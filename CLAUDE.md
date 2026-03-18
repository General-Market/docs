## Git

Commit after each completed task/feature to enable rollback. Use descriptive commit messages. NEVER add "Co-Authored-By" trailers to commit messages.

### Frontend Repo Sync

`frontend/` has NO nested `.git` — it is tracked by the mono repo only. A post-commit hook (`scripts/sync-frontend.sh`) auto-pushes `frontend/` to `General-Market/frontend.git` (remote `gm-frontend`) whenever frontend files change. Vercel watches that repo for auto-deploys.

**NEVER:**
- Run `git init` inside `frontend/`
- Run `git pull` or `git fetch` from inside `frontend/`
- Push to `gm-frontend` manually — the hook handles it
- Create a `.git` directory inside `frontend/`

## Parallelism

Max 6 agents running at the same time.

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
| Index L3 (Orbit) | 111222333 | http://142.132.164.24/ | GM (18 dec) |
| Local Settlement (Anvil) | 421611337 | http://localhost:8546 | — |

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

Oracles **only run on VPS** — never locally. Don't create local oracle startup scripts, don't test oracles on localhost. All oracle infrastructure lives in `docker/testnet/oracle/` and runs via Docker Compose on the VPS.

- SSH to VPS: `ssh index-maker/prod/be`
- Oracle logs: `docker logs oracle-1 --tail 100` (oracle-1, oracle-2, oracle-3)
- Restart: `cd /home/max/index && docker compose -f docker/testnet/oracle/docker-compose.yml restart`

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

## Design Decision Backlog

Log design decisions and failed attempts to `./backlog.md`.

**When to log:**
- New design/architecture decisions
- Approaches that failed (with reason)
- Non-obvious tradeoffs made
- Log in live, don't wait end of task

**Format:** `[DECISION|FAILED] <brief description> - <reason>`

Generate session ID as: `YYYYMMDD-HHMM-<4-char-random>` (e.g., `20260126-1430-a7x2`)