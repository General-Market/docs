import React from "react";
import { C, FONT_DISPLAY, FONT_TEXT } from "./tokens";

export const ChartFrame: React.FC<{
  children: React.ReactNode;
  opacity?: number;
}> = ({ children, opacity = 1 }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      backgroundColor: C.bg,
      opacity,
    }}
  >
    {children}
  </div>
);

export const Title: React.FC<{
  text: string;
  subtitle?: string;
  x?: number | string;
  y?: number;
  align?: "left" | "center";
  size?: number;
}> = ({ text, subtitle, x = "50%", y = 36, align = "center", size = 26 }) => (
  <div
    style={{
      position: "absolute",
      top: y,
      left: x,
      transform: align === "center" ? "translateX(-50%)" : undefined,
      textAlign: align,
      color: C.ink,
      fontFamily: FONT_DISPLAY,
      fontWeight: 600,
      fontSize: size,
      letterSpacing: "-0.014em",
    }}
  >
    {text}
    {subtitle ? (
      <div
        style={{
          marginTop: 6,
          fontFamily: FONT_TEXT,
          fontSize: 14,
          fontWeight: 400,
          color: C.inkMuted,
          letterSpacing: 0,
        }}
      >
        {subtitle}
      </div>
    ) : null}
  </div>
);

export const PlotArea: React.FC<{
  left: number;
  top: number;
  width: number;
  height: number;
  children: React.ReactNode;
}> = ({ left, top, width, height, children }) => (
  <svg
    style={{
      position: "absolute",
      left,
      top,
      width,
      height,
      overflow: "visible",
    }}
    viewBox={`0 0 ${width} ${height}`}
  >
    {children}
  </svg>
);

export const Axis: React.FC<{
  orientation: "bottom" | "left";
  ticks: { pos: number; label: string }[];
  length: number;
  offset?: number;
  showLine?: boolean;
  tickColor?: string;
  labelColor?: string;
  fontSize?: number;
  tickLength?: number;
}> = ({
  orientation,
  ticks,
  length,
  offset = 0,
  showLine = false,
  tickColor = C.inkFaint,
  labelColor = C.inkDim,
  fontSize = 11,
  tickLength = 4,
}) => {
  if (orientation === "bottom") {
    return (
      <g transform={`translate(0, ${offset})`}>
        {showLine ? (
          <line x1={0} y1={0} x2={length} y2={0} stroke={tickColor} strokeWidth={1} />
        ) : null}
        {ticks.map((t, i) => (
          <g key={i} transform={`translate(${t.pos}, 0)`}>
            <line y1={0} y2={tickLength} stroke={tickColor} strokeWidth={1} />
            <text
              y={tickLength + 14}
              textAnchor="middle"
              fontFamily={FONT_TEXT}
              fontSize={fontSize}
              fill={labelColor}
            >
              {t.label}
            </text>
          </g>
        ))}
      </g>
    );
  }
  return (
    <g transform={`translate(${offset}, 0)`}>
      {showLine ? (
        <line x1={0} y1={0} x2={0} y2={length} stroke={tickColor} strokeWidth={1} />
      ) : null}
      {ticks.map((t, i) => (
        <g key={i} transform={`translate(0, ${t.pos})`}>
          <line x1={-tickLength} x2={0} stroke={tickColor} strokeWidth={1} />
          <text
            x={-tickLength - 6}
            y={4}
            textAnchor="end"
            fontFamily={FONT_TEXT}
            fontSize={fontSize}
            fill={labelColor}
          >
            {t.label}
          </text>
        </g>
      ))}
    </g>
  );
};

export const AxisLabel: React.FC<{
  text: string;
  x: number;
  y: number;
  rotate?: number;
}> = ({ text, x, y, rotate = 0 }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      transform: rotate ? `translate(-50%, -50%) rotate(${rotate}deg)` : "translate(-50%, -50%)",
      color: C.ink,
      fontFamily: FONT_TEXT,
      fontSize: 13,
      fontWeight: 500,
      whiteSpace: "nowrap",
    }}
  >
    {text}
  </div>
);

// Vertical color bar — used by IV / PnL / basis legend tiles.
export const VerticalColorBar: React.FC<{
  x: number;
  y: number;
  width?: number;
  height?: number;
  stops: { t: number; color: string }[]; // t in [0..1], 0 = bottom
  ticks: { t: number; label: string }[];
  title?: string;
}> = ({ x, y, width = 14, height = 220, stops, ticks, title }) => {
  const id = React.useId().replace(/[:]/g, "");
  return (
    <svg
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: width + 70,
        height: height + 50,
        overflow: "visible",
      }}
    >
      {title ? (
        <text
          x={0}
          y={-6}
          fontFamily={FONT_TEXT}
          fontSize={12}
          fontWeight={500}
          fill={C.inkDim}
        >
          {title}
        </text>
      ) : null}
      <defs>
        <linearGradient id={id} x1="0" y1="1" x2="0" y2="0">
          {stops.map((s, i) => (
            <stop key={i} offset={`${s.t * 100}%`} stopColor={s.color} />
          ))}
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={width} height={height} fill={`url(#${id})`} />
      {ticks.map((t, i) => {
        const yy = (1 - t.t) * height;
        return (
          <g key={i}>
            <line
              x1={width}
              x2={width + 4}
              y1={yy}
              y2={yy}
              stroke={C.inkFaint}
              strokeWidth={1}
            />
            <text
              x={width + 8}
              y={yy + 4}
              fontFamily={FONT_TEXT}
              fontSize={11}
              fill={C.inkDim}
            >
              {t.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

// Horizontal color bar (used by chart 06)
export const HorizontalColorBar: React.FC<{
  x: number;
  y: number;
  width?: number;
  height?: number;
  stops: { t: number; color: string }[];
  leftLabel?: string;
  rightLabel?: string;
  title?: string;
}> = ({
  x,
  y,
  width = 240,
  height = 10,
  stops,
  leftLabel,
  rightLabel,
  title,
}) => {
  const id = React.useId().replace(/[:]/g, "");
  return (
    <svg
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: width + 12,
        height: height + 38,
        overflow: "visible",
      }}
    >
      {title ? (
        <text
          x={0}
          y={-6}
          fontFamily={FONT_TEXT}
          fontSize={12}
          fontWeight={500}
          fill={C.inkDim}
        >
          {title}
        </text>
      ) : null}
      <defs>
        <linearGradient id={id} x1="0" x2="1" y1="0" y2="0">
          {stops.map((s, i) => (
            <stop key={i} offset={`${s.t * 100}%`} stopColor={s.color} />
          ))}
        </linearGradient>
      </defs>
      <rect x={0} y={6} width={width} height={height} fill={`url(#${id})`} />
      {leftLabel ? (
        <text
          x={0}
          y={height + 26}
          fontFamily={FONT_TEXT}
          fontSize={11}
          fill={C.inkDim}
        >
          {leftLabel}
        </text>
      ) : null}
      {rightLabel ? (
        <text
          x={width}
          y={height + 26}
          textAnchor="end"
          fontFamily={FONT_TEXT}
          fontSize={11}
          fill={C.inkDim}
        >
          {rightLabel}
        </text>
      ) : null}
    </svg>
  );
};

export const linspace = (a: number, b: number, n: number): number[] => {
  if (n <= 1) return [a];
  const step = (b - a) / (n - 1);
  return Array.from({ length: n }, (_, i) => a + step * i);
};
