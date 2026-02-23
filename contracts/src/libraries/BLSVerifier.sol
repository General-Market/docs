// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IIssuerRegistry} from "../interfaces/IIssuerRegistry.sol";
import {BLSLib} from "./BLSLib.sol";
import {ErrorsLib} from "./ErrorsLib.sol";

/// @title BLSVerifier - Standard BLS signature verification mixin
/// @dev All contracts requiring BLS verification inherit this.
///      Single source of truth: reads aggregated pubkey from IssuerRegistry.
///      Follows EigenLayer's BLSSignatureChecker pattern.
/// @custom:security-contact security@indexprotocol.com
abstract contract BLSVerifier {
    /// @notice The IssuerRegistry that holds the aggregated BLS pubkey
    /// @dev Set once during initialize/__BLSVerifier_init. Private to prevent
    ///      subclasses from accidentally shadowing.
    IIssuerRegistry private _blsIssuerRegistry;

    /// @notice Initialize the BLS verifier with an IssuerRegistry
    /// @dev Call from initialize() (UUPS) or constructor (non-upgradeable)
    function __BLSVerifier_init(address registry_) internal {
        if (registry_ == address(0)) revert ErrorsLib.E043_ZeroIssuerRegistry();
        _blsIssuerRegistry = IIssuerRegistry(registry_);
    }

    /// @notice Verify a BLS signature against the aggregated pubkey
    /// @dev Reverts on any failure. No return value - if it doesn't revert, it's valid.
    /// @param messageHash The keccak256 message hash
    /// @param blsSignature The aggregated BLS signature (64 bytes, G1 point)
    function _verifyBLS(bytes32 messageHash, bytes calldata blsSignature) internal view {
        if (address(_blsIssuerRegistry) == address(0))
            revert ErrorsLib.E043_ZeroIssuerRegistry();
        bytes memory pubkey = _blsIssuerRegistry.getAggregatedPubkey();
        if (pubkey.length != 128)
            revert ErrorsLib.E07E_InvalidAggregatedPubkeyLength(pubkey.length);
        if (!BLSLib.verifyBLS(pubkey, messageHash, blsSignature))
            revert ErrorsLib.E020_InvalidBLSSignature();
    }

    /// @notice Get the IssuerRegistry used for BLS verification
    function blsIssuerRegistry() public view returns (IIssuerRegistry) {
        return _blsIssuerRegistry;
    }
}
