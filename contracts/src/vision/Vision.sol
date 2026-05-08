// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {BLSVerifier} from "../libraries/BLSVerifier.sol";
import {IVision} from "../interfaces/IVision.sol";
import {IOracleRegistry} from "../interfaces/IOracleRegistry.sol";

/// @title Vision — Round-based prediction market
/// @notice Each batch = one round. Direct USDC in via joinBatchDirect(),
///         direct USDC out via settleBatch(). No persistent balance, no ticks.
/// @custom:security-contact security@indexprotocol.com
contract Vision is IVision, ReentrancyGuard, BLSVerifier {
    using SafeERC20 for IERC20;

    // ============ CONSTANTS ============

    uint256 public constant PROTOCOL_FEE_BPS = 5; // 0.05%
    uint256 public constant MIN_DEPOSIT = 1e17; // 0.1 USDC (18 decimals)
    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public constant MIN_TICK_DURATION = 60;       // 1 minute minimum
    uint256 public constant MAX_TICK_DURATION = 604800;   // 1 week maximum
    uint256 public constant MIN_SETTLEMENT_GRACE = 60;    // 1 minute — the oracle gets at least one block of slack
    uint256 public constant MAX_SETTLEMENT_GRACE = 86400; // 24 hours — past this, the protocol is hostage-taking

    // ============ IMMUTABLES ============

    IERC20 public immutable USDC;
    address public immutable oracleRegistry;

    // ============ STATE ============

    uint256 public nextBatchId;
    mapping(uint256 => Batch) internal _batches;
    mapping(uint256 => mapping(address => PlayerPosition)) internal _positions;
    /// @notice Fees backed by actual L3 USDC in the contract
    uint256 public accumulatedRealFees;
    address public feeCollector;

    /// @notice sourceId => latest batchId (reverse lookup for the most recent batch)
    mapping(bytes32 => uint256) public latestBatchForSource;

    // Bot registry state
    mapping(address => Bot) internal _bots;
    address[] internal _botAddresses;
    mapping(address => uint256) internal _botIndex;

    // ============ CONSTRUCTOR ============

    constructor(address _usdc, address _oracleRegistry, address _feeCollector) {
        USDC = IERC20(_usdc);
        oracleRegistry = _oracleRegistry;
        feeCollector = _feeCollector;
        __BLSVerifier_init(_oracleRegistry);
    }

    // ============ CRITICAL INTERNALS ============

    /// @notice Current tick ID relative to batch creation, with underflow guard.
    function _currentTickId(uint256 batchId) internal view returns (uint256) {
        Batch storage b = _batches[batchId];
        uint256 currentTick = block.timestamp / b.tickDuration;
        if (currentTick < b.createdAtTick) return 0;
        return currentTick - b.createdAtTick;
    }

    /// @notice Revert if the batch is in its lock window.
    function _requireNotLocked(uint256 batchId) internal view {
        Batch storage b = _batches[batchId];
        if (b.lockOffset == 0) return;

        uint256 currentAbsoluteTick = block.timestamp / b.tickDuration;
        uint256 tickEnd = (currentAbsoluteTick + 1) * b.tickDuration;

        if (block.timestamp >= tickEnd - b.lockOffset) {
            revert TickLocked();
        }
    }

    /// @notice Revert if batch does not exist.
    function _requireBatchExists(uint256 batchId) internal view {
        if (_batches[batchId].tickDuration == 0) revert BatchNotFound();
    }

    /// @notice Expiration timestamp — after this, settlement is illegal and
    ///         refund is open. Anchored to the tick the batch belongs to, plus
    ///         the per-batch grace window.
    function _expirationTime(Batch storage b) internal view returns (uint256) {
        return (b.createdAtTick + 1) * b.tickDuration + b.settlementGrace;
    }

    // ============ BATCH MANAGEMENT ============

    /// @inheritdoc IVision
    function createBatch(
        bytes32 sourceId,
        bytes32 configHash,
        uint256 tickDuration,
        uint256 lockOffset,
        uint256 settlementGrace,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external returns (uint256 batchId) {
        return _createBatch(
            sourceId, configHash, tickDuration, lockOffset, settlementGrace,
            blsSignature, referenceNonce, signersBitmask
        );
    }

    /// @notice Internal batch creation.
    function _createBatch(
        bytes32 sourceId,
        bytes32 configHash,
        uint256 tickDuration,
        uint256 lockOffset,
        uint256 settlementGrace,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) internal returns (uint256 batchId) {
        if (tickDuration < MIN_TICK_DURATION || tickDuration > MAX_TICK_DURATION) revert InvalidTickDuration();
        if (lockOffset >= tickDuration) revert InvalidLockOffset();
        if (settlementGrace < MIN_SETTLEMENT_GRACE || settlementGrace > MAX_SETTLEMENT_GRACE) {
            revert InvalidSettlementGrace();
        }

        bytes32 message = keccak256(abi.encode(
            block.chainid,
            address(this),
            "CREATE_BATCH",
            sourceId,
            configHash,
            tickDuration,
            lockOffset,
            settlementGrace
        ));
        _verifyBLS(message, blsSignature, referenceNonce, signersBitmask);

        batchId = nextBatchId;
        nextBatchId = batchId + 1;

        Batch storage b = _batches[batchId];
        b.creator = msg.sender;
        b.sourceId = sourceId;
        b.configHash = configHash;
        b.tickDuration = tickDuration;
        b.lockOffset = lockOffset;
        b.settlementGrace = settlementGrace;
        b.createdAtTick = block.timestamp / tickDuration;
        b.paused = false;

        latestBatchForSource[sourceId] = batchId;

        emit BatchCreated(batchId, sourceId, msg.sender, configHash, tickDuration, lockOffset, settlementGrace);
    }

    /// @inheritdoc IVision
    function getBatch(uint256 batchId) external view returns (Batch memory) {
        return _batches[batchId];
    }

    /// @inheritdoc IVision
    function getBatchIdBySourceId(bytes32 sourceId) external view returns (uint256) {
        uint256 batchId = latestBatchForSource[sourceId];
        if (batchId == 0 && _batches[0].sourceId != sourceId) revert BatchNotFound();
        return batchId;
    }

    /// @inheritdoc IVision
    function currentTickId(uint256 batchId) external view returns (uint256) {
        _requireBatchExists(batchId);
        return _currentTickId(batchId);
    }

    // ============ PLAYER OPERATIONS ============

    /// @inheritdoc IVision
    function joinBatchDirect(
        uint256 batchId,
        bytes32 configHash,
        uint256 depositAmount,
        bytes32 bitmapHash
    ) external nonReentrant {
        _requireBatchExists(batchId);
        Batch storage b = _batches[batchId];
        if (b.paused) revert BatchPaused();

        _requireNotLocked(batchId);

        if (b.configHash != configHash) revert BatchNotFound();

        if (_positions[batchId][msg.sender].totalDeposited != 0) revert AlreadyJoined();
        if (depositAmount < MIN_DEPOSIT) revert DepositBelowMinimum();

        // Transfer USDC directly from player wallet
        USDC.safeTransferFrom(msg.sender, address(this), depositAmount);

        _positions[batchId][msg.sender] = PlayerPosition({
            bitmapHash: bitmapHash,
            configHash: configHash,
            joinTimestamp: block.timestamp,
            totalDeposited: depositAmount
        });

        emit PlayerJoined(batchId, msg.sender, depositAmount, bitmapHash, configHash);
    }

    /// @inheritdoc IVision
    function updateBitmap(
        uint256 batchId,
        bytes32 configHash,
        bytes32 newBitmapHash
    ) external {
        if (_positions[batchId][msg.sender].totalDeposited == 0) revert NotJoined();

        _requireNotLocked(batchId);

        Batch storage b = _batches[batchId];
        if (b.configHash != configHash) revert BatchNotFound();

        _positions[batchId][msg.sender].bitmapHash = newBitmapHash;
        _positions[batchId][msg.sender].configHash = configHash;

        emit BitmapUpdated(batchId, msg.sender, newBitmapHash, configHash);
    }

    /// @inheritdoc IVision
    function getPosition(uint256 batchId, address player) external view returns (PlayerPosition memory) {
        return _positions[batchId][player];
    }

    // ============ BOT REGISTRY ============

    /// @inheritdoc IVision
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

    /// @inheritdoc IVision
    function deregisterBot() external nonReentrant {
        Bot storage bot = _bots[msg.sender];
        if (!bot.isActive) revert BotNotRegistered();

        uint256 idx = _botIndex[msg.sender] - 1;
        address lastBot = _botAddresses[_botAddresses.length - 1];
        _botAddresses[idx] = lastBot;
        _botIndex[lastBot] = idx + 1;
        _botAddresses.pop();
        delete _botIndex[msg.sender];
        delete _bots[msg.sender];

        emit BotDeregistered(msg.sender);
    }

    /// @inheritdoc IVision
    function getAllActiveBots() external view returns (address[] memory, Bot[] memory) {
        uint256 len = _botAddresses.length;
        Bot[] memory bots = new Bot[](len);
        for (uint256 i = 0; i < len; i++) {
            bots[i] = _bots[_botAddresses[i]];
        }
        return (_botAddresses, bots);
    }

    // ============ FEE MANAGEMENT ============

    /// @inheritdoc IVision
    function collectFees() external nonReentrant {
        if (msg.sender != feeCollector) revert Unauthorized();

        uint256 fees = accumulatedRealFees;
        accumulatedRealFees = 0;

        if (fees > 0) {
            USDC.safeTransfer(feeCollector, fees);
        }

        emit FeeCollected(fees);
    }

    /// @inheritdoc IVision
    function updateFeeCollector(
        address newCollector,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external {
        if (newCollector == address(0)) revert Unauthorized();
        bytes32 message = keccak256(abi.encode(
            block.chainid, address(this), "UPDATE_FEE_COLLECTOR", newCollector
        ));
        _verifyBLS(message, blsSignature, referenceNonce, signersBitmask);
        address old = feeCollector;
        feeCollector = newCollector;
        emit FeeCollectorUpdated(old, newCollector);
    }

    // ============ ORACLE OPERATIONS ============

    /// @inheritdoc IVision
    function pause(
        uint256 batchId,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external {
        _requireBatchExists(batchId);

        bytes32 message = keccak256(abi.encode(
            block.chainid,
            address(this),
            "PAUSE",
            batchId
        ));
        _verifyBLS(message, blsSignature, referenceNonce, signersBitmask);

        _batches[batchId].paused = true;

        emit BatchPausedEvent(batchId);
    }

    /// @inheritdoc IVision
    function unpause(
        uint256 batchId,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external {
        _requireBatchExists(batchId);

        bytes32 message = keccak256(abi.encode(
            block.chainid,
            address(this),
            "UNPAUSE",
            batchId
        ));
        _verifyBLS(message, blsSignature, referenceNonce, signersBitmask);

        _batches[batchId].paused = false;

        emit BatchUnpaused(batchId);
    }

    /// @inheritdoc IVision
    /// @dev Direct USDC transfer to player wallets. No dual-balance routing.
    function settleBatch(
        uint256 batchId,
        address[] calldata players,
        uint256[] calldata payouts,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external nonReentrant {
        Batch storage b = _batches[batchId];
        if (b.tickDuration == 0) revert BatchNotFound();
        if (b.settled) revert BatchAlreadySettled();
        // Hard cliff: once the grace window has passed, settlement is illegal.
        // The refund window is now open and the oracle has lost the right to decide.
        if (block.timestamp >= _expirationTime(b)) revert SettlementWindowClosed();
        if (players.length != payouts.length) revert InvalidArrayLength();
        if (players.length == 0) revert InvalidArrayLength();

        // Single BLS check for entire batch
        bytes32 payoutsHash = keccak256(abi.encode(players, payouts));
        bytes32 message = keccak256(abi.encode(
            block.chainid,
            address(this),
            "SETTLE_BATCH",
            batchId,
            payoutsHash
        ));
        _verifyBLS(message, blsSignature, referenceNonce, signersBitmask);

        // Pass 1: validate solvency, verify all players exist, enforce no duplicates
        uint256 totalPayouts;
        uint256 totalDeposits;
        for (uint256 i = 0; i < players.length; i++) {
            if (i > 0 && uint160(players[i]) <= uint160(players[i - 1])) revert InvalidArrayLength();
            PlayerPosition storage pos = _positions[batchId][players[i]];
            if (pos.totalDeposited == 0) revert NotJoined();
            totalPayouts += payouts[i];
            totalDeposits += pos.totalDeposited;
        }
        if (totalPayouts != totalDeposits) revert NonZeroSum();

        // Pass 2: settle each player — transfer USDC directly
        for (uint256 i = 0; i < players.length; i++) {
            PlayerPosition storage pos = _positions[batchId][players[i]];

            uint256 payout = payouts[i];
            uint256 profit = payout > pos.totalDeposited ? payout - pos.totalDeposited : 0;
            uint256 fee = (profit * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
            uint256 netPayout = payout - fee;

            // Delete position (CEI)
            delete _positions[batchId][players[i]];

            // Accumulate fees
            accumulatedRealFees += fee;

            // Direct transfer to player wallet
            if (netPayout > 0) {
                USDC.safeTransfer(players[i], netPayout);
            }

            emit PlayerSettled(batchId, players[i], netPayout, fee);
        }

        b.settled = true;
        emit BatchSettled(batchId, players.length);
    }

    // ============ REFUND PATH ============

    /// @inheritdoc IVision
    function batchExpirationTime(uint256 batchId) external view returns (uint256) {
        _requireBatchExists(batchId);
        return _expirationTime(_batches[batchId]);
    }

    /// @inheritdoc IVision
    function claimRefund(uint256 batchId) external nonReentrant {
        _claimRefund(batchId, msg.sender);
    }

    /// @inheritdoc IVision
    function claimRefundFor(uint256 batchId, address player) external nonReentrant {
        _claimRefund(batchId, player);
    }

    /// @notice Per-player refund. Funds always go to `player`, regardless of caller.
    ///         No protocol fee — the protocol earned nothing if it didn't deliver.
    function _claimRefund(uint256 batchId, address player) internal {
        Batch storage b = _batches[batchId];
        if (b.tickDuration == 0) revert BatchNotFound();
        if (b.settled) revert BatchAlreadySettled();
        if (block.timestamp < _expirationTime(b)) revert NotYetRefundable();

        PlayerPosition storage pos = _positions[batchId][player];
        uint256 amount = pos.totalDeposited;
        if (amount == 0) revert NotJoined();

        // CEI: clear position before transfer. The deletion is the per-player
        // sentinel that prevents double-refund and reentrancy at once.
        delete _positions[batchId][player];

        USDC.safeTransfer(player, amount);

        emit PlayerRefunded(batchId, player, amount);
    }
}
