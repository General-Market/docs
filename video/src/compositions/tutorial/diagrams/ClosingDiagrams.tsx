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

const s = (sec: number) => Math.round(sec * FPS);

// ═══════════════════════════════════════════════════════════════════════════
// DIAGRAM 1: Bot Status Dashboard (0–5.9s local = 271.0–276.9s video)
// ═══════════════════════════════════════════════════════════════════════════

interface StatData {
  label: string;
  value: string;
  targetNum?: number;
  prefix?: string;
  suffix?: string;
  color?: string;
}

const STATS: StatData[] = [
  { label: "TRADES", value: "47", targetNum: 47 },
  { label: "WIN RATE", value: "54.3%", targetNum: 54.3, suffix: "%" },
  { label: "PNL", value: "+$12.40", targetNum: 12.4, prefix: "+$", color: COLOR.positive },
  { label: "UPTIME", value: "4m 31s" },
];

interface ActivityRow {
  batch: number;
  detail: string;
  pnl: string;
  positive: boolean;
}

const ACTIVITY: ActivityRow[] = [
  { batch: 142, detail: "5000 streamers", pnl: "+$3.20", positive: true },
  { batch: 141, detail: "5000 streamers", pnl: "-$1.80", positive: false },
  { batch: 140, detail: "5000 streamers", pnl: "+$5.10", positive: true },
];

const BotDashboard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Live dot pulse
  const livePulse = 0.5 + 0.5 * Math.sin(frame * 0.2);

  // Uptime counter (real-time ticking)
  const elapsedSec = frame / fps;
  const baseSec = 271; // 4m 31s = 271s
  const totalSec = baseSec + elapsedSec;
  const minutes = Math.floor(totalSec / 60);
  const seconds = Math.floor(totalSec % 60);
  const uptimeStr = `${minutes}m ${String(seconds).padStart(2, "0")}s`;

  // Trade counter ticks (+1 every 2s)
  const baseTrades = 47;
  const tradeIncrement = Math.floor(elapsedSec / 2);

  // Stat counter animation (0 → target over 1.5s)
  const counterDur = s(1.5);
  const counterDelay = s(0.4);

  const animateNum = (target: number, delay: number = counterDelay): number => {
    const localFrame = frame - delay;
    if (localFrame <= 0) return 0;
    return interpolate(localFrame, [0, counterDur], [0, target], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: EASE.out,
    });
  };

  return (
    <DiagramCard width={1200} padding="0">
      <div
        style={{
          overflow: "hidden",
        }}
      >
        {/* Header row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            height: 52,
            borderBottom: `1px solid ${COLOR.border}`,
            padding: "0 28px",
            gap: 12,
          }}
        >
          {/* Live dot */}
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: COLOR.wiseGreen,
              boxShadow: `0 0 ${8 + livePulse * 6}px ${COLOR.wiseGreen}`,
              opacity: 0.7 + livePulse * 0.3,
            }}
          />
          <span
            style={{
              ...TYPE.label,
              fontSize: 12,
              fontWeight: 700,
              color: COLOR.darkGreen,
              letterSpacing: 1.2,
              background: COLOR.wiseGreen,
              padding: "2px 8px",
              borderRadius: 4,
            }}
          >
            LIVE
          </span>
          <span
            style={{
              ...TYPE.cardTitle,
              marginLeft: 4,
            }}
          >
            Twitch Viewer Prediction Strategy
          </span>
        </div>

        {/* Stats row */}
        <div
          style={{
            display: "flex",
            height: 90,
            borderBottom: `1px solid ${COLOR.border}`,
          }}
        >
          {STATS.map((stat, i) => {
            const delay = counterDelay + i * s(0.15);
            const statSpring = spring({
              frame: Math.max(frame - delay, 0),
              fps,
              config: { damping: 16, stiffness: 140, mass: 0.5 },
            });

            let displayValue: string;
            if (stat.label === "UPTIME") {
              displayValue = uptimeStr;
            } else if (stat.label === "TRADES") {
              const animVal = animateNum(baseTrades, delay);
              const val = Math.round(animVal) + (frame > s(2) ? tradeIncrement : 0);
              displayValue = String(val);
            } else if (stat.targetNum !== undefined) {
              const animVal = animateNum(stat.targetNum, delay);
              if (stat.suffix === "%") {
                displayValue = animVal.toFixed(1) + "%";
              } else {
                displayValue = (stat.prefix || "") + animVal.toFixed(2);
              }
            } else {
              displayValue = stat.value;
            }

            return (
              <div
                key={stat.label}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRight: i < STATS.length - 1 ? `1px solid ${COLOR.border}` : "none",
                  opacity: statSpring,
                  transform: `translateY(${(1 - statSpring) * 12}px)`,
                }}
              >
                {/* Micro label */}
                <span
                  style={{
                    ...TYPE.label,
                    marginBottom: 6,
                  }}
                >
                  {stat.label}
                </span>
                {/* Value */}
                <span
                  style={{
                    ...TYPE.statValue,
                    color: stat.color || COLOR.nearBlack,
                    lineHeight: 1,
                  }}
                >
                  {displayValue}
                </span>
              </div>
            );
          })}
        </div>

        {/* Activity section */}
        <div
          style={{
            padding: "16px 28px",
          }}
        >
          {/* Activity header */}
          <span
            style={{
              ...TYPE.label,
            }}
          >
            RECENT ACTIVITY
          </span>

          {/* Activity rows */}
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            {ACTIVITY.map((row, i) => {
              const rowDelay = s(1.2) + i * s(0.3);
              const rowSpring = spring({
                frame: Math.max(frame - rowDelay, 0),
                fps,
                config: { damping: 16, stiffness: 120, mass: 0.6 },
              });

              return (
                <div
                  key={row.batch}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 16px",
                    background: COLOR.lightSurface,
                    borderRadius: 8,
                    border: `1px solid ${COLOR.border}`,
                    opacity: rowSpring,
                    transform: `translateX(${(1 - rowSpring) * 40}px)`,
                  }}
                >
                  <span
                    style={{
                      ...TYPE.body,
                    }}
                  >
                    Batch #{row.batch}: Bet on {row.detail}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        ...TYPE.bodySemibold,
                        fontSize: 13,
                        color: COLOR.gray,
                      }}
                    >
                      Settled
                    </span>
                    <span
                      style={{
                        ...TYPE.bodySemibold,
                        fontSize: 15,
                        fontWeight: 700,
                        color: row.positive ? COLOR.positive : COLOR.danger,
                      }}
                    >
                      {row.pnl}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </DiagramCard>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN EXPORT — ClosingDiagrams
// ═══════════════════════════════════════════════════════════════════════════

const DASHBOARD_START = 0;
const DASHBOARD_END = s(5.9);

export const ClosingDiagrams: React.FC = () => {
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <Sequence from={DASHBOARD_START} durationInFrames={DASHBOARD_END - DASHBOARD_START}>
        <BotDashboard />
        <Audio src={staticFile("sfx/code-compile-success.mp3")} volume={0.5} />
      </Sequence>
    </AbsoluteFill>
  );
};
