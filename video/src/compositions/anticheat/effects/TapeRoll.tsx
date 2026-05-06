import React from "react";
import { useCurrentFrame, interpolate, Easing } from "remotion";

type Props = {
  startFrame: number;
  durationFrames?: number;
  bandHeightPx?: number;
};

export const TapeRoll: React.FC<Props> = ({
  startFrame,
  durationFrames = 16,
  bandHeightPx = 180,
}) => {
  const frame = useCurrentFrame();
  const local = frame - startFrame;
  if (local < 0 || local > durationFrames) return null;

  const t = local / durationFrames;
  const id = React.useId();

  // Band travels from below the bottom edge up past the top, like a VHS
  // sync-loss bar rolling against the field direction.
  const yPct = interpolate(t, [0, 1], [110, -25], {
    easing: Easing.inOut(Easing.cubic),
  });
  const seed = Math.floor(local * 0.6) + Math.floor(startFrame / 13);
  const alpha = interpolate(t, [0, 0.1, 0.9, 1], [0, 1, 1, 0]);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
        opacity: alpha,
      }}
    >
      <svg
        style={{ position: "absolute", width: 0, height: 0 }}
        aria-hidden
      >
        <defs>
          <filter
            id={`${id}-jitter`}
            x="-10%"
            y="-10%"
            width="120%"
            height="120%"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.9 0.02"
              numOctaves={1}
              seed={seed}
              result="n"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="n"
              scale={28}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
          <linearGradient id={`${id}-band`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="6%" stopColor="rgba(0,200,255,0.85)" />
            <stop offset="14%" stopColor="rgba(255,255,255,0.95)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.18)" />
            <stop offset="86%" stopColor="rgba(255,255,255,0.95)" />
            <stop offset="94%" stopColor="rgba(255,80,140,0.85)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>
      </svg>

      <div
        style={{
          position: "absolute",
          left: "-5%",
          width: "110%",
          top: `${yPct}%`,
          height: `${bandHeightPx}px`,
          background: `url(#${id}-band)`,
          mixBlendMode: "screen",
          filter: `url(#${id}-jitter)`,
        }}
      >
        <svg
          width="100%"
          height="100%"
          preserveAspectRatio="none"
          style={{ display: "block" }}
        >
          <rect width="100%" height="100%" fill={`url(#${id}-band)`} />
        </svg>
      </div>

      <div
        style={{
          position: "absolute",
          left: "-5%",
          width: "110%",
          top: `calc(${yPct}% + ${bandHeightPx / 2 - 1}px)`,
          height: "2px",
          background: "rgba(255,255,255,0.95)",
          mixBlendMode: "screen",
        }}
      />
    </div>
  );
};
