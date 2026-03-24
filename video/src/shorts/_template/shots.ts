// TEMPLATE — Copy /src/shorts/_template/ to /src/shorts/your-short/
// Then: replace __TEMPLATE__ with your short ID

import type { ShotDef, BackgroundDef } from "./types";
// import { COLORS } from "./types"; // uncomment when using COLORS in your shots

const BG_DARK_GRADIENT: BackgroundDef = {
  type: "gradient",
  gradientColors: ["#0A0A0A", "#1A1A2E"],
  gradientAngle: 180,
};

export const shots: ShotDef[] = [
  // Shot 1 ─ Hook
  {
    id: 1,
    isFirstShot: true,
    line: "Your hook line here.",
    durationSeconds: 3.0,
    chibiEmotion: "thumbsup",
    chibiAnimation: "bounce",
    chibiEntrance: "bottom",
    background: { ...BG_DARK_GRADIENT },
    captionMode: "shout",
    wordHighlights: [],
    sfx: [],
    transitionIn: "cut",
    musicState: "playing",
  },

  // Shot 2 ─ Follow-up
  {
    id: 2,
    line: "Second shot here.",
    durationSeconds: 2.0,
    chibiEmotion: "teaching",
    chibiAnimation: "idle",
    background: { ...BG_DARK_GRADIENT },
    captionMode: "shout",
    wordHighlights: [],
    sfx: [],
    transitionIn: "cut",
    musicState: "playing",
  },
];
