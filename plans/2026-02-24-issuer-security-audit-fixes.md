# Issuer Security Audit Remediation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all 71 security findings from the issuer audit, organized by severity (Critical first) and subsystem.

**Architecture:** Each task targets a specific finding or cluster of related findings. Fixes are isolated per-subsystem to minimize merge conflicts when running parallel agents. Every fix includes a regression test.

**Tech Stack:** Rust (tokio, ethers-rs, axum, sqlx), Foundry (Solidity tests)

---

## Phase 1: CRITICAL Fixes (8 findings)

These must be fixed first. They represent fund-loss or consensus-bypass vectors.

---

### Task 1: Eliminate all BLS verification bypass paths in consensus protocol

**Findings:** Critical-1, Critical-2, Critical-3 (+ High-10, High-11)

**Files:**
- Modify: `issuer/src/consensus/protocol.rs` (lines 1927-1951, 2064-2087, 2530-2563, 3645-3677, 4120-4152, 4610-4638, 4855-4885, 5098-5127, 5325-5356, 7679-7695, 7917-7989)
- Modify: `issuer/src/consensus/aggregator.rs` (lines 98-100, 20-36, 127-192)
- Test: `issuer/tests/bls_bypass_regression.rs`

**Step 1: Write failing tests for BLS bypass**

Create `issuer/tests/bls_bypass_regression.rs`:

```rust
//! Regression tests: BLS verification must NEVER be skipped.
//! Each test sends a proposal from a leader whose public key is NOT in the registry
//! and asserts the follower REJECTS it (returns Err), not signs it.

use issuer::consensus::protocol::ConsensusProtocol;
// ... test harness imports

#[tokio::test]
async fn test_price_proposal_rejected_when_leader_key_missing() {
    let (protocol, _) = setup_protocol_with_empty_registry().await;
    let unknown_leader = PeerId::random();
    let fake_sig = BLSSignature(vec![0u8; 64]);
    let result = protocol
        .handle_price_proposal_as_follower(
            unknown_leader, 1, HashMap::new(), fake_sig,
        )
        .await;
    assert!(result.is_err(), "Must reject proposal from unknown leader");
    assert!(
        result.unwrap_err().to_string().contains("not found in registry"),
        "Error must mention registry lookup failure"
    );
}

#[tokio::test]
async fn test_batch_proposal_rejected_when_leader_key_missing() {
    // Same pattern for batch proposal
}

#[tokio::test]
async fn test_itp_creation_rejected_when_leader_key_missing() {
    // Same pattern for ITP creation
}

#[tokio::test]
async fn test_bridge_arb_to_l3_rejected_when_leader_key_missing() {
    // Same pattern for bridge
}

#[tokio::test]
async fn test_record_collateral_move_actually_verifies_bls() {
    let (protocol, _) = setup_protocol_with_registry().await;
    let leader = registered_leader_id();
    let bad_sig = BLSSignature(vec![0xDE; 64]); // wrong signature
    let result = protocol
        .handle_record_collateral_move_proposal(
            leader, 1, H256::zero(), U256::zero(), U256::zero(), U256::zero(), 0, bad_sig,
        )
        .await;
    assert!(result.is_err(), "Must reject invalid BLS sig on RecordCollateralMove");
}

#[tokio::test]
async fn test_mint_bridged_shares_rejects_invalid_sig() {
    let (protocol, _) = setup_protocol_with_registry().await;
    let leader = registered_leader_id();
    let bad_sig = BLSSignature(vec![0xDE; 64]);
    let result = protocol
        .handle_mint_bridged_shares_proposal(
            leader, 1, H256::zero(), Address::zero(), U256::zero(), bad_sig,
        )
        .await;
    assert!(result.is_err(), "Must reject invalid BLS sig on MintBridgedShares");
}

#[tokio::test]
async fn test_set_threshold_rejects_zero() {
    let mut aggregator = SignatureAggregator::new(/* ... */);
    // set_threshold(0) must panic or return error
    let result = std::panic::catch_unwind(|| aggregator.set_threshold(0));
    assert!(result.is_err(), "Threshold 0 must be rejected");
}

#[tokio::test]
async fn test_set_threshold_rejects_one() {
    let mut aggregator = SignatureAggregator::new(/* ... */);
    let result = std::panic::catch_unwind(|| aggregator.set_threshold(1));
    assert!(result.is_err(), "Threshold 1 must be rejected");
}

#[tokio::test]
async fn test_calculate_threshold_zero_issuers_returns_2() {
    assert_eq!(calculate_threshold(0), 2);
}

#[tokio::test]
async fn test_follower_signature_verified_before_aggregation() {
    let mut aggregator = SignatureAggregator::new(/* ... */);
    let fake_peer = PeerId::from(99);
    let garbage_sig = BLSSignature(vec![0xFF; 64]);
    // add_signature must verify against the peer's registered pubkey
    let result = aggregator.add_signature(fake_peer, garbage_sig);
    assert!(result.is_err(), "Must reject unverified follower signature");
}
```

**Step 2: Run tests to verify they fail**

Run: `cargo test -p issuer --test bls_bypass_regression -- --nocapture 2>&1 | head -50`
Expected: All tests FAIL (current code skips verification)

**Step 3: Fix the 9 "key not found" bypass paths**

In `protocol.rs`, replace every instance of this pattern:

```rust
// BEFORE (appears at lines 1944-1951, 2080-2087, 2556-2563, 3670-3677,
//         4145-4152, 4631-4638, 4878-4885, 5120-5127, 5349-5356)
} else {
    warn!(
        code = "INFRA-007",
        ...
        "Leader public key not found in registry, skipping signature verification"
    );
}
```

With:

```rust
// AFTER
} else {
    warn!(
        code = "INFRA-007",
        ...
        "Leader public key not found in registry, REJECTING proposal"
    );
    return Err(Error::BlsVerification(
        format!("Leader {:?} not found in key registry -- refusing to sign", leader_id)
    ));
}
```

Do this for ALL 9 occurrences. Search for `"skipping signature verification"` to find them all.

**Step 4: Fix RecordCollateralMove (line 7694)**

Replace:

```rust
// BEFORE (protocol.rs:7693-7694)
// Try to verify with zero address first; if mismatch, still sign based on leader trust
let _ = message_hash; // verification is best-effort for this phase
```

With:

```rust
// AFTER
let hash_bytes: [u8; 32] = message_hash.into();
match self.bls_signer.verify_message_hash(&leader_pubkey, &hash_bytes, &leader_signature) {
    Ok(true) => {
        debug!(cycle_number, "Leader signature verified for RecordCollateralMove");
    }
    Ok(false) => {
        return Err(Error::BlsVerification(
            "Invalid leader signature on RecordCollateralMove".to_string(),
        ));
    }
    Err(e) => {
        return Err(Error::BlsVerification(
            format!("Failed to verify RecordCollateralMove sig: {}", e),
        ));
    }
}
```

And add the `else` branch for missing key (same pattern as Step 3).

**Step 5: Fix MintBridgedShares (lines 7953-7957)**

Replace:

```rust
// BEFORE (protocol.rs:7953-7957)
Ok(false) | Err(_) => {
    // Allow - follower may not know exact bridge_proxy address
    debug!(cycle_number, "MintBridgedShares leader sig verification skipped (address mismatch ok)");
}
```

With:

```rust
// AFTER
Ok(false) => {
    return Err(Error::BlsVerification(
        "Invalid leader signature on MintBridgedShares".to_string(),
    ));
}
Err(e) => {
    return Err(Error::BlsVerification(
        format!("Failed to verify MintBridgedShares sig: {}", e),
    ));
}
```

**Step 6: Fix aggregator threshold validation**

In `aggregator.rs`, replace `set_threshold` (line 98-100):

```rust
// BEFORE
pub fn set_threshold(&mut self, threshold: usize) {
    self.required_signatures = threshold;
}
```

With:

```rust
// AFTER
pub fn set_threshold(&mut self, threshold: usize) {
    assert!(threshold >= 2, "BLS threshold must be >= 2, got {}", threshold);
    self.required_signatures = threshold;
}
```

Fix `calculate_threshold` for 0 issuers (line 33):

```rust
// BEFORE
if num_issuers == 0 {
    return 1;
}
```

With:

```rust
// AFTER
if num_issuers == 0 {
    return 2;
}
```

**Step 7: Add follower signature verification to `add_signature`**

In `aggregator.rs`, modify `add_signature` (line 127) to accept a `key_registry` reference and verify each signature:

```rust
pub fn add_signature(
    &mut self,
    peer_id: PeerId,
    signature: BLSSignature,
    key_registry: &dyn KeyRegistry,
    message_bytes: &[u8],
) -> Result<AggregationStatus, Error> {
    // ... existing dedup + length checks ...

    // Verify individual signature against peer's registered pubkey
    let pubkey = key_registry.get_public_key(&peer_id).ok_or_else(|| {
        Error::BlsVerification(format!("Peer {:?} not in key registry", peer_id))
    })?;
    match self.signer.verify(&pubkey, message_bytes, &signature) {
        Ok(true) => {}
        Ok(false) => {
            return Err(Error::BlsVerification(
                format!("Invalid BLS signature from peer {:?}", peer_id),
            ));
        }
        Err(e) => return Err(e),
    }

    // ... rest of existing add logic ...
}
```

Update all call sites that pass signatures to `add_signature`.

**Step 8: Run tests to verify they pass**

Run: `cargo test -p issuer --test bls_bypass_regression -- --nocapture`
Expected: All tests PASS

**Step 9: Run full issuer test suite**

Run: `cargo test -p issuer -- --nocapture 2>&1 | tail -20`
Expected: All existing tests still pass (update mocks as needed)

**Step 10: Commit**

```bash
git add issuer/src/consensus/protocol.rs issuer/src/consensus/aggregator.rs issuer/tests/bls_bypass_regression.rs
git commit -m "fix(consensus): eliminate all BLS verification bypass paths

- Reject proposals when leader pubkey not in registry (9 paths)
- Actually verify BLS sig in RecordCollateralMove (was discarded)
- Reject invalid sig in MintBridgedShares (was swallowed)
- Enforce threshold >= 2 in set_threshold()
- Fix calculate_threshold(0) to return 2
- Verify follower signatures before aggregation"
```

---

### Task 2: Fix silent overflow wrapping in netting i256_from_u256

**Finding:** Critical-4

**Files:**
- Modify: `issuer/src/netting/asset_decompose.rs` (lines 257-260)
- Modify: `issuer/src/netting/pair.rs` (lines 48-69)
- Test: `issuer/tests/netting_overflow_regression.rs`

**Step 1: Write failing tests**

```rust
#[test]
fn test_i256_from_u256_rejects_values_above_i256_max() {
    // I256::MAX = 2^255 - 1. Values >= 2^255 must NOT silently become negative.
    let too_large = U256::from(1u64) << 255; // exactly I256::MAX + 1
    let result = std::panic::catch_unwind(|| i256_from_u256(too_large));
    assert!(result.is_err(), "Must panic/error for values > I256::MAX");
}

#[test]
fn test_i256_from_u256_accepts_i256_max() {
    let max = (U256::from(1u64) << 255) - 1;
    let result = i256_from_u256(max);
    assert!(result.is_positive());
}

#[test]
fn test_pair_netting_rejects_overflow_amounts() {
    let order = Order {
        id: U256::from(1),
        amount: U256::MAX, // way above any safe range
        side: Side::Buy,
        ..Default::default()
    };
    let result = std::panic::catch_unwind(|| net_pair_orders(vec![order]));
    assert!(result.is_err(), "Must reject amounts that overflow I256");
}
```

**Step 2: Run tests to verify they fail**

Run: `cargo test -p issuer --test netting_overflow_regression`
Expected: FAIL (current code silently wraps)

**Step 3: Fix `i256_from_u256` in `asset_decompose.rs:257-260`**

```rust
// BEFORE
fn i256_from_u256(v: U256) -> I256 {
    I256::from_raw(v)
}

// AFTER
fn i256_from_u256(v: U256) -> I256 {
    I256::try_from(v).expect("U256 value exceeds I256::MAX -- amount overflow")
}
```

**Step 4: Fix `pair.rs:48-69`**

Replace the entire signed_amount block:

```rust
// BEFORE (pair.rs:51-69)
let signed_amount = if order.amount > U256::from(i128::MAX as u128) {
    tracing::warn!(...);
    match order.side {
        Side::Buy => I256::MAX,
        Side::Sell => I256::MIN,
    }
} else {
    match order.side {
        Side::Buy => I256::from_raw(order.amount),
        Side::Sell => -I256::from_raw(order.amount),
    }
};

// AFTER
let i256_amount = I256::try_from(order.amount).unwrap_or_else(|_| {
    panic!(
        "Order {} amount {} exceeds I256::MAX -- cannot net safely",
        order.id, order.amount
    )
});
let signed_amount = match order.side {
    Side::Buy => i256_amount,
    Side::Sell => -i256_amount,
};
```

**Step 5: Run tests, verify pass**

Run: `cargo test -p issuer --test netting_overflow_regression`
Expected: PASS

**Step 6: Commit**

```bash
git add issuer/src/netting/asset_decompose.rs issuer/src/netting/pair.rs issuer/tests/netting_overflow_regression.rs
git commit -m "fix(netting): replace silent I256 overflow wrapping with explicit panics

- i256_from_u256 now uses try_from instead of from_raw
- pair.rs rejects amounts > I256::MAX instead of silently capping"
```

---

### Task 3: Fix f64 precision loss in price conversion

**Finding:** Critical-5, High-13 (price validator)

**Files:**
- Modify: `issuer/src/price/backend.rs` (line 131)
- Modify: `issuer/src/price/validator.rs` (lines 236-238)
- Test: `issuer/tests/price_precision_regression.rs`

**Step 1: Write failing tests**

```rust
#[test]
fn test_backend_price_precision_btc_100k() {
    // BTC at $100,000 = 100000 * 1e18 = 1e23
    // f64 can only represent integers exactly up to 2^53 (~9e15)
    // So 1e23 via f64 loses ~1e7 wei of precision
    let price_str = "100000.123456789012345";
    let result = parse_price_to_u256(price_str);
    let expected = U256::from_dec_str("100000123456789012345000").unwrap();
    // Must match to at least 18 significant digits
    let diff = if result > expected { result - expected } else { expected - result };
    assert!(diff < U256::from(1000u64), "Precision loss exceeds 1000 wei: diff={}", diff);
}

#[test]
fn test_validator_uses_u256_arithmetic_not_f64() {
    // Two prices that differ by 1 wei at 1e23 scale
    // f64 cannot distinguish these, but U256 can
    let price_a = U256::from_dec_str("100000000000000000000001").unwrap(); // 1e23 + 1
    let price_b = U256::from_dec_str("100000000000000000000002").unwrap(); // 1e23 + 2
    let tolerance = 0.0001; // 0.01%
    // These should be within tolerance (differ by 1e-21 %)
    assert!(prices_within_tolerance(price_a, price_b, tolerance));
}
```

**Step 2: Run tests to verify they fail**

Expected: FAIL (f64 conversion loses precision)

**Step 3: Fix backend.rs price conversion (line 131)**

Replace f64 multiplication with string-based decimal parsing:

```rust
// BEFORE (backend.rs:131)
let price_u256 = U256::from((price_f64 * 1e18) as u128);

// AFTER
let price_u256 = parse_decimal_to_u256_18dec(&entry.last_price)
    .unwrap_or_else(|| {
        warn!(symbol = %symbol, price = %entry.last_price, "Failed to parse price string");
        continue;
    });
```

Add helper function:

```rust
/// Parse a decimal string like "100000.123456789012345" to U256 with 18 decimal places.
/// Uses pure string manipulation -- no f64 intermediate.
fn parse_decimal_to_u256_18dec(s: &str) -> Option<U256> {
    let s = s.trim();
    let (integer_part, decimal_part) = match s.split_once('.') {
        Some((i, d)) => (i, d),
        None => (s, ""),
    };

    // Pad or truncate decimal to exactly 18 digits
    let decimal_18 = if decimal_part.len() >= 18 {
        &decimal_part[..18]
    } else {
        // Pad with zeros
        &format!("{:0<18}", decimal_part)
    };

    let combined = format!("{}{}", integer_part, decimal_18);
    U256::from_dec_str(&combined).ok()
}
```

**Step 4: Fix validator.rs tolerance comparison (lines 236-238)**

Replace f64 comparison with U256 arithmetic:

```rust
// BEFORE (validator.rs:234-241)
let diff_f64 = diff.as_u128() as f64;
let leader_f64 = leader_price.price.as_u128() as f64;
diff_f64 / leader_f64

// AFTER -- pure U256 arithmetic with basis points
// difference_bps = (diff * 10000) / leader_price
let difference_bps = if leader_price.price.is_zero() {
    if my_price.price.is_zero() { U256::zero() } else { U256::MAX }
} else {
    (diff * U256::from(10000u64)) / leader_price.price
};
let tolerance_bps = U256::from((tolerance * 10000.0) as u64);
if difference_bps > tolerance_bps {
```

**Step 5: Run tests, verify pass**

Run: `cargo test -p issuer --test price_precision_regression`
Expected: PASS

**Step 6: Commit**

```bash
git add issuer/src/price/backend.rs issuer/src/price/validator.rs issuer/tests/price_precision_regression.rs
git commit -m "fix(price): eliminate f64 precision loss in price conversion and validation

- Backend: parse decimal strings directly to U256 (no f64 intermediate)
- Validator: use U256 basis-point arithmetic instead of f64 division"
```

---

### Task 4: Fix nonce gap under concurrent failures

**Finding:** Critical-6

**Files:**
- Modify: `issuer/src/chain/nonce.rs` (lines 148-192)
- Test: `issuer/tests/nonce_gap_regression.rs`

**Step 1: Write failing test**

```rust
#[tokio::test]
async fn test_nonce_gap_reclaimed_on_earlier_failure() {
    let manager = NonceManager::new_with_nonce(10);
    let n1 = manager.get_next_nonce().await; // 10
    let n2 = manager.get_next_nonce().await; // 11
    let n3 = manager.get_next_nonce().await; // 12

    // n1 (10) fails -- not the latest, but must still be reclaimed
    manager.handle_failure(n1, "execution reverted").await.unwrap();

    // Next nonce should be 10 (reclaimed), not 13
    let n4 = manager.get_next_nonce().await;
    assert_eq!(n4, U256::from(10), "Failed nonce must be reclaimed even if not latest");
}
```

**Step 2: Run test to verify it fails**

Expected: FAIL (current code only reclaims if `nonce == current - 1`)

**Step 3: Implement in-flight nonce tracking**

Replace the simple `AtomicU64` approach with a tracked set:

```rust
// In NonceManager, add:
in_flight: Arc<Mutex<BTreeSet<u64>>>,
reclaim_queue: Arc<Mutex<BTreeSet<u64>>>,

// get_next_nonce: check reclaim_queue first
pub async fn get_next_nonce(&self) -> U256 {
    let mut reclaim = self.reclaim_queue.lock().await;
    if let Some(&nonce) = reclaim.iter().next() {
        reclaim.remove(&nonce);
        self.in_flight.lock().await.insert(nonce);
        return U256::from(nonce);
    }
    drop(reclaim);

    let nonce = self.local_nonce.fetch_add(1, Ordering::SeqCst);
    self.in_flight.lock().await.insert(nonce);
    U256::from(nonce)
}

// handle_failure: always reclaim the failed nonce
pub async fn handle_failure(&self, nonce: U256, error_msg: &str) -> Result<(), Error> {
    let nonce_u64 = nonce.as_u64();
    self.in_flight.lock().await.remove(&nonce_u64);
    self.pending_txs.remove(&nonce);

    let error_lower = error_msg.to_lowercase();
    if error_lower.contains("nonce too low") || error_lower.contains("nonce has already been used") {
        self.resync_with_retry(3).await?;
    } else {
        self.reclaim_queue.lock().await.insert(nonce_u64);
    }
    Ok(())
}

// handle_success: remove from in_flight
pub async fn handle_success(&self, nonce: U256) {
    self.in_flight.lock().await.remove(&nonce.as_u64());
    self.pending_txs.remove(&nonce);
}
```

**Step 4: Run tests, verify pass**

Run: `cargo test -p issuer --test nonce_gap_regression`
Expected: PASS

**Step 5: Commit**

```bash
git add issuer/src/chain/nonce.rs issuer/tests/nonce_gap_regression.rs
git commit -m "fix(chain): track in-flight nonces and reclaim on failure

- Replace single-nonce reclaim with BTreeSet-based tracking
- Failed nonces are queued for reuse regardless of order"
```

---

### Task 5: Secure data-node connections (Vision + Arbitration)

**Findings:** Critical-7, Critical-8

**Files:**
- Modify: `issuer/src/vision/engine.rs` (line 42-44)
- Modify: `issuer/src/vision/config.rs`
- Modify: `issuer/src/arbitration/market_data.rs` (lines 112-118)
- Modify: `issuer/src/main.rs` (data-node-url validation)
- Test: `issuer/tests/data_node_security_regression.rs`

**Step 1: Write failing test**

```rust
#[test]
fn test_data_node_url_rejects_http_in_production() {
    let result = validate_data_node_url("http://localhost:8200", false); // not mock
    assert!(result.is_err(), "Plain HTTP must be rejected in production mode");
}

#[test]
fn test_data_node_url_accepts_https() {
    let result = validate_data_node_url("https://data.index.network:8200", false);
    assert!(result.is_ok());
}

#[test]
fn test_data_node_url_accepts_http_in_mock_mode() {
    let result = validate_data_node_url("http://localhost:8200", true);
    assert!(result.is_ok(), "HTTP allowed in mock/dev mode");
}
```

**Step 2: Implement URL validation**

Add to `issuer/src/config.rs`:

```rust
pub fn validate_data_node_url(url: &str, is_mock: bool) -> Result<(), String> {
    if !is_mock && url.starts_with("http://") {
        return Err(format!(
            "Data-node URL '{}' uses plain HTTP. Use HTTPS in production, or pass --mock for development.",
            url
        ));
    }
    Ok(())
}
```

Wire into `main.rs` startup:

```rust
if let Some(ref url) = args.data_node_url {
    validate_data_node_url(url, args.mock)
        .unwrap_or_else(|e| panic!("FATAL: {}", e));
}
```

**Step 3: Add bearer token auth to data-node requests**

In `vision/engine.rs`, add an auth header:

```rust
// BEFORE (engine.rs:43-44)
let client = reqwest::Client::new();
let response = client.get(&url).timeout(...).send().await;

// AFTER
let mut req = client.get(&url).timeout(std::time::Duration::from_secs(10));
if let Some(ref token) = data_node_token {
    req = req.bearer_auth(token);
}
let response = req.send().await;
```

Same pattern in `arbitration/market_data.rs`.

**Step 4: Run tests, verify pass, commit**

```bash
git add issuer/src/vision/engine.rs issuer/src/vision/config.rs issuer/src/arbitration/market_data.rs issuer/src/config.rs issuer/src/main.rs issuer/tests/data_node_security_regression.rs
git commit -m "fix(security): require HTTPS for data-node connections in production

- Reject http:// URLs unless --mock is set
- Add bearer token auth header to vision + arbitration requests"
```

---

## Phase 2: HIGH Fixes (18 findings)

---

### Task 6: Bind P2P identity to transport layer

**Findings:** High-9 (consensus identity spoofing), High-21 (P2P identity), High-12 (TLS hardcoded name)

**Files:**
- Modify: `issuer/src/consensus/messages.rs` (17 instances of `from: leader_id`)
- Modify: `issuer/src/p2p/connection.rs` (lines 411-478)
- Modify: `issuer/src/p2p/tls.rs` (line 139)
- Test: `issuer/tests/p2p_identity_regression.rs`

**Step 1: Write tests**

```rust
#[tokio::test]
async fn test_message_from_mismatched_transport_identity_rejected() {
    // Peer connected as PeerId(1) but sends message claiming leader_id=PeerId(99)
    let handler = ConsensusMessageHandler::new(/* ... */);
    let transport_from = PeerId::from(1);
    let msg = P2PMessage::ItpCreationProposal { leader_id: PeerId::from(99), /* ... */ };
    let result = handler.handle_message(transport_from, msg).await;
    assert!(matches!(result, MessageHandleResult::Reject { .. }));
}
```

**Step 2: Fix messages.rs -- validate transport identity against message identity**

In each of the 17 instances where `from: leader_id` replaces transport identity, add validation:

```rust
// At the top of handle_message(), before the match:
fn validate_sender(transport_from: PeerId, claimed_id: PeerId) -> Result<(), Error> {
    if transport_from != claimed_id {
        return Err(Error::Authentication(format!(
            "Transport peer {:?} claims to be {:?} -- identity mismatch",
            transport_from, claimed_id
        )));
    }
    Ok(())
}

// In each match arm, before returning MessageHandleResult:
P2PMessage::ItpCreationProposal { leader_id, .. } => {
    validate_sender(from, leader_id)?;
    MessageHandleResult::ProcessItpCreationProposal {
        from: leader_id, // now validated == transport from
        ...
    }
}
```

**Step 3: Fix tls.rs -- per-node certificate identity**

Replace hardcoded server name with node-specific name:

```rust
// BEFORE (tls.rs:139)
let tls = self.connect_tls(stream, "issuer.index.local").await?;

// AFTER
let expected_name = format!("issuer-{}.index.local", target_peer_id);
let tls = self.connect_tls(stream, &expected_name).await?;
```

**Step 4: Run tests, verify pass, commit**

```bash
git add issuer/src/consensus/messages.rs issuer/src/p2p/connection.rs issuer/src/p2p/tls.rs issuer/tests/p2p_identity_regression.rs
git commit -m "fix(p2p): bind message identity to transport identity

- Validate leader_id/signer_id matches transport-level peer
- Use per-node TLS certificate names instead of shared name"
```

---

### Task 7: Fix predictable leader election

**Finding:** High-12

**Files:**
- Modify: `issuer/src/leader/election.rs` (lines 172-186)
- Test: `issuer/tests/leader_election_regression.rs`

**Step 1: Write test**

```rust
#[test]
fn test_leader_election_not_purely_round_robin() {
    let elector = LeaderElector::new(0, 20);
    // Verify consecutive cycles don't always produce sequential leaders
    let leaders: Vec<u8> = (0..100).map(|c| elector.leader_for_cycle(c)).collect();
    let sequential_count = leaders.windows(2).filter(|w| w[1] == (w[0] + 1) % 20).count();
    assert!(sequential_count < 80, "Leader election must not be purely sequential");
}
```

**Step 2: Replace round-robin with signature-based election**

```rust
// BEFORE (election.rs:179)
let leader_index = (cycle_number % self.num_issuers as u64) as u8;

// AFTER -- use previous cycle's batch hash for unpredictability
pub fn leader_for_cycle(&self, cycle_number: u64, prev_batch_hash: Option<H256>) -> u8 {
    let seed = match prev_batch_hash {
        Some(hash) => {
            let mut hasher = Keccak256::new();
            hasher.update(hash.as_bytes());
            hasher.update(&cycle_number.to_be_bytes());
            let result = hasher.finalize();
            u64::from_be_bytes(result[0..8].try_into().unwrap())
        }
        None => cycle_number, // fallback for genesis
    };
    (seed % self.num_issuers as u64) as u8
}
```

**Step 3: Run tests, verify pass, commit**

```bash
git add issuer/src/leader/election.rs issuer/tests/leader_election_regression.rs
git commit -m "fix(consensus): use hash-based leader election instead of round-robin"
```

---

### Task 8: Persist bridge state to database

**Findings:** High-15, High-16, High-18

**Files:**
- Modify: `issuer/src/bridge/orchestrator.rs` (lines 68-168)
- Create: `issuer/migrations/bridge_state.sql`
- Test: `issuer/tests/bridge_persistence_regression.rs`

**Step 1: Create migration**

```sql
-- bridge_state.sql
CREATE TABLE IF NOT EXISTS bridge_processed_orders (
    order_id TEXT PRIMARY KEY,
    tx_hash TEXT NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bridge_order_status (
    order_id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bridge_order_mappings (
    arb_order_id TEXT PRIMARY KEY,
    l3_order_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bridge_custody_nonces (
    address TEXT PRIMARY KEY,
    nonce TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Step 2: Add persistence layer to BridgeOrchestrator**

Add a `BridgeStateStore` trait and `PostgresBridgeStateStore` impl. On startup, load `processed_orders`, `order_status`, `order_mappings`, and `custody_nonces` from Postgres. On each mutation, write-through to Postgres.

**Step 3: Replace `Instant` with `chrono::DateTime<Utc>` in watchdog**

```rust
// BEFORE (watchdog.rs)
status_changes: HashMap<U256, Instant>,

// AFTER
status_changes: HashMap<U256, DateTime<Utc>>,
```

This survives process restarts (loaded from DB timestamp).

**Step 4: Write test, run, commit**

```bash
git add issuer/src/bridge/orchestrator.rs issuer/src/bridge/watchdog.rs issuer/migrations/bridge_state.sql issuer/tests/bridge_persistence_regression.rs
git commit -m "fix(bridge): persist critical bridge state to Postgres

- processed_orders, order_status, order_mappings, custody_nonces in DB
- Watchdog uses DateTime<Utc> instead of Instant
- State survives process restarts"
```

---

### Task 9: Add P2P rate limiting and connection caps

**Finding:** High-20

**Files:**
- Modify: `issuer/src/p2p/transport.rs` (lines 99-129)
- Test: `issuer/tests/p2p_dos_regression.rs`

**Step 1: Implement per-IP connection limit and global connection cap**

```rust
// In transport.rs listener loop:
let connection_counts: Arc<DashMap<IpAddr, AtomicUsize>> = Arc::new(DashMap::new());
const MAX_CONNECTIONS_PER_IP: usize = 5;
const MAX_TOTAL_CONNECTIONS: usize = 100;
let total_connections = Arc::new(AtomicUsize::new(0));

// Before accepting:
let ip = addr.ip();
let ip_count = connection_counts.entry(ip).or_insert(AtomicUsize::new(0));
if ip_count.load(Ordering::Relaxed) >= MAX_CONNECTIONS_PER_IP {
    warn!(%addr, "Per-IP connection limit reached, rejecting");
    drop(stream);
    continue;
}
if total_connections.load(Ordering::Relaxed) >= MAX_TOTAL_CONNECTIONS {
    warn!(%addr, "Global connection limit reached, rejecting");
    drop(stream);
    continue;
}
ip_count.fetch_add(1, Ordering::Relaxed);
total_connections.fetch_add(1, Ordering::Relaxed);
```

**Step 2: Run tests, commit**

```bash
git add issuer/src/p2p/transport.rs issuer/tests/p2p_dos_regression.rs
git commit -m "fix(p2p): add per-IP and global connection limits to prevent DoS"
```

---

### Task 10: Sign checkpoint files and verify on load

**Finding:** High-22

**Files:**
- Modify: `issuer/src/state/reconstruction.rs` (lines 483-529)
- Test: `issuer/tests/checkpoint_integrity_regression.rs`

**Step 1: Add HMAC to checkpoint save/load**

```rust
// save_checkpoint: append HMAC
use hmac::{Hmac, Mac};
use sha2::Sha256;
type HmacSha256 = Hmac<Sha256>;

pub fn save_checkpoint(checkpoint: &Checkpoint, path: &str, secret: &[u8]) -> Result<(), Error> {
    let json = serde_json::to_string_pretty(checkpoint)?;
    let mut mac = HmacSha256::new_from_slice(secret).unwrap();
    mac.update(json.as_bytes());
    let sig = hex::encode(mac.finalize().into_bytes());

    let sealed = format!("{}\n---HMAC---\n{}", json, sig);
    std::fs::write(path, sealed)?;
    Ok(())
}

// load_checkpoint: verify HMAC
pub fn load_checkpoint(path: &str, secret: &[u8]) -> Result<Option<Checkpoint>, Error> {
    // ... read file, split on ---HMAC---, verify mac, deserialize ...
}
```

**Step 2: Add block_hash verification against chain on load**

```rust
// After deserializing checkpoint:
let on_chain_hash = chain_reader.get_block_hash(checkpoint.block_number).await?;
if on_chain_hash != checkpoint.block_hash {
    return Err(Error::Serialization(
        format!("Checkpoint block_hash mismatch: expected {:?}, got {:?}", on_chain_hash, checkpoint.block_hash)
    ));
}
```

**Step 3: Run tests, commit**

```bash
git add issuer/src/state/reconstruction.rs issuer/tests/checkpoint_integrity_regression.rs
git commit -m "fix(state): add HMAC integrity and block_hash verification to checkpoints"
```

---

### Task 11: Replace f64 with fixed-point in Vision tick resolution

**Findings:** High-23 (vision f64 non-determinism), High-16 (multiplier truncation)

**Files:**
- Modify: `issuer/src/vision/multiplier.rs` (lines 49-65)
- Modify: `issuer/src/vision/resolver.rs` (lines 165-177)
- Test: `issuer/tests/vision_determinism_regression.rs`

**Step 1: Write test**

```rust
#[test]
fn test_multiplier_deterministic_across_platforms() {
    // Same inputs must always produce same output (no f64 variance)
    let result1 = compute_effective_stake(stake, early_secs, tick_duration, ticks_committed, config);
    let result2 = compute_effective_stake(stake, early_secs, tick_duration, ticks_committed, config);
    assert_eq!(result1, result2, "Multiplier must be deterministic");
}

#[test]
fn test_resolver_uses_integer_arithmetic() {
    // Percentage change that would round differently on different f64 implementations
    let start = U256::from(10000u64); // $0.00000000000001 in 18-dec
    let end = U256::from(10005u64);
    let pct = compute_pct_change_bps(start, end);
    assert_eq!(pct, 5); // 0.05% = 5 bps, deterministic
}
```

**Step 2: Replace f64 multiplier with fixed-point U256 arithmetic**

```rust
// BEFORE (multiplier.rs:49-65) -- f64 pipeline
let early_mult = 1.0 + (capped_time as f64).powi(2) / (tick_duration as f64).powi(2);

// AFTER -- U256 with 18-decimal precision
const PRECISION: U256 = U256::from(1_000_000_000_000_000_000u64); // 1e18
let early_mult = PRECISION + (U256::from(capped_time).pow(2) * PRECISION) / U256::from(tick_duration).pow(2);
// For log10: use lookup table or integer approximation
let commitment_mult = integer_log10_scaled(ticks_committed + config.commitment_offset, PRECISION);
let total_mult = (early_mult * commitment_mult) / PRECISION;
let effective_stake = (player.stake_per_tick * total_mult) / PRECISION;
```

**Step 3: Replace f64 in resolver.rs percentage change**

```rust
// BEFORE (resolver.rs:165-169)
let pct_change = (end_price - start_price) / start_price * 100.0;

// AFTER -- integer basis points
fn compute_pct_change_bps(start: U256, end: U256) -> i64 {
    if start.is_zero() { return 0; }
    let diff = if end >= start { end - start } else { start - end };
    let bps = (diff * U256::from(10000u64)) / start;
    let bps_i64 = bps.as_u64() as i64;
    if end >= start { bps_i64 } else { -bps_i64 }
}
```

**Step 4: Add bounds check for `resolution_types` array access (line 172)**

```rust
// BEFORE
let resolution_type = batch.resolution_types[market_idx];

// AFTER
let resolution_type = batch.resolution_types.get(market_idx).copied().unwrap_or_else(|| {
    warn!(batch_id, market_idx, "resolution_types index out of bounds, defaulting to Standard");
    ResolutionType::Standard
});
```

**Step 5: Run tests, commit**

```bash
git add issuer/src/vision/multiplier.rs issuer/src/vision/resolver.rs issuer/tests/vision_determinism_regression.rs
git commit -m "fix(vision): replace f64 with fixed-point integer arithmetic for determinism

- Multiplier uses U256 scaled arithmetic
- Resolver uses basis-point integer comparison
- Bounds check on resolution_types array access"
```

---

### Task 12: Add reorg handling to Vision chain_listener

**Finding:** High-24, High-25

**Files:**
- Modify: `issuer/src/vision/chain_listener.rs` (lines 158-162, 292-316)
- Test: `issuer/tests/vision_reorg_regression.rs`

**Step 1: Implement reorg detection**

```rust
// After fetching block range, verify parent hash continuity:
let latest_block = provider.get_block(to_block).await?;
if let Some(expected_parent) = self.last_block_hash {
    if latest_block.parent_hash != expected_parent {
        warn!(to_block, "Chain reorg detected! Rolling back cursor");
        cursor = self.find_common_ancestor(cursor, to_block).await?;
        self.rollback_to_block(cursor).await?;
        continue;
    }
}
self.last_block_hash = latest_block.hash;
```

**Step 2: Make scheduler + Postgres updates atomic**

```rust
// BEFORE (chain_listener.rs:292-316)
self.scheduler.on_batch_created(batch.clone()).await;
if let Err(e) = sqlx::query(...).execute(&self.pool).await {
    warn!(...);
}

// AFTER -- write to Postgres first, then update scheduler
let mut tx = self.pool.begin().await?;
sqlx::query(...).execute(&mut *tx).await?;
tx.commit().await?;
// Only update in-memory state after DB succeeds
self.scheduler.on_batch_created(batch.clone()).await;
```

**Step 3: Fix cursor advancement to depend on bookmark save**

```rust
// BEFORE (chain_listener.rs:158-162)
if let Err(e) = self.save_last_indexed_block(to_block).await {
    warn!(...);
}
cursor = to_block + 1;

// AFTER
match self.save_last_indexed_block(to_block).await {
    Ok(()) => { cursor = to_block + 1; }
    Err(e) => {
        warn!(error = %e, "Failed to save bookmark, NOT advancing cursor");
        // Will re-process this block range on next iteration
    }
}
```

**Step 4: Run tests, commit**

```bash
git add issuer/src/vision/chain_listener.rs issuer/tests/vision_reorg_regression.rs
git commit -m "fix(vision): add reorg detection and atomic state updates

- Detect reorgs via parent hash verification
- Postgres writes before in-memory updates
- Cursor only advances after successful bookmark save"
```

---

### Task 13: Fix arbitration BLS verification and defaults

**Findings:** High-26 (price votes unverified), High-30 (negative price cast), High-31-32 (resolution sigs unverified)

**Files:**
- Modify: `issuer/src/arbitration/processor.rs` (lines 88-98, 100-109, 271)
- Modify: `issuer/src/arbitration/consensus.rs` (line 54)
- Test: `issuer/tests/arbitration_regression.rs`

**Step 1: Write tests**

```rust
#[test]
fn test_price_vote_requires_bls_verification() {
    let mut processor = ArbitrationProcessor::new(/* ... */);
    let vote = P2PMessage::ArbitrationPriceVote {
        voter_index: 0,
        bet_id: H256::zero(),
        accept: true,
        signature: BLSSignature(vec![0xFF; 64]), // garbage sig
    };
    processor.handle_message(PeerId::from(0), vote);
    // Vote should NOT be counted without valid BLS sig
    let state = processor.active.get(&H256::zero());
    assert!(state.is_none() || state.unwrap().price_votes.is_empty());
}

#[test]
fn test_negative_price_encoded_correctly() {
    let hash1 = build_price_proposal_hash(&[(0, "BTC".into(), -100i64)]);
    let hash2 = build_price_proposal_hash(&[(0, "BTC".into(), -100i64)]);
    assert_eq!(hash1, hash2, "Must be deterministic");
    // And different from positive 100
    let hash3 = build_price_proposal_hash(&[(0, "BTC".into(), 100i64)]);
    assert_ne!(hash1, hash3);
}

#[test]
fn test_creator_wins_none_does_not_default_to_filler() {
    // When consensus is incomplete, don't settle the bet
    let state = BetConsensusState { creator_wins: None, /* ... */ };
    assert!(!state.is_ready_to_settle(), "Must not settle without resolution");
}
```

**Step 2: Add BLS verification to price vote handler**

```rust
// BEFORE (processor.rs:88-98)
state.price_votes.insert(voter_index, accept);

// AFTER
let pubkey = self.key_registry.get_public_key(&PeerId::from(voter_index as u64))
    .ok_or_else(|| warn!("Unknown voter {}", voter_index))?;
let msg_hash = build_price_proposal_hash(&state.prices);
match self.bls_signer.verify_message_hash(&pubkey, &msg_hash, &signature) {
    Ok(true) => { state.price_votes.insert(voter_index, accept); }
    _ => { warn!(voter_index, "Invalid BLS sig on price vote, rejecting"); }
}
```

**Step 3: Fix negative price encoding**

```rust
// BEFORE (consensus.rs:54)
Token::Int(U256::from(*price as u64)),

// AFTER
Token::Tuple(vec![
    Token::Bool(*price >= 0),
    Token::Uint(U256::from(price.unsigned_abs())),
])
```

**Step 4: Fix `creator_wins` default**

```rust
// BEFORE (processor.rs:271)
creator_wins: state.creator_wins.unwrap_or(false),

// AFTER -- skip unresolved bets
if state.creator_wins.is_none() {
    warn!(bet_id = %bet_id, "Bet resolution incomplete, skipping settlement");
    continue;
}
let creator_wins = state.creator_wins.unwrap();
```

**Step 5: Run tests, commit**

```bash
git add issuer/src/arbitration/processor.rs issuer/src/arbitration/consensus.rs issuer/tests/arbitration_regression.rs
git commit -m "fix(arbitration): verify BLS on price votes, fix negative prices, no default settlement"
```

---

### Task 14: Add production guards for dev-only CLI flags

**Findings:** High-27 (--no-tls), High-28 (--bls-key-seed-index)

**Files:**
- Modify: `issuer/src/main.rs` (lines 86-88, 118-120, 130-132)
- Test: `issuer/tests/cli_safety_regression.rs`

**Step 1: Add startup validation**

In `main.rs`, after parsing args:

```rust
// Reject dangerous flags in production mode
if !args.mock {
    if args.no_tls {
        panic!("FATAL: --no-tls requires --mock. Do not disable TLS in production.");
    }
    if args.bls_key_seed_index.is_some() {
        panic!("FATAL: --bls-key-seed-index requires --mock. Deterministic keys are insecure.");
    }
    if args.skip_reconstruction {
        panic!("FATAL: --skip-reconstruction requires --mock. Production nodes must reconstruct state.");
    }
}

// Validate consensus timeout fits in cycle
if let (Some(consensus_ms), Some(cycle_ms)) = (args.consensus_timeout_ms, args.cycle_duration_ms) {
    assert!(
        consensus_ms < cycle_ms,
        "consensus_timeout_ms ({}) must be < cycle_duration_ms ({})",
        consensus_ms, cycle_ms
    );
}

// Validate data-node-url is present when needed
if !args.mock && args.data_node_url.is_none() {
    panic!("FATAL: --data-node-url is required in production mode");
}
```

**Step 2: Run tests, commit**

```bash
git add issuer/src/main.rs issuer/tests/cli_safety_regression.rs
git commit -m "fix(bootstrap): reject dev-only CLI flags in production mode

- --no-tls, --bls-key-seed-index, --skip-reconstruction require --mock
- Validate consensus_timeout_ms < cycle_duration_ms at startup
- Require --data-node-url in production"
```

---

### Task 15: Persist CustodyWriter nonce bitmap + fix infinite loop

**Findings:** High-18, High-19

**Files:**
- Modify: `issuer/src/chain/custody_writer.rs` (lines 73-130)
- Test: `issuer/tests/custody_nonce_regression.rs`

**Step 1: Add upper bound to `next_available()`**

```rust
// BEFORE (custody_writer.rs:108-116)
fn next_available(&self) -> U256 {
    let mut nonce = U256::zero();
    loop {
        if !self.is_used(nonce) { return nonce; }
        nonce += U256::one();
    }
}

// AFTER
fn next_available(&self) -> Result<U256, Error> {
    let mut nonce = U256::zero();
    let max_scan = U256::from(1_000_000u64); // safety limit
    while nonce < max_scan {
        if !self.is_used(nonce) { return Ok(nonce); }
        nonce += U256::one();
    }
    Err(Error::NonceBitmap("All nonces exhausted within scan limit".into()))
}
```

**Step 2: Add on-chain nonce sync on startup**

Read used nonces from BLSCustody contract events and populate the bitmap on startup, so it survives restarts.

**Step 3: Run tests, commit**

```bash
git add issuer/src/chain/custody_writer.rs issuer/tests/custody_nonce_regression.rs
git commit -m "fix(chain): bound custody nonce scan and sync from on-chain state on startup"
```

---

## Phase 3: MEDIUM Fixes (24 findings)

---

### Task 16: Fix price staleness bypass and missing-asset validation

**Findings:** Medium (bitget cache + timestamp override, missing leader prices, SystemTime)

**Files:**
- Modify: `issuer/src/price/backend.rs` (line 135 -- timestamp override)
- Modify: `issuer/src/price/bitget.rs` (cache timestamp preservation)
- Modify: `issuer/src/price/validator.rs` (missing asset detection)

**Changes:**

1. **backend.rs:135** -- Preserve original timestamp instead of overwriting:
```rust
// BEFORE
timestamp: current_timestamp(),
// AFTER
timestamp: entry.timestamp.unwrap_or_else(current_timestamp),
```

2. **bitget.rs** -- Store cache population time in `PriceFeed.timestamp`:
```rust
let cache_time = current_timestamp();
// When reading from cache, use cache_time, not SystemTime::now()
```

3. **validator.rs** -- Flag missing assets as disagreement:
```rust
// After the existing loop over `mine`, add:
let leader_only_assets: Vec<_> = leader_map.keys()
    .filter(|a| !my_assets.contains(a))
    .collect();
if !leader_only_assets.is_empty() {
    warn!(count = leader_only_assets.len(), "Leader has prices follower lacks");
    disagreements += leader_only_assets.len();
}
let my_only_assets: Vec<_> = my_assets.iter()
    .filter(|a| !leader_map.contains_key(a))
    .collect();
if !my_only_assets.is_empty() {
    warn!(count = my_only_assets.len(), "Follower has prices leader lacks");
    disagreements += my_only_assets.len();
}
```

**Commit:**
```bash
git commit -m "fix(price): preserve original timestamps, flag missing assets in validation"
```

---

### Task 17: Fix netting edge cases

**Findings:** Medium (zero-net Buy default, two-step division truncation, USDT heuristic fallback)

**Files:**
- Modify: `issuer/src/netting/pair.rs` (line 84-88)
- Modify: `issuer/src/netting/asset_decompose.rs` (lines 175-176)
- Modify: `issuer/src/netting/usdt.rs` (line 407, 570-580)

**Changes:**

1. **pair.rs:84-88** -- Return None for zero-net instead of defaulting to Buy:
```rust
// BEFORE
let side = if net_amount >= I256::zero() { Side::Buy } else { Side::Sell };
// AFTER
if net_amount.is_zero() {
    return None; // no trade needed, skip this pair
}
let side = if net_amount.is_positive() { Side::Buy } else { Side::Sell };
```

2. **asset_decompose.rs:175-176** -- Single combined division to reduce truncation:
```rust
// BEFORE
let usdc_amount = (order_amount * weight) / PRECISION / nav_price;
// AFTER
let usdc_amount = (order_amount * weight) / (PRECISION * nav_price / U256::exp10(18));
```

3. **usdt.rs:570-580** -- Return error instead of heuristic fallback when registry locked:
```rust
// BEFORE -- falls through to heuristic on lock contention
// AFTER
if registry.is_none() {
    return Err(Error::RegistryUnavailable("ChainPairRegistry locked, retry next cycle"));
}
```

**Commit:**
```bash
git commit -m "fix(netting): handle zero-net pairs, reduce truncation, reject USDT heuristic"
```

---

### Task 18: Fix bridge race conditions and lock expiry

**Findings:** Medium (TOCTOU race, 60s rebalance lock, writer nonce TOCTOU)

**Files:**
- Modify: `issuer/src/bridge/orchestrator.rs` (lines 250-267, 411-421)
- Modify: `issuer/src/chain/arbitrum_writer.rs`
- Modify: `issuer/src/chain/writer.rs` (lines ~518-570)

**Changes:**

1. **orchestrator.rs:250-267** -- Extend rebalance lock to 5 minutes + on-chain confirmation check:
```rust
// BEFORE
if started_at.elapsed() < Duration::from_secs(60) {
// AFTER
if started_at.elapsed() < Duration::from_secs(300) {
    // Also verify on-chain that rebalance is still pending
```

2. **orchestrator.rs:411-421** -- Convert point-in-time check to mutex-protected section:
```rust
// Acquire a lock that prevents both L3-native and cross-chain from racing
let _bridge_lock = self.bridge_processing_mutex.lock().await;
if self.has_any_active_bridge_orders().await { return; }
// ... process L3-native orders while holding the lock
```

3. **writer.rs:518-570** -- Route through NonceManager:
```rust
// BEFORE -- uses ethers-rs internal nonce tracking
// AFTER -- get nonce from our NonceManager
let nonce = self.nonce_manager.get_next_nonce().await;
// Build tx with explicit nonce
```

4. **arbitrum_writer.rs** -- Wrap nonce read + increment in a lock.

**Commit:**
```bash
git commit -m "fix(bridge): extend rebalance lock, mutex for L3/cross-chain, unify nonce management"
```

---

### Task 19: Fix Vision memory growth and error exposure

**Findings:** Medium (bitmap store unbounded, tick scheduler unbounded, DB errors exposed, balance endpoint unsigned)

**Files:**
- Modify: `issuer/src/vision/bitmap_store.rs` (lines 13-17)
- Modify: `issuer/src/vision/tick_scheduler.rs`
- Modify: `issuer/src/vision/api.rs` (lines 247-255, 353-361, 684-691)

**Changes:**

1. **bitmap_store.rs** -- Add max entries and TTL-based eviction:
```rust
const MAX_BITMAPS: usize = 100_000;

pub fn store(&self, batch_id: u64, player: Address, bitmap: StoredBitmap) -> Result<(), Error> {
    let mut bitmaps = self.bitmaps.write().await;
    if bitmaps.len() >= MAX_BITMAPS {
        // Evict oldest batch entries
        self.evict_resolved_batches(&mut bitmaps);
    }
    bitmaps.insert((batch_id, player), bitmap);
    Ok(())
}
```

2. **tick_scheduler.rs** -- Add periodic cleanup of resolved batches:
```rust
pub fn cleanup_resolved(&mut self, resolved_batch_ids: &HashSet<u64>) {
    self.batches.retain(|id, _| !resolved_batch_ids.contains(id));
    self.player_positions.retain(|(id, _), _| !resolved_batch_ids.contains(id));
    self.last_resolved.retain(|id, _| !resolved_batch_ids.contains(id));
}
```

3. **api.rs** -- Sanitize DB errors:
```rust
// BEFORE
Json(ApiError::new(format!("Database error: {e}")))
// AFTER
error!(error = %e, "Database query failed");
Json(ApiError::new("Internal database error".to_string()))
```

4. **api.rs:684-691** -- Add TODO tracking for BLS-signed balance (mark as known technical debt, not fixed in this PR since it requires on-chain withdrawal contract changes).

**Commit:**
```bash
git commit -m "fix(vision): bound bitmap/scheduler memory, sanitize DB errors"
```

---

### Task 20: Fix arbitration float-to-cents and missing event replay

**Findings:** Medium (float-to-cents rounding, listener misses historical events, consensus timeout)

**Files:**
- Modify: `issuer/src/arbitration/market_data.rs` (line 147)
- Modify: `issuer/src/arbitration/listener.rs` (lines 54-55)
- Modify: `issuer/src/arbitration/processor.rs` (active map cleanup)

**Changes:**

1. **market_data.rs:147** -- Request integer cents from data-node or use deterministic rounding:
```rust
// BEFORE
let cents = (price.value * 100.0).round() as i64;
// AFTER -- use string parsing to avoid f64 rounding
let cents = parse_price_to_cents(&price.raw_value)?;
```

2. **listener.rs:54-55** -- Persist last-processed block and resume from there:
```rust
// BEFORE -- starts from current tip
let start_block = provider.get_block_number().await?;
// AFTER
let start_block = self.load_last_processed_block().await?.unwrap_or_else(|| {
    provider.get_block_number().await.unwrap()
});
```

3. **processor.rs** -- Add timeout-based cleanup for stuck consensus states:
```rust
pub fn cleanup_stale(&mut self, max_age: Duration) {
    let now = Instant::now();
    self.active.retain(|_, state| {
        now.duration_since(state.created_at) < max_age
    });
}
```

**Commit:**
```bash
git commit -m "fix(arbitration): deterministic price rounding, historical event replay, stale cleanup"
```

---

### Task 21: Fix P2P codec and unbounded consensus message buffer

**Findings:** Medium (buf.clear on oversized msg, unbounded pending_messages)

**Files:**
- Modify: `issuer/src/p2p/codec.rs` (lines 89-97)
- Modify: `issuer/src/consensus/messages.rs` (lines 14-16)

**Changes:**

1. **codec.rs:92** -- Skip only the oversized frame, not the entire buffer:
```rust
// BEFORE
self.buffer.clear();
// AFTER
let skip_len = 4 + payload_len; // length prefix + claimed payload
if self.buffer.len() >= skip_len {
    self.buffer.advance(skip_len);
} else {
    self.buffer.clear(); // not enough data yet, clear to reset
}
```

2. **messages.rs:14-16** -- Cap pending message buffer:
```rust
const MAX_PENDING_MESSAGES: usize = 1000;
const MAX_CYCLE_DISTANCE: u64 = 10;

// Before buffering:
if cycle_number > current_cycle + MAX_CYCLE_DISTANCE {
    warn!("Message too far in future (cycle {}), dropping", cycle_number);
    return;
}
if self.pending_messages.len() >= MAX_PENDING_MESSAGES {
    warn!("Pending message buffer full, dropping oldest");
    self.pending_messages.remove(0);
}
```

**Commit:**
```bash
git commit -m "fix(p2p): skip only oversized frames in codec, cap pending message buffer"
```

---

## Phase 4: LOW Fixes (21 findings)

---

### Task 22: Fix panics on edge cases across subsystems

**Files:**
- Modify: `issuer/src/slippage/mod.rs` (lines 117-120 -- negative spread panic)
- Modify: `issuer/src/vision/side_matching.rs` (lines 111-116 -- overflow panic)
- Modify: `issuer/src/vision/resolver.rs` (line 172 -- array index)
- Modify: `issuer/src/chain/reader.rs` (lines ~190,199 -- default order status)
- Modify: `issuer/src/chain/arbitrum_reader.rs` (clear_old_seen_orders)
- Modify: `issuer/src/vision/chain_listener.rs` (line 897 -- extract_indexed_u64 truncation)
- Modify: `issuer/src/main.rs` (line 1344-1348 -- zero NAV, line 1380 -- E021 string matching)

**Changes (each is a 1-2 line fix):**

1. **slippage/mod.rs:117** -- Return error instead of panic:
```rust
// BEFORE
assert!(spread >= 0);
// AFTER
if spread < 0 { return Err(Error::NegativeSpread(spread)); }
```

2. **side_matching.rs:114** -- Return error instead of expect:
```rust
// BEFORE
.checked_mul(matched).expect("matched_stake overflow")
// AFTER
.checked_mul(matched).ok_or(Error::Overflow("matched_stake * matched"))?
```

3. **reader.rs:190,199** -- Return error for unknown values:
```rust
// BEFORE
_ => OrderStatus::Pending, // default
// AFTER
other => return Err(Error::UnknownOrderStatus(other)),
```

4. **arbitrum_reader.rs** -- Use LRU cache instead of full clear:
```rust
// BEFORE
self.seen_orders.clear();
// AFTER -- remove oldest 25%
let remove_count = self.seen_orders.len() / 4;
for _ in 0..remove_count {
    if let Some(oldest) = self.seen_orders.iter().next().cloned() {
        self.seen_orders.remove(&oldest);
    }
}
```

5. **chain_listener.rs:897** -- Add bounds check:
```rust
// BEFORE
U256::from(bytes).as_u64()
// AFTER
let val = U256::from(bytes);
if val > U256::from(u64::MAX) {
    warn!("Indexed value exceeds u64::MAX, truncating");
}
val.as_u64()
```

6. **main.rs:1344-1348** -- Reject zero NAV:
```rust
// BEFORE
let shares = if fill.fill_price > U256::zero() { ... } else { fill.fill_amount };
// AFTER
if fill.fill_price.is_zero() {
    return Err(Error::ZeroNav("Cannot compute shares with zero NAV"));
}
let shares = (fill.fill_amount * U256::exp10(18)) / fill.fill_price;
```

7. **main.rs:1380** -- Use ABI decoding instead of string matching:
```rust
// BEFORE
if err_str.contains("E021") || err_str.contains("7a5425d1")
// AFTER
if matches!(decode_revert_reason(&err_bytes), Some(RevertReason::AlreadyBatched))
```

**Commit:**
```bash
git commit -m "fix: replace panics with errors, add bounds checks across subsystems"
```

---

### Task 23: Fix Vision persistence gaps

**Findings:** Low (bitmaps lost on restart, reveal window uses system clock)

**Files:**
- Modify: `issuer/src/vision/bitmap_store.rs`
- Modify: `issuer/src/vision/api.rs` (line 734 -- reveal window)

**Changes:**

1. **bitmap_store.rs** -- Add Postgres persistence for bitmaps:
```rust
// On store(), write-through to Postgres table `vision_bitmaps`
// On startup, load from Postgres
```

2. **api.rs:734** -- Use chain timestamp:
```rust
// BEFORE
let now = SystemTime::now();
// AFTER
let now = self.chain_reader.get_latest_block_timestamp().await?;
```

**Commit:**
```bash
git commit -m "fix(vision): persist bitmaps to Postgres, use chain timestamp for reveal window"
```

---

### Task 24: Fix remaining low-severity issues

**Files:**
- Modify: `issuer/src/price/bitget.rs` (line 162 -- saturating_mul)
- Modify: `issuer/src/price/bitget.rs` (line 238 -- best_ask vs mid-price)
- Modify: `issuer/src/chain/gas.rs` (line ~128 -- fallback gas warning)
- Modify: `issuer/src/arbitration/types.rs` (lines 52-55 -- silent config failure)
- Modify: `issuer/src/arbitration/listener.rs` (lines 123-131 -- zero-valued stub)

**Changes:**

1. **bitget.rs:162** -- Return error on overflow instead of saturating:
```rust
// BEFORE
.saturating_mul(...)
// AFTER
.checked_mul(...).ok_or(Error::PriceOverflow(...))?
```

2. **bitget.rs:238** -- Use mid-price:
```rust
// BEFORE
let price = parse_price(&ticker.best_ask, asset)?;
// AFTER
let ask = parse_price(&ticker.best_ask, asset)?;
let bid = parse_price(&ticker.best_bid, asset)?;
let price = (ask + bid) / U256::from(2);
```

3. **gas.rs:~128** -- Log at warn level on fallback:
```rust
warn!(code = "INFRA-003", fallback = %fallback_gas_limit, "Gas estimation failed, using fallback");
```

4. **arbitration/types.rs:52-55** -- Log warning:
```rust
// BEFORE
None
// AFTER
warn!("Failed to parse arbitration config -- arbitration will be DISABLED");
None
```

5. **arbitration/listener.rs:123-131** -- Validate enrichment before processing:
```rust
if request.creator == Address::zero() || request.filler == Address::zero() {
    warn!(bet_id = %request.bet_id, "Enrichment failed -- zero addresses, skipping");
    continue;
}
```

**Commit:**
```bash
git commit -m "fix: address remaining low-severity audit findings

- Error on price overflow instead of saturating
- Use mid-price instead of best_ask
- Warn on gas estimation fallback
- Warn on arbitration config parse failure
- Validate enrichment before processing bets"
```

---

## Summary

| Phase | Tasks | Findings Covered | Priority |
|-------|-------|-----------------|----------|
| Phase 1 | Tasks 1-5 | 8 Critical | Fix immediately |
| Phase 2 | Tasks 6-15 | 18 High | Fix within 1 week |
| Phase 3 | Tasks 16-21 | 24 Medium | Fix within 2 weeks |
| Phase 4 | Tasks 22-24 | 21 Low | Fix within 1 month |

**Total: 24 tasks covering all 71 findings.**

Each task is independently testable and committable. Tasks within the same phase can be parallelized across agents (max 3 concurrent per CLAUDE.md).
