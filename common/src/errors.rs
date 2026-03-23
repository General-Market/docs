//! Standardized error codes for Index L3 protocol (E001-E006)
//!
//! These error codes match the Solidity ErrorsLib.sol for cross-language consistency.
//! See architecture.md Section 21 for error code definitions.

use thiserror::Error;

/// Protocol-level error codes for Index L3 (E001-E006)
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
