# E2E Tests — Testnet Reference

57 test files across 7 Playwright projects, running on 1 worker (serialized — shared deployer nonce space).

## Project Architecture

```
Phase 1 — DATA (2 projects, parallel on Anvil):
  itp-data (DEPLOYER_KEY):          01 → 02 → 03 → 04 → 05 → 07 → 08 → 10-morpho → 18 → 26 → 36
  vision-data (VISION_PLAYER_KEY):  10-vision → 12 → 13 → 15 → 25 → 14 → 19 → 20 → 21 → 41 → 42 → 43 → 44

Phase 2 — UI VERIFY (depends on respective Phase 1):
  ui-verify-itp (depends: itp-data):       00, 06, 16, 17, 22, 23, 24, 27, 28, 32, 34
  ui-verify-vision (depends: vision-data):  11, 29, 33

Phase 3 — LATE WRITES (depends on Phase 1 + Phase 2):
  write-after:  30, 31

Phase 4 — SWARM (depends: vision-data):
  swarm:  40

Standalone (no dependencies):
  production-smoke:  35
```

Timeouts: 180s test / 30s expect / 60s action / 90s navigation.
Consensus timeout: 360s (full tick cycle + consensus + propagation).

---

## ITP Project (itp-data + ui-verify-itp)

### 00 — Health Check (ui-verify-itp)
| # | Test | Summary |
|---|------|---------|
| 1 | frontend loads — Vision on root | Root page loads |
| 2 | frontend loads — ITP listing on /index | /index page loads |
| 3 | backend API is reachable | Backend responds |
| 4 | Settlement RPC is reachable | Settlement chain responds |
| 5 | L3 RPC is reachable | L3 chain responds |
| 6 | AP is reachable | Authorized Participant responds |
| 7 | ITP listing appears with at least one ITP | At least one ITP displayed |

### 01 — Connect Wallet (itp-data)
| # | Test | Summary |
|---|------|---------|
| 1 | connects wallet and shows truncated address | Wallet connection flow |
| 2 | disconnect button works | Wallet disconnection |
| 3 | wallet reconnects on page reload | Session persistence |

### 02 — Buy ITP (itp-data)
| # | Test | Summary |
|---|------|---------|
| 1 | full buy flow: mint USDC if needed, approve, buy, wait for fill | Complete buy flow with oracle consensus |

### 03 — Lending (itp-data)
| # | Test | Summary |
|---|------|---------|
| 1 | full lending cycle | Deposit collateral → borrow USDC → repay → withdraw |

### 04 — Sell ITP (itp-data)
| # | Test | Summary |
|---|------|---------|
| 1 | sell ITP shares | Sell flow with oracle consensus, verify shares decrease |

### 05 — Create ITP (itp-data)
| # | Test | Summary |
|---|------|---------|
| 1 | create ITP via frontend + Settlement bridge relay | Full ITP creation with bridge relay to L3 |

### 06 — Backtester Smoke (ui-verify-itp)
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

### 07 — Oracle Resilience (itp-data)
| # | Test | Summary |
|---|------|---------|
| 1 | kill 1/3 oracles — system continues, killed node recovers | 2/3 quorum survives |
| 2 | kill 2/3 oracles — system halts, recovers after quorum restored | System halts correctly |

> **Skipped on testnet** — requires `RUN_RESILIENCE=1` and local process control.

### 08 — Settlement Bridge Buy (itp-data)
| # | Test | Summary |
|---|------|---------|
| 1 | buy ITP via Settlement bridge | Settlement USDC → L3 Index + Settlement BridgedITP |
| 2 | sell ITP via Settlement bridge | BridgedITP burn → L3 burn + Settlement USDC return |

### 16 — Portfolio Regression (ui-verify-itp)
| # | Test | Summary |
|---|------|---------|
| 1 | user has ITP shares from previous buy | Order settled, not stuck |
| 2 | ITP card shows TVL as dollar amount (not "–") | TVL displays correctly |
| 3 | header and portfolio show same USDC balance | Balance consistency |
| 4 | Total Value includes USDC balance | Portfolio totals correct |

### 17 — Multi-ITP Lending Visibility (ui-verify-itp)
| # | Test | Summary |
|---|------|---------|
| 1 | lending markets table shows multiple ITPs | ITP2+ visible in lending |
| 2 | ITP2 row shows "Coming Soon" when no Morpho market | Graceful fallback |

### 18 — Multi-ITP Order Processing (itp-data)
| # | Test | Summary |
|---|------|---------|
| 1 | buy ITP2 order fills via oracle consensus | Multi-ITP buy pipeline |
| 2 | sell ITP2 order completes | Sell race condition fix verified |
| 3 | ITP1 sell still works after multi-ITP fix | Regression test |

### 22 — UI Fixes Validation (ui-verify-itp)
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

### 23 — API Routes Smoke (ui-verify-itp)
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

### 24 — Decimal Regression (ui-verify-itp)
| # | Test | Summary |
|---|------|---------|
| 1 | no 18+ digit numbers visible in body | Bigint leak scan |
| 2 | ITP NAV values in sane range ($0.01–$1000) | NAV range check |
| 3 | Vision balance shows formatted amount | Not raw wei |
| 4 | lending TVL under $10M | Catches raw wei display |

### 26 — Rebalance Full Cycle (itp-data)
| # | Test | Summary |
|---|------|---------|
| 1 | rebalance preserves NAV and updates weights | NAV preserved (<1% drift), weights changed |

### 27 — AP Endpoints (ui-verify-itp)
| # | Test | Summary |
|---|------|---------|
| 1 | GET /health returns valid status | AP health endpoint |

### 28 — System Health (ui-verify-itp)
| # | Test | Summary |
|---|------|---------|
| 1 | System Status section loads on /index#system | Section renders with "Active Oracles" |
| 2 | oracle nodes show active status | Alpha/Beta/Gamma visible via SSE (falls back to explorer health API) |
| 3 | consensus status resolves to Healthy, Offline, or checking | Status indicator present |
| 4 | orders total label is visible | Pending orders display |
| 5 | GET /api/explorer/health returns valid JSON | Explorer health API |
| 6 | Explorer page loads | /explorer renders heading |

### 32 — ITP Detail Page (ui-verify-itp)
| # | Test | Summary |
|---|------|---------|
| 1 | /itp/[itpId] page loads | SSR delivers heading |
| 2 | NAV per share in sane range | Dollar value matches $x.xxxx format |
| 3 | holdings table shows assets | BTC/ETH/SOL visible in holdings |

### 34 — Backtester Deploy Handoff (ui-verify-itp)
| # | Test | Summary |
|---|------|---------|
| 1 | simulation produces results with chart | Sidebar nav → backtest section, auto-run or manual run, stats/chart visible |

### 36 — Lending Curator (itp-data)
| # | Test | Summary |
|---|------|---------|
| 1 | lending section shows non-zero vault TVL | Vault TVL displays dollar amount (not "--") |
| 2 | markets table has rows with borrow APY | At least one data row, APY cells have content |

### 44 — ITP Liquidation (vision-data)
| # | Test | Summary |
|---|------|---------|
| 1 | health factor computation matches TypeScript library | Pure math: HF at various debt levels |
| 2 | liquidation price computation is correct | Pure math: liq price at 50 USDC / 100 ITP |
| 3 | Morpho market state verification | On-chain: contracts deployed, oracle non-zero, supply ≥ borrow, LLTV = 77% |

---

## Vision Project (vision-data + ui-verify-vision)

### 10 — Vision (vision-data)
| # | Test | Summary |
|---|------|---------|
| 1 | L3 chain is reachable | L3 RPC responds |
| 2 | Vision API responds | Backend API health |
| 3 | at least one batch exists | Batch data present |
| 4 | vision page loads and shows batch | UI renders batch |
| 5 | two players join batch and deposits settle | Opposing bets, USDC settle |

### 10 — Morpho Oracle Health (itp-data)
| # | Test | Summary |
|---|------|---------|
| 1 | oracle price is readable and matches deployment | Price read |
| 2 | oracle price change affects max borrow | Price sensitivity |
| 3 | LLTV boundary: cannot borrow beyond 77% | Liquidation threshold |
| 4 | oracle price update emits correct values | Event verification |
| 5 | market state is consistent | State consistency |

> Some tests skip if not IS_ANVIL (oracle price manipulation requires Anvil).

### 11 — Vision Sources (ui-verify-vision)
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

### 12 — Vision Deposit (vision-data)
| # | Test | Summary |
|---|------|---------|
| 1 | deposit USDC to Vision balance and verify on UI | L3 deposit flow |

### 13 — Vision Enter Batch (UI) (vision-data)
| # | Test | Summary |
|---|------|---------|
| 1 | enter batch via source detail page | Full batch entry via UI |

### 14 — Vision Claim + Withdraw (vision-data)
| # | Test | Summary |
|---|------|---------|
| 1 | withdraw from batch and Vision balance via UI | Full withdraw cycle after tick resolution |

### 15 — Display Formatting (vision-data)
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

### 19 — Vision Settlement Bridge Deposit (vision-data)
| # | Test | Summary |
|---|------|---------|
| 1 | deposit Settlement USDC → Vision virtual balance via backend | Cross-chain deposit |
| 2 | frontend shows updated balance after Settlement deposit | UI reflects deposit |

### 20 — Vision Settlement Withdraw (vision-data)
| # | Test | Summary |
|---|------|---------|
| 1 | withdraw to Settlement UI path shows correct options | UI options |
| 2 | virtual balance from Settlement deposit can be withdrawn | Withdraw flow |
| 3 | complete withdrawal from Vision virtual balance to Settlement USDC | Full withdraw cycle |

### 21 — Vision Claim Rewards (vision-data)
| # | Test | Summary |
|---|------|---------|
| 1 | balance proof fetchable via proxy after tick resolution | BLS proof fetch |
| 2 | bitmap submission works via proxy fan-out | Bitmap fan-out |

### 25 — Vision Tick Resolution (vision-data)
| # | Test | Summary |
|---|------|---------|
| 1 | tick resolves with opposite bets — balances change + pool conserved | Full tick lifecycle |

### 29 — Faucet (ui-verify-vision)
| # | Test | Summary |
|---|------|---------|
| 1 | POST /api/faucet rejects invalid address | 400 with error message |
| 2 | POST /api/faucet caps at 10,000 USDC | Amount cap enforcement |
| 3 | BalanceDepositModal shows Mint Test USDC button | UI: click DEPOSIT → modal → Mint → "1,000 USDC minted" |

### 30 — Vision Batch Entry (write-after)
| # | Test | Summary |
|---|------|---------|
| 1 | source detail page has Enter Batch panel with stake input | Panel visible on /source/coingecko |
| 2 | batch list shows at least one live or pending batch | NextBatches carousel or SourcesGrid renders |

### 31 — Portfolio & Orders (write-after)
| # | Test | Summary |
|---|------|---------|
| 1 | Portfolio section shows tabs | Positions tab visible after sidebar nav |
| 2 | Positions tab shows formatted values | No raw 18-digit numbers |
| 3 | Trades tab renders | Tab activates without crash, no raw wei |

### 33 — Vision Positions & Validation (ui-verify-vision)
| # | Test | Summary |
|---|------|---------|
| 1 | Enter Batch button requires predictions | Button disabled without predictions |
| 2 | balance bar shows after deposit | Deposit 10 USDC, verify on-chain + UI "Balance: … USDC" |

### 41 — Vision Round Lifecycle (vision-data, serial)
| # | Test | Summary |
|---|------|---------|
| 41a | active round exists | At least one active round (graceful pass if none) |
| 41b | two players join round with opposite bets | PLAYER1 + PLAYER2 join with opposite bitmaps |
| 41c | round auto-settles after betting window | Wait up to CONSENSUS_TIMEOUT for settlement |
| 41d | settlement results show correct predictions and PnL | Parimutuel conservation: sum(PnL) ≈ 0 |
| 41e | bitmaps are transparent after settlement | All players' predictions visible post-settlement |
| 41f | settled funds credited to Vision balance | Non-negative realBalance for both players |
| 41g | new round auto-created after settlement | Fresh round in "betting" status |

> Graceful pass on fresh deploy if no round-based sources are configured.

### 42 — Vision Leaderboard API (vision-data)
| # | Test | Summary |
|---|------|---------|
| 42a | leaderboard returns core fields | walletAddress, pnl, totalVolume + optional roundsPlayed |
| 42b | leaderboard includes round-based batch results | PLAYER1 from test 41 appears with round data |

> Graceful pass if no rounds have settled.

### 43 — Vision Concurrent Rounds (vision-data, serial)
| # | Test | Summary |
|---|------|---------|
| 43a | find 2 active rounds not yet joined by PLAYER1 | Needs ≥2 round-based sources |
| 43b | player joins both rounds independently | Join with random bets on each |
| 43c | positions exist on both batches with correct deposits | Both show totalDeposited + non-zero bitmapHash |
| 43d | total USDC deducted equals sum of both deposits | Balance decreased by ≥ 2× DEPOSIT |
| 43e | wait for at least one round to settle | Race: whichever settles first |
| 43f | settled round credits realBalance | Non-negative realBalance after payout |
| 43g | unsettled round position still active | Original deposit intact, settlement isolation |
| 43h | pool conservation on settled round | sum(payouts) ≈ sum(deposits) within 5% |

> Graceful pass if fewer than 2 active rounds available.

### 45 — Vision Leaderboard (vision-data)
| # | Test | Summary |
|---|------|---------|
| 1 | global leaderboard has players with non-zero PnL | ≥2 players with |PnL| > 0.001 |
| 2 | per-source leaderboard returns data via frontend proxy | source_id=defi query works |
| 3 | per-source leaderboard has non-zero PnL for active sources | ≥25% of sources with deployed batches have activity |
| 4 | all sources have leaderboard data | Broken sources < 50% of total deployed |
| 5 | leaderboard source_id mapping works (defillama → defi) | Frontend proxy translates display ID → internal ID |

> Graceful pass on fresh deploy if no rounds have settled.

### 45 — Vision Lock Phase UI (vision-data)
| # | Test | Summary |
|---|------|---------|
| 45a | betting phase shows enabled entry controls | Countdown, UP/DN buttons, quick-stake visible |
| 45b | lock phase indicators on NextBatches carousel | Red border cards for locked batches |
| 45c | round status reflects betting or locked via API | Each round has valid status + bettingEnd + timeframeSecs |

> Best-effort — lock phase timing depends on when the test runs relative to the round lifecycle.

### 46 — Vision Leaderboard Sorting (vision-data)
| # | Test | Summary |
|---|------|---------|
| 46a | leaderboard table renders with correct columns | #, Player, PnL, ROI, Win%, Volume headers present |
| 46b | leaderboard entries sorted by PnL descending | Each row PnL ≥ next row |
| 46c | no raw bigint values in leaderboard | No 18+ digit unformatted numbers |

---

## Swarm Project

### 40 — Vision Swarm (swarm, serial, 20m timeout)
| Stage | Test | Summary |
|-------|------|---------|
| 1 | infrastructure health | L3 RPC + data-node + ≥2/3 oracles reachable |
| 2 | fund and deploy swarm | Fund 10 bots with L3 USDC, start swarm containers |
| 3 | bots join batches | ≥80% of sampled batches have ≥5 bots with non-zero bitmaps |
| 4 | tick resolution via BLS consensus | ≥3 fast batches advance tick, balances change |
| 5 | frontend displays swarm data | Source cards visible, leaderboard shows bots |
| 6 | economic invariants hold | Solvency assertion (hard), per-batch conservation (soft/info) |

> Stage 4 graceful timeout if ticks have longer durations than 10m.

---

## Production Smoke (standalone)

### 35 — Production Smoke (production-smoke, no dependencies)

Read-only tests against `generalmarket.io` or any preview URL. No wallet, no transactions.

| Section | Tests | Summary |
|---------|-------|---------|
| **API Endpoints** | 10 | ITP-1/ITP-2 NAV, vision/batches, vision/snapshot, vision/snapshot/meta, vision/leaderboard (global + batch_id filter), market/history, explorer/health (history + latest) |
| **SSE Data Stream** | 2 | /dn proxy delivers itp-nav events with NAV data; /dn proxy delivers system-status events |
| **Vision Home (/)** | 3 | source cards grid, pool/player data (not all dashes), Connect Wallet button, footer |
| **Vision Source Detail** | 8 | 5 sources load without error (finnhub, earthquake, twitch, steam, tmdb), batch bar (Tick/Players/Pool), markets table with prices, batch entry panel, Top Players, set count + timer |
| **ITP Listing (/index)** | 4 | ITP table with fund data, NAV dollar values, AUM, Buy action button |
| **ITP Detail (/itp/[itpId])** | 1 | detail page loads with name, NAV, breadcrumbs |
| **Explorer (/explorer)** | 10 | page title + summary bar, tab navigation (11 tabs), time range buttons, Consensus/Orders/P2P/Cycles/System Health/Price Feeds/ITP & NAV/Chain & Gas/Vision tabs, API data feeds into charts |
| **Sources Health (/sources)** | 1 | page loads with source list |
| **Points (/points)** | 1 | page loads with season info |
| **Learn (/learn)** | 2 | article list, first article loads |
| **Static Pages** | 5 | /about, /terms, /privacy, /legal-index, /legal-vision |
| **Index Sub-Tabs** | 4 | all sidebar items visible, Create Index form, Backtesting simulation, System oracle nodes |
| **Additional Sources** | 5 | coingecko, yahoo_tech, weather, reddit, github source detail pages |
| **Navigation & Layout** | 3 | header nav, / → /source/earthquake, /index → ITP detail, 404 page |

---

## Tests Skipped on Testnet

| Test | Reason |
|------|--------|
| 07 — Oracle Resilience (all) | Requires local process kill/restart (`RUN_RESILIENCE=1`) |
| 23 #2 — POST /api/faucet | IS_ANVIL only |
| 10 — Morpho Oracle (some) | Oracle price manipulation requires Anvil |

---

## Missing E2E Coverage

### Medium Priority — /index (ITP)

| Gap | Feature | Details |
|-----|---------|---------|
| Order cancellation | Cancel pending order | `cancelOrder(orderId)` in modals |
| Backtest → Rebalance | Rebalance existing ITP from backtest results | Not tested |

### Medium Priority — /vision

| Gap | Feature | Details |
|-----|---------|---------|
| Script tab (Python) | Pyodide strategy editor | `ScriptTab` — algorithmic betting |
| Deposit more (existing) | Add funds to existing batch | `DepositModal` in-batch |

### Medium Priority — Infrastructure / System

| Gap | Feature | Details |
|-----|---------|---------|
| SSE system feed | Real-time system snapshot via SSE | `useSSESystem` → `useSystemStatus` — connectivity tested in 35 (prod smoke), not in testnet suite |
| AP balance rotation | Keeper balances with auto-rotate | `useApBalances` + `APBalanceCard` — not tested |
| Vault asset breakdown | Top vault assets with USD values | `topVaultAssets` in system status |

### Low Priority

| Gap | Feature | Details |
|-----|---------|---------|
| Chart modal | ITP price history chart | `ChartModal` with timeframe |
| Orderbook content | Bid/ask data, spread display | Only aggregation default tested (22#6) |
| AP Trades Feed | Real-time keeper trades | `VaultTradesFeed` |
| Cost basis card | Per-position avg buy price | `CostBasisCard` on ITP listing |
| Nonce stuck detection | Warn on stuck txs | `useNonceCheck` |
| Visual tab drag-paint | Drag-paint bitmap editing | `SourceCard` hover interaction |
| Bulk actions | All UP / All DOWN buttons | `ExpandedBatch` |
| Market search filtering | Search actually filters markets | 11#12 checks input exists, not filtering |
| 7-day price chart | Expandable row LineChart | `MarketsTable` |
| Multiplier display | Tick multiplier (1x–20x) | Rendered in `BatchEntryPanel` |
| GET /api/og/[wallet] | Dynamic OG image | Not tested |

---

## Running

```bash
# Switch to testnet env first
./switch-env.sh testnet

# Run all tests
cd frontend && npx playwright test --config=e2e/playwright.config.ts

# Run single project
npx playwright test --config=e2e/playwright.config.ts --project=itp-data
npx playwright test --config=e2e/playwright.config.ts --project=vision-data
npx playwright test --config=e2e/playwright.config.ts --project=ui-verify-itp
npx playwright test --config=e2e/playwright.config.ts --project=ui-verify-vision
npx playwright test --config=e2e/playwright.config.ts --project=write-after
npx playwright test --config=e2e/playwright.config.ts --project=swarm
npx playwright test --config=e2e/playwright.config.ts --project=production-smoke

# Run single file
npx playwright test --config=e2e/playwright.config.ts e2e/tests/02-buy-itp.spec.ts

# Production smoke against live site
E2E_FRONTEND_URL=https://www.generalmarket.io npx playwright test --config=e2e/playwright.config.ts --project=production-smoke
```
