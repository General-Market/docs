//! Heartbeat monitoring for oracle node health tracking
//!
//! This module provides heartbeat-based peer health monitoring per architecture Section 4:
//!
//! - **HEARTBEAT messages** sent every 1 second to all peers
//! - **Health tracking** with 5 second unhealthy threshold
//! - **Kick vote proposals** after 3 consecutive misses (not auto-executed)
//! - **Health metrics** exposed for monitoring dashboard
//!
//! # Architecture
//!
//! ```text
//! HeartbeatMonitor
//!   ├── Heartbeat Sender (every 1s)
//!   │   └── Broadcasts P2PMessage::Heartbeat to all peers
//!   │
//!   ├── Health Checker (every 1s, offset 500ms)
//!   │   ├── Updates PeerHealthTracker
//!   │   ├── Detects unhealthy peers (5s threshold)
//!   │   └── Proposes kick votes (3 consecutive misses)
//!   │
//!   └── HeartbeatMetrics
//!       └── Exposes counters for health endpoint
//! ```
//!
//! # Safety
//!
//! Kick votes are **NOT auto-executed**. They are:
//! 1. Logged at WARN level
//! 2. Stored in `kick_proposals` for admin review
//! 3. Require explicit admin action to broadcast
//!
//! This prevents accidental network splits from transient connectivity issues.

mod metrics;
mod monitor;
mod tracker;
mod types;

pub use metrics::HeartbeatMetrics;
pub use monitor::HeartbeatMonitor;
pub use tracker::PeerHealthTracker;
pub use types::{
    KickVoteProposal, PeerHealthInfo, PeerHealthStatus,
    HEARTBEAT_INTERVAL, KICK_VOTE_THRESHOLD, UNHEALTHY_THRESHOLD,
};
