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
import { COMPARISONS } from "../proofData";
import { DiagramCardDark } from "../components/DiagramCard";

const sec = (s: number) => Math.round(s * FPS);

const AMBER = "#F59E0B";
const DOT_SIZE = 10;

// Local timing (frame 0 = 161.40s in video)
const DISPUTE_IN = sec(19.8);
const DISPUTE_OUT = sec(32.6);

// ---------------------------------------------------------------------------
// DISPUTE TIMELINE COMPARISON (19.8s-32.6s local)
// ---------------------------------------------------------------------------

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

  // Panel entrance
  const panelEnter = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 100, mass: 0.9 },
  });

  const panelY = interpolate(panelEnter, [0, 1], [80, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const panelOpacity = interpolate(panelEnter, [0, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Traditional timeline stretches (90% width)
  const tradBarProgress = interpolate(frame, [sec(0.5), sec(3)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });

  // GM timeline (short — 10% width)
  const gmBarProgress = interpolate(frame, [sec(1.5), sec(2.5)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });

  // Traditional dispute fill animation (pulsing red)
  const disputePulse = 0.3 + 0.15 * Math.sin(frame * 0.1);

  // GM green glow
  const gmGlow = 0.6 + 0.2 * Math.sin(frame * 0.12);

  // Traditional: milestones
  const tradMilestones = [
    { label: "Order", pos: 0 },
    { label: "Trade", pos: 0.08 },
    { label: "Challenge: 7 DAYS", pos: 0.15, isDispute: true },
    { label: "Resolution", pos: 0.95 },
  ];

  // GM: milestones
  const gmMilestones = [
    { label: "Bet", pos: 0 },
    { label: "Settlement: 10 MIN", pos: 0.25, isGreen: true },
    { label: "PNL", pos: 0.55 },
    { label: "WITHDRAW", pos: 0.85 },
  ];

  // Polymarket annotation
  const annotationOpacity = interpolate(
    frame,
    [sec(4), sec(5)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <DiagramCardDark width={1500} padding="40px 48px">
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 48,
          opacity: Math.min(panelOpacity, exitOpacity),
          transform: `translateY(${panelY}px)`,
          position: "relative",
        }}
      >
        {/* TRADITIONAL timeline */}
        <div>
          <div
            style={{
              ...TYPE.cardTitleDark,
              color: COLOR.danger,
              marginBottom: 16,
            }}
          >
            TRADITIONAL
          </div>

          {/* Timeline bar */}
          <div style={{ position: "relative", height: 50 }}>
            {/* Track */}
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 20,
                height: 10,
                borderRadius: 5,
                background: COLOR.border,
                opacity: 0.15,
              }}
            />

            {/* Dispute fill (the massive red zone) */}
            <div
              style={{
                position: "absolute",
                left: `${0.15 * 100}%`,
                width: `${Math.max(0, (0.95 - 0.15) * tradBarProgress * 100)}%`,
                top: 16,
                height: 18,
                borderRadius: 9,
                background: COLOR.danger,
                opacity: disputePulse,
              }}
            />

            {/* Milestones */}
            {tradMilestones.map((m, i) => {
              const mDelay = sec(0.5) + i * sec(0.4);
              const mOpacity = interpolate(
                frame - mDelay,
                [0, 8],
                [0, 1],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
              );

              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: `${m.pos * 100}%`,
                    top: 0,
                    transform: "translateX(-50%)",
                    opacity: mOpacity,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                  }}
                >
                  {/* Dot */}
                  <div
                    style={{
                      width: DOT_SIZE,
                      height: DOT_SIZE,
                      borderRadius: "50%",
                      background: m.isDispute ? COLOR.danger : COLOR.gray,
                      marginBottom: 4,
                    }}
                  />
                  {/* Label */}
                  <div
                    style={{
                      ...TYPE.labelDark,
                      position: "absolute",
                      top: 36,
                      fontWeight: m.isDispute ? 700 : TYPE.labelDark.fontWeight,
                      color: m.isDispute ? COLOR.danger : COLOR.gray,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {m.label}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Parasite labels for traditional */}
          <div
            style={{
              display: "flex",
              gap: 32,
              marginTop: 32,
              opacity: interpolate(frame, [sec(3), sec(4)], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            {["dispute window", "manual review", "voter incentives"].map(
              (label, i) => (
                <div
                  key={i}
                  style={{
                    ...TYPE.captionDark,
                    color: COLOR.danger,
                    opacity: 0.6,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  {label}
                </div>
              ),
            )}
          </div>
        </div>

        {/* GM timeline */}
        <div>
          <div
            style={{
              ...TYPE.cardTitleDark,
              color: COLOR.wiseGreen,
              marginBottom: 16,
            }}
          >
            GENERAL MARKET
          </div>

          {/* Timeline bar — only 10% of width to show the dramatic difference */}
          <div style={{ position: "relative", height: 50, width: "15%" }}>
            {/* Track */}
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 20,
                height: 10,
                borderRadius: 5,
                background: COLOR.border,
                opacity: 0.15,
              }}
            />

            {/* Green fill */}
            <div
              style={{
                position: "absolute",
                left: 0,
                width: `${gmBarProgress * 100}%`,
                top: 16,
                height: 18,
                borderRadius: 9,
                background: COLOR.wiseGreen,
                opacity: gmGlow * 0.5,
                boxShadow: `0 0 16px ${COLOR.wiseGreen}`,
              }}
            />

            {/* Milestones */}
            {gmMilestones.map((m, i) => {
              const mDelay = sec(1.5) + i * sec(0.3);
              const mOpacity = interpolate(
                frame - mDelay,
                [0, 8],
                [0, 1],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
              );

              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: `${m.pos * 100}%`,
                    top: 0,
                    transform: "translateX(-50%)",
                    opacity: mOpacity,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      width: DOT_SIZE,
                      height: DOT_SIZE,
                      borderRadius: "50%",
                      background: COLOR.wiseGreen,
                      boxShadow: m.isGreen
                        ? `0 0 8px ${COLOR.wiseGreen}`
                        : undefined,
                    }}
                  />
                  <div
                    style={{
                      ...TYPE.labelDark,
                      position: "absolute",
                      top: 36,
                      fontWeight: m.isGreen ? 700 : TYPE.labelDark.fontWeight,
                      color: COLOR.wiseGreen,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {m.label}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Parasite labels for GM */}
          <div
            style={{
              display: "flex",
              gap: 32,
              marginTop: 32,
              opacity: interpolate(frame, [sec(3.5), sec(4.5)], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            {["automatic", "oracle consensus", "instant"].map((label, i) => (
              <div
                key={i}
                style={{
                  ...TYPE.captionDark,
                  color: COLOR.wiseGreen,
                  opacity: 0.7,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* Polymarket annotation */}
        <div
          style={{
            position: "absolute",
            right: 48,
            top: 44,
            opacity: annotationOpacity,
            maxWidth: 280,
          }}
        >
          <div
            style={{
              ...TYPE.captionDark,
              color: COLOR.gray,
              textAlign: "right",
            }}
          >
            Polymarket disputes can take{" "}
            <span style={{ color: AMBER, fontWeight: 700 }}>weeks</span>.
            <br />
            GM settles in{" "}
            <span style={{ color: COLOR.wiseGreen, fontWeight: 700 }}>
              {COMPARISONS.gmSettlement}
            </span>
            .
          </div>
        </div>
      </div>
    </DiagramCardDark>
  );
};

// ---------------------------------------------------------------------------
// Main composition — frame 0 = 161.40s in video
// ---------------------------------------------------------------------------

export const PrivacyDiagrams: React.FC = () => {
  return (
    <AbsoluteFill>
      {/* Dispute Timeline only — other diagrams removed */}
      <Sequence from={DISPUTE_IN} durationInFrames={DISPUTE_OUT - DISPUTE_IN}>
        <DisputeTimeline />
        <Audio src={staticFile("sfx/metal-latch-unlock.mp3")} volume={0.5} />
      </Sequence>
    </AbsoluteFill>
  );
};
