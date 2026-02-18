# Story 2.15: AssetPairRegistry.sol

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **issuer network**,
I want **a global registry for whitelisting assets and trading pairs with BLS-controlled governance**,
so that **only approved assets and pairs can be used in ITP creation and trading, with secure add/remove capabilities**.

## Acceptance Criteria

1. **Given** no existing interface for AssetPairRegistry
   **When** I implement AssetPairRegistry.sol
   **Then** the contract manages a global whitelist of assets and trading pairs
   **And** pairs are identified by `pairId = keccak256(asset, source, quoteToken, chainId)`

2. **Given** a valid BLS signature from 11/20 issuers
   **When** `proposeAsset(address asset, bytes calldata blsSignature)` is called
   **Then** the asset is queued for activation with a 2-day timelock
   **And** `AssetProposed` event is emitted with activation timestamp

3. **Given** an asset has passed its timelock period
   **When** `activateAsset(address asset)` is called
   **Then** the asset is added to the global whitelist
   **And** `AssetActivated` event is emitted

4. **Given** an active asset with liquidity issues or security concerns
   **When** `delistAsset(address asset, bytes calldata blsSignature)` is called with 11/20 threshold
   **Then** the asset is marked as DELISTING (not immediately removed)
   **And** `AssetDelisting` event is emitted
   **And** affected ITPs should be identified for forced rebalance

5. **Given** an emergency security situation
   **When** `emergencyRemoveAsset(address asset, bytes calldata blsSignature)` is called with 15/20 threshold
   **Then** the asset is immediately removed from whitelist
   **And** `AssetEmergencyRemoved` event is emitted

6. **Given** an approved asset and approved source
   **When** `proposePair(address asset, bytes32 source, address quoteToken, uint256 chainId, bytes calldata blsSignature)` is called
   **Then** a unique pairId is generated and queued with 2-day timelock
   **And** `PairProposed` event is emitted

7. **Given** a pair has passed its timelock period
   **When** `activatePair(bytes32 pairId)` is called
   **Then** the pair is added to the active pairs mapping
   **And** `PairActivated` event is emitted

8. **Given** a pair with insufficient liquidity (<$10k daily volume)
   **When** `delistPair(bytes32 pairId, bytes calldata blsSignature)` is called with 11/20 threshold
   **Then** the pair is marked inactive for new orders but existing orders complete
   **And** `PairDelisted` event is emitted

9. **Given** an active asset or pair
   **When** `isAssetWhitelisted(address asset)` or `isPairActive(bytes32 pairId)` is called
   **Then** the correct status is returned

10. **Given** the implementation
    **When** Foundry tests are run
    **Then** all asset and pair lifecycle operations are covered
    **And** timelock enforcement is verified
    **And** threshold requirements are verified
    **And** `forge test` passes

## Tasks / Subtasks

- [x] Task 1: Create IAssetPairRegistry interface (AC: 1, 2, 3, 4, 5, 6, 7, 8, 9)
  - [x] 1.1: Create `contracts/src/interfaces/IAssetPairRegistry.sol`
  - [x] 1.2: Define asset management functions: proposeAsset, activateAsset, delistAsset, emergencyRemoveAsset
  - [x] 1.3: Define pair management functions: proposePair, activatePair, delistPair
  - [x] 1.4: Define view functions: isAssetWhitelisted, isPairActive, getAsset, getPair, getActiveAssets, getActivePairs
  - [x] 1.5: Define events: AssetProposed, AssetActivated, AssetDelisting, AssetEmergencyRemoved, PairProposed, PairActivated, PairDelisted
  - [x] 1.6: Add NatSpec documentation with BLS message formats

- [x] Task 2: Add Asset and Pair structs to TypesLib.sol (AC: 1)
  - [x] 2.1: Add `AssetInfo` struct: address, status (PENDING/ACTIVE/DELISTING), proposedAt, activatedAt
  - [x] 2.2: Add `PairInfo` struct: pairId, asset, source, quoteToken, chainId, status, proposedAt, activatedAt
  - [x] 2.3: Add `AssetStatus` enum: INACTIVE, PENDING, ACTIVE, DELISTING
  - [x] 2.4: Add `PairStatus` enum: INACTIVE, PENDING, ACTIVE, DELISTED

- [x] Task 3: Create AssetPairRegistry.sol implementation (AC: 1-9)
  - [x] 3.1: Create `contracts/src/registry/AssetPairRegistry.sol`
  - [x] 3.2: Import IAssetPairRegistry interface
  - [x] 3.3: Import TypesLib for structs
  - [x] 3.4: Implement constructor with admin and initial pubkey

- [x] Task 4: Implement storage variables (AC: 1, 9)
  - [x] 4.1: Add `mapping(address => AssetInfo) private _assets` for asset data
  - [x] 4.2: Add `address[] private _assetList` for enumeration
  - [x] 4.3: Add `mapping(bytes32 => PairInfo) private _pairs` for pair data
  - [x] 4.4: Add `bytes32[] private _pairList` for enumeration
  - [x] 4.5: Add `mapping(address => bytes32[]) private _assetPairs` for asset→pairs lookup
  - [x] 4.6: Add `uint256 private _nonce` for replay protection
  - [x] 4.7: Add `bytes public aggregatedPubkey` for BLS verification
  - [x] 4.8: Add `address public admin` for admin functions
  - [x] 4.9: Add constants: ASSET_TIMELOCK = 2 days, PAIR_TIMELOCK = 2 days, STANDARD_THRESHOLD = 11, EMERGENCY_THRESHOLD = 15

- [x] Task 5: Implement BLS verification (AC: 2, 4, 5, 6, 8) - MOCK for now
  - [x] 5.1: Add placeholder `_verifyBLS(bytes32 message, bytes calldata signature)` internal function
  - [x] 5.2: Add placeholder `_verifyBLS15(bytes32 message, bytes calldata signature)` for 15/20 threshold
  - [x] 5.3: Add TODO comment: "Replace with actual BLSLib after integration"

- [x] Task 6: Implement asset management functions (AC: 2, 3, 4, 5)
  - [x] 6.1: Implement `proposeAsset(address asset, bytes calldata blsSignature)` with 11/20 verification
  - [x] 6.2: Build message: `keccak256(abi.encode("PROPOSE_ASSET", chainid, this, asset, nonce++))`
  - [x] 6.3: Set asset status to PENDING, record proposedAt = block.timestamp + ASSET_TIMELOCK
  - [x] 6.4: Implement `activateAsset(address asset)` - anyone can call after timelock
  - [x] 6.5: Verify timelock passed, set status to ACTIVE, add to _assetList
  - [x] 6.6: Implement `delistAsset(address asset, bytes calldata blsSignature)` with 11/20 verification
  - [x] 6.7: Set status to DELISTING, emit event for ITP forced rebalance trigger
  - [x] 6.8: Implement `emergencyRemoveAsset(address asset, bytes calldata blsSignature)` with 15/20 verification
  - [x] 6.9: Immediately set status to INACTIVE, prevent new usage

- [x] Task 7: Implement pair management functions (AC: 6, 7, 8)
  - [x] 7.1: Implement `proposePair(address asset, bytes32 source, address quoteToken, uint256 chainId, bytes calldata blsSignature)`
  - [x] 7.2: Validate asset is ACTIVE before allowing pair proposal
  - [x] 7.3: Generate pairId: `keccak256(abi.encode(asset, source, quoteToken, chainId))`
  - [x] 7.4: Build message: `keccak256(abi.encode("PROPOSE_PAIR", chainid, this, asset, source, quoteToken, chainId, nonce++))`
  - [x] 7.5: Set pair status to PENDING, record proposedAt
  - [x] 7.6: Implement `activatePair(bytes32 pairId)` - anyone can call after timelock
  - [x] 7.7: Verify timelock passed, set status to ACTIVE, add to _pairList and _assetPairs
  - [x] 7.8: Implement `delistPair(bytes32 pairId, bytes calldata blsSignature)` with 11/20 verification
  - [x] 7.9: Set status to DELISTED, prevent new orders but allow existing completion

- [x] Task 8: Implement view functions (AC: 9)
  - [x] 8.1: Implement `isAssetWhitelisted(address asset)` - returns true if ACTIVE
  - [x] 8.2: Implement `isAssetDelisting(address asset)` - returns true if DELISTING
  - [x] 8.3: Implement `isPairActive(bytes32 pairId)` - returns true if ACTIVE
  - [x] 8.4: Implement `getAsset(address asset)` - returns AssetInfo
  - [x] 8.5: Implement `getPair(bytes32 pairId)` - returns PairInfo
  - [x] 8.6: Implement `getActiveAssets()` - returns array of active asset addresses
  - [x] 8.7: Implement `getActivePairs()` - returns array of active pairIds
  - [x] 8.8: Implement `getPairsForAsset(address asset)` - returns pairs using this asset
  - [x] 8.9: Implement `computePairId(address asset, bytes32 source, address quoteToken, uint256 chainId)` pure function

- [x] Task 9: Implement admin functions
  - [x] 9.1: Add `modifier onlyAdmin()`
  - [x] 9.2: Implement `setAggregatedPubkey(bytes calldata pubkey)` - admin only
  - [x] 9.3: Implement `setAdmin(address newAdmin)` - admin only, with zero-address check

- [x] Task 10: Write Foundry tests (AC: 10)
  - [x] 10.1: Create `contracts/test/AssetPairRegistry.t.sol`
  - [x] 10.2: Test proposeAsset creates pending entry with correct timelock
  - [x] 10.3: Test activateAsset fails before timelock, succeeds after
  - [x] 10.4: Test delistAsset marks as DELISTING with BLS verification
  - [x] 10.5: Test emergencyRemoveAsset immediately removes with higher threshold
  - [x] 10.6: Test proposePair fails if asset not active
  - [x] 10.7: Test proposePair generates correct pairId
  - [x] 10.8: Test activatePair fails before timelock, succeeds after
  - [x] 10.9: Test delistPair marks as DELISTED
  - [x] 10.10: Test view functions return correct data
  - [x] 10.11: Test replay protection (same nonce fails)
  - [x] 10.12: Test multiple assets and pairs track independently
  - [x] 10.13: Test asset delisting affects pair availability
  - [x] 10.14: Run `forge test --match-contract AssetPairRegistryTest -vvv`

## Dev Notes

### Architecture Requirements

From architecture.md Section 12 (Asset Listing & Pair System):

**Core Concept: Pairs, Not Just Assets**
BTC can be traded on Bitget (CEX) or via 1inch (DEX). Each is a different **Pair** with a unique `pairId`.

```solidity
// pairId = keccak256(asset, source, quoteToken, chainId)
// This uniquely identifies WHERE and HOW an asset is traded
```

**Pair Registry Examples:**
| Pair ID | Asset | Source | Quote | Chain | Type |
|---------|-------|--------|-------|-------|------|
| 0x000...001 | BTC | Bitget | USDC | N/A (CEX) | CEX |
| 0x226...abc | WBTC | 1inch | USDC | Arbitrum | DEX |
| 0xc02...def | WETH | 1inch | USDC | Ethereum | DEX |
| 0x123...ghi | SOL | 1inch-Fusion+ | USDC | Solana | DEX |

**Global Asset List Requirements:**
- Issuers maintain whitelist of tradeable assets
- New assets: Issuers propose + approve (11/20 BLS)
- Each asset can have multiple pairs (different sources/quotes)
- Delisting: Affects new ITP creations only (not rebalance)

**Pair Whitelist Requirements:**
Before a pair can be used:
1. **Asset whitelisted** - in global asset registry
2. **Source approved** - CEX account or DEX router whitelisted
3. **Liquidity check** - minimum $10k daily volume
4. **Price feed available** - Bitget API or 1inch quote accessible

**Asset Delisting Flow (from architecture.md Section 18):**
```
1. Issuer proposes delist (reason: Bitget delisted, security issue)
2. 11/20 issuers approve via BLS
3. Asset marked "DELISTING" on-chain
4. Affected ITPs identified automatically
5. For each affected ITP:
   a. Pause new orders for that ITP
   b. Queue forced rebalance: delisted asset weight → 0%
   c. Scale other weights proportionally to sum = 100%
6. Forced rebalance executes over N cycles (liquidity-dependent)
7. Once all ITPs have 0% of delisted asset:
   a. Asset removed from global whitelist
   b. ITPs resumed
8. New ITP creation cannot include delisted assets
```

### Technical Stack

| Attribute | Value |
|-----------|-------|
| Solidity Version | `^0.8.20` |
| Framework | Foundry |
| Chain | Index L3 Orbit (Chain ID: 111222333) |
| BLS Verification | Mock for now, integrate BLSLib later |

### BLS Message Formats

**Asset Operations:**
```solidity
// Propose asset
bytes32 message = keccak256(abi.encode(
    "PROPOSE_ASSET",
    block.chainid,
    address(this),
    asset,
    _nonce++
));

// Delist asset (standard 11/20)
bytes32 message = keccak256(abi.encode(
    "DELIST_ASSET",
    block.chainid,
    address(this),
    asset,
    _nonce++
));

// Emergency remove (15/20)
bytes32 message = keccak256(abi.encode(
    "EMERGENCY_REMOVE_ASSET",
    block.chainid,
    address(this),
    asset,
    _nonce++
));
```

**Pair Operations:**
```solidity
// Propose pair
bytes32 message = keccak256(abi.encode(
    "PROPOSE_PAIR",
    block.chainid,
    address(this),
    asset,
    source,
    quoteToken,
    chainId,
    _nonce++
));

// Delist pair
bytes32 message = keccak256(abi.encode(
    "DELIST_PAIR",
    block.chainid,
    address(this),
    pairId,
    _nonce++
));
```

### Source Types (bytes32 encoding)

```solidity
// CEX sources
bytes32 constant SOURCE_BITGET = keccak256("BITGET");

// DEX sources
bytes32 constant SOURCE_1INCH = keccak256("1INCH");
bytes32 constant SOURCE_1INCH_FUSION = keccak256("1INCH_FUSION_PLUS");
bytes32 constant SOURCE_UNISWAP_V3 = keccak256("UNISWAP_V3");
bytes32 constant SOURCE_JUPITER = keccak256("JUPITER");
```

### Storage Layout

```solidity
// Asset tracking
mapping(address => AssetInfo) private _assets;
address[] private _assetList;

// Pair tracking
mapping(bytes32 => PairInfo) private _pairs;
bytes32[] private _pairList;
mapping(address => bytes32[]) private _assetPairs;  // asset → its pairs

// Replay protection
uint256 private _nonce;

// BLS verification
bytes public aggregatedPubkey;

// Admin
address public admin;

// Constants
uint256 public constant ASSET_TIMELOCK = 2 days;
uint256 public constant PAIR_TIMELOCK = 2 days;
uint256 public constant STANDARD_THRESHOLD = 11;  // 11/20
uint256 public constant EMERGENCY_THRESHOLD = 15;  // 15/20
```

### Project Structure Notes

```
contracts/
├── src/
│   ├── interfaces/
│   │   └── IAssetPairRegistry.sol  # NEW - This story
│   ├── registry/
│   │   ├── CollateralRegistry.sol  # EXISTS - Story 2.11
│   │   └── AssetPairRegistry.sol   # NEW - This story
│   └── libraries/
│       └── TypesLib.sol            # MODIFY - Add Asset/Pair structs
├── test/
│   └── AssetPairRegistry.t.sol     # NEW - This story
└── foundry.toml                    # EXISTS
```

### Integration Points

**Used by:**
- `Index.sol` `createITP()` - validates all assets are whitelisted
- `Index.sol` `submitOrder()` - validates pair is active
- Issuer netting engine - routes orders to correct source based on pair
- AP/Keeper - uses pair info to route to correct CEX/DEX

**Interacts with:**
- `IssuerRegistry.sol` - shares aggregatedPubkey for BLS verification
- `Governance.sol` - admin functions coordinated

### Testing Strategy

1. **Unit Tests:**
   - Asset lifecycle: propose → activate → delist → remove
   - Pair lifecycle: propose → activate → delist
   - Timelock enforcement
   - BLS threshold verification (mocked)

2. **Integration Tests:**
   - Asset delisting cascades to pairs
   - View functions return correct filtered lists
   - Nonce prevents replay attacks

3. **Edge Cases:**
   - Double activation (should fail)
   - Activate before timelock (should fail)
   - Propose pair for non-active asset (should fail)
   - Emergency remove on already-delisting asset

### Security Considerations

1. **BLS Verification:** Currently mocked - MUST integrate real BLSLib before mainnet
2. **Replay Protection:** Nonce incremented on every call prevents replay
3. **Timelock:** 2-day delay prevents rushed additions (allows time to catch issues)
4. **Emergency Override:** 15/20 threshold for immediate removal in emergencies
5. **Chain ID Binding:** Messages include chainId to prevent cross-chain replay

### Dependencies

**This story depends on:**
- Story 2.1: Governance.sol (admin pattern reference)
- Story 2.6: BLSLib (integrate later for real verification)
- Epic 1 completion (interfaces, types)

**This story provides:**
- AssetPairRegistry.sol for global asset/pair whitelisting
- IAssetPairRegistry interface

**Used by (future stories):**
- Story 2.2: Index.sol createITP() validates assets
- Story 2.3: Index.sol submitOrder() validates pairs
- Story 3.7: Netting engine uses pair info for routing
- Story 6.2: Integration wiring

### References

- [Source: architecture.md#12-asset-listing-pair-system] - Pair registry design
- [Source: architecture.md#18-pause-mechanisms-asset-delisting] - Delisting flow
- [Source: architecture.md#custody-whitelist-management] - BLS timelock patterns
- [Source: epics.md#global-asset-list] - Asset whitelist requirements
- [Source: contracts/src/registry/CollateralRegistry.sol] - Similar registry pattern
- [Source: contracts/src/interfaces/IIssuerRegistry.sol] - BLS verification patterns

### Cross-Story Dependencies

**Previous stories in Epic 2:**
- 2-1: Governance.sol (admin pattern)
- 2-6: BLS Library (integrate later)
- 2-11: CollateralRegistry.sol (similar registry pattern)

**Parallel stories in Wave 2:**
- 2-4: Index.sol batch confirmation (will use pair info)
- 2-7: BLSCustody core (different BLS usage)
- 2-12: IssuerRegistry core (shares pubkey management)
- 2-14: FeeRegistry (similar registry pattern)

### Reference Implementation Skeleton

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IAssetPairRegistry.sol";
import "../libraries/TypesLib.sol";

/// @title AssetPairRegistry - Global asset and trading pair whitelist
/// @notice Manages which assets and pairs can be used in ITPs
/// @dev All modifications require BLS signature from issuer consensus
contract AssetPairRegistry is IAssetPairRegistry {
    // ============ ERRORS ============
    error Unauthorized();
    error ZeroAddress();
    error InvalidBLSSignature();
    error AssetNotWhitelisted();
    error AssetAlreadyExists();
    error PairAlreadyExists();
    error TimelockNotPassed();
    error AssetNotPending();
    error PairNotPending();

    // ============ CONSTANTS ============
    uint256 public constant ASSET_TIMELOCK = 2 days;
    uint256 public constant PAIR_TIMELOCK = 2 days;
    uint256 public constant STANDARD_THRESHOLD = 11;
    uint256 public constant EMERGENCY_THRESHOLD = 15;

    // ============ STORAGE ============
    mapping(address => TypesLib.AssetInfo) private _assets;
    address[] private _assetList;

    mapping(bytes32 => TypesLib.PairInfo) private _pairs;
    bytes32[] private _pairList;
    mapping(address => bytes32[]) private _assetPairs;

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

    // ============ ASSET MANAGEMENT ============
    function proposeAsset(
        address asset,
        bytes calldata blsSignature
    ) external override {
        bytes32 message = keccak256(abi.encode(
            "PROPOSE_ASSET",
            block.chainid,
            address(this),
            asset,
            _nonce++
        ));
        if (!_verifyBLS(message, blsSignature)) revert InvalidBLSSignature();

        // Implementation...
    }

    // ============ PAIR MANAGEMENT ============
    function proposePair(
        address asset,
        bytes32 source,
        address quoteToken,
        uint256 chainId,
        bytes calldata blsSignature
    ) external override {
        // Verify asset is active first
        if (_assets[asset].status != uint8(TypesLib.AssetStatus.ACTIVE)) {
            revert AssetNotWhitelisted();
        }

        bytes32 pairId = computePairId(asset, source, quoteToken, chainId);
        // Implementation...
    }

    // ============ VIEW FUNCTIONS ============
    function computePairId(
        address asset,
        bytes32 source,
        address quoteToken,
        uint256 chainId
    ) public pure returns (bytes32) {
        return keccak256(abi.encode(asset, source, quoteToken, chainId));
    }

    // ============ INTERNAL ============
    function _verifyBLS(bytes32 /*message*/, bytes calldata /*signature*/) internal pure returns (bool) {
        // TODO: Replace with actual BLSLib.verifyBLS after integration
        return true;
    }

    function _verifyBLS15(bytes32 /*message*/, bytes calldata /*signature*/) internal pure returns (bool) {
        // TODO: Replace with actual 15/20 threshold verification
        return true;
    }
}
```

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

No debug issues encountered.

### Completion Notes List

- Implemented full AssetPairRegistry contract following CollateralRegistry pattern
- Created comprehensive IAssetPairRegistry interface with all asset and pair management functions
- Added AssetStatus and PairStatus enums to TypesLib.sol
- Added AssetInfo and PairInfo structs to TypesLib.sol
- Implemented full asset lifecycle: propose (2-day timelock) → activate → delist (DELISTING) → emergency remove (INACTIVE)
- Implemented full pair lifecycle: propose (2-day timelock, requires active asset) → activate → delist (DELISTED)
- BLS verification is mocked with TODO comments for future BLSLib integration (Story 2.6)
- All 47 tests pass covering:
  - Constructor and admin tests
  - Asset lifecycle (propose, activate, delist, emergency remove)
  - Pair lifecycle (propose, activate, delist)
  - Timelock enforcement (fails before, succeeds after)
  - View functions (isAssetWhitelisted, isPairActive, getActiveAssets, getActivePairs, etc.)
  - Replay protection (nonce increments)
  - Multiple assets/pairs tracking independently
  - Asset delisting affecting pair availability
- Full test suite (487 tests) passes with no regressions

### Change Log

- 2026-01-30: Initial implementation complete - all acceptance criteria met
- 2026-01-30: Code review fixes applied (AI Review):
  - HIGH-3: Added asset status verification in `activatePair()` - pairs can no longer be activated if underlying asset was delisted/removed during timelock
  - MEDIUM-2: Added `cancelAssetProposal()` and `cancelPairProposal()` functions to allow cancellation of pending proposals during timelock
  - MEDIUM-4: Added `getActivePairsForAsset()` function to return only active pairs (filters out PENDING/DELISTED)

### File List

**New Files:**
- contracts/src/interfaces/IAssetPairRegistry.sol
- contracts/src/registry/AssetPairRegistry.sol
- contracts/test/AssetPairRegistry.t.sol

**Modified Files:**
- contracts/src/libraries/TypesLib.sol (added AssetStatus, PairStatus enums; AssetInfo, PairInfo structs)

