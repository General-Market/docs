//! Rate limiting utilities for external API integrations
//!
//! Provides thread-safe rate limiters using sliding window algorithms.

mod bitget;

pub use bitget::{
    BitgetRateLimiter, BitgetRateLimiterBuilder, EndpointType, RateLimiterConfig,
    RateLimiterMetrics, RateLimiterTier,
};
