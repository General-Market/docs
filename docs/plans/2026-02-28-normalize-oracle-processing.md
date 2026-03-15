# Normalize Oracle Processing — Kill the Central Bottleneck

## Problem

The oracle main loop has a **centralized sequential bottleneck**: `run_cycle()` runs synchronously every tick, blocking everything. It bundles price consensus + batch consensus into one call. When it fails (~14% of cycles), all other work (buy, sell, create, L3-native, rebalance) is skipped entirely.

Each task already has its own BLS consensus internally. There's no reason any of them should wait for an unrelated price update to finish.

## Before (Broken)

```
CycleManager tick
       │
       ▼
  run_cycle()          ← synchronous, blocks 1-3s
  (price + batch)
       │
  success? ── no ──→ SKIP EVERYTHING
       │
      yes
       │
  ┌────┼────┬─────┬──────────┐
  ▼    ▼    ▼     ▼          ▼
 ITP  BUY  SELL  L3-native  Rebalance
```

## After (Normalized)

All tasks are peers. No gatekeeper. Leader proposes, followers agree or not. Same pattern for everything.

```
CycleManager tick
       │
  ┌────┼────┬────┬─────┬──────┬───────┐
  ▼    ▼    ▼    ▼     ▼      ▼       ▼
PRICE BUY  SELL CREATE L3-ORD REBAL  STALE
```

Each task:
1. `*_active` flag check → skip if already running
2. Detect pending work (chain read / events)
3. Leader proposes, followers verify + sign
4. Settle on-chain
5. If fail: log, try next cycle. Nothing else affected.

## Phase 1 — Changes (Done)

- [x] Main loop is now a pure task spawner (`main.rs`)
- [x] `run_price_cycle` added to protocol.rs (price-only consensus)
- [x] `run_cycle` removed from main loop (kept for integration tests)
- [x] `consensus_succeeded` gating removed — all 6 tasks spawn unconditionally
- [x] `last_signature` removed
- [x] `price_active` flag added
- [x] `run_price_update` standalone function
- [x] Soften emergency pause — price disagreement = Failed, not EmergencyPause
- [x] `cargo build --release` — compiles clean
- [ ] Restart + E2E test suite

---

## Phase 2A — Fix Audit Findings (Before Wiring Oracle)

Security audit found 30 findings (3 CRITICAL, 9 HIGH). These 6 must be fixed before Phase 2B. Full audit: `docs/plans/2026-02-28-normalize-audit.md`.

### Step 1. FlagGuard — panic-safe task spawning [C2]

**File:** `oracle/src/main.rs`

Add a drop guard so task panics always reset the flag:

```rust
struct FlagGuard(Arc<AtomicBool>);
impl Drop for FlagGuard {
    fn drop(&mut self) { self.0.store(false, Ordering::Release); }
}
```

Apply to all 6 spawn sites (price, buy, sell, create, L3-native, rebalance):

```rust
tokio::spawn(async move {
    let _guard = FlagGuard(flag);
    run_price_update(...).await;
    // flag reset on normal return AND panic
});
```

Also upgrade all flag operations: `Acquire` for loads, `Release` for stores (fixes M1).

**Checklist:**
- [ ] Add `FlagGuard` struct to `main.rs`
- [ ] Wrap all 6 spawn sites with `FlagGuard`
- [ ] Change all `Ordering::Relaxed` to `Acquire`/`Release` on the 6 flags
- [ ] Change work_tx flag loads to `Acquire` (line 984-989)

---

### Step 2. Dedicated price consensus state [C1, H3]

**Files:** `oracle/src/consensus/protocol.rs`, `oracle/src/main.rs`

`run_price_cycle` and bridge tasks share `self.state` and `self.aggregator`. Concurrent execution corrupts round state, equivocation detection, and WAL.

**Fix:** Add dedicated fields to `ConsensusProtocol`:

```rust
// In ConsensusProtocol struct:
price_state: RwLock<ConsensusState>,        // NEW — only used by run_price_cycle
price_aggregator: RwLock<SignatureAggregator>, // NEW — only used by run_price_cycle
```

- `run_price_cycle` uses `self.price_state` / `self.price_aggregator` instead of `self.state` / `self.aggregator`
- Bridge tasks continue using `self.state` / `self.aggregator` (most already use BridgeOrchestrator's `SignatureCollector`, but L3-native's `run_cycle` still uses the shared ones — that's fine, they won't overlap with price anymore)
- Equivocation detector: add `round_type` to `DetectorKey` so price-round and bridge-round messages are keyed separately
- WAL GC: `run_price_cycle` only GCs price-keyed entries, bridge tasks only GC bridge-keyed entries

**Checklist:**
- [ ] Add `price_state`, `price_aggregator` to `ConsensusProtocol`
- [ ] `run_price_cycle` → use `self.price_state` / `self.price_aggregator`
- [ ] Add `round_type: &'static str` to `DetectorKey` in `equivocation.rs`
- [ ] WAL entries keyed by `(round_type, cycle_number)`
- [ ] `run_price_cycle` GC only deletes `"price"` entries
- [ ] Message handler routes price messages to `price_state`, bridge messages to `state`

---

### Step 3. Separate follower protocol for price-only [H1, H2]

**File:** `oracle/src/consensus/protocol.rs`

Currently both `run_price_cycle` and `run_cycle` delegate to the same `run_follower_protocol`. A malicious leader can send a `BatchProposal` to price-only followers.

**Fix:**

Add `run_follower_protocol_price_only`:
- Only waits for `PriceProposal` → `PriceVoting` → `Complete`
- Rejects `BatchProposal` messages
- Timeout = `price_proposal_timeout + price_vote_timeout` (no batch phases)

Add `ConsensusResult::PriceAgreed { cycle_number, aggregated_signature, signer_count, signers_bitmask }`:
- Distinct from `Success` — carries the real BLS signature data
- Forces callers to handle price-only case explicitly
- Phase 2B uses `aggregated_signature` + `signers_bitmask` for oracle submission

**Checklist:**
- [ ] Add `run_follower_protocol_price_only` method
- [ ] Add `ConsensusResult::PriceAgreed` variant
- [ ] `run_price_cycle` leader path returns `PriceAgreed` with real signature data (not dummy)
- [ ] `run_price_cycle` follower path calls `run_follower_protocol_price_only`
- [ ] `run_price_update` in `main.rs` handles `PriceAgreed` (log + metrics for now, oracle submission in Phase 2B)

---

### Step 4. Route `send_transaction` through NonceManager [H6]

**File:** `oracle/src/chain/writer.rs`

`send_transaction()` bypasses `NonceManager`. Two concurrent tasks calling it get the same nonce.

**Fix:**

```rust
async fn send_transaction(&self, to: Address, calldata: Vec<u8>, value: U256) -> Result<TxHash, Error> {
    let mut tx: TypedTransaction = Eip1559TransactionRequest::new()
        .to(to)
        .data(Bytes::from(calldata))
        .value(value)
        .into();
    self.submit_tx(tx, "send_transaction").await
}
```

Delete the old implementation (lines 572-624) that directly calls `self.client.send_transaction()`.

**Checklist:**
- [ ] Replace `send_transaction` body with delegation to `submit_tx`
- [ ] Remove manual gas estimation / receipt waiting (submit_tx handles this)
- [ ] Verify all callers (BridgeOrchestrator, ArbitrumChainWriter) still work

---

### Step 5. Watchdog safety + consecutive failure counter [H5, M4]

**File:** `oracle/src/main.rs`

Watchdog resets orders being actively processed. Price disagreement has no circuit breaker.

**Fix watchdog (lines 941-981):**
- Add `last_touched: Instant` to `BridgeOrderStatus` in orchestrator
- Watchdog only resets orders with `last_touched` > 60s ago
- Check `buy_active || sell_active` — if either running, skip reset entirely

**Fix price circuit breaker:**
- Add `consecutive_price_failures: u32` counter in main loop
- On `PriceAgreed` → reset to 0
- On `Failed` → increment
- If `consecutive_price_failures >= 10` → log CRITICAL alert, set `consensus_metrics.price_stalled = true`

**Checklist:**
- [ ] Add `last_touched: Instant` to `BridgeOrderStatus`
- [ ] Update orchestrator to set `last_touched` on every status transition
- [ ] Watchdog checks `last_touched` > 60s AND `!buy_active && !sell_active`
- [ ] Add `consecutive_price_failures` counter
- [ ] Reset on success, increment on failure, alert at 10

---

### Step 6. Compile + E2E test Phase 2A

- [ ] `cargo build --release` — compiles clean
- [ ] `./stop.sh && ./start.sh --vision` — system starts
- [ ] `cd frontend && npx playwright test --config=e2e/playwright.config.ts` — all 88 tests pass

---

## Phase 2B — Upgrade MirrorOracleRegistry to Full IOracleRegistry

**Core decision:** No code duplication. ITPNAVOracle uses the **exact same** `BLSVerifier._verifyBLS()` code path as BridgeProxy, ArbBridgeCustody, and Investment. That means MirrorOracleRegistry must implement `IOracleRegistry` — storing individual pubkeys, snapshots, and supporting `verifyBLSMultiPairing`. 2/3 threshold, not all-oracles.

### Step 7. Upgrade MirrorOracleRegistry to implement IOracleRegistry

**File:** `contracts/src/registry/MirrorOracleRegistry.sol`

Current MirrorOracleRegistry stores only the aggregated pubkey. For multi-pairing, it needs individual pubkeys per oracle, snapshots, and `verifyBLSMultiPairing`.

**New storage:**

```solidity
contract MirrorOracleRegistry is IMirrorOracleRegistry, IOracleRegistry, Initializable, UUPSUpgradeable {
    // Individual oracle pubkeys (oracle_id => G2 pubkey 128 bytes)
    mapping(uint256 => bytes) private _oraclePubkeys;

    // Active oracle bitmask (bit i = oracle i is active)
    uint256 public activeBitmask;

    // Snapshots for BLSVerifier historical lookups
    mapping(uint256 => TypesLib.RegistrySnapshot) private _snapshots;
    uint256 public lastSnapshotNonce;

    // Missed counts (advisory liveness tracking)
    mapping(uint256 => uint256) private _missedCounts;

    // Authorized callers for incrementMissedCounts
    mapping(address => bool) public authorizedMissedCountCallers;
}
```

**New `sync()` signature** — accepts individual pubkeys:

```solidity
function sync(
    bytes[] calldata oraclePubkeys,    // individual G2 pubkeys in ID order
    uint256 newActiveBitmask,
    uint256 newActiveCount,
    uint256 newThreshold,
    uint256 nonce,
    bytes calldata blsSignature,
    uint256 referenceNonce,            // snapshot nonce for BLS verification
    uint256 signersBitmask
) external
```

**Verification in sync():**
- First sync (no individual keys stored yet): use `BLSLib.verifyBLS(aggregatedPubkey, ...)` against the bootstrap aggregated key (TOFU)
- Subsequent syncs: use multi-pairing via own `verifyBLSMultiPairing(signersBitmask, messageHash, blsSignature)` with 2/3 threshold — same as everything else

**Implement IOracleRegistry methods:**

| Method | Implementation |
|--------|---------------|
| `lastSnapshotNonce()` | Return `lastSnapshotNonce` storage |
| `getSnapshotAtNonce(nonce)` | Return `_snapshots[nonce]` |
| `verifyBLSMultiPairing(bitmask, hash, sig)` | Decode bitmask → fetch pubkeys → call `BLSLib.verifyBLSMulti(pubkeys, hash, sig)` |
| `incrementMissedCounts(bitmask)` | Iterate bits, increment `_missedCounts[i]` |
| `getActiveBitmask()` | Return `activeBitmask` |
| `activeOracleCount()` | Return `activeCount` |
| `getAggregatedPubkey()` | Compute from individual keys or return cached |
| `registryNonce()` | Return `registryNonce` |
| `getOraclePubkeys(ids)` | Return `_oraclePubkeys[id]` for each |
| `decodeBitmap(bitmask)` | Same as L3 OracleRegistry |

Methods NOT needed (N/A for mirror): `addOracle`, `removeOracle`, `requestKeyRotation`, `approveRotation`, `executeRotation`, `getOracles`, `isActiveOracle`, `getActiveOracleEndpoints`, `updateOracleIp`, `consensusPaused`, `setConsensusPaused`.

**Checklist:**
- [ ] Add new storage fields to MirrorOracleRegistry
- [ ] Implement `IOracleRegistry` view methods
- [ ] Implement `verifyBLSMultiPairing` using `BLSLib.verifyBLSMulti`
- [ ] Update `sync()` to accept individual pubkeys + use multi-pairing (with TOFU fallback for first sync)
- [ ] Create snapshot on each `sync()`: `_snapshots[nonce] = RegistrySnapshot(activeBitmask, activeCount, block.number)`
- [ ] Add `setAuthorizedMissedCountCaller(address, bool)` admin function
- [ ] Update `IMirrorOracleRegistry` interface to include new methods
- [ ] Storage gap adjustment for upgrade safety

---

### Step 8. Rewrite ITPNAVOracle to inherit BLSVerifier

**File:** `contracts/src/oracle/ITPNAVOracle.sol`

Delete all custom BLS code. Inherit `BLSVerifier`. Same verification path as every other contract.

```solidity
contract ITPNAVOracle is IITPNAVOracle, IOracle, BLSVerifier {
    uint256 public constant PRICE_DECIMALS = 36;
    uint256 public constant MAX_STALENESS = 24 hours;
    uint256 public constant MAX_DEVIATION_BPS = 1000; // 10%
    uint256 public constant MAX_CYCLE_GAP = 10000;

    address public immutable itpAddress;

    uint256 public currentPrice;
    uint256 public lastUpdated;
    uint256 public lastCycleNumber;

    constructor(address _oracleRegistry, address _itpAddress, uint256 _initialPrice) {
        __BLSVerifier_init(_oracleRegistry);   // <-- points to MirrorOracleRegistry
        itpAddress = _itpAddress;
        currentPrice = _initialPrice;
        lastUpdated = block.timestamp;
    }

    function updatePrice(
        uint256 newPrice,
        uint256 timestamp,
        uint256 cycleNumber,
        bytes calldata blsSignature,
        uint256 referenceNonce,         // NEW — for snapshot lookup
        uint256 signersBitmask
    ) external {
        if (newPrice == 0) revert ErrorsLib.E095_InvalidOraclePrice();
        if (cycleNumber <= lastCycleNumber) return;
        if (cycleNumber > lastCycleNumber + MAX_CYCLE_GAP) revert ErrorsLib.E098_CycleGapTooLarge();

        // Price deviation check (skip on first update when currentPrice == initialPrice)
        if (lastCycleNumber > 0) {
            uint256 deviation = newPrice > currentPrice
                ? ((newPrice - currentPrice) * 10000) / currentPrice
                : ((currentPrice - newPrice) * 10000) / currentPrice;
            if (deviation > MAX_DEVIATION_BPS) revert ErrorsLib.E099_PriceDeviationTooHigh();
        }

        // Hash includes chainId + address(this) for cross-chain replay protection
        bytes32 messageHash = keccak256(
            abi.encode(block.chainid, address(this), itpAddress, newPrice, timestamp, cycleNumber)
        );

        // Same verification as BridgeProxy, ArbBridgeCustody, Investment
        // Multi-pairing, 2/3 threshold, snapshot-based
        _verifyBLS(messageHash, blsSignature, referenceNonce, signersBitmask);

        currentPrice = newPrice;
        lastUpdated = block.timestamp;
        lastCycleNumber = cycleNumber;

        emit EventsLib.NAVPriceUpdated(itpAddress, newPrice, block.timestamp, cycleNumber, signersBitmask);
    }

    function price() external view override(IITPNAVOracle, IOracle) returns (uint256) {
        if (block.timestamp - lastUpdated > MAX_STALENESS) {
            revert ErrorsLib.E096_StaleOraclePrice(lastUpdated, MAX_STALENESS);
        }
        return currentPrice;
    }
}
```

**Key changes:**
- Inherits `BLSVerifier` — `_verifyBLS()` does threshold check, snapshot lookup, multi-pairing
- Hash uses `abi.encode(chainId, address(this), ...)` — NOT `abi.encodePacked`
- Adds `referenceNonce` parameter (for snapshot-based verification)
- Adds `MAX_DEVIATION_BPS` (10% circuit breaker)
- Adds `MAX_CYCLE_GAP` (prevents unbounded cycle skip)
- No more `IMirrorOracleRegistry` import — BLSVerifier reads from `IOracleRegistry` internally

**Checklist:**
- [ ] Rewrite ITPNAVOracle inheriting BLSVerifier
- [ ] Add `referenceNonce` to `updatePrice` signature + `IITPNAVOracle` interface
- [ ] Add `MAX_DEVIATION_BPS` and `MAX_CYCLE_GAP` checks
- [ ] Switch hash to `abi.encode(chainId, address(this), ...)` — matches new Rust hash
- [ ] Add E098, E099 error codes to ErrorsLib
- [ ] Update IITPNAVOracle interface

---

### Step 9. Fix Rust-side hash + P2P messages

**Files:** `oracle/src/bridge/types.rs`, `oracle/src/consensus/messages.rs`, `oracle/src/consensus/protocol.rs`

The Rust hash must match the new Solidity hash exactly: `keccak256(abi.encode(chainId, address(this), itpAddress, price, timestamp, cycleNumber))`.

**Fix `build_nav_message_hash` in `types.rs`:**

```rust
pub fn build_nav_oracle_hash(
    chain_id: u64,
    oracle_address: Address,
    itp_address: Address,
    price: U256,
    timestamp: u64,
    cycle_number: u64,
) -> H256 {
    // abi.encode: each field padded to 32 bytes
    let mut data = Vec::with_capacity(192);
    data.extend_from_slice(&ethers::abi::encode(&[
        Token::Uint(U256::from(chain_id)),
        Token::Address(oracle_address),
        Token::Address(itp_address),
        Token::Uint(price),
        Token::Uint(U256::from(timestamp)),
        Token::Uint(U256::from(cycle_number)),
    ]));
    H256::from(keccak256(&data))
}
```

Delete `build_set_itp_nav_hash` and `build_nav_message_hash` (the old `encodePacked` version in `nav_sign.rs`). Single hash function, single code path.

**Add calldata builder:**

```rust
pub fn build_update_price_calldata(
    new_price: U256,
    timestamp: u64,
    cycle_number: u64,
    bls_signature: &[u8],
    reference_nonce: u64,
    signers_bitmask: U256,
) -> Vec<u8> {
    let selector = &keccak256(b"updatePrice(uint256,uint256,uint256,bytes,uint256,uint256)")[..4];
    let encoded = ethers::abi::encode(&[
        Token::Uint(new_price),
        Token::Uint(U256::from(timestamp)),
        Token::Uint(U256::from(cycle_number)),
        Token::Bytes(bls_signature.to_vec()),
        Token::Uint(U256::from(reference_nonce)),
        Token::Uint(signers_bitmask),
    ]);
    [selector, &encoded].concat()
}
```

**Update P2P messages in `messages.rs`:**

Add `timestamp`, `cycle_number`, `oracle_address` to `SetItpNavProposal` and `SetItpNavSign`:

```rust
P2PMessage::SetItpNavProposal {
    leader_id,
    itp_address: Address,      // was itp_id: H256
    oracle_address: Address,    // NEW
    nav: U256,
    timestamp: u64,            // NEW
    cycle_number: u64,         // NEW
    reference_nonce: u64,
    leader_signature: Vec<u8>,
}
```

**Checklist:**
- [ ] Add `build_nav_oracle_hash` to `types.rs` using `abi.encode`
- [ ] Delete `build_set_itp_nav_hash` and old `build_nav_message_hash`
- [ ] Add `build_update_price_calldata` to `types.rs`
- [ ] Update `SetItpNavProposal` / `SetItpNavSign` P2P messages
- [ ] Update `run_itp_nav_sign_consensus` in `protocol.rs` to use new hash + messages
- [ ] Add cross-language hash parity test (Rust hash == Solidity hash for same inputs)

---

### Step 10. Wire price task to oracle submission

**Files:** `oracle/src/main.rs`, `oracle/src/consensus/protocol.rs`

After `run_price_cycle` returns `PriceAgreed`, the leader submits to `ITPNAVOracle.updatePrice()`.

**In `run_price_update`:**

```rust
async fn run_price_update(
    protocol, price_fetcher, chain_reader, chain_writer, // <-- chain_writer is NEW
    oracle_address: Address,                              // <-- NEW config
    itp_address: Address,                                 // <-- NEW config
    chain_id: u64,                                        // <-- NEW config
    known_assets, cycle, metrics, rpc_ts,
) {
    // 1. Fetch prices
    let prices = price_fetcher.fetch_prices(&known_assets).await?;

    // 2. Compute NAV from inventory
    let nav = compute_nav(&chain_reader, &prices).await;
    let morpho_price = scale_to_36_decimals(nav);

    // 3. Run price consensus
    let timestamp = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
    let result = protocol.run_price_cycle(cycle, prices, morpho_price, timestamp, oracle_address, itp_address, chain_id).await;

    // 4. If leader and agreed, submit to oracle
    match result {
        ConsensusResult::PriceAgreed { aggregated_signature, signer_count, signers_bitmask, cycle_number } => {
            let reference_nonce = protocol.key_registry.registry_nonce().await;
            let calldata = build_update_price_calldata(
                morpho_price, timestamp, cycle_number,
                &aggregated_signature.0, reference_nonce, signers_bitmask,
            );
            match chain_writer.send_transaction(oracle_address, calldata, U256::zero()).await {
                Ok(tx) => info!(cycle, tx = %tx, "Oracle price updated"),
                Err(e) => warn!(cycle, error = %e, "Oracle price update failed"),
            }
        }
        ConsensusResult::Failed { reason, .. } => {
            warn!(cycle, reason, "Price consensus failed");
        }
        _ => {}
    }
}
```

**Update main loop spawn** to pass `chain_writer`, `oracle_address`, `itp_address`, `chain_id`:

```rust
// Price update — spawn if not already running
if !price_active.load(Ordering::Acquire) {
    price_active.store(true, Ordering::Relaxed);
    let _guard = FlagGuard(price_active.clone());
    let cw = consensus_chain_writer_for_task.clone();  // NEW
    tokio::spawn(async move {
        run_price_update(p, pf, cr, cw, oracle_addr, itp_addr, chain_id, addrs, cycle, metrics, rpc_ts).await;
    });
}
```

**Checklist:**
- [ ] Add `oracle_address`, `itp_address`, `chain_id` to oracle config / CLI args
- [ ] Pass `chain_writer` to `run_price_update`
- [ ] `run_price_cycle` leader path collects real BLS signature + bitmask (not dummy)
- [ ] After `PriceAgreed`, build calldata and submit via `chain_writer.send_transaction`
- [ ] Follower nodes skip oracle submission (only leader submits)

---

### Step 11. Deploy script + deployment JSON

**Files:** `contracts/script/DeployMorphoE2E.s.sol`, `deployments/morpho-e2e.json`

Replace `MockMorphoOracle` with real `MirrorOracleRegistry` + `ITPNAVOracle`.

**Deploy flow:**

```
1. Deploy MirrorOracleRegistry (UUPS proxy)
2. Initialize with:
   - Individual oracle pubkeys from L3 OracleRegistry
   - activeBitmask from L3
   - threshold = ceil(2*activeCount/3)
   - admin = deployer
3. Create initial snapshot at nonce 0
4. Authorize ITPNAVOracle for incrementMissedCounts
5. Deploy ITPNAVOracle(mirrorRegistryAddress, itpAddress, initialPrice=1e36)
6. Create Morpho market with ITPNAVOracle as oracle
7. Update morpho-e2e.json with:
   - MIRROR_REGISTRY: proxy address
   - ITP_NAV_ORACLE: oracle address
   - Remove MOCK_ORACLE
```

**Checklist:**
- [ ] Update `DeployMorphoE2E.s.sol` to deploy MirrorOracleRegistry + ITPNAVOracle
- [ ] Read oracle pubkeys from L3 OracleRegistry in deploy script
- [ ] Register oracle as authorized missed count caller
- [ ] Update `morpho-e2e.json` with new addresses
- [ ] Update `frontend/lib/contracts/morpho-deployment.json`

---

### Step 12. Oracle-side MirrorOracleRegistry sync

**File:** `oracle/src/consensus/protocol.rs` (or new `oracle/src/registry_sync/`)

Oracles must sync MirrorOracleRegistry when the L3 OracleRegistry state changes.

**Trigger:** On L3 `registryNonce` change (detected by existing `RegistrySyncHandler`)

**Flow:**
1. Detect L3 nonce > MirrorOracleRegistry nonce
2. Read individual pubkeys + activeBitmask + activeCount from L3 OracleRegistry
3. Leader proposes sync via P2P consensus
4. Followers verify L3 state matches proposal
5. Leader aggregates BLS signatures
6. Leader calls `MirrorOracleRegistry.sync(pubkeys, bitmask, count, threshold, nonce, sig, refNonce, bitmask)` on the chain where Morpho lives

**Checklist:**
- [ ] Add sync detection to RegistrySyncHandler (compare L3 nonce vs mirror nonce)
- [ ] Add `build_mirror_registry_sync_hash` to `types.rs`
- [ ] Add `build_mirror_registry_sync_calldata` to `types.rs`
- [ ] Add P2P messages for mirror sync consensus
- [ ] Leader submits sync tx after BLS aggregation
- [ ] Test: L3 oracle add → mirror auto-syncs → oracle accepts new signer set

---

### Step 13. Compile + E2E test Phase 2B

- [ ] `forge build` — Solidity compiles clean
- [ ] `cargo build --release` — Rust compiles clean
- [ ] Cross-language hash parity test passes
- [ ] `./stop.sh && ./start.sh --vision` — system starts with real oracle
- [ ] Verify oracle logs show `Oracle price updated` every cycle
- [ ] `cd frontend && npx playwright test --config=e2e/playwright.config.ts` — all tests pass
- [ ] Morpho E2E test (`10-morpho-oracle-health.spec.ts`) passes with real oracle
- [ ] Commit and `git push mono main`

---

## Files to Modify (Complete)

| File | Phase | Change |
|------|-------|--------|
| `oracle/src/main.rs` | 2A | FlagGuard, Acquire/Release ordering, consecutive failure counter, watchdog safety |
| `oracle/src/consensus/protocol.rs` | 2A+2B | Dedicated price state, price-only follower, PriceAgreed variant, real BLS sig |
| `oracle/src/consensus/messages.rs` | 2A+2B | P2P message routing by round_type, add timestamp/cycleNumber/oracle to NAV messages |
| `oracle/src/consensus/equivocation.rs` | 2A | Add `round_type` to DetectorKey |
| `oracle/src/p2p/wal.rs` | 2A | Key entries by `(round_type, cycle_number)` |
| `oracle/src/chain/writer.rs` | 2A | Route `send_transaction` through `submit_tx` / NonceManager |
| `oracle/src/bridge/orchestrator.rs` | 2A | Add `last_touched: Instant` to order status |
| `oracle/src/bridge/types.rs` | 2B | New `build_nav_oracle_hash`, `build_update_price_calldata`, delete old hash fns |
| `oracle/src/api/nav_sign.rs` | 2B | Update to use `build_nav_oracle_hash` |
| `contracts/src/registry/MirrorOracleRegistry.sol` | 2B | Implement IOracleRegistry, individual pubkeys, snapshots, verifyBLSMultiPairing |
| `contracts/src/interfaces/IMirrorOracleRegistry.sol` | 2B | Add IOracleRegistry methods |
| `contracts/src/oracle/ITPNAVOracle.sol` | 2B | Inherit BLSVerifier, add referenceNonce, deviation bounds, cycle gap, abi.encode hash |
| `contracts/src/interfaces/IITPNAVOracle.sol` | 2B | Update updatePrice signature |
| `contracts/src/libraries/ErrorsLib.sol` | 2B | Add E098, E099 |
| `contracts/script/DeployMorphoE2E.s.sol` | 2B | Deploy MirrorOracleRegistry + ITPNAVOracle |
| `deployments/morpho-e2e.json` | 2B | New addresses |
| `frontend/lib/contracts/morpho-deployment.json` | 2B | New addresses |

## Verification

1. Unit: `build_nav_oracle_hash` Rust output == `keccak256(abi.encode(...))` Solidity output
2. E2E: Price task pushes BLS-signed price → `oracle.price()` returns fresh value
3. E2E: Morpho market uses real oracle for borrow/liquidation calculations
4. E2E: 1 oracle offline → oracle still updates (2/3 threshold)
5. E2E: L3 oracle add → MirrorOracleRegistry auto-syncs → oracle accepts new set
