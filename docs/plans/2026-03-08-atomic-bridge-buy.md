# Atomic Bridge — No Unbacked ITP Implementation Plan (v4)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ensure ITP shares are NEVER minted without 1:1 backing. Fix all paths where unbacked ITP can be created, on both buy and sell sides.

**Architecture:** Three principles:
1. **Gate on receipts**: No minting without confirmed settlement tx receipt
2. **Only leader marks terminal**: Followers stay non-terminal; watchdog + replay protection make retries safe and idempotent
3. **Fail-open for gas**: If no gas, return error (don't block) — order stays non-terminal for watchdog retry

**Deployment order:** Task 6 (contract replay protection) MUST deploy before or with Tasks 1-5. Without on-chain replay protection, crash-recovery retries can double-mint.

**Tech Stack:** Rust (oracle), ethers-rs (settlement_writer), Solidity (BridgeProxy, SettlementBridgeCustody)

---

## Audit Summary (2 rounds × 3 independent researchers)

### Round 1 Findings (6 CRITICAL, 8 HIGH):
| ID | Finding | Fixed In |
|----|---------|----------|
| C1 | completeBuyOrder failure doesn't block fills/mint | Task 1 |
| C2 | completeBuyOrder no receipt wait | Task 1 |
| C3 | mintBridgedShares no on-chain replay protection | Task 6 |
| C4 | mintBridgedShares failure marks SharesBridged (terminal) | Task 2 |
| C5 | Zero gas balance check before Settlement txs | Task 3 |
| C6 | Escrowed BridgedITP never burned after sell | Task 7 |
| H1 | completeSellOrder receipt timeout marks SellCompleted | Task 4 |
| H2 | Followers mark SellCompleted without verifying leader tx | Task 4 |
| H3 | E021 fallback skips limit price check | Task 5 |
| H4 | Watchdog can reset SellFilled during in-flight | Task 4 (E119 handling) |
| H5 | L3 sell USDC to inaccessible address | Accepted (by design) |
| H6 | No persistent bridge WAL | Mitigated by replay protection |
| H7 | burnBridgedShares no replay protection | Task 6 |
| H8 | Asset trades fire-and-forget | Accepted (AP has own retry) |

### Round 2 Findings (3 CRITICAL, 4 HIGH):
| ID | Finding | Fixed In |
|----|---------|----------|
| R2-C1 | Follower marks SharesBridged before leader confirms | Task 2 (redesigned) |
| R2-C2 | BridgedITP.burn() has onlyBridgeProxy — custody can't call | Task 7 (redesigned: burnFromCustody) |
| R2-C3 | Part 1 without Part 2 = replay on crash | Deployment ordering |
| R2-H1 | Gas blocking freezes node + disables watchdog | Task 3 (redesigned: non-blocking) |
| R2-H2 | Third mint path (already-filled E021) not covered | Task 2 (all 3 paths) |
| R2-H3 | Burn failure reverts USDC transfer | Task 7 (try/catch, decoupled) |
| R2-H4 | Follower SellFilled infinite retry | Task 4 (E119 handling) |

### Round 3 Findings (1 CRITICAL, 2 HIGH):
| ID | Finding | Fixed In |
|----|---------|----------|
| R3-C1 | Burn BLS consensus impossible — followers exited code path | Task 7 (redesigned: burnFromCustody, no BLS needed) |
| R3-H2 | Watchdog reset wipes order_amounts — retry uses wrong amount | Task 8 |
| R3-H3 | Stale threshold shorter than pipeline duration | Task 9 |

---

## Part 1: Contract Fixes (MUST deploy first)

### Task 6: Add replay protection to mintBridgedShares and burnBridgedShares (C3, H7)

**Files:**
- Modify: `contracts/src/bridge/BridgeProxy.sol:389-436`
- Modify: `contracts/src/libs/ErrorsLib.sol` (add new error codes)
- Modify: `oracle/src/bridge/types.rs` (~line 922, hash builders)
- Modify: `oracle/src/consensus/protocol.rs` (~line 9042, phase runner)
- Modify: `oracle/src/bridge/orchestrator.rs` (~line 4631, proposal creation)
- Modify: `oracle/src/main.rs` (3 call sites: normal ~1954, E021 ~2069, already-filled ~2118)
- Modify: `oracle/src/chain/settlement_writer.rs` (mint_bridged_shares function signature)

**Step 1: Solidity — Add processed mapping + orderId param to BridgeProxy**

```solidity
// Add to BridgeProxy state
mapping(uint256 => bool) public mintProcessed;
mapping(uint256 => bool) public burnProcessed;

function mintBridgedShares(
    bytes32 itpId,
    address user,
    uint256 amount,
    uint256 orderId,  // NEW: settlement order ID for replay protection
    bytes calldata blsSignature,
    uint256 referenceNonce,
    uint256 signersBitmask
) external override whenNotPaused {
    if (mintProcessed[orderId]) revert ErrorsLib.E_MintAlreadyProcessed(orderId);

    address bridgedItp = orbitToSettlement[itpId];
    if (bridgedItp == address(0)) revert ErrorsLib.E099_BridgeItpNotFound(itpId);
    if (amount == 0) revert ErrorsLib.E106_ZeroAddressNotAllowed();

    // Include orderId in BLS message hash
    bytes32 message = keccak256(abi.encode(
        block.chainid, address(this), "mintBridgedShares", itpId, user, amount, orderId
    ));
    _verifyBLS(message, blsSignature, referenceNonce, signersBitmask);

    mintProcessed[orderId] = true;
    IBridgedITP(bridgedItp).mint(user, amount);
    emit BridgedSharesMinted(itpId, user, amount);
}

function burnBridgedShares(
    bytes32 itpId,
    address from,
    uint256 amount,
    uint256 orderId,  // NEW
    bytes calldata blsSignature,
    uint256 referenceNonce,
    uint256 signersBitmask
) external override whenNotPaused {
    if (burnProcessed[orderId]) revert ErrorsLib.E_BurnAlreadyProcessed(orderId);
    address bridgedItp = orbitToSettlement[itpId];
    if (bridgedItp == address(0)) revert ErrorsLib.E099_BridgeItpNotFound(itpId);
    if (amount == 0) revert ErrorsLib.E106_ZeroAddressNotAllowed();

    bytes32 message = keccak256(abi.encode(
        block.chainid, address(this), "burnBridgedShares", itpId, from, amount, orderId
    ));
    _verifyBLS(message, blsSignature, referenceNonce, signersBitmask);

    burnProcessed[orderId] = true;
    IBridgedITP(bridgedItp).burn(from, amount);
    emit BridgedSharesBurned(itpId, from, amount);
}
```

**Step 2: Rust — Update hash builders in `oracle/src/bridge/types.rs`**

Update `build_mint_bridged_shares_hash` (~line 922) to include `order_id: U256`:
```rust
pub fn build_mint_bridged_shares_hash(
    chain_id: u64, bridge_proxy: Address, itp_id: H256, user: Address, amount: U256, order_id: U256,
) -> H256 {
    let encoded = ethers::abi::encode(&[
        Token::Uint(U256::from(chain_id)),
        Token::Address(bridge_proxy),
        Token::String("mintBridgedShares".to_string()),
        Token::FixedBytes(itp_id.as_bytes().to_vec()),
        Token::Address(user),
        Token::Uint(amount),
        Token::Uint(order_id),
    ]);
    H256::from(ethers::utils::keccak256(encoded))
}
```

Same for `build_burn_bridged_shares_hash`.

**Step 3: Rust — Update protocol phase runner in `consensus/protocol.rs`**

Update `run_mint_bridged_shares_phase` (~line 9042) signature to accept `order_id: U256`. Pass through to orchestrator's propose function and include in BLS hash.

Update the `MintBridgedSharesProposal` P2P message struct in the protocol to include `order_id`.

**Step 4: Rust — Update orchestrator in `bridge/orchestrator.rs`**

Update `propose_mint_bridged_shares` (~line 4631) to accept and include `order_id`.

**Step 5: Rust — Update settlement_writer in `chain/settlement_writer.rs`**

Update `mint_bridged_shares` function signature to accept `order_id: U256` and include in the calldata.

**Step 6: Rust — Update all 3 call sites in `main.rs`**

Pass the settlement order ID to `run_mint_bridged_shares_phase`:
- Normal path (~line 1954): pass `settlement_id`
- E021 path (~line 2069): pass `settlement_id`
- Already-filled path (~line 2118): pass `settlement_id`

**Step 7:** `forge build && cargo check --bin oracle`

**Step 8:** Commit: `fix(contracts+oracle): add orderId replay protection to mintBridgedShares/burnBridgedShares`

---

## Part 2: Oracle Fixes (Rust — deploy after Part 1)

### Task 1: Gate confirmFills on completeBuyOrder receipt (C1, C2)

**Files:** `oracle/src/main.rs:1884-1931` and E021 path `2005-2042`

**Step 1:** Replace fire-and-forget completeBuyOrder block (lines 1884-1903) with receipt-gated version.

Track `cbo_confirmed_orders: Vec<U256>`. For each order:
- Run completeBuyOrder consensus
- Leader: submit tx → `wait_for_receipt(tx_hash, 60)` → check `receipt.status == 1`
- On success: push to `cbo_confirmed_orders`
- On E125 (BuyOrderNotFound = already completed): push to `cbo_confirmed_orders`
- On any other error: do NOT push (warn log)
- Followers: trust consensus, push to `cbo_confirmed_orders`

After loop, guard with (NOT `continue` — there's no enclosing loop):
```rust
if cbo_confirmed_orders.is_empty() {
    warn!(cycle = current_cycle, "No orders had completeBuyOrder confirmed — skipping fills to prevent unbacked ITP");
    // Fall through — do not proceed to fills. Orders stay Batched for watchdog retry.
} else {
    // ... build fills (only for confirmed orders) ...
    // ... run confirmFills ...
    // ... run mintBridgedShares ...
}
```

**Step 2:** Filter fills list — skip orders NOT in `cbo_confirmed_orders`. Add `fill_price_respects_limit` check.

**Step 3:** Apply SAME pattern to E021 path (lines 2005-2042). Include E125 detection:
```rust
Err(e) => {
    let err_str = format!("{}", e);
    if err_str.contains("E125") || err_str.contains("BuyOrderNotFound") {
        info!(order_id = %order_id, "completeBuyOrder already done (E125)");
        cbo_confirmed_orders.push(*order_id);
    } else {
        warn!(error = %e, order_id = %order_id, "completeBuyOrder failed — will NOT mint");
    }
}
```

**Step 4:** `cargo check --bin oracle`

**Step 5:** Commit: `fix(oracle): gate confirmFills on completeBuyOrder receipt — prevent unbacked ITP`

---

### Task 2: Only LEADER marks SharesBridged after confirmed receipt (C4, R2-C1, R2-H2)

**Files:** `oracle/src/main.rs` — THREE locations:
1. Normal path (~line 1954-1976)
2. E021 path (~line 2069-2090)
3. Already-filled path (~line 2118-2140)

**Key design:** Followers do NOT mark SharesBridged. They leave order at `Batched`. With replay protection (Task 6), watchdog retry is safe and idempotent — if mint already happened on-chain, contract reverts with `E_MintAlreadyProcessed` (benign).

**Step 1:** In ALL THREE mint blocks, change the logic:

```rust
match protocol.run_mint_bridged_shares_phase(
    current_cycle, order_itp, mapping.original_user, shares, bridge_proxy, settlement_id, batch_am_leader,
).await {
    Ok(mint_result) => {
        info!(..., "MintBridgedShares consensus completed");
        if batch_am_leader && !mint_result.aggregated_signature.0.is_empty() {
            match settlement_writer.mint_bridged_shares(
                order_itp, mapping.original_user, shares, settlement_id,
                mint_result.aggregated_signature.0.clone(), protocol.registry_nonce(), mint_result.signer_bitmap,
            ).await {
                Ok(tx_hash) => {
                    info!(?tx_hash, "mintBridgedShares submitted, waiting for receipt");
                    const RECEIPT_TIMEOUT_SECS: u64 = 60;
                    match settlement_writer.wait_for_receipt(tx_hash, RECEIPT_TIMEOUT_SECS).await {
                        Ok(receipt) => {
                            let success = receipt.status.map(|s| s.as_u64() == 1).unwrap_or(false);
                            if success {
                                info!(?tx_hash, "mintBridgedShares CONFIRMED");
                                let orch = orchestrator.write().await;
                                orch.mark_orders_shares_bridged(&[settlement_id]).await;
                            } else {
                                warn!(?tx_hash, "mintBridgedShares REVERTED — order stays Batched for retry");
                            }
                        }
                        Err(e) => warn!("mintBridgedShares receipt timeout — stays Batched for retry"),
                    }
                }
                Err(e) => {
                    let err_str = format!("{}", e);
                    if err_str.contains("MintAlreadyProcessed") {
                        info!("mintBridgedShares already processed — marking SharesBridged");
                        let orch = orchestrator.write().await;
                        orch.mark_orders_shares_bridged(&[settlement_id]).await;
                    } else {
                        warn!(error = %e, "mintBridgedShares failed — stays Batched");
                    }
                }
            }
        }
        // NOTE: Followers do NOT mark SharesBridged here.
        // They stay at Batched. Watchdog will detect stale + retry.
        // With on-chain replay protection (Task 6), retry is safe and idempotent.
    }
    Err(e) => warn!(..., "MintBridgedShares consensus failed"),
}
```

**Step 2:** Verify the already-filled path at ~lines 2118-2140 also gets this treatment.

**Step 3:** `cargo check --bin oracle`

**Step 4:** Commit: `fix(oracle): only leader marks SharesBridged after confirmed receipt — followers stay Batched`

---

### Task 3: Gas pre-flight check — bounded, non-blocking (C5, R2-H1)

**Files:** `oracle/src/chain/settlement_writer.rs`

**Design:** Return error on low gas instead of blocking. The caller skips settlement operations for this cycle. Orders stay non-terminal. Watchdog retries when gas is available. The node stays alive and can still participate in P2P consensus as a follower.

**Step 1:** Add a non-blocking gas check:

```rust
/// Check if the settlement wallet has enough gas. Returns error if not.
/// DOES NOT BLOCK — caller decides what to do (skip cycle, retry later).
async fn check_gas_available(&self) -> Result<(), SettlementWriterError> {
    let min_balance = U256::from(50_000_000_000_000_000u64); // 0.05 native tokens
    let balance = self.client.get_balance(self.client.address(), None).await
        .map_err(|e| SettlementWriterError::ProviderError(format!("balance check: {}", e)))?;
    if balance < min_balance {
        return Err(SettlementWriterError::InsufficientGas {
            address: self.client.address(),
            balance,
            required: min_balance,
        });
    }
    Ok(())
}
```

**Step 2:** Add `InsufficientGas` variant to `SettlementWriterError`:
```rust
InsufficientGas { address: Address, balance: U256, required: U256 },
```

**Step 3:** Call at start of `complete_buy_order()`, `complete_sell_order()`, `mint_bridged_shares()`, `complete_create_itp()`:
```rust
self.check_gas_available().await?;
```

**Step 4:** In `main.rs`, handle `InsufficientGas` errors with a loud warning but don't block:
```rust
Err(e) => {
    warn!(error = %e, "Settlement tx skipped — insufficient gas. Order stays non-terminal for watchdog retry.");
}
```

**Step 5:** `cargo check --bin oracle`

**Step 6:** Commit: `fix(oracle): add non-blocking gas pre-flight check to settlement_writer`

---

### Task 4: Fix completeSellOrder receipt handling (H1, H2, R2-H4)

**Files:** `oracle/src/main.rs:2543-2578`

**Step 1:** On receipt timeout (lines 2563-2568), do NOT mark SellCompleted:
```rust
Err(e) => {
    warn!(order_id = %order_id, error = %e, "completeSellOrder receipt timeout — leaving SellFilled for retry");
}
```

**Step 2:** On receipt success, check status before marking:
```rust
Ok(receipt) => {
    let success = receipt.status.map(|s| s.as_u64() == 1).unwrap_or(false);
    if success {
        info!(..., "completeSellOrder CONFIRMED");
        let orch = orchestrator.write().await;
        orch.mark_sell_order_processed(order_id, tx_hash).await;
    } else {
        warn!(..., "completeSellOrder REVERTED — leaving SellFilled");
    }
}
```

**Step 3:** Followers mark `SellFilled` (non-terminal) instead of `SellCompleted`:
```rust
} else if !am_leader {
    // Follower stays at SellFilled. If leader succeeded, retry will hit E119 (benign).
    // If leader failed, retry will re-attempt completeSellOrder.
}
```
Actually, followers are already at `SellFilled` status (set at line 2401-2404). They just don't need to change status here at all. Remove the follower status marking entirely.

**Step 4:** Add E119 handling for `completeSellOrder` retries. When `settlement_writer.complete_sell_order()` returns an error containing "E119" or "SellOrderNotFound", treat as success:
```rust
Err(e) => {
    let err_str = format!("{}", e);
    if err_str.contains("E119") || err_str.contains("SellOrderNotFound") {
        info!(order_id = %order_id, "completeSellOrder already done (E119) — marking completed");
        let orch = orchestrator.write().await;
        orch.mark_sell_order_processed(order_id, H256::zero()).await;
    } else {
        warn!(order_id = %order_id, error = %e, "completeSellOrder failed — leaving SellFilled");
    }
}
```

**Step 5:** `cargo check --bin oracle`

**Step 6:** Commit: `fix(oracle): only mark SellCompleted after confirmed receipt + E119 handling`

---

### Task 5: Add limit price check to E021 fallback path (H3)

**Files:** `oracle/src/main.rs:2028-2042`

**Step 1:** Add `fill_price_respects_limit` check to the E021 fills loop (identical to normal path at lines 1916-1922):

```rust
if let Some((limit_price, side)) = o.get_order_limit_price(settlement_id).await {
    let order_side = common::types::Side::from(side);
    if !fill_price_respects_limit(order_nav, limit_price, order_side) {
        warn!(order_id = %settlement_id, l3_id = %l3_id, nav = %order_nav, limit_price = %limit_price,
            "Skipping cross-chain fill (E021): NAV violates limit price (E126 guard)");
        continue;
    }
}
```

**Step 2:** `cargo check --bin oracle`

**Step 3:** Commit: `fix(oracle): add limit price check to E021 fallback path`

---

### Task 7: Burn escrowed BridgedITP after sell completion (C6, R2-C2, R2-H3, R3-C1)

**Files:**
- Modify: `contracts/src/bridge/BridgeProxy.sol` (add `burnFromCustody`)
- Modify: `contracts/src/custody/SettlementBridgeCustody.sol` (call burn in `completeSellOrder`)
- Modify: `contracts/src/libs/ErrorsLib.sol` (if needed)

**Design (Round 3 fix):** A BLS burn consensus phase is structurally impossible — by the time the leader confirms `completeSellOrder`, followers have exited the sell processing code path and can't participate in P2P consensus.

Instead, use a **contract-level burn**: add a `burnFromCustody` function on BridgeProxy that only the custody contract can call (no BLS needed). Call it atomically inside `completeSellOrder` with try/catch — if burn fails, payment still goes through (user gets USDC).

**Step 1:** Add `burnFromCustody` to BridgeProxy:

```solidity
/// @notice Burn BridgedITP held by custody contract. No BLS needed — only custody can call.
/// @dev Called atomically from SettlementBridgeCustody.completeSellOrder
function burnFromCustody(bytes32 itpId, address from, uint256 amount) external {
    if (msg.sender != address(settlementBridgeCustody)) revert ErrorsLib.E_OnlyCustody();
    address bridgedItp = orbitToSettlement[itpId];
    if (bridgedItp == address(0)) revert ErrorsLib.E099_BridgeItpNotFound(itpId);
    IBridgedITP(bridgedItp).burn(from, amount);
    emit BridgedSharesBurned(itpId, from, amount);
}
```

Add `address public settlementBridgeCustody` to BridgeProxy state + a setter (owner-only) or set in constructor.

**Step 2:** Update `completeSellOrder` in SettlementBridgeCustody to burn escrowed tokens:

```solidity
function completeSellOrder(
    uint256 orderId, uint256 usdcProceeds, address vault,
    bytes calldata blsSignature, uint256 referenceNonce, uint256 signersBitmask
) external override {
    TypesLib.CrossChainSellOrder storage order = crossChainSellOrders[orderId];
    if (order.user == address(0)) revert ErrorsLib.E119_SellOrderNotFound(orderId);
    // ... BLS verification ...

    address user = order.user;
    bytes32 itpId = order.itpId;
    uint256 shareAmount = order.amount;

    delete crossChainSellOrders[orderId];

    // Pay user (critical — must succeed)
    if (usdcProceeds > 0) {
        usdc.safeTransferFrom(vault, user, usdcProceeds);
    }

    // Burn escrowed BridgedITP (hygiene — try/catch so payment isn't blocked)
    if (shareAmount > 0) {
        try IBridgeProxy(bridgeProxy).burnFromCustody(itpId, address(this), shareAmount) {
            // burned successfully
        } catch {
            emit BurnFailed(orderId, itpId, shareAmount);
        }
    }

    emit SellOrderCompleted(orderId, usdcProceeds);
}
```

**Step 3:** Add `BurnFailed` event to SettlementBridgeCustody. Add `bridgeProxy` address to SettlementBridgeCustody state (set in constructor or via setter).

**Step 4:** `forge build`

**Step 5:** Commit: `fix(contracts): burn escrowed BridgedITP atomically in completeSellOrder via BridgeProxy`

---

### Task 8: Preserve order metadata on watchdog reset (R3-H2)

**Files:** `oracle/src/bridge/orchestrator.rs` (~line 286, `reset_stale_order`)

**Problem:** When watchdog resets a stale order, it wipes `order_amounts`, `order_itp_ids`, and `order_mappings`. On retry, fill amount falls back to `U256::exp10(18)` (wrong). If original order was 100 USDC, retry fills for 1 token.

**Step 1:** In `reset_stale_order`, do NOT remove from `order_amounts`, `order_itp_ids`, `order_limit_prices`, or `order_mappings`. Only clear transient state (status, processed flags). Same for `reset_stale_sell_order`.

**Step 2:** `cargo check --bin oracle`

**Step 3:** Commit: `fix(oracle): preserve order metadata on watchdog reset — prevent wrong fill amounts`

---

### Task 9: Increase stale order threshold for cross-chain orders (R3-H3)

**Files:** `oracle/src/main.rs` (watchdog creation, ~line 713)

**Problem:** With receipt waits (60s per completeBuyOrder + 60s per mintBridgedShares), the total pipeline time can be 120s+. If the stale threshold is 10-30s, the watchdog fires DURING normal processing, causing unnecessary resets.

**Step 1:** Increase the stale threshold for the buy watchdog to 300s (5 minutes). The `any_order_task_active` guard already prevents watchdog from firing during active processing, but as a belt-and-suspenders measure, the threshold should exceed maximum pipeline time.

**Step 2:** `cargo check --bin oracle`

**Step 3:** Commit: `fix(oracle): increase stale order threshold to 300s for receipt-wait pipeline`

---

### Task 10: Make gas exhaustion retryable + startup balance warning

**Files:**
- Modify: `oracle/src/chain/retry.rs` (~line 92)
- Modify: `oracle/src/bootstrap/chain.rs` (~line 181)

**Step 1:** In `retry.rs`, remove "insufficient funds" and "insufficient balance" from non-retryable patterns. The pre-flight check (Task 3) is the primary defense.

**Step 2:** In `bootstrap/chain.rs`, after creating settlement writer, check native balance and warn:
```rust
let settlement_balance = settlement_provider.get_balance(settlement_signer_address, None).await?;
if settlement_balance < U256::from(50_000_000_000_000_000u64) {
    warn!(address = ?settlement_signer_address, balance = %settlement_balance,
        "Settlement wallet has low gas — settlement txs will fail until funded");
}
```

**Step 3:** `cargo check --bin oracle`

**Step 4:** Commit: `fix(oracle): make gas exhaustion retryable + startup balance warning`

---

## Accepted Risks (verified by 6 researchers across 2 rounds)

| ID | Finding | Why Accepted |
|----|---------|-------------|
| H5 | L3 sell USDC to inaccessible address | By design: AP vault provides sell liquidity. L3 USDC is internal accounting. |
| H8 | Asset trades fire-and-forget | AP has own retry mechanism. Oracle cannot force AP execution. |
| H6 | No persistent bridge WAL | Mitigated by: replay protection (Task 6) makes retries idempotent, watchdog detects stuck orders, E021/E125/E119 fallback paths handle mid-pipeline crashes. |

---

## Verification

1. `forge build` — contracts compile
2. `cargo check --bin oracle` — Rust compiles
3. Deploy contracts to testnet (BridgeProxy upgrade with replay protection)
4. Deploy oracle binary
5. Test buy: verify `completeBuyOrder CONFIRMED` appears before `Fills confirmed`
6. Test sell: verify `completeSellOrder CONFIRMED` appears before `SellCompleted`
7. Test gas failure: drain wallet, verify orders stay non-terminal, node stays responsive
8. Test replay: attempt to submit same mintBridgedShares twice — verify `E_MintAlreadyProcessed` revert
9. Test leader crash: kill leader after consensus but before mint — verify follower retry on next cycle
10. Fund wallets, restart, verify stale orders recover
