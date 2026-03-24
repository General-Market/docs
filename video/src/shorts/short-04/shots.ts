import type { ShotDef } from "./types";

export const shots: ShotDef[] = [
  // Shot 1 — Flat snow terrain with floating props
  {
    id: 1,
    line: "",
    durationSeconds: 12,
    chibiEmotion: "content",
    chibiAnimation: "idle",
    background: { type: "solid", color: "#0A0A0A" },
    captionMode: "quiet",
    wordHighlights: [],
    sfx: [],
    transitionIn: "fade",
    transitionDuration: 15,
    musicState: "silence",
    customScenes: ["terrainWalker"],
    scenePhase: "walk",
    hideChibi: true,
  },

  // Shot 2 — Hillside / mountain slope, same character + props
  {
    id: 2,
    line: "",
    durationSeconds: 12,
    chibiEmotion: "content",
    chibiAnimation: "idle",
    background: { type: "solid", color: "#0A0A0A" },
    captionMode: "quiet",
    wordHighlights: [],
    sfx: [],
    transitionIn: "fade",
    transitionDuration: 20,
    musicState: "silence",
    customScenes: ["terrainWalker"],
    scenePhase: "hillside",
    hideChibi: true,
  },
];
