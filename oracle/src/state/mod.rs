//! State module for Index L3 Issuer
//!
//! Provides state reconstruction and management for issuer nodes.
//! Implements the stateless design pattern (NFR19) where nodes reconstruct
//! their state from on-chain data on startup.
//!
//! # Components
//!
//! - [`types`]: State types including `IssuerState`, `ITPState`, and `Checkpoint`
//! - [`reconstruction`]: `StateReconstructor` for rebuilding state from chain
//!
//! # Usage
//!
//! ```ignore
//! use issuer::state::{StateReconstructor, ReconstructorConfig, IssuerState};
//!
//! let config = ReconstructorConfig {
//!     rpc_url: "http://localhost:8545".to_string(),
//!     index_contract: index_address,
//!     ..Default::default()
//! };
//!
//! let reconstructor = StateReconstructor::new(config)?;
//! let (state, stats) = reconstructor.reconstruct_state().await?;
//! ```

pub mod reconstruction;
pub mod types;

pub use reconstruction::{ReconstructionStats, ReconstructorConfig, StateReconstructor};
pub use types::{chains, Checkpoint, ITPState, IssuerState};
