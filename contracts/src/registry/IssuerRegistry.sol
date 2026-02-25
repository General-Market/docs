// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IIssuerRegistry} from "../interfaces/IIssuerRegistry.sol";
import {IGovernance} from "../interfaces/IGovernance.sol";
import {TypesLib} from "../libraries/TypesLib.sol";
import {ErrorsLib} from "../libraries/ErrorsLib.sol";
import {EventsLib} from "../libraries/EventsLib.sol";
import {BLSLib} from "../libraries/BLSLib.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/// @title IssuerRegistry - Issuer node management for Index L3
/// @notice Registry for issuer nodes, their BLS public keys, and aggregated key management
/// @dev UUPS upgradeable. Story 2.12 covers core registry; Story 2.13 covers key rotation
/// @custom:security-contact security@indexprotocol.com
contract IssuerRegistry is IIssuerRegistry, Initializable, UUPSUpgradeable {
    // ============ ERRORS ============

    /// @notice Thrown when caller is not the admin
    error Unauthorized();

    /// @notice Thrown when issuer address is zero
    error ZeroAddress();

    /// @notice Thrown when issuer ID is invalid or not found
    error IssuerNotFound(uint256 issuerId);

    /// @notice Thrown when issuer is not active
    error IssuerNotActive(uint256 issuerId);

    /// @notice Thrown when issuer is already active
    error IssuerAlreadyActive(uint256 issuerId);

    /// @notice Thrown when BLS public key has invalid length
    error InvalidPubkeyLength(uint256 length);

    /// @notice Thrown when BLS signature verification fails
    error InvalidBLSSignature();

    /// @notice Thrown when rotation request doesn't exist
    error NoRotationPending(uint256 issuerId);

    /// @notice Thrown when rotation is already pending
    error RotationAlreadyPending(uint256 issuerId);

    /// @notice Thrown when self-approval is attempted
    error SelfApprovalNotAllowed();

    /// @notice Thrown when issuer has already approved
    error AlreadyApproved(uint256 approvingIssuerId);

    /// @notice Thrown when insufficient approvals for rotation
    error InsufficientApprovals(uint256 current, uint256 required);

    /// @notice Thrown when timelock has not expired
    error TimelockNotExpired(uint256 unlockTime, uint256 currentTime);

    /// @notice Thrown when safe period has not elapsed
    error SafePeriodNotElapsed(uint256 lastApprovalTime, uint256 requiredWait);

    /// @notice Thrown when admin force window has not elapsed
    error ForceWindowNotElapsed(uint256 requestTime, uint256 requiredWait);

    /// @notice Thrown when BLS verification is attempted but not yet supported
    /// @dev BLSLib.verifyBLS expects G2 pubkeys (128 bytes) but we store G1 pubkeys (64 bytes)
    /// for on-chain aggregation. This architectural mismatch requires BLSLib updates.
    error BLSVerificationNotYetSupported();

    /// @notice Thrown when rotation has already been executed
    error RotationAlreadyExecuted(uint256 issuerId);

    /// @notice Emitted when aggregated pubkey is updated
    event AggregatedPubkeyUpdated(bytes pubkey);

    /// @notice Thrown when pubkey is not on curve
    error PubkeyNotOnCurve();

    /// @notice Thrown when new pubkey is same as current pubkey
    error SamePubkey();

    /// @notice Thrown when BLS pubkey is already registered to another issuer
    /// @param existingIssuerId The issuer that already has this pubkey
    error IssuerRegistry__PubkeyAlreadyRegistered(uint256 existingIssuerId);

    /// @notice Thrown when Proof of Possession BLS signature is invalid
    error IssuerRegistry__InvalidPoP();

    /// @notice Thrown when a snapshot is pending (must call setAggregatedPubkey before further mutations)
    error IssuerRegistry__PendingSnapshot();

    // ============ CONSTANTS ============

    /// @notice Key rotation approval threshold (10/19 other issuers)
    uint256 public constant override ROTATION_THRESHOLD = 10;

    /// @notice Key rotation timelock duration (24 hours)
    uint256 public constant override ROTATION_TIMELOCK = 24 hours;

    /// @notice Safe period after last approval (1 hour)
    uint256 public constant override SAFE_PERIOD = 1 hours;

    /// @notice Admin force window (48 hours)
    uint256 public constant override ADMIN_FORCE_WINDOW = 48 hours;

    /// @notice Expected BLS G2 public key length (128 bytes: x_im, x_re, y_im, y_re)
    uint256 private constant PUBKEY_LENGTH = 128;

    /// @notice Grace period cycles for old key validity after rotation
    uint256 public constant ROTATION_GRACE_CYCLES = 10;

    // ============ STORAGE ============

    /// @dev Governance contract for admin checks
    IGovernance private _governance;

    /// @dev Issuer data by ID
    mapping(uint256 => TypesLib.Issuer) private _issuers;

    /// @dev Total number of issuers ever registered (for ID assignment)
    uint256 private _issuerCount;

    /// @dev Count of currently active issuers
    uint256 private _activeCount;

    /// @dev DEPRECATED: Aggregated BLS public key (G2 aggregation not possible on-chain)
    /// @dev G2 addition requires field extension arithmetic not available via precompiles
    /// @dev Aggregation is computed off-chain; this storage is kept for upgrade compatibility
    uint256[2] private _aggregatedPubkey_DEPRECATED;

    /// @dev Pending key rotation requests by issuer ID
    mapping(uint256 => TypesLib.KeyRotation) private _pendingRotations;

    /// @dev Approval tracking for rotations: rotatingIssuerId => approvingIssuerId => approvalTimestamp
    /// @dev Approvals are only valid if timestamp >= rotation.requestedAt (prevents carryover after cancel)
    mapping(uint256 => mapping(uint256 => uint256)) private _rotationApprovals;

    /// @dev Last approval timestamp for rotation safe period check
    mapping(uint256 => uint256) private _lastApprovalTime;

    /// @dev Grace period expiry cycle for old keys (keccak256(pubkey) => cycle)
    mapping(bytes32 => uint256) private _keyGracePeriod;

    /// @dev Admin force window enabled for rotation (issuerId => enabled)
    mapping(uint256 => bool) private _forceWindowEnabled;

    /// @dev Current cycle number (for grace period tracking)
    uint256 private _currentCycle;

    /// @dev Registry nonce — incremented on every state change (add/remove issuer, key rotation)
    /// @dev Used for MirrorIssuerRegistry sync tracking and replay protection
    uint256 private _registryNonce;

    /// @dev Aggregated BLS G2 public key (computed off-chain, stored for getAggregatedPubkey)
    bytes private _aggregatedPubkey;

    /// @dev Whether consensus is paused (admin circuit breaker)
    bool public consensusPaused;

    /// @dev Pubkey hash to issuer ID + 1 (0 = not registered, N = issuer N-1)
    /// @dev Sentinel +1 avoids collision with issuer ID 0
    mapping(bytes32 => uint256) private _pubkeyHashToIssuerId;

    /// @dev Latest snapshot nonce (set when setAggregatedPubkey is called)
    uint256 public lastSnapshotNonce;

    /// @dev Registry snapshots by nonce
    mapping(uint256 => TypesLib.RegistrySnapshot) private _nonceSnapshots;

    /// @dev Advisory missed-round count per issuer ID (public, permissionless increment)
    mapping(uint256 => uint256) public issuerMissedCount;

    /// @dev Storage gap for upgrade safety (reduced from 32 to 29 for lastSnapshotNonce + _nonceSnapshots + issuerMissedCount)
    uint256[29] private __gap;

    // ============ CONSTRUCTOR ============

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // ============ INITIALIZER ============

    /// @notice Initialize the IssuerRegistry contract
    /// @param governance_ The Governance contract address
    function initialize(address governance_) external initializer {
        if (governance_ == address(0)) revert ZeroAddress();
        __UUPSUpgradeable_init();
        _governance = IGovernance(governance_);
    }

    // ============ MODIFIERS ============

    /// @notice Restricts function to admin only
    modifier onlyAdmin() {
        if (msg.sender != _governance.admin()) revert Unauthorized();
        _;
    }

    // ============ ISSUER MANAGEMENT ============

    /// @inheritdoc IIssuerRegistry
    function addIssuer(
        address issuerAddr,
        bytes32 ip,
        bytes calldata blsPubkey,
        bytes calldata blsPopSignature
    ) external override onlyAdmin returns (uint256 issuerId) {
        if (lastSnapshotNonce != _registryNonce) revert IssuerRegistry__PendingSnapshot();
        if (issuerAddr == address(0)) revert ZeroAddress();
        if (blsPubkey.length != PUBKEY_LENGTH) revert InvalidPubkeyLength(blsPubkey.length);

        // Reject all-zeros pubkey
        bool allZeros = true;
        for (uint256 i = 0; i < 32 && i < blsPubkey.length; i++) {
            if (blsPubkey[i] != 0) {
                allZeros = false;
                break;
            }
        }
        if (allZeros) revert InvalidPubkeyLength(0);

        // Key uniqueness: reject if pubkey already registered to another issuer
        bytes32 pubkeyHash = keccak256(blsPubkey);
        uint256 existingSentinel = _pubkeyHashToIssuerId[pubkeyHash];
        if (existingSentinel != 0) {
            revert IssuerRegistry__PubkeyAlreadyRegistered(existingSentinel - 1);
        }

        // Proof of Possession: verify issuer controls the BLS private key
        // Domain-separated message: prevents cross-chain/cross-contract replay
        {
            bytes32 popMessage = keccak256(abi.encode(
                "INDEX_BLS_POP", block.chainid, address(this), issuerAddr, blsPubkey
            ));
            if (!BLSLib.verifyBLS(blsPubkey, popMessage, blsPopSignature)) {
                revert IssuerRegistry__InvalidPoP();
            }
        }

        // Assign new issuer ID
        issuerId = _issuerCount++;

        // Store issuer data
        _issuers[issuerId] = TypesLib.Issuer({
            addr: issuerAddr,
            ip: ip,
            blsPubkey: blsPubkey,
            status: 1, // active
            registeredAt: block.timestamp
        });

        // Update active count
        _activeCount++;

        // Register pubkey in uniqueness mapping (sentinel = issuerId + 1)
        _pubkeyHashToIssuerId[pubkeyHash] = issuerId + 1;

        emit IssuerAdded(issuerId, issuerAddr, blsPubkey);

        // Emit registry state change for MirrorIssuerRegistry sync (Story 8.1)
        _emitStateChange();
    }

    /// @inheritdoc IIssuerRegistry
    function removeIssuer(uint256 issuerId) external override {
        if (lastSnapshotNonce != _registryNonce) revert IssuerRegistry__PendingSnapshot();
        TypesLib.Issuer storage issuer = _issuers[issuerId];

        // Validate issuer exists and is active
        if (issuer.addr == address(0)) revert IssuerNotFound(issuerId);
        if (issuer.status != 1) revert IssuerNotActive(issuerId);

        // Check authorization: admin can always remove
        bool isAdmin = msg.sender == _governance.admin();

        if (!isAdmin) {
            // For non-admin, would need BLS vote verification
            // This is a placeholder - full BLS vote implementation would verify
            // a signature from 11/20 issuers on the removal message
            revert Unauthorized();
        }

        // Clear pubkey uniqueness mapping
        delete _pubkeyHashToIssuerId[keccak256(issuer.blsPubkey)];

        // Deactivate issuer
        issuer.status = 0; // inactive
        _activeCount--;

        emit IssuerRemoved(issuerId);

        // Emit registry state change for MirrorIssuerRegistry sync (Story 8.1)
        _emitStateChange();
    }

    /// @notice Remove an issuer via BLS vote from other issuers
    /// @param issuerId The issuer to remove
    /// @param blsSignature Aggregated BLS signature over the removal message
    /// @param referenceNonce Registry snapshot nonce for historical pubkey lookup
    /// @param signersBitmask Bitmask of issuers that signed this vote
    function removeIssuerByVote(
        uint256 issuerId,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external {
        if (lastSnapshotNonce != _registryNonce) revert IssuerRegistry__PendingSnapshot();
        TypesLib.Issuer storage issuer = _issuers[issuerId];
        if (issuer.addr == address(0)) revert IssuerNotFound(issuerId);
        if (issuer.status != 1) revert IssuerNotActive(issuerId);

        // Validate reference nonce is within acceptable window
        uint256 latest = lastSnapshotNonce;
        uint256 minNonce = latest > 256 ? latest - 256 : 0;
        if (referenceNonce < minNonce) revert IssuerNotFound(0); // nonce too old
        if (referenceNonce > latest) revert IssuerNotFound(0);   // nonce future

        // Load snapshot and validate signers
        TypesLib.RegistrySnapshot memory snap = _nonceSnapshots[referenceNonce];
        if ((signersBitmask & ~snap.activeBitmask) != 0) revert InvalidBLSSignature();
        if (_popcount(signersBitmask) < snap.activeCount * 2 / 3 + 1) revert InvalidBLSSignature();

        bytes32 message = keccak256(abi.encode(
            block.chainid, address(this), "removeIssuerByVote", issuerId
        ));

        // Verify against snapshot's aggregated pubkey
        bytes memory pubkey = _fixedToPubkey(snap.aggregatedPubkey);
        if (!BLSLib.verifyBLS(pubkey, message, blsSignature)) {
            revert InvalidBLSSignature();
        }

        // Liveness accounting — advisory only
        uint256 nonSignersBitmask = snap.activeBitmask ^ signersBitmask;
        if (nonSignersBitmask != 0) {
            this.incrementMissedCounts(nonSignersBitmask);
        }

        // Clear pubkey uniqueness mapping
        delete _pubkeyHashToIssuerId[keccak256(issuer.blsPubkey)];

        issuer.status = 0;
        _activeCount--;
        emit IssuerRemoved(issuerId);
        _emitStateChange();
    }

    // ============ KEY ROTATION (Story 2.13, upgraded in Story 7.17) ============
    //
    /// @inheritdoc IIssuerRegistry
    /// @dev BLS verification: issuer signs keccak256(abi.encode("ROTATE", issuerId, newPubkey)) with old key
    /// @dev PoP verification: issuer signs keccak256(abi.encode("INDEX_BLS_POP", chainid, this, addr, newPubkey)) with new key
    function requestKeyRotation(
        uint256 issuerId,
        bytes calldata newPubkey,
        bytes calldata signatureWithOldKey,
        bytes calldata newKeyPopSignature
    ) external override {
        // Validate issuer exists and is active
        TypesLib.Issuer storage issuer = _issuers[issuerId];
        if (issuer.addr == address(0)) revert IssuerNotFound(issuerId);
        if (issuer.status != 1) revert IssuerNotActive(issuerId);

        // Verify BLS signature with issuer's current (old) key
        {
            bytes32 message = keccak256(abi.encode("ROTATE", issuerId, newPubkey));
            if (!BLSLib.verifyBLS(issuer.blsPubkey, message, signatureWithOldKey)) {
                revert ErrorsLib.E086_InvalidRotationSignature();
            }
        }

        // Validate new pubkey length (128 bytes for G2 point)
        if (newPubkey.length != PUBKEY_LENGTH) revert InvalidPubkeyLength(newPubkey.length);

        // Validate new pubkey is different from current pubkey
        bytes32 newPubkeyHash = keccak256(newPubkey);
        if (newPubkeyHash == keccak256(issuer.blsPubkey)) revert SamePubkey();

        // Key uniqueness: reject if new pubkey already registered to another issuer
        {
            uint256 existingSentinel = _pubkeyHashToIssuerId[newPubkeyHash];
            if (existingSentinel != 0 && existingSentinel - 1 != issuerId) {
                revert IssuerRegistry__PubkeyAlreadyRegistered(existingSentinel - 1);
            }
        }

        // Proof of Possession for new key
        {
            bytes32 popMessage = keccak256(abi.encode(
                "INDEX_BLS_POP", block.chainid, address(this), issuer.addr, newPubkey
            ));
            if (!BLSLib.verifyBLS(newPubkey, popMessage, newKeyPopSignature)) {
                revert IssuerRegistry__InvalidPoP();
            }
        }

        // Check no pending rotation exists
        if (_pendingRotations[issuerId].requestedAt != 0) revert RotationAlreadyPending(issuerId);

        // Create rotation request
        _pendingRotations[issuerId] = TypesLib.KeyRotation({
            issuerId: issuerId,
            newPubkey: newPubkey,
            requestedAt: block.timestamp,
            approvalCount: 0,
            executed: false
        });

        emit KeyRotationRequested(issuerId, newPubkey);
    }

    /// @inheritdoc IIssuerRegistry
    /// @dev BLS verification: approver signs keccak256(abi.encode("APPROVE_ROTATION", rotatingIssuerId, rotation.newPubkey))
    function approveRotation(
        uint256 rotatingIssuerId,
        uint256 approvingIssuerId,
        bytes calldata approverSignature
    ) external override {
        // Validate rotation exists and not executed
        TypesLib.KeyRotation storage rotation = _pendingRotations[rotatingIssuerId];
        if (rotation.requestedAt == 0) revert NoRotationPending(rotatingIssuerId);
        if (rotation.executed) revert RotationAlreadyExecuted(rotatingIssuerId);

        // Validate approving issuer exists and is active
        TypesLib.Issuer storage approver = _issuers[approvingIssuerId];
        if (approver.addr == address(0)) revert IssuerNotFound(approvingIssuerId);
        if (approver.status != 1) revert IssuerNotActive(approvingIssuerId);

        // Block self-approval
        if (rotatingIssuerId == approvingIssuerId) revert SelfApprovalNotAllowed();

        // Verify BLS signature from approving issuer
        {
            bytes32 message = keccak256(abi.encode("APPROVE_ROTATION", rotatingIssuerId, rotation.newPubkey));
            if (!BLSLib.verifyBLS(approver.blsPubkey, message, approverSignature)) {
                revert ErrorsLib.E087_InvalidApprovalSignature();
            }
        }

        // Block double-approval (only count approvals made after this rotation was requested)
        // This prevents old approvals from carrying over after cancel+re-request
        if (_rotationApprovals[rotatingIssuerId][approvingIssuerId] >= rotation.requestedAt) {
            revert AlreadyApproved(approvingIssuerId);
        }

        // Record approval with timestamp (used to validate approval belongs to current rotation)
        _rotationApprovals[rotatingIssuerId][approvingIssuerId] = block.timestamp;
        rotation.approvalCount++;

        // Update last approval time for safe period check
        _lastApprovalTime[rotatingIssuerId] = block.timestamp;

        emit KeyRotationApproved(rotatingIssuerId, approvingIssuerId, rotation.approvalCount);
    }

    /// @inheritdoc IIssuerRegistry
    function executeRotation(uint256 issuerId) external override {
        TypesLib.KeyRotation storage rotation = _pendingRotations[issuerId];

        // Validate rotation exists and not executed
        if (rotation.requestedAt == 0) revert NoRotationPending(issuerId);
        if (rotation.executed) revert RotationAlreadyExecuted(issuerId);

        // Check approval threshold
        if (rotation.approvalCount < ROTATION_THRESHOLD) {
            revert InsufficientApprovals(rotation.approvalCount, ROTATION_THRESHOLD);
        }

        // Check timelock (24h since request)
        if (block.timestamp < rotation.requestedAt + ROTATION_TIMELOCK) {
            revert TimelockNotExpired(rotation.requestedAt + ROTATION_TIMELOCK, block.timestamp);
        }

        // Check safe period (1h since last approval) - unless force window enabled
        // NOTE: This is a simplified time-based safe period (Story 2.13 Option B).
        // Architecture spec suggests checking cycle state (idle, no pending batches).
        // TODO: Enhance in future story to integrate with cycle manager for full safety.
        if (!_forceWindowEnabled[issuerId]) {
            uint256 safeTime = _lastApprovalTime[issuerId] + SAFE_PERIOD;
            if (block.timestamp < safeTime) {
                revert SafePeriodNotElapsed(_lastApprovalTime[issuerId], SAFE_PERIOD);
            }
        }

        // Get old pubkey for event
        TypesLib.Issuer storage issuer = _issuers[issuerId];
        bytes memory oldPubkey = issuer.blsPubkey;

        // Update pubkey uniqueness mapping: clear old, set new
        bytes32 oldPubkeyHash = keccak256(oldPubkey);
        delete _pubkeyHashToIssuerId[oldPubkeyHash];
        _pubkeyHashToIssuerId[keccak256(rotation.newPubkey)] = issuerId + 1;

        // Update issuer's pubkey
        issuer.blsPubkey = rotation.newPubkey;

        // Mark rotation as executed
        rotation.executed = true;

        // Set grace period for old key
        _keyGracePeriod[oldPubkeyHash] = _currentCycle + ROTATION_GRACE_CYCLES;

        // Clear force window if set
        if (_forceWindowEnabled[issuerId]) {
            _forceWindowEnabled[issuerId] = false;
        }

        emit KeyRotationExecuted(issuerId, oldPubkey, rotation.newPubkey);

        // Emit registry state change for MirrorIssuerRegistry sync (Story 8.1)
        _emitStateChange();
    }

    /// @inheritdoc IIssuerRegistry
    function forceRotationWindow(uint256 issuerId) external override onlyAdmin {
        TypesLib.KeyRotation storage rotation = _pendingRotations[issuerId];

        // Validate rotation exists and not executed
        if (rotation.requestedAt == 0) revert NoRotationPending(issuerId);
        if (rotation.executed) revert RotationAlreadyExecuted(issuerId);

        // Check 48h window has passed since request
        if (block.timestamp < rotation.requestedAt + ADMIN_FORCE_WINDOW) {
            revert ForceWindowNotElapsed(rotation.requestedAt, ADMIN_FORCE_WINDOW);
        }

        // Enable force window
        _forceWindowEnabled[issuerId] = true;

        emit RotationWindowForced(issuerId);
    }

    /// @inheritdoc IIssuerRegistry
    function cancelRotation(uint256 issuerId) external override onlyAdmin {
        TypesLib.KeyRotation storage rotation = _pendingRotations[issuerId];

        // Validate rotation exists and not executed
        if (rotation.requestedAt == 0) revert NoRotationPending(issuerId);
        if (rotation.executed) revert RotationAlreadyExecuted(issuerId);

        // Clear the rotation
        delete _pendingRotations[issuerId];

        // Clear last approval time
        delete _lastApprovalTime[issuerId];

        // Clear force window if set
        if (_forceWindowEnabled[issuerId]) {
            delete _forceWindowEnabled[issuerId];
        }

        // Note: _rotationApprovals entries are NOT cleared but become invalid automatically
        // because the timestamp-based check requires approvals >= rotation.requestedAt.
        // Any new rotation will have a later requestedAt, invalidating old approvals.

        emit KeyRotationCancelled(issuerId);
    }

    // ============ HELPER FUNCTIONS ============

    /// @notice Check if a public key is in its grace period
    /// @param pubkey The BLS public key to check
    /// @return True if the key is in grace period (still valid)
    function isKeyInGracePeriod(bytes memory pubkey) external view returns (bool) {
        bytes32 pubkeyHash = keccak256(pubkey);
        uint256 gracePeriodEnd = _keyGracePeriod[pubkeyHash];
        if (gracePeriodEnd == 0) return false;
        return _currentCycle <= gracePeriodEnd;
    }

    /// @notice Update the current cycle number
    /// @dev Callable by admin for grace period tracking
    /// @param cycle The new cycle number
    function updateCurrentCycle(uint256 cycle) external onlyAdmin {
        _currentCycle = cycle;
    }

    /// @notice Get the current cycle number
    /// @return The current cycle
    function currentCycle() external view returns (uint256) {
        return _currentCycle;
    }

    // ============ CONSENSUS PAUSE (Phase -1a) ============

    /// @notice Pause or unpause consensus (admin circuit breaker)
    /// @param paused Whether to pause consensus
    function setConsensusPaused(bool paused) external onlyAdmin {
        consensusPaused = paused;
        emit EventsLib.ConsensusPausedChanged(paused);
    }

    // ============ PEER DISCOVERY (Story 7.17) ============

    /// @notice Get connection details for all active issuers
    /// @dev Used by new issuer nodes for P2P bootstrap from on-chain registry
    /// @return ids Array of active issuer IDs
    /// @return ips Array of IP addresses (packed as bytes32)
    /// @return pubkeys Array of BLS public keys
    function getActiveIssuerEndpoints()
        external
        view
        returns (uint256[] memory ids, bytes32[] memory ips, bytes[] memory pubkeys)
    {
        // First pass: count active issuers
        uint256 activeCount = _activeCount;
        ids = new uint256[](activeCount);
        ips = new bytes32[](activeCount);
        pubkeys = new bytes[](activeCount);

        uint256 idx = 0;
        for (uint256 i = 0; i < _issuerCount && idx < activeCount; i++) {
            TypesLib.Issuer storage issuer = _issuers[i];
            if (issuer.addr != address(0) && issuer.status == 1) {
                ids[idx] = i;
                ips[idx] = issuer.ip;
                pubkeys[idx] = issuer.blsPubkey;
                idx++;
            }
        }
    }

    /// @notice Update an issuer's IP address
    /// @param issuerId The issuer whose IP to update
    /// @param newIp The new IP address (packed as bytes32)
    /// @param blsSignature BLS signature proving ownership
    function updateIssuerIp(uint256 issuerId, bytes32 newIp, bytes calldata blsSignature) external {
        TypesLib.Issuer storage issuer = _issuers[issuerId];
        if (issuer.addr == address(0)) revert IssuerNotFound(issuerId);
        if (issuer.status != 1) revert IssuerNotActive(issuerId);

        {
            bytes32 message = keccak256(abi.encode("UPDATE_IP", issuerId, newIp));
            if (!BLSLib.verifyBLS(issuer.blsPubkey, message, blsSignature)) {
                revert ErrorsLib.E088_InvalidIpUpdateSignature();
            }
        }

        issuer.ip = newIp;
        emit EventsLib.IssuerIpUpdated(issuerId, newIp);
    }

    // ============ VIEW FUNCTIONS ============

    /// @inheritdoc IIssuerRegistry
    function getIssuer(uint256 issuerId) external view override returns (TypesLib.Issuer memory) {
        return _issuers[issuerId];
    }

    /// @inheritdoc IIssuerRegistry
    function getAggregatedPubkey() external view override returns (bytes memory) {
        return _aggregatedPubkey;
    }

    /// @notice Set the aggregated BLS G2 public key and create a registry snapshot
    /// @dev Must be called after any addIssuer/removeIssuer/key rotation
    /// @param pubkey The aggregated G2 public key (128 bytes)
    /// @param nonce The registry nonce this snapshot corresponds to
    function setAggregatedPubkey(bytes calldata pubkey, uint256 nonce) external override onlyAdmin {
        if (nonce != _registryNonce) revert IssuerRegistry__PendingSnapshot();
        _aggregatedPubkey = pubkey;

        // Write snapshot
        uint256 activeBitmask = _computeActiveBitmask();
        bytes32[4] memory fixedPubkey = _pubkeyToFixed(pubkey);
        _nonceSnapshots[nonce] = TypesLib.RegistrySnapshot({
            activeCount: _activeCount,
            stateHash: getRegistryStateHash(),
            aggregatedPubkey: fixedPubkey,
            blockNumber: block.number,
            activeBitmask: activeBitmask
        });
        lastSnapshotNonce = nonce;

        emit AggregatedPubkeyUpdated(pubkey);
        emit EventsLib.SnapshotCreated(nonce, block.number, activeBitmask);
    }

    /// @notice Get pubkeys for specific issuers (for off-chain aggregation)
    /// @param issuerIds Array of issuer IDs
    /// @return pubkeys Array of G2 pubkeys (128 bytes each)
    function getIssuerPubkeys(uint256[] calldata issuerIds) external view returns (bytes[] memory pubkeys) {
        pubkeys = new bytes[](issuerIds.length);
        for (uint256 i = 0; i < issuerIds.length; i++) {
            TypesLib.Issuer storage issuer = _issuers[issuerIds[i]];
            if (issuer.addr != address(0) && issuer.status == 1) {
                pubkeys[i] = issuer.blsPubkey;
            }
        }
    }

    /// @notice Verify signer bitmap and return signer count
    /// @param signerBitmap Bitmap of issuer IDs that signed (bit i = issuer i signed)
    /// @return signerCount Number of valid active signers
    /// @return issuerIds Array of issuer IDs that signed
    function verifySignerBitmap(uint256 signerBitmap) external view returns (uint256 signerCount, uint256[] memory issuerIds) {
        // Count signers first
        uint256 tempBitmap = signerBitmap;
        uint256 count = 0;
        while (tempBitmap != 0) {
            count += tempBitmap & 1;
            tempBitmap >>= 1;
        }

        // Allocate array
        issuerIds = new uint256[](count);
        uint256 idx = 0;
        signerCount = 0;

        // Iterate through bitmap
        for (uint256 i = 0; i < 256 && signerBitmap != 0; i++) {
            if (signerBitmap & 1 == 1) {
                TypesLib.Issuer storage issuer = _issuers[i];
                if (issuer.addr != address(0) && issuer.status == 1) {
                    issuerIds[idx++] = i;
                    signerCount++;
                }
            }
            signerBitmap >>= 1;
        }

        // Resize array to actual signer count
        assembly {
            mstore(issuerIds, signerCount)
        }
    }

    /// @inheritdoc IIssuerRegistry
    function getIssuers() external view override returns (TypesLib.Issuer[] memory) {
        TypesLib.Issuer[] memory issuers = new TypesLib.Issuer[](_issuerCount);
        for (uint256 i = 0; i < _issuerCount; i++) {
            issuers[i] = _issuers[i];
        }
        return issuers;
    }

    /// @inheritdoc IIssuerRegistry
    function isActiveIssuer(address addr) external view override returns (bool) {
        for (uint256 i = 0; i < _issuerCount; i++) {
            TypesLib.Issuer storage issuer = _issuers[i];
            if (issuer.addr == addr && issuer.status == 1) {
                return true;
            }
        }
        return false;
    }

    /// @inheritdoc IIssuerRegistry
    function activeIssuerCount() external view override returns (uint256) {
        return _activeCount;
    }

    /// @inheritdoc IIssuerRegistry
    function getPendingRotation(uint256 issuerId)
        external
        view
        override
        returns (TypesLib.KeyRotation memory)
    {
        return _pendingRotations[issuerId];
    }

    /// @inheritdoc IIssuerRegistry
    function canExecuteRotation(uint256 issuerId) external view override returns (bool) {
        TypesLib.KeyRotation storage rotation = _pendingRotations[issuerId];

        // No pending rotation or already executed
        if (rotation.requestedAt == 0) return false;
        if (rotation.executed) return false;

        // Insufficient approvals
        if (rotation.approvalCount < ROTATION_THRESHOLD) return false;

        // Timelock not passed
        if (block.timestamp < rotation.requestedAt + ROTATION_TIMELOCK) return false;

        // Safe period not elapsed (unless force window enabled)
        if (!_forceWindowEnabled[issuerId]) {
            if (block.timestamp < _lastApprovalTime[issuerId] + SAFE_PERIOD) return false;
        }

        return true;
    }

    /// @notice Check if force window is enabled for a rotation
    /// @param issuerId The issuer ID to check
    /// @return True if force window is enabled
    function isForceWindowEnabled(uint256 issuerId) external view returns (bool) {
        return _forceWindowEnabled[issuerId];
    }

    // ============ REGISTRY SYNC (Story 8.1) ============

    /// @inheritdoc IIssuerRegistry
    function registryNonce() external view override returns (uint256) {
        return _registryNonce;
    }

    /// @inheritdoc IIssuerRegistry
    function getRegistryStateHash() public view override returns (bytes32) {
        bytes memory packed;
        for (uint256 i = 0; i < _issuerCount; i++) {
            TypesLib.Issuer storage issuer = _issuers[i];
            if (issuer.addr != address(0) && issuer.status == 1) {
                packed = abi.encodePacked(packed, issuer.blsPubkey);
            }
        }
        return keccak256(packed);
    }

    /// @notice Emit RegistryStateChanged event after any state mutation
    /// @dev IMPORTANT: Must be called AFTER the primary mutation event (IssuerAdded, IssuerRemoved, KeyRotationExecuted)
    /// @dev Increments _registryNonce, computes state hash from active pubkeys, emits RegistryStateChanged
    function _emitStateChange() internal {
        _registryNonce++;
        bytes32 stateHash = getRegistryStateHash();
        emit EventsLib.RegistryStateChanged(_registryNonce, _activeCount, stateHash);
        emit EventsLib.SnapshotPending(_registryNonce);
    }

    /// @notice Get the governance contract address
    /// @return The governance contract
    function governance() external view returns (IGovernance) {
        return _governance;
    }

    // ============ SNAPSHOT & NON-SIGNER TRACKING (Phase 2+3) ============

    /// @inheritdoc IIssuerRegistry
    function getSnapshotAtNonce(uint256 nonce) external view override returns (TypesLib.RegistrySnapshot memory) {
        return _nonceSnapshots[nonce];
    }

    /// @inheritdoc IIssuerRegistry
    function getActiveBitmask() external view override returns (uint256) {
        return _computeActiveBitmask();
    }

    /// @inheritdoc IIssuerRegistry
    function incrementMissedCounts(uint256 nonSignersBitmask) external override {
        uint256 mask = nonSignersBitmask;
        for (uint256 i = 0; i < 256 && mask != 0; i++) {
            if (mask & 1 == 1) {
                issuerMissedCount[i]++;
            }
            mask >>= 1;
        }
        emit EventsLib.NonSignersRecorded(nonSignersBitmask);
    }

    /// @dev Compute active issuer bitmask from current state
    /// @return bitmask where bit i = issuer i is active
    function _computeActiveBitmask() internal view returns (uint256 bitmask) {
        for (uint256 i = 0; i < _issuerCount && i < 256; i++) {
            if (_issuers[i].addr != address(0) && _issuers[i].status == 1) {
                bitmask |= (1 << i);
            }
        }
    }

    /// @dev Convert dynamic bytes pubkey to fixed bytes32[4] for snapshot storage
    function _pubkeyToFixed(bytes calldata pubkey) internal pure returns (bytes32[4] memory r) {
        assembly {
            calldatacopy(r, pubkey.offset, 128)
        }
    }

    /// @dev Convert fixed bytes32[4] pubkey back to dynamic bytes
    function _fixedToPubkey(bytes32[4] memory pk) internal pure returns (bytes memory) {
        return abi.encodePacked(pk[0], pk[1], pk[2], pk[3]);
    }

    /// @dev Count set bits in a uint256 (population count)
    function _popcount(uint256 x) internal pure returns (uint256 count) {
        while (x != 0) {
            x &= x - 1;
            count++;
        }
    }

    // ============ UPGRADE AUTHORIZATION ============

    /// @notice Authorize an upgrade (admin only)
    /// @param newImplementation The new implementation address
    function _authorizeUpgrade(address newImplementation) internal override onlyAdmin {
        if (newImplementation.code.length == 0) revert ZeroAddress();
    }
}
