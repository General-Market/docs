import type { SceneDefinition } from "../../../engine/types/scene";

export const forexIntroScene: SceneDefinition = {
  id: "forex-intro",
  lighting: "bright-morning",
  camera: {
    behaviors: [
      { type: "orbit", angleRange: [0.15, 0.3], radius: [3.2, 2.8], height: 1.5 },
      { type: "sway", amplitude: 0.015, speed: 0.02 },
      { type: "breathe", amplitude: 0.03 },
    ],
    lookAt: [0, 1.0, -0.3],
  },
  environment: { hasDesk: true },
  entities: [
    {
      id: "protagonist",
      prefab: "mixamo-character",
      transform: { position: [0.5, 0, 1.5], rotationY: Math.PI * 1.19 },
      animation: { clip: "weight-shift" },
      props: { characterKey: "casualMan", color: "#3B82F6" },
    },
    {
      id: "trader",
      prefab: "smart-character",
      transform: { position: [0.15, 0, 0.15], rotationY: Math.PI },
      animation: { clip: "Idle" },
    },
    {
      id: "desk",
      prefab: "trading-desk",
      transform: { position: [0, 0, 0] },
      props: {
        accentColor: "#00ff41",
        logoFile: "shorts/short-02/logos/forex-screen.png",
        logoText: "FOREX",
        primaryChart: "line",
        chartSeed: 100,
      },
    },
  ],
};
