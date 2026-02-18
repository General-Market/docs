// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IGovernance - Governance and emergency controls interface
/// @notice Admin controls for system pause, ITP management, and admin transfer
/// @dev All pause functions are admin-only for emergency response
interface IGovernance {
    // ============ SYSTEM PAUSE ============

    /// @notice Emergency pause the entire system
    /// @dev Only callable by admin
    /// @dev Blocks all order submissions, batch confirmations, and bridge operations
    function pause() external;

    /// @notice Resume system after emergency pause
    /// @dev Only callable by admin
    /// @dev Re-enables all system operations
    function unpause() external;

    // ============ ITP PAUSE ============

    /// @notice Pause a specific ITP
    /// @dev Only callable by admin
    /// @dev Blocks orders for this ITP while allowing others to function
    /// @param itpId The ITP to pause
    function pauseITP(bytes32 itpId) external;

    /// @notice Resume a paused ITP
    /// @dev Only callable by admin
    /// @dev Re-enables orders for this ITP
    /// @param itpId The ITP to unpause
    function unpauseITP(bytes32 itpId) external;

    // ============ ADMIN MANAGEMENT ============

    /// @notice Transfer admin role to a new address
    /// @dev Only callable by current admin
    /// @dev Takes effect immediately - use with extreme caution
    /// @param newAdmin The new admin address
    function setAdmin(address newAdmin) external;

    // ============ VIEW FUNCTIONS ============

    /// @notice Check if the system is paused
    /// @return Whether the system is currently paused
    function isPaused() external view returns (bool);

    /// @notice Check if a specific ITP is paused
    /// @param itpId The ITP to check
    /// @return Whether the ITP is currently paused
    function isITPPaused(bytes32 itpId) external view returns (bool);

    /// @notice Get the current admin address
    /// @return The admin address
    function admin() external view returns (address);

    // ============ EVENTS ============

    /// @notice Emitted when the system is paused
    /// @param admin The admin who triggered the pause
    event SystemPaused(address indexed admin);

    /// @notice Emitted when the system is unpaused
    /// @param admin The admin who triggered the unpause
    event SystemUnpaused(address indexed admin);

    /// @notice Emitted when an ITP is paused
    /// @param itpId The paused ITP
    /// @param admin The admin who triggered the pause
    event ITPPaused(bytes32 indexed itpId, address indexed admin);

    /// @notice Emitted when an ITP is unpaused
    /// @param itpId The unpaused ITP
    /// @param admin The admin who triggered the unpause
    event ITPUnpaused(bytes32 indexed itpId, address indexed admin);

    /// @notice Emitted when admin is transferred
    /// @param previousAdmin The old admin address
    /// @param newAdmin The new admin address
    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);
}
