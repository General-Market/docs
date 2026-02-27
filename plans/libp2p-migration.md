# Issuer Network Hardening Plan (Unified)

**Origin**: 22-point comparison vs EigenLayer's consensus framework. Items: Reference Block Pattern (#1), Historical State Tracking (#2), Non-Signer Tracking (#3), Proof of Possession (#6), Global Key Uniqueness (#7), Key Separation (#8), plus P2P transport hardening.

**Scope**: Contracts + Issuer Rust node + P2P transport + Operational infrastructure

**Design invariant**: Issuers are stateless. Every piece of in-memory state MUST be reconstructable from on-chain data via a small number of RPC calls. No local disk persistence required for correctness (WAL is optional optimization).

---

## Review History

- v1-v4: Consensus safety hardening iterated through 4 rounds of critic reviews (16 total critics).
- v5: Statelessness audit — chain-based bootstrap, encoding mismatch, protocol invariants.
- P2P plan: 5 independent reviews rejected libp2p, designed 7-phase targeted hardening.
- **This document**: Unified plan merging both. Single source of truth.

---

## Part A: Background

### Why Not libp2p

Five independent reviews unanimously rejected replacing the custom TCP P2P layer with `rust-libp2p`:

1. **GossipSub is wrong for 20 nodes** — designed for thousands of anonymous peers. Adds 10-30ms mesh relay latency to a system with 150ms phase timeouts. Full mesh direct TCP is optimal for 20 known nodes.
2. **PeerId impedance mismatch** — libp2p uses keypair-derived PeerIds, our system uses `[u8; 32]` from `node_id`. Bridging via BiMap introduces race conditions (messages arrive before identify completes -> votes silently lost).
3. **GossipSub dedup kills consensus retries** — price proposal retry mechanism broadcasts the same message again. GossipSub silently drops it as a duplicate. Consensus stalls.
4. **Rolling upgrade impossible** — TCP and libp2p are incompatible wire protocols. Can't upgrade 1 node at a time. Requires big-bang cutover of all 20 nodes.
5. **Security downgrade** — mutual TLS with CA verification -> Noise protocol (any keypair can connect). Permissioned network loses its permissioning at the transport layer.
6. **155 lines vs 5-6 weeks** — every feature we need can be added directly to the existing code.

The existing P2P layer is 1,818 lines across 5 files. The features we need are bolt-on additions, not architectural replacements.

### Revisit Trigger

Consider libp2p **only if**:
- Network grows beyond 50 issuers (full mesh becomes impractical)
- Issuers become untrusted/anonymous (need peer scoring at protocol level)
- Nodes move behind NATs (need hole punching)
- A production incident demonstrates that direct TCP is insufficient

### Current P2P Architecture (unchanged)

```
                    P2PTransport trait (4 methods)
                    +-----------------------------+
Consensus --------+ | connect_peers()             |
Protocol           | broadcast()                  |
(unchanged)        | send_to()                    |
                   | receive() -> MessageStream   |
                   +----------+------------------+
                              |
                   +----------v------------------+
                   | TcpP2PTransport (HARDEN)     |
                   | +-- transport.rs             |
                   | +-- connection.rs            |
                   | +-- discovery.rs             |
                   | +-- codec.rs                 |
                   | +-- tls.rs                   |
                   | +-- rate_limit.rs     (NEW)  |
                   | +-- peer_scoring.rs   (NEW)  |
                   | +-- wal.rs            (NEW)  |
                   | +-- metrics.rs        (NEW)  |
                   +------------------------------+
```

---

## Part B: Statelessness Contract

Every piece of issuer node state MUST satisfy: **a freshly-started node can reconstruct it from current on-chain state via a small number of RPC calls (not event replay).**

| State | Source | RPC calls | Survives crash? |
|-------|--------|-----------|-----------------|
| Key registry (all issuers' BLS pubkeys) | `getActiveIssuerEndpoints()` | 1 | Rebuilt at boot |
| `issuer_registry_index` (own on-chain ID) | `getActiveIssuerEndpoints()` -> match own BLS pubkey | 1 | Rebuilt at boot |
| `node_index` (dense index for LeaderElector) | Sort active IDs, find own position | 0 (derived) | Rebuilt at boot |
| `num_issuers` / `threshold` | `activeIssuerCount()` + `compute_threshold()` | 1 | Rebuilt at boot |
| `reference_nonce` (latest) | `lastSnapshotNonce()` (Phase C2) or `registryNonce()` (Phase -1) | 1 | Per-cycle ephemeral |
| `VersionedKeyRegistry` (latest snapshot) | `getSnapshotAtNonce(lastSnapshotNonce)` (Phase C2) | 2 | Latest rebuilt at boot |
| `VersionedKeyRegistry` (historical) | Not needed on restart — in-flight work abandoned | 0 | Acceptable loss |
| `aggregatedPubkey` | `getAggregatedPubkey()` or from snapshot | 1 | Rebuilt at boot |
| `activeBitmask` | Derived from `getActiveIssuerEndpoints()` or from snapshot | 1 | Rebuilt at boot |
| `consensusPaused` | `IssuerRegistry.consensusPaused()` | 1 | On-chain |
| `SignatureAggregator` (in-flight sigs) | N/A — per-cycle ephemeral, reset each round | 0 | Acceptable loss |
| `LeaderElector` | Pure function of `(node_index, num_issuers)` | 0 | Rebuilt at boot |
| `issuerMissedCount` | On-chain mapping | 0 | On-chain |
| Peer scores | N/A — reset on restart | 0 | Acceptable loss (permissioned network) |
| WAL entries | Local file (optional optimization) | 0 | Best-effort replay |
| Equivocation detector | N/A — per-session | 0 | Acceptable loss |

---

## Part C: Operational Prerequisites (Phase -1)

MUST be deployed before any hardening phase. These are infrastructure gaps that both the P2P and consensus hardening depend on.

### -1a. Consensus Pause Mechanism

**Problem**: Deployment ceremonies require pausing consensus on all nodes. No pause mechanism exists.

**Implementation**: On-chain pause flag in IssuerRegistry.
```solidity
bool public consensusPaused;

function setConsensusPaused(bool paused) external onlyAdmin {
    consensusPaused = paused;
    emit ConsensusPausedChanged(paused);
}
```
- `__gap` impact: 1 slot (IssuerRegistry `__gap` 34 -> 33 before other changes)
- Issuer node: At cycle start in `run_consensus_cycle()`, check `IssuerRegistry.consensusPaused()` via RPC.
  - If true: skip cycle, log, sleep 5s, retry.
  - **If RPC fails: treat as paused (fail-safe).** Log warning, sleep 5s, retry.
- Alternative checked: file-based flag — rejected (requires SSH to 20 nodes).

### -1b. Mandatory `--registry-sync`

**Problem**: Consensus hardening depends on `RegistrySyncHandler`. Flag not passed in any known config.

**Implementation**:
- At startup, if `num_issuers > 1` and `--registry-sync` is not set, refuse to start
- Update production startup scripts + `start-issuers.sh`
- Increase `initial_scan_blocks` from 10,000 to 86,400 (24-hour downtime tolerance at 1s blocks)

### -1c. Bootstrap from On-Chain State

**Problem**: `num_issuers`, `threshold`, `node_index`, `issuer_registry_index` come from CLI flags. After issuer additions/removals, CLI values are stale. `node_index = (node_id - 1)` panics after any issuer removal.

**Step 1: Extend ChainReader trait**:
```rust
// common/src/traits/chain_reader.rs — add with default impls:
async fn get_active_issuer_count(&self) -> Result<u64, Error>;
async fn get_registry_nonce(&self) -> Result<u64, Error>;
async fn get_aggregated_pubkey(&self) -> Result<Vec<u8>, Error>;
```

**Step 2: Query active count + compute threshold**:
```rust
let on_chain_active = chain_reader.get_active_issuer_count().await
    .unwrap_or_else(|_| { warn!("Falling back to CLI"); self.params.num_issuers as u64 });
let threshold = compute_threshold(on_chain_active as usize);  // BFT 67%
```

**Step 3: Derive indices from chain** (replaces build_keys lines 68-69):
```rust
async fn derive_indices_from_chain(&self) -> Result<(u8, u8), BootstrapError> {
    let issuers = self.chain_reader.get_issuer_registry().await?;
    let my_bls_pubkey = /* load from bls_key_path */;
    let my_issuer = issuers.iter()
        .find(|i| i.bls_pubkey == my_bls_pubkey && i.status == 1)
        .ok_or(BootstrapError::IssuerNotFound)?;
    let issuer_registry_index = my_issuer.id as u8;
    let node_index = issuers.iter()
        .filter(|i| i.status == 1 && i.id < my_issuer.id)
        .count() as u8;
    Ok((issuer_registry_index, node_index))
}
```

**Step 4**: Deprecate `--signature-threshold` CLI flag. Log warning if passed, ignore it.

### -1d. Bootstrap Key Registry from Chain

**Problem (CRITICAL)**: `build_key_registry()` returns `None` when `!test_key_seeds`. `build_consensus_protocol()` short-circuits to `None`. Production nodes without `--test-key-seeds` never construct a ConsensusProtocol.

**Implementation**: Replace `build_key_registry()`:
```rust
async fn build_key_registry(&self) -> Option<Arc<InMemoryKeyRegistry>> {
    // 1. Chain-based bootstrap (production path)
    if let Ok(issuers) = self.chain_reader.get_issuer_registry().await {
        let active: Vec<_> = issuers.iter().filter(|i| i.status == 1).collect();
        if !active.is_empty() {
            let mut registry = InMemoryKeyRegistry::new();
            for issuer in &active {
                let peer_id = generate_peer_id(issuer.id as u32);
                if let Ok(pubkey) = BLSPublicKey::from_bytes(&issuer.bls_pubkey) {
                    registry.register(peer_id, pubkey);
                }
            }
            return Some(Arc::new(registry));
        }
    }
    // 2. Fallback: test seeds (local dev / E2E)
    if self.params.test_key_seeds { /* existing code */ }
    None
}
```

**VersionedKeyRegistry bootstrap** (Phase C2 only):
```rust
let current_nonce = chain_reader.get_registry_nonce().await.unwrap_or(0);
versioned_key_registry.snapshot(current_nonce, current_block);
```
Pruning: `prune_before(current_nonce.saturating_sub(256))` after each insert.

### -1e. Health Endpoint Enhancement

Add `/ready` endpoint (separate from `/health`):
```rust
GET /ready -> 200 if ALL:
  - connected_peers >= compute_threshold(num_issuers) - 1
  - BLS keypair loaded
  - Chain reader operational (last RPC success < 30s ago)
  - Registry sync caught up (if enabled)
  - NOT consensus-paused
```

### -1f. Production Deployment Script

`scripts/deploy-ceremony.sh`:
```bash
# 1. Pause consensus (on-chain)
# 2. Wait for all nodes to report paused
# 3. Upload new binary to all nodes via bastion
# 4. Upgrade contracts (forge script)
# 5. Restart all nodes
# 6. Wait for all /ready endpoints
# 7. Unpause consensus
# 8. Verify first round via logs
# Rollback: re-pause, deploy old contracts, restart old binaries, unpause
```

Non-upgradeable redeployment address checklist (Phase C2 ceremony):
1. Record current addresses of Vision, CollateralRegistry, AssetPairRegistry, ITPNAVOracle
2. After redeployment, grep entire codebase + configs + frontend for old addresses
3. Verify zero remaining references before unpausing

---

## Part D: Bug Fixes (Phase 0)

### 0a. Unified threshold formula

**Delete** `calculate_threshold()` from `aggregator.rs` (55%, `ceil(n*11/20)`). Replace ALL usages with `compute_threshold()` (BFT 67%: `floor(2n/3) + 1`).

Locations:
- `aggregator.rs`: remove `calculate_threshold`, remove `SIGNATURE_THRESHOLD = 11`
- `ConsensusConfig::new()`: remove default threshold from `SIGNATURE_THRESHOLD`
- `ConsensusBuilder::build_protocol()`: use `compute_threshold(on_chain_active)` from Phase -1c
- `SignatureAggregator::new()`: accept threshold as param, no default

### 0b. Fix `apply_pending_config_update` crash

Extend `pending_config_update` cell from `(u8, usize)` to:
```rust
pub struct ConfigUpdate {
    pub active_count: u8,
    pub threshold: usize,
    pub node_index: u8,          // dense index (0-based among active issuers)
    pub issuer_registry_index: u8, // on-chain issuer ID (for bitmaps)
}
```
- `RegistrySyncHandler`: computes `node_index` = count of active issuers with on-chain ID < `self.issuer_id`
- `apply_pending_config_update()`: uses `update.node_index` for `LeaderElector::new()`
- If this node IS the removed issuer: log ERROR, self-halt gracefully
- **Crash recovery**: bootstrap (Phase -1c) re-derives correct values from chain

### 0c. Fix `peer_id[0]` inconsistencies (bitmaps AND key registry)

Three different conventions exist:
1. `generate_peer_id(id)` -> `peer_id[0] = id + 1` (bootstrap/types.rs)
2. `RegistrySyncHandler.process_event()` -> `peer_id[0] = idx` (no +1) (registry_sync/mod.rs)
3. `generate_test_registry_with_offset()` -> `peer_id[0] = offset + i + 1` (keys.rs)

**Bitmap fix**: All bitmap computations use `config.issuer_registry_index`, NOT `peer_id[0]`.

**Key registry fix**: `RegistrySyncHandler.process_event()` MUST use `generate_peer_id(idx as u32)` instead of raw `peer_id[0] = idx as u8`.

### 0d. Fix `abi.encode` vs `abi.encodePacked` mismatch in registry sync

MirrorIssuerRegistry.sol (line 130) uses `abi.encode`. Rust uses `abi.encodePacked` (237 bytes). These produce different hashes — BLS verification fails.

**Fix**: Change Solidity to `abi.encodePacked` (matches current Rust). Phase C4 later changes BOTH to `abi.encode` with chain binding.

```solidity
bytes32 messageHash = keccak256(
    abi.encodePacked("REGISTRY_SYNC", nonce, newAggPubkey, newActiveCount, newThreshold)
);
```
Update test files: MirrorIssuerRegistry.t.sol, MorphoPermissionlessLiquidation.t.sol, ITPNAVOracle.t.sol.

---

## Part E: P2P Transport Hardening

### P1. Rate Limiting

**File:** `issuer/src/p2p/rate_limit.rs` (new, ~60 lines)

Token bucket per peer connection:
```rust
pub struct RateBucket {
    tokens: f64,
    max_tokens: f64,
    refill_rate: f64,
    last_refill: Instant,
}
```

Integration: In `connection.rs` `reader_loop`, check rate bucket **before** feeding bytes to the codec (pre-decode):
```rust
if !rate_bucket.try_consume() {
    warn!(code = "INFRA-020", ?peer_id, "Rate limit exceeded, dropping frame");
    continue;
}
```

| Parameter | Default | Flag | Rationale |
|---|---|---|---|
| `max_tokens` (burst) | 100 | `--p2p-rate-burst` | Accommodates fast cycles with bridge operations |
| `refill_rate` (per sec) | 100 | `--p2p-rate-limit` | 100 msgs/sec handles worst-case: 20 cycles/sec x 4 msgs/cycle |

### P2. Connection Limits

In `transport.rs` `start_listener()`, atomic check-and-accept under single write lock:

```rust
const MAX_INBOUND_CONNECTIONS: usize = 30; // 20 issuers + headroom
const DEFAULT_MAX_PER_IP: usize = 2;       // 1 inbound + 1 outbound

// Loopback IPs (127.0.0.0/8, ::1) are ALWAYS exempt
{
    let conns = connections.write().await;
    if conns.len() >= MAX_INBOUND_CONNECTIONS { drop(stream); continue; }
    if !is_loopback(&addr.ip()) && max_per_ip > 0 {
        let ip_count = conns.values().filter(|c| c.addr().ip() == addr.ip()).count();
        if ip_count >= max_per_ip { drop(stream); continue; }
    }
}
```

### P3. Peer Scoring & Auto-Banning

**File:** `issuer/src/p2p/peer_scoring.rs` (new, ~150 lines)

Uses `DashMap` for lock-free concurrent access from 20 reader_loops:

```rust
pub struct PeerScore {
    pub score: AtomicI64,
    pub invalid_messages: AtomicU32,
    pub rate_limit_hits: AtomicU32,
    pub decode_failures: AtomicU32,
    pub last_seen: Mutex<Instant>,
    pub banned_until: Mutex<Option<Instant>>,
    pub ban_count: AtomicU32,
}

pub struct PeerScorer {
    scores: DashMap<PeerId, PeerScore>,
    startup_time: Instant,
}
```

| Event | Score Change | Rationale |
|---|---|---|
| Good message | +0.1 | Slow recovery |
| Heartbeat received | +0.5 | Liveness signal |
| Invalid message | -10.0 | Verifiably bad |
| Decode failure (first 60s) | -1.0 | Rolling upgrade grace period |
| Decode failure (after 60s) | -5.0 | Normal penalty |
| Rate limit hit | -2.0 | Mild — could be transient |
| No heartbeat (per 5s tick) | -5.0 | Liveness failure |
| **Ban threshold** | -50.0 | Sustained misbehavior, not one hiccup |
| **Ban duration** | 60s x 2^(ban_count-1) | Exponential for repeat offenders |

**Partition detection**: If >33% peers unhealthy, suspend score-based bans. Equivocation bans always fire.

**Disconnect mechanism**: `disconnect_peer()` in `TcpP2PTransport`. `reconnect_loop` gated by `is_banned()`.

### P4. Leader Identity Verification

**Merged with consensus-safety Phase 0d.** The check lives in `ConsensusProtocol::handle_message()` (has access to `leader_elector`, `config`, `PeerScorer`).

```rust
fn verify_leader(&self, from: &PeerId, cycle_number: u64) -> bool {
    if is_temp_peer_id(from) || is_zeroed_peer_id(from) { return true; }
    let leader_index = (cycle_number % self.config.num_issuers as u64) as usize;
    let registry = self.peer_registry.read().await;
    if leader_index >= registry.len() { return true; } // Permissive during startup
    if is_zeroed_peer_id(&registry[leader_index]) { return true; }
    if registry[leader_index] != *from {
        self.peer_scorer.record_invalid_message(from);
        return false;
    }
    true
}
```

**Dual-view tolerance** (from consensus-safety Phase 0d): During config propagation window (~5s), accept proposals from the leader according to EITHER old or new `num_issuers`:
```rust
fn is_valid_leader(&self, sender_id: &PeerId, cycle: u64) -> bool {
    let current_count = self.leader_elector.read().num_issuers;
    let sender_index = self.get_dense_index(sender_id);
    if sender_index == (cycle % current_count as u64) as u8 { return true; }
    if current_count > 1 {
        let prev_count = current_count - 1;
        if sender_index == (cycle % prev_count as u64) as u8 { return true; }
    }
    let next_count = current_count + 1;
    if sender_index == (cycle % next_count as u64) as u8 { return true; }
    false
}
```

Applied to all `*Proposal` variants: `PriceProposal`, `BatchProposal`, `ItpCreationProposal`, `BridgeArbToL3Proposal`, `BridgeL3ToArbProposal`, `RebalanceBatchProposal`, `UpdateWeightsProposal`, `AssetTradesProposal`, `SubmitOrderProposal`, `ConfirmBatchProposal`, `ConfirmFillsProposal`.

### P5. Equivocation Detection

**File:** `issuer/src/p2p/equivocation.rs` (new)

Hash **semantic content** of messages (NOT BLS signature — prevents false positives on leader retries):

```rust
pub struct EquivocationDetector {
    seen: DashMap<(PeerId, u64, ConsensusPhase), [u8; 32]>,
}

impl EquivocationDetector {
    pub fn check(&self, peer: &PeerId, cycle: u64, phase: ConsensusPhase, content_hash: [u8; 32]) -> bool {
        match self.seen.entry((*peer, cycle, phase)) {
            Vacant(e) => { e.insert(content_hash); false }
            Occupied(e) => *e.get() != content_hash // true = equivocation
        }
    }
    pub fn gc(&self, current_cycle: u64) {
        self.seen.retain(|&(_, cycle, _), _| cycle >= current_cycle.saturating_sub(2));
    }
}
```

Applied to votes/signs ONLY (not proposals — proposals have legitimate retries). Equivocation = double penalty via `record_invalid_message()`.

**Limitations**: Memory-only (resets on restart). Only detects equivocation visible to this node. Future enhancement: gossip evidence sharing.

### P6. Write-Ahead Log (WAL)

**File:** `issuer/src/p2p/wal.rs` (new, ~200 lines)

**CLI flag:** `--wal-path <PATH>` (default: `./consensus-{node_id}.wal`)

Entry format with CRC:
```
[4 bytes: length] [N bytes: MessagePack WALEntry] [4 bytes: CRC32]
```

```rust
pub struct WALEntry {
    pub cycle_number: u64,
    pub phase: ConsensusPhase,
    pub from: PeerId,
    pub message: P2PMessage,
    pub role: WalRole,
    pub timestamp_ms: u64,
}

pub struct ConsensusWAL {
    file: std::fs::File,  // std::fs, not tokio::fs
    sync_mode: WalSyncMode,  // Fdatasync | Fsync | None
}
```

- **Sync mode auto-detection**: If `--cycle-duration-ms < 500` -> `None`. Otherwise `Fdatasync`.
- **Hard cap**: 10 MB max. Log error + disable writes if exceeded.
- **Atomic GC**: Write current-cycle entries to `.tmp`, fsync, `rename()`.
- **Recovery**: Replay WAL at startup in replay mode (suppresses outbound broadcasts, uses original sender).
- `--skip-wal-replay` escape hatch for corrupt WAL.

**Note**: WAL is an **optimization**, not a correctness requirement. The statelessness contract guarantees recovery from on-chain state alone. WAL only saves one cycle of in-flight work.

### P7. Observability

**File:** `issuer/src/p2p/metrics.rs` (new, ~80 lines)

```rust
pub struct P2PMetrics {
    pub messages_received: AtomicU64,
    pub messages_sent: AtomicU64,
    pub rate_limited_total: AtomicU64,
    pub decode_failures_total: AtomicU64,
    pub peers_banned_total: AtomicU64,
    pub equivocations_detected: AtomicU64,
    pub wal_entries_written: AtomicU64,
    pub wal_replays: AtomicU64,
    pub leader_rejections: AtomicU64,
    pub connection_rejections: AtomicU64,
}
```

Exposed via `/health` JSON endpoint. Error codes: INFRA-020 through INFRA-023, CONSENSUS-020, CONSENSUS-021.

---

## Part F: Consensus & Contract Hardening

### Protocol Invariants

**P-INV-1. Leader proposes `reference_nonce`**: Leader selects from latest snapshot, includes in proposal. Followers validate (exists locally, within 256 of their latest), co-sign with it. Ensures all signers hash the same message.

**P-INV-2. Leader constructs `signersBitmask`**: From `aggregator.get_signatures().keys()`, mapping PeerId -> `issuer_registry_index` bit. Griefing vector: malicious leader can exclude a legitimate signer. Detectable via on-chain event vs local log.

**P-INV-3. `issuerMissedCount` is advisory only**: Public, permissionless. NEVER for automated slashing. Governance dashboards only.

### C1. Foundation — Proof of Possession (#6) + Key Uniqueness (#7)

**Contract-only phase. No issuer node changes. No deployment ceremony needed (proxy upgrade).**

**Proof of Possession**: PoP with `abi.encode("INDEX_BLS_POP", block.chainid, address(this), issuerAddr, blsPubkey)`.

**Key Uniqueness**: `_pubkeyHashToIssuerId` stores `issuerId + 1` (sentinel collision fix for issuer ID 0).

### C2. State + Accountability — Historical Tracking (#2), Reference Block (#1), Non-Signer Tracking (#3)

**SINGLE deployment ceremony. All ~55 BLS-consuming functions gain `(referenceNonce, signersBitmask)` at once.**

#### Contract changes

**IssuerRegistry.sol**:
- `uint256 public lastSnapshotNonce` — `__gap` 1 slot
- `mapping(uint256 => RegistrySnapshot) _nonceSnapshots` — `__gap` 1 slot
- `mapping(uint256 => uint256) public issuerMissedCount` — `__gap` 1 slot
- `getSnapshotAtNonce(uint256 nonce)` view
- `getActiveBitmask()` view (for node bootstrap)
- `incrementMissedCounts(uint256 nonSignersBitmask)` — public, advisory only
- `setAggregatedPubkey(bytes calldata pubkey, uint256 nonce)` writes snapshot with `_computeActiveBitmask()`
- Snapshots written in `setAggregatedPubkey()`, NOT `_emitStateChange()`

```solidity
struct RegistrySnapshot {
    uint256 activeCount;
    bytes32 stateHash;
    bytes32[4] aggregatedPubkey;
    uint256 blockNumber;
    uint256 activeBitmask;
}
```

**BLSVerifier.sol** (9 contracts inherit — **NO `__gap` addition, layout FROZEN at 1 slot**):
```solidity
function _verifyBLS(
    bytes32 messageHash,
    bytes calldata blsSignature,
    uint256 referenceNonce,
    uint256 signersBitmask
) internal view {
    uint256 latest = _blsIssuerRegistry.lastSnapshotNonce();
    uint256 minNonce = latest > 256 ? latest - 256 : 0;
    if (referenceNonce < minNonce) revert BLSVerifier__NonceTooOld();
    if (referenceNonce > latest) revert BLSVerifier__NonceFuture();

    TypesLib.RegistrySnapshot memory snap = _blsIssuerRegistry.getSnapshotAtNonce(referenceNonce);
    if (block.number - snap.blockNumber > 86400) revert BLSVerifier__SnapshotTooOld();

    uint256 nonSignersBitmask = snap.activeBitmask ^ signersBitmask;
    if (signersBitmask & nonSignersBitmask != 0) revert BLSVerifier__BitmaskOverlap();
    if (signersBitmask | nonSignersBitmask != snap.activeBitmask) revert BLSVerifier__BitmaskIncomplete();
    if (_popcount(signersBitmask) < snap.activeCount * 2 / 3 + 1) revert BLSVerifier__BelowThreshold();

    bytes memory pubkey = _fixedToPubkey(snap.aggregatedPubkey);
    BLSLib.verifyBLS(pubkey, messageHash, blsSignature);
    _blsIssuerRegistry.incrementMissedCounts(nonSignersBitmask);
}
```

**IMPORTANT: BLSVerifier does NOT gain a `__gap`.** Adding 49 slots would corrupt storage of all 6 upgradeable inheritors.

**All ~55 affected functions across 9 contracts:**

| Contract | Upgradeable? | Functions | Count |
|----------|-------------|-----------|-------|
| `Investment.sol` | Yes (proxy) | `confirmBatch`, `confirmFills`, `emitAssetTrades`, `refundExpiredOrder`, `rebalance`, `setItpNAV`, `updateVenueBalance`, `cancelStalePendingOrders`, `refundTimedOutBatchedOrder` | 9 |
| `BLSCustody.sol` | Yes (proxy) | `proposeWhitelist`, `executeWhitelist`, `removeWhitelist`, `execute`, `proposeUpgrade` | 5 |
| `ArbBridgeCustody.sol` | Yes (proxy) | Enumerate | ~9 |
| `L3BridgeCustody.sol` | Yes (proxy) | Enumerate | ~7 |
| `FeeRegistry.sol` | Yes (proxy) | Enumerate | ~4 |
| `BridgeProxy.sol` | Yes (proxy) | Enumerate | ~4 |
| `Vision.sol` | **No (redeploy)** | Enumerate | ~7 |
| `CollateralRegistry.sol` | **No (redeploy)** | Enumerate | ~2 |
| `AssetPairRegistry.sol` | **No (redeploy)** | Enumerate | ~8 |
| **Total** | | | **~55** |

**`removeIssuerByVote()`**: NOT in BLSVerifier path. Add `referenceNonce` + `signersBitmask` directly.

**ITPNAVOracle.sol**: Immutable — REDEPLOY. New deployment calls `mirrorRegistry.getAggregatedPubkeyAtNonce(referenceNonce)`.

**MirrorIssuerRegistry.sol**: `lastSnapshotNonce`, `_pubkeyAtNonce` mapping, `getAggregatedPubkeyAtNonce()` view. `__gap` 45 -> 43.

#### Issuer node changes

- `protocol.rs`: Leader includes `reference_nonce` in proposal (P-INV-1). Compute `signersBitmask` from aggregator (P-INV-2).
- `chain/writer.rs`: All `build_*_tx` gain `reference_nonce: u64` + `signers_bitmask: U256`.
- `keys.rs`: `VersionedKeyRegistry` with `BTreeMap<u64, KeySnapshot>`, pruning at 256-nonce window.
- `aggregator.rs`: `non_signers_bitmask()` using `issuer_registry_index` (NOT `peer_id[0]`).

#### Gas impact

~17K-20K additional gas per `_verifyBLS` (7 SLOADs + `incrementMissedCounts`). Acceptable on L3 (WIND gas token).

### C3. Key Separation (#8)

**Contract-only + coordinated Rust update.**

3-factor rotation request (ECDSA + old-key BLS + new-key PoP). 2-factor approval (ECDSA + BLS) with `abi.encode` + chain binding.

MirrorIssuerRegistry `sync()` gains chain binding:
```solidity
bytes32 messageHash = keccak256(abi.encode(
    "REGISTRY_SYNC", block.chainid, address(this),
    nonce, newAggPubkey, newActiveCount, newThreshold
));
```

Rust `build_registry_sync_message_hash()` updated to match. Handler must know MirrorIssuerRegistry chain ID + address (add to `RegistrySyncConfig`).

---

## Part G: Deployment Order & Ceremonies

```
Phase -1 (Operational Infrastructure):
  -1a. On-chain consensus pause (RPC failure = paused)
  -1b. Mandatory --registry-sync (initial_scan_blocks: 86,400)
  -1c. Bootstrap from chain (ChainReader trait, derive indices + threshold)
  -1d. Bootstrap key registry from chain (replaces --test-key-seeds dependency)
  -1e. /ready health endpoint
  -1f. Production deployment script

Phase 0 (Bug Fixes):
  0a. Unify threshold (delete calculate_threshold, use BFT 67%)
  0b. Fix apply_pending_config_update (ConfigUpdate struct)
  0c. Fix peer_id[0] (bitmaps + key registry)
  0d. Fix abi.encode vs abi.encodePacked mismatch

Phase P (P2P Hardening — parallel track, no contract changes):
  P1. Rate limiting          (Day 1)
  P2. Connection limits      (Day 1)
  P3. Peer scoring           (Day 2-4)
  P4. Leader identity        (Day 4-5, merged with Phase 0 leader check)
  P5. Equivocation detection (Day 5-6)
  P6. Write-Ahead Log        (Day 1-4, parallel track)
  P7. Observability          (Day 5-6)

Phase C1 (Foundation — contract proxy upgrade, no ceremony):
  #6 Proof of Possession
  #7 Key Uniqueness

Phase C2 (State + Accountability — SINGLE deployment ceremony):
  #2 Historical Tracking
  #1 Reference Block
  #3 Non-Signer Tracking
  _verifyBLS gains (referenceNonce, signersBitmask) — ONE signature change

Phase C3 (Key Architecture — contract-only + Rust update):
  #8 Key Separation + MirrorIssuerRegistry chain binding
```

### Dependencies

```
Phase -1 ──> Phase 0 ──> Phase C1 ──> Phase C2 ──> Phase C3
                |
                +──> Phase P (independent, parallel)
```

Phase P has no contract dependencies. Can be deployed independently via binary update + rolling restart (no pause needed). Phase 0d (leader verification) from the contract plan is merged into P4.

### Phase C2 Deployment Ceremony

**Pre-requisites**: Phase -1, 0, P, C1 all deployed and verified.

**Happy path**:
1. `IssuerRegistry.setConsensusPaused(true)`
2. Wait for all nodes to stop cycling
3. UUPS upgrade: IssuerRegistry, MirrorIssuerRegistry, Investment, BLSCustody, ArbBridgeCustody, L3BridgeCustody, FeeRegistry, BridgeProxy
4. Redeploy: ITPNAVOracle, Vision, CollateralRegistry, AssetPairRegistry
   - Re-register ITPNAVOracle in Morpho market
   - Run address checklist (grep old addresses, verify zero matches)
5. Upload new issuer binary to all 20 nodes
6. Restart all nodes
7. Wait for `/ready` 200
8. `setConsensusPaused(false)`
9. Monitor 10 rounds

**Rollback** (15-minute budget):
1. Re-pause -> deploy old implementations -> redeploy old immutable contracts -> restart old binaries -> unpause

### Crash Recovery (all phases)

After any crash or restart:
1. Load BLS keypair from file
2. Query on-chain registry -> build `InMemoryKeyRegistry`
3. Derive `issuer_registry_index` (BLS pubkey match) and `node_index` (dense index)
4. Query `activeIssuerCount()` -> compute threshold
5. Query `registryNonce()` -> create bootstrap snapshot
6. Construct `LeaderElector(node_index, num_issuers)`
7. Start consensus from NEXT cycle boundary — current in-flight work abandoned
8. (Optional) Replay WAL entries for current cycle
9. `RegistrySyncHandler` scans from `current_block - 86,400`

**New node joining**: Identical to crash recovery. BLS key must be registered on-chain first.

### P2P Hardening Rollout

No deployment ceremony needed. Rolling binary update:

1. Deploy to 1 issuer. Monitor 24h for:
   - INFRA-020 through INFRA-023 (unexpected triggers)
   - CONSENSUS-020/021 (false positives)
   - Cycle success rate (~100%)
   - WAL file growth (<1MB)
2. If clean, deploy to remaining issuers in batches of 3-5.

**Quick disable** (no rebuild):
- Rate limiting: `--p2p-rate-limit 999999`
- Connection limits: `--p2p-max-per-ip 0`
- WAL: `--skip-wal-replay` or delete WAL files
- Peer scoring: partition heuristic prevents mass banning; scores reset on restart

**Full revert**: `git revert` + `cargo build`. No wire protocol changes. No storage migrations.

---

## Part H: Timeline

```
Week 1-2:
  Phase -1 (operational infrastructure)    [contract + Rust]
  Phase 0  (bug fixes)                     [contract + Rust]
  Phase P1-P3 (rate limit, conn, scoring)  [Rust only, parallel]
  Phase P6 (WAL core + CRC + GC)           [Rust only, parallel]

Week 3:
  Phase P4 (leader check, merged)          [Rust only]
  Phase P5 (equivocation)                  [Rust only]
  Phase P7 (observability)                 [Rust only]
  Phase P integration + property tests     [Rust only]

Week 4:
  Phase C1 (PoP + key uniqueness)          [contract proxy upgrade]

Week 5-6:
  Phase C2 (reference block + historical + non-signer)  [contracts + Rust + ceremony]

Week 7+:
  Phase C3 (key separation)                [contract + Rust]
```

Phase P (P2P hardening) and Phase -1/0 (infra + bugs) run in parallel tracks.

---

## Part I: Known Limitations (accepted)

| Limitation | Rationale |
|---|---|
| ~5s liveness gap after registry changes | Dual-view tolerance mitigates |
| `pending_config_update` TOCTOU | Rapid events drop intermediate states (final state correct) |
| `BLSVerifier` storage layout frozen at 1 slot | Adding gap corrupts 6 proxies |
| `incrementMissedCounts()` public | Advisory only, never for slashing |
| Mid-round crash loses current cycle | Next cycle starts fresh (standard BFT) |
| Historical snapshots lost on restart | Latest rebuilt, sufficient for new rounds |
| Malicious leader can under-report signersBitmask | Detectable, bounded griefing |
| Peer scores reset on restart | Acceptable for 20-node permissioned network |
| Equivocation only detected locally | Future: gossip evidence sharing |
| WAL is best-effort | Not required for correctness (statelessness contract) |
| No gossip redundancy | Full mesh at 20 nodes; threshold absorbs dropped connections |
| No NAT traversal | All issuers on public IPs |
| No partition auto-recovery | Heuristic alerts; manual intervention for true splits |

---

## Part J: Files Modified (Unified)

### Contract files

| File | Phase | Notes |
|------|-------|-------|
| `contracts/src/registry/IssuerRegistry.sol` | -1a, C1, C2 | `__gap` 34 -> 29 (5 slots) |
| `contracts/src/interfaces/IIssuerRegistry.sol` | -1a, C1, C2 | All changed/new signatures |
| `contracts/src/registry/MirrorIssuerRegistry.sol` | 0d, C2, C3 | `__gap` 45 -> 43. encodePacked fix + chain binding |
| `contracts/src/interfaces/IMirrorIssuerRegistry.sol` | C2 | New views |
| `contracts/src/libraries/BLSVerifier.sol` | C2 | `_verifyBLS` gains params. **NO `__gap`** |
| `contracts/src/libraries/TypesLib.sol` | C2 | RegistrySnapshot struct |
| `contracts/src/libraries/EventsLib.sol` | -1a, C2 | New events |
| `contracts/src/core/Investment.sol` | C2 | 9 functions |
| `contracts/src/core/BLSCustody.sol` | C2 | 5 functions |
| `contracts/src/oracle/ITPNAVOracle.sol` | C2 | **REDEPLOY** |
| `contracts/src/custody/ArbBridgeCustody.sol` | C2 | ~9 functions |
| `contracts/src/custody/L3BridgeCustody.sol` | C2 | ~7 functions |
| `contracts/src/registry/AssetPairRegistry.sol` | C2 | **REDEPLOY** |
| `contracts/src/registry/CollateralRegistry.sol` | C2 | **REDEPLOY** |
| `contracts/src/vision/Vision.sol` | C2 | **REDEPLOY** |
| `contracts/src/bridge/BridgeProxy.sol` | C2 | ~4 functions |
| `contracts/src/registry/FeeRegistry.sol` | C2 | ~4 functions |
| `contracts/test/*.t.sol` | 0d, C2 | Hash construction updates |

### Issuer Rust files

| File | Phase | Notes |
|------|-------|-------|
| `issuer/src/p2p/rate_limit.rs` | P1 | **NEW** ~60 lines |
| `issuer/src/p2p/peer_scoring.rs` | P3 | **NEW** ~150 lines |
| `issuer/src/p2p/wal.rs` | P6 | **NEW** ~200 lines |
| `issuer/src/p2p/metrics.rs` | P7 | **NEW** ~80 lines |
| `issuer/src/p2p/connection.rs` | P1, P3 | Rate limit + ban check pre-decode |
| `issuer/src/p2p/transport.rs` | P2, P3 | Conn limits, scorer tick, disconnect |
| `issuer/src/p2p/mod.rs` | P | Exports |
| `issuer/src/consensus/protocol.rs` | 0, P4, P5, C2 | ConfigUpdate, leader check, equivocation, bitmask, reference nonce |
| `issuer/src/consensus/aggregator.rs` | 0a, C2 | Delete calculate_threshold, non_signers_bitmask |
| `issuer/src/consensus/keys.rs` | C2 | VersionedKeyRegistry with pruning |
| `issuer/src/consensus/state.rs` | P5 | Add `Hash` derive to ConsensusPhase |
| `issuer/src/consensus/messages.rs` | P4, P5 | content_hash, RejectedNonLeader |
| `issuer/src/leader/election.rs` | 0b | Dense node_index from ConfigUpdate |
| `issuer/src/chain/writer.rs` | C2 | All build_*_tx gain reference_nonce + signers_bitmask |
| `issuer/src/chain/events/registry_sync.rs` | 0, C2 | ConfigUpdate cell |
| `issuer/src/registry_sync/mod.rs` | 0, C3 | ConfigUpdate, peer_id fix, sync hash, scan window |
| `issuer/src/bootstrap/consensus.rs` | -1c, -1d | Chain-based key registry + indices + threshold |
| `issuer/src/bootstrap/p2p.rs` | P3, P6 | Thread PeerScorer, WAL config |
| `issuer/src/bootstrap/types.rs` | -1c | generate_peer_id consistency |
| `issuer/src/main.rs` | -1a, -1e, P6 | /ready endpoint, pause check, WAL open |
| `common/src/traits/chain_reader.rs` | -1c | 3 new trait methods |
| `issuer/Cargo.toml` | P6 | Add `crc32fast` |

### Scripts & config

| File | Phase | Notes |
|------|-------|-------|
| `scripts/deploy-ceremony.sh` | -1f | **NEW** |
| `scripts/start-issuers.sh` | -1b, P6 | --registry-sync, WAL path |
| `start.sh` | P6 | WAL path in issuer loop |

## UUPS Storage Gap Tracking

| Contract | Current `__gap` | Slots consumed | New `__gap` | New vars |
|----------|----------------|----------------|-------------|----------|
| IssuerRegistry | 34 | 5 | 29 | consensusPaused, lastSnapshotNonce, _nonceSnapshots, _pubkeyHashToIssuerId, issuerMissedCount |
| MirrorIssuerRegistry | 45 | 2 | 43 | lastSnapshotNonce, _pubkeyAtNonce |
| BLSVerifier | 0 | 0 | **0 (FROZEN)** | Layout locked forever |
| InvestmentStorage | 16 | 0 | 16 | No changes |

### New CLI flags (P2P hardening)

| Flag | Default | Purpose |
|------|---------|---------|
| `--wal-path <PATH>` | `./consensus-{node_id}.wal` | Per-issuer WAL file |
| `--wal-sync-mode <MODE>` | auto (none if cycle <500ms, else fdatasync) | WAL durability |
| `--skip-wal-replay` | false | Emergency bypass |
| `--p2p-rate-limit <N>` | 100 | Msgs/sec/peer |
| `--p2p-rate-burst <N>` | 100 | Max burst |
| `--p2p-max-per-ip <N>` | 2 (loopback exempt) | Max connections per IP |
