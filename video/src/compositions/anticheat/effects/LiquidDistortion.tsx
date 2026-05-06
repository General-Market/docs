import React from "react";
import { useCurrentFrame, interpolate, Easing } from "remotion";

type Props = {
  startFrame: number;
  durationFrames?: number;
  color?: string;
};

export const LiquidDistortion: React.FC<Props> = ({
  startFrame,
  durationFrames = 14,
  color = "#ffffff",
}) => {
  const frame = useCurrentFrame();
  const id = React.useId();
  const local = frame - startFrame;

  if (local < 0 || local > durationFrames) return null;

  const t = local / durationFrames;
  const strength = interpolate(t, [0, 0.5, 1], [0, 240, 0], {
    easing: Easing.inOut(Easing.cubic),
  });
  const freq = interpolate(t, [0, 1], [0.006, 0.022]);
  const seed = Math.floor(startFrame / 7) + Math.floor(local * 0.5);
  const bandY = interpolate(t, [0, 1], [-0.2, 1.2]);
  const alpha = interpolate(t, [0, 0.15, 0.85, 1], [0, 0.55, 0.55, 0]);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        opacity: alpha,
      }}
    >
      <svg
        width="100%"
        height="100%"
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
        style={{ display: "block" }}
      >
        <defs>
          <linearGradient
            id={`${id}-grad`}
            x1="0"
            y1={bandY - 0.18}
            x2="0"
            y2={bandY + 0.18}
          >
            <stop offset="0%" stopColor={color} stopOpacity="0" />
            <stop offset="50%" stopColor={color} stopOpacity="1" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
          <filter id={id} x="-30%" y="-30%" width="160%" height="160%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency={`${freq.toFixed(4)} ${(freq * 1.6).toFixed(4)}`}
              numOctaves={2}
              seed={seed}
              result="noise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale={strength}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
        <rect
          x="0"
          y="0"
          width="100"
          height="100"
          fill={`url(#${id}-grad)`}
          filter={`url(#${id})`}
        />
      </svg>
    </div>
  );
};
