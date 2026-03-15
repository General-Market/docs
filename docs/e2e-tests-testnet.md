# E2E Tests — Testnet Reference

Two Playwright projects run on 1 worker (serialized — shared deployer nonce space):
- **ITP project**: tests 00–08, 16–18, 22–24, 26–27
- **Vision project**: tests 10–15, 19–21, 25

Timeouts: 180s test / 30s expect / 60s action / 90s navigation.

---

## ITP Project

### 00 — Health Check
| # | Test | Summary |
|---|------|---------|
| 1 | frontend loads — Vision on root | Root page loads |
| 2 | frontend loads — ITP listing on /index | /index page loads |
| 3 | backend API is reachable | Backend responds |
| 4 | Settlement RPC is reachable | Settlement chain responds |
| 5 | L3 RPC is reachable | L3 chain responds |
| 6 | AP is reachable | Authorized Participant responds |
| 7 | ITP listing appears with at least one ITP | At least one ITP displayed |

### 01 — Connect Wallet
| # | Test | Summary |
|---|------|---------|
| 1 | connects wallet and shows truncated address | Wallet connection flow |
| 2 | disconnect button works | Wallet disconnection |
| 3 | wallet reconnects on page reload | Session persistence |

### 02 — Buy ITP
| # | Test | Summary |
|---|------|---------|
| 1 | full buy flow: mint USDC if needed, approve, buy, wait for fill | Complete buy flow with oracle consensus |

### 03 — Lending
| # | Test | Summary |
|---|------|---------|
| 1 | full lending cycle | Deposit collateral → borrow USDC → repay → withdraw |

### 04 — Sell ITP
| # | Test | Summary |
|---|------|---------|
| 1 | sell ITP shares | Sell flow with oracle consensus, verify shares decrease |

### 05 — Create ITP
| # | Test | Summary |
|---|------|---------|
| 1 | create ITP via frontend + Settlement bridge relay | Full ITP creation with bridge relay to L3 |

### 06 — Backtester Smoke
| # | Test | Summary |
|---|------|---------|
| 1 | categories endpoint returns data | CoinGecko categories loaded |
| 2–6 | CG categories (layer-1, layer-2, defi, meme, AI) | Various weighting modes |
| 7 | all CG categories with ≥5 coins produce valid results | Bulk category validation |
| 8 | DefiLlama categories loaded | DL categories exist |
| 9 | DL categories produce valid results | DL simulation runs |
| 10+ | weighting modes (equal, mcap, sqrt, inv, momentum…) | All weighting algos |
| 11+ | defi weighting (tvl_w, fee_w, vol_w, tvl_eff, yield_w) | DeFi-specific weights |
| 12+ | github weighting (star_w, commit_w, dev_gate…) | GitHub-based weights |
| 13+ | FNG regime (trigger, cash, risk_toggle, top_n…) | Fear & Greed regime modes |
| 14+ | dominance regime (alt_rotator, trend_filter…) | BTC dominance regime modes |
| 15+ | github filter (activity, quality_gate) | GitHub activity filters |
| 16 | FNG + Dominance + GitHub combined | Combined regime test |
| 17 | simulation NAV starts near $1 | NAV sanity check |
| 18 | max drawdown is negative or zero | Drawdown sanity check |
| 19 | /fng/latest returns valid data or empty | FNG endpoint check |

> Skips if sim cache not loaded (CoinGecko historical data needed).

### 07 — Oracle Resilience
| # | Test | Summary |
|---|------|---------|
| 1 | kill 1/3 oracles — system continues, killed node recovers | 2/3 quorum survives |
| 2 | kill 2/3 oracles — system halts, recovers after quorum restored | System halts correctly |

> **Skipped on testnet** — requires `RUN_RESILIENCE=1` and local process control.

### 08 — Settlement Bridge Buy
| # | Test | Summary |
|---|------|---------|
| 1 | buy ITP via Settlement bridge | Settlement USDC → L3 Index + Settlement BridgedITP |
| 2 | sell ITP via Settlement bridge | BridgedITP burn → L3 burn + Settlement USDC return |

### 16 — Portfolio Regression
| # | Test | Summary |
|---|------|---------|
| 1 | user has ITP shares from previous buy | Order settled, not stuck |
| 2 | ITP card shows TVL as dollar amount (not "–") | TVL displays correctly |
| 3 | header and portfolio show same USDC balance | Balance consistency |
| 4 | Total Value includes USDC balance | Portfolio totals correct |

### 17 — Multi-ITP Lending Visibility
| # | Test | Summary |
|---|------|---------|
| 1 | lending markets table shows multiple ITPs | ITP2+ visible in lending |
| 2 | ITP2 row shows "Coming Soon" when no Morpho market | Graceful fallback |

### 18 — Multi-ITP Order Processing
| # | Test | Summary |
|---|------|---------|
| 1 | buy ITP2 order fills via oracle consensus | Multi-ITP buy pipeline |
| 2 | sell ITP2 order completes | Sell race condition fix verified |
| 3 | ITP1 sell still works after multi-ITP fix | Regression test |

### 22 — UI Fixes Validation
| # | Test | Summary |
|---|------|---------|
| 1 | buy modal: slippage hidden behind gear icon | Slippage gear icon (buy) |
| 2 | sell modal: slippage hidden behind gear icon | Slippage gear icon (sell) |
| 3 | source detail page has batch panel with markets | Batch entry panel present |
| 4 | withdraw button NOT visible for unconnected wallet | Auth gate |
| 5 | Enter Batch button disabled without predictions | Validation gate |
| 6 | orderbook defaults to 0.5% aggregation | Not raw orderbook |
| 7 | leaderboard API accepts batch_id filter | API filter works |
| 8 | source detail page leaderboard fetches with batch_id | Frontend uses filter |

### 23 — API Routes Smoke
| # | Test | Summary |
|---|------|---------|
| 1 | GET /api/deployment returns contracts | Deployment config |
| 2 | POST /api/faucet returns 200 | **Skipped on testnet** (IS_ANVIL only) |
| 3 | GET /api/itp-price returns NAV in sane range | ITP price endpoint |
| 4 | GET /api/market/history returns array or error | Market history |
| 5 | GET /api/vision/batches returns valid response | Vision batches |
| 6 | GET /api/vision/snapshot returns valid JSON | Vision snapshot |
| 7 | GET /api/vision/snapshot/meta returns sources health | Sources health |
| 8 | GET /api/vision/leaderboard returns valid response | Leaderboard |

### 24 — Decimal Regression
| # | Test | Summary |
|---|------|---------|
| 1 | no 18+ digit numbers visible in body | Bigint leak scan |
| 2 | ITP NAV values in sane range ($0.01–$1000) | NAV range check |
| 3 | Vision balance shows formatted amount | Not raw wei |
| 4 | lending TVL under $10M | Catches raw wei display |

### 26 — Rebalance Full Cycle
| # | Test | Summary |
|---|------|---------|
| 1 | rebalance preserves NAV and updates weights | NAV preserved (<1% drift), weights changed |

### 27 — AP Endpoints
| # | Test | Summary |
|---|------|---------|
| 1 | GET /health returns valid status | AP health endpoint |
| 2 | GET /metrics returns Prometheus format | AP metrics endpoint |

---

## Vision Project

### 10 — Vision
| # | Test | Summary |
|---|------|---------|
| 1 | L3 chain is reachable | L3 RPC responds |
| 2 | Vision API responds | Backend API health |
| 3 | at least one batch exists | Batch data present |
| 4 | vision page loads and shows batch | UI renders batch |
| 5 | two players join batch and deposits settle | Opposing bets, USDC settle |

### 10 — Morpho Oracle Health
| # | Test | Summary |
|---|------|---------|
| 1 | oracle price is readable and matches deployment | Price read |
| 2 | oracle price change affects max borrow | Price sensitivity |
| 3 | LLTV boundary: cannot borrow beyond 77% | Liquidation threshold |
| 4 | oracle price update emits correct values | Event verification |
| 5 | market state is consistent | State consistency |

> Some tests skip if not IS_ANVIL (oracle price manipulation requires Anvil).

### 11 — Vision Sources
| # | Test | Summary |
|---|------|---------|
| 1 | browse page loads and shows source cards | Sources page renders |
| 2 | stats bar shows Sources count | Stats present |
| 3 | category pills visible with counts | Category UI |
| 4 | category filtering reduces visible cards | Filter works |
| 5 | source card shows name and category badge | Card content |
| 6 | source card has action links | Markets/Batch/Details links |
| 7 | clicking source card navigates to detail page | Navigation |
| 8 | detail page loads for CoinGecko | CG source page |
| 9 | detail page shows back link | Navigation |
| 10 | detail page shows hero with category badge | Hero section |
| 11 | detail page shows markets section | Markets visible |
| 12 | detail page shows search input for markets | Market search |
| 13 | detail page shows Enter Batch panel | Batch entry |
| 14 | stake input and quick amount buttons visible | Stake UI |
| 15 | invalid source shows not-found page | 404 handling |
| 16 | multiple source detail pages work | Multi-source nav |
| 17 | strategy list shows premade strategies | Strategy list |
| 18 | Claude Code agent button is visible | Agent button |

### 12 — Vision Deposit
| # | Test | Summary |
|---|------|---------|
| 1 | deposit USDC to Vision balance and verify on UI | L3 deposit flow |

### 13 — Vision Enter Batch (UI)
| # | Test | Summary |
|---|------|---------|
| 1 | enter batch via source detail page | Full batch entry via UI |

### 14 — Vision Claim + Withdraw
| # | Test | Summary |
|---|------|---------|
| 1 | withdraw from batch and Vision balance via UI | Full withdraw cycle after tick resolution |

### 15 — Display Formatting
| # | Test | Summary |
|---|------|---------|
| 1 | leaderboard volume and PnL are not raw wei | Formatted numbers |
| 2 | win rate is a percentage under 100 | Percentage check |
| 3 | source detail pool TVL is not raw wei | TVL formatting |
| 4 | ITP NAV per share between $0.01–$1000 | NAV range |
| 5 | orderbook loads on ITP hover | Not stuck loading |
| 6 | source cards render with market counts | Card content |
| 7 | stats bar shows source and asset counts | Stats content |
| 8 | source detail page markets load | Not stuck loading |
| 9 | lending markets table TVL not raw wei | Lending format |
| 10 | lending modal amounts not raw wei | Modal format |
| 11 | wallet USDC balance shows formatted amount | Balance format |
| 12 | no raw bigint values in page text | Full page scan |

### 19 — Vision Settlement Bridge Deposit
| # | Test | Summary |
|---|------|---------|
| 1 | deposit Settlement USDC → Vision virtual balance via backend | Cross-chain deposit |
| 2 | frontend shows updated balance after Settlement deposit | UI reflects deposit |

### 20 — Vision Settlement Withdraw
| # | Test | Summary |
|---|------|---------|
| 1 | withdraw to Settlement UI path shows correct options | UI options |
| 2 | virtual balance from Settlement deposit can be withdrawn | Withdraw flow |
| 3 | complete withdrawal from Vision virtual balance to Settlement USDC | Full withdraw cycle |

### 21 — Vision Claim Rewards
| # | Test | Summary |
|---|------|---------|
| 1 | balance proof fetchable via proxy after tick resolution | BLS proof fetch |
| 2 | bitmap submission works via proxy fan-out | Bitmap fan-out |

### 25 — Vision Tick Resolution
| # | Test | Summary |
|---|------|---------|
| 1 | tick resolves with opposite bets — balances change + pool conserved | Full tick lifecycle |

---

## Missing E2E Coverage

### High Priority

| Gap | Feature | Details |
|-----|---------|---------|
| **Create Batch** | 4-step wizard (markets → configure → preview → confirm) | `CreateBatchModal` — critical user flow, zero coverage |

### Medium Priority — /index (ITP)

| Gap | Feature | Details |
|-----|---------|---------|
| Portfolio tabs | Positions / Value / Trades / Orders tabs | `PortfolioSection` — 4 tabs, PnL chart, trade history |
| Order cancellation | Cancel pending order | `cancelOrder(orderId)` in modals |
| ITP detail page | `/itp/[itpId]` — NAV, AUM, holdings | Standalone page, never tested |
| Backtest → Deploy | Deploy simulated index from backtester | "Deploy This Index" button |
| Backtest → Rebalance | Rebalance existing ITP from backtest results | Not tested |

### Medium Priority — /vision

| Gap | Feature | Details |
|-----|---------|---------|
| Faucet UI button | "Mint Test USDC" in BalanceDepositModal | Calls `/api/faucet`, shows result — UI flow untested |
| Faucet API on testnet | `POST /api/faucet` skipped on testnet | Test 23#2 is IS_ANVIL only — should adapt for testnet |
| Batch metadata | Set name, description, YouTube, image | `setBatchMetadata` + `setDeployerName` |
| My Positions | Player position overview across batches | `MyPositions` component |
| Script tab (Python) | Pyodide strategy editor | `ScriptTab` — algorithmic betting |
| Tick lock state | "Enter Batch" disabled when tick is locked | Not tested |

### Medium Priority — Infrastructure / System

| Gap | Feature | Details |
|-----|---------|---------|
| System Status section | Node status (Alpha–Zeta), active/total oracles, pending orders | `SystemStatusSection` — **currently broken, not caught by E2E** |
| SSE system feed | Real-time system snapshot via SSE | `useSSESystem` → `useSystemStatus` — no connectivity test |
| Oracle node health | Per-node status (active/inactive/suspended), uptime, BLS key | `OracleNode` in `useSystemStatus` — not verified |
| Pending orders display | Pending orders count + list in System section | Relies on SSE, not tested |
| Fill time chart | Bar chart of recent fill times | `fillTimeBuckets` in `SystemStatusSection` |
| AP balance rotation | Keeper balances with auto-rotate | `useApBalances` + `APBalanceCard` — not tested |
| Vault asset breakdown | Top vault assets with USD values | `topVaultAssets` in system status |
| Explorer page | `/explorer` — full system health dashboard | 6 sections (ITP, Vision, Health, Gas, Prices, Consensus) — zero coverage |
| Explorer health API | `GET /api/explorer/health` | Not in API smoke tests (23) |

### Low Priority

| Gap | Feature | Details |
|-----|---------|---------|
| Chart modal | ITP price history chart | `ChartModal` with timeframe |
| Orderbook content | Bid/ask data, spread display | Only aggregation default tested (22#6) |
| AP Trades Feed | Real-time keeper trades | `VaultTradesFeed` |
| Cost basis card | Per-position avg buy price | `CostBasisCard` on ITP listing |
| Nonce stuck detection | Warn on stuck txs | `useNonceCheck` |
| NextBatches carousel | Live batch carousel with timers | `NextBatches` on root page |
| Visual tab drag-paint | Drag-paint bitmap editing | `SourceCard` hover interaction |
| Deposit more (existing) | Add funds to existing batch | `DepositModal` in-batch |
| Bulk actions | All UP / All DOWN buttons | `ExpandedBatch` |
| Market search filtering | Search actually filters markets | 11#12 checks input exists, not filtering |
| 7-day price chart | Expandable row LineChart | `MarketsTable` |
| Points page | `/points` — rewards/season 1 | Page exists, never tested |
| Explorer page | `/explorer` — system dashboard | Only API tested (23) |
| Multiplier display | Tick multiplier (1x–20x) | Rendered in `BatchEntryPanel` |
| GET /api/explorer/health | Explorer health metrics | Not in API smoke tests |
| GET /api/og/[wallet] | Dynamic OG image | Not tested |

---

## Tests Skipped on Testnet

| Test | Reason |
|------|--------|
| 07 — Oracle Resilience (all) | Requires local process kill/restart (`RUN_RESILIENCE=1`) |
| 23 #2 — POST /api/faucet | IS_ANVIL only |
| 10 — Morpho Oracle (some) | Oracle price manipulation requires Anvil |

## Running

```bash
# Switch to testnet env first
./switch-env.sh testnet

# Run all tests
cd frontend && npx playwright test --config=e2e/playwright.config.ts

# Run single project
npx playwright test --config=e2e/playwright.config.ts --project=itp
npx playwright test --config=e2e/playwright.config.ts --project=vision

# Run single file
npx playwright test --config=e2e/playwright.config.ts e2e/tests/02-buy-itp.spec.ts
```
