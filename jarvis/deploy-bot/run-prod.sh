#!/usr/bin/env bash
# Per-surface LIVE deploy. Called ONLY by the host watcher (host-deploy.sh),
# which is fired by an approved Jarvis /golive tap. Each surface ships alone.
#
#   run-prod.sh app      → rotate crxfx-frontend :3100 (apex/landing assets)
#                          + promote CURRENT dev root → crx-zk-root-prod :3173 (app.crxfx.com '/')
#   run-prod.sh docs     → rotate crxfx-docs     :3110  (docs.crxfx.com)
#   run-prod.sh landing  → copy landing-dev10 html + assets → /var/www/crxfx.com (crxfx.com)
#   run-prod.sh blog     → copy blog html → /var/www/crxfx-blog (blog.crxfx.com)
#   run-prod.sh solver-dash → sync solver-dash/ → /opt/crx-inventory-dash, restart crx-inventory-dash (solver.crxfx.com)
#   run-prod.sh explorer → SAME as app (rotate :3100 + promote dev root → :3173); explorer.crxfx.com is an nginx vanity on :3173
set -uo pipefail
TARGET="${1:-}"
REPO=ghcr.io/crxnetwork/ui
IMG="$REPO:prod-latest"
LOG=/opt/crxfx/deploy.log
log(){ echo "[$(date -u +%FT%TZ)] $*" >> "$LOG"; }
exec 9>/opt/crxfx/deploy.lock; flock 9
ENVFILE=""; [ -f /opt/crxfx/secrets.env ] && ENVFILE="--env-file /opt/crxfx/secrets.env"

rotate() {  # $1=name $2=port
  docker pull "$IMG" >>"$LOG" 2>&1 || { echo "pull failed"; return 1; }
  docker rm -f "$1" >/dev/null 2>&1 || true
  # Status-page history persists on the HOST so a redeploy never wipes the
  # uptime strips (mirrors the dev writers build-dev.sh/deploy.sh). Only the
  # app image writes there; the mount is harmless for the other surfaces.
  mkdir -p /opt/crxfx/status-history
  # shellcheck disable=SC2086
  docker run -d --name "$1" --restart unless-stopped $ENVFILE \
    -e CRX_STATUS_HISTORY_FILE=/var/crx-status/history.json \
    -e CRX_STATUS_CANARY_FILE=/var/crx-status/canary.json \
    -v /opt/crxfx/status-history:/var/crx-status \
    -p 127.0.0.1:$2:3000 "$IMG" >/dev/null || return 1
  # Portal live-mint reach: attach the just-rotated container to crx-api's docker
  # network so a portal-carrying frontend can call http://crx-api:8090 by service
  # name. crx-api binds 127.0.0.1:8090 on the host — a bridged container cannot
  # reach that, and we must NOT expose the admin port / bind 0.0.0.0 (VPS3 has no
  # firewall). GUARDED + non-fatal: a missing crx-api or a failed connect never
  # aborts an otherwise-good rotation, and the extra network is inert for surfaces
  # that don't call crx-api (docs/dataroom) and for the frontend unless MODE=live.
  connect_crx_api_net "$1"
  return 0
}

# Discover crx-api's OWN docker network from the running container (so a compose
# project-name change can't strand us) and attach $1 to it if not already joined.
# Falls back to the compose default `crx_default`. Always returns 0 — reachability
# for portal live-mint is best-effort; PREVIEW mode is the safe default without it.
connect_crx_api_net() {  # $1=container to attach
  local net
  net=$(docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{println $k}}{{end}}' crx-api 2>/dev/null | grep -vx bridge | head -1)
  [ -n "$net" ] || net=crx_default
  docker network inspect "$net" >/dev/null 2>&1 || { log "crx-api net '$net' absent — skip attach (portal live-mint off until crx-api is up)"; return 0; }
  if docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{println $k}}{{end}}' "$1" 2>/dev/null | grep -qx "$net"; then
    return 0  # already attached — nothing to do
  fi
  if docker network connect "$net" "$1" >/dev/null 2>&1; then
    log "$1 joined crx-api net '$net'"
  else
    log "WARN: could not join '$1' to crx-api net '$net' — portal live-mint may stay in PREVIEW"
  fi
  return 0
}

# Promote the CURRENT dev root (whatever app.dev.crxfx.com '/' serves right now)
# to prod root. app.crxfx.com 'location /' proxies :3173 (cut over 20260714);
# crxfx-frontend:3100 stays alive above it — the apex homepage and its asset
# proxy still ride it, and it is the instant rollback for the root.
# The dev root PORT changes on every dev deploy, so it is parsed live from the
# zk-internal vhost — never hardcoded, never a stale fallback. Fails LOUD.
promote_zk_root() {
  local vhost=/etc/nginx/sites-enabled/crxfx-zk-internal
  local envfile=/opt/crx/zk-frontend-root.env
  local devport img ts i
  devport=$(sed -nE 's#^[[:space:]]*location / +\{ *proxy_pass http://127\.0\.0\.1:([0-9]+);.*#\1#p' "$vhost" | head -1)
  [ -n "$devport" ] || { echo "zk-root promote: cannot parse dev root port from $vhost"; log "zk-root promote FAILED: no dev port in $vhost"; return 1; }
  img=$(docker inspect -f '{{.Image}}' "$(docker ps --filter "publish=$devport" --format '{{.Names}}' | head -1)" 2>/dev/null)  # pin immutable sha256 image ID; {{.Image}} tag name drifts if rebuilt mid-flight
  [ -n "$img" ] || { echo "zk-root promote: no running container publishes 127.0.0.1:$devport"; log "zk-root promote FAILED: no container on :$devport"; return 1; }
  # Runtime keys (FAUCET_PRIVATE_KEY_* etc) live in the env-file, NOT the image.
  # Recreating without it silently ships a keyless faucet — hard-stop instead.
  [ -f "$envfile" ] || { echo "zk-root promote: $envfile missing — refusing keyless run"; log "zk-root promote FAILED: $envfile missing"; return 1; }
  ts=$(date -u +%Y%m%d-%H%M)
  docker tag "$img" crx-zk-frontend:prod-root
  docker tag "$img" "crx-zk-frontend:prod-root-$ts"   # dated rollback anchor
  docker rm -f crx-zk-root-prod >/dev/null 2>&1 || true
  docker run -d --name crx-zk-root-prod --restart unless-stopped \
    --env-file "$envfile" \
    -p 127.0.0.1:3173:3000 crx-zk-frontend:prod-root >/dev/null \
    || { echo "zk-root promote: docker run failed"; log "zk-root promote FAILED: docker run"; return 1; }
  for i in $(seq 1 30); do
    if curl -fsS http://127.0.0.1:3173/swap >/dev/null 2>&1; then
      log "zk-root promoted: $img (dev :$devport) → crx-zk-root-prod:3173, tag prod-root-$ts"
      echo "zk-root → crx-zk-root-prod:3173 @ $img (rollback tag prod-root-$ts)"
      return 0
    fi
    sleep 1
  done
  echo "zk-root promote: health gate FAILED — :3173/swap never answered"; log "zk-root promote FAILED: health gate :3173/swap"; return 1
}

case "$TARGET" in
  app)
    rotate crxfx-frontend 3100 || { echo "app deploy FAILED"; exit 1; }
    promote_zk_root || { echo "app zk-root promote FAILED"; exit 1; }
    echo "app → crxfx-frontend:3100 @ prod-latest + crx-zk-root-prod:3173 @ dev-root promote" ;;
  explorer)
    # explorer.crxfx.com has NO artifact of its own — it is a clean-root nginx
    # vanity (sites-enabled/crxfx-explorer) onto the app root zk container
    # crx-zk-root-prod :3173. Shipping the explorer is therefore the SAME motion
    # as `app`: rotate the shared apex frontend (:3100) and promote the CURRENT
    # dev root to :3173. Nothing explorer-specific to rotate. The only difference
    # is the health gate — host-deploy.sh curls https://explorer.crxfx.com for
    # this target; promote_zk_root already gates :3173/swap here.
    rotate crxfx-frontend 3100 || { echo "explorer deploy FAILED"; exit 1; }
    promote_zk_root || { echo "explorer zk-root promote FAILED"; exit 1; }
    echo "explorer → crxfx-frontend:3100 @ prod-latest + crx-zk-root-prod:3173 @ dev-root promote (explorer.crxfx.com)" ;;
  docs)
    rotate crxfx-docs 3110 || { echo "docs deploy FAILED"; exit 1; }
    # First docs deploy cuts docs.crxfx.com over from the shared :3100 to :3110.
    if grep -q "127.0.0.1:3100" /etc/nginx/sites-available/crxfx-docs 2>/dev/null; then
      sed -i "s#proxy_pass http://127.0.0.1:3100#proxy_pass http://127.0.0.1:3110#" /etc/nginx/sites-available/crxfx-docs
      nginx -t >>"$LOG" 2>&1 && systemctl reload nginx && log "docs vhost → :3110"
    fi
    echo "101 → crxfx-docs:3110 @ prod-latest" ;;
  landing)
    git -C /opt/crxfx/ui fetch -q origin main && git -C /opt/crxfx/ui checkout -q origin/main -- marketing || { echo "landing fetch FAILED"; exit 1; }
    d=/var/www/crxfx.com; mkdir -p "$d"
    # The homepage is frontend/public/landing-dev10.html — the file the app
    # also serves at /landing-dev-3 and /landing-dev10, installed here as
    # index.html with its two asset dirs. crxfx-landing.nginx (applied below)
    # serves all three from this docroot: /golive landing ships the homepage
    # alone, and dev.crxfx.com previews exactly what the next tap makes live.
    # The retired marketing/index.html stays out; 404.html is its honest heir.
    git -C /opt/crxfx/ui checkout -q origin/main -- \
      frontend/public/landing-dev10.html frontend/public/landing-dev10-lib frontend/public/landing/fonts \
      || { echo "landing homepage fetch FAILED"; exit 1; }
    install -m0644 /opt/crxfx/ui/frontend/public/landing-dev10.html "$d/index.html"
    for a in landing-dev10-lib landing/fonts; do
      mkdir -p "$d/$a"
      rsync -a --delete "/opt/crxfx/ui/frontend/public/$a/" "$d/$a/" || { echo "landing asset sync FAILED ($a)"; exit 1; }
    done
    for f in 404.html robots.txt sitemap.xml llms.txt og.png favicon.svg favicon.ico \
             apple-touch-icon.png android-chrome-192x192.png android-chrome-512x512.png \
             site.webmanifest icon-maskable.svg; do
      [ -f "/opt/crxfx/ui/marketing/$f" ] && install -m0644 "/opt/crxfx/ui/marketing/$f" "$d/$f"
    done
    for f in /opt/crxfx/ui/marketing/[0-9a-f]*.txt; do [ -f "$f" ] && install -m0644 "$f" "$d/"; done
    # The apex hero film is a landing-owned asset — nginx serves /crx-film/ from
    # this docroot, not the desk app. Sync the WHOLE dir (single source of truth:
    # frontend/public/crx-film) so a new cut ships on THIS /golive landing with no
    # cache-buster: the changed file makes browsers and Cloudflare refetch on
    # revalidation. Best-effort — a film hiccup must not block the SEO shell.
    if git -C /opt/crxfx/ui checkout -q origin/main -- frontend/public/crx-film 2>/dev/null; then
      mkdir -p "$d/crx-film"
      rsync -a --delete /opt/crxfx/ui/frontend/public/crx-film/ "$d/crx-film/" && log "landing crx-film synced"
    else
      log "landing crx-film: nothing to sync (path absent)"
    fi
    # Apply the apex nginx (carries the no-cache header so deploys aren't masked
    # by a stale browser shell). Reload only if the config tests clean.
    if [ -f /opt/crxfx/ui/marketing/crxfx-landing.nginx ]; then
      install -m0644 /opt/crxfx/ui/marketing/crxfx-landing.nginx /etc/nginx/sites-available/crxfx-landing
      nginx -t >>"$LOG" 2>&1 && systemctl reload nginx && log "landing nginx reloaded"
    fi
    echo "landing → /var/www/crxfx.com @ $(git -C /opt/crxfx/ui rev-parse --short origin/main)" ;;
  blog)
    # Sync the WHOLE blog dir (every page + asset), not one hardcoded file — the
    # same convention the dev helper uses, so a new post can't silently vanish.
    git -C /opt/crxfx/ui fetch -q origin main && git -C /opt/crxfx/ui checkout -q origin/main -- frontend/public/blog || { echo "blog fetch FAILED"; exit 1; }
    s=/opt/crxfx/ui/frontend/public/blog; d=/var/www/crxfx-blog
    stage="$(mktemp -d "$(dirname "$d")/.crxfx-blog.XXXXXX")" || { echo "blog stage FAILED"; exit 1; }
    cp -a "$s"/. "$stage"/
    # blog.crxfx.com serves '/' from index.html; prefer a shipped index.html,
    # else fall back to the home post.
    [ -f "$stage/index.html" ] || cp "$stage/intro-to-fx-risk.html" "$stage/index.html"
    chmod 0755 "$stage"; find "$stage" -type f -exec chmod 0644 {} +
    if [ -d "$d" ]; then rm -rf "$d.old"; mv "$d" "$d.old"; fi
    mv "$stage" "$d"; rm -rf "$d.old"
    echo "blog → /var/www/crxfx-blog (full dir) @ $(git -C /opt/crxfx/ui rev-parse --short origin/main)" ;;
  solver-dash)
    # Static-ish surface like `landing`: pull the host-side ui checkout, sync the
    # dashboard into its runtime dir, bounce the service. server.py serves
    # index.html fresh per request (no-store), so an index-only change needs no
    # restart — we restart anyway so a server.py change always takes effect.
    git -C /opt/crxfx/ui fetch -q origin main && git -C /opt/crxfx/ui checkout -q origin/main -- solver-dash || { echo "solver-dash fetch FAILED"; exit 1; }
    d=/opt/crx-inventory-dash
    for f in index.html server.py chains.json; do
      [ -f "/opt/crxfx/ui/solver-dash/$f" ] && install -m0644 "/opt/crxfx/ui/solver-dash/$f" "$d/$f"
    done
    systemctl restart crx-inventory-dash || { echo "solver-dash restart FAILED"; exit 1; }
    echo "solver-dash → $d (crx-inventory-dash.service) @ $(git -C /opt/crxfx/ui rev-parse --short origin/main)" ;;
  faucet)
    rotate crxfx-frontend 3100 || { echo "faucet deploy FAILED"; exit 1; }
    git -C /opt/crxfx/ui fetch -q origin main && git -C /opt/crxfx/ui checkout -q origin/main -- scripts/vps3/crxfx-faucet.nginx || true
    [ -f /opt/crxfx/ui/scripts/vps3/crxfx-faucet.nginx ] && install -m0644 /opt/crxfx/ui/scripts/vps3/crxfx-faucet.nginx /etc/nginx/sites-available/crxfx-faucet
    ln -sf /etc/nginx/sites-available/crxfx-faucet /etc/nginx/sites-enabled/crxfx-faucet
    nginx -t >>"$LOG" 2>&1 && systemctl reload nginx && log "faucet vhost + nginx reloaded"
    echo "faucet → crxfx-frontend:3100 + vhost @ $(git -C /opt/crxfx/ui rev-parse --short origin/main)" ;;
  dataroom)
    rotate crxfx-dataroom 3120 || { echo "dataroom deploy FAILED"; exit 1; }
    echo "dataroom → crxfx-dataroom:3120 @ prod-latest" ;;
  developers)
    rotate crxfx-docs 3110 || { echo "developers deploy FAILED"; exit 1; }
    git -C /opt/crxfx/ui fetch -q origin main && git -C /opt/crxfx/ui checkout -q origin/main -- scripts/vps3/crxfx-developers.nginx || true
    [ -f /opt/crxfx/ui/scripts/vps3/crxfx-developers.nginx ] && install -m0644 /opt/crxfx/ui/scripts/vps3/crxfx-developers.nginx /etc/nginx/sites-available/crxfx-developers
    ln -sf /etc/nginx/sites-available/crxfx-developers /etc/nginx/sites-enabled/crxfx-developers
    nginx -t >>"$LOG" 2>&1 && systemctl reload nginx && log "developers vhost + nginx reloaded"
    echo "developers → crxfx-docs:3110 + vhost @ $(git -C /opt/crxfx/ui rev-parse --short origin/main)" ;;
  portal)
    # portal.crxfx.com — the maker-API self-service portal, served at the ROOT of
    # its own host by folding onto the app's /portal subtree. It rotates the SAME
    # crxfx-frontend :3100 as `app`/`faucet` (the /api/portal/* routes + magic-link
    # auth run only in the Next app image), then installs the portal vhost. Because
    # the portal lives in that shared container, rotate() attaches it to crx-api's
    # docker network on EVERY app/faucet/portal rotation — so an `app` deploy can't
    # silently sever the portal's live-mint reach.
    #
    # One-time on-box, first portal golive only (HTTP-01, DNS grey-clouded; do NOT
    # use dns-cloudflare — that cred is dead):
    #   sudo certbot --nginx -d portal.crxfx.com
    #
    # One-time env the human sets (NOT baked in the image). LIVE key-minting needs
    # ALL of these; missing any one keeps the portal in PREVIEW (sample keys) —
    # safe by default, so a half-set box never mints a real prod credential:
    #   /opt/crx/.env          : CRX_API_ADMIN_SECRET=<S>   (crx-api validates x-admin-secret)
    #   /opt/crxfx/secrets.env : CRX_API_ADMIN_SECRET=<S>   (SAME value; the frontend sends it)
    #                            PORTAL_MINT_MODE=live
    #                            CRX_API_URL=http://crx-api:8090
    #                            PORTAL_SIGNING_SECRET=<T>  (magic-link session tokens)
    rotate crxfx-frontend 3100 || { echo "portal deploy FAILED"; exit 1; }
    git -C /opt/crxfx/ui fetch -q origin main && git -C /opt/crxfx/ui checkout -q origin/main -- scripts/vps3/crxfx-portal.nginx || true
    [ -f /opt/crxfx/ui/scripts/vps3/crxfx-portal.nginx ] && install -m0644 /opt/crxfx/ui/scripts/vps3/crxfx-portal.nginx /etc/nginx/sites-available/crxfx-portal
    ln -sf /etc/nginx/sites-available/crxfx-portal /etc/nginx/sites-enabled/crxfx-portal
    nginx -t >>"$LOG" 2>&1 && systemctl reload nginx && log "portal vhost + nginx reloaded"
    echo "portal → crxfx-frontend:3100 + vhost @ $(git -C /opt/crxfx/ui rev-parse --short origin/main)" ;;
  *)
    echo "unknown target: $TARGET"; exit 2 ;;
esac
docker image prune -f >/dev/null 2>&1 || true
log "$TARGET deployed"
