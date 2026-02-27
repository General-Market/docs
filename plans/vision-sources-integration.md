# Vision Sources Integration Plan

> Integrate the mockup (`/public/mockup-polymarket-sources.html`) into the Next.js frontend as the main Vision page at `/`.

## Current State

**Already exists:**
- Vision page at `/app/[locale]/page.tsx` with `VisionPageContent`
- 23 hooks in `/hooks/vision/` (batches, snapshots, bitmaps, leaderboard, etc.)
- Components in `/components/domain/vision/` (VisionPage, BatchCard, CreateBatchModal, etc.)
- Data pipeline: data-node `/snapshot` → `/api/vision/snapshot` proxy → React Query
- 83 data sources in `data-node/src/market_data/sources/`
- Market categorization in `/lib/vision/market-categories.ts` (56 prefixes)

**Missing (from mockup):**
- Sources browse grid with flip cards + interactive bitmap
- "Next Batches" horizontal scroll section
- Category subnav filter (Finance, Economic, Tech, etc.)
- Source detail page (markets table, batch entry panel, strategies)
- Per-source card with brand image + bitmap overlay

---

## Architecture

```
/app/[locale]/page.tsx                    ← Landing: sources grid (browse)
/app/[locale]/source/[sourceId]/page.tsx  ← Source detail (markets + batch panel)

/components/domain/vision/
  sources/
    SourcesGrid.tsx          ← Grid of flip cards
    SourceCard.tsx            ← Single flip card (front + bitmap back)
    BitmapOverlay.tsx         ← Interactive bitmap cells (UP/DN/empty toggle)
    CategoryNav.tsx           ← Subnav category filter pills
    NextBatches.tsx           ← Horizontal scroll batch cards with timers
    SortBar.tsx               ← Trending / New / Most Assets / Volume
  detail/
    SourceDetail.tsx          ← Detail page layout (hero + split content)
    SourceHero.tsx            ← Brand image + badges + stats
    MarketsTable.tsx          ← Scrollable market rows with consensus
    ConsensusPopup.tsx        ← Click-to-show consensus history per market
    BatchEntryPanel.tsx       ← Right panel: timer, stake, enter, strategies
    StrategyList.tsx          ← Premade + user strategies + deploy button
    TopPlayers.tsx            ← Leaderboard section

/lib/vision/
  sources.ts                 ← Source registry (id, name, category, logo, colors)
  source-categories.ts       ← Category definitions + filter logic

/hooks/vision/
  useBitmapEditor.ts         ← Local bitmap state management
```

---

## Parallel Execution Plan

> Max 3 agents at a time (per CLAUDE.md). All work streams within a phase can run simultaneously. Phase N+1 starts only after phase N completes.

### Phase 0 — Foundation (sequential, 1 agent)

**Must run first — all other phases depend on these shared types/data.**

| Step | Files | Description |
|------|-------|-------------|
| 0.1 | `/lib/vision/sources.ts` | Source registry: `VisionSource` interface + all 83 entries with id, name, category, logo path, brandBg color |
| 0.2 | `/lib/vision/source-categories.ts` | `SourceCategory` type, category labels, `getSourcesByCategory()`, `getCategoryCounts()` |
| 0.3 | `/hooks/vision/useBitmapEditor.ts` | Local bitmap state hook: stores draft edits in React state, toggle cell (empty→UP→DN→empty), counts, persist to localStorage, group by source |
| 0.4 | `/app/globals.css` | Add flip card CSS (`.source-flip-card`, `.source-front`, `.source-back`, `.bitmap-cell`, `.bitmap-grid`) — copy from mockup |

**Output:** shared types + data layer that all 3 work streams consume.

---

### Phase 1 — Three parallel work streams (3 agents)

```
┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│  AGENT A: Browse     │  │  AGENT B: Detail     │  │  AGENT C: Right      │
│  Page Components     │  │  Page Left Side      │  │  Panel + Wiring      │
└─────────────────────┘  └─────────────────────┘  └─────────────────────┘
```

#### Agent A — Browse Page (sources grid)

No dependency on B or C. Only depends on Phase 0 outputs.

| Step | File | Description |
|------|------|-------------|
| A.1 | `sources/CategoryNav.tsx` | Horizontal scrollable subnav below header. Reads categories from `source-categories.ts`. Sticky at `top: 64px`. Active pill styling from `globals.css` `.subnav-btn` pattern. Calls `onCategoryChange(cat)` prop. |
| A.2 | `sources/SortBar.tsx` | Sort button row: Trending / New / Most Assets / Volume. Calls `onSortChange(sort)` prop. Uses `.sort-btn` styling. |
| A.3 | `sources/NextBatches.tsx` | Horizontal scroll of batch cards. Uses `useBatches()` hook. Shows: batch ID, countdown timer (`setInterval`), TVL, player count. Active batch = 2px black border. Click calls `onBatchSelect(batchId)`. |
| A.4 | `sources/BitmapOverlay.tsx` | Renders bitmap cells for a source's markets. Props: `sourceId`, `markets[]`, `bitmapState` from `useBitmapEditor()`. Each cell 28x28px, click calls `toggleCell(marketId)`. Footer: "X UP / Y DN / Z unset". |
| A.5 | `sources/SourceCard.tsx` | Single flip card. Front: `card-brand` (120px, source bg color) + `card-body` (title). Back: `BitmapOverlay`. CSS 3D flip on hover. `.pinned` class on click. Second click → `router.push(/source/[id])`. |
| A.6 | `sources/SourcesGrid.tsx` | Orchestrates everything: CategoryNav + SortBar + section bar + CSS grid of SourceCards. Filters by category, sorts, passes `useBitmapEditor()` state down. Uses `useMarketSnapshot()` for market counts per source. |
| A.7 | `/app/[locale]/page.tsx` | Replace `VisionPageContent` with `SourcesGrid` as the main content. Keep existing layout/providers. |

**Tests:** renders grid, category filter hides/shows cards, sort reorders, flip animation works, bitmap cell toggle cycles states.

#### Agent B — Detail Page Left Side

No dependency on A or C. Only depends on Phase 0 outputs.

| Step | File | Description |
|------|------|-------------|
| B.1 | `detail/SourceHero.tsx` | Hero card: brand image area (140px) + info section (gray bg). Props: `source: VisionSource`. Badges, title, description, stats row (series count, health dot, update time, API badge). |
| B.2 | `detail/ConsensusPopup.tsx` | Absolute-positioned popup. Props: `marketId`, `history[]`. Shows last 5 batch consensus values. Click-outside to close. |
| B.3 | `detail/MarketsTable.tsx` | Full markets table. Column header with 3px black border. Columns: name, price, Δ1d, Δ7d, last consensus (clickable → ConsensusPopup), UP/DN buttons. Props: `sourceId`, `bitmapEditor`. Uses `useMarketSnapshot()` filtered by source prefix. Search input. |
| B.4 | `detail/TopPlayers.tsx` | Leaderboard section below markets table. Uses `useVisionLeaderboard()`. 5 rows: rank, truncated address, win rate %, P&L. |
| B.5 | `detail/SourceDetail.tsx` | Layout shell: back link + SourceHero + batch bar + `<div class="detail-content">` with left slot (MarketsTable + TopPlayers) and right slot (children/prop for panel). |
| B.6 | `/app/[locale]/source/[sourceId]/page.tsx` | Route page. Reads `sourceId` param, looks up in source registry, renders `SourceDetail` with `BatchEntryPanel` in right slot. |

**Tests:** hero renders source data, markets table filters by source, consensus popup opens/closes, UP/DN buttons toggle, search filters rows.

#### Agent C — Right Panel + Data Wiring

No dependency on A or B. Only depends on Phase 0 outputs.

| Step | File | Description |
|------|------|-------------|
| C.1 | `detail/StrategyList.tsx` | Strategies section. Premade list (Momentum Follower, Contrarian, All Long-Term UP) with badges. User strategies from localStorage. "Deploy with Claude Code Agent" button → opens strategy editor modal (reuse existing `PythonEditor.tsx` in a modal). |
| C.2 | `detail/BatchEntryPanel.tsx` | Right panel (300px, sticky). Sections: header (Enter Batch + batch ID), timer (32px mono countdown), stake input (USDC + quick buttons), "Enter Batch" button, StrategyList. Uses `useBatches()` for timer, `useJoinBatch()` + `useSubmitBitmap()` for entry. Props: `bitmapEditor` for reading current bitmap state. |
| C.3 | Enhance `useBitmapEditor.ts` | Add: `applyStrategy(strategyFn)` to bulk-set bitmap from strategy output, `getBitmapForSubmission()` to convert local state → on-chain format using existing `bitmap.ts` encoding, `getSourceBitmap(sourceId)` to extract per-source view. |

**Tests:** strategy list renders premade + user items, batch entry panel shows timer, stake input updates, enter batch calls hooks, strategy apply updates bitmap.

---

### Phase 2 — Assembly + Polish (1-2 agents)

After all Phase 1 agents complete, assemble and polish.

| Step | Description |
|------|-------------|
| 2.1 | **Wire browse → detail navigation**: SourceCard click → `/source/[id]`, back link → `/`. Verify `bitmapEditor` state persists across navigation (localStorage). |
| 2.2 | **Wire batch entry flow**: Enter Batch button reads full bitmap from `useBitmapEditor`, encodes via `bitmap.ts`, calls `useSubmitBitmap()` then `useJoinBatch()`. Verify tx stepper works. |
| 2.3 | **Responsive**: Mobile stack layout (detail: table full-width, panel below). Tablet: 2-col grid. Category nav horizontal scroll. Reduced motion: disable flip, show bitmap inline. |
| 2.4 | **Strategy editor modal**: Wire "Deploy with Claude Code Agent" → existing `PythonEditor.tsx` in modal. Script output → `bitmapEditor.applyStrategy()`. Preview counts. |
| 2.5 | **Code review**: Run against mockup, verify visual parity. Check all 83 sources render. Check bitmap cell interaction works end-to-end. |

---

## File Manifest

| File | Phase | Agent | Action |
|------|-------|-------|--------|
| `/lib/vision/sources.ts` | 0 | — | Create |
| `/lib/vision/source-categories.ts` | 0 | — | Create |
| `/hooks/vision/useBitmapEditor.ts` | 0 | — | Create |
| `/app/globals.css` | 0 | — | Modify |
| `/components/domain/vision/sources/CategoryNav.tsx` | 1 | A | Create |
| `/components/domain/vision/sources/SortBar.tsx` | 1 | A | Create |
| `/components/domain/vision/sources/NextBatches.tsx` | 1 | A | Create |
| `/components/domain/vision/sources/BitmapOverlay.tsx` | 1 | A | Create |
| `/components/domain/vision/sources/SourceCard.tsx` | 1 | A | Create |
| `/components/domain/vision/sources/SourcesGrid.tsx` | 1 | A | Create |
| `/app/[locale]/page.tsx` | 1 | A | Modify |
| `/components/domain/vision/detail/SourceHero.tsx` | 1 | B | Create |
| `/components/domain/vision/detail/ConsensusPopup.tsx` | 1 | B | Create |
| `/components/domain/vision/detail/MarketsTable.tsx` | 1 | B | Create |
| `/components/domain/vision/detail/TopPlayers.tsx` | 1 | B | Create |
| `/components/domain/vision/detail/SourceDetail.tsx` | 1 | B | Create |
| `/app/[locale]/source/[sourceId]/page.tsx` | 1 | B | Create |
| `/components/domain/vision/detail/StrategyList.tsx` | 1 | C | Create |
| `/components/domain/vision/detail/BatchEntryPanel.tsx` | 1 | C | Create |
| `/hooks/vision/useBitmapEditor.ts` | 1 | C | Enhance |

---

## Shared Contracts (between agents)

Agents must agree on these interfaces established in Phase 0:

```ts
// Agent A, B, C all import from Phase 0 outputs

import { VisionSource, SourceCategory } from '@/lib/vision/sources';
import { getSourcesByCategory } from '@/lib/vision/source-categories';
import { useBitmapEditor, BitmapEditor } from '@/hooks/vision/useBitmapEditor';

// BitmapEditor interface (shared prop type)
interface BitmapEditor {
  state: Record<string, 'up' | 'down' | 'empty'>;  // marketId → state
  toggleCell(marketId: string): void;
  getSourceBitmap(sourceId: string): Record<string, 'up' | 'down' | 'empty'>;
  getCounts(sourceId?: string): { up: number; down: number; empty: number };
  applyStrategy(fn: (markets: string[]) => Record<string, 'up' | 'down'>): void;
  getBitmapForSubmission(): Uint8Array;
  reset(): void;
}

// SourceDetail right slot pattern (Agent B provides slot, Agent C fills it)
// Agent B: <SourceDetail rightPanel={<BatchEntryPanel />} />
// Agent C: <BatchEntryPanel bitmapEditor={editor} sourceId={id} />
```

---

## Dependencies

- No new packages
- Reuses: React Query, next-intl, existing Vision hooks, Pyodide
- Logo images: `/public/source-imgs/` (83 source logos already present)

## Risk Notes

- **Phase 0 is the bottleneck** — keep it tight, don't over-engineer
- **Agent file conflicts**: zero overlap by design (A = `sources/`, B = `detail/` left, C = `detail/` right)
- **`page.tsx` conflict**: only Agent A touches `/app/[locale]/page.tsx`, only Agent B touches `/app/[locale]/source/[sourceId]/page.tsx`
- **`useBitmapEditor`**: Phase 0 creates it, Agent C enhances it — no conflict since Phase 0 completes first
