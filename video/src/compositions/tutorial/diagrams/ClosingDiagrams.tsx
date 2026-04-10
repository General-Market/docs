import React from "react";
import {
  AbsoluteFill,
  Easing,
  Sequence,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLOR, TYPE } from "../designTokens";
import { FPS } from "../theme";
import { DiagramCard } from "../components/DiagramCard";
import { Sfx } from "../components/Sfx";
import { PLOB, PLOB_ACCENT, COUNT } from "../sfxMap";

const s = (sec: number) => Math.round(sec * FPS);
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);

// ── Data ────────────────────────────────────────────────────────────────────

interface Stat {
  label: string;
  target: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  color?: string;
}

const STATS: Stat[] = [
  { label: "TRADES", target: 49 },
  { label: "WIN RATE", target: 54.3, suffix: "%", decimals: 1 },
  { label: "PNL", target: 12.4, prefix: "+$", decimals: 2, color: COLOR.positive },
  { label: "UPTIME", target: 275, suffix: "s" }, // rendered as Xm YYs
];

interface Row {
  batch: number;
  detail: string;
  status: string;
  pnl: string;
  positive: boolean;
}

const ROWS: Row[] = [
  { batch: 142, detail: "5000 streamers", status: "Settled", pnl: "+$3.20", positive: true },
  { batch: 141, detail: "5000 streamers", status: "Settled", pnl: "-$1.80", positive: false },
  { batch: 140, detail: "5000 streamers", status: "Settled", pnl: "+$5.10", positive: true },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatUptime(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const sec = Math.floor(totalSec % 60);
  return `${m}m ${String(sec).padStart(2, "0")}s`;
}

function cascadeEntrance(frame: number, delay: number) {
  const t = interpolate(frame - delay, [0, 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE_OUT,
  });
  return {
    opacity: t,
    transform: `translateY(${(1 - t) * 18}px) scale(${interpolate(t, [0, 1], [0.95, 1])})`,
  };
}

// ── BotDashboard ────────────────────────────────────────────────────────────

const BotDashboard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Live dot pulse
  const pulse = 0.5 + 0.5 * Math.sin(frame * 0.2);

  // Counter animation: 0 → target over 1.2s, delayed 0.4s
  const counterDelay = s(0.4);
  const counterDur = s(1.2);

  const animateValue = (target: number, extraDelay: number = 0): number => {
    const local = frame - counterDelay - extraDelay;
    if (local <= 0) return 0;
    return interpolate(local, [0, counterDur], [0, target], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: EASE_OUT,
    });
  };

  // Uptime ticks in real time
  const baseUptime = 275; // 4m 35s
  const elapsedSec = frame / fps;

  return (
    <DiagramCard>
      {/* Header */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
          paddingBottom: 24,
          borderBottom: `1px solid ${COLOR.border}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: COLOR.wiseGreen,
              boxShadow: `0 0 ${8 + pulse * 6}px ${COLOR.wiseGreen}`,
              opacity: 0.7 + pulse * 0.3,
            }}
          />
          <span
            style={{
              ...TYPE.label,
              fontSize: 24,
              fontWeight: 700,
              color: COLOR.darkGreen,
              background: COLOR.wiseGreen,
              padding: "4px 12px",
              borderRadius: 6,
              letterSpacing: "0.1em",
            }}
          >
            LIVE
          </span>
        </div>
        <span style={{ ...TYPE.sectionHeading, color: COLOR.nearBlack }}>Your Bot</span>
      </div>

      {/* Stats row */}
      <div
        style={{
          display: "flex",
          paddingTop: 28,
          paddingBottom: 28,
          borderBottom: `1px solid ${COLOR.border}`,
        }}
      >
        {STATS.map((stat, i) => {
          const stagger = i * s(0.12);
          const val = animateValue(stat.target, stagger);
          const entrance = cascadeEntrance(frame, counterDelay + stagger);

          let display: string;
          if (stat.label === "UPTIME") {
            const uptimeSec = animateValue(baseUptime, stagger) + (frame > s(2) ? elapsedSec : 0);
            display = formatUptime(uptimeSec);
          } else {
            const num = stat.decimals ? val.toFixed(stat.decimals) : String(Math.round(val));
            display = `${stat.prefix || ""}${num}${stat.suffix || ""}`;
          }

          return (
            <div
              key={stat.label}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 10,
                ...entrance,
              }}
            >
              <span style={{ ...TYPE.label, fontSize: 24 }}>{stat.label}</span>
              <span
                style={{
                  ...TYPE.statValue,
                  color: stat.color || COLOR.nearBlack,
                }}
              >
                {display}
              </span>
            </div>
          );
        })}
      </div>

      {/* Recent activity */}
      <div style={{ paddingTop: 24 }}>
        <span style={{ ...TYPE.label, fontSize: 24 }}>RECENT</span>

        <div style={{ marginTop: 16, display: "flex", flexDirection: "column" }}>
          {ROWS.map((row, i) => {
            const rowDelay = s(1.0) + i * s(0.25);
            const entrance = cascadeEntrance(frame, rowDelay);

            return (
              <div
                key={row.batch}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "14px 0",
                  borderBottom: i < ROWS.length - 1 ? `1px solid ${COLOR.border}` : "none",
                  ...entrance,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <span style={{ ...TYPE.bodySemibold, color: COLOR.nearBlack }}>
                    Batch #{row.batch}
                  </span>
                  <span style={{ ...TYPE.body, color: COLOR.gray }}>{row.detail}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <span style={{ ...TYPE.label, fontSize: 24, color: COLOR.gray }}>{row.status}</span>
                  <span
                    style={{
                      ...TYPE.bodySemibold,
                      fontWeight: 700,
                      fontVariantNumeric: "tabular-nums",
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
    </DiagramCard>
  );
};

// ── Export ───────────────────────────────────────────────────────────────────

const DASHBOARD_START = 0;
const DASHBOARD_END = s(5.9);

export const ClosingDiagrams: React.FC = () => {
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <Sequence from={DASHBOARD_START} durationInFrames={DASHBOARD_END - DASHBOARD_START}>
        <BotDashboard />
        {/* "LIVE" badge appearing */}
        <Sfx sound={PLOB_ACCENT} />
        {/* Stats counter starting */}
        <Sfx sound={COUNT} delay={s(0.4)} />
        {/* Row cascade (3 rows staggered) */}
        <Sfx sound={PLOB} delay={s(1.0)} />
        <Sfx sound={PLOB} delay={s(1.25)} />
        <Sfx sound={PLOB} delay={s(1.5)} />
      </Sequence>
    </AbsoluteFill>
  );
};
