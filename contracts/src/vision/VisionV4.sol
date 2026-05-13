// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

import {BLSVerifier} from "../libraries/BLSVerifier.sol";
import {ErrorsLib} from "../libraries/ErrorsLib.sol";
import {IVision} from "../interfaces/IVision.sol";

/// @title VisionV4 — UUPS-upgradeable round-based prediction market
/// @notice Functionally identical to Vision v3, but lives behind an ERC1967
///         proxy with a BLS-governed upgrade lifecycle copied from
///         `SettlementBridgeCustody`. Future changes ship as a 30-second
///         `upgradeTo`, never another cutover ceremony.
/// @dev Storage layout extends v3 with upgrade-management fields appended at
///      the tail, followed by a 50-slot `__gap`. Constructor disables
///      initializers on the implementation; the proxy calls `initialize`.
/// @custom:security-contact security@indexprotocol.com
contract VisionV4 is
    IVision,
    Initializable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable,
    BLSVerifier
{
    using SafeERC20 for IERC20;

    // ============ CONSTANTS ============

    uint256 public constant PROTOCOL_FEE_BPS = 5; // 0.05%
    uint256 public constant MIN_DEPOSIT = 1e17; // 0.1 USDC (18 decimals)
    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public constant MIN_TICK_DURATION = 60;       // 1 minute minimum
    uint256 public constant MAX_TICK_DURATION = 604800;   // 1 week maximum
    uint256 public constant MIN_SETTLEMENT_GRACE = 60;    // 1 minute — the oracle gets at least one block of slack
    uint256 public constant MAX_SETTLEMENT_GRACE = 86400; // 24 hours — past this, the protocol is hostage-taking

    /// @notice Standard upgrade timelock — matches SettlementBridgeCustody.
    uint256 public constant UPGRADE_TIMELOCK = 7 days;

    /// @notice Emergency upgrade timelock — matches SettlementBridgeCustody.
    uint256 public constant EMERGENCY_UPGRADE_TIMELOCK = 24 hours;

    // ============ STATE (v3-equivalent — NO LONGER immutable) ============

    /// @notice USDC token contract. Set at `initialize`; no longer immutable.
    IERC20 public USDC;

    /// @notice Reference to OracleRegistry. Set at `initialize`; no longer immutable.
    address public oracleRegistry;

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

    // ============ STATE (UUPS upgrade lifecycle) ============

    /// @notice Pending upgrade implementation address
    address public pendingUpgradeImpl;

    /// @notice Pending upgrade proposal timestamp
    uint256 public pendingUpgradeProposedAt;

    /// @notice Whether the pending upgrade is emergency (24h) or standard (7d)
    bool public pendingUpgradeIsEmergency;

    /// @notice Storage gap for future upgrades
    uint256[50] private __gap;

    // ============ CONSTRUCTOR / INITIALIZER ============

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initialize the VisionV4 proxy.
    /// @param _usdc           USDC token address (18 decimals on L3)
    /// @param _oracleRegistry OracleRegistry providing BLS snapshots
    /// @param _feeCollector   Fee collector address
    function initialize(
        address _usdc,
        address _oracleRegistry,
        address _feeCollector
    ) external initializer {
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        __BLSVerifier_init(_oracleRegistry);

        USDC = IERC20(_usdc);
        oracleRegistry = _oracleRegistry;
        feeCollector = _feeCollector;
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
        _settleOne(batchId, players, payouts, blsSignature, referenceNonce, signersBitmask);
    }

    /// @inheritdoc IVision
    /// @dev Single-aggregated-BLS bundle. One signature covers the whole
    ///      bundle: all oracles co-sign `keccak256(chainid, vision,
    ///      "SETTLE_BATCHES_SINGLE_V1", batchIds, payoutsHashes)`. Saves
    ///      ~100k gas × N compared to `settleBatches`, which verifies each
    ///      sub-item separately. The caller bears responsibility for chunking
    ///      by block gas.
    function settleBatchesSingle(
        uint256[] calldata batchIds,
        address[][] calldata players,
        uint256[][] calldata payouts,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external nonReentrant {
        uint256 n = batchIds.length;
        if (n == 0) revert InvalidArrayLength();
        if (players.length != n || payouts.length != n) revert InvalidArrayLength();

        bytes32[] memory payoutsHashes = new bytes32[](n);
        for (uint256 i = 0; i < n; ++i) {
            payoutsHashes[i] = keccak256(abi.encode(players[i], payouts[i]));
        }
        bytes32 message = keccak256(abi.encode(
            block.chainid,
            address(this),
            "SETTLE_BATCHES_SINGLE_V1",
            batchIds,
            payoutsHashes
        ));
        _verifyBLS(message, blsSignature, referenceNonce, signersBitmask);

        for (uint256 i = 0; i < n; ++i) {
            _settleOneSkipBls(batchIds[i], players[i], payouts[i]);
        }
    }

    /// @notice Single-batch body without BLS verification. Used by the
    ///         single-aggregated-BLS bundle path where one signature covers
    ///         the whole bundle. NEVER call from an external entry without
    ///         verifying a bundle signature first.
    function _settleOneSkipBls(
        uint256 batchId,
        address[] calldata players,
        uint256[] calldata payouts
    ) internal {
        Batch storage b = _batches[batchId];
        if (b.tickDuration == 0) revert BatchNotFound();
        if (b.settled) revert BatchAlreadySettled();
        if (block.timestamp >= _expirationTime(b)) revert SettlementWindowClosed();
        if (players.length != payouts.length) revert InvalidArrayLength();
        if (players.length == 0) revert InvalidArrayLength();

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

        for (uint256 i = 0; i < players.length; i++) {
            PlayerPosition storage pos = _positions[batchId][players[i]];

            uint256 payout = payouts[i];
            uint256 profit = payout > pos.totalDeposited ? payout - pos.totalDeposited : 0;
            uint256 fee = (profit * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
            uint256 netPayout = payout - fee;

            delete _positions[batchId][players[i]];
            accumulatedRealFees += fee;
            if (netPayout > 0) {
                USDC.safeTransfer(players[i], netPayout);
            }
            emit PlayerSettled(batchId, players[i], netPayout, fee);
        }

        b.settled = true;
        emit BatchSettled(batchId, players.length);
    }

    /// @inheritdoc IVision
    /// @dev Bundles N settlements into one transaction. Each sub-settlement keeps
    ///      its own BLS signature, refNonce, and signersBitmask — consensus is
    ///      unchanged. The caller bears responsibility for chunking by block gas.
    ///      One `nonReentrant` covers the whole bundle; sub-calls go through the
    ///      same `_settleOne` path as `settleBatch`.
    function settleBatches(
        uint256[] calldata batchIds,
        address[][] calldata players,
        uint256[][] calldata payouts,
        bytes[] calldata blsSignatures,
        uint256[] calldata referenceNonces,
        uint256[] calldata signersBitmasks
    ) external nonReentrant {
        uint256 n = batchIds.length;
        if (n == 0) revert InvalidArrayLength();
        if (
            players.length != n
            || payouts.length != n
            || blsSignatures.length != n
            || referenceNonces.length != n
            || signersBitmasks.length != n
        ) revert InvalidArrayLength();

        for (uint256 i = 0; i < n; ++i) {
            _settleOne(
                batchIds[i],
                players[i],
                payouts[i],
                blsSignatures[i],
                referenceNonces[i],
                signersBitmasks[i]
            );
        }
    }

    /// @notice Single-batch settle body. Verifies BLS once, validates solvency,
    ///         transfers USDC, deletes positions. Shared by `settleBatch` and
    ///         `settleBatches`. The outer entry holds the reentrancy guard.
    function _settleOne(
        uint256 batchId,
        address[] calldata players,
        uint256[] calldata payouts,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) internal {
        Batch storage b = _batches[batchId];
        if (b.tickDuration == 0) revert BatchNotFound();
        if (b.settled) revert BatchAlreadySettled();
        // Hard cliff: once the grace window has passed, settlement is illegal.
        // The refund window is now open and the oracle has lost the right to decide.
        if (block.timestamp >= _expirationTime(b)) revert SettlementWindowClosed();
        if (players.length != payouts.length) revert InvalidArrayLength();
        if (players.length == 0) revert InvalidArrayLength();

        bytes32 payoutsHash = keccak256(abi.encode(players, payouts));
        bytes32 message = keccak256(abi.encode(
            block.chainid,
            address(this),
            "SETTLE_BATCH",
            batchId,
            payoutsHash
        ));
        _verifyBLS(message, blsSignature, referenceNonce, signersBitmask);

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

        for (uint256 i = 0; i < players.length; i++) {
            PlayerPosition storage pos = _positions[batchId][players[i]];

            uint256 payout = payouts[i];
            uint256 profit = payout > pos.totalDeposited ? payout - pos.totalDeposited : 0;
            uint256 fee = (profit * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
            uint256 netPayout = payout - fee;

            delete _positions[batchId][players[i]];

            accumulatedRealFees += fee;

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

    // ============ UPGRADE MANAGEMENT ============

    /// @notice Propose a standard upgrade (7-day timelock).
    /// @param newImpl New implementation address
    /// @param blsSignature BLS signature from oracles
    function proposeUpgrade(
        address newImpl,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external {
        if (newImpl == address(0)) {
            revert ErrorsLib.E038_ZeroImplementation();
        }
        if (pendingUpgradeImpl != address(0)) {
            revert ErrorsLib.E039_UpgradeAlreadyPending();
        }

        bytes32 message = keccak256(abi.encode(block.chainid, address(this), "proposeUpgrade", newImpl));
        _verifyBLS(message, blsSignature, referenceNonce, signersBitmask);

        pendingUpgradeImpl = newImpl;
        pendingUpgradeProposedAt = block.timestamp;
        pendingUpgradeIsEmergency = false;
    }

    /// @notice Propose an emergency upgrade (24-hour timelock).
    /// @dev Emergency-threshold semantics live inside BLSVerifier; this layer
    ///      only domain-separates via the message string.
    function proposeEmergencyUpgrade(
        address newImpl,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external {
        if (newImpl == address(0)) {
            revert ErrorsLib.E038_ZeroImplementation();
        }
        if (pendingUpgradeImpl != address(0)) {
            revert ErrorsLib.E039_UpgradeAlreadyPending();
        }

        bytes32 message = keccak256(abi.encode(block.chainid, address(this), "proposeEmergencyUpgrade", newImpl));
        _verifyBLS(message, blsSignature, referenceNonce, signersBitmask);

        pendingUpgradeImpl = newImpl;
        pendingUpgradeProposedAt = block.timestamp;
        pendingUpgradeIsEmergency = true;
    }

    /// @notice Execute a pending upgrade after its timelock has expired.
    /// @param newImpl Implementation address to upgrade to (must match pending)
    function executeUpgrade(address newImpl) external {
        if (pendingUpgradeImpl == address(0)) {
            revert ErrorsLib.E040_NoPendingUpgrade();
        }
        if (pendingUpgradeImpl != newImpl) {
            revert ErrorsLib.E041_ImplementationMismatch(pendingUpgradeImpl, newImpl);
        }

        uint256 timelock = pendingUpgradeIsEmergency ? EMERGENCY_UPGRADE_TIMELOCK : UPGRADE_TIMELOCK;
        uint256 unlockTime = pendingUpgradeProposedAt + timelock;
        if (block.timestamp < unlockTime) {
            revert ErrorsLib.E042_UpgradeTimelockActive(unlockTime, block.timestamp);
        }

        upgradeToAndCall(newImpl, "");

        pendingUpgradeImpl = address(0);
        pendingUpgradeProposedAt = 0;
        pendingUpgradeIsEmergency = false;
    }

    /// @notice Cancel a pending upgrade.
    function cancelUpgrade(
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external {
        if (pendingUpgradeImpl == address(0)) {
            revert ErrorsLib.E040_NoPendingUpgrade();
        }

        bytes32 message = keccak256(abi.encode(block.chainid, address(this), "cancelUpgrade", pendingUpgradeImpl));
        _verifyBLS(message, blsSignature, referenceNonce, signersBitmask);

        pendingUpgradeImpl = address(0);
        pendingUpgradeProposedAt = 0;
        pendingUpgradeIsEmergency = false;
    }

    /// @notice Get pending upgrade details.
    function getPendingUpgrade()
        external
        view
        returns (address proposedImpl, uint256 proposedAt, bool isEmergency)
    {
        return (pendingUpgradeImpl, pendingUpgradeProposedAt, pendingUpgradeIsEmergency);
    }

    // ============ INTERNAL FUNCTIONS ============

    /// @notice Authorize upgrade (UUPS pattern).
    /// @dev Refuses any upgrade not previously proposed and past its timelock.
    function _authorizeUpgrade(address newImplementation) internal view override {
        if (pendingUpgradeImpl != newImplementation) {
            revert ErrorsLib.E041_ImplementationMismatch(pendingUpgradeImpl, newImplementation);
        }
        uint256 timelock = pendingUpgradeIsEmergency ? EMERGENCY_UPGRADE_TIMELOCK : UPGRADE_TIMELOCK;
        uint256 unlockTime = pendingUpgradeProposedAt + timelock;
        if (block.timestamp < unlockTime) {
            revert ErrorsLib.E042_UpgradeTimelockActive(unlockTime, block.timestamp);
        }
    }
}
