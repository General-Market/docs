# YC Launch Video — Visual Analysis Findings

**Dataset:** 205 YC launch videos with no YouTube transcript. Each analyzed via frame extraction (every 3s), OCR (pytesseract), histogram-based scene transition detection, and frame type classification. Matched to vote data from 2,696 launches.

**Purpose:** Identify which visual patterns in launch videos correlate with votes — what the camera, the cuts, the text overlays, and the production choices actually do.

---

## Executive Summary — The 8 Things That Actually Matter

| # | Finding | Effect Size | Actionability |
|---|---------|------------|---------------|
| 1 | **Visual simplicity wins** — simple visuals median 48 vs complex 22 | Spearman r=+0.154, p=0.028 | High |
| 2 | **3-8 transitions is the sweet spot** | Median 48-65 vs 33 for zero cuts | High |
| 3 | **Gradual transitions beat hard cuts** | Median 44 vs 37 | Medium |
| 4 | **First cut at 5-15s correlates with best performance** | Median 51 vs 32 for <5s | High |
| 5 | **Back-loaded or front-loaded pacing both beat even pacing** | Median 51-62 vs 33 | Medium |
| 6 | **Short video + many cuts = 1.8x median votes** vs short + few cuts | 46 vs 25 | High |
| 7 | **On-screen text showing "data", "code", "demo", "deploy" = penalty** | -12 to -18 median votes | Medium |
| 8 | **Showing "platform", "team", "agent" on screen = boost** | +13 to +28 median votes | Low (confounded) |

---

## 1. Visual Simplicity

The only statistically significant frame-type correlation in the dataset.

| Simplicity Level | n | Avg Votes | Median Votes |
|---|---|---|---|
| Complex (detailed/code-heavy) | 16 | 41.3 | **22** |
| Mixed | 51 | 97.3 | 28 |
| Mostly simple | 44 | 155.9 | **48** |
| Very simple | 94 | 81.8 | **48** |

**Spearman r = +0.154, p = 0.028.** The one real signal in the visual data.

Videos dominated by simple visuals — clean backgrounds, a person talking, uncluttered scenes — outperform videos packed with UI screenshots, code, and dense visuals. The median doubles.

The detailed_visual frame type is the only frame type with a statistically significant negative correlation (r = -0.159, p = 0.023). Complexity repels attention.

---

## 2. Transition Count

| Transitions | n | Avg Votes | Median Votes |
|---|---|---|---|
| 0 (single shot) | 73 | 79.1 | 33 |
| 1-2 | 33 | 93.6 | 41 |
| **3-5** | **37** | **121.9** | **48** |
| **6-10** | **39** | **117.4** | **51** |
| 11+ | 23 | 96.3 | 32 |

Spearman r = +0.054, p = 0.44 — not statistically significant across the full range, but the bucket pattern is consistent.

The sweet spot is 3-10 transitions. Zero transitions (single continuous shot) performs 35% below the sweet spot. More than 11 collapses back to baseline — the video becomes frenetic.

At the fine-grained level, 5-6 transitions correlates with the highest medians (58-65). The 11 transition count, despite tiny n=4, shows the highest average (356) — suggesting a handful of polished demos with many well-timed cuts can explode.

---

## 3. Hard Cuts vs. Gradual Transitions

| Type | n | Avg Votes | Median Votes |
|---|---|---|---|
| No transitions | 73 | 79.1 | 33 |
| Mostly hard cuts | 96 | 102.6 | 37 |
| **Mostly gradual** | **30** | **143.9** | **44** |
| Mixed | 6 | 38.7 | 28 |

Gradual transitions (dissolves, fades) outperform hard cuts by 19% on median. This likely signals production value — videos with dissolves tend to be edited in proper software, not just screen-recorded.

---

## 4. First Cut Timing

Among the 132 videos with at least one scene transition:

| First Cut Timing | n | Avg Votes | Median Votes |
|---|---|---|---|
| <5s | 39 | 53.2 | 32 |
| **5-15s** | **50** | **151.6** | **51** |
| **15-30s** | **19** | **83.9** | **51** |
| >30s | 24 | 131.0 | 32 |

Cutting too early (<5s) performs identically to cutting too late (>30s). The optimal window is 5-30 seconds in — long enough to establish context, soon enough to signal that this isn't a static screen recording.

---

## 5. Transition Pacing

Among videos with 2+ transitions:

| Pacing Pattern | n | Avg Votes | Median Votes |
|---|---|---|---|
| Front-loaded cuts | 31 | 145.6 | 51 |
| Even pacing | 51 | 68.5 | 33 |
| **Back-loaded cuts** | **32** | **148.0** | **62** |

Even pacing — cuts distributed uniformly — performs worst. Both front-loaded (quick intro then settle) and back-loaded (build then rapid demo) outperform by 55-88%. The video needs rhythm, not monotony.

Back-loaded pacing performs best on median: the founder talks, then the product reveals accelerate toward the end. This matches the narrative structure of "here's the problem → now watch what we built."

---

## 6. Duration × Transitions Matrix

| | Few cuts (≤2) | Many cuts (>2) |
|---|---|---|
| **Short video (<65s)** | median=25, avg=58 | **median=46**, avg=73 |
| **Long video (≥65s)** | **median=44**, avg=115 | median=37, avg=146 |

The worst combination: short video with few cuts. This is a static screen recording — 25 median votes.

The best short-video strategy: pack in transitions. Short + many cuts = 1.8x the median of short + few.

For longer videos, the pattern inverts slightly: fewer cuts + longer duration performs better than many cuts + long duration. A considered, unhurried long demo beats a choppy one.

---

## 7. On-Screen Text Keywords

OCR captured product names, UI labels, and text overlays. Correlations with votes:

### Keywords That Hurt

| On-screen keyword | n | Median (with) | Median (without) | Diff |
|---|---|---|---|---|
| "demo" | 8 | 18 | 36 | **-18** |
| "search" | 11 | 19 | 36 | **-18** |
| "deploy" | 6 | 18 | 36 | **-18** |
| "ai" | 51 | 23 | 38 | **-15** |
| "build" | 13 | 23 | 36 | **-13** |
| "data" | 23 | 24 | 36 | **-12** |
| "code" | 12 | 24 | 36 | **-12** |

Showing technical terms on screen — "deploy", "data", "code" — correlates with lower votes. The video is showing implementation instead of outcome. "AI" on screen drops median by 15 points, consistent with the finding from body text analysis.

### Keywords That Help

| On-screen keyword | n | Median (with) | Median (without) | Diff |
|---|---|---|---|---|
| "platform" | 8 | 64 | 36 | **+28** |
| "free" | 7 | 56 | 36 | **+20** |
| "team" | 11 | 53 | 36 | **+18** |
| "agent" | 14 | 49 | 36 | **+13** |

Small n, likely confounded with company quality. But the direction is consistent: outcome-oriented words outperform implementation-oriented words.

---

## 8. Dominant Frame Type

| Dominant frame type | n | Avg Votes | Median Votes |
|---|---|---|---|
| UI / code | 4 | 90.8 | 53 |
| Text with visual | 6 | 60.2 | 52 |
| Dark screen | 47 | 85.3 | 44 |
| **Simple visual** | **92** | **83.4** | **37** |
| White screen | 39 | 172.2 | 36 |
| Detailed visual | 17 | 61.5 | **33** |

Videos dominated by dark frames (branded intros, dark UI themes) slightly outperform the baseline. Videos dominated by detailed visuals — busy, complex frames — perform worst.

The "white_screen dominant" category has a misleading 172 average — pulled up by outliers. Its median is 36, unremarkable.

---

## 9. Visual Variety

| # Distinct Frame Types (>5%) | n | Median Votes |
|---|---|---|
| 1 type | 35 | 37 |
| 2 types | 76 | 39 |
| **3 types** | **57** | **41** |
| 4 types | 27 | 24 |
| 5+ types | 9 | 32 |

Spearman r = -0.106, p = 0.13. Not significant, but the pattern is coherent: 2-3 visual modes is optimal. Above 4 types, the video feels scattered. Below 2, it feels static.

Top quartile videos have median 2 distinct frame types. Bottom quartile: 3. The best videos commit to a visual register and stay there.

---

## 10. Industry Differences

| Industry | n | Median Votes | Avg Duration | Avg Transitions | Avg Text Segments |
|---|---|---|---|---|---|
| Consumer | 23 | **45** | 63s | 4.6 | 5.6 |
| Healthcare | 10 | 36 | 102s | **7.7** | 6.4 |
| B2B | 133 | 34 | 92s | 3.6 | 7.4 |
| Industrials | 24 | 34 | 66s | 5.9 | 5.5 |
| Fintech | 13 | 34 | **125s** | 5.2 | **8.8** |

Consumer videos are shorter, simpler, and vote better. Healthcare videos have the most transitions — they need to show the product doing something clinical. Fintech videos are longest and most text-heavy — and it doesn't help.

---

## 11. The Meta-Finding: Video Presence

| Category | n | Avg Votes | Median Votes |
|---|---|---|---|
| **No video at all** | **1,308** | **84.9** | **38** |
| Video analysis only (no-transcript) | 205 | 98.4 | 36 |
| Transcript only | 1,004 | 81.7 | 34 |
| Has video URL but no data | 179 | 66.7 | 31 |

This confirms the prior finding from the text analysis: **launches without any video have the highest median votes (38)**. Video is not a vote multiplier. The launches that rely on writing outperform.

The no-transcript videos (our cohort) sit at median 36 — slightly above the transcripted video group (34). Having a video that people watch silently may be marginally better than one they half-listen to.

---

## Key Takeaways — The Video Playbook

1. **Keep it visually clean.** Simple backgrounds, uncluttered frames. Showing your complex dashboard screenshot is showing your homework, not your conclusion.

2. **3-8 transitions.** Not zero (boring). Not 15 (seizure-inducing). Enough to show the product, not enough to exhaust the viewer.

3. **First cut between 5 and 15 seconds.** Establish who you are, then move. Don't cut at second 2 (jarring). Don't wait until second 40 (the viewer is gone).

4. **Build toward the demo.** Back-loaded pacing (talk → then rapid product shots) produces the highest medians. The narrative arc is: "here's why you should care" → "now watch this."

5. **Avoid showing technical keywords.** "Deploy", "data", "code", "build" on screen correlates with -12 to -18 median votes. Show what the product does, not how it's built.

6. **Gradual transitions > hard cuts.** The dissolve is doing work — it signals intentionality.

7. **Short videos need more cuts.** A 30-second video with zero transitions is a screenshot that moves. Give it rhythm.

8. **Consider whether you need the video at all.** The data, once again, suggests that writing is the stronger lever. A well-written launch post with no video outperforms a poorly-produced video. The video should be undeniable — or absent.
