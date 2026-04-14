/**
 * BeginnerHedgeFundList — voice-synced pills for the
 * "Whether you are a beginner or already a hedge fund manager" line.
 *
 * Same pill style as PromiseTicker (Liquidity / Capital Lock / Risk Management).
 * Each label springs in when the speaker names it.
 *
 * Transcript:
 *   "beginner"           — 37.28s
 *   "hedge fund manager" — 38.56s
 *
 * Active scene: 36.4–41.0s (right-small layout).
 */

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
import { COLOR, TYPE } from "../designTokens";
import { useTalkingHead } from "../TalkingHeadLayout";
import { Sfx } from "../components/Sfx";
import { PLOB_ACCENT } from "../sfxMap";

const sec = (s: number) => Math.round(s * FPS);

const ITEMS: { label: string; voiceSec: number }[] = [
  { label: "Beginner", voiceSec: 37.28 },
  { label: "Hedge Fund Manager", voiceSec: 38.56 },
];

const APPEAR_START = 37.0;
const HOLD_UNTIL = 41.0;

const PillColumn: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { contentArea } = useTalkingHead();

  const totalFrames = sec(HOLD_UNTIL - APPEAR_START);
  const exitOpacity = interpolate(
    frame,
    [totalFrames - 18, totalFrames],
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
              maxWidth: "100%",
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

export const BeginnerHedgeFundList: React.FC = () => {
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <Sequence
        from={sec(APPEAR_START)}
        durationInFrames={sec(HOLD_UNTIL - APPEAR_START)}
      >
        <PillColumn />
        {ITEMS.map((item) => (
          <Sfx
            key={item.label}
            sound={PLOB_ACCENT}
            delay={sec(item.voiceSec - APPEAR_START)}
          />
        ))}
      </Sequence>
    </AbsoluteFill>
  );
};
