import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import {
  C,
  FONT_DISPLAY,
  FONT_TEXT,
  blueRedRamp,
  gaussian,
  mulberry32,
} from "../tokens";
import {
  Axis,
  AxisLabel,
  ChartFrame,
  HorizontalColorBar,
  PlotArea,
} from "../primitives";

const SEED_PRICE = 0x11a73c;
const SEED_FUND = 0x4f81;
const SEED_BASIS = 0x91c4;

const N_POINTS = 500;
const COLORED_FRACTION = 0.15;
const N_COLORED = Math.round(N_POINTS * COLORED_FRACTION);

const L = { left: 130, top: 180, width: 900, height: 780 };
const R = { left: 1220, top: 180, width: 600, height: 780 };

const L_Y_MIN = 66000;
const L_Y_MAX = 76000;
const L_Y_TICKS = [66000, 68000, 70000, 72000, 74000, 76000];

const R_Y_MIN = -60;
const R_Y_MAX = 40;
const R_Y_TICKS = [40, 20, 0, -20, -40, -60];

const L_X_LABELS = ["Tue 10", "Thu 12", "Sat 14", "Mon 16", "Wed 18", "Fri 20"];
const R_X_LABELS = ["Thu 19", "12 PM", "Fri 20", "12 PM", "Sat 21"];

const BASIS_MIN = -0.0095;
const BASIS_MAX = 0.0311;

const DIM_DOT = "#6E7178";

type PricePoint = { x: number; y: number; basis: number };

function buildPrice(): PricePoint[] {
  const rng = mulberry32(SEED_PRICE);
  const pts: PricePoint[] = [];

  // Random walk with mild upward drift to roughly span 66.5k -> 73.5k
  // with reversals. Then a sharp down-leg near the end to motivate the
  // 2.7-day callout.
  const startY = 67200;
  const targetPeak = 75500;
  const driftPerStep = (targetPeak - startY) / (N_POINTS * 0.8);
  const noiseSigma = 230;

  let y = startY;
  let basis = -0.005;
  const basisNoise = 0.0035;

  for (let i = 0; i < N_POINTS; i++) {
    const tNorm = i / (N_POINTS - 1);

    // Drift: positive for first 80%, then we steer downward for the last 20%
    // so the recent leg shows a visible drop matching the source.
    let drift: number;
    if (tNorm < 0.8) {
      drift = driftPerStep * (0.7 + 0.6 * Math.sin(tNorm * Math.PI * 1.1));
    } else {
      // Aggressive downward steer for the recent down-leg
      drift = -driftPerStep * 2.6;
    }

    y = y + drift + gaussian(rng, 0, noiseSigma);
    y = Math.max(L_Y_MIN + 250, Math.min(L_Y_MAX - 250, y));

    // Basis drifts with price direction: rising price -> warmer (red-ish),
    // falling -> cooler. Random walk on basis too.
    basis = basis + (drift > 0 ? 0.0002 : -0.0003) + gaussian(rng, 0, basisNoise);
    basis = Math.max(BASIS_MIN, Math.min(BASIS_MAX, basis));

    pts.push({ x: tNorm, y, basis });
  }
  return pts;
}

type CarryPoint = { t: number; v: number };

function buildSmoothCurve(
  seed: number,
  finalValue: number,
  shape: (t: number) => number,
): CarryPoint[] {
  // shape(t) returns base value at normalized time t in [0,1].
  // We add bounded low-frequency noise so the curve looks organic but
  // remains smooth (no staircase). The endpoint is pinned to finalValue.
  const rng = mulberry32(seed);
  const M = 240;
  const pts: CarryPoint[] = [];

  // Precompute small perturbations and integrate (cumulative) to get a
  // smooth wandering offset, then taper it to zero at the endpoints.
  let drift = 0;
  const drifts: number[] = [];
  for (let i = 0; i <= M; i++) {
    drift += gaussian(rng, 0, 0.4);
    drifts.push(drift);
  }
  const driftScale = Math.abs(finalValue) * 0.06;
  const maxDrift = Math.max(...drifts.map((d) => Math.abs(d))) || 1;

  for (let i = 0; i <= M; i++) {
    const t = i / M;
    const taper = Math.sin(t * Math.PI); // 0 at ends, 1 in the middle
    const wobble = (drifts[i] / maxDrift) * driftScale * taper;
    const v = shape(t) * finalValue + wobble;
    pts.push({ t, v });
  }

  // Pin endpoints exactly.
  pts[0] = { t: 0, v: 0 };
  pts[pts.length - 1] = { t: 1, v: finalValue };
  return pts;
}

const lXToPx = (t: number) => t * L.width;
const lYToPx = (v: number) =>
  L.height - ((v - L_Y_MIN) / (L_Y_MAX - L_Y_MIN)) * L.height;
const rXToPx = (t: number) => t * R.width;
const rYToPx = (v: number) =>
  R.height - ((v - R_Y_MIN) / (R_Y_MAX - R_Y_MIN)) * R.height;

function formatDollar(v: number): string {
  const sign = v < 0 ? "−" : "";
  const abs = Math.abs(v).toFixed(2);
  return `${sign}$${abs}`;
}

function buildSmoothPath(
  pts: CarryPoint[],
  revealT: number,
  xMap: (t: number) => number,
  yMap: (v: number) => number,
): string {
  if (revealT <= 0 || pts.length < 2) return "";
  const cutoff = Math.max(1, Math.floor((pts.length - 1) * revealT));
  let d = `M ${xMap(pts[0].t)} ${yMap(pts[0].v)}`;
  for (let i = 1; i <= cutoff; i++) {
    d += ` L ${xMap(pts[i].t)} ${yMap(pts[i].v)}`;
  }
  return d;
}

// Find the index pair within the colored tail that frames the largest
// down-leg (max y[i] - y[j] with i < j inside the recent window). Used
// for the 2.7-day callout.
function findDownLeg(price: PricePoint[]): [number, number] {
  const start = price.length - N_COLORED;
  let bestDrop = -Infinity;
  let bestI = start;
  let bestJ = price.length - 1;
  for (let i = start; i < price.length; i++) {
    for (let j = i + 4; j < price.length; j++) {
      const drop = price[i].y - price[j].y;
      if (drop > bestDrop) {
        bestDrop = drop;
        bestI = i;
        bestJ = j;
      }
    }
  }
  return [bestI, bestJ];
}

export const Chart11: React.FC = () => {
  const frame = useCurrentFrame();

  const fadeIn = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(frame, [135, 150], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = Math.min(fadeIn, fadeOut);

  const revealLeft = interpolate(frame, [8, 70], [0, 1], {
    extrapolateRight: "clamp",
  });
  const revealRight = interpolate(frame, [25, 95], [0, 1], {
    extrapolateRight: "clamp",
  });
  const highlightFade = interpolate(frame, [95, 110], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const price = React.useMemo(buildPrice, []);

  // Funding cost climbs smoothly with mild concavity. Shape t^0.85
  // gives slightly faster early ramp, decelerating near the end.
  const fundingPts = React.useMemo(
    () =>
      buildSmoothCurve(SEED_FUND, 40, (t) => Math.pow(t, 0.85)),
    [],
  );
  // Basis cost falls smoothly, accelerating downward. Shape t^1.25 grows
  // faster toward the end -> the negative cumulative gets steeper.
  const basisPts = React.useMemo(
    () =>
      buildSmoothCurve(SEED_BASIS, -60, (t) => Math.pow(t, 1.25)),
    [],
  );

  const [highlightI, highlightJ] = React.useMemo(
    () => findDownLeg(price),
    [price],
  );

  const lXTicks = L_X_LABELS.map((label, i) => ({
    pos: lXToPx(i / (L_X_LABELS.length - 1)),
    label,
  }));
  const lYTicks = L_Y_TICKS.map((v) => ({
    pos: lYToPx(v),
    label: v.toLocaleString("en-US"),
  }));
  const rYTicks = R_Y_TICKS.map((v) => ({
    pos: rYToPx(v),
    label: formatDollar(v),
  }));
  const rXTicks = R_X_LABELS.map((label, i) => ({
    pos: rXToPx(i / (R_X_LABELS.length - 1)),
    label,
  }));

  const fundingPath = buildSmoothPath(fundingPts, revealRight, rXToPx, rYToPx);
  const basisPath = buildSmoothPath(basisPts, revealRight, rXToPx, rYToPx);

  const basisStops = [
    { t: 0, color: "#3F7FBB" },
    { t: 0.5, color: "#F5F5F5" },
    { t: 1, color: "#D85050" },
  ];

  const startPt = price[highlightI];
  const endPt = price[highlightJ];

  return (
    <AbsoluteFill style={{ opacity }}>
      <ChartFrame>
        {/* Header band: left title */}
        <div
          style={{
            position: "absolute",
            left: 80,
            top: 36,
            color: C.ink,
            fontFamily: FONT_DISPLAY,
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: "-0.016em",
          }}
        >
          BTC Index Price
          <div
            style={{
              marginTop: 6,
              fontFamily: FONT_TEXT,
              fontSize: 13,
              fontWeight: 400,
              color: C.inkMuted,
              letterSpacing: 0,
            }}
          >
            08 Mar 26 19:00 – 21 Mar 26 06:00
          </div>
        </div>

        {/* Header band: centered colorbar above the panel divide */}
        <HorizontalColorBar
          x={760}
          y={50}
          width={300}
          height={10}
          stops={basisStops}
          leftLabel="−0.95%"
          rightLabel="+3.11%"
          title="Annualized basis (future)"
        />

        {/* Header band: right title + two subtitles */}
        <div
          style={{
            position: "absolute",
            left: R.left,
            top: 36,
            color: C.ink,
            fontFamily: FONT_DISPLAY,
            fontSize: 20,
            fontWeight: 600,
            letterSpacing: "-0.016em",
          }}
        >
          Relative carry BTC-03APR26-PERPETUAL
          <div
            style={{
              marginTop: 6,
              fontFamily: FONT_TEXT,
              fontSize: 12,
              fontWeight: 400,
              color: C.inkMuted,
              letterSpacing: 0,
            }}
          >
            18 Mar 26 14:00 – 21 Mar 26 06:00 (2.7 days)
          </div>
          <div
            style={{
              marginTop: 2,
              fontFamily: FONT_TEXT,
              fontSize: 12,
              fontWeight: 400,
              color: C.inkMuted,
              letterSpacing: 0,
            }}
          >
            Avg funding: +8.89% | basis cost: −13.30%
          </div>
        </div>

        {/* Left plot: BTC price scatter */}
        <PlotArea left={L.left} top={L.top} width={L.width} height={L.height}>
          {lYTicks.map((t, i) => (
            <line
              key={`l-gy-${i}`}
              x1={0}
              x2={L.width}
              y1={t.pos}
              y2={t.pos}
              stroke={C.grid}
              strokeWidth={1}
            />
          ))}

          {price.map((p, i) => {
            const appearAt = (i / N_POINTS) * 0.9;
            const local = (revealLeft - appearAt) / 0.1;
            const a = Math.max(0, Math.min(1, local));
            if (a <= 0) return null;

            const cx = lXToPx(p.x);
            const cy = lYToPx(p.y);
            const isColored = i >= N_POINTS - N_COLORED;
            let fill: string;
            let opacityDot: number;
            if (isColored) {
              const tt = (p.basis - BASIS_MIN) / (BASIS_MAX - BASIS_MIN);
              fill = blueRedRamp(tt);
              opacityDot = 0.95;
            } else {
              fill = DIM_DOT;
              opacityDot = 0.85;
            }

            return (
              <circle
                key={`pp-${i}`}
                cx={cx}
                cy={cy}
                r={3}
                fill={fill}
                stroke={C.bg}
                strokeWidth={0.6}
                opacity={opacityDot * a}
              />
            );
          })}

          {/* 2.7-day callout */}
          {highlightFade > 0 ? (
            <g opacity={highlightFade}>
              <line
                x1={lXToPx(startPt.x)}
                y1={lYToPx(startPt.y)}
                x2={lXToPx(endPt.x)}
                y2={lYToPx(endPt.y)}
                stroke={C.ink}
                strokeWidth={1}
                strokeDasharray="5 5"
                opacity={0.7}
              />
              {/* Soft halo + white start dot */}
              <circle
                cx={lXToPx(startPt.x)}
                cy={lYToPx(startPt.y)}
                r={12}
                fill={C.bg}
                opacity={0.55}
              />
              <circle
                cx={lXToPx(startPt.x)}
                cy={lYToPx(startPt.y)}
                r={8.5}
                fill={C.white}
                stroke={C.bg}
                strokeWidth={1.2}
              />
              {/* Soft halo + red end dot */}
              <circle
                cx={lXToPx(endPt.x)}
                cy={lYToPx(endPt.y)}
                r={12}
                fill={C.bg}
                opacity={0.55}
              />
              <circle
                cx={lXToPx(endPt.x)}
                cy={lYToPx(endPt.y)}
                r={8.5}
                fill={C.red}
                stroke={C.bg}
                strokeWidth={1.2}
              />
              <text
                x={(lXToPx(startPt.x) + lXToPx(endPt.x)) / 2}
                y={(lYToPx(startPt.y) + lYToPx(endPt.y)) / 2 - 16}
                textAnchor="middle"
                fontFamily={FONT_TEXT}
                fontSize={13}
                fontWeight={500}
                fill={C.ink}
              >
                2.7 days
              </text>
            </g>
          ) : null}

          <Axis
            orientation="bottom"
            ticks={lXTicks}
            length={L.width}
            offset={L.height}
          />
          <Axis orientation="left" ticks={lYTicks} length={L.height} />
        </PlotArea>

        <AxisLabel
          text="Date (UTC)"
          x={L.left + L.width / 2}
          y={L.top + L.height + 56}
        />

        <AxisLabel
          text="Index Price (Close)"
          x={L.left - 78}
          y={L.top + L.height / 2}
          rotate={-90}
        />

        {/* Right plot: cumulative carry */}
        <PlotArea left={R.left} top={R.top} width={R.width} height={R.height}>
          {rYTicks.map((t, i) => {
            const isZero = R_Y_TICKS[i] === 0;
            return (
              <line
                key={`r-gy-${i}`}
                x1={0}
                x2={R.width}
                y1={t.pos}
                y2={t.pos}
                stroke={isZero ? C.inkFaint : C.grid}
                strokeWidth={1}
                opacity={isZero ? 0.5 : 1}
              />
            );
          })}

          <path
            d={fundingPath}
            stroke={C.white}
            strokeWidth={1.8}
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <path
            d={basisPath}
            stroke={C.blue}
            strokeWidth={1.8}
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          <Axis
            orientation="bottom"
            ticks={rXTicks}
            length={R.width}
            offset={R.height}
          />
          <Axis orientation="left" ticks={rYTicks} length={R.height} />
        </PlotArea>

        {/* Right panel legend — top-left inside the plot */}
        <div
          style={{
            position: "absolute",
            left: R.left + 16,
            top: R.top + 14,
            display: "flex",
            flexDirection: "column",
            gap: 4,
            fontFamily: FONT_TEXT,
            fontSize: 12,
            color: C.inkDim,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                width: 18,
                height: 2,
                backgroundColor: C.white,
                display: "inline-block",
              }}
            />
            <span>Funding cost</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                width: 18,
                height: 2,
                backgroundColor: C.blue,
                display: "inline-block",
              }}
            />
            <span>Basis cost</span>
          </div>
        </div>

        <AxisLabel
          text="Date (UTC)"
          x={R.left + R.width / 2}
          y={R.top + R.height + 56}
        />

        <AxisLabel
          text="Cumulative ($)"
          x={R.left - 64}
          y={R.top + R.height / 2}
          rotate={-90}
        />
      </ChartFrame>
    </AbsoluteFill>
  );
};
