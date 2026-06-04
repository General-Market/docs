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
  const liveColor = view.liveUp ? C.green : C.red;
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
        <filter id="entryGlow" x="-200%" y="-200%" width="500%" height="500%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
        <radialGradient id="entryHalo" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={C.green} stopOpacity={0.55} />
          <stop offset="100%" stopColor={C.green} stopOpacity={0} />
        </radialGradient>
      </defs>

      <g
        transform={`translate(${PLOT_L + 8}, ${plotH - 92}) scale(2.6)`}
        fill="#e9ebee"
        opacity={0.9}
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
            strokeDasharray="2 9"
            opacity={0.9}
          />
          <g transform={`translate(${entryX}, 42)`}>
            <circle r={34} fill="url(#entryHalo)" />
            {(() => {
              const w = 22;
              const cy = 6;
              const top = -16;
              const bottom = 26;
              const gem = `M${-w} ${cy} L${-w * 0.62} ${top} L${w * 0.62} ${top} L${w} ${cy} L0 ${bottom} Z`;
              const facet = C.bg;
              return (
                <>
                  <path
                    d={gem}
                    fill={C.green}
                    opacity={0.5}
                    filter="url(#entryGlow)"
                  />
                  <path d={gem} fill={C.green} />
                  <line
                    x1={-w}
                    y1={cy}
                    x2={w}
                    y2={cy}
                    stroke={facet}
                    strokeWidth={1.4}
                    opacity={0.55}
                  />
                  <line
                    x1={-w * 0.62}
                    y1={top}
                    x2={0}
                    y2={bottom}
                    stroke={facet}
                    strokeWidth={1.4}
                    opacity={0.55}
                  />
                  <line
                    x1={w * 0.62}
                    y1={top}
                    x2={0}
                    y2={bottom}
                    stroke={facet}
                    strokeWidth={1.4}
                    opacity={0.55}
                  />
                  <line
                    x1={0}
                    y1={top}
                    x2={0}
                    y2={bottom}
                    stroke={facet}
                    strokeWidth={1.4}
                    opacity={0.4}
                  />
                </>
              );
            })()}
          </g>
        </g>
      )}

      <line
        x1={PLOT_L}
        x2={plotR}
        y1={liveY}
        y2={liveY}
        stroke={liveColor}
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
          fill={liveColor}
        />
        <text
          x={plotR + (LADDER_W - 6) / 2 + 2}
          y={liveY + 9}
          fill={view.liveUp ? C.bg : C.text}
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
