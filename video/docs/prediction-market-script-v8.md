# Prediction Market Video — Script v8 (FAITHFUL TO BRIEF)
# 75s / 2250 frames / 30fps / 1920x1080
# Strictly follows user's 7-point brief — no drift

## S1 — HOOK | 0–6s | f0–180
**Argument:** Prediction markets are the new frontier for algo traders.
**Component:** ParticleWave (hex grid forming)
**Text:**
- `Prediction markets.`
- `The biggest opportunity`
- `for algo traders.`
**Emphasis:** `algo traders` in teal.

## S2 — LIQUIDITY | 6–18s | f180–540
**Argument:** Don't waste profits on liquidity — batched parimutuel = every order fills.
**Component:** GsapStagger (split-screen dot grids)
**Visual:**
- **Left label:** `OTHERS` — 10×10 square of dots. Mostly GRAY with some GREEN scattered. Fills slowly row by row.
- **Right label:** `US` — 10×10 square of dots. ALL GREEN. Fills instantly.
**Text:**
- `On other platforms, liquidity is rationed.`
- beat
- `Here, every order fills.`
**Emphasis:** `every order` in teal, underlined.

## S3 — NO MINIMUM | 18–26s | f540–780
**Argument:** No minimum trade size — $1 works as well as $10,000.
**Component:** RingShader (rings scale with amount) + big text
**Visual:** Ring expands as amount grows. Amounts flash center.
**Text:**
- `No minimum.`
- `$1 is all you need.`
- `$10,000 works the same way.`
**Emphasis:** `$1` in teal (huge), `$10,000` in teal.

## S4 — 100× MORE MARKETS | 26–38s | f780–1140
**Argument:** 100x more markets — expand square to 300,000.
**Component:** ParticleWave / GsapStagger (grid explosion)
**Visual:**
- Start: small grid of ~30 market tiles (a square)
- Burst 1: grid multiplies → 3,000 tiles
- Burst 2: → 30,000
- Burst 3: → 300,000 (screen-filling green pixel sea)
- **Monolith moment:** Huge 3D extruded `300,000` with orbital camera dolly appears as the final burst lands (the kill-shot from consensus rounds).
**Text:**
- `Others offer a few thousand markets.`
- beat
- `We have 300,000.`
**Emphasis:** `300,000` as the 3D extruded monolith.

## S5 — TRADE WHAT YOU LOVE | 38–50s | f1140–1500
**Argument:** Trade what you love — OTHERS only offer boring categories, US adds everything.
**Component:** DepthGallery (parallax cards, split comparison)
**Visual:**
- **Left stack (`OTHERS`, flat, desaturated):** 3 cards
  - `POLITICS`
  - `SPORTS`
  - `ECONOMICS`
- **Right stack (`US`, cascading from depth, vivid):** 8 cards cascade in
  - `TWITCH`
  - `MOVIES`
  - `VIDEO GAMES`
  - `ANIMALS`
  - `SPACE`
  - plus the 3 from OTHERS
**Text:**
- `Trade what you love.`
**Emphasis:** `love` in teal.

## S6 — SETTLEMENT SPEED | 50–62s | f1500–1860
**Argument:** Don't wait — settle every 10 minutes vs their 1 week.
**Component:** Custom chain block visualization (horizontal supply chain of blocks)
**Visual:** Two horizontal chains side by side:
- **Left chain (`OTHERS`):** Amber blocks adding slowly. One block appears every ~1 second. After 8 seconds: ~8 blocks total. Label: `1 WEEK`.
- **Right chain (`US`):** Green blocks adding fast. 10+ blocks appear per second. After 8 seconds: ~80 blocks filling the screen. Label: `10 MINUTES`.
**Text:**
- `Others settle in 1 week.`
- beat
- `We settle every 10 minutes.`
**Emphasis:** `10 minutes` in teal.

## S7 — TWO KINDS OF TRADERS | 62–72s | f1860–2160
**Argument:** Two winning strategies on our platform — upgrade your algo OR find the best markets.
**Component:** TextSplit + split layout with two cards
**Visual:**
- **Left card (cyan):** Icon + label: `STRATEGY BUILDERS`
  - Subtitle: `iterate, improve, compound`
  - Small visual: version numbers iterating (v1 → v2 → v3)
- **Right card (green):** Icon + label: `MARKET HUNTERS`
  - Subtitle: `find the best markets, exploit them`
  - Small visual: a spotlight moving across the market grid from S4
**Text:**
- `Two ways to win.`

## S8 — CTA | 72–75s | f2160–2250
**Component:** GlowingMarquee
**Text:** `generalmarket.io`
Hold. Fade to black.

## DIFFERENCE FROM v7 (WHERE I DRIFTED)
- **S1:** Killed "70% of all trading volume is run by algorithms" (that was Virtuals). Replaced with "Prediction markets. The biggest opportunity for algo traders." — which is YOUR pitch.
- **S1:** Killed "You build better algos / They trade worse markets" (never in brief).
- **S2:** Killed "But most of them are stuck trading 3 things" pivot (never in brief). Restored the direct liquidity comparison.
- **S3:** Killed "Stocks. Crypto. Forex. All crowded. All correlated." (never in brief). Restored "$1 = all" as a standalone scene.
- **S4:** Killed the "literally anything?" pivot. Restored the direct "100× more markets" argument with the 300K monolith.
- **S5:** Restored YOUR categories — politics/sports/economics vs twitch/movies/games/animals/space. Not "rain in Tokyo" / "Elon tweet" etc. I had invented those.
- **S6:** Restored the block/supply chain visual you specifically mentioned. Not just two rings.
- **S7:** Restored the two-trader-types scene that I had dropped entirely in earlier versions.
- **Overall:** 8 scenes (not 12). Directly mirrors your 7-point brief + CTA.

## WebGL Usage
| Component | Scenes | Purpose |
|-----------|--------|---------|
| ParticleWave | S1, S4 | Hero + grid explosion |
| GsapStagger | S2 | Split dot grids |
| RingShader | S3 | Amount rings |
| Text3D (via ThreeCanvas) | S4 | 300,000 monolith kill-shot |
| DepthGallery | S5 | Category parallax comparison |
| Custom block chain | S6 | Horizontal supply chain visual |
| TextSplit | S7 | Two-trader split |
| GlowingMarquee | S8 | URL reveal |

## Scene count & runtime check
- S1: 6s (hook)
- S2: 12s (liquidity — longer because the comparison IS the argument)
- S3: 8s (no minimum)
- S4: 12s (100× markets + monolith)
- S5: 12s (trade what you love)
- S6: 12s (settlement)
- S7: 10s (two trader types)
- S8: 3s (URL)
- **Total: 75s ✓**
