# Remotion Video Toolkit — All Installed Tools

## Core

| Package | Import | What It Does |
|---------|--------|-------------|
| `remotion` | `useCurrentFrame`, `useVideoConfig`, `interpolate`, `spring`, `Sequence`, `Audio`, `Img`, `staticFile`, `AbsoluteFill` | Core framework — frame timing, interpolation, composition structure |
| `@remotion/cli` | CLI: `npx remotion` | `remotion studio` (preview), `remotion render` (export MP4/WebM), `remotion bundle` |
| `@remotion/player` | `<Player>` | Embeddable browser player — no Studio needed, React component |

---

## 3D — Three.js / WebGL / GLTF

| Package | Import | What It Does |
|---------|--------|-------------|
| `@remotion/three` | `<ThreeCanvas>` | Remotion-aware Three.js canvas, syncs frame timing with 3D render loop |
| `@react-three/fiber` | `<Canvas>`, `useFrame`, `useThree` | React renderer for Three.js — declarative 3D scenes |
| `@react-three/drei` | `useGLTF`, `OrbitControls`, `Text3D`, `Environment`, `Stars`, `Float` | 100+ ready-made Three.js helpers — model loading, lighting, text, particles |
| `three` | `THREE.Vector3`, `THREE.MeshStandardMaterial`, etc. | Three.js core — geometry, materials, lights, math |

### Usage
```tsx
import { ThreeCanvas } from "@remotion/three";
import { useGLTF, Environment } from "@react-three/drei";

// Inside composition:
<ThreeCanvas>
  <ambientLight />
  <Environment preset="sunset" />
  <MyModel />
</ThreeCanvas>
```

### Can Do
- Full 3D scenes with lighting, shadows, reflections
- Load GLTF/GLB models (Blender exports, Sketchfab downloads)
- Particle systems (`@react-three/drei` Stars, Sparkles)
- Video as 3D texture (`useVideoTexture`)
- Camera animation (dolly, orbit, zoom)
- Post-processing (bloom, depth of field via `@react-three/postprocessing`)

---

## Transitions

| Package | Import | What It Does |
|---------|--------|-------------|
| `@remotion/transitions` | `<TransitionSeries>`, `fade()`, `slide()`, `wipe()`, `flip()`, `clockWipe()` | Scene transitions with overlap timing |
| `gl-transitions` | 80+ GLSL shader transitions | GPU-accelerated transitions (burn, pixelize, swirl, morph, etc.) |

### Built-in Presentations
- `fade()` — crossfade
- `slide()` — slide in from direction
- `wipe()` — wipe reveal
- `flip()` — 3D flip
- `clockWipe()` — radial clock wipe
- Custom — write your own or use GL Transitions

### Usage
```tsx
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";

<TransitionSeries>
  <TransitionSeries.Sequence durationInFrames={90}>
    <SceneA />
  </TransitionSeries.Sequence>
  <TransitionSeries.Transition
    presentation={fade()}
    timing={linearTiming({ durationInFrames: 30 })}
  />
  <TransitionSeries.Sequence durationInFrames={90}>
    <SceneB />
  </TransitionSeries.Sequence>
</TransitionSeries>
```

---

## Text Animation

| Package | Import | What It Does |
|---------|--------|-------------|
| `remotion-animate-text` | `<AnimateText>` | Per-character or per-word CSS animation (fade, slide, scale, rotate) |
| `remotion-animated` | `<Animated>`, `Move`, `Scale`, `Fade` | Declarative animation primitives — compose multiple effects |

### Wavy TikTok Text (combine with noise)
```tsx
import { noise2D } from "@remotion/noise";
// Apply noise-based offset to each character's Y position per frame
```

### Text Morphing
```tsx
import { interpolatePath } from "@remotion/paths";
// Convert text to SVG paths, interpolate between two path strings
```

---

## SVG & Shapes

| Package | Import | What It Does |
|---------|--------|-------------|
| `@remotion/shapes` | `<Triangle>`, `<Star>`, `<Pie>`, `<Circle>`, `<Rect>`, `<Ellipse>` | Pure SVG shapes — easy to animate, zero dependencies |
| `@remotion/paths` | `evolvePath()`, `interpolatePath()`, `getLength()`, `getPointAtLength()` | SVG path manipulation — draw-on effects, morphing between shapes |

### Draw-on Effect
```tsx
const progress = interpolate(frame, [0, 60], [0, 1]);
const evolved = evolvePath(progress, myPath);
// SVG path draws itself over 60 frames
```

---

## Noise & Organic Motion

| Package | Import | What It Does |
|---------|--------|-------------|
| `@remotion/noise` | `noise2D()`, `noise3D()`, `noise4D()` | Perlin/simplex noise for natural, organic randomness |

### Use Cases
- Wavy text (offset each char Y by `noise2D(charIndex, frame)`)
- Floating/drifting elements
- Particle jitter
- Procedural backgrounds (noise-driven gradients)

---

## Motion Blur

| Package | Import | What It Does |
|---------|--------|-------------|
| `@remotion/motion-blur` | `<CameraMotionBlur>`, `<Trail>` | Adds realistic motion blur to fast-moving elements |

```tsx
<CameraMotionBlur samples={10} shutterAngle={180}>
  <FastMovingScene />
</CameraMotionBlur>
```

---

## Lottie (After Effects Animations)

| Package | Import | What It Does |
|---------|--------|-------------|
| `@remotion/lottie` | `<Lottie>` | Renders Lottie JSON animations synced to Remotion timeline |
| `lottie-web` | (peer dep) | Lottie rendering engine |

### Where to Get Animations
- [LottieFiles.com](https://lottiefiles.com) — thousands of free animations
- Export from After Effects with Bodymovin plugin

```tsx
import { Lottie } from "@remotion/lottie";
import animationData from "./my-animation.json";

<Lottie animationData={animationData} />
```

---

## GIFs

| Package | Import | What It Does |
|---------|--------|-------------|
| `@remotion/gif` | `<Gif>` | Frame-accurate GIF rendering synced to video timeline |

```tsx
import { Gif } from "@remotion/gif";
<Gif src={staticFile("my.gif")} width={300} height={300} />
```

---

## Audio & Captions

| Package | Import | What It Does |
|---------|--------|-------------|
| `@remotion/install-whisper-cpp` | `installWhisperCpp()`, `transcribe()`, `downloadWhisperModel()` | Local Whisper.cpp transcription — word-level timestamps, no API key |
| `@remotion/captions` | Caption types, utilities | Word-level caption objects for subtitle rendering |

### Audio-to-Video Workflow
1. Place audio in `public/`
2. Transcribe:
   ```ts
   import { installWhisperCpp, transcribe, downloadWhisperModel } from "@remotion/install-whisper-cpp";
   await installWhisperCpp({ version: "1.5.5" });
   await downloadWhisperModel({ model: "medium.en" });
   const result = await transcribe({ inputPath: "public/audio.wav", model: "medium.en", tokenLevelTimestamps: true });
   ```
3. Use timestamps to create `<Sequence>` blocks per sentence/segment
4. Render captions synced to words

### Audio Component
```tsx
<Audio src={staticFile("voiceover.mp3")} volume={0.8} />
// Volume keyframes:
<Audio src={staticFile("music.mp3")} volume={(f) => interpolate(f, [0, 30], [0, 0.5])} />
```

---

## Animation Utilities

| Package | Import | What It Does |
|---------|--------|-------------|
| `@remotion/animation-utils` | `makeTransform()`, `interpolateStyles()` | CSS transform builder, style interpolation helpers |
| `@remotion/layout-utils` | `measureText()`, `fitText()` | Measure text dimensions, auto-fit text to containers |

---

## CSS Effects (No Package Needed)

These work with plain React style props + `interpolate()`:

| Effect | How |
|--------|-----|
| **Blur** | `filter: blur(${interpolate(frame, [0,30], [10,0])}px)` |
| **Glow** | `filter: drop-shadow(0 0 20px rgba(255,255,255,0.8))` |
| **Gradient animation** | Interpolate `background: linear-gradient(...)` angle or stops |
| **Clip-path reveal** | `clipPath: inset(${100-progress}% 0 0 0)` |
| **Mask** | CSS `mask-image` with animated position |
| **Scale/Rotate** | `transform: scale(${val}) rotate(${deg}deg)` |
| **Opacity** | `opacity: interpolate(frame, [0, 30], [0, 1])` |
| **Color shift** | Interpolate between HSL values |
| **Glass/Frosted** | `backdrop-filter: blur(10px); background: rgba(255,255,255,0.1)` |

---

## Audio Cleaning (Denoise)

| Tool | Type | What It Does |
|------|------|-------------|
| **DeepFilterNet** | Python CLI | AI neural-net noise removal — best quality, studio-grade |
| **FFmpeg arnndn** | CLI filter | RNN-based noise suppression built into FFmpeg |
| **FFmpeg afftdn** | CLI filter | FFT-based steady noise reduction |
| **SoX noisered** | CLI | Classic noise profile subtraction |

### DeepFilterNet (Recommended)
```bash
# Clean a recording (outputs cleaned file next to original)
deep-filter my-recording.wav -o cleaned.wav

# Or use the helper script
python3 scripts/clean_audio.py my-recording.wav cleaned.wav
```

### FFmpeg Noise Filters
```bash
# AI-based (arnndn) — needs RNNoise model file
ffmpeg -i input.wav -af arnndn=m=rnnoise-model.rnnn output.wav

# FFT-based — good for steady hum/hiss (nf = noise floor in dB)
ffmpeg -i input.wav -af afftdn=nf=-25 output.wav

# Gate — cuts silence between words to true silence
ffmpeg -i input.wav -af agate=threshold=0.01:range=0.1 output.wav

# Dialogue enhance (FFmpeg 5+)
ffmpeg -i input.wav -af dialoguenhance output.wav
```

### SoX Noise Reduction
```bash
# Step 1: Record a noise profile from a silent section
sox noisy.wav -n trim 0 0.5 noiseprof noise.prof

# Step 2: Apply noise reduction (0.21 = strength, higher = more aggressive)
sox noisy.wav cleaned.wav noisered noise.prof 0.21
```

---

## Voice Effects (Pedalboard + FFmpeg + SoX)

| Tool | Type | Best For |
|------|------|----------|
| **Pedalboard** (Spotify) | Python | Chaining multiple studio effects — reverb, pitch, compressor, EQ |
| **FFmpeg** | CLI | Quick one-off effects, processing during render pipeline |
| **SoX** | CLI | Pitch/tempo changes, chorus, classic audio transforms |

### Pedalboard Presets (Ready to Use)
```bash
python3 scripts/voice_effects.py <preset> <input.wav> [output.wav]
```

| Preset | Effect |
|--------|--------|
| `clean-voice` | Highpass + compressor + limiter — podcast-ready |
| `deep-voice` | Pitch down 4 semitones + slight reverb |
| `chipmunk` | Pitch up 6 semitones |
| `radio` | Bandpass + compression + light distortion |
| `cinematic` | Compression + large reverb — movie trailer voice |
| `echo` | Delay + reverb — spacious feel |
| `robot` | Chorus + distortion + hard compression |
| `warm` | Gentle EQ + light compression + tiny reverb |
| `phone` | Narrow bandpass + distortion — telephone effect |
| `underwater` | Heavy lowpass + chorus + large reverb |

### Custom Pedalboard Chain (Python)
```python
from pedalboard import Pedalboard, Reverb, PitchShift, Compressor, Gain, Distortion
from pedalboard import Delay, Chorus, HighpassFilter, LowpassFilter, Limiter, Phaser
from pedalboard.io import AudioFile

board = Pedalboard([
    HighpassFilter(cutoff_frequency_hz=80),
    Compressor(threshold_db=-18, ratio=3),
    PitchShift(semitones=-2),
    Reverb(room_size=0.4, wet_level=0.2),
    Gain(gain_db=3),
])

with AudioFile("input.wav") as f:
    audio = f.read(f.frames)
    sr = f.samplerate

result = board(audio, sr)
with AudioFile("output.wav", "w", sr, result.shape[0]) as f:
    f.write(result)
```

### All Available Pedalboard Effects
| Effect | Key Parameters |
|--------|---------------|
| `Compressor` | `threshold_db`, `ratio`, `attack_ms`, `release_ms` |
| `Gain` | `gain_db` |
| `Limiter` | `threshold_db`, `release_ms` |
| `Distortion` | `drive_db` |
| `PitchShift` | `semitones` (-12 to +12) |
| `Reverb` | `room_size` (0-1), `wet_level`, `damping`, `width` |
| `Delay` | `delay_seconds`, `feedback` (0-1), `mix` |
| `Chorus` | `rate_hz`, `depth`, `mix`, `centre_delay_ms` |
| `Phaser` | `rate_hz`, `depth`, `mix`, `feedback` |
| `HighpassFilter` | `cutoff_frequency_hz` |
| `LowpassFilter` | `cutoff_frequency_hz` |
| `HighShelfFilter` | `cutoff_frequency_hz`, `gain_db` |
| `LowShelfFilter` | `cutoff_frequency_hz`, `gain_db` |
| `PeakFilter` | `cutoff_frequency_hz`, `gain_db`, `q` |
| `Convolution` | `impulse_response_filename` (for real room reverb) |
| `NoiseGate` | `threshold_db`, `ratio`, `attack_ms`, `release_ms` |
| `Clipping` | `threshold_db` |
| `Bitcrush` | `bit_depth` |
| `Resample` | `target_sample_rate` |
| `GSMFullRateCompressor` | (telephone codec effect) |
| `MP3Compressor` | `vbr_quality` (lo-fi effect) |

### FFmpeg Voice Effects (One-Liners)
```bash
# Echo
ffmpeg -i in.wav -af "aecho=0.8:0.88:60:0.4" echo.wav

# Radio voice
ffmpeg -i in.wav -af "highpass=f=300,lowpass=f=3000,acompressor" radio.wav

# Telephone
ffmpeg -i in.wav -af "bandpass=f=1000:w=500,volume=1.5" phone.wav

# Bass boost
ffmpeg -i in.wav -af "equalizer=f=100:t=h:w=200:g=6" bass.wav

# Speed up (1.5x, preserves pitch)
ffmpeg -i in.wav -af "atempo=1.5" fast.wav

# Slow down (0.75x, preserves pitch)
ffmpeg -i in.wav -af "atempo=0.75" slow.wav

# Normalize loudness
ffmpeg -i in.wav -af "loudnorm=I=-16:TP=-1.5:LRA=11" normalized.wav

# Fade in/out (3 sec each)
ffmpeg -i in.wav -af "afade=t=in:d=3,afade=t=out:st=27:d=3" faded.wav

# Remove silence from start/end
ffmpeg -i in.wav -af "silenceremove=start_periods=1:start_silence=0.1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_silence=0.1:start_threshold=-50dB,areverse" trimmed.wav
```

### SoX Voice Effects
```bash
# Pitch down (cents: -300 = 3 semitones down)
sox in.wav out.wav pitch -300

# Pitch up
sox in.wav out.wav pitch 500

# Chorus
sox in.wav out.wav chorus 0.7 0.9 55 0.4 0.25 2

# Reverb
sox in.wav out.wav reverb 50 50 100

# Tremolo
sox in.wav out.wav tremolo 5 80

# Flanger
sox in.wav out.wav flanger

# Trim silence from edges
sox in.wav out.wav silence 1 0.1 1% reverse silence 1 0.1 1% reverse
```

---

## Sound Cutting & Splitting (Whisper + FFmpeg)

### Whisper VAD (Voice Activity Detection)
```bash
# Full transcription with smart silence detection
whisper-cli input.wav \
  --model medium.en \
  --output-json \
  --vad-min-silence-duration-ms 500 \
  --vad-max-speech-duration-s 30 \
  --vad-speech-pad-ms 200 \
  --dtw medium.en
```

| Whisper Flag | What It Does |
|-------------|-------------|
| `--vad-min-silence-duration-ms 500` | Silence must be 500ms+ to count as a segment break |
| `--vad-max-speech-duration-s 30` | Auto-split speech segments longer than 30s |
| `--vad-speech-pad-ms 200` | Add 200ms padding around detected speech |
| `--vad-samples-overlap` | Overlap between segments (prevents cut-offs) |
| `--dtw medium.en` | More accurate word-level timestamps |

### FFmpeg Audio Splitting
```bash
# Cut segment by timestamp
ffmpeg -i input.wav -ss 1.5 -to 4.8 -c copy segment_01.wav

# Split at multiple points (from Whisper JSON timestamps)
ffmpeg -i input.wav -ss 0.0 -to 3.2 -c copy seg1.wav
ffmpeg -i input.wav -ss 3.2 -to 7.1 -c copy seg2.wav
ffmpeg -i input.wav -ss 7.1 -to 12.0 -c copy seg3.wav

# Concatenate segments back
ffmpeg -f concat -i filelist.txt -c copy final.wav

# Mix two audio tracks (voice + music)
ffmpeg -i voice.wav -i music.wav -filter_complex "[1:a]volume=0.3[bg];[0:a][bg]amix=inputs=2:duration=first" mixed.wav

# Crossfade between two audio files (3 sec overlap)
ffmpeg -i part1.wav -i part2.wav -filter_complex "acrossfade=d=3:c1=tri:c2=tri" crossfaded.wav
```

### Remotion Audio Cutting (In-Code)
```tsx
// Trim audio to specific segment
<Audio src={staticFile("voice.wav")} startFrom={45} endAt={144} />

// Layer music underneath voice (quieter)
<Audio src={staticFile("bgm.mp3")} volume={0.15} />
<Audio src={staticFile("voice.wav")} volume={1.0} />
```

---

## Sound Effects (SFX)

### Freesound.org — Search & Download Free SFX
```bash
# Set your API key (get one at https://freesound.org/apiv2/apply/)
export FREESOUND_API_KEY=your_key_here

# Search and download
python3 scripts/fetch_sfx.py "whoosh" 3
python3 scripts/fetch_sfx.py "explosion" 5
python3 scripts/fetch_sfx.py "UI click"
python3 scripts/fetch_sfx.py "cinematic boom"
python3 scripts/fetch_sfx.py "footsteps wood"

# Files saved to public/sfx/
```

### AI-Generated SFX (Meta AudioGen)
```bash
# Generate sound effects from text descriptions
python3 scripts/generate_music.py sfx "thunderstorm with heavy rain" -d 5 -o public/sfx/thunder.wav
python3 scripts/generate_music.py sfx "sword clash metal impact" -d 3 -o public/sfx/sword.wav
python3 scripts/generate_music.py sfx "spaceship engine humming" -d 8 -o public/sfx/engine.wav
python3 scripts/generate_music.py sfx "crowd cheering stadium" -d 6 -o public/sfx/crowd.wav
```

### FFmpeg SFX Generation (No AI Needed)
```bash
# Sine wave beep
ffmpeg -f lavfi -i "sine=frequency=880:duration=0.5" beep.wav

# White noise (static)
ffmpeg -f lavfi -i "anoisesrc=d=2:c=white:r=44100" whitenoise.wav

# Pink noise (softer, ambient)
ffmpeg -f lavfi -i "anoisesrc=d=5:c=pink:r=44100" pinknoise.wav

# Sweep tone (rising pitch)
ffmpeg -f lavfi -i "sine=frequency=200:duration=2" -af "vibrato=f=5:d=1" sweep.wav

# Click/tick
ffmpeg -f lavfi -i "sine=frequency=1000:duration=0.02" click.wav
```

### Use SFX in Remotion
```tsx
<Sequence from={30} durationInFrames={60}>
  <Audio src={staticFile("sfx/whoosh.wav")} volume={0.6} />
</Sequence>

<Sequence from={90} durationInFrames={45}>
  <Audio src={staticFile("sfx/boom.wav")} volume={0.8} />
</Sequence>
```

---

## Music Analysis (AI Understands Music Without Human Listening)

### analyze_music.py — Full Track Analysis
```bash
python3 scripts/analyze_music.py track.mp3
# Outputs track_analysis.json with everything AI needs:
```

**Output JSON contains:**
| Field | What It Tells AI |
|-------|-----------------|
| `bpm` | Beats per minute — for timing scene cuts |
| `estimated_key` | Musical key (C, D#, etc.) — for matching mood |
| `beat_timestamps` | Every beat position — for syncing transitions |
| `onset_timestamps` | Every note/hit — for syncing visual accents |
| `energy_curve` | Energy level every second — match visuals to intensity |
| `energy_peaks` | Drop/climax timestamps — place most impactful visuals here |
| `segments` | Section boundaries with labels (intro/verse/chorus/bridge/outro) |
| `spectral_profile` | Brightness/warmth over time — warm=dark visuals, bright=vivid |
| `sync_points` | AI-recommended moments to cut/transition video scenes |
| `ai_summary` | Quick stats for decision-making |

### separate_stems.py — Split Into Vocals/Drums/Bass/Other
```bash
python3 scripts/separate_stems.py track.mp3 public/stems/
# Outputs: vocals.wav, drums.wav, bass.wav, other.wav
```

Uses Meta's **Demucs v4** (htdemucs). This lets AI:
- Use only drums during action scenes
- Use only melody during calm moments
- Remove vocals to create instrumental
- Isolate vocals for separate subtitle sync

### Workflow: Music-Driven Video (No Human Listening)
```
1. Pick a CC track from Freesound/Pixabay/Incompetech
2. python3 scripts/analyze_music.py track.mp3 → analysis.json
3. AI reads analysis.json → knows BPM, segments, peaks, sync points
4. AI builds Remotion composition:
   - Scene count = sync_points count
   - Transition timing = beat_timestamps
   - High-energy scenes at energy_peaks
   - Calm visuals during low-energy segments
   - <TransitionSeries> cuts aligned to beats
5. python3 scripts/separate_stems.py track.mp3 → use stems as needed
6. Render
```

### Essentia — Danceability, Key, Mood Proxies, Energy Distribution

Essentia is installed under brew's python@3.9 (not system python). It runs automatically via `analyze_music.py` — no manual setup needed.

```bash
# Runs automatically when you call analyze_music.py
# Or run standalone:
/opt/homebrew/opt/python@3.9/bin/python3.9 scripts/essentia_analysis.py track.mp3
```

**Extra fields added to analysis JSON when Essentia is available:**

| Field | What It Tells AI |
|-------|-----------------|
| `essentia.essentia_key_full` | Key + scale (e.g. "A minor") — more accurate than librosa |
| `essentia.danceability_normalized` | 0-1 score — how danceable the track is |
| `essentia.dynamic_complexity` | How much the dynamics vary — high = dramatic, low = steady |
| `essentia.energy_distribution` | % energy in low/mid/high bands — bass-heavy? bright? |
| `essentia.mood_tags` | Heuristic mood labels: energetic, melancholic, happy, dark, warm, etc. |
| `essentia.visual_suggestions` | AI-ready hints: recommended pace, colors, motion style, effects |

**Mood tags** (derived from BPM + key + danceability + dynamics + energy):
- `energetic`, `groovy`, `melancholic`, `dark`, `happy`, `warm`
- `dramatic`, `steady`, `bass-heavy`, `bright`, `muted`
- `slow`, `moderate`, `upbeat`, `fast`

**Visual suggestions** example:
```json
{
  "pace": "fast cuts, quick transitions",
  "colors": "vivid, saturated, high contrast",
  "motion": "rapid, dynamic, particles",
  "effects": "screen shake on bass hits, scale pulses, lens flares, glow"
}
```

### Open Music Sources (Free, CC-Licensed)
| Source | Search By | URL |
|--------|----------|-----|
| **Freesound.org** | Keywords, tags | freesound.org (API installed) |
| **Pixabay Music** | Mood, genre, BPM | pixabay.com/music |
| **Incompetech** | Mood, tempo, genre | incompetech.com/music |
| **Free Music Archive** | Genre, duration | freemusicarchive.org |
| **ccMixter** | Remix-friendly stems | ccmixter.org |
| **Openverse** | CC media search | openverse.org |
| **Filmmusic.io** | Mood, instruments | filmmusic.io |

---

## Music Generation (Meta AudioCraft MusicGen)

```bash
# Generate background music from text prompts
python3 scripts/generate_music.py music "calm lo-fi hip hop beat" -d 30 -o public/bgm.wav
python3 scripts/generate_music.py music "epic cinematic orchestra" -d 20 -o public/epic.wav
python3 scripts/generate_music.py music "upbeat electronic dance" -d 15 -o public/edm.wav
python3 scripts/generate_music.py music "soft piano ambient" -d 60 -o public/piano.wav

# Available models (bigger = better quality, slower):
#   facebook/musicgen-small   (300M, fastest)
#   facebook/musicgen-medium  (1.5B, balanced)
#   facebook/musicgen-large   (3.3B, best quality, needs GPU)
python3 scripts/generate_music.py music "jazz saxophone smooth" -d 20 -m facebook/musicgen-medium
```

### Use Generated Music in Remotion
```tsx
// Background music with fade in/out
<Audio
  src={staticFile("bgm.wav")}
  volume={(f) => {
    const fadeIn = interpolate(f, [0, 30], [0, 0.2], { extrapolateRight: "clamp" });
    const fadeOut = interpolate(f, [totalFrames - 30, totalFrames], [0.2, 0], { extrapolateLeft: "clamp" });
    return Math.min(fadeIn, fadeOut);
  }}
/>
```

---

## Video Post-Processing (FFmpeg VFX)

Apply after rendering, or as part of a pipeline:

| Effect | Command |
|--------|---------|
| **Color grading** | `ffmpeg -i in.mp4 -vf colorbalance=rs=0.3:gs=-0.1:bs=0.2 out.mp4` |
| **Cinematic bars** | `ffmpeg -i in.mp4 -vf "crop=iw:iw/2.35" out.mp4` |
| **Vignette** | `ffmpeg -i in.mp4 -vf "vignette=PI/4" out.mp4` |
| **Film grain** | `ffmpeg -i in.mp4 -vf "noise=alls=20:allf=t" out.mp4` |
| **Speed up 2x** | `ffmpeg -i in.mp4 -filter:v "setpts=0.5*PTS" -filter:a "atempo=2.0" out.mp4` |
| **Slow motion 0.5x** | `ffmpeg -i in.mp4 -filter:v "setpts=2.0*PTS" -filter:a "atempo=0.5" out.mp4` |
| **Chromatic aberration** | `ffmpeg -i in.mp4 -vf "rgbashift=rh=-3:bh=3" out.mp4` |
| **Gaussian blur** | `ffmpeg -i in.mp4 -vf "gblur=sigma=5" out.mp4` |
| **Sharpen** | `ffmpeg -i in.mp4 -vf "unsharp=5:5:1.5" out.mp4` |
| **Fade in/out** | `ffmpeg -i in.mp4 -vf "fade=in:0:30,fade=out:270:30" out.mp4` |
| **Overlay image** | `ffmpeg -i in.mp4 -i logo.png -filter_complex "overlay=10:10" out.mp4` |
| **Stabilize video** | `ffmpeg -i in.mp4 -vf vidstabdetect -f null - && ffmpeg -i in.mp4 -vf vidstabtransform out.mp4` |
| **Reverse video** | `ffmpeg -i in.mp4 -vf reverse -af areverse out.mp4` |
| **Loop** | `ffmpeg -stream_loop 3 -i in.mp4 -c copy looped.mp4` |

---

## Commands Reference

```bash
# Preview in browser (Remotion Studio)
npm run dev

# Render to MP4
npx remotion render src/index.ts MyComposition out/video.mp4

# Render specific frames
npx remotion render src/index.ts MyComposition out/video.mp4 --frames=0-90

# Render as GIF
npx remotion render src/index.ts MyComposition out/video.gif --codec=gif

# Render as WebM
npx remotion render src/index.ts MyComposition out/video.webm --codec=vp8

# Upgrade all remotion packages
npm run upgrade
```

## Project Structure

```
video/
├── src/
│   ├── index.ts          # Entry point — register compositions
│   ├── Root.tsx           # Root component with <Composition> declarations
│   └── MyVideo/
│       ├── index.tsx      # Main composition component
│       ├── scenes/        # Individual scene components
│       └── assets/        # Lottie JSON, local data
├── public/                # Static assets (audio, images, fonts, GIFs)
│   ├── audio.wav          # Your recordings
│   └── sfx/               # Sound effects (downloaded / generated)
├── scripts/               # Python helper scripts
│   ├── analyze_music.py   # Music analysis → JSON (BPM, beats, segments, energy, sync points)
│   ├── separate_stems.py  # Demucs stem separation (vocals/drums/bass/other)
│   ├── clean_audio.py     # DeepFilterNet noise removal
│   ├── voice_effects.py   # Pedalboard voice presets
│   ├── generate_music.py  # MusicGen / AudioGen (music + SFX from text)
│   └── fetch_sfx.py       # Freesound.org search & download
├── out/                   # Rendered output
├── .claude/rules/
│   └── remotion.md        # AI rules for Claude Code
├── .agents/skills/        # Remotion skills (installed)
├── remotion.config.ts     # Remotion config
├── package.json
└── TOOLS.md               # This file
```

## All Installed Tools Summary

### System (brew)
- `ffmpeg` — audio/video processing, format conversion, filters
- `sox` — audio manipulation CLI (pitch, tempo, reverb, chorus, noise reduction)

### Python (pip)
- `deepfilternet` — AI audio denoising (best quality)
- `pedalboard` — Spotify's audio effects (reverb, pitch, compressor, delay, etc.)
- `librosa` — music information retrieval (BPM, beats, segments, energy, spectral)
- `demucs` — Meta's stem separation (vocals/drums/bass/other)
- `essentia` — danceability, key+scale, dynamic complexity, energy bands, mood proxies (brew python@3.9)
- `freesound-python` — search & download free sound effects from Freesound.org
- `audiocraft` — Meta's AI music + SFX generation (MusicGen + AudioGen)

### Node.js (npm)
- `sox-audio` — SoX wrapper for Node.js
- `fluent-ffmpeg` — FFmpeg wrapper for Node.js
- All `@remotion/*` packages (see sections above)

### API Keys Needed
| Service | For | Get Key |
|---------|-----|---------|
| Freesound.org | Downloading sound effects | https://freesound.org/apiv2/apply/ |
| ElevenLabs (optional) | AI voiceover generation | https://elevenlabs.io/ |
