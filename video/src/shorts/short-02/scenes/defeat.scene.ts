import type { SceneDefinition } from "../../../engine/types/scene";

export const defeatScene: SceneDefinition = {
  id: "defeat",
  lighting: "boss-arena",
  camera: {
    behaviors: [
      { type: "dolly", zRange: [3.5, 2.7], xOffset: 0.3, height: [1.2, 0.6] },
      { type: "shake", amplitude: 0.035, frequency: 1.2 },
      { type: "dutchTilt", maxAngle: 0.04, speed: 0.04 },
    ],
    lookAt: [0, 1.4, -2.5],
    lookAtDrift: { y: [1.4, 1.7] },
  },
  weather: { rain: true },
  environment: { hasDesk: true, isDark: true },
  entities: [
    {
      id: "protagonist",
      prefab: "mixamo-character",
      transform: { position: [0, 0, 1.8], rotationY: 0 },
      animation: { clip: "defeated" },
      props: { characterKey: "casualMan", color: "#3B82F6" },
    },
    {
      id: "boss",
      prefab: "big-robot",
      transform: { position: [0, 0, -2] },
    },
    {
      id: "desk",
      prefab: "trading-desk",
      transform: { position: [0, 0, 0] },
      props: {
        accentColor: "#666666",
        logoFile: "shorts/short-02/logos/citadel.png",
        logoText: "CITADEL",
        primaryChart: "candlestick",
        chartSeed: 800,
      },
    },
  ],
};
