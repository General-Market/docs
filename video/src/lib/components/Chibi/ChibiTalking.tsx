import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { noise2D } from "@remotion/noise";

interface TalkingPulse {
  /** Frame to start this pulse */
  startFrame: number;
  /** Duration in frames (default 10) */
  duration?: number;
  /**
   * "zoom"      — uniform scale pulse (in→out)
   * "stretch"   — scaleY pulse (in→out)
   * "zoom-hold" — zoom in with spring and STAY at that scale
   */
  type: "zoom" | "stretch" | "zoom-hold";
  /** Max intensity (default 0.05 for zoom, 0.08 for stretch, 0.15 for zoom-hold) */
  intensity?: number;
}

interface Props {
  children: React.ReactNode;
  /**
   * Array of pulse definitions. If omitted, uses the default
   * "talking" pattern: 2 zoom, 2 stretch, 1 zoom-hold, 2 zoom.
   */
  pulses?: TalkingPulse[];
  /** Frame the entrance pop starts (default 6) */
  entranceFrame?: number;
  /** Duration of entrance spring (default 12) */
  entranceDuration?: number;
  /** Enable idle breathing/sway after entrance (default true) */
  idle?: boolean;
}

const DEFAULT_PULSES: TalkingPulse[] = [
  { startFrame: 14, type: "zoom", duration: 8 },
  { startFrame: 23, type: "zoom", duration: 8 },
  { startFrame: 32, type: "stretch", duration: 10 },
  { startFrame: 43, type: "stretch", duration: 10 },
  { startFrame: 54, type: "zoom-hold", duration: 10, intensity: 0.14 },
  { startFrame: 66, type: "zoom", duration: 8 },
  { startFrame: 75, type: "zoom", duration: 8 },
  { startFrame: 84, type: "zoom", duration: 8 },
];

/**
 * Cubic bezier helper — same math as CSS/Premiere Pro curves.
 * Attempt to solve for t given x using Newton's method.
 */
const cubicBezier = (x1: number, y1: number, x2: number, y2: number) => {
  return (x: number): number => {
    // Newton-Raphson to find t for given x
    let t = x;
    for (let i = 0; i < 8; i++) {
      const cx = 3 * x1 * t * (1 - t) * (1 - t) + 3 * x2 * t * t * (1 - t) + t * t * t - x;
      const dx = 3 * x1 * (1 - t) * (1 - t) - 6 * x1 * t * (1 - t) + 6 * x2 * t * (1 - t) - 3 * x2 * t * t + 3 * t * t;
      if (Math.abs(dx) < 1e-6) break;
      t -= cx / dx;
    }
    t = Math.max(0, Math.min(1, t));
    return 3 * y1 * t * (1 - t) * (1 - t) + 3 * y2 * t * t * (1 - t) + t * t * t;
  };
};

// Premiere-style speed ramp: accelerate hard, ease out smooth
const speedRampUp = cubicBezier(0.12, 0.8, 0.3, 1.0);
const speedRampDown = cubicBezier(0.5, 0.0, 0.7, 0.2);

/**
 * Premiere Pro-style pulse: punchy acceleration into peak,
 * then smooth controlled deceleration out. Not symmetric.
 */
const pulseEased = (frame: number, start: number, dur: number): number => {
  if (frame < start || frame >= start + dur) return 0;
  const t = (frame - start) / dur;
  if (t < 0.25) {
    // Snap up — aggressive bezier (fast acceleration, lands hard at peak)
    return speedRampUp(t / 0.25);
  }
  // Smooth out — controlled deceleration (the "smooth" part of the ramp)
  return 1 - speedRampDown((t - 0.25) / 0.75);
};

/**
 * Wraps children with a "talking" animation:
 * spring pop-in entrance, configurable zoom/stretch pulses, idle sway.
 *
 * Default pattern feels like a confident CEO presenting:
 * measured emphasis, deliberate pauses, authoritative posture shifts.
 *
 * Usage:
 * ```tsx
 * <ChibiTalking>
 *   <Img src={staticFile("test-chibi/chibi.png")} style={{ width: 600 }} />
 * </ChibiTalking>
 * ```
 */
export const ChibiTalking: React.FC<Props> = ({
  children,
  pulses = DEFAULT_PULSES,
  entranceFrame = 6,
  entranceDuration = 12,
  idle = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // --- Entrance spring (snappy, confident) ---
  const entranceProgress = spring({
    frame: frame - entranceFrame,
    fps,
    config: { damping: 13, stiffness: 220, mass: 0.9 },
    durationInFrames: entranceDuration,
  });
  const entranceScale = frame < entranceFrame ? 0 : entranceProgress;
  const entranceOpacity = frame < entranceFrame ? 0 : Math.min(1, entranceProgress * 2);

  // --- Pulse accumulation ---
  let zoomDelta = 0;
  let stretchDelta = 0;

  for (const p of pulses) {
    const dur = p.duration ?? 10;
    if (p.type === "zoom") {
      zoomDelta += pulseEased(frame, p.startFrame, dur) * (p.intensity ?? 0.06);
    } else if (p.type === "stretch") {
      stretchDelta += pulseEased(frame, p.startFrame, dur) * (p.intensity ?? 0.09);
    } else if (p.type === "zoom-hold") {
      if (frame >= p.startFrame) {
        const holdSpring = spring({
          frame: frame - p.startFrame,
          fps,
          config: { damping: 16, stiffness: 200, mass: 0.8 },
          durationInFrames: dur,
        });
        zoomDelta += holdSpring * (p.intensity ?? 0.14);
      }
    }
  }

  const stretchTranslateY = -stretchDelta * 50;

  // --- Idle: alive but not cartoonish ---
  const idleActive = idle && frame > entranceFrame + entranceDuration ? 1 : 0;
  const breathe = 1 + Math.sin((frame / 80) * Math.PI * 2) * 0.01 * idleActive;
  const weightShiftY = Math.sin((frame / 70) * Math.PI * 2) * -3 * idleActive;
  const sway = noise2D("chibi-sway", frame * 0.012, 0) * 0.8 * idleActive;

  // --- Combine ---
  const totalScaleX = entranceScale * (1 + zoomDelta);
  const totalScaleY = entranceScale * (1 + zoomDelta) * (1 + stretchDelta) * breathe;
  const totalTranslateY = weightShiftY + stretchTranslateY;

  return (
    <div
      style={{
        transform: [
          `translateY(${totalTranslateY}px)`,
          `scaleX(${totalScaleX})`,
          `scaleY(${totalScaleY})`,
          `rotate(${sway}deg)`,
        ].join(" "),
        transformOrigin: "center bottom",
        opacity: entranceOpacity,
      }}
    >
      {children}
    </div>
  );
};
