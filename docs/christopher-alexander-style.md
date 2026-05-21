# Christopher Alexander-Style Writing — Sourced Reference Table

Every target below is calibrated against Christopher Alexander's body of work: *A Pattern Language* (1977, with Ishikawa & Silverstein), *The Timeless Way of Building* (1979), and *The Nature of Order* (2002–2004).

Alexander wrote about buildings, cities, gardens, and craft. His real subject was *life* — the quality that makes some things feel alive and other things feel dead. His prose is patient, instructive, anti-style. Aphoristic, but the aphorisms are slow, not fast.

Use as a paste-block at the top of any writing prompt where Alexander-grade output is required.

---

## 1. The Five Voice Axes

| Axis | Alexander | Cioran (counter-example) |
|---|---|---|
| Stance toward life | Quiet reverence | Mockery |
| Tempo | Slow, patient | Fast, compressed |
| Voice mode | Master craftsman to apprentice | Aphorist on a balcony |
| Pronoun gravity | "you" as the builder being shown | "you" as the suspect |
| Aphorism shape | Slow truth that builds | Fast truth that cuts |

Alexander's "you" is direct and instructive, never accusing. It is the voice of a teacher with patience.

---

## 2. The Pattern Format

Every prose section, when possible, follows Alexander's pattern shape:

```
NAME — the thing being described
↓
CONTEXT — what kind of situation this is
↓
FORCE — the tension or problem inside the situation
↓
THEREFORE: — the hinge word
↓
SOLUTION — what to do
↓
CONNECTION — pointer to related patterns
```

The hinge word *"Therefore:"* (or *"Therefore,"*) is the most recognisable Alexander cadence. Use it once per section, on its own line where possible.

[Source: *A Pattern Language*, 253-pattern format]

---

## 3. Sentence Length Distribution

Alexander's sentences are patient. Sometimes long, but they always finish on a definite step.

| Metric | Target |
|---|---|
| Median sentence length | 18 words |
| Max sentence length | 45 words (one per paragraph) |
| % sentences ≤ 10 words | ≥ 25% |
| Standalone short statements (≤ 8 words) | ≥ 1 per 200 words |

Pattern: build the situation in 2–3 medium sentences, then close with a short instructive line.

[Source: sampled from *A Pattern Language*]

---

## 4. Banned Words

Zero occurrences.

```
exciting · innovative · unlock · leverage · cutting-edge · synergy
game-changing · awesome · amazing · please note · it is worth mentioning
```

Soft-banned (≤ 1 per 1000 words): really, very, actually, basically, simply, just.

Alexander writes *plainly*. Avoid all flourishes.

---

## 5. Hedging Words

Zero occurrences. Alexander writes with the patient certainty of someone who has built houses with his hands.

```
perhaps · maybe · may · might · seems · appears · arguably · probably
```

Exception: *"It turns out that…"* and *"The fact is that…"* are permitted authority-setters and are characteristically Alexander.

[Source: *The Timeless Way of Building*]

---

## 6. Italics Discipline

Italics are sparing, for emphasis on the *one* word in a sentence that carries the most weight.

| Use | Target |
|---|---|
| Italic words per 1000 words | 3–8 |
| Italic phrases per 1000 words | ≤ 2 |
| Italic for foreign words | always |
| Italic for the word *Therefore:* | always when used as hinge |

Italics in Alexander are a *whisper*, not a shout.

[Source: *A Pattern Language*, sampled]

---

## 7. The Instructive "You"

Alexander's "you" is the apprentice being shown how. Direct, second-person, used freely — never as accusation.

| Pronoun use | Target |
|---|---|
| "you" as instruction-target | unlimited |
| "you" as verdict on reader | 0 |
| "we" as community of builders | unlimited |
| "I" | rare; used only when the writer is being plain |

Pattern: *"When you do X, the result will Y."*

The reader should feel taught, not judged.

[Source: *A Pattern Language*, every pattern uses this form]

---

## 8. The Quality Without A Name

Alexander tests every page against an implicit question: *does it feel alive?*

Aliveness in writing is what aliveness is in a building:

- The page must feel made by a person, not by a committee.
- Every section must have *one* moment where the writer steps closer to the reader.
- Each part must support the whole; nothing decorative.

For each ≥ 200-word section, name at least one *felt human truth* — a thing the reader recognises in their own life, without needing to be told.

Canonical Alexander examples:
- The way light from two sides feels different from light from one.
- The way a window seat invites a body to settle.
- The way a low ceiling at the threshold makes the high room beyond feel bigger.

Translate the move into our domain: name the felt experience, not just the mechanism.

[Source: *The Nature of Order* Vol. 1]

---

## 9. Sentence-Pattern Repetition

Alexander repeats sentence structures across paragraphs, building rhythm by anaphora:

> *A garden must have a place to sit. A garden must have a place to walk slowly. A garden must have a place where the eye can rest.*

Use this device at least once per page where the topic admits a list. The repetition creates the feeling of a *whole*.

| Page length | Required anaphoric sequences |
|---|---|
| < 500 words | 0 |
| 500–1500 words | 1 |
| > 1500 words | 2 |

[Source: *A Pattern Language*, *The Nature of Order*]

---

## 10. Pattern Cross-Linking

Alexander numbers every pattern (1–253). Each pattern ends by pointing to related patterns.

In our docs, mimic this by ending each ≥ 200-word section with an explicit pointer to another concept on the page or another doc page. The pointer should feel like a thread, not a sales link.

Pattern: *"To deepen this, see [Concept Name]."*

[Source: *A Pattern Language*, every pattern ends with cross-references]

---

## 11. Tempo and Whitespace

Alexander's prose is *slow*. Whitespace is part of the meaning.

| Metric | Target |
|---|---|
| Avg sentences per paragraph | 2–4 |
| Standalone single-sentence paragraphs | ≥ 2 per 1000 words |
| Indented block quotes for emphasis | acceptable, sparingly |
| Em-dashes per 1000 words | ≤ 6 |

The reader should feel they have room to think between sentences.

[Source: *The Timeless Way of Building*, layout-as-meaning]

---

## 12. Reference Implementations

Canonical Alexander lines — public canon:

```
"At the core, there is a *quality which cannot be named*."
                                       — The Timeless Way of Building

"Therefore: arrange the path through a building so that it passes
 through several intermediate places before reaching the place itself."
                                       — A Pattern Language, Pattern 130

"It turns out that the buildings which have life are built differently
 from the buildings which do not."
                                       — The Nature of Order

"You may say to yourself, when the day is done, that you have made
 something that is alive."
                                       — A Pattern Language, foreword
```

Repository exemplars to be added as Alexander-style pages ship.

---

## Audit Procedure

Before publishing any prose page:

1. Word count, sentence count, median.
2. Grep for banned words and hedging words. Both must be empty.
3. Count italics. Within 3–8 per 1000 words?
4. Find the *Therefore:* hinge in each section. Present?
5. Each ≥ 200-word section: a felt human truth named?
6. At least one anaphoric sequence on the page?
7. Cross-link at the end of each ≥ 200-word section?
8. "you" — instructive only, never accusing?
9. Does the page feel *slow*? Does the reader have room?

The audit is mechanical. A reviewer should reach the same verdict as the writer.

---

## Sources

- Christopher Alexander, Sara Ishikawa, Murray Silverstein, *A Pattern Language* (1977)
- Christopher Alexander, *The Timeless Way of Building* (1979)
- Christopher Alexander, *The Nature of Order*, Vols. I–IV (2002–2004)
- Christopher Alexander, *The Oregon Experiment* (1975)
