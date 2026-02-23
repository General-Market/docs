# Unified ExchangeMode Design

**Date:** 2026-02-23
**Status:** Approved

## Problem

The system has three separate Bitget integration paths that don't cleanly compose:

1. **AP `APClient`** — switches via `--mock-bitget` flag between `MockBitget` and `RateLimitedBitgetClient`
2. **AssetTradeRequest pipeline** — hardcoded to `MockBitgetVault` on-chain settlement when mock, no real CEX path
3. **Issuer `BitgetReadOnlyClient`** — always expects real API credentials, no mock fallback for local dev

Additionally, the AP uses Bitget API v1 while the issuer uses v2.

## Design

### ExchangeMode Enum

Single source of truth in `common/src/types/exchange_mode.rs`:

```rust
pub enum ExchangeMode {
    Mock,      // In-memory fakes, no network, instant fills
    Testnet,   // Real Bitget API with testnet keys
    Mainnet,   // Real Bitget API with mainnet keys
}
```

**Resolution:** CLI `--exchange-mode` > env `EXCHANGE_MODE` > config file > default (`Mock`)

### Component Wiring

**AP:**
| Mode | APClient impl | AssetTradeRequest handling |
|------|---------------|---------------------------|
| Mock | MockBitget | MockBitgetVault on-chain (E2E testing) |
| Testnet | RateLimitedBitgetClient | Real Bitget CEX orders via APClient |
| Mainnet | RateLimitedBitgetClient | Real Bitget CEX orders via APClient |

**Issuer:**
| Mode | BitgetReadOnlyClient impl | PriceFetcher |
|------|---------------------------|--------------|
| Mock | MockBitgetReadOnlyClient (new) | BitgetPriceFetcher<MockBitgetReadOnlyClient> |
| Testnet | BitgetReadOnlyClientImpl | BitgetPriceFetcher<BitgetReadOnlyClientImpl> |
| Mainnet | BitgetReadOnlyClientImpl | BitgetPriceFetcher<BitgetReadOnlyClientImpl> |

### New Components

**`MockBitgetReadOnlyClient`** (`common/src/mocks/bitget_read_only.rs`):
- Implements `BitgetReadOnlyClient` trait
- Returns configurable ticker prices from in-memory HashMap
- Supports `get_ticker`, `get_all_tickers`, `get_orderbook`
- For local dev / tests without Bitget API access

### API Upgrade

Upgrade AP's `BitgetClient` from v1 to v2 endpoints:
- `/api/spot/v1/trade/orders` → `/api/v2/spot/trade/place-order`
- `/api/spot/v1/trade/orderInfo` → `/api/v2/spot/trade/orderInfo`
- `/api/spot/v1/trade/fills` → `/api/v2/spot/trade/fills`

### Safety

- `ExchangeMode::Mainnet` requires explicit `EXCHANGE_MODE=mainnet` — no accidental mainnet
- Prominent startup log: `"MAINNET MODE - REAL MONEY TRADING ACTIVE"`
- Existing `--bitget-testnet` safety default preserved as backwards-compat

### Backward Compatibility

| Old flag | Maps to |
|----------|---------|
| `--mock-bitget` | `ExchangeMode::Mock` |
| `--bitget-testnet` (or no flag + credentials) | `ExchangeMode::Testnet` |
| `--bitget-mainnet` | `ExchangeMode::Mainnet` |
| `--exchange-mode mock\|testnet\|mainnet` | Canonical new flag |

Old flags log deprecation warnings but keep working.

### Credentials

| Mode | Required env vars |
|------|-------------------|
| Mock | None |
| Testnet | `BITGET_API_KEY`, `BITGET_API_SECRET`, `BITGET_API_PASSPHRASE` |
| Mainnet | Same as Testnet |
| Issuer read-only | `BITGET_READONLY_API_KEY`, `BITGET_READONLY_API_SECRET`, `BITGET_READONLY_PASSPHRASE` (or shared with AP keys) |
