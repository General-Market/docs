import type { SceneDefinition } from "../../../engine/types/scene";

export const bitcoinIntroScene: SceneDefinition = {
  id: "bitcoin-intro",
  lighting: "bitcoin-sunset",
  camera: {
    behaviors: [
      { type: "orbit", angleRange: [0.4, 2.8], radius: 2.8, height: [1.45, 1.30] },
      { type: "shake", amplitude: 0.008, amplitudeEnd: 0.016, frequency: 0.6 },
      { type: "breathe", amplitude: 0.03 },
    ],
    lookAt: [0, 1.1, -0.3],
  },
  environment: { hasDesk: true },
  entities: [
    {
      id: "protagonist",
      prefab: "mixamo-character",
      transform: { position: [-0.3, 0, 1.3], rotationY: Math.PI * 0.85 },
      animation: { clip: "surprised" },
      props: { characterKey: "casualMan", color: "#3B82F6" },
    },
    {
      id: "trader",
      prefab: "smart-character",
      transform: { position: [0, 0, -0.05], rotationY: Math.PI },
      animation: { clip: "Idle" },
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
