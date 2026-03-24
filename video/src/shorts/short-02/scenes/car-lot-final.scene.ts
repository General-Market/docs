import type { SceneDefinition } from "../../../engine/types/scene";

export const carLotFinalScene: SceneDefinition = {
  id: "car-lot-final",
  lighting: "deep-golden",
  camera: {
    behaviors: [
      { type: "dolly", zRange: [3.5, 1.7], xRange: [0.3, 0], height: [1.1, 1.35] },
    ],
    lookAt: [0, 1.3, -1],
  },
  environment: { hasDesk: true },
  entities: [
    {
      id: "protagonist",
      prefab: "mixamo-character",
      transform: { position: [0.3, 0, 1.0], rotationY: Math.PI },
      animation: { clip: "shrugging" },
      props: { characterKey: "casualMan", color: "#3B82F6" },
    },
    {
      id: "desk",
      prefab: "trading-desk",
      transform: { position: [0, 0, 0] },
      props: {
        accentColor: "#6366f1",
        primaryChart: "candlestick",
        chartSeed: 42,
      },
    },
  ],
};
