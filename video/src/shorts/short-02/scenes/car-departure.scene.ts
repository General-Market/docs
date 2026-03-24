import type { SceneDefinition } from "../../../engine/types/scene";

export const carDepartureScene: SceneDefinition = {
  id: "car-departure",
  lighting: "golden-hour",
  camera: {
    behaviors: [
      { type: "orbit", angleRange: [Math.PI * 0.7, Math.PI * 0.7 - 1.4], radius: [3.0, 5.0], height: [1.0, 1.5] },
      { type: "breathe", amplitude: 0.03 },
    ],
    lookAt: [0, 0.5, 3.8],
  },
  environment: { hasCar: true },
  entities: [
    {
      id: "protagonist",
      prefab: "mixamo-character",
      transform: { position: [0, 0, 0.5], rotationY: Math.PI * 0.5 },
      animation: { clip: "entering-car" },
      props: { characterKey: "casualMan", color: "#3B82F6" },
    },
    {
      id: "car",
      prefab: "car",
      transform: { position: [0, 0, 0] },
      motion: {
        waypoints: [
          { t: 0, position: [0, 0, 3.8] },
          { t: 1, position: [18, 0, 3.8] },
        ],
        easing: "cubic",
      },
    },
  ],
};
