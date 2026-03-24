import type { SceneDefinition } from "../../../engine/types/scene";

export const stocksIntroScene: SceneDefinition = {
  id: "stocks-intro",
  lighting: "bright-midday",
  camera: {
    behaviors: [
      { type: "orbit", angleRange: [0.1, 0.4], radius: [3.2, 2.8], height: 1.5 },
      { type: "sway", amplitude: 0.015, speed: 0.03 },
      { type: "breathe", amplitude: 0.03 },
    ],
    lookAt: [-0.1, 1.0, -0.5],
  },
  environment: { hasDesk: true },
  entities: [
    {
      id: "protagonist",
      prefab: "mixamo-character",
      transform: { position: [0.4, 0, 1.3], rotationY: Math.PI * 0.85 },
      animation: { clip: "hands-forward-gesture" },
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
        accentColor: "#3B82F6",
        logoFile: "shorts/short-02/logos/bloomberg-logo.png",
        logoText: "SPY",
        primaryChart: "candlestick",
        chartSeed: 200,
      },
    },
  ],
};
