/**
 * tilt3d.ts — Programmatic 3D tilt/float for Remotion
 *
 * Replaces react-parallax-tilt / atropos / react-tilt for frame-driven video.
 * Those libs need mouse events — this gives the same visual from frame numbers.
 *
 * Usage:
 *   const tilt = useFloat3D(frame, fps, {
 *     rotateX: { amplitude: 8, frequency: 0.3 },
 *     rotateY: { amplitude: 12, frequency: 0.2 },
 *     translateZ: { amplitude: 20, frequency: 0.15 },
 *   });
 *   style={{ transform: tilt.transform, perspective: "800px" }}
 */

import { noise2D } from "@remotion/noise";

type Axis = {
  amplitude: number;   // degrees (rotate) or pixels (translate)
  frequency: number;   // oscillations per second
  phase?: number;      // offset in radians (default 0)
  noise?: number;      // 0-1 noise amount (default 0)
};

type Float3DConfig = {
  rotateX?: Axis;
  rotateY?: Axis;
  rotateZ?: Axis;
  translateX?: Axis;
  translateY?: Axis;
  translateZ?: Axis;
  scale?: { base: number; amplitude: number; frequency: number };
  perspective?: number; // px, default 800
};

type Float3DResult = {
  rotateX: number;
  rotateY: number;
  rotateZ: number;
  translateX: number;
  translateY: number;
  translateZ: number;
  scale: number;
  transform: string;
  perspectiveStyle: string;
};

function computeAxis(frame: number, fps: number, axis?: Axis, seed = "a"): number {
  if (!axis) return 0;
  const t = frame / fps;
  const phase = axis.phase || 0;
  const sine = Math.sin(2 * Math.PI * axis.frequency * t + phase) * axis.amplitude;
  const noiseAmount = axis.noise || 0;
  const n = noiseAmount > 0 ? noise2D(seed, t * 0.5, 0) * axis.amplitude * noiseAmount : 0;
  return sine + n;
}

/**
 * Compute a 3D floating transform from frame number.
 * Drop-in replacement for mouse-driven tilt libraries.
 */
export function useFloat3D(
  frame: number,
  fps: number,
  config: Float3DConfig
): Float3DResult {
  const rx = computeAxis(frame, fps, config.rotateX, "rx");
  const ry = computeAxis(frame, fps, config.rotateY, "ry");
  const rz = computeAxis(frame, fps, config.rotateZ, "rz");
  const tx = computeAxis(frame, fps, config.translateX, "tx");
  const ty = computeAxis(frame, fps, config.translateY, "ty");
  const tz = computeAxis(frame, fps, config.translateZ, "tz");

  const s = config.scale
    ? config.scale.base + Math.sin(2 * Math.PI * config.scale.frequency * (frame / fps)) * config.scale.amplitude
    : 1;

  const p = config.perspective || 800;

  const transform = [
    `perspective(${p}px)`,
    rx !== 0 ? `rotateX(${rx.toFixed(2)}deg)` : "",
    ry !== 0 ? `rotateY(${ry.toFixed(2)}deg)` : "",
    rz !== 0 ? `rotateZ(${rz.toFixed(2)}deg)` : "",
    tx !== 0 || ty !== 0 || tz !== 0
      ? `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, ${tz.toFixed(1)}px)`
      : "",
    s !== 1 ? `scale(${s.toFixed(3)})` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    rotateX: rx,
    rotateY: ry,
    rotateZ: rz,
    translateX: tx,
    translateY: ty,
    translateZ: tz,
    scale: s,
    transform,
    perspectiveStyle: `${p}px`,
  };
}

/**
 * Pre-built presets matching common motion design patterns.
 */
export const TILT_PRESETS = {
  /** Gentle phone float — like holding a phone that breathes */
  phoneFloat: {
    rotateX: { amplitude: 4, frequency: 0.25, noise: 0.3 },
    rotateY: { amplitude: 6, frequency: 0.18, noise: 0.3 },
    translateY: { amplitude: 5, frequency: 0.2 },
    perspective: 800,
  } satisfies Float3DConfig,

  /** Desktop browser tilt — slight angle like viewing from above-right */
  desktopTilt: {
    rotateX: { amplitude: 3, frequency: 0.15 },
    rotateY: { amplitude: 5, frequency: 0.12 },
    translateZ: { amplitude: 15, frequency: 0.1 },
    perspective: 1000,
  } satisfies Float3DConfig,

  /** Card flip — dramatic Y rotation for card reveals */
  cardRock: {
    rotateY: { amplitude: 20, frequency: 0.4 },
    perspective: 600,
  } satisfies Float3DConfig,

  /** Subtle idle float — almost imperceptible, adds life */
  subtleFloat: {
    rotateX: { amplitude: 1.5, frequency: 0.2, noise: 0.5 },
    rotateY: { amplitude: 2, frequency: 0.15, noise: 0.5 },
    translateY: { amplitude: 3, frequency: 0.18 },
    perspective: 900,
  } satisfies Float3DConfig,

  /** Dramatic entrance — phone sweeping in from angle */
  entranceSweep: {
    rotateX: { amplitude: 15, frequency: 0.3, phase: -Math.PI / 2 },
    rotateY: { amplitude: 25, frequency: 0.25, phase: -Math.PI / 2 },
    translateZ: { amplitude: 50, frequency: 0.2, phase: -Math.PI / 2 },
    scale: { base: 1, amplitude: 0.15, frequency: 0.25 },
    perspective: 700,
  } satisfies Float3DConfig,
};
