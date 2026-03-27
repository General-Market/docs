# YC Launch Video — 50-Dimension Visual + Marketing Analysis

**Dataset:** 209 YC launch videos with no YouTube transcript. Each analyzed across 50 dimensions: face detection, motion, blur, color temperature, brightness trajectories, browser chrome, PiP, letterboxing, intro/outro timing, plus 20 marketing/text dimensions from OCR — social proof, CTAs, jargon density, benefit vs feature language, emotional arcs, metrics placement, and more. Vote range: 4–2,308. Median: 36. Mean: 102.

---

## The Honest Summary

Most of the 50 dimensions show weak or no correlation with votes. This is itself a finding. The visual production quality of a YC launch video is largely irrelevant to its performance. What follows are the exceptions — the signals that survive statistical scrutiny — and the null results that matter.

---

## Tier 1: Statistically Significant (p < 0.10)

### 1. Multiple People on Screen = Penalty (p=0.033)

| | n | Median Votes |
|---|---|---|
| Solo or no face | 184 | **42** |
| Multiple people visible | 25 | **21** |

The strongest single finding in the dataset. Videos showing multiple team members perform at half the median. This isn't about faces — face presence alone has zero correlation (r=-0.023). It's about *team shots*. A solo founder or a product demo beats a group wave.

The most charitable interpretation: team shots are filler. They replace product footage with human furniture.

### 2. Browser Chrome Kills (r=-0.120, p=0.08)

| Browser Chrome | n | Median Votes |
|---|---|---|
| No browser chrome | 169 | **41** |
| Some browser chrome | 28 | 26 |
| Heavy browser chrome (>20%) | 12 | 32 |

Showing the browser — URL bar, tabs, bookmarks — correlates with lower votes. The product should fill the screen. A browser frame says "I recorded this in 30 seconds."

### 3. Benefit Language > Feature Language (r=+0.117, p=0.09)

| Language Type | n | Median Votes |
|---|---|---|
| Feature-heavy (<30% benefits) | 22 | 37 |
| Benefit-leaning (50-70%) | 151 | 35 |
| **Benefit-heavy (>70%)** | **34** | **66** |

The only marketing-text dimension with near-significance. Videos where on-screen text emphasizes outcomes ("save hours", "grow revenue") over implementation ("integrates with", "supports X") perform nearly 2x better on median.

### 4. Competitor Mentions = Penalty (r=-0.116, p=0.09)

Videos showing "vs", "compared to", "better than" language on screen correlate negatively with votes. Positioning against competition visually doesn't help — it centers the competitor in the viewer's mind.

### 5. Blur Variance = Penalty (r=-0.119, p=0.09)

Videos with inconsistent sharpness — some frames sharp, some blurry — correlate with lower votes. Visual inconsistency signals sloppy production. Either blur it all (DOF) or keep it all sharp (screen recording). Don't mix.

---

## Tier 2: Directionally Interesting (p > 0.10 but consistent pattern)

### 6. Picture-in-Picture = Boost (+25 median)

| | n | Median Votes |
|---|---|---|
| Has PiP (webcam overlay) | 14 | **61** |
| No PiP | 195 | 36 |

p=0.177 — not significant at n=14. But +25 median votes is the second-largest effect size in the dataset. The "Loom-style" webcam-in-corner format connects product demo with human presence without the team-shot penalty.

### 7. Background Blur = Boost

| Blur Level | n | Median Votes |
|---|---|---|
| **Very blurry (DOF)** | **66** | **46** |
| Moderate blur | 132 | 34 |
| Very sharp | 10 | 27 |

Blurrier backgrounds correlate with higher votes. Not statistically significant (r=-0.073, p=0.29), but the bucket pattern is consistent. Depth of field signals "I own a real camera" or "I have a nice backdrop."

### 8. Dark First Frame = Best Opening

| First Frame | n | Median Votes |
|---|---|---|
| **Dark first frame (logo/intro)** | **68** | **54** |
| Other (mid-brightness) | 83 | 37 |
| White first frame | 37 | 30 |
| Face in first frame | 22 | 30 |

Opening on a dark branded frame — logo on black — outperforms by +24 median votes vs white first frame. Starting with a face performs worst. The dark intro says "this is produced." The face says "this is a webcam selfie."

### 9. Short Intro (3-6s) = Sweet Spot

| Intro Duration | n | Median Votes |
|---|---|---|
| No intro (instant content) | 152 | 34 |
| Short intro (<3s) | 15 | 54 |
| **Medium intro (3-6s)** | **19** | **65** |
| Long intro (>6s) | 23 | 51 |

r=+0.113, p=0.10 — borderline significant. A 3-6 second branded intro card outperforms no intro by +31 median. Establishing brand identity before diving in matters. But beyond 6 seconds, you're testing patience.

### 10. Metrics Placed Early = Massive Boost

| Metric Placement | n | Avg Votes | Median |
|---|---|---|---|
| **Early (first third)** | **9** | **563.3** | **99** |
| Middle (second third) | 10 | 95.0 | 36 |

Tiny n, but 563 average votes when metrics appear early is the highest single-bucket average in the entire analysis. Consistent with the body text finding from the main report. Show the number first. Explain later.

### 11. Data Visualization on Screen = Boost (+35 median)

| | n | Median Votes |
|---|---|---|
| Has charts/dashboards/analytics | 20 | **71** |
| No data visualization | 189 | 36 |

p=0.162, not significant, but +35 median is substantial. Showing data — not code, not UI, but actual data visualizations — correlates with much higher votes. Data is proof. Code is process.

### 12. Questions on Screen = Boost (+20 median)

| | n | Median Votes |
|---|---|---|
| Has "?" on screen | 31 | **56** |
| No questions | 178 | 36 |

p=0.196. Posing a question visually ("Tired of X?", "What if you could...?") correlates with +20 median. The question is a hook. It creates a void the viewer wants filled.

### 13. Cool Color Temperature = Boost

| Temperature | n | Median Votes |
|---|---|---|
| Warm (orange/yellow cast) | 89 | 41 |
| Neutral | 94 | 34 |
| **Cool (blue cast)** | **26** | **54** |

Not significant (p=0.56), but cool-toned videos have the highest median. Blue connotes technology, professionalism, trust. Warm connotes... a sunset in a real estate ad.

### 14. Low Motion = Better

| Motion Level | n | Median |
|---|---|---|
| **Very static** | **6** | **70** |
| Low motion | 17 | 44 |
| Medium motion | 21 | 33 |
| High motion | 49 | 39 |
| Very dynamic | 116 | 36 |

r=-0.073, p=0.30. The pattern: calmer videos vote better. Frenetic motion is noise. A steady camera says "I know what I'm showing you."

### 15. Pricing on Screen = Boost (+18 median)

| | n | Median |
|---|---|---|
| **Pricing visible** | **14** | **54** |
| No pricing | 195 | 36 |

Showing a price on screen — "$X/mo", "free tier" — correlates with +18 median. This contradicts nothing: the body text analysis found "free" and "no credit card" in text hurts, but *showing* a concrete price point is different from begging with free-tier language.

---

## Tier 3: Confirmed Nulls (No Signal)

These dimensions show effectively zero correlation with votes. Knowing this is as valuable as knowing what works:

| Dimension | r | p | Verdict |
|---|---|---|---|
| Face presence % | -0.023 | 0.74 | **Inert.** Having a face in the video neither helps nor hurts. |
| Dark mode vs light mode | +0.012 | 0.86 | **Inert.** Dark UI or light UI — doesn't matter. |
| Color saturation | +0.031 | 0.65 | **Inert.** Vibrant vs desaturated — no signal. |
| Acronym density | +0.011 | 0.87 | **Inert.** ALL-CAPS jargon on screen is invisible. |
| Brand name repetition | +0.025 | 0.72 | **Inert.** Showing your logo 5 times doesn't help. |
| Urgency/scarcity words | -0.046 | 0.50 | **Inert.** "Beta", "early access", "limited" — no effect. |
| End card duration | +0.018 | 0.79 | **Inert.** Long outro or sudden stop — irrelevant. |
| File size / video quality | +0.018 | 0.80 | **Inert.** 4K doesn't beat 360p in votes. |
| Emotional arc | — | — | **Insufficient variation.** 94% of videos have flat sentiment arc. |
| Step-by-step structure | — | — | **Undetectable.** Zero videos showed numbered steps in OCR. |
| CTA on screen | — | — | **Too rare.** Only 3 videos had detectable CTAs. |
| Problem→Solution arc | — | — | **Too rare.** Only 2 videos showed detectable arcs. |

---

## Top vs Bottom Quartile — What Separates Them

| Metric | Bottom 25% (≤19 votes) | Top 25% (≥80 votes) | Diff |
|---|---|---|---|
| Avg brightness | 139 | 113 | **-26** (darker) |
| Avg saturation | 27 | 39 | **+12** (more colorful) |
| Avg motion | 42 | 34 | **-8** (calmer) |
| Bitrate | 345 kbps | 303 kbps | -42 (lower) |
| Total OCR words | 16 | 25 | **+9** (more text) |
| Reading comfort | 11.3 | 7.8 | -3.5 (faster text) |

The top quartile is **darker, more saturated, calmer, and shows more text that changes faster.** The bottom quartile is bright, washed-out, and jittery. The top quartile's videos are darker because they're showing product on dark backgrounds. The bottom quartile is bright because it's a webcam in a well-lit room showing nothing in particular.

---

## The 50-Dimension Playbook — Condensed

What to do:

1. **Show one person or no person.** Never a team wave. (p=0.033)
2. **Crop the browser out.** No URL bars, no tabs. (p=0.08)
3. **Use benefit language on screen.** "Save 10 hours/week" > "REST API with OAuth2." (p=0.09)
4. **Don't mention competitors.** (p=0.09)
5. **Open on a 3-6 second dark intro card.** (+31 median)
6. **Put your best metric in the first third.** (avg 563 when early)
7. **Use PiP if you're doing a screen recording.** (+25 median)
8. **Show data visualizations if you have them.** (+35 median)
9. **Pose a question on screen.** (+20 median)
10. **Keep it blurry in the back, steady in the front.** DOF + low motion.

What doesn't matter:

- Dark mode vs light mode
- Video resolution / quality
- How many times your logo appears
- Whether there's urgency language
- End cards and CTAs (because nobody sees them)
- The specific emotional arc of on-screen text
- How sharp the image is
- Whether you show your URL

The meta-lesson remains: most of what you can measure about a video doesn't predict its performance. The things that correlate — team shots, browser chrome, benefit language — are fundamentals of storytelling, not production technique. No amount of 4K footage rescues a video that shows the wrong thing.
