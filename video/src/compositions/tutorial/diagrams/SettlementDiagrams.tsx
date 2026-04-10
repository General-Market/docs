import React from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { COLOR, TYPE } from "../designTokens";
import { FPS } from "../theme";
import { DiagramCard } from "../components/DiagramCard";

const sec = (s: number) => Math.round(s * FPS);
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);

const CYCLE_IN = sec(10.56);
const CYCLE_OUT = sec(23.96);

// Voice-synced progress points (local seconds from CYCLE_IN):
// 0s = card appears (speaker: "30 times the question...")
// 7.2s = "everyone pushes bets in a 10 minute window" → BETTING phase done
// 13.4s = "Oracle compute who was right" → ORACLE phase done
// end = SETTLE complete

const SettlementCard: React.FC = () => {
  const frame = useCurrentFrame();
  const duration = CYCLE_OUT - CYCLE_IN;

  const row = (delay: number) => {
    const p = interpolate(frame - sec(delay), [0, sec(0.4)], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: EASE_OUT,
    });
    return {
      opacity: p,
      transform: `translateY(${(1 - p) * 12}px)`,
    };
  };

  // Voice-synced progress bar
  const progress = interpolate(
    frame,
    [sec(0.5), sec(7.2), sec(13.4), duration - 15],
    [0, 55, 78, 100],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const exitOpacity = interpolate(frame, [duration - 15, duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const steps = [
    { label: "Bet", at: 0 },
    { label: "Oracle", at: 55 },
    { label: "Settle", at: 78 },
  ];

  return (
    <DiagramCard>
      <div style={{ opacity: exitOpacity }}>
        {/* Hero */}
        <div style={{ ...row(0), marginBottom: 56 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 20 }}>
            <span style={{ ...TYPE.displayHero, color: COLOR.wiseGreen }}>10 min</span>
            <span style={{ ...TYPE.cardTitle, color: COLOR.gray }}>settlement</span>
          </div>
        </div>

        {/* Progress bar synced to voice */}
        <div style={{ ...row(0.2), marginBottom: 48 }}>
          <div style={{ height: 10, background: COLOR.lightSurface, borderRadius: 5, overflow: "hidden", position: "relative" }}>
            <div style={{ height: "100%", width: `${progress}%`, background: COLOR.wiseGreen, borderRadius: 5 }} />
          </div>
          {/* Step markers */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
            {steps.map((s) => (
              <span
                key={s.label}
                style={{
                  ...TYPE.bodySemibold,
                  color: progress >= s.at ? COLOR.wiseGreen : COLOR.gray,
                }}
              >
                {s.label}
              </span>
            ))}
          </div>
        </div>

        {/* Three green pills */}
        <div style={{ ...row(0.5), display: "flex", gap: 16 }}>
          {["$0 fees", "$0 spread", "No disputes"].map((f) => (
            <div
              key={f}
              style={{
                background: COLOR.lightMint,
                color: COLOR.darkGreen,
                borderRadius: 9999,
                padding: "12px 32px",
                ...TYPE.bodySemibold,
              }}
            >
              {f}
            </div>
          ))}
        </div>
      </div>
    </DiagramCard>
  );
};

export const SettlementDiagrams: React.FC = () => {
  return (
    <AbsoluteFill>
      <Sequence from={CYCLE_IN} durationInFrames={CYCLE_OUT - CYCLE_IN}>
        <SettlementCard />
        <Audio src={staticFile("sfx/scroll-tick.mp3")} volume={0.4} />
      </Sequence>
    </AbsoluteFill>
  );
};
