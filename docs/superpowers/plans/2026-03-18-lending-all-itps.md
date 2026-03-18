# Lending for All ITPs — Fix E2E + Multi-Vault Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development

**Goal:** Fix lending E2E test (buy ITP → deposit as collateral → borrow → repay → withdraw), then enable Morpho lending markets for all 96 ITPs via multi-vault architecture.

---

## Task 1: Fix E2E lending test — buy ITP shares as collateral

**Files:** `frontend/e2e/tests/03-lending.spec.ts`, `frontend/e2e/helpers/backend-api.ts`

The test currently mints MockERC20 tokens as collateral. But the Morpho market uses ITP vault tokens (BRDG) as collateral. ITP vault tokens come from buying the ITP.

Fix the backend API path in test 03:
1. Before depositing collateral, buy ITP shares via `placeL3BuyOrderDirect` (creates ITP shares)
2. The ITP shares ARE the collateral token for batch markets
3. Remove `mintMorphoCollateral` call — replace with buy order + wait for fill
4. Use the batch market's collateralToken (from morpho-deployment.json) which is the ITP vault address
5. The `depositCollateralDirect` function already handles approval + supplyCollateral

---

## Task 2: Multi-vault DeployBatchMarkets (96 ITPs)

**Files:** `contracts/script/DeployBatchMarkets.s.sol`, `testnet.sh`

MetaMorpho caps at 30 markets per vault. For 96 ITPs, need 4 vaults.

1. Modify testnet.sh step 12b to split ITP list into chunks of 29
2. For each chunk, run DeployBatchMarkets with a new MetaMorpho vault
3. Accumulate all vaults+markets into batch-markets.json
4. Add `setAuthorizedMissedCountCaller` for each oracle in DeployBatchMarkets

---

## Task 3: Curator multi-vault support

**Files:** `curator/src/config.rs`, `curator/src/market_deployer.rs`, `curator/src/main.rs`

1. Change `--vault-address` to `--vault-addresses` (comma-separated)
2. Market deployer assigns new ITPs to vaults with capacity
3. Allocation bot reads supply queue from all vaults

---

## Task 4: Fix itp-bot manifest mount

**Files:** `testnet.sh`

The itp-bot crashes with "No such file or directory" for `itp-bot/manifest.json`. The docker-compose override was cleaned up. Keep it.

---

## Task 5: Fix rebalance test (symbol-map)

**Files:** `data/symbol-map.json` or `frontend/e2e/fixtures/wallet.ts`

ITP #1's tokens from old deploy aren't in the symbol-map. Either:
- Add old token addresses to symbol-map (from ITP creation broadcast)
- Or change ITP_ID to an ITP from the latest batch (89+) that has mapped tokens

---

## Finding: ITP Shares ≠ ITP Vault Tokens

The Morpho market uses ITP vault tokens (ERC4626) as collateral, NOT raw ITP shares.

**Flow needed:**
1. `placeL3BuyOrderDirect` → user gets ITP shares (from Index contract)
2. `ITPVault.deposit(shares, receiver)` → user gets vault tokens (BRDG)
3. `Morpho.supplyCollateral(marketParams, amount, user, "")` → vault tokens become collateral

**Current test does steps 1 and 3 but skips step 2.**

Fix: add `depositToVault(TEST_ADDRESS, ITP_ID, shareAmount)` helper that:
- Approves ITP shares to the vault
- Calls `vault.deposit(amount, receiver)`
- Returns the vault token balance

The vault address comes from `Index.itpVaults(itpId)` or from `morpho-deployment.json.marketParams.collateralToken`.
