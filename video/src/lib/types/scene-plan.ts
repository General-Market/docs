export type Emotion =
  | "neutral"
  | "excited"
  | "confused"
  | "panicking"
  | "happy"
  | "sad"
  | "angry";

export type TransitionType = "flash-cut" | "zoom-out" | "whoosh-slide" | "cross-fade";

export interface Segment {
  id: string;
  startMs: number;
  endMs: number;
  emotion: Emotion;
  text: string;
  keywords: string[];
  isPunchline: boolean;
  energyLevel: number; // 0-1
  transition?: TransitionType;
}

export interface ScenePlan {
  shortId: string;
  segments: Segment[];
  totalDurationMs: number;
}
