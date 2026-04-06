import React from "react";
import { useCurrentFrame, interpolate } from "remotion";
import { noise2D } from "@remotion/noise";
import { generateLineData } from "./chartData";

interface Props {
  width: number;
  height: number;
  seed?: number;
  points?: number;
  revealStart?: number;
  revealEnd?: number;
  color?: string;
}

export const LineChartLive: React.FC<Props> = ({
  width,
  height,
  seed = 77,
  points = 80,
  revealStart = 30,
  revealEnd = 60,
  color = "#3B82F6",
}) => {
  const frame = useCurrentFrame();
  const data = React.useMemo(() => generateLineData(seed, points), [seed, points]);

  const padding = { top: 20, right: 10, bottom: 20, left: 45 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const minVal = Math.min(...data) * 0.98;
  const maxVal = Math.max(...data) * 1.02;
  const range = maxVal - minVal;

  const xScale = (i: number) => padding.left + (i / (points - 1)) * chartW;
  const yScale = (v: number) => padding.top + chartH - ((v - minVal) / range) * chartH;

  // Live noise after reveal
  const liveData = data.map((v, i) => {
    if (frame <= revealEnd || i < points - 5) return v;
    return v + noise2D("line", frame * 0.05, i * 0.1) * range * 0.015;
  });

  // Build bezier path
  const pathPoints = liveData.map((v, i) => ({ x: xScale(i), y: yScale(v) }));
  let linePath = `M ${pathPoints[0].x} ${pathPoints[0].y}`;
  for (let i = 1; i < pathPoints.length; i++) {
    const prev = pathPoints[i - 1];
    const curr = pathPoints[i];
    const cpx = (prev.x + curr.x) / 2;
    linePath += ` C ${cpx} ${prev.y}, ${cpx} ${curr.y}, ${curr.x} ${curr.y}`;
  }

  // Area fill path
  const areaPath = `${linePath} L ${pathPoints[pathPoints.length - 1].x} ${padding.top + chartH} L ${pathPoints[0].x} ${padding.top + chartH} Z`;

  // Stroke dashoffset reveal
  const pathLength = chartW * 2;
  const dashOffset = interpolate(frame, [revealStart, revealEnd], [pathLength, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const opacity = interpolate(frame, [revealStart, revealStart + 5], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Pulsing dot at last point
  const lastPoint = pathPoints[pathPoints.length - 1];
  const dotScale =
    frame > revealEnd ? 1 + Math.sin(frame * 0.15) * 0.3 : 0;

  // Grid
  const gridCount = 4;

  return (
    <svg width={width} height={height} opacity={opacity}>
      <rect width={width} height={height} fill="#0d1117" rx={4} />

      {/* Grid */}
      {Array.from({ length: gridCount + 1 }, (_, i) => {
        const y = padding.top + (i / gridCount) * chartH;
        const val = maxVal - (i / gridCount) * range;
        return (
          <g key={i}>
            <line
              x1={padding.left}
              y1={y}
              x2={width - padding.right}
              y2={y}
              stroke="rgba(255,255,255,0.04)"
              strokeDasharray="3 3"
            />
            <text
              x={padding.left - 4}
              y={y + 4}
              fill="rgba(255,255,255,0.3)"
              fontSize={9}
              fontFamily="monospace"
              textAnchor="end"
            >
              {val.toFixed(1)}
            </text>
          </g>
        );
      })}

      <defs>
        <linearGradient id={`lineGrad-${seed}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
        <clipPath id={`lineClip-${seed}`}>
          <rect
            x={padding.left}
            y={padding.top}
            width={chartW * interpolate(frame, [revealStart, revealEnd], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
            height={chartH}
          />
        </clipPath>
      </defs>

      {/* Area fill */}
      <path
        d={areaPath}
        fill={`url(#lineGrad-${seed})`}
        clipPath={`url(#lineClip-${seed})`}
      />

      {/* Line */}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeDasharray={pathLength}
        strokeDashoffset={dashOffset}
      />

      {/* Pulsing dot */}
      {dotScale > 0 && (
        <>
          <circle cx={lastPoint.x} cy={lastPoint.y} r={6 * dotScale} fill={color} opacity={0.3} />
          <circle cx={lastPoint.x} cy={lastPoint.y} r={3} fill={color} />
        </>
      )}

      {/* Label */}
      <text
        x={padding.left + 4}
        y={padding.top - 6}
        fill="rgba(255,255,255,0.5)"
        fontSize={10}
        fontFamily="monospace"
      >
        PRICE · 15M
      </text>
    </svg>
  );
};
