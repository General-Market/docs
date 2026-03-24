# Video Production Toolkit

Full AI-driven video production setup powered by Remotion + Claude Code. Create videos from audio, sync visuals to music beats, apply voice effects, generate SFX, and render — all from the command line.

## Quick Start

```bash
npm run dev          # Preview in Remotion Studio (browser)
npx remotion render src/index.ts MyComposition out/video.mp4
```

## What's Installed

### Video Engine (Remotion v4.0.421)
All packages pinned to same version.

| Package | What |
|---------|------|
| `@remotion/three` + `three` + `@react-three/fiber` + `@react-three/drei` | 3D scenes, GLTF models, particles, WebGL |
| `@remotion/transitions` + `gl-transitions` | Scene transitions (fade, slide, wipe, flip, 80+ GLSL shaders) |
| `@remotion/lottie` + `lottie-web` | After Effects animations |
| `@remotion/gif` | Animated GIFs |
| `@remotion/shapes` + `@remotion/paths` | SVG shapes, path morphing, draw-on effects |
| `@remotion/noise` | Perlin noise for organic motion, wavy text |
| `@remotion/motion-blur` | Realistic motion blur |
| `@remotion/animation-utils` + `@remotion/layout-utils` | Transform helpers, text measurement |
| `@remotion/install-whisper-cpp` + `@remotion/captions` | Audio transcription + word-level subtitles |
| `@remotion/player` | Embeddable browser player |
| `remotion-animate-text` + `remotion-animated` | Per-char/word text animation |
| `fluent-ffmpeg` + `sox-audio` | Node.js wrappers for FFmpeg and SoX |

### Audio Processing (Python)

| Tool | What |
|------|------|
| **DeepFilterNet** | AI noise removal — best quality denoiser |
| **Pedalboard** (Spotify) | 20+ studio effects: reverb, pitch shift, compressor, delay, chorus, distortion, EQ, limiter |
| **librosa** | Music analysis: BPM, beats, energy, segments, spectral features |
| **Demucs** (Meta) | Stem separation: split any track into vocals/drums/bass/other |
| **AudioCraft MusicGen** | AI music generation from text prompts |
| **AudioCraft AudioGen** | AI sound effect generation from text prompts |
| **Essentia** | Danceability, key+scale, mood tags, energy bands, visual suggestions (brew python@3.9) |
| **Freesound API** | Search & download free CC sound effects |

### System

| Tool | What |
|------|------|
| **FFmpeg** | Audio/video processing, format conversion, 100+ filters |
| **SoX** | Audio CLI: pitch, tempo, reverb, chorus, noise reduction |

## Scripts

All in `scripts/`. Run with `python3 scripts/<name>.py`.

### Music Analysis (AI understands music without you listening)
```bash
# Analyze a track → JSON with BPM, beats, energy, segments, sync points
# Also includes Essentia mood/danceability/key if available
python3 scripts/analyze_music.py track.mp3

# Split into stems (vocals, drums, bass, other)
python3 scripts/separate_stems.py track.mp3 public/stems/
```

The analysis JSON includes: BPM, key, beats, onsets, energy curve, peaks, segments (intro/verse/chorus/bridge/outro), spectral profile, sync points, and (with Essentia) mood tags, danceability score, visual suggestions for AI.

### Audio Cleaning
```bash
# AI noise removal
python3 scripts/clean_audio.py recording.wav cleaned.wav
```

### Voice Effects
```bash
# Apply preset: clean-voice, deep-voice, chipmunk, radio, cinematic,
#               echo, robot, warm, phone, underwater
python3 scripts/voice_effects.py cinematic recording.wav output.wav
```

### Sound Effects
```bash
# Search & download from Freesound.org (needs FREESOUND_API_KEY)
export FREESOUND_API_KEY=your_key
python3 scripts/fetch_sfx.py "whoosh" 3

# AI-generate sound effects from text
python3 scripts/generate_music.py sfx "thunderstorm rain" -d 5

# AI-generate music from text (optional)
python3 scripts/generate_music.py music "lo-fi hip hop beat" -d 30
```

## Music-Driven Video Workflow

The main workflow for creating a video synced to music, without manually listening:

```
1. Pick a CC track (Freesound, Pixabay Music, Incompetech, Free Music Archive)
2. python3 scripts/analyze_music.py track.mp3 → track_analysis.json
3. Claude Code reads analysis JSON → knows BPM, segments, peaks, sync points, mood, danceability
4. Uses mood_tags + visual_suggestions to pick color palette, motion style, effects
5. Builds Remotion composition:
   - Scene count matches sync_points
   - Transitions aligned to beat_timestamps
   - High-energy visuals at energy_peaks
   - Calm visuals during low-energy segments
5. Optional: python3 scripts/separate_stems.py → use drums for action, melody for calm
6. npm run dev → preview
7. npx remotion render → export MP4
```

## Project Structure

```
video/
├── src/                   # Remotion compositions (React/TypeScript)
│   ├── index.ts           # Entry point
│   └── Root.tsx           # Composition declarations
├── public/                # Static assets (audio, images, fonts, GIFs)
│   └── sfx/               # Sound effects
├── scripts/               # Python helper scripts
│   ├── analyze_music.py   # Music analysis → JSON (librosa + Essentia)
│   ├── essentia_analysis.py # Essentia mood/danceability helper (brew python@3.9)
│   ├── separate_stems.py  # Demucs stem separation
│   ├── clean_audio.py     # DeepFilterNet noise removal
│   ├── voice_effects.py   # Pedalboard voice presets
│   ├── generate_music.py  # MusicGen/AudioGen
│   └── fetch_sfx.py       # Freesound.org search & download
├── out/                   # Rendered output
├── .claude/rules/         # AI rules for Claude Code
├── .agents/skills/        # Remotion skills (39 rules)
├── TOOLS.md               # Detailed reference for every tool, effect, and command
└── README.md              # This file
```

## API Keys

| Service | For | Get Key |
|---------|-----|---------|
| Freesound.org | Downloading sound effects | https://freesound.org/apiv2/apply/ |
| ElevenLabs (optional) | AI voiceover generation | https://elevenlabs.io/ |

## Open Music Sources

| Source | URL |
|--------|-----|
| Freesound.org | https://freesound.org |
| Pixabay Music | https://pixabay.com/music |
| Incompetech | https://incompetech.com/music |
| Free Music Archive | https://freemusicarchive.org |
| Filmmusic.io | https://filmmusic.io |
| ccMixter | https://ccmixter.org |

## Full Reference

See **[TOOLS.md](./TOOLS.md)** for complete documentation: every package, import, usage example, FFmpeg command, SoX command, Pedalboard effect, and more.

---

## Unused on Short 01

Components and scenes available in the project that Short 01 did **not** use.

### What Short 01 DID use

| Category | Components |
|----------|------------|
| Overlays | `Vignette`, `FilmGrain`, `ProgressBar` |
| Effects | `ScreenShake`, `FlashImpact` |
| Audio | `SFXTrigger` |
| Utils | `secondsToFrame`, `msToFrame` |
| Types | `Caption` |

Short 01 also used: `@remotion/noise` (`noise2D`), `@remotion/google-fonts`.

Everything below was **not imported** by any short-01 file.

### Unused Remotion Packages

| Category | Packages |
|----------|----------|
| 3D / WebGL | `@remotion/three`, `three`, `@react-three/fiber`, `@react-three/drei` |
| Transitions | `@remotion/transitions`, `gl-transitions` |
| Lottie | `@remotion/lottie`, `lottie-web` |
| GIFs | `@remotion/gif` |
| Shapes / Paths | `@remotion/shapes`, `@remotion/paths` |
| Motion Blur | `@remotion/motion-blur` |
| Animation Utils | `@remotion/animation-utils`, `@remotion/layout-utils` |
| Captions / Transcription | `@remotion/install-whisper-cpp`, `@remotion/captions` |
| Player | `@remotion/player` |
| Text Animation | `remotion-animate-text`, `remotion-animated` |
| Node CLI Wrappers | `fluent-ffmpeg`, `sox-audio` |

### Unused Lib Components

**Audio** — `MusicLayer`, `VoiceLayer`, `volumeUtils`

**Background** — `AmbientShimmer`, `AnimatedGradient`, `ParticleField`, `presets`

**Captions** — `CaptionRenderer`, `PhraseGroup`, `WordPopIn`, `captionStyles`

**CharacterDisplay** — `BubbleEntrance`, `CharacterDisplay`, `CharacterPresets`, `SpeechBubble`, `ThoughtBubble`

**Chibi (lib)** — `ChibiBeatPulse`, `ChibiController`, `ChibiEntrance`, `ChibiExit`, `ChibiIdle`, `ChibiShadow`, `ChibiTalking`

**Effects** — `EmojiRain`, `SpeedLines`, `ZoomPulse`

**Overlays** — `ColorGrade`, `Watermark`

**Transitions (lib)** — `FlashCut`, `WhooshSlide`, `ZoomTransition`

**Hooks** — `useBeatSync`, `useCaptions`, `useEnergyAtFrame`, `useMusicAnalysis`, `useSegments`

**Templates** — `ChibiExplainer`, `compileEffectEvents`

**Utils** — `colorPalettes`, `easing`, `random`

### Unused Scenes (none used — all available)

Short 01 imports **zero** scene components.

| Category | Count | Components |
|----------|-------|------------|
| BackgroundAnimations | 10 | Aurora, Bokeh, FlowingGradient, Geometric, Grid, MeshGradient, NoiseTexture, PerspectiveGrid, Radial, Waves |
| CinematicAnimations | 10 | Action, Anime, Documentary, Epic, Horror, MinimalEnd, Noir, Romance, SciFi, Vintage |
| DataAnimations | 8 | BarChart, Gauge, LineChart, PieChart, ProgressBars, Ranking, StatsCards, Timeline |
| DemoAnimations | 12 | AddressBar, CursorClick, DragDrop, MenuExpand, Modal, PageTransition, Scroll, SearchFilter, TextInput, Tooltip, Wizard, ZoomFocus |
| EffectAnimations | 10 | ChromaticAberration, DepthOfField, Duotone, FilmGrain, Glow, Kaleidoscope, LightLeak, Matrix, Noise, VHS |
| LayoutAnimations | 12 | Asymmetric, Diagonal, FrameInFrame, FullscreenType, GiantNumber, GridBreak, Layered, MultiColumn, OffGrid, SplitContrast, VerticalMix, Whitespace |
| LiquidAnimations | 10 | Blob, CalligraphyInk, FluidWave, InkSplash, MorphBlob, OilSpill, PaintDrip, Splatter, Swirl, WaterDrop |
| ListAnimations | 12 | Asymmetric3, FullscreenSequence, HeroWithList, HorizontalPeek, MinimalLeft, NumberedVertical, SimpleText, Staggered, StatsFocused, Timeline, TwoColumnCompare, UnevenGrid |
| LogoAnimations | 10 | 3DRotate, Glitch, LightTrail, MaskReveal, Morph, NeonSign, Particles, SplitScreen, Stamp, Stroke |
| ParticleAnimations | 10 | Bubbles, Confetti, Fireworks, Lightning, MagneticField, Sakura, ShootingStars, Smoke, Snow, Sparks |
| RollerAnimations | 22 | 3DCarousel, Blur, Countdown, DramaticStop, Drum, FadeSlide, Flip, Glitch, GradientWave, Liquid, MaskSlide, MultiSlot, OutlineHighlight, PerspectiveStripes, ScaleBounce, Shuffle, SlotMachine, SlotReveal, SplitFlap, Typewriter, VerticalList, Wave |
| ShapeAnimations | 10 | 3DCube, CircularProgress, Explosion, Helix, HexGrid, Mandala, Morphing, ParticleField, Ripples, SpinningRings |
| TextAnimations | 12 | 3DFlip, Counter, Explode, Glitch, Gradient, Kinetic, MaskReveal, Neon, Scramble, Split, Typewriter, Wave |
| ThemeAnimations | 33 | 3DGlass, 3DGlassThreeJS, ArtDeco, Bauhaus, Boho, BrutalistWeb, Cosmic, Cyberpunk, DarkMode, Duotone, GeometricAbstract, Glassmorphism, Gradient, Holographic, Industrial, Isometric, Japanese, Luxury, Memphis, Minimalist, Monochrome, Natural, Neobrutalism, Neon, Neumorphism, Organic, PaperCut, Pop, Retro, Swiss, Tech, Watercolor, Y2K |
| TransitionAnimations | 10 | Blinds, BoxReveal, CircleWipe, DiagonalSlice, Flash, Glitch, LineSweep, LiquidMorph, Shutter, ZoomBlur |
| UIAnimations | 10 | Button, Card, Dropdown, Form, Loading, Modal, Navigation, Tabs, Toast, Toggle |
