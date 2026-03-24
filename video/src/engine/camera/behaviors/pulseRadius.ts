import type { PulseRadiusBehavior } from "../../types/camera";

/** Compute pulsing radius */
export function applyPulseRadius(
  b: PulseRadiusBehavior,
  ease: number,
  _frame: number,
): number {
  return b.baseRadius + Math.sin(ease * Math.PI * b.cycles) * b.amplitude;
}
