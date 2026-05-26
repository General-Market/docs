import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { measureText } from "@remotion/layout-utils";
import { FPS, H, NAVY, SANS, SANS_TEXT, W } from "./theme";

/* ── A camera, not a chart ──────────────────────────────────────────────────
 * The view starts pushed in on the first bar at 80% of the height. Each new
 * bar is taller and enters from the right; the camera zooms OUT and pans RIGHT
 * to keep it at 80%, so the whole trail recedes left and shrinks together. On a
 * linear scale that recession is the argument — when the billion lands, every
 * market before it is a row of ticks on the floor.
 *
 * The name owns the frame: it is measured to ~60% of the width and shrinks as
 * the diagram fills in, laid over the chart. Each bar carries its own bezier
 * (the acceleration of the move) and its own start/grow (the rhythm).         */
type Bar = {
  key: string;
  name: string;
  sub: string;
  value: number;
  start: number;
  grow: number;
  ease: readonly [number, number, number, number];
  hero?: boolean;
  finale?: boolean;
};

const STD = [0.4, 0, 0.6, 1] as const;
const OUT = [0.25, 0.1, 0.3, 1] as const;
const INOUT = [0.42, 0, 0.58, 1] as const;
const QUICK = [0.3, 0, 0.18, 1] as const;

const BARS: Bar[] = [
  { key: "forex", name: "Forex", sub: "currency pairs", value: 28, start: 14, grow: 20, ease: OUT },
  { key: "commodities", name: "Commodities", sub: "liquid futures", value: 30, start: 48, grow: 16, ease: QUICK },
  { key: "usstocks", name: "US Stocks", sub: "NYSE + Nasdaq", value: 5_200, start: 78, grow: 24, ease: INOUT },
  { key: "microcaps", name: "Micro-caps", sub: "OTC securities", value: 12_000, start: 118, grow: 18, ease: STD },
  { key: "crypto", name: "Crypto", sub: "listed tokens", value: 13_000, start: 152, grow: 18, ease: OUT },
  { key: "etfs", name: "ETFs", sub: "exchange-traded", value: 15_600, start: 186, grow: 18, ease: QUICK },
  { key: "globalstocks", name: "Global Stocks", sub: "every exchange on earth", value: 58_000, start: 222, grow: 24, ease: INOUT },
  { key: "prediction", name: "Prediction Markets", sub: "Polymarket, active", value: 85_000, start: 262, grow: 22, ease: STD },
  { key: "gentoday", name: "General", sub: "today", value: 500_000, start: 302, grow: 24, ease: OUT, hero: true },
  { key: "options", name: "Options", sub: "every strike × expiry", value: 1_000_000, start: 348, grow: 24, ease: INOUT },
  { key: "memecoins", name: "Memecoins", sub: "pump.fun, launched", value: 10_000_000, start: 394, grow: 28, ease: INOUT },
  { key: "bonds", name: "Bonds", sub: "fixed-income CUSIPs", value: 50_000_000, start: 442, grow: 30, ease: INOUT },
  { key: "genscale", name: "General", sub: "at scale", value: 1_000_000_000, start: 490, grow: 46, ease: INOUT, hero: true, finale: true },
];

const TOTAL = 610;
const FILL = 0.8; // the newest bar fills this fraction of the plot height

// camera geometry
const PLOT_H = 620;
const BASELINE = 872;
const ANCHOR = W * 0.84; // newest bar lands here, on the right
const LEFT_EDGE = W * 0.07;
const SPAN = ANCHOR - LEFT_EDGE;
const NAME_X = 112;
const NAME_CY = H * 0.4;

const BLUE = "#0A84FF";
const INK = "#F4F6FA";

const full = (v: number) => Math.round(v).toLocaleString("en-US");

const clamp = (
  frame: number,
  range: [number, number],
  out: [number, number] = [0, 1],
  easing?: (n: number) => number,
) =>
  interpolate(frame, range, out, {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    ...(easing ? { easing } : {}),
  });

export const MarketUniverseScale: React.FC = () => {
  const frame = useCurrentFrame();

  let active = -1;
  for (let i = 0; i < BARS.length; i++) if (frame >= BARS[i].start) active = i;
  if (active < 0) return <AbsoluteFill style={{ backgroundColor: NAVY }} />;

  const A = BARS[active];
  const enter = clamp(frame, [A.start, A.start + A.grow], [0, 1], Easing.bezier(...A.ease));

  // vertical: linear axis maximum eased from the previous titan to the newest
  const newMax = A.value / FILL;
  const prevMax = active > 0 ? BARS[active - 1].value / FILL : newMax;
  const axisMax = prevMax + (newMax - prevMax) * enter;

  // horizontal: continuous newest-index → the trail fits, the newest rides the
  // right anchor, everything slides left as the camera pans
  const cp = active - 1 + enter;
  const count = cp + 1;
  const gap = SPAN / Math.max(1, count);
  const barW = Math.max(7, Math.min(118, gap * 0.5));

  // the name, measured to a target slice of the width that narrows as bars grow
  const targetFrac = clamp(active, [0, 12], [0.6, 0.3]);
  const ref = measureText({
    text: A.name,
    fontFamily: SANS,
    fontWeight: "800",
    fontSize: 100,
    letterSpacing: "-3px",
  });
  const nameSize = Math.max(56, Math.min(300, (100 * targetFrac * W) / ref.width));
  const countSize = nameSize * 0.4;
  const aCount = Math.round(A.value * enter);
  const titleIn = clamp(frame, [A.start, A.start + 10], [0, 1], Easing.out(Easing.cubic));

  return (
    <AbsoluteFill style={{ backgroundColor: NAVY, fontFamily: SANS }}>
      {/* soft blue floor glow once General is on the board */}
      <div
        style={{
          position: "absolute",
          left: ANCHOR - 620,
          top: BASELINE - 600,
          width: 1120,
          height: 740,
          background:
            "radial-gradient(closest-side, rgba(10,132,255,0.18), rgba(10,132,255,0) 70%)",
          opacity: clamp(frame, [300, 500], [0, 1]),
        }}
      />

      {/* baseline */}
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        <line
          x1={0}
          y1={BASELINE}
          x2={W}
          y2={BASELINE}
          stroke="rgba(255,255,255,0.18)"
          strokeWidth={2}
        />
      </svg>

      {/* the bars — one camera: heights ÷ axisMax, x from the panning trail */}
      {BARS.map((bar, i) => {
        if (i > active) return null;
        const isActive = i === active;
        const value = isActive ? bar.value * enter : bar.value;
        const h = Math.max(2, Math.min(PLOT_H, (value / axisMax) * PLOT_H));
        const cx = ANCHOR - (cp - i) * gap;
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
                ? "0 0 60px rgba(10,132,255,0.55)"
                : bar.hero
                  ? "0 0 30px rgba(10,132,255,0.4)"
                  : "none",
              opacity: isActive ? 1 : 0.95,
            }}
          />
        );
      })}

      {/* the name — measured big, laid over the chart, shrinking as it fills */}
      <div
        key={A.key + A.start}
        style={{
          position: "absolute",
          left: NAME_X,
          top: NAME_CY - nameSize * 0.62,
          transform: `translateY(${(1 - titleIn) * 26}px)`,
          opacity: titleIn,
        }}
      >
        <div
          style={{
            fontSize: nameSize,
            fontWeight: 800,
            lineHeight: 0.92,
            letterSpacing: "-3px",
            color: A.hero ? "#fff" : INK,
            textShadow: A.hero
              ? "0 8px 60px rgba(10,132,255,0.55)"
              : "0 6px 40px rgba(0,0,0,0.55)",
          }}
        >
          {A.name}
        </div>
        <div style={{ marginTop: nameSize * 0.08, display: "flex", alignItems: "baseline" }}>
          <span
            style={{
              fontVariantNumeric: "tabular-nums",
              fontSize: countSize,
              fontWeight: 800,
              letterSpacing: "-1px",
              color: A.hero ? BLUE : INK,
              textShadow: "0 4px 30px rgba(0,0,0,0.5)",
            }}
          >
            {full(aCount)}
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
            {A.sub}
          </span>
        </div>
      </div>
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
