# Prediction Market Video — Consensus Script v3
# 75s / 2250 frames / 30fps / 1920x1080
# Target: 9/10 consensus score

## S1 — HOOK | 0–5s | f0–150
**Component:** ParticleWave (orderbook numbers scatter → coalesce into hex grid)
**Visual:** Hundreds of tiny price numbers ($1.23, $0.87, $4.52) fly across screen chaotically. They snap into hex grid formation. Single shockwave ripple.
**Text:** `YOU BUILD BETTER ALGOS.` → beat → `THEY TRADE WORSE MARKETS.`
**Color:** Black, grid #00FF88, text white. Numbers dim as grid solidifies.

## S2 — LIQUIDITY | 5–11s | f150–330
**Component:** GsapStagger (split dot grids) + ParticleButtons (dissolve)
**Left (`OTHERS`):** 10×10 grid. 80% gray, 20% green. Fills row-by-row. 2.5s.
**Right (`US`):** Same grid. 100% green. Fills simultaneously in one snap. 0.5s.
**Text:** `ZERO SLIPPAGE.` → `EVERY POSITION FILLS.`
**Transition:** Left dissolves into particles. Right pulses. Cut.

## S3 — MIN SIZE | 11–16s | f330–480
**Component:** RingShader (concentric rings scale with each amount)
**Visual:** Ring shader starts tight (small ring = small amount). As amount grows, ring EXPANDS — more distortion, more energy. Amounts flash center: `$0.10` → `$1` → `$100` → `$10K` → `$100K`. Each ring layer remains, creating nested rings.
**Text:** `NO MINIMUM. NO MAXIMUM. SAME EDGE.`
**Color:** Rings go from dim green (small) to bright neon green (large). Distortion increases.
**WHY:** RingShader gives this scene genuine WebGL weight. The rings ARE the amounts.

## S4 — SCALE | 16–23s | f480–690
**Component:** GsapStagger (expanding grid) — 7s only
**Visual:** 6×5 tile grid. Tiny scrolling market names inside each tile. Burst 1: 30→3K. Burst 2: 3K→30K. Burst 3: 30K→300K. Each faster.
**Counter:** `30 → 300,000` in bold white.
**Color:** Dark tiles, green borders, white counter. Final: green pixel sea.

## S5 — CATEGORIES | 23–33s | f690–990
**Component:** DepthGallery (parallax depth cards)
**Left (z-near, faded):** 3 flat cards: `POLITICS` · `SPORTS` · `ECONOMICS`
**Right (z-far, vivid, cascading):** 9 cards fly from depth: `TWITCH` · `CINEMA` · `GAMING` · `ANIMALS` · `SPACE` · `WEATHER` · `MUSIC` · `SCIENCE` · `MEMES`
**Text:** `300,000 MARKETS. YOURS TO EXPLOIT.`
**Color:** Right cards in category colors. Parallax creates real depth layers.

## S6 — SETTLEMENT | 33–41s | f990–1230
**Component:** RingShader (dual rings, side by side)
**Left:** Amber ring, crawling. Block counter `1 → 1,008` (1 week of blocks). Label: `1 WEEK`.
**Right:** Green ring, blazing. Counter `1 → 60` in 1.5s. Completes. Resets. Goes AGAIN. And AGAIN. Three full cycles while left is still at `200`.
**Text:** `SETTLE. ITERATE. REDEPLOY.`

## S7 — TWO PATHS | 41–49s | f1230–1470
**Component:** TextSplit + ParticleWave (background, dim grid breathing)
**Visual:** `ALPHA` center → letter-splits apart.
**Left:** `SHARPEN` — subtitle: `backtest → deploy → improve → repeat` (cycle arrows)
**Right:** `DISCOVER` — subtitle: `niche markets. zero competition.`
**Color:** Left cyan. Right green. ParticleWave grid pulses behind both.
**Duration:** 8s.

## S8 — LIVE DATA | 49–59s | f1470–1770
**Component:** ParticleWave (REUSED — but now as a data matrix) + OrganicGradients (bg)
**Visual:** The hex grid from S1 transforms — each hex cell now displays a live-updating number (market prices ticking). Camera slowly zooms INTO the grid. Some cells flash green (profit), some red (loss), most neutral. A strategy signal ripples across the grid — cells it touches turn bright green in sequence, like a wave of alpha propagating.
**Text:** `YOUR ALGO. 300,000 SIGNALS.` → beat → `COMPOUND.`
**Color:** Dark bg with organic gradient blobs drifting. Grid cells white/green/red. The ripple wave is bright green.
**WHY:** ParticleWave IS the data. The hex grid becomes a literal trading floor. This is what algo traders see when they close their eyes. No generic PnL line — the infrastructure IS the visual.

## S9 — CTA | 59–67s | f1770–2010
**Component:** ParticleWave (final form — all cells bright green, grid complete)
**Visual:** Grid stabilizes. All cells green. Numbers stop ticking — calm after the storm.
**Text:** `THE EDGE IS THE MARKET ITSELF.`
**Animation:** Grid breathes once. Text fades in center.
**Duration:** 8s.

## S10 — URL | 67–75s | f2010–2250
**Component:** GlowingMarquee (sweep-glow on URL)
**Visual:** Grid fades to black. `generalmarket.io` glow-sweeps in center. Hold.
**Duration:** 8s. Silence. The URL is the only thing on screen.

## Changes from v2
1. **S3** replaced GlowingMarquee cascade with RingShader — concentric rings scale with amounts. Genuine WebGL.
2. **S4** cut from 10s → 7s.
3. **S5** text sharpened: "YOURS TO EXPLOIT" not "PICK YOUR EDGE"
4. **S8** completely rewritten: ParticleWave grid becomes a data matrix with live prices and strategy signal propagation. No generic PnL line. The grid IS the trading floor.
5. **S8 text** killed "Your strategy. Our infrastructure." — replaced with "YOUR ALGO. 300,000 SIGNALS."
6. **S9/S10** split CTA from URL reveal. CTA gets 8s, URL gets 8s. Total close = 16s (was 12s for one scene — now two distinct beats).
7. **4 scenes now use genuine WebGL** (S1/S3/S6/S8 use ParticleWave or RingShader). Up from 2.
