# Operating manual

This file is the canonical shared instruction source for Claude Code, Codex, and other local coding agents. Claude loads it through `CLAUDE.md`; Codex loads it directly.

## CRX — separate repo

All CRX work happens in **`../crx-mono`** (`~/Downloads/crx-mono`, remote `origin` → `github.com/crxfoundation/mono`). It is a client monorepo, separate from General Market — never `git push mono main` from there. Its docs start at [`../crx-mono/docs/architecture.md`](../crx-mono/docs/architecture.md); operating rules are canonical in [`../crx-mono/AGENTS.md`](../crx-mono/AGENTS.md). [`../crx-mono/CLAUDE.md`](../crx-mono/CLAUDE.md) is only the Claude Code bridge. Open anything CRX from that repo, not this one.

## How to talk to me — and how to write for me

Max is AuDHD. Both chat outputs **and** rendered deliverables (docs pages, marketing copy, emails, READMEs, reports) follow the shape below.

### Structure (always)

- **Front-load the answer.** First line = conclusion. Evidence after.
- **Bullets over prose** for any list of 3+ items.
- **Tables** for any comparison with ≥ 3 rows.
- **Define jargon on first use.** Glossary at the bottom if > 3 new terms appear in one document.
- **Estimate effort on every action and link** ("~2 min", "~10 min", "5 commands").
- **One colour, one meaning.** Red = error/warning. Blue = action/link. Green = success. Grey = neutral. No decorative colour.
- **No metaphor where the literal claim works.** Replace *"the nervous system of the protocol"* with *"the service that feeds every other component."*
- **No tonal shifts inside a section.** Pick one register, hold it to the end.
- **No soft modal verbs.** Not "you might want to", not "feel free to". Give the instruction.
- **Closed endings.** Every section ends on a next step, a link, or a definite fact.
- **State exceptions out loud.** Never bury "this doesn't work on X" inside a paragraph.

### Voice inside the structure

Christopher Alexander — patient declarative, plain words first, direct "you", *Therefore:* hinges, weight-bearing italics sparingly. Full reference: [docs/christopher-alexander-style.md](docs/christopher-alexander-style.md). Visual style for any rendered surface: [docs/apple-style-table.md](docs/apple-style-table.md).

### Chat vs rendered deliverables

- **Chat.** Short answers stay short. Don't pad. Don't TL;DR a 3-line response. The full shape engages when the answer would run > 200 words or carry > 2 sections.
- **Rendered deliverables.** Apply the full shape every time. TL;DR card at top, predictable section template, jargon glossary at bottom, time estimates on links.

Where Alexander and AuDHD conflict, **structure wins**. Skip closing aphorisms in chat; keep them in written prose where the reader has chosen to read slowly.

---

## Code quality overrides (always loaded)

These override the default model behaviour to produce production-grade code. Longer explanations: [docs/claude/agent-directives.md](docs/claude/agent-directives.md).

### Before starting

1. **Step 0 — dead code first.** Before any refactor on a file > 300 LOC, remove dead props, imports, exports, debug logs. Commit cleanup separately.
2. **Phased execution.** Multi-file refactors split into phases of ≤ 5 files. Verify between phases. Wait for approval before the next phase.
3. **Plan ≠ build.** "Make a plan" / "think first" = plan only, no code. Given a written plan, follow it exactly. Flag real problems, don't improvise.
4. **Spec for 3+ steps.** Non-trivial features start in plan mode. The spec is the contract.

### Understanding the ask

5. **References > descriptions.** When the user points at existing code, match its patterns exactly. Working code beats English.
6. **Raw data > theories.** Trace the actual error log. Don't guess. No error output? Ask for it.
7. **One-word mode.** "yes" / "do it" / "push" = execute. No recap. No commentary.

### Writing the code

8. **Senior dev override.** Fix flawed architecture, duplicated state, inconsistent patterns. Don't preserve them out of caution.
9. **Verify before claiming complete.** Run `npx tsc --noEmit` and `npx eslint . --quiet` (when configured). Fix all errors. No type-checker? Say so explicitly.
10. **Human code.** No robotic comment blocks. No corporate descriptions of the obvious. Three senior devs would write it the same way — write that.
11. **Demand elegance.** Non-trivial change: ask "is there a cleaner way?" If it feels hacky, do the clean version.

### Managing context

12. **Sub-agent swarm at > 5 files.** 5–8 files per agent. `run_in_background` for long tasks. Don't poll — wait for completion.
13. **Re-read after 10+ messages.** Don't trust memory of file contents. Auto-compaction silently destroys it.
14. **Proactive `/compact`** when you notice degradation. Save point before the wheels come off.
15. **2000-line read budget.** Files > 500 LOC: use offset/limit, read in chunks.
16. **Truncation blindness.** Tool results > 50k chars get silently cut to 2k preview. Suspiciously few results = re-run narrower. State when you suspect truncation.

### File system as state

17. **Agentic search.** Grep, tail, selective read. Save intermediate results to disk. Use bash (`grep`, `jq`, `awk`) for large data.

### Edit safety

18. **Re-read before EVERY edit. Re-read after.** Edit fails silently on stale `old_string`. Max 3 edits per file without a verify-read.
19. **One source of truth.** Never fix a display bug by duplicating state.
20. **Destructive-action safety.** Never delete a file without verifying no references. Exception: `git push mono main` is always authorized.
21. **No semantic search.** You have grep, not AST. Renaming = search separately for direct calls, type refs, string literals, dynamic imports, re-exports, test mocks.

### Cache discipline

22. **Don't break the prefix.** No mid-session model switches (delegate to a sub-agent instead). No mid-session tool changes. Out of context? `/compact` + write summary to `context-log.md`, fork cleanly.

### Self-improvement

23. **Log mistakes** to `gotchas.md` after any correction. Convert to strict rules.
24. **Bug autopsy.** After fixing, explain why it happened and what prevents the category in future.
25. **2-attempt rule.** If a fix doesn't work twice, stop. Re-read the section top-down. Name where the mental model was wrong. "Step back" / "we're going in circles" = drop everything, rethink from scratch.
26. **Fresh eyes.** Testing your own output = new-user persona. Flag confusion.

### Housekeeping

27. **Bug reports = just fix.** Trace logs → resolve. Zero context switching for the user.
28. **File hygiene.** Long files = suggest splitting into smaller focused files.

---

## Git pipeline (always loaded)

**Pipeline:** commit → `git push mono main` → post-commit hook pings Dokploy on **VPS 3** → Dokploy re-clones `General-Market/mono` over SSH (deploy key `mono-readonly`) → builds `/frontend` with nixpacks → rotates the container → Traefik (port 8080) serves it → nginx terminates HTTPS for `generalmarket.io`. Skipping the push breaks the deploy chain. Work that isn't pushed does not exist. Inspection commands and prod-debug details: [docs/claude/git-deploy.md](docs/claude/git-deploy.md).

### After every completed task

- Stage **your** files (not other sessions' work). Commit. `git push mono main`.
- Sub-agents are authorized to push to `mono main`. Standing override.
- Pre-push safety: `git stash list` + `git diff --cached` — confirm you aren't overwriting another session.
- Descriptive commit messages. **Never** add `Co-Authored-By` trailers.

### Never

- `isolation: "worktree"` — everyone works on `main`.
- Deploy directly: no `vercel`, no manual `docker build && push`, no SSH'ing to bounce containers. Pipeline handles it.
- `git init` / `git pull` / `git fetch` inside `frontend/`.
- Recreate the `gm-frontend` public mirror — it's gone, mono is the only source.
- Use the Vercel CLI — the project is gone.

---

## Other always-rules

- **Frontend design.** Any UI surface — component, page, dashboard, landing copy, video composition, social card, slide, table, pitch deck — **read [docs/apple-style-table.md](docs/apple-style-table.md) first**. Type stack, colour values, easings, glass effects, content widths are all sourced from production Apple CSS. No invented numbers. Reference implementations: `video/src/compositions/block-trading/BlockTradingExile.tsx` and `video/src/compositions/market-anatomy/` — match them before inventing new patterns.
- **Video / Remotion.** Read [video/.claude/rules/remotion.md](video/.claude/rules/remotion.md) first.
- **Parallelism cap.** Max 20 agents at the same time.
- **Backward compatibility.** Not a concern. Break interfaces, change function signatures, remove deprecated storage freely.
- **Marketing `.md` files** (persona, copy, positioning, audience research, sales decks) → `/marketing/`. Technical docs → `/docs/`. Auto, don't ask.
- **Design backlog.** Log non-obvious decisions and failed attempts live to `./backlog.md`. Format: [docs/claude/backlog.md](docs/claude/backlog.md).

---

## Topic pointers (lazy-loaded)

Load the relevant file when working on the topic.

| Topic | File | When to load |
|---|---|---|
| Infrastructure (VPS, network, env switching, RPC) | [docs/claude/infra.md](docs/claude/infra.md) | SSH'ing into prod, switching envs, touching RPC config |
| ITP invariants (USDC decimals, backing, BLS, NAV) | [docs/claude/itp.md](docs/claude/itp.md) | Touching ITP, settlement, bridge, oracle pricing, or BLS code |
| Oracles | [docs/claude/oracles.md](docs/claude/oracles.md) | Touching `docker/testnet/oracle/` or oracle logic |
| E2E testing | [docs/claude/e2e.md](docs/claude/e2e.md) | Running or fixing Playwright tests |
| Deployment & prod ops (timings, in-place patches) | [docs/claude/deploy-ops.md](docs/claude/deploy-ops.md) | Running `testnet.sh`, deploying contracts, watching long ops |
| Git inspection commands & Dokploy details | [docs/claude/git-deploy.md](docs/claude/git-deploy.md) | Inspecting prod containers, build logs, force-redeploy |
| Agent directives (full explanations of all 28) | [docs/claude/agent-directives.md](docs/claude/agent-directives.md) | Need the "why" behind a rule, edge-case clarification |
| Parallel consensus debugging | [docs/claude/parallel-debug.md](docs/claude/parallel-debug.md) | UI shows stale data, multi-system bugs, root cause unclear |
| Prose voice (Christopher Alexander) | [docs/christopher-alexander-style.md](docs/christopher-alexander-style.md) | Writing external-facing prose |
| Visual style (Apple) | [docs/apple-style-table.md](docs/apple-style-table.md) | Building any rendered surface |

---

# Vision Bot -- AI Agent Instructions

> You are an autonomous prediction market bot for General Market Vision.
> Read this file completely before writing any code.
> Full docs live at generalmarket.io/docs — sections vision, bots, developers.

## What is Vision?

Vision is a sealed parimutuel prediction market on an Orbit L3 chain. Players predict UP/DOWN on thousands of markets simultaneously using a bitmap encoding. Every tick, predictions are resolved against real data. Better predictors win from worse predictors.

## Available Markets

See `markets.json` — 47 data sources across 16 categories: DeFi, weather, sports, anime, earthquakes, Twitch, congressional trading, nuclear power, NYC subway, and more.

**Show the user the categories from markets.json and let them pick which to trade, or trade all.**

## Quick Start

```bash
cp .env.example .env       # add BOT_PRIVATE_KEY
pip install -r requirements.txt
python bot.py
```

The bot will auto-faucet USDC, discover batches, join with predictions, and loop.

## Environment

Only one variable required:

```
BOT_PRIVATE_KEY=0x...      # wallet private key
```

Everything else has defaults in `config.toml`:

```
L3_RPC_URL=http://159.195.79.153/
API_URL=https://generalmarket.io/api
VISION_ADDRESS=0x36a28967544c301a3c66dcfb6c6c90e548412693
CHAIN_ID=111222333
```

The bot reads USDC address from the Vision contract at runtime.

## CRITICAL: L3 USDC uses 18 decimals

```
0.1  USDC =  100_000_000_000_000_000   (1e17)
1    USDC =  1_000_000_000_000_000_000  (1e18)
10   USDC = 10_000_000_000_000_000_000  (1e19)
```

Min stake: 0.1 USDC (1e17).

## Contract

- **Vision:** 0x36a28967544c301a3c66dcfb6c6c90e548412693
- **Chain:** 111222333 (Orbit L3)
- **USDC:** 18 decimals
- **Fee:** 0.05% on profits

## Auto-Faucet

On startup, if USDC balance < deposit amount, the bot calls:

```
POST https://generalmarket.io/api/faucet
{ "address": "0x...", "amount": "1000" }   # amount optional; default 100 USDC + 1 GM gas
```

Waitlist-gated: a non-whitelisted address gets 403 WAITLIST_REQUIRED. The bot then falls back to `POST /api/bot/faucet` — fixed 100 USDC + 1 GM, one claim per IP and per address per 24h. Disable with `auto_faucet = false` in config.toml.

## Strategies

| Name | Logic |
|------|-------|
| `random` | 50/50 coin flip |
| `momentum` | UP if recent change >= 0 |
| `contrarian` | DOWN if recent change >= 0 |
| `bullish` | 75% UP bias |
| `bearish` | 75% DOWN bias |

Set in config.toml: `strategy = "momentum"` or env: `STRATEGY=momentum`.

## API Reference

Base URL: `https://generalmarket.io/api`  
No authentication.

```
GET  /vision/batches                     -> { batches: BatchSummary[] }
GET  /vision/batch/{id}/state            -> BatchStateResponse
POST /vision/bitmap                      -> { accepted, batch_id, player }
     Body: { player, batch_id, bitmap_hex, expected_hash }
GET  /vision/batch/{id}/history          -> { history: TickHistoryEntry[] }
GET  /vision/leaderboard                 -> { leaderboard: LeaderboardEntry[] }
POST /api/faucet                         -> default 100 USDC + 1 GM; 403 WAITLIST_REQUIRED if not whitelisted
     Body: { address, amount? }
POST /api/bot/faucet                     -> fallback: fixed 100 USDC + 1 GM, 1 claim/24h per IP and per address
     Body: { address }
(GET /vision/balance/{batch_id}/{player} is DEAD — handler never routed; always 404)
```

## Bot Lifecycle

1. Load `.env` + `config.toml`
2. Connect to L3 RPC, read USDC address from Vision contract
3. Check balance → auto-faucet if low
4. Register bot on-chain (one-time)
5. **Loop:**
   a. Fetch active batches from API (or scan chain)
   b. For each un-joined batch: read configHash from chain, fetch market list from data-node
   c. Generate predictions (strategy), encode bitmap, hash it
   d. Approve USDC, call `joinBatchDirect(batchId, configHash, deposit, bitmapHash)`
   e. Submit bitmap to oracle: `POST /vision/bitmap`
   f. Sleep `poll_interval` seconds, repeat

## Bitmap Encoding

```python
# Each market = 1 bit: UP=1, DOWN=0
# Big-endian: market 0 = MSB of byte 0
# Bytes = ceil(market_count / 8)
# Hash = keccak256(bitmap_bytes)
```

## Error Reference

| Error | Fix |
|-------|-----|
| `AlreadyJoined` | Already in batch, skip |
| `DepositBelowMinimum` | Deposit >= 0.1 USDC (no stake parameter exists — the deposit is the stake) |
| `BatchPaused` | Skip, try another |
| `TickLocked` | Wait for next tick |
| Bitmap 404 | Chain indexer lag, retry in 5s |
| Bitmap 400 | Hash mismatch, verify keccak256 |

## Reference Implementation

`bot.py` — single file, ~400 lines, everything self-contained.
