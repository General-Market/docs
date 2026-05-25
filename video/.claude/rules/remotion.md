# Remotion Video Project — AI Rules

`@remotion/*` all at **4.0.438** (keep in lockstep). ~75 compositions already exist — study them before inventing patterns. Each composition sets its own format.

## Registering a composition

Each file exports a `*Meta` next to its component; `src/Root.tsx` renders one `<Composition>` reading its fields, grouped in `<Folder>` blocks.

```ts
export const fooMeta = { id: "Foo", component: Foo, durationInFrames: DURATION, fps: FPS, width: WIDTH, height: HEIGHT };
```

- **Add:** export `Meta` → import in `Root.tsx` → render a `<Composition>`. **Delete:** remove both, clean orphaned imports.
- **Where to register:** a finished video goes at the **root** of `Root.tsx` (top of the Studio sidebar); its scenes, variants, and WIP go inside a `<Folder>`. Root today: `AntiCheatFull`, `AntiCheatEdit`, `BlockTradingExile`, `WebGLPicks`, `AntiCheatEditThumbnail`.
- **Format lives in the `Meta` — read it.** Talking-head = landscape 30fps; reels = square (e.g. 2160² @60); replicas = landscape. Never assume 1080×1920/30.

## Studio & render

- Studio always on **port 3333**: `npx remotion studio --port 3333` → `http://localhost:3333/<Id>`.
- Prefer Studio for preview. Render only when asked, MP4 to **`~/Downloads`** (not the repo): `npx remotion render src/index.ts <Id> ~/Downloads/<Id>.mp4`.

## Where files live

Repo is `~/Downloads/index/video` (not `~/Downloads/video/`).

- **`~/Movies/`** — recordings ("the movie"). Per session: `screen-/camera-/mic-YYYY-MM-DD-HH-MM.mkv`; **only mic has audio**. `01_transcribe.py`/`06_bake.py` read here.
- **`~/Downloads/`** — final renders, YouTube reference clips (`YTDown_*`), thumbnails, review copies.
- **`public/`** — what compositions render against (baked `final.mp4`, cutouts, light, fetched images, SFX, music). Always `staticFile()`, never a remote URL.

## What this project produces

- **Talking-head edits** — `anticheat-edit/` (`AntiCheatEdit`), via `AntiCheatLayout.tsx`: baked `final.mp4` (`OffthreadVideo`) + graded + light shafts + karaoke captions.
- **Long-form stories** — `anticheat/AntiCheatFull.tsx`: hook → rigged → solution → flag cards → end card.
- **Data-viz reels** — `retail-pnl/`, `lending-curators/`, `morpho-curators/`, `finance-charts/`. Read each folder's `data.ts` + `ChartEngine.tsx` (lightweight-charts / recharts).
- **DeFi category leaderboards** (ranked bar/column reels of protocols by growth, e.g. perps/RWA/privacy "winners"): there's a turnkey engine — numbers + logos in, reel out. **Only if building one of these, read `src/compositions/defi-flows/README.md`** (data-source choice, the %/$/volume call, the logo fetch command, the one-object registry). Don't load it otherwise.
- **Side-by-side replicas** — the `*SideBySide` family under `replicates/`, `polymarket-replicas/` (see Replicating below).
- **OG banners / brand** — `gm/`, `endcard/`.

## Replicating a reference video

Rebuild a reference motion-design video scene-by-scene, then score the replica against it. Convention: `<name>Replicate` (the rebuild) + `<name>SideBySide` (reference vs replica) + a `<name>-Scenes` folder, all under the `Replicate` folder.

1. **Analyze** — `./scripts/analyze-reference.sh <ref.mp4> <dir>` → `analysis.json` (scenes, colors, timing, motion).
2. **Split** — `./scripts/split-scenes.sh <dir>` → per-scene clips + Remotion scaffolds.
3. **Read the motion** — `storyboard.py` (every micro-shift: position/opacity/scale) + `scene-interpret.py` (intent/emotion/technique per scene).
4. **Track** — `track-v3.py` (EasyOCR + RAFT + HSV) or `track-cotracker.py` (CoTracker3, for solid backgrounds) → `track-to-gsap.py` (GSAP MotionPath / timeline / SplitText).
5. **Build** scenes in Remotion, then **verify** — `./scripts/verify-replication.sh <ref.mp4> <Id>` → `SCORE`; `verify-scene-v2.sh` adds SSIM + color + on-screen-text checks.

Go deep — per-element detection, real motion trajectories, typography, SFX. A CSS approximation of a 3D move is not a replica.

## Style (governing)

- Apple-grade visuals per `docs/apple-style-table.md` (SF Pro, 17px body, `#1D1D1F`, sourced easing, glass `saturate(180%) blur(20px)`). No invented numbers.
- Match the reference comps first: `block-trading/BlockTradingExile.tsx`, `market-anatomy/`.
- Rendered prose follows the Alexander voice (`docs/christopher-alexander-style.md`); code stays conventional.

## Capabilities (all installed)

- **3D** — `<ThreeCanvas>` (`@remotion/three`) + R3F, `useGLTF` (`@react-three/drei`), `useVideoTexture()`; `layout="none"` on inner `<Sequence>`.
- **Shaders** — `gl-transitions` in `@remotion/transitions` custom presentations.
- **Text** — `remotion-animate-text`, `remotion-animated`, `@remotion/noise`.
- **Lottie** `<Lottie>` · **GIF** `<Gif>` · **SVG** `@remotion/paths` (`evolvePath`/`interpolatePath`), `@remotion/shapes`.
- **Motion blur** `<CameraMotionBlur>` · **Noise** `noise2D/3D`.
- **Organic motion** — `backgrounds/webgl-picks/OrganicMotion.tsx` holds 15 pulse equations (Windle's sketch.js), each `fn(t)→[-1,1]` to drive size/opacity/position with `t=(frame/fps)*1.5`. E.g. `sin(t)`, `cos(t)*sin(t)`, `sin(tan(cos(t)*1.2))`, `sin(pow(8,sin(t)))`, `pow(sin(t*PI),12)`, `cos(sin(t*3)+t*3)`.
- **Captions** `@remotion/captions` — karaoke layer in `anticheat-edit/captions.ts` + `CaptionLayer.tsx`.
- **Transitions** `<TransitionSeries>`: `fade/slide/wipe/flip/clockWipe` or custom GL.
- **Audio** `<Audio>` + `getAudioDurationInSeconds()` · **Layout** `@remotion/layout-utils` (`measureText`) · **Player** `<Player>`.

## Talking-head pipeline (`scripts/talking-head-edit/`, see `PROTOCOL.md`)

1. `01_transcribe.py` — WhisperX `large-v3` + forced alignment → word-level JSON (alignment is why it's WhisperX, not parakeet). **Set `LANG`** — wrong language silently mistranslates.
2. `02_process_voice.py` — clean/level VO, `duck_breaths` at source.
3. `03_curated_beats.py` — pick kept clauses.
4. `04_clean_cuts.py` → `04b_enriched_transcript.py` — cut list.
5. `05_title_cards.py` — title cards (`REALIGN-TITLE-CARDS.md`).
6. `06_bake.py` — bake to ONE `final.mp4` (one `OffthreadVideo`).
7. `07_article_shots.mjs`, `08_debreath.py` — article b-roll, speech-safe debreath.

## Behind-subject beats (title/light behind the head)

Cutout only the few seconds of the beat — a full-talk matte is ~40GB.

- `python3 scripts/cutout_window.py <video> public/anticheat-edit/beats/<name> --start <s> --duration <s> [--room] [--model human_seg]` → `f_0001.webp …` (alpha, ~64KB/frame); `--room` adds the frame-locked plate. (birefnet hangs on MPS — use `human_seg`.)
- Mount with `<Img src={staticFile(...)}>` (frame-exact; avoids `OffthreadVideo` 1-frame lag). Local frame → `f_{idx}` (1-based, pad4). Ride `idleCamera()`.
- Alpha video needs `OffthreadVideo` `transparent`; `<Img>` WebP/PNG sequences already are.
- Light: `public/anticheat-edit/light_shafts.mp4` (`scripts/render_light_shafts.py`), screen-blended. Grade + light already ride the whole talk in `AntiCheatLayout`.

## Image scripts (`scripts/`)

- **BG removal:** `remove_bg.py` (BiRefNet, slow/clean) or `remove_bg_fast.py` (rembg u2netp, ~0.09s/frame) → PNG+alpha.
- **Person matte (whole clip):** `person_matte.py` → ProRes 4444 alpha. ~40GB full — for short beats use `cutout_window.py`.
- **Grade:** `color_grade.py` — named FFmpeg chains (color sibling of `voice_effects.py`).
- **Localize images before render:** `prefetch-card-images.mjs` pulls every `imageUrl` from `sources.json` → `public/scene-images/`, rewrites to `staticFile`. **Never render against a CDN URL.**
- **Charts/stills:** `extract-source-charts.py` → `public/source-charts/`; `render-finance-stills.sh` → `out/finance-stills/`; `screenshot.mjs`.
- **B-roll from a reference video** (vague timestamps → clean cut-to-cut clips, frame-verified): `scripts/broll-cut/` — `prep.py` detects cuts + renders labelled montages, `extract.py` cuts frame-accurate + edge-verifies. Full protocol in `scripts/broll-cut/README.md` (read it only when cutting b-roll). Clips land in `public/broll/<source-slug>/`, documented in `public/broll/INDEX.md`.

## Audio scripts (`scripts/`)

- **Transcribe:** default `parakeet_transcribe.py` (parakeet-tdt-0.6b-v3). Pipeline `01_transcribe.py` uses WhisperX for alignment (above). Always set language + verify first lines.
- **Denoise** `clean_audio.py` (DeepFilterNet) · **Voice fx** `voice_effects.py <preset>` (Pedalboard).
- **SFX** `fetch_sfx.py "<q>"` (Freesound, `FREESOUND_API_KEY`) / `generate_music.py sfx "<d>" -d <s>` (AudioGen).
- **Music** `analyze_music.py <mp3>` → JSON (BPM/beats/energy/sync + Essentia mood/key); drive cuts from it. **Stems** `separate_stems.py` (Demucs).
- **Mix:** `ffmpeg -i voice.wav -i music.wav -filter_complex "[1:a]volume=0.3[bg];[0:a][bg]amix=inputs=2:duration=first" out.wav`

## Key rules

- Assets in `public/` (SFX `public/sfx/`), via `staticFile()`. Animate with `useCurrentFrame()`+`interpolate()`, easing `spring()`.
- A composition = its `*Meta` + a `<Composition>` in `Root.tsx`. One source.
- `TOOLS.md` = full command reference.
- Commit as you go.
