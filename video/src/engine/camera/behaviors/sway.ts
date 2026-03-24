import type { SwayBehavior } from "../../types/camera";

/** Compute horizontal sway offset */
export function applySway(
  b: SwayBehavior,
  _ease: number,
  frame: number,
): number {
  const speed = b.speed ?? 0.015;
  return Math.sin(frame * speed) * b.amplitude;
}
