/// Canonical BFT threshold: ceil(2n/3).
///
/// All consumers of BLS threshold computation must call this function
/// rather than implementing the formula inline.
///
/// - 0 oracles -> 0 (no consensus possible)
/// - 1 oracle  -> 1 (single-node mode)
/// - n >= 2    -> ceil(2n/3)
pub fn bls_threshold(active_count: usize) -> usize {
    match active_count {
        0 => 0,
        1 => 1,
        _ => (active_count * 2 + 2) / 3,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bls_threshold() {
        assert_eq!(bls_threshold(0), 0);
        assert_eq!(bls_threshold(1), 1);
        assert_eq!(bls_threshold(2), 2);
        assert_eq!(bls_threshold(3), 2);
        assert_eq!(bls_threshold(4), 3);
        assert_eq!(bls_threshold(5), 4);
        assert_eq!(bls_threshold(6), 4);
        assert_eq!(bls_threshold(10), 7);
        assert_eq!(bls_threshold(20), 14);
    }
}
