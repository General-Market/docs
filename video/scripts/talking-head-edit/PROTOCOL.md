# Talking-head edit protocol

The repeatable pipeline for turning a raw recording session into a cut,
voice-processed, title-carded video. Built and proven on the AntiCheat
("13 mechanisms") video; the composition lives at
`src/compositions/anticheat-edit/`.

The recorder writes **three Matroska files per session** into `~/Movies/`:

```
screen-YYYY-MM-DD-HH-MM.mkv   screen capture   (audio track is silent: −91 dB)
camera-YYYY-MM-DD-HH-MM.mkv   webcam           (audio track is silent: −91 dB)
mic-YYYY-MM-DD-HH-MM.mkv      black video + the only real audio
```

Only the **mic** file carries sound. The camera's own audio track exists but is
muted by the recorder — never transcribe or mux the camera audio.

The work is six scripts, run in order. Everything keys off the mic file for
audio and the camera file for picture; they start within a few ms of each other,
so concatenating in recording order keeps them in sync without manual alignment.

---

## 0. Pick the sessions

A take is usually one long "main" file plus a short "intro/pickup" file. Decide
the play order — for AntiCheat the short 16:29 retake was the intro, the long
15:58 file the body. Order matters: it sets the merge offsets in step 3/4.

## 1. Transcribe — `01_transcribe.py`

WhisperX `large-v3` + wav2vec2 forced alignment for word-level timestamps.

**Set `LANG` correctly.** The single worst mistake on this project: it was left
at `"fr"` and Whisper *translated* 30 minutes of English into fluent invented
French. Every downstream cut sat on hallucinated text. **The speaker talks in
English → `LANG = "en"`.** A forced wrong language never errors — it silently
mistranslates.

Runs on CPU (CTranslate2 has no MPS); ~6–10 min for 30 min of audio. Needs the
`torch.load` weights_only patch + omegaconf safe-globals (already in the script)
because PyTorch 2.6 broke pyannote/​speechbrain checkpoint loading.

Output: `/tmp/anticheat-aligned.json` (word timestamps). Transcribe each session
separately, then merge with a time offset so the second session's timestamps
follow the first.

## 2. Process the voice — `02_process_voice.py`

Pedalboard chain modelled on the GarageBand "Narration Vocal" strip the user
runs. Current target: **podcast, low-tone, dry**.

```
HPF 60 Hz → NoiseGate −42 dB → DeEsser (6 kHz peak→comp→cut)
→ LowShelf +2 dB @110 → −1.5 dB @350 (mud) → Comp 5:1 slow
→ +2.5 dB @200 (body) → −1.5 dB @3k (soften) → Comp 2.5:1 glue
→ HighShelf −3 dB @9k (smooth top) → Reverb wet 0.02 (nearly dry) → Limiter −1 dBFS
```

No exciter (it brightens — wrong direction for low-tone). Reverb is deliberately
tiny. **Breath removal**: every inter-word gap 0.1–0.8 s gets ducked −28 dB with
a 25 ms raised-cosine fade, using the word timestamps from step 1.

To re-voice: edit the knob values in `build_board()` and re-run. The chain is
sample-aligned, so word timestamps from step 1 still hold afterwards.

## 3. Curate the beats — `03_curated_beats.py`

**This is the human step.** Read the full transcript (use `dump_script.py` to
print it timestamped) and hand-pick the best take of each beat as
`(start, end, "label")` tuples. The speaker does multiple takes, switches
languages, abandons sentences — no similarity threshold catches this reliably,
because an incomplete first take and its finished retake are only ~60 % similar.
Read it like an editor. Each label carries the transcript line number for
cross-check.

## 4. Clean the cut — `04_clean_cuts.py`

Word-level pass that removes the artifacts hand-curation leaves behind. This is
what kills **rollbacks** (audio jumping back to replay a word):

- **One word, one segment.** Walks beats in order; a word consumed by an earlier
  segment can never replay in a later one. Removes cross-cut echoes.
- **Drop stutter runs, keep the last take.** Finds the longest repeated phrase
  (ranked by occurrence count first, then length — so a 3× "and this is all"
  beats a 2× "and this is all the") and deletes everything from the first
  occurrence up to the last. Guards: skip if clause punctuation sits between
  repeats (that's intentional anaphora — "if X, if Y, if Z"); skip 2-occurrence
  cases that would drop > 4 s of *speech* (likely parallel content, not a
  stutter); always drop 3+ occurrences.
- **Split internal silences > 1.2 s.** No dead air longer than that survives
  inside a sentence.
- **Snap to word edges** (0.06 s lead, 0.12 s tail) — no orphan half-words.

Verifies 0 overlaps at the end. Output: `cuts.json` in the composition folder.

## 4b. Disfluency cleanup — read-based, NOT n-gram (mandatory)

The n-gram stutter matcher in step 4 only catches *exact 3–6 word* repeats. It
**misses** the things that actually make a talking-head cut feel amateur, and it
occasionally **breaks** a good sentence. Three failure classes, all confirmed on
the AntiCheat video, all invisible to the matcher:

1. **Restart / reformulation.** The speaker abandons a sentence and restarts, or
   says the same idea twice in different words. Short repeats ("than this than
   this") are below the 3-word floor; rephrasings share no exact n-gram. The
   matcher also once deleted the *middle* of a 2-occurrence match and left
   "…30 bps **if** [gap] **and** you have…" — gibberish it created itself.
2. **Hesitation gaps.** A pause ≥ 0.45 s *in the middle of a sentence* (not at a
   clause/sentence boundary) is dead air the speaker left while thinking. The cut
   keeps it because it's inside one segment. These are the single biggest source
   of "why does this feel slow."
3. **Slide repeats.** After a section title card, the speaker re-reads the title
   ("…and fair feed latency" right after the *Feed Latency* card). Redundant —
   the slide already says it. Cut the spoken restatement.

**Method that works** (the matcher is not enough — a human/agent must read):

  a. Build an **enriched transcript** of the current cut: every word in play
     order, with `[GAP x.xs]` markers between words and `>>> SLIDE CARD "X" <<<`
     markers. (See the one-off script that wrote `/tmp/enriched-cut.txt`.)
  b. Dispatch **subagents** (split the video into thirds, run in parallel) to
     read it like a film editor and flag every instance of the three classes,
     quoting exact words + giving the SEG number. Whisper's transcript is
     accurate — trust it; the judgment is editorial, not algorithmic.
  c. Consolidate into a master edit list (see `AntiCheat-edit-list.txt` shape).
  d. Apply: Type 1/2 → drop the quoted words; Type 3 → split the segment at the
     gap and rejoin so the pause is removed but words stay contiguous (cap kept
     pause ≈ 0.18 s).

**Slide-repeat rule of thumb:** if the segment right after a card opens with the
card's title words (any phrasing of it), cut those opening words. Leave genuine
transitions ("and coming to the next one, …").

**Hesitation rule of thumb:** flag inter-word gaps ≥ 0.45 s that fall mid-clause.
Do NOT flag pauses at sentence ends or between two distinct points — those are
breathing room and should stay.

## 4c. Three failures we hit, and the standing protections (read this)

These shipped in early cuts and the director caught them. Each now has an
automatic guard in `04_clean_cuts.py`. Do not remove the guards.

1. **ROLLBACK from a close reformulation.** The speaker says a phrase, then a
   few seconds later says it again with different filler between
   ("…faster **to react to the market** and so you will first **to react to the
   market**"). Adjacent-repeat collapse and seam-double checks miss it, and
   `find_stutter_drop`'s tail-ratio test *rejects* it. → `collapse_near_repeats`
   drops any ≥3-word phrase that recurs within ~8 words (unless comma-separated
   anaphora), keeping the second take.

2. **OVER-CUTTING / confetti.** A halting sentence with many 0.45–0.7 s pauses
   got split into 8 jump-cuts in 16 s — staccato, unwatchable. → `HESITATION_GAP`
   raised to **0.70 s**: trim the long thinking pauses, keep natural micro-rhythm.

3. **Silent ship of a bad cut.** → A **verification gate** runs at the end of
   `04_clean_cuts.py` (`verify_no_close_repeats`): it scans the WHOLE cut and
   FAILS loudly if any 5-word phrase replays within 4 s of playback (anaphora
   exempted). **Never ship a cut where this prints anything but PASS.**

The general lesson: every time the director flags a defect type, add a guard AND
a verification check — not just a one-off fix. The guard prevents it; the check
proves it's gone across the whole video, not just the flagged spot.

## 5. Title cards — `05_title_cards.py`

One 1.5 s card per section, Apple black style (SF Pro, blue index, white title,
divider). Each card has a **trigger source-time**; the bake inserts it before
the first kept segment at/after that time. Edit the `CARDS` list to rename,
reorder, or re-time. Cards are NOT sped up.

## 6. Bake — `06_bake.py`

Cuts each `cuts.json` segment from `source.mp4`, applies **1.2× speed**
(`setpts=PTS/1.2` video, `atempo=1.2` audio — pitch preserved by atempo),
inserts the title cards at their triggers, concatenates everything into
`public/anticheat-edit/final.mp4`, and writes `final.meta.json` with the final
duration.

The Remotion composition plays this single `final.mp4` under one
`<OffthreadVideo>`. **One track — never one Sequence per cut.** 87+ sequences
made the studio unusable; a single baked file is responsive.

---

## Source mux (one-time per session set)

Before step 6, `source.mp4` must exist: camera video (stream-copy, it's already
H.264) + processed mic audio, sessions concatenated in play order. See the
`english_pipeline.py` history for the exact ffmpeg invocations
(`-c:v copy`, `-map`, concat demuxer).

## Knobs worth remembering

| Thing | Value | Where |
|---|---|---|
| Language | **en** | `01_transcribe.py` `LANG` |
| Silence split | 1.2 s | `04_clean_cuts.py` `SILENCE_SPLIT` |
| Breath duck | −28 dB, 0.1–0.8 s gaps | `02_process_voice.py` |
| Speed | 1.2× pitch-preserved | `06_bake.py` `RATE` |
| Reverb | wet 0.02 (dry) | `02_process_voice.py` `build_board` |
| Card length | 1.5 s | `05_title_cards.py` `CARD_SECS` |

## The one rule that matters

Read the transcript before you cut. The machine trims silence and catches exact
repeats; it cannot tell a finished thought from an abandoned one. That judgment
is yours.
