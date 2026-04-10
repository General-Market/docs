import React from "react";
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLOR, TYPE } from "../designTokens";
import { FPS } from "../theme";

const sec = (s: number) => Math.round(s * FPS);

const ITEMS = ["Liquidity", "Capital Lock", "Risk Management"];

/**
 * Simple ticker bar showing the 3 promises.
 * Appears at 11.28s when speaker first names them, holds through 22.2s.
 * Clean lower-third, no clutter.
 */
const TickerBar: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enterSpring = spring({
    frame,
    fps,
    config: { damping: 16, stiffness: 140, mass: 0.7 },
    durationInFrames: 20,
  });

  const totalFrames = sec(22.2 - 11.28);
  const exitOpacity = interpolate(
    frame,
    [totalFrames - 15, totalFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const opacity = Math.min(enterSpring, exitOpacity);
  const slideY = interpolate(enterSpring, [0, 1], [40, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  if (opacity < 0.01) return null;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 60,
        left: "50%",
        transform: `translateX(-50%) translateY(${slideY}px)`,
        opacity,
        display: "flex",
        gap: 12,
        pointerEvents: "none",
      }}
    >
      {ITEMS.map((item, i) => {
        const itemDelay = i * sec(0.4);
        const itemProg = spring({
          frame: Math.max(frame - itemDelay, 0),
          fps,
          config: { damping: 14, stiffness: 160, mass: 0.6 },
          durationInFrames: 15,
        });

        return (
          <div
            key={item}
            style={{
              background: COLOR.panelDark,
              borderRadius: 9999,
              padding: "12px 24px",
              display: "flex",
              alignItems: "center",
              gap: 8,
              opacity: itemProg,
              transform: `scale(${interpolate(itemProg, [0, 1], [0.8, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              })})`,
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: COLOR.wiseGreen,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                ...TYPE.bodySemiboldDark,
                whiteSpace: "nowrap",
              }}
            >
              {item}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export const PromiseTicker: React.FC = () => {
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <Sequence from={sec(11.28)} durationInFrames={sec(22.2 - 11.28)}>
        <TickerBar />
      </Sequence>
    </AbsoluteFill>
  );
};
