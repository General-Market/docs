# Phase 7 — Montage (manifest-driven, retake-aware, resyncable)

Most of phase 7 lives as *code* rather than prose in this build, because the decisions are mechanical — *which take wins this sentence?* *which video frames pair with this audio span?* — and they all live in one file the apprentice can edit by hand: `06-voiceover/manifest.json` (mirrored into `video/src/compositions/anticheat-video/manifest.json`, which is what the Remotion composition actually reads).

The composition is a pure function of the manifest. Edit one row, refresh the studio, see the result. There is no hidden state.

---

## What was recorded

| File | Role |
|---|---|
| `06-voiceover/take-A-raw.mp3` (12:48 PM) | take paired with the video — the apprentice's recording of the script with the camera rolling |
| `06-voiceover/take-A-video.mp4` (12:26 PM) | the video that goes with take A — the apprentice's face on camera |
| `06-voiceover/take-B-raw.mp3` (1:11 PM) | audio-only take — done after the video, possibly cleaner or differently delivered |

The two audio takes contain *retakes* — the apprentice stumbled, restarted, said the same sentence two or three times. The aligner finds every attempt and picks the best one per take. Then a second decision picks between A's best and B's best for each script sentence.

## The pipeline (`build_all.sh`)

```
06-voiceover/build_all.sh
  ├─ 1. ffmpeg          → 16 kHz wav (parakeet)  + 48 kHz wav (DeepFilterNet)
  ├─ 2. parakeet        → word-level timing JSON per take
  ├─ 3. extract_script  → 130 sentences with normalised words and rhythm tags
  ├─ 4. align           → per take, find ALL candidate spans per sentence,
  │                       pick the best (high score, latest wins ties)
  ├─ 5. build_manifest  → per sentence, pick take A or B (heuristic), write manifest.json
  ├─ 6. clean_audio     → DeepFilterNet noise removal on both 48 kHz wavs
  └─ 7. publish         → copy cleaned audio + video + manifest into video/public/
                          and video/src/compositions/anticheat-video/
```

Re-runnable. Idempotent. Skips work that's already done. To force a stage to re-run, delete its output file.

## The manifest

`manifest.json` is the *single source of truth* the Remotion composition reads. Per-sentence shape:

```jsonc
{
  "id": "p1_s1",
  "paragraph": "P1",
  "rhythm": "slow",
  "text": "Last October, a trader called 0xQuaza wrote down…",
  "source": "A",                       // ← the picked take
  "sourceA": {
    "chosen":     { "start": 4.21, "end": 17.84, "duration": 13.63, "score": 0.93, ... },
    "candidates": [ ... all attempts within take A ... ],
    "candidateCount": 3
  },
  "sourceB": {
    "chosen":     { "start": 3.88, "end": 18.20, "duration": 14.32, "score": 0.86, ... },
    "candidates": [ ... ],
    "candidateCount": 1
  },
  "autoPick": "A",                     // what the heuristic decided
  "pickReason": "default A (A 93%/3c vs B 86%/1c)",
  "overridden": false,
  "broll": null                        // path to a B-roll clip when source = B
}
```

## How to fix things

| Problem | Fix |
|---|---|
| Wrong take chosen for sentence X | Add `{"p1_s4": "B"}` to `overrides.json`, run `build_all.sh` again |
| Sentence start/end is wrong | Edit `manifest.json` → `sentences[i].sourceA.chosen.start` (or `.end`) directly, refresh studio |
| Video slips behind audio everywhere | Edit `manifest.json` → `videoOffsetSeconds` (positive = video plays from later in the source); refresh |
| A sentence didn't align at all | `chosen` is `null` — open the candidates list for that sentence and pick one manually by editing the manifest, OR override the source to the take that did align |
| A retake was misidentified | Look at `candidates` for that sentence in `align-A.json` / `align-B.json`; if a different candidate is the keeper, copy its values into `chosen` |

The `candidates` array carries every attempt at a sentence within a take, with start/end and score. That is the recovery surface when the auto-pick gets it wrong.

## What B-roll looks like (today)

Every sentence picked as source B renders a *placeholder* — a dark gradient with the sentence text and a `[B-ROLL] p1_s4 · P1` badge in the top-left. The placeholder is a real frame, sized to the composition; it does not interrupt audio playback.

To replace a placeholder with real B-roll later: drop a video clip into `video/public/anticheat-takes/broll/` and set the sentence's `broll` field in the manifest to the clip path. The composition can be extended to render the clip in place of the placeholder when `broll` is non-null. *(The render is not wired yet — write it when the first real B-roll lands.)*

## Mix and effects

Phase 6 cleaned both takes with DeepFilterNet — that is the only audio processing applied. The composition plays the cleaned wavs at full volume. There is no music bed, no SFX layer, no ducking.

The next step in this phase, once the visuals lock, is to add a music bed under the voice — ducked to roughly −22 to −28 LUFS while the voice is speaking, lifted to −18 in the three silent beats (P7, P26, P37). The skill's recipe for that is in phase 7's *Music edit* section.

## Open Remotion Studio

```bash
cd /Users/maxguillabert/Downloads/index/video
npx remotion studio --port 3333
# → http://localhost:3333 → AntiCheatVideo
```

Reload the page after editing the manifest.

## What's still missing

- Final music bed and ducking automation
- Hero shots from `04-title-thumbnail.md` — the diverging chart pair, the receipt-card template, the 45-bps stack — captured as B-roll for the manifest
- Captions / word-synced text layer over the talking head (optional; will lift retention)
- A pass through the composition with the apprentice's eye, flagging sentences whose `chosen` is wrong → overrides

The pipeline is built so each of these can be added without re-architecting anything.

*The composition is a pure function of the manifest. Everything else is a tool that writes to the manifest.*
