# Story 2.14: FeeRegistry.sol - Fee Calculation and Distribution

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **protocol operator**,
I want **on-chain fee calculation and tracking for trading fees, management fees, and bridge/gas costs**,
So that **fees are distributed fairly to ITP deployers, issuers, and the protocol**.

## Acceptance Criteria

1. **Given** the FeeRegistry contract
   **When** I deploy it
   **Then** it inherits from a well-defined `IFeeRegistry` interface

2. **Given** an ITP with a configured fee rate (0-10% annualized)
   **When** `setFeeRate(itpId, feeRate, blsSignature)` is called by issuer consensus
   **Then** the ITP's fee rate is updated
   **And** `FeeRateUpdated` event is emitted

3. **Given** a trade execution
   **When** `recordFeeCharge(user, itpId, feeAmount, feeType, blsSignature)` is called
   **Then** the fee is recorded in the fee pot
   **And** `FeeCharged` event is emitted with user, itpId, amount, and feeType

4. **Given** fee types (TRADING, MANAGEMENT, BRIDGE, GAS)
   **When** fees are recorded with each type
   **Then** each type is tracked separately per ITP

5. **Given** an ITP with accumulated trading fees
   **When** `getAccumulatedFees(itpId)` is called
   **Then** the total accumulated fees (by type) are returned

6. **Given** the fee split configuration (70% deployer, 30% protocol)
   **When** `setFeeSplit(deployerShare, blsSignature)` is called
   **Then** the fee distribution ratios are updated
   **And** `FeeSplitUpdated` event is emitted

7. **Given** accumulated fees in the pot
   **When** `claimFees(itpId, recipient)` is called by the ITP deployer
   **Then** the deployer's share is transferred to the recipient
   **And** `FeesClaimed` event is emitted

8. **Given** small orders incurring high fees relative to order size
   **When** fee > 2% of order amount
   **Then** `isHighFeeOrder(orderAmount, estimatedFee)` returns true (for UI warning)

9. **Given** bridge and gas costs
   **When** fees are allocated proportionally by order size
   **Then** `calculateFeeShare(orderAmount, totalBatchAmount, totalFee)` returns the correct proportional share

10. **Given** the implementation
    **When** Foundry tests are run
    **Then** all fee types, calculations, and distributions are covered
    **And** `forge test` passes

## Tasks / Subtasks

- [x] Task 1: Create IFeeRegistry interface (AC: #1)
  - [x] 1.1: Create `contracts/src/interfaces/IFeeRegistry.sol`
  - [x] 1.2: Define FeeType enum: TRADING, MANAGEMENT, BRIDGE, GAS
  - [x] 1.3: Define all function signatures per acceptance criteria
  - [x] 1.4: Define events: FeeRateUpdated, FeeCharged, FeeSplitUpdated, FeesClaimed

- [x] Task 2: Create FeeRegistry.sol contract (AC: #1)
  - [x] 2.1: Create `contracts/src/registry/FeeRegistry.sol`
  - [x] 2.2: Import IFeeRegistry, TypesLib, ErrorsLib
  - [x] 2.3: Implement storage variables for fee tracking
  - [x] 2.4: Add admin/authorized caller pattern (like CollateralRegistry)
  - [x] 2.5: Add BLS verification placeholder (mock until BLS integration)

- [x] Task 3: Implement fee rate management (AC: #2)
  - [x] 3.1: Add `mapping(bytes32 => uint256) private _feeRates` for per-ITP fee rates
  - [x] 3.2: Implement `setFeeRate(itpId, feeRate, blsSignature)` with BLS verification
  - [x] 3.3: Validate feeRate <= 1000 (10% max, in basis points)
  - [x] 3.4: Emit `FeeRateUpdated(itpId, oldRate, newRate)`

- [x] Task 4: Implement fee recording (AC: #3, #4)
  - [x] 4.1: Add `mapping(bytes32 => mapping(FeeType => uint256)) private _accumulatedFees`
  - [x] 4.2: Implement `recordFeeCharge(user, itpId, feeAmount, feeType, blsSignature)`
  - [x] 4.3: Build message hash with replay protection nonce
  - [x] 4.4: Emit `FeeCharged(user, itpId, feeAmount, feeType)`

- [x] Task 5: Implement fee queries (AC: #5)
  - [x] 5.1: Implement `getAccumulatedFees(itpId)` returning fees by type
  - [x] 5.2: Implement `getFeeRate(itpId)` returning current fee rate
  - [x] 5.3: Implement `getTotalFees(itpId)` returning sum of all fee types

- [x] Task 6: Implement fee distribution (AC: #6, #7)
  - [x] 6.1: Add `uint256 public deployerShareBps` (default 7000 = 70%)
  - [x] 6.2: Add `mapping(bytes32 => uint256) private _claimedFees` for tracking claimed amounts
  - [x] 6.3: Implement `setFeeSplit(deployerShareBps, blsSignature)` - admin/BLS controlled
  - [x] 6.4: Implement `claimFees(itpId, recipient)` - deployer only
  - [x] 6.5: Calculate claimable = (accumulated - claimed) * deployerShare / 10000
  - [x] 6.6: Emit `FeesClaimed(itpId, recipient, amount)`

- [x] Task 7: Implement fee calculation helpers (AC: #8, #9)
  - [x] 7.1: Implement `isHighFeeOrder(orderAmount, estimatedFee)` view function
  - [x] 7.2: High fee threshold: feeAmount * 10000 / orderAmount > 200 (2%)
  - [x] 7.3: Implement `calculateFeeShare(orderAmount, totalBatchAmount, totalFee)` pure function
  - [x] 7.4: Formula: `fee = totalFee * orderAmount / totalBatchAmount`

- [x] Task 8: Add admin functions (similar to CollateralRegistry pattern)
  - [x] 8.1: Add `address public admin` storage
  - [x] 8.2: Add `mapping(address => bool) public authorizedCallers`
  - [x] 8.3: Add `setAdmin(address newAdmin)` function
  - [x] 8.4: Add `setAuthorizedCaller(address caller, bool authorized)` function
  - [x] 8.5: Add `setAggregatedPubkey(bytes calldata pubkey)` function

- [x] Task 9: Write Foundry tests (AC: #10)
  - [x] 9.1: Create `contracts/test/FeeRegistry.t.sol`
  - [x] 9.2: Test setFeeRate with valid rate
  - [x] 9.3: Test setFeeRate revert if rate > 10%
  - [x] 9.4: Test recordFeeCharge for each FeeType
  - [x] 9.5: Test getAccumulatedFees returns correct totals
  - [x] 9.6: Test setFeeSplit updates distribution
  - [x] 9.7: Test claimFees calculates correct deployer share
  - [x] 9.8: Test claimFees only callable by ITP deployer
  - [x] 9.9: Test isHighFeeOrder returns true when fee > 2%
  - [x] 9.10: Test calculateFeeShare proportional calculation
  - [x] 9.11: Test replay protection via nonce
  - [x] 9.12: Run `forge test --match-contract FeeRegistryTest -vvv`

## Dev Notes

### Architecture Requirements (from architecture.md Section 15)

| Fee Type | Details |
|----------|---------|
| Trading Fees | Collected in pot, per-trade |
| Management Fees | Daily, annualized 0-10%, set by deployer |
| ITP Deployer Share | 70% (changeable via BLS) |
| Issuer Compensation | From fee pot, admin splits later |
| Gas (issuers) | Free IND tokens provided |
| Gas (users) | User pays for order submission |

### Fee Flow (from architecture.md Section 8)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        FEE SHARING (STATELESS)                          │
├─────────────────────────────────────────────────────────────────────────┤
│   FEE CALCULATION (proportional to order size):                         │
│   ─────────────────────────────────────────────                         │
│   If bridge happens with $5k minimum threshold:                         │
│     User A order: $1000 (20%) → pays 20% of bridge fee                 │
│     User B order: $3000 (60%) → pays 60% of bridge fee                 │
│     User C order: $1000 (20%) → pays 20% of bridge fee                 │
│                                                                          │
│   EXECUTION FLOW:                                                       │
│   ───────────────                                                       │
│   User submits $1000 order                                              │
│   ↓                                                                     │
│   Issuers batch orders, calculate:                                      │
│     - Bridge needed: yes                                                │
│     - User's share of bridge fee: $1.50                                │
│     - Gas estimate: $0.30                                              │
│     - Total fee: $1.80                                                 │
│   ↓                                                                     │
│   On-chain records:                                                     │
│     - ITP minted for $998.20 worth                                     │
│     - FeeCharged(user, itpId, $1.80, "BRIDGE+GAS")                     │
│                                                                          │
│   MINI ORDER PROTECTION:                                                │
│   ──────────────────────                                                │
│   If fee > 2% of order amount → Warn user before execution             │
│   UI: "Your $50 order has $1.50 fees (3%). Continue?"                  │
└─────────────────────────────────────────────────────────────────────────┘
```

### Contract Architecture

```
contracts/
├── registry/
│   ├── IssuerRegistry.sol     # ✓ Story 2.12/2.13
│   ├── CollateralRegistry.sol # ✓ Story 2.11 (pattern reference)
│   └── FeeRegistry.sol        # ← THIS STORY
├── interfaces/
│   └── IFeeRegistry.sol       # ← THIS STORY
└── libraries/
    └── TypesLib.sol           # Add FeeType enum here
```

### Storage Design (follow CollateralRegistry pattern)

```solidity
// FeeRegistry.sol storage variables
contract FeeRegistry is IFeeRegistry {
    // ============ FEE RATES ============
    /// @notice Fee rate per ITP in basis points (10000 = 100%)
    /// @dev Max 1000 (10% annualized management fee)
    mapping(bytes32 => uint256) private _feeRates;

    // ============ FEE ACCUMULATION ============
    /// @notice Accumulated fees per ITP per fee type (18 decimals)
    mapping(bytes32 => mapping(FeeType => uint256)) private _accumulatedFees;

    /// @notice Already claimed fees per ITP (18 decimals)
    mapping(bytes32 => uint256) private _claimedFees;

    // ============ DISTRIBUTION CONFIG ============
    /// @notice Deployer share in basis points (default 7000 = 70%)
    uint256 public deployerShareBps = 7000;

    // ============ BLS & AUTH ============
    /// @notice Aggregated BLS public key for signature verification
    bytes public aggregatedPubkey;

    /// @notice Replay protection nonce
    uint256 private _nonce;

    /// @notice Admin address
    address public admin;

    /// @notice Authorized callers (temporary until BLS integration)
    mapping(address => bool) public authorizedCallers;

    /// @notice ITP deployer addresses for claim authorization
    /// @dev Should query Index.sol for deployer, or store locally
    mapping(bytes32 => address) private _itpDeployers;
}
```

### FeeType Enum (add to TypesLib.sol or IFeeRegistry.sol)

```solidity
/// @notice Fee types for tracking different cost categories
enum FeeType {
    TRADING,    // Per-trade fees collected
    MANAGEMENT, // Annualized management fees (0-10%)
    BRIDGE,     // Cross-chain bridge costs
    GAS         // Gas costs shared across batch
}
```

### Key Implementation Notes

1. **BLS Verification**: Mock for now (like CollateralRegistry). Add TODO for Story 2.6 integration.

2. **Authorized Callers**: Temporary security pattern until BLS is fully integrated. Admin + authorized callers can record fees.

3. **Fee Calculation**: Off-chain by issuers, recorded on-chain. Registry is passive storage.

4. **Deployer Lookup**: Either:
   - Query Index.sol for ITP creator (requires Index reference)
   - Store deployer mapping locally (simpler, what this story does)

5. **No Token Transfers**: FeeRegistry only tracks amounts. Actual USDC distribution happens via separate mechanism (custody contracts).

### Precision & Constants

```solidity
uint256 constant PRECISION = 1e18;           // 18 decimals for amounts
uint256 constant BASIS_POINTS = 10000;       // 10000 = 100%
uint256 constant MAX_FEE_RATE = 1000;        // 10% max management fee
uint256 constant HIGH_FEE_THRESHOLD = 200;   // 2% = warning threshold
uint256 constant DEFAULT_DEPLOYER_SHARE = 7000; // 70%
```

### Events (from architecture.md Section 15)

```solidity
/// @notice Emitted when ITP fee rate is updated
event FeeRateUpdated(bytes32 indexed itpId, uint256 oldRate, uint256 newRate);

/// @notice Emitted when a fee is charged (per-order or batch)
event FeeCharged(
    address indexed user,
    bytes32 indexed itpId,
    uint256 amount,
    FeeType feeType
);

/// @notice Emitted when fee split ratios are updated
event FeeSplitUpdated(uint256 deployerShareBps);

/// @notice Emitted when fees are claimed by deployer
event FeesClaimed(
    bytes32 indexed itpId,
    address indexed recipient,
    uint256 amount
);
```

### Project Structure Notes

**Files to create:**
1. `contracts/src/interfaces/IFeeRegistry.sol` - Interface definition
2. `contracts/src/registry/FeeRegistry.sol` - Implementation
3. `contracts/test/FeeRegistry.t.sol` - Foundry tests

**Dependencies:**
- TypesLib.sol (for potential FeeType enum or keep in IFeeRegistry)
- ErrorsLib.sol (add fee-related errors if needed)
- CollateralRegistry.sol as pattern reference

### Testing Standards

1. Use Foundry's `forge test` with verbose output
2. Test contract: inherit `Test` from `forge-std`
3. Use `vm.expectRevert()` for error testing
4. Use `vm.expectEmit()` for event testing
5. Use `vm.prank()` for access control testing
6. Test edge cases: zero amounts, max rates, unauthorized access

### References

- [Source: architecture.md#15-economics] - Fee types and distribution
- [Source: architecture.md#8-unified-netting-engine] - Fee allocation in batches
- [Source: architecture.md#5-smart-contract-architecture] - Contract structure
- [Source: epics.md] - FR27: Fee collection (trading + management)
- [Source: contracts/src/registry/CollateralRegistry.sol] - Pattern reference
- [Source: contracts/src/libraries/TypesLib.sol] - Existing types

### Previous Story Intelligence (Story 2.11 CollateralRegistry)

From story 2-11-collateral-registry.md:
- Pattern for registry contracts: constructor with admin, authorized callers, BLS placeholder
- Storage pattern: private mappings with getter functions
- BLS verification is mocked with `_verifyBLS()` returning true
- Events emit all parameters for state reconstruction
- Admin functions follow consistent pattern (setAdmin, setAggregatedPubkey, setAuthorizedCaller)
- Replay protection via incrementing nonce
- Error handling: custom errors (Unauthorized, ZeroAddress, ZeroAmount)

### Dependencies

- **Story 2.2 (Index.sol - Storage & ITP Creation)**: DONE - Provides ITPCore struct with feeRate field
- **Story 2.6 (BLS Library Solidity)**: DONE - Can integrate real BLS verification
- **Story 2.11 (CollateralRegistry.sol)**: In Review - Pattern reference

### Integration Points

1. **Index.sol**: May need to call FeeRegistry to record trading fees
2. **ITPCore.feeRate**: Already exists in TypesLib, but FeeRegistry manages updates
3. **BLSLib**: For signature verification (integrate after Story 2.6)
4. **CollateralRegistry**: Similar pattern, can share auth infrastructure

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None - implementation proceeded without blocking issues.

### Completion Notes List

- Implemented FeeRegistry following CollateralRegistry pattern for consistency
- FeeType enum moved to TypesLib.sol for consistency with other enums (FeeType, OrderStatus, etc.)
- All fee types tracked separately per ITP using nested mappings
- BLS verification mocked (returns true) - TODO for Story 2.6 integration
- Claim tracking fixed: `_claimedFees` stores total fees processed (not just deployer portion) to ensure correct claimable calculations
- Added `registerITPDeployer()` function (onlyAuthorized) for deployer management
- Added `getClaimableFees()` view function for UI integration
- Converted to UUPS upgradeable pattern with Initializable, UUPSUpgradeable, and storage gap
- Added Index.sol integration: `setFeeRegistry()` and auto-registration in `createITP()`
- Added admin/fee events to EventsLib.sol for centralized event definitions
- All 81 tests pass covering all acceptance criteria including proxy deployment
- Full test suite (569 tests) passes with no regressions

### File List

- contracts/src/interfaces/IFeeRegistry.sol (NEW, UPDATED) - Added admin functions, uses TypesLib.FeeType, added getProtocolClaimableFees()
- contracts/src/registry/FeeRegistry.sol (NEW, UPDATED) - UUPS upgradeable, fixed claim race condition with separate deployer/protocol tracking
- contracts/test/FeeRegistry.t.sol (NEW, UPDATED) - 84 tests total (proxy deployment pattern, claim independence tests)
- contracts/src/libraries/TypesLib.sol (UPDATED) - Added FeeType enum
- contracts/src/libraries/EventsLib.sol (UPDATED) - Added registry admin events and fee events
- contracts/src/core/IndexStorage.sol (UPDATED) - Added feeRegistry reference, updated storage gap
- contracts/src/core/Index.sol (UPDATED) - Added setFeeRegistry(), auto-registration in createITP()

### Change Log

| Date | Change |
|------|--------|
| 2026-01-30 | Initial implementation of FeeRegistry.sol with all acceptance criteria |
| 2026-01-30 | Created IFeeRegistry.sol interface with FeeType enum and all function signatures |
| 2026-01-30 | Created comprehensive Foundry tests (66 tests) covering all functionality |
| 2026-01-30 | Fixed claim tracking logic to properly handle deployer share calculations |
| 2026-01-30 | **Code Review**: Removed unused TypesLib import, added `getClaimedFees()` view function for transparency, added `claimProtocolFees()` admin function for protocol share (30%), added 10 new tests (now 76 total) |
| 2026-01-30 | **Code Review #2**: Moved FeeType enum to TypesLib.sol (HIGH-3), added admin functions to IFeeRegistry interface (HIGH-2), added setBLSLibrary() function and blsLibrary storage (MEDIUM-1), added admin events to EventsLib.sol (MEDIUM-3), added override keywords to all interface implementations, added 3 new tests for setBLSLibrary (now 79 total) |
| 2026-01-30 | **Code Review #3**: Converted FeeRegistry to UUPS upgradeable pattern (MEDIUM-2), added Index.sol integration with setFeeRegistry() and auto-registration in createITP() (HIGH-1, HIGH-4), changed registerITPDeployer from onlyAdmin to onlyAuthorized for Index.sol access, added IndexStorage.sol feeRegistry reference, updated tests to use ERC1967Proxy deployment pattern (now 81 total) |
| 2026-01-30 | **Code Review #4**: Fixed CRITICAL claim race condition - deployer and protocol now tracked separately (HIGH-1, HIGH-3), added `getProtocolClaimableFees()` view function, added 5 new claim independence tests (now 84 total) |

### Senior Developer Review (AI)

**Reviewed:** 2026-01-30 (Review #4)
**Reviewer:** Claude Opus 4.5
**Outcome:** APPROVED - All critical issues fixed

**Issues Found & Fixed (Review #4):**
1. ✅ **CRITICAL HIGH-1/HIGH-3**: Fixed claim race condition where deployer and protocol claims blocked each other
   - Split `_claimedFees` into `_deployerClaimedFromTotal` and `_protocolClaimedFromTotal`
   - Deployer can now claim their 70% share independently of protocol claiming their 30%
   - Added `_calculateDeployerClaimable()` and `_calculateProtocolClaimable()` internal functions
   - Added `_getTotalAccumulated()` helper to reduce code duplication
   - Updated storage gap from 40 to 39 slots (accounts for new mapping)
2. ✅ **NEW**: Added `getProtocolClaimableFees(bytes32 itpId)` view function to interface and implementation
3. ✅ Added 5 new tests verifying independent claim behavior:
   - `test_DeployerCanClaimAfterProtocolClaim`
   - `test_ProtocolCanClaimAfterDeployerClaim`
   - `test_BothClaimsWorkIndependently`
   - `test_GetProtocolClaimableFees_ReturnsCorrectAmount`
   - `test_GetProtocolClaimableFees_ReturnsZeroAfterClaim`

**Previous Reviews Summary:**
- Review #1-2: Interface completeness, FeeType placement, BLS library support, EventsLib events
- Review #3: UUPS upgradeability, Index.sol integration, ITP deployer auto-registration

**Issues Noted (Not Fixed - Project-Wide Pattern):**
- **MEDIUM-4**: Errors not centralized to ErrorsLib - project-wide pattern issue

**Test Results:** 84/84 FeeRegistry tests pass, 578/578 full suite tests pass
