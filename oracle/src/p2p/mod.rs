//! P2P transport module for oracle nodes
//!
//! Implements TCP + TLS + MessagePack based peer-to-peer communication
//! between oracle nodes for consensus coordination.
//!
//! # Architecture
//!
//! - **Transport**: TCP with optional TLS (mutual authentication)
//! - **Serialization**: MessagePack with length-prefixed framing
//! - **Reconnection**: Exponential backoff (100ms initial, 5s max)
//!
//! # Components
//!
//! - [`TcpP2PTransport`] - Production implementation of [`P2PTransport`] trait
//! - [`PeerConnection`] - Individual peer connection management
//! - [`codec`] - MessagePack serialization with length-prefixed framing
//! - [`tls`] - TLS configuration for mutual authentication
//! - [`discovery`] - Peer discovery mechanisms

mod codec;
mod connection;
mod discovery;
pub mod equivocation;
pub mod metrics;
pub mod peer_scoring;
pub mod rate_limit;
mod tls;
mod transport;
pub mod wal;

pub use codec::{decode, encode, Codec};
pub use connection::{ConnectionStatus, PeerConnection, ReconnectRequest};
pub use discovery::{OnChainPeerDiscovery, PeerDiscovery, PeerDiscoveryRunner, StaticPeerDiscovery};
pub use metrics::{P2PMetrics, P2PMetricsSnapshot};
pub use peer_scoring::PeerScorer;
pub use tls::{P2PStream, TlsConfig};
pub use transport::TcpP2PTransport;
