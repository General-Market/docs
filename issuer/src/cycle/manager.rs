//! Cycle manager implementation for coordinated order processing.
//!
//! The CycleManager runs a 1-second cycle loop with 5 phases,
//! coordinating order processing across all issuers.

use super::ntp::NtpSyncState;
use super::{CyclePhase, CycleState};
use super::state::CycleTrigger;
use chrono::Utc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, RwLock};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::sync::watch;
use tokio::time::interval;
use tracing::{error, info, warn};

/// Configuration for the cycle manager.
#[derive(Debug, Clone)]
pub struct CycleConfig {
    /// Duration of a full cycle in milliseconds (default: 1000ms).
    /// Acts as the heartbeat interval in demand-driven mode.
    pub cycle_duration_ms: u64,

    /// Minimum gap between fast (work-driven) cycles in milliseconds (default: 50ms).
    /// Prevents spinning too fast when there's pending work.
    pub min_cycle_gap_ms: u64,

    /// Issuer node ID for logging.
    pub issuer_id: u32,

    /// Timing tolerance in milliseconds for NTP sync (default: 200ms).
    pub timing_tolerance_ms: u64,

    /// Warning threshold for cycle duration (default: 500ms).
    pub warn_threshold_ms: u64,

    /// Critical threshold for cycle duration (default: 2000ms).
    pub critical_threshold_ms: u64,

    /// Use wall-clock time to derive cycle numbers (default: true).
    ///
    /// When true, all nodes derive the same cycle number from
    /// `unix_timestamp_ms / cycle_duration_ms`, guaranteeing agreement
    /// regardless of boot time. When false, uses interval-based counting
    /// from a starting cycle number (legacy/testing mode).
    pub wall_clock_aligned: bool,
}

impl Default for CycleConfig {
    fn default() -> Self {
        Self {
            cycle_duration_ms: 1000,
            min_cycle_gap_ms: 50,
            issuer_id: 0,
            timing_tolerance_ms: 200,
            warn_threshold_ms: 500,
            critical_threshold_ms: 2000,
            wall_clock_aligned: true,
        }
    }
}

/// Minimum cycle duration in milliseconds (must allow at least 1ms per phase).
pub const MIN_CYCLE_DURATION_MS: u64 = 5;

impl CycleConfig {
    /// Creates a new config with the specified cycle duration.
    ///
    /// # Panics
    /// Panics if cycle_duration_ms is less than MIN_CYCLE_DURATION_MS (5ms).
    pub fn with_duration_ms(cycle_duration_ms: u64) -> Self {
        assert!(
            cycle_duration_ms >= MIN_CYCLE_DURATION_MS,
            "cycle_duration_ms must be at least {}ms (got {}ms)",
            MIN_CYCLE_DURATION_MS,
            cycle_duration_ms
        );
        Self {
            cycle_duration_ms,
            ..Default::default()
        }
    }

    /// Sets the minimum gap between fast cycles.
    pub fn with_min_cycle_gap_ms(mut self, min_cycle_gap_ms: u64) -> Self {
        self.min_cycle_gap_ms = min_cycle_gap_ms;
        self
    }

    /// Sets the issuer ID.
    pub fn with_issuer_id(mut self, issuer_id: u32) -> Self {
        self.issuer_id = issuer_id;
        self
    }

    /// Returns the duration per phase in milliseconds.
    pub fn phase_duration_ms(&self) -> u64 {
        self.cycle_duration_ms / CyclePhase::count() as u64
    }
}

/// Callback type for phase-specific hooks.
pub type PhaseCallback = Box<dyn Fn(CyclePhase, u64) + Send + Sync>;

/// Manages the issuer cycle loop with configurable timing.
///
/// The CycleManager coordinates the 5-phase cycle structure:
/// PROCESS_FILLS -> NETTING -> INVENTORY_CHECK -> GENERATE_BATCH -> SIGN_SUBMIT
///
/// # Time Synchronization (NTP)
///
/// NTP integration is provided via the [`NtpSync`](super::ntp::NtpSync) module.
/// On startup, `NtpSync::initial_sync()` queries an NTP server and measures drift.
/// A periodic re-sync task runs every 60 seconds to detect clock drift.
///
/// The `reference_time` field can also be set externally via
/// [`set_reference_time()`](Self::set_reference_time) for manual synchronization.
/// If neither NTP nor manual reference is configured, `is_time_synchronized()`
/// returns `true` by default (graceful degradation).
pub struct CycleManager {
    /// Configuration for timing and thresholds.
    config: CycleConfig,

    /// Current cycle state.
    state: CycleState,

    /// Optional callbacks for each phase transition.
    phase_callbacks: Vec<PhaseCallback>,

    /// Sender for state updates (allows external monitoring).
    state_tx: watch::Sender<CycleState>,

    /// Receiver for state updates.
    state_rx: watch::Receiver<CycleState>,

    /// Reference time for synchronization checks.
    reference_time: Option<SystemTime>,

    /// NTP synchronization state (shared with NtpSync periodic task).
    /// When set, `is_time_synchronized()` reads real NTP drift instead of
    /// relying on the local `reference_time` field.
    ntp_state: Option<Arc<RwLock<NtpSyncState>>>,

    /// Receiver for work signals from consensus loop.
    /// `true` = has pending work (trigger fast cycle), `false` = no work (wait for heartbeat).
    /// When None, falls back to pure heartbeat mode (backward compat).
    work_rx: Option<tokio::sync::mpsc::Receiver<bool>>,
}

impl CycleManager {
    /// Creates a new CycleManager with the specified configuration.
    pub fn new(config: CycleConfig) -> Self {
        let initial_state = CycleState::new(0);
        let (state_tx, state_rx) = watch::channel(initial_state.clone());

        Self {
            config,
            state: initial_state,
            phase_callbacks: Vec::new(),
            state_tx,
            state_rx,
            reference_time: None,
            ntp_state: None,
            work_rx: None,
        }
    }

    /// Creates a CycleManager with default 1-second cycles.
    pub fn default_with_issuer_id(issuer_id: u32) -> Self {
        Self::new(CycleConfig::default().with_issuer_id(issuer_id))
    }

    /// Creates a CycleManager for testing with short cycles.
    ///
    /// Uses interval-based counting (wall_clock_aligned=false) for deterministic tests.
    pub fn for_testing(cycle_duration_ms: u64, issuer_id: u32) -> Self {
        let mut config = CycleConfig::with_duration_ms(cycle_duration_ms).with_issuer_id(issuer_id);
        config.wall_clock_aligned = false;
        Self::new(config)
    }

    /// Sets the starting cycle number (e.g., from last on-chain cycle).
    ///
    /// Disables wall-clock alignment — cycles will count up from this number
    /// using interval-based timing.
    pub fn with_starting_cycle(mut self, cycle_number: u64) -> Self {
        self.config.wall_clock_aligned = false;
        self.state.reset_to_cycle(cycle_number);
        let _ = self.state_tx.send(self.state.clone());
        self
    }

    /// Registers a callback to be called on each phase transition.
    pub fn on_phase_transition<F>(mut self, callback: F) -> Self
    where
        F: Fn(CyclePhase, u64) + Send + Sync + 'static,
    {
        self.phase_callbacks.push(Box::new(callback));
        self
    }

    /// Returns the current cycle number.
    #[inline]
    pub fn get_current_cycle(&self) -> u64 {
        self.state.get_current_cycle()
    }

    /// Returns the current phase.
    #[inline]
    pub fn get_cycle_phase(&self) -> CyclePhase {
        self.state.get_cycle_phase()
    }

    /// Returns a receiver for state updates.
    pub fn subscribe(&self) -> watch::Receiver<CycleState> {
        self.state_rx.clone()
    }

    /// Sets the reference time for synchronization checks.
    ///
    /// This can be called by the NTP sync module or set manually.
    /// See [`NtpSync`](super::ntp::NtpSync) for automatic NTP integration.
    pub fn set_reference_time(&mut self, time: SystemTime) {
        self.reference_time = Some(time);
    }

    /// Sets the NTP synchronization state for real drift measurement.
    ///
    /// When set, `is_time_synchronized()` reads from the NTP module's
    /// shared state instead of using the local `reference_time` field.
    /// Call this after creating the `NtpSync` instance but before
    /// `start_periodic()` consumes it.
    pub fn set_ntp_state(&mut self, state: Arc<RwLock<NtpSyncState>>) {
        self.ntp_state = Some(state);
    }

    /// Attaches a work-signal channel for demand-driven cycling.
    ///
    /// When the consensus loop sends `true`, the CycleManager schedules a fast
    /// (WorkDriven) cycle after `min_cycle_gap_ms`. When it sends `false` or the
    /// channel is not wired, cycles only fire on the heartbeat timer.
    pub fn with_work_channel(mut self, rx: tokio::sync::mpsc::Receiver<bool>) -> Self {
        self.work_rx = Some(rx);
        self
    }

    /// Checks if the local time is within tolerance of the reference time.
    ///
    /// Resolution order:
    /// 1. NTP state (if wired via `set_ntp_state`) — real drift measurement
    /// 2. Manual reference_time (if set via `set_reference_time`)
    /// 3. Default: returns `true` (graceful degradation)
    pub fn is_time_synchronized(&self) -> bool {
        // Check NTP state first if available (real drift measurement)
        if let Some(ref ntp_state) = self.ntp_state {
            if let Ok(state) = ntp_state.read() {
                return state.synchronized;
            }
        }

        // Fallback to manual reference_time check
        let Some(ref_time) = self.reference_time else {
            return true; // No reference time, assume synchronized
        };

        let now = SystemTime::now();
        let drift = match now.duration_since(ref_time) {
            Ok(d) => d.as_millis() as i64,
            Err(e) => -(e.duration().as_millis() as i64),
        };

        drift.unsigned_abs() <= self.config.timing_tolerance_ms as u128 as u64
    }

    /// Returns the current timing drift in milliseconds (positive = ahead, negative = behind).
    pub fn get_timing_drift_ms(&self) -> Option<i64> {
        // Check NTP state first if available
        if let Some(ref ntp_state) = self.ntp_state {
            if let Ok(state) = ntp_state.read() {
                return state.drift_ms;
            }
        }

        // Fallback to manual reference_time
        let ref_time = self.reference_time?;
        let now = SystemTime::now();

        Some(match now.duration_since(ref_time) {
            Ok(d) => d.as_millis() as i64,
            Err(e) => -(e.duration().as_millis() as i64),
        })
    }

    /// Formats issuer_id as hex string per architecture Section 21 spec.
    fn format_issuer_id(&self) -> String {
        format!("0x{:08x}", self.config.issuer_id)
    }

    /// Advances to the next phase and executes callbacks.
    fn advance_phase(&mut self) {
        let prev_phase = self.state.get_cycle_phase();
        // Get cycle duration before advancing (if we're at cycle end)
        let cycle_duration_at_end = if prev_phase.is_cycle_end() {
            Some(self.state.cycle_duration_ms())
        } else {
            None
        };
        let prev_duration = self.state.advance_phase();
        let new_phase = self.state.get_cycle_phase();
        let cycle_number = self.state.get_current_cycle();
        let issuer_id_hex = self.format_issuer_id();

        // Log phase transition with JSON-compatible format per architecture Section 21
        info!(
            timestamp = %Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
            cycle_number,
            issuer_id = %issuer_id_hex,
            phase = %new_phase,
            previous_phase = %prev_phase,
            phase_duration_ms = prev_duration,
            "Phase transition"
        );

        // Check TOTAL CYCLE duration thresholds at cycle end (per architecture Section 22)
        // Thresholds apply to total cycle duration, not individual phase duration
        if let Some(total_cycle_ms) = cycle_duration_at_end {
            let completed_cycle = cycle_number.saturating_sub(1); // cycle_number already incremented
            if total_cycle_ms > self.config.critical_threshold_ms as i64 {
                error!(
                    code = "INFRA-001",
                    cycle_number = completed_cycle,
                    issuer_id = %issuer_id_hex,
                    cycle_duration_ms = total_cycle_ms,
                    threshold_ms = self.config.critical_threshold_ms,
                    "CRITICAL: Cycle exceeded critical threshold"
                );
            } else if total_cycle_ms > self.config.warn_threshold_ms as i64 {
                warn!(
                    code = "INFRA-001",
                    cycle_number = completed_cycle,
                    issuer_id = %issuer_id_hex,
                    cycle_duration_ms = total_cycle_ms,
                    threshold_ms = self.config.warn_threshold_ms,
                    "Cycle exceeded warning threshold"
                );
            }
        }

        // Execute phase callbacks
        for callback in &self.phase_callbacks {
            callback(new_phase, cycle_number);
        }

        // Broadcast state update
        let _ = self.state_tx.send(self.state.clone());
    }

    /// Returns the current Unix timestamp in milliseconds.
    fn unix_timestamp_ms() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64
    }

    /// Computes cycle number and phase from wall-clock time.
    fn wall_clock_cycle_and_phase(cycle_duration_ms: u64, phase_duration_ms: u64) -> (u64, CyclePhase) {
        let now_ms = Self::unix_timestamp_ms();
        let cycle = now_ms / cycle_duration_ms;
        let offset_in_cycle = now_ms % cycle_duration_ms;
        let phase_index = (offset_in_cycle / phase_duration_ms) as usize;
        let phase = CyclePhase::from_index(phase_index.min(CyclePhase::count() - 1))
            .unwrap_or_default();
        (cycle, phase)
    }

    /// Runs the cycle loop until shutdown signal is received.
    ///
    /// # Arguments
    /// * `shutdown` - Atomic bool that signals shutdown when set to true.
    pub async fn start(self, shutdown: Arc<AtomicBool>) {
        let mut this = self;
        if this.config.wall_clock_aligned {
            this.start_wall_clock(shutdown).await;
        } else {
            this.start_interval(shutdown).await;
        }
    }

    /// Demand-driven wall-clock cycle loop.
    ///
    /// Heartbeat cycles fire at `cycle_duration_ms` intervals (wall-clock aligned).
    /// When `work_rx` is wired and signals pending work, fast (WorkDriven) cycles
    /// fire after `min_cycle_gap_ms`. When idle, only heartbeat cycles run.
    async fn start_wall_clock(&mut self, shutdown: Arc<AtomicBool>) {
        let max_cycle_ms = self.config.cycle_duration_ms;
        let min_gap_ms = self.config.min_cycle_gap_ms;
        let issuer_id_hex = self.format_issuer_id();

        // Set initial state from wall clock
        let mut cycle_number = Self::unix_timestamp_ms() / max_cycle_ms;
        self.state.set_cycle_and_phase(cycle_number, CyclePhase::SignSubmit);
        self.state.set_trigger(CycleTrigger::Heartbeat);
        let _ = self.state_tx.send(self.state.clone());

        info!(
            cycle_number,
            issuer_id = %issuer_id_hex,
            heartbeat_ms = max_cycle_ms,
            min_gap_ms,
            demand_driven = self.work_rx.is_some(),
            timestamp = %Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
            "CycleManager starting (demand-driven wall-clock)"
        );

        loop {
            if shutdown.load(Ordering::Relaxed) {
                info!(
                    cycle_number = self.state.get_current_cycle(),
                    issuer_id = %issuer_id_hex,
                    "CycleManager shutting down"
                );
                break;
            }

            let now_ms = Self::unix_timestamp_ms();
            let next_heartbeat_ms = ((now_ms / max_cycle_ms) + 1) * max_cycle_ms;
            let sleep_until_heartbeat = next_heartbeat_ms.saturating_sub(now_ms).max(1);

            // Wait for: heartbeat timer OR work signal from consensus
            let trigger = if let Some(ref mut work_rx) = self.work_rx {
                tokio::select! {
                    _ = tokio::time::sleep(Duration::from_millis(sleep_until_heartbeat)) => {
                        CycleTrigger::Heartbeat
                    }
                    result = work_rx.recv() => {
                        match result {
                            Some(true) => {
                                // Has pending work → fast cycle after min gap
                                tokio::time::sleep(Duration::from_millis(min_gap_ms)).await;
                                CycleTrigger::WorkDriven
                            }
                            Some(false) | None => {
                                // No work or channel closed → loop back to heartbeat wait
                                continue;
                            }
                        }
                    }
                }
            } else {
                // No work channel → legacy fixed-time mode (heartbeat only)
                tokio::time::sleep(Duration::from_millis(sleep_until_heartbeat)).await;
                CycleTrigger::Heartbeat
            };

            // Advance cycle number
            cycle_number += 1;
            // For heartbeat, realign to wall-clock so nodes agree
            if matches!(trigger, CycleTrigger::Heartbeat) {
                cycle_number = Self::unix_timestamp_ms() / max_cycle_ms;
            }

            self.state.set_cycle_and_phase(cycle_number, CyclePhase::SignSubmit);
            self.state.set_trigger(trigger);

            info!(
                cycle = cycle_number,
                trigger = ?trigger,
                issuer_id = %issuer_id_hex,
                "Cycle advanced"
            );

            // Execute phase callbacks
            for callback in &self.phase_callbacks {
                callback(CyclePhase::SignSubmit, cycle_number);
            }

            // Broadcast state update
            let _ = self.state_tx.send(self.state.clone());
        }
    }

    /// Interval-based cycle loop (legacy): counts phases from a starting cycle.
    async fn start_interval(&mut self, shutdown: Arc<AtomicBool>) {
        let phase_duration = Duration::from_millis(self.config.phase_duration_ms());
        let mut phase_interval = interval(phase_duration);
        let issuer_id_hex = self.format_issuer_id();

        // Log startup
        info!(
            cycle_number = self.state.get_current_cycle(),
            issuer_id = %issuer_id_hex,
            cycle_duration_ms = self.config.cycle_duration_ms,
            phase_duration_ms = self.config.phase_duration_ms(),
            timestamp = %Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
            "CycleManager starting (interval mode)"
        );

        loop {
            phase_interval.tick().await;

            if shutdown.load(Ordering::Relaxed) {
                info!(
                    cycle_number = self.state.get_current_cycle(),
                    phase = %self.state.get_cycle_phase(),
                    issuer_id = %issuer_id_hex,
                    "CycleManager shutting down"
                );
                break;
            }

            self.advance_phase();

            // Check timing synchronization periodically (at cycle start)
            if self.state.get_cycle_phase().is_cycle_start() {
                if let Some(drift) = self.get_timing_drift_ms() {
                    let tolerance = self.config.timing_tolerance_ms as i64;
                    if drift.abs() > tolerance / 2 {
                        warn!(
                            code = "INFRA-001",
                            cycle_number = self.state.get_current_cycle(),
                            issuer_id = %issuer_id_hex,
                            drift_ms = drift,
                            tolerance_ms = tolerance,
                            "Timing drift approaching tolerance limit"
                        );
                    }
                }
            }
        }
    }

    /// Runs the cycle loop with a channel-based shutdown signal.
    ///
    /// This variant allows for more graceful shutdown coordination.
    pub async fn start_with_channel(self, shutdown_rx: tokio::sync::oneshot::Receiver<()>) {
        let mut this = self;
        if this.config.wall_clock_aligned {
            this.start_wall_clock_channel(shutdown_rx).await;
        } else {
            this.start_interval_channel(shutdown_rx).await;
        }
    }

    /// Demand-driven wall-clock cycle loop with channel-based shutdown.
    async fn start_wall_clock_channel(&mut self, mut shutdown_rx: tokio::sync::oneshot::Receiver<()>) {
        let max_cycle_ms = self.config.cycle_duration_ms;
        let min_gap_ms = self.config.min_cycle_gap_ms;
        let issuer_id_hex = self.format_issuer_id();

        let mut cycle_number = Self::unix_timestamp_ms() / max_cycle_ms;
        self.state.set_cycle_and_phase(cycle_number, CyclePhase::SignSubmit);
        self.state.set_trigger(CycleTrigger::Heartbeat);
        let _ = self.state_tx.send(self.state.clone());

        info!(
            cycle_number,
            issuer_id = %issuer_id_hex,
            heartbeat_ms = max_cycle_ms,
            min_gap_ms,
            demand_driven = self.work_rx.is_some(),
            timestamp = %Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
            "CycleManager starting (demand-driven wall-clock, channel shutdown)"
        );

        loop {
            let now_ms = Self::unix_timestamp_ms();
            let next_heartbeat_ms = ((now_ms / max_cycle_ms) + 1) * max_cycle_ms;
            let sleep_until_heartbeat = next_heartbeat_ms.saturating_sub(now_ms).max(1);

            // Wait for: shutdown, heartbeat timer, or work signal
            let trigger = tokio::select! {
                _ = &mut shutdown_rx => {
                    info!(
                        cycle_number = self.state.get_current_cycle(),
                        issuer_id = %issuer_id_hex,
                        "CycleManager received shutdown signal"
                    );
                    break;
                }
                result = async {
                    if let Some(ref mut work_rx) = self.work_rx {
                        work_rx.recv().await
                    } else {
                        // No work channel → never resolves (heartbeat only)
                        std::future::pending::<Option<bool>>().await
                    }
                } => {
                    match result {
                        Some(true) => {
                            tokio::time::sleep(Duration::from_millis(min_gap_ms)).await;
                            CycleTrigger::WorkDriven
                        }
                        Some(false) | None => continue,
                    }
                }
                _ = tokio::time::sleep(Duration::from_millis(sleep_until_heartbeat)) => {
                    CycleTrigger::Heartbeat
                }
            };

            cycle_number += 1;
            if matches!(trigger, CycleTrigger::Heartbeat) {
                cycle_number = Self::unix_timestamp_ms() / max_cycle_ms;
            }

            self.state.set_cycle_and_phase(cycle_number, CyclePhase::SignSubmit);
            self.state.set_trigger(trigger);

            info!(
                cycle = cycle_number,
                trigger = ?trigger,
                issuer_id = %issuer_id_hex,
                "Cycle advanced"
            );

            for callback in &self.phase_callbacks {
                callback(CyclePhase::SignSubmit, cycle_number);
            }

            let _ = self.state_tx.send(self.state.clone());
        }
    }

    /// Interval-based cycle loop with channel-based shutdown (legacy).
    async fn start_interval_channel(&mut self, mut shutdown_rx: tokio::sync::oneshot::Receiver<()>) {
        let phase_duration = Duration::from_millis(self.config.phase_duration_ms());
        let mut phase_interval = interval(phase_duration);
        let issuer_id_hex = self.format_issuer_id();

        info!(
            cycle_number = self.state.get_current_cycle(),
            issuer_id = %issuer_id_hex,
            cycle_duration_ms = self.config.cycle_duration_ms,
            phase_duration_ms = self.config.phase_duration_ms(),
            timestamp = %Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
            "CycleManager starting (interval mode)"
        );

        loop {
            tokio::select! {
                _ = phase_interval.tick() => {
                    self.advance_phase();

                    // Check timing synchronization at cycle start
                    if self.state.get_cycle_phase().is_cycle_start() {
                        if let Some(drift) = self.get_timing_drift_ms() {
                            let tolerance = self.config.timing_tolerance_ms as i64;
                            if drift.abs() > tolerance / 2 {
                                warn!(
                                    code = "INFRA-001",
                                    cycle_number = self.state.get_current_cycle(),
                                    issuer_id = %issuer_id_hex,
                                    drift_ms = drift,
                                    tolerance_ms = tolerance,
                                    "Timing drift approaching tolerance limit"
                                );
                            }
                        }
                    }
                }
                _ = &mut shutdown_rx => {
                    info!(
                        cycle_number = self.state.get_current_cycle(),
                        phase = %self.state.get_cycle_phase(),
                        issuer_id = %issuer_id_hex,
                        "CycleManager received shutdown signal"
                    );
                    break;
                }
            }
        }
    }
}
