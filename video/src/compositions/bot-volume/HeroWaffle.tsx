import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { ACCENT, SANS } from "../article-2/theme";

const COLS = 20;
const CELL = 58;
const ICON_W = 38;
const ICON_H = 46;
const GREY = "rgba(255,255,255,0.16)";

/** Simple person glyph — head + shoulders. */
const Person: React.FC<{ color: string }> = ({ color }) => (
  <svg width={ICON_W} height={ICON_H} viewBox="0 0 38 46">
    <circle cx={19} cy={13} r={10} fill={color} />
    <path d="M3 46 C3 31 11 26 19 26 C27 26 35 31 35 46 Z" fill={color} />
  </svg>
);

export const HeroWaffle: React.FC<{ filled: number; total: number }> = ({ filled, total }) => {
  const frame = useCurrentFrame();
  const rows = Math.ceil(total / COLS);
  // Negative input start: a block of cells is already lit and more keep filling
  // on frame 0, so the waffle opens mid-count instead of empty.
  const shown = Math.round(
    interpolate(frame, [-12, 44], [0, filled], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 30 }}>
        <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: 150, lineHeight: 1, letterSpacing: "-5px", color: "#fff" }}>
          {shown}
        </span>
        <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 56, color: "rgba(255,255,255,0.55)" }}>
          / {total}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${COLS}, ${CELL}px)`,
          gridAutoRows: `${CELL}px`,
          placeItems: "center",
          padding: 28,
          borderRadius: 26,
          border: "1px solid rgba(255,255,255,0.16)",
          background: "rgba(255,255,255,0.03)",
        }}
      >
        {Array.from({ length: rows * COLS }).map((_, i) => {
          if (i >= total) return <span key={i} />;
          const isBlue = i < filled;
          // staggered reveal of the blue cells, in reading order
          const lit = isBlue && i < shown;
          const op = isBlue ? (lit ? 1 : 0.12) : 1;
          return (
            <span key={i} style={{ opacity: op, transition: "none" }}>
              <Person color={isBlue ? ACCENT : GREY} />
            </span>
          );
        })}
      </div>
    </div>
  );
};
