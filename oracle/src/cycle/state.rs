//! Cycle state tracking for the issuer node.
//!
//! Maintains the current cycle number, phase, trigger, and timing information
//! for coordinated order processing.

use super::CyclePhase;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// What triggered this cycle.
///
/// Used by the consensus loop to decide which work to run:
/// - `Heartbeat`: wall-clock aligned, runs ALL work (including rebalances, stale watchdog)
/// - `WorkDriven`: fast follow-up triggered by pending orders, skips rebalances
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CycleTrigger {
    /// Wall-clock aligned heartbeat cycle — processes all work including rebalances.
    Heartbeat,
    /// Fast follow-up cycle — urgent work only (skip rebalances).
    WorkDriven,
}

impl Default for CycleTrigger {
    fn default() -> Self {
        Self::Heartbeat
    }
}

/// Current state of the cycle manager.
///
/// Tracks cycle number, current phase, and timing for logging
/// and synchronization purposes.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CycleState {
    /// Current cycle number (monotonically increasing).
    cycle_number: u64,

    /// Current phase within the cycle.
    current_phase: CyclePhase,

    /// What triggered this cycle (heartbeat vs work-driven).
    trigger: CycleTrigger,

    /// Timestamp when the current phase started.
    phase_start_time: DateTime<Utc>,

    /// Timestamp when the current cycle started.
    cycle_start_time: DateTime<Utc>,
}

impl CycleState {
    /// Creates a new CycleState starting from a given cycle number.
    ///
    /// # Arguments
    /// * `starting_cycle` - The cycle number to start from (typically from last on-chain cycle)
    pub fn new(starting_cycle: u64) -> Self {
        let now = Utc::now();
        Self {
            cycle_number: starting_cycle,
            current_phase: CyclePhase::default(),
            trigger: CycleTrigger::default(),
            phase_start_time: now,
            cycle_start_time: now,
        }
    }

    /// Returns the current cycle number.
    #[inline]
    pub fn get_current_cycle(&self) -> u64 {
        self.cycle_number
    }

    /// Returns the current phase.
    #[inline]
    pub fn get_cycle_phase(&self) -> CyclePhase {
        self.current_phase
    }

    /// Returns what triggered this cycle.
    #[inline]
    pub fn get_trigger(&self) -> CycleTrigger {
        self.trigger
    }

    /// Returns true if this is a heartbeat (wall-clock) cycle.
    #[inline]
    pub fn is_heartbeat(&self) -> bool {
        self.trigger == CycleTrigger::Heartbeat
    }

    /// Sets the cycle trigger.
    #[inline]
    pub fn set_trigger(&mut self, trigger: CycleTrigger) {
        self.trigger = trigger;
    }

    /// Returns when the current phase started.
    #[inline]
    pub fn phase_start_time(&self) -> DateTime<Utc> {
        self.phase_start_time
    }

    /// Returns when the current cycle started.
    #[inline]
    pub fn cycle_start_time(&self) -> DateTime<Utc> {
        self.cycle_start_time
    }

    /// Returns how long the current phase has been running in milliseconds.
    pub fn phase_duration_ms(&self) -> i64 {
        Utc::now()
            .signed_duration_since(self.phase_start_time)
            .num_milliseconds()
    }

    /// Returns how long the current cycle has been running in milliseconds.
    pub fn cycle_duration_ms(&self) -> i64 {
        Utc::now()
            .signed_duration_since(self.cycle_start_time)
            .num_milliseconds()
    }

    /// Advances to the next phase, incrementing cycle number if wrapping.
    ///
    /// Returns the previous phase duration in milliseconds.
    pub fn advance_phase(&mut self) -> i64 {
        let now = Utc::now();
        let phase_duration = now
            .signed_duration_since(self.phase_start_time)
            .num_milliseconds();

        let next_phase = self.current_phase.next();

        // If we're wrapping back to ProcessFills, start a new cycle
        if next_phase.is_cycle_start() {
            self.cycle_number += 1;
            self.cycle_start_time = now;
        }

        self.current_phase = next_phase;
        self.phase_start_time = now;

        phase_duration
    }

    /// Sets the cycle number and phase directly (used by wall-clock aligned mode).
    pub fn set_cycle_and_phase(&mut self, cycle_number: u64, phase: CyclePhase) {
        let now = Utc::now();
        let cycle_changed = cycle_number != self.cycle_number;
        self.cycle_number = cycle_number;
        self.current_phase = phase;
        self.phase_start_time = now;
        if cycle_changed {
            self.cycle_start_time = now;
        }
    }

    /// Resets the state to a new cycle, used for recovery scenarios.
    pub fn reset_to_cycle(&mut self, cycle_number: u64) {
        let now = Utc::now();
        self.cycle_number = cycle_number;
        self.current_phase = CyclePhase::default();
        self.trigger = CycleTrigger::default();
        self.phase_start_time = now;
        self.cycle_start_time = now;
    }
}

impl Default for CycleState {
    fn default() -> Self {
        Self::new(0)
    }
}
