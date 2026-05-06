import React from "react";
import { useCurrentFrame, interpolate, Easing } from "remotion";

type Props = {
  children: React.ReactNode;
  startFrame?: number;
  durationFrames?: number;
  maxOffsetPx?: number;
  filterId?: string;
};

const ID_COUNTER = { n: 0 };
const nextId = () => `rgbshift-${++ID_COUNTER.n}`;

export const RGBShift: React.FC<Props> = ({
  children,
  startFrame = 0,
  durationFrames = 8,
  maxOffsetPx = 22,
  filterId,
}) => {
  const frame = useCurrentFrame();
  const local = frame - startFrame;

  const intensity =
    local < 0 || local > durationFrames
      ? 0
      : interpolate(
          local,
          [0, durationFrames * 0.35, durationFrames],
          [1, 0.6, 0],
          {
            easing: Easing.out(Easing.cubic),
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          },
        );

  const offset = maxOffsetPx * intensity;
  const id = React.useMemo(() => filterId ?? nextId(), [filterId]);

  if (intensity <= 0.001) {
    return <>{children}</>;
  }

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <svg
        style={{ position: "absolute", width: 0, height: 0 }}
        aria-hidden
      >
        <defs>
          <filter id={id} x="-10%" y="-10%" width="120%" height="120%">
            <feColorMatrix
              in="SourceGraphic"
              type="matrix"
              values="
                1 0 0 0 0
                0 0 0 0 0
                0 0 0 0 0
                0 0 0 1 0"
              result="redChan"
            />
            <feOffset in="redChan" dx={-offset} dy="0" result="redShift" />

            <feColorMatrix
              in="SourceGraphic"
              type="matrix"
              values="
                0 0 0 0 0
                0 1 0 0 0
                0 0 0 0 0
                0 0 0 1 0"
              result="greenChan"
            />
            <feOffset
              in="greenChan"
              dx={offset * 0.15}
              dy={offset * 0.05}
              result="greenShift"
            />

            <feColorMatrix
              in="SourceGraphic"
              type="matrix"
              values="
                0 0 0 0 0
                0 0 0 0 0
                0 0 1 0 0
                0 0 0 1 0"
              result="blueChan"
            />
            <feOffset in="blueChan" dx={offset} dy="0" result="blueShift" />

            <feBlend in="redShift" in2="greenShift" mode="screen" result="rg" />
            <feBlend in="rg" in2="blueShift" mode="screen" />
          </filter>
        </defs>
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          filter: `url(#${id})`,
          willChange: "filter",
        }}
      >
        {children}
      </div>
    </div>
  );
};
