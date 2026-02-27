# Unified ExchangeMode Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Single `ExchangeMode` enum (Mock/Testnet/Mainnet) controlling all Bitget integration points across AP, issuer, and AssetTradeRequest pipeline — with clean switching between mock and real Bitget.

**Architecture:** `ExchangeMode` lives in `common/src/types/` and is resolved once at startup from CLI/env/config. Each component (AP, issuer) reads the mode and constructs the appropriate client implementation. The AP's `AssetTradeRequest` handler routes to MockBitgetVault in Mock mode or real Bitget CEX in Testnet/Mainnet mode. The AP's BitgetClient is upgraded from v1 to v2 API for consistency with the issuer.

**Tech Stack:** Rust, async-trait, ethers, reqwest, clap, serde, HMAC-SHA256 signing

---

### Task 1: Add ExchangeMode Enum to Common Types

**Files:**
- Create: `common/src/types/exchange_mode.rs`
- Modify: `common/src/types/mod.rs`

**Step 1: Create the ExchangeMode enum**

Create `common/src/types/exchange_mode.rs`:

```rust
//! Exchange mode for Bitget integration
//!
//! Controls whether components use mock, testnet, or mainnet Bitget clients.

use std::fmt;
use std::str::FromStr;

use serde::{Deserialize, Serialize};

/// Exchange mode controlling which Bitget client implementation is used.
///
/// Resolved once at startup from CLI/env/config. All components (AP, issuer)
/// read this to construct appropriate client instances.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ExchangeMode {
    /// In-memory fakes, no network, instant fills
    Mock,
    /// Real Bitget API with testnet keys
    Testnet,
    /// Real Bitget API with mainnet keys
    Mainnet,
}

impl ExchangeMode {
    /// Returns true if this mode requires real Bitget API credentials.
    pub fn requires_credentials(&self) -> bool {
        matches!(self, ExchangeMode::Testnet | ExchangeMode::Mainnet)
    }

    /// Returns true if this is the mock mode.
    pub fn is_mock(&self) -> bool {
        matches!(self, ExchangeMode::Mock)
    }

    /// Returns true if this is mainnet (real money).
    pub fn is_mainnet(&self) -> bool {
        matches!(self, ExchangeMode::Mainnet)
    }
}

impl Default for ExchangeMode {
    fn default() -> Self {
        ExchangeMode::Mock
    }
}

impl fmt::Display for ExchangeMode {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ExchangeMode::Mock => write!(f, "mock"),
            ExchangeMode::Testnet => write!(f, "testnet"),
            ExchangeMode::Mainnet => write!(f, "mainnet"),
        }
    }
}

impl FromStr for ExchangeMode {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "mock" => Ok(ExchangeMode::Mock),
            "testnet" => Ok(ExchangeMode::Testnet),
            "mainnet" => Ok(ExchangeMode::Mainnet),
            _ => Err(format!(
                "invalid exchange mode '{}': expected 'mock', 'testnet', or 'mainnet'",
                s
            )),
        }
    }
}

/// Resolve ExchangeMode from legacy flags for backward compatibility.
///
/// Priority: explicit exchange_mode > legacy flags > default (Mock)
pub fn resolve_exchange_mode(
    explicit_mode: Option<ExchangeMode>,
    mock_bitget: bool,
    bitget_testnet: Option<bool>,
    bitget_mainnet: bool,
    has_credentials: bool,
) -> ExchangeMode {
    // Explicit --exchange-mode takes priority
    if let Some(mode) = explicit_mode {
        return mode;
    }

    // Legacy flags
    if mock_bitget {
        return ExchangeMode::Mock;
    }

    if bitget_mainnet {
        return ExchangeMode::Mainnet;
    }

    // bitget_testnet=true OR has credentials without mock flag
    if bitget_testnet == Some(true) || has_credentials {
        return ExchangeMode::Testnet;
    }

    ExchangeMode::Mock
}
```

**Step 2: Register the module in mod.rs**

In `common/src/types/mod.rs`, add:
```rust
mod exchange_mode;
```
And add to the re-exports:
```rust
pub use exchange_mode::*;
```

**Step 3: Run existing tests to verify no regression**

Run: `cargo test -p common --lib types`
Expected: All pass, no new failures

**Step 4: Write tests for ExchangeMode**

Add to the bottom of `common/src/types/exchange_mode.rs`:
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_from_str() {
        assert_eq!("mock".parse::<ExchangeMode>().unwrap(), ExchangeMode::Mock);
        assert_eq!("testnet".parse::<ExchangeMode>().unwrap(), ExchangeMode::Testnet);
        assert_eq!("mainnet".parse::<ExchangeMode>().unwrap(), ExchangeMode::Mainnet);
        assert_eq!("MOCK".parse::<ExchangeMode>().unwrap(), ExchangeMode::Mock);
        assert!("invalid".parse::<ExchangeMode>().is_err());
    }

    #[test]
    fn test_display() {
        assert_eq!(ExchangeMode::Mock.to_string(), "mock");
        assert_eq!(ExchangeMode::Testnet.to_string(), "testnet");
        assert_eq!(ExchangeMode::Mainnet.to_string(), "mainnet");
    }

    #[test]
    fn test_requires_credentials() {
        assert!(!ExchangeMode::Mock.requires_credentials());
        assert!(ExchangeMode::Testnet.requires_credentials());
        assert!(ExchangeMode::Mainnet.requires_credentials());
    }

    #[test]
    fn test_default() {
        assert_eq!(ExchangeMode::default(), ExchangeMode::Mock);
    }

    #[test]
    fn test_resolve_explicit_wins() {
        let mode = resolve_exchange_mode(Some(ExchangeMode::Mainnet), true, None, false, false);
        assert_eq!(mode, ExchangeMode::Mainnet);
    }

    #[test]
    fn test_resolve_mock_flag() {
        let mode = resolve_exchange_mode(None, true, None, false, true);
        assert_eq!(mode, ExchangeMode::Mock);
    }

    #[test]
    fn test_resolve_mainnet_flag() {
        let mode = resolve_exchange_mode(None, false, None, true, true);
        assert_eq!(mode, ExchangeMode::Mainnet);
    }

    #[test]
    fn test_resolve_testnet_flag() {
        let mode = resolve_exchange_mode(None, false, Some(true), false, true);
        assert_eq!(mode, ExchangeMode::Testnet);
    }

    #[test]
    fn test_resolve_credentials_implies_testnet() {
        let mode = resolve_exchange_mode(None, false, None, false, true);
        assert_eq!(mode, ExchangeMode::Testnet);
    }

    #[test]
    fn test_resolve_no_flags_no_creds() {
        let mode = resolve_exchange_mode(None, false, None, false, false);
        assert_eq!(mode, ExchangeMode::Mock);
    }
}
```

**Step 5: Run tests**

Run: `cargo test -p common --lib types::exchange_mode`
Expected: All 8 tests pass

**Step 6: Commit**

```bash
git add common/src/types/exchange_mode.rs common/src/types/mod.rs
git commit -m "feat(common): add ExchangeMode enum (Mock/Testnet/Mainnet)"
```

---

### Task 2: Add MockBitgetReadOnlyClient

**Files:**
- Create: `common/src/mocks/bitget_read_only.rs`
- Modify: `common/src/mocks/mod.rs`

**Step 1: Create the mock client**

Create `common/src/mocks/bitget_read_only.rs`:

```rust
//! MockBitgetReadOnlyClient for local development without Bitget API access
//!
//! Implements BitgetReadOnlyClient with configurable in-memory ticker data.
//! Used by the issuer in ExchangeMode::Mock.

use std::collections::HashMap;
use std::sync::Arc;

use async_trait::async_trait;
use tokio::sync::RwLock;

use crate::error::Error;
use crate::traits::{BitgetFill, BitgetOrderInfo, BitgetOrderbook, BitgetReadOnlyClient, BitgetTicker};

/// In-memory mock implementation of BitgetReadOnlyClient.
///
/// Stores configurable tickers in a HashMap. For local dev and tests
/// when real Bitget API access is not available.
#[derive(Clone)]
pub struct MockBitgetReadOnlyClient {
    tickers: Arc<RwLock<HashMap<String, BitgetTicker>>>,
}

impl MockBitgetReadOnlyClient {
    /// Create a new empty mock client.
    pub fn new() -> Self {
        Self {
            tickers: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Add a ticker with a given price (bid = ask = last = price_str).
    pub async fn set_ticker(&self, symbol: &str, price_str: &str) {
        let ticker = BitgetTicker {
            symbol: symbol.to_string(),
            best_bid: price_str.to_string(),
            best_ask: price_str.to_string(),
            last_price: price_str.to_string(),
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis() as u64,
            bid_size: "1000".to_string(),
            ask_size: "1000".to_string(),
            usdt_volume: "10000000".to_string(),
        };
        self.tickers.write().await.insert(symbol.to_string(), ticker);
    }

    /// Bulk-load tickers from a HashMap of symbol -> price string.
    pub async fn load_tickers(&self, data: HashMap<String, String>) {
        for (symbol, price) in data {
            self.set_ticker(&symbol, &price).await;
        }
    }
}

impl Default for MockBitgetReadOnlyClient {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl BitgetReadOnlyClient for MockBitgetReadOnlyClient {
    async fn get_order(&self, order_id: &str) -> Result<BitgetOrderInfo, Error> {
        Err(Error::NotFound(format!("Mock: order {} not found", order_id)))
    }

    async fn get_fills(&self, _symbol: &str, order_id: &str) -> Result<Vec<BitgetFill>, Error> {
        Err(Error::NotFound(format!("Mock: fills for order {} not found", order_id)))
    }

    async fn get_order_history(
        &self,
        _pair: &str,
        _since: u64,
        _limit: Option<u32>,
    ) -> Result<Vec<BitgetOrderInfo>, Error> {
        Ok(vec![])
    }

    async fn get_ticker(&self, pair: &str) -> Result<BitgetTicker, Error> {
        self.tickers
            .read()
            .await
            .get(pair)
            .cloned()
            .ok_or_else(|| Error::NotFound(format!("Mock: ticker not found for {}", pair)))
    }

    async fn get_all_tickers(&self) -> Result<Vec<BitgetTicker>, Error> {
        let tickers = self.tickers.read().await;
        Ok(tickers.values().cloned().collect())
    }

    async fn get_orderbook(&self, symbol: &str, _limit: u32) -> Result<BitgetOrderbook, Error> {
        let tickers = self.tickers.read().await;
        if let Some(ticker) = tickers.get(symbol) {
            let price: f64 = ticker.last_price.parse().unwrap_or(100.0);
            let spread = price * 0.001; // 0.1% spread
            Ok(BitgetOrderbook {
                asks: vec![(price + spread, 1000.0), (price + spread * 2.0, 2000.0)],
                bids: vec![(price - spread, 1000.0), (price - spread * 2.0, 2000.0)],
                timestamp: ticker.timestamp,
            })
        } else {
            Err(Error::NotFound(format!("Mock: orderbook not found for {}", symbol)))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_set_and_get_ticker() {
        let client = MockBitgetReadOnlyClient::new();
        client.set_ticker("BTCUSDT", "50000.0").await;

        let ticker = client.get_ticker("BTCUSDT").await.unwrap();
        assert_eq!(ticker.symbol, "BTCUSDT");
        assert_eq!(ticker.best_ask, "50000.0");
        assert_eq!(ticker.best_bid, "50000.0");
    }

    #[tokio::test]
    async fn test_ticker_not_found() {
        let client = MockBitgetReadOnlyClient::new();
        let result = client.get_ticker("NOPE").await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_get_all_tickers() {
        let client = MockBitgetReadOnlyClient::new();
        client.set_ticker("BTCUSDT", "50000.0").await;
        client.set_ticker("ETHUSDT", "3000.0").await;

        let tickers = client.get_all_tickers().await.unwrap();
        assert_eq!(tickers.len(), 2);
    }

    #[tokio::test]
    async fn test_get_orderbook() {
        let client = MockBitgetReadOnlyClient::new();
        client.set_ticker("BTCUSDT", "50000.0").await;

        let ob = client.get_orderbook("BTCUSDT", 5).await.unwrap();
        assert_eq!(ob.asks.len(), 2);
        assert_eq!(ob.bids.len(), 2);
        assert!(ob.asks[0].0 > ob.bids[0].0); // ask > bid
    }

    #[tokio::test]
    async fn test_order_and_fills_return_not_found() {
        let client = MockBitgetReadOnlyClient::new();
        assert!(client.get_order("123").await.is_err());
        assert!(client.get_fills("BTCUSDT", "123").await.is_err());
    }
}
```

**Step 2: Register in mocks/mod.rs**

Add to `common/src/mocks/mod.rs`:
```rust
mod bitget_read_only;
```
And to re-exports:
```rust
pub use bitget_read_only::*;
```

**Step 3: Run tests**

Run: `cargo test -p common --lib mocks::bitget_read_only`
Expected: All 5 tests pass

**Step 4: Commit**

```bash
git add common/src/mocks/bitget_read_only.rs common/src/mocks/mod.rs
git commit -m "feat(common): add MockBitgetReadOnlyClient for local dev"
```

---

### Task 3: Upgrade AP BitgetClient from v1 to v2 API

**Files:**
- Modify: `ap/src/external/bitget/client.rs` (endpoints + response types)
- Modify: `ap/src/external/bitget/types.rs` (v2 field name changes)

**Step 1: Update API paths in client.rs**

In `ap/src/external/bitget/client.rs`, change these three endpoint paths:

- `place_limit_order`: `/api/spot/v1/trade/orders` → `/api/v2/spot/trade/place-order`
- `get_order_detail`: `/api/spot/v1/trade/orderInfo?orderId={}` → `/api/v2/spot/trade/orderInfo?orderId={}`
- `get_order_fills`: `/api/spot/v1/trade/fills?orderId={}` → `/api/v2/spot/trade/fills?orderId={}`

**Step 2: Update response types in types.rs**

In `ap/src/external/bitget/types.rs`, the v2 API uses slightly different field names. Update `OrderDetailData`:

```rust
/// Response data for order detail query (v2 API)
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OrderDetailData {
    /// Bitget order ID
    pub order_id: String,
    /// Order status string (e.g., "new", "partial_fill", "full_fill", "cancelled")
    pub status: String,
    /// Filled quantity (v2: baseVolume)
    #[serde(default, alias = "fillQuantity")]
    pub base_volume: Option<String>,
    /// Average fill price (v2: priceAvg)
    #[serde(default, alias = "avgPrice")]
    pub price_avg: Option<String>,
}
```

Update `FillData` to accept v2 field names:
```rust
/// A single fill/trade record from Bitget (v2 API)
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FillData {
    /// Trade ID
    pub trade_id: String,
    /// Order ID
    pub order_id: String,
    /// Filled price
    pub price: String,
    /// Filled quantity (v2: "size" instead of "quantity")
    #[serde(alias = "quantity")]
    pub size: String,
    /// Trade side
    pub side: String,
}
```

Update `RateLimitedBitgetClient::get_fills` in `rate_limited.rs` to read `f.size` instead of `f.quantity`:
```rust
let parsed_qty: rust_decimal::Decimal = f.size.parse()
    .map_err(|e| Error::ApClient(format!("failed to parse fill size '{}': {}", f.size, e)))?;
```

Also update `RateLimitedBitgetClient::get_order_status` to use `detail.status` (no change needed — field name stays the same).

**Step 3: Update the doc comment at the top of types.rs**

Change the first line:
```rust
//! Bitget API request and response types
//!
//! These types match the Bitget Spot API v2 specification for order placement.
```

**Step 4: Run existing tests**

Run: `cargo test -p ap --lib external::bitget`
Expected: All pass (these are unit tests using mock responses, not network calls)

**Step 5: Commit**

```bash
git add ap/src/external/bitget/client.rs ap/src/external/bitget/types.rs ap/src/external/bitget/rate_limited.rs
git commit -m "feat(ap): upgrade BitgetClient from v1 to v2 Spot API"
```

---

### Task 4: Wire ExchangeMode into AP Config

**Files:**
- Modify: `ap/src/config.rs` — add `exchange_mode` field, deprecate `mock_bitget`/`bitget_testnet`
- Modify: `ap/src/main.rs` — resolve ExchangeMode at startup, replace branching logic

**Step 1: Add exchange_mode to APConfig**

In `ap/src/config.rs`, add to `APConfig` struct:
```rust
/// Exchange mode: mock, testnet, or mainnet
/// Supersedes mock_bitget and bitget_testnet flags.
pub exchange_mode: Option<String>,
```

Add env var parsing in `from_env()`:
```rust
exchange_mode: std::env::var("EXCHANGE_MODE").ok(),
```

Add merge for the new field in `merge()`.

Add `effective_exchange_mode()`:
```rust
/// Resolve the effective ExchangeMode using legacy flag compat.
pub fn effective_exchange_mode(&self) -> common::types::ExchangeMode {
    // Explicit exchange_mode takes priority
    if let Some(ref mode_str) = self.exchange_mode {
        if let Ok(mode) = mode_str.parse() {
            return mode;
        }
    }
    common::types::resolve_exchange_mode(
        None,
        self.effective_mock_bitget(),
        self.bitget_testnet,
        self.bitget_testnet == Some(false), // bitget_mainnet
        self.has_bitget_credentials(),
    )
}
```

**Step 2: Add --exchange-mode CLI arg**

In `ap/src/main.rs`, add to `Args` struct:
```rust
/// Exchange mode: mock, testnet, mainnet
/// Supersedes --mock-bitget and --bitget-testnet/--bitget-mainnet
#[arg(long, value_parser = ["mock", "testnet", "mainnet"])]
exchange_mode: Option<String>,
```

Wire it through ConfigBuilder.

**Step 3: Replace mock_bitget branching in run_ap()**

In `ap/src/main.rs` function `run_ap()`, replace the current:
```rust
let mock_bitget = config.effective_mock_bitget();
```
with:
```rust
let exchange_mode = config.effective_exchange_mode();
```

Replace the `if mock_bitget { ... } else { ... }` block for `ap_client` construction with:
```rust
let ap_client: Arc<dyn APClient> = match exchange_mode {
    ExchangeMode::Mock => {
        let mock_client = MockBitgetBuilder::new()
            .with_latency(Duration::from_millis(100))
            .with_fill_delay(Duration::from_millis(500))
            .build();
        info!("MockBitget initialized (APClient - mock mode)");
        Arc::new(mock_client)
    }
    ExchangeMode::Testnet | ExchangeMode::Mainnet => {
        if !config.has_bitget_credentials() {
            error!(code = "INFRA-011", mode = %exchange_mode,
                "Bitget credentials required. Set BITGET_API_KEY, BITGET_API_SECRET, BITGET_API_PASSPHRASE.");
            return Err(format!("{} mode requires API credentials", exchange_mode).into());
        }
        let bitget_config = if exchange_mode.is_mainnet() {
            BitgetConfig::mainnet()
        } else {
            BitgetConfig::testnet()
        };
        let env_label = exchange_mode.to_string();
        info!(environment = %env_label, "Initializing live Bitget client");
        let mut bitget_client = BitgetClient::new(bitget_config)
            .map_err(|e| format!("Failed to create Bitget client: {}", e))?;
        bitget_client.authenticate(
            config.bitget_api_key.as_deref().unwrap_or_default(),
            config.bitget_api_secret.as_deref().unwrap_or_default(),
            config.bitget_api_passphrase.as_deref().unwrap_or_default(),
        ).map_err(|e| format!("Failed to authenticate Bitget client: {}", e))?;
        let tier = if exchange_mode.is_mainnet() { RateLimiterTier::Mainnet } else { RateLimiterTier::Testnet };
        let rate_limiter = Arc::new(BitgetRateLimiter::from_tier(tier));
        let rate_limited_client = RateLimitedBitgetClient::new(bitget_client, rate_limiter);
        info!(environment = %env_label, "Live Bitget client initialized");
        Arc::new(rate_limited_client)
    }
};
```

**Step 4: Add mainnet safety warning**

After the `ap_client` construction:
```rust
if exchange_mode.is_mainnet() {
    warn!("========================================");
    warn!("  MAINNET MODE - REAL MONEY TRADING");
    warn!("========================================");
}
info!(exchange_mode = %exchange_mode, "Exchange mode active");
```

**Step 5: Update AssetTradeRequest handling**

In `process_events()`, the `AssetTradeRequest` handler currently always checks `if let Some(ref settlement) = settlement`. Change the logic so:
- `Mock` → uses `on_chain_settlement` (MockBitgetVault) as before
- `Testnet/Mainnet` → places order via `ap_client.place_order()` per asset, polls fills, reports metrics. Skip on-chain vault.

The `on_chain_settlement` should only be `Some(...)` when `exchange_mode.is_mock()`. Move the conditional from "always build if bitget_vault set" to "only build if Mock mode AND bitget_vault set".

**Step 6: Run tests**

Run: `cargo test -p ap`
Expected: All pass

**Step 7: Commit**

```bash
git add ap/src/config.rs ap/src/main.rs
git commit -m "feat(ap): wire ExchangeMode into AP config and event processing"
```

---

### Task 5: Wire ExchangeMode into Issuer

**Files:**
- Modify: `issuer/src/config.rs` — add `exchange_mode` field
- Modify: `issuer/src/bootstrap/price.rs` — use MockBitgetReadOnlyClient in Mock mode

**Step 1: Add exchange_mode to IssuerConfig**

In `issuer/src/config.rs`, add to `IssuerConfig`:
```rust
/// Exchange mode: mock, testnet, or mainnet (default: resolved from env/flags)
pub exchange_mode: Option<String>,
```

Add env var parsing and `effective_exchange_mode()` method:
```rust
pub fn effective_exchange_mode(&self) -> common::types::ExchangeMode {
    if let Some(ref mode_str) = self.exchange_mode {
        if let Ok(mode) = mode_str.parse() {
            return mode;
        }
    }
    // Check EXCHANGE_MODE env var
    if let Ok(mode_str) = std::env::var("EXCHANGE_MODE") {
        if let Ok(mode) = mode_str.parse() {
            return mode;
        }
    }
    // Default: Mock if no Bitget credentials, Testnet if credentials present
    let has_bitget = std::env::var("BITGET_READONLY_API_KEY").is_ok()
        && std::env::var("BITGET_READONLY_API_SECRET").is_ok()
        && std::env::var("BITGET_READONLY_PASSPHRASE").is_ok();
    if has_bitget {
        common::types::ExchangeMode::Testnet
    } else {
        common::types::ExchangeMode::Mock
    }
}
```

**Step 2: Update PriceBuilder to use ExchangeMode**

In `issuer/src/bootstrap/price.rs`, update `build_price_fetcher` to check ExchangeMode:

```rust
fn build_price_fetcher(&self, symbol_map: &SymbolMap) -> Result<Arc<dyn PriceFetcher>, BootstrapError> {
    // Check data-node backend first (overrides everything)
    let data_node_url = self.config.data_node_url.clone()
        .or_else(|| std::env::var("DATA_NODE_URL").ok());
    if let Some(url) = data_node_url {
        info!(self.node_id, url = %url, "Using BackendPriceFetcher (data-node backend)");
        let fetcher = BackendPriceFetcher::new(url, symbol_map.clone());
        return Ok(Arc::new(fetcher));
    }

    let exchange_mode = self.config.effective_exchange_mode();
    info!(self.node_id, mode = %exchange_mode, "Building price fetcher");

    match exchange_mode {
        common::types::ExchangeMode::Mock => {
            info!(self.node_id, "Using MockBitgetReadOnlyClient (mock mode)");
            let mock_client = common::mocks::MockBitgetReadOnlyClient::new();
            // Load default prices for common assets so NAV computation works
            // Real prices will come from data-node in production
            let fetcher = BitgetPriceFetcher::new(Arc::new(mock_client), symbol_map.clone());
            Ok(Arc::new(fetcher))
        }
        common::types::ExchangeMode::Testnet | common::types::ExchangeMode::Mainnet => {
            let fetcher = self.build_bitget_fetcher(symbol_map)?;
            Ok(Arc::new(fetcher))
        }
    }
}
```

**Step 3: Run tests**

Run: `cargo test -p issuer --lib bootstrap::price`
Expected: All pass

**Step 4: Commit**

```bash
git add issuer/src/config.rs issuer/src/bootstrap/price.rs
git commit -m "feat(issuer): wire ExchangeMode into issuer config and price builder"
```

---

### Task 6: Update Start Scripts and Documentation

**Files:**
- Modify: `scripts/start-ap.sh`
- Modify: `scripts/start-issuers.sh`
- Modify: `start.sh`
- Modify: `docs/plans/2026-02-23-unified-exchange-mode-design.md` (update status)

**Step 1: Update start-ap.sh**

Add `EXCHANGE_MODE` support — if set, pass it through. If not set, infer from existing `AP_MOCK_BITGET` for backward compat.

**Step 2: Update start-issuers.sh**

Add `EXCHANGE_MODE` support — if set, pass it through.

**Step 3: Update start.sh**

Add `EXCHANGE_MODE` export near the top with a default of `mock`.

**Step 4: Run a quick smoke test**

Run: `cargo build -p ap && cargo build -p issuer`
Expected: Both compile cleanly

**Step 5: Commit**

```bash
git add scripts/start-ap.sh scripts/start-issuers.sh start.sh
git commit -m "feat: update start scripts with EXCHANGE_MODE support"
```

---

### Task 7: Integration Test — Mock/Testnet Switch

**Files:**
- Modify: `ap/tests/bitget_integration.rs` or `ap/tests/bitget_wire_integration.rs`

**Step 1: Write integration test that verifies ExchangeMode::Mock uses MockBitget**

```rust
#[tokio::test]
async fn test_exchange_mode_mock_uses_mock_client() {
    let config = APConfig {
        exchange_mode: Some("mock".to_string()),
        ..Default::default()
    };
    assert_eq!(config.effective_exchange_mode(), ExchangeMode::Mock);
    assert!(config.effective_exchange_mode().is_mock());
    assert!(!config.effective_exchange_mode().requires_credentials());
}

#[tokio::test]
async fn test_exchange_mode_testnet_requires_credentials() {
    let config = APConfig {
        exchange_mode: Some("testnet".to_string()),
        ..Default::default()
    };
    assert_eq!(config.effective_exchange_mode(), ExchangeMode::Testnet);
    assert!(config.effective_exchange_mode().requires_credentials());
}
```

**Step 2: Run tests**

Run: `cargo test -p ap test_exchange_mode`
Expected: All pass

**Step 3: Commit**

```bash
git add ap/tests/
git commit -m "test(ap): add ExchangeMode integration tests"
```

---

### Summary of Changes

| File | Action | Purpose |
|------|--------|---------|
| `common/src/types/exchange_mode.rs` | Create | ExchangeMode enum + resolver |
| `common/src/types/mod.rs` | Modify | Register exchange_mode module |
| `common/src/mocks/bitget_read_only.rs` | Create | Mock issuer BitgetReadOnlyClient |
| `common/src/mocks/mod.rs` | Modify | Register bitget_read_only module |
| `ap/src/external/bitget/client.rs` | Modify | Upgrade v1 → v2 API endpoints |
| `ap/src/external/bitget/types.rs` | Modify | v2 field name aliases |
| `ap/src/external/bitget/rate_limited.rs` | Modify | Use v2 field names |
| `ap/src/config.rs` | Modify | Add exchange_mode field |
| `ap/src/main.rs` | Modify | Use ExchangeMode for all branching |
| `issuer/src/config.rs` | Modify | Add exchange_mode field |
| `issuer/src/bootstrap/price.rs` | Modify | Use MockBitgetReadOnlyClient in mock mode |
| `scripts/start-ap.sh` | Modify | EXCHANGE_MODE support |
| `scripts/start-issuers.sh` | Modify | EXCHANGE_MODE support |
| `start.sh` | Modify | EXCHANGE_MODE default |

**Expected usage after implementation:**

```bash
# Local dev (default)
EXCHANGE_MODE=mock ./start.sh

# Testnet
EXCHANGE_MODE=testnet \
  BITGET_API_KEY=xxx \
  BITGET_API_SECRET=xxx \
  BITGET_API_PASSPHRASE=xxx \
  ./start.sh

# Mainnet (production)
EXCHANGE_MODE=mainnet \
  BITGET_API_KEY=xxx \
  BITGET_API_SECRET=xxx \
  BITGET_API_PASSPHRASE=xxx \
  ./start.sh
```
