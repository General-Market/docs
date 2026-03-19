# Remove Anvil from E2E — Testnet Only

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all Anvil infrastructure from E2E tests. Testnet is the only supported environment.

**Architecture:** Delete `IS_ANVIL` flag and all Anvil-specific code paths (impersonation, storage manipulation, block mining). Keep testnet code paths as the only paths. Convert the liquidation test to read-only verification (oracle price doesn't drift naturally — it only updates during rebalance consensus). Delete the batch creation test.

**Tech Stack:** Playwright, viem, Morpho protocol

---

## File Map

| File | Action | What Changes |
|------|--------|-------------|
| `e2e/env.ts` | Modify | Delete `IS_ANVIL`, `ANVIL_DEPLOYER`, hardcode testnet timeouts |
| `e2e/global-setup.ts` | Modify | Remove `IS_ANVIL` import, `VISION_PLAYER_ADDRESS` import, Anvil pre-funding block |
| `e2e/playwright.config.ts` | Modify | Remove `IS_ANVIL` import, hardcode testnet config, clean `47-` from regex |
| `e2e/fixtures/wallet.ts` | Modify | Remove `IS_ANVIL` import, remove Anvil auto-accept branch |
| `e2e/helpers/backend-api.ts` | Modify | Delete Anvil-only functions, collapse conditionals to testnet path |
| `e2e/helpers/vision-api.ts` | Modify | Delete Anvil-only functions, collapse conditionals to testnet path |
| `e2e/helpers/address-validator.ts` | Modify | Remove dead `IS_ANVIL` import |
| `e2e/tests/05-create-itp.spec.ts` | Modify | Remove `IS_ANVIL` + `startSettlementBlockMiner` imports/calls |
| `e2e/tests/03-lending.spec.ts` | Modify | Remove `IS_ANVIL` + `mintL3Shares` imports/branches |
| `e2e/tests/08-settlement-bridge-buy.spec.ts` | Modify | Remove `IS_ANVIL` + `startSettlementBlockMiner` imports/calls, hardcode L3 direct path |
| `e2e/tests/18-multi-itp-orders.spec.ts` | Modify | Remove `IS_ANVIL` + `mintL3Shares` + `startSettlementBlockMiner` imports/calls |
| `e2e/tests/19-vision-settlement-bridge-deposit.spec.ts` | Modify | Remove `IS_ANVIL` + `mineSettlementBlocks` imports/calls |
| `e2e/tests/20-vision-settlement-withdraw.spec.ts` | Modify | Remove `mineSettlementBlocks` import/calls |
| `e2e/tests/26-rebalance-full-cycle.spec.ts` | Modify | Remove `startSettlementBlockMiner` + `mineSettlementBlocks` imports/calls |
| `e2e/tests/07-oracle-resilience.spec.ts` | Modify | Delete entire 160-line Anvil kill/restart suite, keep testnet health checks. Remove `mintBridgedItp` import. |
| `e2e/tests/10-morpho-oracle-health.spec.ts` | Modify | Remove `IS_ANVIL` + `mintL3Shares` + `mintBridgedItp` imports. Delete Anvil branches + dead helpers (`setOraclePrice`, local `supplyCollateral`, `borrow`, `l3SendTx`). |
| `e2e/tests/00-health-check.spec.ts` | Modify | Remove `IS_ANVIL` import |
| `e2e/tests/06-backtester-smoke.spec.ts` | Modify | Remove `IS_ANVIL` import, hardcode testnet warmup |
| `e2e/tests/23-api-routes-smoke.spec.ts` | Modify | Remove dead `IS_ANVIL` import |
| `e2e/tests/24-decimal-regression.spec.ts` | Modify | Remove dead `IS_ANVIL` import |
| `e2e/tests/27-ap-endpoints.spec.ts` | Modify | Remove `IS_ANVIL` import |
| `e2e/tests/29-faucet.spec.ts` | Modify | Remove `IS_ANVIL` import, use testnet address |
| `e2e/tests/44-itp-liquidation.spec.ts` | Rewrite | Keep pure math tests, convert liquidation cycle to read-only Morpho state verification |
| `e2e/tests/47-vision-batch-creation.spec.ts` | Delete | Cannot work without Anvil storage manipulation |

---

### Task 1: env.ts — Delete IS_ANVIL and Anvil constants

**Files:**
- Modify: `frontend/e2e/env.ts`

- [ ] **Step 1: Remove IS_ANVIL definition and ANVIL_DEPLOYER**

Delete lines 26-28 (IS_ANVIL + section comment + JSDoc). Delete lines 72-73 (ANVIL_DEPLOYER). Hardcode timeouts to testnet values:

```typescript
// Replace lines 98-102 with:
export const POLL_TIMEOUT = 180_000
// Settlement needs full tick cycle (120s) + consensus + propagation. 6 min.
export const CONSENSUS_TIMEOUT = 360_000
export const RPC_TIMEOUT = 30_000
```

Update comment on line 53 — remove "Anvil account #7" reference, keep the explanation of separate nonce space.

- [ ] **Step 2: Verify downstream errors exist (expected)**

Run: `cd frontend && npx tsc --noEmit 2>&1 | head -20`
Expected: Many errors from downstream IS_ANVIL imports — fixed in subsequent tasks.

---

### Task 2: playwright.config.ts — Hardcode testnet config

**Files:**
- Modify: `frontend/e2e/playwright.config.ts`

- [ ] **Step 1: Remove IS_ANVIL import and hardcode values**

Remove `IS_ANVIL` from import line. Replace all ternaries with testnet values:
- `workers: 1`
- `timeout: 180_000`
- `expect.timeout: 30_000`
- `actionTimeout: 60_000`
- Always include `launchOptions: { args: ['--allow-running-insecure-content'] }`
- Always include swarm project (remove `IS_ANVIL` guard on lines 76-83)
- Remove `47-` from vision-data `testMatch` regex (file being deleted in Task 8)
- Clean up stale comments referencing "Anvil" or "parallel on Anvil"

---

### Task 3: global-setup.ts — Remove Anvil pre-funding

**Files:**
- Modify: `frontend/e2e/global-setup.ts`

- [ ] **Step 1: Remove IS_ANVIL import, VISION_PLAYER_ADDRESS import, and pre-funding block**

Remove `IS_ANVIL` and `VISION_PLAYER_ADDRESS` from import (both become unused). Delete the entire `if (IS_ANVIL) { ... }` block (lines 53-62) that pre-funds VISION_PLAYER. Clean up stale header comments about pre-funding.

---

### Task 4: fixtures/wallet.ts — Remove Anvil auto-accept path

**Files:**
- Modify: `frontend/e2e/fixtures/wallet.ts`

- [ ] **Step 1: Remove IS_ANVIL import and conditional**

Remove `IS_ANVIL` from import. The testnet signing path (lines 58-111 inside `if (!IS_ANVIL)`) becomes unconditional — remove the `if` guard, keep the body. The signing functions (`__e2eSignAndSend`, `__e2ePersonalSign`) are always exposed. Clean up stale header comments about "two modes" (Anvil/testnet).

---

### Task 5: backend-api.ts — Strip Anvil code

**Files:**
- Modify: `frontend/e2e/helpers/backend-api.ts`

This is the largest file. Work systematically top-to-bottom.

- [ ] **Step 1: Remove IS_ANVIL and ANVIL_DEPLOYER imports**

Remove `IS_ANVIL` and `ANVIL_DEPLOYER` from the import at line 11-13.

- [ ] **Step 2: Line ~97 — health check fallback: remove IS_ANVIL guard**

The `if (!IS_ANVIL)` block becomes unconditional. Keep the testnet fallback logic.

- [ ] **Step 3: Line ~193 — deployer selection: use DEPLOYER_ADDRESS only**

Replace `const DEPLOYER = IS_ANVIL ? ANVIL_DEPLOYER : DEPLOYER_ADDRESS;` with `const DEPLOYER = DEPLOYER_ADDRESS;`. Update stale comment.

- [ ] **Step 4: Delete mintBridgedItp() entirely (lines ~245-270)**

Uses `anvil_setBalance`, `anvil_impersonateAccount`, `anvil_stopImpersonatingAccount`. Delete the entire function.

- [ ] **Step 5: Delete mintL3Shares() and keccak256Hex() (lines ~283-410)**

`mintL3Shares` uses `anvil_setStorageAt`, `anvil_impersonateAccount`. `keccak256Hex` (lines ~402-406) is only called from `mintL3Shares`. Delete both.

- [ ] **Step 6: Lines ~361-366 — mintL3Usdc: keep signed tx path only**

Remove the `if (!IS_ANVIL)` / `else` conditional. Keep only the `l3SignedSend()` path.

- [ ] **Step 7: All remaining conditional blocks**

Collapse ALL `IS_ANVIL` ternaries and `if (!IS_ANVIL) { ... } else { ... }` blocks. This includes:
- `_l3Account` ternary (~446): collapse to `privateKeyToAccount(TEST_PRIVATE_KEY)`
- All `if (!IS_ANVIL) { l3SignedSend } else { anvil_impersonate }` blocks (~656, ~764, ~832, ~906, ~945, ~1003, ~1089): keep testnet body
- `hasSettlementGas` (~870): remove `if (IS_ANVIL) return true;` — always do the actual gas check

- [ ] **Step 8: Delete startSettlementBlockMiner() and mineSettlementBlocks() (lines ~1110-1125)**

Both are no-ops on testnet. Delete entirely. Also remove their exports.

- [ ] **Step 9: Lines ~1169-1257 — deployBridgedItpDirect: keep testnet path only**

Remove the `if (!IS_ANVIL)` guard. Keep the `registerExistingItp()` path. Delete all `anvil_setBalance`, `anvil_impersonateAccount`, `anvil_setStorageAt`, `anvil_mine` calls in the else branch.

- [ ] **Step 10: Final sweep**

`grep -n "anvil_\|IS_ANVIL\|ANVIL_" frontend/e2e/helpers/backend-api.ts` — must return zero. Remove any unused imports and dead local functions.

---

### Task 6: vision-api.ts — Strip Anvil code

**Files:**
- Modify: `frontend/e2e/helpers/vision-api.ts`

- [ ] **Step 1: Remove IS_ANVIL and ANVIL_DEPLOYER imports**

Remove from import line.

- [ ] **Step 2: Lines ~48-52 — Nonce lock: keep file-based lock only**

Remove the `if (IS_ANVIL)` in-process lock branch. Delete the dead `_l3InProcLock` variable (~103). Keep the filesystem lock as the only implementation.

- [ ] **Step 3: Lines ~138-140 — PLAYER2: hardcode testnet address**

Replace ternary with testnet value only:
```typescript
export const PLAYER2 = '0xa0Ee7A142d267C1f36714E4a8F75612F20a79720'
```

- [ ] **Step 4: Lines ~181-184 — USDC address: keep testnet path only**

Remove `if (IS_ANVIL)` branch. Keep the Vision contract read path.

- [ ] **Step 5: Lines ~309-372 — Transaction sending: keep signed tx path only**

Remove `if (!IS_ANVIL)` guard. Keep the cross-process nonce lock + signing path. Replace `IS_ANVIL ? 200 : 1000` with `1000`.

- [ ] **Step 6: Lines ~379-408 — impersonateAccount: keep testnet funding path only**

Remove `anvil_impersonateAccount` call and the entire Anvil branch. Keep the testnet path that funds accounts with ETH from deployer.

- [ ] **Step 7: Line ~414 — DEPLOYER const: hardcode testnet value**

Replace `const DEPLOYER = IS_ANVIL ? ANVIL_DEPLOYER : DEPLOYER_ADDRESS` with `const DEPLOYER = DEPLOYER_ADDRESS`.

- [ ] **Step 8: Delete createBatchViaStorage() (lines ~953-960+)**

Anvil-only storage manipulation. Delete entirely.

- [ ] **Step 9: Lines ~917 — ensureBatchExists: remove Anvil branch**

Remove `if (IS_ANVIL) { createBatchViaStorage() }` path. Keep testnet fallback (throw if no batch exists).

- [ ] **Step 10: Lines ~660-665 — submitBitmapToIssuers: remove IS_ANVIL ternaries**

Replace `IS_ANVIL ? 1_000 : 3_000` with `3_000`. Replace `IS_ANVIL ? 5 : 10` with `10`. Remove `if (!IS_ANVIL)` guard on issuer pre-check block (~665).

- [ ] **Step 11: Lines ~1200 — hasSettlementGas: remove IS_ANVIL guard**

Remove `if (IS_ANVIL) return true;` — always do the actual gas check.

- [ ] **Step 12: Lines ~1280-1297 — depositToVisionViaSettlement: keep testnet path**

Remove Anvil branch (`anvil_setBalance`, `anvil_impersonateAccount`, `anvil_mine`). Keep testnet signed tx path.

- [ ] **Step 13: All remaining IS_ANVIL conditionals**

Delete Anvil branches in: `clearPosition()` (~451), `ensureUsdcBalance()` (~469), `mintSettlementUsdc()` (~1217-1297). Keep testnet paths.

- [ ] **Step 14: Final sweep**

`grep -n "anvil_\|IS_ANVIL\|ANVIL_" frontend/e2e/helpers/vision-api.ts` — must return zero. Remove unused imports and dead local functions/variables.

---

### Task 7: Helper files — Remove dead IS_ANVIL import

**Files:**
- Modify: `frontend/e2e/helpers/address-validator.ts`

- [ ] **Step 1: Remove IS_ANVIL import**

Remove `IS_ANVIL` from the import line. It's a dead import — imported but never used.

---

### Task 8: Test files — Remove IS_ANVIL from all tests

**Files:**
- Modify: All test files listed in File Map

- [ ] **Step 1: 05-create-itp.spec.ts**

Remove `IS_ANVIL` import. Remove `startSettlementBlockMiner` import and call. The `stopMiner` variable becomes `null` (settlement blocks mine naturally). Keep `finally { stopMiner?.() }` as harmless no-op.

- [ ] **Step 2: 03-lending.spec.ts**

Remove `IS_ANVIL` import. Remove `mintL3Shares` import. Delete the Anvil `else` branch that called `mintL3Shares` — keep the testnet path (`placeL3BuyOrderDirect`). Delete the `if (IS_ANVIL)` UI path block (lines ~54-79) — testnet always uses backend RPC path.

- [ ] **Step 3: 08-settlement-bridge-buy.spec.ts**

Remove `IS_ANVIL` import. Remove `startSettlementBlockMiner` import and all calls + `stopMiner()` in `finally` blocks. Replace `useSettlement = IS_ANVIL && hasCustody` with `useSettlement = false` (settlement bridge path was Anvil-only). Remove `!IS_ANVIL` guards from gas checks.

- [ ] **Step 4: 18-multi-itp-orders.spec.ts**

Remove `IS_ANVIL` import. Remove `mintL3Shares` import — delete Anvil branches that called it, keep testnet buy-order paths. Remove `startSettlementBlockMiner` import and calls + `stopMiner()`.

- [ ] **Step 5: 19-vision-settlement-bridge-deposit.spec.ts**

Remove `IS_ANVIL` import. Remove `mineSettlementBlocks` import and all calls (lines ~76, ~86). Remove `if (!IS_ANVIL)` guard on line 43 — testnet path becomes unconditional. Delete unreachable Anvil-only code after testnet `return`.

- [ ] **Step 6: 20-vision-settlement-withdraw.spec.ts**

Remove `mineSettlementBlocks` import and all calls. No `IS_ANVIL` import to remove (only uses the helper).

- [ ] **Step 7: 26-rebalance-full-cycle.spec.ts**

Remove `startSettlementBlockMiner` and `mineSettlementBlocks` imports and all calls. Remove `stopMiner()` in `finally` blocks.

- [ ] **Step 8: 07-oracle-resilience.spec.ts**

Remove `IS_ANVIL` import. Remove `mintBridgedItp` import. **Delete the entire Anvil branch** (~160 lines, lines 36-194) that kills/restarts oracle processes. Keep only the `else` branch (testnet health + consensus checks, lines ~195-253) — make it unconditional. Remove any unused imports from the deleted Anvil suite (kill/restart helpers).

- [ ] **Step 9: 10-morpho-oracle-health.spec.ts**

Remove `IS_ANVIL`, `mintL3Shares`, `mintBridgedItp` imports. Delete all Anvil branches (lines ~193-274, ~278-351, ~355-407 that use storage manipulation). Keep testnet read-only verification. Delete dead local helpers: `setOraclePrice`, local `supplyCollateral`, `borrow`, `l3SendTx`, `USER2` constant.

- [ ] **Step 10: Simple IS_ANVIL removals (6 files)**

For each of these, remove the `IS_ANVIL` import and replace any ternaries with the testnet value:
- `00-health-check.spec.ts` (line 45: remove `!IS_ANVIL` guard, keep catch body unconditional)
- `06-backtester-smoke.spec.ts` (line 129: hardcode `180_000` warmup)
- `23-api-routes-smoke.spec.ts` (remove dead import — IS_ANVIL imported but never used)
- `24-decimal-regression.spec.ts` (remove dead import)
- `27-ap-endpoints.spec.ts` (lines 20, 38: remove `!IS_ANVIL` guards, keep catch bodies unconditional)
- `29-faucet.spec.ts` (line 34: hardcode testnet address `VISION_PLAYER_ADDRESS`)

---

### Task 9: Delete 47-vision-batch-creation.spec.ts

**Files:**
- Delete: `frontend/e2e/tests/47-vision-batch-creation.spec.ts`

- [ ] **Step 1: Delete the file**

```bash
rm frontend/e2e/tests/47-vision-batch-creation.spec.ts
```

- [ ] **Step 2: Check no other file imports from it**

Search for `47-vision-batch-creation` in all E2E files. Should be zero.

---

### Task 10: Rewrite 44-itp-liquidation.spec.ts — Read-only testnet verification

**Files:**
- Rewrite: `frontend/e2e/tests/44-itp-liquidation.spec.ts`

The ITP NAV oracle only updates during rebalance consensus — it does NOT drift naturally on a timer. A test that waits for "natural price drift" will timeout every run. The correct approach: keep pure math tests, convert the on-chain tests to read-only Morpho state verification.

- [ ] **Step 1: Rewrite the test**

Keep these tests unchanged (pure math, no chain interaction):
- `calculateHealthFactor` verification
- `calculateLiquidationPrice` verification

Replace the "full liquidation cycle" and "partial liquidation" tests with a single read-only test:
- Read current Morpho market state (total supply/borrow)
- Read oracle price from ITP_NAV_ORACLE
- If any position exists, compute its health factor
- Verify LLTV matches deployment config
- Verify oracle contract is deployed and returns non-zero price
- Verify Morpho contract is deployed and market exists
- No transaction submission, no impersonation, no storage manipulation

Remove all Anvil-specific helpers: `setOraclePrice`, `mintCollateralToken`, `supplyCollateral`, `borrowFromMorpho`, `mintLoanToken`, `supplyLoanAsLender`, `liquidatePosition`, `l3SendTx`. Remove `IS_ANVIL` import and `test.skip(!IS_ANVIL)`.

- [ ] **Step 2: Verify compile**

Run: `cd frontend && npx tsc --noEmit 2>&1 | head -20`
Expected: Clean

---

### Task 11: Full compile check + cleanup

**Files:**
- All modified files

- [ ] **Step 1: Verify IS_ANVIL is completely gone**

```bash
cd frontend && grep -r "IS_ANVIL" e2e/ --include="*.ts"
```
Expected: Zero results.

- [ ] **Step 2: Verify no anvil_ RPC calls remain**

```bash
cd frontend && grep -r "anvil_" e2e/ --include="*.ts"
```
Expected: Zero results.

- [ ] **Step 3: Verify ANVIL_DEPLOYER is gone**

```bash
cd frontend && grep -r "ANVIL_DEPLOYER" e2e/ --include="*.ts"
```
Expected: Zero results.

- [ ] **Step 4: Verify no deleted helper references remain**

```bash
cd frontend && grep -r "startSettlementBlockMiner\|mineSettlementBlocks\|mintBridgedItp\|mintL3Shares\|createBatchViaStorage" e2e/ --include="*.ts"
```
Expected: Zero results.

- [ ] **Step 5: Verify no stale Anvil references in comments**

```bash
cd frontend && grep -ri "anvil" e2e/ --include="*.ts"
```
Expected: Zero results (or only in legitimate contexts like variable names).

- [ ] **Step 6: Full TypeScript compile**

```bash
cd frontend && npx tsc --noEmit
```
Expected: Clean.

- [ ] **Step 7: Final commit**

```bash
git add -A frontend/e2e/
git commit -m "refactor(e2e): remove all Anvil infrastructure — testnet only

- Delete IS_ANVIL flag and all conditional branches
- Delete Anvil-only helpers: mintBridgedItp, mintL3Shares, createBatchViaStorage, startSettlementBlockMiner, mineSettlementBlocks
- Hardcode testnet timeouts, nonce locks, wallet signing
- Convert liquidation test to read-only Morpho state verification
- Delete 47-vision-batch-creation.spec.ts (required storage manipulation)
- Keep all testnet code paths unchanged"
```
