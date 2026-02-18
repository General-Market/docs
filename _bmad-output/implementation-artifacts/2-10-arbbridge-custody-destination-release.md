# Story 2.10: ArbBridgeCustody.sol - Destination Release

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **issuer**,
I want **to release USDC on Arbitrum after verifying L3 lock**,
So that **bridged funds can be used for swaps**.

## Acceptance Criteria

1. **Given** L3BridgeCustody.sol from Story 2.9
   **When** I implement ArbBridgeCustody.sol
   **Then** contract compiles with `forge build`

2. **`completeBridge(sourceChainId, amount, nonce, proof, blsSignature)`** releases USDC
   - Message format: `keccak256(abi.encode(chainid, this, proof, amount, nonce))`
   - Requires valid BLS signature from issuer quorum (11/20)
   - `proof` includes: `sourceBlockNumber`, `sourceBlockHash`, `sourceTxHash`
   - Nonce tracked in `bridgeCompleted[sourceChainId][nonce]` to prevent replay
   - Transfers USDC from contract to `msg.sender` (or designated recipient)
   - Emits `BridgeCompleted(sourceChainId, amount, nonce)` event

3. **`buyITPFromArbitrum(itpId, amount, limitPrice, slippageTier, deadline)`** for cross-chain buy
   - User's USDC transferred from user to custody contract
   - Validates: slippage tier (0, 1, 2), deadline in future and within 24h
   - Generates unique `orderId` for this cross-chain order
   - Emits `CrossChainOrderCreated(orderId, itpId, user, amount)` event
   - Returns `orderId` for tracking

4. **View functions:**
   - `isNonceUsed(sourceChainId, nonce)` returns whether nonce has been released
   - `l3IndexContract()` returns the L3 Index contract address reference
   - `currentOrderId()` returns the next order ID to be assigned

5. **Foundry tests cover:**
   - completeBridge happy path (release USDC after verified lock)
   - BridgeCompleted event emission with all parameters
   - Replay protection (same nonce from same source chain reverts)
   - Different source chains can use same nonce (no collision)
   - buyITPFromArbitrum happy path
   - CrossChainOrderCreated event emission
   - Validation: invalid slippage tier reverts
   - Validation: expired deadline reverts
   - Validation: deadline too far in future reverts
   - BLS signature verification
   - Zero amount handling

## Tasks / Subtasks

- [x] Task 1: Create ArbBridgeCustody.sol with storage layout (AC: #1)
  - [x] Create `contracts/src/custody/ArbBridgeCustody.sol`
  - [x] Import and inherit UUPSUpgradeable, Initializable
  - [x] Import BLSLib, ErrorsLib, EventsLib, TypesLib
  - [x] Import IIssuerRegistry, IArbBridgeCustody, IERC20 interfaces
  - [x] Define constants: `MAX_DEADLINE_DURATION = 24 hours`, `MAX_SLIPPAGE_TIER = 2`
  - [x] Define storage: `issuerRegistry`, `usdc`, `l3Index`, `bridgeCompleted` mapping, `crossChainOrderId`
  - [x] Add storage gap for future upgrades

- [x] Task 2: Implement initialize function (AC: #1)
  - [x] Accept `issuerRegistry_` address parameter
  - [x] Accept `usdc_` address parameter
  - [x] Accept `l3Index_` address parameter (L3 Index contract reference)
  - [x] Initialize UUPS upgradeable base
  - [x] Validate non-zero addresses
  - [x] Store references

- [x] Task 3: Implement completeBridge function (AC: #2)
  - [x] Build message: `keccak256(abi.encode(chainid, this, proof, amount, nonce))`
  - [x] Verify BLS signature via BLSLib (11/20 threshold)
  - [x] Check nonce not already used: `require(!bridgeCompleted[sourceChainId][nonce])`
  - [x] Mark nonce as used: `bridgeCompleted[sourceChainId][nonce] = true`
  - [x] Transfer USDC from contract to msg.sender
  - [x] Emit BridgeCompleted event from EventsLib
  - [x] Validate proof fields are non-zero

- [x] Task 4: Implement buyITPFromArbitrum function (AC: #3)
  - [x] Validate slippage tier <= MAX_SLIPPAGE_TIER (0, 1, 2)
  - [x] Validate deadline > block.timestamp (not expired)
  - [x] Validate deadline <= block.timestamp + MAX_DEADLINE_DURATION
  - [x] Validate amount > 0
  - [x] Transfer USDC from user to contract (SafeERC20)
  - [x] Generate unique orderId (increment crossChainOrderId)
  - [x] Emit CrossChainOrderCreated event
  - [x] Return orderId

- [x] Task 5: Implement view functions (AC: #4)
  - [x] `isNonceUsed(sourceChainId, nonce)` returns `bridgeCompleted[sourceChainId][nonce]`
  - [x] `l3IndexContract()` returns `l3Index` address
  - [x] `currentOrderId()` returns `crossChainOrderId`

- [x] Task 6: Add error codes to ErrorsLib (AC: #1)
  - [x] `E054_BridgeAlreadyCompleted(uint256 sourceChainId, uint256 nonce)`
  - [x] `E055_InvalidSourceChainId(uint256 sourceChainId)`
  - [x] `E056_ZeroL3IndexAddress()`
  - [x] `E057_InvalidProof()` (zero block hash, zero tx hash)
  - [x] `E058_InvalidDeadline(uint256 deadline, uint256 minDeadline, uint256 maxDeadline)`
  - [x] `E059_CrossChainOrderZeroAmount()`

- [x] Task 7: Update EventsLib if needed (AC: #2, #3)
  - [x] Verify BridgeCompleted event exists (already defined lines 109-114)
  - [x] Add CrossChainOrderCreated event if not already defined (already in IArbBridgeCustody interface)

- [x] Task 8: Create Foundry tests (AC: #5)
  - [x] Test completeBridge happy path
  - [x] Test BridgeCompleted event emission with correct parameters
  - [x] Test revert on already completed nonce (replay attack)
  - [x] Test different source chains can use same nonce
  - [x] Test buyITPFromArbitrum happy path
  - [x] Test CrossChainOrderCreated event emission
  - [x] Test revert on invalid slippage tier (> 2)
  - [x] Test revert on expired deadline
  - [x] Test revert on deadline too far (> 24h)
  - [x] Test revert on zero amount for cross-chain order
  - [x] Test BLS signature verification (Phase 1: empty pubkey bypass)
  - [x] Test zero amount for completeBridge (allowed - marks nonce used)
  - [x] Fuzz tests for amounts, chain IDs, nonces

- [x] Task 9: UUPS upgrade support
  - [x] Implement `_authorizeUpgrade` override
  - [x] Follow same upgrade pattern as L3BridgeCustody.sol (7-day standard / 24-hour emergency)
  - [x] Add upgrade proposal storage: `pendingUpgradeImpl`, `pendingUpgradeProposedAt`, `pendingUpgradeIsEmergency`
  - [x] Add `proposeUpgrade`, `proposeEmergencyUpgrade`, `executeUpgrade`, `cancelUpgrade` functions

## Dev Notes

### Architecture Reference

From architecture.md Section 5 (Multi-Chain Custody Deployment):
- ArbBridgeCustody.sol deployed on Arbitrum chain (Chain ID: 42161)
- Controls USDC inventory for 1inch swap hub operations
- Uses BLS (BN254) for signature verification
- Part of two-phase bridge pattern: Lock (L3) → Verify → Release (Arbitrum)

From architecture.md Section 13-14 (Bridge Contracts):
```
TWO-PHASE BRIDGE WITH VERIFICATION
───────────────────────────────────
PHASE 1: LOCK ON SOURCE (Story 2.9 - L3BridgeCustody)
1. Issuers BLS-sign: BRIDGE_LOCK(amount, destChain, nonce)
2. Contract locks USDC in escrow
3. Emit BridgeLockConfirmed(amount, destChain, nonce, blockHash)
4. Lock includes: block.number, blockhash(block.number - 1)

PHASE 2: VERIFY AND RELEASE ON DESTINATION (this story)
5. Issuers observe BridgeLockConfirmed via multiple RPCs
6. Wait for finality (N confirmations on L3)
7. Build release proof with source tx/block info
8. BLS-sign release on destination chain
9. Contract releases USDC after BLS verification
```

From architecture.md Section 14 (Cross-Chain ITP Purchase):
```
USER FLOW (from Arbitrum):
──────────────────────────
1. User has USDC on Arbitrum
2. User calls ArbBridgeCustody.buyITPFromArbitrum(itpId, amount)
3. USDC locked in Arbitrum Custody
4. Event: CrossChainBuyRequest(user, itpId, amount, sourceChain)
5. Issuers observe event
6. Issuers process as normal order (already has USDC on Arb)
7. ITP minted on L3 to user's address
8. User can bridge ITP to Arbitrum if desired (separate tx)
```

### Message Format (CRITICAL for Cross-Chain Safety)

**completeBridge:**
```solidity
bytes32 message = keccak256(abi.encode(
    block.chainid,           // 42161 for Arbitrum
    address(this),           // ArbBridgeCustody contract address
    proof,                   // ReleaseProof struct
    amount,                  // USDC amount (18 decimals)
    nonce                    // Nonce from source chain
));

// Where proof is TypesLib.ReleaseProof:
struct ReleaseProof {
    uint256 sourceChainId;      // e.g., 111222333 for Index L3
    uint256 sourceBlockNumber;  // Block number of lock tx
    bytes32 sourceBlockHash;    // Block hash for verification
    bytes32 sourceTxHash;       // Transaction hash of lock
}
```

**buyITPFromArbitrum (NO BLS required - user action):**
```solidity
// This is a USER action, not an issuer action
// User directly calls this to initiate cross-chain buy
// No BLS signature needed - user signs with their wallet
function buyITPFromArbitrum(
    bytes32 itpId,
    uint256 amount,
    uint256 limitPrice,
    uint256 slippageTier,
    uint256 deadline
) external returns (uint256 orderId);
```

### Contract Dependencies

**Imports:**
```solidity
import "../interfaces/IBridge.sol";           // IArbBridgeCustody interface
import "../interfaces/IIssuerRegistry.sol";   // For aggregated BLS pubkey
import "../libraries/BLSLib.sol";             // BLS signature verification
import "../libraries/ErrorsLib.sol";          // Custom errors
import "../libraries/EventsLib.sol";          // Event definitions
import "../libraries/TypesLib.sol";           // ReleaseProof struct
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
```

**Key Dependencies:**
- `BLSLib.sol` (Story 2.6) - BLS signature verification via BN254 precompiles
- `IIssuerRegistry` (Story 2.12) - Provides aggregated BLS public key
- `IArbBridgeCustody` (Epic 1) - Interface already defined in IBridge.sol
- `TypesLib.ReleaseProof` (lines 185-190) - Struct already defined
- `EventsLib.BridgeCompleted` (lines 109-114) - Event already defined

### Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| MAX_DEADLINE_DURATION | 24 hours | Max time for cross-chain orders |
| MAX_SLIPPAGE_TIER | 2 | Maximum slippage tier (0, 1, 2) |
| STANDARD_THRESHOLD | 11 | 11/20 issuers for standard ops |
| UPGRADE_TIMELOCK | 7 days | Standard upgrade timelock |
| EMERGENCY_UPGRADE_TIMELOCK | 24 hours | Emergency upgrade timelock |

### Storage Layout

```solidity
contract ArbBridgeCustody is Initializable, UUPSUpgradeable, IArbBridgeCustody {
    using SafeERC20 for IERC20;

    // Immutable references
    IIssuerRegistry public issuerRegistry;
    IERC20 public usdc;
    address public l3Index;  // L3 Index contract reference

    // Bridge state - double mapping for multi-chain support
    mapping(uint256 => mapping(uint256 => bool)) public bridgeCompleted;
    // bridgeCompleted[sourceChainId][nonce] = completed

    // Cross-chain order state
    uint256 public crossChainOrderId;

    // Upgrade state (same as L3BridgeCustody)
    address public pendingUpgradeImpl;
    uint256 public pendingUpgradeProposedAt;
    bool public pendingUpgradeIsEmergency;

    // Storage gap for upgrades
    uint256[42] private __gap;
}
```

### Error Handling

New errors for Story 2.10 (add to ErrorsLib.sol):
```solidity
/// @notice E054: Bridge already completed for this source chain + nonce
/// @param sourceChainId Source chain ID
/// @param nonce Nonce that was already completed
error E054_BridgeAlreadyCompleted(uint256 sourceChainId, uint256 nonce);

/// @notice E055: Invalid source chain ID (zero or same as current)
/// @param sourceChainId The invalid chain ID
error E055_InvalidSourceChainId(uint256 sourceChainId);

/// @notice E056: Zero address for L3 Index contract
error E056_ZeroL3IndexAddress();

/// @notice E057: Invalid proof (zero values not allowed)
error E057_InvalidProof();

/// @notice E058: Invalid deadline for cross-chain order
/// @param deadline The provided deadline
/// @param minDeadline Minimum allowed deadline
/// @param maxDeadline Maximum allowed deadline
error E058_InvalidDeadline(uint256 deadline, uint256 minDeadline, uint256 maxDeadline);

/// @notice E059: Zero amount for cross-chain order
error E059_CrossChainOrderZeroAmount();
```

### Events

Events already defined in EventsLib.sol:
```solidity
// BridgeCompleted (lines 109-114) - already exists
event BridgeCompleted(
    uint256 indexed sourceChainId,
    uint256 indexed nonce,
    uint256 amount,
    bytes32 sourceTxHash
);
```

CrossChainOrderCreated defined in IArbBridgeCustody interface (IBridge.sol lines 150-155):
```solidity
event CrossChainOrderCreated(
    uint256 indexed orderId,
    bytes32 indexed itpId,
    address indexed user,
    uint256 amount
);
```

### Project Structure Notes

**File Location:**
```
contracts/
├── src/
│   ├── custody/
│   │   ├── BLSCustody.sol          ← EXISTS (Story 2.7)
│   │   ├── L3BridgeCustody.sol     ← EXISTS (Story 2.9)
│   │   └── ArbBridgeCustody.sol    ← NEW (this story)
│   ├── interfaces/
│   │   ├── IBLSCustody.sol         ← EXISTS
│   │   └── IBridge.sol             ← EXISTS (IArbBridgeCustody defined)
│   └── libraries/
│       ├── BLSLib.sol              ← EXISTS (Story 2.6)
│       ├── ErrorsLib.sol           ← UPDATE (add E054-E059)
│       ├── EventsLib.sol           ← EXISTS (BridgeCompleted already defined)
│       └── TypesLib.sol            ← EXISTS (ReleaseProof defined)
└── test/
    └── ArbBridgeCustody.t.sol      ← NEW (this story)
```

### Testing Standards

**Phase 1 Mock Verification:**
- MockIssuerRegistry returns empty aggregated pubkey
- Empty BLS signature passes verification when pubkey.length == 0
- Use MockERC20 for USDC in tests
- Production will use real BLS signatures

**Test Setup:**
```solidity
contract ArbBridgeCustodyTest is Test {
    ArbBridgeCustody custody;
    MockIssuerRegistry mockRegistry;
    MockERC20 usdc;

    // Chain IDs
    uint256 constant L3_CHAIN_ID = 111222333;
    uint256 constant ARB_CHAIN_ID = 42161;

    function setUp() public {
        // Set Arbitrum chain ID for testing
        vm.chainId(ARB_CHAIN_ID);

        mockRegistry = new MockIssuerRegistry();
        usdc = new MockERC20("USDC", "USDC", 18);

        // Deploy implementation
        ArbBridgeCustody impl = new ArbBridgeCustody();

        // Deploy proxy
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(impl),
            abi.encodeCall(impl.initialize, (
                address(mockRegistry),
                address(usdc),
                address(0x1234)  // Mock L3 Index address
            ))
        );

        custody = ArbBridgeCustody(address(proxy));

        // Fund custody for release tests
        usdc.mint(address(custody), 1_000_000e18);

        // Fund user for cross-chain buy tests
        usdc.mint(address(this), 1_000_000e18);
        usdc.approve(address(custody), type(uint256).max);
    }
}
```

**Release Proof Testing:**
```solidity
function testCompleteBridgeHappyPath() public {
    TypesLib.ReleaseProof memory proof = TypesLib.ReleaseProof({
        sourceChainId: L3_CHAIN_ID,
        sourceBlockNumber: 12345,
        sourceBlockHash: keccak256("block"),
        sourceTxHash: keccak256("tx")
    });

    bytes memory emptySignature = "";
    uint256 amount = 1000e18;
    uint256 nonce = 0;

    custody.completeBridge(L3_CHAIN_ID, amount, nonce, proof, emptySignature);

    assertTrue(custody.isNonceUsed(L3_CHAIN_ID, nonce));
}
```

### Security Considerations

1. **Replay Attack Prevention:** Double mapping `bridgeCompleted[sourceChainId][nonce]` ensures each nonce from each source chain can only be used once

2. **Cross-Chain Replay Prevention:** Message includes `block.chainid` and `address(this)` to prevent signatures from being reused on different chains/contracts

3. **Proof Verification:** Issuers verify lock event via multiple RPCs before signing release. Contract validates proof fields are non-zero

4. **User vs Issuer Actions:**
   - `completeBridge` - ISSUER action, requires BLS signature
   - `buyITPFromArbitrum` - USER action, no BLS required (user's wallet signature)

5. **Fund Security:**
   - completeBridge transfers to msg.sender (expected to be called by keeper with correct recipient encoding in calldata)
   - buyITPFromArbitrum locks user's USDC in custody until order is processed

### Downstream Dependencies

**Epic 6 Integration:**
- Story 6.5: Deploy BLSCustody to Arbitrum
- Story 6.8: Bridge integration test (L3↔Arb)
- Story 6.12: E2E Test - Cross-Chain Buy

**Issuer Node (Epic 3):**
- Will observe CrossChainOrderCreated events
- Will create internal orders as if submitted on L3
- Will BLS-sign completeBridge calls after verifying L3 locks

### References

- [Source: architecture.md#5-multi-chain-custody-deployment] - ArbBridgeCustody specification
- [Source: architecture.md#13-multi-chain-collateral--custody] - Bridge flow diagram
- [Source: architecture.md#arbitrum-destination-contract] - Solidity implementation reference (lines 1671-1706)
- [Source: architecture.md#cross-chain-itp-purchase] - buyITPFromArbitrum specification (lines 721-767)
- [Source: architecture.md#bridge-security-properties] - Security mitigations
- [Source: contracts/src/interfaces/IBridge.sol#89-156] - IArbBridgeCustody interface
- [Source: contracts/src/libraries/TypesLib.sol#185-190] - ReleaseProof struct
- [Source: contracts/src/libraries/EventsLib.sol#109-114] - BridgeCompleted event
- [Source: epics.md#story-210] - Original acceptance criteria

### Previous Story Intelligence

From **Story 2.9 (L3BridgeCustody - Source Lock):**
- Two-phase bridge pattern: lock on source (2.9), release on destination (this story)
- BLS signature verification pattern with Phase 1 empty pubkey bypass
- Message format includes chainId and address(this) for cross-chain safety
- UUPS upgrade pattern with 7-day standard / 24-hour emergency timelocks
- 47 tests passing, cancelUpgrade added in code review
- PendingLock struct pattern for tracking bridge state

From **Story 2.7 (BLSCustody Core Execution):**
- BLS signature verification pattern using BLSLib
- Nonce handling patterns (this story uses double mapping instead of bitmap)
- 56 tests passing, comprehensive error handling
- Phase 1: empty pubkey skips verification (security documented)

From **Story 2.8 (BLSCustody Whitelist Management):**
- Not directly applicable (ArbBridgeCustody doesn't use whitelist for bridge ops)
- Timelock patterns for upgrades are reused

### Git Intelligence

Recent commits (2026-01-30):
- `d1fc425` Story 5.9: Add TokenRegistry and mock RPC error tests
- `81e8cce` Fix code review issues for Story 5-7 (1inch Fusion+ Client)
- `d21d866` Add common crate dependencies and module exports

Pattern observations:
- Stories follow consistent structure
- Tests are comprehensive (47 for L3BridgeCustody)
- Custom errors in ErrorsLib preferred over require strings
- Events in EventsLib or interface files
- SafeERC20 for token transfers

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None - clean implementation

### Completion Notes List

- Implemented ArbBridgeCustody.sol following L3BridgeCustody.sol patterns
- Added 6 new error codes (E054-E059) to ErrorsLib.sol
- completeBridge: validates source chain, proof fields, BLS signature, marks nonce used, transfers USDC
- buyITPFromArbitrum: validates slippage tier (0-2), deadline (1s to 24h), amount >0, transfers USDC, emits event
- Zero amount allowed for completeBridge (just marks nonce used without transfer)
- Added comprehensive tests: 57 tests passing (including fuzz tests, post-review)
- Full regression suite: 665 tests passing (5 pre-existing failures in other contracts)
- Events use both interface events and EventsLib events for completeBridge
- UUPS upgrade pattern identical to L3BridgeCustody (7-day standard, 24-hour emergency)
- Storage gap: 41 slots reserved for future upgrades
- Phase 1 security note: empty BLS pubkey bypasses verification (documented)

### File List

- contracts/src/custody/ArbBridgeCustody.sol (NEW)
- contracts/src/libraries/ErrorsLib.sol (MODIFIED - added E054-E059)
- contracts/test/ArbBridgeCustody.t.sol (NEW)

### Change Log

| Date | Change |
|------|--------|
| 2026-01-30 | Initial implementation complete - 52 tests passing, all ACs satisfied |
| 2026-01-30 | Code review: Fixed 6 issues (3H, 3M). Stored CrossChainOrder params in mapping, added getCrossChainOrder(), added itpId zero check, added sourceBlockNumber validation, added 5 new tests. 57 tests passing. |

