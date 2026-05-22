# Phase 4 — Titre & miniature (the storefront, decided early)

The script does not begin until this file is finished. The title constrains the script: every paragraph must keep the promise the title makes. The thumbnail constrains the edit: the editor has to know in advance which frame to capture.

## 4a — Title

### The harder question

Not *what title best describes the video?* — that gets a description. The question is: **if I did not care about trading, what would make me click?**

The video's body is technical (basis points, MEV, PFOF). The viewer at the moment of clicking is not. The title has to be specific enough to filter for the right audience and *vague enough to invite the audience next to them*.

### Candidates

Ten variations across the forms the skill names — superlative, question, mystery, number, image, contradiction.

| # | Form | Title | Specific & inviting? | Honourable by the script? | Saturated on YouTube? |
|---|---|---|---|---|---|
| T1 | contradiction | **Your Backtest Was Right. The Venue Lied.** | Yes / strong — "lied" invites the non-trader. | Yes. The body is exactly this. | Low. The exact pair is fresh. |
| T2 | image | The Market You Backtested Doesn't Exist | Yes / philosophical — strong for the non-trader. | Yes. The dead-market thesis is on the page. | Low. |
| T3 | mystery | There's a Number That Killed Your Bot | Strong mystery + payoff. | Yes — 45 bps lands the mystery. | Low. |
| T4 | question | Why Did Your Profitable Strategy Die? | Strong for traders; weak for the indifferent viewer. | Yes. | Moderate. Question titles in this niche are common. |
| T5 | number | 45 Basis Points: Why Your Strategy Died | Specific to a fault — filters out non-traders. | Yes. | Very low — but the filter is too tight. |
| T6 | contradiction | Your Strategy Worked. Your Trade Didn't. | Strong, but reads adjacent to T1. | Yes. | Low. |
| T7 | superlative | The Biggest Lie in Quant Trading | Big claim, weak shape. | Defensible but stretched. | Heavy. Every quant channel has filmed a "biggest lie" video. |
| T8 | image | How Markets Take Your Money Before You Place the Trade | Diagnostic; accessible to a brokerage account-holder. | Yes — pre-trade extraction is the body. | Moderate. |
| T9 | image | The Hidden Tax on Every Trade You Make | Accessible, slightly bland. | Yes. | Heavy. *"Hidden tax"* is a stock construction. |
| T10 | image | Your Backtest Measured the Wrong Market | Diagnostic; strong but quieter than T1. | Yes. | Low. |

### The pick

**Final title: *Your Backtest Was Right. The Venue Lied.***

It honours the phase-3 promise without translation. The *right / lied* contradiction is the structural payoff — it tells the viewer *you didn't do anything wrong, and someone else did*, which is the restorative move the angle requires. *Backtest* signals the script's seriousness to operators. *Lied* invites the non-trader who has never heard the word *backtest*.

It is the title that survived every filter without being trimmed.

### Backup titles (for the launch-day swap window)

The skill says to keep two — phase 9 will tell us whether to swap.

**Backup 1: *The Market You Backtested Doesn't Exist.***
For the case where T1's CTR on the indifferent-viewer audience underperforms. T2 widens the door — *"the market doesn't exist"* is a philosophical hook a non-trader can hold even without knowing what a backtest is. Pair it with a thumbnail that shifts the dominant image from a chart to a vanishing object.

**Backup 2: *There's a Number That Killed Your Bot.***
For the case where the audience leans heavier crypto/quant than expected. T3 uses the number-mystery form, which retains attention for a beat longer than a contradiction. The script doesn't change; only the title does. The 45-bps stack already lives in the body — T3 simply *promises the number up front*.

Do not swap in the first 24h. Let the signal stabilise.

## 4b — Thumbnail

### The two questions

**What is the main subject in one image?** A chart that goes up and then a chart that goes down. The divergence point is the entire story.

**In what context does it live?** A dark background, an Apple-style frame, a small venue mark in the corner so the viewer reads it as *real, named, accountable* — not abstract.

Subject plus context equals the thumbnail. One focal point. No text duplicating the title.

### The thumbnail concept

**Concept A — *The diverging curves.***

Two equity curves on the same axis, sharing an origin.

- Left half: green, smooth, ascending. Label small: *backtest*.
- Right half: red, jagged, falling. Label small: *live*.
- The divergence point — where the green curve and the red curve part ways — is the visual climax. One red dot. One red arrow.
- A single venue mark in the lower-right corner — small, monochrome. Rotates between Robinhood / Coinbase / Binance / Polymarket across A/B test variants (YouTube supports three thumbnails per video natively).

The viewer reads it in 0.3 seconds: *the backtest worked, the live trade didn't*. The title says *the venue lied*. The two together are the whole promise.

Why not the alternatives:
- *The yacht* (a Sigma Chain reference) is dramatic but assumes the viewer knows what they're looking at.
- *The cards on the table* (poker / *the market can't see your hand* inverted) is evocative but harder to read at thumbnail scale.
- *The trader at the screen* with a market-maker reflected is the most cinematic but introduces a human face, which the skill rules against — *no faces* applies on the spine of the video and applies double to the storefront when the face isn't ours.

### Brief for the artist

Most channels of this scale brief a thumbnail artist at €30–120. The brief, written tight:

> **Subject:** Two equity curves on a shared axis, originating from the same point and diverging. Left curve: green, smooth, monotonically rising. Right curve: red, jagged, descending. The divergence point is the visual centre — mark it with one small red dot and one short red arrow indicating the separation.
>
> **Context:** Dark background (near-black, not pure black — Apple uses `#1D1D1F` for text; here use a comparable dark surface, never `#000000`). Apple-style typography for the small labels *backtest* and *live*. A single small venue mark in the lower-right corner — provide three variants (Robinhood / Coinbase / Binance logos in monochrome white).
>
> **Mood:** Diagnostic, not angry. The viewer is being shown a fact. The composition is quiet; the red is the only loud element.
>
> **References:**
> - Veritasium's *How Are Microchips Made* thumbnail — clean object on dark background, single focal point, one element in red.
> - The page's own *VenueBleedSection* visual language at `frontend/app/[locale]/(marketing)/anticheat-flags/VenueBleedSection.tsx` — bar shapes, restrained palette, tabular numerals.
>
> **Red placement:** the divergence point only. No red on the background, no red on the typography, no red on the venue mark. One small dot, one short arrow.
>
> **Text on the thumbnail:** None duplicating the title. The two small in-frame labels *backtest* and *live* are the only text; they exist because the curves need to be readable, not because the title needs reinforcement.
>
> **Aspect:** 1280×720, 16:9. The divergence point lives at roughly the rule-of-thirds intersection, lower-right quadrant.

### Hero-shot plans the editor must capture in phase 7

The thumbnail needs a still or a frame to work from. The editor captures these *deliberately*, even if they don't appear in the final cut:

1. **The diverging chart pair.** Build it once in After Effects or as a clean Remotion frame — green curve ascending, red curve descending, shared origin, divergence point marked. Render at 4K and export a single still frame as the thumbnail source. Use it on screen at the moment the script says *the gap between a profitable backtest and a losing live trade has a name*.
2. **The receipt-card close-up.** A clean Apple-style card showing one venue's *knife* line in display typography, source label below, no chrome. Build six of these — one per mechanism — using the same template. The thumbnail artist can fall back to one of these if Concept A's divergence chart doesn't land in tests.
3. **The 45-bps stack.** A vertical bar chart stacking PFOF (17) + b-book (15) + VIP gap (11) + visibility (2) to a labeled 45-bps total. The number that anchors the body. Available as both an animated reveal (for the script's *here is the total* beat) and a single still frame (for the thumbnail backup).

The skill rule applies: capture these frames as if the thumbnail will need them, because it will.

## Checkpoint

If a stranger walked past this on their feed — title and thumbnail together — would they stop?

The carry-forward law for phases 5 through 8 is now written. The script must honour *Your Backtest Was Right. The Venue Lied.* in its first sixty seconds. The editor must capture the three hero shots above. The mix must hit the diagnostic mood, not the angry one.
