# E2E Test Hardening — Final Consensus

Produced by synthesis of Agent 6A's proposal and Agent 6B's critique, verified against
the actual codebase. Every number below was counted; nothing is estimated.

---

## Resolved Disagreements

### 1. seedMinimumState() scope

**6B was right.** The global-setup cannot create ITPs or deploy Vision batches — those
require Forge deploy scripts (`DeployAllVisionBatches.s.sol`, `DeployIndex.s.sol`).
The seeder can only: (a) validate deployment health (already done), (b) mint USDC to
test wallets, (c) verify existing batches/ITPs exist on-chain, (d) pre-place a buy order
so later tests have shares. It cannot conjure on-chain state from nothing.

**Decision:** Rename to `ensurePreconditions()`. It verifies the deployment provides
minimum state; it does not create that state. If preconditions fail, the suite aborts
with an actionable error ("Redeploy before running E2E"), not a cascade of 40 silent
graceful passes.

### 2. waitForTimeout: mentioned or not?

**6B was right.** 111 `waitForTimeout` calls across 20 files — the single largest
source of flakiness. 6A never mentioned them. These are unconditional sleeps that
either waste time (when state is ready sooner) or cause flakiness (when state is not
ready yet). They must be Phase 0.

**Actual count verified:** 111 occurrences in spec/helper files. Not 107 (6B's estimate
was close).

### 3. test.skip() vs graceful pass — CLAUDE.md constraint

**6B was right.** CLAUDE.md says: "NEVER skip tests on testnet. ADAPT them instead."
Using `test.skip(condition, reason)` violates this directly. The correct replacement
for graceful-pass is: assert the precondition exists, and if it doesn't, create the
precondition programmatically or fail with a clear error explaining what's missing.

**Decision:** The existing `test.skip()` calls (8 across 5 files) are acceptable ONLY
when the precondition genuinely cannot be created programmatically (e.g., sim cache
not loaded on data-node). For the ~18 `if (x.length === 0) { console.log(...); return }`
patterns, replace with either:
- Programmatic state creation (mint USDC, place an order, join a batch) when possible
- Hard `expect(data.length).toBeGreaterThan(0)` when the precondition should always
  exist after a valid deployment

Never `test.skip()` for conditions that indicate a broken deployment — fail loudly.

### 4. IS_TESTNET existence

**6B was right.** `IS_TESTNET` does not exist in `env.ts`. The file has `IS_ANVIL`
referenced in CLAUDE.md but not exported from env.ts either — it's a conceptual
flag, not a real variable. The timeout multiplier needs a new export.

**Decision:** Add to `env.ts`:
```typescript
export const IS_LOCAL = !process.env.E2E_L3_RPC_URL || L3_RPC.includes('localhost')
```
Use `IS_LOCAL` for timeout scaling. No `IS_TESTNET` — the binary is local vs. remote.

### 5. "~50 catch-and-return" count

**6B was right.** Actual catch-and-swallow count is ~147 across 28 files, but most are
legitimate `.catch(() => false)` on `isVisible()` checks — Playwright's recommended
pattern for optional elements. The dangerous ones are the 18 "graceful pass" returns
that silently skip entire test bodies. 6A inflated the problem in one direction; the
real danger is narrower but deeper.

### 6. Shared mutable on-chain state

**6B was right — this is unaddressed and the deepest fragility.** Test 02 (buy) creates
state that 04 (sell) and 16 (portfolio regression) depend on. If 02 fails, 04 and 16
cascade. The `test.describe.serial` within projects and the phased project dependencies
in `playwright.config.ts` are the existing mitigation, but they don't help when a test
partially succeeds (order placed but not filled).

**Decision:** Each test that mutates on-chain state must be self-contained: verify its
own preconditions and create them if missing. Test 04 already does this (buys shares
if none exist). Test 16 does not — it assumes shares from test 02 exist but has a
weak `expect(shares).toBeGreaterThanOrEqual(0n)` fallback. This is the pattern to fix.

### 7. getByRole/getByText selectors

**6B was right.** Playwright's own best practices recommend `getByRole`, `getByText`,
`getByLabel` over data-testid. The selectors.ts file already uses these correctly for
most elements. Only CSS-class-based selectors need data-testid.

**Actual CSS-class selectors needing replacement (verified):**
1. `modalContainer`: `.bg-card.border.border-border-light.rounded-xl`
2. `sourcesSectionBar`: `.bg-black.text-white`
3. `marketsSectionBar`: `.section-bar`
4. 15-display-formatting.spec.ts: `.section-bar`, `.tabular-nums`, `.text-color-up`
5. 35-production-smoke.spec.ts: `.overflow-x-auto`, `.recharts-responsive-container`,
   `.recharts-line-curve`, `.recharts-area-curve`

**Placeholder-based selectors** (`input[placeholder="e.g., 100"]`) are borderline —
they break on copy changes but are more readable than data-testid. Keep for now;
replace only if they cause actual flakiness.

Total data-testid additions needed: ~8 component-level additions, not 20.

### 8. Timeout strategy

**6B was right.** The problem is strategy, not values. `waitForTimeout(3000)` is not
fixed by `waitForTimeout(6000)`. It's fixed by `await page.waitForSelector(...)` or
`await expect(locator).toBeVisible()` or the existing `pollUntil()` pattern.

**Decision:** No timeout tier constants. Instead:
- Replace `waitForTimeout` with condition-based waits everywhere
- Keep `env.ts` existing timeouts: `POLL_TIMEOUT` (180s), `CONSENSUS_TIMEOUT` (360s),
  `RPC_TIMEOUT` (30s) — these are already the right values
- Add `IS_LOCAL` multiplier only for the Playwright config's `timeout` and `actionTimeout`

### 9. Migration order

**6B's order was correct.** Kill sleeps first (highest ROI, lowest risk), then
precondition enforcement, then assertion hardening, then selective data-testid.

---

## Final Design

### Phase 0: Kill unconditional sleeps (111 occurrences, 20 files)

Replace every `waitForTimeout(N)` with the appropriate condition-based wait.

**Patterns:**

| Current | Replacement |
|---------|-------------|
| `await page.waitForTimeout(500)` after dialog dismiss | `await skipBtn.waitFor({ state: 'hidden' })` |
| `await page.waitForTimeout(2000)` after navigation | `await page.waitForLoadState('networkidle')` or `await expect(target).toBeVisible()` |
| `await page.waitForTimeout(1500)` for React settle | `await page.waitForFunction(() => document.querySelector('input')?.value !== '')` |
| `await page.waitForTimeout(3000)` for data load | `await expect(dataElement).toBeVisible({ timeout: 10_000 })` |

**Files (by occurrence count, descending):**
1. `35-production-smoke.spec.ts` — 40 occurrences (highest priority)
2. `22-ui-fixes-validation.spec.ts` — 15
3. `15-display-formatting.spec.ts` — 9
4. `47-itp-rebalance.spec.ts` — 6
5. `24-decimal-regression.spec.ts` — 6
6. `28-system-health.spec.ts` — 5
7. `31-portfolio-orders.spec.ts` — 5
8. `46-vision-leaderboard-sorting.spec.ts` — 4
9. `02-buy-itp.spec.ts` — 3
10. `17-multi-itp-lending.spec.ts` — 3
11. Remaining 10 files — 1-2 each
12. `helpers/selectors.ts` — 2 (in `ensureWalletConnected` and `navigateToLending`)
13. `fixtures/wallet.ts` — 2 (React hydration buffer + retry delay)

**Rollback:** Each file is independent. Revert individual files if a replacement
introduces new flakiness.

### Phase 1: Precondition enforcement in global-setup

Expand `global-setup.ts` to verify (not create) minimum test state:

```typescript
async function ensurePreconditions(health: DeploymentHealth) {
  // 1. At least one ITP exists on L3 (else: abort with "run DeployIndex first")
  // 2. At least one Vision batch exists (else: abort with "run DeployAllVisionBatches first")
  // 3. Test wallet has >100 L3 USDC (else: mint via RPC)
  // 4. Vision player wallet has >100 L3 USDC (else: mint via RPC)
}
```

**Files to modify:**
- `frontend/e2e/global-setup.ts` — add `ensurePreconditions()` after validation
- `frontend/e2e/env.ts` — add `IS_LOCAL` export

**Rollback:** Revert global-setup.ts. Suite falls back to current behavior.

### Phase 2: Harden graceful-pass patterns (18 occurrences, 14 files)

For each `if (data.length === 0) { console.log('...'); return }`:

**Category A — precondition should always exist after valid deploy (fail hard):**
- `10-vision.spec.ts`: active rounds / chain batches
- `14-vision-claim-withdraw.spec.ts`: chain batches
- `21-vision-claim-rewards.spec.ts`: chain batches
- `25-vision-tick-resolution.spec.ts`: chain batches

Replace with: `expect(chainBatches.length, 'No batches on-chain — redeploy').toBeGreaterThan(0)`

**Category B — state depends on previous test execution (self-heal):**
- `41-vision-round-lifecycle.spec.ts`: active rounds (4 graceful returns)
- `43-vision-concurrent-rounds.spec.ts`: round results (11 graceful references)
- `42-vision-leaderboard.spec.ts`: leaderboard entries (7 graceful references)

Replace with: check precondition, create state if missing (join a round, place a bet),
then assert.

**Category C — legitimate optional data (keep as conditional, but log warning):**
- `45-vision-leaderboard.spec.ts`: per-source leaderboard on fresh deploy
- `46-vision-leaderboard-sorting.spec.ts`: leaderboard API
- `35-production-smoke.spec.ts`: snapshot history

Keep the `if (empty) return` but add `console.warn('[PRECONDITION MISSING]')` prefix
so these are visible in CI output and don't silently vanish.

**Files to modify:** 14 spec files listed above.

**Rollback:** Each file independent. Revert individual files.

### Phase 3: Targeted data-testid additions (~8 components)

Add `data-testid` only where CSS-class selectors exist:

| Component | data-testid | Replaces |
|-----------|------------|----------|
| Modal container (TradeModal) | `data-testid="trade-modal"` | `.bg-card.border.border-border-light.rounded-xl` |
| Section bar (SectionBar) | `data-testid="section-bar-{title}"` | `.section-bar` |
| Stats bar (Vision browse) | `data-testid="sources-stats-bar"` | `.bg-black.text-white` |
| Tabular nums cells | `data-testid="tabular-cell"` | `.tabular-nums` |
| Pool value (positive) | `data-testid="pool-value"` | `.text-color-up` |
| Chart container | `data-testid="chart-container"` | `.recharts-responsive-container` |
| Scrollable table | `data-testid="scrollable-table"` | `.overflow-x-auto` |

**Files to modify:**
- Frontend components: ~5-6 .tsx files (add data-testid attributes)
- `frontend/e2e/helpers/selectors.ts` — update 3 locators
- `frontend/e2e/tests/15-display-formatting.spec.ts` — update 5 locators
- `frontend/e2e/tests/35-production-smoke.spec.ts` — update 4 locators

**Rollback:** Revert component + selector changes together (they're paired).

---

## Files Summary

### Create
None. No new files needed.

### Modify

**Phase 0 (20 files):**
- `frontend/e2e/tests/35-production-smoke.spec.ts`
- `frontend/e2e/tests/22-ui-fixes-validation.spec.ts`
- `frontend/e2e/tests/15-display-formatting.spec.ts`
- `frontend/e2e/tests/47-itp-rebalance.spec.ts`
- `frontend/e2e/tests/24-decimal-regression.spec.ts`
- `frontend/e2e/tests/28-system-health.spec.ts`
- `frontend/e2e/tests/31-portfolio-orders.spec.ts`
- `frontend/e2e/tests/46-vision-leaderboard-sorting.spec.ts`
- `frontend/e2e/tests/02-buy-itp.spec.ts`
- `frontend/e2e/tests/17-multi-itp-lending.spec.ts`
- `frontend/e2e/tests/30-vision-create-batch.spec.ts`
- `frontend/e2e/tests/11-vision-sources.spec.ts`
- `frontend/e2e/tests/05-create-itp.spec.ts`
- `frontend/e2e/tests/34-backtester-deploy.spec.ts`
- `frontend/e2e/tests/13-vision-enter-batch.spec.ts`
- `frontend/e2e/tests/00-health-check.spec.ts`
- `frontend/e2e/tests/16-portfolio-regression.spec.ts`
- `frontend/e2e/tests/45-vision-lock-phase.spec.ts`
- `frontend/e2e/helpers/selectors.ts`
- `frontend/e2e/fixtures/wallet.ts`

**Phase 1 (2 files):**
- `frontend/e2e/global-setup.ts`
- `frontend/e2e/env.ts`

**Phase 2 (14 files):**
- 14 spec files with graceful-pass patterns (overlaps with Phase 0 list)

**Phase 3 (~8 files):**
- ~5-6 frontend `.tsx` components
- `frontend/e2e/helpers/selectors.ts`
- `frontend/e2e/tests/15-display-formatting.spec.ts`
- `frontend/e2e/tests/35-production-smoke.spec.ts`

### Delete
None.

---

## What 6A Got Right

- Identified the 5 root cause categories correctly (Tailwind selectors, missing seeding,
  hardcoded timeouts, graceful pass, fragile selectors)
- Proposed centralizing selectors in selectors.ts (already done — good instinct)
- Recognized the need for phased migration with rollback points

## What 6A Got Wrong

- seedMinimumState() scope: conflated "verify preconditions" with "create state from scratch"
- Never mentioned waitForTimeout (the biggest problem)
- Proposed 20 data-testid additions (actual need: ~8)
- Timeout tiers with IS_TESTNET multiplier: wrong abstraction, wrong flag name
- test.skip() as graceful-pass replacement: violates CLAUDE.md

## What 6B Got Right

- Correctly identified seedMinimumState() infeasibility
- Correctly identified waitForTimeout as the #1 priority
- Correctly identified CLAUDE.md constraint on test.skip()
- Correctly identified IS_TESTNET non-existence
- Correctly identified shared mutable state as deepest fragility
- Correct migration order
- Correct that getByRole/getByText selectors are fine

## What 6B Got Wrong

- Said "~30" catch-and-return — actual count of dangerous ones is 18 (graceful-pass
  early returns), but total catch-and-swallow is 147. The 6A count of "~50" was also
  wrong, but in a different direction.
- Suggested `expect(hasData).toBe(true)` as universal replacement — some Category C
  patterns legitimately need conditional behavior on fresh deploys.
