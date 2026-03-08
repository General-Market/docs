//! Consensus state machine for tracking consensus phases and rounds
//!
//! Manages the lifecycle of consensus rounds including phase transitions,
//! vote collection, and timeout tracking.

use std::collections::HashMap;
use std::time::{Duration, Instant};

use common::types::{BLSSignature, PeerId};

/// Consensus phase within a round
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum ConsensusPhase {
    /// Not currently in consensus
    Idle,
    /// Leader is proposing prices
    PriceProposal,
    /// Collecting price votes from followers
    PriceVoting,
    /// Leader is proposing batch
    BatchProposal,
    /// Collecting batch signatures from followers
    BatchSigning,
    /// Consensus round completed successfully
    Complete,
}

impl Default for ConsensusPhase {
    fn default() -> Self {
        Self::Idle
    }
}

impl std::fmt::Display for ConsensusPhase {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Idle => write!(f, "Idle"),
            Self::PriceProposal => write!(f, "PriceProposal"),
            Self::PriceVoting => write!(f, "PriceVoting"),
            Self::BatchProposal => write!(f, "BatchProposal"),
            Self::BatchSigning => write!(f, "BatchSigning"),
            Self::Complete => write!(f, "Complete"),
        }
    }
}

/// Vote from a peer on price proposal
#[derive(Debug, Clone)]
pub struct PriceVote {
    /// Whether the peer approved the prices
    pub approved: bool,
    /// The peer's BLS signature on the vote
    pub signature: BLSSignature,
}

/// Tracking state for a single consensus round
#[derive(Debug, Clone)]
pub struct ConsensusRound {
    /// The cycle number for this consensus round
    pub cycle_number: u64,
    /// Current phase in the consensus process
    pub phase: ConsensusPhase,
    /// Price votes received from peers (indexed by peer ID)
    pub price_votes: HashMap<PeerId, PriceVote>,
    /// Batch signatures received from peers (indexed by peer ID)
    pub batch_signatures: HashMap<PeerId, BLSSignature>,
    /// Number of retry attempts for price consensus
    pub retry_count: u8,
    /// When this round started
    pub started_at: Instant,
    /// When the current phase started
    pub phase_started_at: Instant,
}

impl ConsensusRound {
    /// Create a new consensus round
    pub fn new(cycle_number: u64) -> Self {
        let now = Instant::now();
        Self {
            cycle_number,
            phase: ConsensusPhase::Idle,
            price_votes: HashMap::new(),
            batch_signatures: HashMap::new(),
            retry_count: 0,
            started_at: now,
            phase_started_at: now,
        }
    }

    /// Reset the round for a retry
    pub fn reset_for_retry(&mut self) {
        self.price_votes.clear();
        self.retry_count += 1;
        self.phase = ConsensusPhase::Idle;
        self.phase_started_at = Instant::now();
    }

    /// Transition to a new phase
    pub fn set_phase(&mut self, phase: ConsensusPhase) {
        self.phase = phase;
        self.phase_started_at = Instant::now();
    }

    /// Calculate the disagreement percentage
    pub fn disagreement_percent(&self) -> u8 {
        if self.price_votes.is_empty() {
            return 0;
        }

        let disagree_count = self
            .price_votes
            .values()
            .filter(|v| !v.approved)
            .count();

        ((disagree_count * 100) / self.price_votes.len()) as u8
    }

    /// Get count of agree votes
    pub fn agree_count(&self) -> usize {
        self.price_votes.values().filter(|v| v.approved).count()
    }

    /// Get count of disagree votes
    pub fn disagree_count(&self) -> usize {
        self.price_votes.values().filter(|v| !v.approved).count()
    }

    /// Get count of collected batch signatures
    pub fn signature_count(&self) -> usize {
        self.batch_signatures.len()
    }

    /// Check if a phase has timed out
    pub fn is_phase_timed_out(&self, timeout: Duration) -> bool {
        self.phase_started_at.elapsed() >= timeout
    }
}

/// Configurable timeout durations for consensus phases
#[derive(Debug, Clone)]
pub struct ConsensusTimeouts {
    /// Timeout for price proposal phase (leader waiting for broadcast acknowledgment)
    pub price_proposal_timeout: Duration,
    /// Timeout for price voting phase (collecting votes)
    pub price_vote_timeout: Duration,
    /// Timeout for batch proposal phase (leader waiting for broadcast acknowledgment)
    pub batch_proposal_timeout: Duration,
    /// Timeout for batch signing phase (collecting signatures)
    pub batch_sign_timeout: Duration,
    /// Polling interval for busy-wait loops (default: 10ms production, 1ms tests)
    pub polling_interval: Duration,
}

impl Default for ConsensusTimeouts {
    fn default() -> Self {
        Self {
            // Price phases only used by standalone run_price_cycle (no orders).
            // Regular run_cycle skips price round → batch only: 150+200 = 350ms.
            price_proposal_timeout: Duration::from_millis(100),
            price_vote_timeout: Duration::from_millis(100),
            batch_proposal_timeout: Duration::from_millis(150),
            batch_sign_timeout: Duration::from_millis(200),
            polling_interval: Duration::from_millis(5),
        }
    }
}

impl ConsensusTimeouts {
    /// Create new timeouts with custom durations
    pub fn new(
        price_proposal_timeout: Duration,
        price_vote_timeout: Duration,
        batch_proposal_timeout: Duration,
        batch_sign_timeout: Duration,
    ) -> Self {
        Self {
            price_proposal_timeout,
            price_vote_timeout,
            batch_proposal_timeout,
            batch_sign_timeout,
            polling_interval: Duration::from_millis(10),
        }
    }

    /// Fast timeouts for tests — 200ms per phase, 1ms polling
    pub fn fast() -> Self {
        Self {
            price_proposal_timeout: Duration::from_millis(200),
            price_vote_timeout: Duration::from_millis(200),
            batch_proposal_timeout: Duration::from_millis(200),
            batch_sign_timeout: Duration::from_millis(200),
            polling_interval: Duration::from_millis(1),
        }
    }

    /// Set polling interval (builder pattern)
    pub fn with_polling_interval(mut self, interval: Duration) -> Self {
        self.polling_interval = interval;
        self
    }

    /// Get timeout for the given phase
    pub fn get_timeout(&self, phase: ConsensusPhase) -> Option<Duration> {
        match phase {
            ConsensusPhase::PriceProposal => Some(self.price_proposal_timeout),
            ConsensusPhase::PriceVoting => Some(self.price_vote_timeout),
            ConsensusPhase::BatchProposal => Some(self.batch_proposal_timeout),
            ConsensusPhase::BatchSigning => Some(self.batch_sign_timeout),
            ConsensusPhase::Idle | ConsensusPhase::Complete => None,
        }
    }

    /// Total of all phase timeouts in milliseconds
    pub fn total_timeout_ms(&self) -> u64 {
        (self.price_proposal_timeout
            + self.price_vote_timeout
            + self.batch_proposal_timeout
            + self.batch_sign_timeout)
            .as_millis() as u64
    }

    /// Assert that total timeouts fit within the given cycle duration
    pub fn assert_fits_in_cycle(&self, cycle_duration_ms: u64) {
        let total = self.total_timeout_ms();
        assert!(
            total < cycle_duration_ms,
            "Consensus timeouts ({total}ms) must be less than cycle duration ({cycle_duration_ms}ms)"
        );
    }
}

/// Consensus state tracking across rounds
#[derive(Debug)]
pub struct ConsensusState {
    /// Current consensus round (if any)
    current_round: Option<ConsensusRound>,
    /// Timeout configuration
    timeouts: ConsensusTimeouts,
}

impl Default for ConsensusState {
    fn default() -> Self {
        Self::new()
    }
}

impl ConsensusState {
    /// Create new consensus state with default timeouts
    pub fn new() -> Self {
        Self {
            current_round: None,
            timeouts: ConsensusTimeouts::default(),
        }
    }

    /// Create consensus state with custom timeouts
    pub fn with_timeouts(timeouts: ConsensusTimeouts) -> Self {
        Self {
            current_round: None,
            timeouts,
        }
    }

    /// Get the timeout configuration
    pub fn timeouts(&self) -> &ConsensusTimeouts {
        &self.timeouts
    }

    /// Start a new consensus round
    pub fn start_round(&mut self, cycle_number: u64) -> &mut ConsensusRound {
        self.current_round = Some(ConsensusRound::new(cycle_number));
        self.current_round.as_mut().unwrap()
    }

    /// Get the current round (if any)
    pub fn current_round(&self) -> Option<&ConsensusRound> {
        self.current_round.as_ref()
    }

    /// Get the current round mutably (if any)
    pub fn current_round_mut(&mut self) -> Option<&mut ConsensusRound> {
        self.current_round.as_mut()
    }

    /// Advance to the next phase
    pub fn advance(&mut self) -> Option<ConsensusPhase> {
        if let Some(ref mut round) = self.current_round {
            let next_phase = match round.phase {
                ConsensusPhase::Idle => ConsensusPhase::PriceProposal,
                ConsensusPhase::PriceProposal => ConsensusPhase::PriceVoting,
                ConsensusPhase::PriceVoting => ConsensusPhase::BatchProposal,
                ConsensusPhase::BatchProposal => ConsensusPhase::BatchSigning,
                ConsensusPhase::BatchSigning => ConsensusPhase::Complete,
                ConsensusPhase::Complete => return None,
            };
            round.set_phase(next_phase);
            Some(next_phase)
        } else {
            None
        }
    }

    /// Clear the current round
    pub fn clear_round(&mut self) {
        self.current_round = None;
    }

    /// Check if the current phase has timed out
    pub fn is_current_phase_timed_out(&self) -> bool {
        if let Some(ref round) = self.current_round {
            if let Some(timeout) = self.timeouts.get_timeout(round.phase) {
                return round.is_phase_timed_out(timeout);
            }
        }
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_consensus_phase_default() {
        assert_eq!(ConsensusPhase::default(), ConsensusPhase::Idle);
    }

    #[test]
    fn test_consensus_round_new() {
        let round = ConsensusRound::new(42);
        assert_eq!(round.cycle_number, 42);
        assert_eq!(round.phase, ConsensusPhase::Idle);
        assert!(round.price_votes.is_empty());
        assert!(round.batch_signatures.is_empty());
        assert_eq!(round.retry_count, 0);
    }

    #[test]
    fn test_consensus_round_disagreement_percent() {
        let mut round = ConsensusRound::new(1);

        // No votes = 0% disagreement
        assert_eq!(round.disagreement_percent(), 0);

        // Add 10 votes: 8 agree, 2 disagree = 20% disagreement
        for i in 0..8 {
            let mut peer_id = [0u8; 32];
            peer_id[0] = i;
            round.price_votes.insert(
                peer_id,
                PriceVote {
                    approved: true,
                    signature: BLSSignature(vec![0; 64]),
                },
            );
        }
        for i in 8..10 {
            let mut peer_id = [0u8; 32];
            peer_id[0] = i;
            round.price_votes.insert(
                peer_id,
                PriceVote {
                    approved: false,
                    signature: BLSSignature(vec![0; 64]),
                },
            );
        }

        assert_eq!(round.disagree_count(), 2);
        assert_eq!(round.agree_count(), 8);
        assert_eq!(round.disagreement_percent(), 20);
    }

    #[test]
    fn test_consensus_round_reset_for_retry() {
        let mut round = ConsensusRound::new(1);
        round.phase = ConsensusPhase::PriceVoting;
        round.price_votes.insert(
            [0u8; 32],
            PriceVote {
                approved: true,
                signature: BLSSignature(vec![0; 64]),
            },
        );

        round.reset_for_retry();

        assert_eq!(round.phase, ConsensusPhase::Idle);
        assert!(round.price_votes.is_empty());
        assert_eq!(round.retry_count, 1);
    }

    #[test]
    fn test_consensus_timeouts_default() {
        let timeouts = ConsensusTimeouts::default();
        // Price phases only used by standalone run_price_cycle.
        // Regular run_cycle skips price → batch only: 150+200 = 350ms.
        assert_eq!(timeouts.price_proposal_timeout, Duration::from_millis(100));
        assert_eq!(timeouts.price_vote_timeout, Duration::from_millis(100));
        assert_eq!(timeouts.batch_proposal_timeout, Duration::from_millis(150));
        assert_eq!(timeouts.batch_sign_timeout, Duration::from_millis(200));
        assert_eq!(timeouts.polling_interval, Duration::from_millis(5));
    }

    #[test]
    fn test_consensus_timeouts_total_fits_in_cycle() {
        let timeouts = ConsensusTimeouts::default();
        assert_eq!(timeouts.total_timeout_ms(), 550);
        // Must be less than 1s cycle
        timeouts.assert_fits_in_cycle(1000);
    }

    #[test]
    #[should_panic(expected = "must be less than cycle duration")]
    fn test_consensus_timeouts_too_large_for_cycle() {
        let timeouts = ConsensusTimeouts::new(
            Duration::from_millis(500),
            Duration::from_millis(300),
            Duration::from_millis(500),
            Duration::from_millis(300),
        );
        // 1600ms > 1000ms cycle → should panic
        timeouts.assert_fits_in_cycle(1000);
    }

    #[test]
    fn test_consensus_timeouts_fast() {
        let timeouts = ConsensusTimeouts::fast();
        assert_eq!(timeouts.price_proposal_timeout, Duration::from_millis(200));
        assert_eq!(timeouts.price_vote_timeout, Duration::from_millis(200));
        assert_eq!(timeouts.batch_proposal_timeout, Duration::from_millis(200));
        assert_eq!(timeouts.batch_sign_timeout, Duration::from_millis(200));
        assert_eq!(timeouts.polling_interval, Duration::from_millis(1));
    }

    #[test]
    fn test_consensus_timeouts_with_polling_interval() {
        let timeouts = ConsensusTimeouts::fast().with_polling_interval(Duration::from_millis(5));
        assert_eq!(timeouts.polling_interval, Duration::from_millis(5));
        // Other fields unchanged
        assert_eq!(timeouts.price_proposal_timeout, Duration::from_millis(200));
    }

    #[test]
    fn test_consensus_timeouts_get_timeout() {
        let timeouts = ConsensusTimeouts::default();
        assert_eq!(
            timeouts.get_timeout(ConsensusPhase::PriceProposal),
            Some(Duration::from_millis(100))
        );
        assert_eq!(
            timeouts.get_timeout(ConsensusPhase::PriceVoting),
            Some(Duration::from_millis(100))
        );
        assert_eq!(timeouts.get_timeout(ConsensusPhase::Idle), None);
        assert_eq!(timeouts.get_timeout(ConsensusPhase::Complete), None);
    }

    #[test]
    fn test_consensus_state_advance() {
        let mut state = ConsensusState::new();
        state.start_round(1);

        // Idle -> PriceProposal
        assert_eq!(state.advance(), Some(ConsensusPhase::PriceProposal));
        assert_eq!(
            state.current_round().unwrap().phase,
            ConsensusPhase::PriceProposal
        );

        // PriceProposal -> PriceVoting
        assert_eq!(state.advance(), Some(ConsensusPhase::PriceVoting));
        assert_eq!(
            state.current_round().unwrap().phase,
            ConsensusPhase::PriceVoting
        );

        // PriceVoting -> BatchProposal
        assert_eq!(state.advance(), Some(ConsensusPhase::BatchProposal));
        assert_eq!(
            state.current_round().unwrap().phase,
            ConsensusPhase::BatchProposal
        );

        // BatchProposal -> BatchSigning
        assert_eq!(state.advance(), Some(ConsensusPhase::BatchSigning));
        assert_eq!(
            state.current_round().unwrap().phase,
            ConsensusPhase::BatchSigning
        );

        // BatchSigning -> Complete
        assert_eq!(state.advance(), Some(ConsensusPhase::Complete));
        assert_eq!(
            state.current_round().unwrap().phase,
            ConsensusPhase::Complete
        );

        // Complete -> None
        assert_eq!(state.advance(), None);
    }

    #[test]
    fn test_consensus_state_no_round() {
        let mut state = ConsensusState::new();
        assert!(state.current_round().is_none());
        assert_eq!(state.advance(), None);
    }

    #[test]
    fn test_phase_timeout_check() {
        let round = ConsensusRound::new(1);
        // Just created, should not be timed out with a 200ms timeout
        assert!(!round.is_phase_timed_out(Duration::from_millis(200)));

        // With a 0ms timeout, should be timed out
        assert!(round.is_phase_timed_out(Duration::from_millis(0)));
    }
}
