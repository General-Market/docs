# P2Pool Vision Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace Vision's bilateral betting with a sealed parimutuel P2Pool prediction market — single Vision.sol contract, issuer tick engine, extended data-node, new frontend.

**Architecture:** Single `Vision.sol` monolith contract (batches + pool vault + bot registry) on Orbit L3. Issuer gets new `p2pool/` module for tick-based resolution with BLS consensus. Data-node extended with new collectors (Polymarket, Twitch, HackerNews) and P2Pool endpoints. Frontend replaces Vision tab with cards grid + inline expansion + Pyodide Python strategy editor.

**Tech Stack:** Solidity 0.8.24 (Foundry), Rust (tokio + axum), Next.js 15 + React 19, Tailwind, wagmi v3 + viem, Pyodide (WASM Python)

**Reference:** Design doc at `docs/plans/2026-02-21-p2pool-design.md`

---

## Phase 1: Smart Contract — Vision.sol

### Task 1.1: Create Vision.sol skeleton with storage layout

**Files:**
- Create: `contracts/src/vision/Vision.sol`
- Create: `contracts/src/interfaces/IVision.sol`

**Step 1: Write the interface**

Create `contracts/src/interfaces/IVision.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IVision {
    // ============ ENUMS ============
    enum ResolutionType { UP_0, UP_30, UP_X, DOWN_0, DOWN_30, DOWN_X, FLAT_0, FLAT_X }

    // ============ STRUCTS ============
    struct Batch {
        address creator;
        bytes32[] marketIds;
        uint8[] resolutionTypes;
        uint256 tickDuration;
        uint256[] customThresholds;
        uint256 createdAtTick;     // immutable — when batch was created (block.timestamp / tickDuration)
        // NOTE: No on-chain currentTick. Ticks are deterministic: tick_n = createdAtTick + n.
        // The issuer tracks tick progression off-chain and attests via BLS signatures
        // that include (fromTick, toTick) ranges. The contract enforces monotonic tick
        // claims via lastClaimedTick without needing on-chain tick advancement.
        bool paused;
    }

    struct PlayerPosition {
        bytes32 bitmapHash;
        uint256 stakePerTick;
        uint256 startTick;
        uint256 balance;
        uint256 lastClaimedTick;
        uint256 joinTimestamp;
        uint256 totalDeposited;  // cumulative USDC deposited (joinBatch + deposit calls)
        uint256 totalClaimed;    // cumulative USDC paid out via claimRewards
    }

    struct Bot {
        string endpoint;
        bytes32 pubkeyHash;
        uint256 stakedAmount;
        uint256 registeredAt;
        bool isActive;
    }

    // ============ BATCH MANAGEMENT ============
    function createBatch(
        bytes32[] calldata marketIds,
        uint8[] calldata resolutionTypes,
        uint256 tickDuration,
        uint256[] calldata customThresholds
    ) external returns (uint256 batchId);

    function updateBatchMarkets(
        uint256 batchId,
        bytes32[] calldata marketIds,
        uint8[] calldata resolutionTypes,
        bytes calldata blsSig
    ) external;

    function getBatch(uint256 batchId) external view returns (Batch memory);

    // ============ PLAYER OPERATIONS ============
    function joinBatch(
        uint256 batchId,
        uint256 depositAmount,
        uint256 stakePerTick,
        bytes32 bitmapHash
    ) external;

    function updateBitmap(uint256 batchId, bytes32 newBitmapHash) external;

    function deposit(uint256 batchId, uint256 amount) external;

    function claimRewards(
        uint256 batchId,
        uint256 fromTick,
        uint256 toTick,
        uint256 newBalance,
        bytes calldata blsSignature
    ) external;

    function withdraw(
        uint256 batchId,
        uint256 finalBalance,
        bytes calldata blsSignature
    ) external;

    function getPosition(uint256 batchId, address player) external view returns (PlayerPosition memory);

    // ============ BOT REGISTRY ============
    function registerBot(string calldata endpoint, bytes32 pubkeyHash) external;
    function deregisterBot() external;
    function getAllActiveBots() external view returns (address[] memory, Bot[] memory);

    // ============ FEE MANAGEMENT ============
    function collectFees() external;

    // ============ ISSUER OPERATIONS ============
    function pause(uint256 batchId, bytes calldata blsSignature) external;
    function unpause(uint256 batchId, bytes calldata blsSignature) external;
    function forceWithdraw(uint256 batchId, address player, uint256 finalBalance, bytes calldata blsSignature) external;
}
```

**Step 2: Write the contract skeleton**

Create `contracts/src/vision/Vision.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {BLSLib} from "../libraries/BLSLib.sol";
import {IVision} from "../interfaces/IVision.sol";

contract Vision is IVision, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ CONSTANTS ============
    uint256 public constant PROTOCOL_FEE_BPS = 30; // 0.3%
    uint256 public constant MIN_STAKE_PER_TICK = 1e5; // 0.1 USDC (6 decimals)
    uint256 public constant BOT_MIN_STAKE = 1e18; // 1 WIND (18 decimals)
    uint256 public constant BPS_DENOMINATOR = 10000;

    // ============ IMMUTABLES ============
    IERC20 public immutable USDC;
    IERC20 public immutable WIND;
    address public immutable issuerRegistry;

    // ============ STATE ============
    uint256 public nextBatchId;
    mapping(uint256 => Batch) internal _batches;
    mapping(uint256 => mapping(address => PlayerPosition)) internal _positions;
    uint256 public accumulatedFees;
    address public feeCollector;

    // Bot registry state — indexed for O(1) lookup/removal
    mapping(address => Bot) internal _bots;
    address[] internal _botAddresses;
    mapping(address => uint256) internal _botIndex; // address → index in _botAddresses (1-indexed, 0 = not present)

    // ============ ERRORS ============
    error InvalidBLSSignature();
    error BatchNotFound();
    error BatchPaused();
    error Unauthorized();
    error InsufficientDeposit();
    error StakeBelowMinimum();
    error ArrayLengthMismatch();
    error AlreadyJoined();
    error NotJoined();
    error TickAlreadyClaimed();
    error InvalidTickRange();
    error InvalidTickDuration();
    error InsolventPayout();
    error BotAlreadyRegistered();
    error BotNotRegistered();
    error InsufficientBotStake();

    // ============ EVENTS ============
    event BatchCreated(uint256 indexed batchId, address indexed creator, uint256 tickDuration);
    event BatchMarketsUpdated(uint256 indexed batchId);
    event BatchPaused(uint256 indexed batchId);
    event BatchUnpaused(uint256 indexed batchId);
    event PlayerJoined(uint256 indexed batchId, address indexed player, uint256 stakePerTick, bytes32 bitmapHash);
    event PlayerDeposited(uint256 indexed batchId, address indexed player, uint256 amount);
    event RewardsClaimed(uint256 indexed batchId, address indexed player, uint256 amount);
    event PlayerWithdrawn(uint256 indexed batchId, address indexed player, uint256 amount);
    event ForceWithdrawn(uint256 indexed batchId, address indexed player, uint256 amount);
    event BotRegistered(address indexed bot, string endpoint);
    event BotDeregistered(address indexed bot);

    constructor(address _usdc, address _wind, address _issuerRegistry, address _feeCollector) {
        USDC = IERC20(_usdc);
        WIND = IERC20(_wind);
        issuerRegistry = _issuerRegistry;
        feeCollector = _feeCollector;
    }

    // Implementation stubs — filled in subsequent tasks
}
```

**Step 3: Verify it compiles**

Run: `cd contracts && forge build`
Expected: Compiles with warnings about unused variables (stubs)

**Step 4: Commit**

```bash
git add contracts/src/vision/Vision.sol contracts/src/interfaces/IVision.sol
git commit -m "feat(contracts): add Vision.sol skeleton with P2Pool storage layout"
```

---

### Task 1.2: Implement batch management functions

**Files:**
- Modify: `contracts/src/vision/Vision.sol`

**Step 1: Write failing test**

Create `contracts/test/Vision.t.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {Vision} from "../src/vision/Vision.sol";
import {IVision} from "../src/interfaces/IVision.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

contract VisionTest is Test {
    Vision public vision;
    MockERC20 public usdc;
    MockERC20 public wind;
    address public issuerRegistry;
    address public feeCollector;

    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    function setUp() public {
        usdc = new MockERC20("USDC", "USDC", 6);
        wind = new MockERC20("WIND", "WIND", 18);
        issuerRegistry = makeAddr("issuerRegistry");
        feeCollector = makeAddr("feeCollector");

        vision = new Vision(
            address(usdc),
            address(wind),
            issuerRegistry,
            feeCollector
        );
    }

    function test_createBatch() public {
        bytes32[] memory marketIds = new bytes32[](2);
        marketIds[0] = keccak256("btc_usd_10m");
        marketIds[1] = keccak256("eth_usd_10m");

        uint8[] memory resTypes = new uint8[](2);
        resTypes[0] = 0; // UP_0
        resTypes[1] = 3; // DOWN_0

        uint256[] memory thresholds = new uint256[](0);

        vm.prank(alice);
        uint256 batchId = vision.createBatch(marketIds, resTypes, 600, thresholds);
        assertEq(batchId, 0);

        IVision.Batch memory batch = vision.getBatch(batchId);
        assertEq(batch.creator, alice);
        assertEq(batch.marketIds.length, 2);
        assertEq(batch.tickDuration, 600);
        assertFalse(batch.paused);
    }

    function test_createBatch_revertOnMismatch() public {
        bytes32[] memory marketIds = new bytes32[](2);
        uint8[] memory resTypes = new uint8[](1); // mismatch
        uint256[] memory thresholds = new uint256[](0);

        vm.prank(alice);
        vm.expectRevert(Vision.ArrayLengthMismatch.selector);
        vision.createBatch(marketIds, resTypes, 600, thresholds);
    }

    function test_createBatch_revertZeroTickDuration() public {
        bytes32[] memory marketIds = new bytes32[](1);
        marketIds[0] = keccak256("btc_usd_10m");
        uint8[] memory resTypes = new uint8[](1);
        resTypes[0] = 0;
        uint256[] memory thresholds = new uint256[](0);

        vm.prank(alice);
        vm.expectRevert(Vision.InvalidTickDuration.selector);
        vision.createBatch(marketIds, resTypes, 0, thresholds);
    }

    function test_createBatch_revertExcessiveTickDuration() public {
        bytes32[] memory marketIds = new bytes32[](1);
        marketIds[0] = keccak256("btc_usd_10m");
        uint8[] memory resTypes = new uint8[](1);
        resTypes[0] = 0;
        uint256[] memory thresholds = new uint256[](0);

        vm.prank(alice);
        vm.expectRevert(Vision.InvalidTickDuration.selector);
        vision.createBatch(marketIds, resTypes, 31 days, thresholds);
    }

    function test_updateBatchMarkets() public {
        // Create first
        bytes32[] memory mIds = new bytes32[](1);
        mIds[0] = keccak256("btc_usd_10m");
        uint8[] memory rTypes = new uint8[](1);
        rTypes[0] = 0;
        uint256[] memory thresholds = new uint256[](0);

        vm.prank(alice);
        uint256 batchId = vision.createBatch(mIds, rTypes, 600, thresholds);

        // Update — requires BLS signature from issuers
        bytes32[] memory newIds = new bytes32[](2);
        newIds[0] = keccak256("btc_usd_10m");
        newIds[1] = keccak256("sol_usd_10m");
        uint8[] memory newTypes = new uint8[](2);
        newTypes[0] = 0;
        newTypes[1] = 0;

        // Build BLS message hash matching the contract's computation
        uint256 currentTick = block.timestamp / 600;
        bytes32 msgHash = keccak256(abi.encodePacked(
            batchId, keccak256(abi.encodePacked(newIds)),
            keccak256(abi.encodePacked(newTypes)), currentTick
        ));
        bytes memory blsSig = _signBLS(msgHash); // uses bls-tool test fixture

        vm.prank(alice);
        vision.updateBatchMarkets(batchId, newIds, newTypes, blsSig);

        IVision.Batch memory batch = vision.getBatch(batchId);
        assertEq(batch.marketIds.length, 2);
    }

    function test_updateBatchMarkets_revertNonCreator() public {
        bytes32[] memory mIds = new bytes32[](1);
        mIds[0] = keccak256("btc_usd_10m");
        uint8[] memory rTypes = new uint8[](1);
        rTypes[0] = 0;
        uint256[] memory thresholds = new uint256[](0);

        vm.prank(alice);
        uint256 batchId = vision.createBatch(mIds, rTypes, 600, thresholds);

        vm.prank(bob); // not creator
        vm.expectRevert(Vision.Unauthorized.selector);
        vision.updateBatchMarkets(batchId, mIds, rTypes, bytes(""));
    }
}
```

Also create mock if not present — `contracts/test/mocks/MockERC20.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    uint8 private _decimals;

    constructor(string memory name, string memory symbol, uint8 dec) ERC20(name, symbol) {
        _decimals = dec;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
```

**Step 2: Run test to verify it fails**

Run: `cd contracts && forge test --match-contract VisionTest -v`
Expected: FAIL — functions not implemented

**Step 3: Implement batch management**

In `contracts/src/vision/Vision.sol`, add to the contract body:

```solidity
function createBatch(
    bytes32[] calldata marketIds,
    uint8[] calldata resolutionTypes,
    uint256 tickDuration,
    uint256[] calldata customThresholds
) external returns (uint256 batchId) {
    if (marketIds.length != resolutionTypes.length) revert ArrayLengthMismatch();
    if (tickDuration == 0 || tickDuration > 30 days) revert InvalidTickDuration();

    batchId = nextBatchId++;

    Batch storage batch = _batches[batchId];
    batch.creator = msg.sender;
    batch.tickDuration = tickDuration;
    batch.createdAtTick = block.timestamp / tickDuration;

    for (uint256 i = 0; i < marketIds.length; i++) {
        batch.marketIds.push(marketIds[i]);
        batch.resolutionTypes.push(resolutionTypes[i]);
    }
    for (uint256 i = 0; i < customThresholds.length; i++) {
        batch.customThresholds.push(customThresholds[i]);
    }

    emit BatchCreated(batchId, msg.sender, tickDuration);
}

function updateBatchMarkets(
    uint256 batchId,
    bytes32[] calldata marketIds,
    uint8[] calldata resolutionTypes,
    bytes calldata blsSig
) external {
    Batch storage batch = _batches[batchId];
    if (batch.creator != msg.sender) revert Unauthorized();
    if (marketIds.length != resolutionTypes.length) revert ArrayLengthMismatch();

    // BLS-gated: issuers must approve market changes to prevent
    // mid-tick manipulation. Tick is computed deterministically (no on-chain currentTick).
    uint256 currentTick = block.timestamp / batch.tickDuration;
    bytes32 msgHash = keccak256(abi.encodePacked(
        batchId, keccak256(abi.encodePacked(marketIds)),
        keccak256(abi.encodePacked(resolutionTypes)), currentTick
    ));
    if (!issuerRegistry.verifyAggregated(msgHash, blsSig)) revert InvalidBLSSignature();

    delete batch.marketIds;
    delete batch.resolutionTypes;

    for (uint256 i = 0; i < marketIds.length; i++) {
        batch.marketIds.push(marketIds[i]);
        batch.resolutionTypes.push(resolutionTypes[i]);
    }

    emit BatchMarketsUpdated(batchId);
}

function getBatch(uint256 batchId) external view returns (Batch memory) {
    return _batches[batchId];
}
```

**Step 4: Run tests**

Run: `cd contracts && forge test --match-contract VisionTest -v`
Expected: All 4 tests PASS

**Step 5: Commit**

```bash
git add contracts/src/vision/Vision.sol contracts/test/Vision.t.sol contracts/test/mocks/MockERC20.sol
git commit -m "feat(contracts): implement batch management in Vision.sol"
```

---

### Task 1.3: Implement player operations (join, deposit, claim, withdraw)

**Files:**
- Modify: `contracts/src/vision/Vision.sol`
- Modify: `contracts/test/Vision.t.sol`

**Step 1: Write failing tests**

Add to `contracts/test/Vision.t.sol`:

```solidity
function _createDefaultBatch() internal returns (uint256) {
    bytes32[] memory mIds = new bytes32[](1);
    mIds[0] = keccak256("btc_usd_10m");
    uint8[] memory rTypes = new uint8[](1);
    rTypes[0] = 0;
    uint256[] memory thresholds = new uint256[](0);

    return vision.createBatch(mIds, rTypes, 600, thresholds);
}

function test_joinBatch() public {
    uint256 batchId = _createDefaultBatch();
    uint256 depositAmount = 100e6; // 100 USDC
    uint256 stakePerTick = 1e6;    // 1 USDC/tick
    bytes32 bitmapHash = keccak256("test_bitmap");

    usdc.mint(alice, depositAmount);
    vm.startPrank(alice);
    usdc.approve(address(vision), depositAmount);
    vision.joinBatch(batchId, depositAmount, stakePerTick, bitmapHash);
    vm.stopPrank();

    // Verify USDC transferred
    assertEq(usdc.balanceOf(address(vision)), depositAmount);
    assertEq(usdc.balanceOf(alice), 0);

    // Verify position stored
    IVision.PlayerPosition memory pos = vision.getPosition(batchId, alice);
    assertEq(pos.balance, depositAmount);
    assertEq(pos.stakePerTick, stakePerTick);
    assertEq(pos.bitmapHash, bitmapHash);
}

function test_joinBatch_revertBelowMinStake() public {
    uint256 batchId = _createDefaultBatch();
    usdc.mint(alice, 1e6);

    vm.startPrank(alice);
    usdc.approve(address(vision), 1e6);
    vm.expectRevert(Vision.StakeBelowMinimum.selector);
    vision.joinBatch(batchId, 1e6, 1e4, keccak256("bitmap")); // 0.01 USDC < 0.1 min
    vm.stopPrank();
}

function test_updateBitmap() public {
    uint256 batchId = _createDefaultBatch();
    usdc.mint(alice, 100e6);

    vm.startPrank(alice);
    usdc.approve(address(vision), 100e6);
    vision.joinBatch(batchId, 100e6, 1e6, keccak256("bitmap_v1"));

    bytes32 newHash = keccak256("bitmap_v2");
    vision.updateBitmap(batchId, newHash);
    vm.stopPrank();

    IVision.PlayerPosition memory pos = vision.getPosition(batchId, alice);
    assertEq(pos.bitmapHash, newHash);
}

function test_deposit() public {
    uint256 batchId = _createDefaultBatch();

    usdc.mint(alice, 200e6);
    vm.startPrank(alice);
    usdc.approve(address(vision), 200e6);
    vision.joinBatch(batchId, 100e6, 1e6, keccak256("bitmap"));
    vision.deposit(batchId, 100e6);
    vm.stopPrank();

    assertEq(usdc.balanceOf(address(vision)), 200e6);
}
```

**Step 2: Run test to verify failures**

Run: `cd contracts && forge test --match-test "test_joinBatch|test_deposit" -v`
Expected: FAIL — functions not implemented

**Step 3: Implement player operations**

Add to `contracts/src/vision/Vision.sol`:

```solidity
function joinBatch(
    uint256 batchId,
    uint256 depositAmount,
    uint256 stakePerTick,
    bytes32 bitmapHash
) external nonReentrant {
    if (stakePerTick < MIN_STAKE_PER_TICK) revert StakeBelowMinimum();
    if (depositAmount == 0) revert InsufficientDeposit();
    Batch storage batch = _batches[batchId];
    if (batch.creator == address(0)) revert BatchNotFound();
    if (batch.paused) revert BatchPaused();

    PlayerPosition storage pos = _positions[batchId][msg.sender];
    if (pos.joinTimestamp != 0) revert AlreadyJoined();

    USDC.safeTransferFrom(msg.sender, address(this), depositAmount);

    pos.bitmapHash = bitmapHash;
    pos.stakePerTick = stakePerTick;
    pos.startTick = block.timestamp / batch.tickDuration;
    pos.balance = depositAmount;
    pos.totalDeposited = depositAmount;
    pos.lastClaimedTick = pos.startTick;
    pos.joinTimestamp = block.timestamp;

    emit PlayerJoined(batchId, msg.sender, stakePerTick, bitmapHash);
}

// NOTE: No updateBitmap function. Bitmap hash is immutable — set once at joinBatch.
// Players commit to a strategy upfront. To change strategy, withdraw and rejoin.

function deposit(uint256 batchId, uint256 amount) external nonReentrant {
    PlayerPosition storage pos = _positions[batchId][msg.sender];
    if (pos.joinTimestamp == 0) revert NotJoined();

    USDC.safeTransferFrom(msg.sender, address(this), amount);
    pos.balance += amount;
    pos.totalDeposited += amount;

    emit PlayerDeposited(batchId, msg.sender, amount);
}

function claimRewards(
    uint256 batchId,
    uint256 fromTick,
    uint256 toTick,
    uint256 newBalance,
    bytes calldata blsSignature
) external nonReentrant {
    PlayerPosition storage pos = _positions[batchId][msg.sender];
    if (pos.joinTimestamp == 0) revert NotJoined();

    // Monotonic tick enforcement — prevents replay of old BLS signatures
    if (fromTick <= pos.lastClaimedTick) revert TickAlreadyClaimed();
    if (toTick < fromTick) revert InvalidTickRange();

    // Verify BLS signature — issuers attest newBalance is correct after resolution
    bytes32 message = keccak256(abi.encode(
        block.chainid,
        address(this),
        "CLAIM",
        batchId,
        msg.sender,
        fromTick,
        toTick,
        newBalance
    ));
    _verifyBLS(message, blsSignature);

    // newBalance is the issuer-attested balance after tick resolution.
    // Claims are fee-free — fees are collected on withdraw based on lifetime profit.
    // This avoids overtaxing players who lose then recover (finding 9 fix).
    if (newBalance > pos.balance) {
        uint256 claimable = newBalance - pos.balance;

        // Solvency check
        if (USDC.balanceOf(address(this)) < claimable + accumulatedFees) revert InsolventPayout();

        pos.balance = newBalance;
        pos.lastClaimedTick = toTick;
        pos.totalClaimed += claimable;

        USDC.safeTransfer(msg.sender, claimable);
        emit RewardsClaimed(batchId, msg.sender, claimable);
    } else {
        // Balance decreased (losses) — update on-chain state without payout
        pos.balance = newBalance;
        pos.lastClaimedTick = toTick;
    }
}

function withdraw(
    uint256 batchId,
    uint256 finalBalance,
    bytes calldata blsSignature
) external nonReentrant {
    PlayerPosition storage pos = _positions[batchId][msg.sender];
    if (pos.joinTimestamp == 0) revert NotJoined();

    // Verify BLS signature
    bytes32 message = keccak256(abi.encode(
        block.chainid,
        address(this),
        "WITHDRAW",
        batchId,
        msg.sender,
        finalBalance
    ));
    _verifyBLS(message, blsSignature);

    // Fee on lifetime profit: total extracted (finalBalance + past claims) vs total deposited
    uint256 totalExtracted = finalBalance + pos.totalClaimed;
    uint256 fee = 0;
    if (totalExtracted > pos.totalDeposited) {
        uint256 profit = totalExtracted - pos.totalDeposited;
        fee = (profit * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
    }
    uint256 payout = finalBalance - fee;

    // Solvency check — must cover payout + existing fees + this new fee
    if (USDC.balanceOf(address(this)) < payout + accumulatedFees + fee) revert InsolventPayout();
    accumulatedFees += fee;

    // Clear position
    delete _positions[batchId][msg.sender];

    USDC.safeTransfer(msg.sender, payout);
    emit PlayerWithdrawn(batchId, msg.sender, payout);
}

function getPosition(uint256 batchId, address player) external view returns (PlayerPosition memory) {
    return _positions[batchId][player];
}

// ============ INTERNAL ============

function _verifyBLS(bytes32 message, bytes calldata blsSignature) internal view {
    // Read aggregated pubkey from IssuerRegistry
    (bool success, bytes memory data) = issuerRegistry.staticcall(
        abi.encodeWithSignature("getAggregatedPubkey()")
    );
    require(success, "Failed to read aggregated pubkey");
    bytes memory aggregatedPubkey = abi.decode(data, (bytes));

    if (!BLSLib.verifyBLS(aggregatedPubkey, message, blsSignature)) {
        revert InvalidBLSSignature();
    }
}
```

**Step 4: Run tests**

Run: `cd contracts && forge test --match-contract VisionTest -v`
Expected: join + deposit + updateBitmap tests PASS. BLS-gated functions (claimRewards, withdraw, forceWithdraw, pause) MUST use precomputed BLS test fixtures generated with `bls-tool` binary (see `scripts/bls-tool/`). Set up a mock IssuerRegistry in the test that returns a known aggregated pubkey, then sign messages with the corresponding test secret key. **No BLS bypass paths — per CLAUDE.md rules.**

**Step 5: Commit**

```bash
git add contracts/src/vision/Vision.sol contracts/test/Vision.t.sol
git commit -m "feat(contracts): implement player operations in Vision.sol"
```

---

### Task 1.4: Implement bot registry and issuer operations

**Files:**
- Modify: `contracts/src/vision/Vision.sol`
- Modify: `contracts/test/Vision.t.sol`

**Step 1: Write failing tests**

Add to `contracts/test/Vision.t.sol`:

```solidity
function test_registerBot() public {
    wind.mint(alice, 1e18);

    vm.startPrank(alice);
    wind.approve(address(vision), 1e18);
    vision.registerBot("https://bot.example.com", keccak256("pubkey"));
    vm.stopPrank();

    (address[] memory addrs, IVision.Bot[] memory bots) = vision.getAllActiveBots();
    assertEq(addrs.length, 1);
    assertEq(addrs[0], alice);
    assertTrue(bots[0].isActive);
    assertEq(bots[0].stakedAmount, 1e18);
}

function test_deregisterBot() public {
    wind.mint(alice, 1e18);
    vm.startPrank(alice);
    wind.approve(address(vision), 1e18);
    vision.registerBot("https://bot.example.com", keccak256("pubkey"));
    vision.deregisterBot();
    vm.stopPrank();

    (address[] memory addrs,) = vision.getAllActiveBots();
    assertEq(addrs.length, 0);
}

function test_pause_revertNonIssuer() public {
    uint256 batchId = _createDefaultBatch();

    // Without valid BLS sig, should revert
    vm.prank(alice);
    vm.expectRevert(); // BLS verification will fail
    vision.pause(batchId, hex"");
}
```

**Step 2: Implement bot registry + issuer ops**

Add to `contracts/src/vision/Vision.sol`:

```solidity
// ============ BOT REGISTRY ============

function registerBot(string calldata endpoint, bytes32 pubkeyHash) external nonReentrant {
    if (_bots[msg.sender].isActive) revert BotAlreadyRegistered();

    WIND.safeTransferFrom(msg.sender, address(this), BOT_MIN_STAKE);

    _bots[msg.sender] = Bot({
        endpoint: endpoint,
        pubkeyHash: pubkeyHash,
        stakedAmount: BOT_MIN_STAKE,
        registeredAt: block.timestamp,
        isActive: true
    });
    _botAddresses.push(msg.sender);
    _botIndex[msg.sender] = _botAddresses.length; // 1-indexed

    emit BotRegistered(msg.sender, endpoint);
}

function deregisterBot() external nonReentrant {
    Bot storage bot = _bots[msg.sender];
    if (!bot.isActive) revert BotNotRegistered();

    uint256 stake = bot.stakedAmount;
    bot.isActive = false;
    bot.stakedAmount = 0;

    // O(1) removal using index mapping — swap with last, pop
    uint256 idx = _botIndex[msg.sender];
    if (idx > 0) {
        uint256 lastIdx = _botAddresses.length;
        if (idx != lastIdx) {
            address lastAddr = _botAddresses[lastIdx - 1];
            _botAddresses[idx - 1] = lastAddr;
            _botIndex[lastAddr] = idx;
        }
        _botAddresses.pop();
        delete _botIndex[msg.sender];
    }

    WIND.safeTransfer(msg.sender, stake);
    emit BotDeregistered(msg.sender);
}

function getAllActiveBots() external view returns (address[] memory, Bot[] memory) {
    // Array now only contains active bots (deregister removes from array)
    uint256 len = _botAddresses.length;
    address[] memory addrs = new address[](len);
    Bot[] memory bots = new Bot[](len);
    for (uint256 i = 0; i < len; i++) {
        addrs[i] = _botAddresses[i];
        bots[i] = _bots[_botAddresses[i]];
    }
    return (addrs, bots);
}

// ============ ISSUER OPERATIONS ============

function pause(uint256 batchId, bytes calldata blsSignature) external {
    bytes32 message = keccak256(abi.encode(
        block.chainid, address(this), "PAUSE", batchId
    ));
    _verifyBLS(message, blsSignature);

    _batches[batchId].paused = true;
    emit BatchPaused(batchId);
}

function unpause(uint256 batchId, bytes calldata blsSignature) external {
    bytes32 message = keccak256(abi.encode(
        block.chainid, address(this), "UNPAUSE", batchId
    ));
    _verifyBLS(message, blsSignature);

    _batches[batchId].paused = false;
    emit BatchUnpaused(batchId);
}

function forceWithdraw(
    uint256 batchId,
    address player,
    uint256 finalBalance,
    bytes calldata blsSignature
) external {
    bytes32 message = keccak256(abi.encode(
        block.chainid, address(this), "FORCE_WITHDRAW", batchId, player, finalBalance
    ));
    _verifyBLS(message, blsSignature);

    PlayerPosition storage pos = _positions[batchId][player];
    if (pos.joinTimestamp == 0) revert NotJoined();

    // Fee on lifetime profit — same model as withdraw()
    uint256 totalExtracted = finalBalance + pos.totalClaimed;
    uint256 fee = 0;
    if (totalExtracted > pos.totalDeposited) {
        uint256 profit = totalExtracted - pos.totalDeposited;
        fee = (profit * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
    }
    uint256 payout = finalBalance - fee;

    // Solvency check — must cover payout + existing fees + this new fee
    if (USDC.balanceOf(address(this)) < payout + accumulatedFees + fee) revert InsolventPayout();

    accumulatedFees += fee;

    delete _positions[batchId][player];

    USDC.safeTransfer(player, payout);
    emit ForceWithdrawn(batchId, player, payout);
}

function collectFees() external {
    if (msg.sender != feeCollector) revert Unauthorized();
    uint256 fees = accumulatedFees;
    accumulatedFees = 0;
    USDC.safeTransfer(feeCollector, fees);
}

// NOTE — SOLVENCY TRUST MODEL:
// The per-payout solvency checks (claimRewards, withdraw, forceWithdraw) ensure
// individual payouts don't exceed available USDC. However, there is no global invariant
// enforcing sum(all player balances) + accumulatedFees <= USDC.balanceOf(this).
// Player balances are BLS-attested by the issuer quorum — the contract trusts issuers
// to not inflate balances beyond what the pool can cover. This is by design: the issuer
// quorum is the trust anchor. A compromised quorum could attest inflated balances
// and drain the pool. Mitigation: threshold BLS (n-of-m) makes this require multiple
// compromised issuers. The per-payout solvency check is a last-resort defense that
// reverts individual drains even if attested balances are wrong.
```

**Step 3: Run tests**

Run: `cd contracts && forge test --match-contract VisionTest -v`
Expected: All tests PASS

**Step 4: Commit**

```bash
git add contracts/src/vision/Vision.sol contracts/test/Vision.t.sol
git commit -m "feat(contracts): implement bot registry and issuer ops in Vision.sol"
```

---

## Phase 2: Data Node — New Collectors + P2Pool Endpoints

### Task 2.1: Add Polymarket collector

**Files:**
- Create: `data-node/src/market_data/sources/polymarket/mod.rs`
- Create: `data-node/src/market_data/sources/polymarket/client.rs`
- Modify: `data-node/src/market_data/sources/mod.rs`
- Modify: `data-node/src/main.rs`

**Step 1: Implement the Polymarket client**

Create `data-node/src/market_data/sources/polymarket/mod.rs`:
```rust
pub mod client;
pub use client::PolymarketSource;
```

Create `data-node/src/market_data/sources/polymarket/client.rs`:
```rust
use crate::market_data::traits::{AssetUpdate, MarketDataSource, PriceUpdate, RateLimitConfig};
use async_trait::async_trait;
use chrono::Utc;
use reqwest::Client;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::time::Duration;

const POLYMARKET_API: &str = "https://clob.polymarket.com";
const GAMMA_API: &str = "https://gamma-api.polymarket.com";

#[derive(Debug, Clone, Deserialize)]
struct GammaMarket {
    condition_id: String,
    question: String,
    slug: String,
    active: bool,
    closed: bool,
    outcomes: Vec<String>,
    outcome_prices: Option<Vec<String>>,
    volume: Option<String>,
    liquidity: Option<String>,
}

pub struct PolymarketSource {
    client: Client,
    sync_interval_secs: u64,
    /// Cache last fetched markets to avoid double-fetching the same endpoint
    /// in fetch_assets() and fetch_prices() (30 req/min rate limit).
    cached_markets: tokio::sync::RwLock<Option<(std::time::Instant, Vec<GammaMarket>)>>,
}

impl PolymarketSource {
    pub fn new(sync_interval_secs: u64) -> Self {
        Self {
            client: Client::builder()
                .timeout(Duration::from_secs(30))
                .build()
                .expect("Failed to create HTTP client"),
            sync_interval_secs,
            cached_markets: tokio::sync::RwLock::new(None),
        }
    }

    pub fn from_env() -> anyhow::Result<Self> {
        let interval: u64 = std::env::var("POLYMARKET_SYNC_INTERVAL_SECS")
            .unwrap_or_else(|_| "120".into())
            .parse()?;
        Ok(Self::new(interval))
    }

    /// Fetch markets from Gamma API, using cache if < 60s old.
    async fn get_markets(&self) -> anyhow::Result<Vec<GammaMarket>> {
        // Check cache
        {
            let cache = self.cached_markets.read().await;
            if let Some((ts, markets)) = cache.as_ref() {
                if ts.elapsed() < Duration::from_secs(60) {
                    return Ok(markets.clone());
                }
            }
        }

        // Fetch fresh
        let url = format!("{}/markets?closed=false&limit=500", GAMMA_API);
        let markets: Vec<GammaMarket> = self.client.get(&url).send().await?.json().await?;

        // Update cache
        {
            let mut cache = self.cached_markets.write().await;
            *cache = Some((std::time::Instant::now(), markets.clone()));
        }

        Ok(markets)
    }
}

#[async_trait]
impl MarketDataSource for PolymarketSource {
    fn source_id(&self) -> &'static str { "polymarket" }
    fn display_name(&self) -> &'static str { "Polymarket" }
    fn default_resolution(&self) -> &'static str { "polymarket_odds" }
    fn sync_interval(&self) -> Duration { Duration::from_secs(self.sync_interval_secs) }
    fn rate_limit_config(&self) -> RateLimitConfig {
        RateLimitConfig { requests_per_minute: 30, burst_size: 5 }
    }

    async fn fetch_assets(&self) -> anyhow::Result<Vec<AssetUpdate>> {
        let markets = self.get_markets().await?;

        Ok(markets
            .into_iter()
            .filter(|m| m.active && !m.closed)
            .map(|m| AssetUpdate {
                asset_id: format!("poly_{}", m.slug),
                symbol: m.slug.clone(),
                name: m.question,
                category: Some("prediction".into()),
                metadata: serde_json::json!({
                    "condition_id": m.condition_id,
                    "outcomes": m.outcomes,
                }),
            })
            .collect())
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> anyhow::Result<Vec<PriceUpdate>> {
        let markets = self.get_markets().await?;

        let now = Utc::now();
        let mut updates = Vec::new();

        for market in markets {
            let id = format!("poly_{}", market.slug);
            if !asset_ids.contains(&id) { continue; }

            if let Some(prices) = &market.outcome_prices {
                if let Some(price_str) = prices.first() {
                    if let Ok(price) = price_str.parse::<Decimal>() {
                        updates.push(PriceUpdate {
                            asset_id: id,
                            symbol: market.slug,
                            value: price,
                            prev_close: None,
                            change_pct: None,
                            volume_24h: market.volume.and_then(|v| v.parse().ok()),
                            market_cap: market.liquidity.and_then(|l| l.parse().ok()),
                            fetched_at: now,
                        });
                    }
                }
            }
        }

        Ok(updates)
    }
}
```

**Step 2: Register in sources/mod.rs**

Add `pub mod polymarket;` to `data-node/src/market_data/sources/mod.rs`.

**Step 3: Spawn in main.rs**

Add to `data-node/src/main.rs` in the collector spawn section:

```rust
// Polymarket
{
    let pool_c = pool.clone();
    tokio::spawn(async move {
        match market_data::sources::polymarket::PolymarketSource::from_env() {
            Ok(source) => {
                let engine = market_data::SyncEngine::new(pool_c, Box::new(source));
                engine.run().await;
            }
            Err(e) => tracing::error!("Polymarket init failed: {e}"),
        }
    });
    info!("Polymarket provider started");
}
```

**Step 4: Build and verify**

Run: `cd data-node && cargo build`
Expected: Compiles successfully

**Step 5: Commit**

```bash
git add data-node/src/market_data/sources/polymarket/ data-node/src/market_data/sources/mod.rs data-node/src/main.rs
git commit -m "feat(data-node): add Polymarket collector"
```

---

### Task 2.2: Add Twitch collector

**Files:**
- Create: `data-node/src/market_data/sources/twitch/mod.rs`
- Create: `data-node/src/market_data/sources/twitch/client.rs`
- Modify: `data-node/src/market_data/sources/mod.rs`
- Modify: `data-node/src/main.rs`
- Modify: `data-node/src/config.rs`

**Key differences from Polymarket pattern:**

1. **OAuth token refresh** — Twitch Helix requires a Client Credentials token (`POST https://id.twitch.tv/oauth2/token`). The token expires (typically ~60 days). The client must:
   - Store the token + expiry in-memory
   - Check expiry before each API call
   - Auto-refresh when expired or on 401 response
   ```rust
   struct TwitchAuth {
       token: RwLock<Option<(String, Instant)>>,
       client_id: String,
       client_secret: String,
   }
   impl TwitchAuth {
       async fn get_token(&self, client: &Client) -> anyhow::Result<String> {
           let guard = self.token.read().await;
           if let Some((token, expiry)) = guard.as_ref() {
               if Instant::now() < *expiry { return Ok(token.clone()); }
           }
           drop(guard);
           // Refresh
           let resp = client.post("https://id.twitch.tv/oauth2/token")
               .form(&[("client_id", &self.client_id), ("client_secret", &self.client_secret),
                        ("grant_type", &"client_credentials".to_string())])
               .send().await?.json::<TokenResponse>().await?;
           let mut guard = self.token.write().await;
           let expiry = Instant::now() + Duration::from_secs(resp.expires_in - 300); // 5min buffer
           *guard = Some((resp.access_token.clone(), expiry));
           Ok(resp.access_token)
       }
   }
   ```

2. **API specifics:**
   - Endpoint: `GET https://api.twitch.tv/helix/streams?first=100` (max 100 per page, paginate with `after` cursor)
   - Headers: `Authorization: Bearer {token}`, `Client-Id: {client_id}`
   - Asset ID format: `twitch_{user_login}` (lowercase channel name)
   - Value = `viewer_count` (integer)
   - Rate limit: 800 req/min (generous), but respect `Ratelimit-Remaining` header
   - Poll interval: 60s default (streams change frequently)

3. **Config:** Add `--twitch-client-id` and `--twitch-client-secret` to ServeArgs in config.rs. Skip spawning if not provided.

**Commit message:** `feat(data-node): add Twitch collector`

---

### Task 2.3: Add HackerNews collector

**Files:**
- Create: `data-node/src/market_data/sources/hackernews/mod.rs`
- Create: `data-node/src/market_data/sources/hackernews/client.rs`
- Modify: `data-node/src/market_data/sources/mod.rs`
- Modify: `data-node/src/main.rs`

**Key differences from Polymarket pattern:**

1. **No bulk endpoint** — HN has no single endpoint returning all stories with scores. The flow is:
   - `GET /v0/topstories.json` → returns array of up to 500 story IDs
   - Take first 50 IDs
   - For each: `GET /v0/item/{id}.json` → returns `{ id, score, title, url, ... }`
   - That's 51 HTTP requests per sync cycle (1 + 50 individual stories)

2. **Implementation approach:**
   ```rust
   async fn fetch_prices(&self, asset_ids: &[String]) -> anyhow::Result<Vec<PriceUpdate>> {
       let top_ids: Vec<u64> = self.client.get(format!("{}/v0/topstories.json", HN_API))
           .send().await?.json().await?;

       // Fetch stories concurrently (bounded to avoid overwhelming HN)
       let mut handles = Vec::new();
       for id in top_ids.iter().take(50) {
           let client = self.client.clone();
           let id = *id;
           handles.push(tokio::spawn(async move {
               let url = format!("{}/v0/item/{}.json", HN_API, id);
               client.get(&url).send().await?.json::<HNStory>().await
           }));
       }
       // Join all, filter errors, map to PriceUpdate
   }
   ```

3. **Specifics:**
   - No auth required
   - No rate limit (but be respectful — 50 concurrent is fine)
   - Asset ID format: `hn_{story_id}` (numeric)
   - Value = story score (integer, can decrease)
   - Stories rotate out of top 50 — mark old ones inactive
   - Poll interval: 120s default

**Commit message:** `feat(data-node): add HackerNews collector`

---

### Task 2.3b: Add Weather collector

**Files:**
- Modify: `data-node/src/market_data/sources/openmeteo/` (extend existing module)
- OR Create: `data-node/src/market_data/sources/weather/mod.rs` + `client.rs` if openmeteo module doesn't fit
- Modify: `data-node/src/market_data/sources/mod.rs`
- Modify: `data-node/src/main.rs`

**Key differences from other collectors:**

1. **Multi-metric per station** — One weather station produces N separate markets:
   ```
   weather_nyc_temp       → 72.5 (°F)
   weather_nyc_humidity   → 65.0 (%)
   weather_nyc_wind       → 12.3 (mph)
   weather_nyc_precip     → 0.0 (mm)
   ```
   Each is a separate asset with its own price history. In `fetch_assets()`, generate one `AssetUpdate` per (station, metric) pair.

2. **Open-Meteo API specifics:**
   - Endpoint: `GET https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation`
   - Returns current values for all requested metrics in one call per station
   - Can batch multiple stations by comma-separating coords: `latitude=40.71,-33.87&longitude=-74.01,151.21`
   - Max ~10 stations per request recommended

3. **Station config** — Hardcode initial list (can be made configurable later):
   ```rust
   const STATIONS: &[(&str, f64, f64)] = &[
       ("nyc", 40.7128, -74.0060),
       ("london", 51.5074, -0.1278),
       ("tokyo", 35.6762, 139.6503),
       ("sydney", -33.8688, 151.2093),
       ("dubai", 25.2048, 55.2708),
   ];
   const METRICS: &[&str] = &["temp", "humidity", "wind", "precip"];
   ```

4. **Existing openmeteo module** — Check `data-node/src/market_data/sources/openmeteo/` first. If it already implements `MarketDataSource` trait, extend it to produce P2Pool-compatible asset IDs. If it's structured differently, create a new `weather/` module that wraps or reuses the HTTP client.

5. **Specifics:**
   - No auth required (Open-Meteo is free, 10k req/day)
   - Asset ID format: `weather_{station}_{metric}`
   - Value = metric reading (float)
   - Poll interval: 300s default (weather is slow-moving)
   - Resolution: uses the same `% change = (end - start) / start × 100` formula
   - **Division-by-zero protection for near-zero values:**
     - Temperature: MUST store and resolve in Kelvin (K = °C + 273.15). Kelvin is always positive (min ~200K for earthly weather), so division is safe. Display in °F/°C in the UI but compute % change in Kelvin.
     - Precipitation: when `start = 0mm`, treat as `Cancelled` outcome (can't compute meaningful % change from zero rainfall). The resolver already handles this: `start_f == 0.0 → cancel sub-market`.
     - Humidity: ranges 0-100%, unlikely to be exactly 0 but same cancellation rule applies.
     - Wind speed: same — 0 m/s start → cancel.
   - The collector stores raw Kelvin values for temperature. The `/snapshot` endpoint can include a `display_value` field for UI rendering in user-preferred units.

**Commit message:** `feat(data-node): add weather collector for P2Pool`

---

### Task 2.3c: Create P2Pool database migrations

**Files:**
- Create: `data-node/migrations/YYYYMMDD_create_p2pool_tables.sql`

The P2Pool API endpoints (Task 2.4) query several tables that don't exist yet. Create them before implementing the endpoints.

**Step 1: Write the migration**

```sql
-- P2Pool batch state (indexed from Vision.sol events)
CREATE TABLE IF NOT EXISTS p2pool_batches (
    batch_id BIGINT PRIMARY KEY,
    creator TEXT NOT NULL,
    market_ids TEXT[] NOT NULL,
    resolution_types SMALLINT[] NOT NULL,
    tick_duration BIGINT NOT NULL,
    custom_thresholds TEXT[] NOT NULL DEFAULT '{}',
    current_tick BIGINT NOT NULL DEFAULT 0,
    paused BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Player positions (indexed from Vision.sol events)
CREATE TABLE IF NOT EXISTS p2pool_positions (
    batch_id BIGINT NOT NULL REFERENCES p2pool_batches(batch_id),
    player TEXT NOT NULL,
    bitmap_hash TEXT NOT NULL,
    stake_per_tick NUMERIC NOT NULL,
    start_tick BIGINT NOT NULL,
    balance NUMERIC NOT NULL,
    last_claimed_tick BIGINT NOT NULL DEFAULT 0,
    join_timestamp BIGINT NOT NULL,
    total_deposited NUMERIC NOT NULL DEFAULT 0,
    total_claimed NUMERIC NOT NULL DEFAULT 0,
    PRIMARY KEY (batch_id, player)
);

CREATE INDEX idx_p2pool_positions_balance ON p2pool_positions(batch_id) WHERE balance > 0;

-- Key-value store for indexer state (e.g. last indexed block)
CREATE TABLE IF NOT EXISTS kv_store (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Tick resolution results (written by chain indexer after issuer BLS consensus)
CREATE TABLE IF NOT EXISTS p2pool_tick_results (
    batch_id BIGINT NOT NULL REFERENCES p2pool_batches(batch_id),
    tick_id BIGINT NOT NULL,
    resolved_at BIGINT NOT NULL,
    market_outcomes JSONB NOT NULL,
    total_pool TEXT NOT NULL,
    winner_count BIGINT NOT NULL DEFAULT 0,
    loser_count BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (batch_id, tick_id)
);
```

**Step 2: Run the migration**

Run: `cd data-node && sqlx migrate run` (or apply manually via `psql`)
Expected: Tables created

**Step 3: Commit**

```bash
git add data-node/migrations/
git commit -m "feat(data-node): add P2Pool database migration tables"
```

---

### Task 2.4: Add P2Pool API endpoints

**Files:**
- Modify: `data-node/src/api.rs`
- Create: `data-node/src/p2pool_api.rs`

**Step 1: Create P2Pool API module**

Create `data-node/src/p2pool_api.rs`:

```rust
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use crate::api::AppState;

#[derive(Deserialize)]
pub struct SnapshotParams {
    pub source: Option<String>,
    pub category: Option<String>,
    pub limit: Option<i64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MarketSnapshot {
    pub id: String,
    pub source: String,
    pub symbol: String,
    pub name: String,
    pub value: String,
    pub change_pct: Option<String>,
    pub volume_24h: Option<String>,
    pub market_cap: Option<String>,
    pub category: Option<String>,
}

pub async fn snapshot(
    State(state): State<Arc<AppState>>,
    Query(params): Query<SnapshotParams>,
) -> Result<Json<Vec<MarketSnapshot>>, StatusCode> {
    let limit = params.limit.unwrap_or(10000);

    let rows = sqlx::query_as!(
        MarketSnapshot,
        r#"
        SELECT DISTINCT ON (ma.source, ma.asset_id)
            ma.asset_id as "id!",
            ma.source as "source!",
            ma.symbol as "symbol!",
            ma.name as "name!",
            mp.value::text as "value!",
            mp.change_pct::text as "change_pct",
            mp.volume_24h::text as "volume_24h",
            mp.market_cap::text as "market_cap",
            ma.category as "category"
        FROM market_assets ma
        JOIN market_prices mp ON ma.source = mp.source AND ma.asset_id = mp.asset_id
        WHERE ma.is_active = true
            AND ($1::text IS NULL OR ma.source = $1)
            AND ($2::text IS NULL OR ma.category = $2)
        ORDER BY ma.source, ma.asset_id, mp.fetched_at DESC
        LIMIT $3
        "#,
        params.source,
        params.category,
        limit
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(rows))
}

#[derive(Deserialize)]
pub struct ActiveMarketsParams {
    // Future: filter by issuer whitelist version
}

pub async fn active_markets(
    State(state): State<Arc<AppState>>,
    Query(_params): Query<ActiveMarketsParams>,
) -> Result<Json<Vec<MarketSnapshot>>, StatusCode> {
    // For now, return all active markets. When issuer whitelist is implemented,
    // filter by the signed whitelist.
    snapshot(State(state), Query(SnapshotParams {
        source: None,
        category: None,
        limit: Some(50000),
    })).await
}

/// Batch listing — reads Vision.sol events via cached chain state.
/// The data-node indexes BatchCreated/PlayerJoined events from the chain
/// and serves them here so the frontend doesn't need direct RPC access.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchListEntry {
    pub id: u64,
    pub creator: String,
    pub market_ids: Vec<String>,
    pub resolution_types: Vec<u8>,
    pub tick_duration: u64,
    pub player_count: u64,
    pub tvl: String,
    pub current_tick: u64,
    pub paused: bool,
}

pub async fn list_batches(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<BatchListEntry>>, StatusCode> {
    let rows = sqlx::query_as!(
        BatchListEntry,
        r#"
        SELECT
            b.batch_id as "id!",
            b.creator as "creator!",
            b.market_ids as "market_ids!: Vec<String>",
            b.resolution_types as "resolution_types!: Vec<u8>",
            b.tick_duration as "tick_duration!",
            COALESCE(p.player_count, 0) as "player_count!",
            COALESCE(p.tvl, '0') as "tvl!",
            b.current_tick as "current_tick!",
            b.paused as "paused!"
        FROM p2pool_batches b
        LEFT JOIN (
            SELECT batch_id, COUNT(*) as player_count, SUM(balance)::text as tvl
            FROM p2pool_positions WHERE balance > 0
            GROUP BY batch_id
        ) p ON b.batch_id = p.batch_id
        ORDER BY b.batch_id DESC
        "#
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(rows))
}

/// Batch state — config, current tick, player count, TVL for a single batch.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchState {
    pub id: u64,
    pub creator: String,
    pub market_ids: Vec<String>,
    pub resolution_types: Vec<u8>,
    pub tick_duration: u64,
    pub custom_thresholds: Vec<String>,
    pub player_count: u64,
    pub tvl: String,
    pub current_tick: u64,
    pub paused: bool,
}

pub async fn batch_state(
    State(state): State<Arc<AppState>>,
    Path(batch_id): Path<u64>,
) -> Result<Json<BatchState>, StatusCode> {
    let batch = sqlx::query_as!(
        BatchState,
        r#"
        SELECT
            b.batch_id as "id!",
            b.creator as "creator!",
            b.market_ids as "market_ids!: Vec<String>",
            b.resolution_types as "resolution_types!: Vec<u8>",
            b.tick_duration as "tick_duration!",
            b.custom_thresholds as "custom_thresholds!: Vec<String>",
            COALESCE(p.player_count, 0) as "player_count!",
            COALESCE(p.tvl, '0') as "tvl!",
            b.current_tick as "current_tick!",
            b.paused as "paused!"
        FROM p2pool_batches b
        LEFT JOIN (
            SELECT batch_id, COUNT(*) as player_count, SUM(balance)::text as tvl
            FROM p2pool_positions WHERE balance > 0
            GROUP BY batch_id
        ) p ON b.batch_id = p.batch_id
        WHERE b.batch_id = $1
        "#,
        batch_id as i64
    )
    .fetch_optional(&state.pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(batch))
}

/// Batch history — tick results and player performance over time.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchHistoryEntry {
    pub tick_id: u64,
    pub resolved_at: i64,
    pub market_outcomes: serde_json::Value, // JSON array of per-market outcomes
    pub total_pool: String,
    pub winner_count: u64,
    pub loser_count: u64,
}

pub async fn batch_history(
    State(state): State<Arc<AppState>>,
    Path(batch_id): Path<u64>,
) -> Result<Json<Vec<BatchHistoryEntry>>, StatusCode> {
    let rows = sqlx::query_as!(
        BatchHistoryEntry,
        r#"
        SELECT
            tick_id as "tick_id!",
            resolved_at as "resolved_at!",
            market_outcomes as "market_outcomes!",
            total_pool as "total_pool!",
            winner_count as "winner_count!",
            loser_count as "loser_count!"
        FROM p2pool_tick_results
        WHERE batch_id = $1
        ORDER BY tick_id DESC
        LIMIT 100
        "#,
        batch_id as i64
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(rows))
}

#[derive(Deserialize)]
pub struct BacktestParams {
    pub market_ids: String,   // comma-separated
    pub ticks: i64,           // number of historical ticks to simulate
    pub tick_duration: i64,   // seconds per tick
    pub strategy: String,     // "momentum", "bear", "random", or custom bitmap
}

#[derive(Serialize)]
pub struct BacktestResult {
    pub win_rate: f64,
    pub total_pnl: f64,
    pub ticks_simulated: i64,
    pub per_tick_results: Vec<TickResult>,
    #[serde(default)]
    pub mock: bool, // true when returning placeholder data (Task 2.4), false in real impl (Task 5.3)
}

#[derive(Serialize)]
pub struct TickResult {
    pub tick: i64,
    pub wins: i32,
    pub losses: i32,
    pub pnl: f64,
}

pub async fn backtest(
    State(state): State<Arc<AppState>>,
    Query(params): Query<BacktestParams>,
) -> Result<Json<BacktestResult>, StatusCode> {
    // Placeholder — full implementation in Task 5.3.
    // Returns mock=true flag so frontend can show "mock data" indicator.
    Ok(Json(BacktestResult {
        win_rate: 0.5,
        total_pnl: 0.0,
        ticks_simulated: params.ticks,
        per_tick_results: vec![],
        mock: true, // Frontend checks this to show "mock data" warning
    }))
}
```

**Step 2: Register routes in api.rs**

Add to the router in `data-node/src/api.rs`:

```rust
.route("/p2pool/snapshot", get(crate::p2pool_api::snapshot))
.route("/p2pool/markets/active", get(crate::p2pool_api::active_markets))
.route("/p2pool/batches", get(crate::p2pool_api::list_batches))
.route("/p2pool/batch/:id/state", get(crate::p2pool_api::batch_state))
.route("/p2pool/batch/:id/history", get(crate::p2pool_api::batch_history))
.route("/p2pool/backtest", get(crate::p2pool_api::backtest))
```

And add `mod p2pool_api;` in `main.rs`.

**Step 3: Build and test**

Run: `cd data-node && cargo build`
Expected: Compiles

**Step 4: Commit**

```bash
git add data-node/src/p2pool_api.rs data-node/src/api.rs data-node/src/main.rs
git commit -m "feat(data-node): add P2Pool snapshot, markets, and backtest endpoints"
```

---

### Task 2.5: Add chain indexer for data-node (Vision.sol events → Postgres)

**Files:**
- Create: `data-node/src/p2pool_indexer.rs`
- Modify: `data-node/src/main.rs`
- Modify: `data-node/src/config.rs`

The P2Pool API endpoints (Task 2.4) serve batch/position data from Postgres, but nothing populates those tables. This task adds a chain event indexer that watches Vision.sol events and writes to the `p2pool_batches`, `p2pool_positions`, and `p2pool_tick_results` tables created in Task 2.3c.

**Note:** This is separate from the issuer's chain listener (Task 3.9), which feeds the tick scheduler. The data-node indexer populates Postgres for the REST API.

**Consistency with Task 3.9 indexer:** Both indexers watch the same Vision.sol events but serve different purposes (data-node → Postgres for REST API, issuer → tick scheduler state). To prevent divergence:
- Both MUST use the same `vision_address` and start from the same `start_block` (the Vision.sol deployment block)
- Both MUST handle chain reorgs: on reorg, delete data from the reorged block onward and re-index
- The data-node indexer is the source of truth for historical data (Postgres). The issuer indexer is ephemeral (in-memory state for tick scheduling). On issuer restart, it rebuilds from `start_block`.
- If the data-node indexer falls behind, REST API serves stale data but the system is still safe (issuers still resolve ticks correctly). If the issuer indexer falls behind, ticks are delayed until it catches up.

**Step 1: Add config**

Add to `data-node/src/config.rs`:
```rust
/// P2Pool indexer config
#[derive(Debug, Clone)]
pub struct P2PoolIndexerConfig {
    pub enabled: bool,
    pub rpc_ws_url: String,
    pub vision_address: String,
    pub start_block: u64,
    pub poll_interval_secs: u64,
}
```

Add CLI args: `--p2pool-enabled`, `--p2pool-vision-address`, `--p2pool-rpc-ws`, `--p2pool-start-block`.

**Step 2: Implement the indexer**

Create `data-node/src/p2pool_indexer.rs`:

```rust
use ethers::prelude::*;
use ethers::types::{Address, Filter, Log, H256, U256};
use sqlx::PgPool;
use std::sync::Arc;

// Generate contract bindings: abigen!(VisionContract, "contracts/out/Vision.sol/Vision.json");
pub struct P2PoolIndexer {
    provider: Arc<Provider<Ws>>,
    vision_contract: VisionContract<Provider<Ws>>, // ethers abigen binding for eth_call
    pool: PgPool,
    start_block: u64,
}

impl P2PoolIndexer {
    pub fn new(
        provider: Arc<Provider<Ws>>,
        vision_address: Address,
        pool: PgPool,
        start_block: u64,
    ) -> Self {
        Self { provider, vision_address, pool, start_block }
    }

    pub async fn run(&self) -> eyre::Result<()> {
        // 1. Get last indexed block from DB (or use start_block)
        let last_block = self.get_last_indexed_block().await?.unwrap_or(self.start_block);

        // 2. Replay missed events
        let filter = Filter::new()
            .address(self.vision_address)
            .from_block(last_block);
        let logs = self.provider.get_logs(&filter).await?;
        for log in logs {
            self.process_log(&log).await?;
        }

        // 3. Subscribe to new events
        let sub = self.provider.subscribe_logs(
            &Filter::new().address(self.vision_address)
        ).await?;
        let mut stream = sub.into_stream();

        while let Some(log) = stream.next().await {
            if let Err(e) = self.process_log(&log).await {
                tracing::error!("Failed to index P2Pool event: {e}");
            }
        }
        Ok(())
    }

    async fn process_log(&self, log: &Log) -> eyre::Result<()> {
        let topic0 = log.topics.first().ok_or_else(|| eyre::eyre!("No topic0"))?;

        // BatchCreated(uint256 indexed batchId, address indexed creator, uint256 tickDuration)
        if *topic0 == H256::from(ethers::utils::keccak256("BatchCreated(uint256,address,uint256)")) {
            let batch_id = U256::from_big_endian(log.topics[1].as_bytes()).as_i64();
            let creator = format!("{:?}", Address::from(log.topics[2]));

            // Fetch full batch config from chain via getBatch(batchId)
            let batch = self.vision_contract.get_batch(U256::from(batch_id)).call().await?;
            let market_ids: Vec<String> = batch.market_ids.iter().map(|h| format!("{:?}", h)).collect();
            let res_types: Vec<i16> = batch.resolution_types.iter().map(|r| *r as i16).collect();

            sqlx::query!(
                "INSERT INTO p2pool_batches (batch_id, creator, market_ids, resolution_types, tick_duration)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (batch_id) DO UPDATE SET
                    market_ids = EXCLUDED.market_ids,
                    resolution_types = EXCLUDED.resolution_types",
                batch_id, creator,
                &market_ids,
                &res_types,
                batch.tick_duration.as_u64() as i64
            )
            .execute(&self.pool)
            .await?;
        }

        // PlayerJoined(uint256 indexed batchId, address indexed player, uint256 stakePerTick, bytes32 bitmapHash)
        if *topic0 == H256::from(ethers::utils::keccak256("PlayerJoined(uint256,address,uint256,bytes32)")) {
            let batch_id = U256::from_big_endian(log.topics[1].as_bytes()).as_i64();
            let player_addr = Address::from(log.topics[2]);
            let player = format!("{:?}", player_addr);

            // Decode event data: stakePerTick (bytes 0-31), bitmapHash (bytes 32-63)
            let stake_per_tick = U256::from_big_endian(&log.data[..32]);
            let bitmap_hash = H256::from_slice(&log.data[32..64]);

            // Fetch full position from chain for balance/timestamp
            let pos = self.vision_contract.get_position(
                U256::from(batch_id), player_addr
            ).call().await?;

            sqlx::query!(
                "INSERT INTO p2pool_positions (batch_id, player, bitmap_hash, stake_per_tick, start_tick, balance, join_timestamp, total_deposited)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 ON CONFLICT (batch_id, player) DO UPDATE SET
                    bitmap_hash = EXCLUDED.bitmap_hash,
                    balance = EXCLUDED.balance",
                batch_id, player,
                format!("{:?}", bitmap_hash),
                stake_per_tick.as_u128() as f64 / 1e6, // USDC 6 decimals
                pos.start_tick.as_u64() as i64,
                pos.balance.as_u128() as f64 / 1e6,
                pos.join_timestamp.as_u64() as i64,
                pos.balance.as_u128() as f64 / 1e6 // initial deposit = balance at join
            )
            .execute(&self.pool)
            .await?;
        }

        // PlayerDeposited → update balance + total_deposited
        if *topic0 == H256::from(ethers::utils::keccak256("PlayerDeposited(uint256,address,uint256)")) {
            let batch_id = U256::from_big_endian(log.topics[1].as_bytes()).as_i64();
            let player = format!("{:?}", Address::from(log.topics[2]));
            let amount = U256::from_big_endian(&log.data[..32]).as_u128() as f64 / 1e6;
            sqlx::query!(
                "UPDATE p2pool_positions SET balance = balance + $3, total_deposited = total_deposited + $3 WHERE batch_id = $1 AND player = $2",
                batch_id, player, amount
            ).execute(&self.pool).await?;
        }

        // PlayerWithdrawn / ForceWithdrawn → delete position
        if *topic0 == H256::from(ethers::utils::keccak256("PlayerWithdrawn(uint256,address,uint256)"))
            || *topic0 == H256::from(ethers::utils::keccak256("ForceWithdrawn(uint256,address,uint256)"))
        {
            let batch_id = U256::from_big_endian(log.topics[1].as_bytes()).as_i64();
            let player = format!("{:?}", Address::from(log.topics[2]));
            sqlx::query!("DELETE FROM p2pool_positions WHERE batch_id = $1 AND player = $2", batch_id, player)
                .execute(&self.pool).await?;
        }

        // BatchPaused → update paused flag
        if *topic0 == H256::from(ethers::utils::keccak256("BatchPaused(uint256)")) {
            let batch_id = U256::from_big_endian(log.topics[1].as_bytes()).as_i64();
            sqlx::query!("UPDATE p2pool_batches SET paused = true WHERE batch_id = $1", batch_id)
                .execute(&self.pool).await?;
        }

        // RewardsClaimed → update balance and last_claimed_tick
        if *topic0 == H256::from(ethers::utils::keccak256("RewardsClaimed(uint256,address,uint256)")) {
            let batch_id = U256::from_big_endian(log.topics[1].as_bytes()).as_i64();
            let player = format!("{:?}", Address::from(log.topics[2]));
            // After a claim, re-read position from chain to get updated balance
            let pos = self.vision_contract.getPosition(batch_id as u64, Address::from(log.topics[2])).await?;
            let balance = pos.balance.to_string();
            let last_claimed = pos.lastClaimedTick.as_i64();
            sqlx::query!(
                "UPDATE p2pool_positions SET balance = $3, last_claimed_tick = $4 WHERE batch_id = $1 AND player = $2",
                batch_id, player, balance, last_claimed
            ).execute(&self.pool).await?;
        }

        // Save last indexed block
        if let Some(block_number) = log.block_number {
            self.save_last_indexed_block(block_number.as_u64()).await?;
        }

        Ok(())
    }

    async fn get_last_indexed_block(&self) -> eyre::Result<Option<u64>> {
        let row = sqlx::query_scalar!(
            "SELECT value::bigint FROM kv_store WHERE key = 'p2pool_last_indexed_block'"
        )
        .fetch_optional(&self.pool)
        .await?;
        Ok(row.flatten().map(|v| v as u64))
    }

    async fn save_last_indexed_block(&self, block: u64) -> eyre::Result<()> {
        sqlx::query!(
            "INSERT INTO kv_store (key, value) VALUES ('p2pool_last_indexed_block', $1::text)
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
            (block as i64).to_string()
        )
        .execute(&self.pool)
        .await?;
        Ok(())
    }
}
```

**Step 3: Spawn in main.rs**

```rust
// P2Pool chain indexer
if config.p2pool.enabled {
    let pool_c = pool.clone();
    let ws = Provider::<Ws>::connect(&config.p2pool.rpc_ws_url).await?;
    let vision_addr: Address = config.p2pool.vision_address.parse()?;
    let indexer = p2pool_indexer::P2PoolIndexer::new(
        Arc::new(ws), vision_addr, pool_c, config.p2pool.start_block
    );
    tokio::spawn(async move {
        if let Err(e) = indexer.run().await {
            tracing::error!("P2Pool indexer failed: {e}");
        }
    });
}
```

**Step 4: Build and test**

Run: `cd data-node && cargo build`
Expected: Compiles

**Step 5: Commit**

```bash
git add data-node/src/p2pool_indexer.rs data-node/src/main.rs data-node/src/config.rs
git commit -m "feat(data-node): add Vision.sol chain indexer for P2Pool tables"
```

---

## Phase 3: Issuer — P2Pool Tick Engine

### Task 3.1: Create p2pool module skeleton

**Files:**
- Create: `issuer/src/p2pool/mod.rs`
- Create: `issuer/src/p2pool/types.rs`
- Create: `issuer/src/p2pool/config.rs`
- Modify: `issuer/src/lib.rs`

**Step 1: Define P2Pool types**

Create `issuer/src/p2pool/types.rs`:

```rust
use ethers::types::{Address, H256, U256};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// On-chain batch configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Batch {
    pub id: u64,
    pub creator: Address,
    pub market_ids: Vec<H256>,
    pub resolution_types: Vec<u8>,
    pub tick_duration: u64,          // seconds
    pub custom_thresholds: Vec<U256>,
    pub created_at_tick: u64,        // block.timestamp / tickDuration at creation
    pub paused: bool,
}

/// Player position (from chain events)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerPosition {
    pub player: Address,
    pub bitmap_hash: H256,
    pub stake_per_tick: U256,
    pub start_tick: u64,
    pub balance: U256,
    pub join_timestamp: u64,
}

/// Stored bitmap (off-chain, received from player)
#[derive(Debug, Clone)]
pub struct StoredBitmap {
    pub player: Address,
    pub batch_id: u64,
    pub bitmap: Vec<u8>,
    pub hash: H256,
    pub received_at: u64,
}

/// Per-tick resolution result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TickResult {
    pub batch_id: u64,
    pub tick_id: u64,
    pub market_results: Vec<MarketResult>,
    pub player_balances: Vec<PlayerBalance>,
    pub voided_players: Vec<Address>,   // non-revealed → stake refunded
}

/// Player balance after tick resolution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerBalance {
    pub player: Address,
    pub old_balance: U256,
    pub new_balance: U256,
    pub delta: i128,
}

/// Resolution for a single market in a tick
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketResult {
    pub market_id: H256,
    pub outcome: MarketOutcome,
    pub pct_change: f64,                        // percentage (not basis points)
    pub player_results: Vec<PlayerMarketResult>, // per-player side matching results
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MarketOutcome {
    Up,
    Down,
    Flat,
    Cancelled,          // stale price
    AllSameSide,        // no opponents — refund
    AllLosers,          // threshold unmet — refund
}

/// Multiplier computation result
#[derive(Debug, Clone)]
pub struct PlayerMultiplier {
    pub player: Address,
    pub early_mult: f64,        // 1.0 - 2.0
    pub commitment_mult: f64,   // log10(ticks + offset)
    pub total_mult: f64,
    pub effective_stake: U256,
}

/// Side in a sub-market
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Side {
    Up,     // bit = 1
    Down,   // bit = 0
}
```

Create `issuer/src/p2pool/config.rs`:

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct P2PoolConfig {
    pub enabled: bool,
    pub vision_address: String,
    pub data_node_url: String,
    pub rpc_ws_url: String,
    pub start_block: u64,
    pub reveal_window_secs: u64,        // default 600 (10 min)
    pub commitment_offset: u64,          // default 9
    pub staleness_threshold_secs: u64,   // default 300
    pub tick_poll_interval_ms: u64,      // default 1000
}

impl Default for P2PoolConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            vision_address: String::new(),
            data_node_url: "http://localhost:8200".into(),
            rpc_ws_url: "ws://localhost:8546".into(),
            start_block: 0,
            reveal_window_secs: 600,
            commitment_offset: 9,
            staleness_threshold_secs: 300,
            tick_poll_interval_ms: 1000,
        }
    }
}
```

Create `issuer/src/p2pool/mod.rs`:

```rust
pub mod config;
pub mod types;

// Modules added in subsequent tasks:
// pub mod tick_scheduler;
// pub mod resolver;
// pub mod bitmap_store;
// pub mod multiplier;
// pub mod side_matching;
// pub mod api;
```

**Step 2: Register module**

Add `pub mod p2pool;` to `issuer/src/lib.rs`.

**Step 3: Build**

Run: `cd issuer && cargo build`
Expected: Compiles

**Step 4: Commit**

```bash
git add issuer/src/p2pool/ issuer/src/lib.rs
git commit -m "feat(issuer): add p2pool module skeleton with types and config"
```

---

### Task 3.2: Implement bitmap store

**Files:**
- Create: `issuer/src/p2pool/bitmap_store.rs`
- Modify: `issuer/src/p2pool/mod.rs`

**Step 1: Implement bitmap storage**

Create `issuer/src/p2pool/bitmap_store.rs`:

```rust
use ethers::types::{Address, H256};
use std::collections::HashMap;
use tokio::sync::RwLock;
use sha2::{Sha256, Digest};

use super::types::StoredBitmap;

/// In-memory store for player bitmaps. Each issuer holds all bitmaps.
pub struct BitmapStore {
    /// (batch_id, player) → StoredBitmap
    bitmaps: RwLock<HashMap<(u64, Address), StoredBitmap>>,
}

impl BitmapStore {
    pub fn new() -> Self {
        Self {
            bitmaps: RwLock::new(HashMap::new()),
        }
    }

    /// Store a bitmap received from a player. Verifies hash matches.
    pub async fn store(
        &self,
        player: Address,
        batch_id: u64,
        bitmap: Vec<u8>,
        expected_hash: H256,
    ) -> Result<(), BitmapStoreError> {
        // Verify hash
        let computed_hash = H256::from_slice(&ethers::utils::keccak256(&bitmap));
        if computed_hash != expected_hash {
            return Err(BitmapStoreError::HashMismatch {
                expected: expected_hash,
                computed: computed_hash,
            });
        }

        let stored = StoredBitmap {
            player,
            batch_id,
            bitmap,
            hash: expected_hash,
            received_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
        };

        let mut map = self.bitmaps.write().await;
        map.insert((batch_id, player), stored);
        Ok(())
    }

    /// Get a player's bitmap for a specific batch
    pub async fn get(&self, batch_id: u64, player: Address) -> Option<StoredBitmap> {
        let map = self.bitmaps.read().await;
        map.get(&(batch_id, player)).cloned()
    }

    /// Get all bitmaps for a batch (for tick resolution)
    pub async fn get_batch_bitmaps(&self, batch_id: u64) -> Vec<StoredBitmap> {
        let map = self.bitmaps.read().await;
        map.iter()
            .filter(|((bid, _), _)| *bid == batch_id)
            .map(|(_, v)| v.clone())
            .collect()
    }

    /// Extract a player's prediction for a specific tick and market
    /// Bitmap encoding: tick-major — all markets for tick 0, then tick 1, etc.
    /// Each bit = 1 prediction (1 = UP/outcome happens, 0 = DOWN/doesn't)
    pub fn read_prediction(
        bitmap: &[u8],
        tick_index: usize,
        market_index: usize,
        num_markets: usize,
    ) -> Option<bool> {
        let bit_index = tick_index * num_markets + market_index;
        let byte_index = bit_index / 8;
        let bit_offset = 7 - (bit_index % 8); // MSB first

        if byte_index >= bitmap.len() {
            return None;
        }

        Some((bitmap[byte_index] >> bit_offset) & 1 == 1)
    }

    /// Prune bitmaps older than given timestamp
    pub async fn prune_before(&self, cutoff_timestamp: u64) {
        let mut map = self.bitmaps.write().await;
        map.retain(|_, v| v.received_at >= cutoff_timestamp);
    }
}

#[derive(Debug, thiserror::Error)]
pub enum BitmapStoreError {
    #[error("Hash mismatch: expected {expected}, computed {computed}")]
    HashMismatch { expected: H256, computed: H256 },
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_read_prediction() {
        // 2 markets, 2 ticks
        // tick 0: market 0 = UP(1), market 1 = DOWN(0)
        // tick 1: market 0 = DOWN(0), market 1 = UP(1)
        // Binary: 10 01 = 0b10010000 = 0x90
        let bitmap = vec![0x90];

        assert_eq!(BitmapStore::read_prediction(&bitmap, 0, 0, 2), Some(true));  // tick 0, mkt 0 = UP
        assert_eq!(BitmapStore::read_prediction(&bitmap, 0, 1, 2), Some(false)); // tick 0, mkt 1 = DOWN
        assert_eq!(BitmapStore::read_prediction(&bitmap, 1, 0, 2), Some(false)); // tick 1, mkt 0 = DOWN
        assert_eq!(BitmapStore::read_prediction(&bitmap, 1, 1, 2), Some(true));  // tick 1, mkt 1 = UP
    }

    #[tokio::test]
    async fn test_store_and_retrieve() {
        let store = BitmapStore::new();
        let player = Address::random();
        let bitmap = vec![0xFF, 0x00];
        let hash = H256::from_slice(&ethers::utils::keccak256(&bitmap));

        store.store(player, 1, bitmap.clone(), hash).await.unwrap();

        let stored = store.get(1, player).await.unwrap();
        assert_eq!(stored.bitmap, bitmap);
        assert_eq!(stored.hash, hash);
    }

    #[tokio::test]
    async fn test_store_hash_mismatch() {
        let store = BitmapStore::new();
        let player = Address::random();
        let bitmap = vec![0xFF];
        let wrong_hash = H256::zero();

        let result = store.store(player, 1, bitmap, wrong_hash).await;
        assert!(result.is_err());
    }
}
```

**Step 2: Update mod.rs**

Add `pub mod bitmap_store;` to `issuer/src/p2pool/mod.rs`.

**Step 3: Build and test**

Run: `cd issuer && cargo test p2pool::bitmap_store`
Expected: All tests pass

**Step 4: Commit**

```bash
git add issuer/src/p2pool/bitmap_store.rs issuer/src/p2pool/mod.rs
git commit -m "feat(issuer): implement bitmap store with hash verification"
```

---

### Task 3.3: Implement multiplier computation

**Files:**
- Create: `issuer/src/p2pool/multiplier.rs`
- Modify: `issuer/src/p2pool/mod.rs`

**Step 1: Implement multiplier logic**

Create `issuer/src/p2pool/multiplier.rs`:

```rust
use ethers::types::{Address, U256};
use super::types::PlayerMultiplier;

/// Compute early multiplier.
/// early_mult = 1 + min(time_before_tick, tick_duration)² / tick_duration²
/// Capped at 2.0.
pub fn compute_early_mult(time_before_tick_secs: u64, tick_duration_secs: u64) -> f64 {
    if tick_duration_secs == 0 {
        return 1.0;
    }
    let t = time_before_tick_secs.min(tick_duration_secs) as f64;
    let d = tick_duration_secs as f64;
    let mult = 1.0 + (t * t) / (d * d);
    mult.min(2.0)
}

/// Compute commitment multiplier.
/// commitment_mult = log10(total_ticks_committed + offset)
pub fn compute_commitment_mult(total_ticks: u64, offset: u64) -> f64 {
    ((total_ticks + offset) as f64).log10()
}

/// Compute effective stake = base_stake * total_multiplier
/// Returns U256 in USDC decimals (6).
pub fn compute_effective_stake(base_stake: U256, total_mult: f64) -> U256 {
    // Convert to f64, multiply, convert back
    let stake_f64 = base_stake.as_u128() as f64;
    let effective = stake_f64 * total_mult;
    U256::from(effective as u128)
}

/// Compute all multipliers for a set of players in a tick.
pub fn compute_multipliers(
    players: &[(Address, U256, u64, u64)], // (addr, stake, time_before_tick, total_ticks)
    tick_duration: u64,
    offset: u64,
) -> Vec<PlayerMultiplier> {
    players
        .iter()
        .map(|(addr, stake, time_before, total_ticks)| {
            let early = compute_early_mult(*time_before, tick_duration);
            let commit = compute_commitment_mult(*total_ticks, offset);
            let total = early * commit;
            let effective = compute_effective_stake(*stake, total);
            PlayerMultiplier {
                player: *addr,
                early_mult: early,
                commitment_mult: commit,
                total_mult: total,
                effective_stake: effective,
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_early_mult_at_tick_duration() {
        // Submitted exactly 1 tick_duration ahead → max 2.0
        let mult = compute_early_mult(600, 600);
        assert!((mult - 2.0).abs() < 1e-10);
    }

    #[test]
    fn test_early_mult_capped() {
        // Submitted 10x tick_duration ahead → still 2.0
        let mult = compute_early_mult(6000, 600);
        assert!((mult - 2.0).abs() < 1e-10);
    }

    #[test]
    fn test_early_mult_half() {
        // 5 min before 10 min tick → 1 + (300/600)² = 1.25
        let mult = compute_early_mult(300, 600);
        assert!((mult - 1.25).abs() < 1e-10);
    }

    #[test]
    fn test_early_mult_1_min() {
        // 1 min before 10 min tick → 1 + (60/600)² = 1.01
        let mult = compute_early_mult(60, 600);
        assert!((mult - 1.01).abs() < 1e-10);
    }

    #[test]
    fn test_commitment_mult_default() {
        // 1 tick, offset 9 → log10(10) = 1.0
        let mult = compute_commitment_mult(1, 9);
        assert!((mult - 1.0).abs() < 1e-10);
    }

    #[test]
    fn test_commitment_mult_1000() {
        // 1000 ticks, offset 9 → log10(1009) ≈ 3.004
        let mult = compute_commitment_mult(1000, 9);
        assert!((mult - 3.0).abs() < 0.01);
    }

    #[test]
    fn test_example_from_brief() {
        // Alice: 5 USDC/tick, 1000 ticks committed, 2 days ago
        let early = compute_early_mult(172800, 600); // way more than tick → 2.0
        let commit = compute_commitment_mult(1000, 9); // log10(1009) ≈ 3.0
        let total = early * commit;
        assert!((total - 6.0).abs() < 0.02);

        let eff = compute_effective_stake(U256::from(5_000_000u64), total); // 5 USDC
        // 5 * 6.0 = 30 USDC = 30_000_000
        assert!((eff.as_u128() as f64 - 30_000_000.0).abs() < 100_000.0);
    }
}
```

**Step 2: Update mod.rs, build and test**

Run: `cd issuer && cargo test p2pool::multiplier`
Expected: All tests pass

**Step 3: Commit**

```bash
git add issuer/src/p2pool/multiplier.rs issuer/src/p2pool/mod.rs
git commit -m "feat(issuer): implement multiplier computation (early + commitment)"
```

---

### Task 3.4: Implement side matching (parimutuel resolution)

**Files:**
- Create: `issuer/src/p2pool/side_matching.rs`
- Modify: `issuer/src/p2pool/mod.rs`

**Step 1: Implement side matching**

Create `issuer/src/p2pool/side_matching.rs`:

```rust
use ethers::types::{Address, U256};
use super::types::{MarketOutcome, Side};

/// Per-player result for a single sub-market
#[derive(Debug, Clone)]
pub struct PlayerMarketResult {
    pub player: Address,
    pub side: Side,
    pub effective_stake: U256,
    pub matched_stake: U256,
    pub refund: U256,           // unmatched excess returned (larger side only)
    pub total_back: U256,       // total amount returned to player (winnings + refund, 0 if lost)
    pub net_pnl: i128,         // signed: total_back - effective_stake
}

/// Resolve a single sub-market for one tick using parimutuel side matching.
///
/// Returns per-player results for this market.
pub fn resolve_market(
    players: &[(Address, Side, U256)], // (addr, side, effective_stake_for_this_market)
    outcome: MarketOutcome,
) -> Vec<PlayerMarketResult> {
    match outcome {
        MarketOutcome::Cancelled | MarketOutcome::AllLosers | MarketOutcome::AllSameSide => {
            // Everyone refunded
            players
                .iter()
                .map(|(addr, side, stake)| PlayerMarketResult {
                    player: *addr,
                    side: *side,
                    effective_stake: *stake,
                    matched_stake: U256::zero(),
                    refund: *stake,
                    total_back: *stake,
                    net_pnl: 0,
                })
                .collect()
        }
        MarketOutcome::Flat => {
            // Flat = threshold not met in either direction → refund everyone
            players
                .iter()
                .map(|(addr, side, stake)| PlayerMarketResult {
                    player: *addr,
                    side: *side,
                    effective_stake: *stake,
                    matched_stake: U256::zero(),
                    refund: *stake,
                    total_back: *stake,
                    net_pnl: 0,
                })
                .collect()
        }
        MarketOutcome::Up | MarketOutcome::Down => {
            let winning_side = match outcome {
                MarketOutcome::Up => Side::Up,
                MarketOutcome::Down => Side::Down,
                _ => unreachable!(),
            };

            let up_total: U256 = players
                .iter()
                .filter(|(_, s, _)| *s == Side::Up)
                .map(|(_, _, stake)| *stake)
                .fold(U256::zero(), |a, b| a + b);

            let down_total: U256 = players
                .iter()
                .filter(|(_, s, _)| *s == Side::Down)
                .map(|(_, _, stake)| *stake)
                .fold(U256::zero(), |a, b| a + b);

            // Check special cases
            if up_total.is_zero() || down_total.is_zero() {
                // All same side — everyone refunded
                return players
                    .iter()
                    .map(|(addr, side, stake)| PlayerMarketResult {
                        player: *addr,
                        side: *side,
                        effective_stake: *stake,
                        matched_stake: U256::zero(),
                        refund: *stake,
                        total_back: *stake,
                        net_pnl: 0,
                    })
                    .collect();
            }

            let matched = up_total.min(down_total);
            let (larger_side, larger_total) = if up_total > down_total {
                (Side::Up, up_total)
            } else if down_total > up_total {
                (Side::Down, down_total)
            } else {
                (Side::Up, up_total) // equal — no excess
            };

            players
                .iter()
                .map(|(addr, side, stake)| {
                    let is_larger_side = *side == larger_side && larger_total > matched;

                    // Compute matched stake
                    let matched_stake = if is_larger_side {
                        // Scale down: matched_stake = stake × (matched / side_total)
                        (*stake * matched) / larger_total
                    } else {
                        *stake
                    };

                    let refund = *stake - matched_stake;
                    let is_winner = *side == winning_side;

                    let (winning_matched, losing_matched) = if winning_side == Side::Up {
                        (up_total.min(matched), down_total.min(matched))
                    } else {
                        (down_total.min(matched), up_total.min(matched))
                    };

                    let winnings = if is_winner && !winning_matched.is_zero() {
                        // winnings = matched_stake × (1 + opposing_matched / winning_matched)
                        // = matched_stake + matched_stake × opposing_matched / winning_matched
                        matched_stake + (matched_stake * losing_matched) / winning_matched
                    } else {
                        U256::zero() // loser
                    };

                    let total_back = winnings + refund;
                    let net_pnl = total_back.as_u128() as i128 - stake.as_u128() as i128;

                    PlayerMarketResult {
                        player: *addr,
                        side: *side,
                        effective_stake: *stake,
                        matched_stake,
                        refund,
                        total_back,
                        net_pnl,
                    }
                })
                .collect()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_example_from_brief() {
        // BTC Single: 4 players
        // Alice: $1000 UP, Bob: $500 DOWN, Carol: $200 UP, Dave: $100 DOWN
        let players = vec![
            (Address::random(), Side::Up, U256::from(1_000_000_000u64)),   // Alice $1000
            (Address::random(), Side::Down, U256::from(500_000_000u64)),   // Bob $500
            (Address::random(), Side::Up, U256::from(200_000_000u64)),     // Carol $200
            (Address::random(), Side::Down, U256::from(100_000_000u64)),   // Dave $100
        ];

        // BTC went UP
        let results = resolve_market(&players, MarketOutcome::Up);

        // UP_total = 1200, DOWN_total = 600, matched = 600
        // Alice matched = 1000 * 600/1200 = 500, refund = 500
        // Carol matched = 200 * 600/1200 = 100, refund = 100
        // Bob matched = 500, Dave matched = 100

        // Alice net = +500, Carol net = +100, Bob net = -500, Dave net = -100
        let alice = &results[0];
        let bob = &results[1];
        let carol = &results[2];
        let dave = &results[3];

        assert_eq!(alice.net_pnl, 500_000_000); // +$500
        assert_eq!(bob.net_pnl, -500_000_000);  // -$500
        assert_eq!(carol.net_pnl, 100_000_000);  // +$100
        assert_eq!(dave.net_pnl, -100_000_000);  // -$100

        // Zero-sum check
        let total: i128 = results.iter().map(|r| r.net_pnl).sum();
        assert_eq!(total, 0);
    }

    #[test]
    fn test_all_same_side() {
        let players = vec![
            (Address::random(), Side::Up, U256::from(1000u64)),
            (Address::random(), Side::Up, U256::from(500u64)),
        ];

        let results = resolve_market(&players, MarketOutcome::Up);

        // All same side → everyone refunded
        for r in &results {
            assert_eq!(r.net_pnl, 0);
            assert_eq!(r.refund, r.effective_stake);
        }
    }

    #[test]
    fn test_all_losers_refund() {
        let players = vec![
            (Address::random(), Side::Up, U256::from(1000u64)),
            (Address::random(), Side::Down, U256::from(500u64)),
        ];

        let results = resolve_market(&players, MarketOutcome::AllLosers);

        for r in &results {
            assert_eq!(r.net_pnl, 0);
        }
    }

    #[test]
    fn test_equal_sides_double_or_nothing() {
        let players = vec![
            (Address::random(), Side::Up, U256::from(100u64)),
            (Address::random(), Side::Down, U256::from(100u64)),
        ];

        let results = resolve_market(&players, MarketOutcome::Up);

        // Equal sides, UP wins → UP gets 200, DOWN gets 0
        assert_eq!(results[0].net_pnl, 100);   // winner doubles
        assert_eq!(results[1].net_pnl, -100);  // loser loses all
    }
}
```

**Step 2: Build and test**

Run: `cd issuer && cargo test p2pool::side_matching`
Expected: All tests pass

**Step 3: Commit**

```bash
git add issuer/src/p2pool/side_matching.rs issuer/src/p2pool/mod.rs
git commit -m "feat(issuer): implement parimutuel side matching"
```

---

### Task 3.5: Implement tick scheduler

**Files:**
- Create: `issuer/src/p2pool/tick_scheduler.rs`
- Modify: `issuer/src/p2pool/mod.rs`

This manages per-batch tick scheduling. Each batch has its own independent tick clock.

**Step 1: Implement scheduler**

```rust
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use ethers::types::{Address, H256, U256};
use crate::p2pool::types::{Batch, PlayerPosition};

pub struct TickScheduler {
    batches: RwLock<HashMap<u64, BatchTickState>>,
    /// Vision.sol contract binding for eth_call (getBatch, getPosition)
    vision_contract: Arc<VisionContract>,
}

pub struct BatchTickState {
    pub batch: Batch,
    pub current_tick: u64,
    pub next_tick_time: u64,        // unix timestamp when next tick is due
    pub last_resolved_tick: u64,
    pub players: HashMap<Address, PlayerPosition>, // active players in this batch
}

impl TickScheduler {
    pub fn new(vision_contract: Arc<VisionContract>) -> Self {
        Self {
            batches: RwLock::new(HashMap::new()),
            vision_contract,
        }
    }

    /// Register a batch for scheduling. Computes initial tick state.
    pub async fn register_batch(&self, batch: Batch) {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH).unwrap().as_secs();
        // Tick N = createdAtTick + N. Current tick = (now - created_at_timestamp) / tick_duration
        let ticks_elapsed = (now / batch.tick_duration) - batch.created_at_tick;
        let next_tick_time = (batch.created_at_tick + ticks_elapsed + 1) * batch.tick_duration;

        let mut batches = self.batches.write().await;
        batches.insert(batch.id, BatchTickState {
            current_tick: ticks_elapsed,
            next_tick_time,
            last_resolved_tick: ticks_elapsed.saturating_sub(1),
            players: HashMap::new(),
            batch,
        });
    }

    /// Returns batch IDs that are due for tick resolution right now.
    pub async fn get_due_batches(&self, now: u64) -> Vec<u64> {
        let batches = self.batches.read().await;
        batches.iter()
            .filter(|(_, state)| !state.batch.paused && now >= state.next_tick_time)
            .map(|(id, _)| *id)
            .collect()
    }

    /// Mark a batch's tick as resolved and advance to next tick.
    pub async fn mark_resolved(&self, batch_id: u64, tick: u64) {
        let mut batches = self.batches.write().await;
        if let Some(state) = batches.get_mut(&batch_id) {
            state.last_resolved_tick = tick;
            state.current_tick = tick + 1;
            state.next_tick_time = (state.batch.created_at_tick + tick + 1) * state.batch.tick_duration;
        }
    }

    /// Get batch state + players for resolution. Returns None if batch not found.
    pub async fn get_batch_state(&self, batch_id: u64) -> Option<(Batch, Vec<PlayerPosition>)> {
        let batches = self.batches.read().await;
        batches.get(&batch_id).map(|state| {
            (state.batch.clone(), state.players.values().cloned().collect())
        })
    }

    // === Chain event handlers (called by Task 3.9 chain listener) ===

    pub async fn on_batch_created(&self, batch_id: u64) -> eyre::Result<()> {
        // Fetch full batch config from chain
        let chain_batch = self.vision_contract.get_batch(U256::from(batch_id)).call().await?;
        let batch = Batch {
            id: batch_id,
            creator: chain_batch.creator,
            market_ids: chain_batch.market_ids,
            resolution_types: chain_batch.resolution_types,
            tick_duration: chain_batch.tick_duration.as_u64(),
            custom_thresholds: chain_batch.custom_thresholds,
            created_at_tick: chain_batch.created_at_tick.as_u64(),
            paused: false,
        };
        self.register_batch(batch).await;
        Ok(())
    }

    pub async fn on_player_joined(&self, batch_id: u64, player: Address) -> eyre::Result<()> {
        let pos = self.vision_contract.get_position(U256::from(batch_id), player).call().await?;
        let mut batches = self.batches.write().await;
        if let Some(state) = batches.get_mut(&batch_id) {
            state.players.insert(player, PlayerPosition {
                player,
                bitmap_hash: pos.bitmap_hash,
                stake_per_tick: pos.stake_per_tick,
                start_tick: pos.start_tick.as_u64(),
                balance: pos.balance,
                join_timestamp: pos.join_timestamp.as_u64(),
            });
        }
        Ok(())
    }

    pub async fn on_batch_paused(&self, batch_id: u64) -> eyre::Result<()> {
        let mut batches = self.batches.write().await;
        if let Some(state) = batches.get_mut(&batch_id) {
            state.batch.paused = true;
        }
        Ok(())
    }

    pub async fn on_player_withdrawn(&self, batch_id: u64, player: Address) -> eyre::Result<()> {
        let mut batches = self.batches.write().await;
        if let Some(state) = batches.get_mut(&batch_id) {
            state.players.remove(&player);
        }
        Ok(())
    }

    pub async fn on_bitmap_updated(&self, batch_id: u64, player: Address, new_hash: H256) -> eyre::Result<()> {
        let mut batches = self.batches.write().await;
        if let Some(state) = batches.get_mut(&batch_id) {
            if let Some(pos) = state.players.get_mut(&player) {
                pos.bitmap_hash = new_hash;
            }
        }
        Ok(())
    }
}
```

**Step 2: Write tests**

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_register_and_due_detection() {
        let scheduler = TickScheduler::new(/* mock contract */);
        let batch = Batch { id: 0, tick_duration: 600, created_at_tick: 0, /* ... */ };
        scheduler.register_batch(batch).await;

        // Should be due if we're past next_tick_time
        let future_time = 601;
        let due = scheduler.get_due_batches(future_time).await;
        assert_eq!(due.len(), 1);
    }

    #[tokio::test]
    async fn test_paused_batch_not_due() {
        let scheduler = TickScheduler::new(/* mock */);
        let batch = Batch { id: 0, tick_duration: 600, paused: false, /* ... */ };
        scheduler.register_batch(batch).await;
        scheduler.on_batch_paused(0).await.unwrap();

        let due = scheduler.get_due_batches(999999).await;
        assert!(due.is_empty());
    }

    #[tokio::test]
    async fn test_mark_resolved_advances_tick() {
        let scheduler = TickScheduler::new(/* mock */);
        let batch = Batch { id: 0, tick_duration: 600, created_at_tick: 0, /* ... */ };
        scheduler.register_batch(batch).await;
        scheduler.mark_resolved(0, 1).await;

        let state = scheduler.get_batch_state(0).await.unwrap();
        // next_tick_time should be at tick 2
    }
}
```

**Commit message:** `feat(issuer): implement per-batch tick scheduler`

---

### Task 3.6: Implement tick resolver (full pipeline)

**Files:**
- Create: `issuer/src/p2pool/resolver.rs`
- Modify: `issuer/src/p2pool/mod.rs`

This is the most complex task in the entire plan. It orchestrates the full per-tick resolution pipeline. Each step is detailed below with implementation guidance.

```rust
use std::collections::HashMap;
use std::sync::Arc;
use ethers::types::{Address, H256, U256};
use crate::p2pool::{
    bitmap_store::BitmapStore,
    multiplier::{compute_early_mult, compute_commitment_mult, compute_effective_stake},
    side_matching::{resolve_market, MarketOutcome, Side},
    types::*,
    config::P2PoolConfig,
};

pub struct TickResolver {
    bitmap_store: Arc<BitmapStore>,
    config: P2PoolConfig,
    http_client: reqwest::Client,
}

#[derive(Debug)]
pub enum ResolverError {
    StalePrice { market_id: H256, last_update_secs: u64 },
    NoPriceData { market_id: H256 },
    RevealWindowExpired { player: Address },
    InternalError(String),
}

impl TickResolver {
    pub fn new(bitmap_store: Arc<BitmapStore>, config: P2PoolConfig) -> Self {
        Self {
            bitmap_store,
            config,
            http_client: reqwest::Client::new(),
        }
    }

    pub async fn resolve_tick(
        &self,
        batch: &Batch,
        tick_id: u64,
        players: &[PlayerPosition],
        tick_start_time: u64,
        tick_end_time: u64,
    ) -> Result<TickResult, ResolverError> {
        // === Step 1: Gather active players ===
        // Filter: balance > 0, bitmap covers this tick, revealed within window
        let active_players: Vec<&PlayerPosition> = players.iter()
            .filter(|p| !p.balance.is_zero() && p.start_tick <= tick_id)
            .collect();

        // === Step 2: Bitmap reveal verification (10-min window) ===
        // After tick_end_time, players have reveal_window_secs to reveal their bitmap.
        // Reveal = submitting the full bitmap to POST /p2pool/bitmap.
        // The bitmap_store already verified keccak256(bitmap) == on-chain hash at store time.
        // Here we check: was the bitmap stored BEFORE reveal deadline?
        let reveal_deadline = tick_end_time + self.config.reveal_window_secs;
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH).unwrap().as_secs();

        let mut revealed_players: Vec<&PlayerPosition> = Vec::new();
        let mut voided_players: Vec<Address> = Vec::new();

        for player in &active_players {
            match self.bitmap_store.get(batch.id, player.player).await {
                Some(stored) if stored.received_at <= reveal_deadline => {
                    revealed_players.push(player);
                }
                _ => {
                    // Non-revealed = void. Stake refunded (not lost).
                    voided_players.push(player.player);
                }
            }
        }

        // === Step 3: Compute multipliers ===
        let player_mults: Vec<(Address, U256)> = revealed_players.iter()
            .map(|p| {
                let time_before = tick_start_time.saturating_sub(p.join_timestamp);
                let total_ticks = tick_id - p.start_tick;
                let early = compute_early_mult(time_before, batch.tick_duration);
                let commit = compute_commitment_mult(total_ticks, self.config.commitment_offset);
                let total = early * commit;
                let effective = compute_effective_stake(p.stake_per_tick, total);
                (p.player, effective)
            })
            .collect();

        // === Step 4: Fetch prices from data-node ===
        let prices_start = self.fetch_prices(&batch.market_ids, tick_start_time).await?;
        let prices_end = self.fetch_prices(&batch.market_ids, tick_end_time).await?;

        // === Step 5: Check staleness ===
        // If no price update since tick opened → cancel that sub-market
        let staleness_threshold = self.config.staleness_threshold_secs;

        // === Step 6: Validate markets against issuer whitelist ===
        // Reject batches with market IDs not in the active whitelist.
        // This prevents garbage/malicious market IDs from wasting resolution resources.
        let active_markets = self.fetch_active_market_ids().await?;
        for market_id in &batch.market_ids {
            if !active_markets.contains(market_id) {
                tracing::warn!("Batch {} has non-whitelisted market {:?}, skipping tick", batch.id, market_id);
                return Err(ResolverError::NonWhitelistedMarket(*market_id));
            }
        }

        // === Step 7: Resolve each market ===
        let mut market_results: Vec<MarketResult> = Vec::new();
        let mut player_balances: HashMap<Address, i128> = HashMap::new(); // delta from this tick

        for (i, market_id) in batch.market_ids.iter().enumerate() {
            let start_price = match prices_start.get(market_id) {
                Some(p) => *p,
                None => {
                    // No price → cancel this sub-market
                    market_results.push(MarketResult {
                        market_id: *market_id,
                        outcome: MarketOutcome::Cancelled,
                        pct_change: 0.0,
                        player_results: vec![],
                    });
                    continue;
                }
            };
            let end_price = match prices_end.get(market_id) {
                Some(p) => *p,
                None => {
                    market_results.push(MarketResult {
                        market_id: *market_id,
                        outcome: MarketOutcome::Cancelled,
                        pct_change: 0.0,
                        player_results: vec![],
                    });
                    continue;
                }
            };

            // Universal resolution: % change = (end - start) / start × 100
            let start_f = start_price.as_u128() as f64;
            let end_f = end_price.as_u128() as f64;
            if start_f == 0.0 {
                // Zero start price → cancel (division by zero protection)
                market_results.push(MarketResult {
                    market_id: *market_id,
                    outcome: MarketOutcome::Cancelled,
                    pct_change: 0.0,
                    player_results: vec![],
                });
                continue;
            }
            let pct_change = (end_f - start_f) / start_f * 100.0;

            // Determine outcome based on resolution type + threshold
            let res_type = batch.resolution_types[i];
            let threshold = batch.custom_thresholds.get(i).copied().unwrap_or(U256::zero());
            let threshold_pct = threshold.as_u128() as f64 / 100.0; // stored as basis points

            let outcome = match res_type {
                0 => if pct_change > 0.0 { MarketOutcome::Up } else { MarketOutcome::Down },     // UP_0
                1 => if pct_change > 30.0 { MarketOutcome::Up } else { MarketOutcome::Flat },     // UP_30
                2 => if pct_change > threshold_pct { MarketOutcome::Up } else { MarketOutcome::Flat }, // UP_X
                3 => if pct_change < 0.0 { MarketOutcome::Down } else { MarketOutcome::Up },      // DOWN_0
                4 => if pct_change < -30.0 { MarketOutcome::Down } else { MarketOutcome::Flat },   // DOWN_30
                5 => if pct_change < -threshold_pct { MarketOutcome::Down } else { MarketOutcome::Flat }, // DOWN_X
                6 => if pct_change.abs() < 1.0 { MarketOutcome::Flat } else { MarketOutcome::Up }, // FLAT_0
                7 => if pct_change.abs() < threshold_pct { MarketOutcome::Flat } else { MarketOutcome::Up }, // FLAT_X
                _ => MarketOutcome::Cancelled,
            };

            // === Step 7: Decode bitmaps to get per-player sides ===
            let mut market_players: Vec<(Address, Side, U256)> = Vec::new();
            for (addr, effective_stake) in &player_mults {
                if let Some(stored) = self.bitmap_store.get(batch.id, *addr).await {
                    // Bitmap format: tick-major. Bit at [tick_offset * num_markets + market_idx]
                    // 1 = UP, 0 = DOWN
                    let tick_offset = (tick_id - players.iter().find(|p| p.player == *addr)
                        .unwrap().start_tick) as usize;
                    let bit_index = tick_offset * batch.market_ids.len() + i;
                    let byte_index = bit_index / 8;
                    let bit_offset = 7 - (bit_index % 8);

                    let side = if byte_index < stored.bitmap.len()
                        && (stored.bitmap[byte_index] >> bit_offset) & 1 == 1 {
                        Side::Up
                    } else {
                        Side::Down
                    };
                    market_players.push((*addr, side, *effective_stake));
                }
            }

            // === Step 8: Side matching ===
            let player_results = resolve_market(&market_players, outcome);

            // Accumulate balance deltas
            for pr in &player_results {
                *player_balances.entry(pr.player).or_insert(0) += pr.net_pnl;
            }

            market_results.push(MarketResult {
                market_id: *market_id,
                outcome,
                pct_change,
                player_results,
            });
        }

        // === Step 9: Compute final balances ===
        let player_final_balances: Vec<PlayerBalance> = revealed_players.iter()
            .map(|p| {
                let delta = player_balances.get(&p.player).copied().unwrap_or(0);
                let new_balance = (p.balance.as_u128() as i128 + delta).max(0) as u128;
                PlayerBalance {
                    player: p.player,
                    old_balance: p.balance,
                    new_balance: U256::from(new_balance),
                    delta,
                }
            })
            .collect();

        // === Step 10: Handle voided players (refund stake for this tick) ===
        // Voided = non-revealed. Their stake is returned, they don't participate.
        // No balance change for voided players.

        Ok(TickResult {
            batch_id: batch.id,
            tick_id,
            market_results,
            player_balances: player_final_balances,
            voided_players,
        })
    }

    async fn fetch_prices(
        &self,
        market_ids: &[H256],
        timestamp: u64,
    ) -> Result<HashMap<H256, U256>, ResolverError> {
        // Query data-node: GET /prices?ids=...&at=timestamp
        // Returns closest price to the given timestamp per market
        let ids: Vec<String> = market_ids.iter().map(|h| format!("{:?}", h)).collect();
        let url = format!(
            "{}/prices?ids={}&at={}",
            self.config.data_node_url,
            ids.join(","),
            timestamp
        );
        let resp: HashMap<String, f64> = self.http_client.get(&url)
            .send().await
            .map_err(|e| ResolverError::InternalError(e.to_string()))?
            .json().await
            .map_err(|e| ResolverError::InternalError(e.to_string()))?;

        let mut prices = HashMap::new();
        for (i, market_id) in market_ids.iter().enumerate() {
            if let Some(price) = resp.get(&format!("{:?}", market_id)) {
                prices.insert(*market_id, U256::from((*price * 1e18) as u128));
            }
        }
        Ok(prices)
    }
}
```

**Key implementation notes:**
- The reveal window is enforced at step 2: `stored.received_at <= reveal_deadline`
- Players must call `POST /p2pool/bitmap` (Task 3.7) BEFORE the reveal deadline
- Voided players (non-revealed) get their stake refunded — they don't lose, they just don't participate
- Division by zero is handled: `start_f == 0.0` → cancel sub-market
- Bitmap decoding is tick-major: bit at `[tick_offset * num_markets + market_idx]`

Write tests using the example from the brief (Tick 5 multi-market resolution).

**Commit message:** `feat(issuer): implement full tick resolution pipeline`

---

### Task 3.7: Implement P2Pool API endpoints on issuer

**Files:**
- Create: `issuer/src/p2pool/api.rs`
- Modify: `issuer/src/p2pool/mod.rs`

REST endpoints served by the issuer. Follow the same axum pattern used in the existing issuer API.

**Endpoints:**

1. **`POST /p2pool/bitmap`** — Player submits bitmap for a batch.
   ```rust
   #[derive(Deserialize)]
   pub struct BitmapSubmission {
       pub batch_id: u64,
       pub bitmap: Vec<u8>,  // raw bitmap bytes
   }

   pub async fn submit_bitmap(
       State(state): State<Arc<P2PoolState>>,
       Json(body): Json<BitmapSubmission>,
   ) -> Result<StatusCode, StatusCode> {
       let player = /* extract from auth header or signed message */;
       // Verify: keccak256(bitmap) == on-chain bitmapHash for this player+batch
       let on_chain_hash = state.scheduler.get_player_bitmap_hash(body.batch_id, player).await?;
       let computed_hash = ethers::utils::keccak256(&body.bitmap);
       if H256::from(computed_hash) != on_chain_hash {
           return Err(StatusCode::BAD_REQUEST); // hash mismatch
       }
       state.bitmap_store.store(player, body.batch_id, body.bitmap, on_chain_hash).await?;
       Ok(StatusCode::OK)
   }
   ```

2. **`GET /p2pool/balance/{batch_id}/{player}`** — Returns BLS-signed balance proof for claims/withdrawals.
   ```rust
   #[derive(Serialize)]
   pub struct BalanceProof {
       pub batch_id: u64,
       pub player: String,
       pub balance: String,
       pub total_deposited: String,
       pub from_tick: u64,
       pub to_tick: u64,
       pub bls_signature: String, // hex-encoded aggregated BLS sig
   }

   pub async fn get_balance(
       State(state): State<Arc<P2PoolState>>,
       Path((batch_id, player)): Path<(u64, String)>,
   ) -> Result<Json<BalanceProof>, StatusCode> {
       let player_addr: Address = player.parse().map_err(|_| StatusCode::BAD_REQUEST)?;
       // Get latest resolved balance from tick resolver
       let resolved = state.resolver.get_player_balance(batch_id, player_addr).await
           .ok_or(StatusCode::NOT_FOUND)?;
       // BLS sign the message: (chainid, contract, "CLAIM"/"WITHDRAW", batch, player, from, to, balance)
       let message = /* compute keccak256 of abi.encode(...) matching contract's expected format */;
       let sig = state.bls_signer.sign(message).await?;
       Ok(Json(BalanceProof { /* ... */ }))
   }
   ```

3. **`GET /p2pool/reveal/{batch_id}/{tick_id}`** — Published bitmaps after reveal window.
   ```rust
   pub async fn get_reveals(
       State(state): State<Arc<P2PoolState>>,
       Path((batch_id, tick_id)): Path<(u64, u64)>,
   ) -> Result<Json<Vec<RevealedBitmap>>, StatusCode> {
       // Only serve bitmaps for ticks that are past the reveal window
       let tick_end_time = /* compute from batch.created_at_tick + tick_id * tick_duration */;
       let reveal_deadline = tick_end_time + state.config.reveal_window_secs;
       let now = /* current timestamp */;
       if now < reveal_deadline {
           return Err(StatusCode::TOO_EARLY); // reveal window still open
       }
       let bitmaps = state.bitmap_store.get_all_for_tick(batch_id, tick_id).await;
       Ok(Json(bitmaps))
   }
   ```

4. **`GET /p2pool/markets`** — Issuer-curated market whitelist.
   Returns the BLS-signed JSON of active markets from the hybrid registry.

**Commit message:** `feat(issuer): implement P2Pool REST API endpoints`

---

### Task 3.8: Integrate tick engine into issuer main loop

**Files:**
- Modify: `issuer/src/main.rs`
- Modify: `issuer/src/bootstrap/mod.rs`
- Modify: `issuer/src/config.rs`
- Create: `issuer/src/p2pool/engine.rs`
- Modify: `issuer/src/p2pool/mod.rs`

**Step 1: Wire P2Pool config into IssuerConfig**

In `issuer/src/config.rs`, add a field to `IssuerConfig`:
```rust
// P2PoolConfig is already defined in issuer/src/p2pool/config.rs (Task 3.1)
// Just add the field to IssuerConfig:
pub p2pool: P2PoolConfig,
```

**Step 2: Create tick engine loop**

Create `issuer/src/p2pool/engine.rs`:
```rust
use std::sync::Arc;
use tokio::sync::watch;
use crate::p2pool::tick_scheduler::TickScheduler;
use crate::p2pool::resolver::TickResolver;
use crate::consensus::BLSConsensus;

/// Main tick engine loop. Polls scheduler for due batches, resolves ticks,
/// achieves BLS consensus with other issuers, and updates balances.
pub async fn run(
    scheduler: Arc<TickScheduler>,
    resolver: Arc<TickResolver>,
    consensus: Arc<BLSConsensus>,
    mut shutdown: watch::Receiver<bool>,
    poll_interval_ms: u64,
) {
    let interval = tokio::time::Duration::from_millis(poll_interval_ms);
    loop {
        tokio::select! {
            _ = tokio::time::sleep(interval) => {
                let now = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH).unwrap().as_secs();

                let due_batches = scheduler.get_due_batches(now).await;

                for batch_id in due_batches {
                    match scheduler.get_batch_state(batch_id).await {
                        Some((batch, players)) => {
                            let tick_id = /* current tick for this batch */;
                            let tick_start = (batch.created_at_tick + tick_id) * batch.tick_duration;
                            let tick_end = tick_start + batch.tick_duration;

                            // Wait for reveal window to close before resolving
                            let reveal_deadline = tick_end + resolver.config.reveal_window_secs;
                            if now < reveal_deadline {
                                continue; // reveal window still open, skip this tick
                            }

                            // Resolve tick
                            match resolver.resolve_tick(&batch, tick_id, &players, tick_start, tick_end).await {
                                Ok(result) => {
                                    // BLS consensus: all issuers must compute same result
                                    let result_hash = result.compute_hash(); // deterministic hash of TickResult
                                    match consensus.sign_and_aggregate(result_hash).await {
                                        Ok(aggregated_sig) => {
                                            // Store result + signature for balance proofs
                                            resolver.store_result(result, aggregated_sig).await;
                                            scheduler.mark_resolved(batch_id, tick_id).await;
                                            tracing::info!("Resolved batch {} tick {}", batch_id, tick_id);
                                        }
                                        Err(e) => tracing::error!("BLS consensus failed for batch {} tick {}: {}", batch_id, tick_id, e),
                                    }
                                }
                                Err(e) => tracing::error!("Resolution failed for batch {} tick {}: {:?}", batch_id, tick_id, e),
                            }
                        }
                        None => tracing::warn!("Due batch {} not found in scheduler", batch_id),
                    }
                }
            }
            _ = shutdown.changed() => {
                tracing::info!("Tick engine shutting down");
                break;
            }
        }
    }
}
```

**Step 3: Wire into main.rs**

```rust
// In main.rs, after existing cycle engine setup:
if config.p2pool.enabled {
    let vision_contract = Arc::new(/* abigen binding */);
    let tick_scheduler = Arc::new(TickScheduler::new(vision_contract.clone()));
    let bitmap_store = Arc::new(BitmapStore::new());
    let resolver = Arc::new(TickResolver::new(bitmap_store.clone(), config.p2pool.clone()));

    // Spawn tick engine
    let sched = tick_scheduler.clone();
    let res = resolver.clone();
    let cons = consensus.clone();
    let shutdown_rx = shutdown.subscribe();
    tokio::spawn(async move {
        p2pool::engine::run(sched, res, cons, shutdown_rx, config.p2pool.tick_poll_interval_ms).await;
    });

    // Add P2Pool API routes to the existing axum router
    let p2pool_state = Arc::new(P2PoolState {
        scheduler: tick_scheduler.clone(),
        bitmap_store: bitmap_store.clone(),
        resolver: resolver.clone(),
        config: config.p2pool.clone(),
        bls_signer: bls_signer.clone(),
    });
    // router = router.merge(p2pool::api::routes(p2pool_state));
}
```

**Step 4: Build and test**

Run: `cd issuer && cargo build`
Expected: Compiles. Full integration test requires running chain + data-node.

**Commit message:** `feat(issuer): integrate P2Pool tick engine into main loop`

---

### Task 3.9: Add Vision.sol chain event listener

**Files:**
- Create: `issuer/src/p2pool/chain_listener.rs`
- Modify: `issuer/src/p2pool/mod.rs`

The tick scheduler needs to know about batches and player positions. This task adds a chain event listener that watches Vision.sol for `BatchCreated`, `PlayerJoined`, `PlayerDeposited`, `PlayerWithdrawn`, `BatchPaused`, etc. and feeds them into the tick scheduler's state.

**Step 1: Create chain listener module**

Create `issuer/src/p2pool/chain_listener.rs`:

```rust
use ethers::prelude::*;
use ethers::types::{Address, H256, U256, Filter, Log};
use std::sync::Arc;
use tokio::sync::watch;

use crate::p2pool::types::{Batch, PlayerPosition};
use crate::p2pool::tick_scheduler::TickScheduler;

/// Listens to Vision.sol events and updates the tick scheduler state.
pub struct ChainListener {
    provider: Arc<Provider<Ws>>,
    vision_address: Address,
    scheduler: Arc<TickScheduler>,
}

// Event signatures (keccak256 of event signature)
const BATCH_CREATED_TOPIC: &str = "BatchCreated(uint256,address,uint256)";
const PLAYER_JOINED_TOPIC: &str = "PlayerJoined(uint256,address,uint256,bytes32)";
const PLAYER_DEPOSITED_TOPIC: &str = "PlayerDeposited(uint256,address,uint256)";
const PLAYER_WITHDRAWN_TOPIC: &str = "PlayerWithdrawn(uint256,address,uint256)";
const FORCE_WITHDRAWN_TOPIC: &str = "ForceWithdrawn(uint256,address,uint256)";
const BATCH_PAUSED_TOPIC: &str = "BatchPaused(uint256)";
const REWARDS_CLAIMED_TOPIC: &str = "RewardsClaimed(uint256,address,uint256)";

impl ChainListener {
    pub fn new(
        provider: Arc<Provider<Ws>>,
        vision_address: Address,
        scheduler: Arc<TickScheduler>,
    ) -> Self {
        Self { provider, vision_address, scheduler }
    }

    /// Start listening from a given block number. Replays missed events then subscribes live.
    pub async fn run(
        &self,
        from_block: u64,
        mut shutdown: watch::Receiver<bool>,
    ) -> eyre::Result<()> {
        // 1. Replay historical events from `from_block` to latest
        let filter = Filter::new()
            .address(self.vision_address)
            .from_block(from_block);

        let logs = self.provider.get_logs(&filter).await?;
        for log in logs {
            self.process_log(log).await?;
        }

        // 2. Subscribe to new events
        let sub = self.provider.subscribe_logs(&Filter::new()
            .address(self.vision_address)
        ).await?;

        let mut stream = sub.into_stream();
        loop {
            tokio::select! {
                Some(log) = stream.next() => {
                    if let Err(e) = self.process_log(log).await {
                        tracing::error!("Failed to process Vision event: {e}");
                    }
                }
                _ = shutdown.changed() => {
                    tracing::info!("Chain listener shutting down");
                    break;
                }
            }
        }
        Ok(())
    }

    async fn process_log(&self, log: Log) -> eyre::Result<()> {
        let topic0 = log.topics.get(0).ok_or_else(|| eyre::eyre!("No topic0"))?;

        // Dispatch based on event topic
        match topic0 {
            t if *t == H256::from(ethers::utils::keccak256(BATCH_CREATED_TOPIC)) => {
                let batch_id = U256::from_big_endian(&log.topics[1].as_bytes()).as_u64();
                let creator = Address::from(log.topics[2]);
                tracing::info!("BatchCreated: id={batch_id}, creator={creator:?}");
                // Fetch full batch config from chain via getBatch() call
                self.scheduler.on_batch_created(batch_id).await?;
            }
            t if *t == H256::from(ethers::utils::keccak256(PLAYER_JOINED_TOPIC)) => {
                let batch_id = U256::from_big_endian(&log.topics[1].as_bytes()).as_u64();
                let player = Address::from(log.topics[2]);
                tracing::info!("PlayerJoined: batch={batch_id}, player={player:?}");
                self.scheduler.on_player_joined(batch_id, player).await?;
            }
            t if *t == H256::from(ethers::utils::keccak256(BATCH_PAUSED_TOPIC)) => {
                let batch_id = U256::from_big_endian(&log.topics[1].as_bytes()).as_u64();
                tracing::info!("BatchPaused: id={batch_id}");
                self.scheduler.on_batch_paused(batch_id).await?;
            }
            t if *t == H256::from(ethers::utils::keccak256("RewardsClaimed(uint256,address,uint256)")) => {
                let batch_id = U256::from_big_endian(&log.topics[1].as_bytes()).as_u64();
                let player = Address::from(log.topics[2]);
                tracing::info!("RewardsClaimed: batch={batch_id}, player={player:?}");
                // Re-read player position from chain to update local state
                self.scheduler.on_rewards_claimed(batch_id, player).await?;
            }
            // PlayerDeposited, PlayerWithdrawn, ForceWithdrawn
            // update local balance/bitmap state accordingly
            _ => {
                tracing::debug!("Unhandled Vision event: {:?}", topic0);
            }
        }

        Ok(())
    }
}
```

**Step 2: Wire into main loop**

Update Task 3.8's integration in `main.rs`:

```rust
// In main.rs, after existing cycle engine setup:
if config.p2pool.enabled {
    let tick_scheduler = Arc::new(TickScheduler::new());
    let bitmap_store = Arc::new(BitmapStore::new());
    let resolver = Arc::new(TickResolver::new(bitmap_store.clone(), config.p2pool.clone()));

    // Spawn chain event listener (feeds scheduler with on-chain state)
    let chain_listener = ChainListener::new(
        ws_provider.clone(),
        config.p2pool.vision_address,
        tick_scheduler.clone(),
    );
    let shutdown_rx = shutdown.subscribe();
    tokio::spawn(async move {
        if let Err(e) = chain_listener.run(config.p2pool.start_block, shutdown_rx).await {
            tracing::error!("Chain listener failed: {e}");
        }
    });

    // Spawn tick engine
    tokio::spawn(async move {
        p2pool::engine::run(tick_scheduler, resolver, consensus, shutdown).await;
    });
}
```

**Step 3: Build and test**

Run: `cd issuer && cargo build`
Expected: Compiles

**Step 5: Commit**

```bash
git add issuer/src/p2pool/chain_listener.rs issuer/src/p2pool/mod.rs
git commit -m "feat(issuer): add Vision.sol chain event listener for tick scheduler"
```

---

## Phase 4: Frontend — P2Pool UI

### Task 4.1: Create P2Pool page skeleton and batch card component

**Files:**
- Create: `frontend/components/domain/p2pool/P2PoolPage.tsx`
- Create: `frontend/components/domain/p2pool/BatchCard.tsx`
- Create: `frontend/hooks/p2pool/useBatches.ts`
- Modify: `frontend/app/page.tsx`

**Step 1: Create hooks**

Create `frontend/hooks/p2pool/useBatches.ts`:

```typescript
import { useQuery } from '@tanstack/react-query'

const DATA_NODE_URL = process.env.NEXT_PUBLIC_DATA_NODE_URL || 'http://localhost:8200'

export interface BatchInfo {
  id: number
  creator: string
  marketIds: string[]
  resolutionTypes: number[]
  tickDuration: number
  playerCount: number
  tvl: string
  currentTick: number
  paused: boolean
}

export function useBatches() {
  return useQuery<BatchInfo[]>({
    queryKey: ['p2pool-batches'],
    queryFn: async () => {
      const res = await fetch(`${DATA_NODE_URL}/p2pool/batches`)
      if (!res.ok) return []
      return res.json()
    },
    refetchInterval: 10000,
  })
}
```

**Step 2: Create BatchCard**

Create `frontend/components/domain/p2pool/BatchCard.tsx`:

```tsx
'use client'

import { BatchInfo } from '@/hooks/p2pool/useBatches'

interface BatchCardProps {
  batch: BatchInfo
  onClick: () => void
}

export function BatchCard({ batch, onClick }: BatchCardProps) {
  const marketCount = batch.marketIds.length

  return (
    <div
      onClick={onClick}
      className="bg-card border border-border-light rounded-card p-4 cursor-pointer
                 hover:bg-card-hover hover:shadow-card-hover transition-all"
    >
      {/* Animated header placeholder — type depends on market count */}
      <div className="h-16 bg-surface rounded mb-3 flex items-center justify-center">
        <span className="text-text-muted text-xs font-mono">
          {marketCount <= 5 ? 'sparklines' :
           marketCount <= 20 ? 'bar grid' :
           marketCount <= 100 ? 'heatmap' : 'bitmap mosaic'}
        </span>
      </div>

      <h3 className="font-bold text-text-primary text-sm">
        Batch #{batch.id}
      </h3>
      <div className="flex gap-2 mt-1 text-xs text-text-secondary font-mono">
        <span>{marketCount} mkts</span>
        <span>&middot;</span>
        <span>{batch.tickDuration / 60}min</span>
        <span>&middot;</span>
        <span>{batch.playerCount} players</span>
        <span>&middot;</span>
        <span>${parseFloat(batch.tvl).toLocaleString()}</span>
      </div>
    </div>
  )
}
```

**Step 3: Create P2PoolPage**

Create `frontend/components/domain/p2pool/P2PoolPage.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useBatches, BatchInfo } from '@/hooks/p2pool/useBatches'
import { BatchCard } from './BatchCard'

export function P2PoolPage() {
  const { data: batches, isLoading } = useBatches()
  const [expandedBatchId, setExpandedBatchId] = useState<number | null>(null)

  return (
    <div className="max-w-site-wide mx-auto px-6 lg:px-12 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[32px] font-black tracking-tight text-text-primary">VISION</h1>
          <p className="text-text-secondary text-sm font-mono mt-1">
            {batches?.length || 0} live &middot; sealed parimutuel prediction markets
          </p>
        </div>
        <button className="bg-terminal text-text-inverse px-4 py-2 rounded-card text-sm font-bold
                           hover:opacity-90 transition-opacity">
          + CREATE BATCH
        </button>
      </div>

      {/* Cards grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-32 bg-surface rounded-card animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {batches?.map(batch => (
            <div key={batch.id}>
              <BatchCard
                batch={batch}
                onClick={() => setExpandedBatchId(
                  expandedBatchId === batch.id ? null : batch.id
                )}
              />
              {expandedBatchId === batch.id && (
                <div className="mt-2 p-4 bg-surface border border-border-medium rounded-card">
                  {/* Expanded view — implemented in Task 4.2 */}
                  <p className="text-text-muted text-sm">Expanded view coming...</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

**Step 4: Wire into page.tsx**

In `frontend/app/page.tsx`, add P2Pool as the vision page content (replace current VisionPage import).

**Step 5: Verify**

Run: `cd frontend && npm run build`
Expected: Compiles with no errors

**Step 6: Commit**

```bash
git add frontend/components/domain/p2pool/ frontend/hooks/p2pool/ frontend/app/page.tsx
git commit -m "feat(frontend): add P2Pool page skeleton with batch cards grid"
```

---

### Task 4.2: Implement expanded batch view (Visual + Script tabs)

**Files:**
- Create: `frontend/components/domain/p2pool/ExpandedBatch.tsx`
- Create: `frontend/components/domain/p2pool/VisualTab.tsx`
- Create: `frontend/components/domain/p2pool/CompactVisualTab.tsx`
- Create: `frontend/components/domain/p2pool/ScriptTab.tsx`
- Modify: `frontend/components/domain/p2pool/P2PoolPage.tsx`

Implement the three view modes:
- **VisualTab** (≤20 markets): Market cards with price, sparkline, ▲/▼ toggle
- **CompactVisualTab** (21-100): Rows with toggle + name + price + change + mini chart
- **ScriptTab** (100+ or any batch): Python editor using Monaco + Pyodide

Each tab includes: player stats footer (win%, balance, stake, mult) and action buttons (ALL ▲, ALL ▼, DEPOSIT, WITHDRAW, SUBMIT).

**Commit message:** `feat(frontend): implement expanded batch view with Visual and Script tabs`

---

### Task 4.3: Implement Python strategy editor with Pyodide

**Files:**
- Create: `frontend/components/domain/p2pool/PythonEditor.tsx`
- Create: `frontend/components/domain/p2pool/StrategyTemplates.tsx`
- Create: `frontend/hooks/p2pool/usePyodide.ts`
- Create: `frontend/hooks/p2pool/useBacktest.ts`

Implement:
- Pyodide WASM loading hook (lazy, loaded on first script tab open)
- Monaco/CodeMirror editor for Python
- Template picker (Momentum, Bear All, Random, Custom)
- `[RUN PREVIEW]` button that executes strategy via Pyodide, shows bitmap preview
- `[BACKTEST]` button that calls data-node `/p2pool/backtest` endpoint
- Backtest result chart (win rate curve) using recharts

**Commit message:** `feat(frontend): implement Python strategy editor with Pyodide and backtest`

---

### Task 4.4: Implement bitmap encoding and on-chain submission

**Files:**
- Create: `frontend/lib/p2pool/bitmap.ts`
- Create: `frontend/hooks/p2pool/useSubmitBitmap.ts`
- Create: `frontend/hooks/p2pool/useJoinBatch.ts`

Implement:
- Bitmap encoding: array of 1/0 → packed bytes (tick-major ordering)
- keccak256 hashing of bitmap
- `joinBatch()` contract call via wagmi `useWriteContract`
- Bitmap submission to issuer nodes via REST API
- Deposit flow: approve USDC → joinBatch with bitmap hash

**Commit message:** `feat(frontend): implement bitmap encoding and on-chain batch joining`

---

### Task 4.5: Implement batch creation flow

**Files:**
- Create: `frontend/components/domain/p2pool/CreateBatchModal.tsx`
- Create: `frontend/hooks/p2pool/useCreateBatch.ts`
- Create: `frontend/hooks/p2pool/useMarketRegistry.ts`

Implement:
- Market picker from active registry (`/p2pool/markets/active`)
- Resolution type selector per market
- Tick duration input
- Custom threshold inputs for _x types
- Preview → `createBatch()` contract call

**Commit message:** `feat(frontend): implement batch creation flow`

---

### Task 4.6: Implement deposit, withdraw, and claim flows

**Files:**
- Create: `frontend/hooks/p2pool/useDeposit.ts`
- Create: `frontend/hooks/p2pool/useWithdraw.ts`
- Create: `frontend/hooks/p2pool/useClaim.ts`
- Create: `frontend/components/domain/p2pool/DepositModal.tsx`
- Create: `frontend/components/domain/p2pool/WithdrawModal.tsx`

Implement:
- Deposit: approve + `deposit()` call
- Withdraw: fetch BLS-signed balance from issuer → `withdraw()` call with proof
- Claim: fetch BLS-signed balance for tick range → `claimRewards()` call

**Commit message:** `feat(frontend): implement deposit, withdraw, and claim flows`

---

### Task 4.7: Add animated card headers

**Files:**
- Create: `frontend/components/domain/p2pool/headers/SparklineHeader.tsx`
- Create: `frontend/components/domain/p2pool/headers/BarGridHeader.tsx`
- Create: `frontend/components/domain/p2pool/headers/HeatmapHeader.tsx`
- Create: `frontend/components/domain/p2pool/headers/BitmapMosaicHeader.tsx`
- Modify: `frontend/components/domain/p2pool/BatchCard.tsx`

Implement the four header types that auto-select based on market count:
- ≤5: animated sparklines (canvas or SVG)
- 6-20: mini bar grid
- 21-100: result heatmap
- 100+: bitmap mosaic

**Commit message:** `feat(frontend): add animated batch card headers`

---

## Phase 5: Cleanup

### Task 5.1: Delete old Vision code

**Files:**
- Delete: `contracts/src/vision/CollateralVault.sol`
- Delete: `contracts/src/vision/KeeperRegistry.sol`
- Delete: `contracts/src/vision/ReferralVault.sol`
- Delete: `contracts/src/interfaces/ICollateralVault.sol`
- Delete: `contracts/src/interfaces/IKeeperRegistry.sol`
- Delete: `contracts/src/interfaces/IReferralVault.sol`
- Delete: `frontend/components/domain/vision/LeaderboardSection.tsx`
- Delete: `frontend/components/domain/vision/LeaderboardTable.tsx`
- Delete: `frontend/components/domain/vision/AnimatedLeaderboardRow.tsx`
- Delete: `frontend/components/domain/vision/LeaderboardSkeleton.tsx`
- Delete: `frontend/components/domain/vision/VisionMarketsGrid.tsx`
- Delete: `frontend/components/domain/vision/VisionPage.tsx`
- Delete: `frontend/hooks/vision/useLeaderboard.ts`
- Delete: `frontend/hooks/vision/useLeaderboardSSE.ts`
- Delete: `frontend/hooks/vision/useMarketSnapshot.ts`
- Delete: `frontend/hooks/vision/useMediaQueries.ts`
- Delete: `frontend/hooks/vision/useRankChangeAnimation.ts`

Verify no remaining imports reference deleted files. Run `grep -r "from.*vision/" frontend/` to catch any stale imports.

Run: `cd contracts && forge build` and `cd frontend && npm run build`

**Commit message:** `chore: remove old Vision bilateral betting code`

---

### Task 5.2: Update deployment scripts

**Files:**
- Modify or create deploy script for Vision.sol
- Update `deployments/` artifacts

Add Vision.sol to deployment alongside existing contracts. Register Vision contract address in issuer config.

**Commit message:** `chore: add Vision.sol deployment script`

---

### Task 5.3: Implement real backtest endpoint

**Files:**
- Modify: `data-node/src/p2pool_api.rs`

The backtest handler from Task 2.4 returns a mock result. This task replaces it with a real implementation that:

1. Parses `market_ids` and fetches historical price data from `market_prices` table
2. Simulates tick resolution using the same `% change = (end - start) / start × 100` formula
3. Applies the given strategy (bitmap pattern) to determine UP/DOWN calls per market per tick
4. Computes win/loss per tick and cumulative PnL curve
5. Returns `BacktestResult` with real `win_rate`, `total_pnl`, and per-tick breakdown

```rust
pub async fn backtest(
    State(state): State<Arc<AppState>>,
    Query(params): Query<BacktestParams>,
) -> Result<Json<BacktestResult>, StatusCode> {
    let market_ids: Vec<&str> = params.market_ids.split(',').collect();
    let tick_secs = params.tick_duration;
    let num_ticks = params.ticks;

    // Fetch historical prices for each market, sampled at tick boundaries.
    // Use time-bucket aggregation (closest price to each tick boundary)
    // instead of assuming 1 price/minute — works for all sources.
    let mut market_ticks: HashMap<String, Vec<(i64, f64, f64)>> = HashMap::new(); // (tick_start_ts, start_price, end_price)
    for market_id in &market_ids {
        let rows = sqlx::query!(
            r#"
            WITH tick_boundaries AS (
                SELECT generate_series(
                    (SELECT MAX(fetched_at) FROM market_prices WHERE asset_id = $1) - ($2::bigint * $3::bigint),
                    (SELECT MAX(fetched_at) FROM market_prices WHERE asset_id = $1),
                    $2::bigint
                ) AS tick_start
            ),
            tick_prices AS (
                SELECT DISTINCT ON (tb.tick_start)
                    tb.tick_start,
                    mp.value::float8 AS start_price,
                    LEAD(mp.value::float8) OVER (ORDER BY tb.tick_start) AS end_price
                FROM tick_boundaries tb
                LEFT JOIN LATERAL (
                    SELECT value FROM market_prices
                    WHERE asset_id = $1 AND fetched_at <= tb.tick_start
                    ORDER BY fetched_at DESC LIMIT 1
                ) mp ON true
                ORDER BY tb.tick_start
            )
            SELECT tick_start as "tick_start!", start_price as "start_price!", end_price as "end_price"
            FROM tick_prices
            WHERE end_price IS NOT NULL
            ORDER BY tick_start ASC
            LIMIT $3
            "#,
            market_id.trim(),
            tick_secs,
            num_ticks
        )
        .fetch_all(&state.pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        market_ticks.insert(
            market_id.to_string(),
            rows.into_iter()
                .filter_map(|r| r.end_price.map(|ep| (r.tick_start, r.start_price, ep)))
                .collect()
        );
    }

    // Simulate ticks — strategy decides BEFORE seeing outcome (no lookahead)
    let mut per_tick_results = Vec::new();
    let mut total_wins = 0i64;
    let mut total_losses = 0i64;
    let mut cumulative_pnl = 0.0f64;
    // Track previous tick's outcome per market for momentum strategy
    let mut prev_outcomes: HashMap<String, f64> = HashMap::new();

    for tick in 0..num_ticks {
        let mut wins = 0i32;
        let mut losses = 0i32;

        for (idx, market_id) in market_ids.iter().enumerate() {
            let ticks = match market_ticks.get(*market_id) {
                Some(t) if t.len() > tick as usize => t,
                _ => continue,
            };

            let (_, start_price, end_price) = ticks[tick as usize];
            if start_price == 0.0 { continue; }
            let pct_change = (end_price - start_price) / start_price * 100.0;

            // Strategy decides based on PRIOR information only (no lookahead)
            let bet_up = match params.strategy.as_str() {
                "momentum" => {
                    // Bet based on PREVIOUS tick's direction (not current)
                    prev_outcomes.get(*market_id).map_or(true, |prev| *prev > 0.0)
                }
                "contrarian" => {
                    // Bet against previous tick's direction
                    prev_outcomes.get(*market_id).map_or(false, |prev| *prev <= 0.0)
                }
                "all_up" => true,
                "all_down" => false,
                _ => idx % 2 == 0, // alternating default
            };

            let went_up = pct_change > 0.0;
            if bet_up == went_up { wins += 1; } else { losses += 1; }

            // Record this tick's outcome for next tick's strategy decision
            prev_outcomes.insert(market_id.to_string(), pct_change);
        }

        let tick_pnl = (wins as f64 - losses as f64) * 100.0; // simplified
        cumulative_pnl += tick_pnl;
        total_wins += wins as i64;
        total_losses += losses as i64;

        per_tick_results.push(TickResult {
            tick,
            wins,
            losses,
            pnl: cumulative_pnl,
        });
    }

    let total_bets = total_wins + total_losses;
    let win_rate = if total_bets > 0 { total_wins as f64 / total_bets as f64 } else { 0.0 };

    Ok(Json(BacktestResult {
        win_rate,
        total_pnl: cumulative_pnl,
        ticks_simulated: num_ticks,
        per_tick_results,
    }))
}
```

**Step 2: Build and test**

Run: `cd data-node && cargo build`
Expected: Compiles

Test manually: `curl "http://localhost:8200/p2pool/backtest?market_ids=btc_usd&ticks=10&tick_duration=600&strategy=momentum"`
Expected: JSON with real win_rate and per_tick_results (non-empty if price data exists)

**Step 3: Commit**

```bash
git add data-node/src/p2pool_api.rs
git commit -m "feat(data-node): implement real backtest endpoint with historical price simulation"
```

---

## Task Dependency Graph

```
Phase 1 (Contract)     Phase 2 (Data Node)        Phase 3 (Issuer)       Phase 4 (Frontend)
═══════════════════    ═══════════════════════    ═══════════════════    ═══════════════════
1.1 skeleton           2.1 Polymarket             3.1 skeleton
  ↓                    2.2 Twitch                 3.2 bitmap store
1.2 batches            2.3 HackerNews               ↓
  ↓                    2.3b Weather               3.3 multiplier
1.3 player ops         2.3c DB migrations ←──┐    3.4 side matching      4.1 page skeleton
  ↓                      ↓                   │      ↓                      ↓
1.4 bots + issuer ops  2.4 P2Pool API        │    3.5 tick scheduler     4.2 expanded view
                         ↓                   │      ↓                      ↓
                       2.5 chain indexer ─────┘    3.6 resolver           4.3 Python editor
                         ↓                           ↓                      ↓
                         └─────────────────────→   3.7 API endpoints      4.4 bitmap submit
                                                     ↓                      ↓
                                                   3.8 main integration   4.5 create batch
                                                     ↓                      ↓
                                                   3.9 chain listener     4.6 deposit/withdraw
                                                                            ↓
                                                                          4.7 card headers

Phase 5 (Cleanup) — after all above complete
5.1 delete old code
5.2 update deploys
5.3 real backtest endpoint
```

**Phases 1, 2, 3 can run in parallel.** Phase 4 depends on Phase 1 (contract ABI) and Phase 2 (data endpoints). Task 2.5 (chain indexer) depends on Task 2.3c (DB migrations). Phase 5 runs last.
