import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { measureText } from "@remotion/layout-utils";
import { FPS, H, NAVY, SANS, SANS_TEXT, W } from "./theme";

/* ── A camera that never stops tracking ─────────────────────────────────────
 * Every bar contributes an eased ramp to the camera. The ramps are long and
 * overlap, so the view is always gliding — never a jump-then-freeze. The zoom
 * is interpolated in LOG space, so a thousand-fold pull-back is felt as one
 * even, continuous recession rather than a snap. The newest bar rides the right
 * anchor at 80% height while the whole trail slides left and collapses — on a
 * linear axis that recession IS the scale. The count climbs from the previous
 * titan to the new one; the names slide through, they do not pop.            */
type Bar = {
  key: string;
  name: string;
  sub: string;
  value: number;
  start: number;
  grow: number; // ramp length — long, so ramps overlap and the camera flows
  hero?: boolean;
  finale?: boolean;
};

const BARS: Bar[] = [
  { key: "forex", name: "Forex", sub: "currency pairs", value: 28, start: 14, grow: 56 },
  { key: "commodities", name: "Commodities", sub: "liquid futures", value: 30, start: 50, grow: 60 },
  { key: "usstocks", name: "US Stocks", sub: "NYSE + Nasdaq", value: 5_200, start: 92, grow: 64 },
  { key: "microcaps", name: "Micro-caps", sub: "OTC securities", value: 12_000, start: 138, grow: 62 },
  { key: "crypto", name: "Crypto", sub: "listed tokens", value: 13_000, start: 184, grow: 62 },
  { key: "etfs", name: "ETFs", sub: "exchange-traded", value: 15_600, start: 230, grow: 62 },
  { key: "globalstocks", name: "Global Stocks", sub: "every exchange on earth", value: 58_000, start: 278, grow: 64 },
  { key: "prediction", name: "Prediction Markets", sub: "Polymarket, active", value: 85_000, start: 328, grow: 64 },
  { key: "gentoday", name: "General", sub: "today", value: 500_000, start: 380, grow: 66, hero: true },
  { key: "options", name: "Options", sub: "every strike × expiry", value: 1_000_000, start: 432, grow: 66 },
  { key: "memecoins", name: "Memecoins", sub: "pump.fun, launched", value: 10_000_000, start: 482, grow: 70 },
  { key: "bonds", name: "Bonds", sub: "fixed-income CUSIPs", value: 50_000_000, start: 534, grow: 74 },
  { key: "genscale", name: "General", sub: "at scale", value: 1_000_000_000, start: 588, grow: 96, hero: true, finale: true },
];

const TOTAL = 760;
const FILL = 0.8;

const PLOT_H = 640;
const BASELINE = 884;
const ANCHOR = W * 0.84;
const LEFT_EDGE = W * 0.07;
const SPAN = ANCHOR - LEFT_EDGE;
const NAME_X = 112;
const NAME_CY = H * 0.4;
const NAME_T = 18; // text transition length

const BLUE = "#0A84FF";
const INK = "#F4F6FA";

const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
const smootherstep = (t: number) => {
  const x = clamp01(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
};
const rampOf = (f: number, b: Bar) => smootherstep((f - b.start) / b.grow);
const full = (v: number) => Math.round(v).toLocaleString("en-US");
const easeOut = (t: number) => Easing.out(Easing.cubic)(clamp01(t));

const logMaxOf = (v: number) => Math.log10(v / FILL);
const targetFracFor = (i: number) =>
  interpolate(i, [0, 12], [0.6, 0.3], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

const nameSizeFor = (text: string, frac: number) => {
  const ref = measureText({
    text,
    fontFamily: SANS,
    fontWeight: "800",
    fontSize: 100,
    letterSpacing: "-3px",
  });
  return Math.max(56, Math.min(300, (100 * frac * W) / ref.width));
};

const NameBlock: React.FC<{
  bar: Bar;
  count: number;
  ty: number;
  opacity: number;
  blur: number;
}> = ({ bar, count, ty, opacity, blur }) => {
  const nameSize = nameSizeFor(bar.name, targetFracFor(BARS.indexOf(bar)));
  const countSize = nameSize * 0.4;
  return (
    <div
      style={{
        position: "absolute",
        left: NAME_X,
        top: NAME_CY - nameSize * 0.62,
        transform: `translateY(${ty}px)`,
        opacity,
        filter: blur > 0.05 ? `blur(${blur}px)` : undefined,
      }}
    >
      <div
        style={{
          fontSize: nameSize,
          fontWeight: 800,
          lineHeight: 0.92,
          letterSpacing: "-3px",
          color: bar.hero ? "#fff" : INK,
          textShadow: bar.hero ? "0 8px 64px rgba(10,132,255,0.6)" : "0 6px 44px rgba(0,0,0,0.6)",
        }}
      >
        {bar.name}
      </div>
      <div style={{ marginTop: nameSize * 0.08, display: "flex", alignItems: "baseline" }}>
        <span
          style={{
            fontVariantNumeric: "tabular-nums",
            fontSize: countSize,
            fontWeight: 800,
            letterSpacing: "-1px",
            color: bar.hero ? BLUE : INK,
            textShadow: "0 4px 30px rgba(0,0,0,0.55)",
          }}
        >
          {full(count)}
        </span>
        <span
          style={{
            fontFamily: SANS_TEXT,
            fontSize: countSize * 0.42,
            fontWeight: 600,
            color: "rgba(255,255,255,0.55)",
            marginLeft: countSize * 0.22,
          }}
        >
          {bar.sub}
        </span>
      </div>
    </div>
  );
};

export const MarketUniverseScale: React.FC = () => {
  const f = useCurrentFrame();

  let active = -1;
  for (let i = 0; i < BARS.length; i++) if (f >= BARS[i].start) active = i;
  if (active < 0) return <AbsoluteFill style={{ backgroundColor: NAVY }} />;

  const A = BARS[active];

  // camera: sum of overlapping eased ramps → always in motion
  let logMax = logMaxOf(BARS[0].value);
  let cp = 0;
  for (let i = 1; i <= active; i++) {
    const r = rampOf(f, BARS[i]);
    logMax += (logMaxOf(BARS[i].value) - logMaxOf(BARS[i - 1].value)) * r;
    cp += r;
  }
  // a slow perpetual pull-back + drift so it breathes even between bars
  const creep = 1 + 0.07 * (f / TOTAL);
  const bob = 9 * Math.sin(f / 115);
  const axisMax = Math.pow(10, logMax) * creep;

  const count = Math.max(1, cp + 1);
  const gap = SPAN / count;
  const barW = Math.max(7, Math.min(120, gap * 0.5));

  // the newest bar grows in on its own ramp; the count climbs from the last titan
  const rA = rampOf(f, A);
  const prevVal = active > 0 ? BARS[active - 1].value : 0;
  const aCount = Math.round(prevVal + (A.value - prevVal) * rA);

  // text transition: incoming slides up + sharpens, outgoing slides up + blurs out
  const tIn = clamp01((f - A.start) / NAME_T);
  const inTy = (1 - easeOut(tIn)) * 64;
  const inOp = easeOut(tIn);
  const inBlur = (1 - tIn) * 12;
  const showOut = active > 0 && tIn < 1;

  return (
    <AbsoluteFill style={{ backgroundColor: NAVY, fontFamily: SANS }}>
      {/* blue floor glow once General is on the board */}
      <div
        style={{
          position: "absolute",
          left: ANCHOR - 620 + bob,
          top: BASELINE - 620,
          width: 1120,
          height: 760,
          background:
            "radial-gradient(closest-side, rgba(10,132,255,0.2), rgba(10,132,255,0) 70%)",
          opacity: interpolate(f, [380, 600], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      />

      {/* baseline */}
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        <line x1={0} y1={BASELINE} x2={W} y2={BASELINE} stroke="rgba(255,255,255,0.16)" strokeWidth={2} />
      </svg>

      {/* the bars — one continuous camera */}
      {BARS.map((bar, i) => {
        if (i > active) return null;
        const isActive = i === active;
        const value = isActive ? bar.value * rA : bar.value;
        const h = Math.max(2, Math.min(PLOT_H, (value / axisMax) * PLOT_H));
        const cx = ANCHOR - (cp - i) * gap + bob;
        if (cx < -200 || cx > W + 200) return null;
        return (
          <div
            key={bar.key}
            style={{
              position: "absolute",
              left: cx - barW / 2,
              top: BASELINE - h,
              width: barW,
              height: h,
              borderRadius: `${Math.min(10, barW / 6)}px ${Math.min(10, barW / 6)}px 0 0`,
              background: bar.hero
                ? "linear-gradient(180deg, #3AA0FF 0%, #0A6FE0 100%)"
                : "linear-gradient(180deg, #EEF2F8 0%, rgba(120,138,168,0.4) 100%)",
              borderTop: bar.hero ? "2px solid rgba(255,255,255,0.65)" : "none",
              boxShadow: bar.finale
                ? "0 0 64px rgba(10,132,255,0.6)"
                : bar.hero
                  ? "0 0 30px rgba(10,132,255,0.4)"
                  : "none",
              opacity: isActive ? 1 : 0.95,
            }}
          />
        );
      })}

      {/* names — incoming slides through, outgoing slides out */}
      {showOut && (
        <NameBlock
          bar={BARS[active - 1]}
          count={BARS[active - 1].value}
          ty={-easeOut(tIn) * 64}
          opacity={1 - easeOut(tIn)}
          blur={easeOut(tIn) * 12}
        />
      )}
      <NameBlock bar={A} count={aCount} ty={inTy} opacity={inOp} blur={inBlur} />
    </AbsoluteFill>
  );
};

export const marketUniverseScaleMeta = {
  id: "MarketUniverseScale",
  component: MarketUniverseScale,
  width: W,
  height: H,
  fps: FPS,
  durationInFrames: TOTAL,
};
