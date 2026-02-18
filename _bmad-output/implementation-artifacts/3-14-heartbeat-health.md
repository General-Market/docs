# Story 3.14: Heartbeat & Health

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **issuer operator**,
I want **heartbeat monitoring between issuers**,
So that **unhealthy issuers can be detected**.

## Acceptance Criteria

1. HEARTBEAT message sent to all peers every 1 second
2. Track last_seen timestamp per peer
3. Peer marked unhealthy if no heartbeat for 5 seconds
4. `get_healthy_peers()` returns list of healthy peer IDs
5. `get_peer_health(peerId)` returns health status
6. After 3 consecutive misses, propose kick vote (logged, not auto-executed)
7. Health metrics exposed for monitoring
8. Unit tests verify health tracking and timeout detection

## Tasks / Subtasks

- [x] Task 1: Create heartbeat module structure (AC: all)
  - [x] 1.1 Create `issuer/src/heartbeat/mod.rs` module
  - [x] 1.2 Create `issuer/src/heartbeat/monitor.rs` for HeartbeatMonitor struct
  - [x] 1.3 Create `issuer/src/heartbeat/tracker.rs` for PeerHealthTracker
  - [x] 1.4 Create `issuer/src/heartbeat/types.rs` for health-related types
  - [x] 1.5 Export module from `issuer/src/lib.rs`

- [x] Task 2: Implement peer health types (AC: #3, #5)
  - [x] 2.1 Define `PeerHealthStatus` enum: `Healthy`, `Unhealthy`, `Unknown`
  - [x] 2.2 Define `PeerHealthInfo` struct:
    - `peer_id: PeerId`
    - `last_seen: Option<Instant>`
    - `status: PeerHealthStatus`
    - `consecutive_misses: u32`
    - `last_heartbeat_timestamp: u64` (from message)
  - [x] 2.3 Define constants:
    - `HEARTBEAT_INTERVAL: Duration = 1 second`
    - `UNHEALTHY_THRESHOLD: Duration = 5 seconds`
    - `KICK_VOTE_THRESHOLD: u32 = 3` (consecutive misses)
  - [x] 2.4 Implement `PeerHealthInfo::new()` and `update_from_heartbeat()`

- [x] Task 3: Implement PeerHealthTracker (AC: #2, #3, #4, #5)
  - [x] 3.1 Create `PeerHealthTracker` struct with:
    - `peers: HashMap<PeerId, PeerHealthInfo>`
    - `unhealthy_threshold: Duration`
    - `kick_vote_threshold: u32`
  - [x] 3.2 Implement `record_heartbeat(peer_id: PeerId, timestamp: u64)`
    - Update last_seen to now
    - Reset consecutive_misses to 0
    - Set status to Healthy
  - [x] 3.3 Implement `check_health() -> Vec<PeerId>` (returns unhealthy peers)
    - Iterate all peers
    - If now - last_seen > unhealthy_threshold → mark Unhealthy, increment consecutive_misses
    - Return list of unhealthy peer IDs
  - [x] 3.4 Implement `get_healthy_peers() -> Vec<PeerId>`
  - [x] 3.5 Implement `get_peer_health(peer_id) -> Option<PeerHealthInfo>`
  - [x] 3.6 Implement `get_kick_candidates() -> Vec<PeerId>` (consecutive_misses >= 3)
  - [x] 3.7 Implement `register_peer(peer_id)` for new peer discovery
  - [x] 3.8 Implement `remove_peer(peer_id)` for kicked peers

- [x] Task 4: Implement HeartbeatMonitor (AC: #1, #6, #7)
  - [x] 4.1 Create `HeartbeatMonitor<P: P2PTransport>` struct with:
    - `peer_id: PeerId` (our own ID)
    - `p2p: Arc<P>` (for broadcasting)
    - `tracker: Arc<RwLock<PeerHealthTracker>>`
    - `metrics: HeartbeatMetrics`
    - `shutdown: Arc<AtomicBool>`
  - [x] 4.2 Implement `start()` that spawns:
    - Heartbeat sender task (every 1 second)
    - Health check task (every 1 second, offset by 500ms)
  - [x] 4.3 Implement `send_heartbeat()`:
    - Build P2PMessage::Heartbeat with current timestamp
    - Broadcast to all connected peers
    - Log heartbeat sent
  - [x] 4.4 Implement `on_heartbeat_received(peer_id, timestamp)`:
    - Call tracker.record_heartbeat()
    - Update metrics
    - Log heartbeat received (DEBUG level)
  - [x] 4.5 Implement `run_health_check()`:
    - Call tracker.check_health()
    - For each unhealthy peer, log warning
    - Check kick candidates
    - For kick candidates: log WARN, emit KickVoteProposed event (do NOT auto-execute)
  - [x] 4.6 Implement `shutdown()` for graceful stop

- [x] Task 5: Implement health metrics (AC: #7)
  - [x] 5.1 Create `HeartbeatMetrics` struct with:
    - `heartbeats_sent: AtomicU64`
    - `heartbeats_received: AtomicU64`
    - `peers_healthy: AtomicU32`
    - `peers_unhealthy: AtomicU32`
    - `kick_votes_proposed: AtomicU64`
    - `last_check_time_ms: AtomicU64`
  - [x] 5.2 Implement `to_json() -> String` for health endpoint
  - [x] 5.3 Implement `increment_*()` methods for each counter
  - [x] 5.4 Implement `update_peer_counts(healthy: u32, unhealthy: u32)`

- [x] Task 6: Implement kick vote proposal (AC: #6)
  - [x] 6.1 Create `KickVoteProposal` struct:
    - `target_id: PeerId`
    - `reason: String`
    - `consecutive_misses: u32`
    - `proposed_at: Instant`
  - [x] 6.2 Implement `propose_kick(target_id, reason)`:
    - Log WARN with full details
    - Build P2PMessage::KickVote (but do NOT broadcast automatically)
    - Store proposal for admin review
    - Return proposal for potential manual execution
  - [x] 6.3 Add kick proposals to metrics
  - [x] 6.4 Add safety check: never self-kick

- [x] Task 7: Integrate with P2P message handling (AC: #1, #2)
  - [x] 7.1 Add heartbeat message handler to main message processing loop
  - [x] 7.2 Route P2PMessage::Heartbeat to HeartbeatMonitor.on_heartbeat_received()
  - [x] 7.3 Filter heartbeat messages from consensus message handler (already done in 3-12)
  - [x] 7.4 Ensure heartbeat processing doesn't block consensus

- [x] Task 8: Add comprehensive unit tests (AC: #8)
  - [x] 8.1 Test heartbeat sender sends every 1 second
  - [x] 8.2 Test record_heartbeat updates last_seen and status
  - [x] 8.3 Test peer marked unhealthy after 5 seconds without heartbeat
  - [x] 8.4 Test get_healthy_peers returns only healthy peers
  - [x] 8.5 Test get_peer_health returns correct status
  - [x] 8.6 Test 3 consecutive misses triggers kick vote proposal
  - [x] 8.7 Test kick vote NOT auto-executed (only logged)
  - [x] 8.8 Test metrics are updated correctly
  - [x] 8.9 Test new peer registration
  - [x] 8.10 Test peer removal after kick

- [x] Task 9: Wire into issuer main.rs (AC: all)
  - [x] 9.1 Add HeartbeatMonitor initialization after P2P transport
  - [x] 9.2 Start heartbeat monitor tasks
  - [x] 9.3 Route incoming heartbeat messages to monitor
  - [x] 9.4 Add heartbeat metrics to health endpoint JSON:
    - `heartbeat.sent_total`
    - `heartbeat.received_total`
    - `heartbeat.peers_healthy`
    - `heartbeat.peers_unhealthy`
    - `heartbeat.kick_proposals`
  - [x] 9.5 Update IssuerMetrics struct with heartbeat fields
  - [x] 9.6 Graceful shutdown of heartbeat tasks

## Dev Notes

### Architecture Compliance

- **Protocol**: Per architecture.md Section 4, HEARTBEAT message with 1000ms timeout
- **Detection**: 5 second threshold (5 missed heartbeats = unhealthy)
- **Kick Flow**: 3 consecutive misses → propose kick vote (logged only, not auto-executed)
- **Technology**: Rust using existing P2P transport and P2PMessage::Heartbeat type

### Existing Implementation Status

The project **already has**:
- ✅ `P2PMessage::Heartbeat { sender_id, timestamp }` in `common/src/types/p2p.rs`
- ✅ `P2PMessage::KickVote { target_id, voter_id, reason, signature }` in `common/src/types/p2p.rs`
- ✅ `TcpP2PTransport` with broadcast/send_to in `issuer/src/p2p/transport.rs` (Story 3.10)
- ✅ `ConsensusMessageHandler` that filters out HEARTBEAT messages in `issuer/src/consensus/messages.rs` (Story 3.12)
- ✅ `IssuerMetrics` struct for health endpoint in `issuer/src/main.rs`
- ✅ Health check endpoint returning JSON with node status
- ✅ `Bn254BLSSigner` for signing kick votes in `common/src/bls/signer.rs`

### What This Story Implements

This story creates the **heartbeat/health module** that:

1. **HeartbeatMonitor** - Sends heartbeats every 1 second to all peers
2. **PeerHealthTracker** - Tracks last_seen and detects unhealthy peers
3. **Health Metrics** - Exposes peer health for monitoring dashboard
4. **Kick Vote Proposals** - Logs kick vote candidates (manual admin action)

### Technical Requirements

**Heartbeat Flow:**
```
Every 1 second:
1. Send P2PMessage::Heartbeat to all peers
2. Record timestamp for sent heartbeat
3. Log at DEBUG level

On receive P2PMessage::Heartbeat:
1. Extract sender_id and timestamp
2. Update PeerHealthTracker.record_heartbeat(sender_id, timestamp)
3. Reset consecutive_misses for that peer
4. Log at DEBUG level
```

**Health Check Flow:**
```
Every 1 second (offset 500ms from heartbeat send):
1. For each known peer:
   - If now - last_seen > 5 seconds → mark Unhealthy
   - Increment consecutive_misses
2. Log WARN for each unhealthy peer
3. If consecutive_misses >= 3:
   - Log WARN: "Proposing kick vote for peer {peer_id}"
   - Build KickVoteProposal (do NOT broadcast)
   - Store for admin review
4. Update metrics: peers_healthy, peers_unhealthy
```

**Kick Vote Safety:**
```
IMPORTANT: Kick votes are NOT auto-executed!
- Only log the proposal
- Store for potential admin action
- Require explicit CLI command or admin API to actually broadcast
- This prevents accidental network splits from transient issues
```

**Thresholds (from architecture.md):**
```rust
const HEARTBEAT_INTERVAL_MS: u64 = 1000;      // 1 second
const UNHEALTHY_THRESHOLD_MS: u64 = 5000;     // 5 seconds (5 missed heartbeats)
const KICK_VOTE_THRESHOLD: u32 = 3;            // 3 consecutive health checks with miss
```

### Library/Framework Requirements

Dependencies already in workspace:
```toml
# In issuer/Cargo.toml (already present)
common = { path = "../common" }  # P2PMessage types
tokio = { workspace = true }      # async runtime, timers
tracing = { workspace = true }    # logging
```

No additional dependencies required.

### File Structure Requirements

```
issuer/
├── Cargo.toml                    # No new deps needed
└── src/
    ├── main.rs                   # Modify - add HeartbeatMonitor integration
    ├── lib.rs                    # Modify - export heartbeat module
    └── heartbeat/
        ├── mod.rs                # NEW - Module exports
        ├── monitor.rs            # NEW - HeartbeatMonitor coordinator
        ├── tracker.rs            # NEW - PeerHealthTracker
        └── types.rs              # NEW - PeerHealthStatus, PeerHealthInfo
```

### Testing Requirements

- **Unit tests**: `cargo test -p issuer --lib heartbeat`
- **Key scenarios to test**:
  - Heartbeat sender task timing
  - Health status transitions (Unknown → Healthy → Unhealthy)
  - Consecutive miss counting
  - Kick vote threshold detection
  - Metrics accuracy
  - Integration with P2P message flow

### Previous Story Intelligence

From **Story 3-10 P2P Transport**:
- `TcpP2PTransport::broadcast(P2PMessage)` sends to all connected peers
- Connection management already handles reconnection with exponential backoff
- P2PMessage::Heartbeat is used for connection identification on connect
- 19 tests passing for P2P transport

From **Story 3-12 Consensus Flow**:
- `ConsensusMessageHandler` already filters out non-consensus messages including HEARTBEAT
- Test `test_non_consensus_message_ignored` verifies HEARTBEAT is ignored by consensus
- Health endpoint already includes consensus metrics
- Main.rs already has message routing infrastructure

### Git Intelligence

Recent commits show patterns:
- Create module directory with `mod.rs` for exports
- Implement core logic in separate files (`tracker.rs`, `monitor.rs`)
- Add comprehensive tests
- Wire into main.rs last
- Update IssuerMetrics for health endpoint

### Architecture Reference (Section 4 & 21)

**P2P Message Types:**
| Message Type | Sender | Receiver | Timeout | Retry |
|--------------|--------|----------|---------|-------|
| `HEARTBEAT` | All | All | 1000ms | - |
| `KICK_VOTE` | Any | All | 500ms | 0 |

**Monitoring Thresholds (Section 21):**
| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| Issuers online | <18/20 | <14/20 | Quorum risk |

**Kick Flow (Section 15):**
1. After 3 consecutive misses → propose kick vote
2. Kick vote requires 11/20 BLS signatures
3. On kick: remove from registry, recalculate BLS aggregate key

### Project Structure Notes

- Alignment: Module in `issuer/src/heartbeat/` follows existing patterns (consensus, p2p, leader)
- Dependencies: Uses workspace dependencies, no new external crates
- Interface: HeartbeatMonitor struct with start() entry point

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#issuer-p2p-message-types] - HEARTBEAT 1000ms timeout
- [Source: _bmad-output/planning-artifacts/architecture.md#21-operations] - Issuers online thresholds
- [Source: _bmad-output/planning-artifacts/architecture.md#15-security-and-risk-management] - Kick flow after 3 strikes
- [Source: _bmad-output/planning-artifacts/epics.md#story-314-heartbeat--health] - Full acceptance criteria
- [Source: common/src/types/p2p.rs] - P2PMessage::Heartbeat and KickVote definitions
- [Source: issuer/src/p2p/transport.rs] - TcpP2PTransport broadcast implementation
- [Source: issuer/src/consensus/messages.rs] - ConsensusMessageHandler filtering heartbeats
- [Source: issuer/src/main.rs:163-220] - IssuerMetrics struct and health endpoint

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

Session: 20260201-heartbeat-impl

### Completion Notes List

- ✅ Implemented heartbeat module with 4 files: types.rs, tracker.rs, metrics.rs, monitor.rs
- ✅ All 34 unit tests passing (8 types, 12 tracker, 7 metrics, 7 monitor tests)
- ✅ HeartbeatMonitor coordinates 1s heartbeat sending and health checking
- ✅ PeerHealthTracker tracks last_seen and detects unhealthy peers (5s threshold)
- ✅ Kick vote proposals stored for admin review (NOT auto-executed)
- ✅ Self-kick protection prevents proposing kick for own peer ID
- ✅ Integrated into main.rs with P2P message routing
- ✅ Health endpoint JSON extended with heartbeat metrics
- ✅ Graceful shutdown stops heartbeat tasks with 2s timeout

### File List

- issuer/src/heartbeat/mod.rs (NEW)
- issuer/src/heartbeat/types.rs (NEW)
- issuer/src/heartbeat/tracker.rs (NEW)
- issuer/src/heartbeat/metrics.rs (NEW)
- issuer/src/heartbeat/monitor.rs (NEW)
- issuer/src/lib.rs (MODIFIED - added heartbeat module export)
- issuer/src/main.rs (MODIFIED - heartbeat integration)

## Change Log

- 2026-02-01: Story 3.14 implementation complete - heartbeat monitoring with health tracking, kick vote proposals, and metrics exposure
