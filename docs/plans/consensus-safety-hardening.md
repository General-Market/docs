# Consensus Safety Hardening Plan (v8)

**Scope A — Contract & Protocol Safety**: Reference Block Pattern (#1), Historical State Tracking (#2), Non-Signer Tracking (#3), Proof of Possession (#6), Global Key Uniqueness (#7), Key Separation (#8)

**Scope B — P2P Layer Hardening**: Rate Limiting (P2P-1), Connection Limits (P2P-2), Peer Scoring (P2P-3), Leader Identity Verification (P2P-4), Equivocation Detection (P2P-5), Write-Ahead Log (P2P-6), Observability (P2P-7)

**Design invariant**: Issuers are stateless. Every piece of in-memory state MUST be reconstructable from on-chain data via a small number of RPC calls. No local disk persistence (except WAL for mid-cycle recovery), no event replay from genesis, no peer gossip required for recovery.

---

## Review History

- v1: Initial plan. 5 critics found 5 CRITICALs + 8 HIGHs.
- v2: Architecture accepted. 2 CRITICALs remaining (specific code bugs).
- v3: All contract-level issues resolved. 3 critics reviewed with start.sh context.
- v4: Operational infrastructure gaps fixed. `__gap[49]` removed (storage corruption). Pause mechanism added. Phase 2+3 merged. Bootstrap flow addressed.
- v5: Statelessness audit. Chain-based bootstrap for key registry + dense index. Encoding mismatch elevated. Protocol clarifications for reference_nonce and signersBitmask.
- v6: Merged P2P layer hardening plan. 3 rounds of multi-agent criticism (5+5+3 critics). libp2p rejected unanimously — DIY hardening adopted. Startup script integration verified. Rollback strategy added.
- v7: 3-critic review (contracts, consensus, ops). 12 findings, 10 survived self-criticism. Fixed: (1) BLS return value unchecked — silent signature bypass across all 55 functions. (2) `_verifyBLS` `view` → `internal` (calls state-mutating `incrementMissedCounts`). (3) Bitmask operator precedence + redundant overlap check simplified. (4) `Issuer` struct lacks `id` field — `get_issuer_registry()` strips on-chain IDs, causing peer_id mismatch after issuer removal (root cause for 3 downstream bugs in Phase 0b, 0c, P2P-4). (5) `/ready` deadlocks ceremony (checked `NOT consensus-paused` while paused). (6) Initial snapshot not seeded during ceremony. (7) Rollback storage corruption + unrealistic 15min budget → 30min. (8) Phase 0e→-1b ordering not enforced. (9) Curator missing from address checklist. (10) `content_hash` fallback includes BLS signatures → false equivocation after WAL replay.
- v8 (this): Codebase verification review. 12 assumptions checked against code, 10 confirmed correct. Fixed: (1) `compute_threshold()` didn't exist — added definition with `floor(2n/3)+1`, documented liveness impact (55%→67%, threshold 11→14 for n=20). (2) Redundant bitmask completeness check removed from `_verifyBLS` (algebraically guaranteed by XOR + subset check). (3) Snapshot timing gap now enforced on-chain (`addIssuer`/`removeIssuer` revert if `lastSnapshotNonce != registryNonce`). (4) `content_hash` `_ =>` fallback removed — match must be exhaustive to get compile errors on new P2PMessage variants. (5) Added Solidity standards checklist (`@custom:security-contact`, audit reminder for Phase 2+3).

### v5 → v6 additions (P2P layer hardening)

**Why not libp2p:** Five independent reviews unanimously rejected replacing the custom TCP P2P layer with `rust-libp2p`:
1. **GossipSub is wrong for 20 nodes** — designed for thousands of anonymous peers. Adds 10-30ms mesh relay latency to a system with 150ms phase timeouts. Full mesh direct TCP is optimal for 20 known nodes.
2. **PeerId impedance mismatch** — libp2p uses keypair-derived PeerIds, our system uses `[u8; 32]` from `node_id`. Bridging via BiMap introduces race conditions (messages arrive before identify completes, votes silently lost).
3. **GossipSub dedup kills consensus retries** — price proposal retry mechanism broadcasts the same message again. GossipSub silently drops it as a duplicate. Consensus stalls.
4. **Rolling upgrade impossible** — TCP and libp2p are incompatible wire protocols. Can't upgrade 1 node at a time. Requires big-bang cutover of all 20 nodes.
5. **Security downgrade** — mutual TLS with CA verification to Noise protocol (any keypair can connect). Permissioned network loses its permissioning at the transport layer.
6. **155 lines vs 5-6 weeks** — every feature we need can be added directly to the existing code.

The existing P2P layer is 1,818 lines across 5 files. It works. The features we need are bolt-on additions, not architectural replacements.

---

## Statelessness Contract

Every piece of issuer node state MUST satisfy: **a freshly-started node can reconstruct it from current on-chain state via a small number of RPC calls (not event replay).**

| State | Source | RPC calls | Survives crash? |
|-------|--------|-----------|-----------------|
| Key registry (all issuers' BLS pubkeys) | `getActiveIssuerEndpoints()` | 1 | Rebuilt at boot |
| `issuer_registry_index` (own on-chain ID) | `getActiveIssuerEndpoints()` -> match own BLS pubkey | 1 | Rebuilt at boot |
| `node_index` (dense index for LeaderElector) | Sort active IDs, find own position | 0 (derived from above) | Rebuilt at boot |
| `num_issuers` / `threshold` | `activeIssuerCount()` + `compute_threshold()` | 1 | Rebuilt at boot |
| `reference_nonce` (latest) | `lastSnapshotNonce()` (Phase 2+3) or `registryNonce()` (Phase -1) | 1 | Per-cycle, ephemeral |
| `VersionedKeyRegistry` (latest snapshot) | `getSnapshotAtNonce(lastSnapshotNonce)` (Phase 2+3) | 2 | Latest rebuilt at boot |
| `VersionedKeyRegistry` (historical) | Not needed on restart — in-flight work is abandoned | 0 | Acceptable loss |
| `aggregatedPubkey` | `getAggregatedPubkey()` or from snapshot | 1 | Rebuilt at boot |
| `activeBitmask` | Derived from `getActiveIssuerEndpoints()` (Phase -1) or from snapshot (Phase 2+3) | 1 | Rebuilt at boot |
| `consensusPaused` | `IssuerRegistry.consensusPaused()` | 1 | On-chain |
| `SignatureAggregator` (in-flight sigs) | N/A — per-cycle ephemeral, reset each round | 0 | Acceptable loss |
| `LeaderElector` | Pure function of `(node_index, num_issuers)` | 0 | Rebuilt at boot |
| `issuerMissedCount` | On-chain mapping | 0 | On-chain |
| Peer scores (P2P-3) | Reset on restart | 0 | Acceptable loss |
| WAL (P2P-6) | Local disk, per-issuer file | 0 | Survives crash |
| Equivocation detector (P2P-5) | N/A — per-session | 0 | Acceptable loss |

---

# PART A: CONTRACT & PROTOCOL SAFETY

---

## Phase -1: Operational Infrastructure (MUST DO BEFORE EVERYTHING)

These are prerequisites that the hardening plan depends on but do not currently exist.

### -1a. Consensus Pause Mechanism

**Problem**: The deployment ceremony requires pausing consensus on all nodes. No pause mechanism exists. `EmergencyPause` is an uncontrollable local error state.

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
  - **If RPC fails: treat as paused (fail-safe).** Log warning, sleep 5s, retry. This prevents a node from running consensus during a network partition where it cannot reach the chain.
- Alternative checked: file-based flag (`/tmp/issuer-pause`) — rejected because it requires SSH to 20 nodes. On-chain is one tx.

### -1b. Mandatory `--registry-sync`

**Problem**: Plan's items #1 and #2 depend on `RegistrySyncHandler`. Flag not passed in any known config.

**Implementation**:
- At startup, if `num_issuers > 1` and `--registry-sync` is not set, refuse to start with: `"ERROR: --registry-sync required for multi-issuer deployments"`
- Update production startup scripts
- Update `start-issuers.sh` (local dev) to include `--registry-sync`
- Increase `initial_scan_blocks` from 10,000 to 86,400 (24-hour downtime tolerance at 1s blocks). The `max_block_range` config batches these queries.

### -1c. Bootstrap from On-Chain State

**Problem**: `num_issuers`, `signature_threshold`, `node_index`, and `issuer_registry_index` all come from CLI flags. After issuer additions/removals, CLI values are stale. `node_index = (node_id - 1)` (bootstrap/consensus.rs:68) is wrong after any issuer removal. `LeaderElector::new()` panics if `node_index >= num_issuers`.

**Implementation** in `ConsensusBuilder::build_keys()` and `build_protocol()`:

**Step 1: Extend ChainReader trait** (prerequisite for everything below):
```rust
// In common/src/traits/chain_reader.rs — add these methods with default impls:
async fn get_active_issuer_count(&self) -> Result<u64, Error> {
    Err(Error::NotImplemented)
}
async fn get_registry_nonce(&self) -> Result<u64, Error> {
    Err(Error::NotImplemented)
}
async fn get_aggregated_pubkey(&self) -> Result<Vec<u8>, Error> {
    Err(Error::NotImplemented)
}
```
Concrete `EthersChainReader` calls: `activeIssuerCount()`, `registryNonce()`, `getAggregatedPubkey()`.

**Step 2: Query active count and compute threshold**:
```rust
// In build_protocol(), replace calculate_threshold:
let on_chain_active = chain_reader.get_active_issuer_count().await
    .unwrap_or_else(|_| {
        warn!("Failed to query on-chain activeCount, falling back to --num-issuers CLI arg");
        self.params.num_issuers as u64
    });
let threshold = compute_threshold(on_chain_active as usize);  // BFT 67%
```

**Step 3: Derive `issuer_registry_index` and `node_index` from chain** (replaces build_keys lines 68-69):
```rust
// In build_keys():
let (issuer_registry_index, node_index) = match self.derive_indices_from_chain().await {
    Ok(indices) => indices,
    Err(e) => {
        warn!("Failed to derive indices from chain: {e}. Falling back to CLI.");
        let idx = self.params.on_chain_issuer_id.unwrap_or((self.node_id - 1) as u8);
        (idx, idx) // Best-effort fallback for test/local
    }
};

async fn derive_indices_from_chain(&self) -> Result<(u8, u8), BootstrapError> {
    let issuers = self.chain_reader.get_issuer_registry().await?;
    let my_bls_pubkey = /* load from bls_key_path */;

    // Find our on-chain ID by matching BLS pubkey
    let my_issuer = issuers.iter()
        .find(|i| i.bls_pubkey == my_bls_pubkey && i.status == 1)
        .ok_or(BootstrapError::IssuerNotFound)?;
    let issuer_registry_index = my_issuer.id as u8;

    // Dense index = count of active issuers with ID < ours
    let node_index = issuers.iter()
        .filter(|i| i.status == 1 && i.id < my_issuer.id)
        .count() as u8;

    info!(issuer_registry_index, node_index, "Derived indices from on-chain registry");
    Ok((issuer_registry_index, node_index))
}
```

**Step 4: `--signature-threshold` CLI flag**: DEPRECATED. Log warning if passed, ignore it.

**Optional contract addition**: `getIssuerIdByAddress(address) -> (bool found, uint256 issuerId)` for simpler self-discovery. Not blocking — BLS pubkey matching via `getActiveIssuerEndpoints()` works.

### -1d. Bootstrap Key Registry from Chain

**Problem 1**: `VersionedKeyRegistry` has no snapshots until first `RegistryStateChanged` event. Consensus starts before that.

**Problem 2 (CRITICAL)**: `build_key_registry()` returns `None` when `!test_key_seeds` (bootstrap/consensus.rs:293). `build_consensus_protocol()` line 467 does `keys.key_registry.as_ref()?` -> returns `None`. **Production nodes without `--test-key-seeds` never construct a ConsensusProtocol.**

**Implementation**: Replace `build_key_registry()` entirely:

```rust
async fn build_key_registry(&self) -> Option<Arc<InMemoryKeyRegistry>> {
    // 1. Try chain-based bootstrap (production path)
    if let Ok(issuers) = self.chain_reader.get_issuer_registry().await {
        let active_issuers: Vec<_> = issuers.iter()
            .filter(|i| i.status == 1)
            .collect();

        if !active_issuers.is_empty() {
            let mut registry = InMemoryKeyRegistry::new();
            for issuer in &active_issuers {
                let peer_id = generate_peer_id(issuer.id as u32);
                if let Ok(pubkey) = BLSPublicKey::from_bytes(&issuer.bls_pubkey) {
                    registry.register(peer_id, pubkey);
                }
            }
            info!(
                self.node_id,
                peer_count = active_issuers.len(),
                "InMemoryKeyRegistry built from on-chain issuer registry"
            );
            return Some(Arc::new(registry));
        }
    }

    // 2. Fallback: deterministic test seeds (local dev / E2E)
    if self.params.test_key_seeds {
        let (registry, keypairs) = InMemoryKeyRegistry::generate_test_registry_with_offset(
            self.params.num_issuers as usize,
            self.params.key_registry_offset as usize,
        );
        info!(self.node_id, peer_count = keypairs.len(), "InMemoryKeyRegistry from test seeds");
        return Some(Arc::new(registry));
    }

    warn!(self.node_id, "No key registry available — consensus disabled");
    None
}
```

**IMPORTANT**: `generate_peer_id(issuer.id)` is used consistently here — same as the fixed `RegistrySyncHandler` (Phase 0c expanded).

**PREREQUISITE — `Issuer` struct change**: The current `Issuer` struct (`common/src/types/issuer.rs`) does NOT have an `id` field. It has `addr`, `ip`, `bls_pubkey`, `status`, `registered_at`. Add `pub id: u64` to the struct. Additionally, `get_issuer_registry()` (`issuer/src/chain/reader.rs`) currently calls `getIssuers()` and skips inactive issuers, returning a dense list without on-chain IDs. Change it to call `getActiveIssuerEndpoints()` instead, which returns `(ids[], ips[], pubkeys[])` — preserving on-chain IDs. Populate `issuer.id` from the `ids[]` array. This is a hard prerequisite for Phases -1c, -1d, 0b, 0c, and P2P-4 — all of which depend on `issuer.id` for correct peer_id generation and index derivation. Without this change, after any issuer removal, `generate_peer_id(dense_index)` produces different peer_ids than `generate_peer_id(on_chain_id)`, causing BLS verification failures and total consensus stall.

**Bootstrap snapshot for VersionedKeyRegistry** (Phase 2+3 only — not needed until historical tracking is deployed):
```rust
// After building key registry, create initial snapshot:
let current_nonce = chain_reader.get_registry_nonce().await
    .unwrap_or(0); // nonce 0 for local dev
let current_block = chain_reader.get_current_block().await
    .unwrap_or(0);
versioned_key_registry.snapshot(current_nonce, current_block);
```
- On restart, only the latest snapshot is rebuilt. Historical snapshots are not needed — in-flight work from pre-crash is abandoned, and the contract's 256-nonce window tolerates slightly stale nonces from other nodes.
- Pruning: `VersionedKeyRegistry::prune_before(current_nonce.saturating_sub(256))` called after each new snapshot. Prevents unbounded memory growth.

### -1e. Health Endpoint Enhancement

**Problem**: Current health returns "healthy" with just 1 connected peer. Not sufficient as deployment gate.

**Implementation**: Add `/ready` endpoint (separate from `/health`):
```rust
GET /ready -> 200 if ALL:
  - connected_peers >= compute_threshold(num_issuers) - 1
  - BLS keypair loaded
  - Chain reader operational (last RPC success < 30s ago)
  - Registry sync caught up (if enabled)
```
- `/ready` does NOT check `consensusPaused` — it means "can participate if unpaused", not "currently running consensus". The pause check belongs in the consensus loop (Phase -1a), not the readiness gate. Including it here would deadlock the deployment ceremony (step 7 waits for `/ready` 200, step 8 unpauses).
- Deployment ceremony uses `/ready`, not `/health`

### -1f. Production Deployment Script

**Problem**: No orchestration for 20 VPS nodes behind bastion.

**Implementation**: `scripts/deploy-ceremony.sh`:
```bash
#!/bin/bash
# 1. Pause consensus (on-chain)
# 2. Wait for all nodes to report paused (poll /health)
# 3. Upload new binary to all nodes via bastion
# 4. Upgrade contracts (forge script)
# 5. Restart all nodes
# 6. Wait for all /ready endpoints
# 7. Unpause consensus (on-chain)
# 8. Verify first round via logs
# Rollback: re-pause, deploy old contracts, restart old binaries, unpause
```

**Non-upgradeable redeployment address checklist** (Phase 2+3 ceremony):
Before the ceremony, the deployment script MUST:
1. Record current addresses of Vision, CollateralRegistry, AssetPairRegistry, ITPNAVOracle
2. After redeployment, grep the ENTIRE codebase + configs + frontend for old addresses
3. Verify zero remaining references before unpausing
4. Specific reference points to check:
   - `Investment.sol` storage references to CollateralRegistry, AssetPairRegistry
   - `BridgeOrchestrator` config: collateral_registry, bridge_proxy addresses
   - `deployments/*.json` — all deployment config files
   - `frontend/lib/contracts/*.json` — frontend contract addresses
   - Morpho market registration (ITPNAVOracle -> new address)
   - `curator` binary CLI flags: `--oracle-address`, `--oracle-addresses` (curator is the ONLY service writing to ITPNAVOracle — must be restarted with new address or Morpho prices go stale)
   - Any curator systemd service / startup script on prod-be

---

## Phase 0: Pre-existing Bug Fixes

### 0a. Unified threshold formula

**Delete** `calculate_threshold()` from `aggregator.rs`. Define new `compute_threshold()` (BFT 67%: `floor(2n/3) + 1`) in its place. Replace ALL usages.

**New function** (in `aggregator.rs` or `common/src/consensus/threshold.rs`):
```rust
pub fn compute_threshold(num_issuers: usize) -> usize {
    if num_issuers == 0 { return 1; }
    (num_issuers * 2 / 3) + 1  // floor(2n/3) + 1
}
```

**Liveness impact**: For n=20, threshold changes from 11 (55%) to 14 (67%). Requires 3 more signers per round. This is correct for BFT safety but reduces tolerance for offline nodes from 9 to 6.

Locations:
- `aggregator.rs` line 15: remove `SIGNATURE_THRESHOLD = 11`
- `aggregator.rs` line 30: remove `calculate_threshold`, add `compute_threshold` above
- `aggregator.rs` line 84: `SignatureAggregator::new()` default -> accept threshold as param, no default
- `ConsensusConfig::new()` (protocol.rs ~line 157): remove default threshold from `SIGNATURE_THRESHOLD`
- `ConsensusBuilder::build_protocol()`: use `compute_threshold(on_chain_active)` from Phase -1c

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
- `RegistrySyncHandler`: computes `node_index` = count of active issuers with on-chain ID < `self.issuer_id`. **Requires** `Issuer.id` field (Phase -1d prerequisite) — the handler iterates `get_issuer_registry()` which now returns on-chain IDs via `getActiveIssuerEndpoints()`.
- `RegistrySyncHandler`: computes `issuer_registry_index` = `self.issuer_id` (unchanged)
- `apply_pending_config_update()`: uses `update.node_index` for `LeaderElector::new()`, updates `self.config.issuer_registry_index` from `update.issuer_registry_index`
- If this node IS the removed issuer (`self.issuer_id` not in active set): log ERROR, self-halt gracefully (don't panic)
- **Crash recovery**: On restart, bootstrap (Phase -1c) re-derives correct `node_index` and `issuer_registry_index` from chain. The `pending_config_update` cell is ephemeral — loss on crash is harmless because bootstrap replaces it.

### 0c. Fix `peer_id[0]` inconsistencies (bitmaps AND key registry)

**Current bugs** — three different `peer_id[0]` conventions:
1. `generate_peer_id(id)` -> stores `(id + 1)` at `peer_id[0]` (bootstrap/types.rs:216)
2. `RegistrySyncHandler.process_event()` -> `peer_id[0] = idx as u8` (NO +1) (registry_sync/mod.rs:420)
3. `generate_test_registry_with_offset()` -> `peer_id[0] = (offset + i + 1)` (keys.rs:99)

**Bitmap fix**: All bitmap computations use `config.issuer_registry_index` (the on-chain ID), NOT `peer_id[0]`. The `peer_id[0]` value is irrelevant for bitmaps — it's only for P2P identity.

**Key registry fix**: `RegistrySyncHandler.process_event()` MUST use `generate_peer_id(issuer.id as u32)` (on-chain ID) instead of raw `peer_id[0] = idx as u8`. The `idx` from `enumerate()` on the active-only list is a dense index, NOT the on-chain ID — after any issuer removal these diverge. Using the dense index would produce different peer_ids than Phase -1d's bootstrap, causing BLS verification failures. This requires the `Issuer` struct change from Phase -1d (adding `id` field, switching to `getActiveIssuerEndpoints()`).

Locations to fix:
- `protocol.rs` ~line 2549: ITP creation bitmap -> use `issuer_registry_index` from config or key registry lookup
- `registry_sync/mod.rs` ~line 420: `peer_id[0] = idx as u8` -> `let peer_id = generate_peer_id(issuer.id as u32);` (on-chain ID, NOT enumeration index)
- Any other `peer_id[0] as u32` bitmap usage (grep for `peer_id\[0\]`)

### 0d. Leader identity verification (contract-level)

Add `is_valid_leader(sender_id, cycle)` check in `handle_price_proposal_as_follower`.

During config propagation window (~5s), accept proposals from the leader according to EITHER old or new `num_issuers`:
```rust
fn is_valid_leader(&self, sender_id: &PeerId, cycle: u64) -> bool {
    let current_count = self.leader_elector.read().num_issuers;
    let sender_index = self.get_dense_index(sender_id);
    // Accept if leader under current config
    if sender_index == (cycle % current_count as u64) as u8 { return true; }
    // Also accept under previous config (+-1 issuer) for propagation tolerance
    if current_count > 1 {
        let prev_count = current_count - 1;
        if sender_index == (cycle % prev_count as u64) as u8 { return true; }
    }
    let next_count = current_count + 1;
    if sender_index == (cycle % next_count as u64) as u8 { return true; }
    false
}
```

### 0e. Fix `abi.encode` vs `abi.encodePacked` mismatch in registry sync

**Current bug**: MirrorIssuerRegistry.sol (line 130) uses `abi.encode("REGISTRY_SYNC", nonce, ...)`. Rust `build_registry_sync_message_hash()` (registry_sync/mod.rs:642-697) uses `abi.encodePacked` semantics (raw 13-byte tag, no ABI padding, total 237 bytes). These produce different hashes — BLS signature verification will fail.

Currently not hit because `--registry-sync` is never enabled. But Phase -1b mandates it, so this MUST be fixed first.

**Fix options** (pick one):
1. **Change Solidity to `abi.encodePacked`** — matches current Rust, smaller calldata, but less standard.
2. **Change Rust to `abi.encode`** — more standard, but Rust must replicate Solidity's ABI encoding rules (dynamic bytes offset+length, string as bytes32-padded, etc.).

**Recommendation**: Option 1 — change Solidity to `abi.encodePacked`. Simpler, already tested in Rust, and MirrorIssuerRegistry is a proxy (upgradeable). The plan's Phase 4 will later change BOTH to `abi.encode` with chain binding (`block.chainid`, `address(this)`), at which point both sides update together.

**Implementation**:
```solidity
// MirrorIssuerRegistry.sol — change line 130:
bytes32 messageHash = keccak256(
    abi.encodePacked("REGISTRY_SYNC", nonce, newAggPubkey, newActiveCount, newThreshold)
);
```
Update the test files that construct the same hash (MirrorIssuerRegistry.t.sol, MorphoPermissionlessLiquidation.t.sol, ITPNAVOracle.t.sol).

---

## Protocol Invariants

These invariants govern how `reference_nonce` and `signersBitmask` flow through the consensus protocol. They are critical for signature aggregation correctness.

### P1. Leader proposes `reference_nonce`

The **leader** selects `reference_nonce` from its local `VersionedKeyRegistry` (the latest available nonce) and includes it in the `PriceProposal` / `BatchProposal` message.

**Followers** validate the proposed nonce:
1. Check nonce exists in their local `VersionedKeyRegistry` (or is the bootstrap nonce)
2. Check nonce is within acceptable staleness (within 256 of their own latest)
3. If valid, sign the message hash that includes the leader's `reference_nonce`
4. If invalid (too old, unknown), reject the proposal — log warning, do not sign

This ensures all signers in a round use the **same** `reference_nonce`, producing the same message hash for BLS aggregation.

**Crash recovery**: On restart, the node picks up the latest nonce from its bootstrap snapshot. As leader, it proposes this nonce. As follower, it validates incoming proposals against its single bootstrap snapshot. No historical snapshots needed.

### P2. Leader constructs `signersBitmask`

The **leader** constructs `signersBitmask` from `aggregator.get_signatures().keys()`, mapping each signer's `PeerId` to their `issuer_registry_index` bit position.

**Griefing vector (accepted)**: A malicious leader can exclude a legitimate signer from the bitmask (inflating their `issuerMissedCount`). This is bounded:
- The BLS aggregated signature must still verify, so the leader cannot ADD a non-signer to the bitmask
- A leader that inflates miss counts is detectable: followers log "I signed round X but my bit was not set in on-chain tx Y"
- `issuerMissedCount` is advisory only — NEVER used for automated slashing (see P3)

### P3. `issuerMissedCount` is advisory only

`incrementMissedCounts()` is public with no access control. Anyone can inflate counters.

**Contract-level annotation**:
```solidity
/// @notice Advisory liveness metric. DO NOT use for automated slashing or forced removal.
/// @dev Public and permissionless — counters can be inflated by anyone.
///      Governance must cross-reference with on-chain transaction history before acting.
function incrementMissedCounts(uint256 nonSignersBitmask) external { ... }
```

---

## Item 1: Reference Block Pattern

**Problem**: Nodes apply registry changes at different cycle boundaries.

### Contract changes

**IssuerRegistry.sol**:
- Add `uint256 public lastSnapshotNonce`
- Add `getSnapshotAtNonce(uint256 nonce) external view returns (TypesLib.RegistrySnapshot memory)`
- Add `getActiveBitmask() external view returns (uint256)` — for node bootstrap before Phase 2+3 snapshots exist
- **`__gap` impact**: 1 slot

**BLSVerifier.sol** (9 contracts inherit — NO `__gap` addition):
- Change `_verifyBLS(bytes32 messageHash, bytes calldata blsSignature)` to:
  ```solidity
  function _verifyBLS(
      bytes32 messageHash,
      bytes calldata blsSignature,
      uint256 referenceNonce,
      uint256 signersBitmask        // Combined with #3 in single ceremony
  ) internal {
      // NOTE: NOT `view` — incrementMissedCounts writes state. All ~55 callers are
      // already non-view (they write state), so this mutability change is safe.
      uint256 latest = _blsIssuerRegistry.lastSnapshotNonce();
      uint256 minNonce = latest > 256 ? latest - 256 : 0;
      if (referenceNonce < minNonce) revert BLSVerifier__NonceTooOld();
      if (referenceNonce > latest) revert BLSVerifier__NonceFuture();

      TypesLib.RegistrySnapshot memory snap = _blsIssuerRegistry.getSnapshotAtNonce(referenceNonce);
      if (block.number - snap.blockNumber > 86400) revert BLSVerifier__SnapshotTooOld();

      // Non-signer tracking (#3 — merged into same ceremony)
      // Check signersBitmask is a subset of activeBitmask (no stray bits)
      if ((signersBitmask & ~snap.activeBitmask) != 0) revert BLSVerifier__BitmaskInvalid();
      uint256 nonSignersBitmask = snap.activeBitmask ^ signersBitmask;
      // NOTE: completeness check (signers | nonSigners == active) is algebraically
      // guaranteed by XOR construction + subset check above. No separate check needed.
      if (_popcount(signersBitmask) < snap.activeCount * 2 / 3 + 1) revert BLSVerifier__BelowThreshold();

      bytes memory pubkey = _fixedToPubkey(snap.aggregatedPubkey);
      if (!BLSLib.verifyBLS(pubkey, messageHash, blsSignature))
          revert BLSVerifier__InvalidSignature();

      // Liveness accounting — advisory only (see P3)
      _blsIssuerRegistry.incrementMissedCounts(nonSignersBitmask);
  }
  ```
- **Storage**: BLSVerifier layout FROZEN at 1 slot (`_blsIssuerRegistry`). NO `__gap` added. All new state lives in IssuerRegistry. If BLSVerifier ever needs storage, each child contract's `__gap` must be reduced by the same amount — design a migration at that time.

**IMPORTANT: BLSVerifier does NOT gain a `__gap`.** Adding 49 slots would shift storage of all 6 upgradeable inheritors (Investment, BLSCustody, FeeRegistry, ArbBridgeCustody, L3BridgeCustody, BridgeProxy), corrupting every live proxy. FeeRegistry's `__gap[38]` cannot absorb a 49-slot parent expansion.

**All ~55 BLS-consuming functions across 9 inheriting contracts** gain `referenceNonce` + `signersBitmask` parameters in ONE ceremony (Phase 2+3 merged):

| Contract | Upgradeable? | Functions | Count |
|----------|-------------|-----------|-------|
| `Investment.sol` | Yes (proxy) | `confirmBatch`, `confirmFills`, `emitAssetTrades`, `refundExpiredOrder`, `rebalance`, `setItpNAV`, `updateVenueBalance`, `cancelStalePendingOrders`, `refundTimedOutBatchedOrder` | 9 |
| `BLSCustody.sol` | Yes (proxy) | `proposeWhitelist`, `executeWhitelist`, `removeWhitelist`, `execute`, `proposeUpgrade` | 5 |
| `ArbBridgeCustody.sol` | Yes (proxy) | Enumerate with `grep -n "_verifyBLS"` | ~9 |
| `L3BridgeCustody.sol` | Yes (proxy) | Enumerate | ~7 |
| `FeeRegistry.sol` | Yes (proxy) | Enumerate | ~4 |
| `BridgeProxy.sol` | Yes (proxy) | Enumerate | ~4 |
| `Vision.sol` | **No (redeploy)** | Enumerate | ~7 |
| `CollateralRegistry.sol` | **No (redeploy)** | Enumerate | ~2 |
| `AssetPairRegistry.sol` | **No (redeploy)** | Enumerate | ~8 |
| **Total** | | | **~55** |

**`removeIssuerByVote()`** in IssuerRegistry.sol (NOT in BLSVerifier path):
- Add `referenceNonce` + `signersBitmask` parameters directly
- Load pubkey from `_nonceSnapshots[referenceNonce]`

**ITPNAVOracle.sol** (immutable — REDEPLOY):
- New deployment calls `mirrorRegistry.getAggregatedPubkeyAtNonce(referenceNonce)`

**MirrorIssuerRegistry.sol**:
- Add `uint256 public lastSnapshotNonce`
- Add `mapping(uint256 => bytes) _pubkeyAtNonce`
- Add `getAggregatedPubkeyAtNonce(uint256 nonce)` view
- Chain binding added to `sync()` message hash (Phase 4 — not in this ceremony):
  ```solidity
  bytes32 messageHash = keccak256(abi.encode(
      "REGISTRY_SYNC", block.chainid, address(this),
      nonce, newAggPubkey, newActiveCount, newThreshold
  ));
  ```
- **`__gap` impact**: 2 slots (lastSnapshotNonce, _pubkeyAtNonce)

### Issuer node changes

- `registry_sync.rs`: Parse `block_number` from log metadata. Push `ConfigUpdate` struct to `pending_config_update`.
- `protocol.rs`: Leader includes `reference_nonce` (from latest snapshot) in proposal message (see Protocol Invariant P1). Followers validate and co-sign.
- `chain/writer.rs`: All `build_*_tx` gain `reference_nonce: u64` + `signers_bitmask: U256`.
- `keys.rs`: `VersionedKeyRegistry.get_state_at_nonce(nonce)`. Pruning: `prune_before(current_nonce.saturating_sub(256))`.

### Gas impact

The new `_verifyBLS` loads a `RegistrySnapshot` from storage (7 SLOADs) + calls `incrementMissedCounts` (external call + SSTOREs). Estimated ~17K-20K additional gas per verification on cold access. On the L3 (WIND gas token), this is acceptable. If gas becomes a concern, consider:
- EIP-1153 transient storage for snapshot caching within a transaction
- Batching `incrementMissedCounts` calls

---

## Item 2: Historical State Tracking

### Snapshot timing

Snapshots written in `setAggregatedPubkey()`, NOT `_emitStateChange()`.

**Operational constraint**: After `addIssuer()`/`removeIssuer()`, admin MUST call `setAggregatedPubkey(pubkey, N)` before further mutations. Enforced on-chain:
```solidity
function addIssuer(...) external onlyAdmin {
    if (lastSnapshotNonce != registryNonce) revert IssuerRegistry__PendingSnapshot();
    // ...
}
function removeIssuer(...) external onlyAdmin {
    if (lastSnapshotNonce != registryNonce) revert IssuerRegistry__PendingSnapshot();
    // ...
}
```
`_emitStateChange()` emits `SnapshotPending(nonce)`. Issuer nodes log WARNING if gap persists > 10 blocks (full state machine deferred to implementation).

### Contract changes

**IssuerRegistry.sol**:
- `mapping(uint256 => RegistrySnapshot) _nonceSnapshots` — **`__gap` 1 slot**
- `RegistrySnapshot` in TypesLib.sol:
  ```solidity
  struct RegistrySnapshot {
      uint256 activeCount;
      bytes32 stateHash;
      bytes32[4] aggregatedPubkey;
      uint256 blockNumber;
      uint256 activeBitmask;
  }
  ```
- Conversion helpers:
  ```solidity
  function _pubkeyToFixed(bytes calldata pubkey) internal pure returns (bytes32[4] memory r) {
      assembly { calldatacopy(r, pubkey.offset, 128) }
  }
  function _fixedToPubkey(bytes32[4] memory pk) internal pure returns (bytes memory) {
      return abi.encodePacked(pk[0], pk[1], pk[2], pk[3]);
  }
  ```
- `setAggregatedPubkey(bytes calldata pubkey, uint256 nonce)` writes snapshot with `_computeActiveBitmask()`
- `_computeActiveBitmask()` iterates `_issuers[0.._issuerCount]`, sets bit `i` if `status == 1`. Gas scales with total issuers ever registered (not just active). Acceptable for 20-100 issuers. Called only in admin tx (`setAggregatedPubkey`), not user-facing.
- `getActiveBitmask() external view` — public view for node bootstrap (calls `_computeActiveBitmask()`)

### Issuer node: `VersionedKeyRegistry`

```rust
pub struct VersionedKeyRegistry {
    snapshots: BTreeMap<u64, KeySnapshot>,  // nonce -> snapshot
    max_retention: u64,                      // = 256 (matches contract window)
}

impl VersionedKeyRegistry {
    pub fn snapshot(&mut self, nonce: u64, block_number: u64) { ... }
    pub fn get_state_at_nonce(&self, nonce: u64) -> Option<&KeySnapshot> { ... }
    pub fn latest_nonce(&self) -> Option<u64> { ... }

    /// Prune snapshots older than max_retention from latest
    pub fn prune(&mut self) {
        if let Some(&latest) = self.snapshots.keys().last() {
            let min = latest.saturating_sub(self.max_retention);
            self.snapshots = self.snapshots.split_off(&min);
        }
    }
}
```

**Bootstrap**: Phase -1d creates one snapshot from current chain state. On restart, this is sufficient — in-flight work is abandoned.

**Runtime**: Each `RegistryStateChanged` event adds a new snapshot. `prune()` called after each insert.

---

## Item 3: Non-Signer Tracking

**Merged into Phase 2+3 ceremony** — `_verifyBLS` gains BOTH `referenceNonce` and `signersBitmask` at once.

### Contract changes (in IssuerRegistry.sol)

- `mapping(uint256 => uint256) public issuerMissedCount` — **`__gap` 1 slot**
- `function incrementMissedCounts(uint256 nonSignersBitmask) external` — PUBLIC, no access control. Advisory only (see Protocol Invariant P3).
- `NonSignersRecorded` event emitted by BLSVerifier after each `_verifyBLS` call.

### Issuer node

- `aggregator.rs`: `non_signers_bitmask()` using `issuer_registry_index` (NOT `peer_id[0]`)
- `protocol.rs`: Leader computes bitmask from aggregator (see Protocol Invariant P2), passes to chain writer. Also fix ITP creation bitmap (~line 2549).

---

## Item 6: Proof of Possession

Unchanged from v3. PoP with `abi.encode("INDEX_BLS_POP", block.chainid, address(this), issuerAddr, blsPubkey)`.

---

## Item 7: Global Key Uniqueness

Unchanged from v3. `_pubkeyHashToIssuerId` stores `issuerId + 1` (sentinel collision fix).

---

## Item 8: Key Separation

Unchanged from v3. 3-factor rotation request (ECDSA + old-key BLS + new-key PoP). 2-factor approval (ECDSA + BLS) with `abi.encode` + chain binding.

**Additional Rust-side change**: `build_registry_sync_message_hash()` in `registry_sync/mod.rs` must be updated to match the new Solidity encoding (`abi.encode` with `block.chainid` + `address(this)`). The handler must know the MirrorIssuerRegistry's chain ID and address (add to `RegistrySyncConfig`).

**Note**: Phase 0e already fixes the current `encodePacked` mismatch. Phase 4 then changes BOTH sides to `abi.encode` with chain binding in a coordinated update.

---

# PART B: P2P LAYER HARDENING

---

## P2P Architecture (unchanged)

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
                   | +- transport.rs              |
                   | +- connection.rs             |
                   | +- discovery.rs              |
                   | +- codec.rs                  |
                   | +- tls.rs                    |
                   | +- rate_limit.rs     (NEW)   |
                   | +- peer_scoring.rs   (NEW)   |
                   | +- wal.rs            (NEW)   |
                   | +- metrics.rs        (NEW)   |
                   +------------------------------+
```

---

## P2P-1: Rate Limiting

### Token bucket per peer

**File:** `issuer/src/p2p/rate_limit.rs` (new, ~60 lines)

```rust
use std::time::Instant;

pub struct RateBucket {
    tokens: f64,
    max_tokens: f64,
    refill_rate: f64, // tokens per second
    last_refill: Instant,
}

impl RateBucket {
    pub fn new(max_tokens: f64, refill_rate: f64) -> Self {
        Self {
            tokens: max_tokens,
            max_tokens,
            refill_rate,
            last_refill: Instant::now(),
        }
    }

    pub fn try_consume(&mut self) -> bool {
        self.refill();
        if self.tokens >= 1.0 {
            self.tokens -= 1.0;
            true
        } else {
            false
        }
    }

    fn refill(&mut self) {
        let now = Instant::now();
        let elapsed = now.duration_since(self.last_refill).as_secs_f64();
        self.tokens = (self.tokens + elapsed * self.refill_rate).min(self.max_tokens);
        self.last_refill = now;
    }
}
```

### Integration point

In `connection.rs` `reader_loop`, check rate bucket **before** feeding bytes to the codec (pre-decode). This prevents CPU waste on garbage from flooding peers:

```rust
// After reading bytes from TCP, before codec.feed():
// Count complete frames by checking length prefix without deserializing
if !rate_bucket.try_consume() {
    warn!(code = "INFRA-020", ?peer_id, "Rate limit exceeded, dropping frame");
    // Skip this frame: read and discard payload_len bytes
    continue;
}
```

The `RateBucket` is created per connection in `setup_connection()` and passed to `reader_loop` as an owned parameter (no Arc/Mutex needed — each reader_loop owns its bucket).

### Parameters (configurable via CLI flags)

| Parameter | Default | Flag | Rationale |
|---|---|---|---|
| `max_tokens` (burst) | 100 | `--p2p-rate-burst` | Accommodates fast cycles (50ms) with bridge operations |
| `refill_rate` (per sec) | 100 | `--p2p-rate-limit` | 100 msgs/sec handles worst-case: 20 cycles/sec x 4 msgs/cycle |

Defaults are generous. The point is to stop floods (1000+ msgs/sec), not throttle legitimate traffic.

### Deliverable
- A compromised/buggy node cannot flood the network
- Zero latency impact on normal operation (bucket never empties at normal rates)
- Zero new dependencies
- Configurable without recompilation

---

## P2P-2: Connection Limits

### Atomic check-and-accept

In `transport.rs` `start_listener()`, combine total and per-IP checks in a single write lock to prevent TOCTOU races under concurrent connection floods:

```rust
const MAX_INBOUND_CONNECTIONS: usize = 30; // 20 issuers + headroom
const DEFAULT_MAX_PER_IP: usize = 2;      // 1 inbound + 1 outbound

// CLI flag: --p2p-max-per-ip <N> (default: 2, 0 = unlimited)
// Loopback IPs (127.0.0.0/8, ::1) are ALWAYS exempt — start.sh and
// start-issuers.sh run 3-20 issuers on 127.0.0.1.

fn is_loopback(ip: &std::net::IpAddr) -> bool {
    match ip {
        std::net::IpAddr::V4(v4) => v4.is_loopback(),
        std::net::IpAddr::V6(v6) => v6.is_loopback(),
    }
}

// In accept loop, before spawning handler:
{
    let conns = connections.write().await; // Single lock acquisition
    if conns.len() >= MAX_INBOUND_CONNECTIONS {
        warn!(code = "INFRA-021", conn_count = conns.len(), "Max connections reached");
        drop(stream);
        continue;
    }
    // Skip per-IP check for loopback (local dev runs N issuers on 127.0.0.1)
    if !is_loopback(&addr.ip()) && max_per_ip > 0 {
        let ip_count = conns.values().filter(|c| c.addr().ip() == addr.ip()).count();
        if ip_count >= max_per_ip {
            warn!(code = "INFRA-021", %addr, "Per-IP limit reached");
            drop(stream);
            continue;
        }
    }
}
// Lock released before spawning connection handler
```

### Deliverable
- Network cannot be overwhelmed by excessive inbound connections
- Atomic check prevents race condition under concurrent accepts
- Loopback IPs exempt — local dev with 3-20 issuers on 127.0.0.1 works out of the box
- `--p2p-max-per-ip` flag for production tuning (default 2, 0 = unlimited)
- ~30 lines of code

---

## P2P-3: Peer Scoring & Auto-Banning

### Score tracker

**File:** `issuer/src/p2p/peer_scoring.rs` (new, ~150 lines)

Uses `DashMap` (already in `issuer/Cargo.toml` dependency tree) to avoid RwLock write contention from 20 concurrent reader_loops:

```rust
use dashmap::DashMap;
use std::sync::atomic::{AtomicU32, Ordering};
use std::time::Instant;
use common::types::p2p::PeerId;

#[derive(Debug)]
pub struct PeerScore {
    pub score: AtomicI64,          // Fixed-point: actual_score * 100
    pub invalid_messages: AtomicU32,
    pub rate_limit_hits: AtomicU32,
    pub decode_failures: AtomicU32,
    pub last_seen: Mutex<Instant>, // Only updated on heartbeat
    pub banned_until: Mutex<Option<Instant>>,
    pub ban_count: AtomicU32,      // For exponential ban duration
}

pub struct PeerScorer {
    scores: DashMap<PeerId, PeerScore>,
    startup_time: Instant, // For decode failure grace period
}
```

Hot-path methods (`record_good_message`, `record_rate_limit_hit`, `is_banned`) use atomics — no lock contention. Only `tick()` takes the `Mutex` on `banned_until` every 5 seconds.

### Scoring parameters

| Event | Score Change | Rationale |
|---|---|---|
| Good message | +0.1 | Slow recovery to prevent gaming |
| Heartbeat received | +0.5 | Liveness signal |
| Invalid message | -10.0 | Verifiably bad behavior |
| Decode failure (first 60s after startup) | -1.0 | Grace period for rolling upgrades |
| Decode failure (after 60s) | -5.0 | Normal penalty |
| Rate limit hit | -2.0 | Mild — could be transient burst |
| No heartbeat (per 5s tick) | -5.0 | Liveness failure |
| **Ban threshold** | -50.0 | Takes sustained misbehavior, not a single hiccup |
| **Ban duration** | 60s x 2^(ban_count-1) | Exponential: 60s, 120s, 240s... for repeat offenders |

### Partition detection heuristic

In `tick()`, before banning peers:

```rust
let unhealthy_count = /* peers with score < 0 */;
let total_peers = self.scores.len();
if unhealthy_count > total_peers / 3 {
    error!(
        code = "INFRA-023",
        unhealthy_count,
        total_peers,
        "POSSIBLE NETWORK PARTITION — >33% peers unhealthy, suspending bans"
    );
    // Suspend score-based bans — BUT still ban for equivocation.
    // Equivocation is a cryptographic proof of byzantine behavior, not
    // a symptom of partition.
    return self.collect_equivocation_bans_only();
}
```

**N=3 edge case:** With 3 nodes, `>33%` means `>1` peer unhealthy = 2 out of 2 peers. This effectively prevents ALL score-based banning in 3-node clusters. This is acceptable because:
- In dev/E2E (3 nodes), you never want to auto-ban — you want the error logs
- Equivocation bans still fire regardless (provable byzantine behavior)
- In production (20 nodes), `>33%` = `>6` peers — a reasonable partition threshold

### Disconnect mechanism

Add `disconnect_peer()` to `TcpP2PTransport`:

```rust
/// Force-disconnect a peer by PeerId. Removes from connection map and aborts tasks.
pub async fn disconnect_peer(&self, peer_id: &PeerId) {
    let mut conns = self.connections.write().await;
    if let Some(conn) = conns.remove(peer_id) {
        conn.close().await;
        info!(code = "INFRA-023", ?peer_id, "Peer disconnected (banned)");
    }
}
```

Also gate `reconnect_loop` with `is_banned()` check:

```rust
// In reconnect_loop, before each attempt:
if scorer.is_banned(&peer_id) {
    tokio::time::sleep(Duration::from_secs(5)).await;
    continue; // Don't reconnect to banned peer
}
```

### Integration points

1. **Reader loop** (`connection.rs`): check `is_banned()` **before** `codec.feed()` — skip decode entirely for banned peers
2. **Scorer tick** (new timer in `transport.rs`): every 5s, call `tick()`, call `disconnect_peer()` for each banned peer
3. **Rate limiter** (P2P-1): call `record_rate_limit_hit()` when bucket is empty
4. **Reader loop** (on decode error): call `record_decode_failure()` — NOT inside codec.rs (scorer not accessible there)
5. **Reconnect loop**: gate with `is_banned()` to prevent reconnecting to banned peers
6. **Incoming connections**: check `is_banned()` by IP before accepting

### Threading

`PeerScorer` is wrapped in `Arc<PeerScorer>` and threaded to:
- Each `reader_loop` (added as parameter to `setup_connection` -> `reader_loop`)
- `transport.rs` (for tick timer and disconnect)
- `ConsensusProtocol` (for leader check + equivocation scoring — see P2P-4)

### Deliverable
- Peers that send garbage get progressively penalized and auto-disconnected
- Exponential ban duration for repeat offenders (60s -> 120s -> 240s...)
- Partition heuristic prevents score-based banning during a split, but equivocation bans always fire
- At N=3 (dev/E2E), score-based bans are effectively disabled — equivocation is the only auto-ban trigger
- Conservative thresholds: takes sustained misbehavior, not a single hiccup
- Rolling upgrade grace period for decode failures in first 60s
- Zeroed PeerIds (pre-rekey) are ignored by scorer

---

## P2P-4: Leader Identity Verification (transport-level)

This is the P2P-layer complement to Phase 0d's contract-level leader check. Phase 0d verifies leader identity within `ConsensusProtocol` using dense indices. P2P-4 verifies that the transport-layer sender PeerId matches the expected leader, feeding violations into peer scoring.

### Where the check lives

The check goes in `ConsensusProtocol::handle_message()` (`protocol.rs`), **NOT** in `ConsensusMessageHandler` (`messages.rs`). Reason: `ConsensusProtocol` has access to `self.leader_elector`, `self.config` (num_issuers), and can be given `Arc<PeerScorer>`. `ConsensusMessageHandler` is a thin stateless router with none of these.

### Leader election mechanism

The actual leader election uses **cycle-modulo rotation**:

```rust
// leader/election.rs line 179
let leader_index = (cycle_number % self.num_issuers as u64) as u8;
```

NOT BLS-signature-based. The check needs:
1. Compute `leader_index = cycle_number % num_issuers`
2. Look up the PeerId for that index from an ordered peer registry
3. Compare against the transport-layer `from`

### Peer registry for index -> PeerId mapping

Add an ordered `Vec<PeerId>` to `ConsensusProtocol` (populated at startup and refreshed on registry sync):

```rust
/// Ordered list of issuer PeerIds, index matches issuer index in registry
peer_registry: Arc<RwLock<Vec<PeerId>>>,
```

**Population strategy** (IssuerRegistry stores ETH addresses, not PeerIds):

1. **On-chain discovery (preferred)**: Use `get_issuer_registry()` (which now returns on-chain IDs via `getActiveIssuerEndpoints()` — see Phase -1d prerequisite). Build the registry using `generate_peer_id(issuer.id as u32)` for each active issuer. This handles non-contiguous IDs correctly after issuer removal. The static peer list (`ISSUER_PEERS` env) is used ONLY for TCP connection establishment (IP:port), NOT for identity mapping.

2. **Static peer fallback (local dev only)**: For local dev with `--test-key-seeds` where on-chain discovery is unavailable, parse the peer list and build the registry using `generate_peer_id(node_id)` for each `node_id` 1..=num_issuers. This assumes contiguous IDs and will break after any issuer removal — acceptable for local dev only.

**WARNING**: The previous approach of building the peer_registry from static peers with `generate_peer_id(node_id)` for `node_id` 1..=N assumes contiguous IDs. After any issuer removal, IDs have gaps (e.g., 1, 3, 4, ..., 20). Dense index 1 would map to `generate_peer_id(2)` but the actual node has on-chain ID 3 and peer_id `generate_peer_id(3)`. The leader check would reject legitimate leaders. Always prefer on-chain discovery in production.

3. **Zeroed PeerIds**: On-chain peers start with zeroed PeerId before re-keying. The scorer and leader check must skip zeroed PeerIds (treat as "unknown, allow"):

```rust
fn is_zeroed_peer_id(peer: &PeerId) -> bool {
    peer.iter().all(|&b| b == 0)
}
```

### The check

```rust
// In ConsensusProtocol::handle_message(), before routing to ConsensusMessageHandler:
fn verify_leader(&self, from: &PeerId, cycle_number: u64) -> bool {
    // Skip check for temp peer IDs (0xFE/0xFF prefix = connection not yet identified)
    if is_temp_peer_id(from) {
        return true; // Allow — will be re-verified after re-keying
    }

    // Skip check for zeroed PeerIds (on-chain peers before re-keying)
    if is_zeroed_peer_id(from) {
        return true;
    }

    let leader_index = (cycle_number % self.config.num_issuers as u64) as usize;
    let registry = self.peer_registry.read().await;

    if leader_index >= registry.len() {
        warn!(code = "CONSENSUS-020", leader_index, registry_len = registry.len(),
              "Registry not fully populated, allowing proposal");
        return true; // Permissive during startup
    }

    // Skip if expected leader is zeroed (registry not yet resolved for this index)
    if is_zeroed_peer_id(&registry[leader_index]) {
        return true;
    }

    if registry[leader_index] != *from {
        warn!(code = "CONSENSUS-020", ?from, expected = ?registry[leader_index],
              cycle_number, "Proposal from non-leader");
        self.peer_scorer.record_invalid_message(from);
        return false;
    }
    true
}
```

### Apply to all proposal message types

Call `verify_leader()` in `handle_message()` for every `*Proposal` variant before routing to the message handler. The `MessageHandleResult` gains a new variant:

```rust
MessageHandleResult::RejectedNonLeader { from: PeerId }
```

Applied to: `PriceProposal`, `BatchProposal`, `ItpCreationProposal`, `BridgeArbToL3Proposal`, `BridgeL3ToArbProposal`, `RebalanceBatchProposal`, `UpdateWeightsProposal`, `AssetTradesProposal`, `SubmitOrderProposal`, `ConfirmBatchProposal`, `ConfirmFillsProposal`.

### Deliverable
- A non-leader cannot inject fake proposals
- Uses the actual election mechanism (`cycle % N`), not the wrong BLS-based one
- Graceful during startup (permissive if registry not populated or entry is zeroed)
- Graceful during connection re-keying (temp PeerIds and zeroed PeerIds allowed through)
- Registry populated from `generate_peer_id(node_id)` — works for both static peers and on-chain discovery
- Violations feed into peer scoring

---

## P2P-5: Equivocation Detection

### Prerequisites

Add `Hash` to `ConsensusPhase` derive:

```rust
// consensus/state.rs
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum ConsensusPhase { ... }
```

### Content-only hashing

Hash the **semantic content** of messages, NOT the BLS signature. This prevents false positives when the leader re-signs the same proposal on retry:

```rust
use sha2::{Sha256, Digest}; // Already in Cargo.toml

fn content_hash(message: &P2PMessage) -> [u8; 32] {
    let mut hasher = Sha256::new();
    match message {
        P2PMessage::PriceProposal { cycle_number, prices, .. } => {
            hasher.update(b"price_proposal");
            hasher.update(&cycle_number.to_le_bytes());
            for (idx, price) in prices {
                hasher.update(&idx.to_le_bytes());
                hasher.update(&price.to_le_bytes::<32>());
            }
        }
        P2PMessage::PriceVote { cycle_number, voter_id, approved, .. } => {
            hasher.update(b"price_vote");
            hasher.update(&cycle_number.to_le_bytes());
            hasher.update(voter_id);
            hasher.update(&[*approved as u8]);
        }
        // ALL vote/signature message types MUST be explicitly enumerated here,
        // hashing content fields and EXCLUDING BLS signature fields.
        //
        // Types to enumerate (all *Vote/*Sign variants):
        //   BatchVote, ItpCreationVote, BridgeArbToL3Vote, BridgeL3ToArbVote,
        //   RebalanceBatchVote, UpdateWeightsVote, AssetTradesVote,
        //   SubmitOrderVote, ConfirmBatchVote, ConfirmFillsVote
        //
        // For each: hash a unique tag + cycle_number + voter_id + content fields.
        // Do NOT hash the `signature` or `bls_signature` fields.
        //
        // IMPORTANT: Do NOT add a `_ =>` fallback. The match MUST be exhaustive
        // so that adding a new P2PMessage variant produces a compile error, forcing
        // the developer to add a proper content-only hash branch. A fallback that
        // hashes the full encoded message (including BLS signatures) causes false
        // equivocation detection after WAL replay.
    }
    hasher.finalize().into()
}
```

### Detector with DashMap

```rust
use dashmap::DashMap;

pub struct EquivocationDetector {
    // Key: (peer_id, cycle_number, phase)
    // Value: sha256 hash of the first message content
    seen: DashMap<(PeerId, u64, ConsensusPhase), [u8; 32]>,
}

impl EquivocationDetector {
    /// Returns true if equivocation detected (different content for same key).
    pub fn check(&self, peer: &PeerId, cycle: u64, phase: ConsensusPhase, content_hash: [u8; 32]) -> bool {
        let key = (*peer, cycle, phase);
        match self.seen.entry(key) {
            dashmap::mapref::entry::Entry::Vacant(e) => {
                e.insert(content_hash);
                false
            }
            dashmap::mapref::entry::Entry::Occupied(e) => {
                *e.get() != content_hash // true = equivocation
            }
        }
    }

    /// Cleanup. Call at cycle start. Also time-based fallback for stalled cycles.
    pub fn gc(&self, current_cycle: u64) {
        self.seen.retain(|&(_, cycle, _), _| cycle >= current_cycle.saturating_sub(2));
    }

    /// Time-based GC fallback: remove entries older than max_age
    pub fn gc_by_time(&self, max_entries: usize) {
        if self.seen.len() > max_entries {
            // Evict oldest entries by cycle number
            let min_cycle = self.seen.iter()
                .map(|r| r.key().1)
                .min()
                .unwrap_or(0);
            self.seen.retain(|&(_, cycle, _), _| cycle > min_cycle);
        }
    }
}
```

### Integration

In `ConsensusProtocol::handle_message()`, for votes and signatures only (NOT proposals — proposals have legitimate retries):

```rust
// Only check equivocation for votes/signs, not proposals
if is_vote_or_sign(&message) {
    let hash = content_hash(&message);
    if self.equivocation_detector.check(&from, cycle_number, phase, hash) {
        error!(code = "CONSENSUS-021", ?from, cycle_number, ?phase,
               "EQUIVOCATION DETECTED — contradictory message");
        self.peer_scorer.record_invalid_message(&from);
        self.peer_scorer.record_invalid_message(&from); // Double penalty
        return Ok(()); // Drop the equivocating message
    }
}
```

### Limitations (documented)

- **Memory-only**: resets on restart. A byzantine node can exploit the restart window.
- **Best-effort**: only detects equivocation visible to this node. A node that sends message A to peers 1-10 and message B to peers 11-20 is only detected by nodes that somehow see both (not possible in direct TCP without gossip evidence sharing).
- **Future enhancement**: gossip equivocation evidence between nodes.

### Deliverable
- Double-signing detected and penalized for votes/signatures
- No false positives on leader proposal retries (content-only hash, proposals excluded)
- Uses `sha2` (already in deps), not blake3 (would be new dep)
- DashMap avoids lock contention
- GC with both cycle-based and size-based fallback

---

## P2P-6: Write-Ahead Log

### WAL for mid-cycle recovery

**File:** `issuer/src/p2p/wal.rs` (new, ~200 lines)

**CLI flag:** `--wal-path <PATH>` (default: `./consensus-{node_id}.wal`)

Per-issuer WAL path prevents file collision when multiple issuers share the same CWD (as in `start.sh` and `start-issuers.sh` which run 3-20 issuers from the repo root). The `{node_id}` is substituted at startup from `--node-id`.

### Entry framing with CRC

Each WAL entry is framed for corruption resilience:

```
[4 bytes: payload length (big-endian)]
[N bytes: MessagePack payload (WALEntry)]
[4 bytes: CRC32 of payload]
```

On read, if CRC doesn't match -> treat as truncated last write -> stop reading (safe).

```rust
#[derive(Serialize, Deserialize)]
pub struct WALEntry {
    pub cycle_number: u64,
    pub phase: ConsensusPhase,
    pub from: PeerId,           // Original sender (NOT our_peer_id)
    pub message: P2PMessage,
    pub role: WalRole,          // Leader or Follower
    pub timestamp_ms: u64,
}

#[derive(Serialize, Deserialize)]
pub enum WalRole {
    Leader,   // We proposed this
    Follower, // We received this from a peer
}
```

### WAL implementation

```rust
pub struct ConsensusWAL {
    file: std::fs::File,    // std::fs, NOT tokio::fs (avoid blocking pool latency)
    path: PathBuf,
    sync_mode: WalSyncMode,
}

pub enum WalSyncMode {
    Fdatasync,  // Default: fast, skips metadata sync
    Fsync,      // Full sync (paranoid mode)
    None,       // No sync (fastest, data loss possible on crash)
}

impl ConsensusWAL {
    /// Open or create WAL. Probe write at startup to fail fast.
    pub fn open(path: impl Into<PathBuf>, sync_mode: WalSyncMode) -> Result<Self, Error> {
        let path = path.into();
        let file = std::fs::OpenOptions::new()
            .create(true).append(true).read(true).open(&path)?;
        // Probe write to fail fast on permission/disk issues
        // ...
        Ok(Self { file, path, sync_mode })
    }

    /// Append entry. Uses std::fs (not tokio) to avoid blocking pool overhead.
    /// Called from consensus loop which is already on a single task.
    pub fn append(&mut self, entry: &WALEntry) -> Result<(), Error> {
        let payload = rmp_serde::to_vec(entry)?;
        let crc = crc32fast::hash(&payload);
        let len = payload.len() as u32;

        self.file.write_all(&len.to_be_bytes())?;
        self.file.write_all(&payload)?;
        self.file.write_all(&crc.to_be_bytes())?;

        match self.sync_mode {
            WalSyncMode::Fdatasync => self.file.sync_data()?,
            WalSyncMode::Fsync => self.file.sync_all()?,
            WalSyncMode::None => {},
        }
        Ok(())
    }

    /// Read entries for a cycle. Stops at first CRC mismatch (truncated write = safe).
    pub fn read_cycle(&self, cycle_number: u64) -> Result<Vec<WALEntry>, Error>;

    /// GC: write current-cycle entries to .tmp, fsync, atomic rename.
    pub fn gc(&mut self, current_cycle: u64) -> Result<(), Error> {
        // 1. Read entries for current_cycle into memory
        // 2. Write to path.with_extension("wal.tmp")
        // 3. fsync the temp file
        // 4. std::fs::rename(tmp, self.path) — atomic on POSIX
        // 5. Re-open the file for append
        // On error: log INFRA-022, continue without GC (WAL grows but node stays up)
    }
}
```

### Hard cap and graceful degradation

```rust
const MAX_WAL_SIZE: u64 = 10 * 1024 * 1024; // 10 MB

// Before append:
if self.file.metadata()?.len() > MAX_WAL_SIZE {
    error!(code = "INFRA-022", "WAL exceeded 10 MB — GC is broken, disabling WAL writes");
    // Continue operating without WAL rather than crash
    return Ok(());
}
```

### Recovery on restart (replay mode)

```rust
// At startup:
if let Ok(entries) = wal.read_cycle(current_cycle) {
    if !entries.is_empty() {
        info!(cycle = current_cycle, count = entries.len(), "Replaying WAL");
        // Set replay flag — suppresses outbound broadcasts during replay
        consensus.set_replay_mode(true);
        for entry in &entries {
            // Use ORIGINAL sender, not our_peer_id
            consensus.handle_message(entry.from, entry.message.clone()).await?;
        }
        consensus.set_replay_mode(false);
    }
} else {
    warn!(code = "INFRA-022", "WAL replay failed (corrupt?), starting fresh");
    // --skip-wal-replay flag also skips this entirely
}
```

Key details:
- `set_replay_mode(true)` suppresses outbound `p2p.broadcast()` calls during replay
- Uses `entry.from` (original sender), NOT `our_peer_id` — preserves vote attribution
- Skips leader identity check and equivocation detection during replay
- After replay, the node does NOT re-broadcast for the current cycle — peers already received the original votes before the crash. Re-broadcasting would trigger false equivocation detection on peer nodes for any message type whose `content_hash` falls into the fallback branch (which includes BLS signature bytes). The node waits for the next cycle to actively participate.
- If `current_cycle` has moved past the WAL's cycle -> entries are stale, skip replay
- `--skip-wal-replay` CLI flag for emergency bypass of corrupt WAL

### Performance (realistic VPS estimates)

| Metric | Estimate | Notes |
|---|---|---|
| `fdatasync` on Hetzner VPS | 2-15ms | Shared NVMe, varies by tenant load |
| Entries per cycle | 4 max | One per phase transition |
| Total per cycle | 8-60ms | Worst case eats ~7% of 800ms budget |
| With `WalSyncMode::None` | <0.1ms | No sync, risk of losing last entry on crash |

**Auto-detection:** If `--cycle-duration-ms < 500` (E2E / stress test), default to `WalSyncMode::None`. Otherwise default to `Fdatasync`. This prevents E2E cycles from eating 4-30% budget on fsync. Can be overridden with `--wal-sync-mode fdatasync|fsync|none`.

**Recommendation for production:** `fdatasync` (default for >=500ms cycles). If benchmarks on prod-be show >20ms per sync, switch to `None` — losing 1 cycle of WAL data on crash is acceptable given the stateless recovery from on-chain state.

### Deliverable
- CRC-framed WAL entries survive partial writes
- Atomic GC via rename prevents data loss
- Replay mode preserves original sender identity and suppresses broadcasts
- Hard cap prevents disk exhaustion if GC breaks
- Configurable sync mode for VPS performance tuning
- `--skip-wal-replay` escape hatch for emergencies

---

## P2P-7: Observability

### Metrics via existing pattern

The codebase uses `AtomicU64` counters exposed via JSON on the health endpoint (see `heartbeat/metrics.rs`). Follow the same pattern — no new `prometheus` crate dependency:

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

Exposed via existing `/health` JSON endpoint alongside `HeartbeatMetrics`.

### Structured logging with non-colliding error codes

Existing codes INFRA-010 through INFRA-014 are taken. New codes start at INFRA-020:

| Code | Meaning |
|---|---|
| `INFRA-020` | Rate limit exceeded |
| `INFRA-021` | Connection limit exceeded |
| `INFRA-022` | WAL write/read/GC error |
| `INFRA-023` | Peer banned/unbanned/partition detected |
| `CONSENSUS-020` | Proposal from non-leader |
| `CONSENSUS-021` | Equivocation detected |

### Deliverable
- All new features observable via `/health` JSON (same as existing pattern)
- No new dependencies
- Non-colliding error codes for log analysis

---

# UNIFIED IMPLEMENTATION ORDER

---

## Part A: Contract & Protocol Safety

```
Phase -1 (Operational Infrastructure):
  -1a. On-chain consensus pause mechanism (IssuerRegistry.consensusPaused)
       - RPC failure = paused (fail-safe)
  -1b. Mandatory --registry-sync for multi-issuer
       - initial_scan_blocks: 10,000 -> 86,400
  -1c. Bootstrap from on-chain state
       - ChainReader trait: get_active_issuer_count, get_registry_nonce, get_aggregated_pubkey
       - Derive issuer_registry_index + node_index from chain (BLS pubkey match)
       - threshold from compute_threshold(on_chain_active)
       - Deprecate --signature-threshold CLI flag
  -1d. Bootstrap key registry from chain
       - build_key_registry() queries get_issuer_registry(), populates InMemoryKeyRegistry
       - Fallback to test seeds only if chain unavailable AND --test-key-seeds set
       - Bootstrap VersionedKeyRegistry snapshot from registryNonce()
       - VersionedKeyRegistry prunes to 256-nonce window
  -1e. /ready health endpoint (connected peers >= threshold-1, chain reader ok)
  -1f. Production deployment script (scripts/deploy-ceremony.sh)
       - Includes non-upgradeable address checklist

Phase 0 (Bug Fixes):
  0a. Unify threshold formula — delete calculate_threshold(), use compute_threshold() everywhere
  0b. Fix apply_pending_config_update — ConfigUpdate struct with node_index + registry_index
  0c. Fix peer_id[0] inconsistencies — bitmaps use issuer_registry_index, key registry uses generate_peer_id(issuer.id)
  0d. Leader identity verification with dual-view tolerance
  0e. Fix abi.encode vs abi.encodePacked mismatch in MirrorIssuerRegistry.sync()
      *** HARD DEPENDENCY: 0e (Solidity proxy upgrade) MUST be deployed BEFORE -1b's
      --registry-sync enforcement takes effect. If -1b ships without 0e, all registry
      sync BLS verification fails silently (hash mismatch). Deploy 0e contract upgrade
      first, then enable --registry-sync in node configs. ***

Phase 1 (Foundation — contract-only):
  #6 Proof of Possession
  #7 Key Uniqueness

Phase 2+3 (State + Accountability — SINGLE deployment ceremony):
  #2 Historical Tracking
  #1 Reference Block
  #3 Non-Signer Tracking
  BLSVerifier._verifyBLS gains (referenceNonce, signersBitmask) — ONE signature change

Phase 4 (Key Architecture — contract-only):
  #8 Key Separation + MirrorIssuerRegistry chain binding (abi.encode + chainid + address)
  Coordinated Rust update: build_registry_sync_message_hash must match new encoding
```

## Part B: P2P Layer Hardening (3 weeks, 2 parallel tracks)

**Can run independently of Part A.** No contract changes. No wire protocol changes.

```
Track A (transport layer)          Track B (consensus layer)
-------------------------          --------------------------
Day 1:  P2P-1 (rate limit)       Day 1:  P2P-6 (WAL core)
Day 1:  P2P-2 (conn limits)      Day 2:  P2P-6 (CRC + GC)
Day 2-4: P2P-3 (scoring)         Day 3-4: P2P-6 (replay mode)
Day 5:  P2P-4 (leader check)     Day 5:  P2P-7 (metrics)
Day 6:  P2P-5 (equivocation)     Day 6:  P2P-7 (integration)
Day 7-8: Integration testing      Day 7-8: Integration testing
Day 9-10: Property-based tests   Day 9-10: WAL chaos tests
```

| Phase | Effort | Dependencies |
|-------|--------|-------------|
| P2P-1 (Rate limiting) | Day 1 | None |
| P2P-2 (Connection limits) | Day 1 | None |
| P2P-3 (Peer scoring) | Day 2-4 | P2P-1 (rate_limit_hit events) |
| P2P-4 (Leader check) | Day 5 | P2P-3 (scoring), peer registry |
| P2P-5 (Equivocation) | Day 6 | P2P-3 (scoring), `ConsensusPhase: Hash` |
| P2P-6 (WAL) | Day 1-4 (parallel) | None |
| P2P-7 (Observability) | Day 5-6 (parallel) | All phases |
| Testing | Day 7-10 | All phases |
| **Total** | **~3 weeks** | |

## Cross-Cutting Dependencies

```
                    Issuer struct change (add id field, switch to getActiveIssuerEndpoints)
                              |
                              v
Phase -1 ──> Phase 0 ──> Phase 1 ──> Phase 2+3 ──> Phase 4
                |
                +──> P2P (independent, parallel — but P2P-4 needs Issuer.id)

Within Phase 0:  0e (abi.encodePacked fix) ──MUST DEPLOY BEFORE──> -1b (--registry-sync enforcement)
```

Phase P2P has no contract dependencies. Can be deployed independently via binary update + rolling restart (no pause needed). Phase 0d (leader verification) from the contract plan is merged into P2P-4. P2P-4's on-chain discovery path requires the `Issuer.id` field (Phase -1d prerequisite).

## Unified Timeline

```
Week 1-2:
  Phase -1 (operational infrastructure)        [contract + Rust]
  Phase 0  (bug fixes)                         [contract + Rust]
  P2P-1 to P2P-3 (rate limit, conn, scoring)   [Rust only, parallel]
  P2P-6 (WAL core + CRC + GC)                  [Rust only, parallel]

Week 3:
  P2P-4 (leader check, merged with Phase 0d)   [Rust only]
  P2P-5 (equivocation)                         [Rust only]
  P2P-7 (observability)                        [Rust only]
  P2P integration + property tests             [Rust only]

Week 4:
  Phase 1 (PoP + key uniqueness)               [contract proxy upgrade]

Week 5-6:
  Phase 2+3 (reference block + historical + non-signer)  [contracts + Rust + ceremony]

Week 7+:
  Phase 4 (key separation)                     [contract + Rust]
```

P2P hardening (weeks 1-3) and Phase -1/0 (weeks 1-2) run in parallel tracks.

---

## Testing Plan (P2P)

### Unit tests

- Rate bucket: exact token math, refill timing, burst behavior, configurable rates
- Peer scoring: score transitions, ban/unban lifecycle, tick decay, exponential ban duration, partition heuristic (>33% threshold)
- Equivocation detector: same content ok, different content flagged, content-only hash excludes BLS signature, GC by cycle and by size
- WAL: write/read with CRC, truncated last entry recovery, atomic GC, hard cap behavior
- Leader identity: correct leader accepted, wrong leader rejected, temp PeerId bypassed, empty registry permissive

### Integration tests (multi-node, in-process)

Spin up 3 `TcpP2PTransport` instances on localhost ports with full `ConsensusProtocol` stack:

- 3-node consensus with all features enabled -> cycles complete normally
- 1 node sends 500 msgs/sec -> rate limited, other nodes unaffected, consensus continues
- 1 node sends invalid messages -> scored down -> banned -> consensus continues with 2
- 1 node sends contradictory votes -> equivocation detected, logged, vote rejected
- Kill node mid-cycle -> restart -> WAL replay -> participates in next cycle
- Non-leader sends proposal -> rejected by all followers, scored down
- Simulate partition: disconnect 1 node from other 2 -> partition heuristic fires -> no bans

### Property-based tests (proptest)

Use `proptest` (lighter than cargo-fuzz, no separate infrastructure needed):

- Arbitrary message sizes -> codec rejects oversized, scorer tracks
- Arbitrary PeerIds in proposals -> leader check rejects all non-leaders
- Arbitrary message content for same (peer, cycle, phase) -> equivocation detector catches
- Random score sequences -> score never goes below minimum or above maximum

---

## Startup Script Changes (P2P)

All new CLI flags must be threaded into both `start.sh` and `scripts/start-issuers.sh`.

### New CLI flags

| Flag | Default | Purpose |
|------|---------|---------|
| `--wal-path <PATH>` | `./consensus-{node_id}.wal` | Per-issuer WAL file path |
| `--wal-sync-mode <MODE>` | auto (`none` if cycle <500ms, else `fdatasync`) | WAL durability |
| `--skip-wal-replay` | false | Emergency bypass for corrupt WAL |
| `--p2p-rate-limit <N>` | 100 | Messages per second per peer |
| `--p2p-rate-burst <N>` | 100 | Max burst size |
| `--p2p-max-per-ip <N>` | 2 (loopback exempt) | Max connections per IP (0 = unlimited) |

### start.sh changes

In the issuer launch loop (line ~816):

```bash
ISSUER_ARGS="$ISSUER_ARGS --wal-path logs/consensus-$i.wal"
# WAL sync mode auto-detects from cycle-duration-ms, no flag needed
```

Using `logs/` directory (already created by start.sh) keeps WAL files alongside log files and out of the repo root.

### start-issuers.sh changes

Add to each issuer invocation:

```bash
    --wal-path logs/consensus-1.wal \
```

(Similarly for issuers 2 and 3.)

### vital-e2e-test.sh

No changes needed — it calls `start-issuers.sh` which inherits the WAL flags.

---

## Rollback Strategy (P2P)

If the hardening features break consensus:

### Quick disable (no rebuild)

All features are gated by their effects, not by feature flags. But they can be neutralized:

1. **Rate limiting**: Set `--p2p-rate-limit 999999` (effectively unlimited)
2. **Connection limits**: Set `--p2p-max-per-ip 0` (unlimited)
3. **Peer scoring**: Banning only triggers at score < -50 after sustained misbehavior. Under normal operation, scores never go negative. If they do, the partition heuristic at >33% prevents mass banning.
4. **Leader check**: Permissive when registry is empty or peer is unknown. Only rejects when registry is populated AND peer is identified AND peer doesn't match.
5. **WAL**: Set `--skip-wal-replay` or delete WAL files. WAL append failures log but don't crash.

### Full revert (rebuild)

```bash
git revert <hardening-commits>
cargo build --release -p issuer
```

The P2PTransport trait is unchanged. No wire protocol changes. No storage migrations. A reverted binary is fully compatible with the network.

### Incremental rollout

Deploy to 1 issuer first. Monitor for:
- `INFRA-020` through `INFRA-023` error codes (unexpected triggers)
- `CONSENSUS-020` / `CONSENSUS-021` (false positives)
- Cycle success rate (should stay at ~100%)
- WAL file growth (should stay <1MB)

If clean after 24h, deploy to remaining issuers in batches of 3-5.

---

## Deployment Ceremony (Part A, Phase 2+3)

**Pre-requisites**: Phase -1 deployed and verified. Phase 0 deployed. Phase 1 deployed.

**Happy path**:
1. Admin calls `IssuerRegistry.setConsensusPaused(true)` — one on-chain tx
2. Wait for all nodes to stop cycling (poll `/health`, expect "paused" status)
3. **Snapshot proxy storage for rollback**: Record current Investment proxy storage values for CollateralRegistry, AssetPairRegistry addresses (these will be overwritten in step 4). Pre-compute all rollback transactions.
4. Upgrade contracts via UUPS proxy: IssuerRegistry, MirrorIssuerRegistry, Investment, BLSCustody, ArbBridgeCustody, L3BridgeCustody, FeeRegistry, BridgeProxy
5. Redeploy immutable contracts: ITPNAVOracle, Vision, CollateralRegistry, AssetPairRegistry.
   - Re-register ITPNAVOracle in Morpho market
   - Update references in Investment, BridgeOrchestrator config, all deployment JSONs
   - Restart curator with new ITPNAVOracle address
   - Run address checklist (grep old addresses, verify zero matches)
6. **Seed initial snapshot**: Admin calls `IssuerRegistry.setAggregatedPubkey(currentPubkey, 1)` to write the bootstrap `RegistrySnapshot`. Without this, `getSnapshotAtNonce()` returns empty data and the first `_verifyBLS` call after unpause will revert (zero pubkey).
7. Upload new issuer binary to all 20 nodes via bastion
8. Restart all nodes (sequential is fine — they won't cycle while paused)
9. Wait for all `/ready` endpoints to return 200
10. Admin calls `IssuerRegistry.setConsensusPaused(false)`
11. Monitor first 10 rounds for success

**Rollback** (if step 11 fails):
1. `setConsensusPaused(true)`
2. Deploy previous implementations via UUPS proxy
3. **Restore proxy storage**: Write back the snapshotted storage values (step 3 of happy path) for registry addresses in Investment proxy. Rolling back the implementation does NOT restore storage — the old implementation will read the new (now dead) addresses from storage unless explicitly restored.
4. Redeploy previous immutable contracts (old code at NEW addresses — these are different from the originals). Since step 3 restored storage to the original addresses, the old implementations read the correct original addresses, not the step-4 rollback addresses. **Alternatively**: skip redeploying immutable contracts entirely — the originals still exist at their original addresses, and step 3 restored storage to point to them.
5. Restart curator with original ITPNAVOracle address
6. Restart nodes with previous binary
7. `setConsensusPaused(false)`
8. Max time budget: 30 minutes from step 1 to step 7. Pre-compute all rollback transactions as part of the ceremony prep (step 3 of happy path).

### Crash Recovery Behavior

After any crash or restart, an issuer node:
1. Loads BLS keypair from file
2. Queries on-chain registry -> builds `InMemoryKeyRegistry` with all active issuers
3. Derives `issuer_registry_index` (BLS pubkey match) and `node_index` (dense index)
4. Queries `activeIssuerCount()` -> computes threshold
5. Queries `registryNonce()` -> creates bootstrap snapshot in `VersionedKeyRegistry`
6. Constructs `LeaderElector(node_index, num_issuers)`
7. Replays WAL if current-cycle entries exist (P2P-6)
8. Starts consensus from the NEXT cycle boundary — current in-flight work is abandoned
9. `RegistrySyncHandler` begins scanning from `current_block - 86,400`, picks up any missed events

**New node joining**: Identical to crash recovery. Zero prior local state required. The node's BLS key must already be registered on-chain via `addIssuer()`.

---

## What This Doesn't Do (and why that's fine)

| Feature | Status | Rationale |
|---|---|---|
| Gossip redundancy | Not added | Full mesh at 20 nodes. If a connection drops mid-cycle, the 11/20 threshold absorbs it. |
| Noise encryption | Not added | Mutual TLS with CA verification is stronger for permissioned networks. |
| Peer exchange (PEX) | Not added | On-chain registry is the source of truth. |
| Message deduplication | Not added | No relay = no duplicate delivery. Application layer deduplicates via HashMap. |
| Partition auto-recovery | Not added | Partition heuristic alerts but doesn't heal. Manual intervention for true network splits. |
| Equivocation evidence sharing | Not added | In direct TCP, equivocation is only visible if attacker sends to the same node. Future enhancement: gossip evidence. |
| Score persistence | Not added | Scores reset on restart. Acceptable for 20-node permissioned network with on-chain identity. |
| Automated slashing | Not added | `issuerMissedCount` is advisory only. Governance must cross-reference on-chain tx history. |
| NAT traversal | Not added | All issuers on public IPs. No hole punching needed. |

---

## Revisit Trigger

Consider libp2p **only if**:
- Network grows beyond 50 issuers (full mesh becomes impractical)
- Issuers become untrusted/anonymous (need peer scoring at protocol level)
- Nodes move behind NATs (need hole punching)
- A production incident demonstrates that direct TCP is insufficient

None of these apply today.

---

## Files Modified (all items)

### Part A: Contract & Protocol Safety

| File | Items | Notes |
|------|-------|-------|
| `contracts/src/registry/IssuerRegistry.sol` | -1a, #1, #2, #3, #6, #7, #8 | `__gap` 34 -> 29 (5 slots) |
| `contracts/src/interfaces/IIssuerRegistry.sol` | -1a, #1, #2, #3, #6, #7, #8 | All changed/new signatures |
| `contracts/src/registry/MirrorIssuerRegistry.sol` | 0e, #1, #2, #8 | `__gap` 45 -> 43 |
| `contracts/src/interfaces/IMirrorIssuerRegistry.sol` | #1, #2 | New views |
| `contracts/src/libraries/BLSVerifier.sol` | #1, #3 | `_verifyBLS` gains `(referenceNonce, signersBitmask)`. **NO `__gap`** |
| `contracts/src/libraries/TypesLib.sol` | #2 | RegistrySnapshot struct |
| `contracts/src/libraries/EventsLib.sol` | -1a, #2, #3 | New events |
| `contracts/src/core/Investment.sol` | #1, #3 | 9 functions gain (referenceNonce, signersBitmask) |
| `contracts/src/core/BLSCustody.sol` | #1, #3 | 5 functions |
| `contracts/src/oracle/ITPNAVOracle.sol` | #1 | **REDEPLOY** |
| `contracts/src/custody/ArbBridgeCustody.sol` | #1, #3 | ~9 functions. Proxy upgrade |
| `contracts/src/custody/L3BridgeCustody.sol` | #1, #3 | ~7 functions. Proxy upgrade |
| `contracts/src/registry/AssetPairRegistry.sol` | #1, #3 | **REDEPLOY** (~8 functions) |
| `contracts/src/registry/CollateralRegistry.sol` | #1, #3 | **REDEPLOY** (~2 functions) |
| `contracts/src/vision/Vision.sol` | #1, #3 | **REDEPLOY** (~7 functions) |
| `contracts/src/bridge/BridgeProxy.sol` | #1, #3 | ~4 functions. Proxy upgrade |
| `contracts/src/registry/FeeRegistry.sol` | #1, #3 | ~4 functions. Proxy upgrade |
| `contracts/test/*.t.sol` | 0e | Update hash construction |
| `common/src/types/issuer.rs` | -1d | Add `id: u64` field to `Issuer` struct |
| `issuer/src/chain/reader.rs` | -1d | Switch `get_issuer_registry()` from `getIssuers()` to `getActiveIssuerEndpoints()`, populate `Issuer.id` |
| `common/src/traits/chain_reader.rs` | -1c | New ChainReader methods |
| `issuer/src/consensus/protocol.rs` | #0, #1, #3 | ConfigUpdate struct, leader verification, bitmap fix |
| `issuer/src/consensus/aggregator.rs` | #0, #3 | Delete calculate_threshold, non_signers_bitmask |
| `issuer/src/consensus/keys.rs` | #2 | VersionedKeyRegistry with pruning |
| `issuer/src/leader/election.rs` | #0 | Accept dense node_index from ConfigUpdate |
| `issuer/src/chain/events/registry_sync.rs` | #0, #1, #2 | ConfigUpdate cell, bootstrap snapshot |
| `issuer/src/chain/writer.rs` | #1, #3 | All build_*_tx gain reference_nonce + signers_bitmask |
| `issuer/src/registry_sync/mod.rs` | #0, #4 | ConfigUpdate computation, peer_id fix |
| `issuer/src/bootstrap/consensus.rs` | -1c, -1d | Chain-based key registry + indices |
| `issuer/src/bootstrap/types.rs` | -1c | generate_peer_id used consistently |
| `issuer/src/main.rs` | -1a, -1e | /ready endpoint, pause check |
| `scripts/deploy-ceremony.sh` | -1f | **NEW** — production orchestration |
| `scripts/start-issuers.sh` | -1b | Add --registry-sync flag |

### Part B: P2P Layer Hardening

| File | Action | Lines Added (est.) |
|------|--------|-------------------|
| `issuer/src/p2p/rate_limit.rs` | **New** | ~60 |
| `issuer/src/p2p/peer_scoring.rs` | **New** | ~150 |
| `issuer/src/p2p/wal.rs` | **New** | ~200 |
| `issuer/src/p2p/metrics.rs` | **New** | ~80 |
| `issuer/src/p2p/connection.rs` | Edit | ~30 (rate limit + ban check pre-decode, scorer calls) |
| `issuer/src/p2p/transport.rs` | Edit | ~40 (conn limits, scorer tick, disconnect_peer method) |
| `issuer/src/p2p/mod.rs` | Edit | ~10 (exports) |
| `issuer/src/consensus/state.rs` | Edit | ~1 (add `Hash` derive to ConsensusPhase) |
| `issuer/src/consensus/messages.rs` | Edit | ~10 (content_hash function, RejectedNonLeader variant) |
| `issuer/src/consensus/protocol.rs` | Edit | ~60 (P2P leader check, equivocation check, WAL writes, replay mode) |
| `issuer/src/bootstrap/p2p.rs` | Edit | ~15 (thread PeerScorer, WAL config) |
| `issuer/src/bootstrap/mod.rs` | Edit | ~5 (WAL path + sync mode params) |
| `issuer/src/main.rs` | Edit | ~10 (CLI flags, WAL open + replay) |
| `issuer/Cargo.toml` | Edit | ~1 (add `crc32fast`) |
| `start.sh` | Edit | ~3 (WAL path flag in issuer loop) |
| `scripts/start-issuers.sh` | Edit | ~6 (WAL path flag per issuer) |
| **Total** | | **~670 lines** |

One new dependency: `crc32fast` (leaf crate, no transitive deps, 200 lines of code). Everything else uses existing deps (`dashmap`, `sha2`, `rmp-serde`).

## UUPS Storage Gap Tracking

| Contract | Current `__gap` | Slots consumed | New `__gap` | New vars |
|----------|----------------|----------------|-------------|----------|
| IssuerRegistry | 34 | 5 | 29 | consensusPaused, lastSnapshotNonce, _nonceSnapshots, _pubkeyHashToIssuerId, issuerMissedCount |
| MirrorIssuerRegistry | 45 | 2 | 43 | lastSnapshotNonce, _pubkeyAtNonce |
| BLSVerifier | 0 | 0 | **0 (FROZEN)** | Layout locked. New state goes to IssuerRegistry. |
| InvestmentStorage | 16 | 0 | 16 | No changes |

---

## Known Limitations (accepted)

- ~5-second liveness gap after registry changes (dual-view tolerance mitigates)
- `pending_config_update` TOCTOU: rapid events drop intermediate states (final state correct)
- `MirrorIssuerRegistry.sync()` signersBitmask unvalidated (documented)
- `BLSVerifier` storage layout frozen at 1 slot forever (or until explicit per-child gap migration)
- `incrementMissedCounts()` is public — advisory only, NEVER for automated slashing
- `SnapshotPending` full state machine deferred — v5 logs WARNING only, does not auto-pause
- Mid-round crash loses current cycle's in-flight signatures — next cycle starts fresh (standard BFT)
- Historical `VersionedKeyRegistry` snapshots lost on restart — only latest rebuilt, sufficient for new rounds
- Malicious leader can under-report signersBitmask — detectable, bounded griefing (see P2)
- P2P peer scores reset on restart — acceptable for 20-node permissioned network
- P2P equivocation detection memory-only — resets on restart, best-effort
- WAL is best-effort — not required for correctness (statelessness contract guarantees recovery from chain)
- WAL limited to single-node recovery — no cross-node state sharing
- No NAT traversal — all issuers on public IPs

---

## Solidity Standards Checklist

- All new/modified contracts MUST include `@custom:security-contact` natspec at the top
- All new custom errors use `ContractName__ErrorName` convention (already followed above)
- All new code uses `revert` with custom errors, not `require` (already followed above)
- **Audit**: Phase 2+3 changes ~55 BLS-consuming function signatures simultaneously across 9 contracts. Get an external audit before the deployment ceremony
