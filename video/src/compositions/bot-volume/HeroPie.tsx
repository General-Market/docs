import React from "react";
import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { ACCENT, SANS, SANS_TEXT } from "../article-2/theme";

const R = 230;
const CX = 280;
const CY = 280;
const GREY = "rgba(255,255,255,0.16)";

// point on the circle; 0° = top, clockwise
const pt = (deg: number) => {
  const rad = (deg * Math.PI) / 180;
  return [CX + R * Math.sin(rad), CY - R * Math.cos(rad)] as const;
};

const wedge = (a0: number, a1: number) => {
  const [x0, y0] = pt(a0);
  const [x1, y1] = pt(a1);
  const largeArc = a1 - a0 > 180 ? 1 : 0;
  return `M ${CX} ${CY} L ${x0} ${y0} A ${R} ${R} 0 ${largeArc} 1 ${x1} ${y1} Z`;
};

export const HeroPie: React.FC<{ pct: number; blueLabel: string; greyLabel: string }> = ({
  pct,
  blueLabel,
  greyLabel,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Negative input start: the wedge is already partway swept and still moving
  // on frame 0, so the chart opens in motion rather than on a still ring.
  const sweep = interpolate(frame, [-10, 38], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const angle = sweep * (pct / 100) * 360;

  const badgePop = spring({ fps, frame: frame - 22, config: { mass: 0.6, damping: 12 } });
  const shown = Math.round(sweep * pct);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg width={CX * 2} height={CY * 2} viewBox={`0 0 ${CX * 2} ${CY * 2}`}>
        {/* grey base ring */}
        <circle cx={CX} cy={CY} r={R} fill={GREY} />
        {/* blue wedge sweeping in */}
        {angle > 0.2 && (
          <path d={wedge(0, angle)} fill={ACCENT} style={{ filter: "drop-shadow(0 0 22px rgba(10,132,255,0.45))" }} />
        )}
        {/* white center badge */}
        <circle cx={CX} cy={CY} r={R * 0.5 * badgePop} fill="#fff" />
        <text
          x={CX}
          y={CY + 26}
          textAnchor="middle"
          fontFamily={SANS}
          fontWeight={800}
          fontSize={96}
          letterSpacing="-3px"
          fill="#0E1116"
          opacity={badgePop}
        >
          {shown}%
        </text>
      </svg>

      {/* legend */}
      <div style={{ display: "flex", gap: 40, marginTop: 36 }}>
        {[
          { c: ACCENT, label: blueLabel, v: pct },
          { c: GREY, label: greyLabel, v: 100 - pct },
        ].map((row) => (
          <div key={row.label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ width: 22, height: 22, borderRadius: 6, background: row.c }} />
            <span style={{ fontFamily: SANS_TEXT, fontSize: 32, color: "rgba(255,255,255,0.82)" }}>
              {row.label} · {row.v}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
