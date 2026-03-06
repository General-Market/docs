# E2E Testing Lessons — 2026-03-04

## Architecture: Why ITP and Vision Run Separately

Playwright config (`frontend/e2e/playwright.config.ts`) defines **2 projects**:

- **`itp`**: test files `0[0-6]-*, 0[89]-*, 1[6-8]-*` — ITP buy/sell/create/rebalance, bridge buy/sell, regressions
- **`vision`**: test files `1[0-5]-*, 19-*, 2[0-9]-*` — Vision sources, display formatting, Vision bridge

With `workers: 2` and `fullyParallel: false`:
- Worker 1 runs **all itp tests serially** (01→02→03→04→05→06→08→09→16→17→18)
- Worker 2 runs **all vision tests serially** (10→11→12→13→14→15→19→20→21)
- The two workers run **in parallel with each other**

**Why**: ITP tests have ordering dependencies (01 connects wallet, 02 buys, 04 sells what 02 bought). Vision tests are independent. Running them on separate workers halves total E2E time without breaking serial dependencies.

## Mistakes Made and Fixes

### 1. Wrong Regex for Stepper Text
**Bug**: Test 02-buy-itp waited for `/Batching|Filling/` but UI shows "Batching order..." and "Executing trades..." (from `buy-modal.json` i18n).
**Fix**: Changed to `/Batching order|Executing trades/`.
**Lesson**: Always check the actual i18n/translation file for UI text, not guessed labels. The source of truth is `frontend/messages/en/buy-modal.json` → `micro_steps.batch` and `micro_steps.fill`.

### 2. Race Condition — sharesBefore Recorded Too Early
**Bug**: Test 02-buy-itp recorded `sharesBefore` at test start. Meanwhile, parallel lending test (on worker 2) called `mintL3Shares` which inflated shares. By the time the buy order filled, `sharesAfter` seemed unchanged.
**Fix**: Moved `sharesBefore` recording to RIGHT BEFORE clicking the submit button.
**Lesson**: With parallel workers, any L3 chain state can change between tests. Record "before" state as late as possible, immediately before the action being tested.

### 3. Sell Test Minted Shares/USDC Artificially
**Bug**: 04-sell-itp called `mintL3Shares` and `mintL3Usdc` to create test state. User explicitly rejected this — "use what is in the system."
**Fix**: Rewritten to check existing shares from prior buy tests, skip if none available.
**Lesson**: For production-like testing, never mint/impersonate. Use natural system state. If a test depends on prior state, use `test.skip()` when state isn't available.

### 4. Fixture Timeout — Default 120s Too Short
**Bug**: `walletPage` fixture navigates to `/index` which compiles on first load. Under parallel load, this exceeded 120s default timeout.
**Fix**: Added `test.setTimeout(180_000)` to slow tests (01-connect-wallet tests 1 and 3).
**Lesson**: The `walletPage` fixture itself takes 30-90s under load (navigation + hydration + 2s buffer). Tests using it need at least 180s total timeout.

### 5. Strict Mode Violations (.or() and CSS locators)
**Bug**: `page.locator('.bg-card.border.border-border-light.rounded-xl')` matched 2 elements → strict mode error. Also `.or()` in one test.
**Fix**: Added `.first()` to multi-match locators.
**Lesson**: Always use `.first()` on CSS class locators that could match multiple elements. Prefer `getByRole`, `getByText`, or `getByTestId` which are more specific.

### 6. Redundant page.goto in walletPage Tests
**Bug**: Several tests in 15-display-formatting called `page.goto('/index')` even though the `walletPage` fixture already navigates there. This caused double navigation, wasting time and sometimes causing ERR_ABORTED.
**Fix**: Removed redundant `page.goto('/index')`.
**Lesson**: `walletPage` fixture ALWAYS navigates to `/index`. Tests using `walletPage` should NOT navigate to `/index` again. If a test needs a different page (e.g., `/source/coingecko`), it should navigate there with retry logic.

### 7. Navigation ERR_ABORTED Under Parallel Load
**Bug**: `page.goto('/source/coingecko')` failed with `net::ERR_ABORTED; maybe frame was detached?` — Next.js dev server under heavy load.
**Fix**: Wrapped in try-catch with retry: `try { await page.goto(...) } catch { await page.goto(...) }`.
**Lesson**: Any `page.goto()` in tests running under parallel load should have a retry or catch. The dev server compiles pages on first visit and can abort under resource pressure.

### 8. Stale Pending Orders on L3
**Bug**: After multiple test runs without restart, 4 pending buy orders accumulated on L3 that issuers never processed. Issuer's `get_pending_orders()` uses incremental cursor scanning — stale orders from previous sessions may not be re-scanned.
**Fix**: Restart system (stop.sh/start.sh) for clean state before full test run.
**Lesson**: Always restart the system before a full E2E run. Stale on-chain state from prior runs can confuse issuers. The issuer's `order_cursor` in `chain/reader.rs` (REORG_BUFFER=10 blocks) can miss orders submitted many blocks ago if the cursor has advanced.

### 9. Log File Bloat (~4GB)
**Bug**: Issuer logs grew to ~1GB+ each (3 issuers × ~1GB = 3GB+). Also rotated logs (`.2026-03-04` files) accumulated.
**Fix**: Deleted rotated logs, truncated current logs before test run.
**Lesson**: Before starting E2E tests, always clean logs: `truncate -s 0 logs/issuer-*.log` and `rm -f logs/issuer-*.2026-03-*`. Check disk space with `df -h`.

### 10. Stale Processes Taking Resources
**Bug**: Old `start.sh`, `tail -f`, and stale `zsh` shells from previous Claude sessions consumed memory/CPU.
**Fix**: `pkill -f "tail -f"` and kill stale processes before starting.
**Lesson**: Before E2E runs, check `ps aux | grep -E "start.sh|tail|issuer|anvil|data-node"` and kill stale processes.

## Key Architecture Notes

### Mock Wallet (`inject-wallet.ts`)
- Injected via `page.addInitScript()` — runs BEFORE any page JS
- Sets `from: ADDRESS` on `eth_sendTransaction` — Anvil accepts from any address
- Routes to correct chain RPC based on `currentChainId`
- `eth_accounts` returns `[]` until `eth_requestAccounts` is called (prevents auto-connect)
- No `anvil_impersonateAccount` needed — Anvil auto-accepts from all addresses in dev mode

### L3 vs Arb Orders
- **Bridge orders** (Arb → L3): Detected via `CrossChainOrderCreated` events on Arb. Issuers relay to L3 via `Index.submitOrder()`. Always work reliably.
- **Direct L3 orders** (UI buy/sell): User calls `Index.submitOrder()` directly on L3 via mock wallet. Detected by issuers via `OrderSubmitted` events + `get_pending_orders()` polling. Can be missed if issuer cursor advances past event block.
- L3-native processing: `run_l3_native_order_processing()` in `main.rs` line 2777. Skipped when `has_unmapped_bridge_orders()` is true.

### USDC Decimals
- L3: 18 decimals (L3_WUSDC)
- Arb: 6 decimals (ARB_USDC)
- The buy modal on frontend uses L3 amounts (18 dec). Never assume 6 everywhere.

### Issuer Consensus
- 3 issuers, BLS signatures, 2/3 threshold
- 1s cycle time (heartbeat-driven + work-driven)
- Price consensus: NAV oracle updates (~every cycle)
- Order consensus: batch + fill (triggered by pending orders)
- Vision: tick resolution + BLS balance proofs

### Test File Numbering Convention
```
01-connect-wallet     (itp worker)
02-buy-itp            (itp worker)
03-lending            (itp worker)
04-sell-itp           (itp worker)
05-create-itp         (itp worker)
06-rebalance          (itp worker)
08-arb-bridge-buy     (itp worker, backend-only)
09-arb-bridge-sell    (itp worker, backend-only)
10-vision-deposit     (vision worker)
11-vision-sources     (vision worker)
12-vision-buy-sell    (vision worker)
13-vision-batch-flow  (vision worker)
14-vision-claim       (vision worker)
15-display-formatting (vision worker)
16-17-18-regressions  (itp worker)
19-21-vision-bridge   (vision worker)
```

### walletPage Fixture Cost
The `walletPage` fixture:
1. Injects mock wallet script into browser context
2. Installs API interceptors (route interception)
3. Navigates to `/index` (first visit compiles page → 30-90s under load)
4. Waits for `__NEXT_DATA__` hydration (up to 15s)
5. 2s buffer for wagmi init

**Total fixture overhead: 35-100s per test under parallel load.**

Tests that don't need a wallet (e.g., 11-vision-sources) use plain `page` fixture and navigate directly — much faster (5-10s).

### backend-api.ts Key Functions
- `getL3UserShares(user, itpId)` — reads L3 shares directly from chain via RPC
- `getL3UsdcBalance(user)` — reads L3 USDC balance
- `getItpStateL3(itpId)` — reads ITP state (NAV, total supply, etc.)
- `placeBuyOrderDirect(user, itpId, amount, limitPrice)` — bypasses UI, calls contract directly
- `placeSellOrderDirect(user, itpId, amount)` — bypasses UI
- `pollUntil(fn, predicate, timeout, interval)` — generic polling helper
- `startArbBlockMiner(intervalMs)` — mines Arb blocks periodically (needed for event confirmation)
- `mintL3Shares`, `mintL3Usdc` — test helpers that impersonate and mint (NOT for production tests)

## Pre-E2E Checklist
1. Kill stale processes: `pkill -f "tail -f"`, check for old start.sh
2. Clean logs: `truncate -s 0 logs/issuer-*.log && rm -f logs/issuer-*.2026-03-*`
3. Fresh restart: `bash stop.sh && bash start.sh --vision --no-tail`
4. Wait for all 8 services: L3 (8545), Arb (8546), data-node (8200), issuers 1-3 (9001-9003), AP (9100), frontend (3000)
5. Verify health: `curl localhost:8200/health` and check issuer logs for "State reconstruction complete"
6. Run: `cd frontend && npx playwright test --config=e2e/playwright.config.ts`
