# Demo Mode — Cold-Start Bot Build

**Date:** 2026-04-25 (rev 2 — pre-staging removed)
**Status:** approved

## Intent

Record a Claude Code session that, from a blank slate, builds and runs a Twitch trading bot on generalmarket.io. The viewer must believe nothing was prepared. Any agent given the same prompt on any machine must produce the same result.

## What already exists publicly

The website carries the entire contract:

- `https://generalmarket.io/llms.txt` — 3 KB, points at the public repo, names the strategy interface, gives a three-minute happy path.
- `https://github.com/General-Market/vision-bot-examples` — public, contains `twitch/` with `setup.sh --auto-fund`, `live_trader.py`, ABI, predictors.
- `https://generalmarket.io/api/vision/batches` — open, returns live batch ids by `source_id`.
- L3 testnet faucet, Vision contract address, RPC URL — all in `llms.txt`.

The phrase *"build a twitch trading bot on generalmarket.io"* triggers nothing local. Claude reads `llms.txt`, clones the repo, runs `setup.sh --auto-fund`, runs `live_trader.py --strategy momentum --max-joins 1`. Three minutes to one on-chain join.

## What stays local — anti-doxing only

`/tmp/gm-demo/` keeps three scripts. None of them know anything about the bot:

| Script | Purpose |
|---|---|
| `setup.sh` | Backs up `HostName` / `ComputerName` / `LocalHostName`, sets all three to `demo`. Run once before recording. |
| `restore.sh` | Restores from backup. Run once after recording. |
| `scan.sh` | Greps a directory for identifying strings. Read-only audit. |

What was removed in this revision:

- `~/.claude/commands/gm-bot.md` — the natural-language prompt was triggering a pre-staged skill. Theatre.
- `/tmp/gm-demo/gm-bot.sh` — pre-staged scaffolder. Theatre.
- `/tmp/gm-demo/template/` — local copy of the bot. Theatre.

## The recording, in order

```bash
# Pre-recording, off-camera:
cd /tmp/gm-demo
./setup.sh                      # hostname → demo

mkdir -p /tmp/blank && cd /tmp/blank
# (cwd is now /tmp/blank — no username segment)

# Start recording. Open a new shell so the prompt picks up the new hostname.
claude
> build a twitch trading bot on generalmarket.io
# Claude WebFetches https://generalmarket.io/llms.txt
# Clones github.com/General-Market/vision-bot-examples
# Runs ./setup.sh --auto-fund
# Runs live_trader.py --strategy momentum --max-joins 1
# First on-chain join lands within 3 minutes.

# Stop recording.
cd /tmp/gm-demo && ./restore.sh
```

## Why this is reproducible across agents

Determinism comes from `llms.txt` and the public repo, not from any prompt-engineering. Any agent capable of WebFetch + git clone + Python venv arrives at the same set of files and the same first transaction. The bot's wallet is generated fresh on each run, so two recordings produce two different addresses but identical UX.

## Reversal

| Artifact | How to remove |
|---|---|
| Hostname change | `cd /tmp/gm-demo && ./restore.sh` |
| Anti-dox scripts | `rm -rf /tmp/gm-demo` (or reboot) |
| `/tmp/blank` recording cwd | `rm -rf /tmp/blank` (or reboot) |

Nothing under `~/.gitconfig`, `~/.claude/`, or the index repo was modified. The earlier revision created `~/.claude/commands/gm-bot.md` — that file has been removed.
