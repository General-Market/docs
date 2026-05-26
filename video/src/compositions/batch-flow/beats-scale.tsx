import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, EASE, font, monoFont, PILL_GRADIENT } from "./theme";
import { BeatTitle, useFade } from "./chrome";
import { CHAIN_STEPS, CHAIN_TOTAL, HYPERLIQUID_TRADES_PER_DAY, LIQUIDITY_UNLOCKED } from "./data";

type BeatProps = { durationInFrames: number };

const commas = (n: number): string => Math.round(n).toLocaleString("en-US");

const heroNumber = (size: number): React.CSSProperties => ({
  fontFamily: font,
  fontSize: size,
  fontWeight: 800,
  letterSpacing: "-0.035em",
  lineHeight: 0.92,
  fontVariantNumeric: "tabular-nums",
  background: PILL_GRADIENT,
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
  filter: "drop-shadow(0 16px 40px rgba(94,120,255,0.40))",
});

// ─── 7 · The multiplication — one trade explodes into ten million ─────────────
//
// A running product, center stage. Each factor snaps in and the number leaps:
// 1 → 10,000 → 1,000,000 → 10,000,000. No fades — the product pulses on arrival.

const STEP_AT = [46, 120, 194];
const STEP_DUR = 26;

const cumulative = (() => {
  const c = [1];
  CHAIN_STEPS.forEach((s, i) => c.push(c[i] * s.factor));
  return c; // [1, 10000, 1e6, 1e7]
})();

const FactorChip: React.FC<{ at: number; head: string; sub: string; seed?: boolean }> = ({
  at,
  head,
  sub,
  seed = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const r = Math.min(
    1,
    spring({ fps, frame: Math.max(0, frame - at), config: { damping: 14, stiffness: 130, mass: 0.6 }, durationInFrames: 22 }),
  );
  return (
    <div
      style={{
        opacity: r,
        transform: `translateY(${((1 - r) * 16).toFixed(1)}px) scale(${(0.92 + 0.08 * r).toFixed(3)})`,
        minWidth: 188,
        padding: "16px 22px",
        borderRadius: 18,
        textAlign: "center",
        background: seed
          ? "linear-gradient(160deg, rgba(255,255,255,0.86), rgba(255,255,255,0.62))"
          : PILL_GRADIENT,
        border: seed ? "1px solid rgba(60,64,130,0.16)" : "none",
        boxShadow: seed
          ? "0 10px 26px rgba(70,74,140,0.14), inset 0 1px 0 rgba(255,255,255,0.9)"
          : "0 14px 34px rgba(94,120,255,0.36), inset 0 1px 0 rgba(255,255,255,0.45)",
      }}
    >
      <div
        style={{
          fontFamily: font,
          fontSize: 38,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          color: seed ? C.text : "#fff",
          textShadow: seed ? "none" : "0 1px 2px rgba(40,40,90,0.28)",
        }}
      >
        {head}
      </div>
      <div
        style={{
          fontFamily: monoFont,
          fontSize: 16,
          fontWeight: 600,
          letterSpacing: "0.02em",
          marginTop: 4,
          color: seed ? C.dim : "rgba(255,255,255,0.92)",
        }}
      >
        {sub}
      </div>
    </div>
  );
};

export const MultiplyBeat: React.FC<BeatProps> = ({ durationInFrames }) => {
  const frame = useCurrentFrame();
  const fade = useFade(durationInFrames);

  // Running product — animate from one cumulative value to the next per step.
  let value = cumulative[0];
  for (let i = 0; i < CHAIN_STEPS.length; i++) {
    const t = interpolate(frame, [STEP_AT[i], STEP_AT[i] + STEP_DUR], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: EASE.out,
    });
    if (t > 0) value = cumulative[i] + (cumulative[i + 1] - cumulative[i]) * t;
  }

  // Pulse the number as each multiply lands.
  let pulse = 0;
  for (let i = 0; i < CHAIN_STEPS.length; i++) {
    const d = frame - (STEP_AT[i] + STEP_DUR);
    if (d >= -6 && d <= 16) pulse = Math.max(pulse, d <= 0 ? (d + 6) / 6 : 1 - d / 16);
  }
  const scale = 1 + pulse * 0.12;

  const lastEnd = STEP_AT[2] + STEP_DUR;
  const labelOp = interpolate(frame, [lastEnd + 6, lastEnd + 24], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <BeatTitle title="From one trade" sub="ten thousand markets in a single transaction" />

      <div style={{ position: "absolute", top: 332, left: 0, right: 0, textAlign: "center" }}>
        <div style={{ display: "inline-block", transform: `scale(${scale.toFixed(3)})`, ...heroNumber(206) }}>
          {commas(value)}
        </div>
        <div
          style={{
            opacity: labelOp,
            marginTop: 10,
            fontFamily: monoFont,
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: "0.08em",
            color: C.dim,
          }}
        >
          TRADES · PER USER · PER DAY
        </div>
      </div>

      <div style={{ position: "absolute", top: 712, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 18 }}>
        <FactorChip at={18} head="1 trade" sub="one action" seed />
        {CHAIN_STEPS.map((s, i) => (
          <FactorChip key={i} at={STEP_AT[i]} head={s.head} sub={s.sub} />
        ))}
      </div>
    </AbsoluteFill>
  );
};

// ─── 8 · The unlock — what that throughput backs ─────────────────────────────

export const UnlockBeat: React.FC<BeatProps> = ({ durationInFrames }) => {
  const frame = useCurrentFrame();
  const fade = useFade(durationInFrames);

  const dollars = interpolate(frame, [28, 128], [0, LIQUIDITY_UNLOCKED], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });
  const subOp = interpolate(frame, [138, 158], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <BeatTitle title="Liquidity unlocked" sub="what one user's volume can back" />

      <div style={{ position: "absolute", top: 408, left: 0, right: 0, textAlign: "center" }}>
        <div style={{ display: "inline-block", ...heroNumber(208) }}>${commas(dollars)}</div>
        <div
          style={{
            opacity: subOp,
            marginTop: 22,
            fontFamily: font,
            fontSize: 42,
            fontWeight: 700,
            letterSpacing: "-0.01em",
            color: C.text,
          }}
        >
          one user · {commas(CHAIN_TOTAL)} trades a day ·{" "}
          <span style={{ color: C.up, fontWeight: 800 }}>more than Hyperliquid</span>
        </div>
        <div
          style={{
            opacity: subOp,
            marginTop: 8,
            fontFamily: monoFont,
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: "0.04em",
            color: C.faint,
          }}
        >
          Hyperliquid clears ~{commas(HYPERLIQUID_TRADES_PER_DAY)} a day — across everyone
        </div>
      </div>
    </AbsoluteFill>
  );
};
