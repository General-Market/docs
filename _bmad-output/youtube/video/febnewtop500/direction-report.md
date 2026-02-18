# Direction Report — Feb New Top 500 (v3 — finance-clean)

## Shot Summary — 12 shots, 57.1s

| # | Section | Dur | BG | Chibi | Transition | Music |
|---|---------|-----|----|-------|------------|-------|
| 1 | HOOK — "7 top 500..." | 6.1s | Collage: 7 websites | confident/bounce | whip | playing |
| 2 | ZAMA — "institutional play" | 3.7s | Zama homepage | teaching/snap | whip | playing |
| 3 | ZAMA — "5 TPS, slow" | 6.4s | Zama product page | shrug/tilt | cut | playing |
| 4 | STABLECOINS — "keep creating..." | 4.1s | Dark + 4 tickers | tired/shake | whip | ducked |
| 5 | BITLAYER — "shady" | 5.4s | Bitlayer homepage | confused/wobble | whip | building |
| 6 | DEFI LLAMA — "nope" | 3.7s | defillama_bitlayer.png | shrug/shake | cut | ducked |
| 7 | AZTEC — "based community" | 4.5s | Aztec homepage | proud/bounce | whip | playing |
| 8 | AZTEC — "go to events" | 3.5s | Aztec event photos | proud/heartbeat | cut | playing |
| 9 | AZTEC — "a16z, hard" | 3.5s | Aztec docs page | thinking/tilt | cut | building |
| 10 | AZTEC — "no mainnet" | 4.6s | Aztec GitHub/Twitter | scared/wobble | cut | building |
| 11 | GMRT — "red flag" | 5.0s | GMRT homepage | scared/shake | whip | bass-drop |
| 12 | 9BIT — "I don't like—" | 3.8s | 9bit homepage | tired/dim | cut | SILENCE |

## Changes from v2 (finance-clean pass)

**Removed (gaming/memey):**
- Emoji rain (Shot 11 — red flags)
- Screen shake (Shots 5, 11)
- Flash (Shot 11)
- Screen break (Shot 12)
- Glitch VFX (Shot 5)
- fullScreenZoom (Shots 1, 6)

**SFX stripped to 3 total:**
- Shot 1: cinematic whoosh intro
- Shot 7: clean rising whoosh (Aztec positive shift)
- Shot 11: clean low impact on "red flag"
- Everything else: silence (no record scratch, womp womp, alarm buzzer, sparkle chime, warning chime, negative buzzer)

**Entrance VFX unified:**
- All `speed-lines` and `glow-ring` → `dust` (every shot now uses dust only)

**Glow reduced — data points only:**
- Glow ON: "7" (hook), "5 TPS" (metric), "shady" (verdict), "nope" (verdict), "Aztec" (featured), "events" (CTA), "a16z" (backer), "mainnet" (key concern), "red flag" (verdict)
- Glow OFF: "500", "institutional", "slow", "stablecoins", "Bitlayer", "GMRT", "based", "hard", "careful", "like—", "seriously"

**Background descriptions cleaned:**
- Switched from verbose `[DESCRIBE: ...]` to terse `[ASSET: id — one-line note]`
- Red tint on GMRT (Shot 11) → neutral dark `#0A0A0A`

## Pacing (unchanged)

- **Avg shot:** 4.8s
- **Longest:** Shot 3 at 6.4s (Zama detail)
- **Shortest:** Shot 8 at 3.5s (Aztec events)
- **No shot over 6.5s**

## Music Arc (unchanged)

```
Shot:  1    2    3    4    5    6    7    8    9    10   11   12
State: play play play duck build duck play play build build drop SILENCE
```

## SFX Budget

| Shot | SFX | Why |
|------|-----|-----|
| 1 | Cinematic whoosh | Hook entrance energy |
| 7 | Rising whoosh | Tone shift: negative → positive (Aztec) |
| 11 | Low impact | Punctuate "red flag" verdict |
| 12 | — | Hard cut to silence IS the sound design |

3 SFX total. Clean, intentional. No stacked effects.

## Assets Required

| Asset ID | Shot | Description |
|----------|------|-------------|
| hook_collage | 1 | 7 website screenshots in collage around chibi |
| zama_homepage | 2 | Zama website homepage |
| zama_product | 3 | Zama technology/product page |
| — (solid dark) | 4 | No asset needed, dark BG + ticker callouts |
| bitlayer_homepage | 5 | Bitlayer website homepage |
| defillama_bitlayer.png | 6 | DeFi Llama TVL chart (provided) |
| aztec_homepage | 7 | Aztec Network website homepage |
| aztec_events | 8 | Aztec developer meetup / conference photos |
| aztec_docs | 9 | Aztec developer docs page |
| aztec_github | 10 | Aztec GitHub repo or Twitter/X timeline |
| gmrt_homepage | 11 | GMRT website homepage |
| 9bit_homepage | 12 | The9bit website homepage |
