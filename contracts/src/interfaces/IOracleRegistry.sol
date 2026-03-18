// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../libraries/TypesLib.sol";

/// @title IOracleRegistry - Oracle node management interface
/// @notice Registry for oracle nodes and their BLS public keys
/// @dev Manages oracle lifecycle, key rotation, and aggregated public key
/// @dev Message format: keccak256(abi.encode(chainid, this, functionSpecificData...))
interface IOracleRegistry {
    // ============ ORACLE MANAGEMENT ============

    /// @notice Add a new oracle to the registry
    /// @dev Only callable by admin. Requires Proof of Possession (PoP) to prove key ownership.
    /// @param oracleAddr Oracle's Ethereum address for rewards/governance
    /// @param ip IP address for P2P communication (packed as bytes32)
    /// @param blsPubkey BLS public key for signature aggregation
    /// @param blsPopSignature PoP: BLS signature over keccak256(abi.encode("INDEX_BLS_POP", chainid, registry, oracleAddr, blsPubkey))
    /// @return oracleId The assigned oracle ID
    function addOracle(
        address oracleAddr,
        bytes32 ip,
        bytes calldata blsPubkey,
        bytes calldata blsPopSignature
    ) external returns (uint256 oracleId);

    /// @notice Remove an oracle from the registry
    /// @dev Callable by admin OR by BLS vote from other oracles
    /// @dev Message (if BLS): keccak256(abi.encode(chainid, this, "removeOracle", oracleId))
    /// @param oracleId The oracle to remove
    function removeOracle(uint256 oracleId) external;

    // ============ KEY ROTATION ============

    /// @notice Request a key rotation for an oracle
    /// @dev Must be signed with the OLD key to prove ownership + PoP with NEW key
    /// @dev Starts approval process requiring 10/19 other oracle approvals
    /// @param oracleId The oracle requesting rotation
    /// @param newPubkey The new BLS public key
    /// @param signatureWithOldKey Signature with the current (old) key
    /// @param newKeyPopSignature PoP: BLS signature over keccak256(abi.encode("INDEX_BLS_POP", chainid, registry, oracleAddr, newPubkey))
    function requestKeyRotation(
        uint256 oracleId,
        bytes calldata newPubkey,
        bytes calldata signatureWithOldKey,
        bytes calldata newKeyPopSignature
    ) external;

    /// @notice Approve a pending key rotation
    /// @dev Requires approval from 10/19 other oracles
    /// @dev Message: keccak256(abi.encode(chainid, this, "approveRotation", rotatingOracleId, newPubkey))
    /// @param rotatingOracleId The oracle whose key is being rotated
    /// @param approvingOracleId The oracle approving the rotation
    /// @param approverSignature Signature from the approving oracle
    function approveRotation(
        uint256 rotatingOracleId,
        uint256 approvingOracleId,
        bytes calldata approverSignature
    ) external;

    /// @notice Execute a key rotation after timelock and approvals
    /// @dev Can only be called after 24h timelock AND safe period
    /// @dev Safe period = no new approvals in last 1h (prevents rushing)
    /// @param oracleId The oracle whose key is being rotated
    function executeRotation(uint256 oracleId) external;

    /// @notice Force rotation window after being stuck
    /// @dev Admin escape hatch if rotation is stuck for 48h+
    /// @dev Only callable by admin
    /// @param oracleId The oracle whose rotation is stuck
    function forceRotationWindow(uint256 oracleId) external;

    /// @notice Cancel a pending key rotation
    /// @dev Only callable by admin
    /// @param oracleId The oracle whose rotation to cancel
    function cancelRotation(uint256 oracleId) external;

    // ============ VIEW FUNCTIONS ============

    /// @notice Get oracle details by ID
    /// @param oracleId The oracle ID
    /// @return oracle The oracle struct
    function getOracle(uint256 oracleId) external view returns (TypesLib.Oracle memory oracle);

    /// @notice Get the aggregated BLS public key of all active oracles
    /// @dev Used for verifying aggregated signatures
    /// @return The aggregated public key bytes
    function getAggregatedPubkey() external view returns (bytes memory);

    /// @notice Set the aggregated BLS G2 public key and create a registry snapshot
    /// @dev Must be called after any addOracle/removeOracle/key rotation
    /// @param pubkey The aggregated G2 public key (128 bytes)
    /// @param nonce The registry nonce this snapshot corresponds to
    function setAggregatedPubkey(bytes calldata pubkey, uint256 nonce) external;

    /// @notice Get the latest snapshot nonce
    /// @return The latest nonce that has a snapshot
    function lastSnapshotNonce() external view returns (uint256);

    /// @notice Get a registry snapshot by nonce
    /// @param nonce The nonce to look up
    /// @return snapshot The registry snapshot at that nonce
    function getSnapshotAtNonce(uint256 nonce) external view returns (TypesLib.RegistrySnapshot memory snapshot);

    /// @notice Get the current active oracle bitmask (computed live)
    /// @dev For node bootstrap before Phase 2+3 snapshots exist
    /// @return bitmask Bitmask where bit i = oracle i is active
    function getActiveBitmask() external view returns (uint256 bitmask);

    /// @notice Increment missed counts for non-signing oracles
    /// @dev Advisory liveness metric. DO NOT use for automated slashing or forced removal.
    ///      Restricted to authorized callers (BLSVerifier-inheriting protocol contracts).
    ///      Register callers via setAuthorizedMissedCountCaller().
    /// @param nonSignersBitmask Bitmask of oracles that did not sign
    function incrementMissedCounts(uint256 nonSignersBitmask) external;

    /// @notice Get all registered oracles
    /// @return An array of all oracle structs
    function getOracles() external view returns (TypesLib.Oracle[] memory);

    /// @notice Check if an address is a registered active oracle
    /// @param addr The address to check
    /// @return True if the address belongs to an active oracle
    function isActiveOracle(address addr) external view returns (bool);

    /// @notice Get active oracle count
    /// @return Number of active oracles
    function activeOracleCount() external view returns (uint256);

    /// @notice Verify signer bitmap and return signer count
    /// @param signerBitmap Bitmap of oracle IDs that signed (bit i = oracle i signed)
    /// @return signerCount Number of valid active signers
    /// @return oracleIds Array of oracle IDs that signed
    function verifySignerBitmap(uint256 signerBitmap) external view returns (uint256 signerCount, uint256[] memory oracleIds);

    /// @notice Get individual BLS pubkeys for a list of oracle IDs
    /// @param oracleIds Array of oracle IDs
    /// @return pubkeys Array of BLS G2 public keys (128 bytes each)
    function getOraclePubkeys(uint256[] calldata oracleIds) external view returns (bytes[] memory pubkeys);

    /// @notice Decode a bitmap into an array of set bit indices
    /// @param bitmap The bitmap to decode
    /// @return ids Array of indices where bits are set
    function decodeBitmap(uint256 bitmap) external pure returns (uint256[] memory ids);

    /// @notice Verify a BLS signature against individual signer pubkeys using multi-pairing
    /// @dev Decodes bitmap, fetches pubkeys, and does e(-sig, G2) * e(H(msg), pk[0]) * ... == 1
    /// @param signersBitmask Bitmap of oracles that signed
    /// @param messageHash The message hash
    /// @param blsSignature The aggregated BLS signature (64 bytes G1 point)
    /// @return True if signature is valid
    function verifyBLSMultiPairing(
        uint256 signersBitmask,
        bytes32 messageHash,
        bytes calldata blsSignature
    ) external view returns (bool);

    /// @notice Get pending key rotation details
    /// @param oracleId The oracle ID
    /// @return rotation The key rotation struct (empty if none pending)
    function getPendingRotation(uint256 oracleId) external view returns (TypesLib.KeyRotation memory rotation);

    /// @notice Check if a key rotation can be executed
    /// @dev Returns true if timelock passed AND required approvals received AND safe period elapsed
    /// @param oracleId The oracle ID
    /// @return Whether rotation can be executed
    function canExecuteRotation(uint256 oracleId) external view returns (bool);

    // ============ REGISTRY SYNC (Story 8.1) ============

    /// @notice Get current registry nonce for sync tracking
    /// @dev Incremented on every state change (add/remove oracle, key rotation)
    /// @return The current registry nonce
    function registryNonce() external view returns (uint256);

    /// @notice Compute hash of all active oracle pubkeys for state verification
    /// @dev Returns keccak256 of all active oracle pubkeys concatenated in ID order
    /// @return The registry state hash
    function getRegistryStateHash() external view returns (bytes32);

    // ============ CONSTANTS ============

    /// @notice Key rotation approval threshold (10/19 other oracles)
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

    /// @notice Get connection details for all active oracles
    /// @dev Used by new oracle nodes for P2P bootstrap
    /// @return ids Array of active oracle IDs
    /// @return ips Array of IP addresses (packed as bytes32)
    /// @return pubkeys Array of BLS public keys
    function getActiveOracleEndpoints()
        external
        view
        returns (uint256[] memory ids, bytes32[] memory ips, bytes[] memory pubkeys);

    /// @notice Update an oracle's IP address
    /// @param oracleId The oracle whose IP to update
    /// @param newIp The new IP address (packed as bytes32)
    /// @param blsSignature BLS signature proving ownership
    function updateOracleIp(uint256 oracleId, bytes32 newIp, bytes calldata blsSignature) external;

    // ============ CONSENSUS PAUSE ============

    /// @notice Emergency: update the governance contract address
    /// @dev Escape hatch for Orbit nonce divergence — if initialize() stored a stale
    ///      Governance proxy address, this lets the current admin fix it.
    /// @param newGovernance The correct Governance contract address
    function setGovernance(address newGovernance) external;

    /// @notice Whether consensus is currently paused
    /// @return True if consensus is paused
    function consensusPaused() external view returns (bool);

    /// @notice Pause or unpause consensus (admin circuit breaker)
    /// @param paused Whether to pause consensus
    function setConsensusPaused(bool paused) external;

    // ============ EVENTS ============

    /// @notice Emitted when a new oracle is added
    /// @param oracleId The assigned oracle ID
    /// @param addr Oracle's Ethereum address
    /// @param blsPubkey Oracle's BLS public key
    event OracleAdded(uint256 indexed oracleId, address indexed addr, bytes blsPubkey);

    /// @notice Emitted when an oracle is removed
    /// @param oracleId The removed oracle's ID
    event OracleRemoved(uint256 indexed oracleId);

    /// @notice Emitted when a key rotation is requested
    /// @param oracleId The oracle requesting rotation
    /// @param newPubkey The proposed new BLS public key
    event KeyRotationRequested(uint256 indexed oracleId, bytes newPubkey);

    /// @notice Emitted when a key rotation receives an approval
    /// @param rotatingOracleId The oracle whose key is being rotated
    /// @param approvingOracleId The oracle who approved
    /// @param approvalCount Current number of approvals
    event KeyRotationApproved(
        uint256 indexed rotatingOracleId,
        uint256 indexed approvingOracleId,
        uint256 approvalCount
    );

    /// @notice Emitted when a key rotation is executed
    /// @param oracleId The oracle whose key was rotated
    /// @param oldPubkey The previous BLS public key
    /// @param newPubkey The new BLS public key
    event KeyRotationExecuted(uint256 indexed oracleId, bytes oldPubkey, bytes newPubkey);

    /// @notice Emitted when admin forces a rotation window
    /// @param oracleId The oracle whose rotation was forced
    event RotationWindowForced(uint256 indexed oracleId);

    /// @notice Emitted when a key rotation is cancelled
    /// @param oracleId The oracle whose rotation was cancelled
    event KeyRotationCancelled(uint256 indexed oracleId);
}
