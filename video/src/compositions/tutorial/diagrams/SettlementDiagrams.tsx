import React from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { EASE } from "../../../common/easing";
import { COLOR, TYPE } from "../designTokens";
import { FPS } from "../theme";
import { DiagramCardDark } from "../components/DiagramCard";

// ---------------------------------------------------------------------------
// Timing — local seconds (component starts at 0 = video 89.84s)
// ---------------------------------------------------------------------------

const sec = (s: number) => Math.round(s * FPS);

// Diagram windows (local seconds, offset from 89.84s)
const CYCLE_IN = sec(10.56);
const CYCLE_OUT = sec(23.96);

// Colors — from design tokens
const GREEN = COLOR.wiseGreen;
const RED = COLOR.danger;
const ACCENT = COLOR.wiseGreen;
const DIM = COLOR.gray;
const BRIGHT = COLOR.white;

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function fadeEnterExit(
  frame: number,
  enterStart: number,
  exitEnd: number,
  fadeFrames = 10,
) {
  const enterOp = interpolate(frame, [enterStart, enterStart + fadeFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exitOp = interpolate(frame, [exitEnd - fadeFrames, exitEnd], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return Math.min(enterOp, exitOp);
}

// ---------------------------------------------------------------------------
// DIAGRAM: 10-Min Cycle Timeline (ZONE D — full-width lower third)
// ---------------------------------------------------------------------------

interface BetBlock {
  x: number;
  color: string;
  label: string;
}

const CycleTimeline: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = fadeEnterExit(frame, CYCLE_IN, CYCLE_OUT, 15);
  const localFrame = frame - CYCLE_IN;
  const totalDuration = CYCLE_OUT - CYCLE_IN;

  // Overall progress through the 3 phases
  const progress = interpolate(localFrame, [0, totalDuration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.smooth,
  });

  // Phase boundaries (relative)
  const PHASE_BETTING_END = 0.55;
  const PHASE_ORACLE_END = 0.78;

  const currentPhase = progress < PHASE_BETTING_END ? 0 : progress < PHASE_ORACLE_END ? 1 : 2;

  const barWidth = 1100;
  const barHeight = 16;
  const filledWidth = progress * barWidth;

  // Betting blocks (Tetris-like)
  const bettingProgress = interpolate(progress, [0, PHASE_BETTING_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const blocks: BetBlock[] = [
    { x: 80, color: GREEN, label: "YES" },
    { x: 200, color: RED, label: "NO" },
    { x: 340, color: GREEN, label: "YES" },
    { x: 460, color: GREEN, label: "YES" },
    { x: 580, color: RED, label: "NO" },
    { x: 700, color: GREEN, label: "YES" },
    { x: 820, color: RED, label: "NO" },
    { x: 940, color: GREEN, label: "YES" },
  ];

  // Oracle pulse
  const oracleActive = currentPhase >= 1;
  const oraclePulse = oracleActive ? 0.5 + 0.5 * Math.sin((localFrame / fps) * Math.PI * 5) : 0;

  // Settle $ flow
  const settleActive = currentPhase === 2;
  const settleProgress = interpolate(progress, [PHASE_ORACLE_END, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Bar color
  const barColor = currentPhase === 0 ? GREEN : currentPhase === 1 ? ACCENT : BRIGHT;

  // Phase labels
  const phaseLabels = [
    { label: "BETTING", sub: "10 min", color: GREEN },
    { label: "ORACLE", sub: "consensus", color: ACCENT },
    { label: "SETTLE", sub: "payout", color: BRIGHT },
  ];

  // Parasite label stagger
  const parasiteLabels = [
    { text: "SEALED BETS", delay: 0.1, color: GREEN },
    { text: "BLS CONSENSUS", delay: 0.55, color: ACCENT },
    { text: "PARIMUTUEL ENGINE", delay: 0.6, color: DIM },
    { text: "INSTANT WITHDRAWAL", delay: 0.8, color: BRIGHT },
  ];

  return (
    <DiagramCardDark width={1600} padding="32px 40px" position="bottom">
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
          opacity,
        }}
      >
        {/* Current phase label */}
        <div
          style={{
            ...TYPE.labelDark,
            color: phaseLabels[currentPhase].color,
          }}
        >
          {phaseLabels[currentPhase].label}
        </div>

        {/* Bet blocks dropping area */}
        <div style={{ position: "relative", width: barWidth, height: 36, overflow: "hidden" }}>
          {currentPhase === 0 &&
            blocks.map((block, i) => {
              const blockDelay = i / blocks.length;
              const blockProg = interpolate(bettingProgress, [blockDelay, blockDelay + 0.15], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              const blockY = interpolate(blockProg, [0, 1], [-30, 4], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: EASE.out,
              });
              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: block.x,
                    top: blockY,
                    opacity: blockProg,
                    width: 32,
                    height: 28,
                    borderRadius: 4,
                    background: block.color === GREEN ? `${COLOR.wiseGreen}40` : `${COLOR.danger}40`,
                    border: `1.5px solid ${block.color}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: TYPE.bodySemibold.fontFamily,
                    fontSize: 8,
                    fontWeight: TYPE.label.fontWeight,
                    color: block.color,
                  }}
                >
                  {block.label}
                </div>
              );
            })}

          {/* Oracle pulse nodes */}
          {oracleActive && currentPhase === 1 && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: 24,
                width: "100%",
                height: "100%",
              }}
            >
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: ACCENT,
                    opacity: 0.6 + 0.4 * oraclePulse,
                    boxShadow: `0 0 ${8 + 6 * oraclePulse}px ${COLOR.wiseGreen}80`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: TYPE.bodySemibold.fontFamily,
                    fontSize: 11,
                    fontWeight: TYPE.label.fontWeight,
                    color: COLOR.white,
                  }}
                >
                  {n}
                </div>
              ))}
            </div>
          )}

          {/* Settle $ signs */}
          {settleActive &&
            Array.from({ length: 6 }).map((_, i) => {
              const dollarDelay = i * 0.12;
              const dollarOp = interpolate(settleProgress, [dollarDelay, dollarDelay + 0.3], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              const dollarX = 200 + i * 140;
              const dollarY = interpolate(dollarOp, [0, 1], [20, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: dollarX,
                    top: dollarY,
                    opacity: dollarOp,
                    fontFamily: TYPE.statValue.fontFamily,
                    fontSize: TYPE.statValue.fontSize,
                    fontWeight: TYPE.statValue.fontWeight,
                    color: COLOR.wiseGreen,
                  }}
                >
                  $
                </div>
              );
            })}
        </div>

        {/* Progress bar */}
        <div
          style={{
            width: barWidth,
            height: barHeight,
            borderRadius: barHeight / 2,
            background: `${COLOR.border}18`,
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div
            style={{
              width: filledWidth,
              height: "100%",
              borderRadius: barHeight / 2,
              background: barColor,
              transition: "background 0.3s",
            }}
          />
          {/* Phase dividers */}
          <div
            style={{
              position: "absolute",
              left: `${PHASE_BETTING_END * 100}%`,
              top: 0,
              width: 1.5,
              height: "100%",
              background: `${COLOR.gray}26`,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: `${PHASE_ORACLE_END * 100}%`,
              top: 0,
              width: 1.5,
              height: "100%",
              background: `${COLOR.gray}26`,
            }}
          />
        </div>

        {/* Phase labels below bar */}
        <div style={{ width: barWidth, display: "flex", position: "relative", height: 16 }}>
          <div
            style={{
              ...TYPE.labelDark,
              position: "absolute",
              left: 0,
              width: `${PHASE_BETTING_END * 100}%`,
              textAlign: "center",
              color: COLOR.wiseGreen,
            }}
          >
            BETTING (10 min)
          </div>
          <div
            style={{
              ...TYPE.labelDark,
              position: "absolute",
              left: `${PHASE_BETTING_END * 100}%`,
              width: `${(PHASE_ORACLE_END - PHASE_BETTING_END) * 100}%`,
              textAlign: "center",
              color: COLOR.wiseGreen,
            }}
          >
            ORACLE
          </div>
          <div
            style={{
              ...TYPE.labelDark,
              position: "absolute",
              left: `${PHASE_ORACLE_END * 100}%`,
              width: `${(1 - PHASE_ORACLE_END) * 100}%`,
              textAlign: "center",
              color: COLOR.white,
            }}
          >
            SETTLE
          </div>
        </div>

        {/* Parasite labels row */}
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center", marginTop: 4 }}>
          {parasiteLabels.map((pl) => {
            const plOp = interpolate(progress, [pl.delay, pl.delay + 0.08], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return (
              <ParasiteLabel key={pl.text} text={pl.text} color={pl.color} style={{ opacity: plOp }} />
            );
          })}
        </div>
      </div>
    </DiagramCardDark>
  );
};

// ---------------------------------------------------------------------------
// Parasite Label — reusable floating annotation
// ---------------------------------------------------------------------------

const ParasiteLabel: React.FC<{
  text: string;
  color: string;
  style?: React.CSSProperties;
}> = ({ text, color, style }) => (
  <div
    style={{
      ...TYPE.captionDark,
      textTransform: "uppercase",
      letterSpacing: TYPE.labelDark.letterSpacing,
      color,
      whiteSpace: "nowrap",
      ...style,
    }}
  >
    {text}
  </div>
);

// ---------------------------------------------------------------------------
// Main Export
// ---------------------------------------------------------------------------

export const SettlementDiagrams: React.FC = () => {
  return (
    <AbsoluteFill>
      {/* 10-Min Cycle Timeline only — other diagrams removed */}
      <CycleTimeline />
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
