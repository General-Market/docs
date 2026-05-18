import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import {
  C,
  FONT_MONO,
  FONT_TEXT,
  blueRedRamp,
  gaussian,
  mulberry32,
} from "../tokens";
import { ChartFrame } from "../primitives";

const SEED = 0x08c4310;

const SPOT = 70_736;
const STRIKE = 75_000;
const MU = 0.76; // annualized drift
const SIGMA = 0.44; // annualized vol
const T_DAYS = 30;
const T_YEARS = T_DAYS / 365;
const STEPS = 30;
const N_PATHS = 220;
const PREMIUM = 2172;

// ---- Layout ----
const HUD = {
  top: 0,
  height: 92,
};
const SUBHUD = {
  top: 92,
  height: 50,
};

const VIZ = {
  left: 130,
  top: 200,
  width: 1300,
  height: 800,
};
const HIST = {
  left: VIZ.left + VIZ.width + 16,
  top: VIZ.top,
  width: 320,
  height: VIZ.height,
};

const PRICE_MIN = 50_000;
const PRICE_MAX = 120_000;

const yOfPrice = (p: number) =>
  VIZ.height -
  ((p - PRICE_MIN) / (PRICE_MAX - PRICE_MIN)) * VIZ.height;

const xOfStep = (s: number) => (s / STEPS) * VIZ.width;

type Path = {
  d: string;
  terminal: number;
  pnl: number;
};

function buildPaths(): Path[] {
  const rng = mulberry32(SEED);
  const dt = T_YEARS / STEPS;
  const drift = (MU - 0.5 * SIGMA * SIGMA) * dt;
  const diff = SIGMA * Math.sqrt(dt);
  const paths: Path[] = [];
  for (let p = 0; p < N_PATHS; p++) {
    let price = SPOT;
    let d = `M${xOfStep(0).toFixed(2)},${yOfPrice(price).toFixed(2)} `;
    for (let s = 1; s <= STEPS; s++) {
      price = price * Math.exp(drift + diff * gaussian(rng, 0, 1));
      d += `L${xOfStep(s).toFixed(2)},${yOfPrice(price).toFixed(2)} `;
    }
    const payoff = Math.max(0, price - STRIKE);
    const pnl = payoff - PREMIUM;
    paths.push({ d, terminal: price, pnl });
  }
  return paths;
}

const N_BINS = 28;

function buildHistogram(paths: Path[]) {
  const bins = new Array(N_BINS).fill(0);
  for (const p of paths) {
    const t = (p.terminal - PRICE_MIN) / (PRICE_MAX - PRICE_MIN);
    if (t < 0 || t > 1) continue;
    const b = Math.min(N_BINS - 1, Math.floor(t * N_BINS));
    bins[b] += 1;
  }
  const max = Math.max(1, ...bins);
  return { bins, max };
}

function pnlToColor(pnl: number, maxAbs: number): string {
  const t = 0.5 + 0.5 * Math.max(-1, Math.min(1, pnl / maxAbs));
  // 0 = blue (gain bottom of ramp), 1 = red. We want top=gain=blue, bottom=loss=red.
  // blueRedRamp: 0=blue, 0.5=white, 1=red. So loss → red → use 1 when pnl<0.
  return blueRedRamp(1 - t);
}

const HUD_VALUES = [
  { k: "IV", v: "47.58%" },
  { k: "MARK", v: "+2,172" },
  { k: "Δ", v: "+0.33" },
  { k: "Γ", v: "+0.0000" },
  { k: "Θ", v: "-64.38" },
  { k: "ν", v: "+75.25" },
];

const PILL: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "5px 12px",
  border: `1px solid ${C.grid}`,
  borderRadius: 4,
  fontFamily: FONT_MONO,
  fontSize: 12,
  color: C.ink,
  backgroundColor: "rgba(255,255,255,0.02)",
  marginRight: 6,
  letterSpacing: "0.02em",
};

const PILL_BUY: React.CSSProperties = {
  ...PILL,
  color: C.blue,
  borderColor: "rgba(91,155,213,0.4)",
};

const STAT_ROW: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  fontFamily: FONT_MONO,
  fontSize: 12,
  padding: "4px 0",
  borderBottom: `1px solid ${C.gridFaint}`,
};

const STAT_KEY: React.CSSProperties = {
  color: C.inkDim,
  letterSpacing: "0.04em",
};

export const Chart08: React.FC = () => {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, 18], [0, 1], {
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(frame, [162, 180], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = Math.min(fadeIn, fadeOut);

  const reveal = interpolate(frame, [10, 80], [0, 1], {
    extrapolateRight: "clamp",
  });
  const histReveal = interpolate(frame, [50, 95], [0, 1], {
    extrapolateRight: "clamp",
  });

  const paths = React.useMemo(buildPaths, []);
  const { bins, max: binMax } = React.useMemo(
    () => buildHistogram(paths),
    [paths],
  );

  const maxAbsPnl = PREMIUM * 3;

  return (
    <AbsoluteFill style={{ opacity }}>
      <ChartFrame>
        {/* ---- HUD top bar ---- */}
        <div
          style={{
            position: "absolute",
            top: HUD.top,
            left: 0,
            right: 0,
            height: HUD.height,
            display: "flex",
            alignItems: "center",
            padding: "0 28px",
            borderBottom: `1px solid ${C.grid}`,
            gap: 24,
            fontFamily: FONT_TEXT,
          }}
        >
          <div
            style={{
              color: C.ink,
              fontFamily: FONT_MONO,
              fontSize: 13,
              letterSpacing: "0.02em",
            }}
          >
            <span style={{ color: C.inkDim, marginRight: 8 }}>BTCUSD</span>
            <span style={{ color: C.ink, fontWeight: 600 }}>70,736</span>
            <span style={{ color: C.inkFaint, margin: "0 10px" }}>|</span>
            <span style={{ color: C.inkDim }}>26 Mar 26, 04:56:33 UTC</span>
          </div>

          <div style={{ display: "flex", marginLeft: 12 }}>
            <span style={PILL_BUY}>Buy</span>
            <span style={PILL}>1</span>
            <span style={PILL}>Call</span>
            <span style={PILL}>24 Apr 26</span>
            <span style={PILL}>75,000</span>
          </div>

          <div
            style={{
              display: "flex",
              marginLeft: "auto",
              gap: 22,
              alignItems: "center",
            }}
          >
            {HUD_VALUES.map((h) => (
              <div
                key={h.k}
                style={{ display: "flex", flexDirection: "column" }}
              >
                <span
                  style={{
                    color: C.inkDim,
                    fontFamily: FONT_TEXT,
                    fontSize: 10,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  {h.k}
                </span>
                <span
                  style={{
                    color: C.ink,
                    fontFamily: FONT_MONO,
                    fontSize: 13,
                  }}
                >
                  {h.v}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ---- Sub-HUD: parameters + tabs ---- */}
        <div
          style={{
            position: "absolute",
            top: SUBHUD.top,
            left: 0,
            right: 0,
            height: SUBHUD.height,
            display: "flex",
            alignItems: "center",
            padding: "0 28px",
            borderBottom: `1px solid ${C.gridFaint}`,
            fontFamily: FONT_MONO,
            fontSize: 12,
            color: C.inkDim,
            gap: 22,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: C.blue,
              display: "inline-block",
            }}
          />
          <span>
            <span style={{ color: C.inkDim }}>μ </span>
            <span style={{ color: C.ink }}>76.00%</span>
          </span>
          <span>
            <span style={{ color: C.inkDim }}>σ </span>
            <span style={{ color: C.ink }}>44.00%</span>
          </span>
          <span>
            <span style={{ color: C.inkDim }}>η </span>
            <span style={{ color: C.ink }}>5,000</span>
          </span>
          <span>
            <span style={{ color: C.inkDim }}>T+</span>
            <span style={{ color: C.ink }}>30D</span>
          </span>
          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              gap: 4,
              fontFamily: FONT_TEXT,
              fontSize: 11,
              letterSpacing: "0.08em",
            }}
          >
            <span
              style={{
                padding: "4px 10px",
                color: C.inkDim,
              }}
            >
              PRICE
            </span>
            <span
              style={{
                padding: "4px 10px",
                color: C.ink,
                backgroundColor: "rgba(91,155,213,0.12)",
                border: `1px solid rgba(91,155,213,0.4)`,
                borderRadius: 3,
              }}
            >
              PNL
            </span>
            <span
              style={{
                padding: "4px 10px",
                color: C.inkDim,
              }}
            >
              PROB
            </span>
          </div>
        </div>

        {/* ---- Left stats inset ---- */}
        <div
          style={{
            position: "absolute",
            left: VIZ.left + 24,
            top: VIZ.top + 24,
            width: 280,
            padding: "16px 18px",
            backgroundColor: "rgba(0,0,0,0.7)",
            border: `1px solid ${C.grid}`,
            fontFamily: FONT_MONO,
            zIndex: 10,
          }}
        >
          <div
            style={{
              color: C.inkDim,
              fontFamily: FONT_TEXT,
              fontSize: 10,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginBottom: 10,
            }}
          >
            Simulation
          </div>
          <div style={STAT_ROW}>
            <span style={STAT_KEY}>AVG PNL</span>
            <span style={{ color: C.blue }}>+$1,720</span>
          </div>
          <div style={STAT_ROW}>
            <span style={STAT_KEY}>MEDIAN PNL</span>
            <span style={{ color: C.red }}>-$2,172</span>
          </div>
          <div style={STAT_ROW}>
            <span style={STAT_KEY}>BREAK-EVEN</span>
            <span style={{ color: C.ink }}>$77,203</span>
          </div>
          <div style={STAT_ROW}>
            <span style={STAT_KEY}>MAX LOSS</span>
            <span style={{ color: C.red }}>-$2,172</span>
          </div>
          <div style={{ ...STAT_ROW, borderBottom: "none" }}>
            <span style={STAT_KEY}>MAX PAYOFF</span>
            <span style={{ color: C.blue }}>+$47,166</span>
          </div>
        </div>

        {/* ---- Main fan viz ---- */}
        <svg
          style={{
            position: "absolute",
            left: VIZ.left,
            top: VIZ.top,
            width: VIZ.width,
            height: VIZ.height,
            overflow: "hidden",
          }}
          viewBox={`0 0 ${VIZ.width} ${VIZ.height}`}
        >
          {/* horizontal price grid */}
          {[60_000, 75_000, 85_000, 100_000, 120_000].map((p) => (
            <g key={p}>
              <line
                x1={0}
                x2={VIZ.width}
                y1={yOfPrice(p)}
                y2={yOfPrice(p)}
                stroke={C.grid}
                strokeWidth={1}
              />
              <text
                x={-8}
                y={yOfPrice(p) + 4}
                textAnchor="end"
                fontFamily={FONT_MONO}
                fontSize={11}
                fill={C.inkDim}
              >
                {`${Math.round(p / 1000)}k`}
              </text>
            </g>
          ))}

          {/* strike line */}
          <line
            x1={0}
            x2={VIZ.width}
            y1={yOfPrice(STRIKE)}
            y2={yOfPrice(STRIKE)}
            stroke={C.cream}
            strokeWidth={1}
            strokeDasharray="4 4"
            opacity={0.6}
          />
          <text
            x={VIZ.width - 8}
            y={yOfPrice(STRIKE) - 6}
            textAnchor="end"
            fontFamily={FONT_MONO}
            fontSize={11}
            fill={C.cream}
            opacity={0.85}
          >
            K = 75,000
          </text>

          <defs>
            <clipPath id="chart08-viz-clip">
              <rect
                x={0}
                y={0}
                width={VIZ.width * reveal}
                height={VIZ.height}
              />
            </clipPath>
          </defs>

          <g clipPath="url(#chart08-viz-clip)">
            {paths.map((p, i) => (
              <path
                key={i}
                d={p.d}
                stroke={pnlToColor(p.pnl, maxAbsPnl)}
                strokeWidth={1}
                strokeOpacity={0.7}
                fill="none"
              />
            ))}
          </g>

          {/* origin pin */}
          <circle
            cx={0}
            cy={yOfPrice(SPOT)}
            r={4}
            fill={C.cream}
          />

          {/* x-axis label */}
          <text
            x={VIZ.width - 8}
            y={VIZ.height - 8}
            textAnchor="end"
            fontFamily={FONT_MONO}
            fontSize={11}
            fill={C.inkDim}
          >
            T+30D
          </text>
        </svg>

        {/* ---- Right histogram ---- */}
        <svg
          style={{
            position: "absolute",
            left: HIST.left,
            top: HIST.top,
            width: HIST.width,
            height: HIST.height,
            overflow: "visible",
          }}
          viewBox={`0 0 ${HIST.width} ${HIST.height}`}
        >
          <line
            x1={0}
            x2={0}
            y1={0}
            y2={HIST.height}
            stroke={C.grid}
            strokeWidth={1}
          />
          {bins.map((count, i) => {
            const t = (i + 0.5) / N_BINS;
            const priceAtBin = PRICE_MIN + t * (PRICE_MAX - PRICE_MIN);
            const yTop = yOfPrice(priceAtBin) - HIST.height / N_BINS / 2;
            const h = HIST.height / N_BINS;
            const w = (count / binMax) * (HIST.width - 30) * histReveal;
            const payoff = Math.max(0, priceAtBin - STRIKE);
            const pnl = payoff - PREMIUM;
            const color = pnlToColor(pnl, maxAbsPnl);
            return (
              <rect
                key={i}
                x={0}
                y={yTop}
                width={w}
                height={Math.max(2, h - 1.5)}
                fill={color}
                fillOpacity={0.85}
              />
            );
          })}
          {[60_000, 80_000, 100_000].map((p) => (
            <text
              key={p}
              x={HIST.width - 8}
              y={yOfPrice(p) + 4}
              textAnchor="end"
              fontFamily={FONT_MONO}
              fontSize={10}
              fill={C.inkFaint}
            >
              {p.toLocaleString()}
            </text>
          ))}
        </svg>
      </ChartFrame>
    </AbsoluteFill>
  );
};
