import type { ShakeBehavior } from "../../types/camera";

/** Compute shake offset from behavior config */
export function applyShake(
  b: ShakeBehavior,
  ease: number,
  frame: number,
): { dx: number; dy: number; dz: number } {
  const freq = b.frequency ?? 1.0;
  const amp = b.amplitudeEnd != null
    ? b.amplitude + ease * (b.amplitudeEnd - b.amplitude)
    : b.amplitude;

  const dx = Math.sin(frame * 0.12 * freq) * amp + Math.sin(frame * 0.07 * freq) * amp * 0.5;
  const dy = Math.cos(frame * 0.15 * freq) * amp * 0.6;
  const dz = Math.sin(frame * 0.15 * freq) * amp * 0.3;

  return { dx, dy, dz };
}
