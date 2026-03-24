import type { BreatheBehavior } from "../../types/camera";

/** Compute breathing offset (subtle vertical oscillation) */
export function applyBreathe(
  b: BreatheBehavior,
  _ease: number,
  frame: number,
): number {
  const speed = b.speed ?? 0.025;
  return Math.sin(frame * speed) * b.amplitude;
}
