//! Shared OAuth2 token cache for sources using client-credentials grants.
//!
//! Eliminates the duplicated `CachedToken` + `get_token()` pattern
//! found in reddit, twitch, and finra clients.

use std::future::Future;
use std::time::{Duration, Instant};

use tokio::sync::Mutex;
use tracing::debug;

struct CachedToken {
    access_token: String,
    expires_at: Instant,
}

/// Thread-safe OAuth2 token cache with lazy refresh.
///
/// Holds the Mutex across the refresh call to prevent thundering-herd
/// concurrent token requests (same pattern reddit/twitch used).
pub struct OAuthTokenCache {
    token: Mutex<Option<CachedToken>>,
    /// Name for debug logging (e.g. "Reddit", "Twitch", "FINRA")
    name: &'static str,
}

impl OAuthTokenCache {
    pub fn new(name: &'static str) -> Self {
        Self {
            token: Mutex::new(None),
            name,
        }
    }

    /// Return cached token if still valid, otherwise call `refresh` to get a new one.
    ///
    /// `refresh` should return `(access_token, expires_in_secs)`.
    /// The token is cached with a 60-second safety buffer subtracted from `expires_in`.
    pub async fn get_or_refresh<F, Fut>(&self, refresh: F) -> anyhow::Result<String>
    where
        F: FnOnce() -> Fut,
        Fut: Future<Output = anyhow::Result<(String, u64)>>,
    {
        let mut guard = self.token.lock().await;

        // Return cached token if still valid (60s buffer)
        if let Some(ref cached) = *guard {
            if cached.expires_at > Instant::now() + Duration::from_secs(60) {
                return Ok(cached.access_token.clone());
            }
        }

        let (access_token, expires_in) = refresh().await?;
        let expires_at = Instant::now() + Duration::from_secs(expires_in.saturating_sub(120));

        debug!("{} access token refreshed, expires in {}s", self.name, expires_in);

        *guard = Some(CachedToken {
            access_token: access_token.clone(),
            expires_at,
        });

        Ok(access_token)
    }

    /// Clear the cached token (e.g., on 401 response).
    pub async fn invalidate(&self) {
        let mut guard = self.token.lock().await;
        *guard = None;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_caches_token() {
        let cache = OAuthTokenCache::new("test");

        let token = cache
            .get_or_refresh(|| async { Ok(("tok123".to_string(), 3600)) })
            .await
            .unwrap();
        assert_eq!(token, "tok123");

        // Second call should return cached value without calling refresh
        let token2 = cache
            .get_or_refresh(|| async { Ok(("tok456".to_string(), 3600)) })
            .await
            .unwrap();
        assert_eq!(token2, "tok123"); // still the cached one
    }

    #[tokio::test]
    async fn test_invalidate_clears_cache() {
        let cache = OAuthTokenCache::new("test");

        cache
            .get_or_refresh(|| async { Ok(("tok123".to_string(), 3600)) })
            .await
            .unwrap();

        cache.invalidate().await;

        let token = cache
            .get_or_refresh(|| async { Ok(("tok789".to_string(), 3600)) })
            .await
            .unwrap();
        assert_eq!(token, "tok789"); // got new one after invalidation
    }
}
