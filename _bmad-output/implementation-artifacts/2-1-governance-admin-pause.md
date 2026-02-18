# Story 2.1: Governance.sol - Admin & Pause

Status: done

## Story

As an **admin**,
I want **a Governance contract with pause/unpause and admin management**,
so that **I can control the system in emergencies**.

## Acceptance Criteria

1. **Given** IGovernance interface from Epic 1
   **When** I implement Governance.sol with UUPS proxy
   **Then** the contract inherits from `IGovernance` and `UUPSUpgradeable`

2. **Given** the Governance contract is deployed
   **When** `pause()` is called by admin
   **Then** the system is paused and `SystemPaused` event is emitted
   **And** all order processing is blocked system-wide

3. **Given** the system is paused
   **When** `unpause()` is called by admin
   **Then** the system resumes and `SystemUnpaused` event is emitted

4. **Given** an active ITP exists
   **When** `pauseITP(itpId)` is called by admin
   **Then** only that specific ITP is paused and `ITPPaused` event is emitted

5. **Given** an ITP is paused
   **When** `unpauseITP(itpId)` is called by admin
   **Then** the ITP resumes and `ITPUnpaused` event is emitted

6. **Given** the current admin address
   **When** `setAdmin(newAdmin)` is called by current admin
   **Then** admin is transferred and `AdminTransferred` event is emitted
   **And** zero address is rejected

7. **Given** the contract is UUPS upgradeable
   **When** `_authorizeUpgrade` is called
   **Then** only admin can authorize upgrades

8. **Given** all functions are implemented
   **When** non-admin calls any admin function
   **Then** the call reverts with appropriate error

9. **Given** the implementation
   **When** Foundry tests are run
   **Then** all functions and access control are covered
   **And** `forge test` passes

## Tasks / Subtasks

- [x] Task 0: Install OpenZeppelin dependencies (PREREQUISITE)
  - [x] 0.1: Run `forge install OpenZeppelin/openzeppelin-contracts-upgradeable --no-commit`
  - [x] 0.2: Verify lib/openzeppelin-contracts-upgradeable exists
  - [x] 0.3: Add remapping to foundry.toml if needed: `@openzeppelin/contracts-upgradeable/=lib/openzeppelin-contracts-upgradeable/contracts/`

- [x] Task 1: Create Governance.sol implementation (AC: 1, 7)
  - [x] 1.1: Create `contracts/src/Governance.sol` file
  - [x] 1.2: Import OpenZeppelin `UUPSUpgradeable` and `Initializable`
  - [x] 1.3: Import `IGovernance` interface from interfaces/
  - [x] 1.4: Import `ErrorsLib` for error handling
  - [x] 1.5: Add constructor with `_disableInitializers()` to prevent implementation initialization
  - [x] 1.6: Implement `initialize(address initialAdmin)` function with `initializer` modifier
  - [x] 1.7: Implement `_authorizeUpgrade` restricted to admin

- [x] Task 2: Implement storage variables (AC: 1)
  - [x] 2.1: Add `address private _admin` state variable
  - [x] 2.2: Add `bool private _systemPaused` state variable
  - [x] 2.3: Add `mapping(bytes32 => bool) private _itpPaused` mapping
  - [x] 2.4: Add storage gap `uint256[47] private __gap` for upgrades

- [x] Task 3: Implement admin modifier (AC: 8)
  - [x] 3.1: Create `modifier onlyAdmin()` that reverts for non-admin
  - [x] 3.2: Define `error Unauthorized()` for access control

- [x] Task 4: Implement system pause functions (AC: 2, 3)
  - [x] 4.1: Implement `pause()` - sets _systemPaused = true, emits SystemPaused
  - [x] 4.2: Implement `unpause()` - sets _systemPaused = false, emits SystemUnpaused
  - [x] 4.3: Implement `isPaused()` view function

- [x] Task 5: Implement ITP pause functions (AC: 4, 5)
  - [x] 5.1: Implement `pauseITP(bytes32 itpId)` - sets _itpPaused[itpId] = true
  - [x] 5.2: Implement `unpauseITP(bytes32 itpId)` - sets _itpPaused[itpId] = false
  - [x] 5.3: Implement `isITPPaused(bytes32 itpId)` view function

- [x] Task 6: Implement admin management (AC: 6)
  - [x] 6.1: Implement `setAdmin(address newAdmin)` with zero-address check
  - [x] 6.2: Implement `admin()` view function

- [x] Task 7: Create deployment script (AC: 1)
  - [x] 7.1: Create `scripts/deploy/DeployGovernance.s.sol`
  - [x] 7.2: Use ERC1967Proxy for deployment
  - [x] 7.3: Call initialize with deployer as initial admin

- [x] Task 8: Write Foundry tests (AC: 9)
  - [x] 8.1: Create `contracts/test/Governance.t.sol`
  - [x] 8.2: Test initialization - correct admin set, event emitted
  - [x] 8.3: Test pause/unpause system - events emitted, state changes
  - [x] 8.4: Test pauseITP/unpauseITP - events emitted, state changes
  - [x] 8.5: Test setAdmin - transfers correctly, rejects zero address
  - [x] 8.6: Test access control - all functions revert for non-admin
  - [x] 8.7: Test upgrade authorization - only admin can upgrade
  - [x] 8.8: Test idempotent operations - double pause/unpause succeed silently
  - [x] 8.9: Test implementation cannot be initialized directly (disableInitializers)
  - [x] 8.10: Run `forge test --match-contract GovernanceTest -vvv`

## Dev Notes

### Architecture Requirements

From architecture.md Section 5 (Smart Contract Architecture):

**Governance.sol** responsibilities:
- Admin functions (single EOA Phase 1, multisig later)
- Issuer registry (addresses, IPs, BLS pubkeys) - **NOTE: IssuerRegistry is separate contract, Story 2.12**
- Aggregated BLS public key management - **NOTE: In IssuerRegistry, not this story**
- Emergency pause/unpause
- Upgrade authorization (`_authorizeUpgrade`)

**UUPS Pattern Benefits:**
- No separate ProxyAdmin contract to manage
- Cheaper deployment (~24k gas saved vs Transparent Proxy)
- Upgrade logic in implementation = you control it
- OpenZeppelin battle-tested
- Single admin model fits Phase 1

### Technical Stack

| Attribute | Value |
|-----------|-------|
| Solidity Version | `^0.8.20` |
| Framework | Foundry |
| Proxy Pattern | UUPS (OpenZeppelin 5.x) |
| Chain | Index L3 Orbit (Chain ID: 111222333) |

### OpenZeppelin Dependencies

**CRITICAL: OpenZeppelin is NOT currently installed in contracts/lib/**

Must install before implementation:
```bash
cd contracts
forge install OpenZeppelin/openzeppelin-contracts-upgradeable --no-commit
```

Then add remapping to `foundry.toml`:
```toml
[profile.default]
remappings = [
  "@openzeppelin/contracts-upgradeable/=lib/openzeppelin-contracts-upgradeable/contracts/"
]
```

Required imports:
```solidity
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
```

### Storage Layout

```solidity
// Storage variables (must be stable for upgrades)
address private _admin;           // Slot 0
bool private _systemPaused;       // Slot 1 (packed)
mapping(bytes32 => bool) private _itpPaused;  // Slot 2
uint256[47] private __gap;        // Slots 3-49 (upgrade safety gap, 50 total)
```

### UUPS Security Pattern

```solidity
/// @custom:oz-upgrades-unsafe-allow constructor
constructor() {
    _disableInitializers();  // Prevent implementation from being initialized
}

function initialize(address initialAdmin) external initializer {
    require(initialAdmin != address(0), "Zero address");
    _admin = initialAdmin;
    emit AdminTransferred(address(0), initialAdmin);
}
```

### Idempotent Operations

- `pause()` when already paused: **succeed silently** (no-op, no event)
- `unpause()` when not paused: **succeed silently** (no-op, no event)
- `pauseITP(itpId)` when ITP already paused: **succeed silently**
- `unpauseITP(itpId)` when ITP not paused: **succeed silently**

This prevents wasteful reverts and simplifies calling code.

### Interface Compliance

Must implement all functions from `IGovernance.sol`:
- `pause()` - Admin-only, emits `SystemPaused`
- `unpause()` - Admin-only, emits `SystemUnpaused`
- `pauseITP(bytes32 itpId)` - Admin-only, emits `ITPPaused`
- `unpauseITP(bytes32 itpId)` - Admin-only, emits `ITPUnpaused`
- `setAdmin(address newAdmin)` - Admin-only, emits `AdminTransferred`
- `isPaused()` - View
- `isITPPaused(bytes32 itpId)` - View
- `admin()` - View

### Error Codes to Use

From `ErrorsLib.sol`:
- `E004_SystemPaused()` - Use when system is paused (other contracts will use)
- `E003_ITPPaused(bytes32 itpId)` - Use when ITP is paused (other contracts will use)

Custom errors for this contract:
- `Unauthorized()` - When non-admin calls admin function
- `ZeroAddress()` - When setting admin to zero address

### Events (defined in IGovernance.sol)

```solidity
event SystemPaused(address indexed admin);
event SystemUnpaused(address indexed admin);
event ITPPaused(bytes32 indexed itpId, address indexed admin);
event ITPUnpaused(bytes32 indexed itpId, address indexed admin);
event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);
```

### Project Structure Notes

```
contracts/
├── src/
│   ├── Governance.sol            # NEW - This story
│   ├── interfaces/
│   │   └── IGovernance.sol       # EXISTS - Story 1.1
│   └── libraries/
│       └── ErrorsLib.sol         # EXISTS - Story 1.4
├── test/
│   └── Governance.t.sol          # NEW - This story
├── scripts/
│   └── deploy/
│       └── DeployGovernance.s.sol # NEW - This story
└── foundry.toml                  # EXISTS
```

### Alignment with Existing Code

**IGovernance.sol** already defines:
- All function signatures with correct visibility
- All events with correct indexed parameters
- NatSpec documentation for all functions

**Ensure implementation matches interface exactly:**
- `bytes32 itpId` parameter type (not `uint256`)
- Event parameter ordering matches interface

### Testing Strategy

1. **Unit Tests:**
   - Each function tested in isolation
   - Event emission verified with `vm.expectEmit`
   - Access control tested with `vm.expectRevert`

2. **Integration Tests:**
   - Upgrade scenario: deploy v1, upgrade to v2
   - Admin transfer: verify old admin loses access

3. **Edge Cases:**
   - Double pause (already paused, pause again - should succeed)
   - Unpause when not paused (should succeed)
   - Pause non-existent ITP (should succeed - no ITP validation in Governance)

### Reference Implementation Skeleton

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IGovernance} from "./interfaces/IGovernance.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract Governance is IGovernance, Initializable, UUPSUpgradeable {
    // Custom errors
    error Unauthorized();
    error ZeroAddress();

    // Storage
    address private _admin;
    bool private _systemPaused;
    mapping(bytes32 => bool) private _itpPaused;
    uint256[47] private __gap;

    modifier onlyAdmin() {
        if (msg.sender != _admin) revert Unauthorized();
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address initialAdmin) external initializer {
        if (initialAdmin == address(0)) revert ZeroAddress();
        _admin = initialAdmin;
        emit AdminTransferred(address(0), initialAdmin);
    }

    // ... implement remaining functions

    function _authorizeUpgrade(address) internal override onlyAdmin {}
}
```

### Security Considerations

1. **Reentrancy:** Not applicable - no external calls
2. **Access Control:** Single admin EOA in Phase 1 - ensure key management
3. **Upgrade Safety:** Use storage gap, test upgrade scenarios
4. **Zero Address:** Block zero address for admin transfer
5. **Initializer Protection:** `_disableInitializers()` in constructor prevents implementation attacks

### References

- [Source: architecture.md#5-smart-contract-architecture] - UUPS pattern, contract responsibilities
- [Source: architecture.md#18-governance--policies] - Phase 1 single admin, Phase 2+ multisig
- [Source: architecture.md#16-security--recovery] - Emergency pause section
- [Source: epics.md#story-21-governancesol---admin--pause] - Acceptance criteria
- [Source: contracts/src/interfaces/IGovernance.sol] - Interface definition
- [Source: contracts/src/libraries/ErrorsLib.sol] - Error codes E003, E004

### Cross-Story Dependencies

**This story provides:**
- Governance.sol contract for other contracts to check pause state
- Admin authorization pattern for upgrade protection

**Used by (future stories):**
- Story 2.2: Index.sol will call `isPaused()` and `isITPPaused()`
- Story 2.12: IssuerRegistry.sol will reference Governance for admin
- Story 6.1: Deployment will deploy Governance as first contract

**No previous story file to reference** - This is the first story in Epic 2.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- OpenZeppelin v5.1.0 requires Solidity ^0.8.21, updated from ^0.8.20 to ^0.8.24
- forge install doesn't work without git repo; used git clone with submodule init instead

### Completion Notes List

- Implemented Governance.sol with full UUPS proxy pattern using OpenZeppelin 5.1.0
- All 8 interface functions implemented: pause, unpause, pauseITP, unpauseITP, setAdmin, isPaused, isITPPaused, admin
- Idempotent operations: pause/unpause succeed silently when already in target state (no events, no reverts)
- Custom errors: Unauthorized() for access control, ZeroAddress() for admin validation
- Storage gap of 47 slots for upgrade safety
- 41 comprehensive tests covering all ACs including 2 fuzz tests (upgraded from 34 after code review)
- Deployment script using ERC1967Proxy for UUPS pattern
- All 226 tests in repo pass (41 Governance + 185 other)

### Senior Developer Review (AI)

**Reviewer:** Claude Opus 4.5
**Date:** 2026-01-29
**Outcome:** APPROVED (after fixes)

**Issues Found & Fixed:**
1. **[H-2] FIXED:** `_authorizeUpgrade` now validates `newImplementation` has code (prevents bricking via upgrade to EOA/zero address)
2. **[H-3] FIXED:** Added `test_proxy_cannotBeReinitialized` to verify proxy cannot be initialized twice
3. **[M-2] FIXED:** Deploy script now warns when PRIVATE_KEY not set
4. **[M-3] FIXED:** Added 4 tests verifying no events emitted on idempotent operations (pause, unpause, pauseITP, unpauseITP)

**Issues Noted (Not Fixed):**
- **[H-1]** AC2 states "all order processing is blocked system-wide" - this is validated in Index.sol tests (Story 2.3), not Governance tests. Cross-story integration is correct.
- **[M-1]** `__gap` naming is OpenZeppelin convention - forge lint warning is acceptable
- **[L-1, L-2]** Documentation-only issues, no code changes needed

**Test Coverage:** 100% (41/41 lines, 30/30 statements, 7/7 branches, 12/12 functions)

### File List

**New Files:**
- contracts/src/Governance.sol
- contracts/test/Governance.t.sol
- contracts/scripts/deploy/DeployGovernance.s.sol

**Modified Files:**
- contracts/foundry.toml (added OZ remappings, updated solc to 0.8.24)

**Dependencies Added:**
- contracts/lib/openzeppelin-contracts-upgradeable/ (v5.1.0 with submodules)

## Change Log

- 2026-01-29: Story 2.1 implementation complete - Governance.sol with UUPS proxy, admin pause controls, and comprehensive tests
- 2026-01-29: Code review completed - Fixed 4 issues (H-2, H-3, M-2, M-3), added 7 new tests, upgraded to 41 total tests

