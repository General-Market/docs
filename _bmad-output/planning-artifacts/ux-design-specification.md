---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments:
  - docs/plans/2026-02-19-general-market-frontendv4-design.md
  - frontend/app/page.tsx
  - frontend/app/globals.css
  - frontend/tailwind.config.js
  - frontend/components/layout/Header.tsx
  - frontend/components/layout/Footer.tsx
  - frontend/components/domain/ItpListing.tsx
  - frontend/components/domain/MarketsSection.tsx
  - frontend/components/domain/PortfolioSection.tsx
---

# UX Design Specification — General Market

**Author:** max
**Date:** 2026-02-20
**Approach:** Upgrade existing frontend to be more BlackRock/iShares institutional

---

## Executive Summary

### Target Users

Crypto-native investors expecting iShares-level visual credibility. Not developers.

### Key Design Challenge

Developer artifacts in UI — raw hex IDs, contract addresses, nonces, emoji icons, and collapsible debug sections need to be removed or abstracted.

---

## Core User Experience

### Goal

Take the current frontend and make it look and feel like iShares.com — same layout, same functionality, just more polished and institutional.

### What "More BlackRock" Means

- Tighter typography — smaller labels, more uppercase tracking, cleaner hierarchy
- Denser data — less whitespace waste, more info per card
- Remove dev artifacts — no hex IDs, no emoji icons, no expand/collapse toggles
- Proper data tables — iShares-style: muted headers, clean rows, right-aligned numbers
- Restrained interaction — no hover lifts, no glow effects, just subtle border/shadow changes
- ITP cards as fund tiles — name, ticker, NAV, AUM, status, YouTube video. Clean and compact.

### What Stays

- Light color system (#F8F8F8 page, white cards)
- Tab-based single page layout
- Current header/footer structure
- All hooks, logic, contracts unchanged
- YouTube videos on ITP cards (trust signal)

---

## Desired Emotional Response

### Primary

**Trust and confidence.** The user should feel like they're using a real financial platform built by professionals, not a crypto side-project. The same feeling you get landing on iShares.com — "these people know what they're doing."

### Emotion-Design Connections

- **Confidence** → clean data tables, consistent typography, no visual noise
- **Trust** → no dev artifacts visible, polished empty states, proper number formatting
- **Calm control** → restrained colors, no flashy animations, institutional spacing
- **Avoid: anxiety** → no red pulsing, no urgency tricks, no "crypto startup" energy

---

## UX Pattern Analysis & Inspiration

### Reference: iShares.com

**What they do that we adopt:**

- **Filter bar above content** — category/sort controls sit above the data, not in a sidebar
- **Number formatting** — percentages to 2 decimals, currency with commas, right-aligned, consistent
- **Neutral palette** — white/light gray backgrounds, blue for links only, no decorative color
- **Typography hierarchy** — large page title, medium section headers, small dense data. Clear without being loud.
- **Uppercase muted column headers** — `text-xs tracking-wider` for labels

### What to Adopt

- **Smart card grid for ITPs** — keep card-based, but add a sort/filter bar above (sort by NAV, AUM, 24h%, name). Paginate or virtualize when card count grows.
- Filter bar pattern for Markets section (replace emoji tile grid)
- Compact number formatting with `tabular-nums font-mono`

### Anti-Patterns to Avoid

- Emoji icons for market categories
- Collapsible accordion sections for primary content
- Showing raw contract addresses / hex IDs to end users
- "View Details" buttons that dump debug info

---

## Design System Foundation

### Choice

**Tailwind CSS with custom semantic tokens** as base, plus new libraries where they add institutional polish.

### Current Problem

Looks like a default Vercel/Next.js template. Clean but generic. Needs more visual personality to feel like a real financial platform.

### Libraries to Evaluate

- **shadcn/ui** — headless Tailwind components (tables, dialogs, tabs, dropdowns). Gives polished interaction patterns without owning the visual style.
- **Recharts** (already used) — keep for portfolio charts
- **@tanstack/react-table** — proper sortable/filterable data tables with column resizing, pagination. Replaces hand-rolled table markup.
- **framer-motion** — subtle micro-animations (card entrance, number transitions, tab switches) that make it feel premium without being flashy

### Customization Strategy

- Use shadcn/ui primitives for consistent dialogs, dropdowns, tabs — restyle to match iShares aesthetic
- Use @tanstack/react-table for ITP listing sort/filter and portfolio tables
- Tighten Tailwind tokens where needed (spacing, shadows, typography scale)
- Add subtle transitions that make it feel crafted, not template-generated

---

## Defining Experience

### The Core Interaction

**"Everything is here, live, on one page."**

Trust comes from showing the full stack: fund cards with videos, backtester, live AP keeper balances, inventory bumps, consensus status. Nothing hidden. A user scrolls down and sees the entire operation — that's what makes it feel real, not just a buy button with a nice font.

### Trust Through Transparency

The long single page IS the product differentiator:
- **Markets** — fund cards with video explainers, live NAVs
- **Portfolio** — positions, PnL, trade history
- **Create** — build your own index product
- **Lend** — vault stats, deposit/withdraw, Morpho markets
- **Backtest** — run simulations before committing money
- **System** — live AP balances, fill speed charts, inventory bumps, consensus health

No other crypto product shows you the AP keeper's wallet balance and fill speed in real-time. That's the trust.

### ITP Card Structure

1. **YouTube video** (top) — trust/explainer content
2. **Fund identity** — name, ticker, status dot
3. **Key metrics** — NAV (large), AUM, asset count
4. **Actions** — Buy / Sell / Chart / Rebalance / Borrow

### What "More BlackRock" Means Here

Make each of those sections look institutional — not add/remove sections. The content is right, the styling needs to catch up.

---

## Visual Design Foundation

### Color System

**Keep current tokens** — already iShares-aligned:

| Token | Value | Status |
|-------|-------|--------|
| `page` | `#F8F8F8` | Keep |
| `card` | `#FFFFFF` | Keep |
| `text-primary` | `#18181B` | Keep |
| `text-muted` | `#A1A1AA` | Keep |
| `border-light` | `#E4E4E7` | Keep |
| `color-up` | `#16A34A` | Keep |
| `color-down` | `#DC2626` | Keep |
| `brand` | `#00A36C` | Evaluate — currently unused. Either use it or remove it. |

### Typography — What to Change

Current fonts (Inter + JetBrains Mono) are fine but applied too loosely. Tighten:

- **Section eyebrows**: `text-[10px] font-medium uppercase tracking-[0.15em] text-text-muted` — smaller, wider tracked
- **Card titles**: `text-[15px] font-semibold` — not `text-xl`, tighter
- **Table headers**: `text-[11px] font-medium uppercase tracking-wider` — smaller than current
- **Financial numbers**: always `font-mono tabular-nums` — enforce everywhere

### Spacing — What to Change

Current spacing is too generous. BlackRock is denser:

- **Card padding**: `p-5` not `p-6` or `p-8`
- **Section gaps**: `gap-3` not `gap-4` between cards
- **Table cell padding**: `px-3 py-2.5` not `px-4 py-3`
- **Section padding**: `py-10` not `py-12`

### Isometric Illustrations

Add isometric 3D illustrations/animations as visual personality:

- **Section headers** — small iso graphics next to section eyebrows (e.g., iso chart for Markets, iso vault for Lend, iso gears for System)
- **Empty states** — iso illustrations instead of plain text ("No positions yet" + iso portfolio graphic)
- **Loading states** — subtle iso animations instead of generic spinners
- **Animated** — gentle float/rotate animations via framer-motion, not static images
- **Style** — monochrome or zinc-toned to match institutional palette. Not colorful cartoon iso.
- **Source** — consider libraries like 3dicons.co, iconscout isometric packs, or custom SVGs

### What Makes It Stop Looking Like a Template

1. **Tighter type scale** — smaller labels, wider tracking on uppercase text
2. **Denser spacing** — less air between elements
3. **Consistent number formatting** — every financial value: mono, tabular-nums, right-aligned, 2 decimals
4. **Isometric illustrations** — unique visual identity at section headers and empty states
5. **shadcn/ui components** — replace hand-rolled dialogs/tabs/dropdowns with polished primitives
6. **framer-motion entrances** — cards and iso graphics animate in on scroll
