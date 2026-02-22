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
    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public constant MAX_TICK_DURATION = 30 days;

    // ============ IMMUTABLES ============
    IERC20 public immutable USDC;
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

    constructor(address _usdc, address _issuerRegistry, address _feeCollector) {
        USDC = IERC20(_usdc);
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
    ) external nonReentrant {
        Batch storage batch = _batches[batchId];
        if (batch.creator == address(0)) revert BatchNotFound();
        if (batch.paused) revert BatchPaused();
        if (_positions[batchId][msg.sender].stakePerTick != 0) revert AlreadyJoined();
        if (stakePerTick < MIN_STAKE_PER_TICK) revert StakeBelowMinimum();
        if (depositAmount < stakePerTick) revert InsufficientDeposit();

        USDC.safeTransferFrom(msg.sender, address(this), depositAmount);

        uint256 currentTick = block.timestamp / batch.tickDuration;
        _positions[batchId][msg.sender] = PlayerPosition({
            bitmapHash: bitmapHash,
            stakePerTick: stakePerTick,
            startTick: currentTick,
            balance: depositAmount,
            lastClaimedTick: 0,
            joinTimestamp: block.timestamp,
            totalDeposited: depositAmount,
            totalClaimed: 0
        });

        emit PlayerJoined(batchId, msg.sender, stakePerTick, bitmapHash);
    }

    function updateBitmap(uint256 batchId, bytes32 newBitmapHash) external {
        if (_positions[batchId][msg.sender].stakePerTick == 0) revert NotJoined();
        _positions[batchId][msg.sender].bitmapHash = newBitmapHash;
    }

    function deposit(uint256 batchId, uint256 amount) external nonReentrant {
        PlayerPosition storage position = _positions[batchId][msg.sender];
        if (position.stakePerTick == 0) revert NotJoined();

        USDC.safeTransferFrom(msg.sender, address(this), amount);

        position.balance += amount;
        position.totalDeposited += amount;

        emit PlayerDeposited(batchId, msg.sender, amount);
    }

    function claimRewards(
        uint256 batchId,
        uint256 fromTick,
        uint256 toTick,
        uint256 newBalance,
        bytes calldata blsSignature
    ) external nonReentrant {
        PlayerPosition storage position = _positions[batchId][msg.sender];
        if (position.stakePerTick == 0) revert NotJoined();
        if (fromTick <= position.lastClaimedTick && position.lastClaimedTick != 0) revert TickAlreadyClaimed();
        if (toTick < fromTick) revert InvalidTickRange();

        // BLS verify: issuers sign the new balance for this player over this tick range
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

        uint256 oldBalance = position.balance;
        position.balance = newBalance;
        position.lastClaimedTick = toTick;

        if (newBalance > oldBalance) {
            uint256 winnings = newBalance - oldBalance;
            uint256 fee = (winnings * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
            accumulatedFees += fee;
            uint256 payout = winnings - fee;

            // Solvency check
            if (USDC.balanceOf(address(this)) < payout + accumulatedFees) revert InsolventPayout();

            USDC.safeTransfer(msg.sender, payout);
            position.totalClaimed += payout;

            emit RewardsClaimed(batchId, msg.sender, payout);
        }
        // If newBalance <= oldBalance, losses are recorded (balance decreased), no payout
    }

    function withdraw(
        uint256 batchId,
        uint256 finalBalance,
        bytes calldata blsSignature
    ) external nonReentrant {
        PlayerPosition storage position = _positions[batchId][msg.sender];
        if (position.stakePerTick == 0) revert NotJoined();

        // BLS verify: issuers sign the final balance for withdrawal
        bytes32 message = keccak256(abi.encode(
            block.chainid,
            address(this),
            "WITHDRAW",
            batchId,
            msg.sender,
            finalBalance
        ));
        _verifyBLS(message, blsSignature);

        // Fee on profit only
        uint256 totalDeposited = position.totalDeposited;
        uint256 profit = finalBalance > totalDeposited ? finalBalance - totalDeposited : 0;
        uint256 fee = (profit * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
        uint256 payout = finalBalance - fee;

        accumulatedFees += fee;

        // Solvency check
        if (USDC.balanceOf(address(this)) < payout + accumulatedFees) revert InsolventPayout();

        USDC.safeTransfer(msg.sender, payout);

        // Delete position
        delete _positions[batchId][msg.sender];

        emit PlayerWithdrawn(batchId, msg.sender, payout);
    }

    function getPosition(uint256 batchId, address player) external view returns (PlayerPosition memory) {
        return _positions[batchId][player];
    }

    // ============ BOT REGISTRY ============

    function registerBot(string calldata endpoint, bytes32 pubkeyHash) external nonReentrant {
        if (_bots[msg.sender].isActive || _botIndex[msg.sender] != 0) revert BotAlreadyRegistered();

        _bots[msg.sender] = Bot({
            endpoint: endpoint,
            pubkeyHash: pubkeyHash,
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

        // Swap-and-pop removal from _botAddresses
        uint256 idx = _botIndex[msg.sender] - 1; // convert to 0-based
        address lastBot = _botAddresses[_botAddresses.length - 1];
        _botAddresses[idx] = lastBot;
        _botIndex[lastBot] = idx + 1; // update moved bot's 1-indexed position
        _botAddresses.pop();
        delete _botIndex[msg.sender];
        delete _bots[msg.sender];

        emit BotDeregistered(msg.sender);
    }

    function getAllActiveBots() external view returns (address[] memory, Bot[] memory) {
        uint256 len = _botAddresses.length;
        Bot[] memory bots = new Bot[](len);
        for (uint256 i = 0; i < len; i++) {
            bots[i] = _bots[_botAddresses[i]];
        }
        return (_botAddresses, bots);
    }

    // ============ FEE MANAGEMENT ============

    function collectFees() external nonReentrant {
        if (msg.sender != feeCollector) revert Unauthorized();

        uint256 fees = accumulatedFees;
        accumulatedFees = 0;

        USDC.safeTransfer(feeCollector, fees);
    }

    // ============ ISSUER OPERATIONS ============

    function pause(uint256 batchId, bytes calldata blsSignature) external {
        Batch storage batch = _batches[batchId];
        if (batch.creator == address(0)) revert BatchNotFound();

        bytes32 message = keccak256(abi.encode(
            block.chainid,
            address(this),
            "PAUSE",
            batchId
        ));
        _verifyBLS(message, blsSignature);

        batch.paused = true;

        emit BatchPausedEvent(batchId);
    }

    function unpause(uint256 batchId, bytes calldata blsSignature) external {
        Batch storage batch = _batches[batchId];
        if (batch.creator == address(0)) revert BatchNotFound();

        bytes32 message = keccak256(abi.encode(
            block.chainid,
            address(this),
            "UNPAUSE",
            batchId
        ));
        _verifyBLS(message, blsSignature);

        batch.paused = false;

        emit BatchUnpaused(batchId);
    }

    function forceWithdraw(
        uint256 batchId,
        address player,
        uint256 finalBalance,
        bytes calldata blsSignature
    ) external nonReentrant {
        PlayerPosition storage position = _positions[batchId][player];
        if (position.stakePerTick == 0) revert NotJoined();

        bytes32 message = keccak256(abi.encode(
            block.chainid,
            address(this),
            "FORCE_WITHDRAW",
            batchId,
            player,
            finalBalance
        ));
        _verifyBLS(message, blsSignature);

        // Fee on profit only
        uint256 totalDeposited = position.totalDeposited;
        uint256 profit = finalBalance > totalDeposited ? finalBalance - totalDeposited : 0;
        uint256 fee = (profit * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
        uint256 payout = finalBalance - fee;

        accumulatedFees += fee;

        // Solvency check
        if (USDC.balanceOf(address(this)) < payout + accumulatedFees) revert InsolventPayout();

        // Delete position before transfer (CEI pattern)
        delete _positions[batchId][player];

        USDC.safeTransfer(player, payout);

        emit ForceWithdrawn(batchId, player, payout);
    }
}
