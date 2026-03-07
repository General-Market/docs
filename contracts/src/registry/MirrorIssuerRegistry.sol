// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {BLSLib} from "../libraries/BLSLib.sol";
import {ErrorsLib} from "../libraries/ErrorsLib.sol";
import {EventsLib} from "../libraries/EventsLib.sol";
import {TypesLib} from "../libraries/TypesLib.sol";
import {IMirrorIssuerRegistry} from "../interfaces/IMirrorIssuerRegistry.sol";
import {IIssuerRegistry} from "../interfaces/IIssuerRegistry.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/// @title MirrorIssuerRegistry
/// @notice Mirror of L3 IssuerRegistry on Settlement (or any chain).
///         Synced via BLS-signed state proofs. Permissionless updates.
///         Implements IIssuerRegistry subset so BLSVerifier can use it directly.
/// @dev Stores individual issuer pubkeys for multi-pairing BLS verification.
///      First sync uses aggregated pubkey (TOFU bootstrap).
///      Subsequent syncs use multi-pairing with 2/3 threshold.
///
///      Chain of trust: Old keys sign the transition to new keys.
///      The initial deploy (initialize) is the trust anchor.
/// @custom:security-contact security@indexprotocol.com
contract MirrorIssuerRegistry is IMirrorIssuerRegistry, IIssuerRegistry, Initializable, UUPSUpgradeable {
    // ============ CONSTANTS ============

    /// @notice Expected BLS G2 public key length (128 bytes: x_im, x_re, y_im, y_re)
    uint256 private constant PUBKEY_LENGTH = 128;

    // ============ STORAGE ============

    /// @notice Aggregated BLS G2 public key (128 bytes) — bootstrap trust anchor
    bytes public aggregatedPubkey;

    /// @notice BLS threshold (e.g., 2 for 2/3 quorum)
    uint256 public threshold;

    /// @notice Active issuer count
    uint256 public activeCount;

    /// @notice Monotonically increasing nonce for replay protection
    uint256 public override(IMirrorIssuerRegistry, IIssuerRegistry) registryNonce;

    /// @notice Admin address for upgrades only
    address public admin;

    /// @notice Nonce of the last snapshot stored
    uint256 public override(IMirrorIssuerRegistry, IIssuerRegistry) lastSnapshotNonce;

    /// @notice Historical aggregated pubkeys indexed by nonce (kept for backward compat)
    mapping(uint256 => bytes) private _pubkeyAtNonce;

    // --- Phase 2B additions (individual pubkeys + snapshots) ---

    /// @notice Individual issuer pubkeys (issuer_id => G2 pubkey 128 bytes)
    mapping(uint256 => bytes) private _issuerPubkeys;

    /// @notice Active issuer bitmask (bit i = issuer i is active)
    uint256 public activeBitmask;

    /// @notice Snapshots for BLSVerifier historical lookups
    mapping(uint256 => TypesLib.RegistrySnapshot) private _snapshots;

    /// @notice Missed counts (advisory liveness tracking)
    mapping(uint256 => uint256) private _missedCounts;

    /// @notice Authorized callers for incrementMissedCounts
    mapping(address => bool) public authorizedMissedCountCallers;

    /// @notice Storage gap for upgrade safety
    uint256[38] private __gap;

    // ============ ERRORS ============

    /// @notice Thrown when caller is not the admin
    error Unauthorized();

    // ============ CONSTRUCTOR ============

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // ============ INITIALIZER ============

    /// @notice Initialize the MirrorIssuerRegistry
    /// @param aggPubkey Initial aggregated G2 pubkey (128 bytes)
    /// @param _threshold BLS threshold for signature verification
    /// @param _activeCount Number of active issuers
    /// @param _admin Admin address for upgrades
    function initialize(
        bytes calldata aggPubkey,
        uint256 _threshold,
        uint256 _activeCount,
        address _admin
    ) external initializer {
        __UUPSUpgradeable_init();

        // Validate admin is not zero address
        if (_admin == address(0)) {
            revert ErrorsLib.E092_ZeroAdmin();
        }

        // Validate pubkey length
        if (aggPubkey.length != PUBKEY_LENGTH) {
            revert ErrorsLib.E091_InvalidAggPubkey();
        }

        // Validate threshold configuration
        if (_threshold == 0 || _threshold > _activeCount) {
            revert ErrorsLib.E093_InvalidThreshold(_threshold, _activeCount);
        }

        aggregatedPubkey = aggPubkey;
        threshold = _threshold;
        activeCount = _activeCount;
        admin = _admin;
        registryNonce = 0;
    }

    // ============ SYNC FUNCTION ============

    /// @notice Sync registry state from L3 via BLS-signed proof with individual pubkeys
    /// @dev First sync (lastSnapshotNonce == 0): uses BLSLib.verifyBLS against aggregated key (TOFU)
    ///      Subsequent syncs: uses verifyBLSMultiPairing with 2/3 threshold
    function sync(
        bytes[] calldata issuerPubkeys,
        uint256[] calldata issuerIds,
        uint256 newActiveBitmask,
        uint256 newActiveCount,
        uint256 newThreshold,
        uint256 nonce,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external {
        // Validate nonce is strictly increasing
        if (nonce <= registryNonce) {
            revert ErrorsLib.E090_StaleNonce(nonce, registryNonce);
        }

        // Validate pubkeys and IDs array lengths match
        if (issuerPubkeys.length != issuerIds.length) {
            revert ErrorsLib.E137_PubkeysIdsLengthMismatch(issuerPubkeys.length, issuerIds.length);
        }

        // Validate threshold configuration
        if (newThreshold == 0 || newThreshold > newActiveCount) {
            revert ErrorsLib.E093_InvalidThreshold(newThreshold, newActiveCount);
        }

        // Validate all pubkeys are correct length
        for (uint256 i = 0; i < issuerPubkeys.length; i++) {
            if (issuerPubkeys[i].length != PUBKEY_LENGTH) {
                revert ErrorsLib.E091_InvalidAggPubkey();
            }
        }

        // Compute message hash for BLS verification (chain-bound)
        bytes32 messageHash = keccak256(
            abi.encode(
                "REGISTRY_SYNC",
                block.chainid,
                address(this),
                nonce,
                keccak256(abi.encode(issuerPubkeys, issuerIds)),
                newActiveBitmask,
                newActiveCount,
                newThreshold
            )
        );

        // BLS verification: TOFU bootstrap vs multi-pairing
        if (lastSnapshotNonce == 0) {
            // First sync — use aggregated pubkey (TOFU)
            bool valid = BLSLib.verifyBLS(aggregatedPubkey, messageHash, blsSignature);
            if (!valid) {
                revert ErrorsLib.E020_InvalidBLSSignature();
            }
        } else {
            // Subsequent syncs — use multi-pairing with 2/3 threshold
            // Validate signers bitmask is subset of current active bitmask
            if ((signersBitmask & ~activeBitmask) != 0) {
                revert ErrorsLib.E020_InvalidBLSSignature();
            }
            // Check 2/3 threshold
            uint256 signerCount = _popcount(signersBitmask);
            if (signerCount < (activeCount * 2 + 2) / 3) {
                revert ErrorsLib.E020_InvalidBLSSignature();
            }
            // Multi-pairing verification using current individual pubkeys
            bool valid = _verifyMultiPairing(signersBitmask, messageHash, blsSignature);
            if (!valid) {
                revert ErrorsLib.E020_InvalidBLSSignature();
            }
        }

        // Store individual pubkeys
        for (uint256 i = 0; i < issuerIds.length; i++) {
            _issuerPubkeys[issuerIds[i]] = issuerPubkeys[i];
        }

        // Update state
        activeBitmask = newActiveBitmask;
        activeCount = newActiveCount;
        threshold = newThreshold;
        registryNonce = nonce;

        // Create snapshot for BLSVerifier historical lookups
        _snapshots[nonce] = TypesLib.RegistrySnapshot({
            activeCount: newActiveCount,
            stateHash: keccak256(abi.encode(issuerPubkeys, issuerIds)),
            aggregatedPubkey: [bytes32(0), bytes32(0), bytes32(0), bytes32(0)],
            blockNumber: block.number,
            activeBitmask: newActiveBitmask
        });
        lastSnapshotNonce = nonce;

        // Emit event
        emit EventsLib.RegistrySynced(
            nonce,
            newActiveCount,
            newThreshold,
            keccak256(abi.encode(issuerPubkeys)),
            signersBitmask
        );
    }

    // ============ IIssuerRegistry METHODS (BLSVerifier subset) ============

    /// @notice Get a registry snapshot by nonce
    function getSnapshotAtNonce(uint256 nonce) external view override(IMirrorIssuerRegistry, IIssuerRegistry) returns (TypesLib.RegistrySnapshot memory) {
        return _snapshots[nonce];
    }

    /// @notice Verify a BLS signature against individual signer pubkeys using multi-pairing
    function verifyBLSMultiPairing(
        uint256 signersBitmask,
        bytes32 messageHash,
        bytes calldata blsSignature
    ) external view override(IMirrorIssuerRegistry, IIssuerRegistry) returns (bool) {
        return _verifyMultiPairing(signersBitmask, messageHash, blsSignature);
    }

    /// @notice Increment missed counts for non-signing issuers (advisory)
    function incrementMissedCounts(uint256 nonSignersBitmask) external override(IMirrorIssuerRegistry, IIssuerRegistry) {
        if (!authorizedMissedCountCallers[msg.sender]) {
            revert ErrorsLib.E136_NotAuthorizedMissedCountCaller(msg.sender);
        }

        uint256 bitmap = nonSignersBitmask;
        while (bitmap != 0) {
            uint256 bit = bitmap & (~bitmap + 1); // isolate lowest set bit
            uint256 issuerId = _log2(bit);
            _missedCounts[issuerId]++;
            bitmap ^= bit;
        }

        emit EventsLib.NonSignersRecorded(nonSignersBitmask);
    }

    // ============ IIssuerRegistry VIEW FUNCTIONS (partially implemented) ============

    /// @notice Get the current aggregated G2 pubkey
    function getAggregatedPubkey() external view override(IMirrorIssuerRegistry, IIssuerRegistry) returns (bytes memory) {
        return aggregatedPubkey;
    }

    /// @notice Get the active issuer bitmask
    function getActiveBitmask() external view returns (uint256) {
        return activeBitmask;
    }

    /// @notice Get the active issuer count
    function activeIssuerCount() external view returns (uint256) {
        return activeCount;
    }

    /// @notice Get individual BLS pubkeys for a list of issuer IDs
    function getIssuerPubkeys(uint256[] calldata issuerIdList) external view returns (bytes[] memory pubkeys) {
        pubkeys = new bytes[](issuerIdList.length);
        for (uint256 i = 0; i < issuerIdList.length; i++) {
            pubkeys[i] = _issuerPubkeys[issuerIdList[i]];
        }
    }

    /// @notice Decode a bitmap into an array of set bit indices
    function decodeBitmap(uint256 bitmap) external pure returns (uint256[] memory ids) {
        return _decodeBitmap(bitmap);
    }

    /// @notice Get missed count for a specific issuer
    function getMissedCount(uint256 issuerId) external view returns (uint256) {
        return _missedCounts[issuerId];
    }

    // ============ IIssuerRegistry STUBS (not applicable for mirror) ============
    // These exist to satisfy the interface but are not meaningful on a mirror registry.

    function addIssuer(address, bytes32, bytes calldata, bytes calldata) external pure returns (uint256) {
        revert("MirrorIssuerRegistry: not supported");
    }

    function removeIssuer(uint256) external pure {
        revert("MirrorIssuerRegistry: not supported");
    }

    function requestKeyRotation(uint256, bytes calldata, bytes calldata, bytes calldata) external pure {
        revert("MirrorIssuerRegistry: not supported");
    }

    function approveRotation(uint256, uint256, bytes calldata) external pure {
        revert("MirrorIssuerRegistry: not supported");
    }

    function executeRotation(uint256) external pure {
        revert("MirrorIssuerRegistry: not supported");
    }

    function forceRotationWindow(uint256) external pure {
        revert("MirrorIssuerRegistry: not supported");
    }

    function cancelRotation(uint256) external pure {
        revert("MirrorIssuerRegistry: not supported");
    }

    function getIssuer(uint256) external pure returns (TypesLib.Issuer memory) {
        revert("MirrorIssuerRegistry: not supported");
    }

    function setAggregatedPubkey(bytes calldata, uint256) external pure {
        revert("MirrorIssuerRegistry: not supported");
    }

    function verifySignerBitmap(uint256) external pure returns (uint256, uint256[] memory) {
        revert("MirrorIssuerRegistry: not supported");
    }

    function getPendingRotation(uint256) external pure returns (TypesLib.KeyRotation memory) {
        revert("MirrorIssuerRegistry: not supported");
    }

    function canExecuteRotation(uint256) external pure returns (bool) {
        revert("MirrorIssuerRegistry: not supported");
    }

    function getRegistryStateHash() external pure returns (bytes32) {
        revert("MirrorIssuerRegistry: not supported");
    }

    function ROTATION_THRESHOLD() external pure returns (uint256) {
        revert("MirrorIssuerRegistry: not supported");
    }

    function ROTATION_TIMELOCK() external pure returns (uint256) {
        revert("MirrorIssuerRegistry: not supported");
    }

    function SAFE_PERIOD() external pure returns (uint256) {
        revert("MirrorIssuerRegistry: not supported");
    }

    function ADMIN_FORCE_WINDOW() external pure returns (uint256) {
        revert("MirrorIssuerRegistry: not supported");
    }

    function getActiveIssuerEndpoints() external pure returns (uint256[] memory, bytes32[] memory, bytes[] memory) {
        revert("MirrorIssuerRegistry: not supported");
    }

    function updateIssuerIp(uint256, bytes32, bytes calldata) external pure {
        revert("MirrorIssuerRegistry: not supported");
    }

    function consensusPaused() external pure returns (bool) {
        return false;
    }

    function setConsensusPaused(bool) external pure {
        revert("MirrorIssuerRegistry: not supported");
    }

    function getIssuers() external pure returns (TypesLib.Issuer[] memory) {
        revert("MirrorIssuerRegistry: not supported");
    }

    function isActiveIssuer(address) external pure returns (bool) {
        revert("MirrorIssuerRegistry: not supported");
    }

    // ============ ADMIN FUNCTIONS ============

    /// @notice Set a new admin address
    function setAdmin(address newAdmin) external {
        if (msg.sender != admin) {
            revert Unauthorized();
        }
        if (newAdmin == address(0)) {
            revert ErrorsLib.E092_ZeroAdmin();
        }

        address oldAdmin = admin;
        admin = newAdmin;

        emit EventsLib.AdminChanged(oldAdmin, newAdmin);
    }

    /// @notice Authorize or deauthorize a caller for incrementMissedCounts
    function setAuthorizedMissedCountCaller(address caller, bool authorized) external {
        if (msg.sender != admin) {
            revert Unauthorized();
        }
        authorizedMissedCountCallers[caller] = authorized;

        emit EventsLib.AuthorizedCallerUpdated(caller, authorized);
    }

    // ============ INTERNAL HELPERS ============

    /// @dev Multi-pairing verification: decode bitmask, fetch pubkeys, call BLSLib.verifyBLSMulti
    function _verifyMultiPairing(
        uint256 signersBitmask,
        bytes32 messageHash,
        bytes memory blsSignature
    ) internal view returns (bool) {
        uint256[] memory ids = _decodeBitmap(signersBitmask);
        bytes[] memory pubkeys = new bytes[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            pubkeys[i] = _issuerPubkeys[ids[i]];
            if (pubkeys[i].length != PUBKEY_LENGTH) {
                revert ErrorsLib.E135_MissingIssuerPubkey(ids[i]);
            }
        }
        return BLSLib.verifyBLSMulti(pubkeys, messageHash, blsSignature);
    }

    /// @dev Decode a bitmap into an array of set bit indices
    function _decodeBitmap(uint256 bitmap) internal pure returns (uint256[] memory ids) {
        uint256 count = _popcount(bitmap);
        ids = new uint256[](count);
        uint256 idx;
        uint256 remaining = bitmap;
        while (remaining != 0) {
            uint256 bit = remaining & (~remaining + 1); // isolate lowest set bit
            ids[idx++] = _log2(bit);
            remaining ^= bit;
        }
    }

    /// @dev Count set bits in a uint256 (population count)
    function _popcount(uint256 x) internal pure returns (uint256 count) {
        while (x != 0) {
            x &= x - 1;
            count++;
        }
    }

    /// @dev Log2 of a power-of-2 value (bit position)
    function _log2(uint256 x) internal pure returns (uint256 r) {
        // x is always a power of 2 (single bit set)
        if (x >= 1 << 128) { r += 128; x >>= 128; }
        if (x >= 1 << 64)  { r += 64;  x >>= 64; }
        if (x >= 1 << 32)  { r += 32;  x >>= 32; }
        if (x >= 1 << 16)  { r += 16;  x >>= 16; }
        if (x >= 1 << 8)   { r += 8;   x >>= 8; }
        if (x >= 1 << 4)   { r += 4;   x >>= 4; }
        if (x >= 1 << 2)   { r += 2;   x >>= 2; }
        if (x >= 1 << 1)   { r += 1; }
    }

    // ============ UUPS UPGRADE ============

    /// @notice Authorize upgrade (admin only)
    function _authorizeUpgrade(address newImplementation) internal override {
        if (msg.sender != admin) {
            revert Unauthorized();
        }
        // Silence unused variable warning
        newImplementation;
    }
}
