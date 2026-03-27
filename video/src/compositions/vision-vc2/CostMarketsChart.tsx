/**
 * CostMarketsScene — Tight, rhythmic scatter animation
 *
 * No idle time. Every frame earns its keep.
 * Combines: staggered cascade (A) + afterimage trails (B) + beat-snapped timing (C).
 *
 * Beat 1 (f0-8):    Chart + dots slam in
 * Beat 2 (f10-22):  Arrows cascade UP (2-frame stagger) with ghost trails
 * Beat 3 (f24):     "10x More Markets" hard cut
 * Beat 4 (f32):     Arrows vanish (instant)
 * Beat 5 (f34-46):  Arrows cascade LEFT from top with trails
 * Beat 6 (f48):     "10x Less Costs" hard cut
 * Beat 7 (f54):     Everything vanishes
 * Beat 8 (f56):     GM slams in with ring pulse
 * Hold until f90.
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

const CH = { left: 160, right: 1840, top: 80, bottom: 880 };
const W = CH.right - CH.left;
const H = CH.bottom - CH.top;
const X_MAX = 30_000;
const Y_MAX = 620_000;
const px = (cost: number) => CH.left + (cost / X_MAX) * W;
const py = (mkts: number) => CH.bottom - (mkts / Y_MAX) * H;
const gmX = px(GM.cost);
const gmY = py(GM.markets);

const XT = [{ v: 0, l: "$0" }, { v: 10_000, l: "$10K" }, { v: 20_000, l: "$20K" }, { v: 30_000, l: "$30K" }];
const YT = [
  { v: 0, l: "0" }, { v: 100_000, l: "100K" }, { v: 200_000, l: "200K" },
  { v: 300_000, l: "300K" }, { v: 400_000, l: "400K" }, { v: 500_000, l: "500K" }, { v: 600_000, l: "600K" },
];

// ── Timing (8-frame grid, no idle) ────────────────────────────────────

const SHOW = 8;
const UP_START = 10;
const UP_DUR = 12;
const TEXT1_IN = 24;
const LEFT_START = 34;
const LEFT_DUR = 12;
const TEXT2_IN = 48;
const GM_IN = 56;

const ease = Easing.out(Easing.cubic);

// Ghost trail: 3 copies at decreasing opacity
const TRAIL_COUNT = 3;
const TRAIL_SPACING = 0.08; // fraction behind the head

// ── Component ─────────────────────────────────────────────────────────

export const CostMarketsScene: React.FC = () => {
  const f = useCurrentFrame();

  const show = interpolate(f, [0, SHOW], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease,
  });

  // ── Upward phase ──
  const upOn = f >= UP_START && f < UP_KILL;

  // ── Leftward phase ──
  const leftOn = f >= LEFT_START && f < ALL_KILL;

  // ── Text visibility (hard cut in, hard cut out) ──
  const text1On = f >= TEXT1_IN && f < UP_KILL;
  const text2On = f >= TEXT2_IN && f < ALL_KILL;

  // ── GM ──
  const gmS = spring({ frame: Math.max(0, f - GM_IN), fps: FPS, config: { damping: 10, stiffness: 250, mass: 0.4 } });
  const gmRingS = spring({ frame: Math.max(0, f - GM_IN), fps: FPS, config: { damping: 8, stiffness: 80, mass: 0.6 } });

  return (
    <AbsoluteFill style={{ backgroundColor: COLOR.page }}>
      {/* ── SVG ────────────────────────────────────────── */}
      <svg style={{ position: "absolute", inset: 0, width: 1920, height: 1080, pointerEvents: "none" }}>
        {/* Axes */}
        <g opacity={show}>
          <line x1={CH.left} y1={CH.bottom} x2={CH.right} y2={CH.bottom}
            stroke={COLOR.textMuted} strokeWidth={1} opacity={0.3} />
          <line x1={CH.left} y1={CH.top} x2={CH.left} y2={CH.bottom}
            stroke={COLOR.textMuted} strokeWidth={1} opacity={0.3} />
          {XT.map(t => {
            const x = px(t.v);
            return (<g key={`x${t.v}`}>
              {t.v > 0 && <line x1={x} y1={CH.top} x2={x} y2={CH.bottom}
                stroke={COLOR.textMuted} strokeWidth={1} opacity={0.05} strokeDasharray="4 6" />}
              <line x1={x} y1={CH.bottom} x2={x} y2={CH.bottom + 5}
                stroke={COLOR.textMuted} strokeWidth={1} opacity={0.25} />
              <text x={x} y={CH.bottom + 24} textAnchor="middle"
                fontFamily="Geist, Inter, sans-serif" fontSize={18} fill={COLOR.textSecondary}>{t.l}</text>
            </g>);
          })}
          {YT.map(t => {
            const y = py(t.v);
            return (<g key={`y${t.v}`}>
              {t.v > 0 && <line x1={CH.left} y1={y} x2={CH.right} y2={y}
                stroke={COLOR.textMuted} strokeWidth={1} opacity={0.05} strokeDasharray="4 6" />}
              <line x1={CH.left - 5} y1={y} x2={CH.left} y2={y}
                stroke={COLOR.textMuted} strokeWidth={1} opacity={0.25} />
              <text x={CH.left - 10} y={y + 5} textAnchor="end"
                fontFamily="Geist, Inter, sans-serif" fontSize={18} fill={COLOR.textSecondary}>{t.l}</text>
            </g>);
          })}
        </g>

        {/* ── Upward arrows with ghost trails ────────── */}
        {upOn && PLATFORMS.map((p, i) => {
          const cx = px(p.cost), cy = py(p.markets);
          const localF = f - UP_START - i * 2; // 2-frame stagger
          const prog = interpolate(localF, [0, UP_DUR], [0, 1], {
            extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease,
          });
          if (prog <= 0) return null;
          const dist = cy - CH.top;
          const tipY = cy - dist * prog;

          return (<g key={`u-${p.name}`}>
            {/* Ghost trails */}
            {Array.from({ length: TRAIL_COUNT }).map((_, t) => {
              const trailProg = Math.max(0, prog - (t + 1) * TRAIL_SPACING);
              const trailY = cy - dist * trailProg;
              return (<line key={t} x1={cx} y1={cy} x2={cx} y2={trailY}
                stroke={p.color} strokeWidth={4} strokeLinecap="round"
                opacity={0.12 - t * 0.03} />);
            })}
            {/* Main arrow */}
            <line x1={cx} y1={cy} x2={cx} y2={tipY}
              stroke={p.color} strokeWidth={4} strokeLinecap="round" opacity={0.6} />
            <polygon points="0,-10 11,0 -11,0"
              transform={`translate(${cx},${tipY})`} fill={p.color} opacity={0.7} />
          </g>);
        })}

        {/* ── Leftward arrows with ghost trails ──────── */}
        {leftOn && PLATFORMS.map((p, i) => {
          const cx = px(p.cost);
          const localF = f - LEFT_START - i * 2;
          const prog = interpolate(localF, [0, LEFT_DUR], [0, 1], {
            extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease,
          });
          if (prog <= 0) return null;
          const dist = cx - CH.left;
          const tipX = cx - dist * prog;

          return (<g key={`l-${p.name}`}>
            {Array.from({ length: TRAIL_COUNT }).map((_, t) => {
              const trailProg = Math.max(0, prog - (t + 1) * TRAIL_SPACING);
              const trailX = cx - dist * trailProg;
              return (<line key={t} x1={cx} y1={CH.top} x2={trailX} y2={CH.top}
                stroke={p.color} strokeWidth={4} strokeLinecap="round"
                opacity={0.12 - t * 0.03} />);
            })}
            <line x1={cx} y1={CH.top} x2={tipX} y2={CH.top}
              stroke={p.color} strokeWidth={4} strokeLinecap="round" opacity={0.6} />
            <polygon points="-10,0 0,11 0,-11"
              transform={`translate(${tipX},${CH.top})`} fill={p.color} opacity={0.7} />
          </g>);
        })}

        {/* ── GM ring pulse ──────────────────────────── */}
        {f >= GM_IN && (
          <circle cx={gmX} cy={gmY}
            r={14 + gmRingS * 40}
            fill="none" stroke={GM.color} strokeWidth={2}
            opacity={0.4 * (1 - gmRingS)} />
        )}
      </svg>

      {/* ── Dots + labels ──────────────────────────────── */}
      {PLATFORMS.map(p => {
        const cx = px(p.cost), cy = py(p.markets);
        return (<React.Fragment key={p.name}>
          <div style={{
            position: "absolute", left: cx - 9, top: cy - 9,
            width: 18, height: 18, borderRadius: "50%",
            border: `2.5px solid ${p.color}`, opacity: show,
          }} />
          <div style={{
            position: "absolute", left: cx + p.lx, top: cy + p.ly,
            fontFamily: FONT.sans, fontSize: 18, fontWeight: 500,
            color: p.color, whiteSpace: "nowrap", opacity: show,
          }}>{p.name}</div>
        </React.Fragment>);
      })}

      {/* ── "10x More Markets" — hard cut ───────────────── */}
      {text1On && (
        <div style={{
          position: "absolute", left: 0, right: 0,
          top: CH.top + H * 0.32,
          textAlign: "center",
          fontFamily: FONT.sans, fontSize: 92, fontWeight: 700,
          color: COLOR.textPrimary, letterSpacing: "-0.04em",
        }}>
          10x More Markets
        </div>
      )}

      {/* ── "10x Less Costs" — hard cut ─────────────────── */}
      {text2On && (
        <div style={{
          position: "absolute", left: 0, right: 0,
          top: CH.top + H * 0.32,
          textAlign: "center",
          fontFamily: FONT.sans, fontSize: 92, fontWeight: 700,
          color: COLOR.textPrimary, letterSpacing: "-0.04em",
        }}>
          10x Less Costs
        </div>
      )}

      {/* ── GM dot (overshoot slam) ───────────────────── */}
      {f >= GM_IN && (() => {
        const s = interpolate(gmS, [0, 1], [0, 1]);
        const overshoot = interpolate(gmS, [0, 0.6, 1], [0, 1.3, 1]);
        return (<>
          <div style={{
            position: "absolute", left: gmX - 16, top: gmY - 16,
            width: 32, height: 32, borderRadius: "50%",
            backgroundColor: GM.color,
            boxShadow: `0 0 20px ${GM.color}50`,
            transform: `scale(${overshoot})`,
            opacity: interpolate(s, [0, 0.15], [0, 1], { extrapolateRight: "clamp" }),
          }} />
          <div style={{
            position: "absolute", left: gmX + 22, top: gmY - 11,
            fontFamily: FONT.sans, fontSize: 24, fontWeight: 700,
            color: GM.color, whiteSpace: "nowrap",
            opacity: interpolate(s, [0, 0.15], [0, 1], { extrapolateRight: "clamp" }),
          }}>
            {GM.name}
          </div>
        </>);
      })()}

      {/* ── Bottom title ──────────────────────────────── */}
      <div style={{
        position: "absolute", bottom: 26, left: 0, right: 0,
        textAlign: "center", fontFamily: FONT.sans, fontSize: 21,
        fontWeight: 500, color: COLOR.textSecondary, opacity: show,
      }}>
        Fee Cost for 1M Positions vs Number of Markets — Each Position at Minimum Trade Size
      </div>
    </AbsoluteFill>
  );
};
