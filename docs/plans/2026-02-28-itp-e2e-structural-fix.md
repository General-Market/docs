# ITP E2E Structural Fix — End-to-End Through Real Oracle Pipeline

## Context

E2E tests 02-05 (buy, lending, sell, create ITP) fail because **transactions route to the wrong chain**. The frontend forces ALL writes to L3 via `useChainWriteContract`, but uses `buyITPFromArbitrum` / `sellITPFromArbitrum` on `ArbBridgeCustody` — a contract designed for the Arbitrum chain. This emits `CrossChainOrderCreated` on L3, but **oracles watch Arbitrum (port 8546) for these events**, not L3 (port 8545). Orders are never detected → never relayed → never filled.

The test workarounds (Anvil impersonation via `mintBridgedItp`) also fail because they mint on Arb (port 8546) while the frontend reads balances from L3 (port 8545).

**Goal**: Make buy/sell/create ITP work end-to-end through real oracle consensus. No Anvil impersonation. No manual minting. The decentralized pipeline must work autonomously.

---

## Root Cause Chain

```
Frontend sends buyITPFromArbitrum() → L3 chain (port 8545)
                                       ↓
                      CrossChainOrderCreated emits on L3
                                       ↓
              Oracles watch Arb (port 8546) for this event
                                       ↓
                    Oracles NEVER see event → order stuck forever
```

The secondary issue: `mintBridgedItp()` mints on Arb (8546), but `useUserState` reads from L3 (8545) → balance increase never detected.

---

## Solution: Direct L3 Order Path

Since the frontend already forces L3 for all operations, **use `Index.submitOrder()` on L3 directly** instead of the cross-chain `buyITPFromArbitrum()`. This is architecturally correct: users on L3 should call L3 contracts directly.

The cross-chain path (`buyITPFromArbitrum` → Arb → oracle relay → L3) is for production users on Arbitrum mainnet. In the current setup (L3-primary), direct L3 orders are the right path.

### Key Differences: Cross-Chain vs Direct L3

| Aspect | Cross-Chain (current, broken) | Direct L3 (fix) |
|--------|-------------------------------|-----------------|
| Contract | `ArbBridgeCustody.buyITPFromArbitrum` | `Index.submitOrder` |
| Chain | Arb (but sent to L3 → broken) | L3 (correct) |
| USDC | ARB_USDC (6 decimals) | L3_WUSDC (18 decimals) |
| Event | `CrossChainOrderCreated` (Arb) | `OrderSubmitted` (L3) |
| Oracle detection | Arb event watcher | L3 cycle reads `_orders` |
| Bridge steps | 6 micro-steps (bridge, relay, batch, fill, bridge-back, mint) | 3 micro-steps (batch, fill, done) |
| Share delivery | BridgedITP minted on Arb | Direct shares on L3 (`_userShares`) |

---

## Implementation Plan

### Step 1: Add direct L3 buy/sell to BuyItpModal + SellItpModal

**Files**:
- `frontend/components/domain/BuyItpModal.tsx`
- `frontend/components/domain/SellItpModal.tsx`

**Changes**:

1. **Detect chain mode**: If user is on L3, use direct path. If on Arb, use cross-chain path.

```typescript
const isOnL3 = chainId === indexL3.id
```

2. **For L3 buy**: Call `Index.submitOrder(itpId, Side.BUY, amount, limitPrice, slippageTier, deadline)` instead of `ArbBridgeCustody.buyITPFromArbitrum(...)`.
   - USDC is L3_WUSDC (18 decimals) → change `parseUnits(amount, 6)` to `parseUnits(amount, 18)`
   - Approve L3_WUSDC → Index contract (not ArbBridgeCustody)
   - Extract `orderId` from `OrderSubmitted` event (not `CrossChainOrderCreated`)

3. **For L3 sell**: Call `Index.submitOrder(itpId, Side.SELL, amount, limitPrice, slippageTier, deadline)`.
   - Amount is already 18-decimal (shares)
   - No BridgedITP needed — burn ITP vault tokens directly
   - But we need the user to have L3 shares. Currently shares are tracked via `_userShares[itpId][user]` in the Index contract.

4. **Simplify micro-step flow for L3**:
   - Remove BRIDGE_TO_L3, RELAY, BRIDGE_TO_ARB, COMPLETE_BRIDGE, MINT_SHARES
   - New flow: APPROVE → SUBMIT → BATCH → FILL → DONE
   - The "Process" visible step becomes: "Oracles processing your order"
   - The "Deliver" visible step becomes: "Shares credited"

5. **Balance detection for L3**: Instead of watching `BridgedITP` balance on Arb, watch `_userShares` on L3 via the existing `useItpShares` or `useReadContract` hook.

### Step 2: Update USDC references for L3 path

**Files**:
- `frontend/components/domain/BuyItpModal.tsx`
- `frontend/hooks/useUserState.ts`
- `frontend/lib/contracts/addresses.ts`

**Changes**:

1. When on L3, the "USDC balance" shown in the buy modal should read L3_WUSDC (18 decimals), not ARB_USDC (6 decimals).
2. The `useUserState` hook should expose both L3 and Arb balances.
3. The approval should go to `INDEX_PROTOCOL.index` (the Index contract on L3), not `INDEX_PROTOCOL.arbCustody`.

### Step 3: Update Sell flow for L3 path

**Files**:
- `frontend/components/domain/SellItpModal.tsx`
- `frontend/hooks/useUserState.ts`

**Changes**:

For sells on L3, the user sells their L3 shares (tracked in `_userShares[itpId][user]`). The sell order flow:
1. User calls `Index.submitOrder(itpId, SELL, shares, minPrice, slippage, deadline)`
2. Index contract deducts from `_userShares`
3. Oracles batch and fill the sell
4. User receives L3_WUSDC back

The sell modal needs to show L3 share balance (not BridgedITP balance) and submit through Index.submitOrder.

### Step 4: Fix E2E test helpers

**Files**:
- `frontend/e2e/helpers/backend-api.ts`
- `frontend/e2e/helpers/selectors.ts`

**Changes**:

1. **Remove `mintBridgedItp` workaround** from tests — orders should go through real pipeline
2. **`mintL3Shares`** already works on L3 (port 8545) — keep for test setup
3. **Add `mintL3Usdc`** helper that mints L3_WUSDC (18 decimals) on L3 for buy tests
4. **Remove `startArbBlockMiner`** from individual tests — start.sh already runs a block miner on both chains (line 845)

### Step 5: Fix E2E tests to use real pipeline

**Files**:
- `frontend/e2e/tests/02-buy-itp.spec.ts`
- `frontend/e2e/tests/03-lending.spec.ts`
- `frontend/e2e/tests/04-sell-itp.spec.ts`
- `frontend/e2e/tests/05-create-itp.spec.ts`

**Changes**:

**Test 02 (Buy)**:
1. Remove `mintBridgedItp` workaround (line 64)
2. Modal will show L3_WUSDC balance and use `parseUnits(amount, 18)`
3. Wait for `orderSubmittedBanner` ("Buy More") — should appear when oracles fill the order
4. Increase timeout to 180s (oracle consensus takes ~30-90s)
5. Verify L3 shares increased after fill

**Test 03 (Lending)**:
1. Remove `mintBridgedItp` setup — use `mintL3Shares` directly
2. Lending operates on L3 directly (Morpho on L3) → should work as-is
3. `rebalanceItp` already calls L3 directly → should work

**Test 04 (Sell)**:
1. Remove `mintBridgedItp` — only need `mintL3Shares` for sell
2. Remove `startArbBlockMiner` — start.sh block miner handles this
3. Wait for L3_WUSDC balance increase (not ARB_USDC on Arb)
4. The sell modal will use `Index.submitOrder(SELL)` on L3

**Test 05 (Create)**:
1. Remove the try/catch around L3 ITP creation verification
2. Create flow goes through BridgeProxy → oracles → Index.createITP on L3
3. Wait for ITP count to increase with proper timeout (90s)

### Step 6: Add INDEX_ABI submitOrder to frontend ABI

**File**: `frontend/lib/contracts/index-protocol-abi.ts`

Add `submitOrder` function to `INDEX_ABI`:
```typescript
{
  name: 'submitOrder',
  type: 'function',
  stateMutability: 'nonpayable',
  inputs: [
    { name: 'itpId', type: 'bytes32' },
    { name: 'side', type: 'uint8' },      // 0 = BUY, 1 = SELL
    { name: 'amount', type: 'uint256' },
    { name: 'limitPrice', type: 'uint256' },
    { name: 'slippageTier', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
  outputs: [{ name: 'orderId', type: 'uint256' }],
}
```

### Step 7: SSE/Order tracking for L3 orders

**File**: `frontend/hooks/useSSE.ts`

The SSE hooks track orders by `order_id`. For direct L3 orders, the `order_id` comes from `OrderSubmitted` event (not `CrossChainOrderCreated`). Ensure the SSE tracking works for L3 order IDs.

If data-node is not running (common in E2E), the fallback is direct L3 RPC polling of `Index.getOrder(orderId)` — this already exists in `backend-api.ts`.

### Step 8: Oracle verification

**No code changes needed** — oracles already monitor L3 Index contract state:
- They read `_orders` from L3 Index in every cycle
- They batch and fill orders on L3
- The direct L3 path means orders appear in L3 Index immediately (no Arb → L3 relay needed)

Verify by checking oracle logs after a buy:
```bash
grep -i "order\|batch\|fill" logs/oracle-1.log | tail -20
```

---

## Files Modified (Summary)

| File | Change |
|------|--------|
| `frontend/components/domain/BuyItpModal.tsx` | Add direct L3 path via `Index.submitOrder`, L3_WUSDC (18 dec), simplified micro-steps |
| `frontend/components/domain/SellItpModal.tsx` | Add direct L3 sell via `Index.submitOrder`, use L3 shares |
| `frontend/lib/contracts/index-protocol-abi.ts` | Add `submitOrder` to INDEX_ABI |
| `frontend/hooks/useUserState.ts` | Expose L3_WUSDC balance + L3 shares for L3 users |
| `frontend/e2e/tests/02-buy-itp.spec.ts` | Remove `mintBridgedItp`, wait for real pipeline fill |
| `frontend/e2e/tests/03-lending.spec.ts` | Remove `mintBridgedItp`, use `mintL3Shares` only |
| `frontend/e2e/tests/04-sell-itp.spec.ts` | Remove `mintBridgedItp` + block miner, use L3 path |
| `frontend/e2e/tests/05-create-itp.spec.ts` | Remove try/catch, validate real pipeline |
| `frontend/e2e/helpers/backend-api.ts` | Add `mintL3Usdc`, clean up unused Arb helpers |

---

## Verification

1. Run `./stop.sh && ./start.sh --vision` to start fresh
2. Wait for oracles to be healthy (check `logs/oracle-1.log` for "cycle" entries)
3. Run full E2E suite:
   ```bash
   cd frontend && npx playwright test --config=e2e/playwright.config.ts --reporter=list
   ```
4. Expect: 88/88 passed (0 failed)
5. Verify no Anvil impersonation (`mintBridgedItp`) in any test file:
   ```bash
   grep -r "mintBridgedItp" frontend/e2e/tests/
   ```
   Should return empty.

---

## Risk Assessment

- **L3_WUSDC is 18 decimals vs ARB_USDC 6 decimals** — Must change all amount parsing in buy modal. Off-by-12-decimals would be catastrophic. Test with small amounts first.
- **Index.submitOrder needs USDC on L3** — start.sh already mints 50k L3_WUSDC for test user (line 344). Production users would need L3 USDC too.
- **Sell path needs L3 shares** — `_userShares` storage is set by Index contract when fills happen. For tests, `mintL3Shares` helper already handles this.
- **Oracle cycle timing** — Oracles run 200ms cycles. Order should be batched within 1-5s, filled within 5-30s. 180s timeout is generous.
