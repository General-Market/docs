# nsgame ↔ Solana Indexer Wiring

How nsgame reaches the event indexer's Postgres on VPS 3. A choice between
proximity and theatre. We choose proximity — but not yet at production scale.

Decided 2026-04-25: no domain, single monorepo. Dokploy stays on the shelf
until nsgame has a place to live publicly. For now, local development reaches
production data through an SSH tunnel.

---

## 1. Objective

The event indexer writes to a Postgres on VPS 3 that listens on
`127.0.0.1:5432`. By design. The
`nsgame/app/api/events/{stream,recent,history}/route.ts` handlers query
that database. They cannot, from elsewhere, query what they cannot
reach.

Postgres listens where we told it to listen. The service that needs it
must come to it. Today, "the service" is a developer's laptop. Tomorrow,
it will be a deployment on VPS 3 itself. The path matters less than the
fact that it exists.

---

## 2. Phase 0 — SSH tunnel for local development (now)

Cheapest possible door. No new daemon, no new tunnel daemon, no new
service to monitor, no new git remote, no Dokploy config. Forty seconds
of typing.

### 2.1 Tunnel command

On the developer's laptop, in a long-lived shell:

```bash
ssh -N -L 5433:127.0.0.1:5432 vps3
```

Flags:

- `-N` — no remote command. The session exists only to forward the port.
- `-L 5433:127.0.0.1:5432` — bind local `5433` and forward to `127.0.0.1:5432`
  on VPS 3. Local `5433` is chosen to avoid colliding with any local
  Postgres on `5432`.

Leave it running in a terminal. Reconnect when the SSH session drops —
`autossh -M 0 -N -L 5433:127.0.0.1:5432 vps3` if you want it persistent.

### 2.2 nsgame env

In `nsgame/.env.local` (already gitignored):

```ini
POSTGRES_URL=postgres://indexer:<password>@127.0.0.1:5433/prediction_market_indexer
POSTGRES_SCHEMA=prediction_market
NEXT_PUBLIC_RPC_URL=https://devnet.helius-rpc.com/?api-key=<key>
NEXT_PUBLIC_PROGRAM_ID=DQwMnwQGYuLDvciSFZNgUvcHkA3Buyhk3ejgbACvSydA
```

The `<password>` is the same value already in `/etc/prediction-indexer.env`
on VPS 3 (`POSTGRES_URL=postgres://indexer:<...>@127.0.0.1:5432/prediction_market_indexer`).
Read it via `ssh vps3 'cat /etc/prediction-indexer.env'` and paste once.
The `<key>` is the Helius free-tier key already saved in
`.env.data-node` at the mono-repo root.

### 2.3 Run

```bash
cd nsgame
npm install
npm run dev
```

The `app/api/events/*` routes now resolve through the tunnel. SSE streams
work. `LISTEN/NOTIFY` works because Postgres treats the tunneled
connection as local.

### 2.4 Caveats

- The tunnel is single-tenant. Two developers running `npm run dev`
  cannot share one tunnel — each runs their own.
- If the SSH session breaks, queries hang until the tunnel is restored.
  `autossh` papers over flaky links.
- This is a development-time crutch. Do not point a production frontend
  at it.

---

## 3. Phase 1 — Dokploy on VPS 3 from a monorepo subpath (deferred)

Same machine as Postgres, no tunnel, but blocked on a public domain
nsgame does not yet own. Documented now so the work is easy when the
domain question is answered.

### 3.1 The mono-only constraint

Decided 2026-04-25: nsgame ships from this monorepo. No
`nsgame-frontend.git` mirror. No second remote. Dokploy supports
custom-Git sources with a build context path; we point it at the mono
repo and tell it to build only `nsgame/`.

This rules out the elegance of a single-purpose mirror but it ends the
hook-and-fetch dance the existing `frontend/` deployment runs. One
remote, one push, one build context per app.

### 3.2 Dokploy app — provisioning checklist

Open the Dokploy admin UI: `https://generalmarket.io/_dokploy/`

| Field | Value |
|---|---|
| Project | reuse existing project, or create `nsgame` |
| App name | `nsgame` |
| Source type | Custom Git |
| Repo URL | `git@github.com:General-Market/mono.git` |
| Branch | `main` |
| Build context path | `nsgame/` |
| Build type | Nixpacks |
| Nixpacks config path | `nsgame/nixpacks.toml` |
| Healthcheck path | `/api/health` if added; otherwise `/` |

After first deploy, capture the webhook URL from the Dokploy UI under
the app's *Deployments → Webhook* panel. The existing
`scripts/sync-frontend.sh` already triggers a Dokploy deploy after every
mono push for the `frontend/` app; extend it (or fork
`scripts/sync-nsgame.sh`) to POST a second webhook for the `nsgame` app
when `nsgame/` files change. No new git mirror; just a second curl.

### 3.3 Environment variables

| Var | Value | Source |
|---|---|---|
| `POSTGRES_URL` | `postgres://indexer:<password>@host.docker.internal:5432/prediction_market_indexer` | matches `/etc/prediction-indexer.env` on VPS 3 |
| `POSTGRES_SCHEMA` | `prediction_market` | indexer default |
| `NEXT_PUBLIC_RPC_URL` | `https://devnet.helius-rpc.com/?api-key=<key>` | Helius free tier |
| `NEXT_PUBLIC_PROGRAM_ID` | `DQwMnwQGYuLDvciSFZNgUvcHkA3Buyhk3ejgbACvSydA` | from `vps3-receipt.md` |
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

### 3.4 `nsgame/nixpacks.toml` — draft

Mirror the existing `frontend/nixpacks.toml` discipline: pin Node 20,
prefer `npm install` over `npm ci` because lockfiles drift between
local and CI faster than they should.

```toml
[phases.install]
cmds = ["npm install --no-audit --no-fund"]

[variables]
NIXPACKS_NODE_VERSION = "20"
```

`package.json` already pins `"engines": { "node": "20.x" }` — this
restates the pin where Nixpacks reads it. The `prebuild` script in
`package.json` runs as part of `npm run build` automatically. Nothing
to add for it.

### 3.5 Domain & nginx — deferred

Not buying a domain today. When one exists, the nginx vhost on VPS 3
mirrors the existing `frontend/` block: HTTPS via Let's Encrypt DNS-01
(Cloudflare token at `/root/.secrets/cloudflare-dns.ini`), HTTP/2 +
HTTP/3, SSE buffering disabled on `/api/events/stream`. The pattern is
copy-paste from the existing vhost; no new design needed.

### 3.6 Deploy trigger — when Phase 1 lands

```
mono push → post-commit hook detects nsgame/ change
         → POST https://generalmarket.io/_dokploy/api/deploy/<token>
         → Dokploy pulls mono main, builds nsgame/ subdir via nixpacks
         → Traefik routes, nginx serves
```

One push, one rebuild. Same shape as the existing `frontend/` flow,
minus the mirror.

---

## 4. Phase 2 — alternatives, if Phase 1 ever doesn't fit

Kept here for future reference. Today both lose to Phase 0 + 1.

### 4.1 Cloudflare Tunnel or Tailscale

Expose `127.0.0.1:5432` over a tunnel. Vercel (or any host) connects to
the tunnel endpoint as if it were a local Postgres.

| Concern | Cost |
|---|---|
| New surface | a long-lived tunnel daemon on VPS 3 |
| Auth | tunnel ACL + Postgres role — two layers to misconfigure |
| Latency | every query crosses the public network twice |
| Failure mode | tunnel hiccup → frontend serves empty event lists silently |

Viable. More moving parts to break, more accounts to own.

### 4.2 Read-only HTTP proxy on VPS 3

A small service on VPS 3 — a hundred lines of Rust or Node — wraps the
indexer tables behind HTTPS endpoints. nsgame, hosted anywhere, calls
those endpoints. Reads only; writes are impossible by construction.

Cheapest external surface, since it speaks HTTPS and nothing else. Most
new code, since every endpoint nsgame currently writes against
`pg.checkout()` becomes a route in the proxy plus a fetch on the
nsgame side. SSE has to be forwarded too, which means re-implementing
the LISTEN/NOTIFY bridge inside the proxy. A second indexer in
disguise.

---

## 5. Decision

- **Now (2026-04-25):** Phase 0 — SSH tunnel for local development.
  Section 2 is what you implement today.
- **Next:** Phase 1 — Dokploy on VPS 3 from a mono-repo subpath, when
  a domain exists. Section 3 is the work.
- **Never (unless Phase 1 fails):** Phase 2.

---

## 6. Open questions

What was here and is now resolved:

- ~~Production domain.~~ Deferred per `PLAN.md` §3. No domain.
- ~~GitHub ownership of `nsgame-frontend.git`.~~ No mirror. nsgame ships
  from this monorepo.
- ~~Dokploy project layout.~~ Punt to Phase 1 — one Dokploy app per
  product, build context path keeps them isolated regardless of
  project grouping.

What remains:

1. **Phase 1 trigger.** When does nsgame need to be reachable from
   somewhere other than a developer's laptop? The answer determines
   when Phase 0 retires.

---

## 7. Rollback

Phase 0 has nothing to roll back — close the SSH session and the
tunnel dies. No infrastructure outlives the developer's terminal.

Phase 1, when it exists, rolls back the way the existing frontend does:

1. In the Dokploy UI, *Stop* the nsgame app. Traefik stops routing.
2. If users are hitting it mid-incident, flip the chosen DNS record.
3. Leave indexer, Postgres, and mono untouched. None depend on nsgame
   being up.

What rolls back, rolls back. What stays running, stays running.
