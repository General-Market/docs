// Slot types — shared shot-based composition system types
// Extracted from short-01/types.ts for cross-short reuse

export type ChibiEmotion =
  | "thumbsup"
  | "shrug"
  | "teaching"
  | "confident"
  | "thinking"
  | "proud"
  | "panic"
  | "idea"
  | "confused"
  | "scared"
  | "tired";

export const emotionToFile: Record<ChibiEmotion, string> = {
  thumbsup: "thumbsup.png",
  shrug: "shrug.png",
  teaching: "teaching.png",
  confident: "confident.png",
  thinking: "thinking.png",
  proud: "proud.png",
  panic: "panic.png",
  idea: "idea.png",
  confused: "confused.png",
  scared: "scared.png",
  tired: "tired.png",
};

export type ChibiAnimation =
  | "bounce"       // BounceSettle — spring overshoot landing
  | "snap"         // AnticipationDip — shrink before pop
  | "punch"        // SquashStretch — compress X, extend Y on hit
  | "zoom"         // ShadowPulse — zoom with shadow depth
  | "tilt"         // HeadTilt — alternating rotation emphasis
  | "shake"        // ShakeVibrate — noise-based lateral burst
  | "dim"          // Nod with fade — nod agreement + dim
  | "idle"         // FloatHover — gentle levitation bob
  | "wobble"       // Wobble/Jelly — wobbly deformation
  | "heartbeat"    // Heartbeat — double-pulse rhythm
  | "drift"        // EyeLineDrift — slow lateral sway
  | "blink";       // OpacityBlink — quick double-blink

export type BackgroundType =
  | "solid"
  | "gradient"
  | "image"
  | "video"
  | "split";

export interface BackgroundDef {
  type: BackgroundType;
  color?: string;
  // Gradient
  gradientColors?: [string, string];
  gradientAngle?: number;
  // Image / video
  src?: string;
  blur?: number;          // Gaussian blur px
  brightness?: number;    // 0-1, default 0.7
  tint?: string;          // Color overlay with opacity
  tintOpacity?: number;
  kenBurns?: boolean;     // Slow zoom 100% → 103%
  objectFit?: "cover" | "contain" | "fill"; // Default "cover"
  imageScale?: number;    // Scale the image (e.g. 0.35 for 35% of frame)
  scrollDown?: boolean;   // Scroll tall image from top to bottom over shot duration
  scrollSpeed?: number;   // 0-1: how much of the page to scroll through (default 0.6)
  // Split
  leftSrc?: string;
  rightSrc?: string;
  leftTint?: string;
  rightTint?: string;
  dividerColor?: string;
}

export type CaptionMode = "shout" | "quiet";

export interface WordHighlight {
  word: string;       // Match text (case-insensitive)
  color: string;      // Hex color
  scale?: number;     // 1.0 default, up to 1.4
  glow?: boolean;     // Outer glow
  holdFrames?: number; // Extra frames before advancing
}

export interface SFXCue {
  frame: number;        // Relative to shot start
  file: string;         // Filename in sfx dir
  volume?: number;      // 0-1
}

export type TransitionIn =
  | "cut"           // Hard cut (default)
  | "fade"          // Fade from black
  | "zoom"          // Zoom transition
  | "whip"          // Whip pan
  | "glitch"        // Glitch tear
  | "morph";        // Content morphs

export interface DataCalloutDef {
  text: string;         // "$1.175B", "$0", "800M ANALYSTS"
  color: string;        // Hex
  glow?: boolean;
  glowColor?: string;
  scale?: number;       // Starting scale for slam (e.g. 1.8 → 1.2)
  targetScale?: number;
  yOffset?: number;     // Vertical position offset
  delayFrames?: number; // Delay before appearing
  hideAfterFrames?: number; // Frames after delay to start fade-out (disappears)
  instant?: boolean;    // Show at full opacity/targetScale from frame 0 (no spring)
}

export type ChibiEntrance =
  | "bottom"      // Slide up from below (default)
  | "left"        // Slide in from left
  | "right"       // Slide in from right
  | "top"         // Drop in from above
  | "none";       // No chibi on this shot

// Chibi entrance VFX — visual effects on arrival
// "auto" picks based on entrance direction (bottom→dust, left/right→speed-lines, top→glow-ring)
export type ChibiEntranceVfx =
  | "auto"         // Auto-select from entrance direction
  | "dust"         // Impact dust puff at landing
  | "speed-lines"  // Directional motion streaks
  | "glow-ring"    // Expanding light ring
  | "ghost-trail"  // Fading afterimages
  | "none";        // No VFX

// Chibi exit style — how chibi disappears at end of shot
// "auto" picks "fade" by default
export type ChibiExitStyle =
  | "auto"         // Default: "fade"
  | "poof"         // Shrink + dust burst
  | "slide-out"    // Reverse of entrance direction
  | "fade"         // Scale down + opacity fade
  | "snap-vanish"  // Quick squash Y→0 + flash
  | "none";        // Just disappear (current behavior)

// Chibi zoom drift — persistent slow zoom or dezoom that holds
export type ChibiZoomDrift =
  | "zoom-in"      // Slowly zoom in and hold (1.0 → 1.08)
  | "zoom-out"     // Slowly zoom out and hold (1.0 → 0.93)
  | "none";

// Full-screen zoom drift — slow continuous zoom on the entire frame
export type FullScreenZoom =
  | "in"            // Slowly zoom in (1.0 → 1.05)
  | "out";          // Slowly zoom out (1.05 → 1.0)

// Camera tilt — slow rotation drift (0 → ±0.5°)
export type CameraTilt = "cw" | "ccw";

// Camera drift — slow horizontal pan (±10px over shot)
export type CameraDrift = "left" | "right";

// Camera vertical drift — slow vertical pan (±80px over shot)
export type CameraVerticalDrift = "up" | "down";

// Letterbox — cinematic bars slide in from top/bottom
export interface LetterboxDef {
  delay?: number;     // Frames before bars start (default 0)
  height?: number;    // Bar height in px (default 90)
}

// Focus pull — blur transition over the shot
export type FocusPull = "sharpen" | "soften";

// Color temperature shift — warm↔cool drift
export type ColorShift = "warm-to-cool" | "cool-to-warm";

// Breathing pulse — cyclical micro-scale oscillation (~2s period)
// boolean — just on/off

// Multi-expression sequence within a shot
export interface ChibiExpression {
  emotion: ChibiEmotion;
  /** Frame offset within the shot to switch to this expression */
  atFrame: number;
}

// Rain cloud above chibi
export interface ChibiRainCloud {
  intensity?: number;    // 0-1, density of raindrops (default 0.7)
  color?: string;        // Rain/cloud color (default "#8899aa")
  delay?: number;        // Frames before cloud appears
  lightning?: boolean;   // Quick flash inside cloud
}

// Architecture diagram types
export interface ArchDiagramNode {
  id: string;
  label: string;
  subtitle: string;
  color: string;
}

export interface ArchDiagramEdge {
  from: string;
  to: string;
  label?: string;
  curved?: boolean;
}

export interface ArchDiagramTiming {
  nodeEntranceDuration: number; // frames for each node's spring entrance
  nodeStagger: number;          // frames between each node start
  edgeDelay: number;            // frames after source node entrance before edge draws
  edgeDrawDuration: number;     // frames for edge stroke draw-in
  particleDelay: number;        // frames after edge draw before particle starts
}

export interface ArchitectureDiagramConfig {
  nodes: ArchDiagramNode[];
  edges: ArchDiagramEdge[];
  timing?: Partial<ArchDiagramTiming>;
  light?: boolean; // White background, dark text (fintech whitepaper style)
  topPad?: number;       // Override default 300px top padding
  nodeScale?: number;    // Scale all nodes/edges (default 1.0)
  transparentBg?: boolean; // Don't render opaque bg (let shot background show through)
  instant?: boolean;     // Skip all entrance animations (diagram appears fully built)
  headerLogo?: {         // Centered logo image above diagram nodes
    src: string;         // staticFile path (e.g. "shorts/short-03/logos/ecb.png")
    width?: number;      // Default 280
    topY?: number;       // Y position (default 200)
    label?: string;      // Text label below logo (e.g. "European Central Bank")
    labelSize?: number;  // Font size (default 28)
    labelColor?: string; // Font color (default "#1a1a2e")
  };
}

// Animated background variant types
export type AnimatedBgVariant =
  | "particles"
  | "matrix"
  | "grid"
  | "waves"
  | "radial"
  | "trading"
  | "bokeh";

// Shot VFX overlay — adapted from LogoAnimations
export type ShotVfxVariant =
  | "glitch"       // RGB split + scanlines + flicker (from LogoGlitch)
  | "speed-lines"  // Horizontal light trails (from LogoLightTrail)
  | "ink-splash"   // Burst particles on impact (from LogoStamp)
  | "neon-glow";   // Atmospheric neon flicker (from LogoNeonSign)

export interface ShotDef {
  id: number;
  line: string;                 // Script text for this shot
  durationSeconds: number;
  chibiEmotion: ChibiEmotion;
  chibiAnimation: ChibiAnimation;
  chibiEntrance?: ChibiEntrance;  // Direction chibi enters from (default: "bottom")
  chibiDelay?: number;            // Frames to wait before chibi appears
  background: BackgroundDef;
  animatedBg?: AnimatedBgVariant; // Animated background overlay variant
  animatedBgColor?: string;       // Accent color for animated bg
  architectureDiagram?: ArchitectureDiagramConfig; // SVG architecture schematic overlay
  captionMode: CaptionMode;
  wordHighlights: WordHighlight[];
  sfx: SFXCue[];
  transitionIn: TransitionIn;
  transitionDuration?: number;  // Frames for transition (default 9)
  // Special components
  dataCallout?: DataCalloutDef;
  secondaryCallout?: DataCalloutDef;
  callouts?: DataCalloutDef[];      // Multiple timed callouts (with hideAfterFrames for sequencing)
  splitScreen?: boolean;
  barChart?: boolean;
  morph?: boolean;
  ghostLogos?: boolean;
  rankings?: "naruto-views" | "top-20" | "jojo-cliffhanger";
  fandomScroll?: boolean;        // Fandom wiki auto-scroll background
  brollMosaic?: {                // Zoom-out to 3x3 b-roll mosaic
    triggerFrame: number;         // Frame within shot to start zoom-out
    videos: string[];             // 9 video filenames in backgrounds/
  };
  screenBreak?: boolean;        // Glass-shatter intro effect
  sneakyCEO?: boolean;          // Sneaky CEO peeking animation
  miniPersona?: {
    variant: "analyst" | "gamer" | "fan" | "trader" | "naruto-fan";
    bubbleText: string;
    position?: "top-left" | "top-right" | "mid-left" | "mid-right";
    delay?: number;
    bubbleDelay?: number;
  };
  impactScene?: "forty-million" | "visits" | "billion-rain" | "zero-crack";
  crowdVisualization?: boolean;   // 600M analysts crowd visualization
  tradingFloor?: boolean;         // 3D trading floor scene (shot 27)
  moneyExplosion?: boolean;       // 3D money explosion (shot 2)
  crunchyrollReveal?: boolean;   // Big Crunchyroll logo slam-in effect
  floatingLogos?: boolean;        // Floating crypto token logos overlay
  stablecoinCards?: boolean;      // CoinGecko-style stablecoin decline cards
  projectShowcase?: boolean;      // Shot 1: 7 project cards scrolling
  projectDataCard?: {             // CoinGecko-style data card replacing chibi
    name: string;
    ticker: string;
    logo: string;                 // filename in logos/
    color: string;
    category: string;             // e.g. "FHE Privacy", "Bitcoin L2"
    pricePath: number[];          // 30 data points for mini chart
    pricePrefix?: string;         // "$" or "" (default "$")
    priceDecimals?: number;       // decimal places (default 4)
    badgeLogo?: string;           // optional secondary badge logo (e.g. "ecb.png")
  };
  // Shot-specific visual data (replaces shot-ID checks in ShotRenderer)
  emojiRain?: { frame: number; emojis: string[] }[];
  speedLines?: { frame: number }[];
  barChartVariant?: "1in3" | "1in4-compare";
  morphToColor?: string;
  isFirstShot?: boolean;
  customScenes?: string[];
  questionStack?: {              // Stacking question list (shots 29-31)
    items: { text: string; color: string; icon?: string }[];
    activeCount: number;
  };
  compoundingList?: {             // Animated compounding bullet list (shots 3-6)
    items: { text: string; color: string; icon?: string }[];
    activeCount: number;
  };
  hideCaptions?: boolean;        // Hide bottom captions (use title callouts instead)
  // Music state
  musicState: "playing" | "building" | "ducked" | "silence" | "bass-drop";
  musicDb?: number;             // Volume in dB relative to base
  // Chibi VFX (auto-defaults if omitted)
  chibiEntranceVfx?: ChibiEntranceVfx;   // Visual effect on entrance (default: "auto")
  chibiExit?: ChibiExitStyle;            // Exit animation (default: "auto")
  chibiZoomDrift?: ChibiZoomDrift;       // Persistent slow zoom/dezoom
  chibiRainCloud?: ChibiRainCloud;       // Rain cloud above chibi
  chibiExpressions?: ChibiExpression[];  // Multi-expression sequence (overrides chibiEmotion)
  chibiFlipY?: boolean;                  // Mirror chibi horizontally (scaleX: -1)
  // Shot VFX overlay
  shotVfx?: ShotVfxVariant;
  shotVfxColor?: string;    // Accent color for the VFX (defaults to shot's accent)
  shotVfxDelay?: number;    // Delay frames before VFX starts
  // Full-screen camera effects
  fullScreenZoom?: FullScreenZoom;
  cameraTilt?: CameraTilt;
  cameraDrift?: CameraDrift;
  cameraVerticalDrift?: CameraVerticalDrift;
  letterbox?: LetterboxDef | boolean;
  focusPull?: FocusPull;
  colorShift?: ColorShift;
  breathingPulse?: boolean;
  // Effects
  screenShake?: { amplitude: number; duration: number };
  flash?: boolean;
  duotone?: boolean | { baseHue?: number; speed?: number };
  lightLeak?: boolean | { delay?: number; intensity?: number };
  // Caption text override (if different from line)
  captionOverride?: string[];   // Array of words to show (for data callout shots)
  // Per-shot voice segments — slices of voice.mp3 this shot plays.
  // Enables cutting words from a shot without cascading to other shots.
  voiceSegments?: VoiceSegment[];
}

// Per-shot voice segment — defines a slice of voice.mp3 to play.
export interface VoiceSegment {
  startMs: number;
  endMs: number;
}

// Audio silence windows for Short01Music
export interface SilenceWindow {
  startFrame: number;
  endFrame: number;
}

// Color constants from the production notes
export const COLORS = {
  BG_BASE: "#0A0A0A",
  TEXT_PRIMARY: "#FFFFFF",
  MONEY_YELLOW: "#FFE500",
  PAIN_RED: "#FF3333",
  GROWTH_GREEN: "#00FF88",
  ACCENT_BLUE: "#00D4FF",
  REDDIT_ORANGE: "#FF4500",
  BLOOMBERG_GREEN: "#00FF41",
  NARUTO_ORANGE: "#FF6B00",
  JOJO_PURPLE: "#7B2D8E",
  CRUNCHYROLL_ORANGE: "#F47521",
} as const;

// Layout constants from screen layout spec
export const LAYOUT = {
  WIDTH: 1080,
  HEIGHT: 1920,
  TOP_SAFE: 288,
  BOTTOM_SAFE: 672,
  RIGHT_MARGIN: 192,
  CHIBI_SIZE: 1600,
  CHIBI_BOTTOM_Y: 900,
  CAPTION_Y: 550,
  FPS: 30,
} as const;

// Shared slot props interface — all slots receive at minimum:
export interface SlotProps {
  shot: ShotDef;
  globalFrameOffset: number;
  captions?: import("../lib/types").Caption[];
  prevShotEmotion?: string;
  nextShotEmotion?: string;
  prevProjectTicker?: string;
  voiceSegments?: VoiceSegment[];
}
