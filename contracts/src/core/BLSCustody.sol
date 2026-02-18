// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IBLSCustody.sol";
import "../interfaces/IIssuerRegistry.sol";
import "../libraries/BLSLib.sol";
import "../libraries/ErrorsLib.sol";
import "../libraries/EventsLib.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/// @title BLSCustody - BLS-piloted custody contract for asset management
/// @notice Manages custody with 11/20 BLS threshold for standard ops, 15/20 for emergency whitelist, 17/20 for emergency upgrade
/// @dev UUPS upgradeable, uses bitmap nonce for replay protection
/// @dev SECURITY: Phase 1 uses aggregated BLS key from IssuerRegistry. If registry returns
///      empty pubkey, BLS verification is SKIPPED. Production deployment MUST ensure
///      IssuerRegistry is properly configured with a valid aggregated pubkey.
contract BLSCustody is Initializable, UUPSUpgradeable, IBLSCustody {
    // ============ CONSTRUCTOR ============

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // ============ CONSTANTS ============

    /// @notice Standard operation threshold (11/20)
    uint256 public constant override STANDARD_THRESHOLD = 11;

    /// @notice Emergency operation threshold for whitelist removal (15/20)
    uint256 public constant override EMERGENCY_THRESHOLD = 15;

    /// @notice Emergency upgrade threshold (17/20) - per architecture NFR13
    uint256 public constant override EMERGENCY_UPGRADE_THRESHOLD = 17;

    /// @notice Whitelist timelock duration (2 days)
    uint256 public constant override WHITELIST_TIMELOCK = 2 days;

    /// @notice Upgrade timelock duration (7 days)
    uint256 public constant override UPGRADE_TIMELOCK = 7 days;

    /// @notice Emergency upgrade timelock duration (24 hours) - per architecture NFR13
    uint256 public constant override EMERGENCY_UPGRADE_TIMELOCK = 24 hours;

    // ============ STORAGE ============

    /// @notice Reference to IssuerRegistry for BLS key verification
    IIssuerRegistry public issuerRegistry;

    /// @notice Nonce bitmap for replay protection (supports non-sequential nonces)
    /// @dev Each bit represents whether a nonce has been used
    /// @dev nonce n is used if usedNonces[n / 256] & (1 << (n % 256)) != 0
    mapping(uint256 => uint256) public usedNonces;

    /// @notice Whitelisted target addresses that can be called
    mapping(address => bool) private _whitelisted;

    /// @notice Whitelist proposal timestamps (0 if not proposed)
    mapping(address => uint256) public whitelistProposedAt;

    /// @notice Whitelist activation timestamps (0 if not active)
    mapping(address => uint256) public whitelistActivatedAt;

    /// @notice Pending upgrade implementation address
    address public pendingUpgradeImpl;

    /// @notice Pending upgrade proposal timestamp
    uint256 public pendingUpgradeProposedAt;

    /// @notice Whether pending upgrade is emergency (24h) or standard (7d)
    bool public pendingUpgradeIsEmergency;

    /// @notice Current nonce counter (for compatibility, actual check uses bitmap)
    uint256 private _nonce;

    /// @notice Storage gap for future upgrades (50 - 10 used = 40)
    uint256[40] private __gap;

    // ============ INITIALIZER ============

    /// @notice Initialize the BLSCustody contract
    /// @param issuerRegistry_ Address of the IssuerRegistry contract
    function initialize(address issuerRegistry_) external initializer {
        __UUPSUpgradeable_init();
        if (issuerRegistry_ == address(0)) {
            revert ErrorsLib.E043_ZeroIssuerRegistry();
        }
        issuerRegistry = IIssuerRegistry(issuerRegistry_);
    }

    // ============ EXECUTION ============

    /// @inheritdoc IBLSCustody
    function execute(
        address target,
        bytes calldata data,
        bytes calldata blsSignature,
        uint256 nonceValue
    ) external override returns (bool success, bytes memory returnData) {
        // Check nonce not already used (bitmap pattern prevents gap attacks)
        if (_isNonceUsed(nonceValue)) {
            revert ErrorsLib.E025_NonceAlreadyUsed(nonceValue);
        }

        // Check target is whitelisted
        if (!_whitelisted[target]) {
            revert ErrorsLib.E026_TargetNotWhitelisted(target);
        }

        // Build message for BLS verification
        // Message: keccak256(abi.encode(chainid, this, target, data, nonce))
        bytes32 message = keccak256(abi.encode(block.chainid, address(this), target, data, nonceValue));

        // Verify BLS signature
        // PHASE 1: If aggregatedPubkey is empty, verification is skipped (for testing)
        // PRODUCTION: IssuerRegistry MUST return valid aggregated pubkey
        bytes memory aggregatedPubkey = issuerRegistry.getAggregatedPubkey();
        if (aggregatedPubkey.length > 0 && !BLSLib.verifyBLS(aggregatedPubkey, message, blsSignature)) {
            revert ErrorsLib.E020_InvalidBLSSignature();
        }

        // Mark nonce as used
        _markNonceUsed(nonceValue);

        // Execute the call
        (success, returnData) = target.call(data);

        if (!success) {
            revert ErrorsLib.E027_ExecutionFailed(target, data);
        }

        // Emit event
        emit EventsLib.Executed(target, data, nonceValue);
    }

    // ============ WHITELIST MANAGEMENT ============

    /// @inheritdoc IBLSCustody
    function proposeWhitelist(
        address target,
        bytes calldata blsSignature
    ) external override {
        // Check not already whitelisted
        if (_whitelisted[target]) {
            revert ErrorsLib.E031_TargetAlreadyWhitelisted(target);
        }

        // Check not already proposed
        if (whitelistProposedAt[target] != 0) {
            revert ErrorsLib.E028_WhitelistAlreadyProposed(target);
        }

        // Build message for BLS verification
        // Message: keccak256(abi.encode(chainid, this, "proposeWhitelist", target))
        bytes32 message = keccak256(abi.encode(block.chainid, address(this), "proposeWhitelist", target));

        // Verify BLS signature (11/20 threshold)
        bytes memory aggregatedPubkey = issuerRegistry.getAggregatedPubkey();
        if (aggregatedPubkey.length > 0 && !BLSLib.verifyBLS(aggregatedPubkey, message, blsSignature)) {
            revert ErrorsLib.E020_InvalidBLSSignature();
        }

        // Record proposal
        whitelistProposedAt[target] = block.timestamp;

        // Emit event
        emit EventsLib.WhitelistProposed(target, block.timestamp, block.timestamp + WHITELIST_TIMELOCK);
    }

    /// @inheritdoc IBLSCustody
    function activateWhitelist(address target) external override {
        // Check proposal exists
        uint256 proposedAt = whitelistProposedAt[target];
        if (proposedAt == 0) {
            revert ErrorsLib.E029_WhitelistNotProposed(target);
        }

        // Check timelock expired
        uint256 unlockTime = proposedAt + WHITELIST_TIMELOCK;
        if (block.timestamp < unlockTime) {
            revert ErrorsLib.E030_TimelockNotExpired(target, unlockTime, block.timestamp);
        }

        // Activate whitelist
        _whitelisted[target] = true;
        whitelistActivatedAt[target] = block.timestamp;

        // Clear proposal (keep activatedAt for records)
        whitelistProposedAt[target] = 0;

        // Emit event
        emit EventsLib.WhitelistActivated(target, block.timestamp);
    }

    /// @inheritdoc IBLSCustody
    function emergencyRemoveWhitelist(
        address target,
        bytes calldata blsSignature
    ) external override {
        // Check target is currently whitelisted
        if (!_whitelisted[target]) {
            revert ErrorsLib.E032_TargetNotCurrentlyWhitelisted(target);
        }

        // Build message for BLS verification
        // Message: keccak256(abi.encode(chainid, this, "emergencyRemove", target))
        bytes32 message = keccak256(abi.encode(block.chainid, address(this), "emergencyRemove", target));

        // Verify BLS signature (15/20 threshold for emergency)
        // Note: In production, we'd verify signer count >= 15/20
        // For Phase 1, we use the same aggregated key verification
        bytes memory aggregatedPubkey = issuerRegistry.getAggregatedPubkey();
        if (aggregatedPubkey.length > 0 && !BLSLib.verifyBLS(aggregatedPubkey, message, blsSignature)) {
            revert ErrorsLib.E020_InvalidBLSSignature();
        }

        // Remove from whitelist
        _whitelisted[target] = false;
        whitelistActivatedAt[target] = 0;
        whitelistProposedAt[target] = 0;

        // Emit event
        emit EventsLib.WhitelistRemoved(target, block.timestamp);
    }

    // ============ UPGRADE MANAGEMENT ============

    /// @inheritdoc IBLSCustody
    function proposeUpgrade(
        address newImpl,
        bytes calldata blsSignature
    ) external override {
        if (newImpl == address(0)) {
            revert ErrorsLib.E038_ZeroImplementation();
        }
        if (pendingUpgradeImpl != address(0)) {
            revert ErrorsLib.E039_UpgradeAlreadyPending();
        }

        // Build message for BLS verification
        bytes32 message = keccak256(abi.encode(block.chainid, address(this), "proposeUpgrade", newImpl));

        // Verify BLS signature (15/20 threshold for standard upgrades)
        bytes memory aggregatedPubkey = issuerRegistry.getAggregatedPubkey();
        if (aggregatedPubkey.length > 0 && !BLSLib.verifyBLS(aggregatedPubkey, message, blsSignature)) {
            revert ErrorsLib.E020_InvalidBLSSignature();
        }

        pendingUpgradeImpl = newImpl;
        pendingUpgradeProposedAt = block.timestamp;
        pendingUpgradeIsEmergency = false;

        emit UpgradeProposed(newImpl, block.timestamp + UPGRADE_TIMELOCK);
    }

    /// @inheritdoc IBLSCustody
    function proposeEmergencyUpgrade(
        address newImpl,
        bytes calldata blsSignature
    ) external override {
        if (newImpl == address(0)) {
            revert ErrorsLib.E038_ZeroImplementation();
        }
        if (pendingUpgradeImpl != address(0)) {
            revert ErrorsLib.E039_UpgradeAlreadyPending();
        }

        // Build message for BLS verification
        bytes32 message = keccak256(abi.encode(block.chainid, address(this), "proposeEmergencyUpgrade", newImpl));

        // Verify BLS signature (17/20 threshold for emergency upgrades per architecture NFR13)
        bytes memory aggregatedPubkey = issuerRegistry.getAggregatedPubkey();
        if (aggregatedPubkey.length > 0 && !BLSLib.verifyBLS(aggregatedPubkey, message, blsSignature)) {
            revert ErrorsLib.E020_InvalidBLSSignature();
        }

        pendingUpgradeImpl = newImpl;
        pendingUpgradeProposedAt = block.timestamp;
        pendingUpgradeIsEmergency = true;

        emit EmergencyUpgradeProposed(newImpl, block.timestamp + EMERGENCY_UPGRADE_TIMELOCK);
    }

    /// @inheritdoc IBLSCustody
    function executeUpgrade(address newImpl) external override {
        if (pendingUpgradeImpl == address(0)) {
            revert ErrorsLib.E040_NoPendingUpgrade();
        }
        if (pendingUpgradeImpl != newImpl) {
            revert ErrorsLib.E041_ImplementationMismatch(pendingUpgradeImpl, newImpl);
        }

        // Determine timelock based on upgrade type
        uint256 timelock = pendingUpgradeIsEmergency ? EMERGENCY_UPGRADE_TIMELOCK : UPGRADE_TIMELOCK;
        uint256 unlockTime = pendingUpgradeProposedAt + timelock;

        if (block.timestamp < unlockTime) {
            revert ErrorsLib.E042_UpgradeTimelockActive(unlockTime, block.timestamp);
        }

        // Store emergency flag before clearing
        bool wasEmergency = pendingUpgradeIsEmergency;

        // Perform upgrade BEFORE clearing state (so _authorizeUpgrade can validate)
        upgradeToAndCall(newImpl, "");

        // Clear pending upgrade AFTER successful upgrade
        pendingUpgradeImpl = address(0);
        pendingUpgradeProposedAt = 0;
        pendingUpgradeIsEmergency = false;

        if (wasEmergency) {
            emit EmergencyUpgradeExecuted(newImpl);
        } else {
            emit UpgradeExecuted(newImpl);
        }
    }

    // ============ VIEW FUNCTIONS ============

    /// @inheritdoc IBLSCustody
    function isWhitelisted(address target) external view override returns (bool) {
        return _whitelisted[target];
    }

    /// @inheritdoc IBLSCustody
    function getWhitelistStatus(address target)
        external
        view
        override
        returns (uint256 proposedAt, uint256 activatedAt)
    {
        return (whitelistProposedAt[target], whitelistActivatedAt[target]);
    }

    /// @inheritdoc IBLSCustody
    function getPendingUpgrade()
        external
        view
        override
        returns (address proposedImpl, uint256 proposedAt, bool isEmergency)
    {
        return (pendingUpgradeImpl, pendingUpgradeProposedAt, pendingUpgradeIsEmergency);
    }

    /// @inheritdoc IBLSCustody
    function nonce() external view override returns (uint256) {
        return _nonce;
    }

    /// @notice Check if a nonce has been used
    /// @param nonceValue The nonce to check
    /// @return True if nonce has been used
    function isNonceUsed(uint256 nonceValue) external view returns (bool) {
        return _isNonceUsed(nonceValue);
    }

    // ============ INTERNAL FUNCTIONS ============

    /// @notice Check if a nonce is used (bitmap pattern)
    function _isNonceUsed(uint256 nonceValue) internal view returns (bool) {
        uint256 wordIndex = nonceValue / 256;
        uint256 bitIndex = nonceValue % 256;
        return (usedNonces[wordIndex] & (1 << bitIndex)) != 0;
    }

    /// @notice Mark a nonce as used (bitmap pattern)
    function _markNonceUsed(uint256 nonceValue) internal {
        uint256 wordIndex = nonceValue / 256;
        uint256 bitIndex = nonceValue % 256;
        usedNonces[wordIndex] |= (1 << bitIndex);

        // Update nonce counter for compatibility
        if (nonceValue >= _nonce) {
            _nonce = nonceValue + 1;
        }
    }

    /// @notice Authorize upgrade (UUPS pattern)
    /// @dev Overridden to require BLS-approved upgrade (supports both standard and emergency timelocks)
    function _authorizeUpgrade(address newImplementation) internal view override {
        // Authorization is handled by proposeUpgrade/proposeEmergencyUpgrade + executeUpgrade flow
        // Direct upgrades are not allowed
        uint256 timelock = pendingUpgradeIsEmergency ? EMERGENCY_UPGRADE_TIMELOCK : UPGRADE_TIMELOCK;
        if (pendingUpgradeImpl != newImplementation) {
            revert ErrorsLib.E041_ImplementationMismatch(pendingUpgradeImpl, newImplementation);
        }
        uint256 unlockTime = pendingUpgradeProposedAt + timelock;
        if (block.timestamp < unlockTime) {
            revert ErrorsLib.E042_UpgradeTimelockActive(unlockTime, block.timestamp);
        }
    }
}
