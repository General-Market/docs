//! Integration test: P2P peer scoring ban recovery
//!
//! Verifies that the peer scoring system recovers from cascade bans:
//! 1. Startup penalty cascade → peers get banned
//! 2. Ban expires → scores reset to 0, peers unbanned
//! 3. Good messages flow → scores recover

use std::sync::atomic::Ordering;
use std::time::{Duration, Instant};

use issuer::p2p::peer_scoring::PeerScorer;

type PeerId = [u8; 32];

fn test_peer(n: u8) -> PeerId {
    let mut id = [0u8; 32];
    id[0] = n;
    id
}

/// Simulates the production startup race: 3 issuers start simultaneously,
/// each getting penalized for non-leader proposals and false equivocations.
#[test]
fn startup_cascade_ban_and_recovery() {
    let scorer = PeerScorer::new();
    let peers: Vec<PeerId> = (1..=3).map(test_peer).collect();
    let all_connected: Vec<PeerId> = peers.clone();

    // Phase 1: Simulate startup penalty cascade
    // Each peer sends 5 invalid messages (non-leader proposals at wrong cycle)
    // During startup grace: 5 × -2.0 = -10.0 per peer (NOT enough to ban)
    for p in &peers {
        for _ in 0..5 {
            scorer.record_invalid_message(p);
        }
    }

    // Verify scores are at -10.0 (startup grace: -2.0 each)
    for p in &peers {
        assert!(
            (scorer.score_of(p) - (-10.0)).abs() < f64::EPSILON,
            "Expected -10.0 during startup grace, got {}",
            scorer.score_of(p)
        );
    }

    // Tick should NOT ban anyone at -10.0 (threshold is -50.0)
    let banned = scorer.tick(&all_connected);
    assert!(
        banned.is_empty(),
        "Startup grace should prevent bans from 5 invalid messages"
    );

    // Phase 2: Simulate severe penalty (push past threshold manually)
    // This simulates what happens without grace period: direct score manipulation
    for p in &peers {
        if let Some(entry) = scorer.scores.get(p) {
            entry.score.store(-6000, Ordering::Relaxed); // -60.0
        }
    }

    // Only ban one peer (if we ban >33%, partition heuristic activates).
    // Set two peers back to healthy so only one gets banned.
    for p in &peers[1..] {
        if let Some(entry) = scorer.scores.get(p) {
            entry.score.store(0, Ordering::Relaxed);
        }
    }

    let banned = scorer.tick(&all_connected);
    assert_eq!(banned.len(), 1, "Exactly one peer should be banned");
    assert!(scorer.is_banned(&peers[0]));

    // Phase 3: Simulate ban expiry
    if let Some(entry) = scorer.scores.get(&peers[0]) {
        if let Ok(mut b) = entry.banned_until.lock() {
            *b = Some(Instant::now() - Duration::from_secs(1));
        }
    }

    // Phase 4: Tick after ban expiry — score should reset to 0, peer unbanned
    let re_banned = scorer.tick(&all_connected);
    assert!(
        re_banned.is_empty(),
        "Peer should NOT be re-banned after ban expiry"
    );
    assert!(!scorer.is_banned(&peers[0]));
    assert!(
        (scorer.score_of(&peers[0]) - 0.0).abs() < f64::EPSILON,
        "Score should be reset to 0 after ban expiry, got {}",
        scorer.score_of(&peers[0])
    );

    // Phase 5: Good messages flow — scores recover above zero
    for _ in 0..50 {
        scorer.record_good_message(&peers[0]);
    }
    assert!(
        scorer.score_of(&peers[0]) > 0.0,
        "Score should be positive after good messages"
    );
}

/// Verifies that multiple ban/unban cycles work correctly
/// (ban_count increases, but score always resets on expiry).
#[test]
fn multiple_ban_cycles_recover() {
    let scorer = PeerScorer::new();
    let peer = test_peer(20);

    for cycle in 0..3 {
        // Drive score below threshold
        if let Some(entry) = scorer.scores.get(&peer) {
            entry.score.store(-6000, Ordering::Relaxed);
        } else {
            scorer.record_good_message(&peer); // create entry
            if let Some(entry) = scorer.scores.get(&peer) {
                entry.score.store(-6000, Ordering::Relaxed);
            }
        }

        let banned = scorer.tick(&[peer]);
        assert!(
            banned.contains(&peer),
            "Peer should be banned in cycle {}",
            cycle
        );

        // Simulate ban expiry
        if let Some(entry) = scorer.scores.get(&peer) {
            if let Ok(mut b) = entry.banned_until.lock() {
                *b = Some(Instant::now() - Duration::from_secs(1));
            }
        }

        // Tick — should reset
        let re_banned = scorer.tick(&[peer]);
        assert!(
            re_banned.is_empty(),
            "Peer should NOT be re-banned after expiry in cycle {}",
            cycle
        );
        assert!(
            (scorer.score_of(&peer) - 0.0).abs() < f64::EPSILON,
            "Score should reset to 0 after expiry in cycle {}, got {}",
            cycle,
            scorer.score_of(&peer)
        );
    }
}
