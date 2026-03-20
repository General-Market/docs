# Curator Reform Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 30-market MetaMorpho vault with a 500-market version, switch from bricked AdaptiveCurveIrm to CuratorRateIRM, wire the curator bot, fix the frontend to aggregate across all markets.

**Architecture:** Fork MetaMorpho (MAX_QUEUE_LENGTH=500, already done). DeployMorphoE2E deploys CuratorRateIRM + sets initial rate. testnet.sh reads new JSON keys. Frontend deletes singleton hooks, aggregates stats from useAllMorphoMarkets multicall. No backward compatibility.

**Tech Stack:** Solidity/Forge (contracts), Bash (testnet.sh), React/wagmi (frontend), Playwright (E2E)

**Spec:** `docs/superpowers/specs/2026-03-20-curator-reform-design.md`

---

## Task 1: DeployMorphoE2E — Switch to CuratorRateIRM

**Files:**
- Modify: `contracts/script/DeployMorphoE2E.s.sol`

- [ ] **Step 1: Replace AdaptiveCurveIrm import with CuratorRateIRM**

Replace line 12:
```solidity
// Remove:
import {AdaptiveCurveIrm} from "@morpho-blue-irm/adaptive-curve-irm/AdaptiveCurveIrm.sol";
// Add:
import {CuratorRateIRM} from "../src/irm/CuratorRateIRM.sol";
```

- [ ] **Step 2: Replace IRM deployment (line 68)**

```solidity
// Remove:
AdaptiveCurveIrm irm = new AdaptiveCurveIrm(address(morpho));
// Add:
CuratorRateIRM irm = new CuratorRateIRM(address(morpho), deployer);
```

- [ ] **Step 3: Set initial rate after market creation (after line 110)**

Add after `console.logBytes32(Id.unwrap(marketId));`:
```solidity
// Set initial borrow rate: 5% APR = 0.05 / 31536000 ≈ 1585489599 WAD per second
irm.setRate(marketId, 1585489599);
console.log("Initial borrow rate set: 5% APR");
```

- [ ] **Step 4: Update JSON output — write CURATOR_RATE_IRM key (line 153)**

Replace the `ADAPTIVE_IRM` line in JSON output:
```solidity
'",\n    "CURATOR_RATE_IRM": "', vm.toString(address(irm)),
```

- [ ] **Step 5: Update console log text**

Change `"AdaptiveCurveIRM deployed:"` to `"CuratorRateIRM deployed:"`.

- [ ] **Step 6: Compile and verify**

```bash
cd contracts && forge build 2>&1 | tail -3
```
Expected: compiles without errors.

- [ ] **Step 7: Commit**

```bash
git add contracts/script/DeployMorphoE2E.s.sol
git commit -m "feat: DeployMorphoE2E uses CuratorRateIRM with initial 5% rate"
```

---

## Task 2: testnet.sh — Update JSON key reads + remove queue caps

**Files:**
- Modify: `testnet.sh`

- [ ] **Step 1: Fix IRM key read at line 1026**

```bash
# Change:
CURATOR_IRM=$(python3 -c "import json; print(json.load(open('deployments/morpho-e2e.json'))['contracts']['ADAPTIVE_IRM'])" 2>/dev/null || echo "")
# To:
CURATOR_IRM=$(python3 -c "import json; c=json.load(open('deployments/morpho-e2e.json'))['contracts']; print(c.get('CURATOR_RATE_IRM', c.get('ADAPTIVE_IRM', '')))" 2>/dev/null || echo "")
```

- [ ] **Step 2: Fix IRM key read at line 1685**

Same pattern:
```bash
CURATOR_IRM_ADDR=$(python3 -c "import json; c=json.load(open('deployments/morpho-e2e.json'))['contracts']; print(c.get('CURATOR_RATE_IRM', c.get('ADAPTIVE_IRM', '')))" 2>/dev/null || echo "")
```

- [ ] **Step 3: Remove the 29-market cap at line 1047-1053**

Replace:
```bash
MAX_BATCH=29  # MetaMorpho withdraw queue limit = 30 (including existing singleton)
NEW_COUNT=${#BATCH_VAULTS[@]}
if [ "$NEW_COUNT" -gt "$MAX_BATCH" ]; then
    echo -e "  ${YELLOW}Capping batch to $MAX_BATCH (MetaMorpho queue limit 30)${NC}"
    BATCH_VAULTS=("${BATCH_VAULTS[@]:0:$MAX_BATCH}")
    NEW_COUNT=$MAX_BATCH
fi
```
With:
```bash
NEW_COUNT=${#BATCH_VAULTS[@]}
```

- [ ] **Step 4: Pass all market IDs to curator docker (line 1728-1729)**

Replace the single market ID:
```yaml
      - "--market-ids"
      - "$MARKET_ID"
```
With all market IDs, oracle addresses, and ITP addresses from batch-markets.json:
```yaml
      - "--market-ids"
      - "$(python3 -c "import json; d=json.load(open('deployments/batch-markets.json')); print(','.join([m['marketId'] for m in d['markets']]))" 2>/dev/null || echo "$MARKET_ID")"
```

Also update `--oracle-addresses` (line 1742) and `--itp-addresses` (line 1744) to pass all:
```yaml
      - "--oracle-addresses"
      - "$(python3 -c "import json; d=json.load(open('deployments/batch-markets.json')); print(','.join([m['oracle'] for m in d['markets']]))" 2>/dev/null || echo "$ORACLE_ADDR")"
      - "--itp-addresses"
      - "$(python3 -c "import json; d=json.load(open('deployments/batch-markets.json')); print(','.join([m['collateralToken'] for m in d['markets']]))" 2>/dev/null || echo "$ITP_ADDR")"
```

- [ ] **Step 5: Commit**

```bash
git add testnet.sh
git commit -m "fix: testnet.sh reads CURATOR_RATE_IRM key, no queue caps, all market IDs to curator"
```

---

## Task 3: Frontend — Delete dead code, fix morpho-addresses

**Files:**
- Delete: `frontend/hooks/useMorphoMarkets.ts`
- Delete: `frontend/components/lending/MarketsTable.tsx`
- Modify: `frontend/lib/contracts/morpho-addresses.ts`

- [ ] **Step 0: Fix deploy-batch-markets.sh IRM key read (line 23)**

```bash
# Change:
CURATOR_IRM=$(jq -r '.contracts.ADAPTIVE_IRM' "$MORPHO_DEPLOYMENT")
# To:
CURATOR_IRM=$(jq -r '.contracts.CURATOR_RATE_IRM // .contracts.ADAPTIVE_IRM' "$MORPHO_DEPLOYMENT")
```

- [ ] **Step 1: Fix `getDefaultMarketParams` IRM field**

In `morpho-addresses.ts`, change:
```typescript
irm: MORPHO_ADDRESSES.adaptiveIrm,
```
To:
```typescript
irm: MORPHO_ADDRESSES.curatorRateIrm,
```

- [ ] **Step 2: Delete dead files**

```bash
rm frontend/hooks/useMorphoMarkets.ts
rm frontend/components/lending/MarketsTable.tsx
```

- [ ] **Step 3: Remove useMorphoMarkets from lending/index.ts barrel export**

Check if `frontend/components/lending/index.ts` exports MarketsTable and remove the line.

- [ ] **Step 4: Fix VaultModal — remove useMorphoMarkets import and usage**

In `VaultModal.tsx`, remove:
```typescript
import { useMorphoMarkets } from '@/hooks/useMorphoMarkets'
```
And remove line 92:
```typescript
const { markets, refetch: refetchMarkets } = useMorphoMarkets()
```
And the `refetchMarkets` from the refresh handler.

Replace `market = markets[0]` and derived values with aggregates from `allMarketData`:
```typescript
// Aggregate stats from all markets
const { totalSupply, totalBorrow, weightedBorrowApy } = useMemo(() => {
  let ts = 0n, tb = 0n, weightedRate = 0
  if (allMarketData) {
    for (const m of allMarketData.values()) {
      ts += m.totalSupplyAssets
      tb += m.totalBorrowAssets
      weightedRate += m.borrowApy * Number(m.totalBorrowAssets)
    }
  }
  return {
    totalSupply: ts,
    totalBorrow: tb,
    weightedBorrowApy: tb > 0n ? weightedRate / Number(tb) : 0,
  }
}, [allMarketData])

const borrowApy = weightedBorrowApy
const utilization = totalSupply > 0n ? Number((totalBorrow * 10000n) / totalSupply) / 100 : 0
const supplyApy = borrowApy > 0 ? borrowApy * utilization / 100 : (vaultInfo?.apy ?? 0)
```

Replace `collateralValue` formula — remove `market.navPrice` dependency (oracle price = 1e36 = 1:1):
```typescript
const collateralValue = position?.collateralAmount
  ? `$${parseFloat(formatUnits(position.collateralAmount, 18)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  : '—'
```

Replace `$0.00` borrow panel values with `'—'` when no position exists:
```typescript
const outstandingDebt = position?.debtAmount && position.debtAmount > 0n
  ? `$${parseFloat(formatUnits(position.debtAmount, 18)).toLocaleString(...)}`
  : '—'
const maxBorrow = position?.maxBorrow && position.maxBorrow > 0n
  ? `$${parseFloat(formatUnits(position.maxBorrow, 18)).toLocaleString(...)}`
  : '—'
```

- [ ] **Step 5: Remove useMetaMorphoVault singleton market reads**

In `useMetaMorphoVault.ts`:

1. Remove the `useReadContract` for `MORPHO_ABI` `market` function (lines 126-139) and the `irmStoredRate` read (lines 142-153).

2. **CRITICAL: Remove `&& marketData` from the vaultInfo guard** (line 160). Change:
```typescript
if (totalAssets !== undefined && name !== undefined && symbol !== undefined && marketData) {
```
To:
```typescript
if (totalAssets !== undefined && name !== undefined && symbol !== undefined) {
```
Without this, `vaultInfo` is permanently `undefined` and the entire lending UI is dead.

3. **CRITICAL: Remove `refetchMarket` from the `refetch` function** and `isMarketLoading` from `isLoading`:
```typescript
const refetch = () => {
  refetchTotalAssets()
  refetchTotalSupply()
  refetchUserShares()
  // refetchMarket removed — no longer exists
}
// ...
isLoading: isTotalAssetsLoading || isTotalSupplyLoading || isNameLoading || isSymbolLoading || isDecimalsLoading || isUserSharesLoading,
// removed: || isMarketLoading
```

4. Remove all `borrowApy`/`utilization`/`supplyApy` computation. Simplify `vaultInfo`:
```typescript
vaultInfo = {
  address: MORPHO_ADDRESSES.metaMorphoVault,
  name: name as string,
  symbol: symbol as string,
  totalAssets: totalAssets as bigint,
  apy: 0, // Overridden by VaultModal from aggregate data
  utilization: 0,
  decimals: vaultDecimals,
}
```

5. Remove unused imports: `MORPHO_ABI`, `CURATOR_RATE_IRM_ABI`, `useSSEOracle`, `MORPHO_ADDRESSES.marketId`

- [ ] **Step 5b: Fix VaultModal — remove ALL `market` variable references**

After removing `useMorphoMarkets`, the `market = markets[0]` variable is gone. Fix ALL references:

- `borrowApy = market?.borrowApy` → replaced by `weightedBorrowApy` (from step 4 aggregate)
- `market.navPrice` in `collateralValue` → use `position?.oraclePrice` from `useMorphoPosition` instead:
```typescript
const oraclePrice = position?.oraclePrice ? parseFloat(formatUnits(BigInt(position.oraclePrice), 36)) : 1
const collateralValue = position?.collateralAmount
  ? `$${(parseFloat(formatUnits(position.collateralAmount, 18)) * oraclePrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  : '—'
```
- `market?.lltvPercent` → hardcode `77` or read from first `allMarketData` entry:
```typescript
const lltvPercent = allMarketData && allMarketData.size > 0
  ? Number([...allMarketData.values()][0].lltv) / 1e16
  : 77
```
- `refetchMarkets` in `handleRefresh` → remove the call entirely

- [ ] **Step 6: Type-check**

```bash
cd frontend && npx tsc --noEmit --pretty 2>&1 | head -20
```
Expected: no errors.

- [ ] **Step 7: Build**

```bash
npx next build 2>&1 | tail -5
```
Expected: build succeeds.

- [ ] **Step 8: Commit**

```bash
git add -A frontend/
git commit -m "fix: delete useMorphoMarkets + MarketsTable dead code, aggregate stats from all markets"
```

---

## Task 4: E2E Test — Lending Curator

**Files:**
- Create: `frontend/e2e/tests/28-lending-curator.spec.ts`

- [ ] **Step 1: Write the test**

Use wallet fixture (not raw `@playwright/test`). Scope locators to `#lend`. Use proper wait patterns.
Number as `09-` to fall into `itp-data` project (matches `0[1-578]-`... actually use `28-` for `ui-verify-itp`).

```typescript
/**
 * 28-lending-curator — Verify lending markets have real data after curator reform.
 */
import { test, expect } from '../fixtures/wallet'
import { FRONTEND_URL } from '../env'

test.describe('Lending Curator', () => {
  test('28a: lending section shows non-zero vault TVL', async ({ walletPage: page }) => {
    // Navigate to lending section
    const lendBtn = page.locator('button:has-text("Lending")')
    await expect(lendBtn).toBeVisible({ timeout: 15_000 })
    await lendBtn.click()
    await page.waitForTimeout(2000)

    const lendSect = page.locator('#lend')
    await expect(lendSect).toBeVisible({ timeout: 30_000 })

    // Vault TVL should not be '--'
    const tvlCell = lendSect.locator('text=/Vault TVL/').locator('..').locator('p')
    await expect(tvlCell).not.toHaveText('--', { timeout: 30_000 })
  })

  test('28b: markets table has rows with borrow APY', async ({ walletPage: page }) => {
    const lendBtn = page.locator('button:has-text("Lending")')
    await expect(lendBtn).toBeVisible({ timeout: 15_000 })
    await lendBtn.click()

    const lendSect = page.locator('#lend')
    await expect(lendSect).toBeVisible({ timeout: 30_000 })

    // Scoped to #lend to avoid matching other tables
    const marketTable = lendSect.locator('table').first()
    await expect(marketTable).toBeVisible({ timeout: 30_000 })

    const rows = marketTable.locator('tbody tr')
    await expect(rows.first()).toBeVisible({ timeout: 30_000 })
    const rowCount = await rows.count()
    expect(rowCount, 'Markets table should have rows').toBeGreaterThan(0)

    // At least one row should have a non-placeholder borrow APY
    const apyCells = marketTable.locator('tbody tr td:nth-child(3)')
    const allText = await apyCells.allTextContents()
    const hasRealApy = allText.some(t => t.includes('%') && !t.includes('--'))
    expect(hasRealApy, 'At least one market should show real borrow APY').toBe(true)
  })
})
```

File name: `frontend/e2e/tests/28-lending-curator.spec.ts`
```

- [ ] **Step 2: Commit**

```bash
git add frontend/e2e/tests/48-lending-curator.spec.ts
git commit -m "test: E2E lending curator — verify markets have real TVL and APY"
```

---

## Task 5: Seeding — Fix seed-lending.sh to supply USDC before borrowing

**Files:**
- Modify: `scripts/seed-lending.sh`

- [ ] **Step 1: Add USDC supply step before borrow in Phase 2**

In the Phase 2 loop, before the `supplyCollateral` call, add USDC supply:
```python
    # Supply USDC to market (provides liquidity for borrowing)
    supply_usdc = str(rand_borrow * 3 * 10**18)  # 3x headroom
    cast_send(MORPHO,
        "supply((address,address,address,address,uint256),uint256,uint256,address,bytes)",
        mp, supply_usdc, "0", DEPLOYER, "0x")
```

This was missing — the previous version only supplied collateral but no USDC, so borrows silently failed.

- [ ] **Step 2: Vary utilization ratios**

Replace the fixed `3x` headroom with random multiplier. Use the ACTUAL borrow amount (after cap) to size supply:
```python
    # Size supply based on actual borrow (after collateral cap), not uncapped rand_borrow
    actual_borrow = borrow_wei / 10**18  # in USDC units
    headroom = random.uniform(1.5, 5.0)  # 20-67% utilization
    supply_usdc = str(int(actual_borrow * headroom * 10**18))
```

- [ ] **Step 3: Commit**

```bash
git add scripts/seed-lending.sh
git commit -m "fix: seed-lending supplies USDC before borrowing, varied utilization"
```

---

## Task 6: Final — Push and verify

- [ ] **Step 1: Full type-check + build**

```bash
cd frontend && npx tsc --noEmit && npx next build 2>&1 | tail -5
```

- [ ] **Step 2: Push all changes**

```bash
git push mono main
```

- [ ] **Step 3: Verify deployment propagation**

After Vercel deploys, check the live site's lending section shows real data.
