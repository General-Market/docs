//! Twitch viewer count data source
//!
//! Fetches top live streams from Twitch Helix API.
//! - Streams: Top 100 by viewer count with game/category info
//! - Requires OAuth client credentials (Client-ID + Bearer token)
//! - Rate limit: 800 req/min allowed, conservative at 30 req/min

mod client;

pub use client::TwitchSource;
