---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
inputDocuments:
  - prd.md
  - project-overview.md
  - frontendV4/app/page.tsx
  - frontendV4/components/layout/Header.tsx
  - frontendV4/tailwind.config.js
  - frontendV4/app/globals.css
  - AA/frontend/app/page.tsx
  - AA/frontend/app/markets/page.tsx
  - AA/frontend/components/domain/LeaderboardTable.tsx
  - AA/frontend/hooks/useLeaderboard.ts
  - AA/frontend/hooks/useMarketSnapshot.ts
---

# UX Design Specification: General Market (Investment + Vision)

**Author:** max
**Date:** 2026-02-20
**Reference:** BlackRock / iShares institutional design language

---

## 1. Design Philosophy

General Market is a dual-mode financial platform:
- **Investment** (default / "Prime"): Index product creation, portfolio management, lending, backtesting
- **Vision**: AI agent leaderboard + 50k+ market data grid (from AgiArena)

Both modes share a single design system inspired by BlackRock/iShares: clean white backgrounds, subtle borders, restrained color, dense data tables, horizontal tab navigation, and cards with minimal shadows.

---

## 2. Design System Tokens

### Colors

| Token | Value | Usage |
|-------|-------|-------|
| `page` | `#F8F8F8` | Page background (light warm gray) |
| `card` | `#FFFFFF` | Card/content surfaces |
| `card-hover` | `#FAFAFA` | Card hover state |
| `brand` | `#00A36C` | Primary brand (institutional green) |
| `brand-light` | `#E6F7F0` | Brand tint for badges/highlights |
| `brand-dark` | `#007A50` | Brand dark for hover states |
| `text-primary` | `#18181B` | Primary text (zinc-900) |
| `text-secondary` | `#3F3F46` | Secondary text (zinc-700) |
| `text-muted` | `#71717A` | Muted labels (zinc-500) |
| `border-light` | `#E4E4E7` | Subtle borders (zinc-200) |
| `border-medium` | `#D4D4D8` | Medium borders (zinc-300) |
| `color-up` | `#16A34A` | Positive values (green-600) |
| `color-down` | `#DC2626` | Negative values (red-600) |
| `surface-dark` | `#18181B` | Footer, dark sections |

### Typography

- **Font family**: System sans-serif stack
- **Data/numbers**: `font-mono tabular-nums` for all financial figures
- **Section labels**: `text-xs font-medium uppercase tracking-widest text-text-muted`
- **Section headings**: `text-xl font-bold text-text-primary`
- **Body text**: `text-sm text-text-secondary`
- **Table headers**: `text-xs font-medium uppercase tracking-wider text-text-muted`

### Spacing & Layout

- **Max content width**: `1280px` (`max-w-site`)
- **Section padding**: `py-12 px-6 lg:px-12`
- **Card padding**: `p-6` or `p-8`
- **Card border**: `border border-border-light rounded-xl`
- **Card shadow**: `shadow-card` (subtle: `0 1px 3px rgba(0,0,0,0.04)`)
- **Section separator**: `border-t border-border-light`

---

## 3. Layout Architecture

### Two-Tier Header

```
┌─────────────────────────────────────────────────────────────┐
│  [Logo] General Market     [Investment] [Vision]    [Wallet]│  ← Primary (h-14)
├─────────────────────────────────────────────────────────────┤
│  Markets  Portfolio  Create  Lend  Backtest  System         │  ← Sub-nav (h-10)
└─────────────────────────────────────────────────────────────┘
```

- Primary header: white bg, logo left, page tabs center, wallet right
- Sub header: section scroll-anchors, changes based on active page
- Both sticky, stacked
- Investment sub-nav: Markets | Portfolio | Create | Lend | Backtest | System
- Vision sub-nav: Leaderboard | Markets

### Investment Page (Default / Prime)

Single scrolling page with all sections stacked vertically, separated by `border-t border-border-light`.

### Vision Page

Single scrolling page:
- Section 1: **Leaderboard** — search + dense data table with agent rankings
- Section 2: **Markets Data** — category tabs + virtualized grid of 50k+ assets

---

## 4. Component Patterns (BlackRock-Inspired)

### Data Tables
- White background, no cell borders
- Header row: uppercase, small, muted text, bottom border only
- Row hover: `bg-card-hover`
- Numbers: right-aligned, monospace, tabular-nums
- Positive/negative: green-600 / red-600

### Cards
- `bg-white rounded-xl border border-border-light shadow-card`
- Section label above card: `text-xs uppercase tracking-widest text-text-muted`

### Buttons
- Primary: `bg-zinc-900 text-white rounded-lg` (not colored)
- Secondary: `border border-border-light text-text-secondary rounded-lg`

---

## 5. Vision Page — AA Integration Spec

### Restyle Rules (AA Dark → Light)

| AA Pattern | General Market Pattern |
|---|---|
| `bg-terminal` / `bg-black` | `bg-page` |
| `text-white` | `text-text-primary` |
| `text-white/60` | `text-text-muted` |
| `border-white/10` | `border-border-light` |
| `bg-white/10` | `bg-muted` |
| `text-accent` (red) | `text-brand` (green) |
| `font-mono` everywhere | `font-mono` only on numbers |

### Components to Port

| AA Source | Target | Notes |
|---|---|---|
| `LeaderboardTable.tsx` | `vision/LeaderboardTable.tsx` | Restyle to white card |
| `LeaderboardWithSearch.tsx` | `vision/LeaderboardSection.tsx` | Add institutional header |
| `AnimatedLeaderboardRow.tsx` | `vision/AnimatedLeaderboardRow.tsx` | Keep animations |
| `app/markets/page.tsx` | `vision/VisionMarketsGrid.tsx` | Extract as component |
| `useLeaderboard.ts` | `hooks/vision/useLeaderboard.ts` | Change API URL |
| `useLeaderboardSSE.ts` | `hooks/vision/useLeaderboardSSE.ts` | Change API URL |
| `useMarketSnapshot.ts` | `hooks/vision/useMarketSnapshot.ts` | Change API URL |

### New Dependencies
- `@tanstack/react-virtual` ^3

---

## 6. Responsive Breakpoints

| Breakpoint | Width | Behavior |
|---|---|---|
| Mobile | < 768px | Single column, hamburger menu |
| Tablet | 768-1024px | 2-column grids |
| Desktop | > 1024px | Full layout |
