# Remotion Video Project — AI Rules

This project has ALL Remotion effect packages installed at v4.0.421.

## Available Capabilities

### 3D Scenes
Use `<ThreeCanvas>` from `@remotion/three` with React Three Fiber.
Load GLTF models via `useGLTF` from `@react-three/drei`.
Use `useVideoTexture()` for video-on-3D surfaces.
Pass `layout="none"` to `<Sequence>` inside `<ThreeCanvas>`.

### Shader Transitions
Import from `gl-transitions` (80+ GLSL transitions).
Wrap in `@remotion/transitions` custom presentations.

### Text Animation
Use `remotion-animate-text` for per-character/word CSS animation.
Combine with `@remotion/noise` for wavy/TikTok-style effects.
Use `remotion-animated` for declarative animation helpers.

### Lottie (After Effects)
Use `<Lottie>` from `@remotion/lottie` with JSON files from LottieFiles.

### GIFs
Use `<Gif>` from `@remotion/gif` to embed animated GIFs.

### SVG Morph & Shapes
Use `@remotion/paths` (`evolvePath`, `interpolatePath`) for SVG morphing.
Use `@remotion/shapes` (`<Triangle>`, `<Star>`, `<Pie>`, `<Circle>`).

### Noise / Organic Motion
Use `noise2D` / `noise3D` from `@remotion/noise` for Perlin noise.

### Motion Blur
Wrap fast-moving elements in `<CameraMotionBlur>` from `@remotion/motion-blur`.

### Captions / Subtitles
Transcribe audio with `@remotion/install-whisper-cpp`.
Render word-level captions with `@remotion/captions`.

### Transitions
Use `<TransitionSeries>` from `@remotion/transitions` with built-in presentations:
`fade()`, `slide()`, `wipe()`, `flip()`, `clockWipe()`, or custom GL shader presentations.

### Audio
Use `<Audio>` component for audio playback with volume keyframes.
Use `getAudioDurationInSeconds()` to match composition length to audio.

### Layout
Use `@remotion/layout-utils` for `measureText()` and fitting text to containers.

### Player (Browser Embed)
Use `<Player>` from `@remotion/player` for in-browser preview without Studio.

## Standard Workflow

1. User provides audio file -> transcribe with Whisper -> get word timestamps
2. Build scenes as React components, each timed to transcript segments
3. Add transitions between scenes using `<TransitionSeries>`
4. Layer effects (noise, 3D, text animation) per scene
5. Preview with `npm run dev` (opens Remotion Studio)
6. Render with `npx remotion render src/index.ts <CompositionId> out/video.mp4`

## Audio Processing (Python Scripts in `scripts/`)

### Denoise
- `python3 scripts/clean_audio.py <input.wav> [output.wav]` — AI noise removal via DeepFilterNet

### Voice Effects
- `python3 scripts/voice_effects.py <preset> <input.wav> [output.wav]`
- Presets: clean-voice, deep-voice, chipmunk, radio, cinematic, echo, robot, warm, phone, underwater
- Uses Spotify Pedalboard: Reverb, PitchShift, Compressor, Distortion, Delay, Chorus, EQ, Limiter, etc.

### Sound Effects
- `python3 scripts/fetch_sfx.py "<query>" [count]` — search & download from Freesound.org (needs FREESOUND_API_KEY)
- `python3 scripts/generate_music.py sfx "<description>" -d <seconds>` — AI-generate SFX via Meta AudioGen
- FFmpeg can generate sine waves, noise, beeps for basic SFX

### Music Analysis (No Human Listening Needed)
- `python3 scripts/analyze_music.py <track.mp3>` — outputs JSON with BPM, beats, segments, energy, peaks, sync points
- Read the JSON to know exactly when to cut scenes, where energy peaks are, what sections exist
- `python3 scripts/separate_stems.py <track.mp3>` — splits into vocals/drums/bass/other via Demucs
- Use stems selectively: drums for action, melody for calm, no vocals for instrumental

### Music Sources (Open/CC)
- Freesound.org (API installed), Pixabay Music, Incompetech, Free Music Archive, ccMixter, Filmmusic.io

### Essentia (Mood, Danceability, Key+Scale)
- Installed under brew's python@3.9 — runs automatically via `analyze_music.py`
- Adds to analysis JSON: `essentia.mood_tags`, `essentia.danceability_normalized`, `essentia.visual_suggestions`
- Mood tags: energetic, groovy, melancholic, dark, happy, warm, dramatic, steady, bass-heavy, bright, muted, slow, moderate, upbeat, fast
- Visual suggestions: pace, colors, motion style, effects — use these to drive visual design decisions
- Key+scale (e.g. "A minor") is more accurate than librosa's key estimation

### Music-Driven Video Workflow
1. Analyze track → get analysis.json with sync_points, beats, segments, energy, mood, danceability
2. Read `ai_summary.mood_tags` and `ai_summary.visual_suggestions` for overall visual direction
3. Build scenes: count = sync_points, transitions aligned to beat_timestamps
4. High-energy visuals at energy_peaks, calm visuals during low-energy segments
5. Use mood tags to pick color palettes, motion styles, and effects
6. Separate stems if needed (drums only for action, etc.)

### Music Generation (Optional)
- `python3 scripts/generate_music.py music "<description>" -d <seconds>` — AI music via Meta MusicGen
- Models: facebook/musicgen-small (fast), facebook/musicgen-medium, facebook/musicgen-large (best)

### Audio Cutting
- Whisper VAD auto-detects speech segments with word-level timestamps
- FFmpeg: `ffmpeg -i in.wav -ss <start> -to <end> -c copy segment.wav`
- SoX: `sox in.wav out.wav silence 1 0.1 1% reverse silence 1 0.1 1% reverse` (trim silence)

### Audio Mixing (FFmpeg)
- Mix voice + music: `ffmpeg -i voice.wav -i music.wav -filter_complex "[1:a]volume=0.3[bg];[0:a][bg]amix=inputs=2:duration=first" mixed.wav`
- Crossfade: `ffmpeg -i a.wav -i b.wav -filter_complex "acrossfade=d=3" out.wav`

## Short Production Pipeline

See `PRODUCTION.md` for the full 22-step pipeline. Summary:

**Format:** 1080x1920 (9:16), 30fps, H.264, under 60s

**Layers (bottom to top):**
1. Background — animated gradient, shifts with mood
2. Music — CC track, ducked under voice (0.12-0.18), up in gaps (0.35)
3. Chibi character — emotion-matched to transcript segments, spring animations
4. Captions — word-synced bold text, pop-in animation (THE key retention driver)
5. SFX — whoosh on transitions, pop on reveals, impact on punchlines
6. Effects — particles, emojis, emphasis lines, screen shake
7. Voice — clean, on top, full volume

**Chibi library** is in `public/chibis/`, labeled by emotion (confused, panicking, hyped, frustrated).

**Critical for virality:**
- First 0.5s must hook — bold text + voice starts immediately
- Word-synced captions are the #1 retention factor
- Nothing static — every element has micro-motion
- Scene changes every 2-4s max
- SFX accent every transition and punchline
- Audio: voice clear > music subtle > sfx punchy

## Post-Render
- Prefer opening Remotion Studio (`npm run dev`) for preview instead of rendering to MP4 directly.
- Only render to MP4 when the user explicitly asks for a final render.

## Key Rules
- All `@remotion/*` packages are pinned to 4.0.421 — keep aligned on upgrades
- Use `staticFile()` for assets in the `public/` folder
- Use `useCurrentFrame()` and `interpolate()` for all animations
- Use `spring()` for physics-based easing
- Compositions go in `src/` and are registered in `src/Root.tsx`
- SFX files go in `public/sfx/`, music in `public/`
- See `TOOLS.md` for full command reference and all available effects
