## Git

Commit after each completed task/feature to enable rollback. Use descriptive commit messages.

## Parallelism

Max 3 agents running at the same time.

## Network
| Network | Chain ID | RPC | Collateral |
|---------|----------|-----|------------|
| Index L3 (Orbit) | 111222333 | https://index.rpc.zeeve.net | WIND (18 dec) |

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
- Issuer: `nav.rs` — `calculate_nav()`, reads inventory via `getITPState`
- Frontend: `useItpNav.ts` — inventory-first, weight fallback for legacy ITPs

## BLS Signature Verification

**NEVER skip BLS verification.** Not in local dev, not in tests, not anywhere.

- No `aggregatedPubkey.length == 0` bypass paths
- No `testMode` flags that bypass BLS
- No `address(issuerRegistry) == address(0)` skip paths
- No `onlyOwner` admin functions that bypass BLS consensus
- Local dev MUST use real BLS signing with test keys registered in IssuerRegistry
- Tests MUST use proper BLS test fixtures (precomputed signatures)
- Deploy scripts MUST register issuer BLS keys and set aggregated pubkey

If BLS verification is in the way, fix the BLS pipeline — don't bypass the check.

## Backward Compatibility

Not a concern. Break interfaces, change function signatures, remove deprecated storage freely.

## Contracts


## Design Decision Backlog

Log design decisions and failed attempts to `./backlog.md`.

**When to log:**
- New design/architecture decisions
- Approaches that failed (with reason)
- Non-obvious tradeoffs made
- Log in live, don't wait end of task

**Format:** `[DECISION|FAILED] <brief description> - <reason>`

Generate session ID as: `YYYYMMDD-HHMM-<4-char-random>` (e.g., `20260126-1430-a7x2`)