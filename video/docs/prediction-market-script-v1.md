# Prediction Market Video — Consensus Script v1
# 75s / 2250 frames / 30fps / 1920x1080

## S1 — HOOK | 0–5s | f0–150
**Component:** ParticleWave (dark hex grid, single shockwave ripple)
**Text:** `YOU BUILD BETTER ALGOS.` → beat → `THEY TRADE WORSE MARKETS.`
**Animation:** Grid stable → ripple → text slams center. White on black, grid #00FF88.

## S2 — LIQUIDITY | 5–16s | f150–480
**Component:** GsapStagger (split-screen dot grids)
**Left (`OTHERS`):** 12×12 grid. 80% gray (#555), 20% green (#00FF88). Fills staggered row-by-row (hesitant).
**Right (`US`):** Same grid. 100% green. Fills ALL AT ONCE (instant, clean snap).
**Text:** `BATCHED PARIMUTUEL.` → `EVERY DOT IS PROFIT.`
**Transition:** Left grid dissolves via ParticleButtons into nothing. Right grid pulses once.

## S3 — MIN SIZE | 16–21s | f480–630
**Component:** GlowingMarquee
**Text:** `$1` glow-sweeps in → holds → `= ALL` arrives. Full: `$1 = ALL`. Scales up 2x.
**Color:** White text, green glow sweep. Black bg.

## S4 — SCALE | 21–33s | f630–990
**Component:** GsapStagger (expanding grid)
**Visual:** 6×5 tile grid (30 markets with labels). Multiplies outward in 3 bursts.
**Counter:** `30 → 3,000 → 30,000 → 300,000` (exponential ease, each wave faster).
**Color:** Tiles dark gray with green borders. Counter white. Final frame: sea of green pixels.

## S5 — CATEGORIES | 33–44s | f990–1320
**Component:** CardCarousel (split comparison)
**Left carousel (`OTHERS`, slow, 3 cards, desaturated):** `POLITICS` · `SPORTS` · `ECONOMICS`
**Right carousel (`US`, fast, 9+ cards, vivid):** same 3 + `TWITCH` · `MOVIES` · `GAMING` · `ANIMALS` · `SPACE` · `WEATHER`
**Text:** `TRADE WHAT YOU LOVE.`
**Animation:** Left rotates slow. Right keeps adding cards, overwhelms left. Category colors per card.

## S6 — SETTLEMENT | 44–53s | f1320–1590
**Component:** RingShader (dual rings side by side)
**Left ring:** Slow rotation. Counter: `1d → 2d → ... → 7d`. Label: `1 WEEK`.
**Right ring:** 7× speed. Counter: `1m → 5m → 10m`. Label: `10 MINUTES`. Pulse on completion.
**Text:** `SETTLE FASTER THAN YOUR STRATEGY ITERATES.`
**Color:** Left dull amber. Right electric cyan/green.

## S7 — TWO PATHS | 53–65s | f1590–1950
**Component:** TextSplit (word splits from center) + ScrollReveal (subtitles)
**Visual:** Word `ALPHA` center → splits apart into two halves.
**Left reveals:** `STRATEGY UPGRADERS` → `Iterate. Improve. Compound.`
**Right reveals:** `MARKET PICKERS` → `Find alpha where nobody looks.`
**Color:** Left cyan (#4488FF). Right green (#00FF88). Center gap grows.

## S8 — CTA | 65–75s | f1950–2250
**Component:** ParticleWave (Scene 1 callback — grid now ALL green)
**Text:** `THE EDGE IS THE MARKET ITSELF.` → 2s hold → `generalmarket.io`
**Animation:** Grid reassembles from edges inward. Green instead of blue. Text fades. Hold. Black.

## WebGL Component Usage Summary
| Component | Scene(s) | Purpose |
|-----------|----------|---------|
| ParticleWave | S1, S8 | Bookend hero — dark→green transformation |
| GsapStagger | S2, S4 | Split grids + expanding market grid |
| GlowingMarquee | S3 | "$1 = ALL" glow sweep |
| CardCarousel | S5 | Category comparison carousels |
| RingShader | S6 | Settlement speed dual rings |
| TextSplit | S7 | "ALPHA" word split into two paths |
| ScrollReveal | S7 | Subtitle reveals under split |
| ParticleButtons | S2 | Dissolution transition for "OTHERS" grid |
