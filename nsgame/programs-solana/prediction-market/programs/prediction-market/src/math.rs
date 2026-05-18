//! Parimutuel math and threshold comparator.
//!
//! Prices are u128 normalized to 1e18 (SA9). Threshold is signed bps: positive
//! means YES wins if the price moved up past the threshold, negative means
//! YES wins if the price moved down past the threshold (MR9).

/// Returns `(net_to_winner, fee_to_treasury)`.
///
/// Caller must guarantee `winning_total > 0` and `winning_total >= winning_stake`.
/// Both guaranteed in `claim` handler by the stake-presence and winning-total
/// checks.
pub fn payout(
    total_pool: u128,
    winning_stake: u128,
    winning_total: u128,
    fee_bps: u16,
) -> (u64, u64) {
    debug_assert!(winning_total > 0);
    debug_assert!(winning_total >= winning_stake);
    let gross = total_pool.saturating_mul(winning_stake) / winning_total;
    let fee = gross.saturating_mul(fee_bps as u128) / 10_000;
    let net = gross - fee;
    (net as u64, fee as u64)
}

/// MR9 — signed threshold. Returns true if the price moved through the
/// threshold in the direction indicated by the sign.
pub fn outcome_yes(baseline: u128, final_price: u128, threshold_bps: i32) -> bool {
    let bps = threshold_bps as i128;
    let num = 10_000i128 + bps;
    // baseline fits in i128 (u128 -> i128 lossy only above 2^127; prices this
    // high are a pricing bug, not a legitimate trade).
    let target = (baseline as i128).saturating_mul(num) / 10_000;
    let finalp = final_price as i128;
    if threshold_bps >= 0 {
        finalp >= target
    } else {
        finalp <= target
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn payout_standard_case() {
        // 4M pool, user owns 1M of the 3M winning side, 50bps fee.
        // gross = 4M * 1M / 3M = 1_333_333
        // fee   = 1_333_333 * 50 / 10_000 = 6_666
        // net   = 1_326_667
        let (net, fee) = payout(4_000_000, 1_000_000, 3_000_000, 50);
        assert_eq!(net, 1_326_667);
        assert_eq!(fee, 6_666);
    }

    #[test]
    fn payout_zero_fee() {
        let (net, fee) = payout(4_000_000, 1_000_000, 3_000_000, 0);
        assert_eq!(net, 1_333_333);
        assert_eq!(fee, 0);
    }

    #[test]
    fn outcome_yes_positive_threshold() {
        // baseline 1e18, +50bps target 1.005e18
        let b = 1_000_000_000_000_000_000u128;
        assert!(outcome_yes(b, 1_010_000_000_000_000_000u128, 50));
        assert!(!outcome_yes(b, 1_004_000_000_000_000_000u128, 50));
        assert!(outcome_yes(b, 1_005_000_000_000_000_000u128, 50));
    }

    #[test]
    fn outcome_yes_negative_threshold() {
        let b = 1_000_000_000_000_000_000u128;
        // -50bps target 0.995e18 — YES if final <= 0.995e18
        assert!(outcome_yes(b, 990_000_000_000_000_000u128, -50));
        assert!(!outcome_yes(b, 1_000_000_000_000_000_000u128, -50));
    }
}
