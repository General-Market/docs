import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { measureText } from "@remotion/layout-utils";
import { FPS, H, NAVY, SANS, SANS_TEXT, W } from "./theme";
import { BrandMark } from "../../components/BrandMark";

/* ── A camera that lands clean ──────────────────────────────────────────────
 * Every bar contributes an eased ramp to a LINEAR axis whose maximum tracks the
 * newest bar to 80% of the height; the older bars collapse together — on a
 * linear scale that recession IS the scale. Each ramp finishes before the next
 * begins, so a bar arrives, settles dead-still, then the camera pulls out — no
 * sway, no rebound. The title is one fixed size and slides through a blur as it
 * changes. The counter never transitions: it climbs from the last titan to the
 * new one, and it SWELLS with its own magnitude — small markets read small, a
 * billion reads enormous. A logo rides above whichever bar is tall.           */
type Bar = {
  key: string;
  name: string;
  value: number;
  start: number;
  grow: number;
  icon?: string; // emoji glyph for pure categories
  logo?: string; // staticFile path for real brand marks
  tag?: string; // small qualifier after the title (General → today / at scale)
  hero?: boolean;
  finale?: boolean;
};

const BARS: Bar[] = [
  { key: "forex", name: "Forex", value: 28, start: 14, grow: 30, icon: "💱" },
  { key: "commodities", name: "Commodities", value: 30, start: 50, grow: 28, icon: "🛢️" },
  { key: "usstocks", name: "US Stocks", value: 5_200, start: 92, grow: 34, icon: "📈" },
  { key: "microcaps", name: "Micro-caps", value: 12_000, start: 138, grow: 30, icon: "🔬" },
  { key: "crypto", name: "Crypto", value: 13_000, start: 184, grow: 30, logo: "exchange-logos/coinbase-icon.svg" },
  { key: "etfs", name: "ETFs", value: 15_600, start: 230, grow: 30, icon: "🧺" },
  { key: "globalstocks", name: "Global Stocks", value: 58_000, start: 278, grow: 34, icon: "🌍" },
  { key: "prediction", name: "Prediction Markets", value: 85_000, start: 328, grow: 34, logo: "exchange-logos/polymarket-icon.png" },
  { key: "gentoday", name: "General", value: 500_000, start: 380, grow: 36, logo: "article-2/gm-mark-blue.svg", tag: "today", hero: true },
  { key: "options", name: "Options", value: 1_000_000, start: 432, grow: 36, icon: "🎛️" },
  { key: "memecoins", name: "Memecoins", value: 10_000_000, start: 482, grow: 40, logo: "exchange-logos/pumpfun-icon.png" },
  { key: "bonds", name: "Bonds", value: 50_000_000, start: 534, grow: 42, icon: "🏛️" },
  { key: "genscale", name: "General", value: 1_000_000_000, start: 588, grow: 56, logo: "article-2/gm-mark-blue.svg", tag: "at scale", hero: true, finale: true },
];

const TOTAL = 720;
const FILL = 0.8;

const PLOT_H = 640;
const BASELINE = 884;
const ANCHOR = W * 0.84;
const LEFT_EDGE = W * 0.07;
const SPAN = ANCHOR - LEFT_EDGE;
const NAME_X = 112;
const NAME_TOP = H * 0.25;
const NAME_FIT_W = W * 0.66; // longest title fits this; all titles share its size
const NAME_T = 18;
const COUNT_BASE = 84;

const INK = "#F4F6FA";
const BLUE_TXT = "rgba(120,190,255,0.95)";

const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
const smootherstep = (t: number) => {
  const x = clamp01(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
};
const rampOf = (f: number, b: Bar) => smootherstep((f - b.start) / b.grow);
const full = (v: number) => Math.round(v).toLocaleString("en-US");
const easeOut = (t: number) => Easing.out(Easing.cubic)(clamp01(t));
const logMaxOf = (v: number) => Math.log10(v / FILL);

const longestName = BARS.reduce((a, b) => (b.name.length > a.length ? b.name : a), "");
const useTitleSize = () => {
  const ref = measureText({ text: longestName, fontFamily: SANS, fontWeight: "800", fontSize: 100, letterSpacing: "-3px" });
  return Math.min(190, (100 * NAME_FIT_W) / ref.width);
};

const Title: React.FC<{ bar: Bar; size: number; ty: number; opacity: number; blur: number }> = ({
  bar,
  size,
  ty,
  opacity,
  blur,
}) => (
  <div
    style={{
      position: "absolute",
      left: NAME_X,
      top: NAME_TOP + ty,
      opacity,
      filter: blur > 0.05 ? `blur(${blur}px)` : undefined,
      display: "flex",
      alignItems: "baseline",
    }}
  >
    <span
      style={{
        fontSize: size,
        fontWeight: 800,
        lineHeight: 0.92,
        letterSpacing: "-3px",
        color: bar.hero ? "#fff" : INK,
        textShadow: bar.hero ? "0 8px 64px rgba(10,132,255,0.6)" : "0 6px 44px rgba(0,0,0,0.6)",
      }}
    >
      {bar.name}
    </span>
    {bar.tag && (
      <span
        style={{
          fontSize: size * 0.3,
          fontWeight: 700,
          marginLeft: size * 0.13,
          letterSpacing: "-0.5px",
          color: BLUE_TXT,
        }}
      >
        {bar.tag}
      </span>
    )}
  </div>
);

const LogoChip: React.FC<{ bar: Bar; cx: number; top: number; size: number; opacity: number }> = ({
  bar,
  cx,
  top,
  size,
  opacity,
}) => (
  <div
    style={{
      position: "absolute",
      left: cx - size / 2,
      top,
      width: size,
      height: size,
      borderRadius: "50%",
      background: "#fff",
      boxShadow: "0 6px 22px rgba(0,0,0,0.45)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      opacity,
    }}
  >
    {bar.logo ? (
      <Img src={staticFile(bar.logo)} style={{ width: size * 0.66, height: size * 0.66, objectFit: "contain" }} />
    ) : (
      <span style={{ fontSize: size * 0.56, lineHeight: 1 }}>{bar.icon}</span>
    )}
  </div>
);

export const MarketUniverseScale: React.FC = () => {
  const f = useCurrentFrame();
  const nameSize = useTitleSize();

  let active = -1;
  for (let i = 0; i < BARS.length; i++) if (f >= BARS[i].start) active = i;
  if (active < 0) return <AbsoluteFill style={{ backgroundColor: NAVY }} />;

  const A = BARS[active];

  // camera: each ramp completes before the next starts → land, settle, then pull out
  let logMax = logMaxOf(BARS[0].value);
  let cp = 0;
  for (let i = 1; i <= active; i++) {
    const r = rampOf(f, BARS[i]);
    logMax += (logMaxOf(BARS[i].value) - logMaxOf(BARS[i - 1].value)) * r;
    cp += r;
  }
  const axisMax = Math.pow(10, logMax);
  const gap = SPAN / Math.max(1, cp + 1);
  const barW = Math.max(7, Math.min(120, gap * 0.5));

  const rA = rampOf(f, A);
  const prevVal = active > 0 ? BARS[active - 1].value : 0;
  const aCount = Math.round(prevVal + (A.value - prevVal) * rA);

  // the counter swells with its own magnitude — small reads small, a billion huge
  const cMag = clamp01(Math.log10(Math.max(1, aCount)) / 9);
  const countSize = COUNT_BASE * (1 + 0.8 * cMag);
  const marketsSize = Math.min(78, countSize * 0.55);

  const tIn = clamp01((f - A.start) / NAME_T);
  const showOut = active > 0 && tIn < 1;

  return (
    <AbsoluteFill style={{ backgroundColor: NAVY, fontFamily: SANS }}>
      <BrandMark surface="dark" />
      {/* blue floor glow once General is on the board */}
      <div
        style={{
          position: "absolute",
          left: ANCHOR - 620,
          top: BASELINE - 620,
          width: 1120,
          height: 760,
          background: "radial-gradient(closest-side, rgba(10,132,255,0.2), rgba(10,132,255,0) 70%)",
          opacity: interpolate(f, [380, 600], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      />

      {/* baseline */}
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        <line x1={0} y1={BASELINE} x2={W} y2={BASELINE} stroke="rgba(255,255,255,0.16)" strokeWidth={2} />
      </svg>

      {/* the bars + their logos — one continuous camera */}
      {BARS.map((bar, i) => {
        if (i > active) return null;
        const isActive = i === active;
        const value = isActive ? bar.value * rA : bar.value;
        const h = Math.max(2, Math.min(PLOT_H, (value / axisMax) * PLOT_H));
        const cx = ANCHOR - (cp - i) * gap;
        if (cx < -200 || cx > W + 200) return null;
        const chipSize = Math.max(20, Math.min(62, barW + 6));
        const chipOp = clamp01((h / PLOT_H) * 3.5);
        return (
          <React.Fragment key={bar.key}>
            <div
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
            {chipOp > 0.02 && (
              <LogoChip bar={bar} cx={cx} top={BASELINE - h - chipSize - 8} size={chipSize} opacity={chipOp} />
            )}
          </React.Fragment>
        );
      })}

      {/* title — incoming slides through, outgoing slides out (one size for all) */}
      {showOut && (
        <Title bar={BARS[active - 1]} size={nameSize} ty={-easeOut(tIn) * 64} opacity={1 - easeOut(tIn)} blur={easeOut(tIn) * 12} />
      )}
      <Title bar={A} size={nameSize} ty={(1 - easeOut(tIn)) * 64} opacity={easeOut(tIn)} blur={(1 - tIn) * 12} />

      {/* the counter — persistent, never transitions, climbing and swelling */}
      <div style={{ position: "absolute", left: NAME_X, top: NAME_TOP + nameSize * 1.12, display: "flex", alignItems: "baseline" }}>
        <span
          style={{
            fontVariantNumeric: "tabular-nums",
            fontSize: countSize,
            fontWeight: 800,
            letterSpacing: "-1px",
            color: "#fff",
            textShadow: "0 4px 30px rgba(0,0,0,0.55)",
          }}
        >
          {full(aCount)}
        </span>
        <span
          style={{
            fontFamily: SANS_TEXT,
            fontSize: marketsSize,
            fontWeight: 700,
            color: "rgba(255,255,255,0.6)",
            marginLeft: countSize * 0.18,
          }}
        >
          markets
        </span>
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
