import type { CraneBehavior } from "../../types/camera";

/** Compute crane height delta */
export function applyCrane(
  b: CraneBehavior,
  ease: number,
  _frame: number,
): number {
  return b.heightDelta[0] + ease * (b.heightDelta[1] - b.heightDelta[0]);
}
