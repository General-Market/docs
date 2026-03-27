# PH Transcript Analysis — Complete Findings

**Dataset:** 1712 Product Hunt transcripts with ≥20 words.
**Date range:** 2023-03-25 to 2026-03-22
**Vote range:** 118 to 9861
**Median votes:** 389.0

- 2023: 411 transcripts, median 350 votes
- 2024: 587 transcripts, median 454 votes
- 2025: 568 transcripts, median 371.5 votes
- 2026: 146 transcripts, median 327.0 votes

---

## 1. Opening Hooks

| Hook Type | n | Median Votes | Mean Votes |
|---|---|---|---|
| **founder_story** | 6 | 448 | 506 |
| **pain_point** | 88 | 402 | 455 |
| **greeting** | 632 | 400 | 464 |
| **announcement** | 60 | 399 | 422 |
| **demo_instruction** | 45 | 391 | 451 |
| **bold_claim** | 60 | 385 | 486 |
| **descriptive** | 642 | 378 | 429 |
| **stat_number** | 74 | 374 | 475 |
| **product_statement** | 38 | 373 | 436 |
| **question** | 67 | 363 | 448 |

### Hook Type Shifts by Year

| Hook Type | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|
| descriptive | 352 (n=138) | 428 (n=162) | 377 (n=263) | 334 (n=79) |
| greeting | 351 (n=159) | 463 (n=246) | 392 (n=192) | 332 (n=35) |
| pain_point | 341 (n=31) | 475 (n=41) | 344 (n=14) | 288 (n=2) |
| stat_number | 334 (n=20) | 488 (n=39) | 348 (n=11) | 254 (n=4) |
| question | 324 (n=12) | 446 (n=26) | 358 (n=23) | 312 (n=6) |
| announcement | 373 (n=13) | 467 (n=17) | 356 (n=24) | 330 (n=6) |
| bold_claim | 326 (n=22) | 453 (n=34) | 299 (n=4) | — |
| demo_instruction | 397 (n=8) | 487 (n=12) | 352 (n=18) | 252 (n=7) |

### First-Person Opener

| | n | Median | Mean |
|---|---|---|---|
| First-person (I/We) | 436 | 396 | 473 |
| Other | 1276 | 384 | 440 |

### Negative Opener Words

- **"broken"**: n=4, median=310, mean=322
- **"tired"**: n=22, median=382, mean=482
- **"hate"**: n=3, median=396, mean=537
- **"frustrated"**: n=1, median=337, mean=337
- **"problem"**: n=4, median=435, mean=436

### Opening Sentence Length

| Length | n | Median |
|---|---|---|
| Short (≤10 words) | 469 | 370 |
| Long (>10 words) | 1243 | 395 |

---

## 2. Transcript Length

| Word Count | n | Median | Mean |
|---|---|---|---|
| 0-50 | 82 | 360 | 431 |
| 50-100 | 163 | 379 | 426 |
| 100-150 | 210 | 397 | 443 |
| 150-200 | 211 | 389 | 447 |
| 200-300 | 299 | 387 | 455 |
| 300-500 | 353 | 409 | 485 |
| 500+ | 394 | 372 | 428 |

**Spearman r = -0.007** (word count vs votes)

### Optimal Length by Year

- **2023**: Best bucket = 150-200 (median 371)
- **2024**: Best bucket = 300-500 (median 478)
- **2025**: Best bucket = 300-500 (median 397)
- **2026**: Best bucket = 100-150 (median 348)

---

## 3. Linguistic Patterns

- Avg sentence length vs votes: r = 0.111
- Word diversity vs votes: r = 0.059
- Flesch-Kincaid grade vs votes: r = 0.118

### Pronoun Strategy

| Strategy | n | Median |
|---|---|---|
| mostly_we | 135 | 410 |
| neutral | 59 | 396 |
| balanced | 224 | 390 |
| mostly_you | 1294 | 385 |

### Hedge Words

| | n | Median |
|---|---|---|
| Has hedge words | 484 | 402 |
| No hedge words | 1228 | 383 |

### Filler Words

Spearman r = 0.015 (filler count vs votes)

---

## 4. Narrative Arc

| Arc | n | Median | Mean |
|---|---|---|---|
| problem→solution→neutral | 10 | 536 | 583 |
| too_short | 880 | 406 | 474 |
| neutral→neutral→problem | 10 | 399 | 421 |
| traction_first | 36 | 391 | 433 |
| problem_heavy | 27 | 367 | 390 |
| solution_first | 510 | 364 | 426 |

### Topic Transitions

| Density | n | Median |
|---|---|---|
| focused (≤2) | 1194 | 397 |
| mid (3-5) | 190 | 373 |
| choppy (≥6) | 328 | 360 |

### Problem vs Solution Time

- Problem % vs votes: r = 0.136
- Solution % vs votes: r = 0.140

---

## 5. Traction & Metrics

Number density vs votes: r = 0.114

### Metric Count

| Metrics | n | Median |
|---|---|---|
| 0 | 876 | 381 |
| 1-2 | 493 | 393 |
| 3-5 | 215 | 417 |
| 6+ | 128 | 397 |

### Metric Placement

| Position | n | Median |
|---|---|---|
| front | 468 | 402 |
| middle | 199 | 381 |
| back | 169 | 398 |
| none | 876 | 381 |

### Before/After Claims

| | n | Median |
|---|---|---|
| Has before/after | 30 | 388 |
| No before/after | 1682 | 389 |

### Success Claim Types

- **cost_savings**: n=6, median=644
- **revenue**: n=75, median=388
- **users**: n=33, median=480

---

## 6. Social Proof & Credibility

| | n | Median |
|---|---|---|
| Has brand mention | 740 | 393 |
| No brands | 972 | 385 |

### Top Brands by Median Votes

| Brand | n | Median |
|---|---|---|
| dropbox | 6 | 478 |
| hubspot | 19 | 478 |
| figma | 32 | 472 |
| linkedin | 84 | 455 |
| facebook | 27 | 431 |
| salesforce | 22 | 428 |
| google | 226 | 424 |
| stripe | 28 | 419 |
| slack | 111 | 417 |
| zoom | 58 | 412 |
| spotify | 8 | 407 |
| notion | 82 | 406 |

Investor mention: has=57 (median 482), no=1655 (median 388)

"Trusted by": has=29 (median 330), no=1683 (median 391)

---

## 7. Competitive Framing

- **alternative_to**: n=15, median=402
- **better_than**: n=26, median=441
- **faster_than**: n=32, median=434
- **cheaper_than**: n=6, median=309
- **replaces**: n=38, median=384
- **unlike**: n=30, median=470
- **compared_to**: n=30, median=414

### Category Creation Language

- **the_first**: n=282, median=392
- **the_only**: n=54, median=391
- **a_new_kind**: n=7, median=596
- **we_invented**: n=148, median=394

### Replacement Framing

Has replacement framing: n=76, median=414
No replacement framing: n=1636, median=388

---

## 8. Call to Action

| CTA Type | n | Median |
|---|---|---|
| beta | 17 | 500 |
| waitlist | 8 | 498 |
| limited | 24 | 416 |
| get_started | 112 | 409 |
| free | 228 | 395 |
| try | 164 | 386 |
| join | 105 | 385 |
| book_demo | 129 | 384 |
| none | 801 | 383 |
| sign_up | 124 | 373 |

Discount language: has=464 (median 394), no=1248 (median 386)

Scarcity language: has=122 (median 404), no=1590 (median 388)

### CTA Position

| Position | n | Median |
|---|---|---|
| start | 198 | 392 |
| middle | 147 | 400 |
| end | 566 | 393 |
| none | 801 | 383 |

---

## 9. Key Phrases & Power Words

| Phrase | n | Median | Diff vs Rest |
|---|---|---|---|
| 10x | 10 | 402 | +13 |
| ai | 901 | 402 | +13 |
| all_in_one | 74 | 409 | +20 |
| api | 169 | 382 | -7 |
| automate | 502 | 379 | -10 |
| dashboard | 178 | 390 | +1 |
| developer | 184 | 395 | +6 |
| enterprise | 46 | 363 | -26 |
| gpt | 125 | 351 | -38 |
| integration | 270 | 409 | +20 |
| no_code | 51 | 370 | -19 |
| open_source | 96 | 367 | -22 |
| privacy | 94 | 402 | +14 |
| real_time | 159 | 383 | -6 |
| startup | 57 | 393 | +4 |
| workflow | 164 | 404 | +16 |

### Buzzwords

Has buzzwords: n=167, median=393
No buzzwords: n=1545, median=389

### Action Verbs

Action verb count vs votes: r = 0.108

### AI Mention Density

Mentions AI: n=901, median=402
No AI mention: n=811, median=373

### AI Mention by Year

- 2023: 41% mention AI | with AI median=349, without=350
- 2024: 50% mention AI | with AI median=486, without=418
- 2025: 64% mention AI | with AI median=384, without=364
- 2026: 54% mention AI | with AI median=344, without=315

---

## 10. Sentiment

| Sentiment | n | Median |
|---|---|---|
| positive | 849 | 394 |
| neutral | 692 | 388 |
| negative | 171 | 357 |

---

## 11. Demo Walkthrough & Pricing

Has demo walkthrough: n=250, median=363
No demo: n=1462, median=394

Mentions pricing: n=306, median=392
No pricing: n=1406, median=388

---

## 12. Video-Script Dimensions

These dimensions translate the 200 visual/audio findings into script-level patterns.

### Before/After Narrative Structure
Has before→after flow: n=455, median=392
No before/after: n=1257, median=388

### Declining Emotional Arc (positive start → urgency at end)
Has declining arc: n=91, median=383
No declining arc: n=1621, median=391

### URL/Website Mention
Mentions URL: n=292, median=362
No URL: n=1420, median=394

### Questions Throughout Script
Question marks vs votes: r = 0.193

### Data Visualization Narration
Data viz cues vs votes: r = 0.214

### Screen Narration ('here you can see', 'on the left')
Screen narration vs votes: r = 0.233

### Benefit-to-Feature Ratio
Benefit ratio vs votes: r = 0.050
| Ratio | n | Median |
|---|---|---|
| benefit-heavy (≥70%) | 497 | 396 |
| balanced | 897 | 381 |
| feature-heavy (≤30%) | 318 | 394 |

### Energy/Pacing Markers
Energy markers vs votes: r = 0.325

### Storytelling/Anecdote
Has storytelling: n=131, median=445
No storytelling: n=1581, median=386

### Humor/Lightness
Has humor: n=18, median=411
No humor: n=1694, median=389

### Feature Listing ('first...', 'second...', 'also...')
Feature list markers vs votes: r = 0.183

### Multiple Speakers
Multiple speakers: n=47, median=360
Single speaker: n=1665, median=389

### Product Name Repetition
Name density vs votes: r = 0.143
| Density | n | Median |
|---|---|---|
| 0 mentions | 1007 | 383 |
| light (0-2/100w) | 475 | 392 |
| moderate (2-5/100w) | 212 | 398 |
| heavy (5+/100w) | 18 | 402 |

### Closing Patterns (last 2 sentences)

| Closing Element | Has (n, median) | Without (n, median) |
|---|---|---|
| CTA in closing | 610, 388 | 1102, 390 |
| URL in closing | 116, 394 | 1596, 388 |
| Thanks/bye in closing | 417, 384 | 1295, 391 |

### Social Proof Claims ('companies like X', 'used by Y')
Social proof claims vs votes: r = 0.362

### Production Elements ([Music], [Applause])
Has production markers: n=513, median=384
No markers: n=1199, median=392

---

## 13. TEMPORAL SHIFTS — What Changed Year Over Year

This is the core finding: which dimensions are shifting over time on PH.

### Per-Year Spearman Correlations (dimension vs votes)

| Dimension | 2023 | 2024 | 2025 | 2026 | Shift (first→last) |
|---|---|---|---|---|---|
| Transcript Length | -0.069 | +0.042 | -0.042 | -0.046 | +0.023 |
| Avg Sentence Length | -0.007 | +0.044 | +0.015 | -0.001 | +0.006 |
| Word Diversity | +0.127* | +0.019 | +0.092 | +0.056 | -0.071 |
| Reading Level (FK) | -0.005 | +0.046 | +0.034 | +0.076 | +0.081 |
| Hedge Words | +0.182* | +0.217* | +0.148* | +0.241* | +0.059 |
| Confidence Words | +0.001 | +0.043 | +0.060 | +0.044 | +0.043 |
| Filler Words | +0.022 | +0.073 | -0.013 | -0.069 | -0.092 |
| Number Density | +0.136* | +0.105* | +0.123* | +0.159* | +0.023 |
| Before/After Claims | +0.487* | +0.482* | +0.470* | +0.476* | -0.011 |
| Brand Mentions | +0.064 | +0.135* | +0.110* | +0.184* | +0.121 |
| Competitive Phrases | +0.424* | +0.432* | +0.375* | +0.409* | -0.015 |
| Buzzwords | +0.359* | +0.416* | +0.384* | +0.328* | -0.032 |
| Action Verbs | +0.082 | +0.050 | +0.153* | +0.025 | -0.056 |
| AI Mentions | +0.142* | +0.234* | +0.039 | +0.128* | -0.014 |
| AI Density | +0.157* | +0.197* | +0.068 | +0.150* | -0.006 |
| Demo Instructions | +0.475* | +0.428* | +0.167* | +0.222* | -0.253 |
| Problem % | +0.152* | +0.149* | +0.036 | +0.073 | -0.079 |
| Solution % | +0.181* | +0.177* | +0.050 | +0.160* | -0.020 |
| Platform Mentions | +0.108* | +0.171* | +0.185* | +0.169* | +0.060 |
| Passive Voice | +0.033 | +0.113* | +0.071 | +0.165* | +0.132 |
| We-Pronouns | +0.007 | +0.044 | +0.004 | -0.062 | -0.069 |
| You-Pronouns | -0.079 | +0.033 | -0.091 | -0.042 | +0.037 |
| Topic Transitions | +0.294* | +0.315* | -0.058 | -0.029 | -0.323 |
| Success Claims | +0.429* | +0.404* | +0.428* | +0.419* | -0.010 |
| Questions Throughout | +0.472* | +0.464* | +0.058 | +0.034 | -0.438 |
| Question Sentences | +0.472* | +0.464* | +0.058 | +0.034 | -0.438 |
| Data Viz Narration | +0.190* | +0.183* | +0.215* | +0.314* | +0.124 |
| Screen Narration | +0.166* | +0.210* | +0.269* | +0.274* | +0.109 |
| Benefit Ratio | +0.055 | -0.004 | +0.107* | -0.055 | -0.110 |
| Benefit Words | +0.001 | +0.042 | +0.138* | +0.017 | +0.016 |
| Feature Words | +0.002 | +0.106* | +0.084 | +0.121* | +0.119 |
| Energy/Pacing Markers | +0.252* | +0.337* | +0.327* | +0.429* | +0.177 |
| Speaker Changes | +0.285* | +0.334* | +0.340* | +0.324* | +0.039 |
| Feature List Markers | +0.152* | +0.173* | +0.181* | +0.297* | +0.145 |
| Social Proof Claims | +0.340* | +0.389* | +0.347* | +0.407* | +0.067 |
| Product Name Repeats | +0.061 | +0.229* | +0.148* | +0.170* | +0.109 |
| Product Name Density | +0.084 | +0.225* | +0.153* | +0.192* | +0.108 |
| Production Markers ([Music] etc) | +0.175* | +0.170* | +0.139* | +0.268* | +0.092 |

\* = |r| > 0.10 (directionally meaningful)

### Biggest Shifts (sorted by |shift|)

| Dimension | Shift | Direction | Interpretation |
|---|---|---|---|
| Questions Throughout | -0.438 | ↓ declining | +0.472 (2023) → +0.034 (2026) |
| Question Sentences | -0.438 | ↓ declining | +0.472 (2023) → +0.034 (2026) |
| Topic Transitions | -0.323 | ↓ declining | +0.294 (2023) → -0.029 (2026) |
| Demo Instructions | -0.253 | ↓ declining | +0.475 (2023) → +0.222 (2026) |
| Energy/Pacing Markers | +0.177 | ↑ growing | +0.252 (2023) → +0.429 (2026) |
| Feature List Markers | +0.145 | ↑ growing | +0.152 (2023) → +0.297 (2026) |
| Passive Voice | +0.132 | ↑ growing | +0.033 (2023) → +0.165 (2026) |
| Data Viz Narration | +0.124 | ↑ growing | +0.190 (2023) → +0.314 (2026) |
| Brand Mentions | +0.121 | ↑ growing | +0.064 (2023) → +0.184 (2026) |
| Feature Words | +0.119 | ↑ growing | +0.002 (2023) → +0.121 (2026) |
| Benefit Ratio | -0.110 | ↓ declining | +0.055 (2023) → -0.055 (2026) |
| Product Name Repeats | +0.109 | ↑ growing | +0.061 (2023) → +0.170 (2026) |
| Screen Narration | +0.109 | ↑ growing | +0.166 (2023) → +0.274 (2026) |
| Product Name Density | +0.108 | ↑ growing | +0.084 (2023) → +0.192 (2026) |
| Production Markers ([Music] etc) | +0.092 | ↑ growing | +0.175 (2023) → +0.268 (2026) |

### Boolean Dimension Shifts

| Dimension | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|
| First-Person Opener | 21% (+13) | 24% (-2) | 30% (+22) | 26% (+18) |
| Negative Opener | 3% (-4) | 3% (+53) | 2% (-64) | 2% (+0) |
| Discount Language | 31% (+14) | 27% (+2) | 26% (+3) | 23% (+8) |
| Scarcity Language | 8% (+43) | 7% (+58) | 7% (+19) | 3% (-68) |
| Pricing Mention | 15% (-36) | 19% (+44) | 17% (-15) | 24% (+15) |
| Testimonial/Quote | 5% (-26) | 6% (-30) | 9% (+7) | 11% (+44) |
| Trusted-By Pattern | 2% (-56) | 1% (+52) | 2% (-42) | 3% (+50) |
| Investor Mention | 3% (-84) | 4% (+80) | 3% (+108) | 3% (+194) |
| Founder Credential | 0% (-113) | 0% (+124) | 1% (-34) | 1% (-34) |
| Partnership Mention | 11% (+26) | 15% (+39) | 9% (+101) | 8% (+35) |
| Before/After Narrative | 25% (-28) | 27% (-14) | 28% (+26) | 24% (-3) |
| Declining Emotional Arc | 1% (-82) | 2% (+50) | 10% (+14) | 12% (+7) |
| URL/Website Mention | 18% (-39) | 15% (-50) | 18% (-10) | 18% (+6) |
| Storytelling/Anecdote | 6% (-32) | 9% (+116) | 8% (+24) | 6% (+19) |
| Humor/Lightness | 1% (+31) | 1% (+114) | 1% (+40) | 1% (-119) |
| CTA in Closing | 39% (-41) | 41% (-25) | 29% (+10) | 27% (+8) |
| URL in Closing | 10% (-38) | 9% (-14) | 3% (+65) | 3% (+108) |
| Thanks/Bye in Closing | 30% (+12) | 28% (-14) | 18% (-34) | 17% (-52) |

Format: usage% (median vote lift vs without)

### Hook Type Market Share by Year

| Hook | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|
| announcement | 3% | 3% | 4% | 4% |
| bold_claim | 5% | 6% | 1% | 0% |
| demo_instruction | 2% | 2% | 3% | 5% |
| descriptive | 34% | 28% | 46% | 54% |
| founder_story | 0% | 1% | 0% | 0% |
| greeting | 39% | 42% | 34% | 24% |
| pain_point | 8% | 7% | 2% | 1% |
| product_statement | 2% | 1% | 3% | 5% |
| question | 3% | 4% | 4% | 4% |
| stat_number | 5% | 7% | 2% | 3% |

### CTA Type Shifts

| CTA | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|
| beta | 1% (med 379) | 1% (med 532) | 1% (med 685) | 0% (med 0) |
| book_demo | 7% (med 288) | 8% (med 428) | 8% (med 411) | 6% (med 304) |
| free | 14% (med 345) | 13% (med 501) | 13% (med 388) | 14% (med 358) |
| get_started | 6% (med 351) | 7% (med 434) | 6% (med 342) | 9% (med 341) |
| join | 6% (med 381) | 8% (med 426) | 5% (med 363) | 4% (med 288) |
| limited | 2% (med 426) | 1% (med 545) | 1% (med 408) | 1% (med 294) |
| none | 45% (med 349) | 44% (med 460) | 49% (med 369) | 54% (med 323) |
| sign_up | 9% (med 395) | 8% (med 388) | 6% (med 331) | 4% (med 232) |
| try | 10% (med 353) | 9% (med 465) | 10% (med 374) | 7% (med 348) |
| waitlist | 0% (med 202) | 0% (med 790) | 1% (med 399) | 1% (med 899) |

### Narrative Arc Shifts

| Arc | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|
| neutral_to_solution | 2% (med 325) | 3% (med 537) | 11% (med 367) | 10% (med 310) |
| neutral→neutral→neutral | 0% (med 526) | 1% (med 414) | 8% (med 331) | 10% (med 373) |
| problem_heavy | 1% (med 511) | 0% (med 424) | 3% (med 392) | 5% (med 194) |
| problem→solution→solution | 0% (med 0) | 0% (med 655) | 4% (med 356) | 3% (med 342) |
| solution_first | 9% (med 291) | 10% (med 428) | 59% (med 381) | 57% (med 339) |
| too_short | 87% (med 359) | 83% (med 456) | 5% (med 378) | 3% (med 210) |
| traction_first | 0% (med 0) | 1% (med 478) | 4% (med 393) | 5% (med 307) |

### Sentiment Shift

| Sentiment | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|
| positive | 51% (med 367) | 49% (med 466) | 51% (med 384) | 42% (med 316) |
| neutral | 39% (med 349) | 41% (med 454) | 38% (med 370) | 48% (med 350) |
| negative | 10% (med 330) | 10% (med 419) | 10% (med 328) | 10% (med 306) |

---

## 14. Quarterly Deep Dive

| Quarter | n | Med Votes | Avg Words | AI % | Demo % | FP Opener % | Neg Opener % | Scarcity % |
|---|---|---|---|---|---|---|---|---|
| 2023-Q1 | 8 | 416 | 301 | 50% | 0% | 0% | 12% | 0% |
| 2023-Q2 | 139 | 293 | 458 | 40% | 1% | 27% | 1% | 9% |
| 2023-Q3 | 128 | 368 | 410 | 41% | 0% | 22% | 4% | 4% |
| 2023-Q4 | 136 | 393 | 357 | 42% | 4% | 17% | 3% | 10% |
| 2024-Q1 | 152 | 392 | 392 | 41% | 2% | 22% | 5% | 6% |
| 2024-Q2 | 175 | 447 | 664 | 51% | 3% | 19% | 2% | 7% |
| 2024-Q3 | 193 | 503 | 501 | 54% | 3% | 28% | 3% | 10% |
| 2024-Q4 | 67 | 462 | 582 | 54% | 4% | 30% | 0% | 6% |
| 2025-Q2 | 177 | 390 | 490 | 59% | 33% | 33% | 2% | 7% |
| 2025-Q3 | 199 | 380 | 480 | 70% | 37% | 29% | 3% | 9% |
| 2025-Q4 | 191 | 351 | 329 | 62% | 27% | 27% | 2% | 6% |
| 2026-Q1 | 146 | 327 | 378 | 54% | 28% | 26% | 2% | 3% |

---

## 15. Top 1% Deep Dive

**Top 17 products** (top 1% by votes)

| Name | Votes | Hook | Arc | Words | AI | CTA |
|---|---|---|---|---|---|---|
| Wordware | 9861 | greeting | too_short | 462 | 2 | free |
| Supabase | 2310 | stat_number | solution_first | 510 | 0 | get_started |
| Me.bot | 1634 | bold_claim | too_short | 240 | 1 | none |
| Flipner AI | 1610 | greeting | too_short | 503 | 6 | none |
| Trace | 1569 | greeting | solution_first | 253 | 4 | none |
| Clustr | 1497 | greeting | too_short | 456 | 0 | sign_up |
| Framer AI | 1459 | descriptive | too_short | 23 | 0 | none |
| Guidde AI | 1455 | greeting | too_short | 313 | 1 | none |
| Pygma | 1453 | greeting | too_short | 264 | 2 | none |
| Guideflow | 1369 | greeting | solution_first | 446 | 2 | book_demo |
| Pathway | 1350 | greeting | too_short | 367 | 1 | free |
| Cello | 1347 | bold_claim | too_short | 154 | 1 | try |
| Clueso | 1306 | descriptive | neutral_to_solution | 283 | 2 | none |
| buzzabout | 1292 | stat_number | too_short | 138 | 1 | none |
| Typeframes | 1292 | descriptive | too_short | 21 | 0 | none |
| Amie | 1291 | bold_claim | solution_first | 431 | 1 | none |
| YouMind | 1275 | greeting | solution_first | 64 | 2 | none |

### Top 1% vs Dataset

| Trait | Top 1% | Dataset |
|---|---|---|
| Median word count | 283 | 264 |
| AI mention % | 76% | 53% |
| Has metrics | 53% | 49% |
| First-person opener | 24% | 25% |
| Has brand mention | 24% | 43% |
| Has scarcity | 6% | 7% |
| Has discount | 24% | 27% |
| Demo walkthrough | 6% | 15% |

### Best Openers

- **Wordware** (9861v): *"hey I'm philli and I'm the CEO at wordware at wordware we are building an ID and a toolkit that enables anyone to build "*
- **Supabase** (2310v): *"Supabase is now GA today we manage over a million  databases and we launch over 2 and a half thousand new databases ever"*
- **Me.bot** (1634v): *"every day is packed with meetings errands commutes and social events leaving no brain space for yourself those interesti"*
- **Flipner AI** (1610v): *"Hello this is Julia from Flipner allow  me to introduce you to our pocket sized writing assistant we are transitioning  "*
- **Trace** (1569v): *"Hi, I'm Tim from Trace"*
- **Clustr** (1497v): *"hi guys Tim here today we're super excited to launch cluster on product hunt we believe that the crypto changes of today"*
- **Framer AI** (1459v): *"yo [Music] [Music] laughs [Music] my personal mission and the company's mission is to make the web more creative yo [Mus"*
- **Guidde AI** (1455v): *"hi this is Dan from guide guide lets you create video documentation across any app using our AI capture tool let's see h"*
- **Pygma** (1453v): *"hi I'm pigma your AI Instagram co-pilot the main thing I'm focused on is performing all functions in a dialogue format s"*
- **Guideflow** (1369v): *"Hey guys, super happy to announce the release of Gate Flow 2"*

---

## 16. Bottom 10% Anti-Patterns

**Bottom 171 products** (bottom 10%)

| Trait | Bottom 10% | Top 10% | Gap |
|---|---|---|---|
| Has AI mention | 43% | 58% | +15pp |
| Has metrics | 47% | 54% | +7pp |
| First-person opener | 23% | 29% | +6pp |
| Has discount | 27% | 26% | -1pp |
| Has buzzwords | 8% | 14% | +6pp |
| Demo walkthrough | 15% | 11% | -5pp |
| Has scarcity | 9% | 8% | -1pp |
| Has brand mention | 42% | 37% | -5pp |
| Negative opener | 3% | 4% | +1pp |

---

## 17. Cross-Correlations — All Dimensions vs Votes

| Dimension | Spearman r | p-approx | Direction |
|---|---|---|---|
| **Before/After Claims** | +0.478 | 1.0438 | + |
| **Success Claims** | +0.423 | 1.1536 | + |
| **Competitive Phrases** | +0.408 | 1.1843 | + |
| **Buzzwords** | +0.384 | 1.2310 | + |
| **Social Proof Claims** | +0.362 | 1.2769 | + |
| **Speaker Changes** | +0.329 | 1.3427 | + |
| **Energy/Pacing Markers** | +0.325 | 1.3504 | + |
| **Demo Instructions** | +0.280 | 1.4404 | + |
| **Screen Narration** | +0.233 | 1.5335 | + |
| **Data Viz Narration** | +0.214 | 1.5711 | + |
| **Questions Throughout** | +0.193 | 1.6141 | + |
| **Question Sentences** | +0.193 | 1.6141 | + |
| **Hedge Words** | +0.193 | 1.6143 | + |
| **Feature List Markers** | +0.183 | 1.6341 | + |
| **Production Markers ([Music] etc)** | +0.157 | 1.6859 | + |
| **Platform Mentions** | +0.157 | 1.6863 | + |
| **Product Name Density** | +0.143 | 1.7139 | + |
| **Solution %** | +0.140 | 1.7204 | + |
| **Product Name Repeats** | +0.137 | 1.7258 | + |
| **Problem %** | +0.136 | 1.7283 | + |
| **AI Mentions** | +0.129 | 1.7415 | + |
| **AI Density** | +0.129 | 1.7423 | + |
| **Reading Level (FK)** | +0.118 | 1.7640 | + |
| **Number Density** | +0.114 | 1.7722 | + |
| **Avg Sentence Length** | +0.111 | 1.7775 | + |
| **Action Verbs** | +0.108 | 1.7846 | + |
| **Brand Mentions** | +0.107 | 1.7869 | + |
| **Passive Voice** | +0.080 | 1.8390 | + |
| **Feature Words** | +0.077 | 1.8453 | + |
| **Benefit Words** | +0.071 | 1.8585 | + |
| **Word Diversity** | +0.059 | 1.8828 | + |
| **Benefit Ratio** | +0.050 | 1.8990 | + |
| Confidence Words | +0.046 | 1.9081 | + |
| You-Pronouns | -0.029 | 1.9412 | − |
| We-Pronouns | +0.027 | 1.9465 | + |
| Filler Words | +0.015 | 1.9694 | + |
| Topic Transitions | -0.012 | 1.9769 | − |
| Transcript Length | -0.007 | 1.9865 | − |

---

*Analysis generated 2026-03-24 16:07*
*1712 transcripts analyzed across 86 dimensions*