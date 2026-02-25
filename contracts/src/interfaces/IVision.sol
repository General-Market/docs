// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IVision — Auto-batch prediction market interface
/// @notice Resolves issues 1-10 from the 3-round review. Hash-based batches with
///         deferred config promotion, lock windows, sourceId idempotency, and
///         atomic createBatchAndJoin.
/// @dev BLS replay protection uses the EXISTING 256-nonce sliding window in
///      BLSVerifier (referenceNonce + signersBitmask). No second nonce mechanism.
interface IVision {

    // ============ ENUMS ============

    enum ResolutionType { UP_0, UP_30, UP_X, DOWN_0, DOWN_30, DOWN_X, FLAT_0, FLAT_X }

    // ============ STRUCTS ============

    /// @notice On-chain batch — all market detail lives off-chain, only the config
    ///         hash is stored. Config promotion is deferred: `updateBatchConfig()`
    ///         writes to `nextConfigHash`/`nextLockOffset`; at the next tick boundary,
    ///         `_promoteConfigIfNeeded()` copies next -> active.
    struct Batch {
        address creator;                 // first user who created the batch
        bytes32 sourceId;                // keccak256(source_id_string) — F13
        bytes32 configHash;              // active config hash (keccak256 of ABI-encoded config)
        bytes32 nextConfigHash;          // pending config hash for next tick — F3
        uint256 tickDuration;            // seconds per tick
        uint256 lockOffset;              // active lock window (seconds before tick end)
        uint256 nextLockOffset;          // pending lock offset for next tick — F3
        uint256 createdAtTick;           // block.timestamp / tickDuration at creation
        uint256 lastPromotionTick;       // tick at which config was last promoted — F3
        bool paused;
    }

    /// @notice Player position within a batch.
    /// @dev `configHash` records which config the player's bitmap was submitted against (F21).
    struct PlayerPosition {
        bytes32 bitmapHash;              // keccak256 of the player's bitmap
        bytes32 configHash;              // config hash active when bitmap was last set — F21
        uint256 stakePerTick;
        uint256 startTick;
        uint256 balance;
        uint256 lastClaimedTick;
        uint256 joinTimestamp;
        uint256 totalDeposited;
        uint256 totalClaimed;
    }

    struct Bot {
        string endpoint;
        bytes32 pubkeyHash;
        uint256 registeredAt;
        bool isActive;
    }

    // ============ CUSTOM ERRORS (Issue 10) ============

    error BatchNotFound();
    error BatchPaused();
    error BatchAlreadyExists();          // sourceId already has a batch — F5
    error Unauthorized();
    error InsufficientDeposit();
    error StakeBelowMinimum();
    error AlreadyJoined();
    error NotJoined();
    error TickAlreadyClaimed();
    error InvalidTickRange();
    error InvalidTickDuration();
    error InvalidLockOffset();           // lockOffset >= tickDuration
    error InsolventPayout();
    error BotAlreadyRegistered();
    error BotNotRegistered();
    error TickLocked();                  // bet/update during lock window — F6
    error InvalidBLSSignature();         // kept for backwards compat event decoding

    // ============ EVENTS ============

    /// @param sourceId keccak256(source_id_string) for reverse lookup
    event BatchCreated(
        uint256 indexed batchId,
        bytes32 indexed sourceId,
        address indexed creator,
        bytes32 configHash,
        uint256 tickDuration,
        uint256 lockOffset
    );

    event BatchConfigUpdated(
        uint256 indexed batchId,
        bytes32 nextConfigHash,
        uint256 nextLockOffset
    );

    event BatchConfigPromoted(
        uint256 indexed batchId,
        bytes32 oldConfigHash,
        bytes32 newConfigHash,
        uint256 atTick
    );

    event BatchPausedEvent(uint256 indexed batchId);
    event BatchUnpaused(uint256 indexed batchId);

    event PlayerJoined(
        uint256 indexed batchId,
        address indexed player,
        uint256 stakePerTick,
        bytes32 bitmapHash,
        bytes32 configHash                // which config the bitmap targets
    );

    event PlayerDeposited(uint256 indexed batchId, address indexed player, uint256 amount);

    event BitmapUpdated(
        uint256 indexed batchId,
        address indexed player,
        bytes32 newBitmapHash,
        bytes32 configHash                // which config the bitmap targets
    );

    event RewardsClaimed(uint256 indexed batchId, address indexed player, uint256 amount);
    event PlayerWithdrawn(uint256 indexed batchId, address indexed player, uint256 amount);
    event ForceWithdrawn(uint256 indexed batchId, address indexed player, uint256 amount);

    event BotRegistered(address indexed bot, string endpoint);
    event BotDeregistered(address indexed bot);
    event FeeCollectorUpdated(address indexed oldCollector, address indexed newCollector);

    // ============ BATCH MANAGEMENT ============

    /// @notice Create a new batch for a sourceId. Idempotent: if sourceId already has
    ///         a batch, returns the existing batchId without reverting (F5).
    /// @dev BLS message = keccak256(abi.encode(
    ///        block.chainid, address(this), "CREATE_BATCH",
    ///        sourceId, configHash, tickDuration, lockOffset
    ///      ))
    ///      Uses existing BLSVerifier nonce window — no separate nonce (F25/Issue 8).
    /// @param sourceId       keccak256(source_id_string)
    /// @param configHash     keccak256 of ABI-encoded batch config (F2)
    /// @param tickDuration   seconds per tick
    /// @param lockOffset     seconds before tick end where betting closes
    /// @param blsSignature   aggregated BLS signature
    /// @param referenceNonce BLSVerifier snapshot nonce
    /// @param signersBitmask bitmask of signing issuers
    /// @return batchId       the batch ID (new or existing)
    function createBatch(
        bytes32 sourceId,
        bytes32 configHash,
        uint256 tickDuration,
        uint256 lockOffset,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external returns (uint256 batchId);

    /// @notice Atomic create-or-lookup + join (Issue 1).
    ///         Solves the problem that callers cannot read return values from
    ///         state-changing transactions. This combines createBatch (idempotent)
    ///         and joinBatch into a single atomic transaction.
    /// @dev If sourceId already has a batch, skips creation. Then joins.
    ///      BLS signature covers the CREATE_BATCH domain tag (same as createBatch).
    /// @param sourceId       keccak256(source_id_string)
    /// @param configHash     keccak256 of ABI-encoded batch config
    /// @param tickDuration   seconds per tick
    /// @param lockOffset     seconds before tick end
    /// @param blsSignature   aggregated BLS signature (over create params)
    /// @param referenceNonce BLSVerifier snapshot nonce
    /// @param signersBitmask bitmask of signing issuers
    /// @param depositAmount  USDC amount to deposit
    /// @param stakePerTick   USDC staked per tick
    /// @param bitmapHash     keccak256 of the player's prediction bitmap
    /// @return batchId       the batch ID (new or existing)
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
    ) external returns (uint256 batchId);

    /// @notice Update a batch's config hash. Takes effect NEXT tick (F3 deferred
    ///         promotion). Writes to nextConfigHash/nextLockOffset; promotion happens
    ///         lazily via _promoteConfigIfNeeded().
    /// @dev BLS message = keccak256(abi.encode(
    ///        block.chainid, address(this), "UPDATE_BATCH_CONFIG",
    ///        batchId, configHash, lockOffset
    ///      ))
    ///      Distinct domain tag from CREATE_BATCH (Issue 9).
    ///      Enforces lock window check (Issue 9) -- cannot update config during lock.
    ///      If configHash == batch.configHash AND no pending next, no-op without revert.
    function updateBatchConfig(
        uint256 batchId,
        bytes32 configHash,
        uint256 lockOffset,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external;

    function getBatch(uint256 batchId) external view returns (Batch memory);

    /// @notice Look up batchId by sourceId (F13/F23)
    function getBatchIdBySourceId(bytes32 sourceId) external view returns (uint256);

    /// @notice Get current tick ID for a batch, with underflow guard (F14)
    function currentTickId(uint256 batchId) external view returns (uint256);

    // ============ PLAYER OPERATIONS ============

    /// @notice Join an existing batch. Enforces lock window (F6).
    /// @dev configHash param binds the bitmap to the active config (Issue 2/F21).
    ///      Triggers _promoteConfigIfNeeded() before checking lock window.
    /// @param batchId        the batch to join
    /// @param configHash     active configHash the player's bitmap is built against
    /// @param depositAmount  USDC amount to deposit
    /// @param stakePerTick   USDC staked per tick
    /// @param bitmapHash     keccak256 of the player's prediction bitmap
    function joinBatch(
        uint256 batchId,
        bytes32 configHash,
        uint256 depositAmount,
        uint256 stakePerTick,
        bytes32 bitmapHash
    ) external;

    /// @notice Update prediction bitmap. Enforces lock window (Issue 6/F6).
    /// @dev configHash param binds the new bitmap to the active config (Issue 2).
    ///      Triggers _promoteConfigIfNeeded() before checking lock window.
    function updateBitmap(
        uint256 batchId,
        bytes32 configHash,
        bytes32 newBitmapHash
    ) external;

    function deposit(uint256 batchId, uint256 amount) external;

    function claimRewards(
        uint256 batchId,
        uint256 fromTick,
        uint256 toTick,
        uint256 newBalance,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external;

    function withdraw(
        uint256 batchId,
        uint256 finalBalance,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external;

    function getPosition(uint256 batchId, address player) external view returns (PlayerPosition memory);

    // ============ BOT REGISTRY ============

    function registerBot(string calldata endpoint, bytes32 pubkeyHash) external;
    function deregisterBot() external;
    function getAllActiveBots() external view returns (address[] memory, Bot[] memory);

    // ============ FEE MANAGEMENT ============

    function collectFees() external;
    function updateFeeCollector(
        address newCollector,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external;

    // ============ ISSUER OPERATIONS ============

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

    function forceWithdraw(
        uint256 batchId,
        address player,
        uint256 finalBalance,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external;
}
