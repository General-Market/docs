# Prediction Market Video — Script v9
# 75s / 2250 frames / 30fps / 1920x1080
# Merges v7 tone (plain-English sentences, word-by-word reveals) with v8 brief fidelity

## THE RAILS (strict — scoring penalizes drift)

The video MUST make these 9 arguments in this order:

1. **PAIN**: Traders can't make money with existing financial products
2. **HOOK**: Prediction markets are the opportunity for algo traders
3. **LIQUIDITY**: Batched parimutuel — no rationed liquidity, every order fills (split grid visual)
4. **MIN SIZE**: $1 trades with the same edge as $10,000
5. **100× MARKETS**: 300,000 markets instead of a handful (grid explosion visual)
6. **TRADE WHAT YOU LOVE**: Politics/Sports/Economics vs Twitch/Movies/Games/Animals/Space (comparison)
7. **SETTLEMENT**: 10 minutes vs 1 week (supply chain of blocks visual)
8. **TWO WINNING PATHS**: Strategy builders (upgrade algos) + Market hunters (find best markets)
9. **CTA**: generalmarket.io

No other arguments. No "70% of volume run by algorithms." No "stuck trading 3 things." No "the edge was never the algorithm." Every scene must serve one of the 9 points above.

---

## S1 — THE PAIN | 0–8s | f0–240
**Component:** ParticleWave (dim, muted — scattered red/gray price data)
**Visual:** Price numbers and PnL curves scatter dimly across a dark screen. They look broken — some red, some flat, some going down. A single failed strategy backtest.
**Text (word-by-word, subject-verb-number sentences):**
- `Most traders lose money.`
- beat
- `Stocks. Crypto. Forex.`
- beat
- `The edge is gone.`
**Emphasis:** `lose money` in red, `edge is gone` in dim red.

## S2 — THE HOOK | 8–14s | f240–420
**Component:** RingShader (radial shockwave — pure shader, NOT ParticleWave again)
**Visual:** A single teal ring bursts outward from the center, distortion/chromatic aberration in its wake. The red scatter from S1 gets consumed by the shockwave and replaced with clean black. Ring fades as text lands.
**Text:**
- `Prediction markets are different.`
- `And algo traders go first.`
**Emphasis:** `different` in teal, `algo traders` in teal underline.
**WHY:** Different component from S1's ParticleWave — no back-to-back repetition. The shader shockwave is the narrative transition from pain to opportunity.

## S3 — LIQUIDITY | 14–24s | f420–720
**Argument (from brief):** Don't waste profits on liquidity — batched parimutuel.
**Component:** GsapStagger (split-screen dot grids, exactly as described in brief)
**Visual:**
- **Left (`OTHERS`):** 10×10 square. Dots fill row-by-row. ~70% gray, ~30% green. Slow, hesitant.
- **Right (`US`):** 10×10 square. ALL dots turn green in a single snap.
**Text (word-by-word):**
- `On other platforms,`
- `half your order never fills.`
- beat
- `Here, every order fills.`
**Emphasis:** `half` in red, `every order` in teal underline.

## S4 — NO MINIMUM | 24–30s | f720–900
**Argument (from brief):** No minimum size — $1 = same as big.
**Component:** RingShader (concentric rings expanding with amounts)
**Visual:** Rings nest as amounts flash center. Each new amount creates a new ring layer.
**Text:**
- `Trade with $1.`
- `Or $10,000.`
- `Same edge. Same fills.`
**Emphasis:** `$1` huge teal, `$10,000` huge teal.

## S5 — 300,000 MARKETS | 30–40s | f900–1200
**Argument (from brief):** 100× more markets — expand grid to 300K.
**Component:** ParticleWave (grid explosion) + Text3D monolith (the kill-shot)
**Visual:**
- Start: small square of ~30 market tiles (2s)
- Two-stage explosion: 30 → 3,000 → 300,000 in rapid succession (2s)
- As the final burst lands: a **3D extruded** `300,000` glyph materializes with orbital camera dolly + rim lighting. Digits re-extrude as they count up to the final number. (6s)
**Text (before monolith):** `Others offer a few thousand markets.`
**Text (during monolith):** The 3D number itself. Word-by-word below: `markets. live. now.`
**Emphasis:** The monolith IS the emphasis.

## S6 — TRADE WHAT YOU LOVE | 40–52s | f1200–1560
**Argument (from brief):** Trade what you love — their boring vs our expansive.
**Component:** DepthGallery (parallax depth cards, split)
**Visual:**
- **Left (`OTHERS`, flat, desaturated):** 3 cards drifting slowly:
  - `POLITICS`
  - `SPORTS`
  - `ECONOMICS`
- **Right (`US`, vivid, cascading from depth):** 8 cards fly in:
  - `TWITCH` (purple)
  - `MOVIES` (red)
  - `VIDEO GAMES` (blue)
  - `ANIMALS` (orange)
  - `SPACE` (navy)
  - plus the 3 from OTHERS
**Text (word-by-word):**
- `Others give you three categories.`
- beat
- `We give you everything.`
**Emphasis:** `three` in dim gray, `everything` in teal.

## S7 — SETTLEMENT | 52–62s | f1560–1860
**Argument (from brief):** Settle every 10 minutes vs 1 week — supply chain of blocks visual.
**Component:** Custom BlockChain visualization (horizontal chains of blocks side by side)
**Visual:**
- **Left chain (`OTHERS`):** Amber/dim. Blocks add slowly — one every ~1s. After 8s: ~8 blocks. Counter label below: `1 WEEK`.
- **Right chain (`US`):** Bright green. Blocks BLAZE in — ~10 per second. After 8s: 80+ blocks filling half the screen. Counter label: `10 MINUTES`.
**Text (word-by-word):**
- `Other markets settle in a week.`
- beat
- `We settle every 10 minutes.`
- beat
- `Then you deploy again.`
**Emphasis:** `10 minutes` in teal underline.

## S8 — TWO WAYS TO WIN | 62–72s | f1860–2160
**Argument (from brief):** Two kinds of winners — strategy upgraders + market pickers.
**Component:** WebGL split — NO text cards
**Visual:** Screen splits down the middle at f0. Two independent WebGL scenes side by side.
- **Left half (cyan):** A single particle node in 3D space. It mutates through versions — `v1 → v2 → v3 → v4`. Each version, the node's particle arrangement morphs (more connections, denser, brighter). Label fades in below: `STRATEGY BUILDERS`.
- **Right half (green):** The market grid from S5 appears as a dim background. A bright spotlight (radial shader) sweeps across the grid, lighting tiles as it passes. Each lit tile flashes a market name briefly. Label fades in below: `MARKET HUNTERS`.
**Text (bottom center, spanning both halves):**
- `Two ways to win.`
**Duration:** 10s — enough for the version-tick and spotlight sweep to register fully.
**WHY:** Replaced typography-heavy text split with two WebGL scenes. Left = particle morph (algo iteration). Right = shader spotlight (market discovery). Both are visually distinct from the rest of the video.

## S9 — CTA | 72–75s | f2160–2250
**Component:** GlowingMarquee (URL with glow sweep)
**Text:** `generalmarket.io`
Hold. Fade to black.

---

## Scene durations (v9 final)
- S1 PAIN: 0-8s (8s)
- S2 HOOK: 8-14s (6s)
- S3 LIQUIDITY: 14-24s (10s)
- S4 MIN SIZE: 24-30s (6s)
- S5 300K: 30-40s (10s) — monolith kill-shot
- S6 LOVE: 40-52s (12s)
- S7 SETTLEMENT: 52-62s (10s)
- S8 TWO WAYS: 62-72s (10s) — dual WebGL split
- S9 CTA: 72-75s (3s)
- **Total: 75s ✓**

## Voice notes (matching v7/Virtuals tone)
- Every line is a SENTENCE. Subject, verb, object. No slogans.
- Numbers always appear concrete: `$1`, `$10,000`, `300,000`, `10 minutes`, `1 week`.
- Comparisons use the word "others" explicitly — never "competitors" or "platforms."
- Word-by-word reveal with 8-10 frames per word, teal underline on the key word per scene.
- No "edge is the market itself" or other abstract slogans.
- No jargon — no "parimutuel," no "slippage," no "liquidity rationing."

## WebGL usage (9/9 scenes with genuine shaders — no typography-only scene)
| Component | Scenes | Purpose |
|-----------|--------|---------|
| ParticleWave | S1, S5 | Pain scatter + grid explosion |
| RingShader | S2, S4 | Shockwave transition + amount rings |
| GsapStagger | S3 | Split dot grids |
| Text3D monolith | S5 | 300,000 kill-shot |
| DepthGallery | S6 | Category parallax |
| Custom BlockChain | S7 | Supply chain of blocks |
| Particle morph + radial spotlight | S8 | Two-trader dual WebGL split |
| GlowingMarquee | S9 | URL |
