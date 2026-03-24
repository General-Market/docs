export interface Caption {
  text: string;
  startMs: number;
  endMs: number;
  confidence: number;
  timestampMs: number;
}

export interface CaptionPage {
  words: Caption[];
  startFrame: number;
  endFrame: number;
}
