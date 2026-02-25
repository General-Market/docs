// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IBLSCustody - BLS-secured custody contract interface
/// @notice Multi-sig custody using BLS signature aggregation
/// @dev All operations require BLS signatures from issuer quorum
/// @dev Message format: keccak256(abi.encode(chainid, this, functionSpecificData...))
interface IBLSCustody {
    // ============ EXECUTION ============

    /// @notice Execute an arbitrary call with BLS signature authorization
    /// @dev Requires 11/20 issuer signatures (standard threshold)
    /// @dev Target must be whitelisted before execution
    /// @dev Message: keccak256(abi.encode(chainid, this, target, data, nonce))
    /// @param target Address to call (must be whitelisted)
    /// @param data Calldata for the call
    /// @param blsSignature Aggregated BLS signature from 11/20 issuers
    /// @param nonce Unique nonce to prevent replay attacks
    /// @return success Whether the call succeeded
    /// @return returnData Data returned by the call
    function execute(
        address target,
        bytes calldata data,
        bytes calldata blsSignature,
        uint256 nonce,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external returns (bool success, bytes memory returnData);

    // ============ WHITELIST MANAGEMENT ============

    /// @notice Propose adding a target address to whitelist
    /// @dev Requires 11/20 issuer signatures
    /// @dev Starts 2-day timelock before activation
    /// @dev Message: keccak256(abi.encode(chainid, this, "proposeWhitelist", target))
    /// @param target Address to propose for whitelisting
    /// @param blsSignature Aggregated BLS signature from 11/20 issuers
    function proposeWhitelist(
        address target,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external;

    /// @notice Activate a proposed whitelist after timelock expires
    /// @dev Can only be called after 2-day timelock from proposal
    /// @dev No signature required - timelock is the security mechanism
    /// @param target Address to activate on whitelist
    function activateWhitelist(address target) external;

    /// @notice Emergency remove a target from whitelist
    /// @dev Requires 15/20 issuer signatures (emergency threshold)
    /// @dev Takes effect immediately - no timelock
    /// @dev Message: keccak256(abi.encode(chainid, this, "emergencyRemove", target))
    /// @param target Address to remove from whitelist
    /// @param blsSignature Aggregated BLS signature from 15/20 issuers
    function emergencyRemoveWhitelist(
        address target,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external;

    // ============ UPGRADE MANAGEMENT ============

    /// @notice Propose a UUPS upgrade to new implementation (standard 7-day timelock)
    /// @dev Requires 15/20 issuer signatures
    /// @dev Starts 7-day timelock before execution
    /// @dev Message: keccak256(abi.encode(chainid, this, "proposeUpgrade", newImpl))
    /// @param newImpl Address of the new implementation contract
    /// @param blsSignature Aggregated BLS signature from 15/20 issuers
    function proposeUpgrade(
        address newImpl,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external;

    /// @notice Propose an emergency UUPS upgrade (24-hour timelock)
    /// @dev Requires 17/20 issuer signatures (emergency upgrade threshold per NFR13)
    /// @dev Starts 24-hour timelock before execution
    /// @dev Message: keccak256(abi.encode(chainid, this, "proposeEmergencyUpgrade", newImpl))
    /// @param newImpl Address of the new implementation contract
    /// @param blsSignature Aggregated BLS signature from 17/20 issuers
    function proposeEmergencyUpgrade(
        address newImpl,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external;

    /// @notice Execute a proposed upgrade after timelock expires
    /// @dev Can only be called after timelock expires (7 days for standard, 24 hours for emergency)
    /// @dev No signature required - timelock is the security mechanism
    /// @param newImpl Address of the new implementation (must match proposal)
    function executeUpgrade(address newImpl) external;

    // ============ VIEW FUNCTIONS ============

    /// @notice Check if an address is whitelisted
    /// @param target Address to check
    /// @return Whether the address is on the active whitelist
    function isWhitelisted(address target) external view returns (bool);

    /// @notice Get whitelist proposal details
    /// @param target Address to check
    /// @return proposedAt Timestamp when proposed (0 if not proposed)
    /// @return activatedAt Timestamp when activated (0 if not active)
    function getWhitelistStatus(address target) external view returns (uint256 proposedAt, uint256 activatedAt);

    /// @notice Get upgrade proposal details
    /// @return proposedImpl Address of proposed implementation (address(0) if none)
    /// @return proposedAt Timestamp of proposal
    /// @return isEmergency Whether this is an emergency upgrade (24h timelock) or standard (7d)
    function getPendingUpgrade() external view returns (address proposedImpl, uint256 proposedAt, bool isEmergency);

    /// @notice Get the current nonce for replay protection
    /// @return The current nonce value
    function nonce() external view returns (uint256);

    // ============ CONSTANTS ============

    /// @notice Standard operation threshold (11/20)
    /// @return The number of signers required for standard operations
    function STANDARD_THRESHOLD() external view returns (uint256);

    /// @notice Emergency operation threshold for whitelist removal (15/20)
    /// @return The number of signers required for emergency whitelist operations
    function EMERGENCY_THRESHOLD() external view returns (uint256);

    /// @notice Emergency upgrade threshold (17/20) per architecture NFR13
    /// @return The number of signers required for emergency upgrades
    function EMERGENCY_UPGRADE_THRESHOLD() external view returns (uint256);

    /// @notice Whitelist timelock duration (2 days)
    /// @return The timelock duration in seconds
    function WHITELIST_TIMELOCK() external view returns (uint256);

    /// @notice Standard upgrade timelock duration (7 days)
    /// @return The timelock duration in seconds
    function UPGRADE_TIMELOCK() external view returns (uint256);

    /// @notice Emergency upgrade timelock duration (24 hours) per architecture NFR13
    /// @return The timelock duration in seconds
    function EMERGENCY_UPGRADE_TIMELOCK() external view returns (uint256);

    // ============ EVENTS ============
    // Note: Event signatures must match EventsLib exactly for proper log parsing

    /// @notice Emitted when a BLS-signed execution is performed
    /// @param target The address that was called
    /// @param data The calldata that was executed
    /// @param nonce The nonce used for replay protection
    event Executed(address indexed target, bytes data, uint256 indexed nonce);

    /// @notice Emitted when a whitelist addition is proposed
    /// @param target The address proposed for whitelisting
    /// @param proposedAt Timestamp when proposed
    /// @param activateAt Timestamp when whitelist can be activated (after timelock)
    event WhitelistProposed(address indexed target, uint256 proposedAt, uint256 activateAt);

    /// @notice Emitted when a whitelist proposal is activated
    /// @param target The address added to whitelist
    /// @param activatedAt Timestamp when activated
    event WhitelistActivated(address indexed target, uint256 activatedAt);

    /// @notice Emitted when an address is removed from whitelist
    /// @param target The address removed
    /// @param removedAt Timestamp when removed
    event WhitelistRemoved(address indexed target, uint256 removedAt);

    /// @notice Emitted when a standard upgrade is proposed (7-day timelock)
    /// @param newImpl The proposed new implementation address
    /// @param activationTime Timestamp when upgrade can be executed
    event UpgradeProposed(address indexed newImpl, uint256 activationTime);

    /// @notice Emitted when an emergency upgrade is proposed (24-hour timelock)
    /// @param newImpl The proposed new implementation address
    /// @param activationTime Timestamp when upgrade can be executed
    event EmergencyUpgradeProposed(address indexed newImpl, uint256 activationTime);

    /// @notice Emitted when a standard upgrade is executed
    /// @param newImpl The new implementation address
    event UpgradeExecuted(address indexed newImpl);

    /// @notice Emitted when an emergency upgrade is executed
    /// @param newImpl The new implementation address
    event EmergencyUpgradeExecuted(address indexed newImpl);
}
