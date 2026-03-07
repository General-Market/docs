//! USDC decimal conversion utilities
//!
//! Converts between 6-decimal USDC (real settlement chain/mainnet USDC) and 18-decimal
//! internal representation used throughout the protocol.
//!
//! # Conversion Boundaries
//!
//! - **Entry (Settlement → L3):** User deposits 6-decimal USDC, convert to 18-decimal internal
//! - **Exit (L3 → Settlement):** Internal 18-decimal amount, convert to 6-decimal USDC for transfer
//!
//! # Example
//!
//! ```
//! use common::decimals;
//! use ethers::types::U256;
//!
//! // User deposits 100 USDC = 100_000_000 (6 decimals)
//! let usdc_6 = U256::from(100_000_000u64);
//!
//! // Convert to internal representation
//! let internal_18 = decimals::to_internal(usdc_6);
//! // internal_18 = 100_000_000_000_000_000_000 (18 decimals)
//!
//! // Convert back to USDC
//! let back_to_usdc = decimals::to_usdc(internal_18);
//! assert_eq!(back_to_usdc, usdc_6);
//! ```

use ethers::types::U256;

/// Number of decimals for real USDC (settlement chain/mainnet)
pub const USDC_DECIMALS: u8 = 6;

/// Number of decimals for internal protocol representation
pub const INTERNAL_DECIMALS: u8 = 18;

/// Get the decimal multiplier (10^12)
/// Using a function since U256 const construction isn't straightforward
#[inline]
pub fn decimal_multiplier() -> U256 {
    U256::exp10(12)
}

/// Convert 6-decimal USDC amount to 18-decimal internal representation
///
/// # Arguments
/// * `usdc_6` - Amount in 6-decimal USDC format
///
/// # Returns
/// Amount in 18-decimal internal format
///
/// # Note
/// Uses saturating multiplication to prevent overflow. In practice, this should
/// never overflow given reasonable USDC amounts (total USDC supply is ~50B).
#[inline]
pub fn to_internal(usdc_6: U256) -> U256 {
    usdc_6.saturating_mul(decimal_multiplier())
}

/// Convert 18-decimal internal amount to 6-decimal USDC
///
/// # Arguments
/// * `internal_18` - Amount in 18-decimal internal format
///
/// # Returns
/// Amount in 6-decimal USDC format (truncates any dust)
///
/// # Note
/// Division truncates - use `has_dust()` to check for precision loss before conversion.
#[inline]
pub fn to_usdc(internal_18: U256) -> U256 {
    internal_18 / decimal_multiplier()
}

/// Check if an 18-decimal amount has dust that will be lost in conversion
///
/// # Arguments
/// * `internal_18` - Amount in 18-decimal internal format
///
/// # Returns
/// `true` if amount has non-zero remainder when dividing by DECIMAL_MULTIPLIER
///
/// # Note
/// Maximum dust loss is ~$0.000001 per transaction.
#[inline]
pub fn has_dust(internal_18: U256) -> bool {
    (internal_18 % decimal_multiplier()) != U256::zero()
}

/// Get the dust amount that would be lost in conversion
///
/// # Arguments
/// * `internal_18` - Amount in 18-decimal internal format
///
/// # Returns
/// The amount (in wei) that will be truncated during conversion
#[inline]
pub fn get_dust(internal_18: U256) -> U256 {
    internal_18 % decimal_multiplier()
}

/// Round-trip conversion check (for testing)
///
/// # Arguments
/// * `usdc_6` - Amount in 6-decimal USDC format
///
/// # Returns
/// `true` if `to_usdc(to_internal(usdc_6)) == usdc_6`
///
/// # Note
/// Always returns `true` since conversion is lossless in this direction.
#[inline]
pub fn round_trip_lossless(usdc_6: U256) -> bool {
    to_usdc(to_internal(usdc_6)) == usdc_6
}

/// Parse a human-readable USDC amount (e.g., "100.50") to 6-decimal format
///
/// # Arguments
/// * `amount_str` - String like "100", "100.50", "0.001"
///
/// # Returns
/// Amount in 6-decimal USDC format, or error if parsing fails
///
/// # Example
/// ```
/// use common::decimals::parse_usdc;
/// use ethers::types::U256;
///
/// assert_eq!(parse_usdc("100").unwrap(), U256::from(100_000_000u64));
/// assert_eq!(parse_usdc("100.50").unwrap(), U256::from(100_500_000u64));
/// assert_eq!(parse_usdc("0.001").unwrap(), U256::from(1_000u64));
/// ```
pub fn parse_usdc(amount_str: &str) -> Result<U256, DecimalError> {
    let parts: Vec<&str> = amount_str.split('.').collect();

    match parts.len() {
        1 => {
            // No decimal point
            let whole: u128 = parts[0]
                .parse()
                .map_err(|_| DecimalError::ParseError(amount_str.to_string()))?;
            Ok(U256::from(whole) * U256::from(1_000_000u64))
        }
        2 => {
            // Has decimal point
            let whole: u128 = if parts[0].is_empty() {
                0
            } else {
                parts[0]
                    .parse()
                    .map_err(|_| DecimalError::ParseError(amount_str.to_string()))?
            };

            let frac_str = parts[1];
            if frac_str.len() > 6 {
                return Err(DecimalError::TooManyDecimals(frac_str.len()));
            }

            let frac_padded = format!("{:0<6}", frac_str);
            let frac: u64 = frac_padded
                .parse()
                .map_err(|_| DecimalError::ParseError(amount_str.to_string()))?;

            let whole_units = U256::from(whole) * U256::from(1_000_000u64);
            Ok(whole_units + U256::from(frac))
        }
        _ => Err(DecimalError::ParseError(amount_str.to_string())),
    }
}

/// Format a 6-decimal USDC amount to human-readable string
///
/// # Arguments
/// * `usdc_6` - Amount in 6-decimal USDC format
///
/// # Returns
/// Human-readable string like "100.50"
pub fn format_usdc(usdc_6: U256) -> String {
    let million = U256::from(1_000_000u64);
    let whole = usdc_6 / million;
    let frac = usdc_6 % million;

    if frac.is_zero() {
        whole.to_string()
    } else {
        // Trim trailing zeros from fractional part
        let frac_str = format!("{:06}", frac);
        let frac_trimmed = frac_str.trim_end_matches('0');
        format!("{}.{}", whole, frac_trimmed)
    }
}

/// Errors that can occur during decimal operations
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DecimalError {
    /// Failed to parse the amount string
    ParseError(String),
    /// Too many decimal places (max 6 for USDC)
    TooManyDecimals(usize),
}

impl std::fmt::Display for DecimalError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            DecimalError::ParseError(s) => write!(f, "Failed to parse amount: {}", s),
            DecimalError::TooManyDecimals(n) => {
                write!(f, "Too many decimal places: {} (max 6)", n)
            }
        }
    }
}

impl std::error::Error for DecimalError {}

#[cfg(test)]
mod tests {
    use super::*;

    // ============ to_internal TESTS ============

    #[test]
    fn test_to_internal_zero() {
        assert_eq!(to_internal(U256::zero()), U256::zero());
    }

    #[test]
    fn test_to_internal_one_usdc() {
        // 1 USDC = 1_000_000 (6 dec) → 1e18 (18 dec)
        let usdc_1 = U256::from(1_000_000u64);
        let expected = U256::exp10(18);
        assert_eq!(to_internal(usdc_1), expected);
    }

    #[test]
    fn test_to_internal_100_usdc() {
        let usdc_100 = U256::from(100_000_000u64);
        let expected = U256::from(100u64) * U256::exp10(18);
        assert_eq!(to_internal(usdc_100), expected);
    }

    #[test]
    fn test_to_internal_fractional_usdc() {
        // 0.001 USDC = 1000 (6 dec) → 1e15 (18 dec)
        let usdc_fractional = U256::from(1000u64);
        let expected = U256::exp10(15);
        assert_eq!(to_internal(usdc_fractional), expected);
    }

    #[test]
    fn test_to_internal_smallest_unit() {
        // 0.000001 USDC = 1 (6 dec) → 1e12 (18 dec)
        let usdc_smallest = U256::from(1u64);
        let expected = U256::exp10(12);
        assert_eq!(to_internal(usdc_smallest), expected);
    }

    // ============ to_usdc TESTS ============

    #[test]
    fn test_to_usdc_zero() {
        assert_eq!(to_usdc(U256::zero()), U256::zero());
    }

    #[test]
    fn test_to_usdc_one_usdc_internal() {
        let internal_1 = U256::exp10(18);
        let expected = U256::from(1_000_000u64);
        assert_eq!(to_usdc(internal_1), expected);
    }

    #[test]
    fn test_to_usdc_100_usdc_internal() {
        let internal_100 = U256::from(100u64) * U256::exp10(18);
        let expected = U256::from(100_000_000u64);
        assert_eq!(to_usdc(internal_100), expected);
    }

    #[test]
    fn test_to_usdc_truncates_dust() {
        // 100 USDC + 999,999,999,999 wei dust
        let internal_with_dust =
            U256::from(100u64) * U256::exp10(18) + U256::from(999_999_999_999u64);
        let expected = U256::from(100_000_000u64);
        assert_eq!(to_usdc(internal_with_dust), expected);
    }

    #[test]
    fn test_to_usdc_below_minimum() {
        // Amounts below 1e12 convert to 0
        assert_eq!(to_usdc(U256::from(1u64)), U256::zero());
        assert_eq!(to_usdc(U256::from(999_999_999_999u64)), U256::zero());
    }

    // ============ has_dust TESTS ============

    #[test]
    fn test_has_dust_no_dust() {
        assert!(!has_dust(U256::zero()));
        assert!(!has_dust(U256::exp10(12)));
        assert!(!has_dust(U256::exp10(18)));
    }

    #[test]
    fn test_has_dust_with_dust() {
        assert!(has_dust(U256::from(1u64)));
        assert!(has_dust(U256::from(999_999_999_999u64)));
        assert!(has_dust(U256::exp10(12) + U256::from(1u64)));
    }

    // ============ get_dust TESTS ============

    #[test]
    fn test_get_dust_no_dust() {
        assert_eq!(get_dust(U256::zero()), U256::zero());
        assert_eq!(get_dust(U256::exp10(12)), U256::zero());
    }

    #[test]
    fn test_get_dust_with_dust() {
        assert_eq!(get_dust(U256::from(1u64)), U256::from(1u64));
        assert_eq!(get_dust(U256::exp10(12) + U256::from(123u64)), U256::from(123u64));
    }

    // ============ round_trip TESTS ============

    #[test]
    fn test_round_trip_lossless() {
        assert!(round_trip_lossless(U256::zero()));
        assert!(round_trip_lossless(U256::from(1u64)));
        assert!(round_trip_lossless(U256::from(1_000_000u64)));
        assert!(round_trip_lossless(U256::from(100_000_000u64)));
    }

    #[test]
    fn test_round_trip_various() {
        for &usdc in &[0u64, 1, 100, 1000, 1_000_000, 100_000_000, 1_000_000_000_000] {
            let original = U256::from(usdc);
            let internal = to_internal(original);
            let back = to_usdc(internal);
            assert_eq!(back, original, "Round trip failed for {}", usdc);
        }
    }

    // ============ parse_usdc TESTS ============

    #[test]
    fn test_parse_usdc_whole() {
        assert_eq!(parse_usdc("100").unwrap(), U256::from(100_000_000u64));
        assert_eq!(parse_usdc("1").unwrap(), U256::from(1_000_000u64));
        assert_eq!(parse_usdc("0").unwrap(), U256::zero());
    }

    #[test]
    fn test_parse_usdc_fractional() {
        assert_eq!(parse_usdc("100.50").unwrap(), U256::from(100_500_000u64));
        assert_eq!(parse_usdc("0.001").unwrap(), U256::from(1_000u64));
        assert_eq!(parse_usdc("0.000001").unwrap(), U256::from(1u64));
    }

    #[test]
    fn test_parse_usdc_too_many_decimals() {
        assert!(matches!(
            parse_usdc("100.0000001"),
            Err(DecimalError::TooManyDecimals(7))
        ));
    }

    // ============ format_usdc TESTS ============

    #[test]
    fn test_format_usdc() {
        assert_eq!(format_usdc(U256::from(100_000_000u64)), "100");
        assert_eq!(format_usdc(U256::from(100_500_000u64)), "100.5");
        assert_eq!(format_usdc(U256::from(1_000u64)), "0.001");
        assert_eq!(format_usdc(U256::from(1u64)), "0.000001");
        assert_eq!(format_usdc(U256::zero()), "0");
    }

    // ============ CONSTANTS TESTS ============

    #[test]
    fn test_constants() {
        assert_eq!(USDC_DECIMALS, 6);
        assert_eq!(INTERNAL_DECIMALS, 18);
        assert_eq!(decimal_multiplier(), U256::exp10(12));
    }

    // ============ REAL-WORLD SCENARIO TESTS ============

    #[test]
    fn test_real_world_user_deposit() {
        // User deposits 1000 USDC on settlement chain
        let user_deposit = U256::from(1000u64 * 1_000_000u64); // 1,000,000,000

        // Contract converts to internal representation
        let internal = to_internal(user_deposit);
        assert_eq!(internal, U256::from(1000u64) * U256::exp10(18));

        // Later, user withdraws - convert back
        let user_receives = to_usdc(internal);
        assert_eq!(user_receives, user_deposit);
    }

    #[test]
    fn test_real_world_dust_loss() {
        // Internal amount with dust (e.g., from fee calculation)
        let internal_with_dust =
            U256::from(1000u64) * U256::exp10(18) + U256::from(500_000_000_000u64);

        // Check dust exists
        assert!(has_dust(internal_with_dust));
        assert_eq!(get_dust(internal_with_dust), U256::from(500_000_000_000u64));

        // Convert - dust is truncated
        let usdc = to_usdc(internal_with_dust);
        assert_eq!(usdc, U256::from(1_000_000_000u64)); // Exactly 1000 USDC
    }
}
