//! P2P subsystem metrics — atomic counters exposed via `/health`.
//!
//! [`P2PMetrics`] holds lock-free atomic counters that are incremented by the
//! rate-limiter, connection guard, WAL, peer scorer, equivocation detector, and
//! leader verifier.  [`P2PMetricsSnapshot`] is a `Serialize`-able point-in-time
//! copy surfaced in the health JSON under the `"p2p"` key.

use serde::Serialize;
use std::sync::atomic::{AtomicU64, Ordering};

/// Lock-free P2P counters.
///
/// All fields use `Relaxed` ordering — we only need eventual visibility for
/// diagnostics, not cross-field consistency.
#[derive(Debug, Default)]
pub struct P2PMetrics {
    /// Total messages received across all peer connections.
    pub messages_received: AtomicU64,
    /// Total messages sent across all peer connections.
    pub messages_sent: AtomicU64,
    /// Messages dropped due to per-peer token-bucket rate limiting (INFRA-020).
    pub rate_limited_total: AtomicU64,
    /// Messages that failed MessagePack decode.
    pub decode_failures_total: AtomicU64,
    /// Peers banned by the peer scorer (INFRA-023).
    pub peers_banned_total: AtomicU64,
    /// Equivocation events detected (CONSENSUS-021).
    pub equivocations_detected: AtomicU64,
    /// WAL entries successfully written (INFRA-022).
    pub wal_entries_written: AtomicU64,
    /// WAL replay operations completed on startup.
    pub wal_replays: AtomicU64,
    /// Proposals rejected because sender was not the elected leader (CONSENSUS-020).
    pub leader_rejections: AtomicU64,
    /// Inbound connections rejected (per-IP limit, INFRA-021).
    pub connection_rejections: AtomicU64,
}

/// Serializable point-in-time snapshot of [`P2PMetrics`].
#[derive(Debug, Serialize)]
pub struct P2PMetricsSnapshot {
    pub messages_received: u64,
    pub messages_sent: u64,
    pub rate_limited_total: u64,
    pub decode_failures_total: u64,
    pub peers_banned_total: u64,
    pub equivocations_detected: u64,
    pub wal_entries_written: u64,
    pub wal_replays: u64,
    pub leader_rejections: u64,
    pub connection_rejections: u64,
}

impl P2PMetrics {
    /// Take a consistent-enough snapshot for the health endpoint.
    pub fn snapshot(&self) -> P2PMetricsSnapshot {
        P2PMetricsSnapshot {
            messages_received: self.messages_received.load(Ordering::Relaxed),
            messages_sent: self.messages_sent.load(Ordering::Relaxed),
            rate_limited_total: self.rate_limited_total.load(Ordering::Relaxed),
            decode_failures_total: self.decode_failures_total.load(Ordering::Relaxed),
            peers_banned_total: self.peers_banned_total.load(Ordering::Relaxed),
            equivocations_detected: self.equivocations_detected.load(Ordering::Relaxed),
            wal_entries_written: self.wal_entries_written.load(Ordering::Relaxed),
            wal_replays: self.wal_replays.load(Ordering::Relaxed),
            leader_rejections: self.leader_rejections.load(Ordering::Relaxed),
            connection_rejections: self.connection_rejections.load(Ordering::Relaxed),
        }
    }
}
