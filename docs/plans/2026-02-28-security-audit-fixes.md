# Unified Security Audit — All Findings

Merges the Feb-24 oracle audit (71 findings, 24 tasks) with the Feb-28 parallel consensus + Solidity audit (28 findings). Deduplicated and prioritized.

**Status key:** FIXED / PARTIAL / OPEN

---

## CRITICAL

### C1. Task panic = flag stuck forever [OPEN] [NEW]

**File:** `oracle/src/main.rs` (6 spawn sites)

If any spawned task panics, the `*_active` flag stays true forever. That pipeline permanently dead.

```rust
struct FlagGuard(Arc<AtomicBool>);
impl Drop for FlagGuard {
    fn drop(&mut self) { self.0.store(false, Ordering::Release); }
}
// In every spawn: let _guard = FlagGuard(flag);
```

---

### C2. `mintBridgedShares`/`burnBridgedShares` replay [OPEN] [NEW]

**File:** `contracts/src/bridge/BridgeProxy.sol` (lines 389-436)

Hash has no orderId — deterministic, replayable within snapshot window.

```solidity
mapping(uint256 => bool) public mintProcessed;

function mintBridgedShares(
    bytes32 itpId, address user, uint256 amount,
    uint256 orderId,  // ADD
    bytes calldata blsSignature, uint256 referenceNonce, uint256 signersBitmask
) external override whenNotPaused {
    if (mintProcessed[orderId]) revert AlreadyProcessed(orderId);
    bytes32 message = keccak256(abi.encode(
        block.chainid, address(this), "mintBridgedShares", itpId, user, amount, orderId
    ));
    _verifyBLS(message, blsSignature, referenceNonce, signersBitmask);
    mintProcessed[orderId] = true;
    IBridgedITP(orbitToArbitrum[itpId]).mint(user, amount);
}
// Same for burnBridgedShares
```

---

### C3. MirrorOracleRegistry `sync()` rogue key [OPEN] [NEW]

**File:** `contracts/src/registry/MirrorOracleRegistry.sol` (line 143)

Uses aggregated key verification. Rogue key can take over entire Arb registry.

**Short-term:** Make `sync()` admin-only until multi-pairing is implemented.
**Long-term:** Store individual oracle pubkeys, use multi-pairing verification.

---

### C4. ITPNAVOracle: aggregated key + missing chainId [OPEN] [NEW]

**File:** `contracts/src/oracle/ITPNAVOracle.sol`

Three stacked issues: no chainId/address(this), uses aggregated key, no threshold check.

```solidity
contract ITPNAVOracle is IITPNAVOracle, IOracle, BLSVerifier {
    constructor(address _oracleRegistry, address _itpAddress, uint256 _initialPrice)
        BLSVerifier(_oracleRegistry) { ... }

    function updatePrice(uint256 newPrice, uint256 timestamp, uint256 cycleNumber,
        bytes calldata blsSignature, uint256 referenceNonce, uint256 signersBitmask
    ) external {
        if (cycleNumber <= lastCycleNumber) return;
        bytes32 messageHash = keccak256(abi.encode(
            block.chainid, address(this), "updatePrice", itpAddress, newPrice, timestamp, cycleNumber
        ));
        _verifyBLS(messageHash, blsSignature, referenceNonce, signersBitmask);
        currentPrice = newPrice; lastUpdated = block.timestamp; lastCycleNumber = cycleNumber;
    }
}
```

---

### C5. BLS verification bypass paths [FIXED]

**Old Task 1.** All 9+ bypass paths now reject proposals. `set_threshold` enforces >= 2.
**Residual:** `compute_threshold(0)` still returns 1 — see M12.

---

### C6. Silent overflow in netting i256_from_u256 [FIXED]

**Old Task 2.** Now uses `I256::try_from(v).expect(...)`.

---

### C7. Nonce gap under concurrent failures [FIXED]

**Old Task 4.** Uses `BTreeSet<u64>` for in-flight, reclaims failed nonces.

---

## HIGH

### H1. No refund for cross-chain buy orders [OPEN] [NEW]

**File:** `contracts/src/custody/ArbBridgeCustody.sol`

```solidity
function refundBuyOrder(uint256 orderId, bytes calldata blsSignature,
    uint256 referenceNonce, uint256 signersBitmask) external {
    TypesLib.CrossChainOrder storage order = crossChainOrders[orderId];
    if (order.user == address(0)) revert ErrorsLib.E125_BuyOrderNotFound(orderId);
    bytes32 message = keccak256(abi.encode(block.chainid, address(this), "refundBuyOrder", orderId));
    _verifyBLS(message, blsSignature, referenceNonce, signersBitmask);
    address user = order.user; uint256 amount = order.amount;
    delete crossChainOrders[orderId];
    uint256 usdcAmount = DecimalLib.toUsdc(amount);
    if (usdcAmount > 0) usdc.safeTransfer(user, usdcAmount);
}
```

---

### H2. TOCTOU on L3-native bridge guard [OPEN] [NEW]

**File:** `oracle/src/main.rs`

Track L3 order IDs bidirectionally in BridgeOrchestrator. Cross-chain pipeline registers L3 order IDs. L3-native filter excludes mapped orders.

---

### H3. Config update mid-bridge corrupts signer index [OPEN] [NEW]

**File:** `oracle/src/consensus/protocol.rs`, `oracle/src/main.rs`

Pass frozen `ConfigSnapshot` to spawned bridge tasks instead of reading from live atomics.

---

### H4. Self-reported signer_index in bridge P2P + unbound P2P identity [OPEN] [MERGED: New + Old T6]

**Files:** `oracle/src/consensus/messages.rs`, `oracle/src/p2p/`

Derive signer_index from transport-layer peer ID. Validate all bridge sign messages. Also bind P2P identity to TLS cert (old T6 — still not done, `tls.rs:139` hardcodes `"oracle.index.local"`).

```rust
let verified_index = extract_oracle_id(&from) as u8;
if signer_index != verified_index {
    return Err(ConsensusError::InvalidSignerIndex);
}
```

---

### H5. Zeroed/temp PeerIds bypass leader validation [OPEN] [NEW]

**File:** `oracle/src/consensus/protocol.rs` (line 558-563)

```rust
if Self::is_zeroed_peer_id(sender_id) || Self::is_temp_peer_id(sender_id) {
    warn!("Rejecting proposal from unregistered peer");
    return false;
}
```

---

### H6. Persist bridge state to database [OPEN] [Old T8]

Bridge state is in-memory only. Restart = lose all in-flight orders. Need `bridge_processed_orders`, `bridge_order_status` tables.

---

### H7. Sign checkpoint files and verify on load [OPEN] [Old T10]

No HMAC or integrity verification on checkpoint load. Attacker can inject modified state.

---

### H8. Replace f64 with fixed-point in Vision [OPEN] [Old T11]

`vision/multiplier.rs:49` uses `powi(2)`, `log10()`, `as f64`. `vision/resolver.rs` entirely f64. Non-determinism between nodes = consensus divergence.

---

### H9. Vision reorg handling [OPEN] [Old T12]

No `parent_hash` verification. Cursor advances even on bookmark save failure.

---

### H10. Fix arbitration BLS + defaults [OPEN] [Old T13]

Price votes unverified. `creator_wins` defaults to `false`. Float-to-cents rounding.

---

### H11. Production guards for dev CLI flags [PARTIAL] [Old T14]

`--skip-reconstruction` guarded. `--no-tls` and `--bls-key-seed-index` still unguarded.

---

### H12. CustodyWriter nonce bitmap + infinite loop [OPEN] [Old T15]

`custody_writer.rs:108-115` unbounded `loop` in `next_available()`. No on-chain nonce sync.

---

### H13. f64 precision in price conversion [PARTIAL] [Old T3]

`parse_decimal_to_u256_18dec()` fixed for parsing. But `validator.rs:368` still uses `as f64` for disagreement %. Tolerance constants still f64.

---

### H14. Secure data-node connections [PARTIAL] [Old T5]

`validate_data_node_url()` added. Arbitration has `bearer_auth`. Vision does NOT have auth.

---

## MEDIUM

### M1. `setBridgeProxy` callable multiple times [OPEN] [NEW]

Add: `if (address(bridgeProxy) != address(0)) revert;`

### M2. `completeBridge` sends USDC to msg.sender [OPEN] [NEW]

Include `msg.sender` in BLS hash.

### M3. `reverseLock` signerCount not from bitmask [OPEN] [NEW]

Derive from `_popcount(signersBitmask)`.

### M4. `completeCreateItp` uses encodePacked [OPEN] [NEW]

Switch to `abi.encode` with operation discriminator.

### M5. `BridgeProxy` admin is onlyOwner [OPEN] [NEW]

Migrate to BLS-gated admin functions.

### M6. `setItpNav` no replay protection [OPEN] [NEW]

Add `cycleNumber` parameter + monotonicity check.

### M7. Followers don't validate fill fairness [OPEN] [NEW]

Verify fill prices within 1% of consensus prices.

### M8. State/aggregator reset non-atomic [OPEN] [NEW]

Acquire both locks in same block.

### M9. Non-idempotent ITP creation [OPEN] [NEW]

Check if ITP exists for nonce before creating on L3.

### M10. `removeOracleByVote` uses aggregated key [OPEN] [NEW]

Use multi-pairing verification.

### M11. Mixed hash encoding formats [OPEN] [NEW]

Add string operation discriminator to all packed-encoded hashes.

### M12. Threshold allows n=1 [OPEN] [NEW]

Enforce minimum 3 oracles in `compute_threshold`. On-chain minimum active count check.

### M13. Price staleness bypass [OPEN] [Old T16]

No timestamp preservation. Missing-asset validation not implemented.

### M14. Bridge race conditions and lock expiry [OPEN] [Old T18]

No `bridge_processing_mutex`. Rebalance lock uses `Instant`.

### M15. Vision memory growth [OPEN] [Old T19]

No `MAX_BITMAPS`. No `cleanup_resolved`. DB errors exposed in API.

### M16. P2P codec + unbounded buffer [OPEN] [Old T21]

`codec.rs:92` destroys trailing frames on oversize. `pending_messages` unbounded.

### M17. Netting edge cases [PARTIAL] [Old T17]

Zero-net still defaults to Buy (not skipped).

---

## LOW

### L1. Ordering::Relaxed on AtomicBool guards [OPEN] [NEW]
### L2. Watch channel skips cycles [OPEN] [NEW] — by design, document
### L3. Stale order watchdog lock gap [OPEN] [NEW]
### L4. Batch signature collector cycle collision [OPEN] [NEW] — document 500M assumption
### L5. requestRebalance permissionless [OPEN] [NEW]
### L6. visionReserve silent truncation [OPEN] [NEW]
### L7. Relaxed ordering on RuntimeConfig [OPEN] [NEW]
### L8. Deterministic leader with broad acceptance [OPEN] [NEW]
### L9. Panics on edge cases [OPEN] [Old T22] — slippage assert, side_matching expect
### L10. Vision persistence gaps [OPEN] [Old T23] — no Postgres bitmaps, system clock
### L11. Remaining low-severity [OPEN] [Old T24] — saturating_mul, best_ask, gas fallback
### L12. Arbitration float-to-cents + event replay [OPEN] [Old T20]
### L13. Predictable leader election [FIXED] [Old T7] — now uses keccak256(last_bls_sig)
### L14. P2P rate limiting [FIXED] [Old T9] — MAX_INBOUND=30, per-IP caps, token bucket

---

## Summary

| Severity | Total | Fixed | Partial | Open |
|----------|-------|-------|---------|------|
| CRITICAL | 7 | 3 | 0 | 4 |
| HIGH | 14 | 0 | 3 | 11 |
| MEDIUM | 17 | 0 | 1 | 16 |
| LOW | 14 | 2 | 0 | 12 |
| **TOTAL** | **52** | **5** | **4** | **43** |

## Priority Order

| Phase | What | Effort |
|-------|------|--------|
| **Now** | C1 (flag guard), C2 (mint/burn nonce), C4 (oracle fix) | 1 day |
| **This week** | H1 (buy refund), H2 (TOCTOU), H4 (signer+P2P), H5 (peer reject) | 2 days |
| **Next sprint** | H6-H14, M1-M12 | 1 week |
| **Backlog** | M13-M17, L1-L14 | 1 week |
| **Architecture** | C3 (MirrorRegistry multi-pairing) | 1 week |
