import type { SceneDefinition } from "../../../engine/types/scene";

export const forexScene: SceneDefinition = {
  id: "forex",
  lighting: "bright-morning-sun",
  camera: {
    behaviors: [
      { type: "orbit", angleRange: [0.8, 0.3], radius: [2.2, 1.9], height: [1.4, 1.55] },
    ],
    lookAt: [-0.1, 1.2, -1],
  },
  environment: { hasDesk: true },
  entities: [
    {
      id: "protagonist",
      prefab: "mixamo-character",
      transform: { position: [0.15, 0, 0.0], rotationY: Math.PI },
      animation: { clip: "weight-shift" },
      props: { characterKey: "casualMan", color: "#3B82F6" },
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
