import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { SceneFrame, font, monoFont, scene } from "../props";

// 0.04% TOOK 70% — "Where the winnings go".
//
// One horizontal pot of winnings, split grossly by value. A tiny sliver of
// traders (0.04%) takes 70% of the wins; the entire rest of the crowd
// (99.96%) splits the remaining 30%. The visual injustice: the sliver of
// PEOPLE is almost invisible, yet it owns most of the VALUE.

const STAGE_W = 1480;
const STAGE_LEFT = (1920 - STAGE_W) / 2;
const STAGE_TOP = 380;

const BAR_W = STAGE_W;
const BAR_H = 150;

// Value split, left → right. The winners' slice fills most of the bar.
const WINNERS_VALUE = 0.7; // 70% of wins
// People split, drawn as a thin second bar below to show the inversion.
const WINNERS_PEOPLE = 0.0004; // 0.04% of traders

const Slice: React.FC<{
  left: number;
  width: number;
  color: string;
  glow: boolean;
  grow: number;
}> = ({ left, width, color, glow, grow }) => (
  <div
    style={{
      position: "absolute",
      left,
      top: 0,
      width: Math.max(0, width * grow),
      height: BAR_H,
      background: color,
      boxShadow: glow
        ? `0 0 0 1px ${scene.accentSoft} inset, 0 14px 36px rgba(0,82,255,0.34)`
        : "inset 0 0 0 1px rgba(255,255,255,0.10)",
    }}
  />
);

export const ParetoSplit: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const grow = spring({
    fps,
    frame: Math.max(0, frame - 16),
    config: { mass: 0.7, damping: 16, stiffness: 110 },
    durationInFrames: 30,
  });

  const labelOp = interpolate(frame, [40, 56], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const statOp = interpolate(frame, [56, 74], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const statY = interpolate(frame, [56, 74], [16, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const breath = 0.5 + 0.5 * Math.sin((frame / fps) * 2.2);

  const winnersW = BAR_W * WINNERS_VALUE;
  const restW = BAR_W * (1 - WINNERS_VALUE);

  // The second (people) bar: the winners are a hairline; the crowd is the rest.
  const peopleBarW = BAR_W;
  const peopleWinW = Math.max(4, peopleBarW * WINNERS_PEOPLE * 60); // exaggerated to ~stay visible as a hairline marker
  const peopleY = BAR_H + 92;

  return (
    <SceneFrame kicker="0.04% TOOK 70%" title="Where the winnings go">
      <AbsoluteFill>
        <div
          style={{
            position: "absolute",
            left: STAGE_LEFT,
            top: STAGE_TOP,
            width: STAGE_W,
          }}
        >
          {/* Heading for the value bar */}
          <div
            style={{
              position: "absolute",
              top: -38,
              left: 0,
              fontFamily: monoFont,
              fontSize: 15,
              fontWeight: 600,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: scene.inkDim,
              opacity: labelOp,
            }}
          >
            The wins
          </div>

          {/* The value pot */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: BAR_W,
              height: BAR_H,
              borderRadius: 18,
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            {/* Winners' 70% — the dominant lit slice */}
            <Slice left={0} width={winnersW} color={scene.accent} glow grow={grow} />
            {/* The crowd's 30% — faint */}
            <div
              style={{
                position: "absolute",
                left: winnersW * grow,
                top: 0,
                width: restW * grow,
                height: BAR_H,
                background: "rgba(255,255,255,0.10)",
                boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)",
              }}
            />
          </div>

          {/* In-bar callouts */}
          <div
            style={{
              position: "absolute",
              top: BAR_H / 2 - 36,
              left: 36,
              opacity: labelOp,
            }}
          >
            <div
              style={{
                fontFamily: font,
                fontSize: 64,
                fontWeight: 800,
                letterSpacing: "-0.022em",
                color: scene.ink,
                fontVariantNumeric: "tabular-nums",
                lineHeight: 1.0,
              }}
            >
              70%
            </div>
            <div
              style={{
                fontFamily: monoFont,
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: scene.inkSoft,
                marginTop: 6,
              }}
            >
              taken by 0.04%
            </div>
          </div>
          <div
            style={{
              position: "absolute",
              top: BAR_H / 2 - 22,
              left: winnersW + 36,
              opacity: labelOp,
              fontFamily: monoFont,
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: "0.04em",
              color: scene.inkDim,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            30% · everyone else
          </div>

          {/* The inversion: who those people are */}
          <div
            style={{
              position: "absolute",
              top: peopleY - 36,
              left: 0,
              fontFamily: monoFont,
              fontSize: 15,
              fontWeight: 600,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: scene.inkDim,
              opacity: statOp,
            }}
          >
            The people
          </div>
          <div
            style={{
              position: "absolute",
              top: peopleY,
              left: 0,
              width: peopleBarW,
              height: 40,
              borderRadius: 10,
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.10)",
              opacity: statOp,
            }}
          >
            {/* The 0.04% — a near-invisible accent hairline at the far left */}
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: peopleWinW,
                height: 40,
                background: scene.accent,
                boxShadow: `0 0 0 1px ${scene.accentSoft} inset`,
                opacity: 0.8 + 0.2 * breath,
              }}
            />
            {/* The 99.96% crowd */}
            <div
              style={{
                position: "absolute",
                left: peopleWinW,
                top: 0,
                width: peopleBarW - peopleWinW,
                height: 40,
                background: "rgba(255,255,255,0.08)",
              }}
            />
          </div>
          <div
            style={{
              position: "absolute",
              top: peopleY + 4,
              left: peopleWinW + 20,
              opacity: statOp,
              fontFamily: monoFont,
              fontSize: 17,
              fontWeight: 600,
              letterSpacing: "0.04em",
              color: scene.inkSoft,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            99.96% of traders share 30%
          </div>

          {/* Mono stat callout */}
          <div
            style={{
              position: "absolute",
              top: peopleY + 96,
              left: 0,
              right: 0,
              textAlign: "center",
              opacity: statOp,
              transform: `translateY(${statY.toFixed(1)}px)`,
            }}
          >
            <div
              style={{
                fontFamily: monoFont,
                fontSize: 20,
                fontWeight: 500,
                letterSpacing: "0.06em",
                color: scene.inkSoft,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              0.04% of traders · 70% of all winnings
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </SceneFrame>
  );
};
