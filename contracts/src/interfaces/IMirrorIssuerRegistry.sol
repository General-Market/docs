// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IMirrorIssuerRegistry
/// @notice Interface for MirrorIssuerRegistry - mirror of L3 IssuerRegistry synced via BLS proofs
/// @dev Used by ITPNAVOracle and other contracts that need to verify BLS signatures
interface IMirrorIssuerRegistry {
    // ============ INITIALIZATION ============

    /// @notice Initialize the MirrorIssuerRegistry
    /// @param aggPubkey Initial aggregated G2 pubkey (128 bytes)
    /// @param threshold BLS threshold for signature verification
    /// @param activeCount Number of active issuers
    /// @param admin Admin address for upgrades
    function initialize(
        bytes calldata aggPubkey,
        uint256 threshold,
        uint256 activeCount,
        address admin
    ) external;

    // ============ SYNC ============

    /// @notice Sync registry state from L3 via BLS-signed proof
    /// @param newAggPubkey New aggregated G2 pubkey (128 bytes)
    /// @param newActiveCount New active issuer count
    /// @param newThreshold New BLS threshold
    /// @param nonce Must be > current registryNonce
    /// @param blsSignature Aggregated BLS signature (G1, 64 bytes)
    /// @param signersBitmask Bitmask of which issuers signed
    function sync(
        bytes calldata newAggPubkey,
        uint256 newActiveCount,
        uint256 newThreshold,
        uint256 nonce,
        bytes calldata blsSignature,
        uint256 signersBitmask
    ) external;

    // ============ VIEW FUNCTIONS ============

    /// @notice Get the current aggregated G2 pubkey
    /// @return The aggregated pubkey bytes (128 bytes)
    function getAggregatedPubkey() external view returns (bytes memory);

    /// @notice Get the current aggregated pubkey (storage variable)
    /// @return The aggregated pubkey bytes
    function aggregatedPubkey() external view returns (bytes memory);

    /// @notice Get the current BLS threshold
    /// @return The threshold value
    function threshold() external view returns (uint256);

    /// @notice Get the current active issuer count
    /// @return The active count
    function activeCount() external view returns (uint256);

    /// @notice Get the current registry nonce
    /// @return The nonce value
    function registryNonce() external view returns (uint256);

    /// @notice Get the admin address
    /// @return The admin address
    function admin() external view returns (address);

    // ============ ADMIN FUNCTIONS ============

    /// @notice Set a new admin address (admin only)
    /// @param newAdmin The new admin address
    function setAdmin(address newAdmin) external;
}
