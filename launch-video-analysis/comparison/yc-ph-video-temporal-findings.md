# Product Hunt Video Analysis — How What Works Has Changed (Q4 2024 → Q1 2026)

**Dataset:** 571 Product Hunt launch videos with extended analysis + vote data, broken into quarters.

| Quarter | Videos | Median Votes | Mean Votes |
|---|---|---|---|
| 2024 Q4 | 37 | 335 | 404 |
| 2025 Q1 | 242 | 408 | 483 |
| 2025 Q2 | 66 | 300 | 380 |
| 2025 Q3 | 53 | 382 | 403 |
| 2025 Q4 | 68 | 283 | 321 |
| 2026 Q1 | 101 | 330 | 369 |

---

## The Central Discovery: Rules Invert in Under Six Quarters

The visual signals that predicted success in Q4 2024 either collapsed or reversed by Q1 2026. The quarter-by-quarter view reveals this wasn't a sudden flip — it was a gradual drift through 2025, accelerating in late 2025 and crystallizing in 2026.

---

## The 10 Major Shifts — Quarter by Quarter

### 1. Dark Mode: From King to Poison (shift: -0.73)

```
2024Q4: r=+0.498*  |++++++++++++++     ← Dark mode = highest-correlated signal
2025Q1: r=-0.018   |                    ← Instantly collapsed
2025Q2: r=-0.058   |-
2025Q3: r=+0.023   |                    ← Brief blip
2025Q4: r=+0.008   |                    ← Dead
2026Q1: r=-0.228*  |------              ← Now actively hurts
```

In Q4 2024, dark mode was the single strongest predictor of votes (r=+0.50, p<0.01). By Q1 2025 — one quarter later — the correlation was already zero. By Q1 2026 it's significantly negative. The speed of this inversion is remarkable. It took one quarter to go from "best thing in the dataset" to "irrelevant."

**Average dark mode usage:** 32% → 36% → 46% → 34% → 35% → 36%. Usage barely changed. The *audience's response* changed completely. Everyone still makes dark videos — they just stopped rewarding them.

### 2. Brightness: Mirror Image of Dark Mode (shift: +0.64)

```
2024Q4: r=-0.387*  |-----------         ← Bright = penalty
2025Q1: r=+0.017   |                    ← Neutral
2025Q2: r=+0.057   |+
2025Q3: r=-0.013   |                    ← Wobble
2025Q4: r=+0.138   |++++                ← Building
2026Q1: r=+0.255*  |+++++++             ← Bright wins
```

Perfect mirror. What was a significant penalty (r=-0.39) in Q4 2024 became a significant positive (r=+0.26) by Q1 2026. The crossover happened in Q1 2025.

### 3. Light Mode: Same Arc (shift: +0.46)

```
2024Q4: r=-0.240   |-------
2025Q1: r=+0.029   |
2025Q2: r=+0.064   |+
2025Q3: r=-0.090   |--                  ← Temporary dip
2025Q4: r=+0.105   |+++
2026Q1: r=+0.215*  |++++++
```

Light mode's rise tracked brightness exactly but with one interesting wobble in Q3 2025. That quarter saw a brief return of dark-mode preference that didn't stick.

### 4. Browser Chrome: From Amateurish to Authentic (shift: +0.42)

```
2024Q4: r=-0.201   |------              ← Browser visible = penalty
2025Q1: r=+0.021   |                    ← Neutral
2025Q2: r=-0.041   |-
2025Q3: r=+0.280*  |++++++++            ← Sudden positive
2025Q4: r=+0.145   |++++
2026Q1: r=+0.216*  |++++++              ← Now a positive signal
```

The flip happened in Q3 2025. Before that: showing browser chrome was sloppy. After: it was authentic. The tipping point was a single quarter.

### 5. Branded Intros: Dead by Mid-2025 (shift: -0.41)

```
2024Q4: r=+0.336*  |++++++++++          ← Long intro = quality signal
2025Q1: r=+0.005   |                    ← Dead
2025Q2: r=+0.014   |                    ← Dead
2025Q3: r=+0.158   |++++                ← Brief revival
2025Q4: r=-0.083   |--                  ← Now negative
2026Q1: r=-0.076   |--
```

Intro cards helped strongly in Q4 2024. By Q1 2025 — gone. A brief resurgence in Q3 2025 (maybe a batch of well-produced launches) didn't hold. By Q4 2025, intros were negatively correlated.

**Average intro duration:** 3.1s → 4.3s → 3.1s → 1.5s → 1.8s → 1.7s. People stopped making them, correctly reading the shift.

### 6. Bitrate / Quality: Steadily Growing (shift: +0.34)

```
2024Q4: r=-0.015   |                    ← Irrelevant
2025Q1: r=+0.086   |++
2025Q2: r=-0.011   |                    ← Wobble
2025Q3: r=+0.260'  |+++++++             ← Breakout
2025Q4: r=+0.225'  |++++++
2026Q1: r=+0.325*  |+++++++++           ← Strongest current signal
```

Video quality went from inert to the strongest current correlation. The breakout happened in Q3 2025. As most visual gimmicks faded, raw production quality became the differentiator that remained.

### 7. PiP: Used and Discarded (shift: -0.31)

```
2024Q4: r=+0.256   |+++++++             ← PiP helps
2025Q1: r=+0.081   |++                  ← Fading
2025Q2-Q4:          insufficient data    ← PiP usage dropped below measurable
2026Q1: r=-0.057   |-                   ← Slight penalty
```

**PiP usage:** 3% → 9% → 2% → 2% → 1% → 3%. A brief spike in Q1 2025, then near-abandonment. By the time 2026 arrived, PiP was a relic. The Loom era lasted approximately two quarters.

### 8. Saturation: Vibrant Hurts Now (shift: -0.24)

```
2024Q4: r=-0.014   |                    ← Inert
2025Q1: r=+0.020   |
2025Q2: r=+0.085   |++                  ← Brief positive
2025Q3: r=-0.035   |-
2025Q4: r=-0.084   |--                  ← Turning negative
2026Q1: r=-0.253*  |-------             ← Saturated = penalty
```

Vivid, saturated colors were neutral through mid-2025. Then they turned negative — quickly. By Q1 2026, saturation is a significant penalty (r=-0.25, p=0.01). The aesthetic shifted to desaturated, professional tones.

### 9. Face Presence: Rose Then Fell

```
2024Q4: r=+0.110   |+++
2025Q1: r=+0.102   |+++
2025Q2: r=+0.183   |+++++               ← Peak
2025Q3: r=+0.277*  |++++++++            ← Strongest quarter
2025Q4: r=+0.094   |++                  ← Fading
2026Q1: r=-0.008   |                    ← Inert
```

Faces peaked in Q3 2025 as a strong positive (r=+0.28). Then collapsed in Q4 2025 and reached zero by Q1 2026.

**Face usage:** 13% → 25% → 8% → 3% → 3% → 14%. Volatile. But the audience stopped caring regardless.

### 10. Motion: Slowly Rising

```
2024Q4: r=-0.046   |-
2025Q1: r=+0.096   |++
2025Q2: r=+0.007   |
2025Q3: r=+0.095   |++
2025Q4: r=+0.122   |+++
2026Q1: r=+0.108   |+++
```

Motion went from slightly negative to consistently positive. Not dramatic, but steady. Dynamic content now outperforms static — a reversal from Q4 2024.

---

## Boolean Features: Quarter-by-Quarter Adoption & Effect

### Before/After (consistently valuable)

| Quarter | % Using | Median Diff |
|---|---|---|
| 2024Q4 | 38% | **+61** |
| 2025Q1 | 46% | **+42** |
| 2025Q2 | 30% | **+40** |
| 2025Q3 | 36% | **+50** |
| 2025Q4 | 28% | **+43** |
| 2026Q1 | 45% | **+42** |

The only feature that worked every single quarter with roughly stable effect size. Never faddish. Adoption oscillates between 28-46% — never saturated.

### Urgency/Scarcity (strengthening)

| Quarter | % Using | Median Diff |
|---|---|---|
| 2024Q4 | 27% | +61 |
| 2025Q1 | 36% | +29 |
| 2025Q2 | 23% | -36 |
| 2025Q3 | 19% | **+137** |
| 2025Q4 | 28% | +54 |
| 2026Q1 | 33% | **+58** |

Volatile quarter-to-quarter but the trend is upward. Crashed in Q2 2025, spiked dramatically in Q3 2025 (+137). The correlation is strengthening into 2026.

### Pricing on Screen (new signal in 2026)

| Quarter | % Using | Median Diff |
|---|---|---|
| 2024Q4 | 8% | +26 |
| 2025Q1 | 5% | -48 |
| 2025Q2 | 6% | -43 |
| 2025Q3 | 6% | +38 |
| 2025Q4 | 4% | **+129** |
| 2026Q1 | 8% | **+90** |

Pricing actively *hurt* in early 2025 (Q1: -48, Q2: -43). Then it flipped in Q4 2025 to +129 and held at +90 in Q1 2026. As AI products flooded PH with vague positioning, concrete pricing became a trust signal.

### Testimonials (recovering from a dip)

| Quarter | % Using | Median Diff |
|---|---|---|
| 2024Q4 | 19% | **+122** |
| 2025Q1 | 16% | -13 |
| 2025Q2 | 12% | +80 |
| 2025Q3 | 6% | **+322** |
| 2025Q4 | 12% | -10 |
| 2026Q1 | 17% | **+58** |

Wildly volatile. The Q3 2025 +322 is a small-n outlier. But the pattern: testimonials help when they're rare (6% in Q3 = +322), lose effect when common (16-19% = -13 to +58). Scarcity drives the testimonial's value.

### URL Shown (new emerging signal)

| Quarter | % Using | Median Diff |
|---|---|---|
| 2024Q4 | 5% | 0 |
| 2025Q1 | 7% | -62 |
| 2025Q2 | 6% | +5 |
| 2025Q3 | 6% | **+188** |
| 2025Q4 | 4% | **+239** |
| 2026Q1 | 5% | **+128** |

In 2025 H2, showing your URL exploded as a signal (+188, +239, +128). Low usage (4-7%) makes these high-variance, but the direction is consistent. Showing the URL says "go try it now" — a confidence signal.

---

## How Videos Are Being Made — The Production Shift

| Metric | Q4 2024 | Q1 2025 | Q2 2025 | Q3 2025 | Q4 2025 | Q1 2026 |
|---|---|---|---|---|---|---|
| Avg brightness | 135 | 128 | 117 | 141 | 134 | 136 |
| Dark mode % | 32% | 36% | 46% | 34% | 35% | 36% |
| Light mode % | 42% | 38% | 37% | 50% | 43% | 45% |
| Face presence % | 13% | 25% | 8% | 3% | 3% | 14% |
| PiP frames | 4.4 | 2.9 | 0.1 | 0.7 | 0.2 | 1.3 |
| Avg motion | 31.1 | 33.5 | 36.1 | 37.7 | 36.3 | 31.9 |
| Bitrate kbps | 344 | 346 | 321 | 300 | 272 | 264 |
| Total OCR words | 142 | 127 | 64 | 42 | 45 | 55 |
| Intro duration (s) | 3.1 | 4.3 | 3.1 | 1.5 | 1.8 | 1.7 |
| Cool frame % | 13% | 20% | 21% | 19% | 16% | 14% |
| Saturation | 56 | 56 | 52 | 54 | 53 | 47 |

**The production trend:** Bitrate is declining (264 vs 344), text density dropped by 60%, PiP disappeared, intros shortened from 3s to 1.7s, faces became volatile. Videos got leaner and faster. But paradoxically, the *audience* now rewards higher bitrate more than ever — the gap between what people make and what works is widening.

---

## The Three Eras

### Q4 2024: The Polished Dark Era
- Dark mode = strongest signal (+0.50)
- Branded intros help (+0.34)
- PiP helps (+0.26)
- Browser chrome hurts (-0.20)
- Brightness hurts (-0.39)
- Quality irrelevant

### Q1-Q3 2025: The Great Neutralization
- Most Q4 2024 signals collapse to zero
- Face presence briefly spikes as a signal (Q2-Q3)
- Browser chrome flips positive (Q3)
- Quality starts mattering (Q3)
- Everything is in flux — no stable playbook
- Q2 2025 is the "nothing works" quarter

### Q4 2025 – Q1 2026: The New Rules
- Bright/light mode wins (+0.22 to +0.26)
- Quality is king (+0.33)
- Browser chrome is authentic (+0.22)
- Dark mode hurts (-0.23)
- Saturation hurts (-0.25)
- Urgency resurges (+0.19)
- Pricing emerges (+90 to +129 median)
- Before/after still works (+42)
- Faces, PiP, intros = inert or negative

---

## The Pattern

Every 4-6 quarters, the meta inverts. What works gets adopted. What gets adopted becomes background noise. What was background noise becomes distinguishing.

**2024:** "Make it dark, polished, with a face and a branded intro."
**2025:** "Nothing works. Everything is noise."
**2026:** "Make it bright, high-quality, raw, and show the price."

The stable through-lines: before/after structures, metrics, and benefit language. These survived every era. Everything else is fashion.

The deepest lesson: the audience doesn't know what it wants until everyone gives it the same thing. Then it wants the opposite.
