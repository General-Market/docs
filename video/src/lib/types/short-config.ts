export type CaptionStylePreset = "bold-stroke" | "minimal" | "neon" | "indexmaker";

export interface ShortConfig {
  id: string;
  title: string;
  voicePath: string;
  captionsPath: string;
  scenePlanPath: string;
  musicPath: string;
  musicAnalysisPath: string;
  chibiDir: string;
  sfxDir: string;
  fps: 30;
  width: 1080;
  height: 1920;
  captionStyle?: CaptionStylePreset;
  watermarkText?: string;
}
