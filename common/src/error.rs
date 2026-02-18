//! Infrastructure error types for Index L3
//!
//! These are system-level errors (chain, BLS, P2P, external services),
//! NOT protocol errors. Protocol errors (E001-E010) are in `errors.rs`.
//!
//! Infrastructure errors use the INFRA-XXX prefix to avoid collision
//! with protocol error codes (E001-E010) defined in ErrorsLib.sol and errors.rs.

use thiserror::Error;

/// Infrastructure error types for Index L3
///
/// Covers system-level failures: chain I/O, BLS crypto, P2P networking,
/// and external service integration. Protocol-level errors (E001-E010)
/// are defined separately in [`crate::errors::IndexError`].
#[derive(Debug, Error)]
pub enum Error {
    // Chain errors
    #[error("INFRA-001: Chain read error: {0}")]
    ChainRead(String),

    #[error("INFRA-002: Chain write error: {0}")]
    ChainWrite(String),

    #[error("INFRA-003: Transaction failed: {0}")]
    TransactionFailed(String),

    // BLS errors
    #[error("INFRA-004: BLS signing error: {0}")]
    BlsSigning(String),

    #[error("INFRA-005: BLS verification failed: {0}")]
    BlsVerification(String),

    #[error("INFRA-006: Signature aggregation failed: {0}")]
    SignatureAggregation(String),

    // P2P errors
    #[error("INFRA-007: P2P connection error: {0}")]
    P2PConnection(String),

    #[error("INFRA-008: P2P broadcast failed: {0}")]
    P2PBroadcast(String),

    #[error("INFRA-009: P2P message receive error: {0}")]
    P2PReceive(String),

    // AP errors
    #[error("INFRA-010: AP client error: {0}")]
    ApClient(String),

    // External service errors
    #[error("INFRA-011: Authentication error: {0}")]
    Authentication(String),

    #[error("INFRA-012: Rate limit exceeded: {0}")]
    RateLimit(String),

    #[error("INFRA-013: External service error: {0}")]
    ExternalService(String),

    // Generic errors
    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Invalid argument: {0}")]
    InvalidArgument(String),

    #[error("Serialization error: {0}")]
    Serialization(String),

    #[error("Timeout: {0}")]
    Timeout(String),

    #[error("INFRA-014: Netting pipeline error: {0}")]
    Netting(String),
}
