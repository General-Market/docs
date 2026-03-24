# Viral Short Production Pipeline — Complete Guide

Full pipeline from raw voice recording to upload-ready 9:16 vertical short.

## Architecture

```
video/
├── src/
│   ├── index.ts                          # Remotion entry point
│   ├── Root.tsx                          # Dynamic multi-short registration
│   ├── lib/                              # SHARED REUSABLE COMPONENTS
│   │   ├── components/
│   │   │   ├── Background/               # AnimatedGradient, ParticleField, AmbientShimmer
│   │   │   ├── Chibi/                    # ChibiController, Idle, Entrance/Exit, BeatPulse, Shadow
│   │   │   ├── Captions/                 # CaptionRenderer, WordPopIn, PhraseGroup, styles
│   │   │   ├── Effects/                  # ScreenShake, ZoomPulse, FlashImpact, EmojiRain, SpeedLines
│   │   │   ├── Overlays/                 # Vignette, FilmGrain, ColorGrade, Watermark, ProgressBar
│   │   │   ├── Transitions/              # WhooshSlide, ZoomTransition, FlashCut
│   │   │   └── Audio/                    # MusicLayer (smart ducking), VoiceLayer, SFXTrigger
│   │   ├── hooks/                        # useBeatSync, useSegments, useMusicAnalysis, useCaptions, useEnergyAtFrame
│   │   ├── types/                        # ShortConfig, ScenePlan, MusicAnalysis, Caption types
│   │   ├── utils/                        # frameConvert, colorPalettes, easing presets, deterministic random
│   │   └── templates/
│   │       ├── ChibiExplainer.tsx        # MASTER TEMPLATE — wires all 18 layers
│   │       └── compileEffectEvents.ts    # Effect event compiler (the "brain")
│   └── shorts/                           # PER-SHORT (add new shorts here)
│       └── <short-id>/
│           ├── index.tsx                 # <ChibiExplainer {...config} />
│           └── config.ts                 # ShortConfig for this short
├── public/
│   ├── shorts/<short-id>/               # PER-SHORT ASSETS
│   │   ├── voice.wav, captions.json, scene-plan.json
│   │   ├── music.mp3, music_analysis.json
│   │   ├── chibis/ (transparent PNGs by emotion)
│   │   └── sfx/ (whoosh.wav, pop.wav, impact.wav, sparkle.wav)
│   └── shared/                          # SHARED (fonts, textures, emojis)
├── scripts/                             # Python audio tools + transcription
└── out/<short-id>-final.mp4
```

## Visual Layer Stack (18 Layers)

| # | Layer | Component | Key Animation |
|---|-------|-----------|---------------|
| 0 | Base gradient | `AnimatedGradient` | 3-color gradient, 0.5deg/frame rotation, noise-driven center drift, emotion color crossfade |
| 1 | Particle field | `ParticleField` | 30 floating shapes, noise paths, energy-modulated density |
| 2 | Ambient shimmer | `AmbientShimmer` | Full-screen noise overlay, emotion-tinted |
| 3 | Music audio | `MusicLayer` | Smart ducking: 0.14 under voice, 0.35 in gaps, smooth ramp |
| 4 | Voice audio | `VoiceLayer` | Volume 1.0, starts frame 0 |
| 5 | SFX audio | `SFXTrigger` | Whoosh/pop/impact/sparkle mapped to events |
| 6-7 | Chibi + shadow | `ChibiController` | Idle: breathing + bounce + sway. Entrance: spring pop-in. Beat pulse |
| 8 | Captions | `CaptionRenderer` | Word-by-word spring pop-in, current word highlight, TikTok-style pages |
| 9 | Screen shake | `ScreenShake` | Noise-driven translate, linear decay |
| 10 | Zoom pulse | `ZoomPulse` | Spring scale pulse on peaks |
| 11 | Flash impact | `FlashImpact` | White flash on hard cuts |
| 12 | Emoji rain | `EmojiRain` | Falling emojis on hyped segments |
| 13 | Speed lines | `SpeedLines` | SVG radial lines on dramatic beats |
| 15 | Vignette | `Vignette` | Radial gradient, dark edges |
| 16 | Film grain | `FilmGrain` | SVG noise, randomized per frame |
| 17 | Color grade | `ColorGrade` | Emotion-tinted overlay |
| 18 | Progress bar | `ProgressBar` | 3px accent color fill |

## Production Steps

### Phase 1: Audio Pipeline

```bash
# 1. Copy raw voice
cp voice-raw.wav public/shorts/<id>/voice-raw.wav

# 2. Denoise
python3 scripts/clean_audio.py public/shorts/<id>/voice-raw.wav public/shorts/<id>/voice-clean.wav

# 3. Trim silence (zero dead air for hook)
ffmpeg -i public/shorts/<id>/voice-clean.wav -af silenceremove=1:0:-50dB public/shorts/<id>/voice-trimmed.wav

# 4. Voice effects (optional)
python3 scripts/voice_effects.py public/shorts/<id>/voice-trimmed.wav --preset cinematic

# 5. Transcribe to word-level captions
npx tsx scripts/transcribe.ts public/shorts/<id>/voice.wav public/shorts/<id>/captions.json
```

### Phase 2: Scene Plan

Create `public/shorts/<id>/scene-plan.json`:
- Split transcript by pauses (>400ms gaps) into segments
- Assign emotion per segment (neutral, excited, confused, panicking, happy, sad, angry)
- Mark keywords and punchlines
- Set energy levels (0-1)
- Assign transitions between segments (flash-cut, whoosh-slide, zoom-out, cross-fade)

### Phase 3: Music Pipeline

```bash
# 1. Place music track
cp music.mp3 public/shorts/<id>/music.mp3

# 2. Analyze
python3 scripts/analyze_music.py public/shorts/<id>/music.mp3 public/shorts/<id>/music_analysis.json
```

### Phase 4: Assets

```bash
# 1. Copy chibis (one PNG per emotion, transparent background)
cp chibis/*.png public/shorts/<id>/chibis/
# Rename: neutral.png, excited.png, confused.png, panicking.png, happy.png, sad.png, angry.png

# 2. Remove backgrounds if needed
pip install rembg && rembg i input.png output.png

# 3. Place SFX files
# whoosh.wav, pop.wav, impact.wav, sparkle.wav
# Fetch from Freesound: python3 scripts/fetch_sfx.py "whoosh" --download
```

### Phase 5: Register Short

1. Create `src/shorts/<id>/config.ts` with your ShortConfig
2. Create `src/shorts/<id>/index.tsx` (just wraps ChibiExplainer)
3. Import config in `src/Root.tsx` and add to the `shorts` array

### Phase 6: Preview & Render

```bash
# Preview in Remotion Studio
npm run dev

# Render
npx remotion render src/index.ts <id> out/<id>.mp4 --codec=h264 --crf=18

# Post-process
ffmpeg -i out/<id>.mp4 \
  -vf "eq=contrast=1.05:saturation=1.1,unsharp=3:3:0.5" \
  -af loudnorm=I=-14:TP=-1:LR=11 \
  -movflags +faststart \
  out/<id>-final.mp4

# Extract thumbnail
ffmpeg -i out/<id>-final.mp4 -vframes 1 -ss 0.033 out/<id>-thumb.jpg
```

## Hook Strategy (First 30 Frames / 1 Second)

| Frame | Visual | Audio |
|-------|--------|-------|
| 0 | Background snaps in, vignette + grain active | Music starts (vol 0 ramping), voice starts IMMEDIATELY |
| 1-4 | Hook text springs in | Voice speaking |
| 3 | First caption word appears (70ms pre-emit) | — |
| 6-10 | Chibi ENTERS: spring pop-in + shadow | Optional pop SFX |
| 10-15 | Chibi settled, idle animations begin | Music reaching ducking volume |
| 15-30 | Full composition, first beat pulse | Normal rhythm |

## Music Sync Mapping

| Field | Visual Trigger |
|-------|----------------|
| `beat_timestamps` | Chibi beat-pulse, caption nudge, particle opacity pulse |
| `energy_peaks` | ZoomPulse + ScreenShake + SpeedLines |
| `energy_curve` | Modulates particle density, grain opacity, saturation |
| `mood_tags` | Drives initial background preset + color palette |

## Transition Logic

| Condition | Type | Duration | SFX |
|-----------|------|----------|-----|
| Big energy jump | Flash cut | 3f | impact.wav |
| Big energy drop | Zoom out | 12f | soft whoosh |
| Moderate increase | Whoosh slide | 8f | whoosh.wav |
| Subtle change | Cross-fade | 15f | none |

## Quality Checklist

- [ ] Voice starts at frame 0 (zero dead air)
- [ ] Captions appear 50-100ms before audio
- [ ] Chibi emotion matches each segment
- [ ] Music ducked properly (voice always dominant)
- [ ] Beat pulses visible but not overwhelming
- [ ] No static frames (always movement from gradient + particles + idle)
- [ ] 1080x1920, under 60s, under 50MB
- [ ] -14 LUFS loudness
- [ ] First frame = good thumbnail
- [ ] Text readable on mobile
