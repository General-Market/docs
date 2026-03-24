import type { Emotion } from "../../types";

// ─── Position ─────────────────────────────────────────────────────────

export type CharacterPosition =
  | "bottom-left"
  | "bottom-center"
  | "bottom-right"
  | "center-left"
  | "center-right"
  | "top-left"
  | "top-right";

// ─── Bubble ───────────────────────────────────────────────────────────

export type BubbleType = "thought" | "speech" | "none";

export type BubblePosition = "above-left" | "above-right" | "auto";

export interface BubbleConfig {
  type: BubbleType;
  text: string;
  /** Frame delay before bubble appears (relative to character entrance) */
  delay?: number;
  /** Duration in frames the bubble stays visible (0 = forever) */
  duration?: number;
  maxWidth?: number;
  fontSize?: number;
  accentColor?: string;
  /** Enable typewriter effect for speech bubbles */
  typewriter?: boolean;
  /** Override auto-resolved bubble position */
  bubblePosition?: BubblePosition;
}

// ─── Animation ────────────────────────────────────────────────────────

export interface AnimationConfig {
  /** Enable spring pop-in entrance (default true) */
  entrance?: boolean;
  /** Frame to start entrance (default 6) */
  entranceFrame?: number;
  /** Enable beat-synced pulse */
  beatPulse?: boolean;
  /** Beat pulse intensity (default 0.06) */
  beatIntensity?: number;
  /** Enable idle breathing/sway (default true) */
  idle?: boolean;
  /** Enable exit animation */
  exit?: boolean;
  /** Frame to trigger exit */
  exitFrame?: number;
}

// ─── Character Preset ─────────────────────────────────────────────────

export interface CharacterPreset {
  id: string;
  name: string;
  /** Directory inside public/ containing emotion PNGs */
  assetDir: string;
  /** Map emotion names to PNG filenames (defaults to `${emotion}.png`) */
  emotionMap?: Partial<Record<Emotion, string>>;
  defaultEmotion?: Emotion;
  defaultSize?: number;
  accentColor?: string;
  glowColor?: string;
  shadow?: boolean;
}

// ─── Inline Character ─────────────────────────────────────────────────

export interface InlineCharacter {
  id: string;
  assetDir: string;
  accentColor?: string;
  defaultSize?: number;
  emotionMap?: Partial<Record<Emotion, string>>;
}

// ─── Main Props ───────────────────────────────────────────────────────

export interface CharacterDisplayProps {
  /** Preset ID string or inline character config */
  character: string | InlineCharacter;
  /** Current emotion (default: "neutral") */
  emotion?: Emotion;
  /** Screen position (default: "bottom-center") */
  position?: CharacterPosition;
  /** Character render size in px (default: 750) */
  size?: number;
  /** Beat frames for pulse sync */
  beatFrames?: number[];
  /** Bubble configuration */
  bubble?: BubbleConfig;
  /** Animation overrides */
  animation?: AnimationConfig;
  /** Extra style on the root container */
  style?: React.CSSProperties;
}
