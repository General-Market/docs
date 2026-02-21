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
        uint256 createdAtTick;
        bool paused;
    }

    struct PlayerPosition {
        bytes32 bitmapHash;
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
