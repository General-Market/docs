# Normalize Oracle Processing — Security Audit

3 independent cynical researchers audited Phase 1 (done) + Phase 2 (planned) of the normalize-oracle-processing refactor. 31 raw findings, 30 unique after dedup.

**Status key:** OPEN / FIXED

---

## CRITICAL

### C1. Shared `self.state` / `self.aggregator` corrupted by concurrent consensus rounds [OPEN]

**Files:** `protocol.rs:641-646`, `protocol.rs:729-733`, `main.rs:741,907`
**Researchers:** R1-F1, R2-F1

`run_price_cycle` and bridge tasks (L3-native `run_cycle`, `run_batch_confirm_phase`) share the same `Arc<ConsensusProtocol>`. Both call `state.start_round()` + `aggregator.reset()`. If price task resets mid-bridge-consensus:
- Follower sees wrong `cycle_number` from price round instead of bridge round
- Equivocation detector keys on wrong cycle/phase, misses Byzantine messages
- WAL records wrong cycle, corrupting crash recovery
- Aggregator is wiped mid-signature-collection

**Fix:** Give `run_price_cycle` its own dedicated `PriceConsensusState` + `PriceAggregator`. Bridge consensus already uses `BridgeOrchestrator`'s own `SignatureCollector` maps — the problem is only with the shared `self.state`/`self.aggregator` that the message handler reads.

---

### C2. Task panic permanently disables that task type [OPEN]

**File:** `main.rs:731-744` (pattern repeated for all 6 tasks)
**Researcher:** R1-F2

```rust
tokio::spawn(async move {
    run_price_update(...).await;
    flag.store(false, Ordering::Relaxed);  // never runs if panic
});
```

If any spawned task panics, `flag.store(false)` is never reached. The `AtomicBool` stays `true` forever. That task type is permanently dead.

**Fix:**
```rust
struct FlagGuard(Arc<AtomicBool>);
impl Drop for FlagGuard {
    fn drop(&mut self) { self.0.store(false, Ordering::Release); }
}
// In every spawn:
let _guard = FlagGuard(flag);
```

---

### C3. ITPNAVOracle uses single-pairing BLS (requires ALL oracles), incompatible with threshold subset signing [OPEN]

**File:** `ITPNAVOracle.sol:90-101`
**Researcher:** R3-F1

Oracle calls `BLSLib.verifyBLS(aggPubkey, messageHash, blsSignature)` — single-pairing against the FULL aggregated key. This requires ALL oracles to sign. If even one is offline, `updatePrice()` always reverts.

Rest of the system (BridgeProxy, ArbBridgeCustody, Investment) uses `BLSVerifier._verifyBLS()` with multi-pairing + threshold. These are fundamentally incompatible verification models.

**Fix:** Make `ITPNAVOracle` inherit `BLSVerifier` and use multi-pairing verification with threshold from `MirrorOracleRegistry` (which needs to store individual pubkeys, not just the aggregate).

---

## HIGH

### H1. `run_follower_protocol` cannot distinguish price-only vs batch rounds [OPEN]

**File:** `protocol.rs:1117-1187`
**Researcher:** R2-F2

Both `run_price_cycle` and `run_cycle` delegate to the same `run_follower_protocol`. A malicious leader can send a `PriceProposal` then a `BatchProposal` for the same cycle. Followers in price-only mode will process both — signing a batch that shouldn't exist for this round type. Also wastes 450ms on batch timeouts in price-only cycles.

**Fix:** Create `run_follower_protocol_price_only` that rejects `BatchProposal` messages.

---

### H2. Dummy BLS signature returned by `run_price_cycle` on success [OPEN]

**File:** `protocol.rs:693-697`
**Researcher:** R2-F3

```rust
ConsensusResult::Success {
    aggregated_signature: BLSSignature(vec![0; 64]),
    signer_count: 0,
    cycle_number,
}
```

Phase 2 will connect this to oracle submission. If connected before the real signature is wired, zero signature goes on-chain, tx reverts, prices stop updating.

**Fix:** Return `ConsensusResult::PriceOnly { cycle_number }` — a distinct variant that forces callers to handle it explicitly.

---

### H3. Equivocation detector keys on shared `ConsensusPhase`, misses concurrent-round equivocation [OPEN]

**File:** `equivocation.rs:15-18`, `protocol.rs:1203-1222`
**Researcher:** R2-F4

`DetectorKey = (PeerId, cycle, ConsensusPhase, msg_tag)`. Phase is read from `self.state` which is the SHARED state. A Byzantine node sends two conflicting `ConfirmBatchSign` messages — one arrives during `PriceVoting`, the other during `BatchProposal`. Different keys → equivocation undetected.

**Fix:** Use message's own cycle number + a fixed "neutral" phase for bridge messages, not `self.state`'s phase.

---

### H4. `local_nav_fallback` races with concurrent price update [OPEN]

**File:** `main.rs:750-808`
**Researcher:** R1-F4

NAV is computed inline AFTER price task is already spawned (line 741). Price task is fetching new prices from Bitget while the inline computation also calls `price_fetcher.fetch_prices()`. If prices move between calls, NAV is stale. This stale NAV is passed to buy/sell/L3-native tasks for fill computation.

**Fix:** Compute NAV BEFORE spawning price task (so both use same snapshot), or have price task publish agreed NAV via `tokio::watch::Sender<U256>` for order tasks to subscribe to.

---

### H5. Watchdog resets orders being actively processed by concurrent tasks [OPEN]

**File:** `main.rs:941-981`
**Researcher:** R1-F5

Watchdog runs inline in main loop, drops read lock, re-acquires, calls `reset_stale_order()`. Between drop and re-acquire, buy task can advance order from `Pending` to `BridgedToL3`. Watchdog then resets it back. ArbitrumReader dedup is also cleared (line 969) → order detected as new next cycle → double processing → double mint.

**Fix:** Add `last_touched: Instant` to order status. Only reset orders older than 60s. Or check `buy_active`/`sell_active` before resetting.

---

### H6. `send_transaction` bypasses NonceManager — nonce collisions [OPEN]

**File:** `writer.rs:572-624`
**Researcher:** R1-F6

`ChainWriter` trait `send_transaction()` calls `self.client.send_transaction()` directly, bypassing the `NonceManager`. Two concurrent tasks calling `send_transaction` get the same nonce from the node → one reverts. `submit_tx()` properly uses `NonceManager`, but `send_transaction()` doesn't.

**Fix:** Route `send_transaction()` through `submit_tx()`:
```rust
async fn send_transaction(&self, to, calldata, value) -> Result<TxHash> {
    let tx = Eip1559TransactionRequest::new().to(to).data(calldata).value(value).into();
    self.submit_tx(tx, "send_transaction").await
}
```

---

### H7. Fragile Rust/Solidity encoding parity for `abi.encodePacked` [OPEN]

**File:** `ITPNAVOracle.sol:91`, `nav_sign.rs:317-347`
**Researcher:** R3-F2

Rust encodes `timestamp` (u64) and `cycle_number` (u64) as 32-byte U256. Solidity `abi.encodePacked(uint256)` also 32 bytes. Works today but if anyone refactors Rust to use native u64 widths (8 bytes), hash silently breaks. No test enforces parity.

**Fix:** Switch Solidity to `abi.encode` (always 32-byte padded, self-describing). Add cross-language hash parity test.

---

### H8. MirrorOracleRegistry `sync()` requires ALL oracles (no subset support) [OPEN]

**File:** `MirrorOracleRegistry.sol:137-146`
**Researcher:** R3-F3

Same single-pairing problem as C3. If one oracle goes permanently offline, key rotation on MirrorOracleRegistry is impossible. Registry frozen → oracle frozen → Morpho frozen.

**Fix:** Store individual pubkeys, use multi-pairing verification with threshold.

---

### H9. No price deviation bounds in ITPNAVOracle [OPEN]

**File:** `ITPNAVOracle.sol:78-106`
**Researcher:** R3-F4

Oracle accepts any non-zero `newPrice`. A malicious quorum can push `price = 1e50`, borrow max USDC against inflated ITP collateral in Morpho, extract funds. Price corrected next cycle but bad debt remains.

**Fix:** Add `MAX_DEVIATION_BPS` (e.g., 1000 = 10%):
```solidity
uint256 deviation = newPrice > currentPrice
    ? ((newPrice - currentPrice) * 10000) / currentPrice
    : ((currentPrice - newPrice) * 10000) / currentPrice;
if (deviation > MAX_DEVIATION_BPS) revert PriceDeviationTooHigh();
```

---

## MEDIUM

### M1. `Ordering::Relaxed` on AtomicBool flags — ARM reordering [OPEN]

**File:** `main.rs:731-744`
**Researcher:** R1-F3

`Relaxed` doesn't guarantee writes in the spawned task are visible before the flag reads `false`. On ARM, main loop could see "task done" but read stale protocol state.

**Fix:** `Release` for store, `Acquire` for load.

---

### M2. WAL GC race — price GC deletes bridge WAL entries [OPEN]

**File:** `protocol.rs:652-658,739-745`
**Researcher:** R2-F5

Both `run_price_cycle` and `run_cycle` GC the WAL, retaining only their own `cycle_number`. Price GC with cycle 100 deletes bridge entries with cycle 500000042. Crash recovery loses bridge state.

**Fix:** Pass set of active cycles to GC, or key WAL by `(round_type, cycle_number)`.

---

### M3. Leader validation +/-1 window allows multiple valid leaders [OPEN]

**File:** `protocol.rs:558-619`
**Researcher:** R2-F6

During oracle set changes, up to 3 nodes can be valid leaders for the same cycle (under count, count-1, count+1). Byzantine node exploits this window to push manipulated prices.

**Fix:** Require quorum of votes before acting on proposal, or narrow the +/-1 window to only accept within seconds of a registry update.

---

### M4. Price disagreement softening removes circuit breaker [OPEN]

**File:** `protocol.rs:699-706`, `main.rs:1214-1216`
**Researcher:** R2-F7

Old: 3 disagreements → EmergencyPause. New: disagreement → `Failed`, try next cycle. A Byzantine node voting reject every cycle causes permanent price stall with no alert.

**Fix:** Add consecutive failure counter. After 10 failures, escalate to EmergencyPause or critical alert.

---

### M5. Phase 2 hash format migration causes consensus fork during rolling update [OPEN]

**File:** `protocol.rs:836,2542`
**Researcher:** R2-F8

During rolling deployment, updated nodes produce new-format hashes, non-updated nodes reject them. Every Nth cycle fails (where N = num_oracles).

**Fix:** Add `hash_version` field to `PriceProposal`. Leaders use old format until all nodes upgraded (verified via registry flag).

---

### M6. No `chainId`/`address(this)` in oracle hash — cross-chain replay [OPEN]

**File:** `ITPNAVOracle.sol:90-92`
**Researcher:** R3-F5

Hash is `keccak256(abi.encodePacked(itpAddress, price, timestamp, cycleNumber))`. Same ITP on two chains (same address via CREATE2) → signed price replayed cross-chain.

**Fix:** Add `block.chainid` and `address(this)` to hash.

---

### M7. Unbounded `cycleNumber` skipping can permanently freeze oracle [OPEN]

**File:** `ITPNAVOracle.sol:85-87`
**Researcher:** R3-F6

`if (cycleNumber <= lastCycleNumber) return`. A buggy/malicious push with `cycleNumber = 999999999` permanently blocks all future updates below that number.

**Fix:** Add `MAX_CYCLE_GAP` check.

---

### M8. 24h staleness reverts freeze all Morpho operations with no fallback [OPEN]

**File:** `ITPNAVOracle.sol:115-122`
**Researcher:** R3-F7

If oracles go down >24h, `price()` reverts. Morpho calls `price()` on every operation → all borrow/repay/liquidate frozen. Bad debt accumulates.

**Fix:** Longer staleness period (72h), or emergency admin price push with timelock.

---

### M9. MirrorOracleRegistry admin can upgrade unilaterally (no timelock) [OPEN]

**File:** `MirrorOracleRegistry.sol:209-215`
**Researcher:** R3-F8

`_authorizeUpgrade` only checks `msg.sender == admin`. Admin key compromise → new impl returns malicious aggregated pubkey → control all oracles → drain Morpho.

**Fix:** BLS-gated upgrade with 7-day timelock (matching ArbBridgeCustody pattern).

---

### M10. `Investment.setItpNav` has no replay protection [OPEN]

**File:** `Investment.sol:809-814`
**Researcher:** R3-F9

No timestamp, no cycleNumber, no monotonicity check. Any previously signed NAV replayed at any time. Dual-write confusion when ITPNAVOracle coexists.

**Fix:** Add `lastNavCycle` per ITP with monotonically increasing cycle numbers.

---

### M11. L3-native guard TOCTOU with buy task status writes [OPEN]

**File:** `main.rs:2521-2530`
**Researcher:** R1-F7

L3-native checks `has_any_active_bridge_orders()` before buy task has set `Pending` status → both process same order → double batch.

**Fix:** Set order status INLINE before spawning buy task, not inside the spawned task.

---

### M12. CycleManager `work_tx` signaling uses stale flag values [OPEN]

**File:** `main.rs:984-995`
**Researcher:** R1-F8

Multi-flag OR with `Relaxed` ordering → stale reads → CycleManager enters slow-poll when tasks are active (latency) or fast-poll when no tasks are active (waste).

**Fix:** `Acquire` ordering for loads, `Release` for stores. Use `watch` channel instead of `try_send`.

---

### M13. Rebalance dedup check-then-mark is non-atomic [OPEN]

**File:** `main.rs:2195-2224`
**Researcher:** R1-F9

Check `is_rebalance_in_progress` with read lock, drop lock, re-acquire, mark started. Two rapid spawns can both pass the check → double rebalance.

**Fix:** Single write lock scope for check + mark.

---

## LOW

### L1. Message buffer lacks size limit [OPEN]

**File:** `messages.rs:15,887-893`
**Researcher:** R2-F9

Future-dated messages buffered in unbounded `Vec`. Attacker sends 100k messages → memory exhaustion.

**Fix:** Max buffer size (1000), reject messages >10 cycles ahead.

---

### L2. Zeroed/temp PeerIds bypass leader verification with no expiry [OPEN]

**File:** `protocol.rs:519-533,561`
**Researcher:** R2-F10

All-zero or 0xFE/0xFF-prefixed PeerIds bypass leader checks. No timeout → indefinite bypass.

**Fix:** Expire temp PeerIds after 60 seconds. Only allow heartbeats from temp peers, not proposals.

---

### L3. Public individual signature endpoint enables permissionless aggregation [OPEN]

**File:** `nav_sign.rs:178-266`
**Researcher:** R3-F10

`/api/nav-sign` returns individual BLS signatures publicly. Any external party can aggregate and front-run legitimate leader's `updatePrice()`. Design trade-off if permissionless is desired.

---

### L4. TOFU bootstrap — `initialize()` trusts deployer for initial pubkey [OPEN]

**File:** `MirrorOracleRegistry.sol:71-99`
**Researcher:** R3-F11

No verification that initial pubkey matches L3 OracleRegistry. Deployment bug → wrong pubkey → registry permanently stuck.

**Fix:** Post-deployment cross-check via L3 cross-chain message.

---

### L5. Watchdog uses read lock for mutation [OPEN]

**File:** `main.rs:944-960`
**Researcher:** R1-F10

`reset_stale_order` through read lock (via interior mutability). Misleading, fragile pattern.

**Fix:** Use write lock for the reset phase.

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 3 |
| HIGH | 9 |
| MEDIUM | 13 |
| LOW | 5 |
| **TOTAL** | **30** |

## Priority Order

| Phase | What | Items |
|-------|------|-------|
| **Before Phase 2** | C1 (shared state), C2 (flag guard), H1 (follower split), H2 (dummy sig), H3 (equivocation), H6 (nonce bypass) | 6 items |
| **Phase 2 blockers** | C3 (oracle multi-pairing), H7 (encoding parity), H8 (mirror multi-pairing), H9 (deviation bounds), M5 (hash migration), M6 (chainId in hash) | 6 items |
| **Before mainnet** | H4 (NAV race), H5 (watchdog), M1-M4, M7-M13 | 14 items |
| **Backlog** | L1-L5 | 5 items |

## Architectural Verdict

The system has **two fundamentally incompatible BLS verification models**:

1. **BLSVerifier** (BridgeProxy, ArbBridgeCustody, Investment): Multi-pairing with individual pubkeys, threshold enforcement, liveness tracking. Mature.

2. **BLSLib.verifyBLS** (ITPNAVOracle, MirrorOracleRegistry): Single-pairing against aggregated key. No threshold, no bitmask validation, requires ALL oracles. Broken for production.

Phase 2 MUST NOT ship until the oracle/registry migrate to multi-pairing. Otherwise, a single offline oracle freezes all price updates → Morpho markets freeze → bad debt accumulates.
