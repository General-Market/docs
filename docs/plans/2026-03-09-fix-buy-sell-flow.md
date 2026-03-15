# Fix Buy & Sell Cross-Chain Flow — Gating, Collateral Routing, Limit Prices (v5)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the sell flow symmetric with the buy flow. Fix all gaps identified in the security audit comparison.

**Audit trail:**
- v1: reviewed by 3 independent security researchers. 4 CRITICAL + 6 HIGH findings.
- v2: addressed all v1 findings. Re-reviewed by 3 researchers. 1 new CRITICAL + 4 new HIGH found.
- v3: addressed all v2 findings. Re-reviewed by 3 researchers. 0 CRITICAL + 5 new HIGH found.
- v4: addresses all v3 findings.
- v5 (this): sc-auditor Map-Hunt-Attack audit (Slither + Cyfrin checklist + Solodit). Found 1 pre-existing HIGH (totalSupply inflation), 2 new defense-in-depth fixes. See Round 5 at bottom.

---

## Current State

### What L3 `confirmFills` Actually Does (Investment.sol)

`confirmFills` is **full execution**, not locking:

| | BUY | SELL |
|---|-----|------|
| **submitOrderFor** | Escrows USDC from payer to contract | Escrows L3 ITP shares (`_userShares -= amount`) |
| **confirmBatch** | Marks BATCHED, emits TradeRequest | Same |
| **confirmFills** | **Mints L3 ITP shares** to user + vault.mint() | **Burns L3 ITP shares** via vault.burn() + **sends L3 USDC** to user |

### Buy Flow (Current — Correct)

```
1. buyITPFromSettlement           → User deposits USDC to custody
2. Bridge USDC Settlement→L3     → L3BridgeCustody.initiateBridge
3. submitOrderFor(BUY)           → Escrows USDC on L3
4. confirmBatch                  → Marks BATCHED
5. completeBuyOrder              → USDC custody→vault — RECEIPT-GATED ← THE GATE
6. confirmFills                  → MINTS L3 shares (ONLY if gate passed)
7. emitAssetTrades               → AP buys real assets (fire-and-forget)
8. Bridge L3 USDC→Settlement     → Collateral routing
9. Record collateral move        → On-chain tracking
10. mintBridgedShares            → Mint BridgedITP to user on Settlement
```

**Key invariant:** USDC committed to vault (step 5) BEFORE shares minted (step 6). No unbacked ITP.

### Sell Flow (Current — Broken)

```
1. sellITPFromSettlement          → User escrows BridgedITP to custody
2. submitOrderFor(SELL)           → Escrows L3 ITP shares on L3
3. confirmBatch                   → Marks BATCHED
4. emitAssetTrades                → AP sells assets (fire-and-forget)
5. confirmFills                   → BURNS L3 shares + sends L3 USDC ← NO GATE!
6. completeSellOrder              → USDC vault→user + burn BridgedITP ← AFTER burns
```

**Problems:**
- No gate before confirmFills — L3 shares burned without Settlement-side commitment
- BridgedITP burned AFTER L3 shares already gone — if completeSellOrder fails, refunding BridgedITP creates unbacked tokens
- Limit price from user silently ignored (submitted as 0 to L3)
- L3 USDC from sell goes to inaccessible address, never routed back
- No collateral move recording for sells
- Fill amounts fallback to 1e18 on metadata loss

---

## Target Sell Flow

**Principle:** Burn BridgedITP BEFORE anything on L3. Verify USDC amount properly before paying user. Recovery path if pipeline fails after burn.

```
1. sellITPFromSettlement          → User escrows BridgedITP to custody          [Settlement]
2. burnSellOrderShares            → Burn escrowed BridgedITP — RECEIPT-GATED   [Settlement] ← NEW GATE
3. submitOrderFor(SELL)           → Escrows L3 ITP shares on L3                [L3]
4. confirmBatch                   → Marks BATCHED                              [L3]
5. emitAssetTrades                → AP sells real assets                       [L3, fire-and-forget]
6. confirmFills                   → Burns L3 shares + returns L3 USDC          [L3] (only if gate passed)
7. Record collateral move         → On-chain tracking                          [Settlement]
8. completeSellOrder              → USDC vault→user (using STORED fill price)  [Settlement]
```

**Recovery:** If pipeline fails permanently after step 2 (BridgedITP burned but L3 sell never completes), oracles call `remintForFailedSell` (BLS-gated) to re-mint BridgedITP to the user. See Task 1b.

**Key invariant:** BridgedITP destroyed (step 2) BEFORE L3 shares burned (step 6). No unbacked BridgedITP possible.

**USDC amount:** `completeSellOrder` uses the **stored fill price from Phase B** (not a fresh NAV sample) to calculate `usdcProceeds`. All oracles agree on this via BLS consensus.

---

## Part 1: Contract Changes

### Task 1a: Add `burnSellOrderShares` + `MIN_SELL_AMOUNT` to SettlementBridgeCustody

New BLS-gated function that burns escrowed BridgedITP without releasing USDC. This is the sell-side gate (equivalent to `completeBuyOrder` for buys). Also adds minimum sell amount to prevent dust griefing.

**Files:**
- Modify: `contracts/src/custody/SettlementBridgeCustody.sol`
- Modify: `contracts/src/interfaces/IBridge.sol`
- Modify: `contracts/src/libraries/TypesLib.sol`
- Modify: `contracts/src/libraries/ErrorsLib.sol`

**Step 0 (v4 fix — dust griefing prevention):** Add minimum sell amount to `sellITPFromSettlement`:

```solidity
/// @notice Minimum sell amount — matches L3 MIN_ORDER_AMOUNT to prevent dust orders
/// that burn BridgedITP on Settlement but revert on L3, forcing costly remint recovery.
uint256 public constant MIN_SELL_AMOUNT = 1e15; // 0.001 shares

// In sellITPFromSettlement, after amount != 0 check:
if (amount < MIN_SELL_AMOUNT) revert ErrorsLib.E152_BelowMinSellAmount(amount, MIN_SELL_AMOUNT);
```

**Step 1:** Add `burned` and `burnedAt` fields to `TypesLib.CrossChainSellOrder`:

```solidity
struct CrossChainSellOrder {
    bytes32 itpId;
    address user;
    address bridgedItpAddress;
    uint256 amount;
    uint256 limitPrice;
    uint256 slippageTier;
    uint256 deadline;
    uint256 createdAt;
    bool burned;      // NEW: true after burnSellOrderShares
    uint256 burnedAt; // NEW: timestamp when burned (for remint cooldown)
}
```

Add constant to `SettlementBridgeCustody`:
```solidity
/// @notice Minimum delay after burn before remintAndRefundFailedSell is allowed
/// @dev Gives L3 ample time to finalize. Prevents TOCTOU with stale L3 view.
uint256 public constant MIN_REMINT_DELAY = 1 hours;
```

**Step 2:** Add new function:

```solidity
/// @notice Burn escrowed BridgedITP for a sell order — MUST be called before L3 confirmFills
/// @dev This is the sell-side gate: BridgedITP destroyed before L3 shares burned.
///      If this fails, L3 confirmFills must NOT proceed — order stays retryable.
/// @param orderId The sell order ID
function burnSellOrderShares(
    uint256 orderId,
    bytes calldata blsSignature,
    uint256 referenceNonce,
    uint256 signersBitmask
) external {
    TypesLib.CrossChainSellOrder storage order = crossChainSellOrders[orderId];
    if (order.user == address(0)) revert ErrorsLib.E119_SellOrderNotFound(orderId);
    if (order.burned) revert ErrorsLib.E147_SellOrderAlreadyBurned(orderId);

    bytes32 message = keccak256(abi.encode(
        block.chainid, address(this), "burnSellOrderShares", orderId
    ));
    _verifyBLS(message, blsSignature, referenceNonce, signersBitmask);

    order.burned = true;
    order.burnedAt = block.timestamp;

    // Burn the escrowed BridgedITP via BridgeProxy
    IBridgeProxy(bridgeProxy).burnFromCustody(order.itpId, address(this), order.amount);

    emit SellOrderSharesBurned(orderId, order.itpId, order.amount);
}
```

**Step 3:** Update `completeSellOrder` — remove the burn (already done in burnSellOrderShares), add `burned` guard:

```solidity
function completeSellOrder(
    uint256 orderId,
    uint256 usdcProceeds,
    address vault,
    bytes calldata blsSignature,
    uint256 referenceNonce,
    uint256 signersBitmask
) external override {
    TypesLib.CrossChainSellOrder storage order = crossChainSellOrders[orderId];
    if (order.user == address(0)) revert ErrorsLib.E119_SellOrderNotFound(orderId);
    if (!order.burned) revert ErrorsLib.E148_SellSharesNotBurned(orderId);

    bytes32 message = keccak256(abi.encode(
        block.chainid, address(this), "completeSellOrder", orderId, usdcProceeds, vault
    ));
    _verifyBLS(message, blsSignature, referenceNonce, signersBitmask);

    address user = order.user;
    delete crossChainSellOrders[orderId];

    if (usdcProceeds > 0) {
        usdc.safeTransferFrom(vault, user, usdcProceeds);
    }

    emit SellOrderCompleted(orderId, usdcProceeds);
}
```

**Step 4:** Update `refundSellOrder` — can only refund if NOT yet burned:

```solidity
function refundSellOrder(...) external override {
    // ...existing checks...
    if (order.burned) revert ErrorsLib.E147_SellOrderAlreadyBurned(orderId);
    // ...rest unchanged (returns BridgedITP to user)...
}
```

**Step 5:** Add events and error codes to `ErrorsLib.sol` and `IBridge.sol`.

**Step 5b (v5):** Add `limitPrice` to `CrossChainSellOrderCreated` event in `IBridge.sol` and emit it in `sellITPFromSettlement`. This allows oracles to read the user's limit price from events without an extra RPC call (see Task 12).

**Step 6:** `forge build`

**Step 7:** Commit: `fix(contracts): add burnSellOrderShares gate — burn BridgedITP before L3 sell`

---

### Task 1b: Add `remintAndRefundFailedSell` atomic recovery (addresses v1-C2, v1-H2, v2-C1)

If the sell pipeline fails permanently after `burnSellOrderShares` (BridgedITP burned but L3 never completes), the user has no BridgedITP and no USDC. This function atomically re-mints BridgedITP and returns it to the user in a single transaction, then deletes the order.

**v2-C1 fix (3/3 researchers):** The v2 design had two separate calls (remint then refund) with a `burned=false` reset in between. This created a burn→remint→burn infinite loop — each cycle mints new BridgedITP from nothing. The v3 fix makes recovery atomic: one function that remints directly to the user and deletes the order. No intermediate state, no replay possible.

**Files:**
- Modify: `contracts/src/custody/SettlementBridgeCustody.sol`
- Modify: `contracts/src/interfaces/IBridge.sol`
- Modify: `contracts/src/bridge/BridgeProxy.sol` (add `mintFromCustody`)

**Step 1:** Add `mintFromCustody` to BridgeProxy (mirror of `burnFromCustody`):

```solidity
/// @notice Mint BridgedITP for custody contract — recovery for failed sells.
/// @dev Only callable by settlementBridgeCustody. No BLS needed at this level.
function mintFromCustody(bytes32 itpId, address to, uint256 amount) external {
    if (msg.sender != settlementBridgeCustody) revert ErrorsLib.E141_OnlyCustody();
    address bridgedItp = orbitToSettlement[itpId];
    if (bridgedItp == address(0)) revert ErrorsLib.E099_BridgeItpNotFound(itpId);
    IBridgedITP(bridgedItp).mint(to, amount);
    emit BridgedSharesMinted(itpId, to, amount);
}
```

**Step 2:** Add `remintAndRefundFailedSell` to SettlementBridgeCustody — **atomic, one-shot, deletes the order**:

```solidity
/// @notice Recovery: re-mint BridgedITP directly to user after a permanently failed sell.
/// @dev ATOMIC: mints to user + deletes order in one tx. No intermediate state.
///      One-shot: once called, the order is gone — cannot be called again (no replay).
///      BLS-gated with all oracles agreeing the L3 sell pipeline failed permanently.
///      Oracles MUST verify the L3 order was cancelled/refunded/never-submitted before calling.
/// @param orderId The sell order ID
function remintAndRefundFailedSell(
    uint256 orderId,
    bytes calldata blsSignature,
    uint256 referenceNonce,
    uint256 signersBitmask
) external {
    TypesLib.CrossChainSellOrder storage order = crossChainSellOrders[orderId];
    if (order.user == address(0)) revert ErrorsLib.E119_SellOrderNotFound(orderId);
    if (!order.burned) revert ErrorsLib.E148_SellSharesNotBurned(orderId);

    // v3-H1 FIX: Enforce minimum delay after burn before allowing remint.
    // This gives L3 ample time to finalize — prevents TOCTOU where oracles
    // have stale L3 view and remint while L3 sell is actually completing.
    if (block.timestamp < order.burnedAt + MIN_REMINT_DELAY) {
        revert ErrorsLib.E151_RemintTooEarly(orderId, order.burnedAt + MIN_REMINT_DELAY);
    }

    bytes32 message = keccak256(abi.encode(
        block.chainid, address(this), "remintAndRefundFailedSell", orderId
    ));
    _verifyBLS(message, blsSignature, referenceNonce, signersBitmask);

    // Cache before delete
    address user = order.user;
    bytes32 itpId = order.itpId;
    uint256 amount = order.amount;

    // Delete order FIRST — prevents any replay (refund, burn, remint all revert with E119)
    delete crossChainSellOrders[orderId];

    // Mint BridgedITP directly to user (NOT to custody)
    IBridgeProxy(bridgeProxy).mintFromCustody(itpId, user, amount);

    emit SellOrderReminted(orderId, itpId, amount);
}
```

**Why this is safe:**
- `delete` before `mintFromCustody` → if mint reverts, entire tx rolls back (Solidity atomicity), order is restored
- After success: order is deleted → `burnSellOrderShares`, `refundSellOrder`, `completeSellOrder` all revert with E119
- No `burned=false` reset → no burn→remint→burn loop possible
- BridgedITP goes directly to user → no custody intermediate state

**Oracle responsibility:** Before proposing this via BLS consensus, oracles MUST verify:
1. The L3 order was never submitted (status < SellSubmittedOnL3), OR
2. The L3 order was refunded/cancelled on L3 (shares returned to user's L3 balance)
This is an off-chain check enforced by BLS consensus (11/20 must agree).

**Step 3:** `forge build`

**Step 4:** Commit: `fix(contracts): add atomic remintAndRefundFailedSell — one-shot recovery, no replay`

---

### Task 1c: Remove `burnBridgedShares` dual-burn path for sell orders (addresses audit H3)

The BLS-gated `burnBridgedShares` on BridgeProxy and the custody-gated `burnFromCustody` (called by `burnSellOrderShares`) are two independent burn paths that could target the same tokens. Coordinate them.

**Files:**
- Modify: `contracts/src/bridge/BridgeProxy.sol`

**Step 1:** In `burnBridgedShares`, add a check that `from` is NOT the custody address:

```solidity
function burnBridgedShares(...) external override whenNotPaused {
    // Prevent double-burn: custody tokens are burned via burnFromCustody (called by burnSellOrderShares)
    if (from == settlementBridgeCustody) revert ErrorsLib.E149_UseBurnFromCustody();
    // ...rest unchanged...
}
```

This ensures tokens held by custody can ONLY be burned via `burnSellOrderShares → burnFromCustody`, not via the BLS-gated `burnBridgedShares` path.

**Step 2:** `forge build`

**Step 3:** Commit: `fix(contracts): prevent double-burn via burnBridgedShares for custody-held tokens`

---

### Task 2: Add limit price to CrossChainSellOrder on-chain enforcement

Currently `confirmFills` on L3 checks `order.limitPrice` — but the oracle submits sells with `limitPrice = 0`.

**Files:**
- Modify: `oracle/src/bridge/orchestrator.rs` (~line 4275)
- Modify: `oracle/src/main.rs` (sell fills section ~line 2523)

**Step 1:** In `execute_submit_sell_order` (orchestrator.rs), pass the user's actual limit price instead of `U256::zero()`. Read from orchestrator state.

**Step 2:** Store sell order limit price when first detected (main.rs ~line 2380):
```rust
orch_write.set_sell_order_limit_price(sell_order.order_id, sell_order.limit_price).await;
```

**Step 3:** Add `fill_price_respects_limit` check in sell fills (main.rs ~line 2528):
```rust
if let Some(limit_price) = o.get_sell_order_limit_price(settlement_order_id).await {
    if !fill_price_respects_limit(order_nav, limit_price, common::types::Side::Sell) {
        warn!("Skipping sell fill: NAV violates limit price");
        continue;
    }
}
```

**Step 4:** Same check for E021 fallback path (main.rs ~line 2577).

**Step 5:** `cargo check --bin oracle`

**Step 6:** Commit: `fix(oracle): enforce sell limit price — read from settlement order, pass to L3`

---

### Task 3: Fix fill amount fallback + store actual fill amounts (addresses audit H4, C3)

**Files:** `oracle/src/main.rs`, `oracle/src/bridge/orchestrator.rs`

**Step 1:** Replace all `unwrap_or(U256::exp10(18))` in sell pipeline with skip-on-missing:

```rust
let amount = match o.get_sell_order_amount(order_id).await {
    Some(a) => a,
    None => {
        warn!(order_id = %order_id, "Sell order amount not found — skipping (metadata lost)");
        continue;
    }
};
```

Locations: `main.rs:2502, 2530, 2578`

**Step 2:** Same fix for buy pipeline (`main.rs:1878, 1948`).

**Step 3 (C3 fix):** After Phase B confirmFills succeeds, **store the fill price and fill amount** per order in the orchestrator:

```rust
// After fills confirmed, store actual fill data for Phase C proceeds calculation
for fill in &fills {
    let settlement_id = l3_to_settlement.get(&fill.order_id).copied().unwrap_or(fill.order_id);
    orch.set_sell_order_fill_price(settlement_id, fill.fill_price).await;
    orch.set_sell_order_fill_amount(settlement_id, fill.fill_amount).await;
}
```

**Step 4 (C3 fix):** In Phase C, use **stored fill price** (NOT fresh NAV) for proceeds. If stored data is missing (oracle restart), **recover from on-chain FillConfirmed events** (v2-H2 fix):

```rust
let usdc_proceeds = {
    let o = orchestrator.read().await;
    let mut fill_amount = o.get_sell_order_fill_amount(&order_id).await;
    let mut fill_price = o.get_sell_order_fill_price(&order_id).await;

    // v2-H2 FIX: If in-memory fill data is lost (oracle restart), recover from on-chain events.
    // Query L3 FillConfirmed events for this order to get the actual fill price and amount.
    if fill_amount.is_none() || fill_price.is_none() {
        warn!(order_id = %order_id, "Fill data missing from memory — recovering from on-chain events");
        if let Ok(fill_event) = l3_reader.get_fill_confirmed_event(l3_order_id).await {
            fill_amount = Some(fill_event.fill_amount);
            fill_price = Some(fill_event.fill_price);
            // Re-store for future cycles
            drop(o);
            let mut ow = orchestrator.write().await;
            ow.set_sell_order_fill_price(&order_id, fill_event.fill_price).await;
            ow.set_sell_order_fill_amount(&order_id, fill_event.fill_amount).await;
        }
    }

    let fill_amount = match fill_amount {
        Some(a) if !a.is_zero() => a,
        _ => { warn!(order_id = %order_id, "Cannot calculate proceeds — no fill amount"); continue; }
    };
    let fill_price = match fill_price {
        Some(p) if !p.is_zero() => p,
        _ => { warn!(order_id = %order_id, "Cannot calculate proceeds — no fill price"); continue; }
    };

    // proceeds_18dec = fill_amount * fill_price / 1e18, then /1e12 for 6-dec
    let proceeds_18dec = fill_amount * fill_price / U256::exp10(18);
    let proceeds_6dec = proceeds_18dec / U256::exp10(12);

    // v3-H3 FIX: If proceeds round to zero, DON'T skip — call completeSellOrder with 0
    // to cleanly delete the order on-chain. The contract handles usdcProceeds=0 gracefully
    // (skips the transfer). Skipping via `continue` would create a permanent dead state
    // because BridgedITP and L3 shares are already burned.
    if proceeds_6dec.is_zero() {
        warn!(order_id = %order_id, fill_amount = %fill_amount, fill_price = %fill_price,
              "Proceeds round to zero after decimal conversion — completing with 0 to close order");
    }

    proceeds_6dec
};
```

This ensures:
- Partial fills use actual fill amount (not original order amount) → fixes v1-H4
- NAV drift between Phase B and C is impossible → fixes v1-C3
- Oracle restart doesn't lose fill data → fixes v2-H2 (on-chain recovery)
- Zero proceeds close the order cleanly → fixes v3-H3 (no dead state)

**Step 5 (v3-H4 fix — l3_order_id mapping recovery):** The `l3_order_id` needed for FillConfirmed event recovery is stored in `sell_order_mappings` (in-memory). After restart, this mapping is empty. Fix by reconstructing it on startup:

```rust
// On oracle startup, rebuild sell_order_mappings from on-chain events.
// Query L3 OrderSubmitted events for orders matching known settlement sell order IDs.
// The settlement sell order ID is embedded in the L3 order's metadata (user address + itpId).
// Alternatively, query CrossChainSellOrderCreated events on Settlement to get (orderId, itpId, user),
// then query L3 OrderSubmitted events filtered by (itpId, user) to find the L3 order ID.
async fn rebuild_sell_order_mappings(&self, settlement_reader: &SettlementReader, l3_reader: &L3Reader) {
    // For each SellFilled order missing a mapping:
    for (settlement_id, status) in self.sell_order_status.read().await.iter() {
        if !matches!(status, SellFilled) { continue; }
        if self.sell_order_mappings.read().await.contains_key(settlement_id) { continue; }

        // Reconstruct from on-chain: get the order's itpId+user from Settlement,
        // then find the matching L3 order.
        if let Ok(sell_order) = settlement_reader.get_cross_chain_sell_order(*settlement_id).await {
            // v4 FIX: Query by (itpId, user, amount) to disambiguate concurrent orders.
            // If still ambiguous, use timestamp correlation as tiebreaker.
            // Best approach: embed settlement_order_id in L3 submitOrderFor metadata
            // field so reconstruction is unambiguous. See Task 4 Step 5.
            if let Ok(l3_order_id) = l3_reader.find_order_by_itp_user_and_amount(
                sell_order.itp_id, sell_order.user, sell_order.amount
            ).await {
                self.sell_order_mappings.write().await.insert(
                    *settlement_id,
                    OrderMapping { l3_order_id, settlement_order_id: *settlement_id }
                );
                info!(settlement_id = %settlement_id, l3_order_id = %l3_order_id,
                      "Rebuilt sell order mapping from on-chain data");
            }
        }
    }
}
```

Call this during oracle startup before entering the main loop.

**Step 6 (v3-H5 fix — all unwrap_or(1e18) locations):** Replace ALL instances. Complete list (verified via grep):

```
SELL PIPELINE:
main.rs:2573  — Phase B batch/fill amount
main.rs:2601  — Phase B E021 fallback amount
main.rs:2650  — Phase B fill construction amount
main.rs:2718  — Phase C proceeds amount (MOST DANGEROUS — overpays user)

BUY PIPELINE:
main.rs:1878  — buy amount for CBO
main.rs:1948  — buy amount for fills
main.rs:2196  — buy E021 fallback (can mint 100x unbacked BridgedITP)
```

All 4 must use the skip-on-missing pattern. Same for buy pipeline (`main.rs:1878, 1948`).

**Step 7:** `cargo check --bin oracle`

**Step 8:** Commit: `fix(oracle): store fill price/amount for sell proceeds — prevent NAV drift and partial fill overpay`

---

## Part 2: Oracle Pipeline Reorder

### Task 4: Add burn-before-sell gate with correct state machine (addresses audit C1, H1, H5, H6)

Reorder the sell pipeline: burn BridgedITP on Settlement BEFORE submitting sell on L3. Fix all state machine interactions.

**Files:**
- Modify: `oracle/src/main.rs` (sell pipeline + watchdog handling)
- Modify: `oracle/src/bridge/orchestrator.rs` (new burn phase + guards)
- Modify: `oracle/src/consensus/protocol.rs` (new consensus phase)
- Modify: `oracle/src/chain/settlement_writer.rs` (new burn_sell_order_shares function)
- Modify: `oracle/src/bridge/types.rs` (new status, proposal types)
- Modify: `oracle/src/bridge/watchdog.rs` (terminal list)

**Step 1:** Add new `BridgeOrderStatus::SellBurned` between `SellPending` and `SellSubmittedOnL3`:

```rust
pub enum BridgeOrderStatus {
    // ...existing...
    SellPending,
    SellBurned,           // NEW: BridgedITP burned on Settlement, ready for L3 sell
    SellSubmittedOnL3,
    SellFilled,
    SellCompleted,
}
```

**Step 2:** Add `burn_sell_order_shares` to `settlement_writer.rs`:

```rust
pub async fn burn_sell_order_shares(
    &self,
    order_id: U256,
    aggregated_signature: Vec<u8>,
    reference_nonce: u64,
    signers_bitmask: U256,
) -> Result<H256, SettlementWriterError> {
    self.check_gas_available().await?;
    // Build calldata for burnSellOrderShares(orderId, blsSig, refNonce, bitmask)
    // ... standard tx submission pattern ...
}
```

**Step 3:** Add consensus phase `run_burn_sell_order_phase` to `protocol.rs`.

**Step 4:** Add proposal/validation/signing to `orchestrator.rs`.

**Step 5 (fixes v1-C1 — follower must verify on-chain, v2-H3 — no string matching):** Reorder Phase A in `main.rs` sell pipeline. **Followers verify on-chain state, not error strings.**

```
NEW Phase A (two sub-steps per order):
  SellPending → burn consensus → leader submits burn tx → receipt-gated → SellBurned
  SellBurned  → submit sell on L3 → SellSubmittedOnL3
```

Key logic for sub-step 1:
```rust
match protocol.run_burn_sell_order_phase(sell_order.order_id, am_leader).await {
    Ok(burn_result) => {
        if am_leader && !burn_result.aggregated_signature.0.is_empty() {
            match settlement_writer.burn_sell_order_shares(
                sell_order.order_id,
                burn_result.aggregated_signature.0.clone(),
                protocol.registry_nonce(),
                burn_result.signer_bitmap,
            ).await {
                Ok(tx_hash) => {
                    match settlement_writer.wait_for_receipt(tx_hash, 60).await {
                        Ok(receipt) if receipt.status == Some(1.into()) => {
                            info!("burnSellOrderShares CONFIRMED on-chain");
                            orch.set_sell_order_status(order_id, SellBurned).await;
                        }
                        _ => warn!("burnSellOrderShares failed — stays SellPending for retry"),
                    }
                }
                Err(e) => {
                    // v2-H3 FIX: Don't match error strings (brittle).
                    // Query on-chain state instead.
                    let on_chain_burned = settlement_reader
                        .get_cross_chain_sell_order(order_id).await
                        .map(|o| o.burned)
                        .unwrap_or(false);
                    if on_chain_burned {
                        info!("burnSellOrderShares already confirmed on-chain — marking SellBurned");
                        orch.set_sell_order_status(order_id, SellBurned).await;
                    } else {
                        warn!("burn tx failed: {} — stays SellPending for retry", e);
                    }
                }
            }
        } else if !am_leader {
            // FOLLOWER: Query on-chain burned state directly.
            // v2-H3 FIX: No E142 string matching — use on-chain truth.
            let on_chain_burned = settlement_reader
                .get_cross_chain_sell_order(sell_order.order_id).await
                .map(|o| o.burned)
                .unwrap_or(false);
            if on_chain_burned {
                info!("Burn confirmed on-chain — follower advancing to SellBurned");
                orch.set_sell_order_status(order_id, SellBurned).await;
            } else {
                info!("Burn not yet on-chain — follower stays SellPending");
            }
        }
    }
    Err(e) => warn!("Burn consensus failed: {}", e),
}
```

Sub-step 2 (only if SellBurned):
```rust
if orch.get_sell_order_status(&order_id).await == Some(SellBurned) {
    // ...existing submitOrderFor(SELL) logic...
}
```

**Step 6 (fixes v1-H1, v2-H1 — watchdog state machine):** Update watchdog and main.rs stale order handling. **Both `SellBurned` AND `SellBurnPending` must be handled.**

In `watchdog.rs`, both are non-terminal (the watchdog should detect them if stuck):
```rust
// SellBurned is non-terminal but special: only retry L3 submit, NOT re-burn
// SellBurnPending is non-terminal: check receipt of pending burn tx
```

In `main.rs` stale order handling (~line 1115), add BOTH to the sell match arm:
```rust
BridgeOrderStatus::SellPending |
BridgeOrderStatus::SellBurnPending |  // NEW (v2-H1): burn tx submitted, awaiting receipt
BridgeOrderStatus::SellBurned |       // NEW
BridgeOrderStatus::SellSubmittedOnL3 |
BridgeOrderStatus::SellFilled => {
    if matches!(status, BridgeOrderStatus::SellBurnPending) {
        // v2-H1 FIX: Check on-chain state to resolve ambiguous SellBurnPending.
        // Don't reset to SellPending blindly — the burn tx might have confirmed.
        let on_chain_burned = settlement_reader
            .get_cross_chain_sell_order(chain_id, *order_id).await
            .map(|o| o.burned)
            .unwrap_or(false);
        if on_chain_burned {
            warn!("Stale SellBurnPending but burn confirmed on-chain — advancing to SellBurned");
            orch.set_sell_order_status(order_id, SellBurned).await;
        } else {
            warn!("Stale SellBurnPending and burn NOT on-chain — resetting to SellPending for retry");
            orch.set_sell_order_status(order_id, SellPending).await;
        }
    } else if matches!(status, BridgeOrderStatus::SellBurned) {
        // Special: don't reset to SellPending. Keep at SellBurned.
        // Only clear the seen_sell_orders dedup so L3 submit retries.
        warn!("Stale SellBurned order — retrying L3 submit only");
        settlement_reader.remove_seen_sell_order(chain_id, *order_id).await;
    } else {
        orch.reset_stale_sell_order(order_id).await;
        settlement_reader.remove_seen_sell_order(chain_id, *order_id).await;
    }
}
```

**Step 7 (fixes v1-H5, v2-H1 — in-flight guards):** Update ALL guard functions in `orchestrator.rs` — **include `SellBurnPending` everywhere alongside `SellBurned`**:

```rust
// has_in_flight_orders (line ~402):
self.sell_order_status.read().await.values().any(|s| matches!(s,
    BridgeOrderStatus::SellPending |
    BridgeOrderStatus::SellBurnPending |     // NEW (v2-H1)
    BridgeOrderStatus::SellBurned |          // NEW
    BridgeOrderStatus::SellSubmittedOnL3 |
    BridgeOrderStatus::SellFilled
))

// has_any_active_bridge_orders (line ~470):
self.sell_order_status.read().await.values().any(|status| matches!(status,
    BridgeOrderStatus::SellPending |
    BridgeOrderStatus::SellBurnPending |     // NEW (v2-H1)
    BridgeOrderStatus::SellBurned |          // NEW
    BridgeOrderStatus::SellSubmittedOnL3
))

// has_unmapped_bridge_orders (line ~492):
self.sell_order_status.read().await.values().any(|status| matches!(status,
    BridgeOrderStatus::SellPending |
    BridgeOrderStatus::SellBurnPending |     // NEW (v2-H1): burn tx pending, no L3 order yet
    BridgeOrderStatus::SellBurned            // NEW: no L3 order ID yet
))
```

**Step 8 (fixes H6 — sequential blocking):** Split Phase A burn into non-blocking two-pass:

```
Pass 1 (same cycle): For each SellPending order:
  - Run burn consensus
  - Leader: submit burn tx (fire-and-forget, store tx_hash)
  - Do NOT wait for receipt here
  - Set status to SellBurnPending (new transient status)

Pass 2 (next cycle or later): For each SellBurnPending order:
  - Leader: check receipt for stored tx_hash
  - On confirmed: advance to SellBurned
  - On reverted/timeout: reset to SellPending for retry
  - Follower: re-run burn consensus → hits E142 → advance to SellBurned
```

This decouples the 60s receipt wait from the sequential processing loop. Multiple orders can have pending burn txs simultaneously.

Add `SellBurnPending` to the state machine:
```rust
SellPending,
SellBurnPending,  // NEW: burn tx submitted, awaiting receipt
SellBurned,
SellSubmittedOnL3,
SellFilled,
SellCompleted,
```

Store pending burn tx hashes in orchestrator:
```rust
sell_burn_tx_hashes: RwLock<HashMap<U256, H256>>,  // order_id → pending burn tx
```

**Step 9:** `cargo check --bin oracle`

**Step 10:** Commit: `fix(oracle): add burn-before-sell gate with non-blocking receipts and correct state machine`

---

### Task 5: Add collateral move recording for sells

After `confirmFills` for sell, record the collateral movement for accounting/auditing.

**Files:**
- Modify: `oracle/src/main.rs` (sell Phase B, after fills confirmed)
- Modify: `oracle/src/bridge/orchestrator.rs` (collateral tracking)

**Step 1:** After sell confirmFills succeeds, record collateral move:

```rust
// Record collateral move (sell direction) using stored fill data
match protocol.run_record_collateral_move_phase(current_cycle, ...).await {
    Ok(_) => info!("Sell collateral move recorded"),
    Err(e) => warn!("Sell collateral move recording failed (non-critical): {}", e),
}
```

**Step 2:** Track L3 USDC from sell fills for reconciliation:
- Direction: SELL
- L3 USDC amount: `fill_amount × fill_price / 1e18` (from stored fill data)
- Source: user's L3 address
- Destination: vault/custody on Settlement

**Step 3:** `cargo check --bin oracle`

**Step 4:** Commit: `fix(oracle): add collateral move recording for sell orders`

---

## Part 3: Buy Flow Hardening

### Task 6: Fix buy amount fallback (same as Task 3 for sells)

Already covered in Task 3, Step 2. Ensure buy fills also skip on missing amount instead of defaulting to 1e18.

---

### Task 7: Verify buy flow pendingMints integration

The contract now has `pendingMints` mapping + `clearPendingMint`. Verify the oracle reads `pendingMints` on startup to recover un-minted orders.

**Files:**
- Verify: `oracle/src/main.rs` (startup section)
- Verify: `oracle/src/chain/settlement_reader.rs` (reading pendingMints)

**Step 1:** On oracle startup, query `pendingMints` for all recent order IDs. For each non-zero entry, inject into the mint pipeline.

**Step 2:** After successful `mintBridgedShares`, call `clearPendingMint(orderId)` via settlement_writer.

**Step 3:** `cargo check --bin oracle`

**Step 4:** Commit: `fix(oracle): integrate pendingMints crash recovery for buy flow`

---

### Task 8: Add access control to `clearPendingMint` (addresses v2-H4)

`clearPendingMint` is currently `external` with no access control. Anyone can call it to delete pending mint records, breaking crash recovery. v2's Task 7 relies on `pendingMints` for recovery but doesn't fix this.

**Files:**
- Modify: `contracts/src/custody/SettlementBridgeCustody.sol`

**Step 1:** Add a guard: only allow clearing after the mint has actually been processed:

```solidity
function clearPendingMint(uint256 orderId) external {
    // Only allow clearing if mint was actually processed on BridgeProxy
    if (!IBridgeProxy(bridgeProxy).mintProcessed(orderId)) {
        revert ErrorsLib.E150_MintNotProcessed(orderId);
    }
    delete pendingMints[orderId];
}
```

This ensures `clearPendingMint` cannot be called before `mintBridgedShares` succeeds, protecting crash recovery.

**Step 2:** `forge build`

**Step 3:** Commit: `fix(contracts): add access control to clearPendingMint — require mintProcessed`

---

## Part 4: Pre-existing Bugs & Defense-in-Depth (sc-auditor Round 5)

### Task 9: Fix totalSupply inflation on SELL cancel/refund (PRE-EXISTING BUG)

**Severity: HIGH** — Exploitable at gas cost only. Any user can inflate `totalSupply` indefinitely by submitting and immediately cancelling sell orders.

**Root cause:** `_createOrder` SELL path decrements `_userShares` but NOT `totalSupply`. All 4 cancel/refund paths increment BOTH. Net: every cancelled sell inflates `totalSupply` by `order.amount`. Partial fills where `fillAmount < order.amount / 2` also inflate.

**Impact:** `getITPState().totalSupply` returns inflated value → oracle computes inflated `total_value` in `reconstruction.rs:391` → rebalance progress inaccurate. Frontend displays wrong TVL/market cap. Note: ERC4626 vault `totalAssets()` uses `ERC20.totalSupply()` (correct), NOT `_itps.totalSupply` (inflated), so vault share pricing is NOT affected.

**Files:**
- Modify: `contracts/src/core/Investment.sol`

**Step 1:** In `_createOrder` SELL path (line 254), decrement `totalSupply` at escrow time:

```solidity
// SELL: Escrow ITP shares (deduct from user balance AND total supply)
_userShares[itpId][user] -= amount;
_itps[itpId].totalSupply -= amount;  // NEW: track escrowed shares out of supply
```

**Step 2:** In `_processFill` SELL path, remove the `totalSupply -= fill.fillAmount` (lines 476-478). Supply was already decremented at escrow. Keep the partial fill `totalSupply += unfilledShares` (line 499) — it correctly restores unfilled shares.

```solidity
// REMOVE these lines (476-478) — totalSupply already decremented at escrow:
// if (itp.totalSupply >= fill.fillAmount) {
//     itp.totalSupply -= fill.fillAmount;
// }

// KEEP line 499 — partial fill returns unfilled shares to supply:
if (fill.fillAmount < order.amount) {
    uint256 unfilledShares = order.amount - fill.fillAmount;
    _userShares[order.itpId][order.user] += unfilledShares;
    itp.totalSupply += unfilledShares;  // ← KEEP: restores unfilled portion
}
```

**Arithmetic verification:**
- Full fill: escrow(`-N`) + fill(`0`) = net `-N` ✓
- Partial fill (50%): escrow(`-N`) + partial(`+N/2`) = net `-N/2` ✓
- Cancel: escrow(`-N`) + cancel(`+N`) = net `0` ✓ (cancel paths already increment, now symmetric)

**Step 3:** Add one-time correction during UUPS upgrade to reset accumulated inflation:

```solidity
// In reinitializer (called once during upgrade), for each active ITP:
// _itps[itpId].totalSupply = ITP(itpVaults[itpId]).totalSupply();
// This resets _itps.totalSupply to match the vault's actual ERC20 supply,
// clearing any inflation accumulated before the fix.
```

This is safe because during the upgrade there are no in-flight escrows (deploy order: contracts upgrade is atomic, and the oracle stops processing during upgrade).

**Step 4:** `forge build`

**Step 5:** Commit: `fix(contracts): fix totalSupply inflation on SELL cancel/refund — decrement at escrow`

---

### Task 10: Add `whenNotPaused` to `burnFromCustody` (BridgeProxy)

**Severity: MEDIUM** — `burnFromCustody` bypasses `whenNotPaused`, making sell completions possible during emergency pause while mints are blocked. Inconsistent with `mintBridgedShares` and `burnBridgedShares`.

**Files:**
- Modify: `contracts/src/bridge/BridgeProxy.sol`

**Step 1:** Add `whenNotPaused` modifier:

```solidity
function burnFromCustody(bytes32 itpId, address from, uint256 amount) external whenNotPaused {
    if (msg.sender != settlementBridgeCustody) revert ErrorsLib.E141_OnlyCustody();
    // ...rest unchanged...
}
```

**Step 2:** Also add to `mintFromCustody` (new function from Task 1b) for consistency:

```solidity
function mintFromCustody(bytes32 itpId, address to, uint256 amount) external whenNotPaused {
    // ...
}
```

**Step 3:** `forge build`

**Step 4:** Commit: `fix(contracts): add whenNotPaused to burnFromCustody/mintFromCustody`

---

### Task 11: Harden `setSettlementBridgeCustody` on BridgeProxy

**Severity: LOW (informational)** — ATTACK phase confirmed the exploit path is valid (owner → malicious custody → arbitrary burn) but it collapses into the existing owner trust assumption. BridgeProxy's `_authorizeUpgrade` is `onlyOwner {}` with no timelock/BLS, so owner compromise already means total bridge compromise regardless. The real architectural gap is that BridgeProxy's upgrade path is weaker than SettlementBridgeCustody's (BLS + 7-day timelock). This task adds basic hygiene.

**Files:**
- Modify: `contracts/src/bridge/BridgeProxy.sol`

**Step 1:** Add zero-address check and event:

```solidity
event SettlementBridgeCustodyUpdated(address indexed oldCustody, address indexed newCustody);

function setSettlementBridgeCustody(address _settlementBridgeCustody) external onlyOwner {
    if (_settlementBridgeCustody == address(0)) revert ErrorsLib.E106_ZeroAddressNotAllowed();
    address old = settlementBridgeCustody;
    settlementBridgeCustody = _settlementBridgeCustody;
    emit SettlementBridgeCustodyUpdated(old, _settlementBridgeCustody);
}
```

**Step 2:** `forge build`

**Step 3:** Commit: `fix(contracts): harden setSettlementBridgeCustody — zero-check + event`

---

### Task 12: Fix vacuous follower validation for `completeSellOrder` proceeds

**Severity: MEDIUM** — ATTACK phase discovered that `validate_complete_sell_order_proposal` (orchestrator.rs:4462-4491) does NOT independently compute `usdc_proceeds`. Followers rebuild the BLS hash FROM the leader's proposed value and sign it if the hash matches. A single malicious leader that wins leader election can propose `usdcProceeds = 0` (or any low value) for a sell order and collect 11 honest co-signatures, underpaying the user.

**Contrast with buy flow:** Buy followers independently verify fill amounts and prices. Sell followers don't.

**Files:**
- Modify: `oracle/src/bridge/orchestrator.rs` (follower validation)
- Modify: `oracle/src/main.rs` (store limitPrice from settlement event)

**Step 1:** Store sell order `limitPrice` when detected (main.rs, sell order event processing):

```rust
// Already stores amount and itp_id. Also store limitPrice:
orch_write.set_sell_order_limit_price(sell_order.order_id, sell_order.limit_price).await;
```

Note: `CrossChainSellOrderCreated` event does NOT currently emit `limitPrice`. Either:
- (a) Read it via `getCrossChainSellOrder(orderId)` RPC call, or
- (b) Add `limitPrice` to the event in the contract upgrade (preferred, saves RPC calls)

**Step 2:** In `validate_complete_sell_order_proposal`, add independent proceeds verification:

```rust
async fn validate_complete_sell_order_proposal(&self, proposal: &CompleteSellOrderProposal) -> bool {
    // EXISTING: hash consistency check (keep)

    // NEW: independently compute expected proceeds
    let sell_order = match self.get_sell_order_from_settlement(proposal.order_id).await {
        Some(o) => o,
        None => { warn!("Cannot validate: sell order not found"); return false; }
    };

    // Get fill data (stored after Phase B, or recovered from on-chain)
    let fill_amount = match self.get_sell_order_fill_amount(&proposal.order_id).await {
        Some(a) => a,
        None => { warn!("Cannot validate: fill amount unknown"); return false; }
    };
    let fill_price = match self.get_sell_order_fill_price(&proposal.order_id).await {
        Some(p) => p,
        None => { warn!("Cannot validate: fill price unknown"); return false; }
    };

    // Compute expected proceeds
    let expected_18dec = fill_amount * fill_price / U256::exp10(18);
    let expected_6dec = expected_18dec / U256::exp10(12);

    // Allow small rounding tolerance (±1 unit at 6 decimals)
    let diff = if proposal.usdc_proceeds > expected_6dec {
        proposal.usdc_proceeds - expected_6dec
    } else {
        expected_6dec - proposal.usdc_proceeds
    };

    if diff > U256::from(1) {
        warn!(
            order_id = %proposal.order_id,
            proposed = %proposal.usdc_proceeds,
            expected = %expected_6dec,
            "REJECTING completeSellOrder proposal: proceeds mismatch"
        );
        return false;
    }

    // Also check limitPrice if available
    if let Some(limit_price) = self.get_sell_order_limit_price(&proposal.order_id).await {
        let min_proceeds_18dec = fill_amount * limit_price / U256::exp10(18);
        let min_proceeds_6dec = min_proceeds_18dec / U256::exp10(12);
        if proposal.usdc_proceeds < min_proceeds_6dec && !min_proceeds_6dec.is_zero() {
            warn!(
                order_id = %proposal.order_id,
                proposed = %proposal.usdc_proceeds,
                min_from_limit = %min_proceeds_6dec,
                "REJECTING completeSellOrder proposal: below user's limit price"
            );
            return false;
        }
    }

    true
}
```

**Step 3:** `cargo check --bin oracle`

**Step 4:** Commit: `fix(oracle): add independent proceeds validation for sell order followers`

---

## Summary: Buy vs Sell After Fixes

| Step | Buy Flow | Sell Flow |
|------|----------|-----------|
| 1 | User deposits USDC to custody | User escrows BridgedITP to custody |
| 2 | Bridge USDC Settlement→L3 | **Burn BridgedITP** on Settlement ← GATE |
| 3 | submitOrderFor(BUY) on L3 | submitOrderFor(SELL) on L3 (with limit price) |
| 4 | confirmBatch | confirmBatch |
| 5 | **completeBuyOrder** (USDC→vault) ← GATE | emitAssetTrades (AP sells assets) |
| 6 | confirmFills (mints L3 shares) | confirmFills (burns L3 shares) |
| 7 | emitAssetTrades (AP buys assets) | Record collateral move |
| 8 | Bridge L3 USDC→Settlement | **completeSellOrder** (USDC vault→user) |
| 9 | Record collateral move | — |
| 10 | mintBridgedShares | — |

**Both flows have a gate before confirmFills:**
- Buy: completeBuyOrder (USDC committed to vault) → then mint shares
- Sell: burnSellOrderShares (BridgedITP destroyed) → then burn L3 shares

**Both flows have recovery paths:**
- Buy: pendingMints crash recovery (re-mint after restart, protected by Task 8 access control)
- Sell: remintAndRefundFailedSell (atomic: re-mint BridgedITP + delete order, one-shot, no replay)

**Deployment order (v3-H2 fix — corrected from v3):**

1. **Deploy oracle first** (Tasks 2-5, 12): New states (`SellBurned`, `SellBurnPending`), guards, watchdog, fill storage, l3_order_id recovery, independent follower validation. The new oracle code is dormant — `burnSellOrderShares` doesn't exist on the contract yet, so the burn phase simply won't find any orders to burn. The existing sell pipeline continues unchanged. Task 12 (follower validation) activates immediately — it hardens the existing completeSellOrder consensus even before the new burn gate.

2. **Deploy contracts atomically** (Tasks 1a-1c, 8-11): ALL changes in a **single UUPS upgrade transaction**:
   - New `CrossChainSellOrder` struct with `burned`/`burnedAt` fields
   - `burnSellOrderShares` function
   - Updated `completeSellOrder` (no burn, `burned` guard)
   - Updated `refundSellOrder` (`burned` guard)
   - `remintAndRefundFailedSell` with `MIN_REMINT_DELAY`
   - `mintFromCustody` on BridgeProxy
   - `burnBridgedShares` custody guard
   - `clearPendingMint` access control
   - **Task 9:** Fix totalSupply inflation (Investment.sol `_createOrder` + `_processFill`)
   - **Task 10:** `whenNotPaused` on `burnFromCustody`/`mintFromCustody` (BridgeProxy)
   - **Task 11:** Harden `setSettlementBridgeCustody` (BridgeProxy)

   No backward compatibility concern — break freely per CLAUDE.md. Any in-flight pre-upgrade sell orders will fail and can be manually resolved.

3. **Activate**: Once contracts are upgraded, the oracle's new burn phase activates automatically — it now finds `burnSellOrderShares` callable.

---

## Audit Findings Addressed (v4)

### Round 1 (v1→v2) — 4 CRIT + 6 HIGH

| Finding | Sev | Fix |
|---------|-----|-----|
| C1: Follower advances SellBurned without on-chain verification | CRIT | Task 4 Step 5: followers query on-chain `order.burned` |
| C2: L3 order refund after burn = permanent fund loss | CRIT | Task 1b: `remintAndRefundFailedSell` atomic recovery with MIN_REMINT_DELAY |
| C3: NAV drift between fill and completion | CRIT | Task 3 Steps 3-4: store fill price, use stored value in Phase C |
| C4: Vault USDC depletion | CRIT | Operational: AP maintains vault. Recovery via remintAndRefundFailedSell. See Accepted Risks. |
| H1: Watchdog resets SellBurned | HIGH | Task 4 Step 6: SellBurned + SellBurnPending in match arms, status-aware reset |
| H2: Vault approval failure after burn | HIGH | Task 1b: remintAndRefundFailedSell as recovery. Vault approval = deployment invariant. |
| H3: Double-burn via two paths | HIGH | Task 1c: burnBridgedShares rejects custody address |
| H4: Partial fill overpay | HIGH | Task 3 Steps 3-4: store actual fill amount, use in proceeds |
| H5: SellBurned missing from guards | HIGH | Task 4 Step 7: added to all 3 guard functions (SellBurned + SellBurnPending) |
| H6: Sequential burn blocks pipeline | HIGH | Task 4 Step 8: two-pass non-blocking burn with SellBurnPending |

### Round 2 (v2→v3) — 1 CRIT + 4 HIGH

| Finding | Sev | Fix |
|---------|-----|-----|
| v2-C1: remint burn→remint→burn infinite loop + unbacked ITP via L3 order in-flight | CRIT | Task 1b rewritten: atomic + `MIN_REMINT_DELAY` (1h cooldown after burn) |
| v2-H1: SellBurnPending missing from guards/watchdog/stale-handler | HIGH | Task 4 Steps 6-7: added everywhere with on-chain state check |
| v2-H2: In-memory fill data lost on oracle restart | HIGH | Task 3 Step 4: on-chain FillConfirmed event recovery |
| v2-H3: E142 error string detection is brittle | HIGH | Task 4 Step 5: replaced with on-chain `order.burned` query |
| v2-H4: clearPendingMint has no access control | HIGH | Task 8: require `mintProcessed` before allowing clear |

### Round 3 (v3→v4) — 0 CRIT + 5 HIGH

| Finding | Sev | Fix |
|---------|-----|-----|
| v3-H1: remintAndRefundFailedSell TOCTOU — stale L3 view → unbacked ITP | HIGH | Task 1b: `MIN_REMINT_DELAY = 1 hours` on-chain cooldown after `burnedAt` timestamp. Gives L3 ample finality time. |
| v3-H2: Deployment ordering wrong — contracts before oracle creates unbacked window | HIGH | Deployment section rewritten: oracle deploys first (dormant), contracts upgrade atomically second, migration for pre-upgrade orders |
| v3-H3: Zero-proceeds guard creates permanent dead state | HIGH | Task 3 Step 4: call completeSellOrder with 0 proceeds instead of `continue` — contract handles gracefully |
| v3-H4: l3_order_id mapping lost on restart — fill recovery fails | HIGH | Task 3 Step 5: `rebuild_sell_order_mappings` on startup from on-chain CrossChainSellOrderCreated + L3 OrderSubmitted events |
| v3-H5: unwrap_or(1e18) locations incomplete in plan | HIGH | Task 3 Step 6: complete list of all 4 sell + 3 buy instances with line numbers |

### Round 4 (v4 verification) — 0 CRIT + 4 HIGH (implementation-level)

| Finding | Sev | Fix |
|---------|-----|-----|
| v4-H1: rebuild_sell_order_mappings ambiguous for concurrent orders (same user+itpId) | HIGH | Task 3 Step 5: query by (itpId, user, amount) for disambiguation |
| v4-H2: unwrap_or(1e18) at line 2196 (buy E021 fallback) missing | HIGH | Task 3 Step 6: added to complete list (now 4 sell + 3 buy = 7 total) |
| v4-H3: No MIN_SELL_AMOUNT on sellITPFromSettlement — dust griefing | HIGH | Task 1a Step 0: `MIN_SELL_AMOUNT = 1e15` matching L3 minimum |
| v4-H4: E142-E146 error codes collide with existing | HIGH | All new errors renumbered to E147-E152 |

### Round 5 (sc-auditor Map-Hunt-Attack) — 1 HIGH + 2 MEDIUM + 7 dismissed

Methodology: Slither (114 findings: 4H 24M 52L 31I 3G) + Aderyn (failed, Prague EVM) + Cyfrin checklist + Solodit pattern search. Manual MAP-HUNT on SettlementBridgeCustody, BridgeProxy, BridgedITP, Investment.sol, L3BridgeCustody.

| Finding | Sev | Fix |
|---------|-----|-----|
| totalSupply inflation on SELL cancel/refund — every cancelled sell inflates supply (PRE-EXISTING) | HIGH | Task 9: decrement totalSupply at escrow in `_createOrder`, remove redundant decrement in `_processFill` |
| `burnFromCustody` bypasses `whenNotPaused` — sells complete during emergency pause | MEDIUM | Task 10: add `whenNotPaused` to `burnFromCustody` and `mintFromCustody` |
| `setSettlementBridgeCustody` owner-only, re-settable, no event — asymmetric vs BLS-gated `setBridgeProxy` | LOW | Task 11: zero-address check + event. ATTACK phase confirmed exploit path collapses into owner trust (owner already has god-mode via UUPS `_authorizeUpgrade` with no timelock). |
| **Followers blindly sign leader's `usdc_proceeds`** — `validate_complete_sell_order_proposal` never independently computes proceeds | **MEDIUM** | **Task 12: add independent proceeds calculation + limitPrice check in follower validation** |
| Zero `usdcProceeds` in completeSellOrder burns tokens for nothing | LOW | ATTACK confirmed: by design for dust orders. Proceeds round to 0 at 6-dec for near-worthless ITPs. Completing with 0 is correct (alternative = permanent stuck order). |
| `burnBridgedShares` appears unused / dead code with arbitrary-address burn | MEDIUM | Already addressed by Task 1c (custody guard). Function kept for future direct-burn use case. |
| `setBridgeProxy` not actually one-time despite NatSpec | MEDIUM | Dismissed: BLS-gated. Requires oracle quorum compromise. |
| Investment.sol upgrade uses single admin key, no timelock | MEDIUM | Dismissed: architectural decision (governance.admin pattern). Out of scope for sell flow fix. |
| BridgeProxy `_authorizeUpgrade` is `onlyOwner {}` (no timelock, no BLS) — inconsistent with SettlementBridgeCustody | MEDIUM | Noted as architectural gap. Out of scope — requires separate governance hardening pass. |
| No minimum sell amount in sellITPFromSettlement | LOW | Already addressed in v4-H3 (Task 1a Step 0: MIN_SELL_AMOUNT = 1e15) |
| `>=` clamping guards mask accounting drift (Investment.sol lines 476, 479) | LOW | Task 9 removes the totalSupply clamp (line 476-478). totalValue clamp stays (separate, lower concern). |
| `assetPrices` dead storage — getPrice()/batchGetPrices() return 0 | LOW | Informational: dead code cleanup, not blocking. |

**Slither HIGHs dismissed (all FP):**
- `arbitrary-send-erc20` in completeSellOrder: vault is BLS-signed in message hash
- `unprotected-upgrade` in Investment.sol: protected by `governance.admin()` check
- `unprotected-upgrade` in SettlementBridgeCustody.sol: BLS + 7-day timelock
- `uninitialized-state` (assetPrices): dead storage, view functions only

**Verified safe:**
- Complete+refund race condition: CEI correct (delete before external calls)
- Shared `crossChainOrderId` counter: by design, separate mappings, no collision
- BLS verification: no bypass paths, no test mode, no owner override
- BridgedITP token: standard ERC20, immutable bridgeProxy, proper SafeERC20 usage
- Vault pull pattern: BLS-gated, USDC compatible, atomic (revert on failure)

---

## Accepted Risks & Trust Assumptions

| Risk | Why Accepted |
|------|-------------|
| AP asset trades fire-and-forget | AP has own retry. Oracle cannot force AP execution. Same for buy. |
| L3 sell USDC to inaccessible address | Internal accounting. User gets Settlement USDC via vault. AP is responsible for vault liquidity. |
| Vault USDC depletion if sells >> buys | AP operational responsibility to maintain vault liquidity from asset sales. If vault runs dry: completeSellOrder retries until funded. If permanently unfunded: remintAndRefundFailedSell returns BridgedITP to user. Not a protocol-level fix — depends on AP business operations. |
| Vault approval exhaustion | Operational: vault MUST approve custody for type(uint256).max USDC. Documented as deployment invariant. If violated: same recovery path as vault depletion. |
| Burn-before-sell gate is oracle-side only, no on-chain cross-chain enforcement | **Trust assumption (documented):** The L3 `confirmFills` function cannot check Settlement-side state (different chains). The ordering (burn → submit → fills) is enforced by the oracle pipeline + BLS consensus (11/20 must agree). A rogue oracle cannot bypass this alone — they need 10 other oracles to co-sign. This is the same trust model as the buy flow (completeBuyOrder gate is also oracle-enforced). Cross-chain on-chain enforcement would require a bridge message, which adds complexity and latency without meaningful security improvement given the BLS threshold. |
| No on-chain limitPrice enforcement in completeSellOrder | `CrossChainSellOrder.limitPrice` stored but not validated on-chain in `completeSellOrder`. Enforcement is off-chain in oracle Rust code (Task 2). BLS quorum signs the `usdcProceeds` — all 11/20 oracles must agree on the amount. A compromised quorum could fill at any price, but a compromised quorum can already do far worse (mint unbacked shares, steal vault USDC). Same trust model as buy flow. |
| `setSettlementBridgeCustody` weaker than `setBridgeProxy` | Asymmetric: owner-only vs BLS-gated. Accepted because BridgeProxy owner is a multisig in production, and the custody address rarely changes. Task 11 adds zero-check + event for auditability. Full BLS-gating deferred to future governance hardening pass. |
