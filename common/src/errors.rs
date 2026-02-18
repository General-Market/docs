//! Standardized error codes for Index L3 protocol (E001-E010)
//!
//! These error codes match the Solidity ErrorsLib.sol for cross-language consistency.
//! See architecture.md Section 21 for error code definitions.

use thiserror::Error;

/// Protocol-level error codes for Index L3 (E001-E010)
///
/// These errors represent business logic failures in the Index protocol
/// and are designed to match the Solidity ErrorsLib.sol custom errors.
///
/// Display format: `[E00X] Error description: {context}`
#[derive(Debug, Clone, PartialEq, Eq, Error)]
#[non_exhaustive]
pub enum IndexError {
    /// E001: Order amount below minimum threshold
    ///
    /// Minimum order amount is 0.001 USDC (1e15 in 18-decimal representation)
    #[error("[E001] Order below minimum: amount={amount}, minimum={minimum}")]
    OrderBelowMin {
        /// The submitted order amount
        amount: u128,
        /// The required minimum (0.001 USDC = 1e15)
        minimum: u128,
    },

    /// E002: User has insufficient balance to complete order
    ///
    /// Check user's USDC balance before order submission
    #[error("[E002] Insufficient balance: user={user}, required={required}, available={available}")]
    InsufficientBalance {
        /// The user address attempting the order (hex string)
        user: String,
        /// The amount required for the order
        required: u128,
        /// The user's current available balance
        available: u128,
    },

    /// E003: The specified ITP is currently paused
    ///
    /// ITP can be paused by governance for maintenance or emergency
    #[error("[E003] ITP paused: itp_id={itp_id}")]
    ITPPaused {
        /// The bytes32 identifier of the paused ITP (hex string)
        itp_id: String,
    },

    /// E004: System is in emergency pause mode
    ///
    /// Global emergency pause affects all operations across all ITPs
    #[error("[E004] System paused")]
    SystemPaused,

    /// E005: Limit order price deviates too far from current price
    ///
    /// Maximum allowed deviation is 50% from current price at submission
    #[error("[E005] Limit out of bounds: limit_price={limit_price}, current_price={current_price}, max_deviation={max_deviation}")]
    LimitOutOfBounds {
        /// The user's submitted limit price
        limit_price: u128,
        /// The current market price
        current_price: u128,
        /// The maximum allowed price deviation (50% = 5000 bps)
        max_deviation: u128,
    },

    /// E006: The specified ITP identifier does not exist
    ///
    /// ITP must be registered before orders can be placed
    #[error("[E006] ITP not found: itp_id={itp_id}")]
    ITPNotFound {
        /// The bytes32 identifier that was not found (hex string)
        itp_id: String,
    },

    /// E007: Asset in this ITP is being delisted
    ///
    /// No new orders accepted for assets in delisting process
    #[error("[E007] Asset delisting: asset={asset}")]
    AssetDelisting {
        /// The address of the asset being delisted (hex string)
        asset: String,
    },

    /// E008: Liquidity source is currently unavailable
    ///
    /// External liquidity source (AP, DEX) is offline or unreachable
    #[error("[E008] Source unavailable: source_id={source_id}")]
    SourceUnavailable {
        /// The identifier of the unavailable source (hex string)
        source_id: String,
    },

    /// E009: Order has expired past its deadline
    ///
    /// Orders auto-cancel after 1 hour (default deadline), user receives full refund
    #[error("[E009] Order expired: order_id={order_id}, deadline={deadline}, current_time={current_time}")]
    OrderExpired {
        /// The unique identifier of the expired order (u128 to match Solidity uint256 range)
        order_id: u128,
        /// The order's expiration timestamp
        deadline: u64,
        /// The current timestamp
        current_time: u64,
    },

    /// E010: Order was only partially filled
    ///
    /// Remainder is automatically refunded to user
    #[error("[E010] Fill incomplete: order_id={order_id}, requested={requested}, filled={filled}")]
    FillIncomplete {
        /// The unique identifier of the partially filled order (u128 to match Solidity uint256 range)
        order_id: u128,
        /// The original requested amount
        requested: u128,
        /// The actual filled amount
        filled: u128,
    },
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_e001_order_below_min() {
        let err = IndexError::OrderBelowMin {
            amount: 100,
            minimum: 1000,
        };
        assert!(err.to_string().starts_with("[E001]"));
        assert!(err.to_string().contains("amount=100"));
        assert!(err.to_string().contains("minimum=1000"));
    }

    #[test]
    fn test_e002_insufficient_balance() {
        let err = IndexError::InsufficientBalance {
            user: "0xabc123".to_string(),
            required: 5000,
            available: 1000,
        };
        assert!(err.to_string().starts_with("[E002]"));
        assert!(err.to_string().contains("user=0xabc123"));
        assert!(err.to_string().contains("required=5000"));
        assert!(err.to_string().contains("available=1000"));
    }

    #[test]
    fn test_e003_itp_paused() {
        let err = IndexError::ITPPaused {
            itp_id: "0xdeadbeef".to_string(),
        };
        assert!(err.to_string().starts_with("[E003]"));
        assert!(err.to_string().contains("itp_id=0xdeadbeef"));
    }

    #[test]
    fn test_e004_system_paused() {
        let err = IndexError::SystemPaused;
        assert_eq!(err.to_string(), "[E004] System paused");
    }

    #[test]
    fn test_e005_limit_out_of_bounds() {
        let err = IndexError::LimitOutOfBounds {
            limit_price: 150,
            current_price: 100,
            max_deviation: 5000,
        };
        assert!(err.to_string().starts_with("[E005]"));
        assert!(err.to_string().contains("limit_price=150"));
        assert!(err.to_string().contains("current_price=100"));
        assert!(err.to_string().contains("max_deviation=5000"));
    }

    #[test]
    fn test_e006_itp_not_found() {
        let err = IndexError::ITPNotFound {
            itp_id: "0x1234".to_string(),
        };
        assert!(err.to_string().starts_with("[E006]"));
        assert!(err.to_string().contains("itp_id=0x1234"));
    }

    #[test]
    fn test_e007_asset_delisting() {
        let err = IndexError::AssetDelisting {
            asset: "0xtoken".to_string(),
        };
        assert!(err.to_string().starts_with("[E007]"));
        assert!(err.to_string().contains("asset=0xtoken"));
    }

    #[test]
    fn test_e008_source_unavailable() {
        let err = IndexError::SourceUnavailable {
            source_id: "uniswap-v3".to_string(),
        };
        assert!(err.to_string().starts_with("[E008]"));
        assert!(err.to_string().contains("source_id=uniswap-v3"));
    }

    #[test]
    fn test_e009_order_expired() {
        let err = IndexError::OrderExpired {
            order_id: 12345,
            deadline: 1700000000,
            current_time: 1700003600,
        };
        assert!(err.to_string().starts_with("[E009]"));
        assert!(err.to_string().contains("order_id=12345"));
        assert!(err.to_string().contains("deadline=1700000000"));
        assert!(err.to_string().contains("current_time=1700003600"));
    }

    #[test]
    fn test_e010_fill_incomplete() {
        let err = IndexError::FillIncomplete {
            order_id: 99999,
            requested: 10000,
            filled: 7500,
        };
        assert!(err.to_string().starts_with("[E010]"));
        assert!(err.to_string().contains("order_id=99999"));
        assert!(err.to_string().contains("requested=10000"));
        assert!(err.to_string().contains("filled=7500"));
    }

    #[test]
    fn test_error_equality() {
        // Test Eq implementation
        let err1 = IndexError::SystemPaused;
        let err2 = IndexError::SystemPaused;
        assert_eq!(err1, err2);

        let err3 = IndexError::OrderBelowMin {
            amount: 100,
            minimum: 1000,
        };
        let err4 = IndexError::OrderBelowMin {
            amount: 100,
            minimum: 1000,
        };
        assert_eq!(err3, err4);

        // Test inequality
        let err5 = IndexError::OrderBelowMin {
            amount: 100,
            minimum: 2000,
        };
        assert_ne!(err3, err5);
    }

    #[test]
    fn test_error_clone() {
        let err = IndexError::InsufficientBalance {
            user: "0xtest".to_string(),
            required: 1000,
            available: 500,
        };
        let cloned = err.clone();
        assert_eq!(err, cloned);
    }
}
