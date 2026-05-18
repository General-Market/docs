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

const SEED_L = 0x110b71;
const SEED_R = 0x110c52;

const N_POINTS = 600;
const N_COLORED = 80;

const L = {
  left: 80,
  top: 120,
  width: 1020,
  height: 880,
};

const R = {
  left: 1180,
  top: 120,
  width: 660,
  height: 880,
};

const L_Y_MIN = 66000;
const L_Y_MAX = 76000;
const L_Y_TICKS = [66000, 68000, 70000, 72000, 74000, 76000];

const R_Y_MIN = -60;
const R_Y_MAX = 40;
const R_Y_TICKS = [-60, -40, -20, 0, 20, 40];

const X_LABELS = ["Tue 10", "Thu 12", "Sat 14", "Mon 16", "Wed 18", "Fri 20"];

type PricePoint = { x: number; y: number; basis: number };

function buildPrice(): PricePoint[] {
  const rng = mulberry32(SEED_L);
  const pts: PricePoint[] = [];
  let y = 68000;
  for (let i = 0; i < N_POINTS; i++) {
    const t = i / (N_POINTS - 1);
    const drift =
      900 * Math.sin(t * Math.PI * 1.8) +
      1500 * Math.sin(t * Math.PI * 4.3) +
      2400 * t;
    const noise = gaussian(rng, 0, 180);
    y = 68000 + drift + noise;
    y = Math.max(L_Y_MIN + 200, Math.min(L_Y_MAX - 200, y));

    let basis = -0.0095 + 0.04 * t + gaussian(rng, 0, 0.004);
    basis = Math.max(-0.0095, Math.min(0.0311, basis));

    pts.push({ x: t, y, basis });
  }
  return pts;
}

type StepPoint = { t: number; v: number };

function buildCarry(seed: number, finalValue: number): StepPoint[] {
  const rng = mulberry32(seed);
  const steps: StepPoint[] = [{ t: 0, v: 0 }];
  const M = 120;
  const drift = finalValue / M;
  let v = 0;
  for (let i = 1; i <= M; i++) {
    v += drift + gaussian(rng, 0, Math.abs(drift) * 0.35);
    steps.push({ t: i / M, v });
  }
  // Force the endpoint to match spec.
  steps[steps.length - 1] = { t: 1, v: finalValue };
  return steps;
}

const lXToPx = (t: number) => t * L.width;
const lYToPx = (v: number) =>
  L.height - ((v - L_Y_MIN) / (L_Y_MAX - L_Y_MIN)) * L.height;
const rXToPx = (t: number) => t * R.width;
const rYToPx = (v: number) =>
  R.height - ((v - R_Y_MIN) / (R_Y_MAX - R_Y_MIN)) * R.height;

const BASIS_MIN = -0.0095;
const BASIS_MAX = 0.0311;

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
  const revealRight = interpolate(frame, [25, 90], [0, 1], {
    extrapolateRight: "clamp",
  });

  const price = React.useMemo(buildPrice, []);
  const fundingSteps = React.useMemo(() => buildCarry(SEED_R, 40), []);
  const basisSteps = React.useMemo(() => buildCarry(SEED_R ^ 0x999, -60), []);

  const lXTicks = X_LABELS.map((label, i) => ({
    pos: lXToPx(i / (X_LABELS.length - 1)),
    label,
  }));
  const lYTicks = L_Y_TICKS.map((v) => ({
    pos: lYToPx(v),
    label: `$${(v / 1000).toFixed(0)}k`,
  }));
  const rYTicks = R_Y_TICKS.map((v) => ({
    pos: rYToPx(v),
    label: `${v > 0 ? "+" : ""}${v}`,
  }));

  const lastIdx = price.length - 1;
  const highlightStart = price[Math.max(0, lastIdx - 30)];
  const highlightEnd = price[lastIdx];

  const buildStepPath = (
    steps: StepPoint[],
    revealT: number,
    xMap: (t: number) => number,
    yMap: (v: number) => number,
  ) => {
    const cutoff = Math.floor(steps.length * revealT);
    if (cutoff < 1) return "";
    let d = `M ${xMap(steps[0].t)} ${yMap(steps[0].v)}`;
    for (let i = 1; i <= Math.min(cutoff, steps.length - 1); i++) {
      const prev = steps[i - 1];
      const cur = steps[i];
      d += ` L ${xMap(cur.t)} ${yMap(prev.v)}`;
      d += ` L ${xMap(cur.t)} ${yMap(cur.v)}`;
    }
    return d;
  };

  const fundingPath = buildStepPath(fundingSteps, revealRight, rXToPx, rYToPx);
  const basisPath = buildStepPath(basisSteps, revealRight, rXToPx, rYToPx);

  const basisStops = [
    { t: 0, color: "#3F7FBB" },
    { t: 0.5, color: "#F5F5F5" },
    { t: 1, color: "#D85050" },
  ];

  return (
    <AbsoluteFill style={{ opacity }}>
      <ChartFrame>
        <div
          style={{
            position: "absolute",
            left: L.left,
            top: 38,
            color: C.ink,
            fontFamily: FONT_DISPLAY,
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: "-0.014em",
          }}
        >
          BTC Index Price
          <div
            style={{
              marginTop: 4,
              fontFamily: FONT_TEXT,
              fontSize: 13,
              fontWeight: 400,
              color: C.inkMuted,
            }}
          >
            08 Mar 26 19:00 - 21 Mar 26 06:00
          </div>
        </div>

        <HorizontalColorBar
          x={L.left + L.width - 280}
          y={62}
          width={240}
          height={10}
          stops={basisStops}
          leftLabel="−0.95%"
          rightLabel="+3.11%"
          title="Annualized basis (future)"
        />

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
            const appearAt = (i / N_POINTS) * 0.85;
            const local = (revealLeft - appearAt) / 0.12;
            const a = Math.max(0, Math.min(1, local));
            if (a <= 0) return null;

            const cx = lXToPx(p.x);
            const cy = lYToPx(p.y);
            const isColored = i >= N_POINTS - N_COLORED;
            let fill: string;
            if (isColored) {
              const tt = (p.basis - BASIS_MIN) / (BASIS_MAX - BASIS_MIN);
              fill = blueRedRamp(tt);
            } else {
              fill = C.inkFaint;
            }

            return (
              <circle
                key={`pp-${i}`}
                cx={cx}
                cy={cy}
                r={2.4}
                fill={fill}
                opacity={(isColored ? 0.95 : 0.55) * a}
              />
            );
          })}

          {revealLeft > 0.95 ? (
            <>
              <line
                x1={lXToPx(highlightStart.x)}
                y1={lYToPx(highlightStart.y)}
                x2={lXToPx(highlightEnd.x)}
                y2={lYToPx(highlightEnd.y)}
                stroke={C.ink}
                strokeWidth={1}
                strokeDasharray="4 4"
                opacity={0.6}
              />
              <circle
                cx={lXToPx(highlightStart.x)}
                cy={lYToPx(highlightStart.y)}
                r={6.5}
                fill={C.white}
                stroke={C.bg}
                strokeWidth={1.5}
              />
              <circle
                cx={lXToPx(highlightEnd.x)}
                cy={lYToPx(highlightEnd.y)}
                r={6.5}
                fill={C.red}
                stroke={C.bg}
                strokeWidth={1.5}
              />
              <text
                x={(lXToPx(highlightStart.x) + lXToPx(highlightEnd.x)) / 2}
                y={(lYToPx(highlightStart.y) + lYToPx(highlightEnd.y)) / 2 - 14}
                textAnchor="middle"
                fontFamily={FONT_TEXT}
                fontSize={12}
                fill={C.ink}
              >
                2.7 days
              </text>
            </>
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

        <div
          style={{
            position: "absolute",
            left: R.left,
            top: 38,
            color: C.ink,
            fontFamily: FONT_DISPLAY,
            fontSize: 20,
            fontWeight: 600,
            letterSpacing: "-0.014em",
          }}
        >
          Relative carry BTC-03APR26-PERPETUAL
          <div
            style={{
              marginTop: 4,
              fontFamily: FONT_TEXT,
              fontSize: 12,
              fontWeight: 400,
              color: C.inkMuted,
            }}
          >
            18 Mar 26 14:00 - 21 Mar 26 06:00 (2.7 days)
          </div>
          <div
            style={{
              marginTop: 2,
              fontFamily: FONT_TEXT,
              fontSize: 12,
              fontWeight: 400,
              color: C.inkMuted,
            }}
          >
            Avg funding: +8.89% | basis cost: −13.30%
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            left: R.left + R.width - 200,
            top: 60,
            display: "flex",
            flexDirection: "column",
            gap: 4,
            fontFamily: FONT_TEXT,
            fontSize: 11,
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
                opacity={isZero ? 0.6 : 1}
              />
            );
          })}

          <path
            d={fundingPath}
            stroke={C.white}
            strokeWidth={1.6}
            fill="none"
            strokeLinejoin="miter"
          />
          <path
            d={basisPath}
            stroke={C.blue}
            strokeWidth={1.6}
            fill="none"
            strokeLinejoin="miter"
          />

          <Axis
            orientation="bottom"
            ticks={[
              { pos: 0, label: "Tue" },
              { pos: rXToPx(0.33), label: "Wed" },
              { pos: rXToPx(0.66), label: "Thu" },
              { pos: rXToPx(1), label: "Fri" },
            ]}
            length={R.width}
            offset={R.height}
          />
          <Axis orientation="left" ticks={rYTicks} length={R.height} />
        </PlotArea>

        <AxisLabel
          text="Cumulative ($)"
          x={R.left - 56}
          y={R.top + R.height / 2}
          rotate={-90}
        />
      </ChartFrame>
    </AbsoluteFill>
  );
};
