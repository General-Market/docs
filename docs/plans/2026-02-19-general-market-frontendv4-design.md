# General Market — frontend Design

**Date:** 2026-02-19
**Status:** Approved

## Overview

Create `/frontend` by copying `/frontend` (latest functional code) and restyling it with `/frontendV2`'s institutional Blackrock aesthetic. Rebrand from "Index" to "General Market".

## Brand

- **Name:** General Market (replaces Index, IndexMaker, AgiArena everywhere)
- **Logo:** `/Downloads/Vector.svg` — black square with white horizontal bars
- **Accent:** None. Black/charcoal CTAs. Semantic colors only (green=up, red=down, amber=warning).
- **Tagline:** "The institutional-grade protocol for on-chain index products." (from V2 footer)

## Navigation

Tab-based single page (not collapsible accordion, not multi-page routing).

**Tabs:** Markets | Portfolio | Create | Lend | Backtest | System

Tab bar is sticky below the header. Only one tab's content visible at a time.

## Color System

```
/* Page */
--bg-page:          #09090B       /* Near-black page background (zinc-950) */
--bg-card:          #FFFFFF       /* White card surfaces */
--bg-card-hover:    #FAFAFA       /* Card hover */
--bg-muted:         #F4F4F5       /* Inset/secondary surfaces on cards (zinc-100) */
--bg-input:         #F4F4F5       /* Input backgrounds */

/* Text */
--text-primary:     #18181B       /* Headings on white cards (zinc-900) */
--text-secondary:   #52525B       /* Body text (zinc-600) */
--text-muted:       #A1A1AA       /* Labels, metadata (zinc-400) */
--text-inverse:     #FAFAFA       /* Text on dark backgrounds */
--text-inverse-muted: #71717A     /* Secondary text on dark backgrounds (zinc-500) */

/* Borders */
--border-light:     #E4E4E7       /* Card borders (zinc-200) */
--border-medium:    #D4D4D8       /* Input borders (zinc-300) */
--border-dark:      #3F3F46       /* Borders on dark backgrounds (zinc-700) */

/* Interactive */
--btn-primary-bg:   #18181B       /* Black buttons */
--btn-primary-text: #FFFFFF
--btn-primary-hover:#27272A       /* Slightly lighter on hover */

/* Semantic */
--color-up:         #16A34A       /* Green for positive/buy (green-600) */
--color-down:       #DC2626       /* Red for negative/sell (red-600) */
--color-warning:    #D97706       /* Amber for warnings (amber-600) */
--color-info:       #2563EB       /* Blue for info states (blue-600) */

/* Surface tints (for stat card backgrounds) */
--surface-up:       #F0FDF4       /* green-50 */
--surface-down:     #FEF2F2       /* red-50 */
--surface-warning:  #FFFBEB       /* amber-50 */

/* Shadows */
--shadow-card:      0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)
--shadow-card-hover:0 4px 12px rgba(0,0,0,0.12)
--shadow-modal:     0 25px 50px rgba(0,0,0,0.25)
```

## Typography

```
--font-sans:  'Inter', system-ui, sans-serif     /* UI text */
--font-mono:  'JetBrains Mono', monospace         /* Financial data */

/* Scale */
Page title:     24px / 600 / sans                  /* Tab content headers */
Section title:  18px / 600 / sans                  /* Card group headers */
Card title:     15px / 600 / sans                  /* Card headers */
Body:           14px / 400 / sans                  /* Default */
Label:          12px / 500 / sans / uppercase / tracking-wide  /* Column headers */
Eyebrow:        10-11px / 500 / sans / uppercase / tracking-widest  /* Kicker labels */
Tiny:           11px / 400 / sans                  /* Metadata */

/* Financial (all mono + tabular-nums) */
Hero number:    28px / 700 / mono                  /* Portfolio total */
Stat number:    24px / 700 / mono                  /* Stat card values */
Price:          16px / 500 / mono                  /* ITP NAV in rows */
Delta:          13px / 600 / mono                  /* +2.1% colored */
Small number:   13px / 400 / mono                  /* Table cells */
Address:        11px / 400 / mono                  /* Wallet addresses */
```

## Page Layout

```
┌─────────────────────────────────────────────────────┐
│  HEADER (sticky, 56px, dark #09090B)                 │
│  [Logo SVG]  General Market              [Wallet]    │
├─────────────────────────────────────────────────────┤
│  TAB BAR (sticky below header, 48px, dark)           │
│  Markets │ Portfolio │ Create │ Lend │Backtest│System │
│  ─────────                     (underline active)    │
├─────────────────────────────────────────────────────┤
│                                                       │
│  TAB CONTENT (scrollable, dark page bg #09090B)      │
│  max-w-[1200px] centered, px-6 lg:px-12             │
│                                                       │
│  ┌───────────────────────────────────────────┐       │
│  │  White card surfaces (rounded-xl shadow)   │       │
│  │  with institutional data patterns          │       │
│  └───────────────────────────────────────────┘       │
│                                                       │
├─────────────────────────────────────────────────────┤
│  FOOTER (4-col institutional, dark)                  │
│  Brand | Protocol | Resources | Legal                │
│  © 2026 General Market · Risk disclaimer             │
└─────────────────────────────────────────────────────┘
```

## Tab Content Specifications

### Markets Tab
- Section header: eyebrow "Index Tracking Products" + headline
- ITP cards in grid (or master-detail split on wide screens)
- Each card: white `rounded-xl shadow-card`, status dot, name, symbol, large NAV, eyebrow labels
- Buy/Sell/Chart/Rebalance/Borrow actions
- Buy/Sell modals: white background, black confirm buttons, step progress tracker

### Portfolio Tab
- 3 stat summary cards: Total Value, Total Invested, P&L (colored)
- Underline tabs: Value (area chart) | Positions | Trades | Orders
- Data tables: `text-xs uppercase tracking-wider` headers, `tabular-nums font-mono` values

### Create Tab
- Centered form card (`max-w-2xl`)
- Name, symbol, asset picker (removable pills), weight sliders
- "Distribute Evenly" button
- Live NAV preview
- Black "Create Index" submit button

### Lend Tab
- Vault stats card (APY, total deposits, utilization)
- Deposit/Withdraw forms
- Position card with health factor
- Morpho markets table
- Lending history

### Backtest Tab
- Full simulation filter panel (strategies, categories, top-N, rebalance config)
- Single run + sweep mode
- Performance chart, stats grid, holdings table
- Deploy-to-ITP button from results

### System Tab
- AP Balance card (keeper health, vault holdings)
- Fill Speed chart
- Inventory Bump chart
- Stat cards: Consensus threshold, Active Issuers, Network status

## Component Design Patterns (from V2)

### Stat Card
```
bg-white rounded-xl shadow-card border border-border-light p-6 text-center
  eyebrow: text-xs font-medium uppercase tracking-widest text-text-muted mb-2
  value:   text-2xl font-bold text-text-primary tabular-nums
  sub:     text-xs text-text-muted mt-1
```

### Underline Tab
```
border-b border-border-light mb-6
  tab: pb-3 text-sm font-medium border-b-2
    active:   border-zinc-900 text-text-primary
    inactive: border-transparent text-text-secondary hover:text-text-primary
```

### Section Header (eyebrow + headline)
```
eyebrow: text-xs font-medium uppercase tracking-widest text-text-muted mb-2
headline: text-2xl font-semibold text-text-primary
```

### Data Table
```
thead: bg-muted
  th: text-xs font-medium uppercase tracking-wider text-text-muted px-4 py-3
tbody:
  tr: border-b border-border-light hover:bg-bg-muted/50
  td: px-4 py-3 text-sm tabular-nums font-mono (for numbers)
```

### Card
```
bg-white rounded-xl shadow-card hover:shadow-card-hover transition-shadow
border border-border-light p-6
```

### Buttons
```
Primary:  bg-zinc-900 text-white hover:bg-zinc-800 h-10 px-4 rounded-lg font-medium
Buy:      bg-green-600 text-white hover:bg-green-700
Sell:     bg-red-600 text-white hover:bg-red-700
Ghost:    bg-transparent text-text-secondary hover:bg-muted border border-border-light
```

## Implementation Strategy

1. Copy `/frontend` → `/frontend`
2. Replace `tailwind.config.js` — full token system with all semantic tokens
3. Replace `globals.css` — new base styles, animations adapted for light cards
4. Add Inter font to `layout.tsx`, update body classes
5. Rebrand: "General Market" everywhere, new logo SVG, update metadata
6. Restructure `page.tsx` — remove accordion, add tab-based layout
7. Restyle Header — V2's sticky nav pattern, adapted for tabs + dark bg
8. Restyle Footer — V2's 4-column institutional footer
9. Restyle all UI primitives (`components/ui/`)
10. Restyle all domain components (`components/domain/`)
11. Restyle lending components (`components/lending/`)
12. Restyle simulation components (`components/domain/simulation/`)
13. Keep all hooks, lib, contracts, providers unchanged

## What to Keep Unchanged
- All hooks (`hooks/`) — 60+ hooks
- All lib utilities (`lib/`)
- Contract ABIs and addresses
- API layer
- Providers and wallet config (except ChainGuard visuals)
- E2E test logic (selectors will need updates)

## What to Remove
- Hero section ("The First AGI Capital Market")
- All "Index" / "AgiArena" / "IndexMaker" brand references
- Red `#C40000` color system
- `pulse-red` animations
- Terminal/hacker aesthetic (pure black bg, monospace-everything, red glow)
- Collapsible section accordion pattern
- Card hover lifts (translateY)
