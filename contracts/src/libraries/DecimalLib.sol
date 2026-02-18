// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title DecimalLib
/// @notice Utility library for converting between USDC decimals (6) and internal decimals (18)
/// @dev All internal protocol calculations use 18 decimals. Conversion happens at entry/exit boundaries.
///
/// Conversion boundaries:
/// - Entry (Arbitrum → L3): User deposits 6-decimal USDC, convert to 18-decimal internal
/// - Exit (L3 → Arbitrum): Internal 18-decimal amount, convert to 6-decimal USDC for transfer
///
/// Example:
///   User deposits 100 USDC = 100_000_000 (6 decimals)
///   Internal representation = 100_000_000_000_000_000_000 (18 decimals)
///   User receives 100 USDC = 100_000_000 (6 decimals)
library DecimalLib {
    /// @notice Number of decimals for real USDC (Arbitrum/mainnet)
    uint8 public constant USDC_DECIMALS = 6;

    /// @notice Number of decimals for internal protocol representation
    uint8 public constant INTERNAL_DECIMALS = 18;

    /// @notice Multiplier for converting between USDC and internal decimals
    /// @dev 10^(18-6) = 10^12 = 1_000_000_000_000
    uint256 public constant DECIMAL_MULTIPLIER = 1e12;

    /// @notice Convert 6-decimal USDC amount to 18-decimal internal representation
    /// @param usdc6 Amount in 6-decimal USDC format
    /// @return internal18 Amount in 18-decimal internal format
    /// @dev Cannot overflow: max uint256 / 1e12 > max realistic USDC supply
    function toInternal(uint256 usdc6) internal pure returns (uint256 internal18) {
        return usdc6 * DECIMAL_MULTIPLIER;
    }

    /// @notice Convert 18-decimal internal amount to 6-decimal USDC
    /// @param internal18 Amount in 18-decimal internal format
    /// @return usdc6 Amount in 6-decimal USDC format (truncates dust)
    /// @dev Division truncates - use hasDust() to check for precision loss
    function toUsdc(uint256 internal18) internal pure returns (uint256 usdc6) {
        return internal18 / DECIMAL_MULTIPLIER;
    }

    /// @notice Check if an 18-decimal amount has dust that will be lost in conversion
    /// @param internal18 Amount in 18-decimal internal format
    /// @return hasDust True if amount has non-zero remainder when dividing by DECIMAL_MULTIPLIER
    /// @dev Dust = internal18 % 1e12 (max loss ~$0.000001)
    function hasDust(uint256 internal18) internal pure returns (bool) {
        return (internal18 % DECIMAL_MULTIPLIER) != 0;
    }

    /// @notice Get the dust amount that would be lost in conversion
    /// @param internal18 Amount in 18-decimal internal format
    /// @return dust The amount (in wei) that will be truncated
    function getDust(uint256 internal18) internal pure returns (uint256 dust) {
        return internal18 % DECIMAL_MULTIPLIER;
    }

    /// @notice Round-trip conversion check (for testing)
    /// @param usdc6 Amount in 6-decimal USDC format
    /// @return True if toUsdc(toInternal(usdc6)) == usdc6
    /// @dev Always true since conversion is lossless in this direction
    function roundTripLossless(uint256 usdc6) internal pure returns (bool) {
        return toUsdc(toInternal(usdc6)) == usdc6;
    }
}
