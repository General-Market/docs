import React from "react";
import { interpolate } from "remotion";
import { C, FONT_MONO } from "./theme";
import { ladderLabel } from "./engine";
import type { FrameView } from "./types";

const PLOT_L = 30;
const LADDER_W = 150;

export const CandleChart: React.FC<{
  view: FrameView;
  width: number;
  height: number;
}> = ({ view, width, height }) => {
  const plotR = width - LADDER_W;
  const plotW = plotR - PLOT_L;
  const plotH = height;

  const xOf = (vx: number) => plotR - (vx / view.viewCount) * plotW;
  const yOf = (v: number) =>
    interpolate(v, [view.scaleMin, view.scaleMax], [plotH - 6, 8], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  const cw = Math.max(2, (plotW / view.viewCount) * 0.6);

  const liveY = yOf(view.liveMcap);
  const entryX = view.entry ? xOf(view.entry.vx) : null;
  const refreshCx = PLOT_L + plotW / 2;
  const refreshCy = plotH - 150;
  const refreshR = 22;

  return (
    <svg
      width={width}
      height={height}
      style={{ display: "block" }}
      shapeRendering="crispEdges"
    >
      <defs>
        <filter id="entryGlow" x="-150%" y="-150%" width="400%" height="400%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>

      <g
        transform={`translate(${PLOT_L + 8}, ${plotH - 104}) scale(2)`}
        fill="#d4d7dc"
        opacity={0.45}
      >
        <path d="M0 0 H20 V5.5 H12.8 V22 H7.2 V5.5 H0 Z" />
        <path d="M23 22 L30 0 H36 L29 22 Z" />
      </g>

      {view.ladder.map((v) => {
        const y = yOf(v);
        if (y < 4 || y > plotH - 2) return null;
        return (
          <g key={v}>
            <line
              x1={PLOT_L}
              x2={plotR}
              y1={y}
              y2={y}
              stroke={C.hairline}
              strokeWidth={1}
            />
            <text
              x={plotR + 14}
              y={y + 9}
              fill={C.textFaint}
              fontFamily={FONT_MONO}
              fontSize={24}
            >
              {ladderLabel(v)}
            </text>
          </g>
        );
      })}

      {view.candles.map((cd, i) => {
        const x = xOf(cd.x);
        if (x < PLOT_L - cw || x > plotR + cw) return null;
        const up = cd.c >= cd.o;
        const col = up ? C.green : C.red;
        const yH = yOf(cd.h);
        const yL = yOf(cd.l);
        const yO = yOf(cd.o);
        const yC = yOf(cd.c);
        const bodyTop = Math.min(yO, yC);
        const bodyH = Math.max(1.5, Math.abs(yC - yO));
        return (
          <g key={i} opacity={cd.forming ? 0.96 : 1}>
            <line x1={x} x2={x} y1={yH} y2={yL} stroke={col} strokeWidth={2} />
            <rect
              x={x - cw / 2}
              y={bodyTop}
              width={cw}
              height={bodyH}
              fill={col}
              rx={1}
            />
          </g>
        );
      })}

      {view.axisTimes.map((tk, i) => {
        const x = xOf(tk.vx);
        if (x < PLOT_L || x > plotR) return null;
        return (
          <text
            key={i}
            x={x}
            y={plotH - 8}
            fill={C.textFaint}
            fontFamily={FONT_MONO}
            fontSize={22}
            textAnchor="middle"
          >
            {tk.label}
          </text>
        );
      })}

      {entryX !== null && entryX >= PLOT_L && entryX <= plotR && (
        <g>
          <line
            x1={entryX}
            x2={entryX}
            y1={8}
            y2={plotH - 6}
            stroke={C.green}
            strokeWidth={2}
            strokeDasharray="2 8"
            opacity={0.8}
          />
          <g transform={`translate(${entryX}, 40) rotate(45)`}>
            <rect
              x={-18}
              y={-18}
              width={36}
              height={36}
              fill={C.green}
              opacity={0.45}
              filter="url(#entryGlow)"
            />
            <rect x={-15} y={-15} width={30} height={30} fill={C.green} />
          </g>
        </g>
      )}

      <line
        x1={PLOT_L}
        x2={plotR}
        y1={liveY}
        y2={liveY}
        stroke={C.red}
        strokeWidth={1.5}
        strokeDasharray="7 7"
        opacity={0.9}
      />

      <g
        transform={`translate(${refreshCx}, ${refreshCy})`}
        opacity={0.7}
        fill="none"
        stroke={C.textMute}
        strokeWidth={2}
      >
        <circle cx={0} cy={0} r={refreshR} />
        <path
          d="M-7 -3 A8 8 0 0 1 8 -3"
          strokeLinecap="round"
        />
        <path d="M8 -8 L8 -2 L2 -2" strokeLinecap="round" strokeLinejoin="round" />
        <path
          d="M7 3 A8 8 0 0 1 -8 3"
          strokeLinecap="round"
        />
        <path
          d="M-8 8 L-8 2 L-2 2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>

      <g>
        <rect
          x={plotR + 2}
          y={liveY - 21}
          width={LADDER_W - 6}
          height={42}
          rx={6}
          fill={C.red}
        />
        <text
          x={plotR + (LADDER_W - 6) / 2 + 2}
          y={liveY + 9}
          fill={C.text}
          fontFamily={FONT_MONO}
          fontSize={25}
          fontWeight={700}
          textAnchor="middle"
        >
          {ladderLabel(view.liveMcap)}
        </text>
      </g>
    </svg>
  );
};
