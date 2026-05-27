import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame } from "remotion";
import { C, EASE, FPS, H, HOUSE_SPRING, MONO, SANS, W } from "./theme";
import { BrandMark } from "../../components/BrandMark";
import { DotGrid, DotGridVignette } from "../anticheat/DotGrid";

/* ── Block Trading, weighed ──────────────────────────────────────────────────
 * One slide, one idea: the trade of block trading against the loud venues.
 * Two glass columns — what you give up on the right, what you gain on the left —
 * each item rising on the house spring, color-coded by the cost it carries. The
 * camera makes one slow push and never pulls back. Frame 0 is already composed
 * and already moving: the title and headers stand, the first rows are mid-rise. */

const DURATION = 270; // 9s

type Side = "pro" | "con";

const PROS = ["Easier counterparties", "1000× number of trades", "Niche markets", "No spread"];
const CONS = ["Harder to trade", "No arbitrage & front-running strategy"];

// Layout — two columns centered on 1068, the Apple content width.
const COL_W = 740;
const GAP = 90;
const LEFT_X = (W - (COL_W * 2 + GAP)) / 2; // 175
const RIGHT_X = LEFT_X + COL_W + GAP; // 1005
const COL_TOP = 326;
const COL_H = 622;
const PAD = 52;

// One settle for every arrival.
const rise = (frame: number, start: number) => {
  const s = spring({ frame: frame - start, fps: FPS, config: HOUSE_SPRING, durationInFrames: 26 });
  return { s, ty: (1 - s) * 30 };
};

const Glyph: React.FC<{ kind: Side; size: number; color: string }> = ({ kind, size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    {kind === "pro" ? (
      <path d="M5 12.5 L10 17.5 L19.5 7" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    ) : (
      <path d="M7 7 L17 17 M17 7 L7 17" stroke={color} strokeWidth={3} strokeLinecap="round" />
    )}
  </svg>
);

const ItemIcon: React.FC<{ kind: Side; accent: string }> = ({ kind, accent }) => (
  <div
    style={{
      width: 48,
      height: 48,
      borderRadius: "50%",
      background: `${accent}1A`,
      border: `1.5px solid ${accent}55`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    }}
  >
    <Glyph kind={kind} size={28} color={accent} />
  </div>
);

const Column: React.FC<{
  kind: Side;
  label: string;
  accent: string;
  items: string[];
  x: number;
  frame: number;
  starts: number[]; // [shell, ...one per item]
}> = ({ kind, label, accent, items, x, frame, starts }) => {
  const shell = rise(frame, starts[0]);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: COL_TOP,
        width: COL_W,
        height: COL_H,
        padding: PAD,
        boxSizing: "border-box",
        borderRadius: 36,
        background: C.glass,
        border: `1px solid ${C.glassBorder}`,
        boxShadow: "0 30px 80px rgba(40,44,90,0.14), inset 0 1px 0 rgba(255,255,255,0.9)",
        backdropFilter: "saturate(180%) blur(20px)",
        WebkitBackdropFilter: "saturate(180%) blur(20px)",
        overflow: "hidden",
        opacity: shell.s,
        transform: `translateY(${shell.ty}px)`,
      }}
    >
      {/* color-coded top edge + glow */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 6, background: accent }} />
      <div
        style={{
          position: "absolute",
          top: -170,
          left: "50%",
          transform: "translateX(-50%)",
          width: 540,
          height: 380,
          background: `radial-gradient(closest-side, ${accent}22, transparent 70%)`,
        }}
      />

      {/* header */}
      <div style={{ display: "flex", alignItems: "center", gap: 22, marginBottom: 22 }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 20,
            background: accent,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 10px 28px ${accent}66`,
          }}
        >
          <Glyph kind={kind} size={36} color="#fff" />
        </div>
        <span style={{ fontFamily: MONO, fontSize: 31, fontWeight: 700, letterSpacing: "0.16em", color: accent }}>
          {label}
        </span>
      </div>
      <div style={{ height: 1, background: C.rule }} />

      {/* items */}
      {items.map((t, i) => {
        const r = rise(frame, starts[i + 1]);
        return (
          <div
            key={t}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 24,
              paddingTop: 26,
              paddingBottom: 26,
              opacity: r.s,
              transform: `translateY(${r.ty}px)`,
            }}
          >
            <ItemIcon kind={kind} accent={accent} />
            <span
              style={{
                fontFamily: SANS,
                fontSize: 40,
                fontWeight: 600,
                letterSpacing: "-0.01em",
                color: C.text,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {t}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export const ProsAndCons: React.FC = () => {
  const frame = useCurrentFrame();

  // One slow, assured push — already moving at frame 0, never pulls back.
  const push = interpolate(frame, [0, DURATION], [1.0, 1.045], {
    easing: EASE.cam,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <DotGrid intensity={0.7} speed={0.9} />
      <DotGridVignette intensity={0.24} />
      <BrandMark surface="light" />

      <AbsoluteFill style={{ transform: `scale(${push})`, transformOrigin: "50% 46%" }}>
        {/* title block — one primary line, detail directly beneath */}
        <div style={{ position: "absolute", top: 112, left: 0, right: 0, textAlign: "center" }}>
          <div style={{ fontFamily: SANS, fontSize: 76, fontWeight: 800, letterSpacing: "-0.03em", color: C.text }}>
            Block Trading
          </div>
          <div
            style={{
              fontFamily: SANS,
              fontSize: 34,
              fontWeight: 500,
              letterSpacing: "-0.01em",
              color: C.dim,
              marginTop: 12,
            }}
          >
            <span style={{ color: C.faint }}>vs</span>&nbsp;&nbsp;Perps · Options · Predictions · Launchpads
          </div>
        </div>

        <Column
          kind="pro"
          label="PROS"
          accent={C.up}
          items={PROS}
          x={LEFT_X}
          frame={frame}
          starts={[-6, 0, 12, 24, 36]}
        />
        <Column kind="con" label="CONS" accent={C.down} items={CONS} x={RIGHT_X} frame={frame} starts={[-4, 4, 16]} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const prosAndConsMeta = {
  id: "BlockTradingProsCons",
  component: ProsAndCons,
  durationInFrames: DURATION,
  fps: FPS,
  width: W,
  height: H,
};
