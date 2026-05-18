import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import {
  C,
  FONT_TEXT,
  SEQUENTIAL_RED,
  gaussian,
  mulberry32,
  sequentialColor,
} from "../tokens";
import { Axis, ChartFrame, PlotArea, Title } from "../primitives";

const SEED = 0x70a51;

const N_DAYS = 720;

const TOP = {
  left: 110,
  top: 110,
  width: 1700,
  height: 270,
};
const MID = {
  left: 110,
  top: TOP.top + TOP.height + 60,
  width: 1700,
  height: 310,
};
const BOT = {
  left: 110,
  top: 110 + 270 + 60 + 310 + 60,
  width: 1700,
  height: 200,
};

const PRICE_MIN = 60_000;
const PRICE_MAX = 125_000;

type DayPoint = {
  price: number;
  vcr: number; // 0..1 (0–80%)
  rv: number; // 0..1.2
  weekday: number; // 0..6
};

function buildSeries(): DayPoint[] {
  const rng = mulberry32(SEED);
  const out: DayPoint[] = [];
  let price = 64_000;
  let drift = 0;
  for (let i = 0; i < N_DAYS; i++) {
    // gentle drift + occasional regime
    drift = drift * 0.94 + gaussian(rng, 0, 60);
    let bump = drift;
    if (i > 220 && i < 320) bump += 80;
    if (i > 420 && i < 500) bump += 110;
    if (i > 540 && i < 640) bump += 70;
    price += bump + gaussian(rng, 0, 350);
    price = Math.max(58_000, Math.min(128_000, price));

    const baseVcr = 0.08 + 0.18 * Math.abs(Math.sin(i / 28));
    const spike = rng() < 0.07 ? 0.25 + rng() * 0.45 : 0;
    const vcr = Math.max(0, Math.min(0.8, baseVcr + spike + gaussian(rng, 0, 0.05)));

    const rv =
      0.32 +
      0.18 * Math.sin(i / 41) +
      0.4 * vcr +
      gaussian(rng, 0, 0.06);

    out.push({
      price,
      vcr,
      rv: Math.max(0.2, Math.min(1.2, rv)),
      weekday: i % 7,
    });
  }
  return out;
}

// step-line path
function stepPath(
  values: number[],
  xOf: (i: number) => number,
  yOf: (v: number) => number,
): string {
  let d = "";
  for (let i = 0; i < values.length; i++) {
    const x = xOf(i);
    const y = yOf(values[i]);
    if (i === 0) d += `M${x.toFixed(2)},${y.toFixed(2)} `;
    else {
      const prevX = xOf(i - 1);
      d += `L${x.toFixed(2)},${yOf(values[i - 1]).toFixed(2)} `;
      d += `L${x.toFixed(2)},${y.toFixed(2)} `;
      // touch prevX to avoid lint of unused variable
      void prevX;
    }
  }
  return d;
}

const TOP_X_TICKS_LABELS = [
  "July",
  "October",
  "2025",
  "April",
  "July",
  "October",
  "2026",
  "April",
];

export const Chart07: React.FC = () => {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, 18], [0, 1], {
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(frame, [162, 180], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = Math.min(fadeIn, fadeOut);
  const reveal = interpolate(frame, [10, 72], [0, 1], {
    extrapolateRight: "clamp",
  });

  const data = React.useMemo(buildSeries, []);

  // ---- Top panel: price step line ----
  const priceXOf = (i: number) => (i / (N_DAYS - 1)) * TOP.width;
  const priceYOf = (v: number) =>
    TOP.height - ((v - PRICE_MIN) / (PRICE_MAX - PRICE_MIN)) * TOP.height;
  const pricePath = React.useMemo(
    () => stepPath(data.map((d) => d.price), priceXOf, priceYOf),
    [data],
  );
  const PRICE_Y_TICKS = [60, 75, 90, 105, 120].map((v) => ({
    pos: priceYOf(v * 1000),
    label: `${v}k`,
  }));
  const TOP_X_TICKS = TOP_X_TICKS_LABELS.map((label, i) => ({
    pos: (i / (TOP_X_TICKS_LABELS.length - 1)) * TOP.width,
    label,
  }));

  // ---- Middle panel: VCR bars + RV step line ----
  const barW = MID.width / N_DAYS;
  const VCR_MAX = 0.8;
  const vcrToPx = (v: number) => (v / VCR_MAX) * MID.height;
  const RV_MIN = 0.2;
  const RV_MAX = 1.2;
  const rvYOf = (v: number) =>
    MID.height - ((v - RV_MIN) / (RV_MAX - RV_MIN)) * MID.height;
  const midXOf = (i: number) => (i / (N_DAYS - 1)) * MID.width;
  const rvPath = React.useMemo(
    () => stepPath(data.map((d) => d.rv), midXOf, rvYOf),
    [data],
  );

  const MID_LEFT_TICKS = [0, 0.2, 0.4, 0.6, 0.8].map((v) => ({
    pos: MID.height - vcrToPx(v),
    label: `${Math.round(v * 100)}%`,
  }));
  const MID_RIGHT_TICKS = [0.2, 0.4, 0.6, 0.8, 1.0, 1.2].map((v) => ({
    pos: rvYOf(v),
    label: `${Math.round(v * 100)}%`,
  }));

  // ---- Bottom panel: heatmap 7×N_COLS ----
  const N_COLS = 100;
  const cellW = BOT.width / N_COLS;
  const cellH = BOT.height / 7;
  const heat = React.useMemo(() => {
    // bucket the days by N_COLS columns, by weekday
    const grid: number[][] = Array.from({ length: 7 }, () =>
      Array(N_COLS).fill(0),
    );
    const counts: number[][] = Array.from({ length: 7 }, () =>
      Array(N_COLS).fill(0),
    );
    for (let i = 0; i < data.length; i++) {
      const col = Math.min(N_COLS - 1, Math.floor((i / data.length) * N_COLS));
      const wd = data[i].weekday;
      grid[wd][col] += data[i].vcr;
      counts[wd][col] += 1;
    }
    for (let w = 0; w < 7; w++)
      for (let c = 0; c < N_COLS; c++)
        if (counts[w][c] > 0) grid[w][c] /= counts[w][c];
    return grid;
  }, [data]);

  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const visibleBars = Math.floor(N_DAYS * reveal);

  return (
    <AbsoluteFill style={{ opacity }}>
      <ChartFrame>
        <Title
          text="BTCUSD"
          subtitle="7 May 2024 – 30 Apr 2026"
          y={36}
          x={TOP.left}
          align="left"
        />

        {/* ---- Top panel: price ---- */}
        <PlotArea
          left={TOP.left}
          top={TOP.top}
          width={TOP.width}
          height={TOP.height}
        >
          {PRICE_Y_TICKS.map((t, i) => (
            <line
              key={`pgy-${i}`}
              x1={0}
              x2={TOP.width}
              y1={t.pos}
              y2={t.pos}
              stroke={C.grid}
              strokeWidth={1}
            />
          ))}
          <defs>
            <clipPath id="chart07-top-clip">
              <rect
                x={0}
                y={0}
                width={TOP.width * reveal}
                height={TOP.height}
              />
            </clipPath>
          </defs>
          <path
            d={pricePath}
            stroke={C.white}
            strokeWidth={1.2}
            fill="none"
            clipPath="url(#chart07-top-clip)"
          />
          <Axis
            orientation="bottom"
            ticks={TOP_X_TICKS}
            length={TOP.width}
            offset={TOP.height}
          />
          <Axis
            orientation="left"
            ticks={PRICE_Y_TICKS}
            length={TOP.height}
          />
        </PlotArea>

        {/* ---- Middle panel: VCR bars + RV line ---- */}
        <div
          style={{
            position: "absolute",
            left: MID.left,
            top: MID.top - 30,
            color: C.ink,
            fontFamily: FONT_TEXT,
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          Max VCR Ratio (7d){" "}
          <span style={{ color: C.inkDim, marginLeft: 16, fontSize: 12 }}>
            7d Rolling RV
          </span>
        </div>
        <PlotArea
          left={MID.left}
          top={MID.top}
          width={MID.width}
          height={MID.height}
        >
          {MID_LEFT_TICKS.map((t, i) => (
            <line
              key={`mgy-${i}`}
              x1={0}
              x2={MID.width}
              y1={t.pos}
              y2={t.pos}
              stroke={C.grid}
              strokeWidth={1}
            />
          ))}
          {data.slice(0, visibleBars).map((d, i) => {
            const h = vcrToPx(d.vcr);
            const x = midXOf(i);
            const color = sequentialColor(d.vcr / VCR_MAX, SEQUENTIAL_RED);
            return (
              <rect
                key={i}
                x={x}
                y={MID.height - h}
                width={Math.max(0.6, barW * 0.9)}
                height={h}
                fill={color}
                opacity={0.85}
              />
            );
          })}
          <defs>
            <clipPath id="chart07-mid-clip">
              <rect
                x={0}
                y={0}
                width={MID.width * reveal}
                height={MID.height}
              />
            </clipPath>
          </defs>
          <path
            d={rvPath}
            stroke={C.white}
            strokeWidth={1.1}
            fill="none"
            opacity={0.85}
            clipPath="url(#chart07-mid-clip)"
          />
          <Axis
            orientation="left"
            ticks={MID_LEFT_TICKS}
            length={MID.height}
          />
          {/* right axis */}
          <g transform={`translate(${MID.width}, 0)`}>
            {MID_RIGHT_TICKS.map((t, i) => (
              <g key={`mry-${i}`} transform={`translate(0, ${t.pos})`}>
                <line x1={0} x2={4} stroke={C.inkFaint} strokeWidth={1} />
                <text
                  x={10}
                  y={4}
                  fontFamily={FONT_TEXT}
                  fontSize={11}
                  fill={C.inkDim}
                >
                  {t.label}
                </text>
              </g>
            ))}
          </g>
          <Axis
            orientation="bottom"
            ticks={TOP_X_TICKS}
            length={MID.width}
            offset={MID.height}
          />
        </PlotArea>

        {/* ---- Bottom panel: weekday heatmap ---- */}
        <div
          style={{
            position: "absolute",
            left: BOT.left,
            top: BOT.top - 30,
            color: C.ink,
            fontFamily: FONT_TEXT,
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          VCR (7d) by Weekday
        </div>
        <PlotArea
          left={BOT.left}
          top={BOT.top}
          width={BOT.width}
          height={BOT.height}
        >
          {heat.map((row, w) =>
            row.map((v, c) => {
              if (c / N_COLS > reveal) return null;
              const x = c * cellW;
              const y = w * cellH;
              const color = sequentialColor(
                Math.min(1, v / 0.55),
                SEQUENTIAL_RED,
              );
              return (
                <rect
                  key={`h-${w}-${c}`}
                  x={x}
                  y={y}
                  width={cellW + 0.5}
                  height={cellH + 0.5}
                  fill={color}
                />
              );
            }),
          )}
          {DAYS.map((d, w) => (
            <text
              key={d}
              x={-8}
              y={w * cellH + cellH / 2 + 4}
              textAnchor="end"
              fontFamily={FONT_TEXT}
              fontSize={11}
              fill={C.inkDim}
            >
              {d}
            </text>
          ))}
        </PlotArea>
      </ChartFrame>
    </AbsoluteFill>
  );
};
