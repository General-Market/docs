// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {BLSLib} from "../libraries/BLSLib.sol";
import {BLSVerifier} from "../libraries/BLSVerifier.sol";
import {IVision} from "../interfaces/IVision.sol";
import {IIssuerRegistry} from "../interfaces/IIssuerRegistry.sol";

contract Vision is IVision, ReentrancyGuard, BLSVerifier {
    using SafeERC20 for IERC20;

    // ============ CONSTANTS ============
    uint256 public constant PROTOCOL_FEE_BPS = 30; // 0.3%
    uint256 public constant MIN_STAKE_PER_TICK = 1e5; // 0.1 USDC (6 decimals)
    uint256 public constant BOT_MIN_STAKE = 1e18; // 1 WIND (18 decimals)
    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public constant MAX_TICK_DURATION = 30 days;

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

    // Bot registry state
    mapping(address => Bot) internal _bots;
    address[] internal _botAddresses;
    mapping(address => uint256) internal _botIndex;

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
    event BatchPausedEvent(uint256 indexed batchId);
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
        __BLSVerifier_init(_issuerRegistry);
    }

    // ============ BATCH MANAGEMENT ============

    function createBatch(
        bytes32[] calldata marketIds,
        uint8[] calldata resolutionTypes,
        uint256 tickDuration,
        uint256[] calldata customThresholds
    ) external returns (uint256 batchId) {
        if (marketIds.length != resolutionTypes.length) revert ArrayLengthMismatch();
        if (tickDuration == 0) revert InvalidTickDuration();
        if (tickDuration > MAX_TICK_DURATION) revert InvalidTickDuration();

        batchId = nextBatchId;

        Batch storage batch = _batches[batchId];
        batch.creator = msg.sender;
        batch.marketIds = marketIds;
        batch.resolutionTypes = resolutionTypes;
        batch.tickDuration = tickDuration;
        batch.customThresholds = customThresholds;
        batch.createdAtTick = block.timestamp / tickDuration;
        batch.paused = false;

        nextBatchId = batchId + 1;

        emit BatchCreated(batchId, msg.sender, tickDuration);
    }

    function updateBatchMarkets(
        uint256 batchId,
        bytes32[] calldata marketIds,
        uint8[] calldata resolutionTypes,
        bytes calldata blsSig
    ) external {
        Batch storage batch = _batches[batchId];
        if (batch.creator == address(0)) revert BatchNotFound();
        if (msg.sender != batch.creator) revert Unauthorized();
        if (marketIds.length != resolutionTypes.length) revert ArrayLengthMismatch();

        // BLS verify: signature over (batchId, keccak256(marketIds), keccak256(resolutionTypes), currentTick)
        uint256 currentTick = block.timestamp / batch.tickDuration;
        bytes32 message = keccak256(abi.encode(
            block.chainid,
            address(this),
            "updateBatchMarkets",
            batchId,
            keccak256(abi.encodePacked(marketIds)),
            keccak256(abi.encodePacked(resolutionTypes)),
            currentTick
        ));
        _verifyBLS(message, blsSig);

        batch.marketIds = marketIds;
        batch.resolutionTypes = resolutionTypes;

        emit BatchMarketsUpdated(batchId);
    }

    function getBatch(uint256 batchId) external view returns (Batch memory) {
        return _batches[batchId];
    }

    // ============ PLAYER OPERATIONS ============

    function joinBatch(
        uint256 batchId,
        uint256 depositAmount,
        uint256 stakePerTick,
        bytes32 bitmapHash
    ) external {
        // TODO: Task 1.3
        revert("NOT_IMPLEMENTED");
    }

    function updateBitmap(uint256 batchId, bytes32 newBitmapHash) external {
        // TODO: Task 1.3
        revert("NOT_IMPLEMENTED");
    }

    function deposit(uint256 batchId, uint256 amount) external {
        // TODO: Task 1.3
        revert("NOT_IMPLEMENTED");
    }

    function claimRewards(
        uint256 batchId,
        uint256 fromTick,
        uint256 toTick,
        uint256 newBalance,
        bytes calldata blsSignature
    ) external {
        // TODO: Task 1.4
        revert("NOT_IMPLEMENTED");
    }

    function withdraw(
        uint256 batchId,
        uint256 finalBalance,
        bytes calldata blsSignature
    ) external {
        // TODO: Task 1.4
        revert("NOT_IMPLEMENTED");
    }

    function getPosition(uint256 batchId, address player) external view returns (PlayerPosition memory) {
        return _positions[batchId][player];
    }

    // ============ BOT REGISTRY ============

    function registerBot(string calldata endpoint, bytes32 pubkeyHash) external {
        // TODO: Task 1.5
        revert("NOT_IMPLEMENTED");
    }

    function deregisterBot() external {
        // TODO: Task 1.5
        revert("NOT_IMPLEMENTED");
    }

    function getAllActiveBots() external view returns (address[] memory, Bot[] memory) {
        // TODO: Task 1.5
        revert("NOT_IMPLEMENTED");
    }

    // ============ FEE MANAGEMENT ============

    function collectFees() external {
        // TODO: Task 1.5
        revert("NOT_IMPLEMENTED");
    }

    // ============ ISSUER OPERATIONS ============

    function pause(uint256 batchId, bytes calldata blsSignature) external {
        // TODO: Task 1.5
        revert("NOT_IMPLEMENTED");
    }

    function unpause(uint256 batchId, bytes calldata blsSignature) external {
        // TODO: Task 1.5
        revert("NOT_IMPLEMENTED");
    }

    function forceWithdraw(
        uint256 batchId,
        address player,
        uint256 finalBalance,
        bytes calldata blsSignature
    ) external {
        // TODO: Task 1.5
        revert("NOT_IMPLEMENTED");
    }
}
