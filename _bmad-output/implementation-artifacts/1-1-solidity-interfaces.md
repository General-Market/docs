# Story 1.1: Solidity Interfaces

Status: done

## Story

As a **smart contract developer**,
I want **all Solidity interfaces defined (IIndex, IITP, IBLSCustody, ICollateralRegistry, IBridge, IIssuerRegistry, IGovernance)**,
So that **I can implement contracts against stable interfaces while other teams work in parallel**.

## Acceptance Criteria

1. **Given** a new Foundry project at `contracts/`
   **When** I create the interfaces in `contracts/src/interfaces/`
   **Then** all interfaces compile with `forge build`

2. **IIndex.sol** defines:
   - `submitOrder(itpId, side, amount, limitPrice, slippageTier, deadline)` - Submit limit order
   - `confirmBatch(cycleNumber, orderIds[], blsSignature)` - Confirm order batch
   - `confirmFills(cycleNumber, fills[], blsSignature)` - Process fills
   - `createITP(name, symbol, weights[], assets[])` - Create new ITP
   - `refundExpiredOrder(orderId, blsSignature)` - Refund expired orders
   - `getOrder(orderId)` - Return order details
   - `getITP(itpId)` - Return ITP details
   - `getNAV(itpId)` - Return NAV calculation
   - `getITPState(itpId)` - Return full ITP state (creator, totalSupply, nav, assets, weights, inventory)
   - `getPrice(assetIdx)` - Return asset price
   - `batchGetPrices(indices[])` - Return multiple prices

3. **IITP.sol** defines:
   - ERC4626 interface (inherits or defines totalAssets, convertToShares, convertToAssets)
   - `mint(to, shares)` - Only callable by Index.sol
   - `burn(from, shares)` - Only callable by Index.sol
   - `deposit()` and `withdraw()` MUST revert (orders go through Index.sol)

4. **IBLSCustody.sol** defines:
   - `execute(target, data, blsSignature, nonce)` - Execute BLS-signed call
   - `proposeWhitelist(target, blsSignature)` - Propose whitelist addition (11/20 threshold)
   - `activateWhitelist(target)` - Activate after 2-day timelock
   - `emergencyRemoveWhitelist(target, blsSignature)` - Remove immediately (15/20 threshold)
   - `proposeUpgrade(newImpl, blsSignature)` - Propose UUPS upgrade (15/20 + 7-day timelock)
   - `executeUpgrade(newImpl)` - Execute upgrade after timelock

5. **ICollateralRegistry.sol** defines:
   - `recordCollateralMove(itpId, fromChain, toChain, amount, txType, blsSignature)` - Update collateral state
   - `getITPCollateralByChain(itpId, chainId)` - Return collateral amount

6. **IBridge.sol** (L3BridgeCustody + ArbBridgeCustody) defines:
   - `initiateBridge(destChainId, amount, blsSignature)` - Lock USDC on source
   - `markReleased(nonce, destTxHash, blsSignature)` - Mark lock as released
   - `reverseLock(nonce, blsSignature, signerCount)` - Reverse after 1h timeout (15/20)
   - `completeBridge(sourceChainId, amount, nonce, proof, blsSignature)` - Release on destination
   - `buyITPFromArbitrum(itpId, amount, limitPrice, slippageTier, deadline)` - Cross-chain ITP purchase

7. **IIssuerRegistry.sol** defines:
   - `addIssuer(address, ip, blsPubkey)` - Add issuer (admin only)
   - `removeIssuer(issuerId)` - Remove issuer (admin or BLS vote)
   - `requestKeyRotation(issuerId, newPubkey, signatureWithOldKey)` - Request rotation
   - `approveRotation(rotatingIssuerId, approvingIssuerId, approverSignature)` - Approve (10/19)
   - `executeRotation(issuerId)` - Execute after 24h + safe period
   - `forceRotationWindow(issuerId)` - Admin escape after 48h stuck
   - `getIssuer(issuerId)` - Return issuer details
   - `getAggregatedPubkey()` - Return aggregated BLS pubkey
   - `getIssuers()` - Return all issuers

8. **IGovernance.sol** defines:
   - `pause()` - Emergency system pause (admin only)
   - `unpause()` - Resume system (admin only)
   - `pauseITP(itpId)` - Pause specific ITP
   - `unpauseITP(itpId)` - Resume specific ITP
   - `setAdmin(newAdmin)` - Transfer admin

## Tasks / Subtasks

- [x] Task 1: Initialize Foundry project structure (AC: #1)
  - [x] Create `contracts/` directory with standard Foundry layout
  - [x] Initialize with `forge init` or create foundry.toml
  - [x] Create `contracts/src/interfaces/` directory
  - [x] Create `contracts/src/libraries/` directory (for shared types)

- [x] Task 2: Define shared types and enums (AC: #2-8)
  - [x] Create `contracts/src/libraries/TypesLib.sol` with all structs/enums
  - [x] Define `LimitOrder` struct
  - [x] Define `Side` enum (BUY, SELL)
  - [x] Define `OrderStatus` enum (PENDING, FILLED)
  - [x] Define `ITPCore` struct
  - [x] Define `PendingRebalance` struct
  - [x] Define `PendingLock` struct (for bridge)
  - [x] Define `ReleaseProof` struct (for bridge)
  - [x] Define `Fill` struct for fill confirmations

- [x] Task 3: Create IIndex.sol interface (AC: #2)
  - [x] Define all function signatures per AC
  - [x] Import TypesLib for struct types
  - [x] Add NatSpec documentation

- [x] Task 4: Create IITP.sol interface (AC: #3)
  - [x] Extend IERC4626 from OpenZeppelin
  - [x] Define mint/burn with onlyIndex restriction comment
  - [x] Add NatSpec documentation

- [x] Task 5: Create IBLSCustody.sol interface (AC: #4)
  - [x] Define execute, whitelist, and upgrade functions
  - [x] Document threshold requirements in NatSpec

- [x] Task 6: Create ICollateralRegistry.sol interface (AC: #5)
  - [x] Define recordCollateralMove and getter
  - [x] Define txType enum or bytes32 constants

- [x] Task 7: Create IBridge.sol interface (AC: #6)
  - [x] Split into IL3BridgeCustody and IArbBridgeCustody if needed
  - [x] Define all bridge functions
  - [x] Import ReleaseProof struct

- [x] Task 8: Create IIssuerRegistry.sol interface (AC: #7)
  - [x] Define all issuer management functions
  - [x] Define key rotation functions
  - [x] Add threshold requirements in NatSpec

- [x] Task 9: Create IGovernance.sol interface (AC: #8)
  - [x] Define pause/unpause functions
  - [x] Define admin management

- [x] Task 10: Verify compilation (AC: #1)
  - [x] Run `forge build` and fix any errors
  - [x] Ensure all imports resolve correctly

## Dev Notes

### Project Structure (from Architecture.md Section 5)

```
contracts/
├── src/
│   ├── interfaces/
│   │   ├── IIndex.sol
│   │   ├── IITP.sol
│   │   ├── IBLSCustody.sol
│   │   ├── ICollateralRegistry.sol
│   │   ├── IBridge.sol (or IL3BridgeCustody + IArbBridgeCustody)
│   │   ├── IIssuerRegistry.sol
│   │   └── IGovernance.sol
│   ├── libraries/
│   │   ├── TypesLib.sol
│   │   ├── ConstantsLib.sol (optional for this story)
│   │   └── ErrorsLib.sol (optional - Story 1.4)
│   └── ...
├── test/
├── script/
└── foundry.toml
```

### Critical Struct Definitions (from Architecture.md Appendix B)

```solidity
// LimitOrder - from Section 6
struct LimitOrder {
    uint256 id;              // Global unique ID
    address user;
    bytes32 pairId;          // Asset + source identifier
    Side side;               // BUY or SELL
    uint256 amount;          // USDC amount (18 decimals)
    uint256 limitPrice;      // Worst acceptable price (18 decimals)
    uint256 slippageTier;    // 0=strict(0.3%), 1=normal(1%), 2=relaxed(3%)
    uint256 deadline;        // Unix timestamp (max 24h from submission)
    bytes32 itpId;           // Which ITP
    uint256 timestamp;       // Order creation time
    OrderStatus status;      // PENDING or FILLED
}

// Simplified Order for Index.sol storage
struct Order {
    address user;
    uint256 timestamp;
    uint256 orderType;       // 0=BUY_LIMIT, 1=SELL_LIMIT
    uint256 status;          // 0=PENDING, 1=FILLED
    uint256 itpId;
    uint256 amount;          // USDC (18 decimals)
    uint256 limitPrice;
}

// ITPCore - from Section B
struct ITPCore {
    address creator;
    uint256 createdAt;
    uint256 feeRate;         // Basis points (10000 = 100%)
    uint256 status;          // 0=inactive, 1=active, 2=paused, 3=delisting
    uint256 totalSupply;
    uint256 totalValue;      // Cached NAV * supply
    uint256 assetCount;
}

// Fill - for confirmFills
struct Fill {
    uint256 orderId;
    uint256 fillPrice;       // Actual execution price (18 decimals)
    uint256 fillAmount;      // Amount filled
}

// PendingLock - from Bridge section
struct PendingLock {
    uint256 amount;
    uint256 destChainId;
    uint256 lockedAt;
    uint256 lockedBlock;
    bytes32 lockedBlockHash;
    bool released;
    bool reversed;
}

// ReleaseProof - for bridge completion
struct ReleaseProof {
    uint256 sourceChainId;
    uint256 sourceBlockNumber;
    bytes32 sourceBlockHash;
    bytes32 sourceTxHash;
}
```

### Constants to Define (for reference)

```solidity
// Slippage tiers
uint256 constant SLIPPAGE_TIER_0 = 30;   // 0.3% = 30 basis points
uint256 constant SLIPPAGE_TIER_1 = 100;  // 1.0%
uint256 constant SLIPPAGE_TIER_2 = 300;  // 3.0%

// Thresholds
uint256 constant BLS_STANDARD_THRESHOLD = 11;   // 11/20
uint256 constant BLS_REVERSAL_THRESHOLD = 15;   // 15/20
uint256 constant BLS_EMERGENCY_THRESHOLD = 17;  // 17/20
uint256 constant KEY_ROTATION_THRESHOLD = 10;   // 10/19 others

// Timelocks
uint256 constant WHITELIST_TIMELOCK = 2 days;
uint256 constant KEY_ROTATION_TIMELOCK = 24 hours;
uint256 constant UPGRADE_TIMELOCK = 7 days;
uint256 constant EMERGENCY_UPGRADE_TIMELOCK = 24 hours;
uint256 constant BRIDGE_LOCK_TIMEOUT = 1 hours;

// Order constraints
uint256 constant MAX_ORDER_DEADLINE = 24 hours;
uint256 constant MIN_ORDER_AMOUNT = 1e15;  // 0.001 USDC
```

### BLS Signature Pattern

All BLS-verified functions follow this message format:
```solidity
bytes32 message = keccak256(abi.encode(
    block.chainid,           // CRITICAL: Prevents cross-chain replay
    address(this),           // Contract address
    functionSpecificData...  // Function-specific parameters
));
```

### OpenZeppelin Dependencies

- Use OpenZeppelin v5.x for IERC4626
- Import path: `@openzeppelin/contracts/interfaces/IERC4626.sol`
- Foundry remapping: `@openzeppelin/=lib/openzeppelin-contracts/`

### Storage Pattern (NFR20)

**All storage uses uint256 for simplicity and safety:**
- Solidity 0.8+ overflow checks work best with uint256
- Simpler code = fewer bugs
- Pack structs when possible for gas optimization

### UUPS Upgrade Pattern Notes

All upgradeable contracts (Governance, Index, BLSCustody) use UUPS:
- No separate ProxyAdmin needed
- `_authorizeUpgrade(address)` checks admin/BLS
- OpenZeppelin `UUPSUpgradeable` base

### Testing Standards

After implementation, interfaces should:
1. Compile without errors: `forge build`
2. Have consistent function signatures across contracts
3. Match struct definitions between interfaces and implementations
4. Support ethers-rs binding generation (Story 1.3)

### References

- [Source: architecture.md#5-smart-contract-architecture] - Contract structure
- [Source: architecture.md#6-order-system] - Order/LimitOrder structs
- [Source: architecture.md#13-multi-chain-collateral--custody] - Bridge structs
- [Source: architecture.md#17-issuer-key-management] - Key rotation
- [Source: architecture.md#appendix-b-data-structures] - Full struct definitions
- [Source: epics.md#story-11] - Original acceptance criteria

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- OpenZeppelin not installed as git submodule (repo not initialized as git). Defined minimal IERC4626Minimal interface inline in IITP.sol instead.
- Linter style warnings for ITP naming convention (mixedCase) - kept as-is since ITP is the established acronym in the project.

### Completion Notes List

- **Task 1**: Foundry project structure already existed with foundry.toml. Created `contracts/src/interfaces/` directory.
- **Task 2**: Extended TypesLib.sol with missing structs: ReleaseProof, PendingRebalance, Issuer, KeyRotation. All enums (Side, OrderStatus, TxType, ITPStatus) and core structs (LimitOrder, ITPCore, Fill, PendingLock, CollateralMove) already present.
- **Task 3**: Created IIndex.sol with all 11 required functions per AC #2, full NatSpec documentation.
- **Task 4**: Created IITP.sol with minimal ERC4626 interface (IERC4626Minimal) since OpenZeppelin not available. Defined mint/burn as restricted to Index, deposit/withdraw/redeem marked as MUST REVERT per AC.
- **Task 5**: Created IBLSCustody.sol with execute, whitelist (propose/activate/emergencyRemove), and upgrade (propose/execute) functions. Documented 11/20 and 15/20 thresholds in NatSpec.
- **Task 6**: Created ICollateralRegistry.sol with recordCollateralMove and getters. TxType enum defined in TypesLib.
- **Task 7**: Created IBridge.sol split into IL3BridgeCustody and IArbBridgeCustody as recommended. Includes all bridge functions with ReleaseProof struct.
- **Task 8**: Created IIssuerRegistry.sol with all issuer management and key rotation functions. Documented 10/19 threshold for rotation approval.
- **Task 9**: Created IGovernance.sol with pause/unpause (system and ITP-level) and setAdmin functions.
- **Task 10**: `forge build` successful - all interfaces compile without errors.

### File List

**Created:**
- contracts/src/interfaces/IIndex.sol
- contracts/src/interfaces/IITP.sol
- contracts/src/interfaces/IBLSCustody.sol
- contracts/src/interfaces/ICollateralRegistry.sol
- contracts/src/interfaces/IBridge.sol
- contracts/src/interfaces/IIssuerRegistry.sol
- contracts/src/interfaces/IGovernance.sol

**Modified:**
- contracts/src/libraries/TypesLib.sol (added ReleaseProof, PendingRebalance, Issuer, KeyRotation structs; added OrderStatus to LimitOrder)
- contracts/src/interfaces/IITP.sol (added asset(), decimals() to IERC4626Minimal)
- contracts/src/interfaces/IBLSCustody.sol (added events)
- contracts/src/interfaces/ICollateralRegistry.sol (added CollateralMoved event)
- contracts/src/interfaces/IBridge.sol (added events to IL3BridgeCustody and IArbBridgeCustody)
- contracts/src/interfaces/IIssuerRegistry.sol (added events)

## Change Log

- 2026-01-29: Story 1.1 implemented - All 7 Solidity interfaces created and verified compiling with `forge build`
- 2026-01-29: **Code Review Fixes Applied:**
  - [H1] Added missing `OrderStatus status` field to LimitOrder struct in TypesLib.sol
  - [M2] Added events to IBLSCustody.sol (Executed, WhitelistProposed/Activated/Removed, UpgradeProposed/Executed)
  - [M2] Added CollateralMoved event to ICollateralRegistry.sol
  - [M2] Added events to IBridge.sol (BridgeInitiated, LockReleased, LockReversed, BridgeCompleted, CrossChainOrderCreated)
  - [M2] Added events to IIssuerRegistry.sol (IssuerAdded/Removed, KeyRotationRequested/Approved/Executed, RotationWindowForced)
  - [M3] Added `asset()` and `decimals()` functions to IERC4626Minimal for ERC4626 compliance
