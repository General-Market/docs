# Prediction Market Video — Script v6
# 75s / 2250 frames / 30fps / 1920x1080
# Voice: plain English, concrete numbers, questions anyone understands
# Model: Virtuals 2 video (we replicated it — the text pattern works)

## S1 — HOOK | 0–6s | f0–180
**Component:** ParticleWave (orderbook scatter → hex grid)
**Visual:** Price numbers scatter across the screen, then snap into a hex grid. Shockwave.
**Text (word-by-word reveal):**
- `70% of all trading volume`
- `is now run by algorithms.`

Same opening as Virtuals — the hook that already works. Establishes algo traders as the audience.

## S2 — TRANSITION | 6–10s | f180–300
**Component:** GlowingMarquee
**Text:**
- `But most of them`
- `are stuck trading`
- `the same 3 things.`

Plain English. Sets up the categories scene.

## S3 — CATEGORIES PROBLEM | 10–16s | f300–480
**Component:** DepthGallery (3 flat boring cards)
**Visual:** Three cards drift lazily — `STOCKS`, `CRYPTO`, `FOREX`. Desaturated.
**Text:** `Stocks. Crypto. Forex.`
Then cards fade.
**Text:** `All crowded. All correlated.`

## S4 — PIVOT | 16–21s | f480–630
**Component:** TextSplit (punchy)
**Text:**
- `What if you could trade`
- `literally anything?`

Question the viewer can answer in their head. Hook into the next scene.

## S5 — CATEGORIES EXPLOSION | 21–31s | f630–930
**Component:** DepthGallery (parallax, cards flying from depth)
**Visual:** Cards cascade from far to near, category-colored:
- `Will it rain in Tokyo tomorrow?`
- `Who wins the Super Bowl?`
- `Next Elon tweet?`
- `Top Twitch streamer this week?`
- `Next Mars launch date?`
- `Oscars best picture?`
- `Bitcoin above $150K this month?`
**Text overlay:** `300,000 markets. Today.`

Each card is a REAL question someone might want to trade. Not categories — actual markets.

## S6 — LIQUIDITY PROBLEM | 31–38s | f930–1140
**Component:** GsapStagger (split grids)
**Left grid (`Other platforms`):** 100 dots. 20% green, 80% gray. Most don't fill.
**Right grid (`Here`):** 100 dots. All green instantly.
**Text:**
- `On other platforms,`
- `your order sits there.`
- `Half of it never fills.`
Then:
- `Here, every order fills.`
- `Every time.`

Plain description of what happens. No "parimutuel." No "slippage."

## S7 — MINIMUM | 38–44s | f1140–1320
**Component:** RingShader (concentric rings scale with amounts)
**Visual:** Rings nest as amounts appear.
**Text (sequential):**
- `You can trade with $1.`
- `Or $10,000.`
- `Same edge.`

## S8 — SPEED | 44–52s | f1320–1560
**Component:** RingShader (dual rings)
**Left:** Amber, crawling. `1 week.`
**Right:** Green, blazing. `10 minutes.`
**Text:**
- `On other platforms,`
- `you wait a week to settle.`
Then:
- `Here? 10 minutes.`
- `Then you run the strategy again.`

## S9 — THE PROMISE | 52–60s | f1560–1800
**Component:** ParticleWave (data matrix — grid cells ticking prices)
**Visual:** The grid returns. Cells tick. A green wave ripples across the grid.
**Text:**
- `You already have the algo.`
- `We have the markets.`

## S10 — CLOSE | 60–68s | f1800–2040
**Component:** ParticleWave (stabilized all green)
**Text:**
- `The edge was never the algorithm.`
- `It was where you pointed it.`

Plain English. Concrete. A real statement about where alpha actually comes from.

## S11 — URL | 68–75s | f2040–2250
**Component:** GlowingMarquee
**Text:** `generalmarket.io`
Hold. Fade.

## Why this works (vs v5)
v5 text was cryptic: "The edge is the market itself" / "Your algo. Our grid." / "Settle. Iterate. Redeploy." — abstract verbs and slogans.
v6 text is plain: "Most of them are stuck trading the same 3 things." / "On other platforms, your order sits there. Half of it never fills." / "Here? 10 minutes. Then you run the strategy again."

Each line is a SENTENCE. Subject, verb, object. Someone watching this on their phone in 5 seconds understands exactly what we offer:
1. Traditional markets are crowded
2. Trade anything (300K markets)
3. Orders always fill
4. $1 or $10K, same edge
5. 10 min settlement, not 1 week
6. You keep your algo, we give you the markets

No jargon. No mystery. No "parimutuel." Seven concrete benefits delivered in plain English, each with a specific number or comparison.

## WebGL usage (same as v5, 7/11 genuine shader scenes)
| Component | Scenes |
|-----------|--------|
| ParticleWave | S1, S9, S10 |
| GlowingMarquee | S2, S11 |
| DepthGallery | S3, S5 |
| TextSplit | S4 |
| GsapStagger | S6 |
| RingShader | S7, S8 |
