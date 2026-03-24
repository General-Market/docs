// short-04 — "Terrain Walker"
// Character walks forward on deforming terrain with floating props drifting in the air

export type ChibiEmotion = "content";
export type ChibiAnimation = "idle";
export type BackgroundType = "solid";
export type CaptionMode = "quiet";
export type TransitionIn = "cut" | "fade";

export interface BackgroundDef {
  type: BackgroundType;
  color?: string;
}

export interface WordHighlight {
  word: string;
  color: string;
}

export interface SFXCue {
  frame: number;
  file: string;
  volume?: number;
}

export interface ShotDef {
  id: number;
  line: string;
  durationSeconds: number;
  chibiEmotion: ChibiEmotion;
  chibiAnimation: ChibiAnimation;
  background: BackgroundDef;
  captionMode: CaptionMode;
  wordHighlights: WordHighlight[];
  sfx: SFXCue[];
  transitionIn: TransitionIn;
  transitionDuration?: number;
  musicState: "playing" | "silence";
  customScenes?: string[];
  scenePhase?: string;
  hideChibi?: boolean;
  fullScreenZoom?: "in" | "out";
}

export const COLORS = {
  BG_BASE: "#0A0A0A",
  TEXT_PRIMARY: "#f4f1e9",
  ACCENT_1: "#eccb56",
  ACCENT_2: "#8B5CF6",
} as const;

export const LAYOUT = {
  WIDTH: 1080,
  HEIGHT: 1920,
  FPS: 30,
} as const;
