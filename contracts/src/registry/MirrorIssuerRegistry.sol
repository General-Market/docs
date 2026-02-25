// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {BLSLib} from "../libraries/BLSLib.sol";
import {ErrorsLib} from "../libraries/ErrorsLib.sol";
import {EventsLib} from "../libraries/EventsLib.sol";
import {IMirrorIssuerRegistry} from "../interfaces/IMirrorIssuerRegistry.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/// @title MirrorIssuerRegistry
/// @notice Mirror of L3 IssuerRegistry on Arbitrum (or any chain).
///         Synced via BLS-signed state proofs. Permissionless updates.
/// @dev The ITPNAVOracle reads aggregated pubkey from this contract.
///      Anyone can sync by providing a valid BLS proof from the L3 issuer set.
///
///      Chain of trust: Old keys sign the transition to new keys.
///      The initial deploy (initialize) is the trust anchor.
/// @custom:security-contact security@indexprotocol.com
contract MirrorIssuerRegistry is IMirrorIssuerRegistry, Initializable, UUPSUpgradeable {
    // ============ CONSTANTS ============

    /// @notice Expected BLS G2 public key length (128 bytes: x_im, x_re, y_im, y_re)
    uint256 private constant PUBKEY_LENGTH = 128;

    // ============ STORAGE ============

    /// @notice Aggregated BLS G2 public key (128 bytes)
    bytes public aggregatedPubkey;

    /// @notice BLS threshold (e.g., 2 for 2/3 quorum)
    uint256 public threshold;

    /// @notice Active issuer count
    uint256 public activeCount;

    /// @notice Monotonically increasing nonce for replay protection
    uint256 public registryNonce;

    /// @notice Admin address for upgrades only
    address public admin;

    /// @notice Nonce of the last pubkey snapshot stored
    uint256 public lastSnapshotNonce;

    /// @notice Historical aggregated pubkeys indexed by nonce
    mapping(uint256 => bytes) private _pubkeyAtNonce;

    /// @notice Storage gap for upgrade safety
    uint256[43] private __gap;

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

    /// @notice Sync registry state from L3 via BLS-signed proof
    /// @dev Anyone can call this with a valid BLS signature from the current issuer set
    /// @param newAggPubkey New aggregated G2 pubkey (128 bytes)
    /// @param newActiveCount New active issuer count
    /// @param newThreshold New BLS threshold
    /// @param nonce Must be > current registryNonce
    /// @param blsSignature Aggregated BLS signature (G1, 64 bytes)
    /// @param signersBitmask Bitmask of which issuers signed (for reference, not validated here)
    function sync(
        bytes calldata newAggPubkey,
        uint256 newActiveCount,
        uint256 newThreshold,
        uint256 nonce,
        bytes calldata blsSignature,
        uint256 signersBitmask
    ) external {
        // Validate nonce is strictly increasing
        if (nonce <= registryNonce) {
            revert ErrorsLib.E090_StaleNonce(nonce, registryNonce);
        }

        // Validate new pubkey length
        if (newAggPubkey.length != PUBKEY_LENGTH) {
            revert ErrorsLib.E091_InvalidAggPubkey();
        }

        // Validate threshold configuration
        if (newThreshold == 0 || newThreshold > newActiveCount) {
            revert ErrorsLib.E093_InvalidThreshold(newThreshold, newActiveCount);
        }

        // Compute message hash for BLS verification (chain-bound)
        // Uses abi.encode with block.chainid and address(this) for cross-chain replay protection.
        // Rust-side build_registry_sync_message_hash() must match this encoding.
        bytes32 messageHash = keccak256(
            abi.encode("REGISTRY_SYNC", block.chainid, address(this), nonce, newAggPubkey, newActiveCount, newThreshold)
        );

        // Verify BLS signature against CURRENT aggregated pubkey
        // (old keys authorize the transition to new keys)
        bool valid = BLSLib.verifyBLS(aggregatedPubkey, messageHash, blsSignature);
        if (!valid) {
            revert ErrorsLib.E020_InvalidBLSSignature();
        }

        // Update state
        aggregatedPubkey = newAggPubkey;
        activeCount = newActiveCount;
        threshold = newThreshold;
        registryNonce = nonce;

        // Snapshot pubkey at this nonce for historical lookups
        _pubkeyAtNonce[nonce] = newAggPubkey;
        lastSnapshotNonce = nonce;

        // Emit event with pubkey hash and signers bitmask for indexing
        emit EventsLib.RegistrySynced(
            nonce,
            newActiveCount,
            newThreshold,
            keccak256(newAggPubkey),
            signersBitmask
        );
    }

    // ============ VIEW FUNCTIONS ============

    /// @notice Get the current aggregated G2 pubkey
    /// @return The aggregated pubkey bytes (128 bytes)
    function getAggregatedPubkey() external view returns (bytes memory) {
        return aggregatedPubkey;
    }

    /// @notice Get the aggregated G2 pubkey that was active at a specific nonce
    /// @param nonce The registry nonce to look up
    /// @return The aggregated pubkey bytes at that nonce (128 bytes), or empty if not found
    function getAggregatedPubkeyAtNonce(uint256 nonce) external view returns (bytes memory) {
        return _pubkeyAtNonce[nonce];
    }

    // threshold() and activeCount() have auto-generated getters from public storage

    // ============ ADMIN FUNCTIONS ============

    /// @notice Set a new admin address
    /// @param newAdmin The new admin address
    function setAdmin(address newAdmin) external {
        if (msg.sender != admin) {
            revert Unauthorized();
        }

        // Validate new admin is not zero address
        if (newAdmin == address(0)) {
            revert ErrorsLib.E092_ZeroAdmin();
        }

        address oldAdmin = admin;
        admin = newAdmin;

        emit EventsLib.AdminChanged(oldAdmin, newAdmin);
    }

    // ============ UUPS UPGRADE ============

    /// @notice Authorize upgrade (admin only)
    /// @param newImplementation New implementation address
    function _authorizeUpgrade(address newImplementation) internal override {
        if (msg.sender != admin) {
            revert Unauthorized();
        }
        // Silence unused variable warning
        newImplementation;
    }
}
