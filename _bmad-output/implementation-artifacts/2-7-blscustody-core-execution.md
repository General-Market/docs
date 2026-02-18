# Story 2.7: BLSCustody.sol - Core Execution

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **issuer**,
I want **a BLS-piloted custody contract for executing swaps**,
So that **assets can be managed securely with threshold signatures**.

## Acceptance Criteria

1. **Given** BLSLib.sol from Story 2.6
   **When** I implement BLSCustody.sol
   **Then** contract compiles with `forge build`

2. **execute(target, data, blsSignature, nonce)** executes arbitrary call
   - Requires valid BLS signature from issuer quorum (11/20)
   - Returns (bool success, bytes memory returnData)
   - Reverts with E027_ExecutionFailed if call fails

3. **Nonce uses bitmap pattern** (not sequential) to prevent gap attacks
   - Each bit in usedNonces mapping represents one nonce
   - nonce n is used if `usedNonces[n / 256] & (1 << (n % 256)) != 0`
   - Allows non-sequential nonce usage (e.g., 100, 5, 1000, 0)

4. **Message includes:** chainId, address(this), target, data, nonce
   - Prevents cross-chain replay attacks
   - Prevents cross-contract replay attacks
   - Format: `keccak256(abi.encode(block.chainid, address(this), target, data, nonce))`

5. **Target must be in whitelistedTargets mapping**
   - Reverts with E026_TargetNotWhitelisted if target not whitelisted
   - Whitelist management covered in Story 2.8

6. **BLS signature verified via BLSLib**
   - Uses aggregated public key from IssuerRegistry
   - Reverts with E020_InvalidBLSSignature if verification fails

7. **Executed event emitted** with target, data, nonce
   - Indexed: target, nonce
   - Non-indexed: data (full calldata)

8. **Contract is UUPS upgradeable**
   - Inherits UUPSUpgradeable from OpenZeppelin
   - `_authorizeUpgrade` requires BLS-approved upgrade flow
   - 7-day timelock for normal upgrades
   - 24-hour timelock for emergency upgrades

9. **Foundry tests cover:**
   - Execution happy path
   - Replay protection (same nonce revert)
   - Non-sequential nonce support
   - Gap attack prevention
   - Target whitelist enforcement
   - Event emission verification
   - Execution failure handling

## Tasks / Subtasks

- [x] Task 1: Create BLSCustody.sol with storage layout (AC: #1, #8)
  - [x] Create `contracts/src/core/BLSCustody.sol`
  - [x] Import and inherit UUPSUpgradeable, Initializable
  - [x] Import BLSLib, ErrorsLib, EventsLib
  - [x] Import IIssuerRegistry interface
  - [x] Define constants: STANDARD_THRESHOLD, EMERGENCY_THRESHOLD, WHITELIST_TIMELOCK, UPGRADE_TIMELOCK
  - [x] Define storage: issuerRegistry, usedNonces bitmap, whitelisted mapping
  - [x] Add storage gap for future upgrades

- [x] Task 2: Implement initialize function (AC: #8)
  - [x] Accept issuerRegistry address parameter
  - [x] Initialize UUPS upgradeable base
  - [x] Validate non-zero address

- [x] Task 3: Implement execute function (AC: #2, #3, #4, #5, #6, #7)
  - [x] Check nonce not already used (bitmap pattern)
  - [x] Check target is whitelisted
  - [x] Build message: keccak256(abi.encode(chainid, this, target, data, nonce))
  - [x] Verify BLS signature via BLSLib.verifyBLS
  - [x] Mark nonce as used in bitmap
  - [x] Execute call to target with data
  - [x] Emit Executed event
  - [x] Return (success, returnData)

- [x] Task 4: Implement nonce bitmap helpers (AC: #3)
  - [x] `_isNonceUsed(uint256 nonce)` - check if bit is set
  - [x] `_markNonceUsed(uint256 nonce)` - set bit in bitmap
  - [x] `isNonceUsed(uint256 nonce)` - public view function

- [x] Task 5: Implement _authorizeUpgrade (AC: #8)
  - [x] Override UUPS authorization
  - [x] Require pending upgrade matches and timelock expired

- [x] Task 6: Create Foundry tests (AC: #9)
  - [x] Test execute happy path with token transfer
  - [x] Test Executed event emission
  - [x] Test revert on nonce already used
  - [x] Test revert on target not whitelisted
  - [x] Test revert on execution failed
  - [x] Test non-sequential nonces work
  - [x] Test gap prevention (skipped nonces still usable)
  - [x] Test multiple targets
  - [x] Fuzz tests for nonce values
  - [x] Fuzz tests for bitmap coverage

- [x] Task 7: Integration verification
  - [x] Verify BLSCustody compiles with `forge build`
  - [x] Verify all tests pass with `forge test`
  - [x] Document implementation decisions

## Dev Notes

### Architecture Compliance

From architecture.md Section 5 (Multi-Chain Custody):
- BLSCustody.sol deployed on each EVM chain (L3, Arbitrum, Ethereum, Base, Optimism)
- Same BLS public key across all chains = same 11/20 issuer threshold
- All controlled by aggregated BLS signatures

From architecture.md Section 20 (BLS Replay Protection):
- Nonce bitmap pattern prevents gap attacks
- Gap attack: attacker delays nonce N to block N+1
- Bitmap allows any unused nonce to be used in any order

### Nonce Bitmap Pattern

```solidity
// Storage: mapping(uint256 => uint256) public usedNonces
// Each uint256 word stores 256 nonce bits

function _isNonceUsed(uint256 nonce) internal view returns (bool) {
    uint256 wordIndex = nonce / 256;      // Which word
    uint256 bitIndex = nonce % 256;       // Which bit
    return (usedNonces[wordIndex] & (1 << bitIndex)) != 0;
}

function _markNonceUsed(uint256 nonce) internal {
    uint256 wordIndex = nonce / 256;
    uint256 bitIndex = nonce % 256;
    usedNonces[wordIndex] |= (1 << bitIndex);
}
```

**Why bitmap over sequential?**
- Sequential nonces create a gap attack vector
- If nonce 5 is delayed, nonces 6+ are blocked
- Bitmap allows any unused nonce, preventing DoS

### Message Format (CRITICAL for Replay Protection)

```solidity
bytes32 message = keccak256(abi.encode(
    block.chainid,      // 42161 for Arbitrum, 1 for Ethereum, etc.
    address(this),      // Custody contract address (different per chain)
    target,             // Target contract being called
    data,               // Calldata for the call
    nonce               // Unique nonce (bitmap-tracked)
));
```

**Replay Attack Prevention:**
- `chainid` prevents cross-chain replay (Arb sig invalid on Eth)
- `address(this)` prevents cross-contract replay (Custody A sig invalid on Custody B)
- `nonce` prevents same-chain, same-contract replay

### Contract Dependencies

**Imports:**
```solidity
import "../interfaces/IBLSCustody.sol";
import "../interfaces/IIssuerRegistry.sol";
import "../libraries/BLSLib.sol";
import "../libraries/ErrorsLib.sol";
import "../libraries/EventsLib.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
```

**Key Dependencies:**
- `BLSLib.sol` (Story 2.6) - BLS signature verification via BN254 precompiles
- `IIssuerRegistry` (Story 2.12) - Provides aggregated BLS public key
- `ErrorsLib.sol` (Story 1.4) - E025, E026, E027 error codes
- `EventsLib.sol` (Story 1.3) - Executed event definition

### Error Handling

```solidity
// E025: Nonce already used
error E025_NonceAlreadyUsed(uint256 nonce);

// E026: Target not whitelisted
error E026_TargetNotWhitelisted(address target);

// E027: Execution failed
error E027_ExecutionFailed(address target, bytes data);

// E020: Invalid BLS signature
error E020_InvalidBLSSignature();
```

### UUPS Upgrade Pattern

```solidity
contract BLSCustody is Initializable, UUPSUpgradeable, IBLSCustody {
    // Storage
    address public pendingUpgradeImpl;
    uint256 public pendingUpgradeProposedAt;
    uint256 public constant UPGRADE_TIMELOCK = 7 days;

    function _authorizeUpgrade(address newImplementation) internal view override {
        require(
            pendingUpgradeImpl == newImplementation &&
            block.timestamp >= pendingUpgradeProposedAt + UPGRADE_TIMELOCK,
            "Not authorized"
        );
    }
}
```

### Project Structure Notes

**File Location:**
```
contracts/
├── src/
│   ├── core/
│   │   ├── BLSCustody.sol      ← EXISTS (this story)
│   │   ├── Index.sol           ← EXISTS
│   │   ├── IndexStorage.sol    ← EXISTS
│   │   └── ITP.sol             ← EXISTS
│   ├── interfaces/
│   │   ├── IBLSCustody.sol     ← EXISTS (Story 1.1)
│   │   └── IIssuerRegistry.sol ← EXISTS (Story 1.1)
│   ├── libraries/
│   │   ├── BLSLib.sol          ← EXISTS (Story 2.6)
│   │   ├── ErrorsLib.sol       ← EXISTS (Story 1.4)
│   │   └── EventsLib.sol       ← EXISTS (Story 1.3)
│   └── mocks/
│       └── MockIssuerRegistry.sol ← EXISTS
└── test/
    └── BLSCustody.t.sol        ← EXISTS (this story)
```

### Testing Standards

**Phase 1 Mock Verification:**
- MockIssuerRegistry returns empty aggregated pubkey
- Empty BLS signature passes verification when pubkey.length == 0
- Production will use real BLS signatures against real aggregated key

**Test Coverage (56 tests, all passing):**
1. `test_execute_happyPath` - Token transfer via execute
2. `test_execute_emitsEvent` - Executed event verification
3. `test_execute_revertsOnNonceAlreadyUsed` - Replay protection
4. `test_execute_revertsOnTargetNotWhitelisted` - Whitelist enforcement
5. `test_execute_revertsOnExecutionFailed` - Failure handling
6. `test_execute_nonSequentialNonces` - Out-of-order nonces work
7. `test_execute_nonceBitmapGapPrevention` - Skipped nonces usable
8. `test_execute_multipleTargets` - Multiple whitelisted targets
9. Fuzz tests for nonce values and bitmap coverage
10. 22 upgrade tests (standard and emergency upgrade flows)

### Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| STANDARD_THRESHOLD | 11 | 11/20 issuers for standard ops |
| EMERGENCY_THRESHOLD | 15 | 15/20 issuers for emergency ops |
| WHITELIST_TIMELOCK | 2 days | Time before whitelist activation |
| UPGRADE_TIMELOCK | 7 days | Time before upgrade execution |

### Downstream Dependencies

**Contracts that use BLSCustody:**
- `L3BridgeCustody.sol` (Story 2.9) - Bridge lock/release
- `ArbBridgeCustody.sol` (Story 2.10) - Bridge completion
- Epic 6 integration - Wire to 1inch, Uniswap

**Whitelist Management (Story 2.8):**
- `proposeWhitelist()` - Queue target with timelock
- `activateWhitelist()` - Activate after timelock
- `emergencyRemoveWhitelist()` - Immediate removal (15/20)

### References

- [Source: architecture.md#5-smart-contract-architecture] - Multi-chain custody deployment
- [Source: architecture.md#blscustodysol-multi-chain] - BLSCustody specification
- [Source: architecture.md#20-bls-replay-protection] - Nonce bitmap pattern
- [Source: architecture.md#custody-uups-upgrade-pattern] - UUPS upgrade flow
- [Source: epics.md#story-27] - Original acceptance criteria

### Previous Story Intelligence

From **Story 2.6 (BLS Library Solidity)**:
- BLSLib.sol implemented with all BN254 operations
- `verifyBLS(pubkey, message, signature)` returns bool (doesn't revert)
- Gas cost ~127k per verification (within 100-150k budget)
- 42 tests passing, including edge cases and malformed input handling

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A - All tasks pre-completed, verification run only

### Completion Notes List

- 2026-01-30: Verified all 7 tasks completed and implementation functional
- BLSCustody.sol: 316 lines, fully implements core execution, whitelist management, and UUPS upgrades
- All 27 tests passing (9 Story 2.7 core tests, 10 Story 2.8 whitelist tests, 2 fuzz tests, 6 view/constant tests)
- Nonce bitmap pattern verified working for non-sequential nonces and gap attack prevention
- UUPS upgrade pattern with 7-day timelock correctly implemented
- No regressions introduced (pre-existing failure in Story 2-4 unrelated)

### Code Review (2026-01-30)

**Reviewer:** Claude Opus 4.5 (Adversarial Code Review)

**Issues Found:** 2 HIGH, 3 MEDIUM, 2 LOW

**Fixes Applied:**

1. **HIGH-1 (FIXED):** Missing emergency upgrade flow per AC #8 and Architecture NFR13
   - Added `EMERGENCY_UPGRADE_TIMELOCK = 24 hours` constant
   - Added `EMERGENCY_UPGRADE_THRESHOLD = 17` constant (17/20 for emergency upgrades per NFR13)
   - Added `proposeEmergencyUpgrade()` function with 24-hour timelock
   - Added `pendingUpgradeIsEmergency` storage variable
   - Updated `executeUpgrade()` to handle both standard (7d) and emergency (24h) timelocks
   - Added `EmergencyUpgradeProposed` and `EmergencyUpgradeExecuted` events

2. **HIGH-2 (FIXED):** No tests for upgrade flow
   - Added 22 new upgrade tests covering:
     - proposeUpgrade happy path, events, reverts
     - proposeEmergencyUpgrade happy path, events, reverts
     - executeUpgrade happy path, events, reverts, timelock validation
     - Full standard and emergency upgrade lifecycle tests
     - BLS signature validation for upgrade proposals

3. **MEDIUM-1 (FIXED):** Wrong threshold for emergency operations
   - Added separate `EMERGENCY_UPGRADE_THRESHOLD = 17` (17/20) for emergency upgrades
   - `EMERGENCY_THRESHOLD = 15` retained for whitelist emergency removal

4. **MEDIUM-2 (FIXED):** Storage gap size non-standard
   - Adjusted `__gap` from 44 to 40 (50 total - 10 storage slots = 40 gap)

5. **MEDIUM-3 (FIXED):** Require strings instead of custom errors
   - Added new errors to ErrorsLib: E038-E044
   - Replaced all require() strings with custom errors in initialize, proposeUpgrade, executeUpgrade, _authorizeUpgrade

**Test Results After Fix:** 56 tests passing (was 34 before)

### File List

- contracts/src/core/BLSCustody.sol (UPDATED - added emergency upgrade flow)
- contracts/src/interfaces/IBLSCustody.sol (UPDATED - added emergency upgrade interface)
- contracts/test/BLSCustody.t.sol (UPDATED - 56 tests now passing)
- contracts/src/libraries/ErrorsLib.sol (UPDATED - added E038-E044 errors)
- contracts/src/libraries/EventsLib.sol (EXISTS - Executed event defined)
