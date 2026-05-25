# Remotion Video Project — AI Rules

All `@remotion/*` packages are aligned at **4.0.438**. Keep them in lockstep on any
upgrade. This is a mature project with ~75 registered compositions, not a blank
template — study the existing ones before inventing a new pattern.

## How a composition is registered (read this first)

There is no chibi short pipeline, no `public/chibis/`, no single fixed format.
Every composition follows one convention:

1. The composition file exports a `*Meta` object next to its component:
   ```ts
   export const retailPnLMarketsReelMeta = {
     id: "RetailPnLMarketsReel",
     component: RetailPnLMarketsReel,
     durationInFrames: DURATION,
     fps: FPS,
     width: WIDTH,
     height: HEIGHT,
   };
   ```
2. `src/Root.tsx` imports that `Meta` and renders one `<Composition>` reading each
   field off it, grouped inside `<Folder name="...">` blocks:
   ```tsx
   <Composition
     id={anticheatEditMeta.id}
     component={anticheatEditMeta.component}
     durationInFrames={anticheatEditMeta.durationInFrames}
     fps={anticheatEditMeta.fps}
     width={anticheatEditMeta.width}
     height={anticheatEditMeta.height}
   />
   ```

To add a composition: export its `Meta`, import it in `Root.tsx`, drop the
`<Composition>` into the right `<Folder>`. To delete one: remove the
`<Composition>` and its import, then clean up any now-orphaned imports.

**Format depends on the composition — read its `Meta`.** Talking-head edits run
landscape at 30fps; data-viz reels are square (e.g. 2160×2160 @ 60fps);
side-by-side replicas are landscape. Do not assume 1080×1920/30.

## Studio & render

- Studio always runs on **port 3333**: `npx remotion studio --port 3333` →
  `http://localhost:3333/<CompositionId>`.
- Prefer opening Studio for preview. Only render to MP4 when the user explicitly
  asks — and write the final MP4 to **`~/Downloads`**, not into the repo:
  `npx remotion render src/index.ts <CompositionId> ~/Downloads/<CompositionId>.mp4`.

## Where the files live (on the computer)

The repo is at `/Users/maxguillabert/Downloads/index/video` — nested inside
`~/Downloads`, NOT a sibling at `~/Downloads/video/`. That old standalone path is
dead; legacy scripts still pointing there (e.g. `cut-short-02.sh`) are stale.

- **`~/Movies/`** — raw recordings. "The movie" / "the recording" means here. Each
  session is **three Matroska files**: `screen-YYYY-MM-DD-HH-MM.mkv`,
  `camera-<same>.mkv`, `mic-<same>.mkv`. Only the **mic** track carries audio.
  (DaVinci Resolve backups live here too.) `talking-head-edit/01_transcribe.py` and
  `06_bake.py` read from here.
- **`~/Downloads/`** — "download" means here. **Final MP4 renders are written here**
  (not to `out/` in the repo), alongside downloaded YouTube reference clips
  (`YTDown_*`), thumbnails, and eyeball copies the pipeline drops for review
  (e.g. `AntiCheat-enriched-cut.txt`).
- **`public/`** (inside the repo) — everything a composition renders against: the
  baked `final.mp4`, cutout frames, light shafts, fetched card/chart images, SFX,
  music. Reference these with `staticFile()`, never a remote URL.

## What this project actually produces

- **Talking-head edits** — VO + b-roll illustrations + karaoke captions + behind-
  subject light. Flagship: `src/compositions/anticheat-edit/` (`AntiCheatEdit`),
  driven by `AntiCheatLayout.tsx` (baked `final.mp4` via `OffthreadVideo`, graded,
  light shafts riding the whole talk).
- **Long-form story compositions** — e.g. `src/compositions/anticheat/AntiCheatFull.tsx`
  (`AntiCheatFull`): hook → rigged → solution → flag cards → end card.
- **Data-viz reels** — `src/compositions/retail-pnl/` (`RetailPnLMarketsReel`),
  `lending-curators/`, `morpho-curators/`, `finance-charts/`. Charts use
  lightweight-charts / recharts patterns; read the `data.ts` + `ChartEngine.tsx`
  in each folder.
- **Side-by-side replicas** — the `*SideBySide` family (Polymarket, Kalshi,
  Worldcoin, Virtuals, etc.) under `replicates/` / `polymarket-replicas/`.
- **OG banners, brand cards, pitch decks** — `gm/`, `pitch/`, `pitch-ten/`,
  `yc-pitch/`, `endcard/`.

## Visual style & voice (governing constraints)

- **Apple-grade visuals.** Every surface follows `docs/apple-style-table.md` (SF Pro
  Display ≥20px / SF Pro Text <20px, 17px body, `#1D1D1F` text, the sourced easing
  curves, glass = `saturate(180%) blur(20px)`). No invented numbers.
- **Reference implementations to match before inventing:**
  `src/compositions/block-trading/BlockTradingExile.tsx` and
  `src/compositions/market-anatomy/`.
- **On-screen prose** follows the Christopher Alexander voice
  (`docs/christopher-alexander-style.md`). Code, variable names, and these internal
  notes stay precise and conventional — the voice applies to rendered words only.

## Available capabilities

- **3D scenes** — `<ThreeCanvas>` (`@remotion/three`) + React Three Fiber. GLTF via
  `useGLTF` (`@react-three/drei`), `useVideoTexture()` for video-on-3D, `layout="none"`
  on `<Sequence>` inside the canvas.
- **Shader transitions** — `gl-transitions` (80+ GLSL) wrapped in `@remotion/transitions`
  custom presentations.
- **Text animation** — `remotion-animate-text` (per-char/word), `remotion-animated`
  (declarative helpers), `@remotion/noise` for wavy/organic motion.
- **Lottie** — `<Lottie>` (`@remotion/lottie`). **GIFs** — `<Gif>` (`@remotion/gif`).
- **SVG morph & shapes** — `@remotion/paths` (`evolvePath`, `interpolatePath`),
  `@remotion/shapes` (`<Triangle>`, `<Star>`, `<Pie>`, `<Circle>`).
- **Noise** — `noise2D` / `noise3D` (`@remotion/noise`).
- **Motion blur** — `<CameraMotionBlur>` (`@remotion/motion-blur`).
- **Captions** — `@remotion/captions` for word-level karaoke; see the karaoke caption
  data layer in `anticheat-edit/captions.ts` + `CaptionLayer.tsx`.
- **Transitions** — `<TransitionSeries>` (`@remotion/transitions`): `fade()`, `slide()`,
  `wipe()`, `flip()`, `clockWipe()`, or custom GL presentations.
- **Audio** — `<Audio>` with volume keyframes; `getAudioDurationInSeconds()` to fit
  duration to a track.
- **Layout** — `@remotion/layout-utils` (`measureText()`, fitting text to containers).
- **Player** — `<Player>` (`@remotion/player`) for in-browser preview.

## Talking-head edit pipeline (`scripts/talking-head-edit/`)

Ordered scripts; see `scripts/talking-head-edit/PROTOCOL.md` for the full spec.

1. `01_transcribe.py` — WhisperX (`large-v3`) transcribe + forced alignment →
   word-level JSON. The forced alignment is why this step uses WhisperX, not
   parakeet — karaoke captions need per-word play-time. **Set the language
   explicitly** (`LANG`); a wrong language silently mistranslates.
2. `02_process_voice.py` — clean/level VO, `duck_breaths` at source (pre-cut).
3. `03_curated_beats.py` — pick the kept clauses / beats.
4. `04_clean_cuts.py` → `04b_enriched_transcript.py` — assemble the cut list.
5. `05_title_cards.py` — title/lower-third cards (`REALIGN-TITLE-CARDS.md`).
6. `06_bake.py` — bake to a single `final.mp4` played by ONE `OffthreadVideo`.
7. `07_article_shots.mjs`, `08_debreath.py` — article b-roll, speech-safe debreath.

The recorder writes screen/camera/mic mkv per session; only the mic has audio.

## Behind-subject beats (titles / light behind the speaker)

To place a title, chart, or light BEHIND the talking head (room → back content →
person cutout → front content), you need a person cutout — but ONLY for the few
seconds of the beat. Never matte the whole talk: a full-length cutout is ~40GB.

- **Tool:** `python3 scripts/cutout_window.py <video> public/anticheat-edit/beats/<name> --start <sec> --duration <sec> [--room] [--model birefnet]`
  Mattes that window → `f_0001.webp …` (WebP+alpha, ~64KB/frame). `--room` also emits
  the frame-locked room plate. (birefnet hangs on MPS — prefer `human_seg`.)
- Mount frames with `<Img src={staticFile(...)}>` (frame-exact — avoids the
  `OffthreadVideo` ~1-frame "double" lag). Map local frame → `f_{idx}` (1-based,
  padStart 4). Ride `idleCamera()` so the cutout matches the base head.
- `OffthreadVideo` needs the `transparent` prop to honor alpha video; `<Img>`
  WebP/PNG sequences are transparent by default.
- Light layer: `public/anticheat-edit/light_shafts.mp4` (render via
  `scripts/render_light_shafts.py`), screen-blended. Grade + light already ride the
  whole talk inside `AntiCheatLayout`.

## Image treatment (scripts in `scripts/`)

- **Background removal — quality:** `python3 scripts/remove_bg.py` (BiRefNet-portrait)
  → PNG sequence with alpha. Slow, clean edges.
- **Background removal — fast:** `python3 scripts/remove_bg_fast.py` (u2netp via rembg)
  → PNG+alpha, ~0.09s/frame (~11 min for a full clip).
- **Person matte (whole clip):** `python3 scripts/person_matte.py` → ProRes 4444 `.mov`
  with alpha (the "titles behind the subject" matte). A full-length matte is ~40GB —
  for a few-second beat use `cutout_window.py` instead (see Behind-subject beats).
- **Color grade:** `python3 scripts/color_grade.py` — named, reusable FFmpeg filter
  chains (the color sibling of `voice_effects.py`). One preset per kind of footage.
- **Localize remote images before rendering:** `node scripts/prefetch-card-images.mjs`
  downloads every `imageUrl` in a `sources.json` into `public/scene-images/` and
  rewrites the URL to a `staticFile`-resolvable path. **Never render a composition
  against a third-party CDN URL — it fails intermittently.**
- **Source charts / stills:** `extract-source-charts.py` pulls chart images out of a
  session JSONL → `public/source-charts/`; `render-finance-stills.sh` renders one still
  per chart segment → `out/finance-stills/`; `screenshot.mjs` grabs page shots.

Transparent PNG/WebP sequences mount frame-exact via `<Img src={staticFile(...)}>`;
alpha video needs `OffthreadVideo`'s `transparent` prop.

## Audio processing (Python scripts in `scripts/`)

- **Transcribe.** Default STT is parakeet: `python3 scripts/parakeet_transcribe.py <audio>`
  (parakeet-tdt-0.6b-v3, word-level timestamps). The talking-head pipeline's
  `01_transcribe.py` is the deliberate exception — it uses WhisperX `large-v3` for
  forced word-level alignment that karaoke captions depend on. Either way, set the
  language explicitly and verify the first transcript lines before building cuts —
  a wrong language silently mistranslates.
- **Denoise** — `python3 scripts/clean_audio.py <in.wav> [out.wav]` (DeepFilterNet).
- **Voice effects** — `python3 scripts/voice_effects.py <preset> <in.wav> [out.wav]`
  (Spotify Pedalboard). Presets: clean-voice, deep-voice, radio, cinematic, warm, phone…
- **SFX** — `python3 scripts/fetch_sfx.py "<query>" [count]` (Freesound, needs
  `FREESOUND_API_KEY`); `python3 scripts/generate_music.py sfx "<desc>" -d <sec>` (AudioGen).
- **Music analysis** — `python3 scripts/analyze_music.py <track.mp3>` → JSON with BPM,
  beats, segments, energy, peaks, sync points, plus Essentia mood/key/visual
  suggestions. Read it to drive cuts and palette; no human listening needed.
- **Stems** — `python3 scripts/separate_stems.py <track.mp3>` (Demucs).
- **Mix (FFmpeg)** — voice + ducked music:
  `ffmpeg -i voice.wav -i music.wav -filter_complex "[1:a]volume=0.3[bg];[0:a][bg]amix=inputs=2:duration=first" mixed.wav`

## Key rules

- Assets go in `public/`, referenced with `staticFile()`. SFX in `public/sfx/`,
  music in `public/`.
- Animate with `useCurrentFrame()` + `interpolate()`; physics easing with `spring()`.
- A composition is its `*Meta` export + a `<Composition>` in `Root.tsx`. One source.
- `TOOLS.md` is the full command/effect reference. (`PRODUCTION.md` describes the
  retired chibi short pipeline — historical only, do not follow it.)
- Commit changes as you go — this project is version-controlled and work is easy to lose.
