import React from "react";
import { useCurrentFrame, interpolate, Easing } from "remotion";

type Props = {
  startFrame: number;
  durationFrames?: number;
  tearColor?: string;
  flashColor?: string;
};

export const PageTear: React.FC<Props> = ({
  startFrame,
  durationFrames = 14,
  tearColor = "#08070a",
  flashColor = "#ffffff",
}) => {
  const frame = useCurrentFrame();
  const local = frame - startFrame;
  if (local < 0 || local > durationFrames) return null;

  const t = local / durationFrames;
  const id = React.useId();

  const split = interpolate(t, [0, 0.4, 1], [0, 80, 600], {
    easing: Easing.out(Easing.expo),
  });
  const flash = interpolate(t, [0, 0.25, 0.55, 1], [0, 1, 0.4, 0]);
  const seed = Math.floor(startFrame / 11);

  // The tear runs diagonally, slightly off-axis: from top-left edge to
  // bottom-right edge. Two halves clip-path along the line + drift away.
  const topClip = "polygon(0 0, 110% 0, 110% 60%, 0 40%)";
  const bottomClip = "polygon(0 40%, 110% 60%, 110% 110%, 0 110%)";

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
      }}
    >
      <svg
        style={{ position: "absolute", width: 0, height: 0 }}
        aria-hidden
      >
        <defs>
          <filter
            id={`${id}-rough`}
            x="-5%"
            y="-5%"
            width="110%"
            height="110%"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.04 0.012"
              numOctaves={2}
              seed={seed}
              result="n"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="n"
              scale={36}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

      <div
        style={{
          position: "absolute",
          inset: 0,
          clipPath: topClip,
          transform: `translateY(${-split}px)`,
          background: tearColor,
          filter: `url(#${id}-rough)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          clipPath: bottomClip,
          transform: `translateY(${split}px)`,
          background: tearColor,
          filter: `url(#${id}-rough)`,
        }}
      />

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: "calc(40% + 0px)",
          height: `calc(20% + ${split * 0.3}px)`,
          background: `linear-gradient(180deg, transparent, ${flashColor} 50%, transparent)`,
          opacity: flash,
          mixBlendMode: "screen",
          filter: `url(#${id}-rough)`,
        }}
      />
    </div>
  );
};
