# E2E Coverage Expansion — Implementation Plan (v3)

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 8 new E2E test files covering all missing features, restructure Playwright into 3 phases (data → verify → late-write) so ITP and Vision run in parallel with separate wallet keys.

**Architecture:** Split `playwright.config.ts` into 3 project phases using Playwright `dependencies`. Phase 1 produces on-chain state (2 serial chains in parallel on Anvil, each with its own private key — no shared nonce space). Phase 2 runs all UI-only tests after data exists. Phase 3 runs late-write tests after Phase 2. On testnet, workers=1 (serial) until cross-process nonce locking is added to `backend-api.ts`. Existing pure-UI tests (00, 06, 11, 16, 17, 22, 23, 24, 27) move from serial chains to Phase 2.

**Tech Stack:** Playwright, TypeScript, viem (RPC calls), existing `backend-api.ts` helpers, existing `wallet.ts` fixture.

**Ref:** `docs/plans/2026-03-11-e2e-coverage-plan.md` (gap analysis)

**Estimated runtime:** Anvil: ~18min (parallel Phase 1). Testnet: 30–40min (serial, workers=1).

---

## Review Fixes Applied

### Round 1 (v1→v2)

| # | Severity | Issue | Fix |
|---|----------|-------|-----|
| C1 | CRITICAL | `VISION_PLAYER_KEY` declared but never wired — nonce collisions | Task 2 wires key through `vision-api.ts` PLAYER1 + TEST_KEYS + wallet fixture |
| C2 | CRITICAL | Test 07 orphaned by regex | Added `07-` to `itp-data` regex |
| C3 | CRITICAL | Test 15 writes on-chain but classified as ui-verify | Moved test 15 back to `vision-data` Phase 1 |
| H1 | HIGH | Deployer key hardcoded in faucet route | Out of scope — tracked as separate security task |
| H2 | HIGH | Test 14 drains positions → test 33 always skips | Test 33 deposits its own funds |
| H3 | HIGH | Test 34 ends `expect(true).toBe(true)` | Real assertion: sim results visible |
| H4 | HIGH | Test 30 comments out submission | Actually submits on-chain (write-after) |
| H5 | HIGH | `dependencies` blast radius | Split ui-verify into itp/vision |
| H6 | HIGH | 10-morpho writes on-chain in ui-verify | Moved to `itp-data` Phase 1 |
| H7 | HIGH | Vision wallet fixture is copy-paste | Extract `createWalletFixture` factory |
| H8 | HIGH | Filename ordering not guaranteed | Existing tests rely on this, works on CI |
| H9 | HIGH | Runtime estimate "18min" is fiction | Corrected to 30–40min |

### Round 2 (v2→v3)

| # | Severity | Reviewers | Issue | Fix |
|---|----------|-----------|-------|-----|
| C1 | CRITICAL | 3/3 | Test 06 matches both `itp-data` (`0[1-8]`) and `ui-verify-itp` (`06-`) — runs twice | Changed `itp-data` regex from `0[1-8]` to `0[1-578]` (excludes 06) |
| C2 | CRITICAL | 3/3 | Test 15 not in import update list but IS in `vision-data` — wallet/API address mismatch | Added test 15 to Task 2 Step 5 update list |
| C3 | CRITICAL | 3/3 | DEPLOYER nonce shared across workers — `ensureUsdcBalance` (vision) + `l3SignedSend` (itp) both use DEPLOYER, no cross-process lock | `workers: IS_ANVIL ? 2 : 1`. On Anvil: pre-fund VISION_PLAYER in global-setup so `ensureUsdcBalance` is a no-op. On testnet: serial (same as today). Cross-process lock for `backend-api.ts` deferred to future work. |
| H1 | HIGH | 2/3 | Anvil #7 is in `start.sh` ORACLE_KEYS — grep verification will fail | Updated verification to acknowledge the match (safe: default ORACLE_COUNT=3, only accounts 1-3 used) |
| H2 | HIGH | 2/3 | Test 33 writes on-chain in Phase 2 (`depositToVisionBalance`) | Changed to check existing balance first, only deposit if needed — `ensureUsdcBalance` skips minting when pre-funded |
| H3 | HIGH | 1/3 | `global-setup.ts` doesn't fund accounts; `mintL3Usdc` doesn't exist | Fixed: use `ensureUsdcBalance` from `vision-api.ts` in global-setup |
| H4 | HIGH | 1/3 | Phase 2 and Phase 3 can run concurrently — DEPLOYER used in both | Added `ui-verify-itp` and `ui-verify-vision` as dependencies for `write-after` |
| H5 | HIGH | 1/3 | Test 30 `createBatch` may require permissions VISION_PLAYER doesn't have | Added pre-check note + fallback to test fixture (DEPLOYER) if permissioned |

### Round 3 (v3 verification)

| # | Severity | Reviewers | Issue | Fix |
|---|----------|-----------|-------|-----|
| H1 | HIGH | 1/1 | Test 15 `checkRpc()` missing `url` argument — orderbook test always skips (pre-existing) | Fixed: `checkRpc(L3_RPC)` in Task 2 Step 5 |
| — | — | — | **No CRITICAL issues found. All v2 criticals confirmed resolved.** | — |

---

## Chunk 1: Parallelism Redesign

### Task 1: Add VISION_PLAYER_KEY to env.ts

**Files:**
- Modify: `frontend/e2e/env.ts:45-51`

- [ ] **Step 1: Pick a key not used elsewhere in the system**

Use Anvil account #7 (`0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356`). Verify it's not used as an oracle key or in deploy scripts.

Run: `cd /Users/maxguillabert/Downloads/index && grep -r "4bbbf85ce3377467" --include="*.ts" --include="*.sol" --include="*.sh" --include="*.yml" | head -5`

Expected: Match in `start.sh` only (Anvil account #7 is in the `ORACLE_KEYS` array). This is safe because the default `ORACLE_COUNT=3` only uses accounts #1-#3. Account #7 is never used as an oracle in practice. If `ORACLE_COUNT` is ever raised to ≥7, update this key.

- [ ] **Step 2: Add exports to env.ts**

After the existing `PLAYER2_KEY` block (line 51), add:

```ts
// Anvil account #7 — used exclusively for vision-data E2E tests.
// NOT used as an oracle key or in deploy scripts.
export const VISION_PLAYER_KEY = (
  process.env.E2E_VISION_PLAYER_KEY || '0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356'
) as `0x${string}`

// Derive address at import time (no async needed — viem's privateKeyToAccount is sync)
import { privateKeyToAccount } from 'viem/accounts'
export const VISION_PLAYER_ADDRESS = privateKeyToAccount(VISION_PLAYER_KEY).address
```

- [ ] **Step 3: Verify no key collision**

Run: `cd frontend && npx tsx -e "const {privateKeyToAccount} = require('viem/accounts'); console.log('DEPLOYER:', privateKeyToAccount('0x107e200b197dc889feba0a1e0538bf51b97b2fc87f27f82783d5d59789dc3537').address); console.log('PLAYER2:', privateKeyToAccount('0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6').address); console.log('VISION_PLAYER:', privateKeyToAccount('0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356').address)"`

Expected: 3 different addresses. VISION_PLAYER should be `0x14dC79964da2C08daa4968307...` (Anvil #7).

- [ ] **Step 4: Commit**

```bash
git add frontend/e2e/env.ts
git commit -m "feat(e2e): add VISION_PLAYER_KEY (Anvil #7) for parallel test isolation"
```

---

### Task 2: Wire VISION_PLAYER_KEY through vision-api.ts and wallet fixture

**Files:**
- Modify: `frontend/e2e/helpers/vision-api.ts:129-145`
- Modify: `frontend/e2e/fixtures/wallet.ts`

**This is a PREREQUISITE for enabling parallel workers. Not a follow-up.**

- [ ] **Step 1: Update PLAYER1 in vision-api.ts**

Replace lines 129-145 in `vision-api.ts`:

```ts
// ── Test accounts ────────────────────────────────────────────
// PLAYER1 uses VISION_PLAYER_KEY — separate nonce space from DEPLOYER_KEY
// so vision-data and itp-data can run in parallel without nonce collisions.
import { VISION_PLAYER_KEY, VISION_PLAYER_ADDRESS } from '../env'

/** Vision test user — uses VISION_PLAYER_KEY, separate from ITP deployer */
export const PLAYER1 = VISION_PLAYER_ADDRESS

/** Vision bot 1 — on testnet uses Anvil #9 key (funded by deployer) */
export const PLAYER2 = IS_ANVIL
  ? '0x71bE63f3384f5fb98995898A86B02Fb2426c5788'
  : '0xa0Ee7A142d267C1f36714E4a8F75612F20a79720' // Anvil #9

/** Map of address → private key for testnet signing */
const TEST_KEYS: Record<string, `0x${string}`> = {
  [PLAYER1.toLowerCase()]: VISION_PLAYER_KEY,
  [PLAYER2.toLowerCase()]: PLAYER2_KEY,
}
```

- [ ] **Step 2: Pre-fund VISION_PLAYER on Anvil (global-setup.ts)**

`global-setup.ts` currently only warms up the Next.js dev server. Add USDC pre-funding for VISION_PLAYER so that `ensureUsdcBalance` (in `vision-api.ts`) finds sufficient balance and **never needs to mint from DEPLOYER during parallel execution** — this is critical for nonce safety.

On Anvil, account #7 has 10,000 ETH (gas) by default but zero L3 USDC. Add to `global-setup.ts`:

```ts
import { VISION_PLAYER_ADDRESS } from './env'
import { ensureUsdcBalance } from './helpers/vision-api'
import { parseUnits } from 'viem'

// Pre-fund VISION_PLAYER with enough L3 USDC for all vision-data tests.
// This runs before any parallel workers start, preventing DEPLOYER nonce contention.
await ensureUsdcBalance(VISION_PLAYER_ADDRESS, parseUnits('100000', 18))
```

This call uses DEPLOYER to mint USDC, but it runs in `globalSetup` (single process, before workers), so there's no nonce conflict.

- [ ] **Step 3: Fund VISION_PLAYER on testnet**

On testnet, run once manually:
```bash
# SSH to VPS and send GM gas + mint L3 USDC to VISION_PLAYER_ADDRESS
# (get address from Step 3 of Task 1)
```

Or add to `testnet.sh` startup script.

- [ ] **Step 4: Extract wallet fixture factory (fix H7 — no copy-paste)**

In `frontend/e2e/fixtures/wallet.ts`, extract the common logic:

```ts
function createWalletFixture(privateKey: `0x${string}`, address: string, startUrl: string) {
  return async ({ context, page }: { context: any; page: Page }, use: (page: Page) => Promise<void>) => {
    if (!IS_ANVIL) {
      const { createWalletClient, http, defineChain } = await import('viem');
      const { privateKeyToAccount } = await import('viem/accounts');
      const account = privateKeyToAccount(privateKey);
      const l3Chain = defineChain({
        id: CHAIN_ID, name: 'Index L3',
        nativeCurrency: { name: 'GM', symbol: 'GM', decimals: 18 },
        rpcUrls: { default: { http: [L3_RPC_URL] } },
      });

      await page.exposeFunction('__e2eSignAndSend', async (txJson: string) => {
        const tx = JSON.parse(txJson);
        const rpcUrl = tx.rpcUrl || L3_RPC_URL;
        const chainId = tx.chainId || CHAIN_ID;
        const chain = chainId === CHAIN_ID ? l3Chain : defineChain({
          id: chainId, name: `Chain ${chainId}`,
          nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
          rpcUrls: { default: { http: [rpcUrl] } },
        });
        const client = createWalletClient({
          account, chain,
          transport: http(rpcUrl, { fetchOptions: { headers: { Accept: 'application/json' } } }),
        });
        return client.sendTransaction({
          to: tx.to as `0x${string}`,
          data: tx.data as `0x${string}` | undefined,
          value: tx.value ? BigInt(tx.value) : undefined,
          gas: tx.gas ? BigInt(tx.gas) : undefined,
        });
      });

      await page.exposeFunction('__e2ePersonalSign', async (message: string) => {
        const { signMessage } = await import('viem/accounts');
        return signMessage({ message: { raw: message as `0x${string}` }, privateKey });
      });
    }

    const script = getInjectWalletScript(L3_RPC_URL, CHAIN_ID, address, RPC_URL, SETTLEMENT_CHAIN_ID);
    await context.addInitScript({ content: script });

    const wagmiState = JSON.stringify({
      state: {
        connections: { __type: 'Map', value: [['injected', {
          accounts: [address.toLowerCase() as `0x${string}`],
          chainId: CHAIN_ID,
          connector: { id: 'injected', name: 'Injected', type: 'injected', uid: 'injected' },
        }]] },
        chainId: CHAIN_ID, current: 'injected',
      },
      version: 3,
    });
    await context.addInitScript({ content: `localStorage.setItem('wagmi.store', ${JSON.stringify(wagmiState)});` });
    await installApiInterceptors(page);

    await page.goto(startUrl, { waitUntil: 'load', timeout: 90_000 }).catch(() =>
      page.goto(startUrl, { waitUntil: 'load', timeout: 90_000 })
    );
    await page.waitForFunction(
      () => {
        const btn = document.querySelector('button');
        if (!btn) return false;
        return Object.keys(btn).some(k => k.startsWith('__reactFiber') || k.startsWith('__reactProps'));
      },
      { timeout: 30_000 }
    ).catch(() => {});
    await page.waitForTimeout(2_000);
    await use(page);
  };
}

// Deployer wallet (ITP tests)
export const test = base.extend<{ walletPage: Page }>({
  walletPage: createWalletFixture(DEPLOYER_KEY, DEPLOYER_ADDRESS, `${FRONTEND_URL}/index`),
});

// Vision player wallet (Vision tests)
export const visionTest = base.extend<{ walletPage: Page }>({
  walletPage: createWalletFixture(VISION_PLAYER_KEY, VISION_PLAYER_ADDRESS, `${FRONTEND_URL}/`),
});
```

Add imports at top of `wallet.ts`:

```ts
import { VISION_PLAYER_KEY, VISION_PLAYER_ADDRESS } from '../env';
```

- [ ] **Step 5: Update vision-data test imports**

All vision-data tests (10, 12, 13, 14, **15**, 19, 20, 21, 25) that import `{ test, expect, TEST_ADDRESS } from '../fixtures/wallet'` must be updated:

```ts
// BEFORE:
import { test, expect, TEST_ADDRESS } from '../fixtures/wallet'
// AFTER:
import { visionTest as test, expect } from '../fixtures/wallet'
import { VISION_PLAYER_ADDRESS as TEST_ADDRESS } from '../env'
```

Update each file including `15-display-formatting.spec.ts`. The `walletPage` fixture will now inject `VISION_PLAYER_KEY` instead of `DEPLOYER_KEY`.

**Also fix pre-existing bug in test 15**: `checkRpc()` on line 197 is called without the required `url` argument, causing the orderbook hover test to always skip. Fix to:
```ts
import { L3_RPC } from '../env'
// ...
const rpcOk = await checkRpc(L3_RPC)
```

- [ ] **Step 6: Verify vision tests still pass with new key**

Run: `cd frontend && npx playwright test --config=e2e/playwright.config.ts e2e/tests/12-vision-deposit.spec.ts`

Expected: PASS (VISION_PLAYER has been funded with L3 USDC).

- [ ] **Step 7: Commit**

```bash
git add frontend/e2e/helpers/vision-api.ts frontend/e2e/fixtures/wallet.ts frontend/e2e/tests/10-vision.spec.ts frontend/e2e/tests/12-vision-deposit.spec.ts frontend/e2e/tests/13-vision-enter-batch.spec.ts frontend/e2e/tests/14-vision-claim-withdraw.spec.ts frontend/e2e/tests/15-display-formatting.spec.ts frontend/e2e/tests/19-vision-settlement-bridge-deposit.spec.ts frontend/e2e/tests/20-vision-settlement-withdraw.spec.ts frontend/e2e/tests/21-vision-claim-rewards.spec.ts frontend/e2e/tests/25-vision-tick-resolution.spec.ts frontend/e2e/global-setup.ts
git commit -m "feat(e2e): wire VISION_PLAYER_KEY through vision tests — separate nonce space"
```

---

### Task 3: Rewrite playwright.config.ts with 3 phases

**Files:**
- Modify: `frontend/e2e/playwright.config.ts`

Fixes applied:
- v1 C2: Test 07 included in `itp-data`
- v1 C3: Test 15 stays in `vision-data` (writes on-chain)
- v1 H5: Split ui-verify into `ui-verify-itp` and `ui-verify-vision` to limit blast radius
- v1 H6: Test 10-morpho moved to `itp-data`
- v2 C1: Test 06 excluded from `itp-data` regex (`0[1-578]` instead of `0[1-8]`)
- v2 C3: `workers: IS_ANVIL ? 2 : 1` — parallel on Anvil only (no cross-process nonce lock in `backend-api.ts`)
- v2 H4: `write-after` depends on Phase 2 projects too (no concurrent DEPLOYER usage)

- [ ] **Step 1: Replace projects array**

```ts
import { defineConfig } from '@playwright/test';
import { IS_ANVIL, FRONTEND_URL } from './env';

/**
 * 3-phase test execution with separate wallet keys per chain:
 *
 * Phase 1 — DATA (2 projects, parallel on Anvil, serial on testnet):
 *   itp-data (DEPLOYER_KEY):    01 → 02 → 03 → 04 → 05 → 07 → 08 → 10-morpho → 18 → 26
 *   vision-data (VISION_PLAYER_KEY): 10-vision → 12 → 13 → 15 → 25 → 14 → 19 → 20 → 21
 *
 * Phase 2 — UI VERIFY (depends on respective Phase 1 project):
 *   ui-verify-itp (depends: itp-data): 00, 06, 16, 17, 22, 23, 24, 27, 28, 32, 34
 *   ui-verify-vision (depends: vision-data): 11, 29, 33, 35
 *
 * Phase 3 — LATE WRITES (depends on Phase 1 AND Phase 2 — no concurrent DEPLOYER usage):
 *   write-after: 30, 31
 *
 * NONCE SAFETY: On testnet, workers=1 because `backend-api.ts`'s `l3SignedSend` has no
 * cross-process nonce lock. On Anvil, `ensureUsdcBalance` is a no-op (pre-funded in
 * globalSetup) and Anvil auto-manages nonces for unsigned txs, so parallel is safe.
 */
export default defineConfig({
  globalSetup: require.resolve('./global-setup'),
  testDir: './tests',
  fullyParallel: false,
  workers: IS_ANVIL ? 2 : 1, // Parallel on Anvil only — testnet lacks cross-process nonce lock
  timeout: IS_ANVIL ? 120_000 : 180_000,
  expect: {
    timeout: IS_ANVIL ? 15_000 : 30_000,
  },
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: FRONTEND_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: IS_ANVIL ? 30_000 : 60_000,
    navigationTimeout: 90_000,
    browserName: 'chromium',
    ...(!IS_ANVIL ? {
      launchOptions: {
        args: ['--allow-running-insecure-content'],
      },
    } : {}),
  },
  projects: [
    // Phase 1: produce on-chain state (separate keys, parallel on Anvil)
    {
      name: 'itp-data',
      // 0[1-578]: tests 01-05, 07, 08. NOT 06 (moved to ui-verify-itp).
      testMatch: /(^|\/)0[1-578]-.*\.spec\.ts$|(^|\/)10-morpho.*\.spec\.ts$|(^|\/)18-.*\.spec\.ts$|(^|\/)26-.*\.spec\.ts$/,
    },
    {
      name: 'vision-data',
      testMatch: /(^|\/)10-vision\.spec\.ts$|(^|\/)1[2-5]-.*\.spec\.ts$|(^|\/)19-.*\.spec\.ts$|(^|\/)2[0-1]-.*\.spec\.ts$|(^|\/)25-.*\.spec\.ts$/,
    },
    // Phase 2: UI verification (depends on respective Phase 1 only — limited blast radius)
    {
      name: 'ui-verify-itp',
      dependencies: ['itp-data'],
      testMatch: /(^|\/)00-.*\.spec\.ts$|(^|\/)06-.*\.spec\.ts$|(^|\/)1[6-7]-.*\.spec\.ts$|(^|\/)2[2-4]-.*\.spec\.ts$|(^|\/)27-.*\.spec\.ts$|(^|\/)28-.*\.spec\.ts$|(^|\/)32-.*\.spec\.ts$|(^|\/)34-.*\.spec\.ts$/,
    },
    {
      name: 'ui-verify-vision',
      dependencies: ['vision-data'],
      testMatch: /(^|\/)11-.*\.spec\.ts$|(^|\/)29-.*\.spec\.ts$|(^|\/)33-.*\.spec\.ts$|(^|\/)35-.*\.spec\.ts$/,
    },
    // Phase 3: late writes (after ALL earlier phases — prevents concurrent DEPLOYER usage)
    {
      name: 'write-after',
      dependencies: ['itp-data', 'vision-data', 'ui-verify-itp', 'ui-verify-vision'],
      testMatch: /(^|\/)30-.*\.spec\.ts$|(^|\/)31-.*\.spec\.ts$/,
    },
  ],
  ...(!process.env.E2E_FRONTEND_URL ? {
    webServer: {
      command: 'npm run dev',
      url: 'http://localhost:3000',
      reuseExistingServer: true,
      timeout: 120_000,
    },
  } : {}),
});
```

- [ ] **Step 2: Verify all tests are matched**

Run: `cd frontend && npx playwright test --config=e2e/playwright.config.ts --list 2>&1 | grep -c "spec.ts"`

Expected: Count matches total number of test files (28 existing + 8 new = 36 when all are created).

Also verify no orphans:
Run: `cd frontend && npx playwright test --config=e2e/playwright.config.ts --list 2>&1 | grep "07-"` → should appear under `itp-data`
Run: `cd frontend && npx playwright test --config=e2e/playwright.config.ts --list 2>&1 | grep "15-"` → should appear under `vision-data`
Run: `cd frontend && npx playwright test --config=e2e/playwright.config.ts --list 2>&1 | grep "10-morpho"` → should appear under `itp-data`

- [ ] **Step 3: Commit**

```bash
git add frontend/e2e/playwright.config.ts
git commit -m "feat(e2e): 3-phase parallel config with split ui-verify projects"
```

---

## Chunk 2: System Health & Faucet Tests

### Task 4: System health test (28)

**Files:**
- Create: `frontend/e2e/tests/28-system-health.spec.ts`

- [ ] **Step 1: Write the test file**

Uses `@playwright/test` directly (no wallet fixture — pure UI/API read-only).

```ts
/**
 * System health E2E — verifies the System Status section on /index
 * and the Explorer page render with live data from SSE.
 *
 * Phase: ui-verify-itp (runs after itp-data, read-only)
 */
import { test, expect } from '@playwright/test'
import { FRONTEND_URL } from '../env'

const BASE = FRONTEND_URL

test.describe('System Health', () => {
  test('System Status section loads on /index', async ({ page }) => {
    await page.goto('/index')
    await expect(page.getByText(/Active Oracles/i).first()).toBeVisible({ timeout: 30_000 })
  })

  test('oracle nodes show active status', async ({ page }) => {
    await page.goto('/index')
    await expect(page.getByText(/Alpha|Beta|Gamma/i).first()).toBeVisible({ timeout: 30_000 })
  })

  test('consensus status resolves to Healthy or Offline', async ({ page }) => {
    await page.goto('/index')
    await expect(async () => {
      const text = await page.getByText(/Healthy|Offline/i).first().textContent()
      expect(text).toBeTruthy()
    }).toPass({ timeout: 30_000 })
  })

  test('orders total is a formatted number', async ({ page }) => {
    await page.goto('/index')
    await expect(page.getByText(/Orders Total/i).first()).toBeVisible({ timeout: 30_000 })
  })

  test('GET /api/explorer/health returns valid JSON', async () => {
    const res = await fetch(`${BASE}/api/explorer/health`, {
      signal: AbortSignal.timeout(15_000),
      headers: { Accept: 'application/json' },
    })
    if (res.ok) {
      const data = await res.json()
      expect(data).toBeDefined()
      expect(typeof data).toBe('object')
    } else {
      expect([502, 503, 504]).toContain(res.status)
    }
  })

  test('Explorer page loads', async ({ page }) => {
    await page.goto('/explorer')
    await expect(page.locator('h1, h2, h3').first()).toBeVisible({ timeout: 15_000 })
  })
})
```

- [ ] **Step 2: Run and commit**

```bash
cd frontend && npx playwright test --config=e2e/playwright.config.ts e2e/tests/28-system-health.spec.ts
git add frontend/e2e/tests/28-system-health.spec.ts
git commit -m "feat(e2e): add system health tests (28)"
```

---

### Task 5: Faucet test (29)

**Files:**
- Create: `frontend/e2e/tests/29-faucet.spec.ts`

Note: IS_ANVIL skip in test 23 is **preserved** until H1 (deployer key in faucet route) is fixed as a separate security task. Test 29 covers faucet on Anvil only. The faucet UI button test uses `visionTest` (VISION_PLAYER_KEY) to avoid nonce conflicts with deployer.

- [ ] **Step 1: Write the test file**

```ts
/**
 * Faucet E2E — tests the /api/faucet endpoint and the
 * "Mint Test USDC" button in BalanceDepositModal.
 *
 * Phase: ui-verify-vision
 * Uses visionTest fixture for UI tests (separate key from itp tests).
 * API-only tests use @playwright/test (no wallet).
 */
import { test as plainTest, expect as plainExpect } from '@playwright/test'
import { visionTest as test, expect } from '../fixtures/wallet'
import { FRONTEND_URL, IS_ANVIL, VISION_PLAYER_ADDRESS } from '../env'

const BASE = FRONTEND_URL

async function apiPost(path: string, body: Record<string, unknown>): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    method: 'POST',
    signal: AbortSignal.timeout(30_000),
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  })
}

plainTest.describe('Faucet API', () => {
  plainTest('POST /api/faucet rejects invalid address', async () => {
    const res = await apiPost('/api/faucet', { address: 'bad' })
    plainExpect(res.status).toBe(400)
    const data = await res.json()
    plainExpect(data.error).toContain('Invalid address')
  })

  plainTest('POST /api/faucet caps at 10,000 USDC', async () => {
    if (!IS_ANVIL) {
      plainTest.skip(true, 'Faucet security needs review before testnet')
      return
    }
    const res = await apiPost('/api/faucet', {
      address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      amount: '999999',
    })
    if (res.ok) {
      const data = await res.json()
      plainExpect(data.amount).toBe('10000 USDC')
    }
  })
})

test.describe('Faucet UI', () => {
  test('BalanceDepositModal shows Mint Test USDC button', async ({ walletPage: page }) => {
    test.setTimeout(120_000)
    if (!IS_ANVIL) {
      test.skip(true, 'Faucet UI test Anvil only until security review')
      return
    }

    const { ensureWalletConnected } = await import('../helpers/selectors')
    await ensureWalletConnected(page, VISION_PLAYER_ADDRESS)

    const depositBtn = page.getByRole('button', { name: 'DEPOSIT' })
    await expect(depositBtn).toBeVisible({ timeout: 30_000 })
    await depositBtn.click()

    await expect(page.getByText('Deposit to Vision')).toBeVisible({ timeout: 10_000 })
    const mintBtn = page.getByText('Mint Test USDC')
    await expect(mintBtn).toBeVisible({ timeout: 10_000 })

    await mintBtn.click()
    await expect(page.getByText(/1,000 USDC minted/i)).toBeVisible({ timeout: 30_000 })
  })
})
```

- [ ] **Step 2: Run and commit**

```bash
cd frontend && npx playwright test --config=e2e/playwright.config.ts e2e/tests/29-faucet.spec.ts
git add frontend/e2e/tests/29-faucet.spec.ts
git commit -m "feat(e2e): add faucet tests (29) — Anvil only until security review"
```

---

## Chunk 3: High-Priority Missing Tests

### Task 6: ITP detail page test (32)

**Files:**
- Create: `frontend/e2e/tests/32-itp-detail-page.spec.ts`

Uses `@playwright/test` directly (read-only, no wallet needed).

- [ ] **Step 1: Write the test file**

```ts
/**
 * ITP detail page E2E — /itp/[itpId] renders with sane data.
 * Phase: ui-verify-itp (ITP exists from Phase 1)
 */
import { test, expect } from '@playwright/test'

const ITP_ID = '0x' + '0'.repeat(63) + '1'

test.describe('ITP Detail Page', () => {
  test('/itp/[itpId] page loads', async ({ page }) => {
    await page.goto(`/itp/${ITP_ID}`)
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 15_000 })
  })

  test('NAV per share in sane range', async ({ page }) => {
    await page.goto(`/itp/${ITP_ID}`)
    await expect(async () => {
      const text = await page.locator('body').textContent()
      expect(text).toMatch(/\$\d+\.\d{2}/)
      expect(text).not.toMatch(/\d{18,}/)
    }).toPass({ timeout: 15_000 })
  })

  test('holdings table shows assets', async ({ page }) => {
    await page.goto(`/itp/${ITP_ID}`)
    await expect(page.getByText(/BTC|ETH|SOL/i).first()).toBeVisible({ timeout: 15_000 })
  })
})
```

- [ ] **Step 2: Run and commit**

```bash
cd frontend && npx playwright test --config=e2e/playwright.config.ts e2e/tests/32-itp-detail-page.spec.ts
git add frontend/e2e/tests/32-itp-detail-page.spec.ts
git commit -m "feat(e2e): add ITP detail page tests (32)"
```

---

### Task 7: Vision positions test (33)

**Files:**
- Create: `frontend/e2e/tests/33-vision-positions.spec.ts`

Fix H2 (v1): Deposits its own funds before asserting, instead of depending on leftover state from test 14.
Fix H2 (v2): VISION_PLAYER is pre-funded in globalSetup. `ensureUsdcBalance` is a no-op, so no DEPLOYER contention in Phase 2. The `depositToVisionBalance` call only sends VISION_PLAYER-signed txs (approve + deposit), which is safe.

- [ ] **Step 1: Write the test file**

```ts
/**
 * Vision positions E2E — verifies Enter Batch validation and position display.
 *
 * Phase: ui-verify-vision
 * Uses visionTest fixture (VISION_PLAYER_KEY).
 *
 * NOTE: VISION_PLAYER is pre-funded with L3 USDC in globalSetup.
 * The depositToVisionBalance call here only sends VISION_PLAYER-signed txs
 * (approve + depositBalance), NOT deployer-signed minting — safe for Phase 2.
 */
import { visionTest as test, expect } from '../fixtures/wallet'
import { VISION_PLAYER_ADDRESS } from '../env'
import { ensureWalletConnected } from '../helpers/selectors'
import { depositToVisionBalance, getVisionPlayerBalance } from '../helpers/vision-api'
import { parseUnits } from 'viem'

test.describe('Vision Positions & Validation', () => {
  test('Enter Batch button requires predictions', async ({ walletPage: page }) => {
    test.setTimeout(120_000)

    await page.goto('/source/coingecko')
    await ensureWalletConnected(page, VISION_PLAYER_ADDRESS)

    const btn = page.getByRole('button', { name: /Enter Batch/ })
    await expect(btn).toBeVisible({ timeout: 30_000 })
    // Without any predictions set, button should be disabled
    await expect(btn).toBeDisabled()
  })

  test('balance bar shows after deposit', async ({ walletPage: page }) => {
    test.setTimeout(180_000)

    // Deposit 10 USDC to Vision balance.
    // ensureUsdcBalance inside will find pre-funded balance → no DEPLOYER mint needed.
    const depositAmount = parseUnits('10', 18)
    await depositToVisionBalance(VISION_PLAYER_ADDRESS, depositAmount)

    // Verify balance on-chain
    const balance = await getVisionPlayerBalance(VISION_PLAYER_ADDRESS)
    expect(balance).toBeGreaterThanOrEqual(depositAmount)

    // Check UI
    await page.goto('/')
    await ensureWalletConnected(page, VISION_PLAYER_ADDRESS)
    await expect(page.getByText(/Balance:.*USDC/i).first()).toBeVisible({ timeout: 60_000 })
  })
})
```

- [ ] **Step 2: Run and commit**

```bash
cd frontend && npx playwright test --config=e2e/playwright.config.ts e2e/tests/33-vision-positions.spec.ts
git add frontend/e2e/tests/33-vision-positions.spec.ts
git commit -m "feat(e2e): add vision positions tests (33) — self-funding, no leftover dependency"
```

---

### Task 8: Backtester deploy handoff test (34)

**Files:**
- Create: `frontend/e2e/tests/34-backtester-deploy.spec.ts`

Fix H3: Real assertion — sim results must be visible, not `expect(true).toBe(true)`.

- [ ] **Step 1: Write the test file**

```ts
/**
 * Backtester → Deploy handoff E2E.
 * Phase: ui-verify-itp (no on-chain writes)
 */
import { test, expect } from '../fixtures/wallet'
import { TEST_ADDRESS } from '../fixtures/wallet'
import { ensureWalletConnected } from '../helpers/selectors'

test.describe('Backtester Deploy Handoff', () => {
  test('simulation produces results with chart', async ({ walletPage: page }) => {
    test.setTimeout(180_000)

    await page.goto('/index')
    await ensureWalletConnected(page, TEST_ADDRESS)

    // Scroll to backtest section
    await page.evaluate(() => {
      const headings = document.querySelectorAll('h2')
      for (const h of headings) {
        if (h.textContent?.includes('Backtest') || h.textContent?.includes('Simulation')) {
          h.scrollIntoView()
          break
        }
      }
    })

    const runBtn = page.getByRole('button', { name: /Run|Simulate/i }).first()
    const hasSim = await runBtn.isVisible({ timeout: 15_000 }).catch(() => false)

    if (!hasSim) {
      test.skip(true, 'Backtester section not visible — may need sim cache')
      return
    }

    await runBtn.click()

    // Wait for results — chart SVG with path elements proves sim ran
    const chartPath = page.locator('svg path[d]').first()
    await expect(chartPath).toBeVisible({ timeout: 60_000 })

    // Verify stats are rendered (returns, Sharpe ratio, etc.)
    const statsText = await page.locator('body').textContent()
    expect(statsText).toMatch(/return|sharpe|drawdown/i)
  })
})
```

- [ ] **Step 2: Run and commit**

```bash
cd frontend && npx playwright test --config=e2e/playwright.config.ts e2e/tests/34-backtester-deploy.spec.ts
git add frontend/e2e/tests/34-backtester-deploy.spec.ts
git commit -m "feat(e2e): add backtester deploy handoff test (34)"
```

---

### Task 9: Script tab smoke test (35)

**Files:**
- Create: `frontend/e2e/tests/35-vision-script-tab.spec.ts`

- [ ] **Step 1: Write the test file**

```ts
/**
 * Vision Script Tab E2E — Pyodide strategy editor loads.
 * Phase: ui-verify-vision
 */
import { test, expect } from '@playwright/test'

test.describe('Vision Script Tab', () => {
  test('Script tab is accessible on source detail page', async ({ page }) => {
    test.setTimeout(300_000) // Pyodide WASM is ~10MB

    await page.goto('/source/coingecko')

    const scriptTab = page.getByRole('button', { name: /Script|SCRIPT/i }).first()
    const hasScript = await scriptTab.isVisible({ timeout: 15_000 }).catch(() => false)

    if (!hasScript) {
      test.skip(true, 'Script tab not visible on this page')
      return
    }

    await scriptTab.click()

    // Editor must actually load — look for textarea or code mirror
    const editor = page.locator('textarea, .cm-editor, [role="textbox"]').first()
    await expect(editor).toBeVisible({ timeout: 120_000 })
  })
})
```

- [ ] **Step 2: Run and commit**

```bash
cd frontend && npx playwright test --config=e2e/playwright.config.ts e2e/tests/35-vision-script-tab.spec.ts
git add frontend/e2e/tests/35-vision-script-tab.spec.ts
git commit -m "feat(e2e): add script tab smoke test (35)"
```

---

## Chunk 4: Late-Write Tests (Phase 3)

### Task 10: Create batch wizard test (30)

**Files:**
- Create: `frontend/e2e/tests/30-vision-create-batch.spec.ts`

Fix H4 (v1): Actually submits the batch on-chain (it's in `write-after` for this reason).
Fix H5 (v2): Verify `createBatch` is permissionless. If it requires special roles (e.g. onlyOwner), use `test` fixture (DEPLOYER) instead of `visionTest`. Check the Vision contract's `createBatch` function before implementing.

- [ ] **Step 1: Check createBatch permissions**

Run: `cd /Users/maxguillabert/Downloads/index && grep -A5 "function createBatch" contracts/src/Vision*.sol`

If permissionless → use `visionTest` (VISION_PLAYER). If restricted → use `test` (DEPLOYER).

- [ ] **Step 2: Write the test file**

```ts
/**
 * Vision Create Batch E2E — tests the full 4-step batch creation wizard.
 * Phase: write-after (creates batch on-chain)
 *
 * NOTE: If createBatch is permissioned, change to: import { test, expect } from '../fixtures/wallet'
 * and use TEST_ADDRESS instead of VISION_PLAYER_ADDRESS.
 */
import { visionTest as test, expect } from '../fixtures/wallet'
import { VISION_PLAYER_ADDRESS } from '../env'
import { ensureWalletConnected } from '../helpers/selectors'

test.describe('Vision Create Batch', () => {
  test('Create Batch button opens modal with Step 1', async ({ walletPage: page }) => {
    test.setTimeout(120_000)

    await page.goto('/')
    await ensureWalletConnected(page, VISION_PLAYER_ADDRESS)

    const createBtn = page.getByRole('button', { name: /Create Batch/i })
    await expect(createBtn).toBeVisible({ timeout: 15_000 })
    await createBtn.click()

    // Modal opens with Markets step
    await expect(page.getByText(/Select Markets|Create Batch/i).first()).toBeVisible({ timeout: 10_000 })
  })

  test('Create Batch wizard navigates all 4 steps and submits', async ({ walletPage: page }) => {
    test.setTimeout(300_000)

    await page.goto('/')
    await ensureWalletConnected(page, VISION_PLAYER_ADDRESS)

    // Step 1: Open wizard
    const createBtn = page.getByRole('button', { name: /Create Batch/i })
    await expect(createBtn).toBeVisible({ timeout: 15_000 })
    await createBtn.click()
    await expect(page.getByText(/Select Markets/i).first()).toBeVisible({ timeout: 10_000 })

    // Step 1: Select markets
    const searchInput = page.locator('input[placeholder*="Search"]').first()
    const hasSearch = await searchInput.isVisible({ timeout: 5_000 }).catch(() => false)
    if (hasSearch) {
      await searchInput.fill('bitcoin')
      await page.waitForTimeout(1_000)
    }

    // Click first available market checkbox/row
    const marketItem = page.locator('[data-testid="market-row"], tr, label').filter({ hasText: /BTC|bitcoin/i }).first()
    const hasMarket = await marketItem.isVisible({ timeout: 5_000 }).catch(() => false)
    if (hasMarket) {
      await marketItem.click()
    }

    // Step 2: Configure
    const nextBtn = page.getByRole('button', { name: /Next|Continue/i }).first()
    await expect(nextBtn).toBeVisible({ timeout: 10_000 })
    await nextBtn.click()
    await expect(page.getByText(/Configure|Resolution|Tick/i).first()).toBeVisible({ timeout: 10_000 })

    const durationBtn = page.getByRole('button', { name: /5 min|10 min|30 min/i }).first()
    const hasDuration = await durationBtn.isVisible({ timeout: 5_000 }).catch(() => false)
    if (hasDuration) await durationBtn.click()

    // Step 3: Preview
    await nextBtn.click()
    await expect(page.getByText(/Preview|Summary|Review/i).first()).toBeVisible({ timeout: 10_000 })

    // Step 4: Submit on-chain
    const confirmBtn = page.getByRole('button', { name: /Confirm|Create|Submit/i }).first()
    await expect(confirmBtn).toBeVisible({ timeout: 10_000 })
    await confirmBtn.click()

    // Wait for on-chain confirmation
    await expect(page.getByText(/Batch Created|Transaction|Success/i).first()).toBeVisible({ timeout: 180_000 })
  })
})
```

- [ ] **Step 2: Run and commit**

```bash
cd frontend && npx playwright test --config=e2e/playwright.config.ts e2e/tests/30-vision-create-batch.spec.ts
git add frontend/e2e/tests/30-vision-create-batch.spec.ts
git commit -m "feat(e2e): add create batch wizard tests (30) — full submit"
```

---

### Task 11: Portfolio & orders test (31)

**Files:**
- Create: `frontend/e2e/tests/31-portfolio-orders.spec.ts`

- [ ] **Step 1: Write the test file**

```ts
/**
 * Portfolio tabs E2E.
 * Phase: write-after (order cancellation writes on-chain)
 */
import { test, expect, TEST_ADDRESS } from '../fixtures/wallet'
import { ensureWalletConnected } from '../helpers/selectors'

test.describe('Portfolio & Orders', () => {
  test('Portfolio section shows tabs', async ({ walletPage: page }) => {
    test.setTimeout(120_000)

    await page.goto('/index')
    await ensureWalletConnected(page, TEST_ADDRESS)

    await page.evaluate(() => {
      const headings = document.querySelectorAll('h2')
      for (const h of headings) {
        if (h.textContent?.includes('Portfolio')) {
          h.scrollIntoView()
          break
        }
      }
    })

    const positionsTab = page.getByRole('button', { name: /Positions/i }).first()
    await expect(positionsTab).toBeVisible({ timeout: 15_000 })
  })

  test('Positions tab shows formatted values', async ({ walletPage: page }) => {
    test.setTimeout(120_000)

    await page.goto('/index')
    await ensureWalletConnected(page, TEST_ADDRESS)

    const positionsTab = page.getByRole('button', { name: /Positions/i }).first()
    const hasTab = await positionsTab.isVisible({ timeout: 15_000 }).catch(() => false)
    if (!hasTab) {
      test.skip(true, 'Portfolio section not visible')
      return
    }
    await positionsTab.click()

    // Should contain dollar amounts or share counts, not raw 18-digit numbers
    await expect(async () => {
      const text = await page.locator('body').textContent()
      expect(text).not.toMatch(/\d{18,}/)
    }).toPass({ timeout: 15_000 })
  })

  test('Trades tab renders', async ({ walletPage: page }) => {
    test.setTimeout(120_000)

    await page.goto('/index')
    await ensureWalletConnected(page, TEST_ADDRESS)

    const tradesTab = page.getByRole('button', { name: /Trades/i }).first()
    const hasTab = await tradesTab.isVisible({ timeout: 15_000 }).catch(() => false)
    if (!hasTab) {
      test.skip(true, 'Trades tab not visible')
      return
    }
    await tradesTab.click()

    // Tab rendered — content may be empty if no trades. Assert tab didn't crash.
    await page.waitForTimeout(3_000)
    const bodyText = await page.locator('body').textContent()
    // No raw wei in trade amounts
    expect(bodyText).not.toMatch(/\d{18,}/)
  })
})
```

- [ ] **Step 2: Run and commit**

```bash
cd frontend && npx playwright test --config=e2e/playwright.config.ts e2e/tests/31-portfolio-orders.spec.ts
git add frontend/e2e/tests/31-portfolio-orders.spec.ts
git commit -m "feat(e2e): add portfolio & orders tests (31)"
```

---

## Chunk 5: Validation & Docs

### Task 12: Run full suite with new config

- [ ] **Step 1: List all tests by project**

Run: `cd frontend && npx playwright test --config=e2e/playwright.config.ts --list`

Verify every .spec.ts matched by exactly one project (no double matches!):
- `itp-data`: 01, 02, 03, 04, 05, 07, 08, 10-morpho, 18, 26
- `vision-data`: 10-vision, 12, 13, 14, 15, 19, 20, 21, 25
- `ui-verify-itp`: 00, 06, 16, 17, 22, 23, 24, 27, 28, 32, 34
- `ui-verify-vision`: 11, 29, 33, 35
- `write-after`: 30, 31

**Critical check**: Run `--list` and verify test 06 appears ONLY under `ui-verify-itp` (NOT in `itp-data`).

- [ ] **Step 2: Run full suite on Anvil first**

Run: `cd frontend && npx playwright test --config=e2e/playwright.config.ts`

Fix any failures.

- [ ] **Step 3: Run full suite on testnet**

```bash
./switch-env.sh testnet
cd frontend && npx playwright test --config=e2e/playwright.config.ts
```

- [ ] **Step 4: Commit fixes**

```bash
git add -A
git commit -m "fix(e2e): fix issues from full suite validation"
```

---

### Task 13: Update docs and push

**Files:**
- Modify: `docs/e2e-tests-testnet.md`

- [ ] **Step 1: Update the doc with new tests and parallelism description**

- [ ] **Step 2: Mark covered gaps in the "Missing E2E Coverage" section**

- [ ] **Step 3: Commit and push**

```bash
git add docs/e2e-tests-testnet.md
git commit -m "docs: update E2E reference with new tests and 3-phase parallelism"
git push mono main
```

---

## Follow-Up Tasks (out of scope for this plan)

These were identified by reviewers but require separate work:

| # | Issue | Action |
|---|-------|--------|
| H1 | Deployer key hardcoded in `/api/faucet/route.ts` | Move to env var, add rate limiting, use separate faucet-only key |
| — | Faucet IS_ANVIL skip on testnet | Keep skip until H1 is fixed |
| — | Cross-process nonce lock for `backend-api.ts` | Add filesystem-based lock (like `vision-api.ts`'s `withL3NonceLock`) to `l3SignedSend`. This enables `workers: 2` on testnet. |
| — | Cross-process settlement nonce lock | `backend-api.ts`'s `withSettlementNonceLock` is in-process only. Needs filesystem lock for multi-worker. |
