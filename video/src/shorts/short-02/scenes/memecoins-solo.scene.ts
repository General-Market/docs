import type { SceneDefinition } from "../../../engine/types/scene";

export const memecoinsSoloScene: SceneDefinition = {
  id: "memecoins-solo",
  lighting: "neon-midnight",
  camera: {
    behaviors: [
      { type: "orbit", angleRange: [-0.2, 0.3], radius: 2.8, height: 1.5 },
      { type: "pulseRadius", baseRadius: 0, amplitude: 0.25, cycles: 3 },
      { type: "shake", amplitude: 0.025, frequency: 1.2 },
      { type: "dutchTilt", maxAngle: 0.04, speed: 0.04, envelope: "peak-mid" },
    ],
    lookAt: [0, 1.1, -0.8],
  },
  environment: { hasDesk: true, isDark: true },
  entities: [
    {
      id: "protagonist",
      prefab: "mixamo-character",
      transform: { position: [0.15, 0, 0.0], rotationY: Math.PI },
      animation: { clip: "laughing" },
      props: { characterKey: "casualMan", color: "#3B82F6" },
    },
    {
      id: "desk",
      prefab: "trading-desk",
      transform: { position: [0, 0, 0] },
      props: {
        accentColor: "#00ff41",
        logoFile: "shorts/short-02/logos/pumpfun-screen.png",
        logoText: "PUMP.FUN",
        primaryChart: "line",
        chartSeed: 600,
      },
    },
  ],
};
