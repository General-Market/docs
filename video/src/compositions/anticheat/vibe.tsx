import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

// Shared "vibe" primitives for the AntiCheat film.
//
//   IdleZoom    — scene-long imperceptible scale ramp, per scene.
//   RevealChars — staggered glyph entrance, replaces wholesale fades on
//                 hero headlines.

// ─── IdleZoom ─────────────────────────────────────────────────────────────────
//
// Scale ramps from `from` to `to` over the scene's duration. Sub-perceptual
// per-frame change, hypnotic at 3+ seconds. The eye reads it as a held
// inhale.

export const IdleZoom: React.FC<{
  durationInFrames: number;
  from?: number;
  to?: number;
  origin?: string;
  children: React.ReactNode;
}> = ({
  durationInFrames,
  from = 1,
  to = 1.035,
  origin = "50% 50%",
  children,
}) => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, durationInFrames], [from, to], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill
      style={{
        transform: `scale(${scale.toFixed(4)})`,
        transformOrigin: origin,
        willChange: "transform",
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

// ─── RevealChars ──────────────────────────────────────────────────────────────
//
// Stagger each glyph in. Replace wholesale opacity fades on hero headlines.
// Spaces preserve. Default tuning lands between "snappy" (low stagger,
// short duration) and "luxurious" (16f stagger, 20f duration).

type RevealCharsProps = {
  text: string;
  startFrame?: number;
  stagger?: number;
  duration?: number;
  y?: number;
  blur?: number;
  scale?: number;
  // Hold the final state past the reveal window. Defaults to true; set
  // false if you want the chars to keep animating off the end (e.g. for
  // exit choreography handled elsewhere).
  hold?: boolean;
};

export const RevealChars: React.FC<RevealCharsProps> = ({
  text,
  startFrame = 0,
  stagger = 1.6,
  duration = 12,
  y = 14,
  blur = 6,
  scale = 0.94,
  hold = true,
}) => {
  const frame = useCurrentFrame();
  const chars = Array.from(text);
  return (
    <span style={{ display: "inline-block" }}>
      {chars.map((ch, i) => {
        if (ch === " ") {
          return (
            <span
              key={i}
              style={{ display: "inline-block", whiteSpace: "pre" }}
            >
              {" "}
            </span>
          );
        }
        const local = frame - startFrame - i * stagger;
        const tRaw = local / duration;
        const t = hold
          ? Math.max(0, Math.min(1, tRaw))
          : Math.max(0, tRaw);
        const e = 1 - Math.pow(1 - Math.min(1, t), 4);
        const op = e;
        const ty = (1 - e) * y;
        const bl = (1 - e) * blur;
        const sc = scale + (1 - scale) * e;
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              opacity: op,
              transform: `translate3d(0, ${ty.toFixed(2)}px, 0) scale(${sc.toFixed(3)})`,
              filter: bl > 0.05 ? `blur(${bl.toFixed(2)}px)` : undefined,
              willChange: "transform, opacity, filter",
            }}
          >
            {ch}
          </span>
        );
      })}
    </span>
  );
};
