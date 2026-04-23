# Prediction Market Video — Consensus Script v4
# 75s / 2250 frames / 30fps / 1920x1080
# Target: 9/10 — all agent critiques from rounds 2-4 applied

## S1 — HOOK | 0–5s | f0–150
**Component:** ParticleWave (orderbook scatter → hex grid)
**Visual:** Price numbers chaotically flying. Snap into hex grid. Shockwave.
**Text:** `YOU BUILD BETTER ALGOS.` → `THEY TRADE WORSE MARKETS.`
**Color:** Black, green grid, white text.

## S2 — LIQUIDITY | 5–11s | f150–330
**Component:** GsapStagger (split dot grids) + ParticleButtons (dissolve)
**Visual:** Left "OTHERS" 10×10, 80% gray/20% green, fills row-by-row (2.5s). Right "US" 100% green, fills in one snap (0.5s). Left dissolves into particles. Right pulses.
**Text:** `ZERO SLIPPAGE. EVERY POSITION FILLS.`

## S3 — AMOUNTS | 11–16s | f330–480
**Component:** RingShader (nested concentric rings scaling with amounts)
**Visual:** Each amount creates a new ring layer. $0.10 = tight ring. $1 = wider. $100K = full screen distortion. Rings nest and pulse.
**Text:** `NO MINIMUM. NO MAXIMUM. SAME EDGE.`

## S4 — SCALE | 16–21s | f480–630
**Component:** ParticleWave (hex grid EXPLODES outward) — 5s only
**Visual:** The 30-cell hex grid from S1 literally explodes — cells multiply and fly outward, filling the screen. Not a counter ticking up. A DETONATION. Hundreds of cells appear in waves. A subtle counter fades in corner: `300,000`.
**Text:** None. The explosion IS the message. Just the number in the corner.
**WHY:** S1's hex grid returns and erupts. The visual continuity from "30 hexes" to "300,000 hexes" is the argument. No counter animation needed — the scale is felt, not read.

## S5 — CATEGORIES | 21–31s | f630–930
**Component:** DepthGallery (parallax depth cards)
**Left (desaturated, flat):** 3 cards: `POLITICS` · `SPORTS` · `ECONOMICS`
**Right (vivid, cascading from z-depth):** 9 cards: `TWITCH` · `CINEMA` · `GAMING` · `ANIMALS` · `SPACE` · `WEATHER` · `MUSIC` · `SCIENCE` · `MEMES`
**Text:** `300,000 MARKETS. YOURS TO EXPLOIT.`

## S6 — SETTLEMENT | 31–39s | f930–1170
**Component:** RingShader (dual rings side by side)
**Left:** Amber, crawling. Block counter to `1,008`. Label: `1 WEEK`.
**Right:** Green, blazing. Counter to `60` in 1.5s. Resets. Goes again. Three cycles while left crawls.
**Text:** `SETTLE. ITERATE. REDEPLOY.`

## S7 — TWO PATHS | 39–47s | f1170–1410
**Component:** VortexGallery (spiral) — NOT TextSplit
**Visual:** Two spiral vortexes side by side, pulling in content.
**Left vortex (cyan):** Cards spiral in showing strategy iteration: `v1.0` → `v1.1` → `v1.2` → `v2.0` → `v3.0`. Each card is a strategy version. The spiral tightens (convergence).
**Right vortex (green):** Cards spiral in showing market discovery: `Rain in Tokyo` → `Twitch viewership` → `K-pop comeback` → `Mars mission date`. The spiral expands (exploration).
**Text:** Left: `SHARPEN` / Right: `DISCOVER`
**WHY:** VortexGallery replaces the cliched text split. The spirals ARE the metaphor — convergence vs expansion. Genuine visual impact.

## S8 — DATA MATRIX | 47–57s | f1410–1710
**Component:** ParticleWave (hex grid as live data matrix) + OrganicGradients (bg)
**Visual:** S1's hex grid returns — now each cell shows a ticking price. Camera zooms slowly into the grid. A signal wave ripples across cells — they flash green in sequence. The wave IS the algo finding alpha.
**Text:** `YOUR ALGO. 300,000 SIGNALS.`
**Color:** Dark + organic gradient blobs. Grid cells white/green/red. Signal wave bright green.

## S9 — CTA + URL | 57–67s | f1710–2010
**Component:** ParticleWave (all green, stabilized) → GlowingMarquee (URL)
**Visual:** Grid stabilizes. All cells green. Calm. Beat. Text.
**Text:** `THE EDGE IS THE MARKET ITSELF.` → grid fades → `generalmarket.io` glow-sweeps in.
**Duration:** 10s total. 4s grid + text, 2s fade, 4s URL hold.
**WHY:** Merged S9+S10 into one scene. Tighter close.

## S10 — BLACK | 67–75s | f2010–2250
**Component:** None. Pure black. Silence.
**Purpose:** 8s of black. Let the URL burn into retinas. The video ends — the viewer decides.

## Changes from v3
1. **S4** replaced counter-ticking grid with ParticleWave EXPLOSION — hex cells detonate outward. No counter, just scale felt visually. Cut from 7s → 5s.
2. **S7** replaced TextSplit (cliche) with VortexGallery dual spirals — strategy convergence vs market exploration. Genuine visual impact.
3. **S8** text simplified: removed "COMPOUND." standalone. Just "YOUR ALGO. 300,000 SIGNALS."
4. **S9+S10** merged CTA and URL, added 8s black silence at end. Total close = 18s but 8s is pure black (the viewer sits with it).
5. **Overall pacing** tighter in the middle (S4 lost 2s, S7 stayed 8s but with better content).
6. **5 scenes now use genuine WebGL**: S1 (ParticleWave), S3 (RingShader), S4 (ParticleWave), S6 (RingShader), S7 (VortexGallery), S8 (ParticleWave). That's 6/10 scenes with real WebGL.
