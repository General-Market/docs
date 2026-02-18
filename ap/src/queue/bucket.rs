//! Bucket classification for priority scheduling
//!
//! Orders are classified into buckets based on USDC amount:
//! - Small: <$100 (< 1e20 wei)
//! - Medium: $100-$1,000 (1e20 - 1e21 wei)
//! - Large: $1,000-$10,000 (1e21 - 1e22 wei)
//! - XL: >$10,000 (>= 1e22 wei)

use ethers::types::U256;

/// Size bucket for priority scheduling
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Bucket {
    /// Orders < $100
    Small,
    /// Orders $100 - $1,000
    Medium,
    /// Orders $1,000 - $10,000
    Large,
    /// Orders > $10,000
    XL,
}

impl Bucket {
    /// Get threshold for small bucket: $100 = 100 * 10^18
    pub fn small_threshold() -> U256 {
        U256::from(100u64) * U256::exp10(18) // 1e20
    }

    /// Get threshold for medium bucket: $1,000 = 1000 * 10^18
    pub fn medium_threshold() -> U256 {
        U256::from(1000u64) * U256::exp10(18) // 1e21
    }

    /// Get threshold for large bucket: $10,000 = 10000 * 10^18
    pub fn large_threshold() -> U256 {
        U256::from(10000u64) * U256::exp10(18) // 1e22
    }

    /// Classify an order into a bucket based on USDC amount (18 decimals)
    ///
    /// # Arguments
    /// * `amount` - Order amount in USDC with 18 decimals
    ///
    /// # Returns
    /// The appropriate bucket for the order size
    pub fn from_amount(amount: U256) -> Self {
        if amount < Self::small_threshold() {
            Bucket::Small
        } else if amount < Self::medium_threshold() {
            Bucket::Medium
        } else if amount < Self::large_threshold() {
            Bucket::Large
        } else {
            Bucket::XL
        }
    }

    /// Get the allocation percentage for this bucket
    ///
    /// Used for fair scheduling:
    /// - Small: 30%
    /// - Medium: 30%
    /// - Large: 20%
    /// - XL: 20%
    pub fn allocation_percent(&self) -> u8 {
        match self {
            Bucket::Small => 30,
            Bucket::Medium => 30,
            Bucket::Large => 20,
            Bucket::XL => 20,
        }
    }

    /// Get all bucket variants
    pub fn all() -> [Bucket; 4] {
        [Bucket::Small, Bucket::Medium, Bucket::Large, Bucket::XL]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bucket_classification_small() {
        // $0 -> Small
        assert_eq!(Bucket::from_amount(U256::zero()), Bucket::Small);

        // $50 -> Small
        let fifty = U256::from(50u64) * U256::exp10(18);
        assert_eq!(Bucket::from_amount(fifty), Bucket::Small);

        // $99.99 -> Small
        let ninety_nine = U256::from(99_990_000_000_000_000_000u128);
        assert_eq!(Bucket::from_amount(ninety_nine), Bucket::Small);
    }

    #[test]
    fn test_bucket_classification_medium() {
        // $100 exactly -> Medium
        let hundred = U256::from(100u64) * U256::exp10(18);
        assert_eq!(Bucket::from_amount(hundred), Bucket::Medium);

        // $500 -> Medium
        let five_hundred = U256::from(500u64) * U256::exp10(18);
        assert_eq!(Bucket::from_amount(five_hundred), Bucket::Medium);

        // $999.99 -> Medium
        let nine_ninety_nine = U256::from(999_990_000_000_000_000_000u128);
        assert_eq!(Bucket::from_amount(nine_ninety_nine), Bucket::Medium);
    }

    #[test]
    fn test_bucket_classification_large() {
        // $1,000 exactly -> Large
        let thousand = U256::from(1000u64) * U256::exp10(18);
        assert_eq!(Bucket::from_amount(thousand), Bucket::Large);

        // $5,000 -> Large
        let five_thousand = U256::from(5000u64) * U256::exp10(18);
        assert_eq!(Bucket::from_amount(five_thousand), Bucket::Large);

        // $9,999.99 -> Large
        let nine_thousand = U256::from(9999u64) * U256::exp10(18);
        assert_eq!(Bucket::from_amount(nine_thousand), Bucket::Large);
    }

    #[test]
    fn test_bucket_classification_xl() {
        // $10,000 exactly -> XL
        let ten_thousand = U256::from(10000u64) * U256::exp10(18);
        assert_eq!(Bucket::from_amount(ten_thousand), Bucket::XL);

        // $50,000 -> XL
        let fifty_thousand = U256::from(50000u64) * U256::exp10(18);
        assert_eq!(Bucket::from_amount(fifty_thousand), Bucket::XL);

        // $1,000,000 -> XL
        let million = U256::from(1_000_000u64) * U256::exp10(18);
        assert_eq!(Bucket::from_amount(million), Bucket::XL);
    }

    #[test]
    fn test_bucket_boundary_values() {
        // Just below $100 threshold
        let just_below_100 = Bucket::small_threshold() - U256::one();
        assert_eq!(Bucket::from_amount(just_below_100), Bucket::Small);

        // Exactly at $100 threshold
        assert_eq!(Bucket::from_amount(Bucket::small_threshold()), Bucket::Medium);

        // Just below $1,000 threshold
        let just_below_1000 = Bucket::medium_threshold() - U256::one();
        assert_eq!(Bucket::from_amount(just_below_1000), Bucket::Medium);

        // Exactly at $1,000 threshold
        assert_eq!(Bucket::from_amount(Bucket::medium_threshold()), Bucket::Large);

        // Just below $10,000 threshold
        let just_below_10000 = Bucket::large_threshold() - U256::one();
        assert_eq!(Bucket::from_amount(just_below_10000), Bucket::Large);

        // Exactly at $10,000 threshold
        assert_eq!(Bucket::from_amount(Bucket::large_threshold()), Bucket::XL);
    }

    #[test]
    fn test_allocation_percentages() {
        assert_eq!(Bucket::Small.allocation_percent(), 30);
        assert_eq!(Bucket::Medium.allocation_percent(), 30);
        assert_eq!(Bucket::Large.allocation_percent(), 20);
        assert_eq!(Bucket::XL.allocation_percent(), 20);

        // Verify they sum to 100
        let total: u8 = Bucket::all()
            .iter()
            .map(|b| b.allocation_percent())
            .sum();
        assert_eq!(total, 100);
    }
}
