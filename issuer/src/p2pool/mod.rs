//! P2Pool prediction market module
//!
//! Implements the peer-to-peer prediction market system (Vision P2Pool).
//! This module handles batch management, bitmap storage, tick settlement,
//! and player balance tracking.

pub mod api;
pub mod bitmap_store;
pub mod chain_listener;
pub mod config;
pub mod engine;
pub mod multiplier;
pub mod resolver;
pub mod side_matching;
pub mod tick_scheduler;
pub mod types;
