# ShotForge — Production Instructions

## Project Paths

- **Remotion project**: `/Users/maxguillabert/Downloads/video/`
- **Production assets**: `/Users/maxguillabert/Downloads/index/_bmad-output/youtube/video/<video-name>/`
- **Output shorts**: `/Users/maxguillabert/Downloads/video/src/shorts/<short-name>/`
- **Public assets**: `/Users/maxguillabert/Downloads/video/public/shorts/<short-name>/`
- **Global chibis**: `/Users/maxguillabert/Downloads/chibis/`

## Architecture Pattern

Every short follows this structure (from short-01):

```
src/shorts/<name>/
├── <Name>Composition.tsx    # Root composition + audio layers
├── shots.ts                 # All shot definitions (ShotDef[])
├── types.ts                 # Type definitions
├── ShortContext.tsx          # Asset directory context provider
├── components/
│   ├── ShotRenderer.tsx     # Main shot orchestrator
│   ├── VoiceSyncChibi.tsx   # Chibi with voice-sync animation
│   ├── ChibiVfx.tsx         # Entrance/exit VFX
│   ├── ShotCaptions.tsx     # Word-highlighted captions
│   ├── ShotBackground.tsx   # Background renderer
│   ├── ShotTransition.tsx   # Transition effects
│   ├── ShotVfx.tsx          # Shot-level VFX overlays
│   ├── LightLeakOverlay.tsx # Light leak effect
│   ├── DuotoneOverlay.tsx   # Duotone color overlay
│   ├── AnimatedBg.tsx       # Animated background variants
│   ├── DataCallout.tsx      # Data overlay callouts
│   └── [custom components]  # Video-specific components
└── audio/
    ├── MoodMusic.tsx        # Multi-track mood music system
    └── Ambient.tsx          # Ambient background audio
```

## Production Standards

- **Resolution**: 1080x1920 (9:16 vertical)
- **FPS**: 30 (Remotion project standard)
- **Chibi size**: 1600px base
- **Caption Y position**: 550px from bottom
- **Font**: Montserrat Bold for captions
- **Background color base**: #0A0A0A

## Parallel Workstream Strategy

When producing a video, delegate these independent workstreams concurrently:

1. **Types** — Generate types.ts (no dependencies)
2. **Shots** — Generate shots.ts (depends on types, but can start mapping)
3. **Components** — Build component directory (depends on types)
4. **Audio** — Build audio system (independent)
5. **Assets** — Organize public/ assets (independent)

Convergence point: Root composition + ShortContext + Root.tsx registration (depends on all above).

## Input File Expectations

### direction.json
- `meta` — video metadata (title, duration, fps, resolution)
- `typography` — global font/color settings
- `shots[]` — array of shot objects with: id, scriptLine, startSec, endSec, durationSeconds, durationFrames, background, chibiEmotion, chibiAnimation, chibiEntrance, captionMode, wordHighlights, sfx, transitionIn, vfx, musicState, cameraMotion, colorPalette, callouts

### voice-timing.json
- Array of word objects: { word, start, end } with precise timestamps in seconds
- **CRITICAL**: Audio may be re-cut between runs — same sentences but micro-timing shifts.
  Always re-read voice-timing.json fresh on every production run. NEVER cache or reuse
  timings from a previous pass. Even sub-frame drift breaks lip-sync and caption alignment.

### direction-report.md
- Creative overview: narrative arc, color arc, music states, SFX palette, typography specs
- Used for creative context, not direct code generation
