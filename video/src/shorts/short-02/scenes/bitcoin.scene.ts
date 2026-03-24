import type { SceneDefinition } from "../../../engine/types/scene";

export const bitcoinScene: SceneDefinition = {
  id: "bitcoin",
  lighting: "bitcoin-sunset",
  camera: {
    behaviors: [
      { type: "orbit", angleRange: [0.35, 0.65], radius: 2.5, height: [1.35, 1.7] },
    ],
    lookAt: [0, 1.4, -0.8],
    lookAtDrift: { y: [1.4, 1.6] },
  },
  environment: { hasDesk: true },
  entities: [
    {
      id: "protagonist",
      prefab: "mixamo-character",
      transform: { position: [0.15, 0, 0.0], rotationY: Math.PI },
      animation: { clip: "victory" },
      props: { characterKey: "casualMan", color: "#3B82F6" },
    },
    {
      id: "desk",
      prefab: "trading-desk",
      transform: { position: [0, 0, 0] },
      props: {
        accentColor: "#f7931a",
        logoFile: "shorts/short-02/logos/binance.png",
        logoText: "BINANCE",
        primaryChart: "candlestick",
        chartSeed: 300,
      },
    },
  ],
};
