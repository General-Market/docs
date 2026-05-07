# /index "stuck on batching" — frontend slice

## What "Batching" maps to

User-visible label in `frontend/components/domain/PortfolioSection.tsx:64-70`:

```ts
const STATUS_LABELS = { 0: 'Pending', 1: 'Batched', 2: 'Filled', 3: 'Cancelled', 4: 'Expired' }
```

These map 1:1 to on-chain `TypesLib.OrderStatus` (`contracts/src/libraries/TypesLib.sol:20`):
`PENDING=0, BATCHED=1, FILLED=2, CANCELLED=3, EXPIRED=4`.

`Order.status == 1 (BATCHED)` is set in `Investment.sol:350` inside `confirmBatch(...)` — already past phase A, oracles co-signed it. The order is alive. It is waiting for `confirmFills(...)` (`Investment.sol:417`) which flips status to `FILLED=2`.

## Frontend state machine (BuyItpModal.tsx)

Path is **L3-direct** (no bridge leg):

- `APPROVE → SUBMIT → BATCH → FILL → DONE` (lines 43–50, RELAY skipped — see comment 33–42).
- After tx confirm, modal jumps straight to `BuyMicro.BATCH` (line 414).
- Advances to `FILL` only when `trackedOrder.status >= 2` from SSE (line 463–473) **or** `userShares > initialSharesBn` from on-chain `getUserShares` (line 484–487).

The frontend is doing nothing wrong. It's reading the right contract (`INDEX_PROTOCOL.index = deployment.contracts.Index`), through the right RPC (`https://rpc.generalmarket.io/`, `frontend/lib/wagmi.ts:143`), through the right SSE feed (`https://api.generalmarket.io/data-node`). It will sit on "Batched" until the order's on-chain `status` reaches `2`. It cannot, because nobody is calling `confirmFills`.

## Root cause — NOT FRONTEND

The backend is broken. The frontend is the loyal mirror.

Pipeline: `submitOrder` → PENDING → oracles call `confirmBatch` → BATCHED + emit `TradeRequest` → oracles call `emitAssetTrades` → emit `AssetTradeRequest` → AP reads, executes, posts fills → oracles call `confirmFills` → FILLED.

User reports:
- Oracle 1 sees pending L3 direct order, processes phase A → `confirmBatch` succeeded (that's why status=BATCHED).
- Oracle 1 runs `asset_trades` (phase B) → BLS consensus 0/2 every cycle → `emitAssetTrades` never lands, OR lands but AP can't ingest, OR AP ingests but no `confirmFills` consensus.
- AP `orders_processed=0` for 75+ minutes → AP never sees the netted asset trades, OR sees them and silently fails.

The order is stuck between phase B (oracle netting) and phase C (fills). Frontend has nothing to do with this — it would unstick the moment any 2-of-N quorum lands `confirmFills`.

## Diagnosis — how to know

Run the `cast call` below. If it returns `status: 1`, the order is BATCHED on-chain. That confirms the chain is honest and the UI is honest. The break is in oracle p2p / AP.

Then:
- `ssh index-maker/prod/be 'docker logs oracle-1 --tail 200 | grep -E "phase_b|emit_asset_trades|consensus|0/2"'`
- `ssh index-maker/prod/postgres 'journalctl -u ap --since "2h ago" | grep -E "AssetTradeRequest|orders_processed"'`
- Read `assetTradesEmitted[cycleNumber]` on Index — if false, oracles never co-signed phase B.

If the oracles' BLS consensus times out, look at oracle p2p connectivity (the recovery-20260414 postmortem flagged "lying heartbeats" — daemons report healthy while p2p is dead) and at `OracleRegistry` aggregated pubkey freshness.

## Verify on-chain (the exact incantation)

`settlement_id=2` in the user's report likely refers to L3 `orderId=2` (L3-direct uses Index orders, no settlement bridge). To confirm:

```bash
# Read order 2 on L3
cast call 0xaBf79086293d30C8A72A0BE700a1c492F0Dd9D3a \
  "getOrder(uint256)(uint256,address,bytes32,uint8,uint256,uint256,uint256,uint256,bytes32,uint256,uint8)" \
  2 \
  --rpc-url https://rpc.generalmarket.io/

# Last field is `status`. 0=PENDING, 1=BATCHED, 2=FILLED, 3=CANCELLED, 4=EXPIRED.
# Field index 8 (0-based) is itpId, field 0 is order id.
```

Cross-check phase B emission for the order's cycle:

```bash
# Get the cycle number from the BatchConfirmed log, then:
cast call 0xaBf79086293d30C8A72A0BE700a1c492F0Dd9D3a \
  "assetTradesEmitted(uint256)(bool)" <cycleNumber> \
  --rpc-url https://rpc.generalmarket.io/

# false → oracles never co-signed emitAssetTrades. That's the break.
# true  → AP is the break.
```

## Proposed fix

**Do not touch the frontend.** Any frontend "fix" here would be a lie that hides a backing-failure — and the rule says: never lie about a fill.

1. SSH oracle 1 (`index-maker/prod/be`), tail logs, find the phase-B consensus failure. If signers bitmask shows < threshold votes, the other oracles aren't reachable or aren't signing.
2. Verify all three oracle containers are alive and BLS-keyed (`docker ps | grep oracle`, then check `OracleRegistry.aggregatedPubkey` matches the running set).
3. If consensus is dead, restart the oracle stack: `cd /home/max/index && docker compose -f docker/testnet/oracle/docker-compose.yml restart`.
4. Check AP on VPS 2 (`index-maker/prod/postgres`): `docker logs <ap-container> --tail 200`. If AP is healthy but `orders_processed=0`, it never received `AssetTradeRequest` events — phase B never emitted, confirming the oracle break.
5. If `assetTradesEmitted[cycle]==true` but AP shows zero, AP's SSE listener to data-node is broken — verify `reqwest-eventsource` reconnect, check SSE on data-node.
6. If everything looks alive but consensus still 0/2, the third oracle is a phantom — re-register signers in `OracleRegistry` and update aggregated pubkey.

The frontend will heal itself the moment `status` flips to `2`. SSE pushes immediately; failing that, the wagmi `getUserShares` poll (5s) catches it (line 193).

## Confidence: HIGH

The on-chain enum, the frontend label, the modal state machine, and the user's symptom (oracle phase-B consensus 0/2, AP idle) all triangulate. There is no frontend bug. The frontend cannot fix a missing `confirmFills` call. Frontend changes here would be vandalism.
