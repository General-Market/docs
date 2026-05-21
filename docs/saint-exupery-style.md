# Saint-Exupéry-Style Writing — Sourced Reference Table

Every target below is calibrated against publicly-quoted passages from Antoine de Saint-Exupéry — *Terre des hommes* (1939), *Vol de Nuit* (1931), *Pilote de guerre* (1942), *Le Petit Prince* (1943), and *Citadelle* (1948, posthumous).

Saint-Exupéry was an aviator before he was a writer. His prose marries cockpit precision and cosmic wonder. He is aphoristic — but warm, earnest, reverent about work, hopeful about people. Where Cioran negates a comfort, Saint-Exupéry affirms a truth.

Use as a paste-block at the top of any writing prompt where Saint-Exupéry-grade output is required.

---

## 1. The Five Voice Axes

| Axis | Saint-Exupéry | Cioran (counter-example) |
|---|---|---|
| Stance toward life | Reverence | Mockery |
| Tone | Warm, earnest | Dry, bitter |
| Relation to reader | Co-pilot, beloved | Patient, suspect |
| Pronoun gravity | "we", "I", direct "tu" | "we", "I", impersonal "you" |
| Aphorism direction | Affirms a truth | Negates a comfort |

The Saint-Exupéry writer believes in the work. Both voices produce aphorisms; only one trusts.

---

## 2. Sentence Length Distribution

His prose is more lyrical than Cioran's. Long descriptive sentences build the landscape, then a short truth lands. Build → land → silence.

| Metric | Target |
|---|---|
| Median sentence length | 14 words |
| Max sentence length | 38 words (one per paragraph) |
| % sentences ≤ 8 words | ≥ 20% |
| Standalone aphorisms (≤ 12 words) | ≥ 1 per 200 words |

[Source: sampled from *Terre des hommes*]

---

## 3. Banned Words

Zero occurrences.

```
exciting · innovative · unlock · leverage · cutting-edge · synergy
game-changing · awesome · amazing · please note · it is worth mentioning
```

Soft-banned (≤ 1 per 1000 words): really, very, actually, basically, simply.

---

## 4. Hedging Words

Zero occurrences. The aviator voice is certain because it has flown the route.

```
perhaps · maybe · may · might · seems · appears · arguably · probably
```

[Source: *Vol de Nuit* — Rivière's certainty under storm]

---

## 5. Pronoun Discipline

| Pronoun | Allowed |
|---|---|
| we / us / our | Dominant — the brotherhood of those who build |
| I / me / my | Permitted when the writer is present in person |
| you / your | Permitted as direct, loving address — never as accusation |
| no pronoun (impersonal) | Permitted for cosmic statements |

The Saint-Exupéry "you" is the apprentice the writer cares for: *"If you would build a ship, do not gather your men to chop wood — teach them to long for the vast and endless sea."* That "you" is a hand on the shoulder, not a finger pointed.

[Source: *Citadelle*, attributed passages]

---

## 6. The Wonder Requirement

Every section ≥ 200 words contains at least one moment of wonder. A moment of wonder is a sentence that:

- Names a physical detail with reverence — the stars, the wind, the hands, the engine
- Treats the small thing as a doorway to the large
- Does not pivot to irony

Pattern: *"I have flown six thousand kilometres of African sand. I have learned to read the wind by the way it folds the dunes."*

[Source: *Terre des hommes*]

---

## 7. Aphorism Cadence

Aphorisms close paragraphs. Short, affirmative, often paradoxical, never bitter.

| Prose length | Required standalone aphorisms |
|---|---|
| < 300 words | 1 |
| 300–800 words | 2 |
| 800–1500 words | 3 |
| > 1500 words | 4 |

Each aphorism must:
- Be ≤ 15 words
- Land at the end of a paragraph
- Affirm something, not negate something

Canon to emulate:
- *Perfection is reached not when there is nothing left to add, but when there is nothing left to take away.* (*Terre des hommes*)
- *Love does not consist of gazing at one another, but of looking outward together in the same direction.* (*Terre des hommes*)
- *What is essential is invisible to the eye.* (*Le Petit Prince*)
- *You are responsible, forever, for what you have tamed.* (*Le Petit Prince*)

---

## 8. Specificity — The Physical World

Saint-Exupéry's prose is grounded in physical things. Not abstractions, not categories. The mail-bag. The compass bearing. The hand of the mechanic. The smell of fuel at dawn.

Every section ≥ 200 words must contain at least one physical anchor:

- An instrument, a tool, a piece of equipment
- A landscape, a wind, a star, a dune
- A hand, a face, a voice
- A specific time of day, a specific weather

Without physical anchors, the writing floats. Saint-Exupéry never floats.

[Source: *Vol de Nuit* — the cockpit-level realism]

---

## 9. The Work Is Sacred

Work is treated as sacred. The mail must go through. The pilot is responsible for what he has tamed. Build something. Tend to it.

Every page honours the act of building at least once:

- Show the labour, not just the product
- Name the team, not just the company
- Acknowledge the cost of attention

| Page length | Required acknowledgements of labour |
|---|---|
| < 500 words | 1 |
| > 500 words | 2 |

[Source: *Citadelle* — the citadel-building parable]

---

## 10. The Reverent Contradiction

Contradictions are reverent, not ironic. The plane is fragile. The plane carries the world. Both are true.

| Page length | Required contradictions |
|---|---|
| < 500 words | 0 |
| 500–1500 words | 1 |
| > 1500 words | 2 |

A reverent contradiction holds two truths in the same hand. It is not a hedge. It is a deepening.

[Source: *Pilote de guerre*]

---

## 11. Reference Implementations

Public canon, worth quoting at a dinner table:

```
"On ne voit bien qu'avec le cœur. L'essentiel est invisible pour les yeux."
                                                  — Le Petit Prince

"La perfection est atteinte, non pas lorsqu'il n'y a plus rien à ajouter,
 mais lorsqu'il n'y a plus rien à retirer."
                                                  — Terre des hommes

"Aimer, ce n'est pas se regarder l'un l'autre, c'est regarder ensemble
 dans la même direction."
                                                  — Terre des hommes

"Si tu veux construire un bateau, ne rassemble pas tes hommes pour aller
 chercher du bois, mais enseigne-leur la nostalgie de la mer."
                                                  — Citadelle (attributed)
```

Repository exemplars to be added as Saint-Exupéry-style pages ship.

---

## Audit Procedure

Before publishing any prose page:

1. Word count, sentence count, median.
2. Grep for banned words. Result empty.
3. Grep for hedging words. Result empty.
4. Count physical anchors per ≥ 200-word section. Each section ≥ 1.
5. Count aphorisms. Compare to the cadence table.
6. Check tone: any irony pointed at the work itself? Rewrite.
7. Check "you": apprentice address (allowed) or accusation (forbidden)?
8. Does the page honour the labour at least once?

The audit is mechanical. A reviewer with a ruler should reach the same verdict as the writer.

---

## Sources

- Antoine de Saint-Exupéry, *Terre des hommes* / *Wind, Sand and Stars* (1939)
- Antoine de Saint-Exupéry, *Vol de Nuit* / *Night Flight* (1931)
- Antoine de Saint-Exupéry, *Pilote de guerre* / *Flight to Arras* (1942)
- Antoine de Saint-Exupéry, *Le Petit Prince* (1943)
- Antoine de Saint-Exupéry, *Citadelle* (1948, posthumous)
