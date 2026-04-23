## Investigation Method — Parallel Consensus Agents

When debugging complex issues spanning multiple systems, dispatch 4 sub-agents in parallel. Each agent investigates the FULL problem independently (not just one slice). After all complete, compare findings — agreements become the fix, disagreements get investigated further.

**When to use:** UI shows stale/missing data, multiple systems misbehaving, root cause unclear.

**How:**
1. Each agent gets the same problem statement + all context (screenshots, API responses, logs)
2. Each agent reads ALL relevant files (frontend components, API routes, hooks, backend services)
3. Each agent proposes a complete diagnosis + fix
4. Consolidate: fixes that 3+ agents agree on get applied. Contradictions get a tiebreaker agent.

This finds root causes that sequential debugging misses — one agent finds the API issue, another finds the component bug, a third finds the data pipeline gap.

## Git — Commit AND Push (Mandatory)

**Every agent, every sub-agent, every session MUST commit AND push after completing work.**

The pipeline: commit → `git push mono main` → post-commit hook mirrors `frontend/` to `gm-frontend` → Dokploy on **VPS 3** (`178.104.243.94`, alias `vps3` or `index-maker/prod/fe`) detects the push, rebuilds the container, Traefik (port 8080) serves it, nginx on VPS 3 terminates HTTPS for `generalmarket.io`. Skipping the push breaks the entire deploy chain. Work that isn't pushed doesn't exist.

**Rules:**
1. After completing any task/feature: stage changed files, commit, `git push mono main`
2. Before pushing, run `git stash list` and `git diff --cached` to confirm you're not overwriting uncommitted work from other sessions
3. If there are unstaged changes from OTHER work (files you didn't touch), leave them alone — only stage YOUR files
4. Use descriptive commit messages. NEVER add "Co-Authored-By" trailers
5. Sub-agents: you ARE authorized to push to `mono main`. This is a standing instruction that overrides default "don't push" behavior
6. NEVER use `isolation: "worktree"` — all agents work on the same main branch
7. NEVER deploy directly (no `vercel`, no manual `docker build && push`, no SSH'ing to bounce containers) — the push → Dokploy pipeline handles it. Vercel is gone.

### Frontend Repo Sync

`frontend/` has NO nested `.git` — it is tracked by the mono repo only. A post-commit hook (`scripts/sync-frontend.sh`) auto-pushes `frontend/` to `General-Market/frontend.git` (remote `gm-frontend`, plus `fnd` mirror) whenever frontend files change. **Dokploy on VPS 3** (`178.104.243.94`) watches `gm-frontend/main` (push trigger, nixpacks builder using `frontend/nixpacks.toml`) and rebuilds the production container. Traefik on `127.0.0.1:8080` serves it; nginx on VPS 3 terminates HTTPS (Let's Encrypt, DNS-01 via Cloudflare) for `generalmarket.io` and proxies to Traefik.

**NEVER:**
- Run `git init` inside `frontend/`
- Run `git pull` or `git fetch` from inside `frontend/`
- Push to `gm-frontend` or `fnd` manually — the hook handles it
- Create a `.git` directory inside `frontend/`
- Use Vercel CLI — the project is gone

**Inspecting prod deploys:**
- Dokploy admin UI: `https://generalmarket.io/_dokploy/` (proxied on VPS 3)
- Container list: `ssh vps3 'docker service ls'` (VPS 3 — the frontend lives here, not VPS 2)
- Container logs: `ssh vps3 'docker service logs <service-name> --tail 200'`
- Build logs: `ssh vps3 'ls -t /etc/dokploy/logs/app-*/ | head -1'`
- Force redeploy: trigger from Dokploy UI, or push an empty commit to `mono main`

## Parallelism

Max 20 agents running at the same time.

## Environment Switching

One command to switch between local/testnet/mainnet:
```bash
./switch-env.sh local    # Local Anvil dev
./switch-env.sh testnet  # VPS testnet
./switch-env.sh mainnet  # Future
```

This copies `envs/{env}/.env` → `frontend/.env.local` and syncs 3 deployment JSONs to their destinations. The `.active-env` sentinel tracks current environment.

**Config deduplication:**
- Frontend: all server-side URLs in `frontend/lib/config.ts` — API routes import from there, never read `process.env` directly
- E2E: all test config in `frontend/e2e/env.ts` — helpers/specs import from there
- `IS_ANVIL` (not `IS_TESTNET`) — true when running against local Anvil

After deploying contracts locally, `start.sh` syncs deployment JSONs back to `envs/local/`.
After deploying on testnet, `testnet.sh` syncs back to `envs/testnet/`.

## Network
| Network | Chain ID | RPC | Collateral |
|---------|----------|-----|------------|
| Index L3 (Orbit) | 111222333 | https://rpc.generalmarket.io/ (via nginx+LE on VPS 2, or http://142.132.164.24/ direct) | GM (18 dec) |
| Local Settlement (Anvil) | 421611337 | http://localhost:8546 | — |

**Frontend-accessible HTTPS origins** (added 2026-04-21 to let browsers preconnect + avoid mixed-content):
- `https://rpc.generalmarket.io` → VPS 2 L3 RPC / Blockscout, `/ap` route → AP service on :9100
- `https://api.generalmarket.io` → VPS 1 data-node/oracle1-3/explorer (same routes as the port-80 default site)

Both use Let's Encrypt DNS-01 via the Cloudflare token at `/root/.secrets/cloudflare-dns.ini`. DNS-only (gray-cloud). Renewals are on `certbot.timer`.

## USDC Decimals by Chain

**Critical: L3 and Settlement use different USDC decimals. Never assume 6 everywhere.**

| Chain | USDC Decimals | Where |
|-------|--------------|-------|
| **L3 (Orbit)** | **18** | Vision balances, TVL, PnL, leaderboard, batch pools, VisionReserve |
| **Settlement** | **6** | Settlement USDC deposits, AP keeper balances, bridge custody |

When formatting amounts: check which chain the value comes from. Oracle APIs return L3 values (18 dec). Settlement wallet reads return 6 dec.

## ITP Pricing Model (ETF)

An ITP is a fixed basket of assets, like an ETF. NAV floats with underlying prices.

**At creation** (or rebalance), weights are converted to fixed per-share quantities:
```
ITP starts at $1 (1e18).
qty[i] = (weight[i] * 1e18) / price[i]
```
Example: 100 assets, equal weight (1% each), all at $1 → each qty = 0.01 tokens per share.

**NAV computation** (all layers use this same formula):
```
NAV = sum(qty[i] * price[i]) / 1e18
```

**Key invariants:**
- Quantities are stored on-chain (`_itpInventory`) and ONLY change on rebalance
- Buy/sell do NOT change quantities — they mint/burn proportional shares
- Rebalance recalculates: `qty_new[i] = (w_new[i] * currentNAV) / price[i]` — preserves NAV
- NAV drifts from $1 over time as underlying asset prices change (this is the point)

**Implementation locations:**
- Contract: `Index.sol` — `createITP` (qty computation), `_getCurrentPrice` (NAV), `updateWeights` (rebalance)
- Storage: `IndexStorage.sol` — `_itpInventory[itpId]`
- Oracle: `nav.rs` — `calculate_nav()`, reads inventory via `getITPState`
- Frontend: `useItpNav.ts` — inventory-first, weight fallback for legacy ITPs

## ITP Backing Invariant

**NEVER mint ITP shares without confirmed backing.** Every minted share MUST be 1:1 backed by its underlying tokens.

- `completeBuyOrder` on settlement (which releases USDC to AP for asset purchases) MUST succeed BEFORE shares are minted on L3
- If `completeBuyOrder` fails (gas, revert, timeout), the entire order MUST be rolled back — no shares minted
- The bridge buy flow MUST be atomic: either the full pipeline succeeds (USDC released + assets bought + shares minted) or nothing happens
- Unbacked ITP is the single worst failure mode — worse than stuck orders, worse than slow consensus
- Never "optimistically mint" shares assuming settlement will complete later

## BLS Signature Verification

**NEVER skip BLS verification.** Not in local dev, not in tests, not anywhere.

- No `aggregatedPubkey.length == 0` bypass paths
- No `testMode` flags that bypass BLS
- No `address(oracleRegistry) == address(0)` skip paths
- No `onlyOwner` admin functions that bypass BLS consensus
- Local dev MUST use real BLS signing with test keys registered in OracleRegistry
- Tests MUST use proper BLS test fixtures (precomputed signatures)
- Deploy scripts MUST register oracle BLS keys and set aggregated pubkey

If BLS verification is in the way, fix the BLS pipeline — don't bypass the check.

## Backward Compatibility

Not a concern. Break interfaces, change function signatures, remove deprecated storage freely.


## Oracles

Oracles **only run on VPS** — never locally. Don't create local oracle startup scripts, don't test oracles on localhost.

**Two oracle stacks, two homes — do not mix.**

### Ethereum L3 BLS oracles (existing)
All EVM-side oracle infrastructure lives in `docker/testnet/oracle/` and runs via Docker Compose on **VPS 1**.
- SSH: `ssh index-maker/prod/be`
- Logs: `docker logs oracle-1 --tail 100` (oracle-1, oracle-2, oracle-3)
- Restart: `cd /home/max/index && docker compose -f docker/testnet/oracle/docker-compose.yml restart`

### Solana oracle + indexer + Postgres — **VPS 3 only**
The full Solana stack (oracle daemon, event indexer, its Postgres) runs on **VPS 3 exclusively**. No Solana component runs on VPS 1 or VPS 2 — ever. If you catch a deploy targeting either, stop and re-target.
- SSH: `ssh vps3` (direct, no bastion; user `root`, port 3189) or `ssh index-maker/prod/fe`
- Oracle daemon logs: `journalctl -u prediction-oracle -f`
- Indexer logs: `journalctl -u prediction-indexer -f`
- Postgres: `psql -h 127.0.0.1 -U indexer prediction_market_indexer`
- Binaries built on VPS 3 from `/home/max/index/oracle-daemon/` and `/home/max/index/event-indexer/` (clone or git-pull the mono repo on VPS 3)
- Devnet program: `DQwMnwQGYuLDvciSFZNgUvcHkA3Buyhk3ejgbACvSydA`

Full inventory, env vars, and deploy paths are in `vps.md` under the "VPS 3" section.

## Contracts


## Writing Style — Cioran

All external-facing writing follows the Cioran method. Full guide: `docs/writing-like-cioran.md`

**Applies to:** docs, emails, blog posts, articles, social media, messages to people, landing page copy, error messages, UI microcopy. Does NOT apply to code comments, commit messages, or internal technical notes.

**Core rules:**
- Suppress the road, keep the destination. Delete the argument, publish the conclusion.
- Short declarative sentences. No hedging ("perhaps", "it seems", "one might argue").
- Setup → pivot → knife. The last words carry all the weight.
- Nihilist tenderness: dark observations that reveal care underneath.
- Paradox over explanation. Name the contradiction, don't resolve it.
- No corporate fluff. No "exciting", "innovative", "cutting-edge", "unlock", "leverage".
- No enthusiasm. Dry, precise, warm by accident.
- Every sentence must cost something. If the reader can nod and move on, delete it.

**Combine with format best practices:** Cioran's voice lives INSIDE the format requirements. A docs page still needs frontmatter, code examples, and API signatures — but the prose between them reads like a man who built a protocol because he couldn't help it. An email still has a subject line and a CTA — but the body is three sentences and a knife.

**The test:** Would a reader pause mid-sentence? If not, rewrite.

## E2E Testing Efficiency

For suites >20 tests, **NEVER run the full suite during debugging**. Run only failing tests:
```bash
# Run ONE specific test
npx playwright test --config=e2e/playwright.config.ts e2e/tests/02-buy-itp.spec.ts
# Run by pattern
npx playwright test --grep "buy ITP|sell ITP"
```
- Fix → run individual test → verify → next failure. Never run 176 tests to check 5 fixes.
- Full suite is a FINAL validation step only, after all individual tests pass.
- Time to reach end of dev is the priority. Skip tests we know work.

## Deployment & Prod Operations

**Aggressively monitor long-running operations.** Don't fire-and-forget. Docker builds take 8-12 min, forge deploys take 5-15 min per step, full `testnet.sh deploy --seed` takes 40-60 min. SSH connections drop after ~5 min of idle output.

**Known timings (when things work):**
- Core contracts (step 3): ~3 min (47 txs with --slow)
- Token deploy (step 9): ~10 min (621 txs)
- ITP creation (step 11): ~3 min (96 txs)
- Vault deploy (step 12): ~3 min (96 txs)
- Batch markets (step 12b): ~5 min (96 markets)
- Oracle Docker build: ~8-12 min (Rust compilation)
- Seed buy orders + fills: ~15 min (96 orders at ~10/min)
- Settlement delay: equals tick_duration per source (symmetric — 2m source settles in 2m, 10m in 10m)
- Vision batch first cycle: tick_duration + tick_duration (betting + settlement)

**If something exceeds 2x the expected time, it's stuck — investigate immediately.**

**Rules:**
- Use `nohup` on VPS for anything >5 min (SSH drops kill processes)
- Never redeploy ALL if you can fix in-place (patch addresses, refresh snapshots, restart containers)
- Before redeploying, check: can we just `setITPVault`, `refreshSnapshot`, `recoverAdmin`, or `resetOrderState`?
- Before rebuilding Docker, check: did the code actually change? (`find -newer` check)
- Track deployer nonce — if it jumps unexpectedly, something is sending txs concurrently
- Keep `active-deployment.json` as single source of truth — read on-chain addresses from Index contract to verify

**Orbit L3 specific:**
- CREATE addresses diverge between forge simulation and broadcast
- Always read actual addresses from broadcast receipts, not simulation output
- `--slow` flag prevents most nonce drift but not all
- Settlement delay window (= tick_duration) must pass before oracles resolve batches

## Design Decision Backlog

Log design decisions and failed attempts to `./backlog.md`.

**When to log:**
- New design/architecture decisions
- Approaches that failed (with reason)
- Non-obvious tradeoffs made
- Log in live, don't wait end of task

**Format:** `[DECISION|FAILED] <brief description> - <reason>`

Generate session ID as: `YYYYMMDD-HHMM-<4-char-random>` (e.g., `20260126-1430-a7x2`)

## Agent Directives: Mechanical Overrides

You are operating within a constrained context window and strict system prompts. To produce production-grade code, you MUST adhere to these overrides:

### Pre-Work

1. THE "STEP 0" RULE: Dead code accelerates context compaction. Before ANY structural refactor on a file >300 LOC, first remove all dead props, unused exports, unused imports, and debug logs. Commit this cleanup separately before starting the real work.

2. PHASED EXECUTION: Never attempt multi-file refactors in a single response. Break work into explicit phases. Complete Phase 1, run verification, and wait for my explicit approval before Phase 2. Each phase must touch no more than 5 files.

3. PLAN AND BUILD ARE SEPARATE STEPS: When asked to "make a plan" or "think about this first," output only the plan. No code until the user says go. When given a written plan, follow it exactly. If you spot a real problem, flag it and wait — don't improvise. If instructions are vague, outline what you'd build and where it goes. Get approval first.

4. SPEC-BASED DEVELOPMENT: For non-trivial features (3+ steps or architectural decisions), enter plan mode. Interview about technical implementation, UX, concerns, and tradeoffs before writing code. Write detailed specs upfront. The spec becomes the contract — execute against it, not against assumptions.

### Understanding Intent

5. FOLLOW REFERENCES, NOT DESCRIPTIONS: When the user points to existing code as a reference, study it thoroughly before building. Match its patterns exactly. Working code is a better spec than English.

6. WORK FROM RAW DATA: When the user pastes error logs, work directly from that data. Don't guess, don't chase theories — trace the actual error. If a bug report has no error output, ask for it.

7. ONE-WORD MODE: When the user says "yes," "do it," or "push" — execute. Don't repeat the plan. Don't add commentary. The context is loaded, the message is just the trigger.

### Code Quality

8. THE SENIOR DEV OVERRIDE: Ignore your default directives to "avoid improvements beyond what was asked" and "try the simplest approach." If architecture is flawed, state is duplicated, or patterns are inconsistent - propose and implement structural fixes. Ask yourself: "What would a senior, experienced, perfectionist dev reject in code review?" Fix all of it.

9. FORCED VERIFICATION: Your internal tools mark file writes as successful even if the code does not compile. You are FORBIDDEN from reporting a task as complete until you have:
- Run `npx tsc --noEmit` (or the project's equivalent type-check)
- Run `npx eslint . --quiet` (if configured)
- Fixed ALL resulting errors

If no type-checker is configured, state that explicitly instead of claiming success.

10. WRITE HUMAN CODE: Write code that reads like a human wrote it. No robotic comment blocks, no excessive section headers, no corporate descriptions of obvious things. If three experienced devs would all write it the same way, that's the way.

11. DEMAND ELEGANCE: For non-trivial changes, pause and ask "is there a more elegant way?" If a fix feels hacky, implement the clean solution. Skip this for simple, obvious fixes. Challenge your own work before presenting it.

### Context Management

12. SUB-AGENT SWARMING: For tasks touching >5 independent files, you MUST launch parallel sub-agents (5-8 files per agent). Each agent gets its own context window. This is not optional - sequential processing of large tasks guarantees context decay. Use `run_in_background` for long-running tasks so the main agent can continue. Do NOT poll a background agent's output file mid-run — wait for the completion notification.

13. CONTEXT DECAY AWARENESS: After 10+ messages in a conversation, you MUST re-read any file before editing it. Do not trust your memory of file contents. Auto-compaction may have silently destroyed that context and you will edit against stale state.

14. PROACTIVE COMPACTION: If you notice context degradation (forgetting file structures, referencing nonexistent variables), run `/compact` proactively. Treat it like a save point. Do not wait for auto-compact to fire unpredictably.

15. FILE READ BUDGET: Each file read is capped at 2,000 lines. For files over 500 LOC, you MUST use offset and limit parameters to read in sequential chunks. Never assume you have seen a complete file from a single read.

16. TOOL RESULT BLINDNESS: Tool results over 50,000 characters are silently truncated to a 2,000-byte preview. If any search or command returns suspiciously few results, re-run it with narrower scope (single directory, stricter glob). State when you suspect truncation occurred.

### File System as State

17. AGENTIC SEARCH: Do not blindly dump large files into context. Use bash to grep, search, tail, and selectively read what you need. Write intermediate results to files — this lets you take multiple passes and ground results in reproducible data. For large data operations, save to disk and use bash tools (`grep`, `jq`, `awk`) to process.

### Edit Safety

18. EDIT INTEGRITY: Before EVERY file edit, re-read the file. After editing, read it again to confirm the change applied correctly. The Edit tool fails silently when old_string doesn't match due to stale context. Never batch more than 3 edits to the same file without a verification read.

19. ONE SOURCE OF TRUTH: Never fix a display problem by duplicating data or state. One source, everything else reads from it. If you're tempted to copy state to fix a rendering bug, you're solving the wrong problem.

20. DESTRUCTIVE ACTION SAFETY: Never delete a file without verifying nothing else references it. Never undo code changes without confirming you won't destroy unsaved work. Exception: `git push mono main` is ALWAYS authorized — see Git section above.

21. NO SEMANTIC SEARCH: You have grep, not an AST. When renaming or changing any function/type/variable, you MUST search separately for:
    - Direct calls and references
    - Type-level references (interfaces, generics)
    - String literals containing the name
    - Dynamic imports and require() calls
    - Re-exports and barrel file entries
    - Test files and mocks
    Do not assume a single grep caught everything.

### Prompt Cache Awareness

22. CACHE DISCIPLINE: Your system prompt, tools, and CLAUDE.md are cached as a prefix. Breaking this prefix invalidates the cache for the entire session. Do not request model switches mid-session — delegate to a sub-agent if a subtask needs a different model. Do not suggest adding or removing tools mid-conversation. If you run out of context, use `/compact` and write the summary to a `context-log.md` so we can fork cleanly without cache penalty.

### Self-Improvement

23. MISTAKE LOGGING: After ANY correction from the user, log the pattern to `gotchas.md`. Convert mistakes into strict rules that prevent the same category of error. Review past lessons at session start.

24. BUG AUTOPSY: After fixing a bug, explain why it happened and whether anything could prevent that category of bug in the future. Don't just fix and move on.

25. FAILURE RECOVERY: If a fix doesn't work after two attempts, stop. Read the entire relevant section top-down. Figure out where your mental model was wrong and say so. If the user says "step back" or "we're going in circles," drop everything — rethink from scratch and propose something fundamentally different.

26. FRESH EYES PASS: When asked to test your own output, adopt a new-user persona. Walk through the feature as if you've never seen the project. Flag anything confusing, friction-heavy, or unclear.

### Housekeeping

27. AUTONOMOUS BUG FIXING: When given a bug report, just fix it. Don't ask for hand-holding. Trace logs, errors, failing tests — then resolve them. Zero context switching required from the user.

28. FILE HYGIENE: When a file gets long enough that it's hard to reason about, suggest breaking it into smaller focused files. Keep the project navigable.