//! Curator service for Index L3
//!
//! Unified service running concurrent tasks:
//! - **Oracle Collector**: BLS-signed NAV price collection and on-chain push
//! - **Allocation Bot**: Crisis-aware vault rebalancing across ITP markets
//! - **Health Monitor**: Position HF scanning, oracle freshness, crisis detection
//! - **Quote API**: Intent-based lending via off-chain rate computation + bundler calldata
//! - **Liquidation Bot**: Self-funding liquidation with Index.sol sell flow
//! - **Rate Pusher**: SERM-computed rates pushed to CuratorRateIRM
//! - **Alerting**: Crisis transition notifications via Telegram

pub mod alerting;
pub mod allocator;
pub mod collector;
pub mod config;
pub mod data_node_client;
pub mod health_monitor;
pub mod liquidator;
pub mod market_config;
pub mod market_deployer;
pub mod quote;
pub mod quote_server;
pub mod rate_pusher;
pub mod serm;
pub mod shared_state;
pub mod tier_config;
