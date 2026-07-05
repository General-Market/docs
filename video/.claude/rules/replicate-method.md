# Replicate method — the rounds system

Battle-tested on Realist (78.1 → 85+) and IRSwap (~87 → 90+), 2026-07-04/05. Read this BEFORE improving any `*-Replicate` composition. The generic pipeline (analyze/split/track scripts) is in `remotion.md` §Replicating; this file is the improvement loop that runs after a first build exists.

## The loop

Rounds. Each round: one builder agent per track → measure → fix → official verify → ranked handoff. The orchestrator (main chat) only dispatches, relays owner feedback, and repairs infrastructure; builders do the work and may spawn sub-subagents (cap the TREE at ≤4 concurrent; 8-core/16GB).

- **State lives in `video/.claude/rounds/`** — `PROTOCOL.md` (hard rules), `STATE-<track>.md` (mission, owner feedback, append-only round log), verify artifacts per round (`<track>-{verify,keyframes,framessim}-r<N>.*`), tooling under `work/`. NEVER in /tmp or session scratchpads — housekeeping sweeps them.
- **Lanes.** One track = one source dir (`src/compositions/replicates/<track>/**`). Agents stage ONLY their lane's explicit paths. Never `git add -A`.
- **Commit per landing, not per round.** Session limits killed whole agent trees five times in two days; only commits survived. Resume agents via SendMessage when transcripts survive; otherwise spawn an inheritor whose first act is auditing the dirty tree hunk-by-hunk (tsc → A/B still vs HEAD → keep/finish/revert).

## The judge

`scripts/verify-replication.sh <ref.mp4> <CompId>` → SCORE 0–100 (video SSIM 40% · keyframe SSIM 35% · color 15% · duration 10%). Target set per job (0.95 here).

- Always run with the slim path: `VERIFY_ENTRY=src/index-replicas.ts VERIFY_PUBLIC_DIR=$PWD/.claude/rounds/pubdir/<track>`. Remotion byte-copies the WHOLE public/ (multi-GB) per render/still otherwise — ENOSPC killed a verify at 98% disk, and the full entry preloads other comps' GLB/FBX which 404 against a slim dir. Keep `src/index-replicas.ts` registering only the replica comps; keep slim pubdirs as APFS clones (`cp -c`, zero bytes), and re-clone any new staticFile asset into them.
- Serialize heavy renders through a lock: `while ! mkdir /tmp/replica-render.lock 2>/dev/null; do sleep 30; done` + trap rmdir.
- The judge lies until interrogated. Three bugs found by refusing to accept numbers that disagreed with frames: ImageMagick `compare -metric SSIM` emits DISTORTION (identical=0) on IM 7.x → use ffmpeg ssim; ffmpeg inside a while-read loop EATS STDIN and silently re-scores frame 0 → `-nostdin`; fixed /tmp keyframe names + full disk → stale foreign frames scored → per-run paths, fail loudly. When a score jumps or a value repeats identically across timestamps, audit the judge first.
- Rescue the attempt render to `work/r<N>/` before the cleanup trap eats it — next round triages from it for free.

## Triage — rolling windows, not keyframes

Rank by WORST ROLLING-WINDOW MEAN of per-frame SSIM (`scripts/rolling-ssim.py <framessim> --fps <N> --window-sec 2 --top 12`; the verify persists the series automatically, or one ffmpeg ssim pass over a saved render rebuilds it in seconds). A bad frame is noise; a bad 2s window is a defect. Round reports list windows before/after; next-round priorities are stated as windows.

## Measurement doctrine

- Per-frame truth beats theory. Colors: `magick <frame> -format '%[pixel:p{x,y}]'`. Geometry: crops + difference composites (`magick composite -compose difference`). Timing: plate sweeps (binary-search the frame where motion starts). Copy: read the frame image. No invented values, no invented shades.
- **A/B still-gate every change** at ≥3 frames INSIDE the target window (not just the anchor) before commit. Document negative A/Bs in-code — they are how the next agent avoids re-losing the same fight.
- **Perceptual strips gate alongside SSIM**: side-by-side ref/replica strips at the window's key frames. SSIM approved a building lying on its back (+0.002); only eyes catch grammar. The metric is a ruler, not an eye — measure with both.
- Inner loop on stills (slim path, seconds each); pay for a full verify only at round end.

## Structural lessons (each cost a round to learn)

1. **Cameras orbit.** If perspective recession flips direction over time, no translation-only camera fits it. Track gridlines/features per frame, Gauss-Newton (cx,cz,yaw) — 11px RMS fell to 0.25px. Solved three separate chapters with the same recipe.
2. **Per-frame-fitted corrections only.** Hand-drawn references redraw continuously; a fix anchored at one measured frame gains at that keyframe and dies across its window. Fit per-frame (or dense keyframes ≤10f interpolated) across the whole window — the only kind of fix that produced window-level jumps. Corollary: re-test previously "refuted" fixes with better instruments; three r5 negative verdicts reversed under per-frame measurement.
3. **Rigid world, moving camera.** Per-frame WORLD corrections make scene objects visibly drift ("the house moves") even when SSIM approves. Object transforms stay time-constant within a visible scene; express corrections through the camera. Where a hand-drawn ref is multi-view inconsistent (buildings disagree between views), use piecewise-constant world refits that change only during whips/occlusions.
4. **Misplaced ink loses to absent ink** (4 confirmations). Position first, then density/boldness. Never bold in place.
5. **One scene means the ground never empties.** Audit every region handoff ±20f against the ref: does the ref fade the floor, or does artwork persist under the camera? Kill fades the ref doesn't have; ride world slides pinned to scanned screen tracks.
6. **Baked footage is not a replica.** Plates/JPEGs are the measurement reference; the composition mounts DOM/3D only, all copy in editable data modules. Gotcha: JPEG plates carry a ~0.003 black floor — derive fade curves from the VIDEO, not the plates, or "black" frames leak.
7. **Hyper-realism: use the real component.** If the reference embeds a known engine (TradingView chart → `lightweight-charts`), adopt it and drive it deterministically (animations off, state set per frame, delayRender until painted) instead of hand-drawing an imitation.
8. **Asymptote honestly.** When a ceiling is claimed, demand a classified per-keyframe verdict: fixable / reference-self-contradiction / hand-drawn texture. Recompute after judge fixes — one inflated judge shifted the ceiling estimate by a point.

## Owner feedback

Log it verbatim into `STATE-<track>.md` under a dated OWNER FEEDBACK block (timestamps → frames at the comp's fps), relay to live builders via SendMessage, and let it supersede metric priorities. The owner's eye out-ranks the ruler.
