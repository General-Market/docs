import React from "react";
import { useCurrentFrame, interpolate, Easing } from "remotion";

type Props = {
  startFrame: number;
  durationFrames?: number;
  originX?: number;
  originY?: number;
  color?: string;
};

export const InkBleed: React.FC<Props> = ({
  startFrame,
  durationFrames = 16,
  originX = 50,
  originY = 50,
  color = "#08070a",
}) => {
  const frame = useCurrentFrame();
  const local = frame - startFrame;
  if (local < 0 || local > durationFrames) return null;

  const t = local / durationFrames;
  const id = React.useId();

  // Radius grows from 0 to ~1.6× the diagonal so the stain fully covers,
  // then linger-fades. Seed shifts each frame for living edge.
  const r = interpolate(t, [0, 0.85, 1], [0, 1500, 1500], {
    easing: Easing.out(Easing.expo),
  });
  const alpha = interpolate(t, [0, 0.25, 0.85, 1], [0, 1, 1, 0]);
  const seed = Math.floor(startFrame / 17) + Math.floor(local * 0.5);

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
        viewBox="0 0 1080 1920"
        style={{ display: "block" }}
      >
        <defs>
          <filter
            id={id}
            x="-30%"
            y="-30%"
            width="160%"
            height="160%"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.011 0.018"
              numOctaves={3}
              seed={seed}
              result="n"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="n"
              scale={140}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
        <circle
          cx={originX * 10.8}
          cy={originY * 19.2}
          r={r}
          fill={color}
          filter={`url(#${id})`}
        />
      </svg>
    </div>
  );
};
