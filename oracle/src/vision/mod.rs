//! Vision prediction market module
//!
//! Implements the peer-to-peer prediction market system (Vision).
//! This module handles batch management, bitmap storage, tick settlement,
//! player balance tracking, and cross-chain deposit/withdraw orchestration.

pub mod api;
pub mod batch_config_orchestrator;
pub mod bitmap_store;
pub mod chain_listener;
pub mod config;
pub mod config_cache;
pub mod deposit_watcher;
pub mod engine;
pub mod pending_ops;
pub mod resolver;
pub mod settle_signer;
pub mod side_matching;
pub mod tick_consensus;
pub mod tick_scheduler;
pub mod settlement;
pub mod types;
