# Anti-Cheat Flags — Video

Current phase: **7 — Montage (manifest-driven pipeline running)**
Title: **Your Backtest Was Right. The Venue Lied.**
Script (locked, 5b): 39 paragraphs / 130 sentences / ≈ 2,750 words / ≈ 19–20 min.
Recorded takes:
- `06-voiceover/take-A-raw.mp3` (12:48 PM) — paired with `take-A-video.mp4` (12:26 PM)
- `06-voiceover/take-B-raw.mp3` (1:11 PM) — audio only
Both takes contain retakes — apprentice stumbled and re-read sentences multiple times.
Pipeline (`06-voiceover/build_all.sh`):
1. wav conversion (16k for parakeet + 48k for DeepFilterNet)
2. parakeet transcription (word-level timing)
3. extract 130 script sentences
4. retake-aware alignment per take — finds ALL candidate spans per sentence
5. manifest build — auto-picks best take per sentence (heuristic + overrides)
6. DeepFilterNet noise cleanup
7. publish to `video/public/anticheat-takes/` + `video/src/compositions/anticheat-video/manifest.json`
Remotion composition: `video/src/compositions/anticheat-video/AntiCheatVideoComposition.tsx` — registered in Root.tsx as `AntiCheatVideo`. Reads `manifest.json` at the composition path. Each sentence renders as `<Sequence>` containing `<Audio>` from the chosen take + `<OffthreadVideo>` (source A) OR B-roll placeholder (source B). Resync by editing one row in `manifest.json` and refreshing.
Editorial notes for phase 7 are in `07-edit.md`.
Open in studio: `cd video && npx remotion studio --port 3333` → composition `AntiCheatVideo`.

## Status

- `00-seed.md` — the URL, the date, the surrounding assets
- `01-ideas.md` — domain tree, three candidates, recommendation, checkpoint open
- `02-research.md` — pending
- `03-angle.md` — pending
- `04-title-thumbnail.md` — pending
- `05-plan.md`, `05-script.md` — pending
- `06-voiceover.md` — pending
- `07-edit.md` — pending
- `08-publish.md` — pending
- `09-stats.md` — pending
