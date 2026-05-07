# ITP Solvency Audit — 2026-05-07

## Verdict

The testnet has 46,625 ITP shares outstanding across 83 ITPs. None of the 212 underlying assets has ever moved into a backing custody. `MockBitgetVault.tradeCount = 0`. The AP has never executed a single trade. The "backing" exists only in `_itpInventory` storage on the L3 Index contract.

## The numbers

| Quantity | Value |
|---|---|
| ITPs with `totalSupply > 0` | 83 (out of 97 named) |
| Total shares outstanding | 46,625.41 |
| Largest single ITP | id=23 (`ES45M`, 5,584.75 shares) |
| Unique underlying assets referenced | 212 |
| Sum of expected backing (raw 18-dec units, mixed tokens) | 3.76 × 10²⁶ |
| Actual balance at L3 `Index` | **0** for every asset |
| Actual balance at `MockBitgetVault` | **0** for every asset |
| Actual balance at `BLSCustody` | **0** for every asset |
| Actual balance at AP wallet `0x15d3…6A65` | **0** for every asset |
| `MockBitgetVault.tradeCount` | **0** (never executed a trade, ever) |
| `AssetTradeRequest` events emitted, all-time | 7,573 |
| `BatchConfirmed` events emitted, all-time | 37 |
| `FillConfirmed` events emitted, all-time | 121 |
| `AssetTradeRequest` events, last 100k blocks (~28h) | **0** |
| `BatchConfirmed` events, last 100k blocks | **0** |
| `FillConfirmed` events, last 100k blocks | 3 (one was the test order #8 from this session) |

## Method

1. Read every `_itps[itpId]` from `Index` (`0x3eb3bbb…`) for ids 1 through 97. Kept the 83 with non-zero supply.
2. For each, pulled `getITPState(itpId)` → `(creator, totalSupply, nav, assets[], weights[], inventory[])`.
3. Computed expected balance per asset as `Σ over ITPs (totalSupply × inventoryPerShare / 1e18)`. Aggregated to 212 unique asset addresses.
4. Read `balanceOf(custody)` for each asset at four candidates: `Index`, `MockBitgetVault`, `BLSCustody`, AP wallet.
5. Pulled event counts via `cast logs` over the last 100,000 L3 blocks and over the full history.

Script lives at `/tmp/audit-itps.sh` on VPS 1; CSV at `/tmp/audit-final.csv`. Both ephemeral.

## What this means

`MockBitgetVault.executeTrade` follows a mint/burn synthetic model — `IMockERC20(buyToken).mint(address(this), …)`. It does not require pre-funded inventory. AP is supposed to call it for every netted asset trade the oracle emits. The vault then mints the bought token to its own balance, burns the sold one. The vault holding non-zero balances is the on-chain proof of work.

It holds nothing. The vault has been called zero times. Yet 7,573 `AssetTradeRequest` events fired historically — every one of them landed in an empty room. AP has never been wired up to consume them on-chain, or has been continuously broken.

Cycle 1185410180 — the cycle that filled the test order #8 in this session — never had `BatchConfirmed` or `AssetTradeRequest` on chain. `cycleProcessed[1185410180] = false`. `assetTradesEmitted[1185410180] = false`. The fill happened anyway, because `Investment.sol:441-449` (Wave 3.4) lets `confirmFills` accept PENDING orders and auto-promote to FILLED. The fast-path skipped the very contract gates that would have triggered AP.

## The architectural cause, in plain words

There are two paths through `confirmFills`:

- **Slow path:** `confirmBatch(cycle)` → `emitAssetTrades(cycle, trades)` → AP picks up `AssetTradeRequest` events → AP calls `MockBitgetVault.executeTrade` → AP submits `confirmFills(cycle, fills)`. Backing is real because AP's mint operation precedes the share mint.
- **Fast path:** `confirmFills(cycle, fills)` directly on a PENDING order. Status promotes 0 → 2 in one transaction. No `AssetTradeRequest`. No vault call. Wave 3.4 added this for "late fill tolerance" when consensus was unreliable. It silently became the only path the oracle uses.

Both paths exist in the contract. The oracle no longer enters the slow one. The fast one doesn't carry a backing leg. Synthetic shares come out the bottom.

## What I'd change to fix it (Fork A)

1. **Oracle: enforce three-phase order in `oracle/src/phases.rs`.** The leader must broadcast `confirmBatch` first, wait for inclusion, then broadcast `emitAssetTrades`, then `confirmFills`. No bypass. The existing fast-path stays in the contract for emergency unsticking but the oracle never takes it.
2. **AP: monitor `AssetTradeRequest` and call `MockBitgetVault.executeTrade` per emitted trade.** This pipeline already exists in `ap/src/event_processor.rs:464` and `ap/src/external/bitget_vault.rs`. Verify it's running. Likely needs reconnection — `tradeCount=0` after 7,573 emitted requests means subscription never landed.
3. **Contract: tighten `confirmFills` to require `assetTradesEmitted[cycle] == true`** for non-emergency calls. Add an explicit emergency mode guarded by governance for the Wave 3.4 escape hatch. (Optional, but closes the loophole permanently. Requires redeploy.)

## Backfill posture

For the 46,625 shares already outstanding, no backfill makes them retroactively backed in a meaningful sense — the vault has never been called. The cleanest options:

- **Accept testnet-as-synthetic.** Document that all current shares are NAV-tracking synthetics, not backed positions. Reset shares to zero on next deploy.
- **Run a one-shot AP catch-up.** Have AP iterate over all 7,573 historical `AssetTradeRequest` events and execute each via `MockBitgetVault.executeTrade`. Possible because the vault is mint/burn — it doesn't care about chronology. The result: vault balances grow to match the bookkeeping, fees accumulate to AP, ITP shares become "backed" in the only sense the testnet supports.

The second is honest about what the testnet is — a closed loop with synthetic mints — without lying about what it claims to be.

## Risk surface I haven't measured

- Whether the oracle's BLS p2p layer actually reaches quorum for `confirmBatch` and `emitAssetTrades` today. The earlier diagnosis found vote timeouts at `0/2` for some phases but `signature_count=3, signer_bitmap=7` for others. Until the slow path is exercised, we don't know which side it falls on.
- Whether `ORACLE_PEERS=127.0.0.1:9002,127.0.0.1:9003` (each container looking at its own loopback) is the actual murderer of the slow path. Different containers cannot reach each other on `127.0.0.1`. Almost certainly the root cause.

Both get answered by Fork A's first execution. If `confirmBatch` won't land, we know the p2p config is the deeper issue and we fix that first.

## Postscript — what attempted Fork A revealed

Restarted oracles with healthy chain readers. Cleared WAL files. Cleared stuck order 2 via `claimExpiredOrder` (refunded the user 12 USDC). Submitted three fresh test orders (#9, #10, #11). All three filled. None of them produced `BatchConfirmed`. None produced `AssetTradeRequest`. `MockBitgetVault.tradeCount` remained at zero.

The mechanism, traced:

1. The orchestrator's `order_status` map keeps re-introducing order 2 even after WAL clear. The repopulation path comes from `chain_reader` reads that surface the cached entry. The filter at `oracle/src/phases.rs:786-802` does not catch it.
2. `confirmBatch([fresh_order, 2])` reverts at gas estimation (`E021_OrderAlreadyBatched(2)`). The orchestrator logs "Orders already batched, proceeding to CBO/fills" and continues.
3. `confirmFills` retry loop evicts order 2 locally and submits `confirmFills([fresh_order])`. That tx lands. Shares mint.
4. `cycleProcessed[cycleNumber]` was never set because `confirmBatch` didn't land.
5. Asset-trades phase runs and tries `emitAssetTrades(cycleNumber, ...)`, which reverts on `Investment.sol:393` (`if (!cycleProcessed[cycleNumber]) revert E128`). No `AssetTradeRequest` event.
6. AP, now correctly subscribed, sees nothing.

So Wave 3.4's "late fill tolerance" combined with `emitAssetTrades`'s `cycleProcessed` precondition produces the asymmetry: shares mint, backing signal does not fire. The contract trusts every minted share has a matching `confirmBatch` upstream — but the oracle finds it cheaper to skip past `confirmBatch` reverts, and the contract never punishes the skip.

Closing the loop requires one of:
- Drop the `cycleProcessed` precondition from `emitAssetTrades`. Let the BLS sig over `(chainid, address(this), "assetTrades", cycleNumber, trades)` be sufficient. Asset trades become emittable whenever the oracle has signed quorum, regardless of whether `confirmBatch` for that cycle landed.
- Or rewrite the orchestrator's batch composition to never include orders with terminal on-chain status. The filter at `phases.rs:786-802` exists; it isn't catching order 2 because something in the orchestrator's persistent map reinjects it. Trace and fix the reinject.

Either is meaningful work. Both require an oracle Docker rebuild.

## What was fixed in this session

- AP RPC URL: was `http://159.195.78.238:80/` (nginx returned 405 for JSON-RPC POSTs). Changed to `http://localhost:8547` (VPS 2's L3 sequencer direct). AP now reads chain successfully. SSE consumer is wired and waiting on events that aren't currently being emitted.
- Stuck order 2 cleared via `claimExpiredOrder` permissionless refund.
- All three oracle chain readers restored from a stale state where two of them hadn't read the chain in 14+ minutes.

## Resolution — same day, later

The audit's verdict ("synthetic forever") proved provisional. The architectural fork named in the postscript was executable in one session. Below is what landed.

### The patches, in order applied

1. **Contract** — `Investment.sol:393`. Removed `if (!cycleProcessed[cycleNumber]) revert E128_CycleNotConfirmed`. The BLS signature over `(chainid, this, "assetTrades", cycleNumber, trades)` already proves oracle quorum; `assetTradesEmitted` prevents replay; the `cycleProcessed` gate was load-bearing only for an architecture the oracle no longer uses. Deployed via `UpgradeInvestment.s.sol`. New impl `0x37d25Af2Daddb2DF5a11e9b564cd411470118121`. Proxy upgraded in `0xfb1448fdbdcb1779f1b84aaff503dda5c8c982f5184ce20d1dcc445ddd957969`. Storage layout untouched — 83 ITPs and 46,625 shares preserved.
2. **AP exchange mode** — `docker-compose.override.yml`. Was `--exchange-mode testnet`, which gated the entire on-chain settlement init behind `if exchange_mode.is_mock()`. Changed to `mock`. AP now wires `BitgetVaultClient`, the `OnChainSettlement` struct, and the FillConfirmed-derived trade pipeline.
3. **AP price parser** — `ap/src/event_processor.rs`. Old code passed `/fast-prices`'s `last_price` (a decimal string like `"0.0262"`) to `U256::from_dec_str`, which silently returned zero. The handler then warned "Zero price for asset, skipping" and returned. New code splits the decimal, pads fractional to 18 digits, reassembles as a 1e18-scaled integer, parses cleanly. Cargo built on VPS 2, Docker image rebuilt, container redeployed.
4. **AP wallet gas** — funded `0x20A85a164C64B603037F647eb0E0aDeEce0BE5AC` with 100 ETH for L3 gas. Earlier zero-balance tries had also drifted the in-memory nonce ahead of chain; container restart re-initialized it.
5. **AP price-setter authorization** — `MockBitgetVault.setPriceSetter(0x20A85a…)` from the deployer key. AP can now call `setPrice` on the vault, eliminating the per-cycle "set_price failed — trade may use stale price" warnings. Underlying `executeTrade` always succeeded with stale price as a fallback; this just silences the warning.

### Verification — order 16 closed the loop

| signal | value |
|---|---|
| order 16 (10 USDC BUY on ITP `0x17`) | filled, status 2 |
| `AssetTradeRequest` events on chain | 4 (one per asset) |
| `MockBitgetVault.tradeCount` | **0 → 4** (first non-zero in chain history) |
| BLUR held in vault | 86.84 |
| COLLECT held in vault | 80.45 |
| ME held in vault | 23.91 |
| TNSR held in vault | 66.05 |
| `netPosition[asset]` (vault internal accounting) | matches the four balances above |

The pipeline now runs as it should: `OrderSubmitted` → oracle batches → `confirmFills` mints shares → `emitAssetTrades` fires `AssetTradeRequest` → AP receives via SSE → AP fetches ITP state and prices from data-node → AP calls `MockBitgetVault.executeTrade` for each underlying → vault mints the underlying to itself → `netPosition` matches the bookkeeping.

### What still drifts, untreated

- **Pre-resolution shares are still synthetic.** The 46,625 shares minted before this session have no matching vault `netPosition`. A backfill script could replay every historical `AssetTradeRequest` (or recompute net positions and call `executeTrade` once per asset for the delta) to restore the invariant. Not done.
- **`confirmBatch` still reverts every cycle on stale order entries.** The orchestrator keeps reinjecting order 2 (now EXPIRED on chain) and any newly-stuck orders. Cycle telemetry stays noisy. Cosmetic — the fast path takes over and fills succeed regardless.
- **Oracle p2p periodically loses peers** during nginx 502 storms. Manual `docker compose restart` recovers. A health-driven auto-restart would close this.

## Status

Phase 1 (this audit): complete.
Phase 2 (synchronous backing): **complete** — verified end-to-end on order 16.
Backfill of historical 46,625 shares: deferred. Symbolic for testnet, not load-bearing.
UI feature (modal backing preview): shipped as commit `6b460da8c`.
