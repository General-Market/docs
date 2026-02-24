// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../libraries/TypesLib.sol";

/// @title IIssuerRegistry - Issuer node management interface
/// @notice Registry for issuer nodes and their BLS public keys
/// @dev Manages issuer lifecycle, key rotation, and aggregated public key
/// @dev Message format: keccak256(abi.encode(chainid, this, functionSpecificData...))
interface IIssuerRegistry {
    // ============ ISSUER MANAGEMENT ============

    /// @notice Add a new issuer to the registry
    /// @dev Only callable by admin
    /// @param issuerAddr Issuer's Ethereum address for rewards/governance
    /// @param ip IP address for P2P communication (packed as bytes32)
    /// @param blsPubkey BLS public key for signature aggregation
    /// @return issuerId The assigned issuer ID
    function addIssuer(
        address issuerAddr,
        bytes32 ip,
        bytes calldata blsPubkey
    ) external returns (uint256 issuerId);

    /// @notice Remove an issuer from the registry
    /// @dev Callable by admin OR by BLS vote from other issuers
    /// @dev Message (if BLS): keccak256(abi.encode(chainid, this, "removeIssuer", issuerId))
    /// @param issuerId The issuer to remove
    function removeIssuer(uint256 issuerId) external;

    // ============ KEY ROTATION ============

    /// @notice Request a key rotation for an issuer
    /// @dev Must be signed with the OLD key to prove ownership
    /// @dev Starts approval process requiring 10/19 other issuer approvals
    /// @dev Message: keccak256(abi.encode(chainid, this, "rotateKey", issuerId, newPubkey))
    /// @param issuerId The issuer requesting rotation
    /// @param newPubkey The new BLS public key
    /// @param signatureWithOldKey Signature with the current (old) key
    function requestKeyRotation(
        uint256 issuerId,
        bytes calldata newPubkey,
        bytes calldata signatureWithOldKey
    ) external;

    /// @notice Approve a pending key rotation
    /// @dev Requires approval from 10/19 other issuers
    /// @dev Message: keccak256(abi.encode(chainid, this, "approveRotation", rotatingIssuerId, newPubkey))
    /// @param rotatingIssuerId The issuer whose key is being rotated
    /// @param approvingIssuerId The issuer approving the rotation
    /// @param approverSignature Signature from the approving issuer
    function approveRotation(
        uint256 rotatingIssuerId,
        uint256 approvingIssuerId,
        bytes calldata approverSignature
    ) external;

    /// @notice Execute a key rotation after timelock and approvals
    /// @dev Can only be called after 24h timelock AND safe period
    /// @dev Safe period = no new approvals in last 1h (prevents rushing)
    /// @param issuerId The issuer whose key is being rotated
    function executeRotation(uint256 issuerId) external;

    /// @notice Force rotation window after being stuck
    /// @dev Admin escape hatch if rotation is stuck for 48h+
    /// @dev Only callable by admin
    /// @param issuerId The issuer whose rotation is stuck
    function forceRotationWindow(uint256 issuerId) external;

    /// @notice Cancel a pending key rotation
    /// @dev Only callable by admin
    /// @param issuerId The issuer whose rotation to cancel
    function cancelRotation(uint256 issuerId) external;

    // ============ VIEW FUNCTIONS ============

    /// @notice Get issuer details by ID
    /// @param issuerId The issuer ID
    /// @return issuer The issuer struct
    function getIssuer(uint256 issuerId) external view returns (TypesLib.Issuer memory issuer);

    /// @notice Get the aggregated BLS public key of all active issuers
    /// @dev Used for verifying aggregated signatures
    /// @return The aggregated public key bytes
    function getAggregatedPubkey() external view returns (bytes memory);

    /// @notice Set the aggregated BLS G2 public key (computed off-chain)
    /// @param pubkey The aggregated G2 public key (128 bytes)
    function setAggregatedPubkey(bytes calldata pubkey) external;

    /// @notice Get all registered issuers
    /// @return An array of all issuer structs
    function getIssuers() external view returns (TypesLib.Issuer[] memory);

    /// @notice Check if an address is a registered active issuer
    /// @param addr The address to check
    /// @return True if the address belongs to an active issuer
    function isActiveIssuer(address addr) external view returns (bool);

    /// @notice Get active issuer count
    /// @return Number of active issuers
    function activeIssuerCount() external view returns (uint256);

    /// @notice Verify signer bitmap and return signer count
    /// @param signerBitmap Bitmap of issuer IDs that signed (bit i = issuer i signed)
    /// @return signerCount Number of valid active signers
    /// @return issuerIds Array of issuer IDs that signed
    function verifySignerBitmap(uint256 signerBitmap) external view returns (uint256 signerCount, uint256[] memory issuerIds);

    /// @notice Get pending key rotation details
    /// @param issuerId The issuer ID
    /// @return rotation The key rotation struct (empty if none pending)
    function getPendingRotation(uint256 issuerId) external view returns (TypesLib.KeyRotation memory rotation);

    /// @notice Check if a key rotation can be executed
    /// @dev Returns true if timelock passed AND required approvals received AND safe period elapsed
    /// @param issuerId The issuer ID
    /// @return Whether rotation can be executed
    function canExecuteRotation(uint256 issuerId) external view returns (bool);

    // ============ REGISTRY SYNC (Story 8.1) ============

    /// @notice Get current registry nonce for sync tracking
    /// @dev Incremented on every state change (add/remove issuer, key rotation)
    /// @return The current registry nonce
    function registryNonce() external view returns (uint256);

    /// @notice Compute hash of all active issuer pubkeys for state verification
    /// @dev Returns keccak256 of all active issuer pubkeys concatenated in ID order
    /// @return The registry state hash
    function getRegistryStateHash() external view returns (bytes32);

    // ============ CONSTANTS ============

    /// @notice Key rotation approval threshold (10/19 other issuers)
    /// @return The number of approvals required
    function ROTATION_THRESHOLD() external view returns (uint256);

    /// @notice Key rotation timelock duration (24 hours)
    /// @return The timelock duration in seconds
    function ROTATION_TIMELOCK() external view returns (uint256);

    /// @notice Safe period after last approval (1 hour)
    /// @return The safe period duration in seconds
    function SAFE_PERIOD() external view returns (uint256);

    /// @notice Admin force window (48 hours)
    /// @return The duration after which admin can force rotation
    function ADMIN_FORCE_WINDOW() external view returns (uint256);

    // ============ PEER DISCOVERY (Story 7.17) ============

    /// @notice Get connection details for all active issuers
    /// @dev Used by new issuer nodes for P2P bootstrap
    /// @return ids Array of active issuer IDs
    /// @return ips Array of IP addresses (packed as bytes32)
    /// @return pubkeys Array of BLS public keys
    function getActiveIssuerEndpoints()
        external
        view
        returns (uint256[] memory ids, bytes32[] memory ips, bytes[] memory pubkeys);

    /// @notice Update an issuer's IP address
    /// @param issuerId The issuer whose IP to update
    /// @param newIp The new IP address (packed as bytes32)
    /// @param blsSignature BLS signature proving ownership
    function updateIssuerIp(uint256 issuerId, bytes32 newIp, bytes calldata blsSignature) external;

    // ============ CONSENSUS PAUSE ============

    /// @notice Whether consensus is currently paused
    /// @return True if consensus is paused
    function consensusPaused() external view returns (bool);

    /// @notice Pause or unpause consensus (admin circuit breaker)
    /// @param paused Whether to pause consensus
    function setConsensusPaused(bool paused) external;

    // ============ EVENTS ============

    /// @notice Emitted when a new issuer is added
    /// @param issuerId The assigned issuer ID
    /// @param addr Issuer's Ethereum address
    /// @param blsPubkey Issuer's BLS public key
    event IssuerAdded(uint256 indexed issuerId, address indexed addr, bytes blsPubkey);

    /// @notice Emitted when an issuer is removed
    /// @param issuerId The removed issuer's ID
    event IssuerRemoved(uint256 indexed issuerId);

    /// @notice Emitted when a key rotation is requested
    /// @param issuerId The issuer requesting rotation
    /// @param newPubkey The proposed new BLS public key
    event KeyRotationRequested(uint256 indexed issuerId, bytes newPubkey);

    /// @notice Emitted when a key rotation receives an approval
    /// @param rotatingIssuerId The issuer whose key is being rotated
    /// @param approvingIssuerId The issuer who approved
    /// @param approvalCount Current number of approvals
    event KeyRotationApproved(
        uint256 indexed rotatingIssuerId,
        uint256 indexed approvingIssuerId,
        uint256 approvalCount
    );

    /// @notice Emitted when a key rotation is executed
    /// @param issuerId The issuer whose key was rotated
    /// @param oldPubkey The previous BLS public key
    /// @param newPubkey The new BLS public key
    event KeyRotationExecuted(uint256 indexed issuerId, bytes oldPubkey, bytes newPubkey);

    /// @notice Emitted when admin forces a rotation window
    /// @param issuerId The issuer whose rotation was forced
    event RotationWindowForced(uint256 indexed issuerId);

    /// @notice Emitted when a key rotation is cancelled
    /// @param issuerId The issuer whose rotation was cancelled
    event KeyRotationCancelled(uint256 indexed issuerId);
}
