# Frontend Deduplication: Remove p2pool, Keep Vision

**Date:** 2026-02-28
**Goal:** Remove all p2pool duplicate code. Vision is the superset — p2pool is a strict copy-paste subset with no unique functionality.

## Context

The `p2pool` and `vision` subsystems contain 15+ near-identical files across components, hooks, and lib. Vision is the maintained version (has PostHog tracking, extra market categories, additional hooks/components). No app pages import from p2pool.

## Inventory of files to delete

### `components/domain/p2pool/` — 17 files (all duplicated in vision)
- P2PoolPage.tsx, BatchCard.tsx, CreateBatchModal.tsx, DepositModal.tsx, WithdrawModal.tsx
- ExpandedBatch.tsx, MyPositions.tsx, MarketAccordion.tsx, ScriptTab.tsx, VisualTab.tsx
- CompactVisualTab.tsx, PythonEditor.tsx, StrategyTemplates.tsx
- headers/: BarGridHeader.tsx, BitmapMosaicHeader.tsx, HeatmapHeader.tsx, SparklineHeader.tsx

### `hooks/p2pool/` — 18 files (all duplicated in vision)
- useCreateBatch.ts, useDeposit.ts, useWithdraw.ts, useJoinBatch.ts
- useBacktest.ts, useBatchHistory.ts, useBatchMetadata.ts, useBatchState.ts, useBatches.ts
- useClaim.ts, useMarketRegistry.ts, usePlayerBatches.ts, usePlayerPosition.ts
- usePyodide.ts, useSetBatchMetadata.ts, useSetDeployerName.ts, useSubmitBitmap.ts
- useVisionDeployerName.ts

### `lib/p2pool/` — 3 files (all duplicated in vision)
- bitmap.ts, bitmap-store.ts, market-categories.ts

**Total: 38 files to delete**

## Steps

### Step 1: Verify no external references
- Grep entire frontend for imports from `p2pool/` or `@/hooks/p2pool` or `@/lib/p2pool` or `@/components/domain/p2pool`
- Known references (only 2):
  - `components/domain/p2pool/PythonEditor.tsx` imports `@/hooks/p2pool/useBacktest` — this file is being deleted
  - `hooks/p2pool/useJoinBatch.ts` has a comment mentioning "p2pool variant" — this file is being deleted
- Confirm no app/ pages reference p2pool

### Step 2: Delete p2pool directories
```
rm -rf frontend/components/domain/p2pool/
rm -rf frontend/hooks/p2pool/
rm -rf frontend/lib/p2pool/
```

### Step 3: Verify build
```
cd frontend && npm run build
```
If build succeeds with no errors, the deletion is clean.

### Step 4: Verify tests
```
cd frontend && npm test
```
Fix any test files that import from p2pool paths.

### Step 5: Commit
Commit with message: `refactor(frontend): remove p2pool duplicate — vision is the canonical implementation`

## Risk Assessment

**Risk: Very Low**
- No app pages reference p2pool
- No cross-imports between p2pool and vision
- p2pool is a strict subset of vision (zero unique functionality)
- Only 2 internal p2pool references, both within files being deleted
