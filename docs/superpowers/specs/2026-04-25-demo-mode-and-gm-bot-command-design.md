# Demo Mode + `/gm-bot` Command — Design

**Date:** 2026-04-25
**Author:** dev
**Status:** approved

## Problem

Record a demo of a Twitch trading bot on generalmarket.io being scaffolded and run from a blank Claude Code session, using a single line. Two constraints: no identifying information must appear on screen, and any new Claude Code agent receiving the same line must execute without asking questions.

## Non-goals

- Public installer hosted on a domain (`curl gm.io/install`). Out of scope. Local-machine demo only.
- New macOS user. Out of scope. Same user, neutral path.
- Editing global git config or global `CLAUDE.md`. Out of scope. Per-repo and per-command overrides only.
- Production hardening of the bot itself. The bot is `example-vision-bot/bot.py`, unchanged.

## Design

Three artifacts. All reversible by deletion.

### 1. Demo workspace at `/tmp/gm-demo`

Path resolves to `/private/tmp/gm-demo`. Contains no username segment. `/tmp` is wiped on reboot, which is the cheapest reset.

Initial contents:
- `.git/` with per-repo identity `dev <dev@localhost>`. The user's global git identity is untouched.
- `setup.sh` — backs up current hostname and sets it to `demo`. Idempotent.
- `restore.sh` — restores the original hostname from backup. Idempotent.
- `scan.sh` — greps for known identifying strings under a target directory and prints hits.

### 2. Global slash command at `~/.claude/commands/gm-bot.md`

Markdown with YAML frontmatter. When the user types `/gm-bot twitch`, the command body is loaded directly into the agent's context as an imperative. Slash commands sit above skill routing — brainstorming does not trigger.

The command body:
1. Resolves source name from `$ARGUMENTS`. Default `twitch`.
2. Copies `~/Downloads/index/example-vision-bot/.` into the current working directory. The `~` expansion silently passes through the username path; nothing prints to screen.
3. Writes `config.toml` with `batch_ids = [19]` for `twitch`. (Other sources: empty list, trade all.)
4. Creates a Python venv, installs `web3` and `requests`.
5. Generates a fresh testnet wallet via `eth_account.Account.create()` and writes `BOT_PRIVATE_KEY` to `.env`.
6. Runs `python bot.py` in the foreground. The bot auto-faucets, joins batches, and prints predictions.

Reversible: `rm ~/.claude/commands/gm-bot.md`.

### 3. Helper scripts in `/tmp/gm-demo/`

- `setup.sh`:
  - Reads current `HostName`, `ComputerName`, `LocalHostName` via `scutil`.
  - Saves all three to `/tmp/gm-demo/.hostname-backup`.
  - Sets all three to `demo`.
  - Requires `sudo`. Prints what it changed.
- `restore.sh`:
  - Reads `/tmp/gm-demo/.hostname-backup`.
  - Restores all three. Requires `sudo`.
  - Prints what it restored.
- `scan.sh`:
  - `grep -r -i -E 'max guillabert|maxguillabert|max-otc|maxgctr' "$1"`
  - Prints hits. No mutation.

## The recording, end-to-end

```
$ cd /tmp/gm-demo
$ ./setup.sh                         # one-time before recording
$ claude
> /gm-bot twitch
[claude scaffolds, faucets, runs bot]
[bot prints joined batch 19, predictions stream]
^C                                   # stop the recording
$ ./restore.sh                       # restore hostname
```

Anyone else on a different machine: `git clone <reference>` + `python bot.py` works. Slash command is a local convenience, not a portability requirement.

## Reversal

| Artifact | How to remove |
|---|---|
| `/tmp/gm-demo/` | `rm -rf /tmp/gm-demo` (or reboot) |
| `~/.claude/commands/gm-bot.md` | `rm ~/.claude/commands/gm-bot.md` |
| Hostname change | `./restore.sh` |
| Per-repo git identity | Lives inside `/tmp/gm-demo/.git/config`. Removed with the workspace. |

Nothing under `~/.gitconfig`, `~/.claude/CLAUDE.md`, or the index repo is modified.

## Out-of-band notes

- The user's global `~/.claude/CLAUDE.md` does not contain identifying strings. Verified.
- The user's email (`maxgctr@gmail.com`) is known to the agent through the system prompt. It does not appear on screen unless the user explicitly asks for it. Avoid asking during the recording.
- The bot uses 18-decimal L3 USDC. The faucet endpoint at `https://generalmarket.io/api/faucet` mints 1000 testnet USDC plus gas tokens.
- If testnet is redeployed, the Twitch batch ID may shift from 19. Verify with `curl https://generalmarket.io/api/vision/batches | jq '.batches[] | select(.name | contains("twitch"))'`.
