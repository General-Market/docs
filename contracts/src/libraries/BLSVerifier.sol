// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IIssuerRegistry} from "../interfaces/IIssuerRegistry.sol";
import {TypesLib} from "./TypesLib.sol";
import {BLSLib} from "./BLSLib.sol";
import {ErrorsLib} from "./ErrorsLib.sol";

/// @title BLSVerifier - Standard BLS signature verification mixin
/// @dev All contracts requiring BLS verification inherit this.
///      Single source of truth: reads aggregated pubkey from IssuerRegistry.
///      Follows EigenLayer's BLSSignatureChecker pattern.
///      Phase 2+3: Uses snapshot-based historical state + non-signer tracking.
///      Storage layout FROZEN at 1 slot (_blsIssuerRegistry). NO __gap.
/// @custom:security-contact security@indexprotocol.com
abstract contract BLSVerifier {
    // ============ ERRORS ============

    /// @notice Reference nonce is too old (more than 256 behind latest)
    error BLSVerifier__NonceTooOld();

    /// @notice Reference nonce is in the future (greater than latest snapshot)
    error BLSVerifier__NonceFuture();

    /// @notice Snapshot is too old (block distance > 86400)
    error BLSVerifier__SnapshotTooOld();

    /// @notice Signers bitmask contains bits not in active set
    error BLSVerifier__BitmaskInvalid();

    /// @notice Signer count below ceil(2n/3) threshold
    error BLSVerifier__BelowThreshold();

    /// @notice BLS signature verification failed
    error BLSVerifier__InvalidSignature();

    // ============ STORAGE (FROZEN — 1 slot only) ============

    /// @notice The IssuerRegistry that holds the aggregated BLS pubkey
    /// @dev Set once during initialize/__BLSVerifier_init. Private to prevent
    ///      subclasses from accidentally shadowing.
    IIssuerRegistry private _blsIssuerRegistry;

    // ============ INIT ============

    /// @notice Initialize the BLS verifier with an IssuerRegistry
    /// @dev Call from initialize() (UUPS) or constructor (non-upgradeable)
    function __BLSVerifier_init(address registry_) internal {
        if (registry_ == address(0)) revert ErrorsLib.E043_ZeroIssuerRegistry();
        _blsIssuerRegistry = IIssuerRegistry(registry_);
    }

    // ============ VERIFICATION ============

    /// @notice Verify a BLS signature against a historical registry snapshot
    /// @dev NOT `view` — calls incrementMissedCounts which writes state.
    ///      All ~55 callers are already non-view (they write state), so this is safe.
    /// @param messageHash The keccak256 message hash
    /// @param blsSignature The aggregated BLS signature (64 bytes, G1 point)
    /// @param referenceNonce Registry snapshot nonce to verify against
    /// @param signersBitmask Bitmask of issuers that signed (bit i = issuer i signed)
    function _verifyBLS(
        bytes32 messageHash,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) internal {
        if (address(_blsIssuerRegistry) == address(0))
            revert ErrorsLib.E043_ZeroIssuerRegistry();

        // Validate reference nonce is within acceptable window
        uint256 latest = _blsIssuerRegistry.lastSnapshotNonce();
        uint256 minNonce = latest > 256 ? latest - 256 : 0;
        if (referenceNonce < minNonce) revert BLSVerifier__NonceTooOld();
        if (referenceNonce > latest) revert BLSVerifier__NonceFuture();

        // Load historical snapshot
        TypesLib.RegistrySnapshot memory snap = _blsIssuerRegistry.getSnapshotAtNonce(referenceNonce);
        if (block.number - snap.blockNumber > 86400) revert BLSVerifier__SnapshotTooOld();

        // Validate signers bitmask is a subset of active bitmask (no stray bits)
        if ((signersBitmask & ~snap.activeBitmask) != 0) revert BLSVerifier__BitmaskInvalid();

        // Check ceil(2n/3) threshold
        if (_popcount(signersBitmask) < (snap.activeCount * 2 + 2) / 3) revert BLSVerifier__BelowThreshold();

        // Verify BLS signature against individual signer pubkeys (multi-pairing)
        // Single external call — keeps verifyBLSMulti bytecode in IssuerRegistry, not Investment
        if (!_blsIssuerRegistry.verifyBLSMultiPairing(signersBitmask, messageHash, blsSignature))
            revert BLSVerifier__InvalidSignature();

        // Liveness accounting — advisory only (see Protocol Invariant P3)
        uint256 nonSignersBitmask = snap.activeBitmask ^ signersBitmask;
        if (nonSignersBitmask != 0) {
            _blsIssuerRegistry.incrementMissedCounts(nonSignersBitmask);
        }
    }

    // ============ VIEW ============

    /// @notice Get the IssuerRegistry used for BLS verification
    function blsIssuerRegistry() public view returns (IIssuerRegistry) {
        return _blsIssuerRegistry;
    }

    // ============ INTERNAL HELPERS ============

    /// @dev Convert fixed bytes32[4] pubkey to dynamic bytes for BLSLib
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
}
