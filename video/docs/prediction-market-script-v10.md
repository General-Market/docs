# Prediction Market Video — Script v10
# 75s / 2250 frames / 30fps / 1920x1080
# AUDIENCE ASSUMPTION: viewer already trades prediction markets (Polymarket/Kalshi/etc.)
# No selling of prediction markets as a concept. Only "we're better than other PM platforms."

## THE RAILS (strict — same 7 comparisons from the original brief, no drift)

The video makes these 7 head-to-head comparisons with OTHER prediction markets:

1. **HOOK**: You already trade prediction markets. But they're holding your algo back.
2. **LIQUIDITY**: Other PMs ration liquidity. Here, every order fills. (split grid)
3. **MIN SIZE**: Other PMs have minimums. Here, $1 works.
4. **100× MARKETS**: Other PMs have a few thousand markets. We have 300,000.
5. **CATEGORIES**: Other PMs = politics/sports/economics. We add twitch/movies/games/animals/space.
6. **SETTLEMENT**: Other PMs settle in a week. We settle every 10 minutes.
7. **TWO PATHS**: Strategy builders + market hunters both win here.
8. **CTA**: generalmarket.io

No traditional finance. No "most traders lose money." No stocks/crypto/forex. The enemy is OTHER PREDICTION MARKETS, not traditional brokers.

---

## S1 — HOOK | 0–8s | f0–240
**Component:** ParticleWave (hex grid)
**Visual:** Dark hex grid forms with single shockwave ripple.
**Text (word-by-word):**
- `You already trade prediction markets.`
- beat
- `But they're holding your algo back.`
**Emphasis:** `holding your algo back` in red.

## S2 — LIQUIDITY | 8–20s | f240–600
**Argument:** Other PMs ration liquidity. Here, every order fills.
**Component:** GsapStagger (split dot grids)
**Visual:**
- **Left label:** `OTHER PREDICTION MARKETS` — 10×10 grid. ~70% gray, ~30% green. Fills slow, row by row.
- **Right label:** `US` — 10×10 grid. ALL green. Snaps instantly.
**Text:**
- `Their liquidity is rationed.`
- beat
- `Half your order sits waiting.`
- beat
- `Here, every order fills.`
**Emphasis:** `Half` in red, `every order` in teal underline.

## S3 — NO MINIMUM | 20–27s | f600–810
**Argument:** Their minimums kill $1 trades. Ours don't exist.
**Component:** RingShader (concentric rings scaling with amounts)
**Visual:** Rings nest as amounts flash center.
**Text:**
- `They have minimums.`
- beat
- `Trade here with $1.`
- `Or $10,000.`
- `Same edge either way.`
**Emphasis:** `minimums` in red, `$1` huge teal, `$10,000` huge teal.

## S4 — 300,000 MARKETS | 27–39s | f810–1170
**Argument:** They have a few thousand markets. We have 300,000.
**Component:** ParticleWave explosion + Text3D monolith (kill-shot)
**Visual:**
- Start: Small square of ~30 market tiles on their side.
- Transition: grid explodes outward in two stages.
- Lands on huge **3D extruded** `300,000` with orbital camera dolly and rim lighting. Digits count up as they extrude.
**Text:**
- `They give you a few thousand markets.`
- beat
- `We have...` → 3D monolith lands → `markets. live. now.`
**Emphasis:** The monolith.

## S5 — TRADE WHAT YOU LOVE | 39–51s | f1170–1530
**Argument:** They only offer politics/sports/economics. We add everything.
**Component:** DepthGallery (parallax, split)
**Visual:**
- **Left (`OTHER PMs`, faded, flat):** 3 cards drift slowly:
  - `POLITICS`
  - `SPORTS`
  - `ECONOMICS`
- **Right (`US`, vivid, cascading from depth):** 8 cards fly in:
  - `TWITCH`
  - `MOVIES`
  - `VIDEO GAMES`
  - `ANIMALS`
  - `SPACE`
  - plus the 3 categories from the left
**Text:**
- `They give you three categories.`
- beat
- `We give you everything.`
**Emphasis:** `three` in dim gray, `everything` in teal.

## S6 — SETTLEMENT | 51–63s | f1530–1890
**Argument:** They settle in a week. We settle every 10 minutes.
**Component:** Custom BlockChain visualization (horizontal chains of blocks)
**Visual:**
- **Left chain (`OTHER PMs`):** Amber blocks. One every ~1s. After 8s: 8 blocks. Label: `1 WEEK`.
- **Right chain (`US`):** Bright green blocks. Blaze in — 10+ per second. After 8s: 80+ blocks. Label: `10 MINUTES`.
**Text:**
- `They settle in a week.`
- beat
- `We settle every 10 minutes.`
- beat
- `Then deploy the next version.`
**Emphasis:** `10 minutes` in teal underline.

## S7 — TWO WAYS TO WIN | 63–72s | f1890–2160
**Argument:** Two kinds of winners thrive here — strategy builders AND market hunters.
**Component:** WebGL split (particle morph left + radial spotlight right)
**Visual:**
- **Left half (cyan):** Single particle node in 3D space mutating `v1 → v2 → v3 → v4`. More connections each version. Label fades in: `STRATEGY BUILDERS`.
- **Right half (green):** Dim market grid bg. Radial shader spotlight sweeps across, lighting market tiles. Each lit tile flashes a market name briefly. Label fades in: `MARKET HUNTERS`.
**Text (center, spanning both):**
- `Two ways to win here.`
**Emphasis:** `two ways` in teal.

## S8 — CTA | 72–75s | f2160–2250
**Component:** GlowingMarquee
**Text:** `generalmarket.io`
Hold. Fade to black.

---

## Voice rules
- Audience: already knows prediction markets. Speak as a peer, not a pitch deck.
- Enemy: other PM platforms (Polymarket, Kalshi, etc.). Never traditional finance.
- "They" vs "We" structure in every comparison.
- Concrete numbers: `$1`, `$10,000`, `300,000`, `10 minutes`, `1 week`, `three categories`.
- No "the edge is the market itself." No "your algo is starving." No traditional finance pain.

## WebGL usage (9/8 scenes with shaders)
| Component | Scenes |
|-----------|--------|
| ParticleWave | S1, S4 |
| GsapStagger | S2 |
| RingShader | S3 |
| Text3D monolith | S4 |
| DepthGallery | S5 |
| Custom BlockChain | S6 |
| Particle morph + radial spotlight | S7 |
| GlowingMarquee | S8 |

## Changes from v9
1. **S1 rewritten** — killed "Most traders lose money. Stocks. Crypto. Forex." The audience already trades PMs. New line: "You already trade prediction markets. But they're holding your algo back."
2. **Every scene reframed** — "OTHER PREDICTION MARKETS" instead of "OTHERS" (generic). Explicit about who we're competing with.
3. **S2 text** reworked: "Their liquidity is rationed. Half your order sits waiting. Here, every order fills."
4. **S3 text** reworked: "They have minimums. Trade here with $1."
5. **S4 text**: "They give you a few thousand markets. We have 300,000."
6. **S5 text**: "They give you three categories. We give you everything."
7. **S6 text**: "They settle in a week. We settle every 10 minutes. Then deploy the next version."
8. **S8 CTA** unchanged.
9. Removed the "pain" scene entirely — audience doesn't need the setup.

## Scene durations
- S1: 8s (hook)
- S2: 12s (liquidity)
- S3: 7s (min size)
- S4: 12s (300K)
- S5: 12s (categories)
- S6: 12s (settlement)
- S7: 9s (two paths)
- S8: 3s (CTA)
- **Total: 75s ✓**
