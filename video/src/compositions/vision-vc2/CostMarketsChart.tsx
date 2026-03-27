/**
 * CostMarketsScene — Animated scatter for VisionVC2
 *
 * Tight layout, massive arrows, title at bottom.
 * Phase 1: arrows UP + "10x More Markets" riding front
 * Phase 2: arrows LEFT from top + "10x Less Costs" riding front
 * GM springs in at convergence.
 */
import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  spring,
} from "remotion";
import { COLOR, FONT, ANIM } from "./tokens";

const FPS = 30;

// ── Data ──────────────────────────────────────────────────────────────

interface Platform {
  name: string;
  markets: number;
  cost: number;
  color: string;
  labelOffsetX?: number;
  labelOffsetY?: number;
}

const PLATFORMS: Platform[] = [
  { name: "Bitget", markets: 800, cost: 2_000, color: "#00B8A9", labelOffsetX: 14, labelOffsetY: 10 },
  { name: "Binance", markets: 1_600, cost: 5_000, color: "#D4A017", labelOffsetX: 14, labelOffsetY: -24 },
  { name: "Polymarket", markets: 36_000, cost: 10_000, color: "#7B68EE", labelOffsetX: 14, labelOffsetY: -8 },
  { name: "Pump.fun", markets: 95_500, cost: 12_500, color: "#7CB342", labelOffsetX: 14, labelOffsetY: -8 },
  { name: "Kalshi", markets: 35_000, cost: 20_000, color: "#FF5722", labelOffsetX: 14, labelOffsetY: 10 },
  { name: "Coinbase", markets: 300, cost: 24_000, color: "#0052FF", labelOffsetX: 14, labelOffsetY: -24 },
];

const GM = { name: "General Market", markets: 580_000, cost: 0, color: "#00C853" };

// ── Chart geometry (tight margins) ────────────────────────────────────

const CHART = { left: 160, right: 1840, top: 60, bottom: 880 };
const W = CHART.right - CHART.left;
const H = CHART.bottom - CHART.top;

const X_MAX = 30_000;
const Y_MAX = 620_000;
function xPos(c: number) { return CHART.left + (c / X_MAX) * W; }
function yPos(m: number) { return CHART.bottom - (m / Y_MAX) * H; }

const GM_CX = xPos(GM.cost);
const GM_CY = yPos(GM.markets);

const X_TICKS = [
  { v: 0, l: "$0" }, { v: 10_000, l: "$10K" },
  { v: 20_000, l: "$20K" }, { v: 30_000, l: "$30K" },
];
const Y_TICKS = [
  { v: 0, l: "0" }, { v: 100_000, l: "100K" }, { v: 200_000, l: "200K" },
  { v: 300_000, l: "300K" }, { v: 400_000, l: "400K" },
  { v: 500_000, l: "500K" }, { v: 600_000, l: "600K" },
];

// ── Timing ────────────────────────────────────────────────────────────

const DOTS_END = 15;
const ARROWS_UP_START = 18;
const ARROWS_UP_END = 28;
const ARROWS_LEFT_START = 48;
const ARROWS_LEFT_END = 58;
const TEXTS_OUT = 68;
const GM_POP = 70;

// Arrow visuals
const ARROW_STROKE = 6;
const ARROW_HEAD = "0,-12 14,0 -14,0";     // upward
const ARROW_HEAD_L = "-12,0 0,14 0,-14";   // leftward

// ── Component ─────────────────────────────────────────────────────────

export const CostMarketsScene: React.FC = () => {
  const frame = useCurrentFrame();

  const axisOp = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const dotsOp = interpolate(frame, [5, DOTS_END], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  // Phase 1: upward
  const upGrow = interpolate(frame, [ARROWS_UP_START, ARROWS_UP_END], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const upFade = interpolate(frame, [ARROWS_UP_END, ARROWS_UP_END + 10], [0.5, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const upOp = upGrow > 0 ? (frame <= ARROWS_UP_END ? 0.5 : upFade) : 0;

  // Phase 2: leftward (from top)
  const leftGrow = interpolate(frame, [ARROWS_LEFT_START, ARROWS_LEFT_END], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const leftFade = interpolate(frame, [ARROWS_LEFT_END, ARROWS_LEFT_END + 10], [0.5, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const leftOp = leftGrow > 0 ? (frame <= ARROWS_LEFT_END ? 0.5 : leftFade) : 0;

  // Text tracking
  const avgDotY = PLATFORMS.reduce((s, p) => s + yPos(p.markets), 0) / PLATFORMS.length;
  const textUpY = avgDotY - (avgDotY - CHART.top) * upGrow;
  const text1Op = interpolate(frame, [ARROWS_UP_START, ARROWS_UP_START + 3], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  }) * interpolate(frame, [TEXTS_OUT, TEXTS_OUT + 6], [1, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  const avgDotX = PLATFORMS.reduce((s, p) => s + xPos(p.cost), 0) / PLATFORMS.length;
  const textLeftX = avgDotX - (avgDotX - CHART.left) * leftGrow;
  const text2Op = interpolate(frame, [ARROWS_LEFT_START, ARROWS_LEFT_START + 3], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  }) * interpolate(frame, [TEXTS_OUT + 3, TEXTS_OUT + 8], [1, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  // GM pop
  const gmSpring = spring({
    frame: Math.max(0, frame - GM_POP),
    fps: FPS,
    config: ANIM.springMedium,
  });
  const gmScale = interpolate(gmSpring, [0, 1], [0, 1]);
  const gmOp = interpolate(gmSpring, [0, 0.3], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: COLOR.page }}>

      {/* ── SVG: axes + gridlines + arrows ─────────────── */}
      <svg style={{
        position: "absolute", top: 0, left: 0,
        width: 1920, height: 1080, pointerEvents: "none",
      }}>
        <g opacity={axisOp}>
          {/* Axis lines */}
          <line x1={CHART.left} y1={CHART.bottom} x2={CHART.right} y2={CHART.bottom}
            stroke={COLOR.textMuted} strokeWidth={1} opacity={0.35} />
          <line x1={CHART.left} y1={CHART.top} x2={CHART.left} y2={CHART.bottom}
            stroke={COLOR.textMuted} strokeWidth={1} opacity={0.35} />

          {/* X ticks */}
          {X_TICKS.map((t) => {
            const x = xPos(t.v);
            return (
              <g key={`x-${t.v}`}>
                {t.v > 0 && <line x1={x} y1={CHART.top} x2={x} y2={CHART.bottom}
                  stroke={COLOR.textMuted} strokeWidth={1} opacity={0.06} strokeDasharray="4 6" />}
                <line x1={x} y1={CHART.bottom} x2={x} y2={CHART.bottom + 6}
                  stroke={COLOR.textMuted} strokeWidth={1} opacity={0.3} />
                <text x={x} y={CHART.bottom + 28} textAnchor="middle"
                  fontFamily="Geist, Inter, sans-serif" fontSize={20} fill={COLOR.textSecondary}>
                  {t.l}
                </text>
              </g>
            );
          })}

          {/* Y ticks */}
          {Y_TICKS.map((t) => {
            const y = yPos(t.v);
            return (
              <g key={`y-${t.v}`}>
                {t.v > 0 && <line x1={CHART.left} y1={y} x2={CHART.right} y2={y}
                  stroke={COLOR.textMuted} strokeWidth={1} opacity={0.06} strokeDasharray="4 6" />}
                <line x1={CHART.left - 6} y1={y} x2={CHART.left} y2={y}
                  stroke={COLOR.textMuted} strokeWidth={1} opacity={0.3} />
                <text x={CHART.left - 12} y={y + 6} textAnchor="end"
                  fontFamily="Geist, Inter, sans-serif" fontSize={20} fill={COLOR.textSecondary}>
                  {t.l}
                </text>
              </g>
            );
          })}
        </g>

        {/* ── Phase 1: MASSIVE upward arrows ──────────── */}
        {upOp > 0 && PLATFORMS.map((p) => {
          const cx = xPos(p.cost);
          const cy = yPos(p.markets);
          const tipY = cy - (cy - CHART.top) * upGrow;
          return (
            <g key={`up-${p.name}`} opacity={upOp}>
              <line x1={cx} y1={cy} x2={cx} y2={tipY}
                stroke={p.color} strokeWidth={ARROW_STROKE} strokeLinecap="round" />
              <polygon points={ARROW_HEAD}
                transform={`translate(${cx},${tipY})`} fill={p.color} />
            </g>
          );
        })}

        {/* ── Phase 2: MASSIVE leftward arrows from top ── */}
        {leftOp > 0 && PLATFORMS.map((p) => {
          const cx = xPos(p.cost);
          const tipX = cx - (cx - CHART.left) * leftGrow;
          return (
            <g key={`left-${p.name}`} opacity={leftOp}>
              <line x1={cx} y1={CHART.top} x2={tipX} y2={CHART.top}
                stroke={p.color} strokeWidth={ARROW_STROKE} strokeLinecap="round" />
              <polygon points={ARROW_HEAD_L}
                transform={`translate(${tipX},${CHART.top})`} fill={p.color} />
            </g>
          );
        })}
      </svg>

      {/* ── Competitor dots + labels ──────────────────── */}
      {PLATFORMS.map((p) => {
        const cx = xPos(p.cost);
        const cy = yPos(p.markets);
        return (
          <React.Fragment key={p.name}>
            <div style={{
              position: "absolute", left: cx - 10, top: cy - 10,
              width: 20, height: 20, borderRadius: "50%",
              border: `3px solid ${p.color}`, opacity: dotsOp,
            }} />
            <div style={{
              position: "absolute",
              left: cx + (p.labelOffsetX ?? 14),
              top: cy + (p.labelOffsetY ?? -8),
              fontFamily: FONT.sans, fontSize: 20, fontWeight: 500,
              color: p.color, whiteSpace: "nowrap", opacity: dotsOp,
            }}>
              {p.name}
            </div>
          </React.Fragment>
        );
      })}

      {/* ── "10x More Markets" — rides arrow front Y ───── */}
      {text1Op > 0.01 && (
        <div style={{
          position: "absolute",
          left: 0, right: 0,
          top: textUpY - 50,
          textAlign: "center",
          fontFamily: FONT.sans,
          fontSize: 86,
          fontWeight: 700,
          color: COLOR.textPrimary,
          letterSpacing: "-0.03em",
          opacity: text1Op,
        }}>
          10x More Markets
        </div>
      )}

      {/* ── "10x Less Costs" — rides arrow front X ──────── */}
      {text2Op > 0.01 && (
        <div style={{
          position: "absolute",
          left: textLeftX - 240,
          top: CHART.top - 60,
          fontFamily: FONT.sans,
          fontSize: 86,
          fontWeight: 700,
          color: COLOR.textPrimary,
          letterSpacing: "-0.03em",
          opacity: text2Op,
          whiteSpace: "nowrap",
        }}>
          10x Less Costs
        </div>
      )}

      {/* ── GM dot ────────────────────────────────────── */}
      <div style={{
        position: "absolute", left: GM_CX - 14, top: GM_CY - 14,
        width: 28, height: 28, borderRadius: "50%",
        backgroundColor: GM.color,
        boxShadow: `0 0 24px ${GM.color}60`,
        transform: `scale(${gmScale})`, opacity: gmOp,
      }} />
      <div style={{
        position: "absolute", left: GM_CX + 22, top: GM_CY - 10,
        fontFamily: FONT.sans, fontSize: 26, fontWeight: 700,
        color: GM.color, whiteSpace: "nowrap", opacity: gmOp,
      }}>
        {GM.name}
      </div>

      {/* ── Title at BOTTOM ───────────────────────────── */}
      <div style={{
        position: "absolute", bottom: 30, left: 0, right: 0,
        textAlign: "center", fontFamily: FONT.sans, fontSize: 24,
        fontWeight: 500, color: COLOR.textSecondary, opacity: axisOp,
        letterSpacing: "-0.01em",
      }}>
        Fee Cost for 1M Positions vs Number of Markets — Each Position at Minimum Trade Size
      </div>
    </AbsoluteFill>
  );
};
