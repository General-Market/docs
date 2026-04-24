# nsgame ↔ Solana Indexer Wiring

How nsgame reaches the event indexer's Postgres on VPS 3. A choice between
proximity and theatre. We choose proximity.

---

## 1. Objective

The event indexer writes to a Postgres on VPS 3 that listens on
`127.0.0.1:5432`. By design. The
`nsgame/app/api/events/{stream,recent,history}/route.ts` handlers query
that database. They cannot, from elsewhere, query what they cannot
reach.

Postgres listens where we told it to listen. The service that needs it
must come to it. So nsgame moves to VPS 3.

---

## 2. Option A (recommended) — nsgame on Dokploy on VPS 3

VPS 3 already runs the production frontend under Dokploy. The pattern
is proven: mono → mirror repo → Dokploy webhook → Traefik → nginx
terminates HTTPS. nsgame inherits the same pipeline. Same surface,
same operator muscle memory, same renewal timer.

### 2.1 Git mirror — `nsgame-frontend.git`

The mono repo holds `nsgame/`. Dokploy reads from a single-purpose
GitHub remote. The link between them is a post-commit hook that mirrors
`nsgame/` whenever its files change.

**Reference:** the existing hook at
`/Users/maxguillabert/Downloads/index/scripts/sync-frontend.sh` mirrors
`frontend/` to `gm-frontend`. The new hook does the same for `nsgame/`.

**Proposed file:** `/Users/maxguillabert/Downloads/index/scripts/sync-nsgame.sh`

What it must do:

1. From the mono root, build a tree object from `nsgame/` only:
   `git ls-tree HEAD -- nsgame/ | sed 's|\tnsgame/|\t|' | git mktree`
2. Fetch the remote head from `nsgame-frontend` (proposed remote name).
   Parent the new tree on `FETCH_HEAD` if it exists; orphan it
   otherwise.
3. Push the synthetic commit to `nsgame-frontend/main`.
4. POST to the Dokploy webhook for the nsgame app. Custom-Git sources
   in Dokploy do not auto-poll — without the POST, nothing rebuilds.
5. Foreground the curl with three retries and a 15s timeout, exactly as
   `sync-frontend.sh` does. Backgrounded curls die with the post-commit
   shell.

**Wire-up:** add a hook line that runs `sync-nsgame.sh` only when
`nsgame/` files changed in `HEAD`. The existing `.git/hooks/post-commit`
should pattern-match `git diff-tree --name-only HEAD` against `^nsgame/`.

The mono push remains the only deploy gesture. Push triggers both
mirrors. Both mirrors trigger their respective Dokploy apps. One
keystroke, two production rebuilds.

### 2.2 Dokploy app — provisioning checklist

Open the Dokploy admin UI:
`https://generalmarket.io/_dokploy/`

Create a new application. Suggested fields:

| Field | Value |
|---|---|
| Project | reuse existing project, or create `nsgame` |
| App name | `nsgame` |
| Source type | Custom Git |
| Repo URL | `git@github.com:<owner>/nsgame-frontend.git` (see open questions) |
| Branch | `main` |
| Build type | Nixpacks |
| Nixpacks config path | `nixpacks.toml` (root) |
| Healthcheck path | `/api/health` if added; otherwise `/` |

After first deploy, capture the webhook URL from the Dokploy UI under
the app's *Deployments → Webhook* panel. That URL goes into
`sync-nsgame.sh`.

**Environment variables.** From `nsgame/package.json` and `next.config.ts`,
the runtime needs at minimum:

| Var | Value | Source |
|---|---|---|
| `POSTGRES_URL` | `postgres://indexer:<password>@host.docker.internal:5432/prediction_market_indexer` | matches `/etc/prediction-indexer.env` on VPS 3 |
| `POSTGRES_SCHEMA` | `prediction_market` | indexer default |
| `NEXT_PUBLIC_RPC_URL` | `https://api.devnet.solana.com` | devnet for now |
| `NEXT_PUBLIC_PROGRAM_ID` | `DQwMnwQGYuLDvciSFZNgUvcHkA3Buyhk3ejgbACvSydA` | from `vps3-receipt.md` |
| `DOCS_URL` | `https://docs.generalmarket.io` (or nsgame-specific docs host) | `next.config.ts` |
| `BACKEND_URL` | `https://api.generalmarket.io` | data-node passthrough |
| `NODE_ENV` | `production` | — |

The Postgres password lives only in `/etc/prediction-indexer.env` on
VPS 3. Read it once, paste it into Dokploy's env editor, never write it
to the repo. If it rotates, both files rotate together.

**Reaching the host Postgres from inside the container.** Dokploy runs
Docker. Postgres listens on the host's `127.0.0.1:5432`, invisible to
the container. Two viable hostnames:

- **`host.docker.internal`** — needs `extra_hosts: host.docker.internal:host-gateway`
  on Linux. Add it in Dokploy's *Advanced → Extra Hosts*.
- **`172.17.0.1`** — the `docker0` bridge gateway. Stable until someone
  reconfigures the bridge.

Prefer `host.docker.internal` with the explicit `extra_hosts` entry.

Postgres itself must accept the bridge. Confirm `pg_hba.conf` allows
the `indexer` role from `127.0.0.1/32` and `172.17.0.0/16`. Add the
bridge line if missing.

### 2.3 `nixpacks.toml` — draft

Mirror the existing `frontend/nixpacks.toml` discipline: pin Node 20,
prefer `npm install` over `npm ci` because lockfiles drift between
local and CI faster than they should.

Place at `nsgame/nixpacks.toml`:

```toml
[phases.install]
cmds = ["npm install --no-audit --no-fund"]

[variables]
NIXPACKS_NODE_VERSION = "20"
```

`package.json` already pins `"engines": { "node": "20.x" }` — this only
restates the pin where Nixpacks reads it. The `prebuild` script in
`package.json` (`npx tsx scripts/build-founders-lookup.ts`) runs as part
of `npm run build` automatically. Nothing to add for it.

### 2.4 Domain & nginx

Dokploy assigns Traefik routing internally on VPS 3. nginx on VPS 3
terminates HTTPS publicly and reverse-proxies to Traefik on
`127.0.0.1:8080`. Same pattern as `generalmarket.io`.

**Proposed domain:** `nsgame.dev` (apex), with `play.nsgame.dev` as a
candidate if the apex must remain marketing. The decision is in *Open
Questions*.

DNS: A record on the chosen domain points to `178.104.243.94`. Cloudflare
gray cloud (DNS-only) — same posture as `generalmarket.io` because LE
DNS-01 lives at `/root/.secrets/cloudflare-dns.ini` and orange cloud
breaks the WebSocket-style SSE buffering nsgame's `/api/events/stream`
needs.

**LE issuance:**

```bash
certbot certonly --dns-cloudflare \
  --dns-cloudflare-credentials /root/.secrets/cloudflare-dns.ini \
  -d nsgame.dev -d www.nsgame.dev \
  --agree-tos -m ops@nsgame.dev --non-interactive
```

`certbot.timer` already exists on VPS 3 — renewals are automatic.

**Draft nginx vhost** at `/etc/nginx/sites-available/nsgame.dev`:

```nginx
server {
    listen 443 ssl http2;
    listen 443 quic reuseport;
    server_name nsgame.dev www.nsgame.dev;

    ssl_certificate     /etc/letsencrypt/live/nsgame.dev/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/nsgame.dev/privkey.pem;
    add_header Alt-Svc 'h3=":443"; ma=86400' always;

    # SSE: never buffer event streams. /api/events/stream must flush.
    location /api/events/stream {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host            $host;
        proxy_set_header Connection      "";
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 24h;
    }

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host            $host;
        proxy_set_header Upgrade         $http_upgrade;
        proxy_set_header Connection      "upgrade";
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}

server {
    listen 80;
    server_name nsgame.dev www.nsgame.dev;
    return 301 https://$host$request_uri;
}
```

`ln -s` into `sites-enabled/`, `nginx -t`, reload.

### 2.5 Deploy trigger

The pattern is settled. The script does the work. No human clicks
*Rebuild* in Dokploy after the first capture.

```
mono push → post-commit hook detects nsgame/ change
          → sync-nsgame.sh builds tree, pushes to nsgame-frontend/main
          → POST https://generalmarket.io/_dokploy/api/deploy/<token>
          → Dokploy pulls, nixpacks builds, Traefik routes, nginx serves
```

The Dokploy refresh token sits in the Dokploy UI under the app's
deployment settings. Capture it once, paste into `sync-nsgame.sh`, treat
it as the rotation pivot if the app is ever recreated.

---

## 3. Option B — Cloudflare Tunnel or Tailscale

Expose `127.0.0.1:5432` over a tunnel. Vercel (or any host) connects to
the tunnel endpoint as if it were a local Postgres.

| Concern | Cost |
|---|---|
| New surface | a long-lived tunnel daemon on VPS 3 |
| Auth | tunnel ACL + Postgres role — two layers to misconfigure |
| Latency | every query crosses the public network twice |
| Failure mode | tunnel hiccup → frontend serves empty event lists silently |

Viable, second choice. More moving parts to break, more accounts to
own. The chain is longer and every link is one we did not have to add.

---

## 4. Option C — read-only HTTP proxy on VPS 3

A small service on VPS 3 — a hundred lines of Rust or Node — wraps the
indexer tables behind HTTPS endpoints. nsgame, hosted anywhere, calls
those endpoints. The proxy reads only; writes are impossible by
construction.

Cheapest external surface, since it speaks HTTPS and nothing else. Most
new code, since every endpoint nsgame currently writes against
`pg.checkout()` becomes a route in the proxy plus a fetch on the
nsgame side. SSE has to be forwarded too, which means re-implementing
the LISTEN/NOTIFY bridge inside the proxy. A second indexer in
disguise.

---

## 5. Decision & rationale

Choose A. The frontend deployment pattern already exists on VPS 3 and
runs in production. Adding a sibling app reuses Dokploy, Traefik,
nginx, the LE timer, and the post-commit-hook discipline. No new
service, no new tunnel, no new ACL. The Postgres stays on loopback.
nsgame just moves into the same building.

**Proceed with A unless user overrides.**

---

## 6. Open questions

1. **Production domain.** `nsgame.dev` apex, or `play.nsgame.dev`? The
   apex is cleaner; `play.` leaves room for a marketing site later. DNS
   and certbot issuance depend on the answer.
2. **GitHub ownership.** Does `nsgame-frontend.git` live under the
   existing `General-Market` org alongside `frontend.git`, or under a
   new `nsgame`-named org / personal account? Ownership decides who can
   rotate the Dokploy deploy key.
3. **Dokploy project.** Cohabit with the existing `frontend` Dokploy
   app under one project, or carve a separate `nsgame` project? Same
   project means shared env-var clipboard hygiene. Separate project
   means cleaner rollback blast radius.

---

## 7. Rollback

Blast radius is small. Postgres is read-only from nsgame's perspective
— no schema to undo, no row to retract.

1. In the Dokploy UI, *Stop* the nsgame app. Traefik stops routing.
2. If users are hitting it mid-incident, flip the `nsgame.dev` A record
   off `178.104.243.94`. Cloudflare propagates within a minute.
3. Leave indexer, Postgres, and mirror repo untouched. None depend on
   nsgame being up.
4. To re-enable: start the app, re-point DNS. No replay.

What rolls back, rolls back. What stays running, stays running.
