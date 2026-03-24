import type { SceneDefinition } from "../../../engine/types/scene";

export const returnScene: SceneDefinition = {
  id: "return",
  lighting: "sunset-return",
  camera: {
    behaviors: [
      { type: "dolly", zRange: [3.5, 5.0], xOffset: 0.3, height: [0.8, 1.3] },
      { type: "shake", amplitude: 0.02, amplitudeEnd: 0 },
      { type: "dutchTilt", maxAngle: 0.015, speed: 0.03, envelope: "decay" },
    ],
    lookAt: [0, 0.9, 1.5],
  },
  environment: { hasCar: true },
  entities: [
    {
      id: "protagonist",
      prefab: "mixamo-character",
      transform: { position: [0, 0, 3.5], rotationY: Math.PI },
      animation: { clip: "walking" },
      motion: {
        waypoints: [
          { t: 0, position: [0, 0, 3.5], rotationY: Math.PI },
          { t: 0.75, position: [0, 0, 0.8], rotationY: Math.PI },
          { t: 1, position: [-0.15, 0, 0.5], rotationY: Math.PI * 0.5 },
        ],
        easing: "smoothstep",
      },
      props: { characterKey: "casualMan", color: "#3B82F6" },
    },
    {
      id: "car",
      prefab: "car",
      transform: { position: [0, 0, 0] },
    },
  ],
};
