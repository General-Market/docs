// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IITPNAVOracle
/// @notice Interface for ITP NAV Oracle with BLS-verified pricing
/// @dev Used by Morpho Blue markets to price ITP collateral.
///      Uses BLSVerifier (multi-pairing, 2/3 threshold, snapshot-based) — same as all other contracts.
interface IITPNAVOracle {
    /// @notice Get the current ITP price for Morpho Blue
    /// @dev Reverts with E096_StaleOraclePrice if price is older than MAX_STALENESS
    /// @return The current price in 36-decimal format (Morpho standard)
    function price() external view returns (uint256);

    /// @notice Update the ITP NAV price with a BLS-verified signature
    /// @dev Permissionless — anyone can call with a valid BLS signature from the oracle network.
    ///      Uses BLSVerifier._verifyBLS() internally (multi-pairing, 2/3 threshold, snapshot-based).
    /// @param newPrice The new NAV price (36 decimals)
    /// @param timestamp The timestamp associated with the price (from oracle cycle)
    /// @param cycleNumber The oracle cycle number (must be > lastCycleNumber)
    /// @param blsSignature Aggregated BLS signature (G1, 64 bytes)
    /// @param referenceNonce Registry snapshot nonce for BLS verification
    /// @param signersBitmask Bitmask of which oracles signed
    function updatePrice(
        uint256 newPrice,
        uint256 timestamp,
        uint256 cycleNumber,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external;

    /// @notice Get the current stored price
    /// @return The current price (36 decimals)
    function currentPrice() external view returns (uint256);

    /// @notice Get the timestamp of the last price update
    /// @return Block timestamp of last update
    function lastUpdated() external view returns (uint256);

    /// @notice Get the last processed cycle number
    /// @return The last cycle number
    function lastCycleNumber() external view returns (uint256);

    /// @notice Get the ITP address this oracle prices
    /// @return The ITP token address
    function itpAddress() external view returns (address);

    /// @notice Get the price decimal precision
    /// @return The number of decimals (36)
    function PRICE_DECIMALS() external view returns (uint256);

    /// @notice Get the maximum staleness duration
    /// @return The maximum staleness in seconds (24 hours)
    function MAX_STALENESS() external view returns (uint256);

    /// @notice Get the maximum price deviation in basis points
    /// @return The maximum deviation (1000 = 10%)
    function MAX_DEVIATION_BPS() external view returns (uint256);

    /// @notice Get the maximum cycle gap allowed
    /// @return The maximum cycle gap (10000)
    function MAX_CYCLE_GAP() external view returns (uint256);
}
