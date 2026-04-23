# Prediction Market Video — Consensus Script v5
# 70s / 2100 frames / 30fps / 1920x1080
# Target: 9/10. All round 5 critiques applied.

## S1 — HOOK | 0–5s | f0–150
**Component:** ParticleWave (orderbook scatter → hex grid)
**Visual:** Price numbers chaotically flying. Snap into hex grid formation. Shockwave ripple.
**Text:** `YOU BUILD BETTER ALGOS.` → `THEY TRADE WORSE MARKETS.`

## S2 — LIQUIDITY | 5–10s | f150–300
**Component:** ParticleWave (signal propagation across grid)
**Visual:** Left half grid: a buy signal enters. Cells flash IN SEQUENCE with visible gaps — cells wait for liquidity, some don't fill (stay gray). Signal crawls. Right half: same signal enters — ALL cells flash simultaneously, wave rips across the grid in 0.3s. Genuine shader-driven particle propagation.
**Text:** Left label: `OTHERS` / Right label: `US` / Bottom: `EVERY POSITION FILLS.`
**WHY:** Replaces static dot grid with signal propagation — WebGL-native, kinetic, shows the speed difference as motion not as a fill bar. S2 is no longer pedestrian.

## S3 — AMOUNTS | 10–15s | f300–450
**Component:** RingShader (nested concentric rings)
**Visual:** Amounts create ring layers. `$0.10` = tight ring. `$1` = wider. `$100K` = screen-filling distortion. Rings nest.
**Text:** `NO MINIMUM. NO MAXIMUM.`
(Removed "SAME EDGE" — third line bloats the beat.)

## S4 — SCALE | 15–20s | f450–600
**Component:** ParticleWave (hex grid detonation)
**Visual:** The S1 hex grid returns and EXPLODES outward. 30 hexes become thousands become screen-filling green. Corner counter: `300,000`.
**Text:** None. Explosion + corner counter is enough.

## S5 — CATEGORIES | 20–27s | f600–810
**Component:** DepthGallery (parallax depth) — cut from 10s → 7s
**Left (z-near, faded):** 3 cards: `POLITICS` · `SPORTS` · `ECONOMICS`
**Right (z-far, cascading):** 9 cards: `TWITCH` · `CINEMA` · `GAMING` · `ANIMALS` · `SPACE` · `WEATHER` · `MUSIC` · `SCIENCE` · `MEMES`
**Text:** `TRADE WHAT MOVES YOU.`
(Removed "YOURS TO EXPLOIT" — crass. Removed the 300,000 mention — already shown in S4.)

## S6 — SETTLEMENT | 27–35s | f810–1050
**Component:** RingShader (dual rings)
**Left:** Amber, crawling. Counter → `1,008 blocks`. Label: `1 WEEK`.
**Right:** Green, blazing. Counter → `60 blocks`. Resets. Again. Three cycles.
**Text:** `WHILE THEY WAIT, YOU DEPLOY.`
(Killed "SETTLE. ITERATE. REDEPLOY." — replaced with a concrete comparison that shows the algo trader what they gain.)

## S7 — TWO PATHS | 35–43s | f1050–1290
**Component:** VortexGallery (dual spirals)
**Left vortex (cyan, convergence):** Strategy versions spiral in: `v1.0` · `v1.1` · `v1.2` · `v2.0` · `v3.0`. Spiral tightens.
**Right vortex (green, expansion):** Market discoveries spiral in: `Rain in Tokyo` · `Twitch peaks` · `K-pop comeback` · `Mars date`. Spiral expands.
**Text:** Left: `SHARPEN` / Right: `DISCOVER`

## S8 — DATA MATRIX | 43–53s | f1290–1590
**Component:** ParticleWave (hex grid becomes live data) + OrganicGradients
**Visual:** S1/S4's grid returns one final time. Each cell ticks prices. Camera slowly zooms in. A bright green signal wave ripples across cells — the algo finding alpha. Organic gradient blobs drift behind.
**Text:** `YOUR ALGO. OUR GRID.`
(Killed "300,000 SIGNALS" — we already said 300K in S4. Killed "COMPOUND." — SaaS boilerplate.)

## S9 — CTA + URL | 53–63s | f1590–1890
**Component:** ParticleWave (stabilized all green) → GlowingMarquee (URL)
**Visual:** Grid stabilizes. Beat. Text. Grid fades. URL appears.
**Text:** `THE EDGE IS THE MARKET ITSELF.` → fade → `generalmarket.io` glow sweep.

## S10 — SILENCE | 63–70s | f1890–2100
**Component:** Black + URL hold (no 8s nothing — 7s with URL remaining visible)
**Visual:** URL stays visible on black. No animation. Silence. End.
**Duration:** 7s (not 8s — trimmed for confidence over indulgence).

## Changes from v4
1. **S2** — replaced static dot grid with ParticleWave signal propagation. Now kinetic and WebGL-native.
2. **S3** — cut "SAME EDGE" (third line).
3. **S5** — cut from 10s → 7s. Removed "YOURS TO EXPLOIT" (crass) and redundant 300K mention. Simplified to "TRADE WHAT MOVES YOU."
4. **S6** — killed "SETTLE. ITERATE. REDEPLOY." (DevOps jargon). New text: "WHILE THEY WAIT, YOU DEPLOY." — concrete advantage, not a verb list.
5. **S8** — simplified to "YOUR ALGO. OUR GRID." No more number repetition, no "COMPOUND" boilerplate.
6. **S10** — cut from 8s → 7s. URL stays visible on black instead of pure black nothingness. Confidence not indulgence.
7. **Total runtime** compressed from 75s → 70s. 2100 frames.
8. **7/10 scenes now use genuine WebGL shaders**: S1, S2, S3, S4, S6, S7, S8, S9.
