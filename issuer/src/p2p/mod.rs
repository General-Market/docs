//! P2P transport module for issuer nodes
//!
//! Implements TCP + TLS + MessagePack based peer-to-peer communication
//! between issuer nodes for consensus coordination.
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
mod tls;
mod transport;

pub use codec::{decode, encode, Codec};
pub use connection::{ConnectionStatus, PeerConnection};
pub use discovery::{OnChainPeerDiscovery, PeerDiscovery, PeerDiscoveryRunner, StaticPeerDiscovery};
pub use tls::TlsConfig;
pub use transport::TcpP2PTransport;
