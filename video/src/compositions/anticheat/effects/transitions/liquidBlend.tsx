import React from "react";
import type {
  TransitionPresentation,
  TransitionPresentationComponentProps,
} from "@remotion/transitions";

export type LiquidBlendProps = {
  strength?: number;
  bandWidth?: number;
};

const LiquidBlendPresentation: React.FC<
  TransitionPresentationComponentProps<LiquidBlendProps>
> = ({ children, presentationProgress, presentationDirection, passedProps }) => {
  const id = React.useId();
  const strength = passedProps.strength ?? 90;
  const band = passedProps.bandWidth ?? 0.16;

  // Exiting scene renders without a mask; the entering scene rides on top
  // and reveals through a turbulence-displaced wipe. As progress runs 0 → 1,
  // a soft horizontal band travels from the top of the frame to the bottom.
  if (presentationDirection === "exiting") {
    return <>{children}</>;
  }

  const p = presentationProgress;
  const b = -band / 2 + p * (1 + band);
  const lo = Math.max(0, Math.min(1, b - band / 2));
  const hi = Math.max(0, Math.min(1, b + band / 2));
  const seed = Math.floor(p * 64);

  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 1080 1920"
      preserveAspectRatio="none"
      style={{ position: "absolute", inset: 0 }}
    >
      <defs>
        <filter id={`${id}-d`} x="0" y="0" width="100%" height="100%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.012 0.022"
            numOctaves={2}
            seed={seed}
            result="n"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="n"
            scale={strength}
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="white" />
          <stop offset={`${lo * 100}%`} stopColor="white" />
          <stop offset={`${hi * 100}%`} stopColor="black" />
          <stop offset="100%" stopColor="black" />
        </linearGradient>
        <mask id={`${id}-m`}>
          <rect
            width="1080"
            height="1920"
            fill={`url(#${id}-g)`}
            filter={`url(#${id}-d)`}
          />
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

export const liquidBlend = (
  props: LiquidBlendProps = {},
): TransitionPresentation<LiquidBlendProps> => ({
  component: LiquidBlendPresentation,
  props,
});
