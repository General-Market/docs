//! Price calculation utilities for Uniswap V3 sqrtPriceX96 format
//!
//! Uniswap V3 stores price as `sqrtPriceX96 = sqrt(price) * 2^96`
//!
//! To convert to actual price:
//! ```text
//! price = (sqrtPriceX96 / 2^96)^2
//!       = sqrtPriceX96^2 / 2^192
//! ```
//!
//! The price represents token1 per token0 (i.e., how many token1 you get for 1 token0).
//! To adjust for different decimal places:
//! ```text
//! adjusted_price = price * 10^(token0_decimals - token1_decimals)
//! ```

use super::error::{OnchainQuoteError, Result};
use ethers::types::U256;
use rust_decimal::prelude::*;
use rust_decimal::Decimal;

/// Q96 constant: 2^96 used in Uniswap V3 fixed-point math
const Q96: u128 = 1u128 << 96;

/// Q192 constant: 2^192 = (2^96)^2
const Q192_STR: &str = "6277101735386680763835789423207666416102355444464034512896";

/// Calculate price from sqrtPriceX96
///
/// Formula: price = (sqrtPriceX96 / 2^96)^2 = sqrtPriceX96^2 / 2^192
///
/// # Arguments
///
/// * `sqrt_price_x96` - The sqrtPriceX96 value from Uniswap V3 slot0
/// * `token0_decimals` - Decimals of token0 (sorted lower address)
/// * `token1_decimals` - Decimals of token1 (sorted higher address)
///
/// # Returns
///
/// The price of token0 in terms of token1 (how many token1 per 1 token0),
/// adjusted for decimal differences.
pub fn calculate_price_from_sqrt(
    sqrt_price_x96: U256,
    token0_decimals: u8,
    token1_decimals: u8,
) -> Result<Decimal> {
    // Validate input
    if sqrt_price_x96.is_zero() {
        return Err(OnchainQuoteError::MathOverflow {
            context: "sqrtPriceX96 is zero".to_string(),
        });
    }

    // Calculate sqrtPriceX96^2 using checked multiplication to detect overflow
    let sqrt_price_squared = sqrt_price_x96
        .checked_mul(sqrt_price_x96)
        .ok_or_else(|| OnchainQuoteError::MathOverflow {
            context: "sqrtPriceX96 squared overflowed U256".to_string(),
        })?;

    // Convert U256 to Decimal
    let numerator = u256_to_decimal(sqrt_price_squared)?;

    // Parse Q192 as Decimal
    let q192 = Decimal::from_str(Q192_STR).map_err(|_| OnchainQuoteError::MathOverflow {
        context: "Failed to parse Q192 constant".to_string(),
    })?;

    // Calculate raw price
    let raw_price = numerator
        .checked_div(q192)
        .ok_or_else(|| OnchainQuoteError::MathOverflow {
            context: "Division by Q192 failed".to_string(),
        })?;

    // Adjust for decimal differences
    // price_adjusted = raw_price * 10^(token0_decimals - token1_decimals)
    let decimal_diff = token0_decimals as i32 - token1_decimals as i32;
    let adjustment = compute_power_of_ten(decimal_diff)?;

    let adjusted_price = raw_price.checked_mul(adjustment).ok_or_else(|| {
        OnchainQuoteError::MathOverflow {
            context: "Price adjustment multiplication overflowed".to_string(),
        }
    })?;

    Ok(adjusted_price)
}

/// Calculate price in the reverse direction (token0 per token1)
///
/// This is simply 1/price from `calculate_price_from_sqrt`
pub fn calculate_inverse_price(
    sqrt_price_x96: U256,
    token0_decimals: u8,
    token1_decimals: u8,
) -> Result<Decimal> {
    let price = calculate_price_from_sqrt(sqrt_price_x96, token0_decimals, token1_decimals)?;

    if price.is_zero() {
        return Err(OnchainQuoteError::MathOverflow {
            context: "Cannot compute inverse of zero price".to_string(),
        });
    }

    Decimal::ONE.checked_div(price).ok_or_else(|| {
        OnchainQuoteError::MathOverflow {
            context: "Inverse price calculation overflowed".to_string(),
        }
    })
}

/// Get the price with correct direction based on which token is being sold
///
/// # Arguments
///
/// * `sqrt_price_x96` - The sqrtPriceX96 value from Uniswap V3 slot0
/// * `token_in` - The token being sold
/// * `token_out` - The token being bought
/// * `token_in_decimals` - Decimals of the token being sold
/// * `token_out_decimals` - Decimals of the token being bought
///
/// # Returns
///
/// The price of token_in in terms of token_out (how many token_out per 1 token_in)
pub fn get_price_for_swap(
    sqrt_price_x96: U256,
    token_in: ethers::types::Address,
    token_out: ethers::types::Address,
    token_in_decimals: u8,
    token_out_decimals: u8,
) -> Result<Decimal> {
    // Determine which token is token0 (lower address)
    let token0 = if token_in < token_out {
        token_in
    } else {
        token_out
    };

    let (token0_decimals, token1_decimals) = if token_in < token_out {
        (token_in_decimals, token_out_decimals)
    } else {
        (token_out_decimals, token_in_decimals)
    };

    // Calculate base price (token1 per token0)
    let base_price = calculate_price_from_sqrt(sqrt_price_x96, token0_decimals, token1_decimals)?;

    // If selling token0, the price is already correct (token1 per token0)
    // If selling token1, we need the inverse (token0 per token1)
    if token_in == token0 {
        Ok(base_price)
    } else {
        if base_price.is_zero() {
            return Err(OnchainQuoteError::MathOverflow {
                context: "Cannot compute inverse of zero price".to_string(),
            });
        }
        Decimal::ONE.checked_div(base_price).ok_or_else(|| {
            OnchainQuoteError::MathOverflow {
                context: "Inverse price calculation overflowed".to_string(),
            }
        })
    }
}

/// Calculate output amount for a given input amount
///
/// # Arguments
///
/// * `amount_in` - Input amount in smallest units
/// * `sqrt_price_x96` - The sqrtPriceX96 value from Uniswap V3 slot0
/// * `token_in` - Input token address
/// * `token_out` - Output token address
/// * `token_in_decimals` - Decimals of input token
/// * `token_out_decimals` - Decimals of output token
///
/// # Returns
///
/// Expected output amount (before fees and slippage)
pub fn calculate_output_amount(
    amount_in: U256,
    sqrt_price_x96: U256,
    token_in: ethers::types::Address,
    token_out: ethers::types::Address,
    token_in_decimals: u8,
    token_out_decimals: u8,
) -> Result<U256> {
    let price =
        get_price_for_swap(sqrt_price_x96, token_in, token_out, token_in_decimals, token_out_decimals)?;

    // Convert amount_in to Decimal
    let amount_in_dec = u256_to_decimal(amount_in)?;

    // Calculate output amount
    let amount_out_dec = amount_in_dec.checked_mul(price).ok_or_else(|| {
        OnchainQuoteError::MathOverflow {
            context: "Output amount calculation overflowed".to_string(),
        }
    })?;

    // Convert back to U256
    decimal_to_u256(amount_out_dec)
}

/// Estimate price impact in basis points
///
/// **WARNING**: This is a simplified estimation that does NOT account for:
/// - Uniswap V3 concentrated liquidity positions
/// - Tick boundaries and liquidity distribution
/// - Current price position within active tick range
///
/// For small trades (<1% of pool liquidity), this provides a reasonable estimate.
/// For larger trades, the actual impact will likely be HIGHER than estimated.
///
/// TODO: Implement proper Uniswap V3 price impact calculation using tick math
/// for production use with large trade sizes.
///
/// # Arguments
///
/// * `amount` - Trade amount in token0 units
/// * `liquidity` - Pool liquidity (from slot0)
/// * `sqrt_price_x96` - Current sqrt price (currently unused, reserved for future improvement)
///
/// # Returns
///
/// Estimated price impact in basis points (100 bps = 1%)
pub fn estimate_price_impact_bps(amount: U256, liquidity: u128, _sqrt_price_x96: U256) -> u16 {
    if liquidity == 0 {
        return 10000; // 100% impact if no liquidity
    }

    // Simplified estimation: impact ~ amount / (liquidity * sqrt_price)
    // For large trades, this underestimates impact
    // For small trades, this is reasonably accurate
    let amount_u128 = if amount > U256::from(u128::MAX) {
        u128::MAX
    } else {
        amount.as_u128()
    };

    // Compute (amount * 10000) / liquidity in u128 to avoid truncation.
    // Use checked_mul to detect overflow; on overflow cap at 10000 bps (100%).
    let ratio = match amount_u128.checked_mul(10000) {
        Some(numerator) => numerator / liquidity,
        None => {
            // Overflow means amount is extremely large relative to basis points multiplier;
            // fall back to dividing first (loses precision but avoids overflow)
            (amount_u128 / liquidity).saturating_mul(10000)
        }
    };

    ratio.min(10000) as u16
}

/// Compute 10^exp as Decimal, handling both positive and negative exponents
fn compute_power_of_ten(exp: i32) -> Result<Decimal> {
    if exp == 0 {
        return Ok(Decimal::ONE);
    }

    let abs_exp = exp.unsigned_abs();
    let mut result = Decimal::ONE;
    let ten = Decimal::from(10);

    for _ in 0..abs_exp {
        result = result.checked_mul(ten).ok_or_else(|| OnchainQuoteError::MathOverflow {
            context: format!("10^{} overflow", abs_exp),
        })?;
    }

    if exp < 0 {
        Decimal::ONE.checked_div(result).ok_or_else(|| OnchainQuoteError::MathOverflow {
            context: format!("1 / 10^{} overflow", abs_exp),
        })
    } else {
        Ok(result)
    }
}

/// Convert U256 to Decimal
fn u256_to_decimal(value: U256) -> Result<Decimal> {
    // U256 can be very large, so we convert via string
    let value_str = value.to_string();
    Decimal::from_str(&value_str).map_err(|_| OnchainQuoteError::MathOverflow {
        context: format!("U256 {} too large for Decimal", value_str),
    })
}

/// Convert Decimal to U256
fn decimal_to_u256(value: Decimal) -> Result<U256> {
    // Truncate to integer and convert
    let truncated = value.trunc();
    if truncated.is_sign_negative() {
        return Err(OnchainQuoteError::MathOverflow {
            context: "Cannot convert negative Decimal to U256".to_string(),
        });
    }

    let value_str = truncated.to_string();
    U256::from_dec_str(&value_str).map_err(|_| OnchainQuoteError::MathOverflow {
        context: format!("Decimal {} too large for U256", value_str),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use ethers::types::Address;

    // Known sqrtPriceX96 values for testing
    // These are from real Uniswap V3 pools

    /// USDC/WETH pool at ~$2000/ETH
    /// sqrtPriceX96 = sqrt(0.0005) * 2^96 ≈ 1.77e27
    /// (USDC is token0 with 6 decimals, WETH is token1 with 18 decimals)
    const USDC_WETH_SQRT_PRICE_X96: &str = "1771595571142957166518320255467520";

    /// USDC/USDT stablecoin pool (near 1:1)
    /// sqrtPriceX96 ≈ 2^96 (sqrt(1) * 2^96)
    const STABLE_SQRT_PRICE_X96: &str = "79228162514264337593543950336";

    #[test]
    fn test_calculate_price_stablecoin() {
        // USDC/USDT pool - should be close to 1:1
        let sqrt_price = U256::from_dec_str(STABLE_SQRT_PRICE_X96).unwrap();

        // Both 6 decimals
        let price = calculate_price_from_sqrt(sqrt_price, 6, 6).unwrap();

        // Should be approximately 1.0
        let expected = Decimal::ONE;
        let diff = (price - expected).abs();
        assert!(
            diff < Decimal::from_str("0.0001").unwrap(),
            "Stablecoin price {} should be ~1.0, diff={}",
            price,
            diff
        );
    }

    #[test]
    fn test_calculate_price_usdc_weth() {
        // USDC/WETH pool
        // Price should be approximately 0.0005 (2000 USDC per ETH, so 0.0005 ETH per USDC)
        let sqrt_price = U256::from_dec_str(USDC_WETH_SQRT_PRICE_X96).unwrap();

        // USDC: 6 decimals, WETH: 18 decimals
        let price = calculate_price_from_sqrt(sqrt_price, 6, 18).unwrap();

        // The raw price from sqrtPriceX96 is token1/token0
        // Adjusted for decimals: price * 10^(6-18) = price * 10^-12
        // If ETH is ~$2000, then 1 USDC = 0.0005 ETH
        // So price should be around 0.0005
        assert!(
            price > Decimal::ZERO && price < Decimal::ONE,
            "Price {} should be between 0 and 1",
            price
        );
    }

    #[test]
    fn test_calculate_inverse_price() {
        let sqrt_price = U256::from_dec_str(STABLE_SQRT_PRICE_X96).unwrap();
        let price = calculate_price_from_sqrt(sqrt_price, 6, 6).unwrap();
        let inverse = calculate_inverse_price(sqrt_price, 6, 6).unwrap();

        // price * inverse should be ~1
        let product = price * inverse;
        let diff = (product - Decimal::ONE).abs();
        assert!(
            diff < Decimal::from_str("0.0001").unwrap(),
            "price * inverse = {} should be ~1.0",
            product
        );
    }

    #[test]
    fn test_get_price_for_swap_token_order() {
        let sqrt_price = U256::from_dec_str(STABLE_SQRT_PRICE_X96).unwrap();

        // Create two addresses with known ordering
        let token_a: Address = "0x0000000000000000000000000000000000000001"
            .parse()
            .unwrap();
        let token_b: Address = "0x0000000000000000000000000000000000000002"
            .parse()
            .unwrap();

        // token_a < token_b, so token_a is token0
        // Price selling token0 (a) for token1 (b)
        let price_a_to_b = get_price_for_swap(sqrt_price, token_a, token_b, 6, 6).unwrap();

        // Price selling token1 (b) for token0 (a)
        let price_b_to_a = get_price_for_swap(sqrt_price, token_b, token_a, 6, 6).unwrap();

        // These should be inverses
        let product = price_a_to_b * price_b_to_a;
        let diff = (product - Decimal::ONE).abs();
        assert!(
            diff < Decimal::from_str("0.0001").unwrap(),
            "price_a_to_b * price_b_to_a = {} should be ~1.0",
            product
        );
    }

    #[test]
    fn test_calculate_output_amount() {
        let sqrt_price = U256::from_dec_str(STABLE_SQRT_PRICE_X96).unwrap();

        let token_a: Address = "0x0000000000000000000000000000000000000001"
            .parse()
            .unwrap();
        let token_b: Address = "0x0000000000000000000000000000000000000002"
            .parse()
            .unwrap();

        // 1 million tokens (6 decimals)
        let amount_in = U256::from(1_000_000u64);

        let amount_out =
            calculate_output_amount(amount_in, sqrt_price, token_a, token_b, 6, 6).unwrap();

        // For stablecoin pair, output should be approximately equal to input
        let diff = if amount_out > amount_in {
            amount_out - amount_in
        } else {
            amount_in - amount_out
        };

        // Allow 0.1% difference
        let max_diff = amount_in / 1000;
        assert!(
            diff <= max_diff,
            "Output {} should be ~{}, diff={}",
            amount_out,
            amount_in,
            diff
        );
    }

    #[test]
    fn test_estimate_price_impact() {
        // Small trade relative to liquidity
        let impact_small =
            estimate_price_impact_bps(U256::from(1000u64), 1_000_000_000_000u128, U256::one());
        assert!(
            impact_small < 100,
            "Small trade should have <1% impact, got {} bps",
            impact_small
        );

        // Large trade relative to liquidity
        let impact_large =
            estimate_price_impact_bps(U256::from(1_000_000_000u64), 1_000_000u128, U256::one());
        assert!(
            impact_large > 100,
            "Large trade should have >1% impact, got {} bps",
            impact_large
        );

        // Zero liquidity
        let impact_zero = estimate_price_impact_bps(U256::from(1000u64), 0u128, U256::one());
        assert_eq!(impact_zero, 10000, "Zero liquidity should give 100% impact");
    }

    #[test]
    fn test_zero_sqrt_price_error() {
        let result = calculate_price_from_sqrt(U256::zero(), 6, 6);
        assert!(result.is_err());
        assert!(matches!(
            result.unwrap_err(),
            OnchainQuoteError::MathOverflow { .. }
        ));
    }

    #[test]
    fn test_u256_decimal_roundtrip() {
        let original = U256::from(123456789u64);
        let decimal = u256_to_decimal(original).unwrap();
        let back = decimal_to_u256(decimal).unwrap();
        assert_eq!(original, back);
    }
}
