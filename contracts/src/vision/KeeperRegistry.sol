// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title KeeperRegistry
/// @notice Registry for keepers participating in arbitration with BLS key management
/// @dev Part of the bilateral custody system for dispute resolution
contract KeeperRegistry is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ Enums ============

    enum KeeperStatus {
        Inactive, // 0 - Not registered or deregistered
        Active, // 1 - Actively participating in arbitration
        Suspended // 2 - Temporarily suspended (can be reinstated)
    }

    // ============ Structs ============

    struct Keeper {
        address addr; // Keeper's wallet address
        bytes32 ip; // IP address as bytes32 (e.g., "192.168.1.1:8080")
        bytes blsPubkey; // BLS public key (64 bytes for alt_bn128)
        KeeperStatus status; // Current status
        uint256 registeredAt; // Registration timestamp
        uint256 stakedAmount; // Amount of WIND staked
    }

    struct PendingKeyRotation {
        bytes newPubkey; // New BLS public key
        uint256 requestedAt; // When rotation was requested
        uint256 approvalCount; // Number of approvals received
        uint256 rotationNonce; // Increments on each new request to invalidate old approvals
        bool executed; // Whether rotation was executed
    }

    struct OldKeyInfo {
        bytes oldPubkey; // Previous BLS key
        uint256 validUntil; // Timestamp when old key expires
    }

    // ============ Constants ============

    IERC20 public immutable WIND;
    address public immutable ADMIN;

    uint256 public constant MIN_STAKE = 100 * 10 ** 18; // 100 WIND (18 decimals)
    uint256 public constant SAFE_PERIOD = 24 hours; // Old key validity period after rotation
    uint256 public constant FORCE_TIMEOUT = 48 hours; // Admin force rotation timeout
    uint256 public constant BLS_PUBKEY_LENGTH = 128; // BLS G2 point (4 x 32 bytes)

    // ============ State Variables ============

    mapping(address => Keeper) public keepers;
    address[] public keeperAddresses;
    mapping(address => PendingKeyRotation) private _pendingRotations;
    // Approvals keyed by: keeper => nonce => approver => approved
    mapping(address => mapping(uint256 => mapping(address => bool))) private _rotationApprovals;
    mapping(address => OldKeyInfo) public oldKeys; // For safe period transitions

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

    // ============ Modifiers ============

    modifier onlyAdmin() {
        if (msg.sender != ADMIN) revert OnlyAdmin();
        _;
    }

    modifier onlyActiveKeeper() {
        if (keepers[msg.sender].status != KeeperStatus.Active) {
            revert OnlyActiveKeeper();
        }
        _;
    }

    // ============ Constructor ============

    constructor(address _windToken, address _admin) {
        if (_windToken == address(0) || _admin == address(0)) revert ZeroAddress();
        WIND = IERC20(_windToken);
        ADMIN = _admin;
    }

    // ============ Registration Functions ============

    /// @notice Register as a keeper with stake and BLS public key
    /// @param ip IP address as bytes32 (pack with bytes32(bytes("ip:port")))
    /// @param blsPubkey BLS public key (64 bytes for alt_bn128 G1 point)
    function registerKeeper(bytes32 ip, bytes calldata blsPubkey) external nonReentrant {
        if (keepers[msg.sender].status != KeeperStatus.Inactive) {
            revert AlreadyRegistered();
        }
        if (ip == bytes32(0)) revert InvalidIP();
        if (blsPubkey.length != BLS_PUBKEY_LENGTH) revert InvalidPubkey();

        // Transfer stake
        WIND.safeTransferFrom(msg.sender, address(this), MIN_STAKE);

        // Register keeper
        keepers[msg.sender] = Keeper({
            addr: msg.sender,
            ip: ip,
            blsPubkey: blsPubkey,
            status: KeeperStatus.Active,
            registeredAt: block.timestamp,
            stakedAmount: MIN_STAKE
        });
        keeperAddresses.push(msg.sender);

        emit KeeperRegistered(msg.sender, ip, blsPubkey, MIN_STAKE);
    }

    /// @notice Update keeper's IP address
    /// @param newIP New IP address as bytes32
    function updateIP(bytes32 newIP) external onlyActiveKeeper {
        if (newIP == bytes32(0)) revert InvalidIP();
        keepers[msg.sender].ip = newIP;
        emit KeeperUpdated(msg.sender, newIP);
    }

    // ============ Status Management ============

    /// @notice Suspend a keeper (admin only for v1)
    /// @param keeper Address of keeper to suspend
    function suspendKeeper(address keeper) external onlyAdmin {
        if (keepers[keeper].status != KeeperStatus.Active) {
            revert KeeperNotActive(keeper);
        }
        keepers[keeper].status = KeeperStatus.Suspended;
        emit KeeperSuspended(keeper, msg.sender);
    }

    /// @notice Reinstate a suspended keeper (admin only)
    /// @param keeper Address of keeper to reinstate
    function reinstateKeeper(address keeper) external onlyAdmin {
        if (keepers[keeper].status != KeeperStatus.Suspended) {
            revert NotRegistered();
        }
        keepers[keeper].status = KeeperStatus.Active;
        emit KeeperReinstated(keeper);
    }

    // ============ Key Rotation Functions ============

    /// @notice Request BLS key rotation
    /// @param newPubkey New BLS public key (64 bytes)
    function requestKeyRotation(bytes calldata newPubkey) external onlyActiveKeeper {
        if (newPubkey.length != BLS_PUBKEY_LENGTH) revert InvalidPubkey();

        PendingKeyRotation storage rotation = _pendingRotations[msg.sender];
        rotation.newPubkey = newPubkey;
        rotation.requestedAt = block.timestamp;
        rotation.approvalCount = 0;
        rotation.rotationNonce++; // Increment nonce to invalidate all previous approvals
        rotation.executed = false;

        emit KeyRotationRequested(msg.sender, newPubkey);
    }

    /// @notice Approve another keeper's key rotation
    /// @param keeper Address of keeper whose rotation to approve
    function approveKeyRotation(address keeper) external onlyActiveKeeper {
        if (keeper == msg.sender) revert CannotApproveSelf();

        PendingKeyRotation storage rotation = _pendingRotations[keeper];
        if (rotation.requestedAt == 0 || rotation.executed) {
            revert NotPendingRotation();
        }
        // Use nonce to ensure approvals are for the current rotation request only
        if (_rotationApprovals[keeper][rotation.rotationNonce][msg.sender]) revert AlreadyApproved();

        _rotationApprovals[keeper][rotation.rotationNonce][msg.sender] = true;
        rotation.approvalCount++;

        emit KeyRotationApproved(keeper, msg.sender, rotation.approvalCount);
    }

    /// @notice Execute key rotation after approval threshold met
    function executeKeyRotation() external onlyActiveKeeper {
        PendingKeyRotation storage rotation = _pendingRotations[msg.sender];
        if (rotation.requestedAt == 0 || rotation.executed) {
            revert NotPendingRotation();
        }

        uint256 threshold = _calculateThreshold();
        if (rotation.approvalCount < threshold) {
            revert RotationNotApproved();
        }

        _executeRotation(msg.sender);
    }

    /// @notice Force key rotation after timeout (admin escape hatch)
    /// @param keeper Address of keeper whose rotation to force
    function forceKeyRotation(address keeper) external onlyAdmin {
        PendingKeyRotation storage rotation = _pendingRotations[keeper];
        if (rotation.requestedAt == 0 || rotation.executed) {
            revert NotPendingRotation();
        }

        uint256 elapsed = block.timestamp - rotation.requestedAt;
        if (elapsed < FORCE_TIMEOUT) {
            revert TimeoutNotReached(FORCE_TIMEOUT - elapsed);
        }

        _executeRotation(keeper);
        emit KeyRotationForced(keeper, rotation.newPubkey);
    }

    /// @notice Cancel a pending key rotation request
    function cancelKeyRotation() external onlyActiveKeeper {
        PendingKeyRotation storage rotation = _pendingRotations[msg.sender];
        if (rotation.requestedAt == 0 || rotation.executed) {
            revert NotPendingRotation();
        }

        // Mark as executed to prevent further approvals/execution
        rotation.executed = true;
        rotation.requestedAt = 0;

        emit KeyRotationCancelled(msg.sender);
    }

    // ============ View Functions ============

    /// @notice Get all active keepers
    /// @return addresses Array of keeper addresses
    /// @return ips Array of keeper IPs
    /// @return pubkeys Array of BLS public keys
    function getActiveKeepers()
        external
        view
        returns (address[] memory addresses, bytes32[] memory ips, bytes[] memory pubkeys)
    {
        uint256 activeCount = 0;
        for (uint256 i = 0; i < keeperAddresses.length; i++) {
            if (keepers[keeperAddresses[i]].status == KeeperStatus.Active) {
                activeCount++;
            }
        }

        addresses = new address[](activeCount);
        ips = new bytes32[](activeCount);
        pubkeys = new bytes[](activeCount);

        uint256 idx = 0;
        for (uint256 i = 0; i < keeperAddresses.length; i++) {
            address keeperAddr = keeperAddresses[i];
            if (keepers[keeperAddr].status == KeeperStatus.Active) {
                addresses[idx] = keeperAddr;
                ips[idx] = keepers[keeperAddr].ip;
                pubkeys[idx] = keepers[keeperAddr].blsPubkey;
                idx++;
            }
        }
    }

    /// @notice Get keeper information
    /// @param keeper Address of keeper
    /// @return Keeper struct
    function getKeeperInfo(address keeper) external view returns (Keeper memory) {
        return keepers[keeper];
    }

    /// @notice Get total number of keepers (all statuses)
    function getKeeperCount() external view returns (uint256) {
        return keeperAddresses.length;
    }

    /// @notice Get number of active keepers
    function getActiveKeeperCount() external view returns (uint256 count) {
        for (uint256 i = 0; i < keeperAddresses.length; i++) {
            if (keepers[keeperAddresses[i]].status == KeeperStatus.Active) {
                count++;
            }
        }
    }

    /// @notice Check if address is an active keeper
    function isActiveKeeper(address addr) external view returns (bool) {
        return keepers[addr].status == KeeperStatus.Active;
    }

    /// @notice Get old pubkey if still valid during transition
    /// @param keeper Keeper address
    /// @return pubkey Old public key if valid, empty bytes if not
    function getOldPubkey(address keeper) external view returns (bytes memory pubkey) {
        OldKeyInfo storage oldKey = oldKeys[keeper];
        if (block.timestamp <= oldKey.validUntil) {
            return oldKey.oldPubkey;
        }
        return "";
    }

    /// @notice Get pending rotation details
    /// @param keeper Keeper address
    /// @return newPubkey The requested new pubkey
    /// @return requestedAt When the rotation was requested
    /// @return approvalCount Number of approvals received
    /// @return threshold Required approvals
    function getPendingRotation(address keeper)
        external
        view
        returns (bytes memory newPubkey, uint256 requestedAt, uint256 approvalCount, uint256 threshold)
    {
        PendingKeyRotation storage rotation = _pendingRotations[keeper];
        return (rotation.newPubkey, rotation.requestedAt, rotation.approvalCount, _calculateThreshold());
    }

    /// @notice Check if an approver has approved a keeper's current rotation
    /// @param keeper The keeper with pending rotation
    /// @param approver The address to check
    /// @return True if approver has approved the current rotation
    function hasApprovedRotation(address keeper, address approver) external view returns (bool) {
        PendingKeyRotation storage rotation = _pendingRotations[keeper];
        return _rotationApprovals[keeper][rotation.rotationNonce][approver];
    }

    // ============ Internal Functions ============

    /// @notice Calculate approval threshold (2-of-3 for disputes)
    /// @dev ceil(active_keepers * 2 / 3) for 2/3 majority
    function _calculateThreshold() internal view returns (uint256) {
        uint256 activeCount = 0;
        for (uint256 i = 0; i < keeperAddresses.length; i++) {
            if (keepers[keeperAddresses[i]].status == KeeperStatus.Active) {
                activeCount++;
            }
        }

        // For self-excluded (n-1 keepers can approve), we need threshold from n-1
        // 3 keepers: 2 can approve, need 2 (2-of-2)
        // 4 keepers: 3 can approve, need 2 (2-of-3)
        // 5 keepers: 4 can approve, need 3 (3-of-4)
        if (activeCount <= 1) return 0; // Cannot rotate with 1 or fewer

        uint256 voters = activeCount - 1; // Exclude self
        return (voters * 2 + 2) / 3; // ceil(voters * 2 / 3)
    }

    /// @notice Execute the key rotation
    /// @param keeper Keeper address
    function _executeRotation(address keeper) internal {
        PendingKeyRotation storage rotation = _pendingRotations[keeper];

        // Store old key for safe period
        oldKeys[keeper] = OldKeyInfo({ oldPubkey: keepers[keeper].blsPubkey, validUntil: block.timestamp + SAFE_PERIOD });

        bytes memory oldPubkey = keepers[keeper].blsPubkey;

        // Update to new key
        keepers[keeper].blsPubkey = rotation.newPubkey;
        rotation.executed = true;

        emit KeyRotationExecuted(keeper, oldPubkey, rotation.newPubkey);
    }
}
