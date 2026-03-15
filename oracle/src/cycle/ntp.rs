//! NTP time synchronization for cycle manager.
//!
//! Implements SNTP (Simple Network Time Protocol) queries to detect clock drift
//! between oracle nodes. Uses raw UDP sockets with the NTP v4 packet format.
//!
//! Architecture Section 7: "Method: Wall Clock + NTP (off-chain), Tolerance: ±200ms"

use std::net::UdpSocket;
use std::sync::{Arc, RwLock};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::time::interval;
use tracing::{debug, info, warn};

/// NTP epoch starts at 1900-01-01, Unix at 1970-01-01.
/// Difference in seconds: 70 years worth.
const NTP_UNIX_OFFSET: u64 = 2_208_988_800;

/// NTP packet size in bytes.
const NTP_PACKET_SIZE: usize = 48;

/// Default NTP server.
const DEFAULT_NTP_SERVER: &str = "pool.ntp.org";

/// Default NTP port.
const DEFAULT_NTP_PORT: u16 = 123;

/// Default re-sync interval in seconds.
const DEFAULT_RESYNC_INTERVAL_SECS: u64 = 60;

/// Default tolerance in milliseconds.
const DEFAULT_TOLERANCE_MS: u64 = 200;

/// NTP synchronization state shared between the periodic task and the cycle manager.
#[derive(Debug, Clone)]
pub struct NtpSyncState {
    /// The NTP-derived reference time at the moment of last query.
    pub reference_time: Option<SystemTime>,
    /// Measured drift in milliseconds (positive = local clock ahead).
    pub drift_ms: Option<i64>,
    /// Whether sync is considered healthy (drift within tolerance).
    pub synchronized: bool,
    /// Last successful query timestamp.
    pub last_query: Option<SystemTime>,
}

impl Default for NtpSyncState {
    fn default() -> Self {
        Self {
            reference_time: None,
            drift_ms: None,
            synchronized: true, // Assume synced until proven otherwise
            last_query: None,
        }
    }
}

/// NTP synchronization manager.
///
/// Periodically queries an NTP server and maintains a shared sync state
/// that the cycle manager reads to determine if timing is accurate.
pub struct NtpSync {
    /// NTP server address (hostname:port).
    server: String,
    /// Tolerance in milliseconds.
    tolerance_ms: u64,
    /// Re-sync interval.
    resync_interval: Duration,
    /// Shared state accessible by cycle manager.
    state: Arc<RwLock<NtpSyncState>>,
}

impl NtpSync {
    /// Create a new NTP sync manager with the given server.
    pub fn new(server: &str, tolerance_ms: u64, resync_interval_secs: u64) -> Self {
        let server_with_port = if server.contains(':') {
            server.to_string()
        } else {
            format!("{}:{}", server, DEFAULT_NTP_PORT)
        };

        Self {
            server: server_with_port,
            tolerance_ms,
            resync_interval: Duration::from_secs(resync_interval_secs),
            state: Arc::new(RwLock::new(NtpSyncState::default())),
        }
    }

    /// Create with default settings.
    pub fn with_defaults() -> Self {
        Self::new(DEFAULT_NTP_SERVER, DEFAULT_TOLERANCE_MS, DEFAULT_RESYNC_INTERVAL_SECS)
    }

    /// Get a clone of the shared state handle for the cycle manager to read.
    pub fn state(&self) -> Arc<RwLock<NtpSyncState>> {
        Arc::clone(&self.state)
    }

    /// Query NTP server once and return the drift in milliseconds.
    ///
    /// Returns `Ok(drift_ms)` where positive means local clock is ahead.
    /// Returns `Err` if the query fails.
    pub fn query_once(server: &str) -> Result<i64, String> {
        let socket = UdpSocket::bind("0.0.0.0:0")
            .map_err(|e| format!("Failed to bind UDP socket: {}", e))?;
        socket
            .set_read_timeout(Some(Duration::from_secs(5)))
            .map_err(|e| format!("Failed to set timeout: {}", e))?;

        // Build NTP request packet (mode 3 = client, version 4)
        let mut packet = [0u8; NTP_PACKET_SIZE];
        packet[0] = 0x23; // LI=0, VN=4, Mode=3 (client)

        // Record local transmit time
        let local_tx = SystemTime::now();
        let local_tx_unix = local_tx
            .duration_since(UNIX_EPOCH)
            .map_err(|e| format!("System time error: {}", e))?;

        // Set transmit timestamp (bytes 40-47)
        let ntp_secs = local_tx_unix.as_secs() + NTP_UNIX_OFFSET;
        let ntp_frac = ((local_tx_unix.subsec_nanos() as u64) << 32) / 1_000_000_000;
        packet[40..44].copy_from_slice(&(ntp_secs as u32).to_be_bytes());
        packet[44..48].copy_from_slice(&(ntp_frac as u32).to_be_bytes());

        socket
            .send_to(&packet, server)
            .map_err(|e| format!("Failed to send NTP request to {}: {}", server, e))?;

        let mut response = [0u8; NTP_PACKET_SIZE];
        socket
            .recv_from(&mut response)
            .map_err(|e| format!("Failed to receive NTP response: {}", e))?;

        let local_rx = SystemTime::now();

        // Extract server transmit timestamp (bytes 40-47 of response)
        let server_secs = u32::from_be_bytes([response[40], response[41], response[42], response[43]]) as u64;
        let server_frac = u32::from_be_bytes([response[44], response[45], response[46], response[47]]) as u64;

        // Convert NTP timestamp to Unix timestamp
        if server_secs < NTP_UNIX_OFFSET {
            return Err("Invalid NTP response: timestamp before Unix epoch".into());
        }
        let server_unix_secs = server_secs - NTP_UNIX_OFFSET;
        let server_unix_nanos = (server_frac * 1_000_000_000) >> 32;

        let server_time = UNIX_EPOCH + Duration::new(server_unix_secs, server_unix_nanos as u32);

        // Calculate drift: (local_rx + local_tx) / 2 - server_transmit
        // Simplified offset calculation
        let local_midpoint = local_tx + (local_rx.duration_since(local_tx).unwrap_or_default() / 2);

        let drift = match local_midpoint.duration_since(server_time) {
            Ok(d) => d.as_millis() as i64,
            Err(e) => -(e.duration().as_millis() as i64),
        };

        Ok(drift)
    }

    /// Perform initial NTP query on startup.
    ///
    /// Updates the shared state. If query fails, logs a warning but does not
    /// block startup (graceful degradation).
    pub fn initial_sync(&self) {
        match Self::query_once(&self.server) {
            Ok(drift_ms) => {
                let synchronized = (drift_ms.unsigned_abs()) <= self.tolerance_ms;
                let now = SystemTime::now();

                if let Ok(mut state) = self.state.write() {
                    state.reference_time = Some(now);
                    state.drift_ms = Some(drift_ms);
                    state.synchronized = synchronized;
                    state.last_query = Some(now);
                }

                if synchronized {
                    info!(
                        drift_ms = drift_ms,
                        tolerance_ms = self.tolerance_ms,
                        server = %self.server,
                        "NTP sync successful"
                    );
                } else {
                    warn!(
                        code = "INFRA-002",
                        drift_ms = drift_ms,
                        tolerance_ms = self.tolerance_ms,
                        server = %self.server,
                        "NTP drift exceeds tolerance — delaying cycle participation until sync"
                    );
                }
            }
            Err(e) => {
                warn!(
                    code = "INFRA-003",
                    error = %e,
                    server = %self.server,
                    "NTP query failed on startup — using system clock (graceful degradation)"
                );
                // Leave state as default (synchronized = true, graceful degradation)
            }
        }
    }

    /// Start the periodic NTP re-sync task.
    ///
    /// Spawns a tokio task that queries NTP every `resync_interval` seconds
    /// and updates the shared state.
    pub fn start_periodic(self) -> tokio::task::JoinHandle<()> {
        let state = Arc::clone(&self.state);
        let server = self.server.clone();
        let tolerance_ms = self.tolerance_ms;
        let resync_interval = self.resync_interval;

        tokio::spawn(async move {
            let mut tick = interval(resync_interval);

            loop {
                tick.tick().await;

                // Run NTP query in a blocking thread to avoid blocking the async runtime
                let server_clone = server.clone();
                let result = tokio::task::spawn_blocking(move || {
                    Self::query_once(&server_clone)
                })
                .await;

                match result {
                    Ok(Ok(drift_ms)) => {
                        let synchronized = (drift_ms.unsigned_abs()) <= tolerance_ms;
                        let now = SystemTime::now();

                        if let Ok(mut s) = state.write() {
                            s.reference_time = Some(now);
                            s.drift_ms = Some(drift_ms);
                            s.synchronized = synchronized;
                            s.last_query = Some(now);
                        }

                        if !synchronized {
                            warn!(
                                code = "INFRA-002",
                                drift_ms = drift_ms,
                                tolerance_ms = tolerance_ms,
                                "NTP re-sync: drift exceeds tolerance"
                            );
                        } else {
                            debug!(drift_ms = drift_ms, "NTP re-sync: within tolerance");
                        }
                    }
                    Ok(Err(e)) => {
                        warn!(
                            code = "INFRA-003",
                            error = %e,
                            "NTP re-sync query failed — keeping previous state"
                        );
                    }
                    Err(e) => {
                        warn!(
                            code = "INFRA-003",
                            error = %e,
                            "NTP re-sync task panicked"
                        );
                    }
                }
            }
        })
    }

    /// Check if currently synchronized (reads shared state).
    pub fn is_synchronized(&self) -> bool {
        self.state
            .read()
            .map(|s| s.synchronized)
            .unwrap_or(true)
    }

    /// Get current drift in milliseconds (reads shared state).
    pub fn get_drift_ms(&self) -> Option<i64> {
        self.state.read().ok().and_then(|s| s.drift_ms)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ntp_sync_default_state() {
        let state = NtpSyncState::default();
        assert!(state.synchronized);
        assert!(state.reference_time.is_none());
        assert!(state.drift_ms.is_none());
        assert!(state.last_query.is_none());
    }

    #[test]
    fn test_ntp_sync_creation() {
        let sync = NtpSync::new("pool.ntp.org", 200, 60);
        assert!(sync.is_synchronized());
        assert_eq!(sync.get_drift_ms(), None);
    }

    #[test]
    fn test_ntp_sync_with_defaults() {
        let sync = NtpSync::with_defaults();
        assert!(sync.is_synchronized());
    }

    #[test]
    fn test_ntp_sync_state_shared() {
        let sync = NtpSync::new("pool.ntp.org", 200, 60);
        let state = sync.state();

        // Update state
        {
            let mut s = state.write().unwrap();
            s.drift_ms = Some(50);
            s.synchronized = true;
        }

        // Read back
        assert_eq!(sync.get_drift_ms(), Some(50));
        assert!(sync.is_synchronized());
    }

    #[test]
    fn test_ntp_sync_drift_exceeds_tolerance() {
        let sync = NtpSync::new("pool.ntp.org", 200, 60);
        let state = sync.state();

        // Simulate high drift
        {
            let mut s = state.write().unwrap();
            s.drift_ms = Some(500);
            s.synchronized = false;
        }

        assert_eq!(sync.get_drift_ms(), Some(500));
        assert!(!sync.is_synchronized());
    }

    #[test]
    fn test_ntp_sync_graceful_degradation() {
        // Query a non-existent server — should fail but not panic
        let result = NtpSync::query_once("192.0.2.1:123"); // RFC 5737 TEST-NET
        // Should be an error (timeout or connection refused)
        assert!(result.is_err());
    }

    #[test]
    fn test_ntp_sync_server_with_port() {
        let sync = NtpSync::new("ntp.example.com:8123", 200, 60);
        assert_eq!(sync.server, "ntp.example.com:8123");
    }

    #[test]
    fn test_ntp_sync_server_without_port() {
        let sync = NtpSync::new("pool.ntp.org", 200, 60);
        assert_eq!(sync.server, "pool.ntp.org:123");
    }
}
