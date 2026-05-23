import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { scene } from "./tokens";

// FloatingItem — wrap any element so it hovers on the blue field.
//
// A continuous float (sine bob on Y, a smaller drift on X, a whisper of
// rotation) keeps the element alive on a long hold. An optional entrance
// either springs it in ("pop") or just fades the float up ("rise").
//
// FloatingChip wraps the float in the rounded white card the reference puts
// logos and flags inside.

type Enter = "pop" | "rise" | "none";

export type FloatingItemProps = {
  children: React.ReactNode;
  /** Vertical bob amplitude, px. */
  amplitude?: number;
  /** Float period, seconds. */
  period?: number;
  /** Phase offset 0..1 so neighbours don't bob in unison. */
  phase?: number;
  /** Entrance delay, frames. */
  delay?: number;
  enter?: Enter;
  style?: React.CSSProperties;
};

export const FloatingItem: React.FC<FloatingItemProps> = ({
  children,
  amplitude = 14,
  period = 4,
  phase = 0,
  delay = 0,
  enter = "pop",
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  const bob = Math.sin((t / period + phase) * Math.PI * 2) * amplitude;
  const driftX = Math.cos((t / (period * 1.6) + phase) * Math.PI * 2) * (amplitude * 0.35);
  const tilt = Math.sin((t / (period * 2.1) + phase) * Math.PI * 2) * 1.1;

  const local = Math.max(0, frame - delay);
  const pop = spring({
    fps,
    frame: local,
    config: { mass: 0.7, damping: 13, stiffness: 130 },
    durationInFrames: 22,
  });

  let enterScale = 1;
  let enterOpacity = 1;
  if (enter === "pop") {
    enterScale = interpolate(pop, [0, 1], [0.62, 1]);
    enterOpacity = interpolate(local, [0, 8], [0, 1], { extrapolateRight: "clamp" });
  } else if (enter === "rise") {
    enterOpacity = interpolate(local, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  }

  return (
    <div
      style={{
        transform: `translate3d(${driftX.toFixed(2)}px, ${bob.toFixed(2)}px, 0) rotate(${tilt.toFixed(2)}deg) scale(${enterScale.toFixed(3)})`,
        opacity: enterOpacity,
        willChange: "transform, opacity",
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export type FloatingChipProps = FloatingItemProps & {
  /** Card edge in px (square). */
  size?: number;
  /** Corner radius, px. */
  radius?: number;
  /** Inner padding, px. */
  padding?: number;
  /** Card fill — defaults to white, like the reference flag card. */
  background?: string;
};

export const FloatingChip: React.FC<FloatingChipProps> = ({
  children,
  size = 168,
  radius = 28,
  padding = 22,
  background = scene.chip,
  ...float
}) => {
  return (
    <FloatingItem {...float}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          background,
          boxShadow: `0 26px 60px ${scene.chipShadow}, 0 0 0 1px rgba(255,255,255,0.6) inset`,
          padding,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {children}
      </div>
    </FloatingItem>
  );
};
