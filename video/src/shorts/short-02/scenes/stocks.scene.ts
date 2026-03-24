import type { SceneDefinition } from "../../../engine/types/scene";

export const stocksScene: SceneDefinition = {
  id: "stocks",
  lighting: "bright-midday",
  camera: {
    behaviors: [
      { type: "dolly", zRange: [2.8, 2.3], xRange: [1.2, 0.8], height: [1.15, 1.6] },
    ],
    lookAt: [0, 1.2, -0.8],
  },
  environment: { hasDesk: true },
  entities: [
    {
      id: "protagonist",
      prefab: "mixamo-character",
      transform: { position: [0.15, 0, 0.0], rotationY: Math.PI },
      animation: { clip: "cards" },
      props: { characterKey: "casualMan", color: "#3B82F6" },
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
