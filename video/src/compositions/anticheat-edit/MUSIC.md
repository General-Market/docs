# AntiCheatEdit — Music & Atmosphere Cue Sheet

The composition plays one baked `final.mp4` (voice only, 802s / 13:22) with
chart overlays on the 13 mechanism beats. No music is wired in yet.

One score that grows. The instrument **count** carries the narrative: sparse at
the open (3–4), an eight-layer wall at the worst revelation, warmth and space
when the solution arrives, sparse again at the close (2–3).

Core identity: cold, intelligent, investigative fintech exposé. Restrained
electronic-orchestral hybrid. The Anti-Cheat theme is a machine that never
stops favouring the house — a relentless pulsing ostinato (the rig), sub bass
(the threat), a felt-piano motif (you, alone), cold pads (the institution),
ticking data percussion (the market). It builds by **adding** layers, not by
getting louder. It resolves by stripping back to warm piano + strings when the
solution lands — the machine's pulse finally stops.

## Sections (final.mp4 seconds; mechanism anchors from overlays/timeline.ts)

| # | Band | Beat | Emotion | Style | BPM | Instruments | Count |
|---|------|------|---------|-------|-----|-------------|-------|
| 1 | 0–28 | Cold open + credibility | Intrigue, quiet authority, first chill | Minimal teaser, one tone blooming into a heartbeat | ~60 rubato | sub-drone · felt-piano (2–3 notes) · distant pad · sub-boom on title | 3–4 |
| 2 | 28–106 | M1 Colocation · M2 Region | Curiosity → discomfort | Machine starts — looping ostinato | 84 mechanical | ostinato · sub · soft pad · data-tick · piano motif | 4–5 |
| 3 | 106–238 | M3 Fee tiers | Indignation, rigged by money | Pulse + first weight | 84 | + bowed low cello · muted piano chords | 5–6 |
| 4 | 238–339 | M4 Listing front-run · M5 Order-flow | Paranoia, exposure | Tension rises | 88 | + heartbeat sub-pulse · dissonant high pad · detuned bell · short riser | 6 |
| 5 | 339–433 | M6 PFOF · M7 B-book | Betrayal, "free is the most expensive word" | Hollow texture | 84 | thinned ostinato · sub · cold piano · breathy pad · low boom | 4–5 |
| 6 | 433–516 | M8 MEV · M9 Last look | Technological menace | Re-thicken, driving | 92 | + light kick/perc · arp synth · rising drone · data-pulse | 6–7 |
| 7 | 516–602 | M10 API · M11 Funding | Accumulation, weariness — a thousand cuts | Relentless, repetitive | 92–96 | full pulse + perc + strings + clock-tick · strained high piano | 7 |
| 8 | 602–648 | M12 Rebate · M13 Liquidation | **DREAD PEAK** — the house always wins | Max density → held breath | 96–100 → cut | everything: perc · double-sub · tremolo strings · low-horn swell · climax riser → SILENCE | 8 |
| 9 | 648–704 | "But there is solutions" → General Market | **CLIMAX — release, hope, ascension** | Shift to MAJOR, warm, open | 76 → 84 | warm grand piano (full chords) · rising strings · pad bloom · warm pulse · reverse-cymbal swell | 5–6 |
| 10 | 704–760 | The proof / rebuttal | Vindication, weight of evidence | Grounded, confident | 80 | resolved piano motif (major) · strings · soft sub · light pulse · low boom on court cases | 4–5 |
| 11 | 760–802 | The close — "the little spark" / "choose your counterparty" | Quiet wisdom, a gift | Stripped to essence, fades out | ~66 rubato | solo felt-piano · one warm pad · last sub-note | 2–3 |

## The two peaks

- **Dread peak (§8, 10:02):** intensity pointed *down*. Eight layers, agitated
  strings, double sub, riser collapsing into **silence** on "but there is
  solutions." That silence is the most important beat in the score.
- **Climax (§9, 10:48):** the release — same energy turned *upward* into
  major-key warmth. The machine's pulse stops. Everything before exists to make
  this land.

## Atmosphere (paths under video/public/sfx/)

- Continuous bed (body): `ambient-tech-hum.mp3` @ ~0.03 — the institutional machine.
- Paranoia + dread (§4, §8): `ambient-drone-dark.mp3`, `dramatic-suspense-drone.mp3`.
- Heartbeat: `heartbeat.mp3` enters §4 → `dramatic-heartbeat-fast.mp3` into §8.
- Statistical bleed (§7): `env-clock-tick.mp3` + `data-tick-count.mp3`.
- Market texture (body): `stock-ticker.mp3`, `data-pulse-beat.mp3`.
- Per mechanism card (×13): `mg-whoosh-deep.mp3` → `riser-short-tension.mp3` → `impact-cinematic.mp3` / `hit-deep-sub.mp3`.
- Dread peak (§8): `riser-cinematic-build.mp3` → `buildup-climax-grid.mp3` → `boom-cinematic.mp3`.
- The turn (§9): `riser-reverse-cymbal.mp3` swelling → clean drop into `ambient-office-soft.mp3` + `ambient-space-tone.mp3`.

## Mixing law

Voice on top, always. Music ducked to 0.10–0.15 under speech, lifted to
0.30–0.40 in title-card gaps and the §9 swell. Atmospheric beds stay near-
invisible at 0.03–0.05 — felt, not heard.

## Sourcing (next step, not done yet)

Each section's Style + Instruments line doubles as a MusicGen prompt:
`python3 scripts/generate_music.py music "<style>, <instruments>, <BPM> BPM, cinematic documentary, minor key" -d <band length>`.
Generate per-section stems, crossfade at the boundaries, mount under one
`<Audio>` in AntiCheatEditComposition.tsx with a volume keyframe envelope that
follows the mixing law above.
