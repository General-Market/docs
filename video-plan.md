# Video Plan — "Launch Your First GM Bot in 5 Minutes"

Duration: 4:43 | Format: Tutorial + FAQ hybrid | Target: Asset managers, quant traders

---

## Transcript Analysis

### Structure

The video has 4 acts:

1. **HOOK + PROMISES** (0:00–0:42) — Title, anti-hype positioning, promise list, audience targeting
2. **BOT TRIGGER** (0:42–0:48) — "Hey Claude, build me a bot" — the tutorial payload
3. **FAQ WHILE WAITING** (0:48–4:24) — 6 questions answered while the bot builds
4. **PAYOFF + CLOSE** (4:24–4:42) — Bot is ready, sign-off

### Promises Made (Opening)

| Timestamp | Promise | Delivered in Speech? | Needs Visual? |
|-----------|---------|---------------------|---------------|
| 0:16 | "Launch your first bot in 5 minutes" | Partially — bot launches at 4:33 but no timer | YES — countdown timer overlay |
| 3:44 | "Won't promise you'll become a millionaire" | Yes — anti-hype framing | No |
| 11:28 | "Liquidity" problem | YES — FAQ #1 covers it (0:48–1:29) | YES — diagram |
| 11:28 | "Capital lock" problem | NO — never addressed | YES — insert card needed |
| 11:28 | "Risk management" problem | PARTIALLY — parimutuel correction at 2:31 | YES — insert card |
| 22:24 | "Escape all that under this tutorial" | Implicit — but no explicit "here's how the bot solves it" | YES — overlay tying bot to solutions |
| 36:40 | "Beginner or H1 manager" | Not revisited | YES — split-screen or label |

### Promises NOT in Speech (From Pitch / Expected by Viewer)

These are things an asset manager watching this video expects to learn. They aren't said but must appear:

| Topic | Where to Insert | Format |
|-------|----------------|--------|
| **No fees / no spread** | During parimutuel explanation (2:13–2:30) | Text overlay: "$0 spread. $0 fees." |
| **Settlement speed (10 min)** | Already mentioned but needs visual | Animated timeline |
| **Privacy / copy-trade protection** | Covered at 2:41 but abstract | Visual: blurred orderbook vs sealed bets |
| **500K+ markets** | Mentioned at 0:48 but no visual proof | Screen recording of source list |
| **Instant withdrawals** | Not mentioned at all | Insert card during settlement section |

---

## Act-by-Act B-Roll Plan

### ACT 1 — HOOK + PROMISES (0:00–0:42)

| Timestamp | Speech | Visual |
|-----------|--------|--------|
| 0:00–0:16 | (before speech) | **Cold open**: Screen recording of GM dashboard, cursor moving fast. Or: black screen, title card fades in. |
| 0:16–3:44 | "How to launch your first GM bot in 5 minutes" | **Title card** with text. Start a **5-minute countdown timer** in corner (persists entire video). |
| 3:44–9:36 | "Won't promise millionaire..." | **B-roll**: Montage of cringe trading guru thumbnails (blurred/stylized). Or: stock footage of someone in a Lambo, then cut back to you. Quick, 2-3 seconds max. |
| 9:36–11:28 | "No no no" | Stay on face — the delivery sells it. |
| 11:28–22:24 | "Liquidity, capital lock, risk management..." | **Text overlay**: Each problem appears as a bullet point as you say it. Checkmark appears next to each one later when addressed. |
| 22:24–27:92 | "Escape all that under this tutorial" | **B-roll**: Quick flash of the Claude Code terminal (the bot-building interface). Tease what's coming. |
| 27:92–36:40 | "No matter your strategies..." | Stay on face. This is conviction delivery. |
| 36:40–41:76 | "Beginner or H1 manager" | **Split label overlay**: Left "Beginner" / Right "Fund Manager" — both check-marked. |
| 41:76–42:80 | "Let's start now" | **Transition**: Cut to screen recording. |

### ACT 2 — BOT TRIGGER (0:42–0:48)

| Timestamp | Speech | Visual |
|-----------|--------|--------|
| 42:80–48:64 | "Hey Claude, can you build me a bot..." | **SCREEN RECORDING**: Claude Code terminal. You type the prompt. Claude starts building. This is the hero moment — the tutorial payload. Full screen, clean terminal. |

**Critical**: This screen recording must be prepared separately. Record a real Claude Code session building a Twitch viewer strategy. The viewer needs to see the actual prompt and the response starting.

### ACT 3 — FAQ WHILE WAITING (0:48–4:24)

**Transition card**: "While the bot builds, let's answer your questions" (0:48)

#### FAQ 1: Liquidity on 500K Markets (0:48–1:29)

| Timestamp | Speech | Visual |
|-----------|--------|--------|
| 48:64–57:76 | "Most often asked..." | **Text card**: "Q: How does GM ensure liquidity on 500,000 markets?" |
| 57:76–62:40 | "5,000 Twitch streamers in a batch" | **Diagram**: Grid of 5,000 dots (streamers). Highlight one = one submarket. Animate: all dots pulsing = all traded simultaneously. |
| 62:40–67:44 | "Every trader bets on every streamer" | **Animation**: Arrows from "Trader" to ALL dots, not just one. Contrast with traditional: arrow to one dot. |
| 67:44–76:72 | "System only accepts trades where you fill for every streamer" | **Overlay**: "Mandatory fill = guaranteed liquidity". Checkmark next to "Liquidity" from the promises list. |
| 76:72–84:80 | "Harder to trade, but benefit is huge" | **B-roll**: Quick cut to the actual GM interface showing a batch with many markets. Screen recording. |
| 84:80–89:84 | "Some traders earn more because they are better" | Stay on face — this is the competitive framing. |

#### FAQ 2: How Price Works / 10-Min Settlements (1:29–2:31)

| Timestamp | Speech | Visual |
|-----------|--------|--------|
| 89:84–96:40 | "How price works..." / "Train delay batch" | **Text card**: "Q: How does pricing work with 10-minute settlements?" |
| 96:40–107:76 | "30 train station delay submarkets..." | **Animated timeline**: 10-min window opens → bets flow in → window closes → oracle resolves → PNL distributed. This is THE key visual. Must be clean, simple, 3-4 steps. |
| 107:76–113:76 | "Everyone pushes bets in a 10-min window" | **Overlay on timeline**: Multiple bet arrows entering the window simultaneously. |
| 113:76–120:36 | "Wait 10 minutes, oracle computes" | **Oracle animation**: 3 oracle nodes (match your actual 3-oracle setup) reaching consensus. Checkmarks appear. |
| 119:92–131:48 | "Oracle compute PL... no price, quotation revealed at end" | **Key insight overlay**: "No orderbook. No price discovery. Result revealed at settlement." + **INSERT**: "$0 spread. $0 fees. $0 slippage." |
| 131:48–135:72 | "What is parimutuel liquidity?" | **Text card**: "Parimutuel = winners split losers' collateral" |
| 135:72–150:44 | Example explanation | **Simple diagram**: Pool A (YES bets) vs Pool B (NO bets). Arrow from losing pool to winning pool. Repeat 30x animation (fast). Sum = PNL. |
| 150:44–159:72 | "Correction: $1 vs $1M" | **Visual**: Two bars, one tiny ($1), one massive ($1M). Arrow shows max loss = $1. This is the risk management answer — **checkmark next to "Risk Management" from promises**. |

**INSERT CARD** (between 159:72–161:40): "Capital lock: 10 minutes. Not days. Not weeks." — **Checkmark next to "Capital Lock" from promises**.

**INSERT CARD**: "Instant withdrawals after each settlement." — Addresses the missing instant-withdrawal promise.

#### FAQ 3: Privacy (2:41–3:14)

| Timestamp | Speech | Visual |
|-----------|--------|--------|
| 161:40–166:20 | "How GM be private..." | **Text card**: "Q: How is General Market private?" |
| 166:20–172:84 | "Other markets: order books, public oracles" | **Split screen**: Left = traditional orderbook (visible trades, copy-tradeable). Right = GM sealed batch (opaque). |
| 172:84–181:16 | "Built a specialized scalable oracle" | **B-roll**: Server/infrastructure visual. Or: animated oracle network diagram (3 nodes, BLS signatures aggregating). |
| 181:16–194:04 | "Every market settles instantly, no disputes" | **Comparison table overlay**: Traditional PM (disputes, days) vs GM (instant, oracle consensus). |

#### FAQ 4: Finding Your Moat (3:14–3:47)

| Timestamp | Speech | Visual |
|-----------|--------|--------|
| 194:04–204:92 | "Most interesting question... how do I find a moat?" | **Text card**: "Q: How do I find an edge when I must trade everything?" |
| 204:92–212:12 | "Not how good at predicting one market, but all markets" | **Visual**: Single dart vs shotgun blast. One target vs 500,000 targets. The paradigm shift. |
| 212:12–216:84 | "Quantity over quality" | **Bold text overlay**: "QUANTITY > QUALITY" |
| 216:84–230:32 | "1920s technical analysis... 1970s Black-Scholes... 2026 scratch" | **Timeline visual**: 1920s → 1970s → 2026. Each era with its icon. The punchline: "New instrument = new edge." |
| 230:32–247:44 | "Easier starting from new instrument than fighting hedge funds" | **B-roll**: Stay on face for conviction. Maybe subtle overlay of hedge fund logos fading out. |

#### FAQ 5: Do I Need Every Market? (4:07–4:24)

| Timestamp | Speech | Visual |
|-----------|--------|--------|
| 247:44–253:92 | "One batch per source" | **Screen recording**: GM source selection page. Show: Train, Twitch, Steam, Pump.fun as separate batches. |
| 253:92–260:00 | "Only trade on train, only on Twitch..." | **Highlight each source** as mentioned. |
| 260:16–264:88 | "Ask and we will add it" | **Overlay**: "Request a batch → we build it" |
| 264:88–270:96 | "Vision: 1 billion parallel markets" | **Bold number animation**: Counter spinning up to 1,000,000,000. |

### ACT 4 — PAYOFF + CLOSE (4:24–4:42)

| Timestamp | Speech | Visual |
|-----------|--------|--------|
| 270:96–273:76 | "Strategy seems to be ready" | **CUT TO SCREEN**: Claude Code terminal showing completed bot. The payoff. Timer shows ~4:30 — under 5 minutes. |
| 273:76–276:88 | "Claude launched it, let's see how it goes" | **Screen recording**: Bot running, first trades appearing in the GM dashboard. |
| 276:88–280:80 | "Clearer how GM works" | **Recap overlay**: All 3 promises checkmarked (Liquidity ✓, Capital Lock ✓, Risk Management ✓). |
| 280:80–282:80 | "Max, General Market Founder" | **End card**: Logo, URL, CTA. |

---

## Production Checklist

### Screen Recordings Needed

1. **Claude Code bot-building session** — Real recording of prompting Claude to build a Twitch strategy bot. Must show: prompt → response → bot code → launch. This is the tutorial spine.
2. **GM Dashboard** — Batch list, source list, showing 500K+ markets.
3. **GM Source page** — Train, Twitch, Steam, Pump.fun batches visible.
4. **Bot running** — First trades appearing after launch.
5. **Settlement cycle** — A real 10-min batch completing: bets → oracle → PNL.

### Graphics/Animations Needed

1. **5-minute countdown timer** — Corner overlay, persistent.
2. **Promise checklist** — 3 items (liquidity, capital lock, risk management), checkmarks appear as each is addressed.
3. **Batch diagram** — 5,000 dots grid, trader arrows hitting all dots.
4. **Settlement timeline** — 10-min window → bets → close → oracle → PNL. Clean, 4-step animation.
5. **Oracle consensus** — 3 nodes, BLS aggregation visual.
6. **Parimutuel pool diagram** — YES pool vs NO pool, winners take losers' collateral.
7. **$1 vs $1M correction** — Bar chart showing max loss capped.
8. **Privacy split-screen** — Orderbook (transparent) vs sealed batch (opaque).
9. **Timeline** — 1920s → 1970s → 2026 with era icons.
10. **1 billion counter** — Spinning number animation.

### Insert Cards (Text Overlays for Unspoken Promises)

1. "$0 spread. $0 fees. $0 slippage." — Insert at ~2:10
2. "Capital lock: 10 minutes. Not days." — Insert at ~2:39
3. "Instant withdrawals after each settlement." — Insert at ~2:39
4. "Request a batch → we build it" — Insert at ~4:20

### Transcription Corrections for Subtitles

The ASR misheard several domain terms. Corrections needed:

| Timestamp | ASR Output | Correct |
|-----------|-----------|---------|
| 36:40 | "H1 manager" | "hedge fund manager" |
| 67:44 | "feel that" | "fill bets" |
| 72:08 | "unleft" | "left out" (or "unfilled") |
| 94:80 | "Trend delay batch" | "Train delay batch" |
| 96:40 | "trend station" | "train station" |
| 100:40 | "trend station" | "train station" |
| 107:76 | "trend station" | "train station" |
| 119:92 | "perimeter liquidity" | "parimutuel liquidity" |
| 126:20 | "perimeter liquidity" | "parimutuel liquidity" |
| 142:44 | "trend station" | "train station" |
| 166:20 | "all the books" | "order books" |
| 204:92 | "mot" | "moat" |
| 222:04 | "black skull model" | "Black-Scholes model" |
| 247:44 | "mod" | "moat" |
| 253:92 | "batch past sources" | "batch per source" |
| 276:88 | "CloudCon" | "Claude" |

---

## Promise Fulfillment Map

The viewer arrives expecting "5-minute bot tutorial." They get that — plus a deeper understanding of why GM works differently. Every promise from the opening must land:

```
PROMISE                    SPEECH DELIVERS    VISUAL DELIVERS
─────────────────────────  ─────────────────  ─────────────────
5-minute bot launch        ✓ Bot at 4:33      Timer overlay
Liquidity solution         ✓ FAQ #1           Batch diagram
Capital lock solution      ✗ Not said         INSERT CARD
Risk management            ~ Partial (cap)    INSERT CARD + diagram
No fees                    ✗ Not said         INSERT CARD
Instant withdrawals        ✗ Not said         INSERT CARD
Privacy                    ✓ FAQ #3           Split-screen visual
```

The insert cards are not optional. Without them, the viewer remembers the promise but not the delivery. The visual must close the loop the speech left open.
