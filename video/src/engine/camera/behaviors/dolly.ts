import type { DollyBehavior } from "../../types/camera";

/** Compute dolly camera position from behavior config */
export function applyDolly(
  b: DollyBehavior,
  ease: number,
  _frame: number,
): { x: number; y: number; z: number } {
  const z = b.zRange[0] + ease * (b.zRange[1] - b.zRange[0]);
  const x = b.xRange
    ? b.xRange[0] + ease * (b.xRange[1] - b.xRange[0])
    : b.xOffset ?? 0;

  const height = b.height == null
    ? 1.5
    : typeof b.height === "number"
      ? b.height
      : b.height[0] + ease * (b.height[1] - b.height[0]);

  return { x, y: height, z };
}
