import React from "react";
import { useCurrentFrame, interpolate, Easing } from "remotion";

type Props = {
  children: React.ReactNode;
  peakFrame: number;
  rampFrames?: number;
  holdFrames?: number;
  releaseFrames?: number;
  scalePeak?: number;
  rotatePeakDeg?: number;
  rgbOffsetPeakPx?: number;
  vignettePeak?: number;
};

const envelope = (
  frame: number,
  peak: number,
  ramp: number,
  hold: number,
  release: number,
) => {
  const start = peak - ramp;
  const holdEnd = peak + hold;
  const end = holdEnd + release;
  if (frame <= start || frame >= end) return 0;
  if (frame < peak)
    return interpolate(frame, [start, peak], [0, 1], {
      easing: Easing.out(Easing.quad),
    });
  if (frame <= holdEnd) return 1;
  return interpolate(frame, [holdEnd, end], [1, 0], {
    easing: Easing.in(Easing.cubic),
  });
};

export const LensPunch: React.FC<Props> = ({
  children,
  peakFrame,
  rampFrames = 4,
  holdFrames = 2,
  releaseFrames = 10,
  scalePeak = 1.06,
  rotatePeakDeg = 0.4,
  rgbOffsetPeakPx = 16,
  vignettePeak = 0.55,
}) => {
  const frame = useCurrentFrame();
  const t = envelope(frame, peakFrame, rampFrames, holdFrames, releaseFrames);

  const scale = 1 + (scalePeak - 1) * t;
  const rotate = rotatePeakDeg * t;
  const rgb = rgbOffsetPeakPx * t;
  const vignette = vignettePeak * t;
  const filterId = React.useId();

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
      }}
    >
      <svg
        aria-hidden
        style={{ position: "absolute", width: 0, height: 0 }}
      >
        <defs>
          <filter
            id={filterId}
            x="-15%"
            y="-15%"
            width="130%"
            height="130%"
            colorInterpolationFilters="sRGB"
          >
            <feColorMatrix
              in="SourceGraphic"
              type="matrix"
              values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"
              result="r"
            />
            <feOffset in="r" dx={-rgb} dy="0" result="rs" />
            <feColorMatrix
              in="SourceGraphic"
              type="matrix"
              values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0"
              result="g"
            />
            <feColorMatrix
              in="SourceGraphic"
              type="matrix"
              values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0"
              result="b"
            />
            <feOffset in="b" dx={rgb} dy="0" result="bs" />
            <feBlend in="rs" in2="g" mode="screen" result="rg" />
            <feBlend in="rg" in2="bs" mode="screen" />
          </filter>
        </defs>
      </svg>

      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `scale(${scale}) rotate(${rotate}deg)`,
          transformOrigin: "50% 50%",
          filter: t > 0.001 ? `url(#${filterId})` : undefined,
          willChange: "transform, filter",
        }}
      >
        {children}
      </div>

      {vignette > 0.001 ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background: `radial-gradient(ellipse at center, rgba(0,0,0,0) 35%, rgba(0,0,0,${vignette.toFixed(3)}) 100%)`,
            mixBlendMode: "multiply",
          }}
        />
      ) : null}
    </div>
  );
};
