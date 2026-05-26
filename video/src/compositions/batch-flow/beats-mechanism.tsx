import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, EASE, NEON, font, monoFont } from "./theme";
import { BeatTitle, CaptionPill, useFade } from "./chrome";
import { PILL_GRADIENT } from "./theme";
import {
  MARKETS,
  N_TRADERS,
  PICKS_BY_MARKET,
  TRADER_NAMES,
  YOUR_COLLECT,
  YOUR_NET,
  YOUR_STAKE,
  YOUR_WINS,
  yourReturn,
} from "./data";
import { LineRow, Packet, TraderChip } from "./flow";
import { CONFIRM_POS, Cursor, ProductUI, cardButtonPos } from "./ui";

type BeatProps = { durationInFrames: number };

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const TRADER_COLORS = [NEON[0], NEON[5], NEON[3], NEON[4], NEON[7]];
const YOUR_PICKS = MARKETS.map((m) => m.you);

const SEL_START = 48;
const SEL_STEP = 30;

// ─── 1 · The product ─────────────────────────────────────────────────────────
//
// The real dashboard. A cursor walks the ten cards, calling up or down on each
// — the stake already reads $1 × 10 markets.

export const ProductBeat: React.FC<BeatProps> = ({ durationInFrames }) => {
  const frame = useCurrentFrame();
  const fade = useFade(durationInFrames);

  const picks = MARKETS.map((m, i) => (frame >= SEL_START + i * SEL_STEP ? m.you : null));

  const p = Math.max(0, Math.min(MARKETS.length - 1.0001, (frame - SEL_START) / SEL_STEP));
  const i0 = Math.floor(p);
  const i1 = Math.min(MARKETS.length - 1, i0 + 1);
  const f = p - i0;
  const e = interpolate(f, [0, 1], [0, 1], { easing: EASE.inOut });
  const a = cardButtonPos(i0, MARKETS[i0].you);
  const b = cardButtonPos(i1, MARKETS[i1].you);
  const cursorX = a.x + (b.x - a.x) * e;
  const cursorY = a.y + (b.y - a.y) * e;
  const click = frame < SEL_START ? 0 : f < 0.3 ? 1 - f / 0.3 : 0;
  const activeIndex =
    frame < SEL_START ? null : Math.min(MARKETS.length - 1, Math.round((frame - SEL_START) / SEL_STEP));
  const cursorVisible = frame > 26 && frame < durationInFrames - 24;

  const intro = interpolate(frame, [0, 18], [1.03, 1.0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });

  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <AbsoluteFill style={{ transform: `scale(${intro.toFixed(4)})`, transformOrigin: "50% 46%" }}>
        <ProductUI picks={picks} activeIndex={activeIndex} />
        {cursorVisible ? <Cursor x={cursorX} y={cursorY} click={click} /> : null}
      </AbsoluteFill>
      <CaptionPill text="Pick up or down on ten markets" delay={14} />
    </AbsoluteFill>
  );
};

// Each trader's full ten-line ticket (trader t across all markets).
const TRADER_TICKETS: ("up" | "down")[][] = TRADER_NAMES.map((_n, t) =>
  MARKETS.map((_m, i) => PICKS_BY_MARKET[i][t]),
);

// ─── 2 · Enter the trade ─────────────────────────────────────────────────────

export const EnterBeat: React.FC<BeatProps> = ({ durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fade = useFade(durationInFrames);

  const cFrom = cardButtonPos(9, "up");
  const ct = interpolate(frame, [0, 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.inOut });
  const cx = lerp(cFrom.x, CONFIRM_POS.x, ct);
  const cy = lerp(cFrom.y, CONFIRM_POS.y, ct);
  const click = frame >= 18 && frame < 34 ? 1 - (frame - 18) / 16 : 0;
  const confirmGlow = interpolate(frame, [20, 30, 60], [0, 1, 0.32], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const uiOpacity = interpolate(frame, [70, 96], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const pk = spring({ fps, frame: Math.max(0, frame - 64), config: { mass: 0.8, damping: 15, stiffness: 90 }, durationInFrames: 40 });
  const px = lerp(CONFIRM_POS.x, 960, pk);
  const py = lerp(CONFIRM_POS.y, 472, pk);
  const ps = lerp(0.55, 1.0, pk);

  return (
    <AbsoluteFill style={{ opacity: fade }}>
      {uiOpacity > 0.01 ? (
        <AbsoluteFill style={{ opacity: uiOpacity }}>
          <ProductUI picks={YOUR_PICKS} activeIndex={null} confirmGlow={confirmGlow} />
          {frame < 62 ? <Cursor x={cx} y={cy} click={click} /> : null}
        </AbsoluteFill>
      ) : null}
      {frame > 60 ? (
        <div style={{ position: "absolute", left: px, top: py, transform: `translate(-50%,-50%) scale(${ps.toFixed(3)})` }}>
          <Packet picks={YOUR_PICKS} label="You" glow={C.blue} />
        </div>
      ) : null}
      <CaptionPill text="Confirm — ten calls become one packet" delay={104} />
    </AbsoluteFill>
  );
};

// ─── 3 · Five traders, one pool ──────────────────────────────────────────────

const TRADER_X = [310, 645, 960, 1275, 1610];
const POOL = { x: 960, y: 756, w: 560, h: 148 };

export const TradersBeat: React.FC<BeatProps> = ({ durationInFrames }) => {
  const frame = useCurrentFrame();
  const fade = useFade(durationInFrames);
  const launch = (i: number) => 34 + i * 16;
  const arrived = TRADER_NAMES.filter((_n, i) => (frame - launch(i)) / 46 >= 1).length;
  const poolGlow = arrived / N_TRADERS;

  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <BeatTitle title="Everyone sends the same packet" sub="five traders, one pool" />
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <defs>
          <linearGradient id="bf-flow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2997ff" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#9E7BFF" stopOpacity="0.14" />
          </linearGradient>
        </defs>
        {TRADER_X.map((tx, i) => {
          const appear = interpolate(frame, [launch(i), launch(i) + 22], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <path
              key={i}
              d={`M ${tx} 392 C ${tx} 560, ${POOL.x} 600, ${POOL.x} ${POOL.y - POOL.h / 2}`}
              stroke="url(#bf-flow)"
              strokeWidth={3}
              fill="none"
              opacity={appear * 0.6}
              strokeDasharray="2 9"
              strokeLinecap="round"
            />
          );
        })}
      </svg>
      {TRADER_NAMES.map((name, i) => (
        <div key={`chip-${i}`} style={{ position: "absolute", left: TRADER_X[i], top: 300, transform: "translateX(-50%)" }}>
          <TraderChip name={name} color={TRADER_COLORS[i]} />
        </div>
      ))}
      {TRADER_NAMES.map((name, i) => {
        const t = interpolate(frame, [launch(i), launch(i) + 46], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.inOut });
        if (t <= 0) return null;
        const x = lerp(TRADER_X[i], POOL.x, t);
        const y = lerp(392, POOL.y, t);
        const s = lerp(0.6, 0.28, t);
        const op = t < 0.85 ? 1 : interpolate(t, [0.85, 1], [1, 0]);
        return (
          <div key={`pk-${i}`} style={{ position: "absolute", left: x, top: y, transform: `translate(-50%,-50%) scale(${s.toFixed(3)})`, opacity: op }}>
            <Packet picks={TRADER_TICKETS[i]} label={name} glow={TRADER_COLORS[i]} w={210} />
          </div>
        );
      })}
      <div
        style={{
          position: "absolute",
          left: POOL.x - POOL.w / 2,
          top: POOL.y - POOL.h / 2,
          width: POOL.w,
          height: POOL.h,
          borderRadius: 22,
          border: `2px solid ${C.blue}`,
          background: "linear-gradient(160deg, rgba(255,255,255,0.72), rgba(255,255,255,0.48))",
          boxShadow: `0 16px 40px rgba(70,74,140,0.18), 0 0 ${(18 + poolGlow * 52).toFixed(0)}px ${C.blue}${poolGlow > 0 ? "66" : "22"}, inset 0 1px 0 rgba(255,255,255,0.85)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: font, fontSize: 36, fontWeight: 800, color: C.text }}>POOL</div>
          <div style={{ fontFamily: monoFont, fontSize: 20, fontWeight: 700, color: C.dim, marginTop: 4 }}>
            {arrived} / 5 packets · ${arrived * 10}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── 4 · The pool matches, line by line ──────────────────────────────────────

const ROWS_X = 487;
const ROWS_Y = 300;
const BAR_W = 560;

export const PoolBeat: React.FC<BeatProps> = ({ durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fade = useFade(durationInFrames);
  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <BeatTitle title="Each line, matched" sub="up stakes against down stakes" />
      <div style={{ position: "absolute", left: ROWS_X, top: ROWS_Y, display: "flex", flexDirection: "column", gap: 4 }}>
        {MARKETS.map((_m, i) => {
          const reveal = spring({ fps, frame: Math.max(0, frame - (18 + i * 6)), config: { damping: 16, stiffness: 120, mass: 0.6 }, durationInFrames: 24 });
          return <LineRow key={i} index={i} barW={BAR_W} reveal={Math.min(1, reveal)} settle={0} />;
        })}
      </div>
    </AbsoluteFill>
  );
};

// ─── 5 · Settlement, each market on its own ───────────────────────────────────

export const SettleBeat: React.FC<BeatProps> = ({ durationInFrames }) => {
  const frame = useCurrentFrame();
  const fade = useFade(durationInFrames);
  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <BeatTitle title="Each market settles on its own" sub="up takes down, or down takes up" />
      <div style={{ position: "absolute", left: ROWS_X, top: ROWS_Y, display: "flex", flexDirection: "column", gap: 4 }}>
        {MARKETS.map((_m, i) => {
          const settle = interpolate(frame, [26 + i * 11, 26 + i * 11 + 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.inOut });
          return <LineRow key={i} index={i} barW={BAR_W} reveal={1} settle={settle} />;
        })}
      </div>
    </AbsoluteFill>
  );
};

// ─── 6 · Your payout ─────────────────────────────────────────────────────────

export const PayoutBeat: React.FC<BeatProps> = ({ durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fade = useFade(durationInFrames);
  const collected = interpolate(frame, [44, 116], [0, YOUR_COLLECT], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const netOp = interpolate(frame, [124, 142], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <BeatTitle title="You collect every winning line" sub="the sum of your winning positions" />
      <div style={{ position: "absolute", top: 286, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 12 }}>
        {MARKETS.map((m, i) => {
          const won = m.you === m.outcome;
          const r = spring({ fps, frame: Math.max(0, frame - (20 + i * 5)), config: { damping: 15, stiffness: 130, mass: 0.6 }, durationInFrames: 22 });
          return (
            <div
              key={i}
              style={{
                width: 136,
                padding: "14px 10px 12px",
                borderRadius: 14,
                background: "linear-gradient(160deg, rgba(255,255,255,0.66), rgba(255,255,255,0.40))",
                border: `1.5px solid ${won ? C.up : "rgba(255,255,255,0.6)"}`,
                boxShadow: won
                  ? `0 12px 30px ${C.up}40, inset 0 1px 0 rgba(255,255,255,0.85)`
                  : "0 8px 22px rgba(70,74,140,0.12), inset 0 1px 0 rgba(255,255,255,0.8)",
                textAlign: "center",
                opacity: Math.min(1, r),
                transform: `translateY(${((1 - Math.min(1, r)) * 16).toFixed(1)}px)`,
              }}
            >
              <div style={{ fontFamily: font, fontSize: 26, fontWeight: 800, color: m.you === "up" ? C.up : C.down }}>
                {m.you === "up" ? "▲" : "▼"}
              </div>
              <div style={{ fontFamily: font, fontSize: 28, fontWeight: 800, color: won ? C.up : C.down, margin: "4px 0 2px" }}>
                {won ? "✓" : "✗"}
              </div>
              <div style={{ fontFamily: monoFont, fontSize: 16, fontWeight: 700, color: won ? C.text : C.faint }}>
                {won ? `+$${yourReturn(i).toFixed(2)}` : "—"}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", top: 560, left: 0, right: 0, textAlign: "center" }}>
        <div style={{ fontFamily: monoFont, fontSize: 26, fontWeight: 700, letterSpacing: "0.04em", color: C.dim }}>
          {YOUR_WINS} OF 10 LINES WON
        </div>
        <div
          style={{
            fontFamily: font,
            fontSize: 168,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            lineHeight: 1.0,
            fontVariantNumeric: "tabular-nums",
            background: PILL_GRADIENT,
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            filter: "drop-shadow(0 14px 36px rgba(94,120,255,0.40))",
          }}
        >
          ${collected.toFixed(2)}
        </div>
        <div style={{ fontFamily: font, fontSize: 40, fontWeight: 700, color: C.up, opacity: netOp }}>
          collected — net +${YOUR_NET.toFixed(2)} on ${YOUR_STAKE}
        </div>
      </div>
    </AbsoluteFill>
  );
};
