import React from "react";
import type {
  TransitionPresentation,
  TransitionPresentationComponentProps,
} from "@remotion/transitions";

export type HalftoneBlendProps = {
  cellSize?: number;
};

const HalftoneBlendPresentation: React.FC<
  TransitionPresentationComponentProps<HalftoneBlendProps>
> = ({ children, presentationProgress, presentationDirection, passedProps }) => {
  const id = React.useId();
  const cellSize = passedProps.cellSize ?? 38;

  // Both scenes are masked through a shared dot grid. As progress runs 0 → 1
  // the dot radius grows from 0 to ≈ cell·√½. The exiting scene is visible
  // OUTSIDE the dots (mask = white background, black dots punching holes);
  // the entering scene is visible INSIDE the dots (inverted). Where the two
  // masks meet, you see the dot pattern — a halftone cross-fade.
  const isExiting = presentationDirection === "exiting";
  const maxR = (cellSize / Math.sqrt(2)) * 1.05;
  const r = presentationProgress * maxR;

  const dotFill = isExiting ? "black" : "white";
  const bgFill = isExiting ? "white" : "black";

  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 1080 1920"
      preserveAspectRatio="none"
      style={{ position: "absolute", inset: 0 }}
    >
      <defs>
        <pattern
          id={`${id}-p`}
          width={cellSize}
          height={cellSize}
          patternUnits="userSpaceOnUse"
        >
          <rect width={cellSize} height={cellSize} fill={bgFill} />
          <circle
            cx={cellSize / 2}
            cy={cellSize / 2}
            r={r}
            fill={dotFill}
          />
        </pattern>
        <mask id={`${id}-m`}>
          <rect width="1080" height="1920" fill={`url(#${id}-p)`} />
        </mask>
      </defs>
      <foreignObject
        x="0"
        y="0"
        width="1080"
        height="1920"
        mask={`url(#${id}-m)`}
      >
        <div
          style={{
            position: "relative",
            width: "1080px",
            height: "1920px",
          }}
        >
          {children}
        </div>
      </foreignObject>
    </svg>
  );
};

export const halftoneBlend = (
  props: HalftoneBlendProps = {},
): TransitionPresentation<HalftoneBlendProps> => ({
  component: HalftoneBlendPresentation,
  props,
});
