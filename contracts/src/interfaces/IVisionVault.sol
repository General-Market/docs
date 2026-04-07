// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {IERC7540Deposit, IERC7540Redeem} from "./IERC7540.sol";

/// @title IVisionVault — Managed vault for Vision prediction market trading
interface IVisionVault is IERC4626, IERC7540Deposit, IERC7540Redeem {
    // ── Events ──────────────────────────────────────────────────────
    event BatchJoined(uint256 indexed batchId, uint256 amount);
    event BitmapUpdated(uint256 indexed batchId, bytes32 newBitmapHash);
    event Reconciled(uint256 indexed batchId, int256 pnl, uint256 feeSharesMinted, uint256 withdrawalsFulfilled);
    event DepositClaimed(address indexed receiver, uint256 assets, uint256 shares);
    event WithdrawClaimed(address indexed receiver, uint256 assets, uint256 shares);

    // ── Errors ──────────────────────────────────────────────────────
    error NotManager();
    error AlreadyInitialized();
    error InsufficientIdleCapital();
    error BatchNotActive();
    error BatchAlreadyReconciled();
    error NothingToClaim();
    error FeeTooHigh();

    // ── Manager Trading ─────────────────────────────────────────────
    function joinBatch(uint256 batchId, bytes32 configHash, uint256 depositAmount, bytes32 bitmapHash) external;
    function updateBitmap(uint256 batchId, bytes32 configHash, bytes32 newBitmapHash) external;

    // ── Reconciliation (permissionless) ─────────────────────────────
    function reconcile(uint256 batchId, uint256 settlementPayout) external;

    // ── View ────────────────────────────────────────────────────────
    function manager() external view returns (address);
    function performanceFeeRate() external view returns (uint256);
    function highWaterMark() external view returns (uint256);
    function totalActiveCapital() external view returns (uint256);
    function activeBatchDeposits(uint256 batchId) external view returns (uint256);
    function idleUSDC() external view returns (uint256);

    // ── Initialization ──────────────────────────────────────────────
    function initialize(string calldata name, string calldata symbol, address manager, address vision, address usdc, uint256 performanceFeeRate) external;
}

/// @title IVisionVaultFactory — Permissionless vault deployer + registry
interface IVisionVaultFactory {
    event VaultCreated(address indexed vault, address indexed manager, string name, string symbol, uint256 performanceFeeRate);

    error FeeTooHigh();

    function createVault(string calldata name, string calldata symbol, uint256 performanceFeeRate, address manager) external returns (address vault);

    function implementation() external view returns (address);
    function vision() external view returns (address);
    function usdc() external view returns (address);
    function MAX_PERFORMANCE_FEE() external view returns (uint256);

    function getAllVaults() external view returns (address[] memory);
    function getVaultsByManager(address manager) external view returns (address[] memory);
    function getVaultCount() external view returns (uint256);
    function isRegisteredVault(address vault) external view returns (bool);
}
