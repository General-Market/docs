# PH Transcript Analysis V2 — Deep Storytelling & Persuasion Findings

**Dataset:** 1712 Product Hunt transcripts with ≥20 words.
- 2023: 411 transcripts, median 350 votes
- 2024: 587 transcripts, median 454 votes
- 2025: 568 transcripts, median 372 votes
- 2026: 146 transcripts, median 327 votes

**100 new dimensions** across 6 categories: Story Architecture, Emotional Mechanics,
Product Presentation, Wording & Rhetoric, Persuasion Psychology, Structure & Timing.

---

## 1. Continuous Dimensions — Spearman r vs Votes

These dimensions have sufficient variance (not sparse booleans). Spearman r is meaningful.

| # | Dimension | r | High med | Low med | Lift |
|---|---|---|---|---|---|
| 1 | **"Imagine" Device (future pacing)** | +0.366 | 423 | 386 | +37 |
| 2 | **Surprise/Delight Reveals (late bonuses)** | +0.352 | 417 | 387 | +30 |
| 3 | **Pride Triggers (flattery count)** | +0.351 | 396 | 387 | +9 |
| 4 | **Qualifying Retreat (claim then soften)** | +0.334 | 412 | 384 | +28 |
| 5 | **Cliche Count (dead metaphors)** | +0.329 | 392 | 389 | +3 |
| 6 | **Contrast Pairs (juxtapositions)** | +0.318 | 408 | 385 | +23 |
| 7 | **Frustration Vocabulary Breadth** | +0.297 | 403 | 385 | +18 |
| 8 | **Question-Answer Pairs (self-dialogue)** | +0.294 | 363 | 394 | -31 |
| 9 | **Social Belonging Cues (tribe language)** | +0.271 | 388 | 389 | -1 |
| 10 | **"Finally" Signal (long-awaited relief)** | +0.269 | 381 | 391 | -10 |
| 11 | **Pivot Sharpness (problem→solution turn)** | +0.253 | 399 | 385 | +14 |
| 12 | **Villain References (count)** | +0.242 | 398 | 388 | +10 |
| 13 | **Anticipatory Emotion (dopamine priming)** | +0.239 | 373 | 392 | -19 |
| 14 | **Conditional Density (hedging /100w)** | +0.235 | 380 | 391 | -11 |
| 15 | **Voice Consistency (pronoun stability)** | +0.218 | 0 | 389 | -389 |
| 16 | **Empathy Depth (composite score)** | +0.217 | 402 | 384 | +18 |
| 17 | **Imperative Density (commands /100w)** | +0.215 | 363 | 395 | -32 |
| 18 | **Setup-Payoff Distance (suspense)** | +0.204 | 363 | 395 | -32 |
| 19 | **Relief Distance (sentences tension→relief)** | +0.202 | 363 | 394 | -31 |
| 20 | **Negation as Benefit ("no X needed")** | +0.198 | 390 | 389 | +1 |
| 21 | **"Just" Minimizer Count** | +0.188 | 395 | 388 | +7 |
| 22 | **Conclusive Finality (ending strength)** | +0.184 | 0 | 389 | -389 |
| 23 | **Cliffhanger Beats (suspense devices)** | +0.178 | 393 | 388 | +5 |
| 24 | **Parallel Structure Count** | +0.171 | 367 | 395 | -28 |
| 25 | **Demo Voice Present Tense** | +0.160 | 394 | 386 | +8 |
| 26 | **Liveness Score (live demo feel)** | +0.150 | 394 | 385 | +9 |
| 27 | **Integration Count (named platforms)** | +0.145 | 402 | 381 | +21 |
| 28 | **Journey vs Destination Framing** | +0.140 | 397 | 388 | +9 |
| 29 | **Loss Aversion Framing (loss/gain ratio)** | +0.135 | 395 | 383 | +12 |
| 30 | **Speed Claims (velocity language)** | +0.132 | 385 | 391 | -6 |
| 31 | **Anaphora (repeated sentence starts)** | +0.131 | 363 | 395 | -32 |
| 32 | **Use Case Count (distinct personas)** | +0.117 | 407 | 383 | +24 |
| 33 | **Choice Architecture (decision options)** | +0.116 | 402 | 384 | +18 |
| 34 | **Emotional Contrast Ratio (swing size)** | +0.108 | 408 | 376 | +32 |
| 35 | **Concrete vs Abstract Language** | +0.107 | 0 | 389 | -389 |
| 36 | **Joy Velocity Shift (positivity delta)** | +0.096 | 409 | 384 | +25 |
| 37 | **Orphaned Features (no benefit ratio)** | +0.093 | 376 | 396 | -20 |
| 38 | **Cognitive Ease (effortlessness language)** | +0.089 | 380 | 395 | -15 |
| 39 | **Closing Velocity (<1 = accelerating)** | +0.085 | 361 | 395 | -34 |
| 40 | **Verb Energy (high vs low energy)** | +0.084 | 397 | 381 | +16 |
| 41 | Cold Open Words (to first product mention) | +0.069 | 388 | 391 | -3 |
| 42 | Promise-Proof-Push Score (0-3) | +0.064 | 363 | 395 | -32 |
| 43 | Confidence Gradient (certainty growth) | +0.062 | 384 | 391 | -7 |
| 44 | Word Rarity Score (avg word length) | +0.054 | 395 | 381 | +14 |
| 45 | Resolution Completeness (solution/problem ratio) | +0.045 | 384 | 394 | -10 |
| 46 | Superlative Density (/100w) | +0.037 | 394 | 384 | +10 |
| 47 | Specificity Index (concrete/vague ratio) | +0.032 | 394 | 387 | +7 |
| 48 | Feature Intro Velocity (words between features) | +0.030 | 384 | 394 | -10 |
| 49 | Simplicity Signals (easy/simple count) | +0.026 | 393 | 387 | +6 |
| 50 | Certainty Ratio (certain/uncertain) | -0.006 | 381 | 397 | -16 |
| 51 | Breathing Room (connective/info ratio) | -0.016 | 386 | 393 | -7 |
| 52 | Section Length CV (evenness) | -0.026 | 384 | 395 | -11 |
| 53 | "You" Insertion Rate (/100w) | -0.027 | 383 | 394 | -11 |
| 54 | Story Compression (temporal markers/100w) | -0.033 | 383 | 394 | -11 |
| 55 | Section Boundary Markers | -0.058 | 380 | 395 | -15 |
| 56 | Parenthetical Credibility Drops | -0.065 | 370 | 402 | -32 |
| 57 | Sentence Rhythm Variance | -0.069 | 371 | 400 | -29 |

---

## 2. Boolean Dimensions — Median Vote Lift

For sparse booleans (2-30% prevalence), Spearman r is unreliable. Median lift is the honest metric.

| # | Dimension | Has (n) | Has (med) | No (med) | Lift | Prevalence |
|---|---|---|---|---|---|---|
| 1 | **Effort Reduction Specific (quantified)** | 7 ⚠️ | 520 | 389 | +131 | 0% |
| 2 | **"Everyone Else" Maneuver (subtle shaming)** | 20 ⚠️ | 487 | 389 | +98 | 1% |
| 3 | **Power Word Cluster Density** | 30 | 443 | 389 | +54 | 1% |
| 4 | **Emotion Specificity (vivid vs generic)** | 5 ⚠️ | 429 | 389 | +40 | 0% |
| 5 | **In-Group Language (shared identity)** | 64 | 426 | 388 | +38 | 3% |
| 6 | **Unsaid Problem (implicit pain)** | 46 | 422 | 388 | +34 | 2% |
| 7 | **Future Self Projection (identity transform)** | 84 | 422 | 388 | +34 | 4% |
| 8 | **Transformation Promise (identity shift)** | 261 | 406 | 386 | +20 | 15% |
| 9 | **Inciting Incident (specific origin story)** | 148 | 405 | 388 | +17 | 8% |
| 10 | **Empathy Observed (third-person suffering)** | 81 | 404 | 388 | +16 | 4% |
| 11 | **Callback Count (internal references)** | 58 | 405 | 389 | +16 | 3% |
| 12 | Counterfactual Count ("what if") | 114 | 402 | 389 | +13 | 6% |
| 13 | Stakes Escalation (problem grows) | 212 | 399 | 388 | +11 | 12% |
| 14 | Temporal Anchors (specific time refs) | 163 | 399 | 388 | +11 | 9% |
| 15 | Villain Named (explicit antagonist) | 400 | 398 | 388 | +10 | 23% |
| 16 | Vulnerability Moment (admits failure) | 43 | 399 | 389 | +10 | 2% |
| 17 | "Why Now" Argument (timeliness) | 65 | 398 | 389 | +9 | 3% |
| 18 | Comparison Moment (side-by-side) | 176 | 396 | 388 | +8 | 10% |
| 19 | Nested Stories (story within story) | 84 | 395 | 388 | +7 | 4% |
| 20 | FOMO Construction (fear of missing out) | 74 | 393 | 389 | +4 | 4% |
| 21 | Open Loop Closing (forward-looking) | 80 | 393 | 389 | +4 | 4% |
| 22 | Multi-Persona Address Count | 142 | 392 | 389 | +3 | 8% |
| 23 | Objection Preempt (addressing doubts) | 54 | 391 | 389 | +2 | 3% |
| 24 | Empathy First-Hand (speaker lived it) | 136 | 390 | 389 | +1 | 7% |
| 25 | Definitive Closing (clean end) | 735 | 388 | 390 | -2 | 42% |
| 26 | Reciprocity Trigger (free before ask) | 214 | 379 | 391 | -12 | 12% |
| 27 | **Effort Reduction Vague** | 207 | 376 | 391 | -15 | 12% |
| 28 | **Transition Sophistication** | 72 | 373 | 391 | -18 | 4% |
| 29 | **Anchor-Contrast Pricing** | 45 | 371 | 389 | -18 | 2% |
| 30 | **"Under the Hood" (technical depth)** | 375 | 371 | 394 | -23 | 21% |
| 31 | **Emotional Bookend Match** | 689 | 369 | 399 | -30 | 40% |
| 32 | **Onboarding Time Claim** | 52 | 358 | 391 | -33 | 3% |
| 33 | **Progressive Disclosure (layered complexity)** | 111 | 354 | 392 | -38 | 6% |
| 34 | **"One More Thing" Pattern** | 20 ⚠️ | 340 | 391 | -51 | 1% |
| 35 | **Bandwagon Gradient (escalating proof)** | 6 ⚠️ | 328 | 389 | -61 | 0% |

*⚠️ = fewer than 30 observations, treat with caution*

---

## A. Story Architecture

### Inciting Incident (specific origin story)

| | n | Median Votes |
|---|---|---|
| Has | 148 (8%) | 405 |
| No | 1564 (92%) | 388 |

Spearman r = +0.385

**By Year:**

| Year | Usage % | Has (med) | No (med) | Lift |
|---|---|---|---|---|
| 2024 | 8% | 505 | 446 | +59 |
| 2025 | 10% | 367 | 375 | -8 |
| 2026 | 7% | 330 | 327 | +3 |

### Villain Named (explicit antagonist)

| | n | Median Votes |
|---|---|---|
| Has | 400 (23%) | 398 |
| No | 1312 (77%) | 388 |

Spearman r = +0.247

**By Year:**

| Year | Usage % | Has (med) | No (med) | Lift |
|---|---|---|---|---|
| 2024 | 23% | 489 | 437 | +52 |
| 2025 | 23% | 393 | 369 | +24 |
| 2026 | 20% | 307 | 334 | -27 |

### Villain References (count)

Spearman r = +0.242

| Split | n | Median Votes |
|---|---|---|
| Above median (>0.00) | 400 | 398 |
| Below median | 1312 | 388 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | +0.284 | 489 vs 437 |
| 2025 | +0.259 | 393 vs 369 |
| 2026 | +0.234 | 307 vs 334 |

### Stakes Escalation (problem grows)

| | n | Median Votes |
|---|---|---|
| Has | 212 (12%) | 399 |
| No | 1500 (88%) | 388 |

Spearman r = +0.332

**By Year:**

| Year | Usage % | Has (med) | No (med) | Lift |
|---|---|---|---|---|
| 2024 | 12% | 454 | 454 | +0 |
| 2025 | 12% | 390 | 370 | +20 |
| 2026 | 8% | 304 | 332 | -28 |

### Transformation Promise (identity shift)

| | n | Median Votes |
|---|---|---|
| Has | 261 (15%) | 406 |
| No | 1451 (85%) | 386 |

Spearman r = +0.320

**By Year:**

| Year | Usage % | Has (med) | No (med) | Lift |
|---|---|---|---|---|
| 2024 | 15% | 505 | 437 | +68 |
| 2025 | 16% | 384 | 370 | +14 |
| 2026 | 13% | 300 | 330 | -30 |

### Transformation Position (0=start, 1=end)



| Split | n | Median Votes |
|---|---|---|
| Above median (>-1.00) | 261 | 406 |
| Below median | 1451 | 386 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | — | 505 vs 437 |
| 2025 | — | 384 vs 370 |
| 2026 | — | 300 vs 330 |

### Pivot Sharpness (problem→solution turn)

Spearman r = +0.253

| Split | n | Median Votes |
|---|---|---|
| Above median (>0.00) | 408 | 399 |
| Below median | 1304 | 385 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | +0.240 | 482 vs 437 |
| 2025 | +0.223 | 384 vs 370 |
| 2026 | +0.316 | 316 vs 330 |

### Nested Stories (story within story)

| | n | Median Votes |
|---|---|---|
| Has | 84 (4%) | 395 |
| No | 1628 (96%) | 388 |

Spearman r = +0.431

**By Year:**

| Year | Usage % | Has (med) | No (med) | Lift |
|---|---|---|---|---|
| 2024 | 4% | 402 | 454 | -52 |
| 2025 | 6% | 405 | 369 | +36 |
| 2026 | 6% | 283 | 327 | -44 |

### Temporal Anchors (specific time refs)

Spearman r = +0.375

| Split | n | Median Votes |
|---|---|---|
| Above median (>0.00) | 163 | 399 |
| Below median | 1549 | 388 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | +0.356 | 454 vs 454 |
| 2025 | +0.382 | 371 vs 373 |
| 2026 | +0.377 | 356 vs 327 |

### "Imagine" Device (future pacing)

Spearman r = +0.366

| Split | n | Median Votes |
|---|---|---|
| Above median (>0.00) | 206 | 423 |
| Below median | 1506 | 386 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | +0.356 | 497 vs 446 |
| 2025 | +0.354 | 407 vs 369 |
| 2026 | +0.403 | 354 vs 327 |

### Cliffhanger Beats (suspense devices)

Spearman r = +0.178

| Split | n | Median Votes |
|---|---|---|
| Above median (>0.00) | 470 | 393 |
| Below median | 1242 | 388 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | +0.171 | 442 vs 460 |
| 2025 | +0.174 | 377 vs 370 |
| 2026 | +0.144 | 293 vs 330 |

### "Why Now" Argument (timeliness)

| | n | Median Votes |
|---|---|---|
| Has | 65 (3%) | 398 |
| No | 1647 (97%) | 389 |

Spearman r = +0.453

**By Year:**

| Year | Usage % | Has (med) | No (med) | Lift |
|---|---|---|---|---|
| 2024 | 3% | 571 | 447 | +124 |
| 2025 | 4% | 363 | 372 | -9 |
| 2026 | 3% | 298 | 327 | -29 |

### Journey vs Destination Framing

Spearman r = +0.140

| Split | n | Median Votes |
|---|---|---|
| Above median (>0.50) | 238 | 397 |
| Below median | 1474 | 388 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | +0.104 | 496 vs 450 |
| 2025 | +0.197 | 391 vs 370 |
| 2026 | +0.213 | 300 vs 330 |

### Emotional Bookend Match

| | n | Median Votes |
|---|---|---|
| Has | 689 (40%) | 369 |
| No | 1023 (60%) | 399 |

Spearman r = +0.071

**By Year:**

| Year | Usage % | Has (med) | No (med) | Lift |
|---|---|---|---|---|
| 2024 | 7% | 429 | 454 | -25 |
| 2025 | 87% | 373 | 348 | +25 |
| 2026 | 86% | 335 | 293 | +42 |

### Unsaid Problem (implicit pain)

Spearman r = +0.469

| Split | n | Median Votes |
|---|---|---|
| Above median (>0.00) | 46 | 422 |
| Below median | 1666 | 388 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | +0.477 | 532 vs 447 |
| 2025 | +0.468 | 330 vs 373 |
| 2026 | +0.454 | 356 vs 327 |

### Resolution Completeness (solution/problem ratio)

Spearman r = +0.045

| Split | n | Median Votes |
|---|---|---|
| Above median (>0.50) | 749 | 384 |
| Below median | 963 | 394 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | +0.021 | 454 vs 453 |
| 2025 | +0.058 | 358 vs 391 |
| 2026 | +0.076 | 341 vs 319 |

### Story Compression (temporal markers/100w)

Spearman r = -0.033

| Split | n | Median Votes |
|---|---|---|
| Above median (>0.62) | 853 | 383 |
| Below median | 859 | 394 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | -0.062 | 436 vs 472 |
| 2025 | -0.028 | 370 vs 378 |
| 2026 | -0.003 | 327 vs 334 |

---

## B. Emotional Mechanics

### Emotion Specificity (vivid vs generic)

Spearman r = +0.498

| Split | n | Median Votes |
|---|---|---|
| Above median (>0.00) | 5 | 429 |
| Below median | 1707 | 389 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | +0.491 | 554 vs 454 |
| 2025 | +0.500 | 0 vs 372 |
| 2026 | +0.501 | 429 vs 327 |

### Relief Distance (sentences tension→relief)

Spearman r = +0.202

| Split | n | Median Votes |
|---|---|---|
| Above median (>0.00) | 359 | 363 |
| Below median | 1353 | 394 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | +0.414 | 429 vs 457 |
| 2025 | +0.104 | 380 vs 369 |
| 2026 | -0.009 | 304 vs 345 |

### Pride Triggers (flattery count)

Spearman r = +0.351

| Split | n | Median Votes |
|---|---|---|
| Above median (>0.00) | 215 | 396 |
| Below median | 1497 | 387 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | +0.356 | 467 vs 453 |
| 2025 | +0.342 | 384 vs 369 |
| 2026 | +0.320 | 316 vs 332 |

### FOMO Construction (fear of missing out)

Spearman r = +0.440

| Split | n | Median Votes |
|---|---|---|
| Above median (>0.00) | 74 | 393 |
| Below median | 1638 | 389 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | +0.448 | 447 vs 457 |
| 2025 | +0.440 | 371 vs 372 |
| 2026 | +0.413 | 404 vs 327 |

### Empathy First-Hand (speaker lived it)

| | n | Median Votes |
|---|---|---|
| Has | 136 (7%) | 390 |
| No | 1576 (93%) | 389 |

Spearman r = +0.388

**By Year:**

| Year | Usage % | Has (med) | No (med) | Lift |
|---|---|---|---|---|
| 2024 | 8% | 497 | 447 | +50 |
| 2025 | 10% | 362 | 375 | -13 |
| 2026 | 5% | 341 | 327 | +14 |

### Empathy Observed (third-person suffering)

| | n | Median Votes |
|---|---|---|
| Has | 81 (4%) | 404 |
| No | 1631 (96%) | 388 |

Spearman r = +0.436

**By Year:**

| Year | Usage % | Has (med) | No (med) | Lift |
|---|---|---|---|---|
| 2024 | 4% | 562 | 447 | +115 |
| 2025 | 5% | 396 | 370 | +26 |
| 2026 | 6% | 304 | 332 | -28 |

### Frustration Vocabulary Breadth

Spearman r = +0.297

| Split | n | Median Votes |
|---|---|---|
| Above median (>0.00) | 301 | 403 |
| Below median | 1411 | 385 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | +0.335 | 486 vs 439 |
| 2025 | +0.284 | 399 vs 369 |
| 2026 | +0.259 | 327 vs 332 |

### Joy Velocity Shift (positivity delta)

Spearman r = +0.096

| Split | n | Median Votes |
|---|---|---|
| Above median (>0.00) | 362 | 409 |
| Below median | 1350 | 384 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | +0.000 | 443 vs 459 |
| 2025 | +0.104 | 386 vs 369 |
| 2026 | +0.235 | 350 vs 327 |

### Vulnerability Moment (admits failure)

| | n | Median Votes |
|---|---|---|
| Has | 43 (2%) | 399 |
| No | 1669 (98%) | 389 |

Spearman r = +0.466

**By Year:**

| Year | Usage % | Has (med) | No (med) | Lift |
|---|---|---|---|---|
| 2024 | 2% | 499 | 454 | +45 |
| 2025 | 2% | 399 | 370 | +29 |
| 2026 | 2% | 606 | 327 | +279 |

### Anticipatory Emotion (dopamine priming)

Spearman r = +0.239

| Split | n | Median Votes |
|---|---|---|
| Above median (>0.00) | 337 | 373 |
| Below median | 1375 | 392 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | +0.238 | 431 vs 459 |
| 2025 | +0.238 | 359 vs 382 |
| 2026 | +0.247 | 339 vs 327 |

### Social Belonging Cues (tribe language)

Spearman r = +0.271

| Split | n | Median Votes |
|---|---|---|
| Above median (>0.00) | 337 | 388 |
| Below median | 1375 | 389 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | +0.268 | 472 vs 450 |
| 2025 | +0.272 | 365 vs 375 |
| 2026 | +0.256 | 324 vs 327 |

### Loss Aversion Framing (loss/gain ratio)

Spearman r = +0.135

| Split | n | Median Votes |
|---|---|---|
| Above median (>0.11) | 855 | 395 |
| Below median | 857 | 383 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | +0.102 | 460 vs 443 |
| 2025 | +0.142 | 379 vs 365 |
| 2026 | +0.221 | 345 vs 315 |

### Surprise/Delight Reveals (late bonuses)

Spearman r = +0.352

| Split | n | Median Votes |
|---|---|---|
| Above median (>0.00) | 222 | 417 |
| Below median | 1490 | 387 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | +0.354 | 477 vs 447 |
| 2025 | +0.338 | 384 vs 370 |
| 2026 | +0.377 | 356 vs 327 |

### Confidence Gradient (certainty growth)

Spearman r = +0.062

| Split | n | Median Votes |
|---|---|---|
| Above median (>0.00) | 232 | 384 |
| Below median | 1480 | 391 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | +0.109 | 427 vs 459 |
| 2025 | +0.103 | 388 vs 369 |
| 2026 | +0.173 | 350 vs 323 |

### Emotional Contrast Ratio (swing size)

Spearman r = +0.108

| Split | n | Median Votes |
|---|---|---|
| Above median (>2.00) | 645 | 408 |
| Below median | 1067 | 376 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | +0.079 | 465 vs 437 |
| 2025 | +0.106 | 399 vs 369 |
| 2026 | -0.063 | 327 vs 327 |

### "Finally" Signal (long-awaited relief)

Spearman r = +0.269

| Split | n | Median Votes |
|---|---|---|
| Above median (>0.00) | 328 | 381 |
| Below median | 1384 | 391 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | +0.262 | 462 vs 450 |
| 2025 | +0.250 | 342 vs 383 |
| 2026 | +0.329 | 341 vs 324 |

### Empathy Depth (composite score)

Spearman r = +0.217

| Split | n | Median Votes |
|---|---|---|
| Above median (>0.00) | 441 | 402 |
| Below median | 1271 | 384 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | +0.276 | 492 vs 434 |
| 2025 | +0.172 | 384 vs 369 |
| 2026 | +0.145 | 327 vs 332 |

---

## C. Product Presentation

### Feature Intro Velocity (words between features)

Spearman r = +0.030

| Split | n | Median Votes |
|---|---|---|
| Above median (>2.00) | 837 | 384 |
| Below median | 875 | 394 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | +0.054 | 439 vs 463 |
| 2025 | -0.006 | 370 vs 382 |
| 2026 | +0.126 | 327 vs 327 |

### Orphaned Features (no benefit ratio)

Spearman r = +0.093

| Split | n | Median Votes |
|---|---|---|
| Above median (>0.00) | 634 | 376 |
| Below median | 1078 | 396 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | +0.243 | 439 vs 460 |
| 2025 | +0.018 | 367 vs 388 |
| 2026 | +0.110 | 334 vs 324 |

### Demo Voice Present Tense

Spearman r = +0.160

| Split | n | Median Votes |
|---|---|---|
| Above median (>0.00) | 568 | 394 |
| Below median | 1144 | 386 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | +0.125 | 446 vs 457 |
| 2025 | +0.223 | 384 vs 370 |
| 2026 | +0.191 | 327 vs 334 |

### Concrete vs Abstract Language

Spearman r = +0.107

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | +0.053 | 0 vs 454 |
| 2025 | +0.119 | 0 vs 372 |
| 2026 | +0.291 | 0 vs 327 |

### Magic Moment Position (0=start, 1=end)



| Split | n | Median Votes |
|---|---|---|
| Above median (>0.00) | 452 | 363 |
| Below median | 1260 | 396 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | — | 424 vs 457 |
| 2025 | — | 363 vs 389 |
| 2026 | — | 339 vs 327 |

### Speed Claims (velocity language)

Spearman r = +0.132

| Split | n | Median Votes |
|---|---|---|
| Above median (>0.00) | 622 | 385 |
| Below median | 1090 | 391 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | +0.174 | 463 vs 447 |
| 2025 | +0.089 | 370 vs 373 |
| 2026 | +0.261 | 348 vs 304 |

### Effort Reduction Specific (quantified)

| | n | Median Votes |
|---|---|---|
| Has | 7 (0%) | 520 |
| No | 1705 (100%) | 389 |

Spearman r = +0.498

**By Year:**

| Year | Usage % | Has (med) | No (med) | Lift |
|---|---|---|---|---|
| 2024 | 0% | 0 | 454 | +0 |
| 2025 | 0% | 561 | 370 | +191 |
| 2026 | 0% | 520 | 327 | +193 |

### Effort Reduction Vague

| | n | Median Votes |
|---|---|---|
| Has | 207 (12%) | 376 |
| No | 1505 (88%) | 391 |

Spearman r = +0.329

**By Year:**

| Year | Usage % | Has (med) | No (med) | Lift |
|---|---|---|---|---|
| 2024 | 16% | 423 | 462 | -39 |
| 2025 | 10% | 371 | 372 | -1 |
| 2026 | 6% | 286 | 332 | -46 |

### Integration Count (named platforms)

Spearman r = +0.145

| Split | n | Median Votes |
|---|---|---|
| Above median (>0.00) | 683 | 402 |
| Below median | 1029 | 381 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | +0.198 | 486 vs 434 |
| 2025 | +0.154 | 391 vs 367 |
| 2026 | +0.239 | 354 vs 319 |

### Progressive Disclosure (layered complexity)

| | n | Median Votes |
|---|---|---|
| Has | 111 (6%) | 354 |
| No | 1601 (94%) | 392 |

Spearman r = +0.386

**By Year:**

| Year | Usage % | Has (med) | No (med) | Lift |
|---|---|---|---|---|
| 2024 | 2% | 350 | 459 | -109 |
| 2025 | 12% | 372 | 375 | -3 |
| 2026 | 16% | 335 | 327 | +8 |

### "One More Thing" Pattern

| | n | Median Votes |
|---|---|---|
| Has | 20 (1%) | 340 |
| No | 1692 (99%) | 391 |

Spearman r = +0.475

**By Year:**

| Year | Usage % | Has (med) | No (med) | Lift |
|---|---|---|---|---|
| 2024 | 0% | 350 | 457 | -107 |
| 2025 | 1% | 316 | 375 | -59 |
| 2026 | 1% | 371 | 327 | +44 |

### Simplicity Signals (easy/simple count)

Spearman r = +0.026

| Split | n | Median Votes |
|---|---|---|
| Above median (>2.00) | 684 | 393 |
| Below median | 1028 | 387 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | +0.050 | 463 vs 450 |
| 2025 | -0.010 | 383 vs 369 |
| 2026 | -0.085 | 324 vs 334 |

### "Under the Hood" (technical depth)

| | n | Median Votes |
|---|---|---|
| Has | 375 (21%) | 371 |
| No | 1337 (79%) | 394 |

Spearman r = +0.214

**By Year:**

| Year | Usage % | Has (med) | No (med) | Lift |
|---|---|---|---|---|
| 2024 | 19% | 447 | 454 | -7 |
| 2025 | 26% | 363 | 384 | -21 |
| 2026 | 26% | 327 | 327 | +0 |

### Use Case Count (distinct personas)

Spearman r = +0.117

| Split | n | Median Votes |
|---|---|---|
| Above median (>1.00) | 404 | 407 |
| Below median | 1308 | 383 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | +0.102 | 486 vs 443 |
| 2025 | +0.119 | 388 vs 370 |
| 2026 | +0.092 | 339 vs 327 |

### Liveness Score (live demo feel)

Spearman r = +0.150

| Split | n | Median Votes |
|---|---|---|
| Above median (>0.00) | 601 | 394 |
| Below median | 1111 | 385 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | +0.147 | 465 vs 447 |
| 2025 | +0.129 | 365 vs 377 |
| 2026 | +0.229 | 332 vs 327 |

### Onboarding Time Claim

| | n | Median Votes |
|---|---|---|
| Has | 52 (3%) | 358 |
| No | 1660 (97%) | 391 |

Spearman r = +0.446

**By Year:**

| Year | Usage % | Has (med) | No (med) | Lift |
|---|---|---|---|---|
| 2024 | 2% | 450 | 454 | -4 |
| 2025 | 2% | 341 | 373 | -32 |
| 2026 | 7% | 339 | 327 | +12 |

### Comparison Moment (side-by-side)

| | n | Median Votes |
|---|---|---|
| Has | 176 (10%) | 396 |
| No | 1536 (90%) | 388 |

Spearman r = +0.368

**By Year:**

| Year | Usage % | Has (med) | No (med) | Lift |
|---|---|---|---|---|
| 2024 | 12% | 481 | 450 | +31 |
| 2025 | 8% | 392 | 370 | +22 |
| 2026 | 7% | 259 | 330 | -71 |

---

## D. Wording & Rhetoric

### Verb Energy (high vs low energy)

Spearman r = +0.084

| Split | n | Median Votes |
|---|---|---|
| Above median (>0.33) | 810 | 397 |
| Below median | 902 | 381 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | +0.092 | 467 vs 434 |
| 2025 | +0.085 | 384 vs 365 |
| 2026 | +0.172 | 345 vs 315 |

### Sentence Rhythm Variance

Spearman r = -0.069

| Split | n | Median Votes |
|---|---|---|
| Above median (>0.31) | 855 | 371 |
| Below median | 857 | 400 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | +0.015 | 442 vs 454 |
| 2025 | -0.070 | 370 vs 407 |
| 2026 | -0.058 | 332 vs 302 |

### Power Word Cluster Density

Spearman r = +0.474

| Split | n | Median Votes |
|---|---|---|
| Above median (>0.00) | 30 | 443 |
| Below median | 1682 | 389 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | +0.477 | 465 vs 450 |
| 2025 | +0.478 | 426 vs 371 |
| 2026 | +0.454 | 250 vs 330 |

### Jargon Distribution Shape (position of peak)



| Split | n | Median Votes |
|---|---|---|
| Above median (>0.50) | 62 | 384 |
| Below median | 1650 | 390 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | — | 376 vs 454 |
| 2025 | — | 411 vs 369 |
| 2026 | — | 324 vs 327 |

### Anaphora (repeated sentence starts)

Spearman r = +0.131

| Split | n | Median Votes |
|---|---|---|
| Above median (>0.00) | 437 | 363 |
| Below median | 1275 | 395 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | +0.459 | 562 vs 450 |
| 2025 | -0.006 | 369 vs 379 |
| 2026 | -0.026 | 327 vs 344 |

### "Just" Minimizer Count

Spearman r = +0.188

| Split | n | Median Votes |
|---|---|---|
| Above median (>0.00) | 479 | 395 |
| Below median | 1233 | 388 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | +0.209 | 477 vs 445 |
| 2025 | +0.140 | 367 vs 378 |
| 2026 | +0.139 | 293 vs 334 |

### Superlative Density (/100w)

Spearman r = +0.037

| Split | n | Median Votes |
|---|---|---|
| Above median (>0.36) | 855 | 394 |
| Below median | 857 | 384 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | +0.145 | 482 vs 426 |
| 2025 | +0.015 | 373 vs 370 |
| 2026 | -0.101 | 324 vs 332 |

### Question-Answer Pairs (self-dialogue)

Spearman r = +0.294

| Split | n | Median Votes |
|---|---|---|
| Above median (>0.00) | 231 | 363 |
| Below median | 1481 | 394 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | +0.496 | 767 vs 453 |
| 2025 | +0.165 | 370 vs 373 |
| 2026 | +0.146 | 327 vs 332 |

### Transition Sophistication

Spearman r = +0.434

| Split | n | Median Votes |
|---|---|---|
| Above median (>0.00) | 72 | 373 |
| Below median | 1640 | 391 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | +0.452 | 416 vs 454 |
| 2025 | +0.427 | 340 vs 378 |
| 2026 | +0.469 | 403 vs 327 |

### Negation as Benefit ("no X needed")

Spearman r = +0.198

| Split | n | Median Votes |
|---|---|---|
| Above median (>0.00) | 481 | 390 |
| Below median | 1231 | 389 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | +0.221 | 472 vs 445 |
| 2025 | +0.197 | 378 vs 369 |
| 2026 | +0.199 | 324 vs 330 |

### Specificity Index (concrete/vague ratio)

Spearman r = +0.032

| Split | n | Median Votes |
|---|---|---|
| Above median (>0.82) | 847 | 394 |
| Below median | 865 | 387 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | +0.012 | 463 vs 437 |
| 2025 | +0.031 | 372 vs 369 |
| 2026 | +0.143 | 356 vs 304 |

### "You" Insertion Rate (/100w)

Spearman r = -0.027

| Split | n | Median Votes |
|---|---|---|
| Above median (>4.84) | 855 | 383 |
| Below median | 857 | 394 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | +0.032 | 453 vs 459 |
| 2025 | -0.068 | 359 vs 390 |
| 2026 | -0.052 | 327 vs 327 |

### Cliche Count (dead metaphors)

Spearman r = +0.329

| Split | n | Median Votes |
|---|---|---|
| Above median (>0.00) | 250 | 392 |
| Below median | 1462 | 389 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | +0.305 | 472 vs 450 |
| 2025 | +0.334 | 365 vs 375 |
| 2026 | +0.404 | 327 vs 330 |

### Conditional Density (hedging /100w)

Spearman r = +0.235

| Split | n | Median Votes |
|---|---|---|
| Above median (>0.00) | 341 | 380 |
| Below median | 1371 | 391 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | +0.224 | 454 vs 454 |
| 2025 | +0.216 | 367 vs 380 |
| 2026 | +0.239 | 293 vs 330 |

### Parallel Structure Count

Spearman r = +0.171

| Split | n | Median Votes |
|---|---|---|
| Above median (>0.00) | 420 | 367 |
| Below median | 1292 | 395 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | +0.452 | 403 vs 459 |
| 2025 | +0.116 | 384 vs 365 |
| 2026 | +0.087 | 339 vs 319 |

### Imperative Density (commands /100w)

Spearman r = +0.215

| Split | n | Median Votes |
|---|---|---|
| Above median (>0.00) | 347 | 363 |
| Below median | 1365 | 395 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | +0.454 | 460 vs 454 |
| 2025 | +0.073 | 367 vs 383 |
| 2026 | +0.197 | 350 vs 303 |

---

## E. Persuasion Psychology

### Word Rarity Score (avg word length)

Spearman r = +0.054

| Split | n | Median Votes |
|---|---|---|
| Above median (>5.68) | 853 | 395 |
| Below median | 859 | 381 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | +0.068 | 477 vs 429 |
| 2025 | +0.049 | 384 vs 363 |
| 2026 | +0.060 | 345 vs 315 |

### Qualifying Retreat (claim then soften)

Spearman r = +0.334

| Split | n | Median Votes |
|---|---|---|
| Above median (>0.00) | 259 | 412 |
| Below median | 1453 | 384 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | +0.313 | 493 vs 443 |
| 2025 | +0.393 | 373 vs 370 |
| 2026 | +0.412 | 293 vs 327 |

### Conclusive Finality (ending strength)

Spearman r = +0.184

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | +0.256 | 0 vs 454 |
| 2025 | +0.127 | 0 vs 372 |
| 2026 | +0.181 | 0 vs 327 |

### Social Proof Stacking Order

| Category | n | Median Votes | Mean Votes |
|---|---|---|---|
| none | 1482 | 391 | 451 |
| numbers first | 45 | 450 | 495 |
| brands first | 45 | 330 | 408 |
| quotes first | 140 | 384 | 415 |

**By Year:**

| Category | 2024 | 2025 | 2026 |
|---|---|---|---|
| none | 510 (med 446) | 484 (med 378) | 123 (med 327) |
| numbers first | 25 (med 545) | 13 (med 411) | 4 (med 371) |
| brands first | 13 (med 564) | 13 (med 330) | 4 (med 429) |
| quotes first | 39 (med 447) | 58 (med 373) | 15 (med 327) |

### Authority Type (tech/market/domain)

| Category | n | Median Votes | Mean Votes |
|---|---|---|---|
| none | 1639 | 388 | 449 |
| technical | 14 | 306 | 375 |
| market | 41 | 472 | 472 |
| domain | 18 | 457 | 421 |

**By Year:**

| Category | 2024 | 2025 | 2026 |
|---|---|---|---|
| none | 564 (med 446) | 536 (med 372) | 140 (med 327) |
| technical | 2 (med 578) | 7 (med 371) | 2 (med 293) |
| market | 17 (med 498) | 16 (med 411) | 3 (med 408) |
| domain | 4 (med 563) | 9 (med 457) | 1 (med 557) |

### Reciprocity Trigger (free before ask)

| | n | Median Votes |
|---|---|---|
| Has | 214 (12%) | 379 |
| No | 1498 (88%) | 391 |

Spearman r = +0.329

**By Year:**

| Year | Usage % | Has (med) | No (med) | Lift |
|---|---|---|---|---|
| 2024 | 11% | 445 | 454 | -9 |
| 2025 | 12% | 358 | 380 | -22 |
| 2026 | 10% | 371 | 327 | +44 |

### Anchor-Contrast Pricing

| | n | Median Votes |
|---|---|---|
| Has | 45 (2%) | 371 |
| No | 1667 (98%) | 389 |

Spearman r = +0.456

**By Year:**

| Year | Usage % | Has (med) | No (med) | Lift |
|---|---|---|---|---|
| 2024 | 3% | 459 | 454 | +5 |
| 2025 | 2% | 371 | 372 | -1 |
| 2026 | 2% | 371 | 327 | +44 |

### Contrast Pairs (juxtapositions)

Spearman r = +0.318

| Split | n | Median Votes |
|---|---|---|
| Above median (>0.00) | 301 | 408 |
| Below median | 1411 | 385 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | +0.327 | 507 vs 440 |
| 2025 | +0.291 | 399 vs 363 |
| 2026 | +0.351 | 356 vs 323 |

### Certainty Ratio (certain/uncertain)

Spearman r = -0.006

| Split | n | Median Votes |
|---|---|---|
| Above median (>0.31) | 855 | 381 |
| Below median | 857 | 397 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | -0.036 | 429 vs 481 |
| 2025 | +0.047 | 363 vs 383 |
| 2026 | -0.009 | 327 vs 330 |

### In-Group Language (shared identity)

Spearman r = +0.460

| Split | n | Median Votes |
|---|---|---|
| Above median (>0.00) | 64 | 426 |
| Below median | 1648 | 388 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | +0.474 | 554 vs 447 |
| 2025 | +0.468 | 426 vs 370 |
| 2026 | +0.461 | 285 vs 327 |

### Objection Preempt (addressing doubts)

Spearman r = +0.453

| Split | n | Median Votes |
|---|---|---|
| Above median (>0.00) | 54 | 391 |
| Below median | 1658 | 389 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | +0.460 | 503 vs 453 |
| 2025 | +0.444 | 362 vs 375 |
| 2026 | +0.451 | 354 vs 327 |

### Scarcity Type (time/qty/access/capability)

| Category | n | Median Votes | Mean Votes |
|---|---|---|---|
| none | 1529 | 386 | 447 |
| time | 13 | 398 | 416 |
| quantity | 9 | 497 | 451 |
| access | 29 | 419 | 440 |
| capability | 132 | 403 | 466 |

**By Year:**

| Category | 2024 | 2025 | 2026 |
|---|---|---|---|
| none | 512 (med 450) | 513 (med 370) | 140 (med 330) |
| time | 2 (med 1008) | 6 (med 340) | — |
| quantity | 2 (med 687) | 5 (med 411) | — |
| access | 12 (med 520) | 9 (med 377) | — |
| capability | 59 (med 465) | 35 (med 393) | 6 (med 327) |

### Bandwagon Gradient (escalating proof)

Spearman r = +0.493

| Split | n | Median Votes |
|---|---|---|
| Above median (>0.00) | 6 | 328 |
| Below median | 1706 | 389 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | +0.483 | 328 vs 454 |
| 2025 | +0.494 | 517 vs 372 |
| 2026 | +0.500 | 0 vs 327 |

### Choice Architecture (decision options)

Spearman r = +0.116

| Split | n | Median Votes |
|---|---|---|
| Above median (>1.00) | 453 | 402 |
| Below median | 1259 | 384 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | +0.120 | 481 vs 440 |
| 2025 | +0.098 | 372 vs 375 |
| 2026 | +0.110 | 344 vs 327 |

### Cognitive Ease (effortlessness language)

Spearman r = +0.089

| Split | n | Median Votes |
|---|---|---|
| Above median (>0.00) | 705 | 380 |
| Below median | 1007 | 395 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | +0.121 | 450 vs 457 |
| 2025 | +0.075 | 363 vs 382 |
| 2026 | +0.108 | 332 vs 327 |

### "Everyone Else" Maneuver (subtle shaming)

Spearman r = +0.485

| Split | n | Median Votes |
|---|---|---|
| Above median (>0.00) | 20 | 487 |
| Below median | 1692 | 389 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | +0.493 | 564 vs 454 |
| 2025 | +0.466 | 330 vs 375 |
| 2026 | +0.500 | 0 vs 327 |

### Future Self Projection (identity transform)

Spearman r = +0.437

| Split | n | Median Votes |
|---|---|---|
| Above median (>0.00) | 84 | 422 |
| Below median | 1628 | 388 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | +0.424 | 475 vs 454 |
| 2025 | +0.447 | 447 vs 370 |
| 2026 | +0.481 | 422 vs 327 |

---

## F. Structure & Timing

### Info Density Shape (where densest)



| Split | n | Median Votes |
|---|---|---|
| Above median (>0.00) | 583 | 383 |
| Below median | 1129 | 392 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | — | 412 vs 475 |
| 2025 | — | 400 vs 367 |
| 2026 | — | 330 vs 327 |

### Breathing Room (connective/info ratio)

Spearman r = -0.016

| Split | n | Median Votes |
|---|---|---|
| Above median (>0.83) | 855 | 386 |
| Below median | 857 | 393 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | +0.090 | 462 vs 446 |
| 2025 | -0.047 | 384 vs 369 |
| 2026 | -0.126 | 319 vs 345 |

### Cold Open Words (to first product mention)

Spearman r = +0.069

| Split | n | Median Votes |
|---|---|---|
| Above median (>2.00) | 851 | 388 |
| Below median | 861 | 391 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | -0.034 | 450 vs 457 |
| 2025 | +0.188 | 359 vs 383 |
| 2026 | +0.139 | 341 vs 327 |

### Callback Count (internal references)

Spearman r = +0.451

| Split | n | Median Votes |
|---|---|---|
| Above median (>0.00) | 58 | 405 |
| Below median | 1654 | 389 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | +0.426 | 416 vs 454 |
| 2025 | +0.453 | 371 vs 372 |
| 2026 | +0.451 | 356 vs 327 |

### Section Length CV (evenness)

Spearman r = -0.026

| Split | n | Median Votes |
|---|---|---|
| Above median (>0.55) | 854 | 384 |
| Below median | 858 | 395 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | -0.012 | 440 vs 465 |
| 2025 | -0.014 | 369 vs 380 |
| 2026 | -0.042 | 324 vs 344 |

### Promise-Proof-Push Score (0-3)

Spearman r = +0.064

| Split | n | Median Votes |
|---|---|---|
| Above median (>1.00) | 353 | 363 |
| Below median | 1359 | 395 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | +0.210 | 427 vs 459 |
| 2025 | -0.002 | 363 vs 388 |
| 2026 | +0.004 | 327 vs 330 |

### First Feature Position (0=start)



| Split | n | Median Votes |
|---|---|---|
| Above median (>0.23) | 855 | 399 |
| Below median | 857 | 379 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | — | 472 vs 430 |
| 2025 | — | 397 vs 355 |
| 2026 | — | 332 vs 327 |

### Parenthetical Credibility Drops

Spearman r = -0.065

| Split | n | Median Votes |
|---|---|---|
| Above median (>1.00) | 792 | 370 |
| Below median | 920 | 402 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | +0.125 | 442 vs 454 |
| 2025 | -0.045 | 372 vs 407 |
| 2026 | -0.043 | 332 vs 293 |

### Section Boundary Markers

Spearman r = -0.058

| Split | n | Median Votes |
|---|---|---|
| Above median (>3.00) | 782 | 380 |
| Below median | 930 | 395 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | -0.032 | 445 vs 460 |
| 2025 | -0.051 | 361 vs 391 |
| 2026 | -0.002 | 327 vs 332 |

### Setup-Payoff Distance (suspense)

Spearman r = +0.204

| Split | n | Median Votes |
|---|---|---|
| Above median (>0.00) | 356 | 363 |
| Below median | 1356 | 395 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | +0.464 | 472 vs 454 |
| 2025 | +0.090 | 371 vs 375 |
| 2026 | +0.055 | 330 vs 327 |

### Multi-Persona Address Count

Spearman r = +0.391

| Split | n | Median Votes |
|---|---|---|
| Above median (>0.00) | 142 | 392 |
| Below median | 1570 | 389 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | +0.372 | 457 vs 454 |
| 2025 | +0.412 | 397 vs 369 |
| 2026 | +0.383 | 327 vs 330 |

### Voice Consistency (pronoun stability)

Spearman r = +0.218

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | +0.385 | 0 vs 454 |
| 2025 | +0.070 | 0 vs 372 |
| 2026 | -0.014 | 0 vs 327 |

### Counterfactual Count ("what if")

Spearman r = +0.421

| Split | n | Median Votes |
|---|---|---|
| Above median (>0.00) | 114 | 402 |
| Below median | 1598 | 389 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | +0.454 | 545 vs 453 |
| 2025 | +0.383 | 402 vs 369 |
| 2026 | +0.411 | 327 vs 330 |

### Closing Velocity (<1 = accelerating)

Spearman r = +0.085

| Split | n | Median Votes |
|---|---|---|
| Above median (>1.00) | 311 | 361 |
| Below median | 1401 | 395 |

**Year-over-Year Shift:**

| Year | r | High vs Low (median) |
|---|---|---|
| 2024 | +0.393 | 412 vs 454 |
| 2025 | -0.044 | 363 vs 384 |
| 2026 | -0.075 | 327 vs 330 |

### Open Loop Closing (forward-looking)

| | n | Median Votes |
|---|---|---|
| Has | 80 (4%) | 393 |
| No | 1632 (96%) | 389 |

Spearman r = +0.441

**By Year:**

| Year | Usage % | Has (med) | No (med) | Lift |
|---|---|---|---|---|
| 2024 | 5% | 505 | 450 | +55 |
| 2025 | 3% | 363 | 373 | -10 |
| 2026 | 4% | 371 | 327 | +44 |

### Definitive Closing (clean end)

| | n | Median Votes |
|---|---|---|
| Has | 735 (42%) | 388 |
| No | 977 (58%) | 390 |

Spearman r = +0.089

**By Year:**

| Year | Usage % | Has (med) | No (med) | Lift |
|---|---|---|---|---|
| 2024 | 52% | 443 | 472 | -29 |
| 2025 | 31% | 358 | 384 | -26 |
| 2026 | 20% | 286 | 341 | -55 |

---

## Temporal Shifts — Continuous Dimensions (2024 → 2026)

| Dimension | 2024 r | 2025 r | 2026 r | Shift | Direction |
|---|---|---|---|---|---|
| Anaphora (repeated sentence starts) | +0.459 | -0.006 | -0.026 | -0.484 | ↓ declining |
| Closing Velocity (<1 = accelerating) | +0.393 | -0.044 | -0.075 | -0.468 | ↓ declining |
| Relief Distance (sentences tension→relief) | +0.414 | +0.104 | -0.009 | -0.424 | ↓ declining |
| Setup-Payoff Distance (suspense) | +0.464 | +0.090 | +0.055 | -0.409 | ↓ declining |
| Voice Consistency (pronoun stability) | +0.385 | +0.070 | -0.014 | -0.399 | ↓ declining |
| Parallel Structure Count | +0.452 | +0.116 | +0.087 | -0.365 | ↓ declining |
| Question-Answer Pairs (self-dialogue) | +0.496 | +0.165 | +0.146 | -0.350 | ↓ declining |
| Imperative Density (commands /100w) | +0.454 | +0.073 | +0.197 | -0.257 | ↓ declining |
| Superlative Density (/100w) | +0.145 | +0.015 | -0.101 | -0.246 | ↓ declining |
| Concrete vs Abstract Language | +0.053 | +0.119 | +0.291 | +0.237 | ↑ growing |
| Joy Velocity Shift (positivity delta) | +0.000 | +0.104 | +0.235 | +0.234 | ↑ growing |
| Breathing Room (connective/info ratio) | +0.090 | -0.047 | -0.126 | -0.215 | ↓ declining |
| Promise-Proof-Push Score (0-3) | +0.210 | -0.002 | +0.004 | -0.206 | ↓ declining |
| Cold Open Words (to first product mention) | -0.034 | +0.188 | +0.139 | +0.172 | ↑ growing |
| Parenthetical Credibility Drops | +0.125 | -0.045 | -0.043 | -0.168 | ↓ declining |
| Emotional Contrast Ratio (swing size) | +0.079 | +0.106 | -0.063 | -0.141 | ↓ declining |
| Simplicity Signals (easy/simple count) | +0.050 | -0.010 | -0.085 | -0.135 | ↓ declining |
| Orphaned Features (no benefit ratio) | +0.243 | +0.018 | +0.110 | -0.133 | ↓ declining |
| Specificity Index (concrete/vague ratio) | +0.012 | +0.031 | +0.143 | +0.131 | ↑ growing |
| Empathy Depth (composite score) | +0.276 | +0.172 | +0.145 | -0.131 | ↓ declining |
| Loss Aversion Framing (loss/gain ratio) | +0.102 | +0.142 | +0.221 | +0.119 | ↑ growing |
| Journey vs Destination Framing | +0.104 | +0.197 | +0.213 | +0.109 | ↑ growing |
| Cliche Count (dead metaphors) | +0.305 | +0.334 | +0.404 | +0.099 | ↑ growing |
| Qualifying Retreat (claim then soften) | +0.313 | +0.393 | +0.412 | +0.099 | ↑ growing |
| Speed Claims (velocity language) | +0.174 | +0.089 | +0.261 | +0.087 | ↑ growing |

---

## Temporal Shifts — Boolean Dimensions (2024 → 2026)

| Dimension | 2024 (usage%, lift) | 2025 (usage%, lift) | 2026 (usage%, lift) | Trend |
|---|---|---|---|---|
| Vulnerability Moment (admits failure) | 2%, +45 | 2%, +29 | 2%, +279 | ↑ +234 |
| Effort Reduction Specific (quantified) | 0%, +0 | 0%, +191 | 0%, +193 | ↑ +193 |
| "Why Now" Argument (timeliness) | 3%, +124 | 4%, -9 | 3%, -29 | ↓ -153 |
| "One More Thing" Pattern | 0%, -107 | 1%, -59 | 1%, +44 | ↑ +151 |
| In-Group Language (shared identity) | 3%, +107 | 3%, +56 | 2%, -42 | ↓ -149 |
| Empathy Observed (third-person suffering) | 4%, +115 | 5%, +26 | 6%, -28 | ↓ -143 |
| Bandwagon Gradient (escalating proof) | 0%, -126 | 0%, +145 | 0%, +0 | ↑ +126 |
| Progressive Disclosure (layered complexity) | 2%, -109 | 12%, -3 | 16%, +8 | ↑ +117 |
| Transition Sophistication | 3%, -38 | 3%, -38 | 2%, +76 | ↑ +114 |
| "Everyone Else" Maneuver (subtle shaming) | 0%, +110 | 1%, -45 | 0%, +0 | ↓ -110 |
| Comparison Moment (side-by-side) | 12%, +31 | 8%, +22 | 7%, -71 | ↓ -102 |
| Transformation Promise (identity shift) | 15%, +68 | 16%, +14 | 13%, -30 | ↓ -98 |
| Power Word Cluster Density | 1%, +15 | 1%, +55 | 1%, -80 | ↓ -95 |
| Counterfactual Count ("what if") | 4%, +92 | 10%, +33 | 6%, -3 | ↓ -95 |
| FOMO Construction (fear of missing out) | 3%, -10 | 4%, -1 | 5%, +77 | ↑ +87 |
| Villain Named (explicit antagonist) | 23%, +52 | 23%, +24 | 20%, -27 | ↓ -79 |
| Future Self Projection (identity transform) | 4%, +21 | 5%, +77 | 2%, +95 | ↑ +74 |
| Callback Count (internal references) | 4%, -38 | 2%, -1 | 4%, +29 | ↑ +67 |
| Emotional Bookend Match | 7%, -25 | 87%, +25 | 86%, +42 | ↑ +67 |
| Unsaid Problem (implicit pain) | 3%, +85 | 1%, -43 | 3%, +29 | ↓ -56 |

---

## Top 1% Deep Dive — Story & Persuasion Profile

**Top 17 products** vs rest of dataset:

| Dimension | Top 1% | Dataset | Gap |
|---|---|---|---|
| Villain Named (explicit antagonist) | 17% | 23% | -6pp |
| Stakes Escalation (problem grows) | 29% | 12% | +17pp |
| Definitive Closing (clean end) | 35% | 43% | -8pp |
| Empathy First-Hand (speaker lived it) | 0% | 8% | -8pp |
| Onboarding Time Claim | 0% | 3% | -3pp |
| Emotional Bookend Match | 23% | 40% | -17pp |
| Transformation Promise (identity shift) | 23% | 15% | +8pp |
| Vulnerability Moment (admits failure) | 5% | 2% | +3pp |
| Reciprocity Trigger (free before ask) | 5% | 12% | -7pp |
| Open Loop Closing (forward-looking) | 11% | 4% | +7pp |
| Inciting Incident (specific origin story) | 11% | 8% | +3pp |
| Comparison Moment (side-by-side) | 5% | 10% | -5pp |
| Effort Reduction Vague | 0% | 12% | -12pp |
| Progressive Disclosure (layered complexity) | 0% | 6% | -6pp |
| Nested Stories (story within story) | 0% | 4% | -4pp |

---

*Analysis generated by merge_and_report.py*
*1712 transcripts analyzed across 100 new dimensions*