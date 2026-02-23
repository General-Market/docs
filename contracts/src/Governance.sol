// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IGovernance} from "./interfaces/IGovernance.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/// @title Governance - Admin and emergency controls for Index L3
/// @notice Manages system pause, ITP-specific pause, and admin transfers
/// @dev UUPS upgradeable proxy pattern for future upgrades
/// @custom:security-contact security@indexprotocol.com
contract Governance is IGovernance, Initializable, UUPSUpgradeable {
    // ============ ERRORS ============

    /// @notice Thrown when caller is not the admin
    error Unauthorized();

    /// @notice Thrown when setting admin to zero address
    error ZeroAddress();

    // ============ STORAGE ============

    /// @dev Admin address (single EOA in Phase 1, multisig later)
    address private _admin;

    /// @dev Global system pause flag
    bool private _systemPaused;

    /// @dev Per-ITP pause flags
    mapping(bytes32 => bool) private _itpPaused;

    /// @dev Storage gap for upgrade safety (50 slots total)
    uint256[47] private __gap;

    // ============ MODIFIERS ============

    /// @notice Restricts function to admin only
    modifier onlyAdmin() {
        if (msg.sender != _admin) revert Unauthorized();
        _;
    }

    // ============ CONSTRUCTOR ============

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // ============ INITIALIZER ============

    /// @notice Initialize the Governance contract
    /// @param initialAdmin The initial admin address
    function initialize(address initialAdmin) external initializer {
        if (initialAdmin == address(0)) revert ZeroAddress();
        __UUPSUpgradeable_init();
        _admin = initialAdmin;
        emit AdminTransferred(address(0), initialAdmin);
    }

    // ============ SYSTEM PAUSE ============

    /// @inheritdoc IGovernance
    function pause() external onlyAdmin {
        if (_systemPaused) return; // Idempotent - succeed silently if already paused
        _systemPaused = true;
        emit SystemPaused(msg.sender);
    }

    /// @inheritdoc IGovernance
    function unpause() external onlyAdmin {
        if (!_systemPaused) return; // Idempotent - succeed silently if not paused
        _systemPaused = false;
        emit SystemUnpaused(msg.sender);
    }

    /// @inheritdoc IGovernance
    function isPaused() external view returns (bool) {
        return _systemPaused;
    }

    // ============ ITP PAUSE ============

    /// @inheritdoc IGovernance
    function pauseITP(bytes32 itpId) external onlyAdmin {
        if (_itpPaused[itpId]) return; // Idempotent - succeed silently if already paused
        _itpPaused[itpId] = true;
        emit ITPPaused(itpId, msg.sender);
    }

    /// @inheritdoc IGovernance
    function unpauseITP(bytes32 itpId) external onlyAdmin {
        if (!_itpPaused[itpId]) return; // Idempotent - succeed silently if not paused
        _itpPaused[itpId] = false;
        emit ITPUnpaused(itpId, msg.sender);
    }

    /// @inheritdoc IGovernance
    function isITPPaused(bytes32 itpId) external view returns (bool) {
        return _itpPaused[itpId];
    }

    // ============ ADMIN MANAGEMENT ============

    /// @inheritdoc IGovernance
    function setAdmin(address newAdmin) external onlyAdmin {
        if (newAdmin == address(0)) revert ZeroAddress();
        address previousAdmin = _admin;
        _admin = newAdmin;
        emit AdminTransferred(previousAdmin, newAdmin);
    }

    /// @inheritdoc IGovernance
    function admin() external view returns (address) {
        return _admin;
    }

    // ============ UPGRADE AUTHORIZATION ============

    /// @notice Authorize an upgrade (admin only)
    /// @param newImplementation The new implementation address
    /// @dev Validates that newImplementation is a deployed contract to prevent bricking
    function _authorizeUpgrade(address newImplementation) internal override onlyAdmin {
        if (newImplementation.code.length == 0) revert ZeroAddress();
    }
}
