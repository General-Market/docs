# Tutorial Video — Master Build Plan

## Video Specs
- **Source**: `public/tutorial-raw.mp4` (1920x1080, 25fps, 282.88s)
- **Composition**: 30fps, 1920x1080, 8487 frames (282.88s * 30)
- **Composition ID**: `Tutorial`
- **Base path**: `src/compositions/tutorial/`

## Frame Conversion
Source video is 25fps. Remotion composition is 30fps. All timestamps below are in SECONDS.
To convert seconds to Remotion frames: `Math.round(seconds * 30)`.
The `<Video>` component handles framerate mismatch natively.

## Design System
- **Background**: Source video fills frame. Overlays on top.
- **Colors**: Import from `../../common/colors` → `C.black` (#0a0a0a), `C.white` (#fafafa), `C.accent` (#6366f1)
- **Brand green**: `#00C853` (from GeneralMarket theme) — use for GM-specific elements
- **Brand**: `#00A36C` (from frontend CSS)
- **Font sans**: Import `font` from `../../common/fonts` (Inter)
- **Font mono**: Import `monoFont` from `../../common/fonts` (JetBrains Mono)
- **Easing**: Import `EASE` from `../../common/easing`
- **Utility**: Import `lerp` from `../../common/utils`
- **Reusable from GeneralMarket**: Can import TextTrailTitle, Counter, SvgWipe from `../general-market/components/`

## Overlay Architecture
All overlays are **transparent layers** over the source video. The main composition stacks:
1. `<Video>` — source talking head (bottom)
2. `<Sequence>` per overlay — each overlay knows when to appear/disappear
3. Overlays use semi-transparent dark panels (`rgba(10,10,10,0.85)`) for readability
4. Lower-third style for text cards, full-screen for diagrams

## SFX Whitelist
Only use these SFX (all in `public/sfx/`):
```
text-slam-bold.mp3        — title cards, bold statements
text-snap-in.mp3          — bullet points, list items appearing  
whoosh-fast.mp3            — quick transitions
whoosh-scene-dark.mp3      — scene/topic changes
beep-confirm.mp3           — checklist checkmarks
ui-success-chime.mp3       — promise fulfilled
data-tick-count.mp3        — counter/timer ticks
typing-mechanical-soft.mp3 — Claude Code terminal typing
code-compile-success.mp3   — bot ready moment
riser-short-tension.mp3    — before key reveals
transition-slide-in.mp3    — FAQ card slides
text-digital-pop.mp3       — numbers appearing
impact-deep.mp3            — key impactful statements
shimmer-bright.mp3         — insert cards appearing
stock-ticker.mp3           — financial data context
```

## Transcript Corrections
These ASR errors MUST be fixed in any displayed text:
| ASR Output | Correct |
|-----------|---------|
| "H1 manager" | "hedge fund manager" |
| "feel that" | "fill bets" |
| "unleft" | "left out" |
| "Trend/trend station" | "Train/train station" |
| "perimeter liquidity" | "parimutuel liquidity" |
| "black skull model" | "Black-Scholes model" |
| "mot" / "mod" | "moat" |
| "batch past sources" | "batch per source" |
| "CloudCon" | "Claude" |

---

## Agent Assignments

### AGENT 1: Skeleton + Theme (`theme.ts`, `TutorialVideo.tsx`, Root.tsx update)
**Files**: `theme.ts`, `TutorialVideo.tsx`
**Also**: Update `../../Root.tsx` to register the Tutorial composition

`theme.ts` defines:
- FPS=30, total frames=8487
- Color tokens (reuse C + brand green)
- Section timing as start/end seconds (not frames — let each scene convert)
- Sections enum

`TutorialVideo.tsx`:
- `<AbsoluteFill>` with `<Video src={staticFile("tutorial-raw.mp4")}>`
- Sequence for each overlay layer by time range
- Imports all scene components (stub with empty divs initially — other agents fill them)

### AGENT 2: Animated Subtitles (`SubtitleLayer.tsx`)
**Files**: `SubtitleLayer.tsx`
**Data**: Read `/Users/maxguillabert/Downloads/index/transcript-remotion.json`

Word-synced animated subtitles displayed in lower third. Two lines max.
- Each word highlights as spoken (white text, current word bold + slightly larger or colored)
- Dark semi-transparent pill behind text (`rgba(0,0,0,0.7)`, rounded)
- Position: bottom center, ~120px from bottom
- Font: Inter 600, 32px. Current word: 36px bold white. Past words: white 80% opacity.
- Apply transcript corrections from table above
- Words animate in with subtle scale spring
- Max ~12 words visible at once, scroll as new words arrive

### AGENT 3: ACT 1 — Hook Overlays (`HookOverlays.tsx`)
**Time**: 0.00s–42.80s (frames 0–1284)
**Files**: `scenes/HookOverlays.tsx`

Elements:
1. **Title card** (0.16s–3.44s): "How to Launch Your First General Market Bot in 5 Minutes" — bold, center screen, fade in/out. Use TextTrailTitle style.
2. **Countdown timer** (0.16s–282.88s): Persistent top-right corner. 5:00 counting down. Small, monospace, subtle. Disappears or shows "DONE" when bot is ready (~273s).
3. **Promise bullets** (11.28s–22.24s): As speaker says "liquidity, capital lock, risk management" — each bullet slides in from left:
   - [ ] Liquidity
   - [ ] Capital Lock  
   - [ ] Risk Management
   These appear, hold 3s, then fade. They'll get checkmarks later via PromiseChecklist agent.
4. **Audience label** (36.40s–41.76s): Bottom center, two labels side by side: "Beginner" | "Fund Manager" — both with subtle underline.
5. **"Let's start"** (41.76s–42.80s): Quick flash overlay.

SFX: `text-slam-bold.mp3` on title, `text-snap-in.mp3` on each bullet, `whoosh-fast.mp3` on "let's start"

### AGENT 4: ACT 2 — Claude Terminal (`ClaudeTerminal.tsx`)
**Time**: 42.80s–57.76s (frames 1284–1733)
**Files**: `scenes/ClaudeTerminal.tsx`

A mock Claude Code terminal that appears as a lower-third overlay (bottom 40% of screen, or right side panel).
1. (42.80s) Terminal slides in from right. Dark bg (#0a0a0a), green prompt.
2. Typing animation: `$ claude "Build me a bot about Twitch viewer strategy for generalmarket.io"`
3. Claude response starts appearing: streaming text effect showing code/strategy output
4. (48.64s) Transition card overlays: "While the bot builds..." in center, then fades
5. Terminal shrinks to small indicator in corner (stays visible, "building..." animation)

SFX: `typing-mechanical-soft.mp3` during typing, `transition-slide-in.mp3` on "while bot builds"

### AGENT 5: FAQ 1 — Liquidity (`LiquidityDiagram.tsx`)
**Time**: 48.64s–89.84s (frames 1459–2695)
**Files**: `scenes/LiquidityDiagram.tsx`

1. **Q card** (48.64s): "How does GM ensure liquidity on 500K markets?" — lower third, bold text on dark panel
2. **Batch grid** (57.76s–76.72s): Grid of dots representing 5000 streamers. Animate: all dots light up simultaneously (not one by one). Arrows from "TRADER" label to ALL dots. Contrast: traditional = arrow to 1 dot.
3. **"Mandatory fill"** label (67.44s): Text overlay: "Mandatory fill = guaranteed liquidity"
4. **Fade out** (84.80s): Grid fades, Q card fades

Style: Use dark panel (85% opacity) for the diagram area. Dots are small circles. GM green for active, grey for traditional.
SFX: `whoosh-scene-dark.mp3` on Q card, `data-tick-count.mp3` as dots light up, `beep-confirm.mp3` on "mandatory fill"

### AGENT 6: FAQ 2 — Settlement + Parimutuel (`SettlementTimeline.tsx`)  
**Time**: 89.84s–161.40s (frames 2695–4842)
**Files**: `scenes/SettlementTimeline.tsx`

This is the longest and most important section. Multiple sub-animations:

1. **Q card** (89.84s): "How does pricing work with 10-minute settlements?"
2. **Timeline animation** (96.40s–120.36s): Horizontal bar showing 10-min cycle:
   - Phase 1: "BETTING WINDOW" — bets flow in (arrows entering from top)
   - Phase 2: "SETTLEMENT" — window closes, 3 oracle nodes appear, reach consensus
   - Phase 3: "RESULTS" — PNL numbers appear
3. **"No price" reveal** (126.20s): Big text: "No orderbook. No price. Result at settlement."
4. **INSERT: "$0 spread. $0 fees."** (131.48s): Shimmer card, holds 4s
5. **Parimutuel diagram** (135.72s–150.44s): Two pools (YES / NO). Losers' collateral flows to winners. Simple arrow animation. "x30 markets" label. Sum = PNL.
6. **$1 vs $1M bars** (151.88s–159.72s): Two bars, one tiny one massive. Arrow shows max loss capped. Label: "Built-in risk cap."
7. **INSERT: "Capital lock: 10 minutes."** (159.72s): Card appears below the bars.
8. **INSERT: "Instant withdrawals after settlement."** (159.72s): Second line on same card.

SFX: `whoosh-scene-dark.mp3` on Q, `riser-short-tension.mp3` before "no price", `shimmer-bright.mp3` on insert cards, `impact-deep.mp3` on "$0 fees", `text-digital-pop.mp3` on pool numbers

### AGENT 7: FAQ 3 — Privacy (`PrivacySplit.tsx`)
**Time**: 161.40s–194.04s (frames 4842–5821)
**Files**: `scenes/PrivacySplit.tsx`

1. **Q card** (161.40s): "How is General Market private?"
2. **Split comparison** (166.20s–172.84s): Left panel = "TRADITIONAL" (visible orderbook lines, "COPY TRADERS CAN SEE"), Right panel = "GENERAL MARKET" (sealed/blurred, "BETS SEALED UNTIL SETTLEMENT"). Use red/green contrast.
3. **Oracle network** (172.84s–181.16s): 3 connected nodes, BLS signature lines, "Specialized Oracle" label. Simple but professional.
4. **Comparison table** (181.16s–194.04s): Two rows appearing:
   - Traditional: "Days to settle | Disputes possible | Public trades"
   - GM: "10 min settle | No disputes | Private bets"

SFX: `transition-slide-in.mp3` on split, `data-sync.mp3` on oracle nodes, `beep-confirm.mp3` on GM column checkmarks

### AGENT 8: FAQ 4 — Moat + Era Timeline (`MoatTimeline.tsx`)
**Time**: 194.04s–247.44s (frames 5821–7423)
**Files**: `scenes/MoatTimeline.tsx`

1. **Q card** (194.04s): "How do I find an edge when I must trade everything?"
2. **Paradigm text** (204.92s): "Not one market. All markets." — big text, fade transition
3. **"QUANTITY > QUALITY"** (212.12s): Bold overlay, hold 3s
4. **Era timeline** (216.84s–230.32s): Horizontal timeline with 3 markers:
   - 1920s: "Technical Analysis" (chart icon)
   - 1970s: "Black-Scholes" (formula icon)  
   - 2026: "General Market" (GM logo/icon, highlighted green)
   Each era slides in left to right with stagger.
5. **"New instrument = clean slate"** (230.32s–241.52s): Text overlay reinforcing the point
6. **Hedge fund contrast** (241.52s): "Billions in hedge funds competing on old instruments. Here: no one has an edge yet."

SFX: `text-slam-bold.mp3` on QUANTITY>QUALITY, `whoosh-fast.mp3` on each era appearing, `impact-deep.mp3` on "2026"

### AGENT 9: FAQ 5 + Closing (`SourcesClosing.tsx`)
**Time**: 247.44s–282.88s (frames 7423–8487)
**Files**: `scenes/SourcesClosing.tsx`

1. **Q card** (247.44s): "Do I need to bet on every market?"
2. **Source cards** (253.92s–260.00s): Horizontal row of source badges: "Train" "Twitch" "Steam" "Pump.fun" — each lights up as mentioned. Shows "one batch per source" concept.
3. **"Request a batch"** (260.16s): Insert card: "Need a specific batch? Ask. We build it."
4. **1 Billion counter** (264.88s): Counter component spinning up to 1,000,000,000. Label: "parallel markets"
5. **Bot ready** (270.96s–276.88s): Terminal indicator flashes green "STRATEGY READY". Countdown timer shows completion.
6. **End card** (276.88s–282.88s): 
   - Promise checklist: all 3 items checked (Liquidity, Capital Lock, Risk Management)
   - "General Market" logo centered
   - URL: generalmarket.io
   - Fade to black

SFX: `text-snap-in.mp3` on source badges, `shimmer-bright.mp3` on "request a batch", `data-tick-count.mp3` on counter, `code-compile-success.mp3` on bot ready, `ui-success-chime.mp3` on all promises checked, `logo-shimmer-resolve.mp3` on end card

### AGENT 10: Promise Checklist Persistent (`PromiseChecklist.tsx`)
**Time**: Appears at multiple points throughout the video
**Files**: `scenes/PromiseChecklist.tsx`

A floating checklist that appears in the top-left corner at key moments:

| Item | Appears (unchecked) | Gets checked |
|------|-------------------|--------------|
| Liquidity | 11.28s | 76.72s (after "mandatory fill") |
| Capital Lock | 11.28s | 159.72s (after "10 minutes not days") |
| Risk Management | 11.28s | 159.72s (after "$1 vs $1M cap") |

Behavior:
- First appearance (11.28s): 3 items slide in unchecked, hold 4s, fade out
- At each check moment: checklist briefly reappears, item gets checkmark (green), hold 2s, fade
- Final appearance (276.88s): All 3 checked, hold until end

Style: Small panel, top-left, dark bg, white text, green checkmarks. Monospace font.
SFX: `beep-confirm.mp3` on each checkmark

---

## File Structure
```
src/compositions/tutorial/
  PLAN.md              ← this file
  theme.ts             ← Agent 1
  TutorialVideo.tsx    ← Agent 1 (main composition)
  SubtitleLayer.tsx    ← Agent 2
  scenes/
    HookOverlays.tsx   ← Agent 3
    ClaudeTerminal.tsx ← Agent 4
    LiquidityDiagram.tsx ← Agent 5
    SettlementTimeline.tsx ← Agent 6
    PrivacySplit.tsx    ← Agent 7
    MoatTimeline.tsx   ← Agent 8
    SourcesClosing.tsx ← Agent 9
    PromiseChecklist.tsx ← Agent 10
```

## Autoresearch Protocol (3 rounds per agent)
Each agent MUST:
1. **Round 1**: Build the component. Get it compiling. Verify types with `cd /Users/maxguillabert/Downloads/index/video && npx tsc --noEmit`.
2. **Round 2**: Review against this plan. Check: timing matches? All elements present? SFX from whitelist only? Corrections applied? Animations smooth (springs, easing)?
3. **Round 3**: Polish. Add micro-animations (subtle scale springs on text, smooth opacity transitions). Ensure all `interpolate` calls use `extrapolateLeft/Right: "clamp"`. Check font consistency. Run tsc again.
