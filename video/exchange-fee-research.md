# Cost to Open One Minimum-Size Trade on 8 Exchanges

Research date: 2026-04-03. All figures represent the LOWEST/default tier for a new user with no volume history and no token holdings.

---

## Summary Table

| Exchange | Min Trade | Fee Rate | Fee Cost | Gas/Network | Spread Est. | **Total Cost** |
|---|---|---|---|---|---|---|
| **Binance** (Spot) | $5 USDT | 0.10% taker | $0.005 | $0 | ~$0.001 (0.01 bps) | **~$0.006** |
| **Coinbase** (Simple) | ~$2 | $0.99 flat + 0.50% spread | $0.99 | $0 | $0.01 (baked into flat) | **~$1.00** |
| **Polymarket** | $1 (market order) | Taker only, category-dependent | $0.0018-$0.018 | ~$0 (gasless) | ~$0.005 | **~$0.007-$0.023** |
| **Kalshi** | 1 contract (~$0.50) | 0.07 * P * (1-P) taker | $0.0175 max | $0 | $0.01 | **~$0.02-$0.03** |
| **Pump.fun** | ~$0.01 SOL | 1.25% total | $0.000125 | ~$0.002 SOL gas | ~1-3% (illiquid) | **~$0.003-$0.01** |
| **Hyperliquid** | ~$10 | 0.045% taker (perps) / 0.07% (spot) | $0.0045-$0.007 | $0 (gasless) | ~$0.005-$0.02 | **~$0.01-$0.03** |
| **Robinhood** | $0.01-$1 | $0 commission | $0 | $0 | 0.35-0.85% spread | **~$0.004-$0.009** |
| **Bitget** (Spot) | ~$5 (varies) | 0.10% maker/taker | $0.005 | $0 | ~$0.005 | **~$0.01** |

---

## Detailed Breakdown

### 1. Binance (Spot)

- **Minimum order**: 5 USDT notional (minNotional filter; pair-specific, but 5 USDT is the standard for major USDT pairs)
- **Fee rate**: VIP 0 — **0.100% maker / 0.100% taker**. With BNB payment: 0.075% / 0.075%. Without BNB, on a $5 trade: **$0.005 fee**
- **Gas**: $0 (centralized exchange)
- **Spread**: BTC/USDT spread is ~0.001% (1 basis point or less) — effectively **~$0.00005** on a $5 trade. Negligible.
- **Total cost on $5 trade**: **~$0.005**

Source: [Binance Fee Schedule](https://www.binance.com/en/fee/schedule) | [Binance Trading Rules](https://www.binance.com/en/trade-rule) | [Binance Min Notional Announcement](https://www.binance.com/en/support/announcement/detail/e4384cba297a4bd2a154be644d5d76f9)

---

### 2. Coinbase (Simple Buy/Sell)

- **Minimum order**: ~$2 (no hard public minimum stated; $1 purchases documented but some sources say $2)
- **Fee rate**: Flat fee tiers for Simple Trade:
  - Under $10: **$0.99**
  - $10-$25: $1.49
  - $25-$50: $1.99
  - $50-$200: $2.99
  - Over $200: percentage-based
- **Spread**: ~**0.50%** built into every buy/sell, applied ON TOP of the flat fee
- **Gas**: $0 (centralized exchange)
- **Total cost on a $2 trade**: $0.99 flat fee + ~$0.01 spread = **~$1.00**
- **Total cost on a $10 trade**: $0.99 + $0.05 = **~$1.04**

Note: Coinbase Advanced Trade is dramatically cheaper (0.40% maker / 0.60% taker, no flat fee, no spread). The Simple Trade interface is where retail gets incinerated.

**Recent changes**: Coinbase One subscription tiers launched January 2026 (Basic $4.99/mo, Preferred $29.99/mo, Premium $299.99/mo) — zero Simple Trade fees up to volume caps, but the 0.50% spread persists.

Source: [Coinbase Fees Breakdown](https://www.budgetseniors.com/blog/coinbase-fees/) | [Coinbase Fees 2026](https://www.bitdegree.org/crypto/tutorials/coinbase-fees) | [Exchange fees](https://help.coinbase.com/en/exchange/trading-and-funding/exchange-fees)

---

### 3. Polymarket

- **Minimum order**: $1 for market orders, 5 shares for limit orders
- **Fee formula**: `fee = C * feeRate * p * (1 - p)` — takers only, makers free
- **feeRate by category** (as of March 2026):

| Category | feeRate | Max fee at p=0.50 per 100 shares |
|---|---|---|
| Crypto | 0.072 | $1.80 |
| Sports | 0.03 | $0.75 |
| Finance | 0.04 | $1.00 |
| Politics | 0.04 | $1.00 |
| Economics | 0.05 | $1.25 |
| Culture | 0.05 | $1.25 |
| Weather | 0.05 | $1.25 |
| Tech | 0.04 | $1.00 |
| Mentions | 0.04 | $1.00 |
| Other | 0.05 | $1.25 |
| Geopolitics | 0 | $0.00 |

- **Example — 1 share at $0.50 (Sports)**: fee = 1 * 0.03 * 0.50 * 0.50 = **$0.0075**
- **Example — 1 share at $0.50 (Crypto)**: fee = 1 * 0.072 * 0.50 * 0.50 = **$0.018**
- **Gas**: Effectively $0. Polymarket uses gasless meta-transactions on Polygon. Even raw Polygon gas is <$0.002 per tx.
- **Spread**: Varies wildly by market liquidity. Tight markets (presidential elections): 1-2c. Thin markets: 5-10c+. For a liquid market, estimate ~$0.01 on a $0.50 share.
- **Total cost (1 share, p=0.50, Sports, liquid market)**: ~$0.0075 fee + ~$0.01 spread = **~$0.018**

**Recent changes**: Fee rates are now category-specific (updated system). Geopolitics markets are fee-free. The feeRate values should be fetched dynamically — they change without notice.

Source: [Polymarket Fee Docs](https://docs.polymarket.com/polymarket-learn/trading/fees) | [Polymarket Help - Trading Fees](https://help.polymarket.com/en/articles/13364478-trading-fees) | [Polymarket Help - Trading Limits](https://help.polymarket.com/en/articles/13364481-does-polymarket-have-trading-limits)

---

### 4. Kalshi

- **Minimum order**: 1 contract (contracts range from $0.01 to $0.99)
- **Fee formula (taker)**: `roundUp(0.07 * C * P * (1 - P))` where C = contracts, P = price
- **Fee formula (maker)**: `roundUp(0.0175 * C * P * (1 - P))` — exactly 25% of taker fee
- **Fee cap**: Max taker fee = **$0.0175/contract** (at P = $0.50). Max maker fee = ~$0.0044/contract.
- **Gas**: $0 (centralized platform, CFTC-regulated)
- **Spread**: Varies by market. Liquid markets (elections, Fed rates): 1-3c. Thin markets: 5-10c+. Estimate ~$0.01-$0.02 for a liquid market.
- **Example — 1 contract at $0.50 (taker)**: fee = roundUp(0.07 * 1 * 0.50 * 0.50) = roundUp($0.0175) = **$0.02**
- **Total cost (1 contract, P=0.50, liquid)**: $0.02 fee + ~$0.01 spread = **~$0.03**

**Recent changes**: Maker fees shifted from flat to probability-scaled (matching taker formula shape) in July 2025. Kalshi US DCM (the regulated entity) also introduced a separate fee schedule for its CFTC-regulated event contracts.

Source: [Kalshi Fee Schedule PDF (Feb 2026)](https://kalshi.com/docs/kalshi-fee-schedule.pdf) | [Kalshi Fee Schedule Page](https://kalshi.com/fee-schedule) | [Kalshi Help - Fees](https://help.kalshi.com/trading/fees)

---

### 5. Pump.fun

- **Minimum order**: No stated minimum. Practically limited by Solana tx fees (~$0.001). Users regularly trade $0.01-$1 amounts.
- **Fee rate (bonding curve)**: **1.25% total** (since May 13, 2025):
  - Creator: 0.30%
  - Protocol: 0.95%
  - LP: 0.00%
- **Fee rate (PumpSwap, graduated tokens)**: Dynamic by market cap:
  - 0-420 SOL mcap: 1.25% total
  - Scales down to 0.30% at 98,240+ SOL mcap
  - Protocol fee stable at 0.05%, LP fee 0.20%, creator fee variable
- **Gas**: Solana base fee ~$0.0005 + priority fee. Total typically **$0.001-$0.003** per swap.
- **Spread/slippage**: Highly variable. Bonding curve math means small-cap tokens have steep price impact. For a min-size trade (~$0.10): expect 1-5% slippage on most tokens.
- **Example — $0.10 buy on bonding curve**: fee = $0.00125 (1.25%) + $0.002 gas + ~$0.003 slippage = **~$0.006**
- **Coin creation**: 0 SOL (free). Graduation to PumpSwap: 0.015 SOL.

**Recent changes (critical)**: Pump.fun overhauled its fee model in May 2025, introducing creator revenue sharing (0.05%-0.95% dynamic by market cap) and launching PumpSwap as the native DEX for graduated tokens. The old flat 1% fee is gone.

Source: [Pump.fun Fees Docs](https://pump.fun/docs/fees) | [Yahoo Finance - Pump.fun New Fee Model](https://finance.yahoo.com/news/pump-fun-fee-model-hands-125849600.html) | [CoinMarketCap - Pump.fun Fee Structure](https://coinmarketcap.com/academy/article/pumpfun-creators-earn-dollar2m-in-first-day-under-new-fee-structure)

---

### 6. Hyperliquid

- **Minimum order**: ~$10 USDC (enforced across perps and spot)
- **Fee rate (Perps, Tier 0)**: **0.015% maker / 0.045% taker**
- **Fee rate (Spot, Tier 0)**: **0.040% maker / 0.070% taker**
- **Gas**: **$0**. Hyperliquid L1 absorbs all gas costs. No on-chain gas for trading. (March 2026: introduced gasless perps trading via HYPE fee rebates, effectively $0 net gas.)
- **Spread**: Depends on asset. BTC/ETH perps: very tight (1-2 bps). Spot altcoins: wider (5-20 bps). Estimate ~$0.005-$0.02 on a $10 trade.
- **Example — $10 perps taker trade**: fee = $10 * 0.045% = **$0.0045**. Gas = $0. Spread ~$0.01. Total = **~$0.015**
- **Example — $10 spot taker trade**: fee = $10 * 0.070% = **$0.007**. Gas = $0. Spread ~$0.01. Total = **~$0.017**

**Recent changes**: Hyperliquid introduced gasless perps trading in March 2026 via HYPE fee rebates. Staking-based tier discounts (5%-40% off fees based on HYPE staked) were also added.

Source: [Hyperliquid Fee Docs](https://hyperliquid.gitbook.io/hyperliquid-docs/trading/fees) | [CryptoSlate - Hyperliquid Review 2026](https://cryptoslate.com/crypto-exchanges/hyperliquid-exchange-review/) | [CoinReporter - Gasless Trading](https://www.coinreporter.io/2026/03/hyperliquid-introduces-gasless-trading-for-all-perps-via-hype-fee-rebates/)

---

### 7. Robinhood (Crypto)

- **Minimum order**: $0.01 (market maker routing) / $0.03 (smart exchange routing). Practical minimum ~$1.
- **Commission**: **$0** — zero explicit commission
- **Spread markup**: This is where Robinhood makes its money. Per their own disclosure: for every $100 of notional volume, Robinhood receives **$0.85** from its market maker (as of July 24, 2025). The total spread passed to users is slightly more than this.
  - Major coins (BTC, ETH): **0.35%-0.85%** spread
  - Smaller altcoins: up to 1-2% spread
- **Gas**: $0 (centralized, off-chain execution)
- **Example — $1 BTC buy**: $0 commission + ~$0.004-$0.009 spread (0.4%-0.85%) = **~$0.004-$0.009**

**Recent changes**: The CLARITY Act (2025) forced Robinhood to disclose spread costs more transparently. They now show estimated spread before order confirmation. Spreads have narrowed slightly for major coins compared to 2024. Smart exchange routing (introduced 2025) offers lower spreads for some orders.

Source: [Robinhood Crypto Order Routing](https://robinhood.com/us/en/support/articles/crypto-order-routing/) | [Robinhood Buying and Selling Crypto](https://robinhood.com/us/en/support/articles/crypto-buying-and-selling/) | [Bitget - Robinhood Crypto Fees Guide](https://www.bitget.com/academy/robinhood-crypto-fee)

---

### 8. Bitget (Spot)

- **Minimum order**: Pair-specific (e.g., 0.0001 BTC for BTC/USDT). Notional minimum ~$5.
- **Fee rate (Regular)**: **0.10% maker / 0.10% taker**
- **With BGB token**: 20% discount → **0.08% maker / 0.08% taker**
- **Gas**: $0 (centralized exchange)
- **Spread**: BTC/USDT: very tight (~1-2 bps). Smaller pairs: wider. Estimate ~$0.005 on a $5 trade.
- **Example — $5 trade (no BGB)**: fee = $5 * 0.10% = **$0.005**. Gas = $0. Spread ~$0.005. Total = **~$0.01**

Source: [Bitget Fee Page](https://www.bitget.com/fee) | [Bitget Spot Trading Fees](https://www.bitget.com/support/articles/12560603820584) | [TradersUnion - Bitget Fees 2026](https://tradersunion.com/brokers/crypto/view/bitget/fees/)

---

## Ranked by Total Cost (Cheapest First)

| Rank | Exchange | Total Cost (min trade) | Notes |
|---|---|---|---|
| 1 | **Pump.fun** | ~$0.003-$0.01 | Dirt cheap in absolute terms, but 1.25% rate is high. Slippage is the real killer. |
| 2 | **Robinhood** | ~$0.004-$0.009 | $0 commission is a lie — spread IS the fee. But on $1 it's pennies. |
| 3 | **Binance** | ~$0.005 | Cheapest *rate* of any CEX. Min $5 notional. |
| 4 | **Bitget** | ~$0.01 | Identical rate to Binance. Slightly less liquid. |
| 5 | **Hyperliquid** | ~$0.015-$0.017 | Zero gas, competitive rates. Min $10 is the highest floor. |
| 6 | **Polymarket** | ~$0.018 | Category-dependent. Geopolitics is literally free. Crypto is the most expensive. |
| 7 | **Kalshi** | ~$0.03 | Parabolic fee curve punishes mid-priced contracts. Cheap at extremes. |
| 8 | **Coinbase** (Simple) | ~$1.00 | The $0.99 flat fee on small trades is brutal. Advanced Trade fixes this entirely. |

---

## Recent Fee Changes (Last 6 Months)

| Exchange | Change | Date |
|---|---|---|
| **Polymarket** | Category-specific feeRates introduced (Crypto 0.072, Sports 0.03, Geopolitics 0). Dynamic per-category model replaced single flat rate. | 2025-2026 |
| **Polymarket US (DCM)** | Separate regulated entity with 0.01% taker fee on contracts. | Early 2026 |
| **Pump.fun** | Complete fee overhaul: creator revenue sharing (0.05%-0.95% dynamic), PumpSwap DEX for graduated tokens, bonding curve fee restructured to 1.25% (was 1% flat). | May 2025 |
| **Hyperliquid** | Gasless perps trading via HYPE rebates. Staking-based tier discounts (5%-40%). | March 2026 |
| **Kalshi** | Maker fees changed from flat to probability-scaled formula. | July 2025 |
| **Robinhood** | CLARITY Act forced spread disclosure. Smart exchange routing introduced. | 2025 |
| **Coinbase** | Coinbase One restructured into 3 subscription tiers. | January 2026 |
| **Binance** | No significant spot fee changes. | — |
| **Bitget** | No significant spot fee changes. | — |
