// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IOracleRegistry} from "../interfaces/IOracleRegistry.sol";
import {IGovernance} from "../interfaces/IGovernance.sol";
import {TypesLib} from "../libraries/TypesLib.sol";
import {ErrorsLib} from "../libraries/ErrorsLib.sol";
import {EventsLib} from "../libraries/EventsLib.sol";
import {BLSLib} from "../libraries/BLSLib.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/// @title OracleRegistry - Oracle node management for Index L3
/// @notice Registry for oracle nodes, their BLS public keys, and aggregated key management
/// @dev UUPS upgradeable. Story 2.12 covers core registry; Story 2.13 covers key rotation
/// @custom:security-contact security@indexprotocol.com
contract OracleRegistry is IOracleRegistry, Initializable, UUPSUpgradeable {
    // ============ ERRORS ============

    /// @notice Thrown when caller is not the admin
    error Unauthorized();

    /// @notice Thrown when oracle address is zero
    error ZeroAddress();

    /// @notice Thrown when oracle ID is invalid or not found
    error OracleNotFound(uint256 oracleId);

    /// @notice Thrown when oracle is not active
    error OracleNotActive(uint256 oracleId);

    /// @notice Thrown when oracle is already active
    error OracleAlreadyActive(uint256 oracleId);

    /// @notice Thrown when BLS public key has invalid length
    error InvalidPubkeyLength(uint256 length);

    /// @notice Thrown when BLS signature verification fails
    error InvalidBLSSignature();

    /// @notice Thrown when rotation request doesn't exist
    error NoRotationPending(uint256 oracleId);

    /// @notice Thrown when rotation is already pending
    error RotationAlreadyPending(uint256 oracleId);

    /// @notice Thrown when self-approval is attempted
    error SelfApprovalNotAllowed();

    /// @notice Thrown when oracle has already approved
    error AlreadyApproved(uint256 approvingOracleId);

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
    error RotationAlreadyExecuted(uint256 oracleId);

    /// @notice Emitted when aggregated pubkey is updated
    event AggregatedPubkeyUpdated(bytes pubkey);

    /// @notice Thrown when pubkey is not on curve
    error PubkeyNotOnCurve();

    /// @notice Thrown when new pubkey is same as current pubkey
    error SamePubkey();

    /// @notice Thrown when BLS pubkey is already registered to another oracle
    /// @param existingOracleId The oracle that already has this pubkey
    error OracleRegistry__PubkeyAlreadyRegistered(uint256 existingOracleId);

    /// @notice Thrown when Proof of Possession BLS signature is invalid
    error OracleRegistry__InvalidPoP();

    /// @notice Thrown when a snapshot is pending (must call setAggregatedPubkey before further mutations)
    error OracleRegistry__PendingSnapshot();

    // ============ CONSTANTS ============

    /// @notice Key rotation approval threshold (10/19 other oracles)
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

    /// @dev Oracle data by ID
    mapping(uint256 => TypesLib.Oracle) private _oracles;

    /// @dev Total number of oracles ever registered (for ID assignment)
    uint256 private _oracleCount;

    /// @dev Count of currently active oracles
    uint256 private _activeCount;

    /// @dev DEPRECATED: Aggregated BLS public key (G2 aggregation not possible on-chain)
    /// @dev G2 addition requires field extension arithmetic not available via precompiles
    /// @dev Aggregation is computed off-chain; this storage is kept for upgrade compatibility
    uint256[2] private _aggregatedPubkey_DEPRECATED;

    /// @dev Pending key rotation requests by oracle ID
    mapping(uint256 => TypesLib.KeyRotation) private _pendingRotations;

    /// @dev Approval tracking for rotations: rotatingOracleId => approvingOracleId => approvalTimestamp
    /// @dev Approvals are only valid if timestamp >= rotation.requestedAt (prevents carryover after cancel)
    mapping(uint256 => mapping(uint256 => uint256)) private _rotationApprovals;

    /// @dev Last approval timestamp for rotation safe period check
    mapping(uint256 => uint256) private _lastApprovalTime;

    /// @dev Grace period expiry cycle for old keys (keccak256(pubkey) => cycle)
    mapping(bytes32 => uint256) private _keyGracePeriod;

    /// @dev Admin force window enabled for rotation (oracleId => enabled)
    mapping(uint256 => bool) private _forceWindowEnabled;

    /// @dev Current cycle number (for grace period tracking)
    uint256 private _currentCycle;

    /// @dev Registry nonce — incremented on every state change (add/remove oracle, key rotation)
    /// @dev Used for MirrorOracleRegistry sync tracking and replay protection
    uint256 private _registryNonce;

    /// @dev Aggregated BLS G2 public key (computed off-chain, stored for getAggregatedPubkey)
    bytes private _aggregatedPubkey;

    /// @dev Whether consensus is paused (admin circuit breaker)
    bool public consensusPaused;

    /// @dev Pubkey hash to oracle ID + 1 (0 = not registered, N = oracle N-1)
    /// @dev Sentinel +1 avoids collision with oracle ID 0
    mapping(bytes32 => uint256) private _pubkeyHashToOracleId;

    /// @dev Latest snapshot nonce (set when setAggregatedPubkey is called)
    uint256 public lastSnapshotNonce;

    /// @dev Registry snapshots by nonce
    mapping(uint256 => TypesLib.RegistrySnapshot) private _nonceSnapshots;

    /// @dev Advisory missed-round count per oracle ID
    mapping(uint256 => uint256) public oracleMissedCount;

    /// @dev Authorized callers for incrementMissedCounts (BLSVerifier-inheriting contracts)
    mapping(address => bool) public authorizedMissedCountCallers;

    /// @dev Storage gap for upgrade safety (reduced from 29 to 28 for authorizedMissedCountCallers)
    uint256[28] private __gap;

    // ============ CONSTRUCTOR ============

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // ============ INITIALIZER ============

    /// @notice Initialize the OracleRegistry contract
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

    // ============ ORACLE MANAGEMENT ============

    /// @inheritdoc IOracleRegistry
    function addOracle(
        address oracleAddr,
        bytes32 ip,
        bytes calldata blsPubkey,
        bytes calldata blsPopSignature
    ) external override onlyAdmin returns (uint256 oracleId) {
        if (lastSnapshotNonce != _registryNonce) revert OracleRegistry__PendingSnapshot();
        if (oracleAddr == address(0)) revert ZeroAddress();
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

        // Key uniqueness: reject if pubkey already registered to another oracle
        bytes32 pubkeyHash = keccak256(blsPubkey);
        uint256 existingSentinel = _pubkeyHashToOracleId[pubkeyHash];
        if (existingSentinel != 0) {
            revert OracleRegistry__PubkeyAlreadyRegistered(existingSentinel - 1);
        }

        // Proof of Possession: verify oracle controls the BLS private key
        // Domain-separated message: prevents cross-chain/cross-contract replay
        {
            bytes32 popMessage = keccak256(abi.encode(
                "INDEX_BLS_POP", block.chainid, address(this), oracleAddr, blsPubkey
            ));
            if (!BLSLib.verifyBLS(blsPubkey, popMessage, blsPopSignature)) {
                revert OracleRegistry__InvalidPoP();
            }
        }

        // Assign new oracle ID
        oracleId = _oracleCount++;

        // Store oracle data
        _oracles[oracleId] = TypesLib.Oracle({
            addr: oracleAddr,
            ip: ip,
            blsPubkey: blsPubkey,
            status: 1, // active
            registeredAt: block.timestamp
        });

        // Update active count
        _activeCount++;

        // Register pubkey in uniqueness mapping (sentinel = oracleId + 1)
        _pubkeyHashToOracleId[pubkeyHash] = oracleId + 1;

        emit OracleAdded(oracleId, oracleAddr, blsPubkey);

        // Emit registry state change for MirrorOracleRegistry sync (Story 8.1)
        _emitStateChange();
    }

    /// @inheritdoc IOracleRegistry
    function removeOracle(uint256 oracleId) external override {
        if (lastSnapshotNonce != _registryNonce) revert OracleRegistry__PendingSnapshot();
        TypesLib.Oracle storage oracle = _oracles[oracleId];

        // Validate oracle exists and is active
        if (oracle.addr == address(0)) revert OracleNotFound(oracleId);
        if (oracle.status != 1) revert OracleNotActive(oracleId);

        // Check authorization: admin can always remove
        bool isAdmin = msg.sender == _governance.admin();

        if (!isAdmin) {
            // For non-admin, would need BLS vote verification
            // This is a placeholder - full BLS vote implementation would verify
            // a signature from 11/20 oracles on the removal message
            revert Unauthorized();
        }

        // Clear pubkey uniqueness mapping
        delete _pubkeyHashToOracleId[keccak256(oracle.blsPubkey)];

        // Deactivate oracle
        oracle.status = 0; // inactive
        _activeCount--;

        emit OracleRemoved(oracleId);

        // Emit registry state change for MirrorOracleRegistry sync (Story 8.1)
        _emitStateChange();
    }

    /// @notice Remove an oracle via BLS vote from other oracles
    /// @param oracleId The oracle to remove
    /// @param blsSignature Aggregated BLS signature over the removal message
    /// @param referenceNonce Registry snapshot nonce for historical pubkey lookup
    /// @param signersBitmask Bitmask of oracles that signed this vote
    function removeOracleByVote(
        uint256 oracleId,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external {
        if (lastSnapshotNonce != _registryNonce) revert OracleRegistry__PendingSnapshot();
        TypesLib.Oracle storage oracle = _oracles[oracleId];
        if (oracle.addr == address(0)) revert OracleNotFound(oracleId);
        if (oracle.status != 1) revert OracleNotActive(oracleId);

        // Validate reference nonce is within acceptable window
        uint256 latest = lastSnapshotNonce;
        uint256 minNonce = latest > 256 ? latest - 256 : 0;
        if (referenceNonce < minNonce) revert OracleNotFound(0); // nonce too old
        if (referenceNonce > latest) revert OracleNotFound(0);   // nonce future

        // Load snapshot and validate signers
        TypesLib.RegistrySnapshot memory snap = _nonceSnapshots[referenceNonce];
        if ((signersBitmask & ~snap.activeBitmask) != 0) revert InvalidBLSSignature();
        if (_popcount(signersBitmask) < (snap.activeCount * 2 + 2) / 3) revert InvalidBLSSignature();

        bytes32 message = keccak256(abi.encode(
            block.chainid, address(this), "removeOracleByVote", oracleId
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
        delete _pubkeyHashToOracleId[keccak256(oracle.blsPubkey)];

        oracle.status = 0;
        _activeCount--;
        emit OracleRemoved(oracleId);
        _emitStateChange();
    }

    // ============ KEY ROTATION (Story 2.13, upgraded in Story 7.17) ============
    //
    /// @inheritdoc IOracleRegistry
    /// @dev 3-factor rotation request: ECDSA (msg.sender) + old-key BLS + new-key PoP
    /// @dev BLS verification: oracle signs keccak256(abi.encode("ROTATE", chainid, this, oracleId, newPubkey)) with old key
    /// @dev PoP verification: oracle signs keccak256(abi.encode("INDEX_BLS_POP", chainid, this, addr, newPubkey)) with new key
    function requestKeyRotation(
        uint256 oracleId,
        bytes calldata newPubkey,
        bytes calldata signatureWithOldKey,
        bytes calldata newKeyPopSignature
    ) external override {
        // Validate oracle exists and is active
        TypesLib.Oracle storage oracle = _oracles[oracleId];
        if (oracle.addr == address(0)) revert OracleNotFound(oracleId);
        if (oracle.status != 1) revert OracleNotActive(oracleId);

        // ECDSA factor: msg.sender must be the oracle's registered address
        if (msg.sender != oracle.addr) revert Unauthorized();

        // Verify BLS signature with oracle's current (old) key (chain-bound)
        {
            bytes32 message = keccak256(abi.encode("ROTATE", block.chainid, address(this), oracleId, newPubkey));
            if (!BLSLib.verifyBLS(oracle.blsPubkey, message, signatureWithOldKey)) {
                revert ErrorsLib.E086_InvalidRotationSignature();
            }
        }

        // Validate new pubkey length (128 bytes for G2 point)
        if (newPubkey.length != PUBKEY_LENGTH) revert InvalidPubkeyLength(newPubkey.length);

        // Validate new pubkey is different from current pubkey
        bytes32 newPubkeyHash = keccak256(newPubkey);
        if (newPubkeyHash == keccak256(oracle.blsPubkey)) revert SamePubkey();

        // Key uniqueness: reject if new pubkey already registered to another oracle
        {
            uint256 existingSentinel = _pubkeyHashToOracleId[newPubkeyHash];
            if (existingSentinel != 0 && existingSentinel - 1 != oracleId) {
                revert OracleRegistry__PubkeyAlreadyRegistered(existingSentinel - 1);
            }
        }

        // Proof of Possession for new key
        {
            bytes32 popMessage = keccak256(abi.encode(
                "INDEX_BLS_POP", block.chainid, address(this), oracle.addr, newPubkey
            ));
            if (!BLSLib.verifyBLS(newPubkey, popMessage, newKeyPopSignature)) {
                revert OracleRegistry__InvalidPoP();
            }
        }

        // Check no pending rotation exists
        if (_pendingRotations[oracleId].requestedAt != 0) revert RotationAlreadyPending(oracleId);

        // Create rotation request
        _pendingRotations[oracleId] = TypesLib.KeyRotation({
            oracleId: oracleId,
            newPubkey: newPubkey,
            requestedAt: block.timestamp,
            approvalCount: 0,
            executed: false
        });

        emit KeyRotationRequested(oracleId, newPubkey);
    }

    /// @inheritdoc IOracleRegistry
    /// @dev 2-factor approval: ECDSA (msg.sender) + BLS (chain-bound)
    /// @dev BLS verification: approver signs keccak256(abi.encode("APPROVE_ROTATION", chainid, this, rotatingOracleId, rotation.newPubkey))
    function approveRotation(
        uint256 rotatingOracleId,
        uint256 approvingOracleId,
        bytes calldata approverSignature
    ) external override {
        // Validate rotation exists and not executed
        TypesLib.KeyRotation storage rotation = _pendingRotations[rotatingOracleId];
        if (rotation.requestedAt == 0) revert NoRotationPending(rotatingOracleId);
        if (rotation.executed) revert RotationAlreadyExecuted(rotatingOracleId);

        // Validate approving oracle exists and is active
        TypesLib.Oracle storage approver = _oracles[approvingOracleId];
        if (approver.addr == address(0)) revert OracleNotFound(approvingOracleId);
        if (approver.status != 1) revert OracleNotActive(approvingOracleId);

        // ECDSA factor: msg.sender must be the approving oracle's registered address
        if (msg.sender != approver.addr) revert Unauthorized();

        // Block self-approval
        if (rotatingOracleId == approvingOracleId) revert SelfApprovalNotAllowed();

        // Verify BLS signature from approving oracle (chain-bound)
        {
            bytes32 message = keccak256(abi.encode("APPROVE_ROTATION", block.chainid, address(this), rotatingOracleId, rotation.newPubkey));
            if (!BLSLib.verifyBLS(approver.blsPubkey, message, approverSignature)) {
                revert ErrorsLib.E087_InvalidApprovalSignature();
            }
        }

        // Block double-approval (only count approvals made after this rotation was requested)
        // This prevents old approvals from carrying over after cancel+re-request
        if (_rotationApprovals[rotatingOracleId][approvingOracleId] >= rotation.requestedAt) {
            revert AlreadyApproved(approvingOracleId);
        }

        // Record approval with timestamp (used to validate approval belongs to current rotation)
        _rotationApprovals[rotatingOracleId][approvingOracleId] = block.timestamp;
        rotation.approvalCount++;

        // Update last approval time for safe period check
        _lastApprovalTime[rotatingOracleId] = block.timestamp;

        emit KeyRotationApproved(rotatingOracleId, approvingOracleId, rotation.approvalCount);
    }

    /// @inheritdoc IOracleRegistry
    function executeRotation(uint256 oracleId) external override {
        TypesLib.KeyRotation storage rotation = _pendingRotations[oracleId];

        // Validate rotation exists and not executed
        if (rotation.requestedAt == 0) revert NoRotationPending(oracleId);
        if (rotation.executed) revert RotationAlreadyExecuted(oracleId);

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
        if (!_forceWindowEnabled[oracleId]) {
            uint256 safeTime = _lastApprovalTime[oracleId] + SAFE_PERIOD;
            if (block.timestamp < safeTime) {
                revert SafePeriodNotElapsed(_lastApprovalTime[oracleId], SAFE_PERIOD);
            }
        }

        // Get old pubkey for event
        TypesLib.Oracle storage oracle = _oracles[oracleId];
        bytes memory oldPubkey = oracle.blsPubkey;

        // Update pubkey uniqueness mapping: clear old, set new
        bytes32 oldPubkeyHash = keccak256(oldPubkey);
        delete _pubkeyHashToOracleId[oldPubkeyHash];
        _pubkeyHashToOracleId[keccak256(rotation.newPubkey)] = oracleId + 1;

        // Update oracle's pubkey
        oracle.blsPubkey = rotation.newPubkey;

        // Mark rotation as executed
        rotation.executed = true;

        // Set grace period for old key
        _keyGracePeriod[oldPubkeyHash] = _currentCycle + ROTATION_GRACE_CYCLES;

        // Clear force window if set
        if (_forceWindowEnabled[oracleId]) {
            _forceWindowEnabled[oracleId] = false;
        }

        emit KeyRotationExecuted(oracleId, oldPubkey, rotation.newPubkey);

        // Emit registry state change for MirrorOracleRegistry sync (Story 8.1)
        _emitStateChange();
    }

    /// @inheritdoc IOracleRegistry
    function forceRotationWindow(uint256 oracleId) external override onlyAdmin {
        TypesLib.KeyRotation storage rotation = _pendingRotations[oracleId];

        // Validate rotation exists and not executed
        if (rotation.requestedAt == 0) revert NoRotationPending(oracleId);
        if (rotation.executed) revert RotationAlreadyExecuted(oracleId);

        // Check 48h window has passed since request
        if (block.timestamp < rotation.requestedAt + ADMIN_FORCE_WINDOW) {
            revert ForceWindowNotElapsed(rotation.requestedAt, ADMIN_FORCE_WINDOW);
        }

        // Enable force window
        _forceWindowEnabled[oracleId] = true;

        emit RotationWindowForced(oracleId);
    }

    /// @inheritdoc IOracleRegistry
    function cancelRotation(uint256 oracleId) external override onlyAdmin {
        TypesLib.KeyRotation storage rotation = _pendingRotations[oracleId];

        // Validate rotation exists and not executed
        if (rotation.requestedAt == 0) revert NoRotationPending(oracleId);
        if (rotation.executed) revert RotationAlreadyExecuted(oracleId);

        // Clear the rotation
        delete _pendingRotations[oracleId];

        // Clear last approval time
        delete _lastApprovalTime[oracleId];

        // Clear force window if set
        if (_forceWindowEnabled[oracleId]) {
            delete _forceWindowEnabled[oracleId];
        }

        // Note: _rotationApprovals entries are NOT cleared but become invalid automatically
        // because the timestamp-based check requires approvals >= rotation.requestedAt.
        // Any new rotation will have a later requestedAt, invalidating old approvals.

        emit KeyRotationCancelled(oracleId);
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

    /// @notice Get connection details for all active oracles
    /// @dev Used by new oracle nodes for P2P bootstrap from on-chain registry
    /// @return ids Array of active oracle IDs
    /// @return ips Array of IP addresses (packed as bytes32)
    /// @return pubkeys Array of BLS public keys
    function getActiveOracleEndpoints()
        external
        view
        returns (uint256[] memory ids, bytes32[] memory ips, bytes[] memory pubkeys)
    {
        // First pass: count active oracles
        uint256 activeCount = _activeCount;
        ids = new uint256[](activeCount);
        ips = new bytes32[](activeCount);
        pubkeys = new bytes[](activeCount);

        uint256 idx = 0;
        for (uint256 i = 0; i < _oracleCount && idx < activeCount; i++) {
            TypesLib.Oracle storage oracle = _oracles[i];
            if (oracle.addr != address(0) && oracle.status == 1) {
                ids[idx] = i;
                ips[idx] = oracle.ip;
                pubkeys[idx] = oracle.blsPubkey;
                idx++;
            }
        }
    }

    /// @notice Update an oracle's IP address
    /// @param oracleId The oracle whose IP to update
    /// @param newIp The new IP address (packed as bytes32)
    /// @param blsSignature BLS signature proving ownership
    function updateOracleIp(uint256 oracleId, bytes32 newIp, bytes calldata blsSignature) external {
        TypesLib.Oracle storage oracle = _oracles[oracleId];
        if (oracle.addr == address(0)) revert OracleNotFound(oracleId);
        if (oracle.status != 1) revert OracleNotActive(oracleId);

        {
            bytes32 message = keccak256(abi.encode("UPDATE_IP", block.chainid, address(this), oracleId, newIp));
            if (!BLSLib.verifyBLS(oracle.blsPubkey, message, blsSignature)) {
                revert ErrorsLib.E088_InvalidIpUpdateSignature();
            }
        }

        oracle.ip = newIp;
        emit EventsLib.OracleIpUpdated(oracleId, newIp);
    }

    // ============ VIEW FUNCTIONS ============

    /// @inheritdoc IOracleRegistry
    function getOracle(uint256 oracleId) external view override returns (TypesLib.Oracle memory) {
        return _oracles[oracleId];
    }

    /// @inheritdoc IOracleRegistry
    function getAggregatedPubkey() external view override returns (bytes memory) {
        return _aggregatedPubkey;
    }

    /// @notice Set the aggregated BLS G2 public key and create a registry snapshot
    /// @dev Must be called after any addOracle/removeOracle/key rotation
    /// @param pubkey The aggregated G2 public key (128 bytes)
    /// @param nonce The registry nonce this snapshot corresponds to
    function setAggregatedPubkey(bytes calldata pubkey, uint256 nonce) external override onlyAdmin {
        if (nonce != _registryNonce) revert OracleRegistry__PendingSnapshot();
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

    /// @notice Get pubkeys for specific oracles (for off-chain aggregation)
    /// @param oracleIds Array of oracle IDs
    /// @return pubkeys Array of G2 pubkeys (128 bytes each)
    function getOraclePubkeys(uint256[] calldata oracleIds) external view returns (bytes[] memory pubkeys) {
        pubkeys = new bytes[](oracleIds.length);
        for (uint256 i = 0; i < oracleIds.length; i++) {
            TypesLib.Oracle storage oracle = _oracles[oracleIds[i]];
            // Return stored pubkey regardless of current status — the caller
            // (BLSVerifier) already validates the bitmap against a historical
            // snapshot's activeBitmask, so removed oracles that were active at
            // snapshot time still need their pubkeys for BLS verification.
            if (oracle.addr != address(0)) {
                pubkeys[i] = oracle.blsPubkey;
            }
        }
    }

    /// @notice Verify signer bitmap and return signer count
    /// @param signerBitmap Bitmap of oracle IDs that signed (bit i = oracle i signed)
    /// @return signerCount Number of valid active signers
    /// @return oracleIds Array of oracle IDs that signed
    function verifySignerBitmap(uint256 signerBitmap) external view returns (uint256 signerCount, uint256[] memory oracleIds) {
        // Count signers first
        uint256 tempBitmap = signerBitmap;
        uint256 count = 0;
        while (tempBitmap != 0) {
            count += tempBitmap & 1;
            tempBitmap >>= 1;
        }

        // Allocate array
        oracleIds = new uint256[](count);
        uint256 idx = 0;
        signerCount = 0;

        // Iterate through bitmap
        for (uint256 i = 0; i < 256 && signerBitmap != 0; i++) {
            if (signerBitmap & 1 == 1) {
                TypesLib.Oracle storage oracle = _oracles[i];
                if (oracle.addr != address(0) && oracle.status == 1) {
                    oracleIds[idx++] = i;
                    signerCount++;
                }
            }
            signerBitmap >>= 1;
        }

        // Resize array to actual signer count
        assembly {
            mstore(oracleIds, signerCount)
        }
    }

    /// @inheritdoc IOracleRegistry
    function decodeBitmap(uint256 bitmap) external pure override returns (uint256[] memory ids) {
        // Count set bits
        uint256 tempBitmap = bitmap;
        uint256 count;
        while (tempBitmap != 0) {
            tempBitmap &= tempBitmap - 1;
            count++;
        }
        // Decode to array
        ids = new uint256[](count);
        uint256 idx;
        for (uint256 i = 0; i < 256 && bitmap != 0; i++) {
            if (bitmap & 1 == 1) {
                ids[idx++] = i;
            }
            bitmap >>= 1;
        }
    }

    /// @inheritdoc IOracleRegistry
    function verifyBLSMultiPairing(
        uint256 signersBitmask,
        bytes32 messageHash,
        bytes calldata blsSignature
    ) external view override returns (bool) {
        uint256[] memory ids = this.decodeBitmap(signersBitmask);
        bytes[] memory pks = new bytes[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            TypesLib.Oracle storage oracle = _oracles[ids[i]];
            if (oracle.addr != address(0)) {
                pks[i] = oracle.blsPubkey;
            }
        }
        return BLSLib.verifyBLSMulti(pks, messageHash, blsSignature);
    }

    /// @inheritdoc IOracleRegistry
    function getOracles() external view override returns (TypesLib.Oracle[] memory) {
        TypesLib.Oracle[] memory oracles = new TypesLib.Oracle[](_oracleCount);
        for (uint256 i = 0; i < _oracleCount; i++) {
            oracles[i] = _oracles[i];
        }
        return oracles;
    }

    /// @inheritdoc IOracleRegistry
    function isActiveOracle(address addr) external view override returns (bool) {
        for (uint256 i = 0; i < _oracleCount; i++) {
            TypesLib.Oracle storage oracle = _oracles[i];
            if (oracle.addr == addr && oracle.status == 1) {
                return true;
            }
        }
        return false;
    }

    /// @inheritdoc IOracleRegistry
    function activeOracleCount() external view override returns (uint256) {
        return _activeCount;
    }

    /// @inheritdoc IOracleRegistry
    function getPendingRotation(uint256 oracleId)
        external
        view
        override
        returns (TypesLib.KeyRotation memory)
    {
        return _pendingRotations[oracleId];
    }

    /// @inheritdoc IOracleRegistry
    function canExecuteRotation(uint256 oracleId) external view override returns (bool) {
        TypesLib.KeyRotation storage rotation = _pendingRotations[oracleId];

        // No pending rotation or already executed
        if (rotation.requestedAt == 0) return false;
        if (rotation.executed) return false;

        // Insufficient approvals
        if (rotation.approvalCount < ROTATION_THRESHOLD) return false;

        // Timelock not passed
        if (block.timestamp < rotation.requestedAt + ROTATION_TIMELOCK) return false;

        // Safe period not elapsed (unless force window enabled)
        if (!_forceWindowEnabled[oracleId]) {
            if (block.timestamp < _lastApprovalTime[oracleId] + SAFE_PERIOD) return false;
        }

        return true;
    }

    /// @notice Check if force window is enabled for a rotation
    /// @param oracleId The oracle ID to check
    /// @return True if force window is enabled
    function isForceWindowEnabled(uint256 oracleId) external view returns (bool) {
        return _forceWindowEnabled[oracleId];
    }

    // ============ REGISTRY SYNC (Story 8.1) ============

    /// @inheritdoc IOracleRegistry
    function registryNonce() external view override returns (uint256) {
        return _registryNonce;
    }

    /// @inheritdoc IOracleRegistry
    function getRegistryStateHash() public view override returns (bytes32) {
        bytes memory packed;
        for (uint256 i = 0; i < _oracleCount; i++) {
            TypesLib.Oracle storage oracle = _oracles[i];
            if (oracle.addr != address(0) && oracle.status == 1) {
                packed = abi.encodePacked(packed, oracle.blsPubkey);
            }
        }
        return keccak256(packed);
    }

    /// @notice Emit RegistryStateChanged event after any state mutation
    /// @dev IMPORTANT: Must be called AFTER the primary mutation event (OracleAdded, OracleRemoved, KeyRotationExecuted)
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

    /// @notice Emergency: update the governance contract address
    /// @dev Escape hatch for Orbit nonce divergence — if initialize() stored a stale
    ///      Governance proxy address (CREATE vs broadcast mismatch), this lets the current
    ///      admin fix it without redeploying the entire registry + re-registering oracles.
    ///      Only callable by the current admin (through the current _governance.admin()).
    /// @param newGovernance The correct Governance contract address
    function setGovernance(address newGovernance) external onlyAdmin {
        if (newGovernance == address(0)) revert ZeroAddress();
        _governance = IGovernance(newGovernance);
    }

    // ============ SNAPSHOT & NON-SIGNER TRACKING (Phase 2+3) ============

    /// @inheritdoc IOracleRegistry
    function getSnapshotAtNonce(uint256 nonce) external view override returns (TypesLib.RegistrySnapshot memory) {
        return _nonceSnapshots[nonce];
    }

    /// @inheritdoc IOracleRegistry
    function getActiveBitmask() external view override returns (uint256) {
        return _computeActiveBitmask();
    }

    /// @notice Authorize or revoke a contract for calling incrementMissedCounts
    /// @param caller The contract address to authorize/revoke
    /// @param authorized Whether the caller should be authorized
    function setAuthorizedMissedCountCaller(address caller, bool authorized) external onlyAdmin {
        authorizedMissedCountCallers[caller] = authorized;
    }

    /// @inheritdoc IOracleRegistry
    function incrementMissedCounts(uint256 nonSignersBitmask) external override {
        if (!authorizedMissedCountCallers[msg.sender]) revert Unauthorized();
        uint256 mask = nonSignersBitmask;
        for (uint256 i = 0; i < 256 && mask != 0; i++) {
            if (mask & 1 == 1) {
                oracleMissedCount[i]++;
            }
            mask >>= 1;
        }
        emit EventsLib.NonSignersRecorded(nonSignersBitmask);
    }

    /// @dev Compute active oracle bitmask from current state
    /// @return bitmask where bit i = oracle i is active
    function _computeActiveBitmask() internal view returns (uint256 bitmask) {
        for (uint256 i = 0; i < _oracleCount && i < 256; i++) {
            if (_oracles[i].addr != address(0) && _oracles[i].status == 1) {
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
