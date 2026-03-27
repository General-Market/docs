//! Vision prediction market module
//!
//! Implements the round-based prediction market system (Vision).
//! Each batch is one round: direct USDC in, direct USDC out.

pub mod api;
pub mod batch_config_orchestrator;
pub mod bitmap_store;
pub mod chain_listener;
pub mod config;
pub mod epoch_points;
pub mod lifecycle;
pub mod resolver;
pub mod settle_signer;
pub mod shared;
pub mod side_matching;
pub mod tick_scheduler;
pub mod settlement;
pub mod types;
