// stonecutter — "The Trader's Stonecutter"
// Extended emotion set for trading parable narrative

export type ChibiEmotion =
  | "content"
  | "impressed"
  | "envious"
  | "determined"
  | "confident"
  | "curious"
  | "smug"
  | "proud"
  | "mesmerized"
  | "excited"
  | "victorious"
  | "shocked"
  | "defeated"
  | "manic"
  | "frustrated"
  | "exasperated"
  | "scheming"
  | "hopeful"
  | "crushed"
  | "resigned"
  | "wise";

// Map extended emotions → existing chibi PNGs (short-01 asset set)
export const emotionToFile: Record<ChibiEmotion, string> = {
  content:     "thumbsup.png",   // calm satisfaction
  impressed:   "idea.png",       // wide-eyed wonder
  envious:     "confused.png",   // covetous disbelief
  determined:  "confident.png",  // locked-in resolve
  confident:   "confident.png",  // same
  curious:     "thinking.png",   // inquisitive
  smug:        "shrug.png",      // know-it-all
  proud:       "proud.png",      // same
  mesmerized:  "idea.png",       // sparkle-eyed awe
  excited:     "excited.png",    // fist-pump high energy
  victorious:  "excited.png",    // triumphant fist-pump
  shocked:     "panic.png",      // step-back surprise
  defeated:    "tired.png",      // slumped
  manic:       "excited.png",    // wild-eyed intensity
  frustrated:  "confused.png",   // gritted teeth
  exasperated: "tired.png",      // face-palm fatigue
  scheming:    "scheming.png",   // sly chin-stroke calculation
  hopeful:     "idea.png",       // soft optimism
  crushed:     "scared.png",     // broken
  resigned:    "tired.png",      // acceptance
  wise:        "teaching.png",   // knowing calm
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

export type TransitionIn = "cut" | "fade" | "zoom" | "whip" | "glitch" | "morph" | "blinds" | "circleWipe" | "diagonalSlice" | "zoomBlur" | "flash";

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
  duotone?: boolean | { colors?: [string, string]; opacity?: number };
  lightLeak?: boolean | { delay?: number; intensity?: number; color?: string };
  captionOverride?: string[];
  emojiRain?: { frame: number; emojis: string[] }[];
  speedLines?: { frame: number }[];
  barChartVariant?: "1in3" | "1in4-compare";
  morphToColor?: string;
  isFirstShot?: boolean;
  customScenes?: string[];
  scenePhase?: string;
  hideChibi?: boolean;
}

export interface SilenceWindow {
  startFrame: number;
  endFrame: number;
}

// Color palette — warm browns bookend, golden finance, orange BTC, dark corporate
export const COLORS = {
  BG_BASE: "#0A0A0A",
  TEXT_PRIMARY: "#f4f1e9",
  ACCENT_1: "#eccb56",     // yellow keywords
  ACCENT_2: "#f7931a",     // BTC orange
  ACCENT_3: "#7c3aed",     // Polymarket purple
  ACCENT_4: "#00ff41",     // memecoin neon green
  CORPORATE: "#031528",    // Goldman/hedge fund dark blue
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
