// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IKeeperRegistry - Keeper registry interface
/// @notice Registry for keepers participating in arbitration with BLS key management
/// @dev Part of the bilateral custody system for dispute resolution
interface IKeeperRegistry {
    // ============ Enums ============

    enum KeeperStatus {
        Inactive,   // 0 - Not registered or deregistered
        Active,     // 1 - Actively participating in arbitration
        Suspended   // 2 - Temporarily suspended (can be reinstated)
    }

    // ============ Structs ============

    struct Keeper {
        address addr;           // Keeper's wallet address
        bytes32 ip;             // IP address as bytes32 (e.g., "192.168.1.1:8080")
        bytes blsPubkey;        // BLS public key (64 bytes for alt_bn128)
        KeeperStatus status;    // Current status
        uint256 registeredAt;   // Registration timestamp
        uint256 stakedAmount;   // Amount of WIND staked
    }

    struct OldKeyInfo {
        bytes oldPubkey;        // Previous BLS key
        uint256 validUntil;     // Timestamp when old key expires
    }

    // ============ Custom Errors ============

    error NotRegistered();
    error AlreadyRegistered();
    error InsufficientStake(uint256 required, uint256 provided);
    error InvalidPubkey();
    error InvalidIP();
    error NotPendingRotation();
    error RotationNotApproved();
    error AlreadyApproved();
    error CannotApproveSelf();
    error TimeoutNotReached(uint256 remaining);
    error OnlyAdmin();
    error OnlyActiveKeeper();
    error KeeperNotActive(address keeper);
    error ZeroAddress();

    // ============ Events ============

    event KeeperRegistered(address indexed keeper, bytes32 indexed ip, bytes blsPubkey, uint256 stake);
    event KeeperUpdated(address indexed keeper, bytes32 newIP);
    event KeeperSuspended(address indexed keeper, address indexed suspendedBy);
    event KeeperReinstated(address indexed keeper);
    event KeyRotationRequested(address indexed keeper, bytes newPubkey);
    event KeyRotationApproved(address indexed keeper, address indexed approver, uint256 currentApprovals);
    event KeyRotationExecuted(address indexed keeper, bytes oldPubkey, bytes newPubkey);
    event KeyRotationForced(address indexed keeper, bytes newPubkey);
    event KeyRotationCancelled(address indexed keeper);

    // ============ Registration Functions ============

    /// @notice Register as a keeper with stake and BLS public key
    /// @param ip IP address as bytes32 (pack with bytes32(bytes("ip:port")))
    /// @param blsPubkey BLS public key (64 bytes for alt_bn128 G1 point)
    function registerKeeper(bytes32 ip, bytes calldata blsPubkey) external;

    /// @notice Update keeper's IP address
    /// @param newIP New IP address as bytes32
    function updateIP(bytes32 newIP) external;

    // ============ Status Management ============

    /// @notice Suspend a keeper (admin only for v1)
    /// @param keeper Address of keeper to suspend
    function suspendKeeper(address keeper) external;

    /// @notice Reinstate a suspended keeper (admin only)
    /// @param keeper Address of keeper to reinstate
    function reinstateKeeper(address keeper) external;

    // ============ Key Rotation Functions ============

    /// @notice Request BLS key rotation
    /// @param newPubkey New BLS public key (64 bytes)
    function requestKeyRotation(bytes calldata newPubkey) external;

    /// @notice Approve another keeper's key rotation
    /// @param keeper Address of keeper whose rotation to approve
    function approveKeyRotation(address keeper) external;

    /// @notice Execute key rotation after approval threshold met
    function executeKeyRotation() external;

    /// @notice Force key rotation after timeout (admin escape hatch)
    /// @param keeper Address of keeper whose rotation to force
    function forceKeyRotation(address keeper) external;

    /// @notice Cancel a pending key rotation request
    function cancelKeyRotation() external;

    // ============ View Functions ============

    /// @notice Get all active keepers
    /// @return addresses Array of keeper addresses
    /// @return ips Array of keeper IPs
    /// @return pubkeys Array of BLS public keys
    function getActiveKeepers()
        external
        view
        returns (address[] memory addresses, bytes32[] memory ips, bytes[] memory pubkeys);

    /// @notice Get keeper information
    /// @param keeper Address of keeper
    /// @return Keeper struct
    function getKeeperInfo(address keeper) external view returns (Keeper memory);

    /// @notice Get total number of keepers (all statuses)
    function getKeeperCount() external view returns (uint256);

    /// @notice Get number of active keepers
    function getActiveKeeperCount() external view returns (uint256 count);

    /// @notice Check if address is an active keeper
    function isActiveKeeper(address addr) external view returns (bool);

    /// @notice Get old pubkey if still valid during transition
    /// @param keeper Keeper address
    /// @return pubkey Old public key if valid, empty bytes if not
    function getOldPubkey(address keeper) external view returns (bytes memory pubkey);

    /// @notice Get pending rotation details
    /// @param keeper Keeper address
    /// @return newPubkey The requested new pubkey
    /// @return requestedAt When the rotation was requested
    /// @return approvalCount Number of approvals received
    /// @return threshold Required approvals
    function getPendingRotation(address keeper)
        external
        view
        returns (bytes memory newPubkey, uint256 requestedAt, uint256 approvalCount, uint256 threshold);

    /// @notice Check if an approver has approved a keeper's current rotation
    /// @param keeper The keeper with pending rotation
    /// @param approver The address to check
    /// @return True if approver has approved the current rotation
    function hasApprovedRotation(address keeper, address approver) external view returns (bool);

    // ============ Public State Accessors ============

    /// @notice The WIND token used for staking
    function WIND() external view returns (address);

    /// @notice Admin address
    function ADMIN() external view returns (address);

    /// @notice Minimum stake required (100 WIND)
    function MIN_STAKE() external view returns (uint256);

    /// @notice Old key validity period after rotation (24 hours)
    function SAFE_PERIOD() external view returns (uint256);

    /// @notice Admin force rotation timeout (48 hours)
    function FORCE_TIMEOUT() external view returns (uint256);

    /// @notice BLS public key length (128 bytes)
    function BLS_PUBKEY_LENGTH() external view returns (uint256);

    /// @notice Mapping of keeper addresses to keeper data
    function keepers(address keeper) external view returns (
        address addr,
        bytes32 ip,
        bytes memory blsPubkey,
        KeeperStatus status,
        uint256 registeredAt,
        uint256 stakedAmount
    );

    /// @notice Array of all keeper addresses
    function keeperAddresses(uint256 index) external view returns (address);

    /// @notice Mapping of keeper addresses to old key info
    function oldKeys(address keeper) external view returns (bytes memory oldPubkey, uint256 validUntil);
}
