# YC Launch Analysis — Complete Findings

**Dataset:** 2,696 YC launches across 22 batches (Winter 2012 – Spring 2026). 1,388 with video, 1,004 with transcripts. Vote range: 0–3,068. Median: 36. Mean: 83.5.

**Purpose:** Extract every measurable pattern that separates launches that resonate from launches that dissolve. Build a playbook.

---

## Executive Summary — The 12 Things That Actually Matter

| # | Finding | Effect Size | Actionability |
|---|---------|------------|---------------|
| 1 | **Short title + emoji + social proof = 4.1x votes** | Best 3-feature combo in dataset | High |
| 2 | **Optimal video: under 60 seconds** (100–150 words) | Median peaks at 37 votes in this bucket | High |
| 3 | **Body text sweet spot: 400–750 words / 3k–5k chars** | Median 42–45 vs 30 for short posts | High |
| 4 | **Front-load metrics in the first 25% of text** | +46 mean votes vs last-25% placement | High |
| 5 | **Two metrics saturate the benefit** — three adds nothing | Median 41 at 2 metrics, flat after | High |
| 6 | **Dash beats colon in titles** | "Company - X" median 41 vs "Company: X" median 33 | High |
| 7 | **One emoji in title = +36% median votes** | Median 46 vs 33 | High |
| 8 | **Waitlist CTA = +24 median votes** | Scarcity > generosity | Medium |
| 9 | **"Free", "no credit card", "% off" all hurt** | Median drops 8–13 points | Medium |
| 10 | **Launch early in the batch cycle** | Early Q1 outperforms late Q4 by 15–48 votes | Medium |
| 11 | **"Disruptive", "next-gen", "game-changing" = penalty** | Avg 21–32 votes vs 84 baseline | Medium |
| 12 | **Video doesn't help. Writing does.** | No-video + long body: median 44. Video + short body: 31 | Structural |

---

## 1. Opening Hooks

**Dataset:** 1,004 transcripts.

### Hook Category Performance

| Category | n | Avg Votes | Median Votes |
|---|---|---|---|
| **Product statement** | 46 | **133.6** | **47.5** |
| Question | 55 | 90.0 | 42.0 |
| Demo instruction | 33 | 70.4 | 48.0 |
| Stat / number | 144 | 73.2 | 31.5 |
| Pain point | 99 | 70.9 | 34.0 |
| Founder story | 10 | 68.1 | 63.0 |
| Bold claim | 59 | 46.8 | 35.0 |
| Greeting / intro | 110 | 54.5 | 26.5 |

Product statements lead on average. Demo instructions and founder stories lead on median — more consistent, less volatile. Greetings ("Hi, I'm X from Y") are the most predictable path to mediocrity.

### Top 5 Highest-Voted Openers

1. **3,068 votes** — *"I never want to talk to tenants again."* (Brickwise)
2. **2,188 votes** — *"I'm talking about better off."* (Better Auth)
3. **1,835 votes** — *"This is a biologic medication."* (Ruma Care)
4. **1,370 votes** — *"Your greatest revenue opportunity is hiding in plain sight."* (Menza)
5. **1,116 votes** — *"Mat. Hey."* (Scalar Field)

The best opener in the dataset is a one-sentence expression of exhaustion. No pitch, no product name. Just a person who doesn't want to deal with tenants.

### First-Person vs. Third-Person

| Voice | n | Avg Votes | Median Votes |
|---|---|---|---|
| First-person (I/We/My/Our) | 66 | **156.0** | **41.0** |
| Third-person / other | 938 | 76.5 | 34.0 |

2x average, 1.2x median. Starting with "I" or "We" correlates with more votes.

### Negative Opener Words

| Word | n | Avg Votes |
|---|---|---|
| `broken` | 15 | **125.9** |
| `tired` | 7 | 96.7 |
| `hate` | 17 | 94.1 |
| `problem` | 47 | 57.1 |

"Broken" and "tired" pull far above average. "Problem" — the most-used negative word — performs worst. The word "problem" has been laundered into noise by overuse.

### Opening Sentence Length

| Length | n | Avg Votes |
|---|---|---|
| Short (≤10 words) | 416 | **98.3** |
| Long (>10 words) | 588 | 70.0 |

Brevity doesn't guarantee performance — but it correlates with the ceiling being higher.

---

## 2. Transcript Length

### Word Count Buckets

| Bucket (words) | Est. Duration | Count | Avg Votes | Median Votes |
|---|---|---|---|---|
| 0–50 | ~10s | 113 | 87.8 | 34 |
| 50–100 | ~30s | 80 | 99.1 | 34 |
| **100–150** | **~50s** | **150** | **85.0** | **37** |
| 150–200 | ~1.2 min | 158 | 113.6 | 36 |
| 200–300 | ~1.7 min | 229 | 65.1 | 30 |
| 300–500 | ~2.7 min | 164 | 63.1 | 34 |
| 1000+ | ~14 min | 18 | 38.9 | 23 |

**Optimal video length: 40–60 seconds** (100–150 words at 150 wpm). Cross the 200-word mark and median votes fall. Past 1,000 words: 23.

---

## 3. Body Text Length

### Word Count Sweet Spot

| Bucket | Count | Avg Votes | Median Votes |
|---|---|---|---|
| 0–100 | 18 | 64.5 | 17.0 |
| 200–300 | 556 | 66.4 | 30.0 |
| 300–400 | 813 | 82.7 | 37.0 |
| 400–500 | 588 | 85.7 | 40.0 |
| **500–750** | **474** | **111.3** | **45.0** |
| 750–1000 | 71 | 100.1 | 27.0 |

The curve rises steadily to 500–750 words, then collapses. Beyond 750, the post becomes an essay, and essays are skipped.

### The 2x2 Matrix — Video x Body Length

| | Long body (≥2,401 chars) | Short body (<2,401 chars) |
|---|---|---|
| **Video** | median=37, mean=93 | median=31, mean=70 |
| **No-video** | **median=44**, **mean=98** | median=33, mean=73 |

The best-performing cohort wrote well and skipped the video. The worst made a video and wrote little.

---

## 4. Linguistic Patterns

### Reading Level & Complexity

Every complexity metric — reading level, syllable density, word diversity, sentence length — shows near-zero correlation with votes in body text. The market reads everything and rewards nothing linguistic in particular.

**The one exception:** founders who speak in shorter sentences in video transcripts correlate with higher votes (r = −0.10 on log scale). The only reliable linguistic finding in the dataset.

### Pronoun Strategy

| Bucket | n | Median Votes |
|---|---|---|
| mostly-we (>60% we) | 1,236 | 36 |
| balanced (40–60%) | 866 | **38** |
| mostly-you (<40% we) | 594 | 32 |

Balanced framing wins. Heavy "you" language underperforms.

### Hedge Words — The Surprise

| Group | n | Median Votes |
|---|---|---|
| 0 hedge words | 2,002 | 34 |
| 1+ hedge words | 694 | **41** |

**Spearman r = +0.173** — the strongest signal in the linguistic analysis. Almost certainly a confound: hedge words co-occur with longer, more nuanced bodies. But the correlation is real.

### Confidence Words

**Zero signal.** "Will", "does", "always", "guaranteed", "proven" — the correlation is −0.013. Confidence words are inert.

---

## 5. Title Patterns

### Structure

| Structure | Count | Median Votes |
|---|---|---|
| **Company - Description** | 1,125 | **41** |
| Company: Description | 874 | 33 |
| Just Description | 215 | 34 |
| Topic: Description | 200 | 27 |

Dash beats colon by 8 median votes. Consistent, reproducible, free.

### Emoji in Title

| | Count | Median Votes |
|---|---|---|
| With emoji | 786 | **46** |
| Without emoji | 1,910 | 33 |

+36% higher median. One emoji is optimal. Two is acceptable. Three collapses.

### Numbers in Title

| | Count | Median Votes |
|---|---|---|
| Has number | 131 | 28 |
| No number | 2,565 | **36** |

Numbers in titles hurt. They feel like marketing copy.

### Colon vs No Colon

| | Median Votes |
|---|---|
| Has colon | 32 |
| No colon | **39** |

Colons correlate with ~18% lower median votes.

### Top 5 Most-Voted Titles

1. Brickwise - AI Property Manager 🏡 (3,068)
2. Taxo - Autonomous Systems for Healthcare (2,459)
3. Oxus: AI-native automation for SOX audits (2,308)
4. Better Auth - The Authentication Framework for TypeScript (2,188)
5. Oneleet - Compliance without Security Theater (2,094)

---

## 6. Tagline Patterns

### Length Sweet Spot

| Bucket (chars) | Count | Median Votes |
|---|---|---|
| ≤30 | 47 | 32 |
| 31–50 | 410 | 32 |
| 51–70 | 814 | 34 |
| **71–100** | **857** | **39** |
| 101+ | 568 | 36 |

71–100 characters is the sweet spot.

### "AI" in Tagline

| | Median Votes |
|---|---|
| Contains "AI" | 34 |
| No "AI" | **36** |

Saying "AI" in the tagline slightly depresses median. Saturation punishes conformity.

### Sentiment — The Counterintuitive Finding

| Sentiment | Count | Median Votes |
|---|---|---|
| Positive | 915 | 35 |
| Neutral | 1,482 | 36 |
| **Negative (problem-focused)** | **299** | **39** |

Naming a pain is more compelling than promising relief. The wound sells better than the bandage.

### Single vs Multi-Sentence

| Sentences | n | Median | Avg |
|---|---|---|---|
| 0 (no punctuation) | 1,294 | 35 | 83.9 |
| 1 (one sentence) | 1,207 | **38** | 83.4 |
| 2 | 165 | 34 | 87.2 |
| **3+** | **30** | **22** | **52.7** |

Three or more sentences collapses to median 22 — nearly half the baseline. The second sentence is explanation the reader didn't ask for. The third is where they leave.

**Top single-sentence taglines:**
- *"Automating maintenance for landlords and property managers"* (Brickwise, 3,068v)
- *"Modern intelligence for better audits"* (Oxus, 2,308v)
- *"Realtime sales copilot giving on-the-spot phrase suggestions during calls."* (Nomi, 2,014v)
- *"Automating prior auths for the most expensive meds"* (Ruma Care, 1,835v)

Pattern: verb-first, specific, under 80 characters. No adjective bloat.

**Best multi-sentence taglines (the exceptions that work):**
- *"AI that converts clinical documentation into payments. In seconds."* (Taxo, 2,459v)
- *"There's a hundred apps for online meetings. This is for everything else."* (Pocket, 484v)
- *"Tesla promise robots for the price of a car. We will sell ours for the price of an iPhone."* (Piggy Robotics, 288v)

The successful multi-sentence taglines use the second sentence as a knife — a punchline, a contrast, a number. Not an explanation.

**The failure mode (bottom multi-sentence taglines):**
- *"Don't know why your agent messed up? Neither do we. But Mohi will show you exactly where your agents went wrong - and why."* (4v)
- *"Describe your business. Naive runs it."* (2v)
- *"Code search limits coding capabilities. Moving it out to a specialized model wins."* (4v)

The second sentence restates the first. No new information arrives. The reader's attention was borrowed and nothing was deposited.

---

## 7. Traction Signals

### Signal Performance

| Signal | n | Mean Lift | Median Lift |
|---|---|---|---|
| Has user/customer count | 179 | **+44.5** | 0 |
| Specific numbers (vs none) | 162 | +38.5 | 0 |
| Growth metrics present | 1,217 | +16.7 | **+6** |
| Revenue/ARR/MRR present | 470 | +9.6 | +4.5 |

### Metric Count

| Metrics | n | Median Votes |
|---|---|---|
| 0 | 1,064 | 32.0 |
| 1 | 877 | 38 |
| **2** | **542** | **41.0** |
| 3 | 191 | 39 |
| 4+ | 22 | 32.5 |

Two metrics saturate the benefit. Adding a third crowds the signal.

### Metric Placement — The Strongest Positional Finding

| Position | n | Mean Votes | Median Votes |
|---|---|---|---|
| **First 25% of text** | **704** | **108.50** | **40.0** |
| Middle 50% | 494 | 94.91 | 41.0 |
| Last 25% | 198 | 62.19 | 33.0 |
| No metrics | 1,300 | 68.95 | 33.0 |

Metrics in the opening carry 46% more mean votes than metrics buried in the closing. Burying metrics in the final quarter performs no better than having none.

---

## 8. Body Formatting

### Feature Lift (sorted by median vote lift)

| Feature | Median Diff | Direction |
|---|---|---|
| Emojis present | **+10** | positive |
| Bold text present | **+10** | positive |
| Headers present | **+9** | positive |
| TL;DR present | **+7** | positive |
| Bullets present | **+5** | positive |
| Code snippets | −6 | negative |
| Links (more = worse) | −10 at 3 links | negative |
| Explicit "Ask" section | −1 median / −25 mean | negative |

Formatting signals that reduce cognitive load correlate with votes. Signals that evoke technical docs or sales decks do not.

### Paragraph Count

| Paragraphs | Count | Median Votes |
|---|---|---|
| 1–9 | 283 | 22 |
| 10–13 | 506 | 34 |
| **18–20** | **418** | **43** |
| 21+ | 731 | 39 |

Sweet spot: 18–20 paragraphs. Posts with fewer than 10 perform poorly.

---

## 9. Social Proof & Credibility

### Brand Drops

| | n | Median |
|---|---|---|
| Any major brand mentioned | 1,476 | **39** |
| No brand | 1,220 | 32 |

Top brands by vote lift: Microsoft (median 52), Meta (52), Twitter (52), Stripe (50), Airbnb (46). **OpenAI mentions underperform baseline** — the AI wave has compressed vote distribution.

### Founder Credentials

| Signal | n | Avg Votes |
|---|---|---|
| ex-Microsoft | 7 | **315** |
| ex-Google | 11 | **194** |
| MIT | 120 | **138** |
| Stanford | 143 | 91 |
| PhD (alone) | 131 | 81 |
| ex-Meta/FB | 8 | 44 |

MIT dramatically outperforms Stanford. PhD alone is below baseline — the credential without the name carries nothing.

### Investor Mentions

| Signal | n | Avg Votes |
|---|---|---|
| "raised" | 47 | **137** |
| "funded" | 12 | 80 |
| "backed by" | 70 | 68 |
| "investors" | 118 | 68 |

"Raised" is the only funding signal with positive lift. Everything else backfires. Signaling that you have investors does not help. Saying you raised does.

### Before/After Claims

| Signal | n | Avg Votes |
|---|---|---|
| "cut X by Y%" | 10 | **308** |
| "reduced X by Y%" | 15 | **224** |
| "saves X hours" | 54 | **133** |
| "from X to Y" | 933 | 104 |

The rarest, most specific claims carry the heaviest weight. "Cut X by Y%" — used by only 10 launches — averages 308 votes.

### Customer Quotes

**No lift.** Testimonials on YC Launch do not move votes.

---

## 10. Call to Action

### CTA Type Performance

| CTA Type | n | Median Lift |
|---|---|---|
| **waitlist** | 96 | **+24** |
| **join** | 263 | **+7** |
| sign up | 393 | +5 |
| email us | 483 | +4 |
| schedule | 142 | +4.5 |
| book a demo | 506 | 0 |
| try | 731 | **−5** |
| get started | 287 | **−6** |

Waitlist = scarcity. Scarcity works. "Try" and "get started" — the most generic CTAs — correlate with lower votes.

### Urgency Words Near CTA

| Word | Median Lift |
|---|---|
| **beta** | **+13.5** |
| **limited** | **+13.0** |
| now | +0.5 |
| today | −2.5 |
| **free** | **−7.0** |

"Beta" and "limited" are the only urgency words with positive signal. "Free" near a CTA actively hurts. Scarcity framing works; discount framing does not.

### Discount Language — All Negative

| Pattern | n | Median Lift |
|---|---|---|
| % off | 55 | **−8** |
| free trial | 60 | **−10.5** |
| no credit card | 16 | **−12.5** |
| lifetime deal | 2 | **−13** |

The posts that perform worst are the ones that have clearly read a growth-hacking checklist and ticked every box.

### Contact Info

| | n | Median |
|---|---|---|
| Both email + phone | 40 | **50.5** |
| Email only | 1,615 | 39.0 |
| Neither | 1,036 | 31.0 |

Including contact info helps. The combination of email and phone — rarest — performs best.

---

## 11. Competitive Framing

### Phrase Performance

| Phrase | n | Median | Avg |
|---|---|---|---|
| **"alternative to"** | 22 | **52** | 129 |
| "cheaper than" | 30 | 43 | 159 |
| "replaces" | 111 | 41 | 95 |
| "unlike" | 99 | 40 | 102 |
| "faster than" | 85 | 37 | 84 |
| "better than" | 41 | 33 | 50 |
| "compared to" | 56 | 27 | 111 |

"Alternative to" is the most reliably positive phrase. "Better than" — generic superiority — underperforms baseline.

### Category Creation Language

| Phrase | n | Median | Avg |
|---|---|---|---|
| "a new kind of" | 6 | **63.5** | 161 |
| "the only" | 67 | 39 | **139** |
| "the first" | 414 | 40 | 91 |
| "we invented" | 2 | 10 | 10 |

Category language outperforms explicit comparison language. Founders who actually invented something apparently don't announce it that way.

### Replacement Framing — The Anti-Pattern

| Phrase | n | Median |
|---|---|---|
| "no more" | 105 | 32 |
| "replace your" | 5 | 24 |
| "forget about" | 9 | 22 |
| "stop using" | 2 | 21.5 |
| **Any replacement framing** | **125** | **28** |

Replacement framing reliably underperforms. The more aggressive the replacement language, the worse the result. Telling users what to abandon, without earning that authority first, reads poorly.

### Differentiation Claims — Sweet Spot at 2–3

| Claims | n | Median |
|---|---|---|
| 0 | 1,440 | 34 |
| 1 | 823 | 37 |
| **2** | **275** | **40** |
| **3** | **93** | **43** |
| 5+ | 21 | 20–28 |

Linear gain from 0 to 3. At 5+, both median and mean collapse. A post with five differentiation claims is a post where no single claim was convincing.

---

## 12. Industry & Category

### Votes by Industry

| Industry | Count | Median |
|---|---|---|
| **Education** | 24 | **53** |
| **Consumer** | 182 | **45** |
| Healthcare | 238 | 37.5 |
| Fintech | 204 | 37 |
| Industrials | 148 | 36 |
| B2B | 1,834 | 35 |
| Real Estate | 50 | 26.5 |

Education leads but thin sample. Consumer is the only category with both volume and elevated median. B2B is the ocean — 68% of all launches, completely average results.

### "AI" in Title — The Saturation Curve

AI in title rose from ~25% (2021) to ~59% (Spring 2025), then pulled back to ~47%.

| | Count | Median |
|---|---|---|
| AI in title | 1,106 | 34 |
| No AI in title | 1,590 | **37** |

The word confers no advantage. In Spring 2025, non-AI launches averaged 176 vs AI's 107. The herd telegraphed its presence; the crowd stopped rewarding it.

### B2B vs B2C

| Signal | n | Median |
|---|---|---|
| B2B only | 691 | 33 |
| B2C only | 566 | 36 |
| **Both** | **1,047** | **40** |
| Neither | 392 | 31 |

Launches that speak to organizations and people simultaneously perform best.

---

## 13. Timing & Batch Effects

### Season

| Season | n | Median |
|---|---|---|
| Winter | 1,213 | 32 |
| Summer | 1,089 | 35 |
| **Fall** | **246** | **53** |
| **Spring** | **148** | **67.5** |

Spring and Fall batches — smaller, more selective — produce 2x the median of canonical Winter/Summer.

### Day of Week

| Day | n | Median |
|---|---|---|
| **Sunday** | **70** | **45.5** |
| **Friday** | **343** | **40** |
| Wednesday | 579 | 37 |
| Tuesday | 598 | 35 |
| Monday | 473 | 34 |

Sunday is the best day (least traffic, most attentive audience). The busiest days are unremarkable.

### Early vs. Late in Batch

**The delta is positive in every single batch without exception.** Early Q1 always outperforms late Q4 by 15–48 median votes. The gap has widened over time. The audience's attention depletes across the batch cycle.

### Repeat Launchers

402 companies launched multiple times. Serial same-batch launching (Menza launched 3x, Fiber AI 3x) produces the highest raw totals. The final launch in a sequence is usually the peak. Companies warm up their audience across multiple posts.

---

## 14. Video vs. No Video — The Uncomfortable Truth

### Full Percentile Comparison

| Percentile | Video | No-Video |
|---|---|---|
| p25 | 18 | **21** |
| p50 | 34 | **38** |
| p75 | 74 | **79** |
| p90 | 154 | **166** |
| p95 | 262 | **296** |

No-video launches match or outperform at every percentile. The gap is consistent, not noise.

### Video Adoption Over Time

Video adoption collapsed to ~26% in 2022–2023, then surged past 85% after Fall 2024. Now near-universal. But standardization has not made it predictive. Video is table stakes. It is not a differentiator.

### Among Top 50 Launches

56% have video. Among bottom 200: 49.5% have video. Indistinguishable from base rate.

### Transcript Length vs. Votes

Pearson r = −0.014. Zero correlation. Video length does not predict votes. The content of the pitch matters; the length of its record does not.

---

## 15. Narrative Structure

### Arc Classification (920 transcripts)

| Arc | n | Median | Mean |
|---|---|---|---|
| solution-first | 340 | 34 | 77 |
| problem-heavy | 299 | 34 | 85 |
| traction-first | 124 | 34 | 90 |
| neutral→solution→solution | 27 | **47** | **105** |
| **problem→solution→traction** (textbook) | **5** | 33 | 35 |

The textbook arc appears in **0.5% of transcripts**. The gospel is almost nobody's practice. The standout: transcripts that skip problem framing entirely and spend two-thirds on product mechanics.

### Traction Placement

| Position | n | Mean | Median |
|---|---|---|---|
| **Front-loaded** | 195 | **94.3** | **39** |
| Back-loaded | 725 | 75.8 | 33 |

Front-loading traction lifts mean by ~18 points and the ceiling by 50 at p90.

### Topic Transitions

| Density | n | Mean |
|---|---|---|
| Focused (≤2) | 361 | 79.7 |
| **Mid (3–5)** | **258** | **91.7** |
| Choppy (≥6) | 301 | 69.5 |

3–5 transitions is optimal. Rigidity doesn't help. Choppiness kills.

---

## 16. Power Words & Superlatives

### Specificity — The Clearest Signal

| Quartile | Avg Numbers/Post | Avg Votes |
|---|---|---|
| Q1 (0–1) | 0.4 | 34 |
| Q2 (2–3) | 2.7 | 35 |
| Q3 (4–7) | 5.4 | **48** |
| Q4 (8+) | 12.3 | **49** |

Posts with 8+ specific numbers average 43% more votes than posts with 0–1. Specificity is the only language variable with a consistent, monotonic, quartile-spanning relationship to votes.

### Buzzword Penalties

| Word | % Using | Avg Votes |
|---|---|---|
| "disruptive" | 0.1% | **21** |
| "game-changing" | 0.1% | **31** |
| "next-gen" | 0.7% | **32** |
| "revolutionary" | 0.2% | 49 |
| Baseline | — | 84 |

The words that sound like a pitch deck wrote itself are the words that perform worst.

### Action Verbs — All Positive

| Verb | % Using | Avg Votes |
|---|---|---|
| eliminate | 4.8% | **118** |
| automate | 26.0% | **97** |
| simplify | 3.0% | 108 |
| streamline | 6.1% | 109 |
| reduce | 10.9% | 96 |

Every action verb outperforms baseline. None hurt.

---

## 17. Cross-Correlations

### Individual Feature Lift

| Feature | Lift vs. Without |
|---|---|
| has_metrics | **1.43x** |
| has_emoji_title | **1.37x** |
| has_social_proof | **1.34x** |
| long_body | **1.34x** |
| short_title | 1.20x |
| has_video | **0.97x** (negative) |

### Best Combinations

| Combo | Avg Votes | Lift | n |
|---|---|---|---|
| **emoji title + social proof + short title** | **270** | **4.11x** | 37 |
| emoji title + social proof + long body | 221 | 3.27x | 50 |
| metrics + emoji title + social proof | 232 | 3.61x | 38 |
| metrics + emoji title + long body | 159 | 2.69x | 151 |

37 launches hit all three in the best combo. They outperform 96% of the dataset.

### Top 1% vs Bottom 50%

| Feature | Top 1% | Bottom 50% | Gap |
|---|---|---|---|
| has_metrics | 57.7% | 32.6% | **+25pp** |
| has_emoji_title | 42.3% | 21.8% | **+21pp** |
| long_body | 57.7% | 37.8% | **+20pp** |
| has_video | 42.3% | 53.8% | **−12pp** |

The top 1% has fewer videos than the bottom 50%.

---

## 18. Top 1% Deep Dive (n=27)

### Common Traits vs Dataset

| Metric | Top 27 | Dataset |
|---|---|---|
| Video present | 44% | 52% |
| Mean body length | 3,148 chars | 2,544 chars (+24%) |
| Metric density | 0.029 | 0.025 (+17%) |

B2B is **underrepresented** in top 1% relative to its 68% share. Consumer (1.65x) and Real Estate (2.0x) punch above weight.

### Their Video Openers

- **Brickwise (3,068):** *"I never want to talk to tenants again."* — Skit format. Emotional before informational.
- **Ruma Care (1,835):** *"This is a biologic medication. And this tiny vial, it cost $30,000."* — The number arrives before the explanation.
- **Menza (1,370):** *"Your greatest revenue opportunity is hiding in plain sight."* — The loss, not the product.

Pattern: three open with the pain, one opens with the product. Pain-first openers are in the top 10.

---

## 19. Bottom 10% Anti-Patterns (n=269)

### The Failure Profile

| Pattern | Bottom 10% | Top 10% | Discrimination |
|---|---|---|---|
| **Posted 2+ yrs after batch** | 49.4% | 6.7% | **7.4x** |
| Body under 1,500 chars | 24.9% | 5.9% | **4.2x** |
| Zero emoji | 50.2% | 22.2% | **2.3x** |
| Zero metrics | 52% | 32% | **1.6x** |
| Has video | 53.9% | 49.3% | 1.1x (no signal) |

The single most distinguishing feature: **launching 2+ years after the batch.** Their cohort has dispersed, their momentum is gone. The community has no reason to vote for a product that may no longer exist.

### Title Words That Predict Failure

Overrepresented in bottom 10%: "inside", "parallel", "research", "app", "business", "agentic", "operating" — abstract technology framing.

Overrepresented in top 10%: "building", "project", "sell", "financial", "copilot" — action and ownership.

---

## 20. Batch-Normalized Analysis

After removing batch-level vote inflation:

### Normalized Effects

| Signal | Raw Effect | Normalized Effect |
|---|---|---|
| Video | Slight positive (noise) | **None** — artifact of era |
| Body length | Weak positive (r=0.14) | Weak positive (r=0.11) — survives |
| Metrics mention | +12% median | +12% median — consistent |
| Industry: Consumer/Edu | Overperform raw | Still overperform — real signal |

The top normalized performer: **Oxus** (Winter 2026) — 115.4x its batch median. Second: **QueryPie AI** (Winter 2020) — 113.2x. Brickwise has the highest raw count but is "only" 57.9x normalized.

22 of 30 entries overlap between raw and normalized top 30. The exceptions: Spring 2025 companies (inflated by hot batch) drop out; Winter 2022 and Winter 2026 companies (suppressed by cold batches) surface.

---

## 21. Team Size

**Extraction rate:** 336 of 2,696 launches (12.5%) mention team size explicitly. The rest never state it.

| Bucket | n | Avg Votes | Median Votes | p75 | p90 |
|---|---|---|---|---|---|
| Solo (1) | 141 | 68.5 | 31 | 72 | 166 |
| Duo (2) | 76 | 100.5 | 34 | 72 | 200 |
| Small (3–5) | 62 | 81.9 | 34 | 92 | 191 |
| **Medium (6–15)** | **23** | **101.0** | **65** | **151** | **190** |
| Large (16+) | 34 | 84.1 | 34 | 76 | 142 |

Medium teams (6–15) have the highest median by a wide margin — 65 vs 31–36 for all others. The floor is higher; p75 reaches 151. These are companies with enough hands to ship something credible before launch day.

Solo founders are the most numerous extractable group (141) but vote weakest at median. The ceiling is reachable alone (p90 = 166), just rarely.

Large teams (16+) underperform relative to expectation — median 34, same as solos. Many are likely bigger companies doing secondary product launches, not first-time builders.

**Chart:** `charts/team_size_votes.png`

---

## 22. Funding Stage

**Extraction rate:** 144 of 2,696 (5.3%) mention explicit funding labels. Sparse.

### By Funding Round

| Bucket | n | Median Votes | Avg Votes |
|---|---|---|---|
| **Pre-seed** | **9** | **128** | **120** |
| Series C+ | 15 | 49 | 62 |
| Series A | 32 | 37 | 64 |
| Series B | 24 | 34 | 85 |
| Seed | 26 | 32 | 61 |
| Bootstrapped | 28 | 30 | 113 |

Pre-seed wins by a wide margin. The crowd rewards founders who arrive with nothing but an idea — or who know how to perform that posture convincingly.

### By Revenue Stage

| Bucket | n | Median Votes |
|---|---|---|
| <$100K ARR/MRR | 19 | **85** |
| $1M+ ARR/MRR | 33 | 42 |
| $100K–$1M ARR/MRR | 7 | 40 |

Smaller revenue numbers get more votes. Early-stage traction signals — a company still becoming something — outperform proven machines. The audience wants to witness, not validate.

### By User Count Stage

| Bucket | n | Median Votes |
|---|---|---|
| **0–100 users** | **75** | **58** |
| 1K–10K users | 14 | 52 |
| 10K+ users | 71 | 42 |
| 100–1K users | 62 | 36 |

Earliest-stage user counts earn the most consistent engagement.

**Charts:** `charts/funding_stage_votes.png`, `charts/revenue_stage_votes.png`, `charts/user_stage_votes.png`

---

## 23. YC Partner Mentions

Only 4 partners crossed the 3-mention threshold across the entire dataset. Most launches don't name their group partner.

| Partner | Mentions | Median Votes | Avg Votes |
|---|---|---|---|
| **Paul Graham** | 4 | **138** | 116 |
| Garry Tan | 4 | 36 | 51 |
| Sam Altman | 6 | 30.5 | 151 |
| Michael Seibel | 4 | 27 | 35 |

Paul Graham is the outlier that matters — median 138, nearly 4x the corpus median. The four launches mentioning him are substantive: Resend ("Stripe for email"), Flowglad, Eggnog, Compresr. The association is not accidental — founders invoking PG tend to write tighter, clearer launches.

Sam Altman's average (151) is entirely explained by one outlier: Friday (752 votes). Strip it and the distribution collapses.

"Our partner" (25 hits) almost always means business partnerships, not YC. "YC partner" (2 hits), "group partner" (1 hit), "office hours" (5 hits) — too few to analyze.

**Chart:** `charts/yc_partners_votes.png`

---

## 24. Success Claims by Type

| Claim Type | n | Median With | Median Without | Lift | Top 10% Rate | Overall Rate |
|---|---|---|---|---|---|---|
| **Enterprise wins** | 1,823 | 40 | 27 | **1.48x** | 79.7% | 67.6% |
| **Market validation** | 41 | 51 | 36 | **1.42x** | 2.2% | 1.5% |
| **Cost savings** | 50 | 45 | 36 | **1.25x** | 3.3% | 1.9% |
| Growth rate | 324 | 41 | 35 | 1.17x | 11.8% | 12.0% |
| Technical achievement | 343 | 41 | 35 | 1.17x | 10.3% | 12.7% |
| Revenue traction | 83 | 40 | 36 | 1.11x | 3.7% | 3.1% |
| Time savings | 69 | 38 | 36 | 1.06x | 1.8% | 2.6% |
| **User traction** | **143** | **34** | **36** | **0.94x** | 5.9% | 5.3% |

Enterprise wins (named clients) dominate by volume and lift. Market validation (waitlists, signups) has the highest median (51) with tiny sample. User traction is the only negative-lift claim — stating raw user counts performs *worse* than the median. Listing users is defensive.

**Chart:** `charts/success_claims_votes.png`

---

## 25. Industry Deep Dive

### Median Votes by Industry

| Industry | n | Median | Avg |
|---|---|---|---|
| Education | 24 | 53 | 126 |
| Consumer | 182 | 45 | 107 |
| Healthcare | 238 | 38 | 96 |
| Fintech | 204 | 37 | 83 |
| Industrials | 148 | 36 | 87 |
| B2B | 1,834 | 35 | 79 |
| Government | 16 | 31 | 50 |
| Real Estate | 50 | 26 | 103 |

### Success Rate (% above median)

Education ~58%, Consumer and Healthcare just above 50%, B2B just below. Real Estate and Government trail.

**Charts:** `charts/industry_median_votes.png`, `charts/industry_top10pct_share.png`, `charts/industry_success_rate.png`

---

## 26. Batch Timeline

### Top Batches by Median

Spring 2025 (median 67.5, n=146) and Fall 2025 (median 53, n=147) are the genuine peaks among large batches. Older tiny batches (Summer 2019, median 228, n=4) are artifacts.

### Batch Size vs Votes

Slope = −0.159, r = −0.385, p = 0.077. Negative but not significant. Larger batches modestly dilute attention.

### Video Adoption Inflection

Video was 20–45% from 2020 through Summer 2024. Fall 2024 jumps to 84.8%. Winter 2026 has 86.8% video adoption and median 20 votes — highest video rate, lowest median among large batches. Video became table stakes and stopped being signal.

**Charts:** `charts/batch_median_votes.png`, `charts/batch_size_vs_votes.png`, `charts/batch_video_adoption.png`

---

## 27. Success Score Formula

Score = count of features present (0–7): emoji in title, metrics in body, body > 400 words, title < 50 chars, social proof, traction language, dash in title.

| Score | n | Median Votes |
|---|---|---|
| 0 | 103 | 27 |
| 1 | 436 | 27 |
| 2 | 731 | 35 |
| 3 | 695 | 39 |
| 4 | 480 | 43 |
| 5 | 200 | 52 |
| 6 | 44 | **67** |
| 7 | 7 | 51 |

Monotonic from 0 to 6. Each feature adds ~4–5 median votes. Score 7 drops — either formulaic launches feel engineered, or n=7 is noise.

### Feature Importance (median lift, presence vs absence)

| Feature | Lift |
|---|---|
| **Emoji in title** | **+14** |
| Social proof | +9 |
| Metrics in body | +8 |
| Body > 400 words | +8 |
| Dash in title | +6 |
| Traction language | +5 |
| Title < 50 chars | 0 |

**Charts:** `charts/success_score_votes.png`, `charts/success_score_distribution.png`, `charts/feature_importance.png`

---

## 28. Traction Types by Industry

### Prevalence

User counts dominate everywhere. Fintech leads (52%), followed by B2B (47%). Revenue/ARR mentions are highest in Healthcare (32%) and Education (29%). Technical proof (GitHub, open source) is a Consumer badge (28%).

### Vote Lift by Industry × Traction Type

- **Government + Revenue/ARR:** +124 vote lift. Tiny sample, but violent signal. A government company that bills agencies walks into a room of believers.
- **Education + Revenue/ARR:** −27 lift. The community distrusts monetized education at launch.
- **Consumer + Growth rates:** +38.5 lift. The community wants trajectory.
- **Fintech + User counts:** −7.5 lift. Naming customers hurts in fintech — numbers are too small relative to expectation.
- **Real Estate + Revenue/ARR:** −10.5 lift. Charging for real estate software at launch day is the wrong story.

**Charts:** `charts/traction_by_industry.png`, `charts/traction_lift_by_industry.png`

---

## 29. CTA & Formatting by Industry

### CTA Patterns

"Contact" dominates everywhere — most-used CTA in every industry. Industrials (56%), Government (56%), Healthcare (52%).

"Try" is B2B and Consumer (30–38%). "Book Demo" follows sales motion — B2B (23%), Real Estate (22%). "Waitlist" is rare everywhere — Consumer leads at 8%.

### Formatting Patterns

Bold is near-universal (91–97%). TL;DR and headers are standard, not differentiating.

Emoji varies meaningfully: Education 67%, B2B/Consumer 58%, Government 38%. Bullets are underused everywhere (12–31%).

### Formatting Vote Lift

Emoji lift is consistently positive across all industries (+4 to +16). No industry where emoji hurts. Headers lift Consumer strongly (+16) and Fintech moderately (+13.5).

**Charts:** `charts/cta_by_industry.png`, `charts/formatting_by_industry.png`

---

## 30. Top 50 vs Bottom 50 — Feature Matrix

### Starkest Gaps

| Feature | Top 50 | Bottom 50 | Delta |
|---|---|---|---|
| **Emoji in title** | 42% | 6% | **+36pp** |
| **Metrics in body** | 74% | 38% | **+36pp** |
| Social proof | 52% | 36% | +16pp |
| Video | 56% | 46% | +10pp |
| Long body | 100% | 100% | 0pp |
| Traction language | 72% | 70% | 0pp |

Long body and traction language are table stakes — 100% and 70%+ in both cohorts. They predict nothing. Emoji and metrics are the only features that actually separate winners from losers.

The highest-voted launches look more like product announcements than pitch decks. Metrics and a single emoji — that's the formula.

### Vote Distribution

The distribution is extreme. Median 36, p99 at 863. The top 50 threshold is 633 votes (1.9% of launches).

**Charts:** `charts/top50_feature_matrix.png`, `charts/top50_vs_bottom50.png`, `charts/vote_distribution.png`

---

## The Playbook — What To Do

### Do

1. **Title:** `Company - Description` + one emoji. Under 50 chars. No colon. No numbers.
2. **Tagline:** 71–100 chars. Name a pain, not a feature. Single sentence.
3. **Body:** 400–750 words. 18–20 paragraphs. Bold, headers, TL;DR, emoji. 3k–5k chars formatted.
4. **Metrics:** Exactly two. Front-load them in the first 25% of text. Use specific numbers. Use "cut X by Y%."
5. **Social proof:** Name one or two well-known companies or credentials. Use "raised" not "backed by."
6. **CTA:** One CTA. "Join the waitlist" or "Sign up for beta." Include founder email.
7. **Video:** Under 60 seconds. Open with pain, not product. Short sentences. First-person.
8. **Timing:** Launch early in the batch cycle. Sunday or Friday. Avoid the Tuesday–Thursday pile.
9. **Competitive:** "Alternative to [known product]" or "the first/only." 2–3 differentiation claims.

### Don't

1. Don't say "free", "no credit card", "% off", "free trial", "lifetime deal."
2. Don't say "disruptive", "game-changing", "next-gen", "revolutionary."
3. Don't say "problem" — say "broken", "tired", "hate."
4. Don't open with "Hi, I'm X from Y."
5. Don't use a colon in the title.
6. Don't use replacement framing ("no more", "forget about", "stop using").
7. Don't include code snippets in the body.
8. Don't bury metrics in the last paragraph.
9. Don't add more than 2 metrics — it crowds the signal.
10. Don't write an explicit "Our Ask" section.
11. Don't mention "AI" in the tagline if you can avoid it.
12. Don't launch late in the batch cycle.
13. Don't put 3+ emojis in the title.
14. Don't assume a video will help. If the writing is weak, the video won't save it.

---

## Factor Stability — By Industry and By Year

### Do the significant factors hold everywhere, or do they break down in specific industries and eras?

---

### Emoji in Title — By Industry

| Industry | With Med | Without Med | Lift | Adoption |
|---|---|---|---|---|
| **Education** | 98 | 38 | **+60** | 33% |
| **Consumer** | 68 | 36 | **+32** | 34% |
| **Real Estate** | 41 | 22 | **+19** | 28% |
| **B2B** | 46 | 32 | **+14** | 28% |
| **Healthcare** | 46 | 34 | **+12** | 34% |
| **Fintech** | 45 | 35 | **+10** | 25% |
| Industrials | 39 | 34 | +4 | 31% |
| **Government** | 25 | 38 | **−13** | 31% |

Emoji is universally positive except Government (−13). The effect is enormous in Education (+60) and Consumer (+32) — casual audiences reward visual signaling. Government penalizes it. Industrials shows almost no effect.

### Emoji in Title — By Year

| Year | Lift | Adoption |
|---|---|---|
| 2020 | +4 | 33% |
| 2021 | −0 | 33% |
| **2022** | **+19** | 40% |
| **2023** | **+16** | 38% |
| **2024** | **+18** | 30% |
| **2025** | **+18** | 17% |
| 2026 | +10 | 11% |

Emoji had no effect in 2020–2021. It became significant in 2022 and has held steady at +16 to +19 since. Adoption peaked in 2022 (40%) and has *declined* to 11% in 2026 — meaning the signal is becoming rarer and potentially more powerful. The early adopters saturated; the late majority hasn't caught up.

---

### Metrics in Body — By Industry

| Industry | Lift | Adoption |
|---|---|---|
| **Consumer** | **+12** | 68% |
| **Industrials** | **+11** | 78% |
| **Healthcare** | **+9** | 83% |
| **B2B** | **+8** | 62% |
| Fintech | +5 | 80% |
| Real Estate | +0 | 84% |
| **Government** | **−10** | 69% |
| **Education** | **−36** | 71% |

Metrics help in Consumer, Industrials, Healthcare, and B2B. They are neutral in Fintech and Real Estate. They actively hurt in Government (−10) and Education (−36). The Education finding is striking — the audience distrusts numbers in education launches. Government is similar: the community apparently reads metrics in civic/gov tech as spin rather than proof.

### Metrics in Body — By Year

| Year | Lift | Adoption |
|---|---|---|
| **2020** | **+10** | 57% |
| 2021 | +1 | 58% |
| **2022** | **+11** | 63% |
| **2023** | **+10** | 65% |
| **2024** | **+8** | 70% |
| 2025 | +1 | 70% |
| 2026 | +3 | 71% |

Metrics had consistent +8 to +11 lift from 2020–2024. In 2025, the lift collapsed to +1 despite 70% adoption. As metrics became standard (adoption rose from 57% to 71%), the differentiating power vanished. The signal saturated. By 2025, having metrics is table stakes — it no longer separates winners from losers.

---

### Social Proof — By Industry

| Industry | Lift | Adoption |
|---|---|---|
| **Education** | **+54** | 42% |
| **Industrials** | **+10** | 49% |
| **Consumer** | **+8** | 36% |
| Government | +8 | 56% |
| B2B | +4 | 34% |
| Real Estate | +4 | 50% |
| Healthcare | +1 | 49% |
| Fintech | −2 | 42% |

Social proof is wildly uneven. Education (+54, n=10) is an outlier — small sample, but the direction is violent. Industrials and Consumer show meaningful lift. Healthcare, Fintech, and B2B show almost none. The implication: in sectors where founder credibility is uncertain (education, industrials), social proof fills a gap. In sectors where the product speaks for itself (healthcare, fintech), it adds nothing.

### Social Proof — By Year

| Year | Lift | Adoption |
|---|---|---|
| 2020 | −2 | 30% |
| 2021 | −1 | 23% |
| 2022 | +7 | 28% |
| 2023 | +1 | 36% |
| 2024 | −1 | 42% |
| 2025 | +2 | 43% |
| 2026 | +3 | 46% |

Social proof has never been consistently significant in any year. The lift oscillates around zero. Adoption has risen steadily (23% → 46%), but the effect hasn't followed. Social proof is a weak factor that looks strong in aggregate only because it correlates with other signals (longer bodies, more effort).

---

### Domain Expertise — By Industry

| Industry | Lift | Adoption |
|---|---|---|
| **Consumer** | **+21** | 25% |
| **B2B** | **+13** | 23% |
| **Government** | **+11** | 56% |
| Fintech | +6 | 28% |
| Real Estate | +4 | 34% |
| Healthcare | +2 | 34% |
| Industrials | +1 | 37% |
| **Education** | **−51** | 21% |

Domain expertise is the factor with the widest industry variance. Consumer (+21), B2B (+13), and Government (+11) reward it heavily. Healthcare and Industrials don't — in those sectors, expertise is assumed. Education penalizes it severely (−51, n=5) — possibly because stating "10 years in education" reads as establishment rather than innovation.

### Domain Expertise — By Year

| Year | Lift | Adoption |
|---|---|---|
| 2020–2021 | ~0 | 6–7% |
| 2022 | 0 | 12% |
| **2023** | **+11** | 24% |
| **2024** | **+8** | 30% |
| **2025** | +8 | 36% |
| 2026 | +2 | 34% |

Domain expertise became significant only in 2023 and has held since. Adoption tripled from 12% (2022) to 36% (2025). The signal is strengthening as the YC audience grows more skeptical of "two engineers with an API wrapper" — they want to see that founders know the problem firsthand.

---

### Technical Founder Signal — By Industry

| Industry | Lift | Adoption |
|---|---|---|
| **Education** | **+107** | 29% |
| **Consumer** | **+12** | 54% |
| **B2B** | **+11** | 65% |
| **Fintech** | **+10** | 49% |
| Healthcare | 0 | 68% |
| Industrials | −1 | 78% |
| Real Estate | −3 | 78% |
| **Government** | **−19** | 69% |

Education (+107, n=7) is an extreme outlier — a technical founder in education is apparently a novelty the crowd celebrates. B2B, Consumer, and Fintech show consistent +10-12 lift. Healthcare and Industrials show zero — in those sectors, being technical is the norm, not the differentiator. Government penalizes it (−19).

### Technical Signal — By Year

| Year | Lift | Adoption |
|---|---|---|
| 2020 | +5 | 49% |
| 2021 | 0 | 49% |
| **2022** | **+13** | 50% |
| 2023 | +6 | 61% |
| 2024 | +4 | 69% |
| **2025** | **+12** | 73% |
| 2026 | +2 | 69% |

The signal oscillates. Adoption has risen from 49% to 73% — nearly every launch now includes technical language. The lift spiked in 2022 (+13) when it was still 50/50, faded as it became universal, then spiked again in 2025 (+12). Non-stationary. Unreliable as a consistent differentiator.

---

### Waitlist CTA — By Industry

| Industry | Lift | Adoption |
|---|---|---|
| **Healthcare** | **+64** | 5% |
| **Fintech** | **+50** | 5% |
| **Consumer** | **+48** | 8% |
| **B2B** | **+13** | 3% |

Waitlist works everywhere it appears — but it appears almost nowhere. Adoption is 3–8% across all industries. The lifts are enormous: +64 in Healthcare, +50 in Fintech, +48 in Consumer. This is the single most consistent high-lift factor in the dataset. Scarcity framing works universally.

### Waitlist CTA — By Year

| Year | Lift | Adoption |
|---|---|---|
| 2021 | 0 | 5% |
| **2022** | **+71** | 3% |
| **2023** | **+28** | 4% |
| **2024** | **+22** | 5% |
| **2025** | **+9** | 4% |

The waitlist lift is declining over time: +71 in 2022, down to +9 in 2025. The tactic is being adopted slowly (3% → 5%) but the audience is growing resistant. In 2022, a waitlist was genuinely novel. By 2025, it reads more like a growth hack. The signal is fading but still positive.

---

### Long Body — By Industry

| Industry | Lift | Adoption |
|---|---|---|
| **Consumer** | **+20** | 43% |
| **Industrials** | **+14** | 43% |
| **Fintech** | **+12** | 43% |
| B2B | +7 | 41% |
| Government | +6 | 56% |
| Healthcare | +4 | 50% |
| Real Estate | −3 | 40% |
| **Education** | **−36** | 46% |

Long bodies help most in Consumer (+20), Industrials (+14), and Fintech (+12). In Education, long bodies hurt (−36) — possibly because the high-performing Education launches are short, punchy, and emotionally driven rather than comprehensive.

### Long Body — By Year

| Year | Lift | Adoption |
|---|---|---|
| **2020** | **+10** | 29% |
| 2021 | −1 | 27% |
| 2022 | +7 | 30% |
| **2023** | **+9** | 48% |
| 2024 | +3 | 48% |
| **2025** | **+13** | 43% |
| 2026 | +5 | 43% |

The lift oscillates but trends upward. In 2025, long bodies showed their strongest effect (+13). As the YC community grows larger and more saturated, depth is increasingly rewarded — short posts get lost.

---

### Dash in Title — By Industry

| Industry | Lift | Adoption |
|---|---|---|
| **Education** | **+48** | 29% |
| **Real Estate** | **+18** | 58% |
| **Consumer** | **+13** | 51% |
| **B2B** | **+9** | 53% |
| Healthcare | +8 | 50% |
| Industrials | +3 | 53% |
| Fintech | −3 | 55% |
| **Government** | **−10** | 69% |

Dash over colon works everywhere except Government (−10) and Fintech (−3). Education's +48 is extreme but n=7. The effect is strongest in less-represented industries where visual clarity matters more.

---

### Summary — Which Factors Are Universal vs Conditional

| Factor | Universal? | Where it breaks | Trend over time |
|---|---|---|---|
| **Emoji in title** | Almost — fails only in Government | Government (−13) | Stable since 2022 (+16-19), declining adoption |
| **Metrics in body** | No — fails in Education, Government | Education (−36), Government (−10) | **Saturating** — lift collapsed in 2025 |
| **Waitlist CTA** | Yes — works everywhere | None | **Fading** — lift declining yearly |
| **Domain expertise** | No — sector-dependent | Education (−51), Healthcare/Industrials (~0) | **Growing** — emerged 2023, strengthening |
| **Technical signal** | No — sector-dependent | Government (−19), Healthcare/Industrials (~0) | Oscillating, unreliable |
| **Social proof** | No — weak everywhere | Fintech (−2), Healthcare (+1) | Never consistently significant |
| **Long body** | Mostly — fails in Education | Education (−36), Real Estate (−3) | **Strengthening** in 2025 |
| **Dash in title** | Mostly — fails in Government | Government (−10), Fintech (−3) | Peaked 2024, fading |

**The three truly robust factors:** emoji in title, waitlist CTA, and long body. Everything else is conditional on industry or era.

**The Education anomaly:** Education systematically inverts multiple signals. Metrics hurt. Long bodies hurt. Domain expertise hurts. Social proof helps enormously. The audience wants passion and novelty, not proof and credentials. Education is a different game.

**The Government anti-pattern:** Every visual/informal signal (emoji, dash) is penalized in Government. The audience is serious and reads frivolity as a lack of understanding.

**The 2025 saturation:** Metrics and waitlist — two of the strongest signals historically — are both losing power as adoption rises. The playbook is being read by everyone, which means the playbook is becoming less useful. The next edge will come from something not yet measured.

---

---

## 20 Unchecked Angles — Next Wave

These have not been measured yet. They require deeper NLP or manual annotation.

### Narrative & Rhetorical Structure

1. **ABT (And-But-Therefore) structure** — Does the body follow the ABT framework? ("We do X, AND the market wants it, BUT existing solutions fail, THEREFORE we built Y.") Classify each body into ABT vs non-ABT. Correlate with votes. The ABT frame is the backbone of Hollywood screenwriting — does it work in a 500-word launch post?

2. **Specificity of the villain** — Does the launch name a specific antagonist? ("Excel spreadsheets", "manual data entry", "3-day turnaround times") vs vague enemies ("legacy systems", "outdated processes", "the status quo"). Concrete villains may outperform abstract ones.

3. **Future-casting vs present-tense** — Does the post describe what the product *will* do ("we're building") vs what it *does* do ("we do")? Present-tense confidence vs future-tense ambition.

4. **Founder voice vs company voice** — "I built this because..." vs "Company X provides..." First-person singular vs corporate third-person in body text. Correlate with votes.

5. **The "micro-story" test** — Does the body contain a narrative with a character, a conflict, and a resolution? Even a single sentence: "A nurse in Ohio was spending 3 hours a day on prior auth calls. Now she spends 5 minutes." Presence of micro-stories vs pure feature lists.

### Structural Patterns

6. **The "above the fold" test** — What's in the first 100 words of body text? Classify: product description, problem statement, metric/traction, personal story, bold claim. Correlate the opening content type with votes.

7. **Section ordering** — What order do sections appear? Map the sequence: TL;DR → Problem → Solution → How it works → Team → Ask. Does the order matter?

8. **Whitespace ratio** — Character count vs visible content. Posts with more whitespace (short paragraphs, line breaks, headers) may read better. Ratio of blank lines to content lines vs votes.

9. **List-to-prose ratio** — What % of the body is bullet points vs flowing paragraphs? Some launches are pure lists. Others are essays. Which ratio wins?

10. **The "demo sentence"** — Does the post contain a sentence that describes the product *in action*? ("You paste a URL, we return a structured dataset in 3 seconds.") vs feature descriptions ("Our platform offers advanced data extraction.") Process descriptions vs capability claims.

### Social & Behavioral

11. **Launch title A/B testing** — Companies that launched multiple times often changed their title. For each repeat launcher, which title structure won? What did they change between attempts?

12. **Comment bait** — Does the tagline or body contain a provocative/contrarian claim that would invite discussion? ("Compliance doesn't need to be theater", "Your spreadsheet is lying to you") Controversy as engagement driver.

13. **Named-user story** — Does the body contain a named person or company case study? ("Sarah at Acme Corp reduced her onboarding time by 80%") Named examples vs anonymous claims.

14. **Urgency without discount** — Scarcity signals that don't involve money: "We're onboarding 10 companies this month", "Beta closes Friday", "3 spots left in our pilot." Non-monetary urgency vs monetary urgency.

### Visual & Format

15. **First emoji position** — Where does the first emoji appear? Title, tagline, first paragraph, deep in body? Early emoji vs late emoji vote difference.

16. **Screenshot/demo presence** — Bodies that reference visual demos ("see the screenshot below", "[demo gif]", embedded media) vs pure text. Product demonstration vs product description.

17. **Typography density** — Sentences per paragraph. Posts with 1–2 sentence paragraphs (scannable) vs 4+ sentence paragraphs (dense). Reading ease proxy.

### Meta-Patterns

18. **Launch post vs landing page alignment** — Do the tagline and title match the company's actual homepage? Or is the launch post telling a different story? Alignment between launch narrative and product positioning.

19. **Batch peer comparison** — Within the same batch, do launches that differentiate from their batchmates (unique industry, unique angle) outperform those in crowded categories? Intra-batch competition effect.

20. **The "would you click?" test** — Using only the title + tagline (no body, no video), predict vote quartile. How much of the outcome is determined before the reader opens the post? Title-tagline-only predictive power vs full-post features.

---

## 31. Name-Drop Openers (Angle 6)

| Group | n | Median | Avg |
|---|---|---|---|
| Name-drop opener | 75 | 36 | 58.1 |
| No name-drop | 929 | 34 | 83.7 |

Name-dropping a brand (Google, Stripe, etc.) in the first sentence of a transcript produces no meaningful lift. Median is nearly identical. The avg is actually *lower* for name-droppers — the technique may anchor the listener on someone else's product rather than yours.

---

## 32. Time-to-Product-Mention (Angle 7)

| Position | n | Median | Avg |
|---|---|---|---|
| **First 10 words** | **142** | **40** | **95.2** |
| 11–30 words | 85 | 33 | 68.1 |
| 31–60 words | 64 | 30 | 85.0 |
| 61–100 words | 68 | 34 | 117.7 |
| 100+ words | 68 | 30 | 60.8 |
| Never mentioned | 577 | 35 | 78.3 |

Mentioning the product name in the first 10 words correlates with the highest median (40). After that, performance drops. Most transcripts (577) never mention the company name at all — the product is described without being named.

---

## 33. Opening Word Frequency (Angle 8)

Top performers by first word:

| First Word | Count | Median Votes |
|---|---|---|
| **i** | 13 | **101** |
| **your** | 7 | **82** |
| **how** | 6 | **80** |
| **when** | 7 | **66** |
| **what** | 14 | **48** |
| **everyone** | 5 | **48** |
| were | 11 | 46 |
| music | 106 | 42 |
| we | 12 | 42 |
| hi | 166 | 34 |
| hey | 99 | 34 |
| today | 13 | 19 |
| so | 9 | 19 |
| the | 23 | 20 |

"I" as the first word has median 101. "Your" has 82. "How" has 80. These are personal, direct, conversational openings. "Hi" (166 uses, median 34) and "hey" (99, median 34) are the most common — and perfectly average. "Today" and "so" are the worst-performing openers. "Music" at 106 occurrences with median 42 reflects transcription artifacts from intro music.

---

## 34. Traction Mention Timing in Transcripts (Angle 12)

| Position of First Metric | n | Median | Avg |
|---|---|---|---|
| First 25% | 169 | 29 | 80.4 |
| 25–50% | 72 | 31 | 67.7 |
| **50–75%** | **55** | **40** | **79.4** |
| 75–100% | 51 | 36 | 117.2 |
| No metrics | 657 | 35 | 81.1 |

In transcripts (unlike body text), metrics placed in the third quarter correlate with the highest median. Early metrics in transcripts actually underperform — the spoken pitch may need narrative before proof. This contradicts the body text finding, where front-loading wins. Different medium, different rhythm.

---

## 35. CTA Placement in Transcripts (Angle 13)

| Placement | n | Median | Avg |
|---|---|---|---|
| **First third** | **30** | **40** | **69.4** |
| Middle third | 66 | 34 | 73.4 |
| Last third | 176 | 34 | 65.8 |
| Multiple | 126 | 34 | 80.1 |
| None | 606 | 34 | 88.2 |

Most transcripts (606) have no detectable CTA. Those that do show no meaningful placement effect — median is 34 everywhere except the first-third group (40, n=30). The absence of a CTA correlates with the highest average (88.2), suggesting the best videos don't ask — they show.

---

## 36. Distinct Factual Claims in Body Text (Angle 14)

| Claims | n | Median | Avg |
|---|---|---|---|
| 0 | 464 | **27** | 57.9 |
| 1–2 | 1,014 | 37 | 73.7 |
| 3–5 | 807 | 38 | 96.6 |
| 6–10 | 344 | 39 | 99.8 |
| **11+** | **67** | **40** | **167.8** |

Monotonic. Zero claims = median 27. Each additional claim bucket raises the floor. 11+ claims averages 167.8 — but the median gain above 3 is diminishing. The jump from 0 to 1–2 claims (+10 median) is the largest.

---

## 37. Jargon Density (Angle 20)

| Quartile | n | Median | Avg |
|---|---|---|---|
| Q1 (zero jargon) | 674 | 30 | 70.8 |
| Q2 | 674 | 41 | 91.4 |
| Q3 | 674 | 36 | 92.6 |
| Q4 (most jargon) | 674 | 35 | 79.4 |

Zero jargon underperforms (median 30). Some jargon (Q2) peaks at median 41. Heavy jargon (Q4) drops back to 35. The audience is technical enough to reward specificity but not so technical that they want a spec sheet. Moderate jargon is the sweet spot.

---

## 38. Concrete vs Abstract Language (Angle 23)

| Quartile | n | Median | Description |
|---|---|---|---|
| Q1 | 674 | 30 | Most abstract |
| Q2 | 674 | 38 | Somewhat abstract |
| **Q3** | **674** | **39** | **Somewhat concrete** |
| Q4 | 674 | 37 | Most concrete |

Fully abstract underperforms badly (30). Somewhat concrete peaks at 39. The most concrete quartile drops slightly — possibly because pure numbers without narrative feel sterile. The sweet spot is concrete language leavened with enough abstraction to tell a story.

---

## 39. Emotional Valence (Angle 24)

| Valence | n | Median |
|---|---|---|
| Strongly negative | 105 | 35 |
| Slightly negative | 551 | **38** |
| Neutral | 814 | 35 |
| Slightly positive | 1,100 | 35 |
| **Strongly positive** | **126** | **42** |

Strongly positive (median 42) and slightly negative (38) outperform neutral (35). The market rewards emotional intensity in both directions more than it rewards neutrality. But the best performers are those who name something they genuinely love about their product — not those who name pain.

---

## 40. Power Words (Angle 25)

| Word | With (n) | With Median | Lift |
|---|---|---|---|
| **exclusive** | 23 | 55 | **+19** |
| **secret** | 35 | 46 | **+10** |
| limited | 177 | 39 | +3 |
| new | 977 | 36 | 0 |
| guaranteed | 20 | 36 | 0 |
| free | 722 | 34 | −2 |
| instant | 164 | 34 | −2 |
| **proven** | **37** | **28** | **−8** |
| **breakthrough** | **20** | **28** | **−8** |

"Exclusive" (+19) and "secret" (+10) are the only power words with meaningful lift. "Proven" and "breakthrough" both carry an −8 penalty. The marketing playbook is inverted here: scarcity language works, credibility language doesn't, and the most overused power word ("free") is mildly negative.

---

## 41. Time-Framed Metrics (Angle 41)

| Group | n | Median | Avg |
|---|---|---|---|
| Time-framed metrics | 322 | **39** | **119.1** |
| Plain metrics (no timeframe) | 1,247 | 39 | 85.2 |
| No metrics | 1,127 | 33 | 71.5 |

Time-framing metrics ("in 3 months", "year over year") produces the same median as plain metrics but a much higher average (119 vs 85). The effect is concentrated in the top performers — time-framed metrics help the best launches go viral without changing the median. Having any metric beats having none (+6 median).

---

## 42. Image References (Angle 47)

| Group | n | Median |
|---|---|---|
| Has images | 2,388 | **38** |
| No images | 308 | 23 |

| Image Count | n | Median |
|---|---|---|
| 1 | 805 | 35 |
| **2–3** | **1,086** | **39** |
| 4+ | 497 | 39 |

88.6% of launches include images. Those without are severely penalized (median 23 vs 38). 2–3 images is optimal. The gain from 1 to 2–3 is real; the gain from 2–3 to 4+ is zero.

---

## 43. Title-Tagline Word Overlap (Angle 55)

| Overlap | n | Median |
|---|---|---|
| Low (<20%) | 2,030 | 36 |
| Medium (20–50%) | 623 | 35 |
| High (>50%) | 43 | 32 |

Redundancy hurts. Launches where the title and tagline say the same thing (>50% word overlap) have the lowest median. Low overlap — where the tagline adds new information — performs best. Say it once, not twice.

---

## 44. Benefit-First vs Product-First Titles (Angle 58)

| Type | n | Median | Avg |
|---|---|---|---|
| **Benefit-first (verb)** | **9** | **80** | **104.8** |
| Company name first | 2,141 | 37 | 88.7 |

Only 9 titles lead with a benefit verb. The median is 80 — more than double the company-name-first median. The sample is tiny, so the signal is directional, not conclusive. But the direction is clear: starting with what you do for the reader, not who you are, correlates with dramatically higher votes.

---

## 45. Niche vs Broad Market Framing (Angle 65)

| Framing | n | Median |
|---|---|---|
| **Both niche + broad** | **22** | **47** |
| Broad targeting | 392 | 39 |
| Niche targeting | 163 | 37 |
| Neither | 2,141 | 35 |

Speaking to both a specific vertical AND a broader audience wins (median 47). Pure niche framing (37) underperforms pure broad framing (39). The combination works because it signals domain expertise while not limiting perceived market.

---

## 46. Comparison Tables in Body (Angle 81)

Only 2 launches include markdown tables. Sample too small. No conclusion.

---

## 47. CTA Specificity (Angle 85)

| Specificity | n | Median |
|---|---|---|
| No detectable CTA | 1,913 | **37** |
| Specific CTA | 100 | 34 |
| Generic CTA | 683 | 32 |

The absence of a CTA outperforms both specific and generic CTAs. Generic CTAs ("try it", "check it out", "learn more") are the worst. The YC Launch audience is not a sales funnel — they come to evaluate, not to convert. Letting the product speak is the strongest move.

---

## 48. Founder Count Mentioned (Angle 87)

| Founders | n | Median | Avg |
|---|---|---|---|
| **Solo** | **4** | **92** | **96.0** |
| Pair (co-founder) | 479 | 37 | 96.8 |
| Trio+ | 14 | 36 | 59.1 |
| Not mentioned | 2,202 | 36 | 80.7 |

Solo founders who explicitly identify as solo have median 92 — but only 4 of them exist in the data. The signal is anecdotal. Pairs (479) are the most common explicit mention and perform at dataset median. Trio+ slightly underperforms. Most launches (82%) don't specify.

---

## 49. Personal Story (Angle 88)

| Group | n | Median |
|---|---|---|
| Has personal story | 136 | **38** |
| No personal story | 2,560 | 36 |

Modest lift (+2 median). Personal narratives ("I used to", "I struggled", "I realized") are rare (5%) and mildly positive. The effect is smaller than expected — the audience is product-focused, not founder-focused.

---

## 50. Domain Expertise Signaling (Angle 89)

| Group | n | Median |
|---|---|---|
| **Domain expertise signal** | **714** | **44** |
| No domain signal | 1,982 | 34 |

This is one of the stronger binary signals in the dataset: +10 median. Phrases like "X years in healthcare", "built X at Google", "spent a decade in" — domain expertise is the credibility signal that actually works. Unlike credentials (PhD, Stanford), expertise signals speak to the problem, not the person.

---

## 51. "Why We Built This" Section (Angle 90)

| Group | n | Median |
|---|---|---|
| Has "why" section | 351 | 35 |
| No "why" section | 2,345 | 36 |

No lift. The "why we built this" narrative convention is inert. 13% of launches include it, and they perform identically to those that don't. The origin story is apparently not what the audience is evaluating.

---

## 52. Technical Founder Signal (Angle 91)

| Group | n | Median |
|---|---|---|
| **Technical founder signal** | **1,724** | **39** |
| No technical signal | 972 | 31 |

+8 median. 64% of launches contain technical founder language ("engineer", "CTO", "built from scratch", "open source"). The audience is technical and rewards builders. The absence of any technical signal is a penalty.

---

## 53. Body Length x Transcript Length (Angle 92)

| | Long transcript (>200w) | Short transcript (≤200w) |
|---|---|---|
| **Long body (>400w)** | n=237, med=34 | n=208, **med=46** |
| **Short body (≤400w)** | n=263, med=30 | n=296, med=33 |

The best combination is long body + short transcript (median 46). A long video paired with a long post produces only median 34 — the two compete for attention. When you write well, keep the video brief.

---

## 54. Metric Density x Industry (Angle 93)

| Industry | High-Metric Med | Low-Metric Med | Lift |
|---|---|---|---|
| **Education** | **64** | **53** | **+12** |
| B2B | 39 | 33 | +6 |
| Consumer | 48 | 44 | +4 |
| Healthcare | 39 | 36 | +3 |
| Fintech | 38 | 35 | +3 |
| Government | 27 | 38 | −11 |
| Real Estate | 25 | 28 | −3 |

Metrics help most in Education (+12) and B2B (+6). They actively hurt in Government (−11) and Real Estate (−3) — sectors where the audience may distrust numbers, or where the numbers themselves are unimpressive.

---

## 55. Emoji in Title x Industry (Angle 94)

| Industry | With Emoji | Without | Lift |
|---|---|---|---|
| **Education** | **98** | **38** | **+60** |
| **Consumer** | **68** | **36** | **+32** |
| Real Estate | 41 | 22 | +19 |
| B2B | 46 | 32 | +14 |
| Healthcare | 46 | 34 | +12 |
| Fintech | 45 | 35 | +10 |
| Industrials | 39 | 34 | +4 |
| Government | 25 | 38 | **−13** |

Emoji lifts every industry except Government (−13). The effect is enormous in Education (+60) and Consumer (+32) — audiences that are inherently more casual. In Government, emoji signals frivolity. Know your audience.

---

## 56. Title Length x Body Length (Angle 95)

| | Long Body | Short Body |
|---|---|---|
| **Short title** | med=41 | med=33 |
| **Long title** | med=41 | med=32 |

Title length makes no difference when the body is long. Both produce median 41. When the body is short, both produce ~32–33. Body length dominates; title length is noise. Write well, title however you want.

---

## 57. Traction x Batch Era (Angle 96)

| Era | With Traction | Without | Lift |
|---|---|---|---|
| Early (2018–2022) | med=26 | med=19 | +8 |
| Recent (2023–2026) | med=40 | med=36 | +4 |

The traction lift has *decreased* over time — from +8 in early batches to +4 in recent ones. As more companies show traction, the signal becomes less differentiating. The bar has risen but the reward for clearing it has fallen.

---

## 58. Zero-to-Hero — Rising Trajectories (Angle 99)

| Company | Votes 1 → 2 | Batches |
|---|---|---|
| BrowserOS | 49 → 1,078 | Summer 2024 (same batch, rebrand) |
| Asteroid | 19 → 227 | Winter 2025 (same batch, repositioned) |
| Locale | 12 → 155 | Summer 2021 (same batch, new angle) |
| 1stCollab | 28 → 139 | Winter 2023 (same batch, repositioned) |
| Second | 49 → 132 | Winter 2023 (same batch, better title) |

The pattern: companies that launched low and relaunched high almost always did so within the same batch. They didn't wait — they iterated the pitch, not the product. BrowserOS went from 49 to 1,078 by changing the name and framing from "AI infra" to "open source agentic browser." Same product. Different story.

### Profile of early-batch low-vote launches (n=386)

- Avg body: 343 words (vs 450+ for dataset mean)
- Emoji in title: 28% (vs 29% overall)
- Has video: 35% (vs 52% overall)
- Has metrics: 40% (vs 55%+ for top performers)

Short posts, fewer videos, fewer metrics. The early-batch failures didn't just fail at virality — they failed at effort.
