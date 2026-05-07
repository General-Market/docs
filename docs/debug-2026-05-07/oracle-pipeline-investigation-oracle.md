# /index "stuck on batching" — Oracle slice diagnosis

## ROOT CAUSE

**Order ID 2 is unfillable. Its limit price is below NAV. The oracle proposes fills every cycle; the contract reverts `E126_FillPriceViolatesLimit` every time. Nothing is broken. The user asked for an impossible price.**

### Evidence chain

1. Logs from `testnet-oracle-3` (the BATCH leader) — repeating every cycle:
   ```
   Per-order fill revert — evicting bad order and retrying:
     Contract revert during gas estimation:
     data: 0xcbaa4cd6 0000…0002 ea0293d77c65cb2 dd3b16d05cafe2c 0000…0000
     bad_order=2 evicted=1 remaining=0
   No fills left after evictions — nothing to confirm
   ```

2. Selector `0xcbaa4cd6` decoded:
   - `cast keccak 'E126_FillPriceViolatesLimit(uint256,uint256,uint256,uint8)'` → `0xcbaa4cd6` (exact match)
   - Args: `orderId=2, fillPrice=1.054e18, limitPrice=0.996e18, side=0 (BUY)`
   - Throw site: `contracts/src/core/Investment.sol:458–463`

3. Order lifecycle on-chain:
   - `confirmBatch` succeeded once (cycle 1185408739: `Executing confirmBatch with L3 order IDs [2]` → status BATCHED).
   - `confirmFills` keeps reverting → no FILLED transition → frontend status stays "BATCHED" → UI label "batching".

4. Per-cycle behavior is correct:
   - `Phase A finds 1 pending L3 order` (settlement_order_id=2, fallback because no L3 mapping).
   - `am_leader=true` on oracle-3, signatures collected from oracles 0+1 (bitmap=7, threshold reached).
   - `confirmFills` gas-estimate reverts → oracle evicts the bad order, ends up with `remaining=0`, submits nothing.
   - Loop continues forever.

5. Price-consensus vote-timeout (240ms) is real but irrelevant noise: ~10–20% of cycles miss one follower vote, but `disagreement_percent=0` is reached anyway and `confirmBatch` is being submitted successfully (tx hashes in `oracle-1` writer logs). The price round is not what's blocking the order.

### Secondary issue (independent — does NOT block /index)

All three oracles report `(unhealthy)` because `/ready` returns 503. The failing check is `registry_sync.caught_up=false`:
```
peers connected=2 ok=true required=1
bls_keypair ok=true
chain_reader ok=true (last_success_ms_ago<3000)
not_stalled ok=true
registry_sync ok=false caught_up=false
```
The handler scans `current_block - 86_400 .. current_block` on first run (`oracle/src/registry_sync/mod.rs:563–565`). The last `RegistryStateChanged` event is older than 86_400 blocks (≥24h on a 1s-block chain). Cache stays empty. `caught_up` stays false. Healthcheck stays red. **Consensus still works** because `caught_up` only gates the `/ready` HTTP endpoint, not the consensus path — protocol uses `key_registry` directly. This explains the 6h `(unhealthy)` mark while the chain produces blocks and oracles produce signatures.

## FIX

### Primary — refund the unfillable order

The contract has the recovery function. Anyone can call it. The order has been BATCHED for >300s (BATCHED_TIMEOUT) so `refundTimedOutBatchedOrder` is callable now. It needs a BLS sig over `keccak256(abi.encode(chainid, indexAddress, "refundBatched", 2))`.

Two options, in order of preference:

1. **Simplest — wait for permissionless `claimExpiredOrder`.** No BLS, no oracle action. Anyone calls it once `block.timestamp > order.deadline + 24h`. Orders default to 24h max deadline. Verify `order.deadline` for orderId=2 by reading `orders(2)` on the Index contract:
   ```bash
   ssh index-maker/prod/be \
     'cast call <INDEX_ADDR> "orders(uint256)" 2 --rpc-url http://localhost:8547'
   ```
   If `block.timestamp > deadline + 24h`, call `claimExpiredOrder(2)` from any wallet. Done.

2. **If you can't wait** — sign and submit `refundTimedOutBatchedOrder(2, sig, refNonce, bitmask)` with a 2-of-3 BLS aggregate. The cleanest path is to add a one-shot CLI to oracle's `bls-tool` (already built; see `EXTRA_BINS: bls-tool` in compose). Out of scope for this slice — call it manually via a forge script that prompts each oracle's BLS endpoint or read 3 sigs offline.

### Secondary — make `/ready` honest about `caught_up`

`oracle/src/registry_sync/mod.rs` `poll_once` (lines 558–595): when no events are found in the initial scan window AND no events ever arrive, the cache is permanently empty. Two viable fixes; both small:

- **Cleanest**: when `last_block` flips from 0 → non-zero with no events, seed the cache from the current on-chain registry state directly (call `chain_reader.get_oracle_registry()` + sign a synthetic state at the latest known nonce read from `OracleRegistry.nonce()`). Treats "no recent events" as "already caught up" instead of "never caught up".
- **Cheapest patch**: bump `initial_scan_blocks: 86_400` → `1_000_000` in `oracle/src/main.rs:481` (or remove the cap and scan from contract deploy block). Loses runtime cost but trivially correct.

Either edit is one file. Restart the three oracles via `docker compose restart oracle-1 oracle-2 oracle-3` from `/home/max/index/docker/testnet/oracle/`.

### Do NOT

- Do not redeploy contracts. The contracts are working as designed — they reject fills above the user's limit. That's the spec.
- Do not "fix" the leader by rotating it. Every leader will hit the same revert.
- Do not skip BLS. The refund path requires it. The permissionless `claimExpiredOrder` is the BLS-free escape hatch.

## CONFIDENCE

- Selector identification + parameter decode: **HIGH** (exact keccak match, ABI decode is unambiguous).
- Diagnosis that order 2 is the only blocker for /index batching UI: **HIGH** (every cycle for hours shows the same revert on the same `bad_order=2`, `remaining=0`).
- Registry-sync staleness is benign: **MEDIUM-HIGH** (consensus protocol consumes `key_registry`, not `registry_sync_cache`; signatures are flowing on-chain; `confirmBatch` succeeds).
- Price-vote 240ms timeouts are noise: **MEDIUM** (~10–20% miss rate but `disagreement_percent=0` is achieved; could mask a real lag under load — worth raising vote_timeout_ms to 500ms if it persists, but unrelated to the user's symptom).

## WHAT I COULDN'T DETERMINE

- Whether order 2's deadline has elapsed enough for permissionless `claimExpiredOrder`. Needs an `eth_call` against the Index contract — I didn't have the active Index proxy address handy; deployments JSON would resolve it.
- Whether oracle-2's price-vote timeout is correlated with the registry-sync-handler's HTTP poll work (resource contention) or with TCP TLS reconnects under host-network load. The timing pattern looks Poisson-ish, not pathological.
- Whether the AP container would actually pick up this order if the fill cleared. AP heartbeats `orders_processed=0` healthy — but that's because /index uses the L3-direct path which bypasses AP entirely (`L3 direct orders: skipping completeBuyOrder (USDC locked atomically)`). AP being idle is correct.
