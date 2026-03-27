# YC vs Product Hunt — Complete Cross-Platform Comparison

**Addendum to the video analysis.** This covers everything that was missing: PH text analysis, video vs no-video meta-finding on PH, text × video interaction effects, topic-specific optimal styles, engagement quality, team size, and head-to-head pattern comparison.

---

## 1. THE META-FINDING: Video Helps on PH, Not on YC

| Platform | With Video | Without Video | Diff | p |
|---|---|---|---|---|
| **YC** | median 34 (n=1,209) | **median 38** (n=1,308) | **-4** | — |
| **PH** | **median 389** (n=2,760) | median 324 (n=1,010) | **+65** | **<0.001** |

On YC, video doesn't help — launches without video still outperform. On PH, video is a significant advantage. The effect is shrinking over time:

| Year | PH Video Median | PH No-Video Median | Diff |
|---|---|---|---|
| 2024 | 442 | 356 | **+86** |
| 2025 | 362 | 310 | +52 |
| 2026 | 334 | 290 | +44 |

Video's edge on PH is compressing — from +86 in 2024 to +44 in 2026. Still significant, but halved. The writing is catching up.

---

## 2. PH TEXT PATTERNS (never analyzed until now)

### Description Length — Short Wins on PH

| Length | n | PH Median |
|---|---|---|
| **0-50 words** | **3,455** | **375** |
| 50-100 words | 315 | 311 |
| 100-200 words | 206 | 325 |

r=+0.009, p=0.56. No correlation. But the sweet spot is the shortest bucket. PH descriptions are naturally short (median ~35 words) — bloating hurts.

**Comparison with YC:** YC's sweet spot is 500-750 words (median 45). PH's is under 50 words. The platforms are not even in the same genre. YC is an essay. PH is a headline.

### Tagline Length

| Length | n | PH Median | YC Median |
|---|---|---|---|
| 0-30 chars | 436 | **378** | 32 |
| 30-50 chars | 1,768 | 371 | 32 |
| 50-70 chars | 1,566 | 363 | 34 |
| 70-100 chars | — | — | **39** |

PH: shorter taglines win (slightly). YC: longer taglines win (71-100 chars). PH viewers skim. YC viewers read.

### "AI" in Text — Opposite Effects

| | PH | YC |
|---|---|---|
| Tagline has "AI" | median **398** | median 34 |
| Tagline no "AI" | median 356 | median **36** |
| Description has "AI" | median **388** | — |
| Description no "AI" | median 353 | — |

On PH, mentioning AI **helps** (+42 tagline, +35 description). On YC, it **hurts** (-2 tagline, -15 on-screen). PH is a consumer platform that responds to AI hype. YC is a technical community saturated with AI.

### Numbers in Title

| | PH | YC |
|---|---|---|
| Numbers in title | median **409** | median 28 |
| No numbers | median 366 | median **36** |

Opposite again. Numbers in the title help on PH (+43) and hurt on YC (-8).

### Name Format

| Format | PH Median | YC Median |
|---|---|---|
| Dash (Company - X) | 360 | **41** |
| Colon (Company: X) | 353 | 33 |
| Plain name | **370** | 34 |

On PH, plain names perform best. On YC, dashes perform best. PH products have brand names that stand alone. YC launches need context.

---

## 3. PH KEY PHRASES IN DESCRIPTION

| Phrase | n | PH Median | Diff vs Rest |
|---|---|---|---|
| **"10x"** | 36 | **484** | **+115** |
| **"no-code"** | 68 | **423** | **+53** |
| "AI" | 1,742 | 388 | +34 |
| "GPT" | 43 | 391 | +21 |
| "automate" | 426 | 379 | +11 |
| "open source" | 173 | 357 | -13 |
| "free" | 369 | 352 | -19 |
| "all-in-one" | 125 | 350 | -20 |
| "dashboard" | 56 | 348 | -22 |
| **"privacy"** | **50** | **297** | **-74** |

"10x" is the highest-performing phrase on PH (+115 median). "Privacy" is the worst (-74). The PH audience wants amplification, not protection.

**Comparison with YC:** On YC, "free" and "no credit card" hurt (-8 to -13). Same on PH (-19 for "free"). The one universal: nobody is impressed by free.

---

## 4. PH OPENING HOOKS

| Hook Type | n | PH Median |
|---|---|---|
| **Announcement** ("Introducing...", "Meet...") | 93 | **428** |
| Pain point ("Tired of...", "Frustrated...") | 23 | 400 |
| Stat/Number | 216 | 374 |
| First person (We/I) | 65 | 372 |
| Descriptive (The/A) | 1,051 | 370 |
| Other | 2,322 | 368 |

**Comparison with YC:** On YC, the best opener is a product statement (median 47.5) and the worst is a greeting (26.5). On PH, announcements lead. Both platforms penalize generic descriptive openers.

---

## 5. TEAM SIZE — The Strongest PH Signal

| Team Size | n | PH Median |
|---|---|---|
| Solo | 1,117 | **296** |
| 2 people | 729 | 369 |
| 3 people | 479 | 408 |
| 4-5 people | 585 | 411 |
| **6+ people** | **710** | **483** |

**Spearman r = +0.383, p < 0.001.** The strongest single correlation in the entire PH dataset. More makers = more votes. Linear, monotonic, highly significant.

This likely reflects team voting, network effects, and multi-channel promotion more than product quality. But the signal is undeniable: on PH, team size predicts votes better than any video feature.

---

## 6. PH TOPICS — What Categories Perform Best

| Topic | n | Median Votes |
|---|---|---|
| **Sales** | 131 | **463** |
| **Video** | 127 | **439** |
| **No-Code** | 137 | **434** |
| SaaS | 430 | 396 |
| AI | 2,022 | 392 |
| Design Tools | 320 | 390 |
| Marketing | 421 | 389 |
| Productivity | 1,052 | 377 |
| Developer Tools | 711 | 369 |
| Open Source | 248 | 348 |
| GitHub | 295 | 343 |
| Education | 138 | 332 |
| Android | 99 | 326 |

Sales tools, video tools, and no-code products outperform AI products on PH. AI is the largest category (2,022 launches) but its median (392) is below Sales (463) and Video (439). Saturation again.

---

## 7. PH RANK — Positional Effect

| Daily Rank | n | Median Votes |
|---|---|---|
| **#1** | 754 | **626** |
| #2-3 | 1,508 | 400 |
| #4-5 | 1,508 | 269 |

**r = -0.745, p < 0.001.** Rank is the strongest structural predictor. Being #1 more than doubles your votes vs #4-5. This is PH's algorithm at work — top-ranked products get displayed more prominently.

---

## 8. ENGAGEMENT QUALITY (comments/votes ratio)

**r = +0.270, p < 0.001.** Products that generate more comments per vote get more total votes. This is a virtuous cycle — engaged products get algorithmic boost.

High-engagement videos have slightly more motion (31.8 vs 27.7) and more on-screen text (29 vs 22 OCR words). They're more dynamic and information-dense.

---

## 9. INTERACTION EFFECTS — Text × Video

### Description Length × Video Quality

| | Low Quality | High Quality |
|---|---|---|
| Short description | median 317 | **median 390** |
| Long description | median 332 | **median 394** |

Video quality matters more than description length. High-quality video + any description ≈ median 390-394. Low-quality video + any description ≈ 317-332. **Quality trumps copy.**

### Team Size × Face Presence

| | No Faces | Has Faces |
|---|---|---|
| Small team (<3) | median 302 | median 349 |
| Big team (3+) | **median 404** | **median 419** |

Big team + faces = highest (419). Small team + no faces = lowest (302). The gap from team size (302→404) is much larger than the gap from faces (404→419). **Team size overpowers video features.**

### "AI" in Description × Dark Mode

| | Light Mode | Dark Mode |
|---|---|---|
| No AI mentioned | median 332 | median 317 |
| AI mentioned | median 376 | **median 397** |

AI + dark mode = highest median (397). This is the "tech product aesthetic" combo — it signals modernity. No-AI + dark = lowest (317). Dark mode without an AI story just looks somber.

### Topic × Optimal Video Style

Each PH topic has a different "strongest video signal":

| Topic | Strongest Signal | r | p |
|---|---|---|---|
| **Developer Tools** | **Bitrate** (quality) | +0.358 | **<0.001** |
| **Design Tools** | **OCR words** (text density) | +0.354 | **0.005** |
| **SaaS** | **Face %** (faces) | +0.330 | **0.009** |
| **Productivity** | **Face %** | +0.276 | **<0.001** |
| **Marketing** | **Face %** | +0.231 | 0.055 |
| **AI** | **Bitrate** | +0.170 | **0.002** |

Developer Tools and AI audiences care about video quality. SaaS, Productivity, and Marketing audiences care about seeing faces. Design Tools audiences want information-dense screens. **One video style doesn't fit all categories.**

---

## 10. COMPLETE HEAD-TO-HEAD: YC vs PH

| Pattern | YC Effect | PH Effect | Winner |
|---|---|---|---|
| **Video helps?** | No (-4) | Yes (+65, p<0.001) | **Opposite** |
| **Description sweet spot** | 500-750 words | <50 words | **Opposite** |
| **Tagline sweet spot** | 71-100 chars | <30 chars | **Opposite** |
| **"AI" in text** | Hurts (-2 to -15) | Helps (+34 to +42) | **Opposite** |
| **Numbers in title** | Hurts (-8) | Helps (+43) | **Opposite** |
| **"Free" in text** | Hurts (-8 to -13) | Hurts (-19) | **Same** |
| **Team shots** | Halves median (p=0.03) | Slight boost | **Opposite** |
| **Face presence** | Inert | Strong positive (r=+0.19) | **Different** |
| **Dark mode** | Inert (2026) | Hurts in 2026 | **Converging** |
| **Bitrate** | Inert | Strong positive (r=+0.20) | **Different** |
| **Browser chrome** | Hurts (r=-0.12) | Helps in 2026 (r=+0.22) | **Opposite** |
| **PiP** | +25 median | +56 median | **Same direction** |
| **Benefit language** | Strong positive (r=+0.15) | Positive (r=+0.06) | **Same** |
| **Metrics on screen** | Positive (r=+0.10) | Positive (r=+0.10) | **Same** |
| **Before/after** | Inert (+2) | Strong (+52, p<0.001) | **PH only** |
| **Urgency words** | Inert | Positive (+29, p=0.02) | **PH only** |
| **Team size** | Not measurable | Strongest signal (r=+0.38) | **PH only** |
| **Competitor mentions** | Hurts (r=-0.12) | Inert | **YC only** |
| **Branded intro** | Helps (+31) | Dead in 2026 | **YC only (and fading)** |
| **Visual simplicity** | Strong (r=+0.15, p=0.03) | Not measured | **YC only** |
| **Transition pacing** | Back-loaded = +29 | Not measured | **YC only** |

### Universal truths (both platforms):
- "Free" hurts
- PiP helps
- Benefit language beats feature language
- Metrics on screen help
- Questions on screen help

### Opposite everywhere:
- Description length (long on YC, short on PH)
- "AI" mention (hurts on YC, helps on PH)
- Faces (inert on YC, strong on PH)
- Browser chrome (hurts on YC, helps on PH)
- Numbers in title (hurt on YC, help on PH)

### The fundamental difference:
YC is a technical audience that reads. They reward substance, restraint, and specificity. They penalize self-promotion and visual noise.

PH is a broader audience that browses. They reward energy, social proof, and production value. They penalize obscurity and under-investment.

The same product launching on both platforms needs two different videos, two different descriptions, and two different taglines. Optimizing for one audience will actively damage performance on the other.
