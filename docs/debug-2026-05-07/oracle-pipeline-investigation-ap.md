# /index buy/sell stuck on "batching" — AP slice diagnosis

## Symptom (raw, 2026-05-07 ~00:14 UTC)

- AP heartbeat: `orders_processed=0 orders_failed=0 queue_depth=0 health_status=healthy` for 75+ minutes.
- Oracle-1 logs: 1 pending L3 order (settlement_id=2), Phase A → asset_trades phase → `output_trades=4`. UI says "batching".

## Investigation map

1. AP source path:
   - `ap/src/runner.rs:174-327` — Data-node mode wires SSE: subscribes to `order-submitted, fill-confirmed, rebalance-requested, asset-trade-request`.
   - `ap/src/sse_client.rs` — connects, parses envelopes, emits `ChainEvent`.
   - `ap/src/event_processor.rs:217-226` — `AssetTradeRequest` is **explicitly disabled** (`continue;` at line 226) — comment: "FillConfirmed handles trades."
   - `ap/src/event_processor.rs:539-887` — `OrderSubmitted` only tracks `order_id → (itp_id, side)`. `FillConfirmed` is the ONLY event that increments `orders_processed`, via per-asset vault decomposition.
2. Live AP container on VPS 2 (`testnet-ap`): healthy, SSE connected to `http://159.195.78.238:8200/sse/chain-events`, `BITGET_*`, `AP_PRIVATE_KEY`, deployment file all present. Fully alive. Earlier orders (3, 4, 6, 7) reached FillConfirmed and AP processed them correctly.
3. Live oracle stack on VPS 1 (`testnet-oracle-1/2/3`): all up, "unhealthy" container flag but functioning.
   - Leader election works: `calculate_bridge_leader(min_order_id=2, num=3, idx)` ⇒ oracle-3 leads.
   - Batch + fills BLS consensus reach `signature_count=3`, `signer_bitmap=7` every cycle (`Leader: Fills signature threshold reached`).

## Root cause

**Order 2's limit price is stale; on-chain `confirmFills` reverts every cycle with E126_FillPriceViolatesLimit.**

Decoded oracle-3 revert data (selector `0xcbaa4cd6` = `E126_FillPriceViolatesLimit(uint256 orderId, uint256 fillPrice, uint256 limitPrice, uint8 side)`):

```
orderId    = 2
fillPrice  = 0x0ea0293d77c65cb2  ≈ 1.0539e18  (current NAV)
limitPrice = 0x0dd3b16d05cafe2c  ≈ 0.9959e18  (user's submitOrder slippage cap)
side       = 0 (BUY)
```

NAV has drifted ~5.8% above the user's BUY limit. Every cycle the leader builds the proposal, BLS-signs (`signature_count=3`), submits to L3, gets reverted by gas-estimation, and `phases.rs:1284` correctly identifies E126, evicts orderId=2, marks it `Failed (terminal)`. Then `mark_orders_failed` runs — **but next cycle the order reappears as pending**, because `mark_orders_failed` writes to oracle in-memory state, not on-chain. On-chain status stays `Batched`. Loop repeats forever. The mempool never accepts a `confirmFills` tx, so no `FillConfirmed` event is emitted, so the AP SSE pipeline never receives anything to process. Hence `orders_processed=0` while the system spins. The "batching" badge in the UI reads on-chain status, which never changes.

There's a parallel issue: `Per-order fill revert` warning chain → `mark_orders_failed` (in-memory) → `No fills left after evictions — nothing to confirm` → no asset trades emitted → no on-chain progress on order 2 — every cycle, the L3 still shows order 2 `Batched`.

## Why AP looks idle

AP is correct. AP only processes events that reach the chain. `confirmFills` never lands ⇒ no `FillConfirmed` event ⇒ no work for AP. The heartbeat lies: it confirms presence, not throughput. Same lesson as 2026-04-14.

The disabled `AssetTradeRequest` path in `event_processor.rs:217-226` is intentional but worth flagging — if you ever want a path that doesn't depend on `confirmFills` succeeding, that branch is the door.

## Failure classification

**(d) Something else** — neither a→c. Closest to (a) ("oracle never broadcasts to AP"), but the oracle DID sign and DID try to broadcast. The chain refuses the tx. AP is downstream of a chain-side block.

## Fix

Two layers. Apply both.

**Immediate (unblock current pending order 2):**

```bash
# On VPS 1: extract order 2's metadata from on-chain
ssh index-maker/prod/be 'docker exec testnet-oracle-1 cast call 0x3eb3bbbad5aa815d408fc06fb44ff2011b99c4ba "orders(uint256)(uint256,address,bytes32,uint8,uint256,uint256,uint256,uint256,bytes32,uint256,uint8)" 2 --rpc-url http://localhost:80'
```

Either:
- Cancel order 2 from the user side (frontend cancel flow → `Index.cancelOrder(2)`), or
- Force terminal-fail on-chain via an admin/oracle-consensus-signed `expireOrder` if available, or
- Wait for order deadline + `BATCHED_TIMEOUT` (E130 path), then call the timeout-claw to refund.

Verify by reading `Index.orderStatus(2)` on L3 — it must change away from `Batched`.

**Structural (prevent recurrence):**

1. **Honest AP heartbeat.** `ap/src/runner.rs:686` — when `orders_processed` has been zero for >5 minutes AND on-chain has Batched orders older than 60 s, log `degraded`. The 2026-04-14 postmortem flagged this exact failure mode and the fix never landed for this code path.
2. **Cap the eviction loop.** `oracle/src/phases.rs:1303-1357` — `mark_orders_failed` is in-memory only. After 3 retries with the same orderId across cycles, also write a terminal status on-chain (`expireOrder` or signed `markOrderFailed`) so the order disappears from `pending_orders()`. Otherwise the leader will retry the same revert until the deadline, every cycle, forever.
3. **Snapshot price at submitOrder time.** Right now the oracle uses live NAV at confirmFills time. If the user's BUY limit was set with a tight slippage cap and NAV moved, the order is unfillable. Either widen default slippage in the frontend, or recompute fillPrice against the NAV at order submission (snapshot).

## Confidence

**High** on root cause (revert data decoded, error path traced through phases.rs, AP confirmed-functional via earlier successful FillConfirmed events).

**Medium** on fix #2 — `mark_orders_failed` writes to oracle in-memory `BridgeOrchestrator` state. Need to confirm whether the oracle has a chain-side terminal-fail path that other oracles will sign. The Index contract has `expireOrder` for deadlines but not for "limit price violated forever."

**Couldn't verify:**
- Whether order 2's `deadline` has passed (couldn't run the cast call from within the SSH session in time).
- Whether the frontend "Cancel" button works against order status `Batched` — contracts may forbid user cancel after batching.

## File pointers

- `/Users/maxguillabert/Downloads/index/ap/src/event_processor.rs:217-226` — disabled AssetTradeRequest branch
- `/Users/maxguillabert/Downloads/index/ap/src/event_processor.rs:539-887` — FillConfirmed-driven decomposition (the only path that increments `orders_processed`)
- `/Users/maxguillabert/Downloads/index/ap/src/runner.rs:174-327` — SSE wiring
- `/Users/maxguillabert/Downloads/index/oracle/src/phases.rs:1144-1357` — fills confirm + retry/eviction loop
- `/Users/maxguillabert/Downloads/index/oracle/src/bridge/orchestrator.rs:2105-2174` — execute_confirm_fills (silent on revert at line 2147 `?`)
- `/Users/maxguillabert/Downloads/index/contracts/src/libraries/ErrorsLib.sol:562` — E126_FillPriceViolatesLimit
- `/Users/maxguillabert/Downloads/index/oracle/src/helpers.rs:94` — calculate_bridge_leader (works correctly)
