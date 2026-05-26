import React from "react";
import { C, font, monoFont } from "./theme";
import type { Protocol } from "./data";

type Props = {
  p: Protocol;
  progress: number; // 0..1 reveal
  x: number;
  y: number;
  w: number;
  h: number;
};

// A real DefiLlama TVL series, drawn as a falling area chart: blue on the climb
// to the peak, red on the collapse. Reveals left→right; a dot rides the front.
export const TvlChart: React.FC<Props> = ({ p, progress, x, y, w, h }) => {
  const s = p.spark;
  const n = s.length;
  const maxV = Math.max(...s, 1);
  const base = y + h;
  const head = h * 0.9; // vertical headroom

  const px = (i: number) => x + (i / (n - 1)) * w;
  const py = (v: number) => base - (v / maxV) * head;

  const pts = s.map((v, i) => ({ x: px(i), y: py(v) }));

  const linePath = (a: number, b: number) => {
    let d = "";
    for (let i = a; i <= b; i++) d += `${i === a ? "M" : "L"}${pts[i].x.toFixed(1)},${pts[i].y.toFixed(1)} `;
    return d;
  };
  const peakIdx = Math.min(p.peakIdx, n - 1);
  const areaPath =
    `M${pts[0].x.toFixed(1)},${base.toFixed(1)} ` +
    pts.map((pt) => `L${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(" ") +
    ` L${pts[n - 1].x.toFixed(1)},${base.toFixed(1)} Z`;

  // Reveal frontier
  const revW = Math.max(0, w * progress);
  const frontierI = Math.min(n - 1, progress * (n - 1));
  const fi0 = Math.floor(frontierI);
  const fi1 = Math.min(n - 1, fi0 + 1);
  const ft = frontierI - fi0;
  const front = {
    x: pts[fi0].x + (pts[fi1].x - pts[fi0].x) * ft,
    y: pts[fi0].y + (pts[fi1].y - pts[fi0].y) * ft,
  };
  const pastPeak = progress * (n - 1) >= peakIdx;
  const frontColor = pastPeak ? C.down : C.blue;

  const uid = p.id.replace(/[^a-z0-9]/gi, "");
  const peakShown = progress * (n - 1) >= peakIdx + 1;
  const endShown = progress > 0.985;

  return (
    <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <defs>
        <linearGradient id={`area-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(0,113,227,0.30)" />
          <stop offset="55%" stopColor="rgba(110,91,255,0.16)" />
          <stop offset="100%" stopColor="rgba(242,86,107,0.06)" />
        </linearGradient>
        <clipPath id={`rev-${uid}`}>
          <rect x={x} y={y - 60} width={revW} height={h + 120} />
        </clipPath>
        <filter id={`glow-${uid}`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>

      {/* baseline */}
      <line x1={x} y1={base} x2={x + w} y2={base} stroke={C.rule} strokeWidth={1.5} />

      <g clipPath={`url(#rev-${uid})`}>
        <path d={areaPath} fill={`url(#area-${uid})`} />
        {/* rise (blue) then fall (red) */}
        <path d={linePath(0, peakIdx)} fill="none" stroke={C.blue} strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" />
        <path d={linePath(peakIdx, n - 1)} fill="none" stroke={C.down} strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" />
      </g>

      {/* peak marker */}
      {peakShown && (
        <g opacity={Math.min(1, (progress * (n - 1) - peakIdx) / 4)}>
          <line x1={pts[peakIdx].x} y1={pts[peakIdx].y} x2={pts[peakIdx].x} y2={base} stroke={C.blue} strokeWidth={1} strokeDasharray="3 5" opacity={0.5} />
          <circle cx={pts[peakIdx].x} cy={pts[peakIdx].y} r={6} fill={C.blue} />
          <text x={pts[peakIdx].x} y={pts[peakIdx].y - 26} textAnchor="middle" fontFamily={font} fontSize={40} fontWeight={800} letterSpacing="-0.02em" fill={C.text}>
            {p.peakLabel}
          </text>
          <text x={pts[peakIdx].x} y={pts[peakIdx].y - 2} textAnchor="middle" fontFamily={monoFont} fontSize={17} fontWeight={600} fill={C.faint}>
            PEAK · {p.peakWhen.toUpperCase()}
          </text>
        </g>
      )}

      {/* moving frontier dot */}
      {progress > 0.001 && progress < 0.999 && (
        <>
          <circle cx={front.x} cy={front.y} r={12} fill={frontColor} opacity={0.28} filter={`url(#glow-${uid})`} />
          <circle cx={front.x} cy={front.y} r={6} fill={frontColor} />
        </>
      )}

      {/* end marker + drawdown */}
      {endShown && (
        <g>
          <circle cx={pts[n - 1].x} cy={pts[n - 1].y} r={6} fill={C.downDeep} />
          <text x={pts[n - 1].x - 14} y={pts[n - 1].y - 14} textAnchor="end" fontFamily={font} fontSize={26} fontWeight={700} fill={C.dim}>
            {p.latestLabel} now
          </text>
        </g>
      )}
    </svg>
  );
};
