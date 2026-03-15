//! Leader election module for Index L3 Issuer Node
//!
//! Provides deterministic leader election based on the previous cycle's BLS signature.
//! Formula: `leader_index = keccak256(last_bls_signature) mod num_issuers`
//!
//! All issuers compute the same leader from the same inputs, ensuring consensus
//! on who coordinates each cycle.

mod election;

pub use election::{elect_leader, CycleLeaderState, LeaderElector, LeaderElectorError};
