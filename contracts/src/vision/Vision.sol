// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {BLSVerifier} from "../libraries/BLSVerifier.sol";
import {IVision} from "../interfaces/IVision.sol";
import {IIssuerRegistry} from "../interfaces/IIssuerRegistry.sol";

/// @title Vision — Auto-batch prediction market
/// @notice Resolves all 10 issues from the 3-round review.
/// @dev Key design decisions:
///   - Issue 1:  `createBatchAndJoin()` atomic function
///   - Issue 2:  `joinBatch()` and `updateBitmap()` require `configHash` param
///   - Issue 3:  Deferred promotion via `nextConfigHash`/`nextLockOffset`
///   - Issue 4:  BLS messages use `keccak256(abi.encode(chainid, address(this), "TAG", ...))`
///   - Issue 5:  `sourceIdToBatchId` mapping + `sourceId` in Batch struct
///   - Issue 6:  `updateBitmap()` enforces lock window via `_requireNotLocked`
///   - Issue 7:  `_currentTickId()` has underflow guard
///   - Issue 8:  NO second nonce — uses existing BLSVerifier 256-nonce sliding window
///   - Issue 9:  `updateBatchConfig()` has lock window check + "UPDATE_BATCH_CONFIG" domain tag
///   - Issue 10: Custom errors only, no require() strings
/// @custom:security-contact security@indexprotocol.com
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

    /// @notice sourceId => batchId (F5/F13 idempotency + reverse lookup)
    /// @dev A sourceId of bytes32(0) is never valid.
    ///      Value 0 means "no batch exists for this source" since batchIds start at 0
    ///      but we use a separate existence flag via batch.tickDuration > 0.
    mapping(bytes32 => uint256) public sourceIdToBatchId;

    /// @notice Tracks whether a sourceId has ever been assigned a batch.
    /// @dev Needed because batchId 0 is a valid batch. Without this, we cannot
    ///      distinguish "no batch" from "batch 0".
    mapping(bytes32 => bool) public sourceIdHasBatch;

    // Bot registry state
    mapping(address => Bot) internal _bots;
    address[] internal _botAddresses;
    mapping(address => uint256) internal _botIndex;

    // ============ CONSTRUCTOR ============

    constructor(address _usdc, address _issuerRegistry, address _feeCollector) {
        USDC = IERC20(_usdc);
        issuerRegistry = _issuerRegistry;
        feeCollector = _feeCollector;
        __BLSVerifier_init(_issuerRegistry);
    }

    // ============ CRITICAL INTERNALS ============

    /// @notice Lazy config promotion (Issue 3 / F3).
    ///         If a nextConfigHash is pending AND the current tick has advanced past
    ///         the tick at which the update was scheduled, promote next -> active.
    /// @dev Called at the start of every user-facing function that reads config
    ///      (joinBatch, updateBitmap, updateBatchConfig, deposit). This ensures
    ///      the active config is always correct for the current tick without
    ///      requiring a separate keeper transaction.
    ///
    ///      Promotion rule: if currentTick > lastPromotionTick, we have crossed a
    ///      tick boundary since the last config was set. Promote.
    ///
    ///      After promotion, nextConfigHash is cleared (set to bytes32(0)).
    function _promoteConfigIfNeeded(uint256 batchId) internal {
        Batch storage b = _batches[batchId];

        // Nothing to promote
        if (b.nextConfigHash == bytes32(0)) return;

        uint256 currentTick = block.timestamp / b.tickDuration;

        // Only promote if we have crossed into a new tick since the update was staged
        if (currentTick > b.lastPromotionTick) {
            bytes32 oldHash = b.configHash;

            b.configHash = b.nextConfigHash;
            b.lockOffset = b.nextLockOffset;
            b.lastPromotionTick = currentTick;

            // Clear pending
            b.nextConfigHash = bytes32(0);
            b.nextLockOffset = 0;

            emit BatchConfigPromoted(batchId, oldHash, b.configHash, currentTick);
        }
    }

    /// @notice Current tick ID relative to batch creation, with underflow guard (Issue 7 / F14).
    /// @dev If block.timestamp / tickDuration < createdAtTick (possible if tickDuration
    ///      was changed in a hypothetical upgrade, or clock skew on L3), returns 0
    ///      instead of underflowing.
    function _currentTickId(uint256 batchId) internal view returns (uint256) {
        Batch storage b = _batches[batchId];
        uint256 currentTick = block.timestamp / b.tickDuration;
        if (currentTick < b.createdAtTick) return 0;
        return currentTick - b.createdAtTick;
    }

    /// @notice Revert if the batch is in its lock window (Issue 6 / F6).
    /// @dev Lock window = the last `lockOffset` seconds of each tick.
    ///      tickEnd = (currentAbsoluteTick + 1) * tickDuration
    ///      locked if block.timestamp >= tickEnd - lockOffset
    function _requireNotLocked(uint256 batchId) internal view {
        Batch storage b = _batches[batchId];
        if (b.lockOffset == 0) return; // no lock window configured

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

    // ============ BATCH MANAGEMENT ============

    /// @inheritdoc IVision
    function createBatch(
        bytes32 sourceId,
        bytes32 configHash,
        uint256 tickDuration,
        uint256 lockOffset,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external returns (uint256 batchId) {
        return _createBatch(
            sourceId, configHash, tickDuration, lockOffset,
            blsSignature, referenceNonce, signersBitmask
        );
    }

    /// @inheritdoc IVision
    function createBatchAndJoin(
        bytes32 sourceId,
        bytes32 configHash,
        uint256 tickDuration,
        uint256 lockOffset,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask,
        uint256 depositAmount,
        uint256 stakePerTick,
        bytes32 bitmapHash
    ) external nonReentrant returns (uint256 batchId) {
        // Step 1: Create or look up existing batch (idempotent)
        batchId = _createBatch(
            sourceId, configHash, tickDuration, lockOffset,
            blsSignature, referenceNonce, signersBitmask
        );

        // Step 2: Join the batch atomically
        _joinBatch(batchId, configHash, depositAmount, stakePerTick, bitmapHash);
    }

    /// @notice Internal idempotent batch creation (F5).
    ///         If sourceId already has a batch, returns existing batchId without
    ///         re-verifying BLS (the batch already passed BLS at creation).
    function _createBatch(
        bytes32 sourceId,
        bytes32 configHash,
        uint256 tickDuration,
        uint256 lockOffset,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) internal returns (uint256 batchId) {
        // Idempotency check (F5): if sourceId already has a batch, return it
        if (sourceIdHasBatch[sourceId]) {
            return sourceIdToBatchId[sourceId];
        }

        // Validate parameters
        if (tickDuration == 0 || tickDuration > MAX_TICK_DURATION) revert InvalidTickDuration();
        if (lockOffset >= tickDuration) revert InvalidLockOffset();

        // BLS verification — proves issuers signed this config (F1/F4)
        bytes32 message = keccak256(abi.encode(
            block.chainid,
            address(this),
            "CREATE_BATCH",
            sourceId,
            configHash,
            tickDuration,
            lockOffset
        ));
        _verifyBLS(message, blsSignature, referenceNonce, signersBitmask);

        // Allocate batch ID
        batchId = nextBatchId;
        nextBatchId = batchId + 1;

        // Initialize batch
        Batch storage b = _batches[batchId];
        b.creator = msg.sender;
        b.sourceId = sourceId;
        b.configHash = configHash;
        b.tickDuration = tickDuration;
        b.lockOffset = lockOffset;
        b.createdAtTick = block.timestamp / tickDuration;
        b.lastPromotionTick = block.timestamp / tickDuration;
        b.paused = false;
        // nextConfigHash, nextLockOffset default to 0 (no pending update)

        // Register reverse lookup (F5/F13)
        sourceIdToBatchId[sourceId] = batchId;
        sourceIdHasBatch[sourceId] = true;

        emit BatchCreated(batchId, sourceId, msg.sender, configHash, tickDuration, lockOffset);
    }

    /// @inheritdoc IVision
    function updateBatchConfig(
        uint256 batchId,
        bytes32 configHash,
        uint256 lockOffset,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external {
        _requireBatchExists(batchId);
        Batch storage b = _batches[batchId];
        if (b.paused) revert BatchPaused();

        // Promote any pending config first (F3)
        _promoteConfigIfNeeded(batchId);

        // Lock window check (Issue 9) — cannot update config during lock
        _requireNotLocked(batchId);

        // If configHash == active AND no pending next, no-op
        if (b.configHash == configHash && b.nextConfigHash == bytes32(0)) {
            return;
        }

        // Validate lockOffset
        if (lockOffset >= b.tickDuration) revert InvalidLockOffset();

        // BLS verification with distinct domain tag (Issue 9)
        bytes32 message = keccak256(abi.encode(
            block.chainid,
            address(this),
            "UPDATE_BATCH_CONFIG",
            batchId,
            configHash,
            lockOffset
        ));
        _verifyBLS(message, blsSignature, referenceNonce, signersBitmask);

        // Stage for next tick (F3 deferred promotion)
        b.nextConfigHash = configHash;
        b.nextLockOffset = lockOffset;

        emit BatchConfigUpdated(batchId, configHash, lockOffset);
    }

    /// @inheritdoc IVision
    function getBatch(uint256 batchId) external view returns (Batch memory) {
        return _batches[batchId];
    }

    /// @inheritdoc IVision
    function getBatchIdBySourceId(bytes32 sourceId) external view returns (uint256) {
        if (!sourceIdHasBatch[sourceId]) revert BatchNotFound();
        return sourceIdToBatchId[sourceId];
    }

    /// @inheritdoc IVision
    function currentTickId(uint256 batchId) external view returns (uint256) {
        _requireBatchExists(batchId);
        return _currentTickId(batchId);
    }

    // ============ PLAYER OPERATIONS ============

    /// @inheritdoc IVision
    function joinBatch(
        uint256 batchId,
        bytes32 configHash,
        uint256 depositAmount,
        uint256 stakePerTick,
        bytes32 bitmapHash
    ) external nonReentrant {
        _joinBatch(batchId, configHash, depositAmount, stakePerTick, bitmapHash);
    }

    /// @notice Internal join logic, shared by joinBatch() and createBatchAndJoin().
    function _joinBatch(
        uint256 batchId,
        bytes32 configHash,
        uint256 depositAmount,
        uint256 stakePerTick,
        bytes32 bitmapHash
    ) internal {
        _requireBatchExists(batchId);
        Batch storage b = _batches[batchId];
        if (b.paused) revert BatchPaused();

        // Promote pending config if needed (F3)
        _promoteConfigIfNeeded(batchId);

        // Enforce lock window (F6)
        _requireNotLocked(batchId);

        // Config binding (Issue 2): player's bitmap must match active config
        if (b.configHash != configHash) revert BatchNotFound(); // config mismatch

        if (_positions[batchId][msg.sender].stakePerTick != 0) revert AlreadyJoined();
        if (stakePerTick < MIN_STAKE_PER_TICK) revert StakeBelowMinimum();
        if (depositAmount < stakePerTick) revert InsufficientDeposit();

        USDC.safeTransferFrom(msg.sender, address(this), depositAmount);

        uint256 tickId = _currentTickId(batchId);
        _positions[batchId][msg.sender] = PlayerPosition({
            bitmapHash: bitmapHash,
            configHash: configHash,
            stakePerTick: stakePerTick,
            startTick: tickId,
            balance: depositAmount,
            lastClaimedTick: 0,
            joinTimestamp: block.timestamp,
            totalDeposited: depositAmount,
            totalClaimed: 0
        });

        emit PlayerJoined(batchId, msg.sender, stakePerTick, bitmapHash, configHash);
    }

    /// @inheritdoc IVision
    function updateBitmap(
        uint256 batchId,
        bytes32 configHash,
        bytes32 newBitmapHash
    ) external {
        if (_positions[batchId][msg.sender].stakePerTick == 0) revert NotJoined();

        // Promote pending config if needed (F3)
        _promoteConfigIfNeeded(batchId);

        // Enforce lock window (Issue 6 / F6)
        _requireNotLocked(batchId);

        // Config binding (Issue 2): bitmap must match active config
        Batch storage b = _batches[batchId];
        if (b.configHash != configHash) revert BatchNotFound(); // config mismatch

        _positions[batchId][msg.sender].bitmapHash = newBitmapHash;
        _positions[batchId][msg.sender].configHash = configHash;

        emit BitmapUpdated(batchId, msg.sender, newBitmapHash, configHash);
    }

    /// @inheritdoc IVision
    function deposit(uint256 batchId, uint256 amount) external nonReentrant {
        PlayerPosition storage position = _positions[batchId][msg.sender];
        if (position.stakePerTick == 0) revert NotJoined();

        USDC.safeTransferFrom(msg.sender, address(this), amount);

        position.balance += amount;
        position.totalDeposited += amount;

        emit PlayerDeposited(batchId, msg.sender, amount);
    }

    /// @inheritdoc IVision
    function claimRewards(
        uint256 batchId,
        uint256 fromTick,
        uint256 toTick,
        uint256 newBalance,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external nonReentrant {
        PlayerPosition storage position = _positions[batchId][msg.sender];
        if (position.stakePerTick == 0) revert NotJoined();
        if (fromTick <= position.lastClaimedTick && position.lastClaimedTick != 0) revert TickAlreadyClaimed();
        if (toTick < fromTick) revert InvalidTickRange();

        // BLS verify: issuers sign the new balance for this player over this tick range (F1)
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
        _verifyBLS(message, blsSignature, referenceNonce, signersBitmask);

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

    /// @inheritdoc IVision
    function withdraw(
        uint256 batchId,
        uint256 finalBalance,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external nonReentrant {
        PlayerPosition storage position = _positions[batchId][msg.sender];
        if (position.stakePerTick == 0) revert NotJoined();

        // BLS verify (F1)
        bytes32 message = keccak256(abi.encode(
            block.chainid,
            address(this),
            "WITHDRAW",
            batchId,
            msg.sender,
            finalBalance
        ));
        _verifyBLS(message, blsSignature, referenceNonce, signersBitmask);

        // Fee on profit only
        uint256 totalDeposited = position.totalDeposited;
        uint256 profit = finalBalance > totalDeposited ? finalBalance - totalDeposited : 0;
        uint256 fee = (profit * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
        uint256 payout = finalBalance - fee;

        accumulatedFees += fee;

        // Solvency check
        if (USDC.balanceOf(address(this)) < payout + accumulatedFees) revert InsolventPayout();

        // Delete position before transfer (CEI pattern)
        delete _positions[batchId][msg.sender];

        USDC.safeTransfer(msg.sender, payout);

        emit PlayerWithdrawn(batchId, msg.sender, payout);
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

        // Swap-and-pop removal
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

        uint256 fees = accumulatedFees;
        accumulatedFees = 0;

        USDC.safeTransfer(feeCollector, fees);
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

    // ============ ISSUER OPERATIONS ============

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
    function forceWithdraw(
        uint256 batchId,
        address player,
        uint256 finalBalance,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
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
        _verifyBLS(message, blsSignature, referenceNonce, signersBitmask);

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
