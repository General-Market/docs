import type { ShortConfig } from "../../lib/types";

export const config: ShortConfig = {
  id: "example",
  title: "Example Short",
  voicePath: "shorts/example/voice.wav",
  captionsPath: "shorts/example/captions.json",
  scenePlanPath: "shorts/example/scene-plan.json",
  musicPath: "shorts/example/music.mp3",
  musicAnalysisPath: "shorts/example/music_analysis.json",
  chibiDir: "shorts/example/chibis",
  sfxDir: "shorts/example/sfx",
  fps: 30,
  width: 1080,
  height: 1920,
  captionStyle: "indexmaker",
  watermarkText: "@indexmaker",
};
