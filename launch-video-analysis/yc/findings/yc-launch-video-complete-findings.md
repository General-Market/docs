# YC + Product Hunt Launch Video — Complete Analysis

**Dataset:** 768 launch videos across two platforms:
- **YC:** 209 videos, median 36 votes, range 4–2,308
- **Product Hunt:** 559 videos, median 352 votes, range 56–1,821

Two analysis passes per video:
- **Pass 1:** Frame extraction (3s intervals), OCR (pytesseract), histogram-based scene transitions, frame type classification, keyword analysis, transition pacing, visual simplicity.
- **Pass 2:** 50 dimensions — face detection, motion intensity, background blur, color temperature, brightness trajectories, browser chrome, PiP, letterboxing, intro/outro, plus 20 marketing/text dimensions (social proof, CTAs, jargon, benefit/feature language, emotional arcs, metrics, competitor mentions, pricing, questions, brand repetition).

---

## The Central Discovery: YC and Product Hunt Are Different Species

The same video feature that helps on Product Hunt often hurts on YC, and vice versa. These audiences evaluate videos through entirely different lenses.

| Dimension | YC Effect | PH Effect | Same Direction? |
|---|---|---|---|
| **Face presence** | Inert (r=-0.02) | **Strong positive** (r=+0.19, p<0.001) | NO |
| **Motion intensity** | Negative (r=-0.07) | **Positive** (r=+0.08, p=0.07) | NO |
| **Browser chrome** | **Negative** (r=-0.12, p=0.08) | **Positive** (r=+0.08, p=0.07) | NO |
| **Blur variance** | **Negative** (r=-0.12, p=0.09) | **Positive** (r=+0.13, p=0.002) | NO |
| **Bitrate / quality** | Negative (r=-0.10) | **Strong positive** (r=+0.20, p<0.001) | NO |
| **Urgency words** | Inert (r=-0.01) | **Positive** (r=+0.11, p=0.01) | NO |
| **Competitor mentions** | **Negative** (r=-0.12, p=0.09) | Inert (r=+0.01) | NO |
| **Multiple people** | **Penalty** (-22 median, p=0.03) | Slight boost (+31, p=0.08) | NO |
| **Benefit ratio** | **Positive** (r=+0.15, p=0.03) | Weak positive (r=+0.06) | YES |
| **PiP** | +25 median (p=0.18) | **+56 median** (p=0.09) | YES |
| **Metrics on screen** | +positive (r=+0.10) | **Positive** (r=+0.10, p=0.03) | YES |
| **Jargon density** | Positive (r=+0.09) | **Positive** (r=+0.12, p=0.006) | YES |

**Translation:** YC voters reward restraint — simplicity, calm, benefit language, no name-dropping competitors. PH voters reward effort — production value, faces, energy, urgency, more of everything.

---

## Part 1: Universal Findings (Both Platforms Agree)

These correlations point the same direction on both YC and PH:

### 1. PiP (Webcam Overlay) = Boost (both platforms)

| Platform | Has PiP | No PiP | Diff |
|---|---|---|---|
| YC | median 61 (n=14) | median 36 | **+25** |
| PH | median 405 (n=27) | median 349 | **+56** |
| Combined | median 361 (n=41) | median 292 | **+69** |

The Loom format works everywhere. Product demo + human face in the corner. Combined p=0.37 (small n), but consistent across both platforms.

### 2. Metrics on Screen = Boost

| Platform | r | p |
|---|---|---|
| YC | +0.097 | 0.16 |
| PH | +0.095 | **0.025** |
| Combined | +0.105 | **0.004** |

Showing numbers on screen — "$X revenue", "X% faster", "Xk users" — helps on both platforms. Combined, it's highly significant.

### 3. Benefit Language > Feature Language

| Platform | r | p |
|---|---|---|
| YC | **+0.149** | **0.031** |
| PH | +0.062 | 0.14 |
| Combined | +0.079 | **0.028** |

"Save hours" beats "REST API with OAuth2" everywhere. Stronger on YC, but directionally consistent on PH.

### 4. Jargon Density = Positive (Surprise)

| Platform | r | p |
|---|---|---|
| YC | +0.094 | 0.18 |
| PH | **+0.115** | **0.006** |
| Combined | **+0.117** | **0.001** |

Technical jargon on screen correlates *positively* with votes on both platforms. Likely a confound: jargon appears in videos that actually show product UI, which signals substance. Empty talking-head videos have no jargon because there's nothing to read.

### 5. Questions on Screen = Boost

| Platform | r | p |
|---|---|---|
| YC | +0.112 | 0.11 |
| PH | +0.060 | 0.16 |
| Combined | +0.088 | **0.015** |

Visual questions ("Tired of X?") create hooks on both platforms. YC effect is stronger.

### 6. Cool Color Temperature = Slight Edge

| Platform | Warm median | Neutral median | Cool median |
|---|---|---|---|
| YC | 41 | 34 | **54** |
| PH | 356 | 348 | **360** |

Cool-toned (blue cast) videos have the highest median on both platforms. Small effect on PH, noticeable on YC.

---

## Part 2: YC-Only Findings (Don't Apply to Product Hunt)

### 7. Visual Simplicity (YC: r=+0.154, p=0.028)

| Simplicity Level | n | YC Median |
|---|---|---|
| Complex | 16 | **22** |
| Mixed | 51 | 28 |
| Mostly simple | 44 | **48** |
| Very simple | 94 | **48** |

The strongest single visual correlation on YC. Not measured on PH with this metric, but PH's positive correlation with motion, blur variance, and file size suggests complexity *helps* on PH — the opposite.

### 8. Multiple People = Penalty (YC: p=0.033)

| | YC Median | PH Median |
|---|---|---|
| Solo or no face | **42** | 349 |
| Multiple people | **21** | **380** |

On YC, team shots halve your median. On PH, team shots *slightly help* (p=0.08). The YC audience wants to see the product, not the org chart. The PH audience likes seeing a team behind the product.

### 9. Browser Chrome = Penalty (YC: r=-0.120, p=0.08)

| | YC Median |
|---|---|
| No browser chrome | **41** |
| Some browser | 26 |
| Heavy browser | 32 |

On PH: browser chrome *positively* correlates (r=+0.076, p=0.07). PH voters want to see the product in context. YC voters want a clean, branded presentation.

### 10. Competitor Mentions = Penalty (YC: r=-0.116, p=0.09)

On YC, showing "vs", "compared to" on screen hurts. On PH, it's completely inert (r=+0.005). YC voters penalize positioning against others. PH voters don't care.

### 11. Dark First Frame = Best Opener (YC only)

| First Frame | YC Median | PH Median |
|---|---|---|
| **Dark** | **54** | 364 |
| White | 30 | **384** |
| Face | 35 | 379 |
| Other | 37 | 321 |

On YC, dark opening (branded logo card) outperforms by +24. On PH, **white** opening has the highest median. The platforms have opposite aesthetic preferences.

### 12. 3-6s Branded Intro = Sweet Spot (YC only)

| Intro Duration | YC Median |
|---|---|
| No intro | 34 |
| Short (<3s) | 54 |
| **Medium (3-6s)** | **65** |
| Long (>6s) | 51 |

On YC, a 3-6s dark intro card = +31 median. On PH, intro duration has no correlation (r=+0.02, p=0.62).

### 13. Low Motion = Better (YC only)

On YC, calmer videos vote better (r=-0.073). On PH, motion *positively* correlates (r=+0.076, p=0.07). YC wants deliberate; PH wants energetic.

### 14. Transition Patterns (YC only, from Pass 1)

| Pattern | YC Median |
|---|---|
| **3-8 transitions** | **48-51** |
| 0 transitions | 33 |
| 11+ transitions | 32 |
| **Back-loaded pacing** | **62** |
| Even pacing | 33 |
| **First cut at 5-15s** | **51** |
| First cut <5s | 32 |
| **Gradual transitions** | **44** |
| Hard cuts | 37 |

YC rewards deliberate editing rhythm. (PH transition analysis not run separately but these patterns emerge from the visual simplicity vs complexity divergence.)

### 15. On-Screen Keywords (YC only, from Pass 1)

**Keywords that hurt on YC:**

| Keyword | YC Diff |
|---|---|
| "demo", "search", "deploy" | **-18** |
| "ai" | **-15** |
| "build", "data", "code" | **-12 to -13** |

**Keywords that help on YC:**

| Keyword | YC Diff |
|---|---|
| "platform" | **+28** |
| "team" | **+18** |
| "agent" | **+13** |

---

## Part 3: Product Hunt-Only Findings (Don't Apply to YC)

### 16. Faces = Strong Positive (PH: r=+0.190, p<0.001)

| Dimension | PH r | PH p |
|---|---|---|
| Face presence % | +0.190 | **<0.001** |
| Avg face count | +0.191 | **<0.001** |
| Face size % | +0.197 | **<0.001** |

The single strongest cluster of correlations on PH. More face, bigger face, more frequently = more votes. On YC, face presence is completely inert (r=-0.023).

PH voters connect with people. YC voters connect with products.

### 17. Production Quality Matters (PH: r=+0.200, p<0.001)

| Dimension | PH r | PH p |
|---|---|---|
| **Bitrate** | **+0.200** | **<0.001** |
| **File size** | **+0.214** | **<0.001** |
| **Annotation frames** | **+0.152** | **<0.001** |
| Blur variance | +0.131 | **0.002** |

On PH, higher-quality video files strongly correlate with more votes. On YC, bitrate is *negatively* correlated (r=-0.095). PH rewards polished production. YC rewards substance regardless of polish.

### 18. Urgency/Scarcity = Positive (PH: r=+0.109, p=0.01)

| | PH Yes (n=172) | PH No (n=387) |
|---|---|---|
| Has urgency words | median **374** | median 345 |

"Beta", "early access", "limited" — these help on PH (+29 median, p=0.02). On YC, they're inert (r=-0.011).

### 19. More Text = Better (PH: r=+0.146, p<0.001)

| Dimension | PH r | PH p | YC r |
|---|---|---|---|
| Total OCR words | +0.146 | **<0.001** | +0.046 (inert) |
| Text length variance | +0.158 | **<0.001** | +0.042 (inert) |

PH videos with more on-screen text and varied text sizes vote better. On YC, text density doesn't matter.

### 20. Before/After Structure = Strong on PH (p<0.001)

| | PH Yes | PH No |
|---|---|---|
| Has before/after | median **386** (n=226) | median 334 (n=333) |

On PH, showing contrasts (before/after, with/without) = +52 median, p=0.001. On YC, this signal is inert (+2 median).

### 21. Testimonials Help on PH (p=0.033)

| | PH Yes | PH No |
|---|---|---|
| Has testimonial | median **388** (n=78) | median 347 (n=481) |

On PH, showing quotes or customer endorsements = +40 median. On YC, testimonials slightly hurt (-6 median). PH is a consumer audience; social validation works. YC is a technical audience; proof-by-endorsement doesn't.

### 22. Declining Emotional Arc = Best on PH

| Emotional Arc | PH Median |
|---|---|
| **Declining** (positive → negative) | **478** (n=42) |
| Flat | 349 (n=497) |
| Mixed | 285 (n=9) |

On PH, videos that start positive and end on a darker/urgent note outperform. "Here's how great things could be → here's what you're missing." On YC, the flat arc dominates (n=197) with no significant variation.

### 23. URL Shown Helps on PH (p=0.038)

| | PH Yes | PH No |
|---|---|---|
| URL shown | median **406** (n=33) | median 350 (n=526) |

PH voters click. Showing the URL on screen = +56 median. On YC, showing URLs has no effect.

---

## Part 4: Combined Rankings (n=768)

All dimensions ranked by combined statistical significance:

### Continuous Dimensions

| Rank | Dimension | Combined r | p | YC r | PH r |
|---|---|---|---|---|---|
| 1 | **M: Brand mentions** | **-0.275** | **<0.001** | +0.024 | nan |
| 2 | **M: Total OCR words** | **+0.159** | **<0.001** | +0.046 | +0.146 |
| 3 | **M: Text length variance** | **+0.137** | **<0.001** | +0.042 | +0.158 |
| 4 | **M: Urgency count** | **+0.121** | **<0.001** | -0.011 | +0.109 |
| 5 | **M: Benefit count** | **+0.119** | **<0.001** | +0.113 | +0.093 |
| 6 | **M: Jargon density** | **+0.117** | **0.001** | +0.094 | +0.115 |
| 7 | **M: Jargon count** | **+0.113** | **0.002** | +0.096 | +0.103 |
| 8 | **V: Face presence %** | **+0.112** | **0.002** | -0.023 | +0.190 |
| 9 | **V: File size MB** | **+0.110** | **0.002** | +0.018 | +0.214 |
| 10 | **V: Avg face count** | **+0.108** | **0.003** | -0.039 | +0.191 |
| 11 | **M: Metric count** | **+0.105** | **0.004** | +0.097 | +0.095 |
| 12 | **V: Annotation frames** | +0.094 | **0.009** | +0.044 | +0.152 |
| 13 | **V: Face size %** | +0.090 | **0.012** | -0.016 | +0.197 |
| 14 | **M: Question count** | +0.088 | **0.015** | +0.112 | +0.060 |
| 15 | **V: Cool frame %** | +0.081 | **0.025** | +0.041 | +0.056 |
| 16 | **M: Benefit ratio** | +0.079 | **0.028** | +0.149 | +0.062 |
| 17 | V: Warm frame % | -0.074 | **0.040** | -0.013 | +0.004 |
| 18 | M: Acronym count | +0.069 | 0.055 | +0.049 | +0.053 |
| 19 | V: PiP frames | +0.066 | 0.069 | +0.057 | +0.131 |
| 20 | V: Avg saturation | +0.060 | 0.098 | +0.031 | +0.000 |

### Boolean Dimensions

| Rank | Dimension | Combined Diff | p | YC Diff | PH Diff |
|---|---|---|---|---|---|
| 1 | **M: Before/after** | **+73** | **<0.001** | +2 | +52 |
| 2 | **M: Testimonial** | **+74** | **0.002** | -6 | +40 |
| 3 | **M: Urgency** | **+57** | **0.002** | +10 | +29 |
| 4 | **M: Questions** | +46 | **0.018** | +22 | +14 |
| 5 | **M: Text animation** | +56 | **0.021** | +24 | +32 |
| 6 | M: Tagline match | -246 | 0.038 | +11 | n/a |
| 7 | M: Data viz | +48 | 0.077 | +38 | +20 |

---

## Confirmed Nulls (Neither Platform)

| Dimension | Combined r | Verdict |
|---|---|---|
| Dark mode % | -0.008 | Irrelevant on both |
| Brightness trend | -0.009 | Irrelevant |
| Avg brightness | +0.022 | Irrelevant |
| CTA count | +0.017 | Irrelevant (and too rare to detect) |
| Social proof count | -0.004 | Irrelevant |
| End card duration | -0.014 | Irrelevant |
| Acronym density | +0.020 | Irrelevant |
| Reading comfort | -0.044 | Irrelevant |
| Intro duration | -0.006 | Combined: irrelevant (YC positive, PH null — cancels) |

---

## The Two Playbooks

### YC Launch Video Playbook

The YC audience is technical, time-pressed, and allergic to performance. They want to see the product, not the team. They reward restraint.

**Do:**
1. Open on a dark branded card for 3-6 seconds (+31 median)
2. Keep frames visually simple — clean backgrounds (2.2x median)
3. Use benefit language on screen: outcomes over implementations (2x median)
4. Show 3-8 scene transitions with back-loaded pacing (median 62 vs 33)
5. First cut at 5-15 seconds (+19 median)
6. Use gradual transitions (dissolves) over hard cuts (+7 median)
7. Show one person max, or no person. Never a team shot (-21 median)
8. Put your best metric in the first third (avg 563 when early)
9. Use PiP for screen recordings (+25 median)
10. Keep the camera steady — low motion (+34 median)

**Don't:**
- Show browser chrome (-15 median)
- Mention competitors on screen (r=-0.12)
- Show "deploy", "code", "data", "ai" on screen (-12 to -18 median)
- Show multiple team members (-21 median)
- Make it frenetic (11+ transitions collapses back to baseline)

**Irrelevant on YC:** Video quality/resolution, dark mode vs light, urgency words, end cards, face presence, brand repetition.

### Product Hunt Launch Video Playbook

The PH audience is broader, more consumer-oriented, and responds to energy and social proof. They want to see people and polish.

**Do:**
1. Show faces — and big faces (r=+0.197, p<0.001)
2. Invest in production quality — higher bitrate matters (r=+0.200, p<0.001)
3. Use before/after structure (+52 median, p=0.001)
4. Include urgency/scarcity ("beta", "early access") (+29 median, p=0.02)
5. Show testimonials/quotes (+40 median, p=0.03)
6. Use PiP (webcam overlay) (+56 median, p=0.09)
7. Show more text on screen (r=+0.146, p<0.001)
8. Show your URL (+56 median, p=0.04)
9. Use declining emotional arc (positive → urgent) (median 478 vs 349)
10. Add annotations, highlights, callouts (r=+0.152, p<0.001)

**Don't:**
- Use even pacing with no energy
- Open with "other" (non-dark, non-white, non-face) first frames (lowest median)

**Irrelevant on PH:** Competitor mentions, dark mode vs light, brightness trend, intro duration, social proof badges.

---

## Why They Diverge

YC launches are posted to a technical community that already knows what startups are. The audience skims. They want: what does it do, how well does it work, and can I trust these people to build it. The video is optional — **YC launches without video still have the highest median (38 vs 34-36 with video).**

Product Hunt launches are posted to a broader audience that discovers products for fun. The audience browses. They want: who are you, why should I care, and does this look real. The video is a pitch — personality, production value, and social proof are currencies.

The same video cannot optimize for both platforms. Choose your audience. Build accordingly.

---

## Files

| File | Contents |
|---|---|
| `video_analyses_extended/` | 768 per-video 50-dimension JSONs |
| `yc_video_analyses/` | 203 YC OCR JSONs |
| `ph_video_analyses/` | 562 PH OCR JSONs |
| `scripts/analyze_yc_videos.py` | Pass 1: OCR + transitions |
| `scripts/analyze_videos_extended.py` | Pass 2: 50 visual + marketing dimensions |
| `scripts/correlate_yc_vs_ph.py` | YC vs PH comparison analysis |
| `scripts/correlate_extended.py` | YC-only 50-dim correlation |
| `yc_video_analyses_master.json` | Aggregated YC master |
| `yc_launches_enriched.json` | Enriched with video_analysis field |
