// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IVision — Round-based prediction market interface
/// @notice Each batch = one round. Direct USDC in via joinBatchDirect(),
///         direct USDC out via settleBatch(). No persistent balance, no ticks.
/// @dev BLS replay protection uses the EXISTING 256-nonce sliding window in
///      BLSVerifier (referenceNonce + signersBitmask). No second nonce mechanism.
interface IVision {

    // ============ STRUCTS ============

    /// @notice On-chain batch — all market detail lives off-chain, only the config
    ///         hash is stored. One config per batch lifetime (no promotion).
    /// @dev `settlementGrace` is the window after the tick ends during which the
    ///      oracle may still call `settleBatch`. Past it, settlement is permanently
    ///      illegal and players can call `claimRefund` to retrieve their deposit.
    ///      The protocol gives up the right to be late.
    struct Batch {
        address creator;                 // first user who created the batch
        bytes32 sourceId;                // keccak256(source_id_string)
        bytes32 configHash;              // config hash (keccak256 of ABI-encoded config)
        uint256 tickDuration;            // seconds per tick (used for lock window)
        uint256 lockOffset;              // lock window (seconds before tick end)
        uint256 settlementGrace;         // seconds after tick end before refund opens
        uint256 createdAtTick;           // block.timestamp / tickDuration at creation
        bool paused;
        bool settled;
    }

    /// @notice Player position within a batch.
    /// @dev Sentinel: totalDeposited != 0 means player is joined.
    struct PlayerPosition {
        bytes32 bitmapHash;              // keccak256 of the player's bitmap
        bytes32 configHash;              // config hash active when bitmap was last set
        uint256 joinTimestamp;
        uint256 totalDeposited;          // USDC deposited for this round
    }

    struct Bot {
        string endpoint;
        bytes32 pubkeyHash;
        uint256 registeredAt;
        bool isActive;
    }

    // ============ CUSTOM ERRORS ============

    error BatchNotFound();
    error BatchPaused();
    error Unauthorized();
    error DepositBelowMinimum();
    error AlreadyJoined();
    error NotJoined();
    error InvalidTickDuration();
    error InvalidLockOffset();
    error LockOffsetTooLarge();
    error InvalidSettlementGrace();
    error NonZeroSum();
    error BotAlreadyRegistered();
    error BotNotRegistered();
    error TickLocked();
    error InvalidBLSSignature();
    error InvalidArrayLength();
    error BatchAlreadySettled();
    error SettlementWindowClosed();
    error NotYetRefundable();

    // ============ EVENTS ============

    event BatchCreated(
        uint256 indexed batchId,
        bytes32 indexed sourceId,
        address indexed creator,
        bytes32 configHash,
        uint256 tickDuration,
        uint256 lockOffset,
        uint256 settlementGrace
    );

    event BatchPausedEvent(uint256 indexed batchId);
    event BatchUnpaused(uint256 indexed batchId);

    /// @notice Emitted when a player joins a batch.
    /// @dev `deposit` is the full USDC amount transferred from the player. The
    ///      parameter name is preserved for ABI/indexer compatibility but no
    ///      longer represents a per-tick stake — there are no ticks.
    event PlayerJoined(
        uint256 indexed batchId,
        address indexed player,
        uint256 deposit,
        bytes32 bitmapHash,
        bytes32 configHash
    );

    event BitmapUpdated(
        uint256 indexed batchId,
        address indexed player,
        bytes32 newBitmapHash,
        bytes32 configHash
    );

    event PlayerSettled(uint256 indexed batchId, address indexed player, uint256 payout, uint256 fee);
    event BatchSettled(uint256 indexed batchId, uint256 playerCount);

    /// @notice Emitted when a player retrieves their deposit after the oracle
    ///         failed to settle within the grace window. No fee taken — the
    ///         protocol earned nothing if it didn't deliver.
    event PlayerRefunded(uint256 indexed batchId, address indexed player, uint256 amount);

    event BotRegistered(address indexed bot, string endpoint);
    event BotDeregistered(address indexed bot);
    event FeeCollectorUpdated(address indexed oldCollector, address indexed newCollector);
    event FeeCollected(uint256 amount);

    // ============ BATCH MANAGEMENT ============

    /// @notice Create a new batch for a sourceId.
    /// @param settlementGrace seconds after the tick ends during which the oracle
    ///        may still settle. After it, refund opens. Must be in
    ///        [MIN_SETTLEMENT_GRACE, MAX_SETTLEMENT_GRACE].
    function createBatch(
        bytes32 sourceId,
        bytes32 configHash,
        uint256 tickDuration,
        uint256 lockOffset,
        uint256 settlementGrace,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external returns (uint256 batchId);

    function getBatch(uint256 batchId) external view returns (Batch memory);

    /// @notice Look up batchId by sourceId
    function getBatchIdBySourceId(bytes32 sourceId) external view returns (uint256);

    /// @notice Get current tick ID for a batch, with underflow guard
    function currentTickId(uint256 batchId) external view returns (uint256);

    // ============ PLAYER OPERATIONS ============

    /// @notice Join a batch via direct USDC transfer from player wallet.
    /// @param batchId        the batch to join
    /// @param configHash     active configHash the player's bitmap is built against
    /// @param depositAmount  USDC amount to deposit (transferred from player wallet)
    /// @param bitmapHash     keccak256 of the player's prediction bitmap
    function joinBatchDirect(
        uint256 batchId,
        bytes32 configHash,
        uint256 depositAmount,
        bytes32 bitmapHash
    ) external;

    /// @notice Update prediction bitmap. Enforces lock window.
    function updateBitmap(
        uint256 batchId,
        bytes32 configHash,
        bytes32 newBitmapHash
    ) external;

    function getPosition(uint256 batchId, address player) external view returns (PlayerPosition memory);

    // ============ BOT REGISTRY ============

    function registerBot(string calldata endpoint, bytes32 pubkeyHash) external;
    function deregisterBot() external;
    function getAllActiveBots() external view returns (address[] memory, Bot[] memory);

    // ============ FEE MANAGEMENT ============

    function collectFees() external;

    /// @notice Pending fees (backed by L3 USDC in contract)
    function accumulatedRealFees() external view returns (uint256);

    function updateFeeCollector(
        address newCollector,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external;

    // ============ ORACLE OPERATIONS ============

    function pause(
        uint256 batchId,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external;

    function unpause(
        uint256 batchId,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external;

    /// @notice Settle an entire batch in one transaction (round-based flow).
    ///         USDC is transferred directly to player wallets.
    /// @dev Reverts with `SettlementWindowClosed` if called past the
    ///      batch's `endsAt + settlementGrace`. The oracle has lost the
    ///      right to decide; the refund window is now open.
    function settleBatch(
        uint256 batchId,
        address[] calldata players,
        uint256[] calldata payouts,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external;

    /// @notice Single-aggregated-BLS bundle. One signature covers all batches.
    /// @dev Oracles co-sign `keccak256(chainid, vision, "SETTLE_BATCHES_SINGLE_V1",
    ///      batchIds, payoutsHashes)`. Saves N× BLS verification gas vs
    ///      `settleBatches`.
    function settleBatchesSingle(
        uint256[] calldata batchIds,
        address[][] calldata players,
        uint256[][] calldata payouts,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external;

    /// @notice Bundle of `settleBatch` calls in one transaction.
    /// @dev Each sub-settlement keeps its own BLS signature, reference nonce, and
    ///      signers bitmask. Reverts on the first sub-failure — chunking is the
    ///      caller's responsibility. One reentrancy guard covers the bundle.
    function settleBatches(
        uint256[] calldata batchIds,
        address[][] calldata players,
        uint256[][] calldata payouts,
        bytes[] calldata blsSignatures,
        uint256[] calldata referenceNonces,
        uint256[] calldata signersBitmasks
    ) external;

    /// @notice Timestamp after which the batch's settlement window closes and
    ///         deposits become refundable. Equals `(createdAtTick + 1) *
    ///         tickDuration + settlementGrace`.
    function batchExpirationTime(uint256 batchId) external view returns (uint256);

    /// @notice Retrieve your own deposit if the oracle never settled the batch.
    ///         Callable only after `block.timestamp >= batchExpirationTime`.
    function claimRefund(uint256 batchId) external;

    /// @notice Permissionless variant — anyone can fund the gas to refund a
    ///         specific player. The USDC always goes to `player`. Lets a vault
    ///         keeper rescue stuck deposits without the vault contract paying gas.
    function claimRefundFor(uint256 batchId, address player) external;
}
