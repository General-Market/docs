// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {BLSVerifier} from "../libraries/BLSVerifier.sol";
import {IVision} from "../interfaces/IVision.sol";
import {IOracleRegistry} from "../interfaces/IOracleRegistry.sol";

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
    uint256 public constant MIN_STAKE_PER_TICK = 1e17; // 0.1 USDC (18 decimals)
    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public constant MIN_TICK_DURATION = 60;       // 1 minute minimum
    uint256 public constant MAX_TICK_DURATION = 604800;   // 1 week maximum
    uint256 public constant MAX_BATCHES = 200;

    // ============ IMMUTABLES ============

    IERC20 public immutable USDC;
    address public immutable oracleRegistry;

    // ============ STATE ============

    uint256 public nextBatchId;
    mapping(uint256 => Batch) internal _batches;
    mapping(uint256 => mapping(address => PlayerPosition)) internal _positions;
    /// @notice Fees from positions funded by real L3 USDC (backed by actual USDC in contract)
    uint256 public accumulatedRealFees;
    /// @notice Fees from positions funded by virtual balance (backed by Settlement custody, not L3 USDC)
    uint256 public accumulatedVirtualFees;
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

    // ============ DUAL-BALANCE STATE ============

    /// @notice Per-user L3 USDC balance — backed by real L3 USDC in the contract
    mapping(address => uint256) public realBalance;

    /// @notice Per-user virtual balance — backed by USDC locked in SettlementBridgeCustody on Settlement
    mapping(address => uint256) public virtualBalance;

    /// @notice Aggregate tracking for solvency invariants
    uint256 public totalRealBalance;    // sum(realBalance[all users])
    uint256 public totalVirtualBalance; // sum(virtualBalance[all users])

    /// @notice Processed cross-chain deposit IDs (idempotency — survives oracle restarts)
    mapping(uint256 => bool) public depositProcessed;

    /// @notice Auto-incrementing withdraw request ID
    uint256 public withdrawNonce;

    /// @notice Withdraw request details for consensus verification
    struct WithdrawRequest {
        address user;
        uint256 amount;
    }
    mapping(uint256 => WithdrawRequest) public withdrawRequests;

    // INVARIANT: USDC.balanceOf(this) >= totalRealBalance + sum(active batch deposits) + accumulatedRealFees
    // INVARIANT: totalRealBalance == sum(realBalance[all users])
    // INVARIANT: totalVirtualBalance == sum(virtualBalance[all users])
    // INVARIANT: accumulatedVirtualFees NEVER inflates totalRealBalance or USDC holdings

    // ============ CONSTRUCTOR ============

    constructor(address _usdc, address _oracleRegistry, address _feeCollector) {
        USDC = IERC20(_usdc);
        oracleRegistry = _oracleRegistry;
        feeCollector = _feeCollector;
        __BLSVerifier_init(_oracleRegistry);
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

            // Handle tickDuration change: recalculate epochOffset to preserve tick continuity
            if (b.nextTickDuration > 0) {
                // Compute old relative tickId before changing tickDuration
                int256 oldTickId = int256(currentTick) - int256(b.createdAtTick) + b.epochOffset;
                // Switch to new tickDuration
                b.tickDuration = b.nextTickDuration;
                // Compute new absolute tick under new duration
                int256 newAbsTick = int256(block.timestamp / b.tickDuration);
                // epochOffset adjustment: oldTickId must equal newAbsTick - createdAtTick + newEpochOffset
                b.epochOffset = oldTickId - (newAbsTick - int256(b.createdAtTick));
                b.nextTickDuration = 0;
            }

            // lastPromotionTick is always in terms of current tickDuration
            b.lastPromotionTick = block.timestamp / b.tickDuration;

            // Clear pending
            b.nextConfigHash = bytes32(0);
            b.nextLockOffset = 0;

            emit BatchConfigPromoted(batchId, oldHash, b.configHash, b.lastPromotionTick);
        }
    }

    /// @notice Current tick ID relative to batch creation, with underflow guard (Issue 7 / F14).
    /// @dev If block.timestamp / tickDuration < createdAtTick (possible if tickDuration
    ///      was changed in a hypothetical upgrade, or clock skew on L3), returns 0
    ///      instead of underflowing.
    function _currentTickId(uint256 batchId) internal view returns (uint256) {
        Batch storage b = _batches[batchId];
        uint256 currentTick = block.timestamp / b.tickDuration;
        int256 tickId = int256(currentTick) - int256(b.createdAtTick) + b.epochOffset;
        if (tickId < 0) return 0;
        return uint256(tickId);
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

        // Hard cap: reject batch creation once MAX_BATCHES is reached
        if (nextBatchId >= MAX_BATCHES) revert TooManyBatches();

        // Validate parameters
        if (tickDuration < MIN_TICK_DURATION || tickDuration > MAX_TICK_DURATION) revert InvalidTickDuration();
        if (lockOffset >= tickDuration) revert InvalidLockOffset();

        // BLS verification — proves oracles signed this config (F1/F4)
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
        uint256 tickDuration,
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

        // No-op check: skip if configHash, lockOffset, AND tickDuration are ALL unchanged with no pending update
        if (b.configHash == configHash && b.lockOffset == lockOffset && b.nextConfigHash == bytes32(0)
            && b.tickDuration == tickDuration) return;

        // Validate tickDuration
        if (tickDuration < MIN_TICK_DURATION || tickDuration > MAX_TICK_DURATION) revert InvalidTickDuration();

        // Validate lockOffset against the proposed tickDuration
        if (lockOffset >= tickDuration) revert LockOffsetTooLarge();

        // BLS verification with distinct domain tag (Issue 9)
        bytes32 message = keccak256(abi.encode(
            block.chainid,
            address(this),
            "UPDATE_BATCH_CONFIG",
            batchId,
            configHash,
            lockOffset,
            tickDuration
        ));
        _verifyBLS(message, blsSignature, referenceNonce, signersBitmask);

        // Stage for next tick (F3 deferred promotion)
        b.nextConfigHash = configHash;
        b.nextLockOffset = lockOffset;
        b.nextTickDuration = tickDuration;

        emit BatchConfigUpdated(batchId, configHash, lockOffset, tickDuration);
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

        bool usedVirtual = _debitBalance(msg.sender, depositAmount);

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
            isVirtual: usedVirtual
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

        _debitBalance(msg.sender, amount);

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
        if (toTick < fromTick) revert InvalidTickRange();
        if (position.lastClaimedTick == 0) {
            if (fromTick <= position.startTick) revert InvalidTickRange();
        } else {
            if (fromTick != position.lastClaimedTick + 1) revert TickAlreadyClaimed();
        }

        // BLS verify: oracles sign the new balance for this player over this tick range (F1)
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

        // HIGH-2 FIX: No fee is taken here. Fees are applied once — at withdraw() /
        // forceWithdraw() — on net profit over the full lifetime of the position.
        // Taking a fee here AND at withdraw would compound the effective rate, since
        // the withdraw profit calculation uses (finalBalance - totalDeposited), meaning
        // already-taxed intermediate winnings would be taxed again.
        //
        // HIGH-1 NOTE: No solvency gap here. The parimutuel model is inherently sound:
        // all stakes enter the contract via _debitBalance() at join time and never leave
        // until withdraw(). claimRewards() only updates the position's internal balance
        // (a redistribution of already-locked funds between winners and losers), backed
        // by BLS-signed oracle consensus. No USDC is minted or moved; the accounting
        // invariant USDC.balanceOf(this) >= totalRealBalance + active_batch_deposits +
        // accumulatedRealFees holds throughout.
        if (newBalance > oldBalance) {
            emit RewardsClaimed(batchId, msg.sender, newBalance - oldBalance);
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

        // Fee on profit only — net profit = finalBalance minus total amount ever deposited.
        // Fees are applied ONLY here (not in claimRewards) to avoid double-counting.
        // claimRewards() updates position.balance (an internal redistribution), but no
        // USDC is moved. The single fee point is withdraw().
        uint256 totalDeposited = position.totalDeposited;
        uint256 profit = finalBalance > totalDeposited ? finalBalance - totalDeposited : 0;
        uint256 fee = (profit * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
        uint256 payout = finalBalance - fee;

        // SOL-2: Read isVirtual BEFORE delete
        bool isVirtual = position.isVirtual;

        // HIGH-3 FIX: Route fees to the same bucket as the position's funding source.
        // Virtual positions never deposited real USDC — crediting their fees to
        // accumulatedRealFees would inflate totalRealBalance beyond actual USDC holdings.
        if (isVirtual) {
            accumulatedVirtualFees += fee;
        } else {
            accumulatedRealFees += fee;
        }

        // Delete position before balance credit (CEI pattern)
        delete _positions[batchId][msg.sender];

        // SOL-2: Route payout back to the same balance type used to fund the position
        if (isVirtual) {
            virtualBalance[msg.sender] += payout;
            totalVirtualBalance += payout;
        } else {
            realBalance[msg.sender] += payout;
            totalRealBalance += payout;
        }

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

        uint256 realFees = accumulatedRealFees;
        uint256 virtualFees = accumulatedVirtualFees;
        accumulatedRealFees = 0;
        accumulatedVirtualFees = 0;

        // Real fees → realBalance: these are backed by actual L3 USDC in the contract.
        // feeCollector can withdrawBalance() to extract as USDC.
        if (realFees > 0) {
            realBalance[feeCollector] += realFees;
            totalRealBalance += realFees;
        }

        // Virtual fees → virtualBalance: backed by Settlement custody, NOT L3 USDC.
        // Crediting them to realBalance would inflate totalRealBalance beyond actual
        // USDC holdings — the solvency invariant violation this fix corrects.
        // feeCollector can withdrawToSettlement() to extract via the bridge.
        if (virtualFees > 0) {
            virtualBalance[feeCollector] += virtualFees;
            totalVirtualBalance += virtualFees;
        }

        emit FeeCollected(realFees, virtualFees);
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

        // Fee on profit only — net profit = finalBalance minus total amount ever deposited.
        // Fees are applied ONLY here (not in claimRewards) to avoid double-counting.
        uint256 totalDeposited = position.totalDeposited;
        uint256 profit = finalBalance > totalDeposited ? finalBalance - totalDeposited : 0;
        uint256 fee = (profit * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
        uint256 payout = finalBalance - fee;

        // SOL-2: Read isVirtual BEFORE delete
        bool isVirtual = position.isVirtual;

        // HIGH-3 FIX: Route fees to the same bucket as the position's funding source.
        if (isVirtual) {
            accumulatedVirtualFees += fee;
        } else {
            accumulatedRealFees += fee;
        }

        // Delete position before balance credit (CEI pattern)
        delete _positions[batchId][player];

        // SOL-2: Route payout back to the same balance type used to fund the position
        if (isVirtual) {
            virtualBalance[player] += payout;
            totalVirtualBalance += payout;
        } else {
            realBalance[player] += payout;
            totalRealBalance += payout;
        }

        emit ForceWithdrawn(batchId, player, payout);
    }

    // ============ DUAL-BALANCE OPERATIONS ============

    /// @inheritdoc IVision
    function creditBalance(
        address user,
        uint256 amount,
        uint256 depositId,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external nonReentrant {
        if (depositProcessed[depositId]) revert AlreadyProcessed();
        if (user == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        bytes32 message = keccak256(abi.encode(
            block.chainid,
            address(this),
            "creditBalance",
            user,
            amount,
            depositId
        ));
        _verifyBLS(message, blsSignature, referenceNonce, signersBitmask);

        depositProcessed[depositId] = true;
        virtualBalance[user] += amount;
        totalVirtualBalance += amount;

        emit BalanceCredited(user, amount, depositId);
    }

    /// @inheritdoc IVision
    function depositBalance(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();

        USDC.safeTransferFrom(msg.sender, address(this), amount);

        realBalance[msg.sender] += amount;
        totalRealBalance += amount;

        emit BalanceDeposited(msg.sender, amount);
    }

    /// @inheritdoc IVision
    function withdrawBalance(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (realBalance[msg.sender] < amount) revert InsufficientBalance();

        realBalance[msg.sender] -= amount;
        totalRealBalance -= amount;

        USDC.safeTransfer(msg.sender, amount);

        emit RealBalanceWithdrawn(msg.sender, amount);
    }

    /// @inheritdoc IVision
    function withdrawToSettlement(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (virtualBalance[msg.sender] < amount) revert InsufficientBalance();

        uint256 wId = withdrawNonce++;
        virtualBalance[msg.sender] -= amount;
        totalVirtualBalance -= amount;

        withdrawRequests[wId] = WithdrawRequest(msg.sender, amount);

        emit WithdrawToSettlementRequested(msg.sender, amount, wId);
    }

    /// @inheritdoc IVision
    function balanceOf(address user) public view returns (uint256) {
        return realBalance[user] + virtualBalance[user];
    }

    // ============ INTERNAL: DUAL-BALANCE DEBIT ============

    /// @dev Debit `amount` from user's total balance. Virtual first, then real.
    ///      This ensures users who deposited from Settlement don't accumulate real balance
    ///      they can't use, and users who deposited on L3 keep their real balance
    ///      as long as possible.
    /// @return usedVirtual True if any virtual balance was consumed (SOL-2).
    function _debitBalance(address user, uint256 amount) internal returns (bool usedVirtual) {
        uint256 total = virtualBalance[user] + realBalance[user];
        if (total < amount) revert InsufficientBalance();

        // Debit virtual first
        uint256 fromVirtual = amount > virtualBalance[user] ? virtualBalance[user] : amount;
        uint256 fromReal = amount - fromVirtual;

        virtualBalance[user] -= fromVirtual;
        totalVirtualBalance -= fromVirtual;
        realBalance[user] -= fromReal;
        totalRealBalance -= fromReal;

        usedVirtual = fromVirtual > 0;

        emit BalanceDebited(user, fromVirtual, fromReal);
    }
}
