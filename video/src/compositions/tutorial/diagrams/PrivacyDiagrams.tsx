import React from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { EASE } from "../../../common/easing";
import { COLOR, TYPE } from "../designTokens";
import { FPS } from "../theme";
import { DiagramCard } from "../components/DiagramCard";

const sec = (s: number) => Math.round(s * FPS);

// Local timing (frame 0 = 161.40s in video)
const DISPUTE_IN = sec(19.8);
const DISPUTE_OUT = sec(32.6);

// Bar geometry
const BAR_HEIGHT = 14;
const BAR_RADIUS = 7;
const TRAD_BAR_WIDTH = 940;
const GM_BAR_WIDTH = 120;

const DisputeTimeline: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const localDuration = DISPUTE_OUT - DISPUTE_IN;

  const exitOpacity = interpolate(
    frame,
    [localDuration - 15, localDuration],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Traditional bar fills slowly across 2.5s
  const tradProgress = interpolate(frame, [sec(0.4), sec(2.9)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });

  // GM bar fills fast — 0.4s
  const gmProgress = interpolate(frame, [sec(1.8), sec(2.2)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });

  // Traditional milestone labels fade in staggered
  const tradLabelOpacity = interpolate(frame, [sec(2.6), sec(3.2)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // GM milestone labels
  const gmLabelOpacity = interpolate(frame, [sec(2.0), sec(2.6)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // The "700x faster" stat punches in with spring
  const statSpring = spring({
    frame: frame - sec(3.5),
    fps,
    config: { damping: 10, stiffness: 120, mass: 0.8 },
  });

  const statScale = interpolate(statSpring, [0, 1], [0.6, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const statOpacity = interpolate(statSpring, [0, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <DiagramCard>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 40,
          opacity: exitOpacity,
        }}
      >
        {/* Section label */}
        <div style={{ ...TYPE.label }}>Settlement Speed</div>

        {/* Traditional */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ ...TYPE.cardTitle }}>Traditional</div>

          {/* Bar track */}
          <div
            style={{
              width: TRAD_BAR_WIDTH,
              height: BAR_HEIGHT,
              borderRadius: BAR_RADIUS,
              background: COLOR.lightSurface,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${tradProgress * 100}%`,
                height: "100%",
                borderRadius: BAR_RADIUS,
                background: COLOR.danger,
              }}
            />
          </div>

          {/* Milestone labels */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              width: TRAD_BAR_WIDTH,
              opacity: tradLabelOpacity,
            }}
          >
            <span style={{ ...TYPE.caption }}>Order</span>
            <span style={{ ...TYPE.caption }}>Trade</span>
            <span
              style={{
                ...TYPE.caption,
                color: COLOR.danger,
                fontWeight: 600,
              }}
            >
              Challenge: 7 DAYS
            </span>
            <span style={{ ...TYPE.caption }}>Resolution</span>
          </div>
        </div>

        {/* General Market */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ ...TYPE.cardTitle }}>General Market</div>

          {/* Bar track */}
          <div
            style={{
              width: TRAD_BAR_WIDTH,
              height: BAR_HEIGHT,
              borderRadius: BAR_RADIUS,
              background: COLOR.lightSurface,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: gmProgress * GM_BAR_WIDTH,
                height: "100%",
                borderRadius: BAR_RADIUS,
                background: COLOR.wiseGreen,
              }}
            />
          </div>

          {/* Milestone labels */}
          <div
            style={{
              display: "flex",
              gap: 32,
              width: GM_BAR_WIDTH + 80,
              opacity: gmLabelOpacity,
            }}
          >
            <span style={{ ...TYPE.caption }}>Bet</span>
            <span style={{ ...TYPE.caption }}>Settle</span>
            <span style={{ ...TYPE.caption }}>Withdraw</span>
          </div>

          <div
            style={{
              ...TYPE.captionSemibold,
              color: COLOR.wiseGreen,
              opacity: gmLabelOpacity,
            }}
          >
            10 min
          </div>
        </div>

        {/* Divider */}
        <div
          style={{
            width: "100%",
            height: 1,
            background: COLOR.border,
          }}
        />

        {/* 700x faster — the knife */}
        <div
          style={{
            ...TYPE.sectionHeading,
            color: COLOR.wiseGreen,
            opacity: statOpacity,
            transform: `scale(${statScale})`,
            transformOrigin: "left center",
          }}
        >
          700x faster settlement
        </div>
      </div>
    </DiagramCard>
  );
};

export const PrivacyDiagrams: React.FC = () => {
  return (
    <AbsoluteFill>
      <Sequence from={DISPUTE_IN} durationInFrames={DISPUTE_OUT - DISPUTE_IN}>
        <DisputeTimeline />
        <Audio src={staticFile("sfx/metal-latch-unlock.mp3")} volume={0.5} />
      </Sequence>
    </AbsoluteFill>
  );
};
