# Git + Dokploy deploy pipeline

**TL;DR.** Commit your work, then `git push mono main`. A post-commit hook pings Dokploy on VPS 3. Dokploy re-clones mono over SSH, builds `/frontend` with nixpacks, rotates the container. nginx serves it at generalmarket.io. Skipping the push breaks the deploy chain — work that isn't pushed does not exist.

## Mandatory after every task

- Stage **your** files (not other sessions' work), commit, `git push mono main`.
- Sub-agents are authorized to push to `mono main`. Standing override.
- Never `isolation: "worktree"`. Everyone works on main.
- Never deploy directly — no `vercel`, no manual `docker build && push`, no SSH'ing to bounce containers. The pipeline handles it.
- Pre-push safety: `git stash list` + `git diff --cached` to confirm you're not overwriting another session's work.
- Commit messages: descriptive. Never add `Co-Authored-By` trailers.

## Dokploy source

The frontend (generalmarket.io) is a sub-path of the private `General-Market/mono` repo. Dokploy clones over SSH using a read-only deploy key (`mono-readonly` in Dokploy's `ssh-key` table). Build path: `/frontend`. The post-commit hook `scripts/notify-dokploy.sh` pings the webhook; Dokploy re-clones and rebuilds.

The old `gm-frontend` public mirror and its `sync-*.sh` script are gone. Do not recreate. The `nsgame/` subpath stays in mono as code only — nsgame production was killed 2026-05-18.

## Never

- `git init` inside `frontend/`
- `git pull` / `git fetch` from inside `frontend/`
- Recreate the `gm-frontend` remote
- Use Vercel CLI — the project is gone

## Cloudflare blocks the public webhook (2026-06-11)

generalmarket.io moved behind Cloudflare, and its bot challenge 403s every POST to the public `/_dokploy/api/deploy/...` URL. The notify script's ping fails silently in the background — the push succeeds, no deploy ever starts. `notify-dokploy.sh` now hits Dokploy directly at `http://159.195.77.160:3000` (VPS 3, port 3000 is open). If a push doesn't rotate the container within ~10 min, run the script in the foreground to see the HTTP code:

```
bash scripts/notify-dokploy.sh frontend generalmarket.io "$(git rev-parse HEAD)"
```

## Inspecting prod deploys

| Goal | Command |
|------|---------|
| Dokploy admin UI | `https://generalmarket.io/_dokploy/` (proxied on VPS 3) |
| Container list | `ssh vps3 'docker service ls'` |
| Container logs | `ssh vps3 'docker service logs <service-name> --tail 200'` |
| Build logs | `ssh vps3 'ls -t /etc/dokploy/logs/app-*/ \| head -1'` |
| Force redeploy | Dokploy UI, or push an empty commit to `mono main` |
| Verify a deploy landed | `ssh vps3 'docker ps --filter name=app-input --format "{{.CreatedAt}}"'` — CreatedAt must be after your push |

Frontend lives on **VPS 3**, not VPS 2. The GM frontend container is named `app-input-mobile-alarm-jemv3g…`.
