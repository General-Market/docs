# Story 2.13: IssuerRegistry.sol - Key Rotation

Status: done

## Story

As an **issuer**,
I want **to rotate my BLS key with approval from other issuers**,
so that **I can recover from key compromise or upgrade hardware while maintaining network integrity**.

## Acceptance Criteria

1. **Given** IssuerRegistry.sol from Story 2.12 with rotation stubs
   **When** I implement `requestKeyRotation(issuerId, newPubkey, signatureWithOldKey)`
   **Then** a rotation request is created with requestedAt timestamp
   **And** the rotating issuer cannot self-approve their own rotation
   **And** `KeyRotationRequested` event is emitted with issuerId and newPubkey
   **And** the function validates the new pubkey is on curve and correct length (64 bytes)

2. **Given** a pending rotation request
   **When** `approveRotation(rotatingIssuerId, approvingIssuerId, approverSignature)` is called
   **Then** the approving issuer's approval is recorded (prevents double-approve)
   **And** approvalCount is incremented
   **And** `KeyRotationApproved` event is emitted with rotatingIssuerId, approvingIssuerId, approvalCount
   **And** rotating issuer cannot approve their own rotation (self-approval blocked)
   **And** last approval timestamp is recorded for safe period check

3. **Given** a rotation with 10/19 approvals (ROTATION_THRESHOLD)
   **When** the 24h timelock (ROTATION_TIMELOCK) has passed
   **And** the safe period (SAFE_PERIOD = 1 hour since last approval) has elapsed
   **Then** `executeRotation(issuerId)` succeeds
   **And** the old BLS key is removed from aggregatedPubkey via ecNegate + ecAdd
   **And** the new BLS key is added to aggregatedPubkey via ecAdd
   **And** the issuer's blsPubkey is updated in storage
   **And** `KeyRotationExecuted` event is emitted with issuerId, oldPubkey, newPubkey
   **And** the rotation request is marked as executed

4. **Given** the safe period check
   **When** `executeRotation` is called within 1 hour of last approval
   **Then** the transaction reverts with `SafePeriodNotElapsed`
   **And** this prevents rushing rotations or signature invalidation mid-batch

5. **Given** a rotation stuck for 48 hours (ADMIN_FORCE_WINDOW)
   **When** admin calls `forceRotationWindow(issuerId)`
   **Then** the safe period check is bypassed for this rotation
   **And** `RotationWindowForced` event is emitted
   **And** execution can proceed immediately after force

6. **Given** a pending rotation request already exists for an issuer
   **When** a second rotation is requested for the same issuer
   **Then** the transaction reverts with `RotationAlreadyPending`

7. **Given** BLS signature verification limitation
   **When** implementing rotation functions
   **Then** OPTION A (RECOMMENDED): Implement verification using the existing signature + message pattern but verify against individual issuer's pubkey (not aggregated)
   **Or** OPTION B: Admin-only rotation with BLS verification deferred
   **See** Dev Notes for detailed options

8. **Given** all rotation functions implemented
   **When** Foundry tests are run
   **Then** full rotation flow is tested: request → approve (10 issuers) → wait timelock → execute
   **And** edge cases tested: self-approval blocked, double-approval blocked, timelock enforced, safe period enforced
   **And** admin force window tested
   **And** `forge test --match-contract IssuerRegistryTest` passes

## Tasks / Subtasks

- [x] Task 1: Add grace period storage and constants (AC: 3)
  - [x] 1.1: Add `uint256 public constant GRACE_PERIOD_CYCLES = 10` constant
  - [x] 1.2: Add `mapping(bytes32 => uint256) private _keyGracePeriod` for old key grace tracking
  - [x] 1.3: Add `uint256 private _currentCycle` for cycle tracking (updated externally)
  - [x] 1.4: Add `mapping(uint256 => bool) private _forceWindowEnabled` for admin force tracking

- [x] Task 2: Implement requestKeyRotation (AC: 1, 6)
  - [x] 2.1: Validate `issuerId` exists and is active
  - [x] 2.2: Validate `newPubkey.length == 64` (G1 point)
  - [x] 2.3: Validate new pubkey is on curve via `BLSLib.isOnCurve()`
  - [x] 2.4: Check no pending rotation exists: `require(_pendingRotations[issuerId].requestedAt == 0)`
  - [x] 2.5: **SIGNATURE VERIFICATION DECISION** - Implemented Option B (Admin-only) per Dev Notes recommendation
  - [x] 2.6: Create `KeyRotation` struct: `{issuerId, newPubkey, block.timestamp, 0, false}`
  - [x] 2.7: Store in `_pendingRotations[issuerId]`
  - [x] 2.8: Emit `KeyRotationRequested(issuerId, newPubkey)`

- [x] Task 3: Implement approveRotation (AC: 2, 4)
  - [x] 3.1: Validate rotation exists: `_pendingRotations[rotatingIssuerId].requestedAt != 0`
  - [x] 3.2: Validate rotation not already executed
  - [x] 3.3: Validate approving issuer exists and is active
  - [x] 3.4: Block self-approval: `require(rotatingIssuerId != approvingIssuerId, "SelfApprovalNotAllowed")`
  - [x] 3.5: Block double-approval: `require(!_rotationApprovals[rotatingIssuerId][approvingIssuerId])`
  - [x] 3.6: **SIGNATURE VERIFICATION** - Deferred (Option B admin-only, signature verified off-chain)
  - [x] 3.7: Mark approval: `_rotationApprovals[rotatingIssuerId][approvingIssuerId] = true`
  - [x] 3.8: Increment approval count: `_pendingRotations[rotatingIssuerId].approvalCount++`
  - [x] 3.9: Update last approval time: `_lastApprovalTime[rotatingIssuerId] = block.timestamp`
  - [x] 3.10: Emit `KeyRotationApproved(rotatingIssuerId, approvingIssuerId, approvalCount)`

- [x] Task 4: Implement executeRotation (AC: 3, 4)
  - [x] 4.1: Validate rotation exists and not executed
  - [x] 4.2: Check approval threshold: `require(approvalCount >= ROTATION_THRESHOLD)`
  - [x] 4.3: Check timelock: `require(block.timestamp >= requestedAt + ROTATION_TIMELOCK)`
  - [x] 4.4: Check safe period (unless force window enabled): `require(block.timestamp >= _lastApprovalTime[issuerId] + SAFE_PERIOD || _forceWindowEnabled[issuerId])`
  - [x] 4.5: Get old pubkey from issuer storage
  - [x] 4.6: Update aggregated key: `_aggregatedPubkey = ecAdd(_aggregatedPubkey, ecNegate(oldPubkey))`
  - [x] 4.7: Update aggregated key: `_aggregatedPubkey = ecAdd(_aggregatedPubkey, newPubkey)`
  - [x] 4.8: Update issuer storage: `_issuers[issuerId].blsPubkey = newPubkey`
  - [x] 4.9: Mark rotation executed: `_pendingRotations[issuerId].executed = true`
  - [x] 4.10: Optionally set grace period: `_keyGracePeriod[keccak256(oldPubkey)] = _currentCycle + GRACE_PERIOD_CYCLES`
  - [x] 4.11: Clear force window if set: `_forceWindowEnabled[issuerId] = false`
  - [x] 4.12: Emit `KeyRotationExecuted(issuerId, oldPubkey, newPubkey)`

- [x] Task 5: Implement forceRotationWindow (AC: 5)
  - [x] 5.1: Restrict to admin: `onlyAdmin` modifier
  - [x] 5.2: Validate rotation exists and not executed
  - [x] 5.3: Check 48h window: `require(block.timestamp >= requestedAt + ADMIN_FORCE_WINDOW)`
  - [x] 5.4: Enable force window: `_forceWindowEnabled[issuerId] = true`
  - [x] 5.5: Emit `RotationWindowForced(issuerId)`

- [x] Task 6: Add helper functions (AC: 3, 7)
  - [x] 6.1: Implement `isKeyInGracePeriod(bytes memory pubkey)` view function
  - [x] 6.2: Implement `updateCurrentCycle(uint256 cycle)` (callable by Index contract or admin)
  - [x] 6.3: Update `canExecuteRotation()` to check all conditions properly

- [x] Task 7: Add cancelRotation function (optional but useful)
  - [x] 7.1: Allow admin to cancel pending rotation (simplified from issuer OR admin)
  - [x] 7.2: Clear `_pendingRotations[issuerId]`
  - [x] 7.3: Clear related state (_lastApprovalTime, _forceWindowEnabled)
  - [x] 7.4: Emit `KeyRotationCancelled(issuerId)`

- [x] Task 8: Write Foundry tests (AC: 8)
  - [x] 8.1: Test full rotation flow: request → 10 approvals → execute
  - [x] 8.2: Test self-approval blocked
  - [x] 8.3: Test double-approval blocked
  - [x] 8.4: Test timelock enforcement (24h)
  - [x] 8.5: Test safe period enforcement (1h since last approval)
  - [x] 8.6: Test admin force window after 48h
  - [x] 8.7: Test aggregated pubkey correctly updated after rotation
  - [x] 8.8: Test rotation already pending rejection
  - [x] 8.9: Test canExecuteRotation view function
  - [x] 8.10: Test grace period tracking (if implemented)
  - [x] 8.11: All tests pass with `forge test --match-contract IssuerRegistryTest`

## Dev Notes

### BLS Signature Verification Architecture Challenge

**CRITICAL DECISION REQUIRED:** Story 2.12 identified that `BLSLib.verifyBLS` expects G2 pubkeys (128 bytes) but IssuerRegistry stores G1 pubkeys (64 bytes) for on-chain aggregation via ecAdd precompile.

**Three implementation options:**

#### Option A: Individual G2 Pubkey Storage (RECOMMENDED)
Store both G1 (for aggregation) and G2 (for verification) pubkeys per issuer:

```solidity
struct Issuer {
    address addr;
    bytes32 ip;
    bytes blsPubkey;      // G1 pubkey (64 bytes) for aggregation
    bytes blsG2Pubkey;    // G2 pubkey (128 bytes) for verification - NEW
    uint256 status;
    uint256 registeredAt;
}
```

Pros: Clean separation, full BLS verification capability
Cons: Larger storage per issuer (+128 bytes), requires updating addIssuer

**If choosing Option A:**
- Update `TypesLib.Issuer` to include `blsG2Pubkey`
- Update `addIssuer` to accept both G1 and G2 pubkeys
- Use G2 pubkey for signature verification in rotation functions

#### Option B: Admin-Only Rotation (SIMPLEST)
Make rotation functions admin-only, deferring BLS verification:

```solidity
function requestKeyRotation(uint256 issuerId, bytes calldata newPubkey) external onlyAdmin {
    // Admin trusted to verify off-chain
}

function approveRotation(uint256 rotatingIssuerId, uint256 approvingIssuerId) external onlyAdmin {
    // Admin collects approvals off-chain, records on-chain
}
```

Pros: Simplest implementation, ships faster
Cons: Less decentralized, relies on admin honesty

#### Option C: Off-Chain Signature Aggregation
Keep G1-only storage, aggregate signatures off-chain, verify aggregated signature:

Pros: No storage changes
Cons: Complex aggregation logic, doesn't fit current individual approval model

**RECOMMENDATION:** Start with Option B (admin-only) to ship quickly, then upgrade to Option A in a later story when G2 storage is added.

### Architecture Reference (Section 17)

From architecture.md:

```
ISSUER KEY ROTATION (WITH SAFE PERIOD)

ROTATION FLOW:
1. Issuer #7 suspects key compromise
2. Issuer #7 generates NEW keypair offline
3. Issuer #7 signs rotation request with OLD key
4. Submit requestKeyRotation(issuerId, newPubkey, signatureWithOldKey)
5. 10/19 OTHER issuers approve (prevents rogue rotation)
6. After 24h timelock + safe period:
   - Execute rotation
   - Old key valid for 10 more cycles (grace period)

SAFE PERIOD CHECK:
Rotation only executes when:
- Previous cycle confirmed (no pending batches)
- No settlements in flight
- 1 hour since last approval

GRACE PERIOD:
- Old key remains valid for 10 cycles after rotation
- Allows in-flight signatures to complete
- After grace period: old key fully invalidated

SECURITY:
- Rotating issuer CANNOT approve their own rotation
- 10/19 threshold prevents single issuer from hijacking
- 24h timelock allows time to detect malicious rotations
- Safe period prevents signature invalidation mid-batch
```

### Current Storage Layout

From IssuerRegistry.sol (Story 2.12):

```solidity
IGovernance private _governance;                          // Slot 0
mapping(uint256 => TypesLib.Issuer) private _issuers;     // Slot 1
uint256 private _issuerCount;                             // Slot 2
uint256 private _activeCount;                             // Slot 3
uint256[2] private _aggregatedPubkey;                     // Slot 4-5
mapping(uint256 => TypesLib.KeyRotation) private _pendingRotations;  // Slot 6
mapping(uint256 => mapping(uint256 => bool)) private _rotationApprovals;  // Slot 7
mapping(uint256 => uint256) private _lastApprovalTime;    // Slot 8
uint256[40] private __gap;                                // Slots 9-48
```

**New storage needed for this story:**
- `mapping(bytes32 => uint256) private _keyGracePeriod` - Track grace period expiry cycle
- `mapping(uint256 => bool) private _forceWindowEnabled` - Track admin force window
- `uint256 private _currentCycle` - Current cycle number (optional, may be read from Index)

### KeyRotation Struct (from TypesLib)

```solidity
struct KeyRotation {
    uint256 issuerId;
    bytes newPubkey;
    uint256 requestedAt;
    uint256 approvalCount;
    bool executed;
}
```

### Interface Events to Emit

```solidity
event KeyRotationRequested(uint256 indexed issuerId, bytes newPubkey);
event KeyRotationApproved(uint256 indexed rotatingIssuerId, uint256 indexed approvingIssuerId, uint256 approvalCount);
event KeyRotationExecuted(uint256 indexed issuerId, bytes oldPubkey, bytes newPubkey);
event RotationWindowForced(uint256 indexed issuerId);
```

### Constants (already in IssuerRegistry.sol)

```solidity
uint256 public constant ROTATION_THRESHOLD = 10;      // 10/19 approvals
uint256 public constant ROTATION_TIMELOCK = 24 hours; // Wait period after request
uint256 public constant SAFE_PERIOD = 1 hours;        // Time since last approval
uint256 public constant ADMIN_FORCE_WINDOW = 48 hours; // Admin escape hatch
```

### Test Scenarios

1. **Happy Path**: Request → 10 unique approvals → Wait 25h → Execute → Verify agg key updated
2. **Self-Approval Block**: Issuer 5 requests, Issuer 5 tries to approve → Revert
3. **Double-Approval Block**: Issuer 6 approves twice → Second reverts
4. **Timelock Check**: Execute at 23h → Revert, Execute at 25h → Success
5. **Safe Period Check**: Last approval at T, execute at T+30min → Revert, T+2h → Success
6. **Admin Force**: Stuck 49h, admin forces → Execute succeeds immediately
7. **Already Pending**: Second request for same issuer → Revert
8. **Aggregated Key Math**: Verify old key subtracted, new key added correctly

### Project Structure Notes

```
contracts/
├── src/
│   └── registry/
│       └── IssuerRegistry.sol  # MODIFY - Complete rotation functions
├── test/
│   └── IssuerRegistry.t.sol    # MODIFY - Add rotation tests
```

### References

- [Source: architecture.md#17-issuer-key-management] - Key rotation specification
- [Source: contracts/src/registry/IssuerRegistry.sol] - Existing implementation with stubs
- [Source: contracts/src/libraries/BLSLib.sol] - BLS operations (verifyBLS expects G2)
- [Source: contracts/src/libraries/TypesLib.sol] - KeyRotation struct
- [Source: contracts/src/interfaces/IIssuerRegistry.sol] - Interface definition
- [Source: _bmad-output/implementation-artifacts/2-12-issuer-registry-core.md] - Previous story context

### Previous Story Intelligence

From Story 2-12:
- IssuerRegistry uses `IGovernance` reference instead of storing `_admin` directly
- Issuer IDs are 0-indexed
- Aggregated pubkey stored as `uint256[2]` fixed array
- **BLS verification issue documented**: G1 vs G2 pubkey mismatch identified
- All rotation functions currently revert with `BLSVerificationNotYetSupported`
- 44 tests passing for core functionality

### Git Intelligence Summary

Recent commits (d1fc425, 81e8cce, d21d866):
- Project actively progressing through Story 5.x implementations
- Foundry framework patterns well established
- TypesLib and BLSLib stable and available

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A - Implementation proceeded without blockers.

### Completion Notes List

- **Implementation Approach**: Followed Option B (Admin-Only) as recommended in Dev Notes. This defers on-chain BLS signature verification while maintaining the full rotation workflow semantics. Admin is trusted to verify signatures off-chain before submitting transactions.

- **Key Design Decisions**:
  1. `requestKeyRotation` - Admin-only, signature parameter ignored but kept in interface for future compatibility
  2. `approveRotation` - Admin-only, records approvals on-chain that were verified off-chain
  3. `executeRotation` - Callable by anyone once all conditions are met (threshold, timelock, safe period)
  4. `forceRotationWindow` - Admin escape hatch after 48h stuck period
  5. `cancelRotation` - Admin-only, clears rotation state to allow fresh rotation request

- **Security Properties Maintained**:
  - 10/19 approval threshold enforced
  - 24h timelock enforced
  - 1h safe period since last approval enforced
  - Self-approval blocked
  - Double-approval blocked
  - Aggregated pubkey correctly updated (subtract old, add new)
  - Grace period tracking for old keys (10 cycles)

- **New Errors Added**:
  - `RotationAlreadyExecuted(uint256 issuerId)` - For clearer error messages
  - `PubkeyNotOnCurve()` - Specific to pubkey validation in rotation

- **Test Coverage**: 77 tests total, including 39 new rotation-specific tests covering all acceptance criteria and edge cases.

### File List

**Modified:**
- `contracts/src/registry/IssuerRegistry.sol` - Complete key rotation implementation (Tasks 1-7) + review fixes
- `contracts/src/interfaces/IIssuerRegistry.sol` - Added cancelRotation function and KeyRotationCancelled event
- `contracts/src/mocks/MockIssuerRegistry.sol` - Updated approval tracking and added cancelRotation
- `contracts/test/IssuerRegistry.t.sol` - 39 new tests for key rotation (Task 8 + review fixes)

### Change Log

- 2026-01-30: Story 2.13 implementation complete - Key rotation with admin-only BLS verification (Option B). 75 tests passing, all acceptance criteria satisfied.
- 2026-01-30: **Senior Developer Review (AI)** - Found and fixed 2 HIGH, 4 MEDIUM, 2 LOW issues. 77 tests passing.

### Senior Developer Review (AI)

**Reviewer:** Claude Opus 4.5
**Date:** 2026-01-30
**Outcome:** ✅ APPROVED (after fixes applied)

**Issues Found and Fixed:**

| Severity | Issue | Fix Applied |
|----------|-------|-------------|
| HIGH | Approval state not cleared after cancel - old approvals carried over to new rotations | Changed `_rotationApprovals` from `bool` to `uint256` (timestamp). Approvals only valid if timestamp >= rotation.requestedAt |
| HIGH | No validation for same pubkey rotation | Added `SamePubkey` error and validation in `requestKeyRotation` |
| MEDIUM | Safe period implementation deviates from architecture spec | Added TODO comment - intentional simplification for Story 2.13 Option B |
| MEDIUM | Interface incomplete - missing cancelRotation and event | Added `cancelRotation()` and `KeyRotationCancelled` event to interface |
| MEDIUM | Approval state not cleared after execution | Fixed by timestamp-based approval tracking (same fix as HIGH-1) |
| MEDIUM | Missing test for approval carryover bug | Added `test_cancelRotation_approvalsDoNotCarryOver()` |
| LOW | Constant naming inconsistency | Renamed `GRACE_PERIOD_CYCLES` to `ROTATION_GRACE_CYCLES` |
| LOW | Event declaration location | Moved `KeyRotationCancelled` to interface |

**Security Verification:**
- ✅ Approval carryover attack vector eliminated
- ✅ Same-pubkey no-op rotation blocked
- ✅ Interface now complete and composable
- ✅ Mock contract updated for consistency
- ✅ All 77 tests passing
