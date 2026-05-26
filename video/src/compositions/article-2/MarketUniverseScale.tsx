import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { FPS, H, NAVY, SANS, SANS_TEXT, W } from "./theme";

/* ── The set ──────────────────────────────────────────────────────────────
 * Every row is a count of distinct tradeable markets, ranked smallest →
 * largest, sourced in asset-class-counts.research.md. Two rows are blue:
 * General today (500k) and General at scale (1B). Sorted honestly, "today"
 * lands mid-chart — it clears every market a retail trader touches, while the
 * institutional firehoses (options, memecoins, bonds) climb past it, and the
 * billion caps them all. The `grow` field is the rhythm knob: small bars snap,
 * the giants roll up slow.                                                    */
type Bar = {
  key: string;
  name: string;
  sub: string;
  value: number;
  start: number; // frame the bar begins to enter
  grow: number; // frames to full height + count roll
  hero?: boolean; // General → blue
  finale?: boolean; // General at scale → blue, glow, slam
};

const BARS: Bar[] = [
  { key: "forex", name: "Forex", sub: "currency pairs", value: 28, start: 24, grow: 9 },
  { key: "commodities", name: "Commodities", sub: "liquid futures", value: 30, start: 35, grow: 9 },
  { key: "usstocks", name: "US Stocks", sub: "NYSE + Nasdaq", value: 5_200, start: 52, grow: 13 },
  { key: "microcaps", name: "Micro-caps", sub: "OTC securities", value: 12_000, start: 70, grow: 13 },
  { key: "crypto", name: "Crypto", sub: "listed tokens", value: 13_000, start: 88, grow: 13 },
  { key: "etfs", name: "ETFs", sub: "global, exchange-traded", value: 15_600, start: 106, grow: 13 },
  { key: "globalstocks", name: "Global Stocks", sub: "every exchange on earth", value: 58_000, start: 128, grow: 18 },
  { key: "prediction", name: "Prediction Markets", sub: "Polymarket, active", value: 85_000, start: 156, grow: 18 },
  { key: "gentoday", name: "General", sub: "today", value: 500_000, start: 188, grow: 16, hero: true },
  { key: "options", name: "Options", sub: "every strike × expiry", value: 1_000_000, start: 216, grow: 24 },
  { key: "memecoins", name: "Memecoins", sub: "pump.fun, launched", value: 10_000_000, start: 256, grow: 28 },
  { key: "bonds", name: "Bonds", sub: "fixed-income CUSIPs", value: 50_000_000, start: 300, grow: 32 },
  { key: "genscale", name: "General", sub: "at scale", value: 1_000_000_000, start: 348, grow: 46, hero: true, finale: true },
];

const TOTAL = 540;

// log axis: 10^1 floor, headroom just past 10^9 so the billion nearly fills.
const LOG_MIN = 1;
const LOG_MAX = 9.2;

// plot geometry, in frame px
const BASELINE = 920;
const PLOT_H = 640;
const AXIS_X = 150;
const RIGHT_X = 1880;
const SLOT_W = (RIGHT_X - AXIS_X) / BARS.length;
const BAR_W = 82;
const slotCenter = (i: number) => AXIS_X + SLOT_W * i + SLOT_W / 2;

const INK = "#F4F6FA";
const BLUE = "#0A84FF";
const DECADES = [2, 3, 4, 5, 6, 7, 8, 9];

const yFor = (v: number) =>
  BASELINE - ((Math.log10(v) - LOG_MIN) / (LOG_MAX - LOG_MIN)) * PLOT_H;
const heightFor = (v: number) =>
  Math.max(0, ((Math.log10(v) - LOG_MIN) / (LOG_MAX - LOG_MIN)) * PLOT_H);

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
  const { fps } = useVideoConfig();

  // the chart frame reveals first: gridlines + baseline draw in
  const chartIn = clamp(frame, [0, 22], [0, 1], Easing.out(Easing.cubic));
  // intro headline lifts away as the first bar lands (a move, never a dissolve)
  const introOut = clamp(frame, [16, 26], [0, 1], Easing.in(Easing.cubic));

  // which bar is being born → owns the big-name spotlight
  let active = -1;
  for (let i = 0; i < BARS.length; i++) if (frame >= BARS[i].start) active = i;
  const A = active >= 0 ? BARS[active] : null;
  const pop = A ? clamp(frame, [A.start, A.start + 7], [0, 1], Easing.out(Easing.cubic)) : 0;
  const aRoll = A ? clamp(frame, [A.start, A.start + A.grow], [0, 1], Easing.out(Easing.cubic)) : 0;
  const aCount = A ? Math.round(A.value * aRoll) : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: NAVY, fontFamily: SANS }}>
      {/* soft blue floor glow under the tall end of the chart */}
      <div
        style={{
          position: "absolute",
          left: slotCenter(BARS.length - 1) - 520,
          top: BASELINE - 560,
          width: 1040,
          height: 720,
          background:
            "radial-gradient(closest-side, rgba(10,132,255,0.16), rgba(10,132,255,0) 70%)",
          opacity: clamp(frame, [200, 360], [0, 1]),
        }}
      />

      {/* kicker */}
      <div
        style={{
          position: "absolute",
          left: 60,
          top: 46,
          opacity: 0.5 * chartIn,
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

      {/* gridlines + baseline */}
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        {DECADES.map((k) => {
          const y = yFor(10 ** k);
          const d = clamp(frame, [6 + (9 - k) * 1.5, 26 + (9 - k) * 1.5], [0, 1]);
          return (
            <g key={k} opacity={d}>
              <line
                x1={AXIS_X}
                y1={y}
                x2={RIGHT_X}
                y2={y}
                stroke="rgba(255,255,255,0.07)"
                strokeWidth={1}
              />
              <text
                x={AXIS_X - 16}
                y={y + 5}
                textAnchor="end"
                fontFamily={SANS_TEXT}
                fontSize={17}
                fill="rgba(255,255,255,0.32)"
              >
                {compact(10 ** k)}
              </text>
            </g>
          );
        })}
        <line
          x1={AXIS_X - 4}
          y1={BASELINE}
          x2={RIGHT_X}
          y2={BASELINE}
          stroke="rgba(255,255,255,0.35)"
          strokeWidth={2}
          strokeDasharray={`${(RIGHT_X - AXIS_X + 4) * chartIn} 4000`}
        />
      </svg>

      {/* intro headline — lifts out as the bars begin */}
      {introOut < 1 && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 150,
            textAlign: "center",
            transform: `translateY(${-44 * introOut}px)`,
            opacity: (1 - introOut) * chartIn,
          }}
        >
          <div style={{ fontSize: 78, fontWeight: 800, color: INK, letterSpacing: "-2px" }}>
            How many markets exist?
          </div>
        </div>
      )}

      {/* big-name spotlight — whichever bar is being born */}
      {A && pop > 0.001 && (
        <div
          key={A.key + A.start}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 66,
            textAlign: "center",
            transform: `translateY(${(1 - pop) * 22}px)`,
            opacity: pop,
          }}
        >
          <div
            style={{
              fontSize: 78,
              fontWeight: 800,
              letterSpacing: "-2px",
              color: A.hero ? "#fff" : INK,
              textShadow: A.hero ? "0 6px 40px rgba(10,132,255,0.5)" : "none",
            }}
          >
            {A.name}
          </div>
          <div style={{ marginTop: 6 }}>
            <span
              style={{
                fontVariantNumeric: "tabular-nums",
                fontSize: 58,
                fontWeight: 800,
                color: A.hero ? BLUE : INK,
                letterSpacing: "-1px",
              }}
            >
              {full(aCount)}
            </span>
            <span
              style={{
                fontSize: 30,
                fontWeight: 600,
                color: "rgba(255,255,255,0.5)",
                marginLeft: 14,
              }}
            >
              markets
            </span>
          </div>
          <div
            style={{
              marginTop: 4,
              fontFamily: SANS_TEXT,
              fontSize: 24,
              fontWeight: 500,
              color: A.hero ? "rgba(120,190,255,0.92)" : "rgba(255,255,255,0.4)",
              letterSpacing: "0.3px",
            }}
          >
            {A.sub}
          </div>
        </div>
      )}

      {/* the bars */}
      {BARS.map((bar, i) => {
        if (frame < bar.start) return null;
        const g = spring({
          frame: frame - bar.start,
          fps,
          config: bar.finale
            ? { damping: 11, mass: 1.1, stiffness: 130 }
            : { damping: 15, mass: 1, stiffness: 120 },
          durationInFrames: bar.grow,
        });
        const h = Math.min(PLOT_H, heightFor(bar.value) * g);
        const cx = slotCenter(i);
        const isActive = i === active;
        const numIn = clamp(frame - bar.start, [bar.grow * 0.25, bar.grow * 0.7], [0, 1]);
        const roll = clamp(frame, [bar.start, bar.start + bar.grow], [0, 1], Easing.out(Easing.cubic));
        const shown = Math.round(bar.value * roll);

        const settle = clamp(frame, [bar.start + bar.grow, bar.start + bar.grow + 30], [0, 1]);
        const pulse = bar.finale ? 0.5 + 0.5 * Math.sin((frame - bar.start) / 9) : 0;

        return (
          <React.Fragment key={bar.key}>
            <div
              style={{
                position: "absolute",
                left: cx - BAR_W / 2,
                top: BASELINE - h,
                width: BAR_W,
                height: h,
                borderRadius: "10px 10px 0 0",
                background: bar.hero
                  ? "linear-gradient(180deg, #3AA0FF 0%, #0A6FE0 100%)"
                  : "linear-gradient(180deg, #E9EEF6 0%, rgba(120,138,168,0.35) 100%)",
                borderTop: bar.hero ? "2px solid rgba(255,255,255,0.6)" : "none",
                boxShadow: bar.finale
                  ? `0 0 ${44 + pulse * 26}px rgba(10,132,255,${0.45 + pulse * 0.25 * settle})`
                  : bar.hero
                    ? "0 0 26px rgba(10,132,255,0.4)"
                    : "none",
              }}
            />
            {/* count on top of the column */}
            <div
              style={{
                position: "absolute",
                left: cx - 90,
                width: 180,
                top: BASELINE - h - (isActive ? 44 : 36),
                textAlign: "center",
                opacity: numIn,
                fontVariantNumeric: "tabular-nums",
                fontSize: isActive ? 32 : 25,
                fontWeight: 800,
                letterSpacing: "-0.5px",
                color: bar.hero ? "#8AC6FF" : isActive ? "#fff" : "rgba(232,238,246,0.78)",
              }}
            >
              {compact(shown)}
            </div>
            {/* name under the baseline */}
            <div
              style={{
                position: "absolute",
                left: cx - SLOT_W / 2,
                width: SLOT_W,
                top: BASELINE + 14,
                textAlign: "center",
                opacity: numIn,
              }}
            >
              <div
                style={{
                  fontFamily: SANS_TEXT,
                  fontSize: 18,
                  fontWeight: 600,
                  lineHeight: 1.12,
                  color: bar.hero
                    ? "#fff"
                    : isActive
                      ? "rgba(255,255,255,0.9)"
                      : "rgba(255,255,255,0.55)",
                }}
              >
                {bar.name}
              </div>
              {bar.hero && (
                <div
                  style={{
                    fontFamily: SANS_TEXT,
                    fontSize: 15,
                    fontWeight: 600,
                    color: "rgba(120,190,255,0.92)",
                    marginTop: 2,
                  }}
                >
                  {bar.sub}
                </div>
              )}
            </div>
          </React.Fragment>
        );
      })}

      {/* footer credit */}
      <div
        style={{
          position: "absolute",
          right: 40,
          bottom: 26,
          opacity: 0.32 * chartIn,
          fontFamily: SANS_TEXT,
          fontSize: 15,
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
