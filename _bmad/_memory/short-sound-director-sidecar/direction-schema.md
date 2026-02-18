# Direction Schema — shots.ts-Compatible Structure

The direction.json output must conform to this schema so the video builder agent
can consume it directly as a `ShotDef[]` array.

## Top-Level Structure

```json
{
  "fps": 30,
  "totalDurationSeconds": 0,
  "totalFrames": 0,
  "colors": {},
  "backgroundPresets": {},
  "shots": []
}
```

## Shot Definition (ShotDef)

Each shot maps 1:1 to a script sentence.

```typescript
interface ShotDef {
  // ─── Core ───
  id: number;                    // Sequential, 1-based
  line: string;                  // Script sentence text
  durationSeconds: number;       // From voice timing
  isFirstShot?: boolean;         // true for shot 1

  // ─── Chibi ───
  chibiEmotion: ChibiEmotion;
  chibiAnimation: ChibiAnimation;
  chibiEntrance?: ChibiEntrance;     // "bottom" | "left" | "right" | "top" | "none"
  chibiDelay?: number;               // Frames before chibi appears
  chibiEntranceVfx?: ChibiEntranceVfx; // "auto" | "dust" | "speed-lines" | "glow-ring" | "ghost-trail" | "none"
  chibiExit?: ChibiExitStyle;        // "auto" | "poof" | "slide-out" | "fade" | "snap-vanish" | "none"
  chibiZoomDrift?: ChibiZoomDrift;   // "zoom-in" | "zoom-out" | "none"
  chibiFlipY?: boolean;              // Mirror horizontally
  chibiExpressions?: ChibiExpression[]; // Multi-expression sequence
  chibiRainCloud?: ChibiRainCloud;   // Rain cloud effect

  // ─── Background ───
  background: BackgroundDef;
  animatedBg?: AnimatedBgVariant;    // "particles" | "matrix" | "grid" | "waves" | "radial" | "trading" | "bokeh"
  animatedBgColor?: string;          // Hex color

  // ─── Captions ───
  captionMode: CaptionMode;         // "shout" | "quiet"
  wordHighlights: WordHighlight[];
  hideCaptions?: boolean;
  captionOverride?: string[];

  // ─── SFX ───
  sfx: SFXCue[];                     // Frame-precise sound triggers

  // ─── Transitions ───
  transitionIn: TransitionIn;        // "cut" | "fade" | "zoom" | "whip" | "glitch" | "morph"
  transitionDuration?: number;       // Frames (default 9)

  // ─── Data Callouts ───
  dataCallout?: DataCalloutDef;
  secondaryCallout?: DataCalloutDef;
  callouts?: DataCalloutDef[];       // Multiple timed callouts

  // ─── Music ───
  musicState: MusicState;            // "playing" | "building" | "ducked" | "silence" | "bass-drop"
  musicDb?: number;                  // Volume relative to base

  // ─── Shot VFX ───
  shotVfx?: ShotVfxVariant;          // "glitch" | "speed-lines" | "ink-splash" | "neon-glow"
  shotVfxColor?: string;
  shotVfxDelay?: number;

  // ─── Camera ───
  fullScreenZoom?: FullScreenZoom;   // "in" | "out"
  cameraTilt?: CameraTilt;           // "cw" | "ccw"
  cameraDrift?: CameraDrift;         // "left" | "right"
  letterbox?: LetterboxDef | boolean;
  focusPull?: FocusPull;             // "sharpen" | "soften"
  colorShift?: ColorShift;           // "warm-to-cool" | "cool-to-warm"
  breathingPulse?: boolean;

  // ─── Effects ───
  screenShake?: { amplitude: number; duration: number };
  flash?: boolean;
  duotone?: boolean | { baseHue?: number; speed?: number };
  lightLeak?: boolean | { delay?: number; intensity?: number };
  screenBreak?: boolean;

  // ─── Special Components ───
  splitScreen?: boolean;
  barChart?: boolean;
  morph?: boolean;
  ghostLogos?: boolean;
  emojiRain?: { frame: number; emojis: string[] }[];
  speedLines?: { frame: number }[];
}
```

## Sub-Types

### ChibiEmotion
`"thumbsup" | "shrug" | "teaching" | "confident" | "thinking" | "proud" | "panic" | "idea" | "confused" | "scared" | "tired"`

### ChibiAnimation
`"bounce" | "snap" | "punch" | "zoom" | "tilt" | "shake" | "dim" | "idle" | "wobble" | "heartbeat" | "drift" | "blink"`

### BackgroundDef
```json
{
  "type": "solid" | "gradient" | "image" | "split",
  "color": "#hex",
  "gradientColors": ["#hex1", "#hex2"],
  "gradientAngle": 180,
  "src": "path/to/image.jpg",
  "blur": 0,
  "brightness": 0.7,
  "tint": "#hex",
  "tintOpacity": 0.3,
  "kenBurns": false,
  "objectFit": "cover" | "contain",
  "imageScale": 1.0
}
```

For direction.json, use `"src": "[DESCRIBE: dark trading floor with green monitors]"` format
when specifying images to source. The video builder agent resolves descriptions to actual files.

### WordHighlight
```json
{
  "word": "text",
  "color": "#hex",
  "scale": 1.3,
  "glow": true,
  "holdFrames": 5
}
```

### SFXCue
```json
{
  "frame": 0,
  "file": "[DESCRIBE: cinematic boom impact]",
  "volume": 0.8
}
```

For direction.json, use descriptive strings when exact files are unknown.
The video builder agent maps descriptions to actual SFX files.

### DataCalloutDef
```json
{
  "text": "$1.2B",
  "color": "#FFE500",
  "glow": true,
  "glowColor": "#FFE500",
  "scale": 2.0,
  "targetScale": 1.2,
  "yOffset": 0,
  "delayFrames": 10,
  "hideAfterFrames": 60
}
```

## Color Constants (defaults)

```json
{
  "BG_BASE": "#0A0A0A",
  "TEXT_PRIMARY": "#FFFFFF",
  "MONEY_YELLOW": "#FFE500",
  "PAIN_RED": "#FF3333",
  "GROWTH_GREEN": "#00FF88",
  "ACCENT_BLUE": "#00D4FF"
}
```

Override with reference video's palette when available from color_analysis.json.

## Layout Constants

```json
{
  "WIDTH": 1080,
  "HEIGHT": 1920,
  "FPS": 30
}
```

## Direction Rules

1. Every shot MUST have: id, line, durationSeconds, chibiEmotion, chibiAnimation, background, captionMode, wordHighlights (can be []), sfx (can be []), transitionIn, musicState
2. First shot MUST have `isFirstShot: true`
3. durationSeconds comes from voice-timing.json (not estimated)
4. Background descriptions start with `[DESCRIBE: ...]` for the video builder to resolve
5. SFX files start with `[DESCRIBE: ...]` when exact file is unknown
6. Word highlights: pick 1-3 key words per shot, never highlight everything
7. Music state transitions should follow narrative arc: playing → building → bass-drop → ducked → playing
