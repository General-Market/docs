# jarvis

One Python process. Three watchers + a command listener. One Telegram chat (Max).

| Watcher | Source | What it forwards | State file |
|---|---|---|---|
| Waitlist | Postgres `submissions` (waitlist-pg on dokploy-network) | New signups with full personal payload | `state/submissions.json` |
| Discord | Discord bot in *General Market* server, channel `#general` | Every human message in that one channel | none — websocket, no replay |
| Gmail | IMAP at `imap.gmail.com` for `max@generalmarket.io` | New unread mail, **minus** outreach/warmup spam **and** anything on the runtime ban/mute list | `state/gmail.json` |
| Commands | Telegram getUpdates long-poll | Acts on `ban`/`mute` replies to Gmail forwards | `state/forwarded.json`, `state/blocklist.json` |

Polling, not webhooks. No frontend changes. No Dokploy redeploys.

## Reply commands (Gmail only, today)

Reply to a forwarded Gmail message in Telegram — either directly below or by quoting — with one word:

| Command | Effect on inbox | Effect on Jarvis |
|---|---|---|
| `mute` (also `silence`) | untouched | future mail from that sender is silenced |
| `ban` (also `block`) | all existing INBOX mail from that sender moved to Gmail Trash (recoverable for 30 days) | future mail is silenced |

Parsing is first-word, case-insensitive, trailing text ignored. *"ban — they never stop"* still parses. Sender match is exact email address; the ban does not generalize to a domain. Edit `state/blocklist.json` by hand to undo or extend.

The mapping from Telegram message → Gmail sender lives in `state/forwarded.json`, capped at the last 500 forwards. Older messages can't be acted on; Jarvis will say so.

---

## For an agent walking in cold

You are looking at `jarvis/` under the `index` repo. The service is **already deployed and running** on VPS 3 as a Docker container.

```bash
# is it alive?
ssh vps3 'docker ps --filter name=jarvis --format "{{.Status}}"'

# what has it said recently?
ssh vps3 'docker logs jarvis --tail 50'

# what has it skipped as spam?
ssh vps3 'docker logs jarvis 2>&1 | grep "skipped outreach"'
```

The container is named `jarvis`, attached to `dokploy-network` (so it can reach the in-cluster `waitlist-pg` Postgres by hostname), restart policy `unless-stopped`, env loaded from `/root/jarvis/.env` on the host. State (UIDs and cursors) is bind-mounted from `/root/jarvis/state/`.

### Telegram bot

- Bot id `8485613491`, handle visible in the user's Telegram client.
- Sends to chat `5688211833` (Max, DM with the bot).
- Messages use `parse_mode=HTML`. See `formatters.py` for the three formats.

### Discord bot

- App name "General". Bot user id `1506406898339942550`.
- Lives in guild `1473683174222598353` (*General Market*).
- Watches channel `1473683175484952881` (*#general*) — only this one.
- Requires the **Message Content Intent** toggle in the developer portal. Without it, `msg.content` is empty for non-mentions.

### Gmail

- Connects as `max@generalmarket.io` via an IMAP App Password (Google 2FA must be on).
- On first run, **the watcher snapshots `max(UID)` and forwards nothing.** This is deliberate — Max's inbox had ~28k unread on bootstrap and Telegram is not a backfill device.
- Subsequent polls fetch UIDs strictly greater than the saved cursor that are also `UNSEEN`. Max ten per cycle (`MAX_PER_POLL`).
- An outreach filter (subject regexes + sender domains, defined at the top of `gmail_poller.py`) drops cold-sales blast and email-warmup probes before they hit Telegram. Skipped mail is logged at INFO, not lost — search for `skipped outreach` in the logs.

### Waitlist

- Watches `submissions` (the join form), **not** `whitelisted_wallets` (the redemption side).  
  Earlier prototype used the wrong table — submissions has the personal info the user actually wants in a notification.
- Cursor is `created_at` of the last forwarded row. Wipe `state/submissions.json` to replay everything from now forward.

### Anti-noise rules in effect

- Telegram messages are HTML-formatted with one of three emoji prefixes: 🚪 waitlist, 💬 Discord, 📧 Gmail. Emojis used here per explicit user request — the rest of Cioran-rule prose in the repo stays emoji-free.
- The outreach blocklist in `gmail_poller.py` is the only place to add new spam patterns. Order doesn't matter, any match drops the mail.

---

## File map

```
jarvis/
  main.py              # asyncio orchestrator, SIGTERM-clean
  config.py            # env loader + dataclass
  telegram_client.py   # aiohttp wrapper around Bot API (send + getUpdates)
  formatters.py        # HTML formatters for all three notification types
  waitlist.py          # Postgres submissions poll
  discord_bridge.py    # discord.py client on one channel
  gmail_poller.py      # IMAP poll + outreach filter + ban/mute filter + trash
  command_poller.py    # Telegram getUpdates → ban/mute reply commands
  blocklist.py         # runtime ban/mute list, persisted to state/blocklist.json
  forwarded_index.py   # telegram_msg_id → source mapping, capped LRU on disk
  get_chat_id.py       # one-shot helper to discover TELEGRAM_CHAT_ID
  Dockerfile           # python:3.12-slim, COPY ., CMD python -m jarvis.main
  jarvis.service       # systemd unit (alternative to docker)
  requirements.txt
  .env.example         # template; the real .env lives only locally and on VPS 3
  .gitignore-targets   # state/*.json and .env are excluded at repo root
```

---

## Setup from zero (only if rebuilding the world)

If `jarvis/.env` already exists locally, skip to "Redeploy". Otherwise:

### 1. Rotate the Telegram bot token

The token in `.env` was pasted in plaintext at one point. In BotFather: `/mybots` → bot → `Bot Settings` → `Revoke current token`. Paste the new one into `jarvis/.env`.

### 2. Find the Telegram chat_id

```bash
# DM the bot in Telegram, send /start, then:
python3 -m venv jarvis/.venv
jarvis/.venv/bin/pip install -r jarvis/requirements.txt
jarvis/.venv/bin/python -m jarvis.get_chat_id
# paste the printed id into TELEGRAM_CHAT_ID in jarvis/.env
```

### 3. Discord bot

1. https://discord.com/developers/applications → app → **Bot** → enable **MESSAGE CONTENT INTENT** (privileged).
2. **OAuth2 → URL Generator** → scope `bot`, perms `View Channels` + `Read Message History` + `Send Messages`. Open URL, pick the server, authorize.
3. In Discord, Settings → Advanced → **Developer Mode** on. Right-click the channel → **Copy Channel ID**.
4. Set `DISCORD_BOT_TOKEN` and `DISCORD_CHANNEL_ID` in `jarvis/.env`.

### 4. Gmail App Password

1. https://myaccount.google.com/security — **2-Step Verification** must be on.
2. https://myaccount.google.com/apppasswords — create one named "Jarvis". Strip spaces.
3. Set `GMAIL_USER` and `GMAIL_APP_PASSWORD` in `jarvis/.env`.

### 5. Waitlist DSN

Pull from the frontend Dokploy app's env. The current value lives in `jarvis/.env` already:
```
postgres://waitlist:<redacted>@waitlist-pg:5432/waitlist
```
Hostname `waitlist-pg` only resolves inside `dokploy-network`. For local runs, SSH-tunnel `waitlist-pg:5432` and point the DSN at `127.0.0.1`.

---

## Redeploy

```bash
# from project root
rsync -av --exclude .venv --exclude state --exclude __pycache__ jarvis/ vps3:/root/jarvis/
ssh vps3 'cd /root/jarvis && docker build -t jarvis:test .'
ssh vps3 'docker rm -f jarvis 2>/dev/null; docker run -d --name jarvis \
  --restart unless-stopped \
  --network dokploy-network \
  -v /root/jarvis/state:/app/jarvis/state \
  --env-file /root/jarvis/.env \
  jarvis:test'
ssh vps3 'docker logs jarvis --tail 20'
```

To temporarily disable a watcher, add `-e DISCORD_ENABLED=false` or `-e GMAIL_ENABLED=false` to the `docker run` (or edit `/root/jarvis/.env`).

---

## State files (on VPS 3 at `/root/jarvis/state/`)

| File | Contents | Reset means |
|---|---|---|
| `submissions.json` | `{"last_seen": "<RFC3339>"}` | Replay every submission newer than the timestamp |
| `gmail.json` | `{"max_uid": <int>}` | If you wipe this, next start does a bootstrap (forwards nothing once) |
| `forwarded.json` | `{telegram_msg_id: {source, sender_email, ...}}`, last 500 | Replies to older messages will get "I don't remember that" |
| `blocklist.json` | `{banned_emails: [...], muted_emails: [...]}` | Hand-edit to undo a ban or mute, or to seed a list |

Removing all four files and restarting is the clean way to "start watching from now."

---

## Troubleshooting

| Symptom | First check |
|---|---|
| Container restart-looping | `docker logs jarvis` — usually a malformed `.env` or rotated token |
| Waitlist silent | `docker exec waitlist-pg psql -U waitlist -d waitlist -c "SELECT count(*) FROM submissions"` |
| Discord silent | Is the bot in the server? Is `MESSAGE CONTENT INTENT` still on in the developer portal? |
| Gmail silent | `cat /root/jarvis/state/gmail.json` — if `max_uid` keeps advancing but Telegram is quiet, the spam filter is eating everything. Grep logs for `skipped outreach` |
| Telegram delivers nothing | Token rotated without updating `.env`. Or Max blocked the bot in Telegram |

---

## Operational shape

Three async tasks under one process. If one crashes the whole process exits and Docker restarts it after a moment. Coarse, but Jarvis is too small to deserve granular supervision.

Best-effort everywhere. Telegram outage = dropped messages, no retry queue. Postgres or Gmail outages = paused tick, resumed next loop. The cursors guarantee no duplicates after recovery, not zero loss during the outage.

If you find yourself wanting durability — a retry queue, persistent message log, exactly-once semantics — you're building the wrong tool. Jarvis is a notifier, not a record of truth.
