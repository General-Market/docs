//! HackerNews story score data source
//!
//! Fetches top stories from HackerNews Firebase API.
//! - Stories: Top 50 by rank with score, author, comment count
//! - No API key required (public Firebase API)
//! - Rate limit: 30 requests/minute (polite usage)

mod client;

pub use client::HackerNewsSource;
