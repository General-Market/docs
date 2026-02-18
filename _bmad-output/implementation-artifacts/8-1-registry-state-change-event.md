# Story 8.1: RegistryStateChanged Event + _emitStateChange()

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **MirrorIssuerRegistry on Arbitrum**,
I want **the L3 IssuerRegistry to emit a RegistryStateChanged event on every state mutation (add/remove issuer, key rotation)**,
So that **anyone can observe registry changes and BLS-sign sync proofs for permissionless registry mirroring to other chains**.

## Acceptance Criteria

1. **AC1**: L3 IssuerRegistry has a private storage variable `_registryNonce` (uint256) that increments on every state change
2. **AC2**: L3 IssuerRegistry emits `RegistryStateChanged(uint256 indexed nonce, uint256 activeCount, bytes32 stateHash)` event after each mutation
3. **AC3**: `getRegistryStateHash()` public view function returns `keccak256` of all active issuer pubkeys concatenated in order
4. **AC4**: `registryNonce()` external view function returns the current nonce
5. **AC5**: `addIssuer()` calls `_emitStateChange()` after `emit IssuerAdded`
6. **AC6**: `removeIssuer()` calls `_emitStateChange()` after `emit IssuerRemoved`
7. **AC7**: `executeRotation()` calls `_emitStateChange()` after `emit KeyRotationExecuted`
8. **AC8**: All existing IssuerRegistry tests still pass (no regressions)
9. **AC9**: New unit tests verify event emission with correct nonce, activeCount, and stateHash values

## Tasks / Subtasks

- [x] Task 1: Add storage variables (AC: #1)
  - [x] 1.1: Add `uint256 private _registryNonce` storage variable
  - [x] 1.2: Reduce `__gap` by 1 slot (from 36 to 35) to maintain storage layout

- [x] Task 2: Add RegistryStateChanged event to EventsLib (AC: #2)
  - [x] 2.1: Add event definition to `contracts/src/libraries/EventsLib.sol`
  - [x] 2.2: Document event parameters and usage

- [x] Task 3: Implement getRegistryStateHash() (AC: #3)
  - [x] 3.1: Create public view function that iterates active issuers
  - [x] 3.2: Concatenate pubkeys in issuer ID order (0, 1, 2, ...)
  - [x] 3.3: Return keccak256 hash of concatenated pubkeys

- [x] Task 4: Implement registryNonce() view function (AC: #4)
  - [x] 4.1: Add external view function returning `_registryNonce`
  - [x] 4.2: Add to IIssuerRegistry interface

- [x] Task 5: Implement _emitStateChange() internal function (AC: #2)
  - [x] 5.1: Increment `_registryNonce`
  - [x] 5.2: Call `getRegistryStateHash()`
  - [x] 5.3: Emit `RegistryStateChanged` event with nonce, activeCount, stateHash

- [x] Task 6: Wire _emitStateChange() into mutations (AC: #5, #6, #7)
  - [x] 6.1: Call `_emitStateChange()` at end of `addIssuer()` (after `emit IssuerAdded`)
  - [x] 6.2: Call `_emitStateChange()` at end of `removeIssuer()` (after `emit IssuerRemoved`)
  - [x] 6.3: Call `_emitStateChange()` at end of `executeRotation()` (after `emit KeyRotationExecuted`)

- [x] Task 7: Update IIssuerRegistry interface (AC: #4)
  - [x] 7.1: Add `registryNonce()` function signature
  - [x] 7.2: Add `getRegistryStateHash()` function signature and document both functions

- [x] Task 8: Verify existing tests pass (AC: #8)
  - [x] 8.1: Run `forge test --match-contract IssuerRegistry` - all 91 existing tests pass
  - [x] 8.2: Run full Solidity test suite - 1060 tests pass (3 pre-existing failures from Story 7-6b unrelated to this story)

- [x] Task 9: Write new unit tests (AC: #9)
  - [x] 9.1: Test `addIssuer` increments nonce and emits event
  - [x] 9.2: Test `removeIssuer` increments nonce and emits event
  - [x] 9.3: Test `executeRotation` increments nonce and emits event
  - [x] 9.4: Test `getRegistryStateHash` returns correct hash for known issuer set
  - [x] 9.5: Test `registryNonce` returns correct value after multiple mutations
  - [x] 9.6: Test stateHash changes when issuers are added/removed
  - [x] 9.7: Test event order - IssuerAdded emitted before RegistryStateChanged (AC#5)
  - [x] 9.8: Test event order - IssuerRemoved emitted before RegistryStateChanged (AC#6)
  - [x] 9.9: Test event order - KeyRotationExecuted emitted before RegistryStateChanged (AC#7)

## Dev Notes

### Architecture Context

This story is part of **Epic 8: ITP-Morpho Lending Protocol**, specifically Phase 1 (Registry Sync Infrastructure). The goal is to enable a MirrorIssuerRegistry on Arbitrum to stay in sync with the L3 IssuerRegistry via BLS-signed state proofs.

The sync mechanism works as follows:
1. L3 IssuerRegistry emits `RegistryStateChanged` on any mutation
2. Issuers observe the event and compute the new aggregated G2 pubkey off-chain
3. Each issuer BLS-signs: `keccak256(abi.encode("REGISTRY_SYNC", nonce, newAggPubkey, activeCount, threshold))`
4. Anyone can collect 2/3 signatures, aggregate, and call `MirrorIssuerRegistry.sync()` on Arbitrum

### Key Design Decisions

- **Monotonic nonce**: Prevents replay attacks on the sync mechanism
- **stateHash**: Allows verification that the sync message matches the actual L3 state
- **Event ordering**: `_emitStateChange()` called AFTER the primary mutation event to preserve existing behavior

### Implementation Details

**getRegistryStateHash() Algorithm:**
```solidity
function getRegistryStateHash() public view returns (bytes32) {
    bytes memory packed;
    for (uint256 i = 0; i < _issuerCount; i++) {
        if (_issuers[i].addr != address(0) && _issuers[i].status == 1) {
            packed = abi.encodePacked(packed, _issuers[i].blsPubkey);
        }
    }
    return keccak256(packed);
}
```

**Gas Considerations:**
- `getRegistryStateHash()` is O(n) where n = total issuers ever registered
- For 20 issuers with 128-byte pubkeys, ~2560 bytes hashed
- Event emission is ~2000 gas
- Total overhead per mutation: ~5000-10000 gas (acceptable)

### Storage Layout

Current `__gap` is 36 slots. Adding 1 slot for `_registryNonce` requires reducing gap to 35 slots:
```solidity
uint256 private _registryNonce;  // NEW: incremented on each state change
uint256[35] private __gap;       // CHANGED: reduced from 36 to 35
```

### Project Structure Notes

- **IssuerRegistry.sol**: `contracts/src/registry/IssuerRegistry.sol`
- **EventsLib.sol**: `contracts/src/libraries/EventsLib.sol`
- **IIssuerRegistry.sol**: `contracts/src/interfaces/IIssuerRegistry.sol`
- **Tests**: `contracts/test/IssuerRegistry.t.sol`

### Testing Standards

- All new tests in Foundry format
- Use existing test patterns from IssuerRegistry.t.sol
- Test event emission using `vm.expectEmit(true, false, false, true)`
- Verify exact nonce values, not just increment

### Existing EventsLib.sol Structure

Add the new event to `EventsLib.sol` after the `PoolRebalanceComplete` event (around line 334). The file currently has events organized by category:
- ORDER EVENTS (lines 9-68)
- ITP EVENTS (lines 70-86)
- BRIDGE EVENTS (lines 88-114)
- COLLATERAL EVENTS (lines 116-130)
- BLS CUSTODY EVENTS (lines 132-142)
- WHITELIST EVENTS (lines 144-180)
- REGISTRY ADMIN EVENTS (lines 182-200)
- FEE REGISTRY EVENTS (lines 202-239)
- REBALANCE EVENTS (lines 241-271)
- PRODUCTION HARDENING EVENTS (lines 273-305)
- ARCHITECTURE GAP FIX EVENTS (lines 307-333)

Add a new section: `// ============ REGISTRY SYNC EVENTS (Story 8.1) ============`

### IIssuerRegistry.sol Current Interface

Add `registryNonce()` to the VIEW FUNCTIONS section (after line 111, before CONSTANTS section):

```solidity
/// @notice Get current registry nonce for sync tracking
/// @return The current registry nonce (incremented on every state change)
function registryNonce() external view returns (uint256);
```

### Existing IssuerRegistry Storage Layout

Current storage order (must maintain for upgrades):
```solidity
IGovernance private _governance;                    // slot 0
mapping(uint256 => TypesLib.Issuer) _issuers;      // slot 1
uint256 private _issuerCount;                       // slot 2
uint256 private _activeCount;                       // slot 3
uint256[2] private _aggregatedPubkey_DEPRECATED;   // slots 4-5
mapping(uint256 => TypesLib.KeyRotation) ...       // slot 6
mapping(uint256 => mapping(...)) ...               // slot 7
mapping(uint256 => uint256) _lastApprovalTime;     // slot 8
mapping(bytes32 => uint256) _keyGracePeriod;       // slot 9
mapping(uint256 => bool) _forceWindowEnabled;      // slot 10
uint256 private _currentCycle;                      // slot 11
bool private _testMode;                             // slot 12
uint256[36] private __gap;                          // slots 13-48
```

Add `_registryNonce` AFTER `_testMode` and BEFORE `__gap`, reducing gap from 36 to 35 slots.

### Gas Cost Warning

`getRegistryStateHash()` iterates over all ever-registered issuers (not just active). For 20 active out of 30 total issuers with 128-byte pubkeys:
- Memory allocation: ~2560 bytes
- Hash computation: ~100 gas per 32 bytes = ~800 gas
- Loop iteration: ~200 gas × 30 = ~6000 gas
- **Total: ~7000-8000 gas per call**

This is acceptable for event emission but should NOT be called in loops or high-frequency paths.

### References

- [Source: _bmad-output/planning-artifacts/itp-morpho-lending-architectures.md#Registry Sync: L3 IssuerRegistry → MirrorIssuerRegistry]
- [Source: _bmad-output/planning-artifacts/architecture.md#17. Issuer Key Management]
- [Source: contracts/src/registry/IssuerRegistry.sol - existing implementation]
- [Source: contracts/src/libraries/EventsLib.sol - existing events]
- [Source: contracts/src/interfaces/IIssuerRegistry.sol - existing interface]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None - implementation completed without errors.

### Completion Notes List

- **Task 1**: Added `uint256 private _registryNonce` storage variable to IssuerRegistry.sol (line 142). Reduced `__gap` from 36 to 35 slots to maintain storage layout compatibility.
- **Task 2**: Added `RegistryStateChanged` event to EventsLib.sol (lines 337-348) with indexed nonce, activeCount, and stateHash parameters. Created new "REGISTRY SYNC EVENTS (Story 8.1)" section.
- **Task 3**: Implemented `getRegistryStateHash()` public view function that iterates all issuers, includes only active ones (status == 1), concatenates their BLS pubkeys in ID order, and returns keccak256 hash.
- **Task 4**: Implemented `registryNonce()` external view function returning `_registryNonce`.
- **Task 5**: Implemented `_emitStateChange()` internal function that increments nonce, computes state hash, and emits RegistryStateChanged event.
- **Task 6**: Wired `_emitStateChange()` into addIssuer(), removeIssuer(), and executeRotation() after their primary events.
- **Task 7**: Added `registryNonce()` and `getRegistryStateHash()` to IIssuerRegistry interface with documentation.
- **Task 8**: All 91 existing IssuerRegistry tests pass. Full suite: 1060 passed, 3 pre-existing failures (Story 7-6b decimal conversion unrelated to this story).
- **Task 9**: Added 12 new tests covering all acceptance criteria: nonce increment, event emission, state hash computation, event ordering (AC5-7), and edge cases. Total: 103 IssuerRegistry tests.

### File List

- `contracts/src/registry/IssuerRegistry.sol` - Modified: Added _registryNonce storage, reduced __gap, implemented registryNonce(), getRegistryStateHash(), _emitStateChange(), wired into mutations
- `contracts/src/libraries/EventsLib.sol` - Modified: Added RegistryStateChanged event
- `contracts/src/interfaces/IIssuerRegistry.sol` - Modified: Added registryNonce() and getRegistryStateHash() function signatures
- `contracts/test/IssuerRegistry.t.sol` - Modified: Added 9 new tests for Story 8.1

### Change Log

- 2026-02-04: Implemented Story 8.1 - RegistryStateChanged event and _emitStateChange() for MirrorIssuerRegistry sync. 103 tests passing (91 existing + 12 new).
- 2026-02-04: Code review fixes - Added 3 event order tests (AC5-7), enhanced _emitStateChange() NatSpec.
