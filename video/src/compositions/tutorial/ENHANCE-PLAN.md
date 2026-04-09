# Tutorial Video — Enhancement Plan (Round 2)

## Problems to Fix
1. **Not enough visuals** — need 3x more text on screen
2. **Animations not synced with voice** — use word-level timestamps from transcriptData.ts
3. **Frontend style not respected** — must match /sources/ page: white bg, black stats bar, uppercase micro labels, tabular-nums, SpringCard, source brand colors, live dot indicators
4. **WebGL effects underused** — integrate OpeningSequence, LetterDecorations, TextHighlight patterns

## Design Language from Frontend /sources/

### Stats Bar Pattern (from SourcesGrid)
Black bg, white text. Stacked: micro label on top (uppercase, 0.08em tracking, 70% opacity), stat value below (font-black, font-mono, tabular-nums). Multiple stats in a row.
```
SOURCES          ASSETS          CATEGORIES
47               512,000         14
```

### Source Card Pattern (from SourceCard)
- Brand color hero area (aspect-video, full-width, logo centered)
- Category badge: glass pill, uppercase, top-right
- Live dot: green ping animation
- Metrics row: 4-column grid with border-t, micro labels + bold values
- White bg, border-r border-b border-border-light

### Typography
- Display: font-black, letter-spacing -0.035em
- Labels: 0.6875rem, font-semibold, uppercase, tracking 0.08em, color #999
- Stat values: 2rem, font-black, tracking -0.03em, tabular-nums
- Mono: JetBrains Mono for all numbers

### Colors (CSS vars)
- Background: #FFFFFF (white mode overlays)
- Foreground: #1A1A1A
- Surface: #F4F6F5
- Border: #E0E0E0
- Up: #16A34A (green)
- Down: #DC2626 (red)
- Brand: #00A36C

## WebGL Effects to Port

### OpeningSequence (at 3:20 in WebGLPicks)
Black bg, white Dosis 200 uppercase. Letters rotate from Y-90deg, converging letter-spacing, glowing text-shadow, then drift toward camera and fade.
**Use for**: Key dramatic phrases ("No orderbook. No price.", "QUANTITY > QUALITY", "New instrument = clean slate")

### LetterDecorations (at 2:50)
Geometric shapes (circles, rects, polygons) decorating each letter. Shapes scatter outward on reveal.
**Use for**: FAQ section titles (the Q cards)

### TextHighlight (at 2:42)
Progressive word highlight as if being read. Words go from dim to bright sequentially.
**Use for**: Key explanation sentences synced to voice

### ScrollSnap (at 2:14)
3D spatial grid zooming through items. Each item is a text label.
**Use for**: Market categories display, source list

## Voice Sync Strategy

Every key phrase gets a text overlay TIMED TO THE EXACT WORD. Use `transcriptData.ts` word timestamps.

Example: When speaker says "liquidity" at 15.92s, the word "LIQUIDITY" should appear on screen at frame Math.round(15.92 * 30) = 478.

### Key phrases to overlay (with approximate timestamps from transcript):
- "prediction market" (12.68s) — bold label
- "liquidity" (15.92s) — bold + checkmark icon
- "capital lock" (16.96s) — bold label
- "risk management" (17.76s) — bold label  
- "500,000 markets" (53.76s) — big animated number
- "5,000 Twitch streamers" (60.16s) — stat with icon
- "10 minutes" (66.08s, 93.04s, 109.12s) — clock icon + number
- "no submarket is left" (73.12s) — bold text
- "30 train station" (97.92s) — animated number
- "yes or no" (108.48s) — split label
- "10 minute window" (109.12s) — timeline marker
- "Oracle" (116.96s, 121.12s) — icon + label
- "no price" (128.48s) — strike-through effect
- "parimutuel" (132.80s) — definition tooltip
- "$1" vs "$1 million" (154.56s, 155.76s) — dramatic number comparison
- "private" (163.36s) — lock icon
- "1 billion" (175.04s, 266.08s) — massive counter
- "moat" (204.08s) — highlighted text
- "1920s" (217.52s), "1970s" (222.64s), "2026" (228.16s) — era markers
- "Train" (255.52s), "Twitch" (256.24s), "Steam" (257.28s) — source badges

---

## Agent Assignments

### AGENT 1: VoiceSyncKeywords.tsx — Key phrase overlays synced to voice
Floating keyword overlays that appear EXACTLY when the speaker says them. 25+ keywords.
Each keyword: spring-in, hold 2-3s, fade out. Bold, uppercase, positioned around the screen (not center — use margins to avoid face).

### AGENT 2: StatsBarOverlays.tsx — Frontend-style stats bars
Black bar overlays that appear during number-heavy sections:
- At 53.76s: "500,000 MARKETS" stats bar
- At 60.16s: "5,000 STREAMERS | 10 MIN SETTLEMENT | PARIMUTUEL" 
- At 97.92s: "30 STATIONS | 10 MIN WINDOW | 30x COMPUTATION"
- At 266.08s: "1,000,000,000 PARALLEL MARKETS"
Replicate exact frontend pattern: micro label + stat value, font-mono tabular-nums

### AGENT 3: SourceCardOverlays.tsx — Replicate frontend SourceCard design
At 253.92s-260.00s (source badges section), replace simple pills with actual SourceCard-style cards:
- Brand color hero with logo
- Live dot animation
- Metrics row (markets count, type, settlement status)
- Stagger entrance like frontend cascade

### AGENT 4: OpeningSequenceText.tsx — Cinematic text for key phrases
Port the OpeningSequence effect (letter rotateY, converging spacing, glow, drift). Use for:
- "No orderbook. No price. Result at settlement." (126.20s)
- "QUANTITY > QUALITY" (212.12s) 
- "General Market" end card text (280.80s)

### AGENT 5: LetterDecorationsTitle.tsx — Decorated FAQ titles
Port LetterDecorations effect for FAQ question cards. Replace plain text Q cards with decorated letters + geometric shapes. Apply to all 5 FAQ titles.

### AGENT 6: TextHighlightSync.tsx — Progressive text highlight synced to voice
Port TextHighlight effect. Show full sentences on screen, words progressively highlight from dim to bright as the speaker says them. Use for key explanation paragraphs:
- "For each submarket, if traders who bet yes did win..." (135.72s)
- "The moat is not anymore how good you are..." (204.92s)
- "Every instrument that is in the order book..." (241.52s)

### AGENT 7: EnhancedSettlement.tsx — More visual density in settlement section
Add to existing SettlementTimeline:
- Animated clock icon during "10 minute window"
- Pulsing "YES" / "NO" labels during betting explanation
- Oracle node labels ("Oracle 1", "Oracle 2", "Oracle 3") with connection animation
- "$0" numbers that SLAM in (use text-slam SFX timing)
- More text: "SEALED BETS", "CONSENSUS", "INSTANT PAYOUT" appearing at key moments

### AGENT 8: EnhancedPrivacy.tsx — More visual density in privacy section  
Add to existing PrivacySplit:
- Lock icon animation when "private" is said
- "COPY TRADERS BLOCKED" stamp effect
- More comparison rows in the table
- Animated "no disputes" checkmark
- "INSTANT SETTLEMENT" counter showing 10:00 → 0:00

### AGENT 9: EnhancedMoat.tsx — More visual density in moat section
Add to existing MoatTimeline:
- "ALL MARKETS" text explosion (LetterDecorations style)
- Counter: "100 positions/day" crossed out → "10,000,000 positions/day" green
- More text during hedge fund comparison
- "NEW FINANCIAL INSTRUMENT" cinematic reveal

### AGENT 10: WhiteModeOverlays.tsx — Frontend white-mode visual panels
Periodic white-bg panels matching the frontend aesthetic:
- White card popups showing actual UI mockups (source grid, batch config)
- Category pills animation (matching CategoryNav component)
- Metrics grids in white with border patterns
- Use at transition points between FAQ sections

---

## File Structure (new files only — existing files get enhanced)
```
src/compositions/tutorial/
  overlays/
    VoiceSyncKeywords.tsx    ← Agent 1
    StatsBarOverlays.tsx     ← Agent 2
    SourceCardOverlays.tsx   ← Agent 3
    OpeningSequenceText.tsx  ← Agent 4
    LetterDecorationsTitle.tsx ← Agent 5
    TextHighlightSync.tsx    ← Agent 6
    EnhancedSettlement.tsx   ← Agent 7
    EnhancedPrivacy.tsx      ← Agent 8
    EnhancedMoat.tsx         ← Agent 9
    WhiteModeOverlays.tsx    ← Agent 10
```

Each overlay is a NEW layer added to TutorialVideo.tsx — they don't replace existing scenes, they add ON TOP.

## Integration
After all agents complete, TutorialVideo.tsx must be updated to include all 10 new overlay Sequences.
