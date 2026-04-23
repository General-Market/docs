# Exchange Fee Comparison — Verified

Cross-checked by 3 independent research agents. Numbers below reflect
consensus. Disagreements noted and resolved.

## Cost of One Minimum-Size Trade (fee + gas + spread only)

| Exchange | Min Trade | Fee | Gas | Spread | **Cost per Trade** | **× 10M trades/day** |
|---|---|---|---|---|---|---|
| **Bitget** | $1-2 | 0.10% = $0.001 | $0 | ~$0.0002 | **$0.001** | **$10,000** |
| **Binance** | $5 | 0.10% = $0.005 | $0 | ~$0.0005 | **$0.006** | **$60,000** |
| **Hyperliquid** | $10 | 0.045% = $0.0045 | $0 | ~$0.001 | **$0.006** | **$60,000** |
| **Robinhood** | $1 | $0 commission | $0 | 0.4-0.85% = $0.006 | **$0.006** | **$60,000** |
| **Kalshi** | $0.50 | $0.02 (formula) | $0 | in orderbook | **$0.02** | **$200,000** |
| **Polymarket** | $1 | 1.8% at 50/50 = $0.018 | $0.005 | ~$0.02 | **$0.04** | **$400,000** |
| **Pump.fun** | $2.80 | 1.25% = $0.035 | $0.002 | 1-5% slippage | **$0.04-0.13** | **$400K-1.3M** |
| **Coinbase** | $2 | $0.99 flat | $0 | 0.50% = $0.01 | **$1.00** | **$10,000,000** |
| **General Market** | **$0** | **$0** | **$0** | **$0** | **$0** | **$0** |

## Consensus Notes

### Full agreement (all 3 agents)
- **Binance**: $5 min, 0.10% fee, ~$0.005-0.006 total ✓
- **Coinbase**: $2 min, $0.99 flat fee still active in 2026, ~$1.00 total ✓
- **Kalshi**: 1 contract min, formula `0.07 * P * (1-P)`, ~$0.02 at 50c ✓
- **Hyperliquid**: $10 min, 0.045% perps / 0.070% spot, genuinely $0 gas ✓
- **Robinhood**: $1 min, $0 commission, 0.35-0.85% spread markup ✓

### Minor disagreements (resolved)
- **Bitget min trade**: Agents 1 & 3 say 1 USDT, Agent 2 says $2 minNotional. Listed as $1-2.
- **Pump.fun min**: Agents 1 & 3 say 0.02 SOL (~$2.80), Agent 2 says 0.001 SOL practical. Listed as $2.80 (UI quick-buy minimum is higher).
- **Polymarket total cost**: Varies by category (crypto 7.2% feeRate vs politics 4% vs geopolitics 0%). Used crypto feeRate at 50/50 = 1.8% effective as worst case.

### Key findings
- **Coinbase Simple Buy is catastrophic**: $0.99 flat on a $2 trade = 50% tax. Still active in 2026.
- **Robinhood "$0 commission" is a spread**: 0.4-0.85% on BTC. As of July 2025, Robinhood receives $0.85 per $100 from market makers.
- **Hyperliquid genuinely has $0 gas**: Confirmed by all 3 agents. Native L1, gasless trading.
- **Pump.fun changed fees**: Old 1% → new 1.25% (0.95% protocol + 0.30% creator). Slippage dominates on micro-cap tokens.
- **Polymarket fees are category-specific**: Crypto 7.2%, Sports 3%, Politics 4%, Geopolitics 0%.
- **Kalshi caps retail at $25K per contract type**: Even if you wanted 10M positions, the platform won't let you.

## Sources

### Binance
- [Fee Schedule](https://www.binance.com/en/fee/spotMaker) — 0.1%/0.1% at VIP0
- [Minimum Order](https://dappgrid.com/minimum-usdt-to-trade-on-binance/) — 5 USDT notional
- [Spot Trading Rules](https://www.binance.com/en/support/announcement/detail/4b419936509647a4896e65a48eef2c5e)

### Coinbase
- [Pricing and Fees](https://help.coinbase.com/en/coinbase/trading-and-funding/pricing-and-fees/fees) — flat fee schedule
- [Fee Breakdown](https://www.budgetseniors.com/blog/coinbase-fees/) — confirms $0.99 under $10
- [Minimum Trade](https://help.coinbase.com/en/coinbase/trading-and-funding/buying-selling-or-converting-crypto/limits-and-account-levels) — $2

### Polymarket
- [Fee Docs](https://docs.polymarket.com/trading/fees) — formula: `C * feeRate * p * (1-p)`
- [Fee Guide](https://www.predictionhunt.com/blog/polymarket-fees-complete-guide) — category feeRates
- [Trading Fees Help](https://help.polymarket.com/en/articles/13364478-trading-fees) — max 1.80% at 50c
- [Trading Limits](https://help.polymarket.com/en/articles/13364481-does-polymarket-have-trading-limits) — $1 minimum

### Kalshi
- [Fee Schedule](https://kalshi.com/fee-schedule) — formula: `0.07 * C * P * (1-P)`
- [Help: Fees](https://help.kalshi.com/trading/fees) — maker = 25% of taker
- [Fee Schedule PDF](https://kalshi.com/docs/kalshi-fee-schedule.pdf) — Feb 2026

### Pump.fun
- [Fees](https://pump.fun/docs/fees) — 1.25% total (0.95% protocol + 0.30% creator)

### Hyperliquid
- [Fee Docs](https://hyperliquid.gitbook.io/hyperliquid-docs/trading/fees) — 0.045% taker perps, 0.070% spot
- [Gasless Trading](https://www.coinreporter.io/2026/03/hyperliquid-introduces-gasless-trading-for-all-perps-via-hype-fee-rebates/)
- [Rate Limits](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/rate-limits-and-user-limits)

### Robinhood
- [Trading Fees](https://robinhood.com/us/en/support/articles/trading-fees-on-robinhood/) — $0 commission
- [Crypto Buying/Selling](https://robinhood.com/us/en/support/articles/crypto-buying-and-selling/) — $1 minimum
- [Crypto Spread Guide](https://www.bitget.com/academy/robinhood-crypto-trading-spreads-explained-2026-america-beginners-guide-costs-features-new-tools) — 0.35-0.85%
- [Order Routing](https://robinhood.com/us/en/support/articles/crypto-order-routing/) — $0.85 per $100 from market makers

### Bitget
- [Spot Fees](https://www.bitget.com/support/articles/12560603820584) — 0.1%/0.1%
- [Minimum Order](https://www.bitget.com/support/articles/12560603814514) — 1 USDT
- [Fee Schedule](https://www.bitget.com/fee)

### Solana / Polygon
- [Solana Fees](https://solana.com/docs/core/fees) — ~0.000005 SOL base
- [Polygon Gas](https://polygonscan.com/gastracker) — ~$0.005 per tx
