/**
 * CostMarketsScene — Clean animated scatter
 *
 * Three clean beats, no overlap:
 *   Beat 1: Chart + dots appear
 *   Beat 2: Arrows UP + "10x More Markets" (then fade)
 *   Beat 3: Arrows LEFT from top + "10x Less Costs" (then fade)
 *   Beat 4: GM dot springs in
 *
 * Each phase does ONE thing. No position coupling between text and arrows.
 */
import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  spring,
  Easing,
} from "remotion";
import { COLOR, FONT, ANIM } from "./tokens";

const FPS = 30;

// ── Data ──────────────────────────────────────────────────────────────

const PLATFORMS = [
  { name: "Bitget", markets: 800, cost: 2_000, color: "#00B8A9", lx: 14, ly: 10 },
  { name: "Binance", markets: 1_600, cost: 5_000, color: "#D4A017", lx: 14, ly: -24 },
  { name: "Polymarket", markets: 36_000, cost: 10_000, color: "#7B68EE", lx: 14, ly: -8 },
  { name: "Pump.fun", markets: 95_500, cost: 12_500, color: "#7CB342", lx: 14, ly: -8 },
  { name: "Kalshi", markets: 35_000, cost: 20_000, color: "#FF5722", lx: 14, ly: 10 },
  { name: "Coinbase", markets: 300, cost: 24_000, color: "#0052FF", lx: 14, ly: -24 },
];

const GM = { name: "General Market", markets: 580_000, cost: 0, color: "#00C853" };

// ── Chart ─────────────────────────────────────────────────────────────

const C = { left: 160, right: 1840, top: 80, bottom: 880 };
const W = C.right - C.left;
const H = C.bottom - C.top;
const X_MAX = 30_000;
const Y_MAX = 620_000;
const x = (cost: number) => C.left + (cost / X_MAX) * W;
const y = (mkts: number) => C.bottom - (mkts / Y_MAX) * H;
const gmX = x(GM.cost);
const gmY = y(GM.markets);

const XT = [{ v: 0, l: "$0" }, { v: 10_000, l: "$10K" }, { v: 20_000, l: "$20K" }, { v: 30_000, l: "$30K" }];
const YT = [
  { v: 0, l: "0" }, { v: 100_000, l: "100K" }, { v: 200_000, l: "200K" },
  { v: 300_000, l: "300K" }, { v: 400_000, l: "400K" }, { v: 500_000, l: "500K" }, { v: 600_000, l: "600K" },
];

// ── Timing (clean beats, no overlap) ──────────────────────────────────

const APPEAR = 15;       // chart fully visible
const UP_START = 20;     // arrows begin
const UP_DONE = 38;      // arrows fully drawn (easeOut — slows at end)
const UP_FADE = 48;      // arrows + text gone
const LEFT_START = 52;   // leftward arrows begin
const LEFT_DONE = 70;    // fully drawn
const LEFT_FADE = 80;    // gone
const GM_IN = 84;        // GM springs in

const ease = Easing.out(Easing.cubic);

// ── Helpers ───────────────────────────────────────────────────────────

function phase(frame: number, start: number, end: number) {
  return interpolate(frame, [start, end], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease,
  });
}

function fadeOut(frame: number, start: number, end: number) {
  return interpolate(frame, [start, end], [1, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
}

// ── Component ─────────────────────────────────────────────────────────

export const CostMarketsScene: React.FC = () => {
  const f = useCurrentFrame();

  const show = interpolate(f, [0, APPEAR], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Phase 2: up
  const upProg = phase(f, UP_START, UP_DONE);
  const upVis = f >= UP_START && f < UP_FADE;
  const upOp = upVis ? (f >= UP_DONE ? fadeOut(f, UP_DONE, UP_FADE) : 1) : 0;

  // Phase 3: left
  const leftProg = phase(f, LEFT_START, LEFT_DONE);
  const leftVis = f >= LEFT_START && f < LEFT_FADE;
  const leftOp = leftVis ? (f >= LEFT_DONE ? fadeOut(f, LEFT_DONE, LEFT_FADE) : 1) : 0;

  // Phase 4: GM
  const gmS = spring({ frame: Math.max(0, f - GM_IN), fps: FPS, config: ANIM.springMedium });

  // Text springs (appear once, no tracking)
  const text1S = spring({ frame: Math.max(0, f - UP_START - 3), fps: FPS, config: { damping: 200 } });
  const text1Op = text1S * (f < UP_FADE ? fadeOut(f, UP_DONE, UP_FADE) : 0);
  const text2S = spring({ frame: Math.max(0, f - LEFT_START - 3), fps: FPS, config: { damping: 200 } });
  const text2Op = text2S * (f < LEFT_FADE ? fadeOut(f, LEFT_DONE, LEFT_FADE) : 0);

  return (
    <AbsoluteFill style={{ backgroundColor: COLOR.page }}>
      {/* ── SVG ────────────────────────────────────────── */}
      <svg style={{ position: "absolute", inset: 0, width: 1920, height: 1080, pointerEvents: "none" }}>
        {/* Axes + ticks */}
        <g opacity={show}>
          <line x1={C.left} y1={C.bottom} x2={C.right} y2={C.bottom}
            stroke={COLOR.textMuted} strokeWidth={1} opacity={0.3} />
          <line x1={C.left} y1={C.top} x2={C.left} y2={C.bottom}
            stroke={COLOR.textMuted} strokeWidth={1} opacity={0.3} />
          {XT.map(t => {
            const px = x(t.v);
            return (<g key={`x${t.v}`}>
              {t.v > 0 && <line x1={px} y1={C.top} x2={px} y2={C.bottom}
                stroke={COLOR.textMuted} strokeWidth={1} opacity={0.05} strokeDasharray="4 6" />}
              <line x1={px} y1={C.bottom} x2={px} y2={C.bottom + 5}
                stroke={COLOR.textMuted} strokeWidth={1} opacity={0.25} />
              <text x={px} y={C.bottom + 26} textAnchor="middle"
                fontFamily="Geist, Inter, sans-serif" fontSize={19} fill={COLOR.textSecondary}>{t.l}</text>
            </g>);
          })}
          {YT.map(t => {
            const py = y(t.v);
            return (<g key={`y${t.v}`}>
              {t.v > 0 && <line x1={C.left} y1={py} x2={C.right} y2={py}
                stroke={COLOR.textMuted} strokeWidth={1} opacity={0.05} strokeDasharray="4 6" />}
              <line x1={C.left - 5} y1={py} x2={C.left} y2={py}
                stroke={COLOR.textMuted} strokeWidth={1} opacity={0.25} />
              <text x={C.left - 10} y={py + 5} textAnchor="end"
                fontFamily="Geist, Inter, sans-serif" fontSize={19} fill={COLOR.textSecondary}>{t.l}</text>
            </g>);
          })}
        </g>

        {/* ── Upward arrows ──────────────────────────── */}
        {upOp > 0 && PLATFORMS.map(p => {
          const cx = x(p.cost), cy = y(p.markets);
          const tipY = cy - (cy - C.top) * upProg;
          return (<g key={`u-${p.name}`} opacity={upOp * 0.55}>
            <line x1={cx} y1={cy} x2={cx} y2={tipY}
              stroke={p.color} strokeWidth={4} strokeLinecap="round" />
            <polygon points="0,-10 12,0 -12,0"
              transform={`translate(${cx},${tipY})`} fill={p.color} />
          </g>);
        })}

        {/* ── Leftward arrows (from chart top) ───────── */}
        {leftOp > 0 && PLATFORMS.map(p => {
          const cx = x(p.cost);
          const tipX = cx - (cx - C.left) * leftProg;
          return (<g key={`l-${p.name}`} opacity={leftOp * 0.55}>
            <line x1={cx} y1={C.top} x2={tipX} y2={C.top}
              stroke={p.color} strokeWidth={4} strokeLinecap="round" />
            <polygon points="-10,0 0,12 0,-12"
              transform={`translate(${tipX},${C.top})`} fill={p.color} />
          </g>);
        })}
      </svg>

      {/* ── Dots + labels ──────────────────────────────── */}
      {PLATFORMS.map(p => {
        const cx = x(p.cost), cy = y(p.markets);
        return (<React.Fragment key={p.name}>
          <div style={{
            position: "absolute", left: cx - 9, top: cy - 9,
            width: 18, height: 18, borderRadius: "50%",
            border: `2.5px solid ${p.color}`, opacity: show,
          }} />
          <div style={{
            position: "absolute", left: cx + p.lx, top: cy + p.ly,
            fontFamily: FONT.sans, fontSize: 19, fontWeight: 500,
            color: p.color, whiteSpace: "nowrap", opacity: show,
          }}>{p.name}</div>
        </React.Fragment>);
      })}

      {/* ── "10x More Markets" — fixed center, spring scale ─ */}
      {text1Op > 0.01 && (
        <div style={{
          position: "absolute", left: 0, right: 0,
          top: C.top + H * 0.35,
          textAlign: "center",
          fontFamily: FONT.sans, fontSize: 88, fontWeight: 700,
          color: COLOR.textPrimary, letterSpacing: "-0.03em",
          opacity: text1Op,
          transform: `scale(${text1S})`,
        }}>
          10x More Markets
        </div>
      )}

      {/* ── "10x Less Costs" — fixed center, spring scale ─── */}
      {text2Op > 0.01 && (
        <div style={{
          position: "absolute", left: 0, right: 0,
          top: C.top + H * 0.35,
          textAlign: "center",
          fontFamily: FONT.sans, fontSize: 88, fontWeight: 700,
          color: COLOR.textPrimary, letterSpacing: "-0.03em",
          opacity: text2Op,
          transform: `scale(${text2S})`,
        }}>
          10x Less Costs
        </div>
      )}

      {/* ── GM dot ────────────────────────────────────── */}
      <div style={{
        position: "absolute", left: gmX - 14, top: gmY - 14,
        width: 28, height: 28, borderRadius: "50%",
        backgroundColor: GM.color,
        boxShadow: `0 0 20px ${GM.color}50`,
        transform: `scale(${gmS})`,
        opacity: interpolate(gmS, [0, 0.2], [0, 1], { extrapolateRight: "clamp" }),
      }} />
      <div style={{
        position: "absolute", left: gmX + 20, top: gmY - 10,
        fontFamily: FONT.sans, fontSize: 24, fontWeight: 700,
        color: GM.color, whiteSpace: "nowrap",
        opacity: interpolate(gmS, [0, 0.2], [0, 1], { extrapolateRight: "clamp" }),
      }}>
        {GM.name}
      </div>

      {/* ── Bottom title ──────────────────────────────── */}
      <div style={{
        position: "absolute", bottom: 28, left: 0, right: 0,
        textAlign: "center", fontFamily: FONT.sans, fontSize: 22,
        fontWeight: 500, color: COLOR.textSecondary, opacity: show,
      }}>
        Fee Cost for 1M Positions vs Number of Markets — Each Position at Minimum Trade Size
      </div>
    </AbsoluteFill>
  );
};
