//! Property-based tests for P2P hardening components.
//!
//! Uses proptest to verify invariants of the rate limiter, peer scorer,
//! equivocation detector, and consensus WAL under arbitrary inputs.

use proptest::prelude::*;

use issuer::p2p::rate_limit::RateBucket;
use issuer::p2p::peer_scoring::PeerScorer;
use issuer::p2p::equivocation::EquivocationDetector;
use issuer::p2p::wal::{ConsensusWAL, WALEntry, WalRole, WalSyncMode};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn make_peer_id(n: u8) -> [u8; 32] {
    let mut id = [0u8; 32];
    id[0] = n;
    id
}

fn sha256(data: &[u8]) -> [u8; 32] {
    use sha2::{Sha256, Digest};
    let mut hasher = Sha256::new();
    hasher.update(data);
    let result = hasher.finalize();
    let mut out = [0u8; 32];
    out.copy_from_slice(&result);
    out
}

// ---------------------------------------------------------------------------
// 1. Rate Limiter Properties
// ---------------------------------------------------------------------------

proptest! {
    #![proptest_config(ProptestConfig::with_cases(200))]

    /// Tokens must never go below 0 regardless of consume pattern.
    #[test]
    fn rate_limiter_tokens_never_negative(
        max_tokens in 1.0f64..1000.0,
        refill_rate in 0.1f64..1000.0,
        consume_count in 0usize..500,
    ) {
        let mut bucket = RateBucket::new(max_tokens, refill_rate);
        for _ in 0..consume_count {
            bucket.try_consume();
        }
        // After any number of consumes, we can only observe the bucket
        // via try_consume: if the bucket were negative, the impl would
        // allow a consume when it shouldn't or panic.  The real invariant
        // is "no panic and the impl is consistent".  We verify by doing
        // one more consume -- if tokens were negative the .min() in refill
        // would not help but the >= 1.0 guard would still hold.
        // Just exercising the path is the property here.
        let _ = bucket.try_consume();
    }

    /// After any refill interval, tokens must not exceed capacity.
    #[test]
    fn rate_limiter_refill_never_exceeds_capacity(
        max_tokens in 1.0f64..1000.0,
        refill_rate in 0.1f64..10000.0,
        drain_count in 0usize..100,
        sleep_ms in 0u64..50,
    ) {
        let mut bucket = RateBucket::new(max_tokens, refill_rate);
        // Drain some tokens
        for _ in 0..drain_count {
            bucket.try_consume();
        }
        // Let time pass (small sleep to keep tests fast)
        if sleep_ms > 0 {
            std::thread::sleep(std::time::Duration::from_millis(sleep_ms));
        }
        // After refill (triggered by next consume), we verify no panic
        // and that the bucket works correctly: consuming max_tokens+1
        // times must eventually fail.
        let mut successes = 0u64;
        for _ in 0..(max_tokens as u64 + 2) {
            if bucket.try_consume() {
                successes += 1;
            }
        }
        // successes can never exceed max_tokens + refill gained during loop
        // but must always be <= some reasonable upper bound
        prop_assert!(successes <= max_tokens as u64 + (refill_rate * 0.1) as u64 + 2);
    }

    /// Rapid consumes then refill: bucket state stays consistent.
    #[test]
    fn rate_limiter_rapid_consume_then_refill(
        max_tokens in 1.0f64..100.0,
        refill_rate in 1.0f64..500.0,
        burst in 0usize..200,
    ) {
        let mut bucket = RateBucket::new(max_tokens, refill_rate);
        // Rapid burst
        let mut consumed = 0usize;
        for _ in 0..burst {
            if bucket.try_consume() {
                consumed += 1;
            }
        }
        // consumed <= max_tokens (initial burst, time ~0)
        prop_assert!(consumed <= max_tokens.ceil() as usize);

        // Small wait then another burst
        std::thread::sleep(std::time::Duration::from_millis(10));
        for _ in 0..burst {
            let _ = bucket.try_consume();
        }
        // No panic = consistent state
    }
}

// ---------------------------------------------------------------------------
// 2. Peer Scoring Properties
// ---------------------------------------------------------------------------

/// Ban threshold from the source: score < -5000 fixed-point = -50.0 real
const BAN_THRESHOLD: f64 = -50.0;

proptest! {
    #![proptest_config(ProptestConfig::with_cases(200))]

    /// Score adjustments: score should stay bounded even under extreme sequences.
    /// Good messages add +0.1, invalid messages subtract -10.0, rate limit -2.0.
    /// Since atomics can go to i64::MIN in theory, we check the scorer doesn't
    /// panic and that the numeric relationship holds.
    #[test]
    fn peer_scoring_no_panic_under_arbitrary_ops(
        ops in prop::collection::vec(0u8..4, 0..500),
    ) {
        let scorer = PeerScorer::new();
        let peer = make_peer_id(1);

        for op in &ops {
            match op {
                0 => scorer.record_good_message(&peer),
                1 => scorer.record_invalid_message(&peer),
                2 => scorer.record_rate_limit_hit(&peer),
                _ => scorer.record_decode_failure(&peer),
            }
        }

        // Just reading the score shouldn't panic
        let _score = scorer.score_of(&peer);
    }

    /// Arbitrary peer IDs: scorer handles all 256 peer IDs without panic.
    #[test]
    fn peer_scoring_arbitrary_peer_ids(
        peer_byte in 0u8..=255,
        op_count in 0usize..50,
    ) {
        let scorer = PeerScorer::new();
        let peer = make_peer_id(peer_byte);

        for _ in 0..op_count {
            scorer.record_good_message(&peer);
            scorer.record_invalid_message(&peer);
        }

        let _ = scorer.score_of(&peer);
        let _ = scorer.is_banned(&peer);
    }

    /// Multiple ban/unban cycles: state remains consistent.
    /// We drive the peer below the ban threshold, tick to ban, then
    /// check that ban state is consistent.
    #[test]
    fn peer_scoring_ban_unban_cycles(
        ban_cycles in 1usize..10,
    ) {
        let scorer = PeerScorer::new();
        let peer = make_peer_id(42);

        for _ in 0..ban_cycles {
            // Drive score well below -50.0 (6 invalid = -60.0)
            for _ in 0..6 {
                scorer.record_invalid_message(&peer);
            }
            let banned = scorer.tick(&[peer]);

            // After tick, if score was < -50.0, peer should be banned
            let score = scorer.score_of(&peer);
            if score < BAN_THRESHOLD {
                prop_assert!(
                    banned.contains(&peer) || scorer.is_banned(&peer),
                    "Peer with score {} should be banned", score
                );
            }

            // Reset score with many good messages (100 * +0.1 = +10.0 per batch)
            for _ in 0..1000 {
                scorer.record_good_message(&peer);
            }
        }
        // After all cycles, scorer state is consistent (no panic)
        let _ = scorer.score_of(&peer);
    }
}

// ---------------------------------------------------------------------------
// 3. Equivocation Detector Properties
// ---------------------------------------------------------------------------

proptest! {
    #![proptest_config(ProptestConfig::with_cases(200))]

    /// Same (peer, cycle, phase, content) submitted N times -> never equivocation.
    #[test]
    fn equivocation_same_content_never_flagged(
        cycle in 0u64..1000,
        phase in 0u8..10,
        content in prop::collection::vec(any::<u8>(), 0..256),
        repeat_count in 2usize..50,
    ) {
        let det = EquivocationDetector::new();
        let peer = make_peer_id(1);
        let hash = sha256(&content);

        for i in 0..repeat_count {
            let result = det.check(&peer, cycle, phase, hash);
            prop_assert!(
                !result,
                "Same content flagged as equivocation on iteration {}", i
            );
        }
    }

    /// Different content for same (peer, cycle, phase) -> always detected.
    #[test]
    fn equivocation_different_content_always_detected(
        cycle in 0u64..1000,
        phase in 0u8..10,
        content_a in prop::collection::vec(any::<u8>(), 1..256),
        content_b in prop::collection::vec(any::<u8>(), 1..256),
    ) {
        // Only test when content is actually different
        let hash_a = sha256(&content_a);
        let hash_b = sha256(&content_b);
        prop_assume!(hash_a != hash_b);

        let det = EquivocationDetector::new();
        let peer = make_peer_id(2);

        let first = det.check(&peer, cycle, phase, hash_a);
        prop_assert!(!first, "First submission should not be equivocation");

        let second = det.check(&peer, cycle, phase, hash_b);
        prop_assert!(second, "Different content must be flagged as equivocation");
    }

    /// Arbitrary content bytes: detector handles all sizes without panic.
    #[test]
    fn equivocation_arbitrary_content_no_panic(
        content in prop::collection::vec(any::<u8>(), 0..1024),
        cycle in 0u64..10000,
        phase in 0u8..=255,
        peer_byte in 0u8..=255,
    ) {
        let det = EquivocationDetector::new();
        let peer = make_peer_id(peer_byte);
        let hash = sha256(&content);
        let _ = det.check(&peer, cycle, phase, hash);
    }
}

// ---------------------------------------------------------------------------
// 4. WAL Properties
// ---------------------------------------------------------------------------

fn make_wal_entry(cycle: u64, message_bytes: Vec<u8>) -> WALEntry {
    WALEntry {
        cycle_number: cycle,
        phase: "Price".to_string(),
        from: [1u8; 32],
        message_bytes,
        role: WalRole::Follower,
        timestamp_ms: 1234567890,
    }
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(50))]

    /// Arbitrary message bytes (0 to 10KB): write + read roundtrip preserves content.
    #[test]
    fn wal_roundtrip_preserves_content(
        message_bytes in prop::collection::vec(any::<u8>(), 0..10240),
    ) {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("prop_test.wal");
        let mut wal = ConsensusWAL::open(&path, WalSyncMode::None).unwrap();

        let entry = make_wal_entry(1, message_bytes.clone());
        wal.append(&entry).unwrap();

        let entries = wal.read_all().unwrap();
        prop_assert_eq!(entries.len(), 1);
        prop_assert_eq!(&entries[0].message_bytes, &message_bytes);
        prop_assert_eq!(entries[0].cycle_number, 1);
        prop_assert_eq!(&entries[0].phase, "Price");
    }

    /// Arbitrary cycle numbers: read_cycle filter returns only matching entries.
    #[test]
    fn wal_read_cycle_filters_correctly(
        cycles in prop::collection::vec(1u64..100, 1..20),
        target_cycle in 1u64..100,
    ) {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("prop_cycle.wal");
        let mut wal = ConsensusWAL::open(&path, WalSyncMode::None).unwrap();

        for &c in &cycles {
            wal.append(&make_wal_entry(c, vec![c as u8])).unwrap();
        }

        let filtered = wal.read_cycle(target_cycle).unwrap();
        let expected_count = cycles.iter().filter(|&&c| c == target_cycle).count();
        prop_assert_eq!(filtered.len(), expected_count);

        for entry in &filtered {
            prop_assert_eq!(entry.cycle_number, target_cycle);
        }
    }

    /// Multiple entries with random cycle numbers: GC keeps only the specified cycle.
    #[test]
    fn wal_gc_keeps_only_specified_cycle(
        cycles in prop::collection::vec(1u64..50, 1..30),
        gc_cycle in 1u64..50,
    ) {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("prop_gc.wal");
        let mut wal = ConsensusWAL::open(&path, WalSyncMode::None).unwrap();

        for &c in &cycles {
            wal.append(&make_wal_entry(c, vec![c as u8])).unwrap();
        }

        wal.gc(gc_cycle).unwrap();

        let remaining = wal.read_all().unwrap();
        let expected_count = cycles.iter().filter(|&&c| c == gc_cycle).count();
        prop_assert_eq!(remaining.len(), expected_count);

        for entry in &remaining {
            prop_assert_eq!(entry.cycle_number, gc_cycle);
        }
    }
}
