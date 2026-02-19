# General Market frontendV4 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create `/frontendV4` by copying `/frontend` and restyling it with an institutional Blackrock aesthetic, rebranding to "General Market", and switching from accordion to tab-based navigation.

**Architecture:** Copy all functional code from `/frontend` (60+ hooks, 80+ components, all lib/contracts). Replace the design system (tailwind tokens, globals.css, fonts). Restructure `page.tsx` from collapsible accordion to tab-based single page. Restyle every component from dark-terminal (black + red) to institutional (dark page + white cards + neutral palette). Rebrand all copy from AgiArena/Index to General Market.

**Tech Stack:** Next.js 15, React 19, Tailwind CSS 3, Inter + JetBrains Mono fonts, wagmi 3, viem 2, TanStack Query 5, Recharts, lightweight-charts

---

## Reference: Class Transformation Map

Use this map when restyling ANY component. Replace left column with right column:

```
OLD (terminal)                    → NEW (institutional)
─────────────────────────────────────────────────────────
bg-terminal / bg-black            → bg-page (dark page bg)
bg-terminal-dark/50               → bg-white (card surface)
bg-black/30                       → bg-muted
border-white/10                   → border-border-light
border-white/20                   → border-border-medium
border-accent                     → border-zinc-900 (or border-border-light on cards)
text-white                        → text-text-primary (on cards) / text-text-inverse (on dark)
text-white/70                     → text-text-secondary
text-white/50                     → text-text-muted
text-white/40                     → text-text-muted
text-accent                       → text-zinc-900 (brand) / text-color-down (if error)
bg-accent                         → bg-zinc-900 (primary btn)
bg-accent/20                      → bg-muted
text-green-400                    → text-color-up
text-red-400                      → text-color-down
bg-green-500/20                   → bg-surface-up
bg-red-500/20                     → bg-surface-down
bg-yellow-500/30                  → bg-surface-warning
shadow-card (white glow)          → shadow-card (subtle gray)
max-w-4xl                         → max-w-site
font-mono (on UI text)            → font-sans
rounded-lg (cards)                → rounded-xl
```

---

### Task 1: Project Scaffolding

**Files:**
- Copy: `frontend/` → `frontendV4/`
- Copy: `/Users/maxguillabert/Downloads/Vector.svg` → `frontendV4/public/logo.svg`

**Step 1: Copy frontend to frontendV4**

```bash
cp -r frontend frontendV4
```

**Step 2: Remove node_modules and build artifacts from copy**

```bash
rm -rf frontendV4/node_modules frontendV4/.next frontendV4/test-results
```

**Step 3: Copy the new logo**

```bash
cp /Users/maxguillabert/Downloads/Vector.svg frontendV4/public/logo.svg
```

**Step 4: Install dependencies**

```bash
cd frontendV4 && bun install
```

**Step 5: Verify it builds**

```bash
cd frontendV4 && bun run build
```
Expected: Build succeeds (same code as frontend).

**Step 6: Commit**

```bash
git add frontendV4/
git commit -m "chore: copy frontend to frontendV4 scaffold"
```

---

### Task 2: Design System — Tailwind Config

**Files:**
- Modify: `frontendV4/tailwind.config.js`

**Step 1: Replace tailwind.config.js with full token system**

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Page backgrounds
        page: '#09090B',
        // Card surfaces
        card: { DEFAULT: '#FFFFFF', hover: '#FAFAFA' },
        muted: '#F4F4F5',
        // Text
        'text-primary': '#18181B',
        'text-secondary': '#52525B',
        'text-muted': '#A1A1AA',
        'text-inverse': '#FAFAFA',
        'text-inverse-muted': '#71717A',
        // Borders
        'border-light': '#E4E4E7',
        'border-medium': '#D4D4D8',
        'border-dark': '#3F3F46',
        // Semantic
        'color-up': '#16A34A',
        'color-down': '#DC2626',
        'color-warning': '#D97706',
        'color-info': '#2563EB',
        // Surface tints
        'surface-up': '#F0FDF4',
        'surface-down': '#FEF2F2',
        'surface-warning': '#FFFBEB',
        'surface-info': '#EFF6FF',
        // Footer / dark surfaces
        'surface-dark': '#09090B',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'JetBrains Mono', 'monospace'],
      },
      maxWidth: {
        site: '1200px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.12)',
        modal: '0 25px 50px rgba(0,0,0,0.25)',
      },
    },
  },
  plugins: [],
}
```

**Step 2: Verify no build errors**

```bash
cd frontendV4 && bun run build
```

**Step 3: Commit**

```bash
git add frontendV4/tailwind.config.js
git commit -m "feat(v4): replace design system tokens in tailwind config"
```

---

### Task 3: Design System — Globals CSS + Layout

**Files:**
- Modify: `frontendV4/app/globals.css`
- Modify: `frontendV4/app/layout.tsx`

**Step 1: Replace globals.css**

Replace entire file. Key changes: remove all red (#C40000) references, add institutional animations, neutral skeleton, custom scrollbar.

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: #09090B;
  --foreground: #FAFAFA;
}

body {
  color: var(--foreground);
  background: var(--background);
}

/* Skeleton loading — neutral gray */
@keyframes skeleton-pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.7; }
}

.skeleton {
  background: linear-gradient(90deg,
    rgba(161, 161, 170, 0.1) 0%,
    rgba(161, 161, 170, 0.2) 50%,
    rgba(161, 161, 170, 0.1) 100%
  );
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}

/* Button interactions — institutional (no lift, opacity only) */
.btn-interactive {
  transition: opacity 0.15s ease, box-shadow 0.15s ease;
}
.btn-interactive:hover {
  opacity: 0.9;
}
.btn-interactive:active {
  opacity: 0.8;
}

/* Card hover */
.card-interactive {
  transition: box-shadow 0.2s ease;
}

/* Number flash — neutral blue tint */
@keyframes number-flash {
  0% { background-color: transparent; }
  30% { background-color: rgba(37, 99, 235, 0.08); }
  100% { background-color: transparent; }
}
.number-changed {
  animation: number-flash 0.4s ease-out;
}

/* Rank change animations */
@keyframes pulse-highlight {
  0%, 100% { background-color: transparent; }
  50% { background-color: rgba(37, 99, 235, 0.06); }
}
.animate-pulse-red {
  animation: pulse-highlight 0.5s ease-in-out;
}
.animate-pulse-red-bet {
  animation: pulse-highlight 0.5s ease-out;
}
.animate-pulse-red-strong-bet {
  animation: pulse-highlight 0.7s ease-out;
}

.rank-change-up {
  color: #16A34A;
  transition: all 0.3s ease-out;
}
.rank-change-down {
  color: #DC2626;
  transition: all 0.3s ease-out;
}

.pnl-animate {
  transition: all 0.5s ease-out;
}

/* Error state */
.error-state {
  border-left: 4px solid #DC2626;
  padding-left: 12px;
}

/* Leaderboard row optimization */
tr[data-wallet] {
  will-change: transform;
}

/* Custom scrollbar */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #3F3F46; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #52525B; }

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .skeleton,
  .animate-pulse-red,
  .animate-pulse-red-bet,
  .animate-pulse-red-strong-bet,
  .number-changed {
    animation: none !important;
  }
  .btn-interactive, .card-interactive {
    transition: none;
  }
  tr[data-wallet] {
    will-change: auto;
    transition: none !important;
    animation: none !important;
  }
}

@media (max-width: 767px) {
  tr[data-wallet] { will-change: auto; }
}
```

**Step 2: Update layout.tsx**

- Add Inter font alongside JetBrains Mono
- Change body classes to `bg-page text-text-inverse font-sans antialiased`
- Update all metadata: "General Market" brand
- Update themeColor to `#09090B`
- Replace canonical URL
- Keep JSON-LD components but update brand references later (Task 11)

Key code changes in layout.tsx:

```tsx
import { Inter, JetBrains_Mono } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

// viewport
themeColor: "#09090B"

// metadata
title: { default: "General Market", template: "%s | General Market" }
description: "The institutional-grade protocol for on-chain index products."
// ... update all AgiArena references to General Market

// html tag
<html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>

// body tag
<body className="bg-page text-text-inverse font-sans antialiased">
```

**Step 3: Verify build**

```bash
cd frontendV4 && bun run build
```

**Step 4: Commit**

```bash
git add frontendV4/app/globals.css frontendV4/app/layout.tsx
git commit -m "feat(v4): institutional design system — globals.css + layout.tsx"
```

---

### Task 4: Page Shell — Tab Layout + Header + Footer

**Files:**
- Modify: `frontendV4/app/page.tsx`
- Modify: `frontendV4/components/layout/Header.tsx`
- Modify: `frontendV4/components/layout/Footer.tsx`

**Step 1: Rewrite page.tsx with tab-based layout**

Replace accordion pattern with tab state. Tabs: Markets, Portfolio, Create, Lend, Backtest, System.

```tsx
'use client'

import { useState, useCallback } from 'react'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { ItpListing } from '@/components/domain/ItpListing'
import { CreateItpSection } from '@/components/domain/CreateItpSection'
import { PortfolioSection } from '@/components/domain/PortfolioSection'
import { SystemStatusSection } from '@/components/domain/SystemStatusSection'
import { VaultModal } from '@/components/domain/VaultModal'
import { BacktestSection } from '@/components/domain/simulation/BacktestSection'

type Tab = 'markets' | 'portfolio' | 'create' | 'lend' | 'backtest' | 'system'

const TABS: { id: Tab; label: string }[] = [
  { id: 'markets', label: 'Markets' },
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'create', label: 'Create' },
  { id: 'lend', label: 'Lend' },
  { id: 'backtest', label: 'Backtest' },
  { id: 'system', label: 'System' },
]

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('markets')
  const [deployHoldings, setDeployHoldings] = useState<{ symbol: string; weight: number }[] | null>(null)

  const handleDeployIndex = useCallback((holdings: { symbol: string; weight: number }[]) => {
    setDeployHoldings(holdings)
    setActiveTab('create')
  }, [])

  return (
    <main className="min-h-screen bg-page flex flex-col">
      <Header activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="flex-1">
        <div className="max-w-site mx-auto px-6 lg:px-12 py-6">
          {activeTab === 'markets' && (
            <ItpListing onCreateClick={() => setActiveTab('create')} onLendingClick={() => setActiveTab('lend')} />
          )}
          {activeTab === 'portfolio' && (
            <PortfolioSection expanded={true} onToggle={() => {}} />
          )}
          {activeTab === 'create' && (
            <CreateItpSection expanded={true} onToggle={() => {}} initialHoldings={deployHoldings} />
          )}
          {activeTab === 'lend' && (
            <VaultModal onClose={() => setActiveTab('markets')} inline />
          )}
          {activeTab === 'backtest' && (
            <BacktestSection expanded={true} onToggle={() => {}} onDeployIndex={handleDeployIndex} />
          )}
          {activeTab === 'system' && (
            <SystemStatusSection expanded={true} onToggle={() => {}} />
          )}
        </div>
      </div>

      <Footer />
    </main>
  )
}
```

NOTE: The Lend tab renders VaultModal with an `inline` prop. You'll need to add an `inline?: boolean` prop to VaultModal that renders it as a page section instead of an overlay. If VaultModal doesn't support this, wrap its inner content in a simple div instead of the modal overlay when `inline` is true.

**Step 2: Rewrite Header.tsx**

Adapted from V2's Header but with dark background, tab-based navigation, and General Market branding. Uses tab props instead of IntersectionObserver.

```tsx
'use client'

import { useState } from 'react'
import Image from 'next/image'
import { WalletConnectButton } from '@/components/domain/WalletConnectButton'

type Tab = 'markets' | 'portfolio' | 'create' | 'lend' | 'backtest' | 'system'

const TABS: { id: Tab; label: string }[] = [
  { id: 'markets', label: 'Markets' },
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'create', label: 'Create' },
  { id: 'lend', label: 'Lend' },
  { id: 'backtest', label: 'Backtest' },
  { id: 'system', label: 'System' },
]

interface HeaderProps {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
}

export function Header({ activeTab, onTabChange }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 bg-page border-b border-border-dark">
      <div className="max-w-site mx-auto px-6 lg:px-12">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <Image src="/logo.svg" alt="General Market" width={28} height={28} />
            <span className="text-text-inverse font-semibold text-lg tracking-tight">General Market</span>
          </div>

          {/* Desktop Tabs */}
          <nav className="hidden md:flex items-center gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === tab.id
                    ? 'text-text-inverse bg-white/10'
                    : 'text-text-inverse-muted hover:text-text-inverse hover:bg-white/5'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-4">
            <WalletConnectButton />
            <button
              className="md:hidden p-2 text-text-inverse-muted hover:text-text-inverse"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <nav className="md:hidden pb-4 border-t border-border-dark pt-4">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => { onTabChange(tab.id); setMobileMenuOpen(false) }}
                className={`block w-full text-left py-2 text-sm font-medium ${
                  activeTab === tab.id
                    ? 'text-text-inverse'
                    : 'text-text-inverse-muted hover:text-text-inverse'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        )}
      </div>
    </header>
  )
}
```

**Step 3: Rewrite Footer.tsx**

Adapted from V2's institutional footer with General Market branding, dark background.

```tsx
'use client'

export function Footer() {
  return (
    <footer className="bg-page text-text-inverse mt-auto border-t border-border-dark">
      <div className="max-w-site mx-auto px-6 lg:px-12 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div>
            <span className="text-lg font-semibold tracking-tight">General Market</span>
            <p className="text-text-inverse-muted text-sm mt-3 leading-relaxed">
              The institutional-grade protocol for on-chain index products.
            </p>
          </div>

          {/* Protocol */}
          <div>
            <h4 className="text-xs font-medium uppercase tracking-widest text-text-inverse-muted mb-4">Protocol</h4>
            <ul className="space-y-2.5">
              <li><span className="text-sm text-text-inverse-muted hover:text-text-inverse transition-colors cursor-pointer">Markets</span></li>
              <li><span className="text-sm text-text-inverse-muted hover:text-text-inverse transition-colors cursor-pointer">Create ITP</span></li>
              <li><span className="text-sm text-text-inverse-muted hover:text-text-inverse transition-colors cursor-pointer">Portfolio</span></li>
              <li><span className="text-sm text-text-inverse-muted hover:text-text-inverse transition-colors cursor-pointer">System Status</span></li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-xs font-medium uppercase tracking-widest text-text-inverse-muted mb-4">Resources</h4>
            <ul className="space-y-2.5">
              <li><a href="https://discord.gg/xsfgzwR6" target="_blank" rel="noopener noreferrer" className="text-sm text-text-inverse-muted hover:text-text-inverse transition-colors">Discord</a></li>
              <li><a href="https://x.com/otc_max" target="_blank" rel="noopener noreferrer" className="text-sm text-text-inverse-muted hover:text-text-inverse transition-colors">Twitter / X</a></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-xs font-medium uppercase tracking-widest text-text-inverse-muted mb-4">Legal</h4>
            <ul className="space-y-2.5">
              <li><a href="/terms" className="text-sm text-text-inverse-muted hover:text-text-inverse transition-colors">Terms of Service</a></li>
              <li><a href="/privacy" className="text-sm text-text-inverse-muted hover:text-text-inverse transition-colors">Privacy Policy</a></li>
              <li><span className="text-sm text-text-inverse-muted">Risk Disclosures</span></li>
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-border-dark">
        <div className="max-w-site mx-auto px-6 lg:px-12 py-4 flex flex-col md:flex-row justify-between items-center gap-2">
          <p className="text-xs text-text-inverse-muted">
            © 2026 General Market. All rights reserved.
          </p>
          <p className="text-xs text-text-inverse-muted/60 max-w-xl text-center md:text-right">
            Index products involve risk. Past performance does not guarantee future results. This is not financial advice.
          </p>
        </div>
      </div>
    </footer>
  )
}
```

**Step 4: Verify build**

```bash
cd frontendV4 && bun run build
```

Note: Build may have TypeScript errors due to changed props (Header now takes activeTab/onTabChange, VaultModal inline prop). Fix these before proceeding.

**Step 5: Commit**

```bash
git add frontendV4/app/page.tsx frontendV4/components/layout/
git commit -m "feat(v4): tab-based page layout + institutional header/footer"
```

---

### Task 5: UI Primitives — Restyle All 15 Components

**Files:**
- Modify: `frontendV4/components/ui/Button.tsx`
- Modify: `frontendV4/components/ui/Card.tsx`
- Modify: `frontendV4/components/ui/Input.tsx`
- Modify: `frontendV4/components/ui/Table.tsx`
- Modify: `frontendV4/components/ui/Skeleton.tsx`
- Modify: `frontendV4/components/ui/Toast.tsx`
- Modify: `frontendV4/components/ui/Tooltip.tsx`
- Modify: `frontendV4/components/ui/StatusBadge.tsx`
- Modify: `frontendV4/components/ui/AnimatedNumber.tsx`
- Modify: `frontendV4/components/ui/CopyButton.tsx`
- Modify: `frontendV4/components/ui/EmptyState.tsx`
- Modify: `frontendV4/components/ui/ErrorBoundary.tsx`
- Modify: `frontendV4/components/ui/ConnectionStatus.tsx`
- Modify: `frontendV4/components/ui/ConnectionStatusIndicator.tsx`
- Modify: `frontendV4/components/ui/WalletActionButton.tsx`

**Step 1: Restyle Button.tsx**

Replace variant styles:
- `default`: `bg-zinc-900 text-white hover:bg-zinc-800` (was `bg-accent text-white`)
- `outline`: `border border-border-light text-text-primary hover:bg-muted` (was `border-accent text-accent`)
- `ghost`: `text-text-secondary hover:bg-muted hover:text-text-primary` (was `text-white/70`)
- Add `buy` variant: `bg-color-up text-white hover:bg-green-700`
- Add `sell` variant: `bg-color-down text-white hover:bg-red-700`
- Base: `rounded-lg font-medium` (keep), remove `translateY(-1px)` transforms

**Step 2: Restyle Card.tsx**

- Card base: `rounded-xl border border-border-light bg-white shadow-card text-text-primary` (was `rounded-lg border border-white/10 bg-black text-white`)
- CardHeader: keep structure, update text colors
- CardTitle: `text-text-primary` (was `text-white`)

**Step 3: Restyle Input.tsx**

- `bg-muted border border-border-medium text-text-primary placeholder:text-text-muted rounded-lg focus:ring-1 focus:ring-zinc-400 focus:border-zinc-400` (was `bg-terminal border-white/20 text-white`)

**Step 4: Restyle Table.tsx**

- TableHeader bg: `bg-muted` (was transparent)
- TableHead: `text-xs font-medium uppercase tracking-wider text-text-muted` (was `text-white/60`)
- TableRow: `border-b border-border-light hover:bg-card-hover` (was `border-white/10 hover:bg-white/5`)
- TableCell: `text-text-secondary` (was `text-white/70`)

**Step 5: Restyle remaining UI components**

Apply transformation map to: Skeleton, Toast, Tooltip, StatusBadge, AnimatedNumber, CopyButton, EmptyState, ErrorBoundary, ConnectionStatus, ConnectionStatusIndicator, WalletActionButton.

Key pattern for each: replace `bg-black/bg-terminal` → `bg-white`, `text-white` → `text-text-primary`, `border-white/10` → `border-border-light`, `text-accent` → `text-zinc-900`.

For Toast: left accent bar colors should use `border-l-color-up` (success), `border-l-color-down` (error), `border-l-color-warning` (warning).

**Step 6: Verify build**

```bash
cd frontendV4 && bun run build
```

**Step 7: Commit**

```bash
git add frontendV4/components/ui/
git commit -m "feat(v4): restyle all UI primitives — institutional theme"
```

---

### Task 6: Markets Tab — ItpListing + Modals

**Files:**
- Modify: `frontendV4/components/domain/ItpListing.tsx` (includes ItpCard)
- Modify: `frontendV4/components/domain/BuyItpModal.tsx`
- Modify: `frontendV4/components/domain/SellItpModal.tsx`
- Modify: `frontendV4/components/domain/ChartModal.tsx`
- Modify: `frontendV4/components/domain/RebalanceModal.tsx`
- Modify: `frontendV4/components/domain/LendItpModal.tsx`
- Modify: `frontendV4/components/domain/CostBasisCard.tsx`
- Modify: `frontendV4/components/domain/OrderStatusTracker.tsx`

**Step 1: Restyle ItpListing + ItpCard**

ItpCard transformation:
- Container: `bg-white rounded-xl shadow-card hover:shadow-card-hover transition-shadow border border-border-light p-6` (was `bg-terminal-dark border border-white/10 rounded-lg`)
- Status: colored dot `w-2 h-2 rounded-full` + `text-xs font-medium uppercase tracking-wider text-text-muted` (was badge pill)
- ITP name: `text-xl font-semibold text-text-primary` (was `text-white`)
- Symbol: `text-sm text-text-secondary font-mono` (was `text-accent`)
- NAV: `text-3xl font-bold text-text-primary tabular-nums font-mono` (was `text-lg`)
- NAV label: `text-xs font-medium uppercase tracking-widest text-text-muted mt-1` — "NAV / Share"
- Action buttons: use new Button variants (buy/sell/ghost)
- Holder table headers: `text-xs font-medium uppercase tracking-wider text-text-muted`
- Pagination: `text-text-secondary` controls, `bg-white` container

Listing container: `bg-page` (remove dark terminal bg references)

**Step 2: Restyle BuyItpModal**

- Modal overlay: `bg-black/60 backdrop-blur-sm`
- Modal content: `bg-white rounded-xl shadow-modal border border-border-light max-w-md mx-auto p-6`
- Title: `text-text-primary font-semibold text-lg`
- Inputs: use restyled Input component
- Confirm button: `bg-color-up text-white` for buy
- Step progress circles: `bg-zinc-900` for completed, `bg-muted` for pending
- Amount display: `text-2xl font-mono tabular-nums text-text-primary`

**Step 3: Restyle SellItpModal**

Same as BuyItpModal but confirm button: `bg-color-down text-white` for sell.

**Step 4: Restyle ChartModal**

- Modal: `bg-white rounded-xl shadow-modal`
- Timeframe buttons: `bg-muted text-text-secondary` inactive, `bg-zinc-900 text-white` active
- Keep lightweight-charts config but update chart colors if needed

**Step 5: Restyle RebalanceModal, LendItpModal**

Apply transformation map throughout. White modal backgrounds, dark text, neutral buttons.

**Step 6: Restyle CostBasisCard + OrderStatusTracker**

CostBasisCard: White card with institutional stat layout, `tabular-nums font-mono` for all values.
OrderStatusTracker: Step circles `bg-zinc-900` completed, `bg-border-light` pending. Use `text-color-up` for fill success, `text-color-warning`/`text-color-down` for slippage indicators.

**Step 7: Verify build**

```bash
cd frontendV4 && bun run build
```

**Step 8: Commit**

```bash
git add frontendV4/components/domain/ItpListing.tsx frontendV4/components/domain/BuyItpModal.tsx frontendV4/components/domain/SellItpModal.tsx frontendV4/components/domain/ChartModal.tsx frontendV4/components/domain/RebalanceModal.tsx frontendV4/components/domain/LendItpModal.tsx frontendV4/components/domain/CostBasisCard.tsx frontendV4/components/domain/OrderStatusTracker.tsx
git commit -m "feat(v4): restyle Markets tab — ITP cards + modals"
```

---

### Task 7: Portfolio Tab

**Files:**
- Modify: `frontendV4/components/domain/PortfolioSection.tsx`

**Step 1: Restyle PortfolioSection**

- Remove accordion toggle pattern (always expanded in tab view)
- Add 3 stat summary cards at top (Total Value, Total Invested, P&L):
  ```
  bg-white rounded-xl shadow-card border border-border-light p-6 text-center
    eyebrow: text-xs font-medium uppercase tracking-widest text-text-muted mb-2
    value: text-2xl font-bold text-text-primary tabular-nums font-mono
  ```
- Tab navigation: underline style
  ```
  border-b border-border-light mb-6
    tab: pb-3 text-sm font-medium border-b-2
      active: border-zinc-900 text-text-primary
      inactive: border-transparent text-text-secondary
  ```
- Tables: use restyled Table components
- Chart tooltip: `bg-white border border-border-light rounded-lg shadow-card p-3`
- Area chart: green gradient for positive, red for negative

**Step 2: Verify build**

```bash
cd frontendV4 && bun run build
```

**Step 3: Commit**

```bash
git add frontendV4/components/domain/PortfolioSection.tsx
git commit -m "feat(v4): restyle Portfolio tab — stat cards + underline tabs"
```

---

### Task 8: Create Tab

**Files:**
- Modify: `frontendV4/components/domain/CreateItpSection.tsx`

**Step 1: Restyle CreateItpSection**

- Remove accordion toggle (always expanded)
- Section header: eyebrow + headline pattern
- Form card: `bg-white rounded-xl shadow-card border border-border-light p-8 max-w-2xl mx-auto`
- Labels: `text-xs font-medium uppercase tracking-wider text-text-muted`
- Inputs: use restyled Input
- Asset pills: `bg-muted text-text-primary border border-border-light rounded-lg px-3 py-1.5`
- Weight sliders: style range inputs with neutral colors
- Submit: `bg-zinc-900 text-white` full-width button "Create Index"

**Step 2: Verify build + Commit**

```bash
cd frontendV4 && bun run build
git add frontendV4/components/domain/CreateItpSection.tsx
git commit -m "feat(v4): restyle Create tab — institutional form"
```

---

### Task 9: Lend Tab

**Files:**
- Modify: `frontendV4/components/domain/VaultModal.tsx`
- Modify: `frontendV4/components/lending/VaultStats.tsx`
- Modify: `frontendV4/components/lending/VaultDeposit.tsx`
- Modify: `frontendV4/components/lending/VaultPosition.tsx`
- Modify: `frontendV4/components/lending/PositionCard.tsx`
- Modify: `frontendV4/components/lending/MarketsTable.tsx`
- Modify: `frontendV4/components/lending/BorrowUsdc.tsx`
- Modify: `frontendV4/components/lending/DepositCollateral.tsx`
- Modify: `frontendV4/components/lending/RepayDebt.tsx`
- Modify: `frontendV4/components/lending/WithdrawCollateral.tsx`
- Modify: `frontendV4/components/lending/LendingHistory.tsx`

**Step 1: Add `inline` prop to VaultModal**

VaultModal currently renders as a full-screen overlay. Add an `inline?: boolean` prop. When `inline` is true, render the content directly without the overlay/backdrop, so it works as a tab content area.

**Step 2: Restyle all lending components**

Apply transformation map: white card backgrounds, dark text, neutral buttons. Status colors: `text-color-up`/`text-color-down`/`text-color-warning` for health factor indicators. APY numbers: `font-mono tabular-nums text-color-up`. Use stat card pattern for vault stats.

**Step 3: Verify build + Commit**

```bash
cd frontendV4 && bun run build
git add frontendV4/components/domain/VaultModal.tsx frontendV4/components/lending/
git commit -m "feat(v4): restyle Lend tab — vault + lending components"
```

---

### Task 10: Backtest Tab

**Files:**
- Modify: `frontendV4/components/domain/simulation/BacktestSection.tsx`
- Modify: `frontendV4/components/domain/simulation/SimFilterPanel.tsx`
- Modify: `frontendV4/components/domain/simulation/SimStatsGrid.tsx`
- Modify: `frontendV4/components/domain/simulation/SimPerformanceChart.tsx`
- Modify: `frontendV4/components/domain/simulation/SimHoldingsTable.tsx`
- Modify: `frontendV4/components/domain/simulation/SimProgressBar.tsx`
- Modify: `frontendV4/components/domain/simulation/SimSweepStatsTable.tsx`
- Modify: `frontendV4/components/domain/simulation/SimVariantLegend.tsx`

**Step 1: Restyle BacktestSection**

- Remove accordion toggle (always expanded)
- Section header: eyebrow "Index Backtester" + headline
- Filter panel: white card surface, neutral selects/inputs
- Stats grid: stat card pattern (white rounded-xl shadow-card)
- Performance chart: white card, neutral chart colors
- Holdings table: restyled Table component
- Deploy button: `bg-zinc-900 text-white`

**Step 2: Restyle all simulation sub-components**

Apply transformation map to all 8 files. Key: progress bar should use `bg-zinc-900` fill on `bg-muted` track. Strategy selector pills: `bg-muted text-text-secondary` inactive, `bg-zinc-900 text-white` active.

**Step 3: Verify build + Commit**

```bash
cd frontendV4 && bun run build
git add frontendV4/components/domain/simulation/
git commit -m "feat(v4): restyle Backtest tab — simulation components"
```

---

### Task 11: System Tab

**Files:**
- Modify: `frontendV4/components/domain/SystemStatusSection.tsx`
- Modify: `frontendV4/components/domain/APBalanceCard.tsx`
- Modify: `frontendV4/components/domain/FillSpeedChart.tsx`
- Modify: `frontendV4/components/domain/InventoryBumpChart.tsx`
- Modify: `frontendV4/components/domain/PerformanceSection.tsx`

**Step 1: Restyle SystemStatusSection**

- Remove accordion toggle (always expanded)
- Section header: eyebrow "System Status" + headline
- Tab navigation: underline style (AP Status | Performance)
- Stat cards: white rounded-xl shadow-card pattern
  - Consensus: `text-3xl font-bold text-text-primary font-mono` showing "2/3"
  - Active Issuers, Network, Fill Speed

**Step 2: Restyle APBalanceCard, charts, PerformanceSection**

Apply transformation map. Charts: white card containers, neutral axis colors. Vault token table: restyled Table.

**Step 3: Verify build + Commit**

```bash
cd frontendV4 && bun run build
git add frontendV4/components/domain/SystemStatusSection.tsx frontendV4/components/domain/APBalanceCard.tsx frontendV4/components/domain/FillSpeedChart.tsx frontendV4/components/domain/InventoryBumpChart.tsx frontendV4/components/domain/PerformanceSection.tsx
git commit -m "feat(v4): restyle System tab — AP status + performance charts"
```

---

### Task 12: Remaining Domain Components

**Files:** All remaining components in `frontendV4/components/domain/` not yet restyled.

This includes: WalletConnectButton, ChainGuard, LeaderboardTable, RecentBetsFeed, BetCard, BilateralBetCard, AnimatedLeaderboardRow, AnimatedBetFeedItem, PerformanceGraph, USDCBalanceCard, and all other domain components.

**Step 1: Batch restyle all remaining domain components**

Apply transformation map to every remaining `.tsx` file in `components/domain/`. Focus on:
- Background colors: dark → white cards
- Text colors: white → text-primary/secondary/muted
- Border colors: white/10 → border-light
- Accent colors: red → zinc-900 or semantic colors
- Font classes: add `font-sans` where UI text uses `font-mono`

**Step 2: Restyle ChainGuard.tsx**

The chain-switch overlay: `bg-page` background, white card center panel, `bg-zinc-900 text-white` switch button.

**Step 3: Restyle seo/JsonLd.tsx**

Update all brand references: "AgiArena" → "General Market", update URLs.

**Step 4: Verify build + Commit**

```bash
cd frontendV4 && bun run build
git add frontendV4/components/
git commit -m "feat(v4): restyle remaining domain components"
```

---

### Task 13: Global Brand Search & Replace

**Files:** All files in `frontendV4/`

**Step 1: Search and replace brand references**

Find and replace across all files:
- `AgiArena` → `General Market`
- `agiarena` → `generalmarket`
- `agiarena.net` → update to new domain (or placeholder)
- `"INDEX"` (as displayed brand text) → `"General Market"`
- `"Index Protocol"` → `"General Market"`
- `"Index"` (as hero/brand text, NOT as ITP/index fund terminology) → `"General Market"`
- `"The First AGI Capital Market"` → remove (hero is gone)

**IMPORTANT:** Do NOT replace "Index" when it refers to:
- Index funds / index products / ITP (the product type)
- `Index.sol` (the contract)
- Variable names like `indexL3`, `INDEX_CONTRACT`
- Import paths

**Step 2: Update metadata in layout.tsx**

Ensure all SEO metadata says "General Market".

**Step 3: Update OG image generation**

Modify `frontendV4/app/api/og/` and `frontendV4/app/opengraph-image.tsx` / `twitter-image.tsx` to use "General Market" branding.

**Step 4: Verify build + Commit**

```bash
cd frontendV4 && bun run build
git add frontendV4/
git commit -m "feat(v4): rebrand to General Market — search/replace all references"
```

---

### Task 14: Visual Verification

**Step 1: Start dev server**

```bash
cd frontendV4 && bun run dev
```

**Step 2: Verify each tab visually**

Open browser and check:
- [ ] Header: logo renders, tabs work, wallet button visible
- [ ] Markets tab: ITP cards are white on dark bg, NAV numbers prominent, buy/sell buttons work
- [ ] Portfolio tab: stat cards render, tables readable, chart works
- [ ] Create tab: form renders, inputs usable, submit button styled
- [ ] Lend tab: vault content renders inline (not as modal overlay)
- [ ] Backtest tab: filter panel works, can run simulation
- [ ] System tab: AP balance card renders, charts work
- [ ] Footer: 4 columns, legal text, "General Market" brand
- [ ] Mobile: hamburger menu, responsive layout

**Step 3: Fix any visual issues found**

Address broken layouts, missing colors, wrong fonts, etc.

**Step 4: Final commit**

```bash
git add frontendV4/
git commit -m "fix(v4): visual polish and layout fixes"
```

---

## Summary: 14 Tasks

| # | Task | Files | Estimated Scope |
|---|---|---|---|
| 1 | Project scaffolding | copy + logo | Small |
| 2 | Tailwind config | 1 file | Small |
| 3 | Globals CSS + Layout | 2 files | Medium |
| 4 | Page shell + Header + Footer | 3 files | Medium |
| 5 | UI primitives | 15 files | Medium |
| 6 | Markets tab (ITP + modals) | 8 files | Large |
| 7 | Portfolio tab | 1 file | Medium |
| 8 | Create tab | 1 file | Small |
| 9 | Lend tab | 11 files | Medium |
| 10 | Backtest tab | 8 files | Medium |
| 11 | System tab | 5 files | Medium |
| 12 | Remaining domain components | ~30 files | Large |
| 13 | Brand search/replace | all files | Medium |
| 14 | Visual verification | — | Medium |
