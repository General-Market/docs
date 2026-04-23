# Prediction Market Video — Consensus Script v2
# 75s / 2250 frames / 30fps / 1920x1080
# Round 2 applied: all 3 reviewers' critiques addressed

## S1 — HOOK | 0–5s | f0–150
**Component:** ParticleWave (hex grid forms from scattered orderbook depth data)
**Visual:** Numbers/prices scatter across screen (like an exploding orderbook). They coalesce into the hex grid. Shockwave ripple.
**Text:** `YOU BUILD BETTER ALGOS.` → beat → `THEY TRADE WORSE MARKETS.`
**Color:** Black bg, green (#00FF88) grid + white text. Price numbers fade as grid forms.

## S2 — LIQUIDITY | 5–11s | f150–330
**Component:** GsapStagger (split-screen dot grids) + ParticleButtons (dissolve)
**Left (`OTHERS`):** 10×10 grid. 80% gray, 20% green. Fills row-by-row (slow, hesitant). 3s.
**Right (`US`):** Same grid. 100% green. Fills ALL AT ONCE in a snap. 1s.
**Text:** `ZERO SLIPPAGE.` → `EVERY POSITION FILLS.`
**Transition:** Left dissolves into particles. Right pulses. Hard cut.
**Duration:** 6s total — the contrast IS the argument, don't linger.

## S3 — MIN SIZE | 11–17s | f330–510
**Component:** GlowingMarquee + counter cascade
**Visual:** Counter cascades: `$0.10` → `$1` → `$100` → `$10,000` → `$100,000`. Each value glow-sweeps, scales up, then is replaced by the next.
**Text below:** `NO MINIMUM. NO MAXIMUM.`
**Color:** Green glow sweep. White numbers on black. Each cascade faster than the last.

## S4 — SCALE | 17–27s | f510–810
**Component:** GsapStagger (expanding grid with market names)
**Visual:** 6×5 grid (30 tiles). Each tile has a scrolling market name: "BTC > $100K", "Trump wins", "Rain in Tokyo", "Twitch viewership".
**Expansion:** Grid bursts outward in 3 waves: 30 → 3,000 → 300,000. Market names blur into green noise.
**Counter:** Big white numbers counting: `30 → 300,000`.
**Color:** Tiles dark with green borders + tiny white text. Counter massive and white.

## S5 — CATEGORIES | 27–37s | f810–1110
**Component:** DepthGallery (parallax depth cards) — NOT CardCarousel
**Left stack (z-near, desaturated, faded):** 3 flat cards: `POLITICS` · `SPORTS` · `ECONOMICS`
**Right stack (z-far, vivid, cascading in from depth):** 9 cards fly in: `TWITCH` (purple) · `CINEMA` (red) · `GAMING` (blue) · `ANIMALS` (orange) · `SPACE` (navy) · `WEATHER` (cyan) · `MUSIC` (pink) · `SCIENCE` (teal) · `MEMES` (yellow)
**Text:** `300,000 MARKETS. PICK YOUR EDGE.`
**Animation:** Right cards keep arriving, parallax depth creates layers. Overwhelms the 3 boring ones.

## S6 — SETTLEMENT | 37–45s | f1110–1350
**Component:** RingShader (dual rings) + block counter
**Left ring:** Amber, slow. Block counter: `1 → 2 → ... → 1,008` over 8s (representing 1 week of blocks). Label: `1 WEEK`.
**Right ring:** Green, fast. Block counter: `1 → 2 → ... → 60` in 1.5s (representing 10min of blocks). Label: `10 MINUTES`. Ring PULSES bright on completion. Counter resets and goes again 3× (showing multiple settlement cycles while left is still crawling).
**Text:** `SETTLE. ITERATE. DEPLOY AGAIN.`
**Color:** Left amber/dull. Right electric green.

## S7 — TWO PATHS | 45–53s | f1350–1590
**Component:** TextSplit + ParticleWave (background, dim)
**Visual:** `ALPHA` center screen → letter-splits into two halves flying apart.
**Left:** `SHARPEN` — small subtitle: `backtest → deploy → improve → repeat` (loop arrows)
**Right:** `DISCOVER` — small subtitle: `300K markets. Your algo. Zero competition.`
**Color:** Left cyan. Right green. ParticleWave grid dimly pulses behind both.
**Duration:** 8s — tight, punchy. The subtitles are the only prose.

## S8 — DATA | 53–63s | f1590–1890 ← NEW SCENE
**Component:** OrganicGradients (ambient bg) + custom PnL visualization
**Visual:** Animated PnL curve climbing upward on a dark grid. Candlestick micro-chart beside it. Numbers ticking: `+2.3%` `+4.1%` `+7.8%` — a strategy compounding returns.
**Text:** `YOUR STRATEGY. OUR INFRASTRUCTURE.` → `COMPOUND.`
**Color:** Dark bg, green PnL line, orange gradient blobs drifting behind. White text.
**Purpose:** This is the scene algo traders recognize themselves in. Data, not slogans.

## S9 — CTA | 63–75s | f1890–2250
**Component:** ParticleWave (Scene 1 callback — grid ALL green, fully formed)
**Visual:** Hex grid reassembles from edges inward. Now all green — the transformation from S1's scattered orderbook to S9's ordered grid IS the narrative.
**Text:** `THE EDGE IS THE MARKET ITSELF.` → 3s hold → `generalmarket.io`
**Animation:** Grid breathes. URL fades in with GlowingMarquee sweep. Hold 2s. Fade to black.

## WebGL Component Usage Summary
| Component | Scene(s) | Purpose |
|-----------|----------|---------|
| ParticleWave | S1, S7 bg, S9 | Bookend + ambient — scattered data → ordered grid |
| GsapStagger | S2, S4 | Split grids + expanding market grid |
| GlowingMarquee | S3, S9 | Counter cascade + URL reveal |
| DepthGallery | S5 | Parallax category cards with depth |
| RingShader | S6 | Settlement speed dual rings |
| TextSplit | S7 | "ALPHA" splits into two paths |
| ParticleButtons | S2 | Dissolve transition for "OTHERS" grid |
| OrganicGradients | S8 | Ambient bg for data visualization scene |

## Changes from v1
1. S2 cut from 11s → 6s. "Batched parimutuel" → "Zero slippage. Every position fills."
2. S3 now a counter cascade ($0.10 → $100K) not static "$1 = ALL"
3. S4 tiles now have scrolling market names, not blank rectangles
4. S5 switched to DepthGallery (parallax depth) for more visual impact. Text sharpened.
5. S6 shows actual block counting + settlement cycles. "Settle. Iterate. Deploy again."
6. S7 cut from 12s → 8s. Subtitles now concrete (backtest/deploy/improve loop)
7. NEW S8 (Data) — PnL curve + strategy compounding. The scene algo traders identify with.
8. S9 holds longer (12s) for breathing room at the close
