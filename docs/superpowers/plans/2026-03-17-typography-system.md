# Typography System Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace ~1,200 hardcoded `text-[Npx]` values across 150+ files with a strict 8-step type scale, normalize letter-spacing and line-height, and add responsive variants.

**Architecture:** Define the type scale in `tailwind.config.js` with baked-in line-heights. Create composite utility classes in `globals.css` for repeated patterns (label, stat-value, table-header). Then mechanically refactor every component file using the mapping table below.

**Tech Stack:** Tailwind CSS, Next.js (App Router), Inter + JetBrains Mono fonts

---

## Type Scale

```js
// tailwind.config.js → theme.extend.fontSize
fontSize: {
  'micro':   ['0.625rem',  { lineHeight: '1.4' }],   // 10px
  'label':   ['0.6875rem', { lineHeight: '1.4' }],   // 11px
  'caption': ['0.75rem',   { lineHeight: '1.5' }],   // 12px
  'body':    ['0.875rem',  { lineHeight: '1.6' }],   // 14px
  'subhead': ['1rem',      { lineHeight: '1.4' }],   // 16px
  'heading': ['1.25rem',   { lineHeight: '1.3' }],   // 20px
  'title':   ['1.375rem',  { lineHeight: '1.2' }],   // 22px
  'display': ['2rem',      { lineHeight: '1.15' }],   // 32px
}
```

## Size Mapping Table

| Old value(s) | New token | Notes |
|---|---|---|
| `text-[10px]` | `text-micro` | Footnotes, bitmap cells, timestamps, micro-data |
| `text-[11px]` | `text-label` | Table headers, section bar titles, badges, uppercase labels |
| `text-[12px]`, `text-[13px]` | `text-caption` | Nav items, metadata, secondary info, balance displays |
| `text-[14px]`, `text-[15px]` | `text-body` | Body copy, descriptions, form inputs |
| `text-[16px]` | `text-subhead` | Card headings, prominent body, nav links |
| `text-[18px]`, `text-[20px]` | `text-heading` | Stat values, section headings |
| `text-[22px]` | `text-title` | Section titles, modal titles, logo |
| `text-[28px]`, `text-[32px]` | `text-display` | Page titles (one per page) |
| `text-[7px]`–`text-[9px]` | **LEAVE AS-IS** | Learn/diagram 3D canvas labels — intentionally tiny |
| `text-[36px]`+ | **LEAVE AS-IS** | Rare hero/display text in learn pages — case-by-case |

## Tracking Normalization

| Context | Old (various) | New (standardized) |
|---|---|---|
| Uppercase labels (micro, label) | `tracking-wider`, `tracking-[0.12em]`, `tracking-[0.08em]`, `tracking-wide` | `tracking-[0.08em]` |
| Body, caption, subhead | default or various | default (remove explicit tracking) |
| Headings (heading, title, display) | `tracking-[-0.02em]`, `tracking-[-0.03em]` | `tracking-tight` (Tailwind built-in = -0.025em) |

## Composite Utility Classes (globals.css)

```css
/* ── TYPE UTILITIES ── */
.type-label {
  /* 11px, semibold, uppercase, spaced, muted — for table headers, section labels, card labels */
  font-size: 0.6875rem; line-height: 1.4;
  font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.08em; color: var(--text-muted, #999999);
}
.type-table-header {
  /* 11px, bold, uppercase, spaced, secondary — for <th> elements */
  font-size: 0.6875rem; line-height: 1.4;
  font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.025em; color: var(--text-secondary, #555555);
}
.type-stat-value {
  /* 20px, black weight, tight tracking — for metric cards */
  font-size: 1.25rem; line-height: 1.3;
  font-weight: 900; letter-spacing: -0.025em;
}
.type-display {
  /* 32px, black weight, tight tracking, tight leading — for page titles */
  font-size: 2rem; line-height: 1.15;
  font-weight: 900; letter-spacing: -0.025em;
}
```

## File Batches

### Batch 0 — Foundation
- `frontend/tailwind.config.js`
- `frontend/app/globals.css`

### Batch 1 — UI Primitives (7 files)
- `frontend/components/ui/Table.tsx`
- `frontend/components/ui/Input.tsx`
- `frontend/components/ui/Toast.tsx`
- `frontend/components/ui/ErrorBoundary.tsx`
- `frontend/components/ui/HowItWorksButton.tsx`
- `frontend/components/ui/TransactionStepper.tsx`
- `frontend/components/ui/YouTubeLite.tsx`

### Batch 2 — Layout (1 file, complex)
- `frontend/components/layout/Header.tsx`

### Batch 3 — Domain Cards (6 files)
- `frontend/components/domain/BetCard.tsx`
- `frontend/components/domain/BetCardSkeleton.tsx`
- `frontend/components/domain/BilateralBetCard.tsx`
- `frontend/components/domain/BilateralBetsList.tsx`
- `frontend/components/domain/AnimatedBetFeedItem.tsx`
- `frontend/components/domain/AnimatedLeaderboardRow.tsx`

### Batch 4 — Vision Core (6 files)
- `frontend/components/domain/vision/VisionPage.tsx`
- `frontend/components/domain/vision/VisionMarketsGrid.tsx`
- `frontend/components/domain/vision/VisionLeaderboard.tsx`
- `frontend/components/domain/vision/VisualTab.tsx`
- `frontend/components/domain/vision/CompactVisualTab.tsx`
- `frontend/components/domain/vision/BalanceDepositModal.tsx`

### Batch 5 — Vision Detail (7 files)
- `frontend/components/domain/vision/detail/SourceHero.tsx`
- `frontend/components/domain/vision/detail/MarketsTable.tsx`
- `frontend/components/domain/vision/detail/TopPlayers.tsx`
- `frontend/components/domain/vision/detail/StrategyList.tsx`
- `frontend/components/domain/vision/detail/BatchEntryPanel.tsx`
- `frontend/components/domain/vision/detail/ConsensusPopup.tsx`
- `frontend/components/domain/vision/detail/DeployAgentModal.tsx`

### Batch 6 — Vision Sources (3 files)
- `frontend/components/domain/vision/sources/SourceCard.tsx`
- `frontend/components/domain/vision/sources/SourcesGrid.tsx`
- `frontend/components/domain/vision/sources/NextBatches.tsx`

### Batch 7 — Explorer (1 + sections)
- `frontend/components/domain/explorer/ExplorerSummaryBar.tsx`
- All other `frontend/components/domain/explorer/*.tsx` files

### Batch 8 — ITP & Portfolio (10 files)
- `frontend/components/domain/ItpListing.tsx`
- `frontend/components/domain/CreateItpSection.tsx`
- `frontend/components/domain/BuyItpModal.tsx`
- `frontend/components/domain/SellItpModal.tsx`
- `frontend/components/domain/OrderbookDrawer.tsx`
- `frontend/components/domain/PortfolioSection.tsx`
- `frontend/components/domain/PortfolioResolution.tsx`
- `frontend/components/domain/PerformanceSection.tsx`
- `frontend/components/domain/PerformanceGraph.tsx`
- `frontend/components/domain/LeaderboardTable.tsx`

### Batch 9 — ITP Page Sections (5 files)
- `frontend/components/domain/itp-page/sections/KeyStatsBar.tsx`
- `frontend/components/domain/itp-page/sections/PerformanceChart.tsx`
- `frontend/components/domain/itp-page/sections/PortfolioBreakdown.tsx`
- `frontend/components/domain/itp-page/sections/FounderDemographics.tsx`
- `frontend/components/domain/itp-page/sections/FundingOverview.tsx` (if exists)

### Batch 10 — Remaining Domain (10+ files)
- `frontend/components/domain/ArbitrationBadge.tsx`
- `frontend/components/domain/BotTradingNotice.tsx`
- `frontend/components/domain/DeployAgentCTA.tsx`
- `frontend/components/domain/KeeperSignatureList.tsx`
- `frontend/components/domain/SignatureProgress.tsx`
- `frontend/components/domain/StatsGridSkeleton.tsx`
- `frontend/components/domain/TelegramConnect.tsx`
- `frontend/components/domain/profile/BatchTickRow.tsx`
- `frontend/components/domain/simulation/SimFilterPanel.tsx`
- `frontend/components/domain/simulation/SimStatsGrid.tsx`
- `frontend/components/ChainGuard.tsx`

### Batch 11 — Lending (8 files)
- `frontend/components/lending/BorrowUsdc.tsx`
- `frontend/components/lending/DepositCollateral.tsx`
- `frontend/components/lending/LendingHistory.tsx`
- `frontend/components/lending/MarketsTable.tsx`
- `frontend/components/lending/PositionCard.tsx`
- `frontend/components/lending/RepayDebt.tsx`
- `frontend/components/lending/VaultDeposit.tsx`
- `frontend/components/lending/WithdrawCollateral.tsx`

### Batch 12 — Learn (selective)
- `frontend/components/learn/FadeInSection.tsx`
- `frontend/components/learn/diagrams/BeforeAfterScene.tsx` — SELECTIVE (leave 7-9px 3D sizes)
- `frontend/components/learn/diagrams/EIPTimeline.tsx`
- `frontend/components/learn/diagrams/EIPTimeline3D.tsx` — SELECTIVE
- `frontend/components/learn/diagrams/FrameFlow.tsx`
- `frontend/components/learn/diagrams/PrivacyDiagram.tsx`
- `frontend/components/learn/diagrams/VisualCards.tsx`
- All files in `frontend/components/learn/diagrams/eip8141/`
- All files in `frontend/components/learn/diagrams/eip8141-v2/`
- All files in `frontend/components/learn/diagrams/scaling/`

### Batch 13 — App Pages (6 files)
- `frontend/app/[locale]/about/page.tsx`
- `frontend/app/[locale]/legal-index/page.tsx`
- `frontend/app/[locale]/legal-vision/page.tsx`
- `frontend/app/[locale]/privacy/page.tsx`
- `frontend/app/[locale]/terms/page.tsx`
- `frontend/app/[locale]/points/PointsPageClient.tsx`

---

## Tasks

### Task 0: Foundation — Type Scale + Utility Classes

**Files:**
- Modify: `frontend/tailwind.config.js`
- Modify: `frontend/app/globals.css`

- [ ] **Step 1: Add fontSize to tailwind.config.js**

In `theme.extend`, add:
```js
fontSize: {
  'micro':   ['0.625rem',  { lineHeight: '1.4' }],
  'label':   ['0.6875rem', { lineHeight: '1.4' }],
  'caption': ['0.75rem',   { lineHeight: '1.5' }],
  'body':    ['0.875rem',  { lineHeight: '1.6' }],
  'subhead': ['1rem',      { lineHeight: '1.4' }],
  'heading': ['1.25rem',   { lineHeight: '1.3' }],
  'title':   ['1.375rem',  { lineHeight: '1.2' }],
  'display': ['2rem',      { lineHeight: '1.15' }],
},
```

- [ ] **Step 2: Add composite utility classes to globals.css**

After the `:root` block, add:
```css
/* ── TYPE UTILITIES ── */
.type-label {
  font-size: 0.6875rem; line-height: 1.4;
  font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.08em; color: #999999;
}
.type-table-header {
  font-size: 0.6875rem; line-height: 1.4;
  font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.025em; color: #555555;
}
.type-stat-value {
  font-size: 1.25rem; line-height: 1.3;
  font-weight: 900; letter-spacing: -0.025em;
}
.type-display {
  font-size: 2rem; line-height: 1.15;
  font-weight: 900; letter-spacing: -0.025em;
}
```

- [ ] **Step 3: Update CSS classes that use hardcoded font-size in globals.css**

Replace hardcoded `font-size` values in existing classes:
- `.section-bar-title`: 11px → use `.type-label` pattern inline or keep 11px (it's already correct)
- `.section-bar-value`: 15px → 0.875rem (text-body)
- `.section-bar-right`: 12px → 0.75rem (text-caption)
- `.filter-pill`: 13px → 0.75rem (text-caption)
- `.sort-btn`: 11px → keep (already label-sized)
- `.bitmap-cell`: 7px → keep (intentionally micro for grid cells)

- [ ] **Step 4: Verify build compiles**

Run: `cd frontend && npx next build --no-lint 2>&1 | head -20`
Expected: No CSS/Tailwind errors

- [ ] **Step 5: Commit**

```bash
git add frontend/tailwind.config.js frontend/app/globals.css
git commit -m "feat(type): add 8-step type scale and composite utilities"
```

---

### Task 1: UI Primitives

**Files:** All `frontend/components/ui/*.tsx` files listed in Batch 1

**Mapping rules for this batch:**
- `text-[11px]` → `text-label`
- `text-[11px] font-bold uppercase tracking-wider` → `type-table-header` (className)
- Other sizes per mapping table

- [ ] **Step 1: Refactor Table.tsx**

The Table header currently uses `text-[11px] font-bold uppercase tracking-wider text-text-secondary`. Replace with `type-table-header`.

- [ ] **Step 2: Refactor remaining UI files**

Apply mapping table to Input, Toast, ErrorBoundary, HowItWorksButton, TransactionStepper, YouTubeLite.

- [ ] **Step 3: Verify build**
- [ ] **Step 4: Commit**

---

### Task 2: Header

**File:** `frontend/components/layout/Header.tsx`

**Specific mappings:**
- `text-[11px]` (topbar) → `text-label`
- `text-[22px] font-black` (logo) → `text-title font-black`
- `text-[15px] font-semibold` (primary nav) → `text-body font-semibold`
- `text-[12px]` (secondary nav, deposit) → `text-caption`
- `text-[13px]` (balance, sub-nav) → `text-caption`
- `tracking-[0.02em]` → remove (default)
- `tracking-[-0.03em]` → `tracking-tight`
- `tracking-[0.15em]` → `tracking-[0.08em]`

- [ ] **Step 1: Apply all mappings**
- [ ] **Step 2: Verify build**
- [ ] **Step 3: Commit**

---

### Task 3: Domain Cards

**Files:** BetCard, BetCardSkeleton, BilateralBetCard, BilateralBetsList, AnimatedBetFeedItem, AnimatedLeaderboardRow

**Pattern:** These files follow a consistent label/value pattern:
- Labels: `text-xs uppercase font-mono` → `text-micro uppercase font-mono` (xs=12px → micro=10px keeps the compact card feel)
- Values: `font-mono text-text-primary` → keep (no size change needed, inherits)
- `text-[10px]` → `text-micro`

- [ ] **Step 1: Refactor all 6 files**
- [ ] **Step 2: Verify build**
- [ ] **Step 3: Commit**

---

### Tasks 4–13: Mechanical Refactor Batches

Each batch follows the same pattern:

1. Open every file in the batch
2. Apply the **Size Mapping Table** — replace every `text-[Npx]` with its token
3. Apply the **Tracking Normalization** — standardize letter-spacing
4. Where a full `type-label` or `type-table-header` pattern appears (11px + semibold/bold + uppercase + tracking), replace with the composite class
5. Add `tabular-nums` to any `font-mono` displaying numbers that don't already have it
6. **EXCEPTION (Batch 12 only):** In learn/diagram files, leave `text-[7px]`, `text-[8px]`, `text-[9px]` as-is — these are 3D canvas labels
7. Verify build, commit

**Each batch = one commit with message format:**
```
feat(type): migrate [batch-name] to type scale
```

---

## Validation

After all batches complete:

- [ ] `cd frontend && npx next build` — full build succeeds
- [ ] `grep -r 'text-\[1[0-6]px\]' frontend/components/ frontend/app/` — returns zero matches (all 10-16px migrated)
- [ ] `grep -r 'text-\[1[89]px\]\|text-\[2[0-8]px\]\|text-\[3[0-2]px\]' frontend/components/ frontend/app/` — returns zero matches (all 18-32px migrated)
- [ ] Visual spot-check: Header, VisionPage, VisionMarketsGrid, ExplorerSummaryBar, BetCard
