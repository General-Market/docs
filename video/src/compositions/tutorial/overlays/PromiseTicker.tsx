import React from "react";
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { FPS } from "../theme";
import { useDesignTokens } from "../TutorialTheme";
import { useTalkingHead } from "../TalkingHeadLayout";
import { Sfx } from "../components/Sfx";

const sec = (s: number) => Math.round(s * FPS);

/**
 * Voice-synced promise pills. Each appears when the speaker names it.
 * Transcript timestamps:
 *   "liquidity"       — 18.32s
 *   "capital lock"    — 19.28s
 *   "risk management" — 20.32s
 *
 * Rendered in the content area (next to webcam), column layout.
 */

const ITEMS: { label: string; voiceSec: number }[] = [
  { label: "Liquidity", voiceSec: 18.32 },
  { label: "Capital Lock", voiceSec: 19.28 },
  { label: "Risk Management", voiceSec: 20.32 },
];

const APPEAR_START = 18.32; // first word spoken
const HOLD_UNTIL = 21.0; // fade out before particle transition takes over

const TickerColumn: React.FC = () => {
  const { COLOR, TYPE } = useDesignTokens();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { contentArea } = useTalkingHead();

  const totalFrames = sec(HOLD_UNTIL - APPEAR_START);
  const exitOpacity = interpolate(
    frame,
    [totalFrames - 15, totalFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  if (!contentArea) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: contentArea.x,
        top: contentArea.y,
        width: contentArea.w,
        height: contentArea.h,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "0 56px",
        gap: 20,
        opacity: exitOpacity,
        pointerEvents: "none",
      }}
    >
      {ITEMS.map((item) => {
        const itemFrame = frame - sec(item.voiceSec - APPEAR_START);
        const itemProg = spring({
          frame: Math.max(itemFrame, 0),
          fps,
          config: { damping: 14, stiffness: 160, mass: 0.6 },
          durationInFrames: 15,
        });

        if (itemProg < 0.01) return null;

        return (
          <div
            key={item.label}
            style={{
              background: COLOR.lightMint,
              borderRadius: 9999,
              padding: "18px 40px",
              display: "flex",
              alignItems: "center",
              gap: 14,
              opacity: itemProg,
              transform: `scale(${interpolate(itemProg, [0, 1], [0.8, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              })}) translateY(${interpolate(itemProg, [0, 1], [20, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              })}px)`,
              alignSelf: "flex-start",
            }}
          >
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: COLOR.wiseGreen,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                ...TYPE.subHeading,
                color: COLOR.darkGreen,
                whiteSpace: "nowrap",
              }}
            >
              {item.label}
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
      <Sequence from={sec(APPEAR_START)} durationInFrames={sec(HOLD_UNTIL - APPEAR_START)}>
        <TickerColumn />
        {/* Plop per pill entrance — frames relative to APPEAR_START */}
        {ITEMS.map((item) => (
          <Sfx
            key={item.label}
            delay={sec(item.voiceSec - APPEAR_START)}
            volume={0.25}
          />
        ))}
      </Sequence>
    </AbsoluteFill>
  );
};
