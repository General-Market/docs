/**
 * MotionOverlay — Ken Burns drift for static visual scenes.
 *
 * Wraps children in a slow zoom + pan + rotation transform.
 * The viewer should never consciously notice the motion.
 * They should only notice its absence.
 *
 * Tuned for cinematic handheld: a good documentary cameraman,
 * not a tripod, not an earthquake.
 */
import React from "react";
import {
  AbsoluteFill,
  Easing,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";

interface MotionOverlayProps {
  children: React.ReactNode;
  /** Zoom direction: 'in' (1.0→zoomAmount) or 'out' (zoomAmount→1.0) or 'none' */
  zoom?: "in" | "out" | "none";
  /** Drift direction */
  drift?: "left" | "right" | "up" | "down" | "none";
  /** Enable subtle rotation drift */
  rotate?: boolean;
  /** Speed multiplier, default 1.0 */
  speed?: number;
  /** Cyclical scale breathing (3-second cycle, ±0.012) */
  breathing?: boolean;
  /** Deterministic handheld micro-jitter (±0.6px, three-axis) */
  handheld?: boolean;
  /** Parallax depth split — foreground zooms 1.3×, wrapper 0.7× */
  parallax?: boolean;
  /** Global intensity scalar (0–1, default 1.0). Scales ALL motion proportionally. */
  intensity?: number;
}

export const MotionOverlay: React.FC<MotionOverlayProps> = ({
  children,
  zoom = "in",
  drift = "right",
  rotate = true,
  speed = 1.0,
  breathing = false,
  handheld = false,
  parallax = false,
  intensity = 1.0,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Clamp intensity to [0, 1]
  const k = Math.max(0, Math.min(1, intensity));

  // Eased progress 0→1 across the scene, scaled by speed
  const rawProgress = interpolate(
    frame * speed,
    [0, durationInFrames],
    [0, 1],
    { extrapolateRight: "clamp" },
  );
  const progress = Easing.inOut(Easing.quad)(rawProgress);

  // --- Zoom ---
  const ZOOM_AMOUNT = 1.0 + 0.06 * k;
  let scale = 1.0;
  if (zoom === "in") {
    scale = interpolate(progress, [0, 1], [1.0, ZOOM_AMOUNT]);
  } else if (zoom === "out") {
    scale = interpolate(progress, [0, 1], [ZOOM_AMOUNT, 1.0]);
  }

  // --- Breathing ---
  // 3-second cycle, ±0.012 scale oscillation, independent of zoom
  if (breathing) {
    const breathCycle = (frame / fps) * ((2 * Math.PI) / 3);
    const breathScale = 0.012 * k * (0.5 - 0.5 * Math.cos(breathCycle));
    scale += breathScale;
  }

  // --- Parallax depth split ---
  const innerScale = parallax ? 1.0 + (scale - 1.0) * 1.3 : scale;
  const outerScale = parallax ? 1.0 + (scale - 1.0) * 0.7 : 1.0;

  // --- Drift (8px range, scaled by intensity) ---
  const DRIFT_PX = 8 * k;
  let dx = 0;
  let dy = 0;

  if (drift !== "none") {
    switch (drift) {
      case "left":
        dx = interpolate(progress, [0, 1], [0, -DRIFT_PX]);
        break;
      case "right":
        dx = interpolate(progress, [0, 1], [0, DRIFT_PX]);
        break;
      case "up":
        dy = interpolate(progress, [0, 1], [0, -DRIFT_PX]);
        break;
      case "down":
        dy = interpolate(progress, [0, 1], [0, DRIFT_PX]);
        break;
    }

    // Perpendicular micro-drift so motion never feels purely linear
    const crossDrift = Math.sin(progress * Math.PI) * 3 * k;
    if (drift === "left" || drift === "right") {
      dy += crossDrift;
    } else {
      dx += crossDrift;
    }
  }

  // --- Handheld micro-jitter ---
  // Three overlapping sin waves at irrational-ratio frequencies,
  // producing ±0.6px of organic camera shake per frame.
  // Third axis (diagonal) adds the asymmetry a real hand provides.
  if (handheld) {
    const t = frame / fps;
    const amp = 0.6 * k;
    // Horizontal: primary
    dx += amp * Math.sin(t * 7.31);
    // Vertical: primary
    dy += amp * Math.sin(t * 11.87);
    // Diagonal: third frequency axis — splits into both axes
    const diag = 0.6 * k * Math.sin(t * 5.13);
    dx += diag;
    dy += diag;
  }

  // --- Rotation ---
  // Smooth sine arc: 0° → 0.2° → 0° across the scene
  const rot = rotate ? 0.2 * k * Math.sin(progress * Math.PI) : 0;

  const innerTransform = `scale(${innerScale}) translate(${dx}px, ${dy}px) rotate(${rot}deg)`;

  // When parallax is active, the outer wrapper gets its own subtle scale
  const outerStyle: React.CSSProperties = {
    overflow: "hidden",
    ...(parallax ? { transform: `scale(${outerScale})` } : {}),
  };

  return (
    <AbsoluteFill style={outerStyle}>
      <AbsoluteFill
        style={{
          transform: innerTransform,
          transformOrigin: "center center",
        }}
      >
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
