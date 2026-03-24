import type { SceneDefinition } from "../../../engine/types/scene";

export const odteScene: SceneDefinition = {
  id: "0dte",
  lighting: "stormy-red",
  camera: {
    behaviors: [
      { type: "static", position: [1.2, 1.4, 2.4] },
      { type: "pulseRadius", baseRadius: 0, amplitude: 0.3, cycles: 2 },
      { type: "shake", amplitude: 0.04, frequency: 1.5 },
      { type: "dutchTilt", maxAngle: 0.015, speed: 0.05 },
    ],
    lookAt: [0, 1.2, -1],
  },
  weather: { rain: true, lightning: true },
  environment: { hasDesk: true, isDark: true },
  entities: [
    {
      id: "protagonist",
      prefab: "mixamo-character",
      transform: { position: [0.15, 0, 0.0], rotationY: Math.PI },
      animation: { clip: "neck-stretching" },
      props: { characterKey: "casualMan", color: "#3B82F6" },
    },
    {
      id: "desk",
      prefab: "trading-desk",
      transform: { position: [0, 0, 0] },
      props: {
        accentColor: "#ff3333",
        logoFile: "shorts/short-02/logos/robinhood-screen.png",
        logoText: "0DTE",
        primaryChart: "candlestick",
        chartSeed: 500,
      },
    },
  ],
};
