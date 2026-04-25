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

`/tmp/gm-demo/` keeps a tiny rig. None of it knows anything about the bot:

| File | Purpose |
|---|---|
| `enter-demo.sh` | Spawns an interactive sub-shell with `PROMPT='demo %~ %# '`, terminal title `demo`, cwd `/tmp/blank`, neutral git envs. Exit returns to parent. **Primary entry point.** |
| `.zshrc` | Loaded by the sub-shell via `ZDOTDIR=/tmp/gm-demo`. Sets prompt, title, and aliases `claude` → `claude --permission-mode bypassPermissions` so WebFetch and Bash execute without prompts. The global `dontAsk` policy stays in force outside the sub-shell. |
| `setup.sh` / `restore.sh` | Macos-level hostname swap. Cosmetic — supplanted by `enter-demo.sh`'s prompt override. Kept for paranoia. |
| `scan.sh` | Read-only grep for identifying strings. |

The username `maxguillabert` is the macOS account name. `scutil` cannot touch it. Only a custom `PROMPT` can hide it. `enter-demo.sh` is therefore the load-bearing piece; everything else is decoration.

What was removed in this revision:

- `~/.claude/commands/gm-bot.md` — the natural-language prompt was triggering a pre-staged skill. Theatre.
- `/tmp/gm-demo/gm-bot.sh` — pre-staged scaffolder. Theatre.
- `/tmp/gm-demo/template/` — local copy of the bot. Theatre.

## The recording, in order

```bash
# Off-camera, once per recording session:
cd /tmp/gm-demo
./enter-demo.sh                 # sub-shell: prompt 'demo /tmp/blank %', title 'demo'

# On-camera, in the sub-shell:
claude "build a twitch trading bot on generalmarket.io"
# Claude WebFetches https://generalmarket.io/llms.txt
# Clones github.com/General-Market/vision-bot-examples
# Runs ./setup.sh --auto-fund
# Runs live_trader.py --strategy momentum --max-joins 1
# First on-chain join lands within 3 minutes.

# When done:
exit                            # leaves the sub-shell. Original prompt returns.
```

Things to avoid on camera (the prompt hides the name; these would surface it): `whoami`, `id`, `echo $USER`, `cd ~`, any path under `/Users/`.

## Why this is reproducible across agents

Determinism comes from `llms.txt` and the public repo, not from any prompt-engineering. Any agent capable of WebFetch + git clone + Python venv arrives at the same set of files and the same first transaction. The bot's wallet is generated fresh on each run, so two recordings produce two different addresses but identical UX.

## Reversal

| Artifact | How to remove |
|---|---|
| Sub-shell | `exit` |
| Hostname change (if `setup.sh` was run) | `cd /tmp/gm-demo && ./restore.sh` |
| Local rig | `rm -rf /tmp/gm-demo /tmp/blank` (or reboot — `/tmp` is volatile) |

Nothing under `~/.gitconfig`, `~/.claude/`, or the index repo was modified. The earlier revision created `~/.claude/commands/gm-bot.md` — that file has been removed.
