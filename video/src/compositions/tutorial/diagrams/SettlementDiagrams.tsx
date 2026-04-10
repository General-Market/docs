import React from "react";
import {
  AbsoluteFill,
  Easing,
  Sequence,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { COLOR, TYPE } from "../designTokens";
import { FPS } from "../theme";
import { DiagramCard } from "../components/DiagramCard";
import { Sfx } from "../components/Sfx";

const sec = (s: number) => Math.round(s * FPS);
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);

const CYCLE_IN = sec(10.56);
const CYCLE_OUT = sec(36.26);

const JOIN_AT = sec(7.9);
const ORACLE_AT = sec(15.8);
const SETTLE_AT = sec(22.0);

// Voice-synced stepped progress (local seconds from SettlementCard mount):
// Card appears at 100.4s global (10.56s into section).
// ~7.9s local = 108.3s global → voice says "bet" → JOIN lights up
// ~15.8s local = 116.2s global → voice says "Oracle" → ORACLE lights up
// ~22.0s local = 122.4s global → voice says "compute PL" → SETTLE lights up
// Card fades out at ~126.1s global (36.26s into section).

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

  // Stepped progress — each phase snaps into place and HOLDS until the next
  const SNAP = 5; // frames (~0.17s) for a quick visual snap

  const progress = interpolate(
    frame,
    [sec(0.5), JOIN_AT - SNAP, JOIN_AT, ORACLE_AT - SNAP, ORACLE_AT, SETTLE_AT - SNAP, SETTLE_AT],
    [0, 0, 33, 33, 66, 66, 100],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const exitOpacity = interpolate(frame, [duration - 15, duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const steps = [
    { label: "Join", at: 5 },
    { label: "Oracle", at: 34 },
    { label: "Settle", at: 67 },
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
        {/* Hero text "10 min" appearing */}
        <Sfx sound="text-appear-blip" volume={0.3} />
        {/* Progress bar stepping to each phase */}
        <Sfx sound="scroll-tick" volume={0.3} delay={JOIN_AT} />
        <Sfx sound="scroll-tick" volume={0.3} delay={ORACLE_AT} />
        <Sfx sound="scroll-tick" volume={0.3} delay={SETTLE_AT} />
        {/* Three green pills appearing */}
        <Sfx sound="comedy-plop" volume={0.2} delay={sec(0.5)} />
        <Sfx sound="comedy-plop" volume={0.2} delay={sec(0.7)} />
        <Sfx sound="comedy-plop" volume={0.2} delay={sec(0.9)} />
      </Sequence>
    </AbsoluteFill>
  );
};
