import type { SceneDefinition } from "../../../engine/types/scene";

export const polymarketScene: SceneDefinition = {
  id: "polymarket",
  lighting: "purple-twilight",
  camera: {
    behaviors: [
      { type: "dolly", zRange: [2.3, 2.9], xOffset: 0.6, height: [1.5, 1.65] },
      { type: "sway", amplitude: 0.015, speed: 0.015 },
      { type: "dutchTilt", maxAngle: 0.005, speed: 0.02 },
    ],
    lookAt: [0, 1.2, -1],
  },
  environment: { hasDesk: true },
  entities: [
    {
      id: "protagonist",
      prefab: "mixamo-character",
      transform: { position: [0.15, 0, 0.0], rotationY: Math.PI },
      animation: { clip: "thoughtful-head-nod" },
      props: { characterKey: "casualMan", color: "#3B82F6" },
    },
    {
      id: "desk",
      prefab: "trading-desk",
      transform: { position: [0, 0, 0] },
      props: {
        accentColor: "#7c3aed",
        logoFile: "shorts/short-02/logos/polymarket.png",
        logoText: "POLYMARKET",
        primaryChart: "line",
        chartSeed: 700,
      },
    },
  ],
};
