// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BLSVerifier} from "../libraries/BLSVerifier.sol";
import {IIssuerRegistry} from "../interfaces/IIssuerRegistry.sol";

/// @title ArbitrationSettlement — BLS-verified bet resolution via issuer consensus
/// @notice Settles bets on CollateralVault using aggregated BLS signatures from issuers.
///         Uses BLSVerifier (same pattern as Investment.sol) for signature verification
///         against the IssuerRegistry aggregated pubkey. Configurable signature threshold
///         via signer bitmap popcount.
contract ArbitrationSettlement is BLSVerifier {
    // ============ Errors ============

    error ZeroBetId();
    error InsufficientSignatures(uint256 provided, uint256 required);
    error BetAlreadySettled(uint256 betId);
    error InvalidThreshold(uint256 threshold);
    error Unauthorized();
    error SettlementCallFailed();

    // ============ Events ============

    event BetSettled(uint256 indexed betId, bool creatorWins, uint256 signerCount);
    event ThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);

    // ============ State ============

    /// @notice The CollateralVault to call settleBetByArbitration on
    address public immutable collateralVault;

    /// @notice Governance address that can update the threshold
    address public governance;

    /// @notice Minimum number of issuer signatures required (bitmap popcount)
    uint256 public signatureThreshold;

    /// @notice Tracks which bets have been settled (replay protection)
    mapping(uint256 => bool) public settled;

    // ============ Constructor ============

    /// @param _issuerRegistry IssuerRegistry holding aggregated BLS pubkey
    /// @param _collateralVault CollateralVault contract address
    /// @param _governance Governance address for threshold updates
    /// @param _threshold Initial signature threshold (default 2)
    constructor(
        address _issuerRegistry,
        address _collateralVault,
        address _governance,
        uint256 _threshold
    ) {
        if (_collateralVault == address(0)) revert Unauthorized();
        if (_governance == address(0)) revert Unauthorized();
        if (_threshold == 0) revert InvalidThreshold(_threshold);

        __BLSVerifier_init(_issuerRegistry);
        collateralVault = _collateralVault;
        governance = _governance;
        signatureThreshold = _threshold;
    }

    // ============ Settlement ============

    /// @notice Settle a bet via aggregated BLS signature from issuers
    /// @dev Message format: keccak256(abi.encode(chainid, this, "settleBet", betId, creatorWins))
    ///      Follows the same message-hash convention as Investment.sol (chainid + address + tag + params).
    ///      The signerBitmap is used ONLY for threshold counting (popcount >= signatureThreshold).
    ///      Actual signature verification uses the aggregated pubkey from IssuerRegistry,
    ///      matching the BLSVerifier._verifyBLS pattern used by all Index contracts.
    /// @param betId The bet to settle (must not be 0, must not already be settled)
    /// @param creatorWins True if creator wins, false if filler wins
    /// @param blsSignature Aggregated BLS signature (64 bytes, G1 point)
    /// @param signerBitmap Bitmap of issuer IDs that signed (bit i = issuer i signed)
    function settleBet(
        uint256 betId,
        bool creatorWins,
        bytes calldata blsSignature,
        uint256 signerBitmap
    ) external {
        if (betId == 0) revert ZeroBetId();
        if (settled[betId]) revert BetAlreadySettled(betId);

        // Count signers from bitmap and verify threshold
        uint256 signerCount = _popcount(signerBitmap);
        if (signerCount < signatureThreshold)
            revert InsufficientSignatures(signerCount, signatureThreshold);

        // Validate bitmap against IssuerRegistry (only active issuers count)
        (uint256 validCount, ) = blsIssuerRegistry().verifySignerBitmap(signerBitmap);
        if (validCount < signatureThreshold)
            revert InsufficientSignatures(validCount, signatureThreshold);

        // Message hash: same convention as Investment.sol — chainid + contract + tag + params
        bytes32 messageHash = keccak256(
            abi.encode(block.chainid, address(this), "settleBet", betId, creatorWins)
        );

        // Verify aggregated BLS signature via BLSVerifier (reads aggregated pubkey from IssuerRegistry)
        // Reverts with E020_InvalidBLSSignature on failure — no bypass path
        _verifyBLS(messageHash, blsSignature);

        // Mark as settled (replay protection)
        settled[betId] = true;

        // Call CollateralVault.settleBetByArbitration(uint256 betId, bool creatorWins)
        (bool success, ) = collateralVault.call(
            abi.encodeWithSignature(
                "settleBetByArbitration(uint256,bool)",
                betId,
                creatorWins
            )
        );
        if (!success) revert SettlementCallFailed();

        emit BetSettled(betId, creatorWins, validCount);
    }

    // ============ Governance ============

    /// @notice Update the signature threshold
    /// @param newThreshold New minimum number of signers required
    function setThreshold(uint256 newThreshold) external {
        if (msg.sender != governance) revert Unauthorized();
        if (newThreshold == 0) revert InvalidThreshold(newThreshold);
        uint256 old = signatureThreshold;
        signatureThreshold = newThreshold;
        emit ThresholdUpdated(old, newThreshold);
    }

    // ============ Internal ============

    /// @notice Count set bits in a uint256 (Hamming weight / popcount)
    /// @param x The bitmap to count
    /// @return count Number of set bits
    function _popcount(uint256 x) internal pure returns (uint256 count) {
        while (x != 0) {
            count += x & 1;
            x >>= 1;
        }
    }
}
