// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TypesLib} from "../libraries/TypesLib.sol";

/// @title IMirrorOracleRegistry
/// @notice Interface for MirrorOracleRegistry - mirror of L3 OracleRegistry synced via BLS proofs
/// @dev Implements a subset of IOracleRegistry for BLSVerifier compatibility.
///      Stores individual oracle pubkeys, snapshots, and supports multi-pairing verification.
interface IMirrorOracleRegistry {
    // ============ INITIALIZATION ============

    /// @notice Initialize the MirrorOracleRegistry
    /// @param aggPubkey Initial aggregated G2 pubkey (128 bytes) — bootstrap trust anchor
    /// @param threshold BLS threshold for signature verification
    /// @param activeCount Number of active oracles
    /// @param admin Admin address for upgrades
    function initialize(
        bytes calldata aggPubkey,
        uint256 threshold,
        uint256 activeCount,
        address admin
    ) external;

    // ============ SYNC ============

    /// @notice Sync registry state from L3 via BLS-signed proof
    /// @dev First sync (lastSnapshotNonce == 0): verifies against aggregated pubkey (TOFU)
    ///      Subsequent syncs: uses multi-pairing with 2/3 threshold via verifyBLSMultiPairing
    /// @param oraclePubkeys Individual G2 pubkeys for each oracle (128 bytes each)
    /// @param oracleIds Corresponding oracle IDs for each pubkey
    /// @param newActiveBitmask New active oracle bitmask
    /// @param newActiveCount New active oracle count
    /// @param newThreshold New BLS threshold
    /// @param nonce Must be > current registryNonce
    /// @param blsSignature Aggregated BLS signature (G1, 64 bytes)
    /// @param referenceNonce Snapshot nonce for BLS verification (ignored on first sync)
    /// @param signersBitmask Bitmask of which oracles signed
    function sync(
        bytes[] calldata oraclePubkeys,
        uint256[] calldata oracleIds,
        uint256 newActiveBitmask,
        uint256 newActiveCount,
        uint256 newThreshold,
        uint256 nonce,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external;

    // ============ IOracleRegistry SUBSET (for BLSVerifier) ============

    /// @notice Get the latest snapshot nonce
    /// @return The latest nonce that has a snapshot
    function lastSnapshotNonce() external view returns (uint256);

    /// @notice Get a registry snapshot by nonce
    /// @param nonce The nonce to look up
    /// @return snapshot The registry snapshot at that nonce
    function getSnapshotAtNonce(uint256 nonce) external view returns (TypesLib.RegistrySnapshot memory snapshot);

    /// @notice Verify a BLS signature against individual signer pubkeys using multi-pairing
    /// @dev Decodes bitmask to oracle IDs, fetches individual pubkeys, calls BLSLib.verifyBLSMulti
    /// @param signersBitmask Bitmap of oracles that signed
    /// @param messageHash The message hash
    /// @param blsSignature The aggregated BLS signature (64 bytes G1 point)
    /// @return True if signature is valid
    function verifyBLSMultiPairing(
        uint256 signersBitmask,
        bytes32 messageHash,
        bytes calldata blsSignature
    ) external view returns (bool);

    /// @notice Increment missed counts for non-signing oracles (advisory liveness tracking)
    /// @dev Restricted to authorized callers (BLSVerifier-inheriting protocol contracts)
    /// @param nonSignersBitmask Bitmask of oracles that did not sign
    function incrementMissedCounts(uint256 nonSignersBitmask) external;

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

    /// @notice Get the current active oracle count
    /// @return The active count
    function activeCount() external view returns (uint256);

    /// @notice Get the current registry nonce
    /// @return The nonce value
    function registryNonce() external view returns (uint256);

    /// @notice Get the admin address
    /// @return The admin address
    function admin() external view returns (address);

    /// @notice Get the active oracle bitmask
    /// @return The active bitmask
    function activeBitmask() external view returns (uint256);

    /// @notice Get the missed count for a specific oracle
    /// @param oracleId The oracle ID
    /// @return The missed count
    function getMissedCount(uint256 oracleId) external view returns (uint256);

    /// @notice Check if an address is authorized to call incrementMissedCounts
    /// @param caller The address to check
    /// @return Whether the address is authorized
    function authorizedMissedCountCallers(address caller) external view returns (bool);

    // ============ ADMIN FUNCTIONS ============

    /// @notice Set a new admin address (admin only)
    /// @param newAdmin The new admin address
    function setAdmin(address newAdmin) external;

    /// @notice Authorize or deauthorize a caller for incrementMissedCounts
    /// @param caller The address to authorize/deauthorize
    /// @param authorized Whether to authorize or deauthorize
    function setAuthorizedMissedCountCaller(address caller, bool authorized) external;
}
