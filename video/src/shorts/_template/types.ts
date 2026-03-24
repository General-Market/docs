// TEMPLATE — Copy /src/shorts/_template/ to /src/shorts/your-short/
// Then: replace __TEMPLATE__ with your short ID

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
  | "bounce"
  | "snap"
  | "punch"
  | "zoom"
  | "tilt"
  | "shake"
  | "dim"
  | "idle"
  | "wobble"
  | "heartbeat"
  | "drift"
  | "blink";

export type BackgroundType = "solid" | "gradient" | "image" | "video" | "split";

export interface BackgroundDef {
  type: BackgroundType;
  color?: string;
  gradientColors?: [string, string];
  gradientAngle?: number;
  src?: string;
  blur?: number;
  brightness?: number;
  tint?: string;
  tintOpacity?: number;
  kenBurns?: boolean;
  objectFit?: "cover" | "contain";
  imageScale?: number;
  leftSrc?: string;
  rightSrc?: string;
  leftTint?: string;
  rightTint?: string;
  dividerColor?: string;
}

export type CaptionMode = "shout" | "quiet";

export interface WordHighlight {
  word: string;
  color: string;
  scale?: number;
  glow?: boolean;
  holdFrames?: number;
}

export interface SFXCue {
  frame: number;
  file: string;
  volume?: number;
}

export type TransitionIn = "cut" | "fade" | "zoom" | "whip" | "glitch" | "morph";

export interface DataCalloutDef {
  text: string;
  color: string;
  glow?: boolean;
  glowColor?: string;
  scale?: number;
  targetScale?: number;
  yOffset?: number;
  delayFrames?: number;
  hideAfterFrames?: number;
}

export type ChibiEntrance = "bottom" | "left" | "right" | "top" | "none";
export type ChibiEntranceVfx = "auto" | "dust" | "speed-lines" | "glow-ring" | "ghost-trail" | "none";
export type ChibiExitStyle = "auto" | "poof" | "slide-out" | "fade" | "snap-vanish" | "none";
export type ChibiZoomDrift = "zoom-in" | "zoom-out" | "none";
export type FullScreenZoom = "in" | "out";
export type CameraTilt = "cw" | "ccw";
export type CameraDrift = "left" | "right";

export interface LetterboxDef {
  delay?: number;
  height?: number;
}

export type FocusPull = "sharpen" | "soften";
export type ColorShift = "warm-to-cool" | "cool-to-warm";

export interface ChibiExpression {
  emotion: ChibiEmotion;
  atFrame: number;
}

export interface ChibiRainCloud {
  intensity?: number;
  color?: string;
  delay?: number;
  lightning?: boolean;
}

export type AnimatedBgVariant = "particles" | "matrix" | "grid" | "waves" | "radial" | "trading" | "bokeh";
export type ShotVfxVariant = "glitch" | "speed-lines" | "ink-splash" | "neon-glow";

export interface ShotDef {
  id: number;
  line: string;
  durationSeconds: number;
  chibiEmotion: ChibiEmotion;
  chibiAnimation: ChibiAnimation;
  chibiEntrance?: ChibiEntrance;
  chibiDelay?: number;
  background: BackgroundDef;
  animatedBg?: AnimatedBgVariant;
  animatedBgColor?: string;
  captionMode: CaptionMode;
  wordHighlights: WordHighlight[];
  sfx: SFXCue[];
  transitionIn: TransitionIn;
  transitionDuration?: number;
  dataCallout?: DataCalloutDef;
  secondaryCallout?: DataCalloutDef;
  callouts?: DataCalloutDef[];
  splitScreen?: boolean;
  barChart?: boolean;
  morph?: boolean;
  ghostLogos?: boolean;
  rankings?: string;
  screenBreak?: boolean;
  miniPersona?: {
    variant: string;
    bubbleText: string;
    position?: "top-left" | "top-right" | "mid-left" | "mid-right";
    delay?: number;
    bubbleDelay?: number;
  };
  impactScene?: string;
  questionStack?: {
    items: { text: string; color: string; icon?: string }[];
    activeCount: number;
  };
  compoundingList?: {
    items: { text: string; color: string; icon?: string }[];
    activeCount: number;
  };
  hideCaptions?: boolean;
  musicState: "playing" | "building" | "ducked" | "silence" | "bass-drop";
  musicDb?: number;
  chibiEntranceVfx?: ChibiEntranceVfx;
  chibiExit?: ChibiExitStyle;
  chibiZoomDrift?: ChibiZoomDrift;
  chibiRainCloud?: ChibiRainCloud;
  chibiExpressions?: ChibiExpression[];
  chibiFlipY?: boolean;
  shotVfx?: ShotVfxVariant;
  shotVfxColor?: string;
  shotVfxDelay?: number;
  fullScreenZoom?: FullScreenZoom;
  cameraTilt?: CameraTilt;
  cameraDrift?: CameraDrift;
  letterbox?: LetterboxDef | boolean;
  focusPull?: FocusPull;
  colorShift?: ColorShift;
  breathingPulse?: boolean;
  screenShake?: { amplitude: number; duration: number };
  flash?: boolean;
  duotone?: boolean | { baseHue?: number; speed?: number };
  lightLeak?: boolean | { delay?: number; intensity?: number };
  captionOverride?: string[];
  // Shot-specific visual data
  emojiRain?: { frame: number; emojis: string[] }[];
  speedLines?: { frame: number }[];
  barChartVariant?: "1in3" | "1in4-compare";
  morphToColor?: string;
  isFirstShot?: boolean;
  customScenes?: string[];
}

export interface SilenceWindow {
  startFrame: number;
  endFrame: number;
}

// TODO: Set your short's color palette
export const COLORS = {
  BG_BASE: "#0A0A0A",
  TEXT_PRIMARY: "#FFFFFF",
  ACCENT_1: "#00D4FF",
  ACCENT_2: "#FFE500",
  ACCENT_3: "#FF3333",
  ACCENT_4: "#00FF88",
} as const;

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
