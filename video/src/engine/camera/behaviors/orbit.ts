import type { OrbitBehavior } from "../../types/camera";

/** Compute orbit camera position from behavior config */
export function applyOrbit(
  b: OrbitBehavior,
  ease: number,
  _frame: number,
): { x: number; y: number; z: number } {
  const [aStart, aEnd] = b.angleRange;
  const angle = aStart + ease * (aEnd - aStart);

  const radius = typeof b.radius === "number"
    ? b.radius
    : b.radius[0] + ease * (b.radius[1] - b.radius[0]);

  const height = typeof b.height === "number"
    ? b.height
    : b.height[0] + ease * (b.height[1] - b.height[0]);

  return {
    x: Math.sin(angle) * radius,
    y: height,
    z: Math.cos(angle) * radius,
  };
}
