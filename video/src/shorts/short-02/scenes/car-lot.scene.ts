import type { SceneDefinition } from "../../../engine/types/scene";

export const carLotScene: SceneDefinition = {
  id: "car-lot",
  lighting: "golden-hour",
  camera: {
    behaviors: [
      { type: "orbit", angleRange: [-0.6, 0.7], radius: [3.0, 1.9], height: [2.2, 1.4] },
      { type: "sway", amplitude: 0.04, speed: 0.015 },
      { type: "breathe", amplitude: 0.03 },
    ],
    lookAt: [0, 1.4, 0.2],
    lookAtDrift: { x: [0, -0.1], y: [1.4, 1.2] },
  },
  environment: { hasCar: true },
  entities: [
    {
      id: "protagonist",
      prefab: "mixamo-character",
      transform: { position: [0.1, 0, 0.3], rotationY: -Math.PI * 0.6 },
      animation: { clip: "talking" },
      props: { characterKey: "casualMan", color: "#3B82F6" },
    },
    {
      id: "other",
      prefab: "smart-character",
      transform: { position: [-0.35, 0, 0.3], rotationY: Math.PI * 0.55 },
      animation: { clip: "Idle" },
    },
    {
      id: "car",
      prefab: "car",
      transform: { position: [0, 0, 0] },
    },
  ],
};
