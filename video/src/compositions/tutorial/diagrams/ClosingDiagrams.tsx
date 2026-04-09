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
import { C } from "../../../common/colors";
import { font, monoFont } from "../../../common/fonts";
import { EASE } from "../../../common/easing";
import { lerp } from "../../../common/utils";
import { FPS, BRAND_GREEN } from "../theme";

const s = (sec: number) => Math.round(sec * FPS);
const W = 1920;
const H = 1080;

const GREEN = BRAND_GREEN;
const POSITIVE_GREEN = "#16A34A";

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
  { label: "PNL", value: "+$12.40", targetNum: 12.4, prefix: "+$", color: POSITIVE_GREEN },
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

  // Dashboard panel enter
  const panelSpring = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 120, mass: 0.8 },
  });

  const panelScale = interpolate(panelSpring, [0, 1], [0.92, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const panelOpacity = interpolate(panelSpring, [0, 0.4], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

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

  // Dashboard layout: Zones B+C (avoid face safe zone 35-65%)
  // We place the dashboard spanning from ~5% to ~95% but the center is mostly
  // header/stats — activity rows are below face zone
  const dashX = W * 0.05;
  const dashY = H * 0.12;
  const dashW = W * 0.9;
  const dashH = H * 0.76;

  // Layout uses CSS flex — no absolute pixel offsets needed

  return (
    <AbsoluteFill
      style={{
        opacity: panelOpacity,
        transform: `scale(${panelScale})`,
        transformOrigin: "center center",
      }}
    >
      {/* Main dashboard panel — white bg, frontend style */}
      <div
        style={{
          position: "absolute",
          left: dashX,
          top: dashY,
          width: dashW,
          height: dashH,
          background: "#FFFFFF",
          borderRadius: 16,
          boxShadow: "0 4px 32px rgba(0,0,0,0.25), 0 1px 4px rgba(0,0,0,0.1)",
          overflow: "hidden",
        }}
      >
        {/* Header row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            height: 52,
            borderBottom: "1px solid #E0E0E0",
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
              background: POSITIVE_GREEN,
              boxShadow: `0 0 ${8 + livePulse * 6}px ${POSITIVE_GREEN}`,
              opacity: 0.7 + livePulse * 0.3,
            }}
          />
          <span
            style={{
              fontFamily: monoFont,
              fontSize: 12,
              fontWeight: 700,
              color: POSITIVE_GREEN,
              letterSpacing: 1.2,
              textTransform: "uppercase",
            }}
          >
            LIVE
          </span>
          <span
            style={{
              fontFamily: font,
              fontSize: 16,
              fontWeight: 600,
              color: "#1A1A1A",
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
            borderBottom: "1px solid #E0E0E0",
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
                  borderRight: i < STATS.length - 1 ? "1px solid #E0E0E0" : "none",
                  opacity: statSpring,
                  transform: `translateY(${(1 - statSpring) * 12}px)`,
                }}
              >
                {/* Micro label */}
                <span
                  style={{
                    fontFamily: font,
                    fontSize: 11,
                    fontWeight: 500,
                    color: "#999",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    marginBottom: 6,
                  }}
                >
                  {stat.label}
                </span>
                {/* Value */}
                <span
                  style={{
                    fontFamily: monoFont,
                    fontSize: 32,
                    fontWeight: 700,
                    color: stat.color || "#1A1A1A",
                    fontVariantNumeric: "tabular-nums",
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
              fontFamily: font,
              fontSize: 11,
              fontWeight: 500,
              color: "#999",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
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
                    background: "#F8F8F8",
                    borderRadius: 8,
                    border: "1px solid #E8E8E8",
                    opacity: rowSpring,
                    transform: `translateX(${(1 - rowSpring) * 40}px)`,
                  }}
                >
                  <span
                    style={{
                      fontFamily: monoFont,
                      fontSize: 14,
                      fontWeight: 500,
                      color: "#444",
                    }}
                  >
                    Batch #{row.batch}: Bet on {row.detail}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        fontFamily: monoFont,
                        fontSize: 13,
                        color: "#888",
                      }}
                    >
                      Settled
                    </span>
                    <span
                      style={{
                        fontFamily: monoFont,
                        fontSize: 15,
                        fontWeight: 700,
                        color: row.positive ? POSITIVE_GREEN : C.red,
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
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// DIAGRAM 2: Full Architecture Recap + End Card (5.9s–11.9s local)
// ═══════════════════════════════════════════════════════════════════════════

interface ArchNode {
  label: string;
  x: number;
  y: number;
}

const ARCH_NODES: ArchNode[] = [
  { label: "YOU", x: 150, y: 200 },
  { label: "BOT", x: 380, y: 200 },
  { label: "GM API", x: 610, y: 200 },
  { label: "BATCH", x: 870, y: 200 },
  { label: "ORACLE", x: 1130, y: 200 },
  { label: "PNL", x: 1370, y: 200 },
];

interface ArchDetail {
  parentIdx: number;
  lines: string[];
  y: number;
}

const ARCH_DETAILS: ArchDetail[] = [
  { parentIdx: 2, lines: ["500K markets", "$0 fees", "Private"], y: 340 },
  { parentIdx: 4, lines: ["3 BLS nodes", "10 min settle", "No disputes", "Instant withdraw"], y: 340 },
];

interface CheckItem {
  text: string;
  x: number;
}

const CHECKLIST: CheckItem[] = [
  { text: "Liquidity solved", x: 320 },
  { text: "Capital lock: 10 min", x: 760 },
  { text: "Risk management: built-in", x: 1240 },
];

const ArchRecapEndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phase timing (local to this component)
  const checkStart = s(3.5);
  const brandStart = s(4.0);
  const fadeStart = s(4.8); // Last ~1.2s: fade to black except URL

  // Dark overlay fade in
  const overlayOpacity = lerp(frame, [0, s(0.4)], [0, 0.92], EASE.smooth);

  // Architecture node stagger
  const nodeStagger = s(0.35);

  // SVG glow filter
  const GlowDef = (
    <defs>
      <filter id="endGlow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  );

  // Final fade: everything except URL fades out
  const contentFade = frame > fadeStart
    ? lerp(frame, [fadeStart, fadeStart + s(1.0)], [1, 0], EASE.smooth)
    : 1;
  const urlFade = frame > fadeStart
    ? lerp(frame, [fadeStart, fadeStart + s(0.5)], [1, 1], EASE.smooth)
    : lerp(frame, [brandStart, brandStart + s(0.6)], [0, 1], EASE.out);

  // Full black at end
  const blackOverlay = frame > fadeStart + s(0.8)
    ? lerp(frame, [fadeStart + s(0.8), fadeStart + s(1.2)], [0, 1], EASE.smooth)
    : 0;

  return (
    <AbsoluteFill>
      {/* Dark overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `rgba(10, 10, 10, ${overlayOpacity})`,
        }}
      />

      {/* Architecture diagram */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          opacity: contentFade,
        }}
      >
        {GlowDef}

        {/* Connection arrows between nodes */}
        {ARCH_NODES.slice(0, -1).map((node, i) => {
          const next = ARCH_NODES[i + 1];
          const arrowDelay = i * nodeStagger + s(0.2);
          const localFrame = frame - arrowDelay;
          if (localFrame < 0) return null;

          const drawProg = lerp(localFrame, [0, s(0.4)], [0, 1], EASE.out);

          const x1 = node.x + 60;
          const x2 = next.x - 60;
          const y = node.y;

          return (
            <g key={`arrow-${i}`}>
              <line
                x1={x1}
                y1={y}
                x2={x1 + (x2 - x1) * drawProg}
                y2={y}
                stroke="rgba(255,255,255,0.4)"
                strokeWidth={2}
              />
              {drawProg > 0.8 && (
                <polygon
                  points={`${x2},${y} ${x2 - 8},${y - 5} ${x2 - 8},${y + 5}`}
                  fill="rgba(255,255,255,0.4)"
                  opacity={lerp(localFrame, [s(0.3), s(0.4)], [0, 1], EASE.out)}
                />
              )}
            </g>
          );
        })}

        {/* Architecture nodes */}
        {ARCH_NODES.map((node, i) => {
          const nodeDelay = i * nodeStagger;
          const nodeSpring = spring({
            frame: Math.max(frame - nodeDelay, 0),
            fps,
            config: { damping: 14, stiffness: 140, mass: 0.7 },
          });

          const scale = interpolate(nodeSpring, [0, 1], [0.5, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const opacity = interpolate(nodeSpring, [0, 0.3], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          const boxW = 120;
          const boxH = 48;
          const isFirst = i === 0;
          const isLast = i === ARCH_NODES.length - 1;

          return (
            <g
              key={node.label}
              transform={`translate(${node.x}, ${node.y}) scale(${scale})`}
              opacity={opacity}
            >
              <rect
                x={-boxW / 2}
                y={-boxH / 2}
                width={boxW}
                height={boxH}
                rx={10}
                fill={isLast ? "rgba(0,200,83,0.15)" : "rgba(20,20,20,0.9)"}
                stroke={isLast ? GREEN : isFirst ? C.accent : "rgba(255,255,255,0.3)"}
                strokeWidth={2}
              />
              {isLast && (
                <rect
                  x={-boxW / 2 - 3}
                  y={-boxH / 2 - 3}
                  width={boxW + 6}
                  height={boxH + 6}
                  rx={12}
                  fill="none"
                  stroke={GREEN}
                  strokeWidth={1.5}
                  opacity={0.4}
                  filter="url(#endGlow)"
                />
              )}
              <text
                x={0}
                y={2}
                textAnchor="middle"
                dominantBaseline="central"
                fill={isLast ? GREEN : "#fafafa"}
                fontFamily={monoFont}
                fontWeight={700}
                fontSize={15}
                letterSpacing={1}
              >
                {node.label}
              </text>
            </g>
          );
        })}

        {/* Detail labels beneath GM API and ORACLE */}
        {ARCH_DETAILS.map((detail, di) => {
          const parentNode = ARCH_NODES[detail.parentIdx];
          const detailDelay = detail.parentIdx * nodeStagger + s(0.6);

          return (
            <g key={`detail-${di}`}>
              {/* Vertical connector line */}
              {(() => {
                const lineFrame = frame - detailDelay;
                if (lineFrame < 0) return null;
                const lineProg = lerp(lineFrame, [0, s(0.3)], [0, 1], EASE.out);
                return (
                  <line
                    x1={parentNode.x}
                    y1={parentNode.y + 24}
                    x2={parentNode.x}
                    y2={parentNode.y + 24 + (detail.y - parentNode.y - 24) * lineProg}
                    stroke="rgba(255,255,255,0.15)"
                    strokeWidth={1}
                    strokeDasharray="4 3"
                  />
                );
              })()}

              {/* Detail text lines */}
              {detail.lines.map((line, li) => {
                const lineDelay = detailDelay + s(0.2) + li * s(0.15);
                const lineOpacity = lerp(frame - lineDelay, [0, s(0.3)], [0, 1], EASE.out);
                const lineY = detail.y + li * 26;

                return (
                  <text
                    key={`${di}-${li}`}
                    x={parentNode.x}
                    y={lineY}
                    textAnchor="middle"
                    fill={C.gray[400]}
                    fontFamily={monoFont}
                    fontSize={13}
                    letterSpacing={0.5}
                    opacity={lineOpacity}
                  >
                    {line}
                  </text>
                );
              })}
            </g>
          );
        })}

        {/* Promise checklist with animated checkmarks */}
        {CHECKLIST.map((item, i) => {
          const checkDelay = checkStart + i * s(0.3);
          const checkSpring = spring({
            frame: Math.max(frame - checkDelay, 0),
            fps,
            config: { damping: 12, stiffness: 160, mass: 0.5 },
          });

          const checkOpacity = interpolate(checkSpring, [0, 0.3], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          const checkScale = interpolate(checkSpring, [0, 1], [0.6, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          const checkmarkLen = 24;
          const checkDashOffset = interpolate(checkSpring, [0, 1], [checkmarkLen, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          const baseY = 520;

          return (
            <g
              key={item.text}
              transform={`translate(${item.x}, ${baseY}) scale(${checkScale})`}
              opacity={checkOpacity}
            >
              {/* Checkmark */}
              <polyline
                points="0,10 7,18 20,2"
                fill="none"
                stroke={GREEN}
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={checkmarkLen}
                strokeDashoffset={checkDashOffset}
                filter="url(#endGlow)"
              />
              {/* Label */}
              <text
                x={28}
                y={12}
                dominantBaseline="central"
                fill="#fafafa"
                fontFamily={font}
                fontWeight={500}
                fontSize={16}
                letterSpacing={0.3}
              >
                {item.text}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Brand text: GENERAL MARKET */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: H * 0.58,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          opacity: contentFade * lerp(frame, [brandStart, brandStart + s(0.6)], [0, 1], EASE.out),
          transform: `translateY(${lerp(frame, [brandStart, brandStart + s(0.6)], [20, 0], EASE.out)}px)`,
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 72,
            fontWeight: 900,
            color: "#FAFAFA",
            letterSpacing: 6,
            textTransform: "uppercase",
            lineHeight: 1,
          }}
        >
          GENERAL MARKET
        </div>
      </div>

      {/* URL — persists through fade */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: H * 0.68,
          display: "flex",
          justifyContent: "center",
          opacity: urlFade,
        }}
      >
        <div
          style={{
            fontFamily: monoFont,
            fontSize: 24,
            fontWeight: 500,
            color: GREEN,
            letterSpacing: 2,
          }}
        >
          generalmarket.io
        </div>
      </div>

      {/* Final black overlay */}
      {blackOverlay > 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "#0A0A0A",
            opacity: blackOverlay,
            // Punch a hole for the URL
            pointerEvents: "none",
          }}
        />
      )}

      {/* URL on top of black overlay so it stays visible */}
      {blackOverlay > 0 && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: H * 0.68,
            display: "flex",
            justifyContent: "center",
            opacity: urlFade,
          }}
        >
          <div
            style={{
              fontFamily: monoFont,
              fontSize: 24,
              fontWeight: 500,
              color: GREEN,
              letterSpacing: 2,
            }}
          >
            generalmarket.io
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN EXPORT — ClosingDiagrams
// ═══════════════════════════════════════════════════════════════════════════

// Local timing: frame 0 = 271.0s in video
const DASHBOARD_START = 0;
const DASHBOARD_END = s(5.9); // 276.9s

const ENDCARD_START = s(5.9); // 276.9s
const ENDCARD_END = s(11.9); // 282.9s

export const ClosingDiagrams: React.FC = () => {
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* 1. Bot Status Dashboard */}
      <Sequence from={DASHBOARD_START} durationInFrames={DASHBOARD_END - DASHBOARD_START}>
        <BotDashboard />
        <Audio src={staticFile("sfx/code-compile-success.mp3")} volume={0.5} />
      </Sequence>

      {/* 2. Architecture Recap + End Card */}
      <Sequence from={ENDCARD_START} durationInFrames={ENDCARD_END - ENDCARD_START}>
        <ArchRecapEndCard />
        <Audio src={staticFile("sfx/stinger-logo-reveal.mp3")} volume={0.6} />
      </Sequence>
    </AbsoluteFill>
  );
};
