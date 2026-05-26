import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { FPS, H, NAVY, SANS, SANS_TEXT, W } from "./theme";

/* ── The camera, not the chart ──────────────────────────────────────────────
 * A LINEAR axis that reframes itself. The newest bar always fills ~80% of the
 * plot height; the axis maximum animates up to it, so every older bar collapses
 * together — that is the zoom-out. On a linear scale the dwarfing is the point:
 * when the billion lands, every market before it is a row of ticks on the floor.
 *
 * Each bar carries its own cubic-bezier `ease` (the acceleration of its zoom +
 * count roll) and its own `start`/`grow` (the rhythm). Vary both — it should
 * read like a phrase of music, not a metronome.                               */
type Bar = {
  key: string;
  name: string;
  sub: string;
  value: number;
  start: number; // frame the bar begins to enter
  grow: number; // frames to settle at 80% + finish the count roll
  ease: readonly [number, number, number, number];
  hero?: boolean; // General → blue
  finale?: boolean; // General at scale → blue, glow
};

// Apple-sanctioned beziers, varied per bar (no Material 0.22,1,0.36,1).
const STD = [0.4, 0, 0.6, 1] as const; // default
const OUT = [0.25, 0.1, 0.3, 1] as const; // ease-out, snappy settle
const INOUT = [0.42, 0, 0.58, 1] as const; // slow-fast-slow, for the big zooms
const QUICK = [0.3, 0, 0.18, 1] as const; // fast attack

const BARS: Bar[] = [
  { key: "forex", name: "Forex", sub: "currency pairs", value: 28, start: 14, grow: 18, ease: OUT },
  { key: "commodities", name: "Commodities", sub: "liquid futures", value: 30, start: 46, grow: 14, ease: QUICK },
  { key: "usstocks", name: "US Stocks", sub: "NYSE + Nasdaq", value: 5_200, start: 74, grow: 22, ease: INOUT },
  { key: "microcaps", name: "Micro-caps", sub: "OTC securities", value: 12_000, start: 112, grow: 16, ease: STD },
  { key: "crypto", name: "Crypto", sub: "listed tokens", value: 13_000, start: 144, grow: 16, ease: OUT },
  { key: "etfs", name: "ETFs", sub: "global, exchange-traded", value: 15_600, start: 176, grow: 16, ease: QUICK },
  { key: "globalstocks", name: "Global Stocks", sub: "every exchange on earth", value: 58_000, start: 210, grow: 22, ease: INOUT },
  { key: "prediction", name: "Prediction Markets", sub: "Polymarket, active", value: 85_000, start: 248, grow: 20, ease: STD },
  { key: "gentoday", name: "General", sub: "today", value: 500_000, start: 286, grow: 22, ease: OUT, hero: true },
  { key: "options", name: "Options", sub: "every strike × expiry", value: 1_000_000, start: 330, grow: 22, ease: INOUT },
  { key: "memecoins", name: "Memecoins", sub: "pump.fun, launched", value: 10_000_000, start: 374, grow: 26, ease: INOUT },
  { key: "bonds", name: "Bonds", sub: "fixed-income CUSIPs", value: 50_000_000, start: 420, grow: 28, ease: INOUT },
  { key: "genscale", name: "General", sub: "at scale", value: 1_000_000_000, start: 466, grow: 42, ease: INOUT, hero: true, finale: true },
];

const TOTAL = 580;
const FILL = 0.8; // newest bar fills this fraction of the plot height

// plot geometry (left), title panel (right)
const PLOT_L = 120;
const PLOT_R = 1240;
const PLOT_W = PLOT_R - PLOT_L;
const SLOT_W = PLOT_W / BARS.length;
const BAR_W = 54;
const BASELINE = 880;
const PLOT_H = 660;
const PANEL_L = 1300;
const slotCenter = (i: number) => PLOT_L + i * SLOT_W + SLOT_W / 2;

const INK = "#F4F6FA";
const BLUE = "#0A84FF";

const trim = (n: number) => (Number.isInteger(n) ? `${n}` : n.toFixed(1));
const compact = (v: number): string => {
  if (v >= 1e9) return `${trim(v / 1e9)}B`;
  if (v >= 1e6) return `${trim(v / 1e6)}M`;
  if (v >= 1e3) return `${trim(v / 1e3)}k`;
  return `${Math.round(v)}`;
};
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

  // which bar owns the frame right now
  let active = -1;
  for (let i = 0; i < BARS.length; i++) if (frame >= BARS[i].start) active = i;

  // the camera: linear axis maximum eased from the previous titan to the newest
  let axisMax = BARS[0].value / FILL;
  let enter = 0;
  if (active >= 0) {
    const A = BARS[active];
    enter = clamp(frame, [A.start, A.start + A.grow], [0, 1], Easing.bezier(...A.ease));
    const newMax = A.value / FILL;
    const prevMax = active > 0 ? BARS[active - 1].value / FILL : newMax;
    axisMax = prevMax + (newMax - prevMax) * enter;
  }

  const A = active >= 0 ? BARS[active] : null;
  const panelIn = A ? clamp(frame, [A.start, A.start + 9], [0, 1], Easing.out(Easing.cubic)) : 0;
  const aCount = A ? Math.round(A.value * enter) : 0;

  // intro headline lifts out as the first bar lands (a move, never a dissolve)
  const introOut = clamp(frame, [8, 20], [0, 1], Easing.in(Easing.cubic));

  return (
    <AbsoluteFill style={{ backgroundColor: NAVY, fontFamily: SANS }}>
      {/* soft blue floor glow once General is on the board */}
      <div
        style={{
          position: "absolute",
          left: PANEL_L - 700,
          top: BASELINE - 620,
          width: 1200,
          height: 760,
          background:
            "radial-gradient(closest-side, rgba(10,132,255,0.16), rgba(10,132,255,0) 70%)",
          opacity: clamp(frame, [280, 470], [0, 1]),
        }}
      />

      {/* kicker */}
      <div
        style={{
          position: "absolute",
          left: 60,
          top: 50,
          opacity: 0.5,
          fontFamily: SANS_TEXT,
          fontSize: 22,
          fontWeight: 600,
          letterSpacing: "3px",
          color: INK,
          textTransform: "uppercase",
        }}
      >
        Tradeable markets — by asset class
      </div>

      {/* baseline */}
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        <line
          x1={PLOT_L - 6}
          y1={BASELINE}
          x2={PLOT_R + 6}
          y2={BASELINE}
          stroke="rgba(255,255,255,0.28)"
          strokeWidth={2}
        />
      </svg>

      {/* intro headline */}
      {introOut < 1 && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 360,
            textAlign: "center",
            transform: `translateY(${-44 * introOut}px)`,
            opacity: 1 - introOut,
          }}
        >
          <div style={{ fontSize: 80, fontWeight: 800, color: INK, letterSpacing: "-2px" }}>
            How many markets exist?
          </div>
        </div>
      )}

      {/* the bars — every height divided by the same axisMax, so all scale together */}
      {BARS.map((bar, i) => {
        if (frame < bar.start) return null;
        const isActive = i === active;
        const value = isActive ? bar.value * enter : bar.value;
        const h = Math.max(3, Math.min(PLOT_H, (value / axisMax) * PLOT_H));
        const cx = slotCenter(i);

        return (
          <React.Fragment key={bar.key}>
            <div
              style={{
                position: "absolute",
                left: cx - BAR_W / 2,
                top: BASELINE - h,
                width: BAR_W,
                height: h,
                borderRadius: "8px 8px 0 0",
                background: bar.hero
                  ? "linear-gradient(180deg, #3AA0FF 0%, #0A6FE0 100%)"
                  : "linear-gradient(180deg, #E9EEF6 0%, rgba(120,138,168,0.4) 100%)",
                borderTop: bar.hero ? "2px solid rgba(255,255,255,0.6)" : "none",
                boxShadow: bar.finale
                  ? "0 0 52px rgba(10,132,255,0.5)"
                  : bar.hero
                    ? "0 0 26px rgba(10,132,255,0.4)"
                    : "none",
                opacity: isActive ? 1 : 0.92,
              }}
            />
            {/* compact count above the active bar — connects bar to its value */}
            {isActive && h > 30 && (
              <div
                style={{
                  position: "absolute",
                  left: cx - 90,
                  width: 180,
                  top: BASELINE - h - 40,
                  textAlign: "center",
                  fontVariantNumeric: "tabular-nums",
                  fontSize: 28,
                  fontWeight: 800,
                  letterSpacing: "-0.5px",
                  color: bar.hero ? "#8AC6FF" : "#fff",
                }}
              >
                {compact(aCount)}
              </div>
            )}
            {/* roster label under the baseline */}
            <div
              style={{
                position: "absolute",
                left: cx - SLOT_W / 2,
                width: SLOT_W,
                top: BASELINE + 12,
                textAlign: "center",
                fontFamily: SANS_TEXT,
                fontSize: 14,
                fontWeight: 600,
                lineHeight: 1.1,
                color: bar.hero
                  ? "rgba(120,190,255,0.95)"
                  : isActive
                    ? "rgba(255,255,255,0.92)"
                    : "rgba(255,255,255,0.42)",
              }}
            >
              {bar.name}
            </div>
          </React.Fragment>
        );
      })}

      {/* title panel — the active bar, named big, on the right */}
      {A && (
        <div
          key={A.key + A.start}
          style={{
            position: "absolute",
            left: PANEL_L,
            width: W - PANEL_L - 70,
            top: 318,
            transform: `translateX(${(1 - panelIn) * 54}px)`,
            opacity: panelIn,
          }}
        >
          <div
            style={{
              fontSize: 86,
              fontWeight: 800,
              letterSpacing: "-2.5px",
              lineHeight: 0.98,
              color: A.hero ? "#fff" : INK,
              textShadow: A.hero ? "0 6px 44px rgba(10,132,255,0.5)" : "none",
            }}
          >
            {A.name}
          </div>
          <div style={{ marginTop: 16, display: "flex", alignItems: "baseline", flexWrap: "wrap" }}>
            <span
              style={{
                fontVariantNumeric: "tabular-nums",
                fontSize: 60,
                fontWeight: 800,
                color: A.hero ? BLUE : INK,
                letterSpacing: "-1px",
              }}
            >
              {full(aCount)}
            </span>
            <span style={{ fontSize: 30, fontWeight: 600, color: "rgba(255,255,255,0.5)", marginLeft: 14 }}>
              markets
            </span>
          </div>
          <div
            style={{
              marginTop: 8,
              fontFamily: SANS_TEXT,
              fontSize: 25,
              fontWeight: 500,
              color: A.hero ? "rgba(120,190,255,0.92)" : "rgba(255,255,255,0.42)",
              letterSpacing: "0.3px",
            }}
          >
            {A.sub}
          </div>
        </div>
      )}

      {/* footer credit */}
      <div
        style={{
          position: "absolute",
          right: 40,
          bottom: 24,
          opacity: 0.3,
          fontFamily: SANS_TEXT,
          fontSize: 14,
          color: INK,
          textAlign: "right",
          letterSpacing: "0.3px",
        }}
      >
        Live tradeable instruments per class · WFE · OTC Markets · CoinGecko · ETFGI · Polymarket · OCC · MSRB · 2026
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
