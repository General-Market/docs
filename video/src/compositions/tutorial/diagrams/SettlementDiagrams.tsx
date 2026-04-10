import React from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { EASE } from "../../../common/easing";
import { COLOR, TYPE } from "../designTokens";
import { FPS } from "../theme";
import { DiagramCard } from "../components/DiagramCard";

const sec = (s: number) => Math.round(s * FPS);

// Diagram appears at local 10.56s, exits at 23.96s
const CYCLE_IN = sec(10.56);
const CYCLE_OUT = sec(23.96);

// Phase boundaries (normalized 0–1)
const PHASE_BETTING = 0.55;
const PHASE_ORACLE = 0.78;

// Bar geometry
const BAR_W = 960;
const BAR_H = 10;
const DOT_R = 8;

const PHASES = [
  { label: "BETTING", duration: "10 min", pos: 0 },
  { label: "ORACLE", duration: "30 sec", pos: PHASE_BETTING },
  { label: "SETTLE", duration: "Instant", pos: PHASE_ORACLE },
] as const;

const BADGES = ["$0 fees", "$0 spread", "No disputes"] as const;

const SettlementCard: React.FC = () => {
  const frame = useCurrentFrame();

  const opacity = (() => {
    const enterOp = interpolate(frame, [CYCLE_IN, CYCLE_IN + 15], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const exitOp = interpolate(frame, [CYCLE_OUT - 15, CYCLE_OUT], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    return Math.min(enterOp, exitOp);
  })();

  const localFrame = frame - CYCLE_IN;
  const totalDuration = CYCLE_OUT - CYCLE_IN;

  const progress = interpolate(localFrame, [0, totalDuration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.smooth,
  });

  const fillWidth = progress * BAR_W;

  // Badge stagger — fade in during settle phase
  const badgeDelay = (i: number) =>
    interpolate(progress, [0.7 + i * 0.06, 0.76 + i * 0.06], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

  return (
    <div style={{ opacity }}>
      <DiagramCard width={1200}>
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          {/* Label */}
          <div style={{ ...TYPE.label }}>10-MINUTE SETTLEMENT</div>

          {/* Progress bar + dots */}
          <div style={{ position: "relative", width: BAR_W, height: DOT_R * 2 + 20 }}>
            {/* Track */}
            <div
              style={{
                position: "absolute",
                top: DOT_R - BAR_H / 2,
                left: 0,
                width: BAR_W,
                height: BAR_H,
                borderRadius: BAR_H / 2,
                background: COLOR.lightSurface,
              }}
            />

            {/* Fill */}
            <div
              style={{
                position: "absolute",
                top: DOT_R - BAR_H / 2,
                left: 0,
                width: fillWidth,
                height: BAR_H,
                borderRadius: BAR_H / 2,
                background: COLOR.wiseGreen,
              }}
            />

            {/* Dot markers at each phase boundary */}
            {[0, PHASE_BETTING, PHASE_ORACLE].map((pos, i) => {
              const dotX = pos * BAR_W;
              const filled = progress >= pos;
              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: dotX - DOT_R,
                    top: 0,
                    width: DOT_R * 2,
                    height: DOT_R * 2,
                    borderRadius: "50%",
                    background: filled ? COLOR.wiseGreen : COLOR.lightSurface,
                    border: `2px solid ${filled ? COLOR.wiseGreen : COLOR.gray}`,
                    transition: "background 0.2s, border-color 0.2s",
                  }}
                />
              );
            })}
          </div>

          {/* Phase labels + durations */}
          <div
            style={{
              display: "flex",
              width: BAR_W,
            }}
          >
            {PHASES.map((phase, i) => {
              const nextPos = i < PHASES.length - 1 ? PHASES[i + 1].pos : 1;
              const width = (nextPos - phase.pos) * BAR_W;
              return (
                <div
                  key={phase.label}
                  style={{
                    width,
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                  }}
                >
                  <div style={{ ...TYPE.bodySemibold }}>{phase.label}</div>
                  <div style={{ ...TYPE.caption }}>{phase.duration}</div>
                </div>
              );
            })}
          </div>

          {/* Divider */}
          <div
            style={{
              width: BAR_W,
              height: 1,
              background: COLOR.border,
            }}
          />

          {/* Green badges */}
          <div style={{ display: "flex", gap: 32 }}>
            {BADGES.map((badge, i) => (
              <div
                key={badge}
                style={{
                  ...TYPE.bodySemibold,
                  color: COLOR.wiseGreen,
                  opacity: badgeDelay(i),
                }}
              >
                {badge}
              </div>
            ))}
          </div>
        </div>
      </DiagramCard>
    </div>
  );
};

export const SettlementDiagrams: React.FC = () => {
  return (
    <AbsoluteFill>
      <SettlementCard />
      <Sequence from={CYCLE_IN}>
        <Audio src={staticFile("sfx/scroll-tick.mp3")} volume={0.4} />
      </Sequence>
      <Sequence from={Math.round(CYCLE_IN + (CYCLE_OUT - CYCLE_IN) * 0.55)}>
        <Audio src={staticFile("sfx/scroll-tick.mp3")} volume={0.4} />
      </Sequence>
      <Sequence from={Math.round(CYCLE_IN + (CYCLE_OUT - CYCLE_IN) * 0.78)}>
        <Audio src={staticFile("sfx/scroll-tick.mp3")} volume={0.4} />
      </Sequence>
    </AbsoluteFill>
  );
};
