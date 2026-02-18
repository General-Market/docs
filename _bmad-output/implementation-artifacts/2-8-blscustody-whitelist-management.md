# Story 2.8: BLSCustody.sol - Whitelist Management

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **issuer network**,
I want **to manage custody whitelists with timelock**,
So that **new swap targets can be added securely**.

## Acceptance Criteria

1. **`proposeWhitelist(target, blsSignature)`** queues target with 2-day timelock
   - Message format: `keccak256(abi.encode(chainid, this, "proposeWhitelist", target))`
   - Reverts if target already whitelisted or already proposed
   - Records proposal timestamp in `whitelistProposedAt[target]`
   - Emits `WhitelistProposed(target, proposedAt, activationTime)`

2. Proposal requires **11/20 BLS threshold** (standard threshold)
   - Uses `BLSLib.verifyBLS()` with aggregated public key from IssuerRegistry
   - Phase 1: Single aggregated key verification (full quorum required)

3. **`activateWhitelist(target)`** activates after timelock (anyone can call)
   - Reverts if not proposed or timelock not expired
   - Sets `_whitelisted[target] = true`
   - Records `whitelistActivatedAt[target]`
   - Clears `whitelistProposedAt[target]`
   - Emits `WhitelistActivated(target, timestamp)`

4. **`emergencyRemoveWhitelist(target, blsSignature)`** removes immediately
   - Message format: `keccak256(abi.encode(chainid, this, "emergencyRemove", target))`
   - Reverts if target not currently whitelisted
   - Sets `_whitelisted[target] = false`
   - Clears both `whitelistActivatedAt` and `whitelistProposedAt`
   - Emits `WhitelistRemoved(target, timestamp)`

5. Emergency removal requires **15/20 BLS threshold** (emergency threshold)
   - Higher threshold for security-critical operations
   - Phase 1 note: Uses same aggregated key (threshold enforcement is semantic)

6. Events emitted: `WhitelistProposed`, `WhitelistActivated`, `WhitelistRemoved`

7. Foundry tests cover:
   - Proposal flow (propose → wait → activate)
   - Timelock enforcement (cannot activate early)
   - Emergency removal (immediate effect)
   - Error cases (already proposed, not proposed, not whitelisted, etc.)
   - BLS signature verification

## Tasks / Subtasks

- [x] Task 1: Verify existing implementation covers all ACs (AC: #1-6)
  - [x] Review `BLSCustody.sol` - proposeWhitelist implementation
  - [x] Review `BLSCustody.sol` - activateWhitelist implementation
  - [x] Review `BLSCustody.sol` - emergencyRemoveWhitelist implementation
  - [x] Verify 2-day timelock constant (WHITELIST_TIMELOCK)
  - [x] Verify event emissions match AC requirements

- [x] Task 2: Review and enhance Foundry tests (AC: #7)
  - [x] Verify test coverage for propose → wait → activate flow
  - [x] Verify test coverage for timelock enforcement
  - [x] Verify test coverage for emergency removal
  - [x] Verify test coverage for error cases
  - [x] Add any missing edge case tests

- [x] Task 3: Documentation and integration verification
  - [x] Verify IBLSCustody interface matches implementation
  - [x] Verify ErrorsLib has all required error codes
  - [x] Verify EventsLib has all required events
  - [x] Run full test suite to confirm no regressions

## Dev Notes

### Implementation Status

**IMPORTANT:** The whitelist management functionality was implemented as part of Story 2-7 (BLSCustody Core Execution). This story is primarily about **verification and test enhancement** rather than new implementation.

The following functions exist in `BLSCustody.sol`:
- `proposeWhitelist(address target, bytes calldata blsSignature)` - Lines 117-146
- `activateWhitelist(address target)` - Lines 148-171
- `emergencyRemoveWhitelist(address target, bytes calldata blsSignature)` - Lines 173-202

### Architecture Reference

From architecture.md Section 5 (Custody Whitelist Management):

```
Custody Whitelist Management (FR22)
────────────────────────────────────
WHITELIST_APPROVAL_THRESHOLD = 11  // 11/20 for standard operations
EMERGENCY_REMOVAL_THRESHOLD = 15   // 15/20 for emergency removal
WHITELIST_TIMELOCK = 2 days        // 48 hours before activation
```

### BLS Message Formats

**Propose Whitelist:**
```solidity
bytes32 message = keccak256(abi.encode(
    block.chainid,      // Cross-chain replay protection
    address(this),      // Contract-specific
    "proposeWhitelist", // Function identifier
    target              // Target address
));
```

**Emergency Remove:**
```solidity
bytes32 message = keccak256(abi.encode(
    block.chainid,
    address(this),
    "emergencyRemove",
    target
));
```

### Error Codes Used

| Error | Code | Description |
|-------|------|-------------|
| `E020_InvalidBLSSignature` | E020 | BLS signature verification failed |
| `E028_WhitelistAlreadyProposed` | E028 | Target already has pending proposal |
| `E029_WhitelistNotProposed` | E029 | Cannot activate - no proposal exists |
| `E030_TimelockNotExpired` | E030 | Cannot activate - timelock still active |
| `E031_TargetAlreadyWhitelisted` | E031 | Cannot propose - already whitelisted |
| `E032_TargetNotCurrentlyWhitelisted` | E032 | Cannot remove - not currently whitelisted |

### Storage Layout

```solidity
// Whitelist state (in BLSCustody.sol)
mapping(address => bool) private _whitelisted;           // Active whitelist status
mapping(address => uint256) public whitelistProposedAt;  // Proposal timestamp (0 if none)
mapping(address => uint256) public whitelistActivatedAt; // Activation timestamp (0 if never)
```

### Threshold Verification (Phase 1 Limitation)

**Current Phase 1 Implementation:**
- Uses single aggregated BLS public key from IssuerRegistry
- Threshold enforcement is semantic (11/20 vs 15/20 noted in comments)
- All signers must participate in aggregation for signature to verify

**Future Enhancement (Phase 2+):**
- Implement signer counting in BLS verification
- `verifyBLS15()` function for emergency threshold
- Track individual signer participation in signature

### Test Coverage Requirements

**Happy Path Tests:**
1. `test_proposeWhitelist_success` - Valid proposal emits event
2. `test_activateWhitelist_afterTimelock` - Activation after 2 days
3. `test_emergencyRemove_immediate` - Emergency removal works immediately

**Timelock Tests:**
1. `test_activateWhitelist_beforeTimelock_reverts` - Cannot activate early
2. `test_activateWhitelist_atExactTimelock` - Activation at exact boundary

**Error Case Tests:**
1. `test_proposeWhitelist_alreadyWhitelisted_reverts` - E031
2. `test_proposeWhitelist_alreadyProposed_reverts` - E028
3. `test_activateWhitelist_notProposed_reverts` - E029
4. `test_emergencyRemove_notWhitelisted_reverts` - E032
5. `test_proposeWhitelist_invalidSignature_reverts` - E020
6. `test_emergencyRemove_invalidSignature_reverts` - E020

**Integration Tests:**
1. `test_fullWhitelistLifecycle` - Propose → wait → activate → remove
2. `test_proposeAfterRemoval` - Can re-propose after removal
3. `test_execute_afterWhitelist` - Execute works after whitelist activation

### Project Structure Notes

**File Locations:**
```
contracts/
├── src/
│   ├── core/
│   │   └── BLSCustody.sol        ← Contains whitelist management
│   ├── interfaces/
│   │   └── IBLSCustody.sol       ← Interface with function signatures
│   └── libraries/
│       ├── ErrorsLib.sol         ← Error definitions (E028-E032)
│       └── EventsLib.sol         ← Event definitions
└── test/
    └── BLSCustody.t.sol          ← Test file for whitelist tests
```

### Dependencies

**Story 2-6 (BLSLib):** ✅ Complete
- `BLSLib.verifyBLS()` used for signature verification
- All 42 BLSLib tests passing

**Story 2-7 (BLSCustody Core):** Whitelist functions implemented inline
- Core execution verified working
- Nonce bitmap pattern in place
- UUPS upgrade pattern configured

### Previous Story Intelligence

From **Story 2-6 (BLS Library Solidity):**
- `BLSLib.verifyBLS()` returns false (not revert) on invalid signatures
- Gas cost ~120-140k for BLS verification
- Message format must include `chainid` and `address(this)` for replay protection

From **Story 2-7 (BLSCustody Core Execution):**
- Execute function verified working with whitelist check
- Nonce bitmap prevents gap attacks
- IssuerRegistry integration for aggregated pubkey retrieval

### Security Considerations

1. **Timelock Purpose:** 2-day delay allows community to detect and respond to malicious whitelist additions

2. **Emergency Removal:** Immediate effect with higher threshold (15/20) for urgent security response

3. **Cross-Chain Safety:** Message includes `chainid` to prevent replay across different chain deployments

4. **Clean State on Removal:** Both `whitelistActivatedAt` and `whitelistProposedAt` are cleared on removal (per AC #4)

### Testing Standards

**Use Mock IssuerRegistry:**
```solidity
// In test setup
MockIssuerRegistry mockRegistry = new MockIssuerRegistry();
custody.initialize(address(mockRegistry));
mockRegistry.setAggregatedPubkey(testPubkey);
```

**Time Manipulation:**
```solidity
// Fast-forward past timelock
vm.warp(block.timestamp + 2 days + 1);
custody.activateWhitelist(target);
```

**BLS Signature Generation:**
```solidity
// For testing, use mock registry that accepts any signature
// Or use known test vectors from BLSLib.t.sol
```

### References

- [Source: architecture.md#5-custody-whitelist-management] - Whitelist design decisions
- [Source: architecture.md#16-security-recovery] - Security thresholds (11/20, 15/20)
- [Source: epics.md#story-28] - Original acceptance criteria
- [Source: 2-6-bls-library-solidity.md] - BLS verification implementation details
- [Source: contracts/src/core/BLSCustody.sol] - Current implementation

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None - no debugging required for this verification story.

### Completion Notes List

1. **Task 1 - Implementation Verification (AC #1-6):** ✅ Complete
   - All whitelist management functions verified in BLSCustody.sol (lines 117-202)
   - proposeWhitelist: Correct message format, error handling (E028, E031), event emission
   - activateWhitelist: Timelock enforcement, state updates, event emission
   - emergencyRemoveWhitelist: Correct message format, state clearing, event emission
   - WHITELIST_TIMELOCK = 2 days constant verified
   - BLS verification uses aggregated pubkey from IssuerRegistry (Phase 1 semantic threshold)

2. **Task 2 - Test Enhancement (AC #7):** ✅ Complete
   - Added 3 new integration tests:
     - `test_fullWhitelistLifecycle` - Complete propose→wait→activate→remove→re-propose flow
     - `test_execute_afterWhitelistActivation` - Verifies execute works after whitelist
     - `test_emergencyRemove_clearsActivatedAt` - Verifies both timestamps cleared
   - Added 4 BLS signature verification tests (code review fix):
     - `test_proposeWhitelist_invalidSignature_reverts` - E020 on bad sig
     - `test_emergencyRemove_invalidSignature_reverts` - E020 on bad sig
     - `test_execute_invalidSignature_reverts` - E020 on bad sig
     - `test_phase1_emptyPubkey_skipsVerification` - Documents Phase 1 behavior
   - Total test count: 34 tests (up from 30)
   - All tests pass including 2 fuzz tests

3. **Task 3 - Documentation & Integration Verification:** ✅ Complete
   - IBLSCustody interface matches implementation (all function signatures correct)
   - ErrorsLib has all error codes: E020, E028-E032
   - EventsLib has all events: WhitelistProposed, WhitelistActivated, WhitelistRemoved
   - Full test suite: 309 tests pass, 0 failures, 1 skip (unrelated to this story)

### File List

**Modified:**
- `contracts/test/BLSCustody.t.sol` - Added 7 tests (3 integration + 4 BLS verification)
- `contracts/src/core/BLSCustody.sol` - Added Phase 1 security documentation comments
- `contracts/src/interfaces/IBLSCustody.sol` - Fixed event signatures to match EventsLib

**Verified (no changes needed):**
- `contracts/src/libraries/ErrorsLib.sol` - All error codes present (E020, E028-E032)
- `contracts/src/libraries/EventsLib.sol` - All events present

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-01-30 | Story verification complete - all ACs satisfied, 3 integration tests added | Claude Opus 4.5 |
| 2026-01-30 | Code review fixes: Fixed IBLSCustody event signatures, added 4 BLS verification tests, added Phase 1 security docs, fixed story File List | Claude Opus 4.5 |
