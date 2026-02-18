# Video Analysis Protocol

Reproducible pipeline to fully reverse-engineer any short-form video (SFX, VFX, music, montage, typography, camera work).

---

## Prerequisites

### Tools Required

| Tool | Install | Purpose |
|------|---------|---------|
| `yt-dlp` | `brew install yt-dlp` | Download source video |
| `ffmpeg` / `ffprobe` | `brew install ffmpeg` | Extract audio, frames, scene detection, media info |
| `whisper` | `pip install openai-whisper` | Speech-to-text with word-level timestamps |
| `demucs` | `pip install demucs` | Audio stem separation (vocals, drums, bass, other) |
| `librosa` | `pip install librosa` | Beat detection, tempo, onset detection, spectral analysis |
| `opencv-python` | `pip install opencv-python` | Optical flow, color analysis, scene detection |
| `numpy` | `pip install numpy` | Numerical processing |

### Folder Structure (auto-created per video)

```
video_analysis/
  {video_name}/
    source/           # Original downloaded video
    audio/            # Extracted full audio WAV
    stems/
      2stem/          # vocals.wav + music_sfx.wav
      4stem/          # vocals.wav + drums.wav + bass.wav + other.wav
    frames/           # Keyframes at each scene change (PNG)
    data/             # All JSON analysis outputs
    report/           # Final markdown report
```

---

## Phase 1 — Acquisition & Extraction

### Step 1.1: Download Video
```bash
yt-dlp -o "{output_dir}/source/video.%(ext)s" "{URL}"
```
- [ ] Video downloaded
- [ ] Verify format: `ffprobe -v quiet -print_format json -show_format -show_streams video.webm`
- [ ] Record: resolution, fps, codec, duration, aspect ratio

### Step 1.2: Extract Audio
```bash
ffmpeg -i source/video.webm -vn -acodec pcm_s16le -ar 44100 -ac 2 audio/full_audio.wav -y
```
- [ ] Audio extracted as 16-bit 44.1kHz WAV

### Step 1.3: Detect Scene Changes & Extract Keyframes
```bash
mkdir -p frames/
ffmpeg -i source/video.webm \
  -vf "select='gt(scene,0.25)',showinfo" \
  -vsync vfr frames/scene_%04d.png -y 2>&1 | grep "pts_time"
```
- [ ] Keyframes extracted (one per scene change)
- [ ] Scene timestamps recorded from `pts_time` values
- [ ] Total scene count noted

**Tuning:** Lower the threshold (0.25 → 0.15) for faster-cut videos, raise it (0.25 → 0.40) for slower videos.

---

## Phase 2 — Audio Analysis

### Step 2.1: Whisper Transcription
```bash
whisper audio/full_audio.wav --model small --language en \
  --output_format json --output_dir data/ --word_timestamps True
```
- [ ] Full transcript with word-level timestamps
- [ ] Identify: language, speaker count, narration style (voiceover vs dialogue)
- [ ] Map text lines to scene timestamps

### Step 2.2: Stem Separation (2-stem)
```bash
demucs --two-stems vocals audio/full_audio.wav -o stems/2stem/
```
- [ ] `vocals.wav` — isolated voice
- [ ] `no_vocals.wav` — music + SFX combined
- [ ] Compute voice-to-music energy ratio per 5s window

### Step 2.3: Stem Separation (4-stem)
```bash
demucs audio/full_audio.wav -o stems/4stem/
```
- [ ] `vocals.wav` — voice
- [ ] `drums.wav` — percussive elements
- [ ] `bass.wav` — bass frequencies
- [ ] `other.wav` — synths, pads, SFX, textures

### Step 2.4: Librosa Audio Properties
```python
y, sr = librosa.load("audio/full_audio.wav", sr=44100)
tempo, beats = librosa.beat.beat_track(y=y, sr=sr)
onset_frames = librosa.onset.onset_detect(y=y, sr=sr)
```
- [ ] **Tempo** (BPM)
- [ ] **Key** (via chroma analysis)
- [ ] **Beat positions** (timestamps)
- [ ] **Onset count** (total transient events)
- [ ] **RMS energy** per 5s segment (mean + peak)
- [ ] **Spectral centroid** (avg brightness in Hz)
- [ ] **Silent regions** (RMS < 0.05 threshold, > 200ms duration)

### Step 2.5: SFX Catalog (per stem)
For each of `drums.wav` and `other.wav`:
```python
onset_frames = librosa.onset.onset_detect(y=stem, sr=sr)
# For each onset, extract 60ms window and compute:
# - spectral centroid (brightness)
# - spectral bandwidth (spread)
# - zero crossing rate (noisiness)
# - RMS energy
# - spectral rolloff
```
Classify each SFX event:

| Centroid | ZCR | Type |
|----------|-----|------|
| > 5000 Hz, ZCR > 0.12 | high | whoosh/swoosh |
| > 4000 Hz, BW > 2500 | — | shimmer/riser |
| < 1500 Hz, energy > 0.05 | — | low_rumble/boom |
| < 2500 Hz, energy > 0.03 | — | dark_texture |
| 2000–4000 Hz, energy > 0.04 | — | mid_tone/pad |
| < 800 Hz (drums) | — | kick/deep_boom |
| 800–2000 Hz (drums) | low | tom/body_hit |
| > 3500 Hz (drums), ZCR > 0.1 | high | snare/crack |
| > 6000 Hz (drums) | — | hi-hat/sizzle |

- [ ] Percussive SFX catalog (drums stem) with timestamps
- [ ] Texture/SFX catalog (other stem) with timestamps
- [ ] Combined timeline sorted by time
- [ ] Map high-energy SFX to narrative events (nearest scene cut)
- [ ] Identify SFX design patterns (layering, unique palettes per scene)

---

## Phase 3 — Visual Analysis

### Step 3.1: Color Grading Per Shot
For each keyframe:
```python
# K-means clustering (k=3) on RGB pixels → dominant colors + percentages
# Convert to HSV → avg hue, saturation, value
# Grayscale → avg brightness + contrast (std dev)
```
- [ ] Top 3 dominant colors (hex + %) per keyframe
- [ ] Average HSV per keyframe
- [ ] Brightness + contrast values
- [ ] Group by narrative act → color palette per act
- [ ] Identify light leak frames (brightness > 190)

### Step 3.2: Transition Analysis
```python
# Scan every frame for brightness > 190 → find bright regions
# Group consecutive bright frames → light leak regions
# Measure duration in frames and seconds
# Identify flash-cut triplets (3 scene changes within 0.5s)
```
- [ ] Total light leak count
- [ ] Duration per light leak (in frames and seconds)
- [ ] Peak brightness per transition
- [ ] Classify: flash triplet / extended wash / fade to white / hard cut
- [ ] Transition inventory table

### Step 3.3: Camera Motion (Optical Flow)
For each scene (starting at scene timestamp, analyzing 1–2s of footage):
```python
flow = cv2.calcOpticalFlowFarneback(prev_gray, curr_gray, ...)
dx = np.median(flow[:,:,0])  # horizontal motion
dy = np.median(flow[:,:,1])  # vertical motion
# Zoom: compare flow magnitude at center vs edges
```
Classify:

| Condition | Motion Type |
|-----------|-------------|
| magnitude < 0.3 | static |
| abs(dx) > 0.5 | pan_left / pan_right |
| abs(dy) > 0.5 | tilt_up / tilt_down |
| edge_mag - center_mag > 0.3 | zoom_in |
| edge_mag - center_mag < -0.3 | zoom_out |
| magnitude > 1.5 | fast_motion |
| duration < 3 frames | flash_frame (skip) |

- [ ] Motion type per scene
- [ ] dX, dY, zoom, magnitude values
- [ ] Identify strongest motion scene
- [ ] Pattern: zoom in = intimacy, zoom out = reveal

### Step 3.4: Typography Extraction
```python
# Text region: center horizontal, 45–70% from top
# White text: HSV saturation < 40, value > 220
# Yellow text: hue 15–35, saturation > 100, value > 180
# Sample pixel colors → average RGB → hex
# Shadow detection: dilate text mask, sample surrounding dark pixels
```
- [ ] White text hex code
- [ ] Yellow/highlight text hex code
- [ ] Shadow characteristics (brightness, color)
- [ ] Text position (% from top)
- [ ] Approximate font (serif/sans-serif, weight, size relative to frame)
- [ ] Text animation style (hard cut / fade / type-on)

### Step 3.5: Visual VFX Identification (Manual/AI Vision)
Review keyframes for:
- [ ] AI generation artifacts (hands, faces, texture shifting)
- [ ] Compositing (scale changes, figure over landscape)
- [ ] Speed ramps / slow motion
- [ ] Blur effects (radial, motion, depth-of-field)
- [ ] Particle effects
- [ ] Color washes / tints
- [ ] Split screen / picture-in-picture

---

## Phase 4 — Montage & Editing Analysis

### Step 4.1: Cut Statistics
```python
scene_times = [...]  # from Phase 1.3
total_cuts = len(scene_times)
avg_cut_rate = total_cuts / duration
# Cut density per 5s window
```
- [ ] Total cuts
- [ ] Average cuts/second and cuts/minute
- [ ] Fastest section (highest cuts/5s)
- [ ] Slowest section (lowest cuts/5s)
- [ ] Cut density map (histogram per 5s)

### Step 4.2: Editing Patterns
- [ ] Identify repeating cut patterns (triplets, doublets)
- [ ] Measure pace acceleration/deceleration over time
- [ ] Match cuts (visual continuity across scene changes)
- [ ] Bookend structure (opening vs closing similarity)
- [ ] Montage sequences (rapid succession of related shots)
- [ ] Beat-to-cut correlation (% of cuts landing on beat positions)

### Step 4.3: Narrative Structure
- [ ] Map scenes to story acts
- [ ] Identify cyclical/linear/parallel narrative structure
- [ ] Map voice lines to visual scenes (sync analysis)

---

## Phase 5 — Report Compilation

### Report Template (Sections)

1. **Metadata** — Source, format, duration, codec, fps
2. **Full Script** — Whisper transcript with word-level timestamps + keyword mapping
3. **Narrative Structure** — Story arc, acts, transformations
4. **VFX Techniques** — AI generation, compositing, light leaks (measured), color grading (hex values)
5. **Typography** — Text colors (hex), font style, position, animation, shadow
6. **Camera Motion** — Per-shot optical flow, motion type distribution
7. **Audio Stems** — Voice vs music balance, 4-stem energy overview
8. **SFX Catalog** — Percussive events, texture events, combined timeline, design patterns
9. **Montage/Editing** — Cut stats, density map, transition inventory, editing patterns
10. **Music/Score** — Tempo, key, beat-sync analysis
11. **Production Summary** — What makes it work + reproduction pipeline
12. **Files Produced** — Index of all outputs

### Output Files Checklist

| File | Location | Phase |
|------|----------|-------|
| Source video | `source/` | 1.1 |
| Full audio WAV | `audio/` | 1.2 |
| Keyframe PNGs | `frames/` | 1.3 |
| 2-stem vocals | `stems/2stem/vocals.wav` | 2.2 |
| 2-stem music+sfx | `stems/2stem/music_sfx.wav` | 2.2 |
| 4-stem vocals | `stems/4stem/vocals.wav` | 2.3 |
| 4-stem drums | `stems/4stem/drums.wav` | 2.3 |
| 4-stem bass | `stems/4stem/bass.wav` | 2.3 |
| 4-stem other | `stems/4stem/other.wav` | 2.3 |
| Transcript JSON | `data/transcript.json` | 2.1 |
| Color analysis | `data/color_analysis.json` | 3.1 |
| Motion analysis | `data/motion_analysis.json` | 3.3 |
| Transition analysis | `data/transition_analysis.json` | 3.2 |
| Typography analysis | `data/typography_analysis.json` | 3.4 |
| SFX detailed | `data/sfx_detailed.json` | 2.5 |
| Final report | `report/video_analysis_report.md` | 5 |

---

## Execution Order (Dependency Graph)

```
Phase 1 (sequential)
  1.1 Download ──→ 1.2 Extract Audio ──→ 1.3 Scene Detection
                         │
Phase 2 (parallel after 1.2)
                         ├──→ 2.1 Whisper
                         ├──→ 2.2 Demucs 2-stem
                         ├──→ 2.3 Demucs 4-stem ──→ 2.5 SFX Catalog
                         └──→ 2.4 Librosa Analysis

Phase 3 (parallel after 1.3)
  3.1 Color ─┐
  3.2 Trans ─┤ (all parallel, depend on frames)
  3.3 Motion ┤
  3.4 Typo  ─┤
  3.5 VFX   ─┘

Phase 4 (after 1.3 + 2.4)
  4.1 Cut Stats ──→ 4.2 Patterns ──→ 4.3 Narrative

Phase 5 (after all)
  Compile report
```

**Maximum parallelism:** After 1.2 completes, run 2.1/2.2/2.3/2.4 simultaneously. After 1.3 completes, run 3.1–3.5 simultaneously. Phase 4 and 5 depend on earlier phases.

---

## Timing Estimates

| Phase | Wall Clock (1min video) | Bottleneck |
|-------|------------------------|------------|
| 1. Acquisition | 30s–2min | Download speed |
| 2. Audio Analysis | 2–5min | Demucs 4-stem (~1min), Whisper (~1min) |
| 3. Visual Analysis | 1–3min | Optical flow (reads full video) |
| 4. Montage Analysis | < 30s | Pure computation |
| 5. Report | < 1min | Compilation |
| **Total** | **~5–10min per video** | |

---

## Scaling Notes

- **Batch processing:** Wrap each phase in a loop over video URLs. Parallelize across videos.
- **GPU acceleration:** Whisper and Demucs both support `--device cuda` for 5–10x speedup.
- **Threshold tuning:** Scene detection threshold (0.25) may need adjustment per video style. Fast cuts → lower (0.15). Slow cinema → higher (0.40).
- **Language:** Pass `--language` to Whisper if known. Use `--model medium` or `--model large` for non-English.
- **SFX classification thresholds** in Phase 2.5 are tuned for cinematic/orchestral content. Adjust for electronic music or dialogue-heavy content.
