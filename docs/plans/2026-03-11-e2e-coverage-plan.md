# E2E Coverage Expansion Plan

**Date**: 2026-03-11
**Ref**: `docs/e2e-tests-testnet.md` — gap analysis

## Goals

1. Cover all missing high/medium priority features
2. Add infrastructure/system health tests (currently broken, not caught)
3. Add faucet UI + API testnet coverage
4. Redesign parallelism: separate data-producing tests from UI verification tests

---

## Part 0 — Parallelism Redesign

### Problem

All tests run on 1 worker, fully serial (~30+ min on testnet). Two issues:
1. ITP and Vision share deployer nonce → can't run on-chain tests in parallel
2. Pure UI verification tests (15, 16, 22, 24) sit inside serial chains, blocking data-producing tests they don't need to block

### Solution: 3 Phases with Playwright `dependencies`

```
Phase 1: DATA (2 workers, parallel)
├── itp-data:    01 → 02 → 03 → 04 → 05 → 08 → 18 → 26
└── vision-data: 10 → 12 → 13 → 25 → 14 → 19 → 20 → 21

Phase 2: UI VERIFY (parallel workers, depends on Phase 1)
└── ui-verify:   00, 06, 11, 15, 16, 17, 22, 23, 24, 27
                 + new: 28, 29, 32, 33, 34, 35

Phase 3 (optional): WRITE-AFTER (depends on Phase 1)
└── write-after: 30, 31
```

### Why this works

- **Phase 1** produces all on-chain state (ITP shares, Vision positions, batches, bridge txs)
- **Phase 2** only reads/renders — safe to run in parallel, no nonce conflicts
- Tests 15, 16, 17, 22, 24 move OUT of itp-data/vision-data chains (they're pure UI)
- Tests 30 (create batch), 31 (order cancel) write on-chain but don't conflict with each other

### Separate wallets for Phase 1

| Chain | Wallet | Used by |
|-------|--------|---------|
| `itp-data` | `DEPLOYER_KEY` (existing) | ITP buy/sell/create, lending, bridge |
| `vision-data` | `PLAYER1_KEY` (new) | Vision deposits, batch entry, claims |

PLAYER2_KEY already exists for two-player tests (10, 25). PLAYER1 != PLAYER2.

### Dependency chain within each Phase 1 project

**itp-data** (serial, ordered):
```
01 connect wallet
 → 02 buy ITP (mints USDC, creates shares)
   → 03 lending (needs shares — deposits collateral, borrows, repays)
     → 04 sell ITP (needs shares from 02)
       → 05 create ITP (creates ITP2 on Settlement → L3)
         → 08 bridge buy/sell (needs ITP1, creates BridgedITP)
           → 18 multi-ITP orders (needs ITP2 from 05, BridgedITP from 08)
             → 26 rebalance (needs ITP1 with assets)
```

**vision-data** (serial, ordered):
```
10 vision join (2 players join batch, opposing bets)
 → 12 deposit (PLAYER1 deposits L3 USDC to Vision balance)
   → 13 enter batch UI (PLAYER1 joins ISS batch using Vision balance)
     → 25 tick resolution (waits for tick, verifies PnL distribution)
       → 14 claim + withdraw (exits position, withdraws to L3)
         → 19 settlement bridge deposit (locks Settlement USDC → virtual balance)
           → 20 settlement withdraw (virtual balance → Settlement USDC)
             → 21 claim rewards (BLS proof fetch, bitmap fan-out)
```

### What moves to ui-verify (was in itp/vision serial chains)

| Test | Was in | Why it moves |
|------|--------|-------------|
| 00 health check | itp | No data dependency, just pings endpoints |
| 06 backtester | itp | API-only, no on-chain state needed |
| 11 vision sources | vision | Reads source cards/categories, no user data |
| 15 display formatting | vision | Reads leaderboard/TVL/NAV, no writes |
| 16 portfolio regression | itp | Reads ITP shares/USDC, no writes |
| 17 multi-ITP lending | itp | Reads lending markets table, no writes |
| 22 UI fixes | itp | Checks slippage gear, orderbook, no writes |
| 23 API smoke | itp | GET endpoints, no writes |
| 24 decimal regression | itp | Scans page for bigint leaks, no writes |
| 27 AP endpoints | itp | Pings AP /health and /metrics |

### Config

```ts
// playwright.config.ts
projects: [
  // Phase 1: produce data (2 workers, parallel with each other, serial within)
  {
    name: 'itp-data',
    testMatch: /0[1-5]-|08-|18-|26-/,
  },
  {
    name: 'vision-data',
    testMatch: /1[0]-vision|12-|13-|25-|14-|19-|2[0-1]-/,
  },
  // Phase 2: verify UI (parallel workers, runs after data is produced)
  {
    name: 'ui-verify',
    dependencies: ['itp-data', 'vision-data'],
    testMatch: /00-|06-|10-morpho|11-|15-|16-|17-|22-|23-|24-|27-|28-|29-|32-|33-|34-|35-/,
  },
  // Phase 3: late writes (runs after data, doesn't conflict)
  {
    name: 'write-after',
    dependencies: ['itp-data', 'vision-data'],
    testMatch: /30-|31-/,
  },
],
workers: 3,
```

**Estimated speedup**: Phase 1 runs ITP + Vision in parallel (~15min each → 15min total instead of 30min). Phase 2 runs all UI tests in parallel (~3min). Total: ~18min vs ~35min.

---

## Part 1 — Infrastructure & System Health (test 28)

**File**: `frontend/e2e/tests/28-system-health.spec.ts`
**Phase**: `ui-verify` (needs data from Phase 1 for SSE to have content)

| # | Test | What it verifies |
|---|------|-----------------|
| 1 | System Status section loads on /index | `#system` section visible, not empty |
| 2 | SSE system feed connects | Wait for `useSSESystem` data (at least 1 node appears) |
| 3 | Oracle nodes show active status | At least 2/3 nodes show "Active" badge |
| 4 | Pending orders count is a number | Not NaN, not raw wei, not "Loading" |
| 5 | Fill time chart renders | Bar chart SVG present when recent orders exist |
| 6 | AP balance card shows values | `APBalanceCard` renders with non-zero balances |
| 7 | GET /api/explorer/health returns valid JSON | Missing from current API smoke tests |
| 8 | Explorer page loads | Navigate to `/explorer`, sections render |
| 9 | Explorer shows oracle consensus info | Consensus section not empty |

**Why**: System Status is currently broken and not caught.

---

## Part 2 — Faucet (test 29)

**File**: `frontend/e2e/tests/29-faucet.spec.ts`
**Phase**: `ui-verify` (API tests + UI modal check)

| # | Test | What it verifies |
|---|------|-----------------|
| 1 | POST /api/faucet mints USDC (testnet too) | Remove IS_ANVIL skip — works on testnet |
| 2 | POST /api/faucet rejects invalid address | `{ address: "bad" }` → 400 |
| 3 | POST /api/faucet caps at 10,000 USDC | `{ amount: "999999" }` → capped |
| 4 | BalanceDepositModal "Mint Test USDC" button | Open modal → click faucet → success message |
| 5 | L3 USDC balance increases after faucet | Read before/after, verify +1000 |

**Note**: Tests 1–3 are pure API (no wallet). Tests 4–5 need wallet fixture.

---

## Part 3 — Create Batch (test 30)

**File**: `frontend/e2e/tests/30-vision-create-batch.spec.ts`
**Phase**: `write-after` (writes on-chain, but doesn't conflict with other tests)

| # | Test | What it verifies |
|---|------|-----------------|
| 1 | Create Batch button opens modal | Modal appears with step 1 (Markets) |
| 2 | Step 1: select markets from registry | Search source, select ≥2 markets |
| 3 | Step 2: configure resolution + tick duration | Set UP_0, select duration |
| 4 | Step 3: preview shows selected markets | Summary table matches |
| 5 | Step 4: confirm creates batch on-chain | Tx confirms → batch appears in list |
| 6 | Set metadata + deployer name | `setBatchMetadata` + `setDeployerName` succeed |

**#1 gap** — core user flow, zero coverage.

---

## Part 4 — Portfolio & Orders (test 31)

**File**: `frontend/e2e/tests/31-portfolio-orders.spec.ts`
**Phase**: `write-after` (order cancellation writes on-chain)

| # | Test | What it verifies |
|---|------|-----------------|
| 1 | Positions tab shows ITP holdings | Tab switch → shares visible |
| 2 | Value tab shows PnL chart | Area chart SVG renders |
| 3 | Trades tab shows trade history | ≥1 trade from buy/sell |
| 4 | Orders tab shows recent orders | Orders visible |
| 5 | Order cancellation | Submit low-limit buy → cancel → status = cancelled |

---

## Part 5 — ITP Detail Page (test 32)

**File**: `frontend/e2e/tests/32-itp-detail-page.spec.ts`
**Phase**: `ui-verify`

| # | Test | What it verifies |
|---|------|-----------------|
| 1 | /itp/[itpId] page loads | ITP1 detail renders |
| 2 | NAV per share in sane range | $0.01–$1000 |
| 3 | AUM displayed as dollar amount | Not raw wei |
| 4 | Holdings table shows assets | ≥1 asset with symbol + weight |
| 5 | Asset count matches | Number matches on-chain state |

---

## Part 6 — Vision Positions & Tick Lock (test 33)

**File**: `frontend/e2e/tests/33-vision-positions.spec.ts`
**Phase**: `ui-verify` (reads positions created in Phase 1)

| # | Test | What it verifies |
|---|------|-----------------|
| 1 | MyPositions shows after joining batch | Section visible when position exists |
| 2 | Position row shows balance and P&L | Not raw wei |
| 3 | Click position navigates to batch | Quick nav works |
| 4 | Tick lock disables Enter Batch | Button locked during lock phase |

---

## Part 7 — Backtester Deploy Handoff (test 34)

**File**: `frontend/e2e/tests/34-backtester-deploy.spec.ts`
**Phase**: `ui-verify` (no on-chain writes, just UI handoff)

| # | Test | What it verifies |
|---|------|-----------------|
| 1 | Run simulation → "Deploy" button appears | Backtest completes → button visible |
| 2 | Deploy button populates Create section | Asset weights pre-filled from sim |

---

## Part 8 — Script Tab Smoke (test 35)

**File**: `frontend/e2e/tests/35-vision-script-tab.spec.ts`
**Phase**: `ui-verify`

| # | Test | What it verifies |
|---|------|-----------------|
| 1 | Script tab visible in expanded batch | Tab switcher shows SCRIPT |
| 2 | Python editor loads (Pyodide) | Editor renders, not stuck loading |
| 3 | Default template produces bitmap | Script runs → bitmap output generated |

**Note**: Pyodide is ~10MB WASM — extend timeout to 300s.

---

## Where New Tests Slot Into Existing Numbering

Current test order with new tests inserted at their correct phase:

### Phase 1: itp-data (serial)
```
01 connect wallet
02 buy ITP
03 lending
04 sell ITP
05 create ITP
08 bridge buy/sell
18 multi-ITP orders
26 rebalance
```

### Phase 1: vision-data (serial, parallel with itp-data)
```
10 vision join (2 players)
12 deposit
13 enter batch UI
25 tick resolution
14 claim + withdraw
19 settlement bridge deposit
20 settlement withdraw
21 claim rewards
```

### Phase 2: ui-verify (all parallel, after Phase 1)
```
00 health check
06 backtester smoke
10-morpho oracle health
11 vision sources
15 display formatting
16 portfolio regression
17 multi-ITP lending visibility
22 UI fixes
23 API routes smoke
24 decimal regression
27 AP endpoints
28 system health              ← NEW
29 faucet                     ← NEW
32 ITP detail page            ← NEW
33 vision positions & lock    ← NEW
34 backtester deploy handoff  ← NEW
35 script tab smoke           ← NEW
```

### Phase 3: write-after (parallel, after Phase 1)
```
30 create batch wizard        ← NEW
31 portfolio & order cancel   ← NEW
```

---

## Implementation Order

### Wave 1 — Parallelism infrastructure
1. Add `PLAYER1_KEY` to `frontend/e2e/env.ts`
2. Split wallet fixture to accept key parameter
3. Rewrite `playwright.config.ts` with 4 projects + dependencies
4. Move tests 00, 06, 11, 15, 16, 17, 22, 23, 24, 27 to `ui-verify` (just config change, no file edits)
5. Fund PLAYER1 on testnet (GM + USDC)
6. Verify existing tests still pass with new config

### Wave 2 — New tests (parallel agents, max 6)
- **Agent A**: 28-system-health + 29-faucet
- **Agent B**: 30-vision-create-batch
- **Agent C**: 31-portfolio-orders + 32-itp-detail-page
- **Agent D**: 33-vision-positions + 34-backtester-deploy + 35-script-tab

### Wave 3 — Validation
- Run full suite on testnet with new parallelism
- Fix any nonce conflicts or timing issues
- Update `docs/e2e-tests-testnet.md` with all new tests
- Remove IS_ANVIL skip from faucet in test 23

---

## Success Criteria

- [ ] All 8 new test files pass on testnet
- [ ] Full suite runs in ≤18min (down from ~35min)
- [ ] System Status breakage caught by test 28
- [ ] Faucet works on testnet (no IS_ANVIL skip)
- [ ] Create Batch wizard fully covered
- [ ] Zero nonce conflicts between parallel projects
- [ ] Phase 2 tests don't flake from missing data (Phase 1 always completes first)
