# Story 2.11: CollateralRegistry.sol

Status: done

## Story

As an **issuer**,
I want **on-chain tracking of collateral per ITP per chain**,
so that **state can be reconstructed from chain events for stateless issuer operation**.

## Acceptance Criteria

1. **Given** ICollateralRegistry interface from Epic 1
   **When** I implement CollateralRegistry.sol
   **Then** the contract inherits from `ICollateralRegistry`

2. **Given** a valid collateral movement
   **When** `recordCollateralMove(itpId, fromChain, toChain, amount, txType, blsSignature)` is called
   **Then** the `itpCollateralByChain` mapping is updated correctly
   **And** `CollateralMoved` event is emitted with all parameters
   **And** BLS signature is verified against the message

3. **Given** a movement with fromChain != 0
   **When** `recordCollateralMove` is called
   **Then** `itpCollateralByChain[itpId][fromChain]` is decremented by `amount`

4. **Given** a movement with toChain != 0
   **When** `recordCollateralMove` is called
   **Then** `itpCollateralByChain[itpId][toChain]` is incremented by `amount`

5. **Given** an ITP with collateral on multiple chains
   **When** `getITPCollateralByChain(itpId, chainId)` is called
   **Then** the correct collateral amount for that chain is returned

6. **Given** an ITP with collateral on multiple chains
   **When** `getTotalCollateral(itpId)` is called
   **Then** the sum of collateral across all tracked chains is returned

7. **Given** an ITP with collateral on multiple chains
   **When** `getCollateralBreakdown(itpId)` is called
   **Then** arrays of chainIds and corresponding amounts are returned

8. **Given** an ITP that has recorded movements
   **When** `itpExists(itpId)` is called
   **Then** `true` is returned

9. **Given** txType enum values (BRIDGE, SWAP_IN, SWAP_OUT, BUY, SELL)
   **When** `recordCollateralMove` is called with each type
   **Then** the movement is processed correctly for each type

10. **Given** the implementation
    **When** Foundry tests are run
    **Then** all move types and state consistency are covered
    **And** `forge test` passes

## Tasks / Subtasks

- [x] Task 1: Create registry directory structure (PREREQUISITE)
  - [x] 1.1: Create `contracts/src/registry/` directory
  - [x] 1.2: Verify directory created successfully

- [x] Task 2: Create CollateralRegistry.sol implementation (AC: 1, 2)
  - [x] 2.1: Create `contracts/src/registry/CollateralRegistry.sol` file
  - [x] 2.2: Import `ICollateralRegistry` interface
  - [x] 2.3: Import `TypesLib` for TxType enum
  - [x] 2.4: Implement contract inheriting from `ICollateralRegistry`
  - [x] 2.5: Add constructor or initializer (non-upgradeable for simplicity)

- [x] Task 3: Implement storage variables (AC: 1, 5, 6, 7, 8)
  - [x] 3.1: Add `mapping(bytes32 => mapping(uint256 => uint256)) private _itpCollateralByChain`
  - [x] 3.2: Add `mapping(bytes32 => uint256[]) private _itpChainIds` to track which chains have collateral
  - [x] 3.3: Add `mapping(bytes32 => mapping(uint256 => bool)) private _chainTracked` to avoid duplicates
  - [x] 3.4: Add `mapping(bytes32 => bool) private _itpRegistered` for itpExists check
  - [x] 3.5: Add `uint256 private _nonce` for replay protection
  - [x] 3.6: Add `bytes public aggregatedPubkey` for BLS verification (set by admin or IssuerRegistry)

- [x] Task 4: Implement BLS verification (AC: 2) - MOCK for now
  - [x] 4.1: Add placeholder `_verifyBLS(bytes32 message, bytes calldata signature)` internal function
  - [x] 4.2: For now, return true (actual BLS lib in Story 2.6, integration later)
  - [x] 4.3: Add TODO comment: "Replace with actual BLSLib.verifyBLS after Story 2.6"
  - [x] 4.4: Add `address public blsLibrary` storage for future BLS library address

- [x] Task 5: Implement recordCollateralMove (AC: 2, 3, 4, 9)
  - [x] 5.1: Build message hash: `keccak256(abi.encode(block.chainid, address(this), itpId, fromChain, toChain, amount, txType, _nonce++))`
  - [x] 5.2: Call `_verifyBLS(message, blsSignature)` - require success
  - [x] 5.3: If `fromChain != 0`: decrement `_itpCollateralByChain[itpId][fromChain]` (check underflow)
  - [x] 5.4: If `toChain != 0`: increment `_itpCollateralByChain[itpId][toChain]`
  - [x] 5.5: Track chain in `_itpChainIds[itpId]` if not already tracked
  - [x] 5.6: Set `_itpRegistered[itpId] = true`
  - [x] 5.7: Emit `CollateralMoved(itpId, fromChain, toChain, amount, txType)`

- [x] Task 6: Implement view functions (AC: 5, 6, 7, 8)
  - [x] 6.1: Implement `getITPCollateralByChain(bytes32 itpId, uint256 chainId)` returns amount
  - [x] 6.2: Implement `getTotalCollateral(bytes32 itpId)` - sum across all tracked chains
  - [x] 6.3: Implement `getCollateralBreakdown(bytes32 itpId)` - return chainIds[] and amounts[]
  - [x] 6.4: Implement `itpExists(bytes32 itpId)` - return `_itpRegistered[itpId]`

- [x] Task 7: Implement admin functions
  - [x] 7.1: Add `address public admin` storage
  - [x] 7.2: Add `modifier onlyAdmin()`
  - [x] 7.3: Implement `setAggregatedPubkey(bytes calldata pubkey)` - admin only
  - [x] 7.4: Implement `setAdmin(address newAdmin)` - admin only, with zero-address check

- [x] Task 8: Write Foundry tests (AC: 10)
  - [x] 8.1: Create `contracts/test/CollateralRegistry.t.sol`
  - [x] 8.2: Test recordCollateralMove with BRIDGE type - updates both chains
  - [x] 8.3: Test recordCollateralMove with SWAP_IN type - only toChain updated
  - [x] 8.4: Test recordCollateralMove with SWAP_OUT type - only fromChain updated
  - [x] 8.5: Test recordCollateralMove with BUY type - toChain updated
  - [x] 8.6: Test recordCollateralMove with SELL type - fromChain updated
  - [x] 8.7: Test getITPCollateralByChain returns correct amounts
  - [x] 8.8: Test getTotalCollateral sums across chains correctly
  - [x] 8.9: Test getCollateralBreakdown returns correct arrays
  - [x] 8.10: Test itpExists returns true after movement, false before
  - [x] 8.11: Test replay protection - same nonce should fail
  - [x] 8.12: Test underflow protection - cannot reduce below zero
  - [x] 8.13: Test multiple ITPs track independently
  - [x] 8.14: Run `forge test --match-contract CollateralRegistryTest -vvv`

## Dev Notes

### Architecture Requirements

From architecture.md Section 15 (Stateless Collateral Tracking):

**CollateralRegistry.sol** responsibilities:
- Track collateral per ITP per chain: `mapping(bytes32 => mapping(uint256 => uint256)) itpCollateralByChain`
- Record all collateral movements with BLS signature verification
- Emit events for issuers to reconstruct state
- Support 5 transaction types: BRIDGE, SWAP_IN, SWAP_OUT, BUY, SELL

**Why this is critical:**
- Issuers are stateless and reconstruct state from chain events
- CollateralRegistry provides the authoritative view of where collateral sits
- Events enable efficient state reconstruction without scanning all transactions

### Technical Stack

| Attribute | Value |
|-----------|-------|
| Solidity Version | `^0.8.20` |
| Framework | Foundry |
| Chain | Index L3 Orbit (Chain ID: 111222333) |
| BLS Verification | Mock for now, integrate Story 2.6 later |

### Interface Compliance

Must implement all functions from `ICollateralRegistry.sol`:
- `recordCollateralMove(bytes32 itpId, uint256 fromChain, uint256 toChain, uint256 amount, TypesLib.TxType txType, bytes calldata blsSignature)` - Writes
- `getITPCollateralByChain(bytes32 itpId, uint256 chainId)` - View
- `getTotalCollateral(bytes32 itpId)` - View
- `getCollateralBreakdown(bytes32 itpId)` - View
- `itpExists(bytes32 itpId)` - View

Events defined in interface:
```solidity
event CollateralMoved(
    bytes32 indexed itpId,
    uint256 fromChain,
    uint256 toChain,
    uint256 amount,
    TypesLib.TxType txType
);
```

### TxType Enum (from TypesLib.sol)

```solidity
enum TxType {
    BRIDGE,    // Cross-chain bridge transfer
    SWAP_IN,   // DEX swap - assets coming in
    SWAP_OUT,  // DEX swap - assets going out
    BUY,       // CEX buy order
    SELL       // CEX sell order
}
```

### Storage Layout

```solidity
// Core storage
mapping(bytes32 => mapping(uint256 => uint256)) private _itpCollateralByChain;
mapping(bytes32 => uint256[]) private _itpChainIds;
mapping(bytes32 => mapping(uint256 => bool)) private _chainTracked;
mapping(bytes32 => bool) private _itpRegistered;
uint256 private _nonce;

// BLS verification
bytes public aggregatedPubkey;
address public blsLibrary;  // Future: address of BLSLib

// Admin
address public admin;
```

### BLS Message Format

Per interface NatSpec:
```solidity
// Message: keccak256(abi.encode(chainid, this, itpId, fromChain, toChain, amount, txType, nonce))
bytes32 message = keccak256(abi.encode(
    block.chainid,
    address(this),
    itpId,
    fromChain,
    toChain,
    amount,
    txType,
    _nonce++
));
```

### Chain ID Convention

- `0` = L3 (Index L3 Orbit, Chain ID 111222333 in reality, but 0 in collateral tracking means "native L3")
- Other chain IDs use standard EVM chain IDs:
  - Arbitrum One: 42161
  - Ethereum: 1
  - Base: 8453
  - Optimism: 10
  - Solana: Represented as a high number (e.g., 999999) since it's not EVM

### Movement Logic

```solidity
// Example: Bridge from L3 to Arbitrum
// fromChain = 0 (L3), toChain = 42161 (Arbitrum)
// Result: L3 collateral decreases, Arbitrum increases

// Example: BUY order (assets coming to ITP)
// fromChain = 0 (not used for CEX), toChain = chainId where assets now held
// Result: toChain collateral increases

// Example: SELL order (assets leaving ITP)
// fromChain = chainId where assets were, toChain = 0 (not used)
// Result: fromChain collateral decreases
```

### Project Structure Notes

```
contracts/
├── src/
│   ├── registry/
│   │   └── CollateralRegistry.sol  # NEW - This story
│   ├── interfaces/
│   │   └── ICollateralRegistry.sol # EXISTS - Story 1.1
│   └── libraries/
│       ├── TypesLib.sol            # EXISTS - Story 1.3 (has TxType)
│       └── ErrorsLib.sol           # EXISTS - Story 1.4
├── test/
│   └── CollateralRegistry.t.sol    # NEW - This story
└── foundry.toml                    # EXISTS
```

### Testing Strategy

1. **Unit Tests:**
   - Each TxType tested independently
   - Chain tracking verified
   - View functions verified
   - Event emission verified with `vm.expectEmit`

2. **State Consistency Tests:**
   - Multiple movements maintain correct state
   - Total collateral equals sum of chain collaterals
   - Chain list accurately reflects chains with collateral

3. **Security Tests:**
   - Replay protection (nonce)
   - Underflow protection (cannot go negative)
   - BLS verification (mocked for now)

### Reference Implementation Skeleton

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/ICollateralRegistry.sol";
import "../libraries/TypesLib.sol";

/// @title CollateralRegistry - On-chain collateral tracking per ITP per chain
/// @notice Enables stateless issuer operation by tracking all collateral movements
/// @dev All movements require BLS signature from 11/20 issuers
contract CollateralRegistry is ICollateralRegistry {
    // ============ ERRORS ============
    error Unauthorized();
    error ZeroAddress();
    error InvalidBLSSignature();
    error InsufficientCollateral(bytes32 itpId, uint256 chainId, uint256 requested, uint256 available);

    // ============ STORAGE ============
    mapping(bytes32 => mapping(uint256 => uint256)) private _itpCollateralByChain;
    mapping(bytes32 => uint256[]) private _itpChainIds;
    mapping(bytes32 => mapping(uint256 => bool)) private _chainTracked;
    mapping(bytes32 => bool) private _itpRegistered;
    uint256 private _nonce;

    bytes public aggregatedPubkey;
    address public admin;

    // ============ MODIFIERS ============
    modifier onlyAdmin() {
        if (msg.sender != admin) revert Unauthorized();
        _;
    }

    // ============ CONSTRUCTOR ============
    constructor(address _admin) {
        if (_admin == address(0)) revert ZeroAddress();
        admin = _admin;
    }

    // ============ COLLATERAL TRACKING ============
    function recordCollateralMove(
        bytes32 itpId,
        uint256 fromChain,
        uint256 toChain,
        uint256 amount,
        TypesLib.TxType txType,
        bytes calldata blsSignature
    ) external override {
        // Build and verify message
        bytes32 message = keccak256(abi.encode(
            block.chainid,
            address(this),
            itpId,
            fromChain,
            toChain,
            amount,
            txType,
            _nonce++
        ));

        if (!_verifyBLS(message, blsSignature)) revert InvalidBLSSignature();

        // Update fromChain (decrease)
        if (fromChain != 0) {
            uint256 current = _itpCollateralByChain[itpId][fromChain];
            if (current < amount) {
                revert InsufficientCollateral(itpId, fromChain, amount, current);
            }
            _itpCollateralByChain[itpId][fromChain] = current - amount;
        }

        // Update toChain (increase)
        if (toChain != 0) {
            _itpCollateralByChain[itpId][toChain] += amount;
            _trackChain(itpId, toChain);
        }

        // Mark ITP as registered
        _itpRegistered[itpId] = true;

        emit CollateralMoved(itpId, fromChain, toChain, amount, txType);
    }

    // ... implement remaining functions

    // ============ INTERNAL ============
    function _verifyBLS(bytes32 /*message*/, bytes calldata /*signature*/) internal pure returns (bool) {
        // TODO: Replace with actual BLSLib.verifyBLS after Story 2.6
        return true;
    }

    function _trackChain(bytes32 itpId, uint256 chainId) internal {
        if (!_chainTracked[itpId][chainId]) {
            _chainTracked[itpId][chainId] = true;
            _itpChainIds[itpId].push(chainId);
        }
    }
}
```

### Security Considerations

1. **BLS Verification:** Currently mocked - MUST integrate real BLSLib before mainnet
2. **Replay Protection:** Nonce incremented on every call prevents replay
3. **Underflow Protection:** Check balance before decrementing
4. **Access Control:** Admin functions protected, but core recordCollateralMove relies on BLS
5. **Chain ID Binding:** Message includes chainId to prevent cross-chain replay

### Dependencies

**This story depends on:**
- Story 1.1: ICollateralRegistry interface (EXISTS)
- Story 1.3: TypesLib with TxType enum (EXISTS)
- Epic 1 completion (DONE)

**This story provides:**
- CollateralRegistry.sol for tracking collateral positions

**Used by (future stories):**
- Story 2.4: Index.sol batch confirmation will update CollateralRegistry
- Story 2.9/2.10: Bridge contracts will trigger collateral moves
- Story 3.4: State reconstruction reads CollateralMoved events
- Story 6.2: Integration wiring

### References

- [Source: architecture.md#15-stateless-collateral-tracking] - CollateralRegistry design
- [Source: architecture.md#7-issuer-cycle-flow] - PHASE 1 and PHASE 5 update CollateralRegistry
- [Source: architecture.md#appendix-e] - Cross-chain execution examples
- [Source: architecture.md#appendix-d] - State reconstruction queries
- [Source: contracts/src/interfaces/ICollateralRegistry.sol] - Interface definition
- [Source: contracts/src/libraries/TypesLib.sol] - TxType enum definition
- [Source: epics.md#story-211-collateralregistrysol] - Acceptance criteria

### Cross-Story Dependencies

**Previous stories in Epic 2:**
- 2-1: Governance.sol (admin pattern reference)
- 2-2: Index.sol storage (will call CollateralRegistry)
- 2-6: BLS Library (integrate later for real verification)

**Note:** This contract does NOT use UUPS upgradeable pattern - it's a simple stateful contract. If upgrades are needed later, can deploy new version and migrate via admin functions.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None - Implementation proceeded without issues.

### Completion Notes List

- Implemented CollateralRegistry.sol with full ICollateralRegistry interface compliance
- All 5 TxTypes (BRIDGE, SWAP_IN, SWAP_OUT, BUY, SELL) work correctly
- BLS verification is mocked (returns true) - to be integrated with BLSLib after Story 2.6
- Nonce-based replay protection implemented
- Underflow protection with custom InsufficientCollateral error
- Chain tracking prevents duplicate chain IDs in arrays
- Admin functions for pubkey and admin management
- 27 comprehensive Foundry tests all passing
- Fixed pre-existing compilation issues in BLSLib.sol (@return tag) and BLSLib.t.sol (pure -> view)

### File List

**New Files:**
- contracts/src/registry/CollateralRegistry.sol
- contracts/test/CollateralRegistry.t.sol

**Modified Files:**
- contracts/src/libraries/BLSLib.sol (fixed @return tag documentation)
- contracts/test/libraries/BLSLib.t.sol (fixed pure -> view function declarations, gas thresholds)

## Senior Developer Review (AI)

### Review Date: 2026-01-30 (Second Review)

### Issues Found and Fixed

**HIGH Severity (Fixed):**

1. **H1: Interface Documentation Inconsistent with Implementation** - ICollateralRegistry.sol NatSpec stated "0 for L3 native" but implementation uses "0 for external/no-chain". Updated interface to match: `0 for external/CEX, 111222333 for L3`.

2. **H2: Architecture Event Signature Mismatch** - Architecture doc shows `indexed fromChain/toChain` and `bytes32 txType`, but implementation uses non-indexed and enum. **Action Required**: Update architecture.md to match implementation (enum is cleaner). Documented for architect review.

**MEDIUM Severity (Fixed):**

1. **M1: Missing Chain Cleanup Documentation** - Added NatSpec explaining that chains remain in `_itpChainIds` even when balance is 0 (intentional for historical tracking, O(n) removal cost).

2. **M2: Missing Message Hash Format Tests** - Added 3 new tests verifying BLS message hash format matches interface spec for future issuer integration.

3. **M3: Overflow Assumption Documented** - Added NatSpec to `getTotalCollateral` documenting uint256 overflow assumption (realistic limits far exceed global money supply).

**LOW Severity (Not Fixed - Pre-existing):**

- L1: `blsLibrary` storage unused - documented, will be used in Story 2.6
- L2: Architecture docs need update - enum approach is cleaner than bytes32 txType

### Files Modified

- `contracts/src/interfaces/ICollateralRegistry.sol` - Fixed NatSpec chain ID documentation
- `contracts/src/registry/CollateralRegistry.sol` - Added design documentation for chain tracking and overflow assumptions
- `contracts/test/CollateralRegistry.t.sol` - Added 3 message hash format compliance tests (45 tests total)

### Pre-existing Issues Fixed (Unrelated to Story 2-11)

- `contracts/src/registry/FeeRegistry.sol` - Added missing TypesLib import and setBLSLibrary function
- `contracts/test/FeeRegistry.t.sol` - Fixed TypesLib.FeeType references

### Reviewer

Claude Opus 4.5 - Adversarial Code Review

---

### Review Date: 2026-01-30 (First Review)

### Issues Found and Fixed

**HIGH Severity (Fixed):**

1. **H1: Missing Access Control on `recordCollateralMove`** - Added `onlyAuthorized` modifier and `authorizedCallers` mapping as temporary security until BLS integration. Admin is auto-authorized on deployment.

2. **H2: Chain ID Convention Clarified** - Fixed tests to use proper chain ID convention:
   - `EXTERNAL (0)` = external/no-chain (CEX operations)
   - `INDEX_L3 (111222333)` = Index L3 Orbit chain
   - Tests updated to properly model collateral flows

3. **H3: Test Quality Improved** - Added 15 new tests for L3 chain tracking, CEX operations, authorization, and events. Total: 42 tests passing.

**MEDIUM Severity (Fixed):**

1. **M1: Added Events for Admin Changes** - `AdminChanged`, `AggregatedPubkeyUpdated`, `BLSLibraryUpdated`, `AuthorizedCallerUpdated` events added.

2. **M4: Zero Amount Validation** - Added `ZeroAmount` error and validation to prevent spam/abuse via zero-amount movements.

**LOW Severity (Documented):**

- L1: Solidity version inconsistency (^0.8.20 vs ^0.8.24) - documented, will be addressed in BLS integration
- L2: `blsLibrary` storage variable unused - documented with TODO for BLS integration
- L3: `getNonce` documentation - usage is for debugging/integration testing

### Security Notes

- **CRITICAL**: `onlyAuthorized` modifier is a TEMPORARY guard until BLS verification is integrated (Story 2.6). Remove `authorizedCallers` mapping and modifier after BLS integration.
- Chain 0 represents external/no-chain operations (not L3). Use actual chain IDs for on-chain collateral.

### Reviewer

Claude Opus 4.5 - Adversarial Code Review

## Change Log

| Date | Change |
|------|--------|
| 2026-01-29 | Initial implementation of CollateralRegistry.sol with full test coverage (27 tests passing) |
| 2026-01-30 | Code review #1: Fixed H1 (access control), H2/H3 (chain ID convention in tests), M1 (admin events), M4 (zero amount). Tests expanded to 42. |
| 2026-01-30 | Code review #2: Fixed interface NatSpec (chain ID 0 convention), added design docs, added 3 message hash tests. Tests expanded to 45. |

