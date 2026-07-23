# ITP invariants

**TL;DR.** Three rules with no exceptions: (1) never mint shares without confirmed backing, (2) L3 USDC = 18 decimals and Settlement USDC = 6 decimals, (3) never skip BLS verification anywhere.

## ITP backing invariant

**Every minted share must be 1:1 backed by its underlying tokens.**

- `completeBuyOrder` on settlement (which releases USDC to AP for asset purchases) must succeed **before** shares are minted on L3.
- If `completeBuyOrder` fails (gas, revert, timeout), the entire order must be rolled back. No shares minted.
- The bridge buy flow must be atomic: full pipeline succeeds (USDC released + assets bought + shares minted), or nothing happens.
- Unbacked ITP is the worst possible failure mode — worse than stuck orders, worse than slow consensus.
- Never "optimistically mint" shares assuming settlement will complete later.

## USDC decimals by chain

L3 and Settlement use different decimals. Never assume 6 everywhere.

| Chain | USDC decimals | Where the value appears |
|-------|--------------|-------------------------|
| L3 (Orbit) | **18** | Vision balances, TVL, PnL, leaderboard, batch pools, VisionReserve |
| Settlement | **6** | Settlement USDC deposits, AP keeper balances, bridge custody |

When formatting amounts: check which chain the value comes from. Oracle APIs return L3 values (18 dec). Settlement wallet reads return 6 dec.

## BLS signature verification

**Never skip.** Not in local dev. Not in tests. Not anywhere.

- No `aggregatedPubkey.length == 0` bypass paths.
- No `testMode` flags that bypass BLS.
- No `address(oracleRegistry) == address(0)` skip paths.
- No `onlyOwner` admin functions that bypass BLS consensus.
- Local dev must use real BLS signing with test keys registered in OracleRegistry.
- Tests must use proper BLS test fixtures (precomputed signatures).
- Deploy scripts must register oracle BLS keys and set aggregated pubkey.

If BLS verification is in the way, **fix the BLS pipeline** — don't bypass the check.

## ITP pricing model (ETF mechanics)

An ITP is a fixed basket of assets, like an ETF. NAV floats with underlying prices.

**At creation** (or rebalance), weights convert to fixed per-share quantities:

```
ITP starts at $1 (1e18).
qty[i] = (weight[i] * 1e18) / price[i]
```

Example: 100 assets, equal weight (1% each), all at $1 → each `qty = 0.01` tokens per share.

**NAV computation** (every layer uses the same formula):

```
NAV = sum(qty[i] * price[i]) / 1e18
```

**Key invariants:**

- Quantities are stored on-chain (`_itpInventory`) and only change on rebalance.
- Buy/sell does **not** change quantities — it mints/burns proportional shares.
- Rebalance recalculates: `qty_new[i] = (w_new[i] * currentNAV) / price[i]`. Preserves NAV.
- NAV drifts from $1 over time as underlying asset prices change. That is the point.

**Implementation locations:**

- Contract: `Index.sol` — `createITP` (qty computation), `_getCurrentPrice` (NAV), `updateWeights` (rebalance).
- Storage: `IndexStorage.sol` — `_itpInventory[itpId]`.
- Oracle: `nav.rs` — `calculate_nav()` reads inventory via `getITPState`.
- Frontend: `useItpNav.ts` — inventory-first, weight fallback for legacy ITPs.
