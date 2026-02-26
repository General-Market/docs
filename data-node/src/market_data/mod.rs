//! Market data provider framework (ported from AA market-data-lib)

pub mod broadcast;
pub mod error_tracker;
pub mod models;
pub mod queries;
pub mod rate_limiter;
pub mod scheduled_sync_engine;
pub mod sources;
pub mod sync_engine;
pub mod sync_registry;
pub mod traits;

pub use models::{MarketAsset, MarketPriceRecord, MarketPriceSummary, MarketSyncStats};
pub use rate_limiter::{RateLimitConfig, RateWindow, SlidingWindowRateLimiter};
pub use scheduled_sync_engine::ScheduledSyncEngine;
pub use sync_engine::SyncEngine;
pub use traits::{AssetUpdate, MarketDataSource, PriceUpdate, ScheduledMarketDataSource};
