import type { SceneDefinition } from "../../../engine/types/scene";

export const ambushScene: SceneDefinition = {
  id: "ambush",
  lighting: "neon-night",
  camera: {
    behaviors: [
      { type: "dolly", zRange: [3.8, 2.6], xOffset: 0.8, height: [1.5, 1.3] },
      { type: "shake", amplitude: 0.008, amplitudeEnd: 0.033 },
    ],
    lookAt: [0, 1.3, -1.0],
    lookAtDrift: { z: [-1.0, -1.8] },
  },
  weather: { rain: true, lightning: true },
  environment: { hasDesk: true, isDark: true },
  entities: [
    {
      id: "protagonist",
      prefab: "mixamo-character",
      transform: { position: [0.15, 0, 0.0], rotationY: Math.PI },
      animation: { clip: "angry-point" },
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
        accentColor: "#cc0000",
        logoFile: "shorts/short-02/logos/goldman-sachs.png",
        logoText: "ROBINHOOD",
        primaryChart: "candlestick",
        chartSeed: 450,
      },
    },
  ],
};
