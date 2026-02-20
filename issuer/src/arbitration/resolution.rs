//! Bilateral Resolution VM
//!
//! Deterministic evaluation of bilateral bet outcomes using method-based resolution.
//! Ported from AA keeper's bilateral_resolution.rs with these changes:
//! - `anyhow` replaced with `ResolutionError` enum (thiserror)
//! - `sqlx::PgPool` / `fetch_trades_by_merkle_root()` removed (data-node REST in Task 5)
//! - All integer math preserved IDENTICALLY
//!
//! ## Method Types
//! - `up:X`   -> maker wins if exit > entry * (1 + X%)
//! - `down:X` -> maker wins if exit < entry * (1 - X%)
//! - `flat:X`  -> maker wins if |exit - entry| <= entry * X%
//!
//! ## Determinism Requirements
//! - Uses INTEGER math only (i64) - no floats
//! - Prices stored as smallest unit (cents, satoshi, etc.)
//! - Threshold stored as basis points (10000 = 100%)
//! - Taker wins on ties

use regex::Regex;
use serde::{Deserialize, Serialize};
use std::sync::LazyLock;
use tracing::{debug, info};

/// Basis points base (10000 = 100%)
pub const BPS_BASE: i64 = 10000;

/// Compiled regex for method format validation
/// Format: "up:X", "down:X", "flat:X" where X is 0-4 digits with optional 1-2 decimals
static METHOD_REGEX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^(up|down|flat):(\d{1,4}(?:\.\d{1,2})?)$").expect("Invalid regex pattern")
});

// ============================================================================
// Error Type
// ============================================================================

/// Errors arising from bilateral resolution logic
#[derive(Debug, thiserror::Error)]
pub enum ResolutionError {
    #[error("Invalid method format: '{0}'. Expected 'up:X', 'down:X', or 'flat:X' where X is 0-99.99")]
    InvalidMethodFormat(String),

    #[error("Invalid threshold value '{value}': {reason}")]
    InvalidThreshold { value: String, reason: String },

    #[error("Threshold out of range (must be 0-99.99%, got {0} bps)")]
    ThresholdOutOfRange(i64),

    #[error("Invalid entry price: {0} (must be positive)")]
    InvalidEntryPrice(i64),

    #[error("Invalid exit price: {0} (must be non-negative)")]
    InvalidExitPrice(i64),

    #[error("Integer overflow: {0}")]
    Overflow(String),

    #[error("Failed to parse method for ticker {ticker}: {source}")]
    MethodParseForTicker {
        ticker: String,
        source: Box<ResolutionError>,
    },

    #[error("Failed to evaluate trade for ticker {ticker}: {source}")]
    EvaluateForTicker {
        ticker: String,
        source: Box<ResolutionError>,
    },
}

pub type Result<T> = std::result::Result<T, ResolutionError>;

// ============================================================================
// Integer-Only Threshold Parsing
// ============================================================================

/// Parse threshold string to basis points using INTEGER MATH ONLY
///
/// Avoids floating point for determinism across implementations.
/// Examples: "10" -> 1000 bps, "10.5" -> 1050 bps, "0.01" -> 1 bps
///
/// # Algorithm
/// - Split on decimal point
/// - Integer part * 100 = base bps
/// - Decimal part padded/truncated to 2 digits = additional bps
pub fn parse_threshold_to_bps(threshold_str: &str) -> Result<i64> {
    if let Some(dot_pos) = threshold_str.find('.') {
        // Has decimal: "10.5" or "10.55"
        let int_part = &threshold_str[..dot_pos];
        let dec_part = &threshold_str[dot_pos + 1..];

        // Parse integer part (may be empty for ".5" -> treat as 0)
        let int_val: i64 = if int_part.is_empty() {
            0
        } else {
            int_part.parse().map_err(|_| ResolutionError::InvalidThreshold {
                value: threshold_str.to_string(),
                reason: "invalid integer part".to_string(),
            })?
        };

        // Parse decimal part, pad to 2 digits or truncate
        // "5" -> "50", "55" -> "55", "555" -> "55" (truncate)
        let dec_val: i64 = match dec_part.len() {
            0 => 0,
            1 => {
                // Single digit: "5" means 50 hundredths
                let d: i64 = dec_part.parse().map_err(|_| ResolutionError::InvalidThreshold {
                    value: threshold_str.to_string(),
                    reason: "invalid decimal part".to_string(),
                })?;
                d * 10
            }
            _ => {
                // Two or more digits: take first 2
                let d: i64 = dec_part[..2].parse().map_err(|_| ResolutionError::InvalidThreshold {
                    value: threshold_str.to_string(),
                    reason: "invalid decimal part".to_string(),
                })?;
                d
            }
        };

        // Combine: int_val * 100 + dec_val
        // 10.5 -> 10 * 100 + 50 = 1050 bps
        Ok(int_val * 100 + dec_val)
    } else {
        // No decimal: "10" -> 1000 bps
        let int_val: i64 = threshold_str.parse().map_err(|_| ResolutionError::InvalidThreshold {
            value: threshold_str.to_string(),
            reason: "invalid threshold".to_string(),
        })?;
        Ok(int_val * 100)
    }
}

// ============================================================================
// Method Types
// ============================================================================

/// Resolution method type with threshold in basis points
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MethodType {
    /// Maker wins if exit > entry * (1 + threshold_bps/10000)
    Up(i64),
    /// Maker wins if exit < entry * (1 - threshold_bps/10000)
    Down(i64),
    /// Maker wins if |exit - entry| * 10000 <= entry * threshold_bps
    Flat(i64),
}

impl MethodType {
    /// Parse a method string into MethodType
    ///
    /// # Format
    /// - "up:X" where X is threshold percentage (0-99.99)
    /// - "down:X" where X is threshold percentage
    /// - "flat:X" where X is threshold percentage
    pub fn parse(method: &str) -> Result<Self> {
        let caps = METHOD_REGEX
            .captures(method)
            .ok_or_else(|| ResolutionError::InvalidMethodFormat(method.to_string()))?;

        // Extract type and value
        let method_type = &caps[1];
        let threshold_str = &caps[2];

        // Convert percentage to basis points using INTEGER MATH ONLY
        // Parse integer and decimal parts separately to avoid float non-determinism
        // Examples: "10" -> 1000 bps, "10.5" -> 1050 bps, "10.55" -> 1055 bps
        let threshold_bps = parse_threshold_to_bps(threshold_str)?;

        // Validate threshold is within valid range (0 to 99.99% = 0 to 9999 bps)
        if threshold_bps < 0 || threshold_bps > 9999 {
            return Err(ResolutionError::ThresholdOutOfRange(threshold_bps));
        }

        match method_type {
            "up" => Ok(MethodType::Up(threshold_bps)),
            "down" => Ok(MethodType::Down(threshold_bps)),
            "flat" => Ok(MethodType::Flat(threshold_bps)),
            _ => Err(ResolutionError::InvalidMethodFormat(method.to_string())),
        }
    }

    /// Get the threshold in basis points
    pub fn threshold_bps(&self) -> i64 {
        match self {
            MethodType::Up(t) | MethodType::Down(t) | MethodType::Flat(t) => *t,
        }
    }
}

// ============================================================================
// Trade Evaluation
// ============================================================================

/// Evaluate a single trade to determine if maker wins
///
/// # Arguments
/// * `entry` - Entry price in integer units (must be positive)
/// * `exit`  - Exit price in integer units (must be non-negative)
/// * `method` - Resolution method type
///
/// # Returns
/// * `Ok(Some(true))`  - Maker wins
/// * `Ok(Some(false))` - Taker wins
/// * `Ok(None)`        - No price movement, trade skipped
/// * `Err(_)`          - Invalid input
///
/// # Integer Math
/// All calculations use i64 to ensure determinism across implementations.
/// - `up:X`   -> exit * BPS_BASE > entry * (BPS_BASE + threshold_bps)
/// - `down:X` -> exit * BPS_BASE < entry * (BPS_BASE - threshold_bps)
/// - `flat:X`  -> |exit - entry| * BPS_BASE <= entry * threshold_bps
pub fn evaluate_trade(entry: i64, exit: i64, method: &MethodType) -> Result<Option<bool>> {
    // Validate inputs
    if entry <= 0 {
        return Err(ResolutionError::InvalidEntryPrice(entry));
    }
    if exit < 0 {
        return Err(ResolutionError::InvalidExitPrice(exit));
    }

    // No movement = skip (don't count toward either side)
    if entry == exit {
        return Ok(None);
    }

    let result = match method {
        MethodType::Up(threshold_bps) => {
            // Maker wins if exit > entry * (1 + threshold%)
            // Integer form: exit * BPS_BASE > entry * (BPS_BASE + threshold_bps)
            let lhs = exit.checked_mul(BPS_BASE).ok_or_else(|| {
                ResolutionError::Overflow(format!(
                    "exit * BPS_BASE ({} * {})",
                    exit, BPS_BASE
                ))
            })?;
            let rhs = entry.checked_mul(BPS_BASE + threshold_bps).ok_or_else(|| {
                ResolutionError::Overflow(format!(
                    "entry * (BPS_BASE + threshold) ({} * {})",
                    entry,
                    BPS_BASE + threshold_bps
                ))
            })?;
            lhs > rhs
        }
        MethodType::Down(threshold_bps) => {
            // Maker wins if exit < entry * (1 - threshold%)
            // Integer form: exit * BPS_BASE < entry * (BPS_BASE - threshold_bps)
            //
            // Edge case: if threshold_bps >= BPS_BASE, the target would be <= 0
            // In this case, maker can never win (price can't go negative)
            if *threshold_bps >= BPS_BASE {
                false
            } else {
                let lhs = exit.checked_mul(BPS_BASE).ok_or_else(|| {
                    ResolutionError::Overflow(format!(
                        "exit * BPS_BASE ({} * {})",
                        exit, BPS_BASE
                    ))
                })?;
                let rhs = entry.checked_mul(BPS_BASE - threshold_bps).ok_or_else(|| {
                    ResolutionError::Overflow(format!(
                        "entry * (BPS_BASE - threshold) ({} * {})",
                        entry,
                        BPS_BASE - threshold_bps
                    ))
                })?;
                lhs < rhs
            }
        }
        MethodType::Flat(threshold_bps) => {
            // Maker wins if price stayed within +/-threshold%
            // Integer form: |exit - entry| * BPS_BASE <= entry * threshold_bps
            let diff = (exit - entry).abs();
            let lhs = diff.checked_mul(BPS_BASE).ok_or_else(|| {
                ResolutionError::Overflow(format!(
                    "diff * BPS_BASE ({} * {})",
                    diff, BPS_BASE
                ))
            })?;
            let rhs = entry.checked_mul(*threshold_bps).ok_or_else(|| {
                ResolutionError::Overflow(format!(
                    "entry * threshold ({} * {})",
                    entry, threshold_bps
                ))
            })?;
            lhs <= rhs
        }
    };

    Ok(Some(result))
}

// ============================================================================
// Outcome Computation
// ============================================================================

/// Winner of a bet
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Winner {
    Maker,
    Taker,
}

/// Outcome of bet resolution
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Outcome {
    /// Number of trades won by maker
    pub maker_wins: u64,
    /// Number of trades won by taker
    pub taker_wins: u64,
    /// Total resolved trades
    pub total: u64,
    /// Overall winner (taker wins ties)
    pub winner: Winner,
}

/// Trade data for resolution
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Trade {
    /// Stock/asset ticker symbol
    pub ticker: String,
    /// Entry price in integer units
    pub entry_price: i64,
    /// Exit price (None if not yet resolved)
    pub exit_price: Option<i64>,
    /// Resolution method ("up:X", "down:X", "flat:X")
    pub method: String,
}

/// Compute the outcome for a list of trades
///
/// # Arguments
/// * `trades` - List of trades to evaluate
///
/// # Returns
/// * `Outcome` with maker_wins, taker_wins, and overall winner
///
/// # Tie-Breaking
/// If maker_wins == taker_wins, **taker wins** (convention from vital-test.md)
pub fn compute_outcome(trades: &[Trade]) -> Result<Outcome> {
    let mut maker_wins: u64 = 0;
    let mut taker_wins: u64 = 0;

    for trade in trades {
        // Skip trades without exit price
        let exit = match trade.exit_price {
            Some(e) => e,
            None => {
                debug!(ticker = %trade.ticker, "Skipping trade without exit price");
                continue;
            }
        };

        // Parse method
        let method = MethodType::parse(&trade.method).map_err(|e| {
            ResolutionError::MethodParseForTicker {
                ticker: trade.ticker.clone(),
                source: Box::new(e),
            }
        })?;

        // Evaluate trade
        let result = evaluate_trade(trade.entry_price, exit, &method).map_err(|e| {
            ResolutionError::EvaluateForTicker {
                ticker: trade.ticker.clone(),
                source: Box::new(e),
            }
        })?;

        match result {
            Some(true) => maker_wins += 1,
            Some(false) => taker_wins += 1,
            None => {
                debug!(ticker = %trade.ticker, "Skipping trade with no price movement");
                continue;
            }
        }
    }

    // TAKER WINS TIES (convention from vital-test.md)
    let winner = if maker_wins > taker_wins {
        Winner::Maker
    } else {
        Winner::Taker
    };

    let outcome = Outcome {
        maker_wins,
        taker_wins,
        total: maker_wins + taker_wins,
        winner,
    };

    info!(
        maker_wins = outcome.maker_wins,
        taker_wins = outcome.taker_wins,
        total = outcome.total,
        winner = ?outcome.winner,
        "Computed bet outcome"
    );

    Ok(outcome)
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    // ========================================================================
    // Threshold Parsing Tests
    // ========================================================================

    #[test]
    fn test_parse_threshold_integer() {
        // Whole numbers: X% -> X*100 bps
        assert_eq!(parse_threshold_to_bps("10").unwrap(), 1000);
        assert_eq!(parse_threshold_to_bps("0").unwrap(), 0);
        assert_eq!(parse_threshold_to_bps("99").unwrap(), 9900);
    }

    #[test]
    fn test_parse_threshold_decimal() {
        // Single decimal: X.Y% -> X*100 + Y*10 bps
        assert_eq!(parse_threshold_to_bps("10.5").unwrap(), 1050);
        // Two decimals: X.YZ% -> X*100 + YZ bps
        assert_eq!(parse_threshold_to_bps("10.55").unwrap(), 1055);
        // Tiny value
        assert_eq!(parse_threshold_to_bps("0.01").unwrap(), 1);
    }

    // ========================================================================
    // Method Parsing Tests
    // ========================================================================

    #[test]
    fn test_method_parse() {
        assert_eq!(MethodType::parse("up:10").unwrap(), MethodType::Up(1000));
        assert_eq!(MethodType::parse("down:5.5").unwrap(), MethodType::Down(550));
        assert_eq!(MethodType::parse("flat:2").unwrap(), MethodType::Flat(200));
    }

    #[test]
    fn test_method_parsing_valid_extended() {
        // Basic cases
        assert_eq!(MethodType::parse("up:0").unwrap(), MethodType::Up(0));
        assert_eq!(MethodType::parse("down:5").unwrap(), MethodType::Down(500));
        assert_eq!(MethodType::parse("flat:0.5").unwrap(), MethodType::Flat(50));
        assert_eq!(MethodType::parse("up:0.01").unwrap(), MethodType::Up(1));

        // Max valid value
        assert_eq!(MethodType::parse("up:99").unwrap(), MethodType::Up(9900));
        assert_eq!(
            MethodType::parse("down:99.99").unwrap(),
            MethodType::Down(9999)
        );

        // Values > 99.99% should be rejected
        assert!(MethodType::parse("up:100").is_err());
        assert!(MethodType::parse("down:150").is_err());
    }

    #[test]
    fn test_method_parsing_invalid() {
        // Wrong case
        assert!(MethodType::parse("UP:10").is_err());
        assert!(MethodType::parse("Up:10").is_err());

        // Unknown type
        assert!(MethodType::parse("sideways:5").is_err());

        // Invalid format
        assert!(MethodType::parse("up:").is_err());
        assert!(MethodType::parse("up").is_err());
        assert!(MethodType::parse(":10").is_err());

        // Too many digits
        assert!(MethodType::parse("up:10000").is_err());

        // Too many decimal places
        assert!(MethodType::parse("up:10.555").is_err());

        // Negative
        assert!(MethodType::parse("up:-10").is_err());
    }

    // ========================================================================
    // Trade Evaluation Tests
    // ========================================================================

    #[test]
    fn test_evaluate_trade_up() {
        // Maker wins: exit strictly above entry * (1 + threshold)
        // up:10 -> threshold 1000 bps
        // 115 * 10000 = 1_150_000 > 100 * 11000 = 1_100_000 -> maker wins
        assert_eq!(
            evaluate_trade(100, 115, &MethodType::Up(1000)).unwrap(),
            Some(true)
        );

        // Taker wins: exit at or below threshold
        // 110 * 10000 = 1_100_000 > 100 * 11000 = 1_100_000 -> false (not strictly greater)
        assert_eq!(
            evaluate_trade(100, 110, &MethodType::Up(1000)).unwrap(),
            Some(false)
        );

        // Taker wins: exit below entry
        assert_eq!(
            evaluate_trade(100, 90, &MethodType::Up(1000)).unwrap(),
            Some(false)
        );
    }

    #[test]
    fn test_evaluate_trade_down() {
        // Maker wins: exit strictly below entry * (1 - threshold)
        // down:10 -> threshold 1000 bps
        // 89 * 10000 = 890_000 < 100 * 9000 = 900_000 -> maker wins
        assert_eq!(
            evaluate_trade(100, 89, &MethodType::Down(1000)).unwrap(),
            Some(true)
        );

        // Taker wins: exit at threshold boundary
        // 90 * 10000 = 900_000 < 100 * 9000 = 900_000 -> false (not strictly less)
        assert_eq!(
            evaluate_trade(100, 90, &MethodType::Down(1000)).unwrap(),
            Some(false)
        );

        // Taker wins: exit above entry
        assert_eq!(
            evaluate_trade(100, 110, &MethodType::Down(1000)).unwrap(),
            Some(false)
        );
    }

    #[test]
    fn test_evaluate_trade_flat() {
        // Maker wins: price stayed within +/-threshold%
        // flat:5 -> threshold 500 bps
        // |103-100| * 10000 = 30_000 <= 100 * 500 = 50_000 -> maker wins
        assert_eq!(
            evaluate_trade(100, 103, &MethodType::Flat(500)).unwrap(),
            Some(true)
        );

        // Maker wins: at exact boundary
        // |105-100| * 10000 = 50_000 <= 100 * 500 = 50_000 -> maker wins (<=)
        assert_eq!(
            evaluate_trade(100, 105, &MethodType::Flat(500)).unwrap(),
            Some(true)
        );

        // Taker wins: price moved beyond threshold
        // |106-100| * 10000 = 60_000 <= 100 * 500 = 50_000 -> false
        assert_eq!(
            evaluate_trade(100, 106, &MethodType::Flat(500)).unwrap(),
            Some(false)
        );

        // Taker wins: price dropped beyond threshold
        assert_eq!(
            evaluate_trade(100, 94, &MethodType::Flat(500)).unwrap(),
            Some(false)
        );
    }

    #[test]
    fn test_evaluate_trade_no_movement() {
        // entry == exit -> None (no movement, skipped)
        assert_eq!(
            evaluate_trade(10000, 10000, &MethodType::Up(0)).unwrap(),
            None
        );
        assert_eq!(
            evaluate_trade(10000, 10000, &MethodType::Down(0)).unwrap(),
            None
        );
        assert_eq!(
            evaluate_trade(10000, 10000, &MethodType::Flat(0)).unwrap(),
            None
        );
        assert_eq!(
            evaluate_trade(10000, 10000, &MethodType::Up(1000)).unwrap(),
            None
        );
        assert_eq!(
            evaluate_trade(1_000_000, 1_000_000, &MethodType::Down(500)).unwrap(),
            None
        );
    }

    // ========================================================================
    // Outcome Computation Tests
    // ========================================================================

    #[test]
    fn test_compute_outcome_maker_wins() {
        let trades = vec![
            Trade {
                ticker: "AAPL".to_string(),
                entry_price: 100,
                exit_price: Some(110),
                method: "up:0".to_string(),
            }, // maker wins
            Trade {
                ticker: "MSFT".to_string(),
                entry_price: 400,
                exit_price: Some(390),
                method: "up:0".to_string(),
            }, // taker wins
            Trade {
                ticker: "GOOGL".to_string(),
                entry_price: 200,
                exit_price: Some(270),
                method: "up:30".to_string(),
            }, // maker wins
        ];

        let outcome = compute_outcome(&trades).unwrap();
        assert_eq!(outcome.maker_wins, 2);
        assert_eq!(outcome.taker_wins, 1);
        assert_eq!(outcome.total, 3);
        assert_eq!(outcome.winner, Winner::Maker);
    }

    #[test]
    fn test_compute_outcome_taker_wins_on_tie() {
        // Create trades where maker wins 1, taker wins 1 -> tie -> taker wins
        let trades = vec![
            Trade {
                ticker: "A".to_string(),
                entry_price: 100,
                exit_price: Some(110),
                method: "up:0".to_string(),
            }, // maker wins
            Trade {
                ticker: "B".to_string(),
                entry_price: 100,
                exit_price: Some(90),
                method: "up:0".to_string(),
            }, // taker wins
        ];

        let outcome = compute_outcome(&trades).unwrap();
        assert_eq!(outcome.maker_wins, 1);
        assert_eq!(outcome.taker_wins, 1);
        assert_eq!(outcome.winner, Winner::Taker); // TIE -> taker wins
    }

    // ========================================================================
    // Additional Edge Cases
    // ========================================================================

    #[test]
    fn test_invalid_prices() {
        assert!(evaluate_trade(0, 100, &MethodType::Up(0)).is_err());
        assert!(evaluate_trade(-100, 100, &MethodType::Up(0)).is_err());
        assert!(evaluate_trade(100, -50, &MethodType::Up(0)).is_err());

        // Zero exit is valid (price crashed to 0)
        assert_eq!(
            evaluate_trade(100, 0, &MethodType::Down(0)).unwrap(),
            Some(true)
        );
    }

    #[test]
    fn test_skips_trades_without_exit() {
        let trades = vec![
            Trade {
                ticker: "A".to_string(),
                entry_price: 100,
                exit_price: Some(110),
                method: "up:0".to_string(),
            },
            Trade {
                ticker: "B".to_string(),
                entry_price: 100,
                exit_price: None,
                method: "up:0".to_string(),
            },
            Trade {
                ticker: "C".to_string(),
                entry_price: 100,
                exit_price: Some(90),
                method: "up:0".to_string(),
            },
        ];

        let outcome = compute_outcome(&trades).unwrap();
        assert_eq!(outcome.total, 2); // Only 2 resolved, None skipped
    }

    #[test]
    fn test_empty_trades() {
        let outcome = compute_outcome(&[]).unwrap();
        assert_eq!(outcome.maker_wins, 0);
        assert_eq!(outcome.taker_wins, 0);
        assert_eq!(outcome.total, 0);
        assert_eq!(outcome.winner, Winner::Taker); // 0 == 0 -> taker
    }

    #[test]
    fn test_error_type_is_thiserror() {
        // Verify our error type produces useful Display messages
        let err = ResolutionError::InvalidEntryPrice(-5);
        let msg = format!("{}", err);
        assert!(msg.contains("-5"));
        assert!(msg.contains("positive"));

        let err = ResolutionError::ThresholdOutOfRange(10001);
        let msg = format!("{}", err);
        assert!(msg.contains("10001"));
    }
}
