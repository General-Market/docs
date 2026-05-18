import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import {
  C,
  FONT_TEXT,
  divergingColor,
  gaussian,
  mulberry32,
} from "../tokens";
import { ChartFrame, Title } from "../primitives";

const SEED = 0x10aa10;
const N = 55;

const MONTHS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];

type Row = {
  label: string;
  straddle: number;
  hedge: number;
  total: number;
};

function buildRows(): Row[] {
  const rng = mulberry32(SEED);
  const raw: Row[] = [];
  for (let i = 0; i < N; i++) {
    const day = 1 + Math.floor(rng() * 28);
    const month = MONTHS[Math.floor(rng() * MONTHS.length)];
    const year = rng() < 0.4 ? "25" : "26";
    const strike = Math.round((60 + rng() * 40) * 1000);
    const label = `BTC-${String(day).padStart(2, "0")}${month}${year}-${strike}-S`;

    const straddle = gaussian(rng, 0, 4200);
    const hedge = -straddle * (0.55 + rng() * 0.35) + gaussian(rng, 0, 1500);
    raw.push({
      label,
      straddle,
      hedge,
      total: straddle + hedge,
    });
  }

  raw.sort((a, b) => a.straddle - b.straddle);

  // Plant the dramatic extremes the spec demands.
  raw[0] = {
    ...raw[0],
    straddle: -14200,
    hedge: 13100,
    total: -14200 + 13100,
  };
  raw[N - 1] = {
    ...raw[N - 1],
    straddle: 12600,
    hedge: -10800,
    total: 12600 - 10800,
  };

  return raw;
}

const PLOT_TOP = 140;
const PLOT_BOTTOM = 1010;
const PLOT_HEIGHT = PLOT_BOTTOM - PLOT_TOP;
const ROW_H = PLOT_HEIGHT / N;
const BAR_H = Math.max(6, ROW_H - 3);

const LABEL_COL_W = 290;
const PANEL_GAP = 24;
const FIRST_PANEL_X = LABEL_COL_W + 30;
const PANEL_W = (1920 - FIRST_PANEL_X - 40 - PANEL_GAP * 2) / 3;

const VAL_MAX = 16000;
const X_TICKS = [-16000, -12000, -8000, -4000, 0, 4000, 8000, 12000, 16000];

const valueToOffset = (v: number) => {
  const center = PANEL_W / 2;
  const t = v / VAL_MAX;
  return center + (t * PANEL_W) / 2;
};

const PANELS: { key: keyof Pick<Row, "straddle" | "hedge" | "total">; title: string }[] = [
  { key: "straddle", title: "Straddle PnL" },
  { key: "hedge", title: "Hedge PnL" },
  { key: "total", title: "Total PnL" },
];

const formatTick = (v: number) => {
  if (v === 0) return "0";
  const sign = v < 0 ? "−" : "";
  return `${sign}${Math.abs(v / 1000)}k`;
};

export const Chart10: React.FC = () => {
  const frame = useCurrentFrame();

  const fadeIn = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(frame, [165, 180], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = Math.min(fadeIn, fadeOut);

  const reveal = interpolate(frame, [10, 70], [0, 1], {
    extrapolateRight: "clamp",
  });

  const rows = React.useMemo(buildRows, []);

  return (
    <AbsoluteFill style={{ opacity }}>
      <ChartFrame>
        <Title
          text="Per-Instrument PnL: Straddle vs Hedge vs Total"
          subtitle="Source: Thalex | 07 Mar 2025 – 20 Mar 2026"
          y={42}
        />

        {rows.map((r, i) => (
          <div
            key={`lbl-${i}`}
            style={{
              position: "absolute",
              left: 30,
              top: PLOT_TOP + i * ROW_H + ROW_H / 2 - 7,
              width: LABEL_COL_W - 10,
              color: C.inkDim,
              fontFamily: FONT_TEXT,
              fontSize: 10.5,
              textAlign: "right",
              letterSpacing: "0.01em",
              opacity: 0.85,
            }}
          >
            {r.label}
          </div>
        ))}

        {PANELS.map((panel, pi) => {
          const panelX = FIRST_PANEL_X + pi * (PANEL_W + PANEL_GAP);
          const centerX = panelX + PANEL_W / 2;

          return (
            <React.Fragment key={panel.key}>
              <div
                style={{
                  position: "absolute",
                  left: panelX,
                  top: 102,
                  width: PANEL_W,
                  textAlign: "center",
                  color: C.ink,
                  fontFamily: FONT_TEXT,
                  fontSize: 14,
                  fontWeight: 500,
                  letterSpacing: "-0.01em",
                }}
              >
                {panel.title}
              </div>

              <svg
                style={{
                  position: "absolute",
                  left: panelX,
                  top: PLOT_TOP,
                  width: PANEL_W,
                  height: PLOT_HEIGHT + 56,
                  overflow: "visible",
                }}
              >
                {X_TICKS.map((t, ti) => {
                  const x = valueToOffset(t);
                  const isZero = t === 0;
                  return (
                    <line
                      key={`g-${ti}`}
                      x1={x}
                      x2={x}
                      y1={0}
                      y2={PLOT_HEIGHT}
                      stroke={isZero ? C.inkFaint : C.grid}
                      strokeWidth={isZero ? 1 : 1}
                      opacity={isZero ? 0.7 : 1}
                    />
                  );
                })}

                {rows.map((r, i) => {
                  const v = r[panel.key];
                  const appearAt = (i / N) * 0.7;
                  const local = (reveal - appearAt) / 0.18;
                  const a = Math.max(0, Math.min(1, local));
                  if (a <= 0) return null;

                  const zeroX = valueToOffset(0);
                  const endX = valueToOffset(v);
                  const animEndX = zeroX + (endX - zeroX) * a;
                  const x = Math.min(zeroX, animEndX);
                  const w = Math.abs(animEndX - zeroX);
                  const y = i * ROW_H + (ROW_H - BAR_H) / 2;
                  const norm = v / 40000;
                  const fill = divergingColor(norm, -0.4, 0.2);

                  return (
                    <rect
                      key={`b-${pi}-${i}`}
                      x={x}
                      y={y}
                      width={Math.max(0.5, w)}
                      height={BAR_H}
                      fill={fill}
                      opacity={0.92}
                    />
                  );
                })}

                <line
                  x1={0}
                  x2={PANEL_W}
                  y1={PLOT_HEIGHT}
                  y2={PLOT_HEIGHT}
                  stroke={C.inkFaint}
                  strokeWidth={1}
                />

                {X_TICKS.map((t, ti) => {
                  if (ti % 2 !== 0) return null;
                  const x = valueToOffset(t);
                  return (
                    <g key={`tk-${ti}`} transform={`translate(${x}, ${PLOT_HEIGHT})`}>
                      <line y1={0} y2={4} stroke={C.inkFaint} strokeWidth={1} />
                      <text
                        y={18}
                        textAnchor="middle"
                        fontFamily={FONT_TEXT}
                        fontSize={10.5}
                        fill={C.inkDim}
                      >
                        {formatTick(t)}
                      </text>
                    </g>
                  );
                })}
              </svg>

              <div
                style={{
                  position: "absolute",
                  left: centerX - 40,
                  top: PLOT_TOP + PLOT_HEIGHT + 32,
                  width: 80,
                  textAlign: "center",
                  color: C.inkDim,
                  fontFamily: FONT_TEXT,
                  fontSize: 12,
                  fontWeight: 500,
                }}
              >
                PnL ($)
              </div>
            </React.Fragment>
          );
        })}
      </ChartFrame>
    </AbsoluteFill>
  );
};
