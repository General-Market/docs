# Story 2.9: L3BridgeCustody.sol - Source Lock

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **issuer**,
I want **to lock USDC on L3 for bridging to other chains**,
So that **cross-chain transfers use two-phase commit for safety**.

## Acceptance Criteria

1. **Given** BLSCustody.sol from Story 2.7
   **When** I implement L3BridgeCustody.sol
   **Then** contract compiles with `forge build`

2. **`initiateBridge(destChainId, amount, blsSignature)`** locks USDC in escrow
   - Message format: `keccak256(abi.encode(chainid, this, destChainId, amount, nonce))`
   - Requires valid BLS signature from issuer quorum (11/20)
   - USDC transferred from caller to contract's escrow
   - Returns unique nonce for this lock
   - Increments internal nonce counter

3. **PendingLock struct** stores:
   - `amount`: Amount locked (18 decimals)
   - `destChainId`: Destination chain ID
   - `lockedAt`: Timestamp when locked (`block.timestamp`)
   - `lockedBlock`: Block number when locked (`block.number`)
   - `lockedBlockHash`: Block hash for verification (`blockhash(block.number - 1)`)
   - `released`: Whether funds released on destination (false initially)
   - `reversed`: Whether lock was reversed after timeout (false initially)

4. **BridgeLockConfirmed event** emitted with:
   - `nonce` (indexed): Unique lock identifier
   - `amount`: Amount locked (18 decimals)
   - `destChainId`: Destination chain ID
   - `blockNumber`: Current `block.number`
   - `blockHash`: `blockhash(block.number - 1)` for issuer verification

5. **`markReleased(nonce, destTxHash, blsSignature)`** marks lock as released
   - Message format: `keccak256(abi.encode(chainid, this, nonce, destTxHash))`
   - Requires valid BLS signature (11/20)
   - Sets `pendingLocks[nonce].released = true`
   - Emits `LockReleased(nonce, destTxHash)` event
   - Reverts if already released or reversed

6. **`reverseLock(nonce, blsSignature, signerCount)`** reverses after 1-hour timeout
   - Message format: `keccak256(abi.encode(chainid, this, "reverse", nonce, signerCount))`
   - Requires 15/20 BLS threshold (emergency threshold)
   - Can only be called if `block.timestamp >= lockedAt + LOCK_TIMEOUT`
   - Reverts if already released or reversed
   - Sets `pendingLocks[nonce].reversed = true`
   - Returns USDC to the custody contract (or designated recipient)
   - Emits `LockReversed(nonce)` event

7. **Foundry tests cover:**
   - Lock happy path (initiateBridge, event emission)
   - Mark released happy path
   - Reversal after timeout
   - Reversal before timeout (should revert)
   - Double release prevention
   - Double reversal prevention
   - Release after reversal (should revert)
   - Reversal after release (should revert)
   - BLS signature verification
   - Nonce uniqueness

## Tasks / Subtasks

- [x] Task 1: Create L3BridgeCustody.sol with storage layout (AC: #1, #3)
  - [x] Create `contracts/src/custody/L3BridgeCustody.sol`
  - [x] Import and inherit UUPSUpgradeable, Initializable
  - [x] Import BLSLib, ErrorsLib, EventsLib, TypesLib
  - [x] Import IIssuerRegistry, IL3BridgeCustody, IERC20 interfaces
  - [x] Define constants: `LOCK_TIMEOUT = 1 hours`, `REVERSAL_THRESHOLD = 15`
  - [x] Define storage: `issuerRegistry`, `usdc`, `pendingLocks` mapping, `bridgeNonce`
  - [x] Add storage gap for future upgrades

- [x] Task 2: Implement initialize function (AC: #1)
  - [x] Accept `issuerRegistry_` address parameter
  - [x] Accept `usdc_` address parameter
  - [x] Initialize UUPS upgradeable base
  - [x] Validate non-zero addresses
  - [x] Store references

- [x] Task 3: Implement initiateBridge function (AC: #2, #3, #4)
  - [x] Build message: `keccak256(abi.encode(chainid, this, destChainId, amount, bridgeNonce))`
  - [x] Verify BLS signature via BLSLib
  - [x] Transfer USDC from caller to this contract
  - [x] Create PendingLock struct with all required fields
  - [x] Store in pendingLocks mapping with current nonce
  - [x] Emit BridgeLockConfirmed event
  - [x] Increment bridgeNonce and return previous value

- [x] Task 4: Implement markReleased function (AC: #5)
  - [x] Build message: `keccak256(abi.encode(chainid, this, nonce, destTxHash))`
  - [x] Verify BLS signature via BLSLib
  - [x] Check lock exists and is not already released or reversed
  - [x] Set released = true
  - [x] Emit LockReleased event

- [x] Task 5: Implement reverseLock function (AC: #6)
  - [x] Build message: `keccak256(abi.encode(chainid, this, "reverse", nonce, signerCount))`
  - [x] Verify BLS signature via BLSLib
  - [x] Check signerCount >= REVERSAL_THRESHOLD (15/20)
  - [x] Check lock exists and is not released or reversed
  - [x] Check timeout has passed: `block.timestamp >= lockedAt + LOCK_TIMEOUT`
  - [x] Set reversed = true
  - [x] Funds remain in custody (reversal returns USDC to contract for governance handling)
  - [x] Emit LockReversed event

- [x] Task 6: Add view functions
  - [x] `getPendingLock(nonce)` returns PendingLock struct
  - [x] `currentNonce()` returns bridgeNonce
  - [x] `canReverseLock(nonce)` returns bool (timeout check)
  - [x] Whitelist not needed (L3BridgeCustody uses different pattern than BLSCustody)

- [x] Task 7: Add error codes to ErrorsLib (AC: #1)
  - [x] `E045_LockAlreadyReleased(uint256 nonce)`
  - [x] `E046_LockAlreadyReversed(uint256 nonce)`
  - [x] `E047_LockTimeoutNotReached(uint256 nonce, uint256 lockedAt, uint256 currentTime)`
  - [x] `E048_InsufficientSignerCount(uint256 provided, uint256 required)`
  - [x] `E049_LockNotFound(uint256 nonce)`
  - [x] `E050_ZeroUSDCAddress()`

- [x] Task 8: Add events to EventsLib (AC: #4, #5, #6)
  - [x] Verify `BridgeLockConfirmed` event exists (already defined in EventsLib)
  - [x] `LockReleased` and `LockReversed` defined in IBridge.sol interface (emitted from contract)

- [x] Task 9: Create Foundry tests (AC: #7)
  - [x] Test initiateBridge happy path
  - [x] Test BridgeLockConfirmed event emission with all parameters
  - [x] Test markReleased happy path
  - [x] Test LockReleased event emission
  - [x] Test reverseLock after timeout
  - [x] Test LockReversed event emission
  - [x] Test revert on reverseLock before timeout
  - [x] Test revert on double release
  - [x] Test revert on double reversal
  - [x] Test revert on release after reversal
  - [x] Test revert on reversal after release
  - [x] Test revert on insufficient signer count for reversal
  - [x] Test nonce uniqueness (sequential nonces)
  - [x] Test USDC transfer on initiateBridge
  - [x] Fuzz tests for amounts, chain IDs, and timeout scenarios

- [x] Task 10: UUPS upgrade support
  - [x] Implement `_authorizeUpgrade` override
  - [x] Follow same upgrade pattern as BLSCustody.sol (7-day standard / 24-hour emergency)
  - [x] Add upgrade proposal storage: `pendingUpgradeImpl`, `pendingUpgradeProposedAt`, `pendingUpgradeIsEmergency`
  - [x] Add `proposeUpgrade`, `proposeEmergencyUpgrade`, `executeUpgrade` functions

## Dev Notes

### Architecture Reference

From architecture.md Section 5 (Multi-Chain Custody):
- L3BridgeCustody.sol deployed on Index L3 chain
- Controls Master USDC, ITP logic, bridge initiation
- Uses BLS (BN254) for signature verification
- Part of two-phase bridge pattern: Lock → Verify → Release

From architecture.md Section 13-14 (Bridge Contracts):
```
TWO-PHASE BRIDGE WITH VERIFICATION
───────────────────────────────────
PHASE 1: LOCK ON SOURCE (this contract)
1. Issuers BLS-sign: BRIDGE_LOCK(amount, destChain, nonce)
2. Contract locks USDC in escrow
3. Emit BridgeLockConfirmed(amount, destChain, nonce, blockHash)
4. Lock includes: block.number, blockhash(block.number - 1)

PHASE 2: VERIFY AND RELEASE ON DESTINATION (Story 2.10)
5. Issuers observe BridgeLockConfirmed via multiple RPCs
6. Wait for finality (N confirmations on L3)
7. Build release proof with source tx/block info
8. BLS-sign release on destination chain
```

### Message Format (CRITICAL for Cross-Chain Safety)

**initiateBridge:**
```solidity
bytes32 message = keccak256(abi.encode(
    block.chainid,      // 111222333 for Index L3
    address(this),      // L3BridgeCustody contract address
    destChainId,        // e.g., 42161 for Arbitrum
    amount,             // USDC amount (18 decimals)
    bridgeNonce         // Sequential nonce
));
```

**markReleased:**
```solidity
bytes32 message = keccak256(abi.encode(
    block.chainid,
    address(this),
    nonce,
    destTxHash
));
```

**reverseLock:**
```solidity
bytes32 message = keccak256(abi.encode(
    block.chainid,
    address(this),
    "reverse",
    nonce,
    signerCount
));
```

### Contract Dependencies

**Imports:**
```solidity
import "../interfaces/IBridge.sol";           // IL3BridgeCustody interface
import "../interfaces/IIssuerRegistry.sol";   // For aggregated BLS pubkey
import "../libraries/BLSLib.sol";             // BLS signature verification
import "../libraries/ErrorsLib.sol";          // Custom errors
import "../libraries/EventsLib.sol";          // Event definitions
import "../libraries/TypesLib.sol";           // PendingLock struct
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
```

**Key Dependencies:**
- `BLSLib.sol` (Story 2.6) - BLS signature verification via BN254 precompiles
- `IIssuerRegistry` (Story 2.12) - Provides aggregated BLS public key
- `IL3BridgeCustody` (Epic 1) - Interface already defined in IBridge.sol
- `TypesLib.PendingLock` - Struct already defined
- `EventsLib.BridgeLockConfirmed` - Event already defined

### Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| LOCK_TIMEOUT | 1 hour | Time before reversal allowed |
| REVERSAL_THRESHOLD | 15 | 15/20 issuers for emergency reversal |
| STANDARD_THRESHOLD | 11 | 11/20 issuers for standard ops |

### Storage Layout

```solidity
contract L3BridgeCustody is Initializable, UUPSUpgradeable, IL3BridgeCustody {
    // Immutable references
    IIssuerRegistry public issuerRegistry;
    IERC20 public usdc;

    // Bridge state
    mapping(uint256 => TypesLib.PendingLock) public pendingLocks;
    uint256 public bridgeNonce;

    // Storage gap for upgrades
    uint256[47] private __gap;
}
```

### Error Handling

New errors for Story 2.9 (add to ErrorsLib.sol):
```solidity
/// @notice E045: Lock already released
error E045_LockAlreadyReleased(uint256 nonce);

/// @notice E046: Lock already reversed
error E046_LockAlreadyReversed(uint256 nonce);

/// @notice E047: Lock timeout not reached
error E047_LockTimeoutNotReached(uint256 nonce, uint256 lockedAt, uint256 currentTime);

/// @notice E048: Insufficient signer count for emergency operation
error E048_InsufficientSignerCount(uint256 provided, uint256 required);

/// @notice E049: Lock not found (nonce doesn't exist)
error E049_LockNotFound(uint256 nonce);

/// @notice E050: Zero address for USDC
error E050_ZeroUSDCAddress();
```

### Events

Verify/add to EventsLib.sol:
```solidity
// BridgeLockConfirmed already exists (lines 96-102)

/// @notice Emitted when a lock is marked as released on destination
event LockReleased(uint256 indexed nonce, bytes32 destTxHash);

/// @notice Emitted when a lock is reversed after timeout
event LockReversed(uint256 indexed nonce);
```

### Project Structure Notes

**File Location:**
```
contracts/
├── src/
│   ├── custody/
│   │   ├── BLSCustody.sol          ← EXISTS (Story 2.7)
│   │   └── L3BridgeCustody.sol     ← NEW (this story)
│   ├── interfaces/
│   │   ├── IBLSCustody.sol         ← EXISTS
│   │   └── IBridge.sol             ← EXISTS (IL3BridgeCustody defined)
│   └── libraries/
│       ├── BLSLib.sol              ← EXISTS (Story 2.6)
│       ├── ErrorsLib.sol           ← UPDATE (add E045-E050)
│       ├── EventsLib.sol           ← UPDATE (add LockReleased, LockReversed)
│       └── TypesLib.sol            ← EXISTS (PendingLock, ReleaseProof defined)
└── test/
    └── L3BridgeCustody.t.sol       ← NEW (this story)
```

### Testing Standards

**Phase 1 Mock Verification:**
- MockIssuerRegistry returns empty aggregated pubkey
- Empty BLS signature passes verification when pubkey.length == 0
- Use MockERC20 for USDC in tests
- Production will use real BLS signatures

**Test Setup:**
```solidity
contract L3BridgeCustodyTest is Test {
    L3BridgeCustody custody;
    MockIssuerRegistry mockRegistry;
    MockERC20 usdc;

    function setUp() public {
        mockRegistry = new MockIssuerRegistry();
        usdc = new MockERC20("USDC", "USDC", 18);

        // Deploy implementation
        L3BridgeCustody impl = new L3BridgeCustody();

        // Deploy proxy
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(impl),
            abi.encodeCall(impl.initialize, (address(mockRegistry), address(usdc)))
        );

        custody = L3BridgeCustody(address(proxy));

        // Fund test account
        usdc.mint(address(this), 1_000_000e18);
        usdc.approve(address(custody), type(uint256).max);
    }
}
```

**Time Manipulation:**
```solidity
// Fast-forward past timeout
vm.warp(block.timestamp + 1 hours + 1);
custody.reverseLock(nonce, blsSignature, 15);
```

### Security Considerations

1. **Two-Phase Commit Safety:** Funds locked on L3, only released on destination after issuers verify lock event via multiple RPCs

2. **Timeout Reversal:** 1-hour timeout prevents stuck funds, requires higher threshold (15/20) for safety

3. **Cross-Chain Replay Prevention:** Message includes `chainid` and `address(this)`

4. **Double-Spend Prevention:** `released` and `reversed` flags prevent reuse

5. **Block Hash Verification:** `blockhash(block.number - 1)` allows destination chain to verify source finality

### Downstream Dependencies

**Story 2.10 (ArbBridgeCustody.sol):**
- Uses `BridgeLockConfirmed` event to initiate release
- Uses `ReleaseProof` struct from TypesLib
- Calls `completeBridge()` with source chain proof

**Epic 6 Integration:**
- Story 6.8: Bridge integration test (L3↔Arb)
- Verifies full lock → verify → release flow

### References

- [Source: architecture.md#5-multi-chain-custody-deployment] - L3BridgeCustody specification
- [Source: architecture.md#13-multi-chain-collateral--custody] - Bridge flow diagram
- [Source: architecture.md#bridge-contracts-two-phase] - Solidity implementation reference
- [Source: architecture.md#bridge-security-properties] - Security mitigations
- [Source: contracts/src/interfaces/IBridge.sol] - IL3BridgeCustody interface
- [Source: contracts/src/libraries/TypesLib.sol#146-154] - PendingLock struct
- [Source: contracts/src/libraries/EventsLib.sol#96-102] - BridgeLockConfirmed event
- [Source: epics.md#story-29] - Original acceptance criteria

### Previous Story Intelligence

From **Story 2.7 (BLSCustody Core Execution):**
- BLSCustody.sol pattern for BLS signature verification
- Nonce bitmap pattern for replay protection (this story uses sequential)
- UUPS upgrade pattern with 7-day standard / 24-hour emergency timelocks
- 56 tests passing, emergency upgrade flow implemented
- Phase 1: empty pubkey skips verification (security documented)

From **Story 2.8 (BLSCustody Whitelist Management):**
- 15/20 threshold for emergency operations
- Event emission patterns
- 34 tests total passing
- Clean state management on reversal

### Git Intelligence

Recent commits (2026-01-30):
- `d1fc425` Story 5.9: Add TokenRegistry and mock RPC error tests
- `81e8cce` Fix code review issues for Story 5-7 (1inch Fusion+ Client)
- `d21d866` Add common crate dependencies and module exports

Pattern observations:
- Stories follow consistent structure
- Tests are comprehensive (56 for BLSCustody)
- Custom errors in ErrorsLib preferred over require strings

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- All 41 L3BridgeCustody tests pass
- Full test suite: 567 tests pass with no regressions

### Completion Notes List

- **Task 1-2**: Created L3BridgeCustody.sol with UUPS pattern, storage layout following BLSCustody.sol pattern
- **Task 3**: initiateBridge transfers USDC, stores PendingLock, emits BridgeLockConfirmed + BridgeInitiated
- **Task 4**: markReleased validates lock state, sets released=true, emits LockReleased
- **Task 5**: reverseLock requires 1-hour timeout + 15/20 signers, sets reversed=true, emits LockReversed
- **Task 6**: View functions: getPendingLock, currentNonce, canReverseLock
- **Task 7**: Added E045-E050 error codes to ErrorsLib.sol
- **Task 8**: Events defined in IBridge.sol interface (LockReleased, LockReversed)
- **Task 9**: 41 comprehensive tests including fuzz tests for amounts, chain IDs, and timeouts
- **Task 10**: UUPS upgrade with proposeUpgrade, proposeEmergencyUpgrade, executeUpgrade

### Change Log

- 2026-01-30: Story 2.9 implementation complete - L3BridgeCustody.sol with 41 passing tests
- 2026-01-30: Code review fixes applied - added input validation and cancelUpgrade, now 47 tests

### File List

- contracts/src/custody/L3BridgeCustody.sol (NEW)
- contracts/src/libraries/ErrorsLib.sol (MODIFIED - added E045-E050, E052-E053)
- contracts/test/L3BridgeCustody.t.sol (NEW)

## Senior Developer Review (AI)

**Reviewer:** Claude Opus 4.5
**Date:** 2026-01-30
**Outcome:** APPROVED with fixes applied

### Review Summary

All 10 tasks verified as complete. All 7 Acceptance Criteria implemented correctly.

### Issues Found & Fixed

| Severity | Issue | Resolution |
|----------|-------|------------|
| MEDIUM | Missing zero-amount validation in initiateBridge | Added E052_ZeroAmount check |
| MEDIUM | No destChainId validation (accepted 0 or current chain) | Added E053_InvalidDestChainId check |
| MEDIUM | Missing cancelUpgrade function for governance | Added cancelUpgrade with BLS verification |
| LOW | Test coverage gaps for new validations | Added 6 new tests |

### Verification

- **Tests:** 47 passing (41 original + 6 new)
- **Compilation:** Successful
- **All ACs:** Verified implemented
