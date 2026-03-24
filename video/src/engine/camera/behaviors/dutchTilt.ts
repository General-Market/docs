import type { DutchTiltBehavior } from "../../types/camera";

/** Compute dutch tilt rotation.z from behavior config */
export function applyDutchTilt(
  b: DutchTiltBehavior,
  ease: number,
  frame: number,
): number {
  const speed = b.speed ?? 0.04;
  let envelope = 1.0;

  if (b.envelope === "peak-mid") {
    envelope = Math.sin(ease * Math.PI); // peaks at 0.5
  } else if (b.envelope === "decay") {
    envelope = Math.max(0, 1 - ease * 1.5); // gone by 2/3
  }

  return Math.sin(frame * speed) * b.maxAngle * envelope;
}
