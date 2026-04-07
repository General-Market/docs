import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { THEME, DUR, LAYOUT } from "./theme";
import { Grid, type CellStyle } from "./components/Grid";
import { Caption } from "./components/Caption";
import { GridLabel } from "./components/GridLabel";

// Deterministic pseudo-random seeded by cell position.
const hash = (r: number, c: number, seed: number) => {
  const x = Math.sin(r * 12.9898 + c * 78.233 + seed * 43.758) * 43758.5453;
  return x - Math.floor(x);
};

// Reveal stagger: each cell turns on at a frame derived from its position.
const cellAppear = (
  frame: number,
  r: number,
  c: number,
  rows: number,
  cols: number,
  startFrame: number,
  totalDuration: number,
) => {
  const total = rows * cols;
  const index = r * cols + c;
  const cellStart = startFrame + (index / total) * totalDuration;
  return interpolate(frame, [cellStart, cellStart + 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
};

export const Scene01Liquidity: React.FC = () => {
  const frame = useCurrentFrame();

  const rows = LAYOUT.gridRows;
  const cols = LAYOUT.gridCols;

  const renderOthers = (r: number, c: number): CellStyle => {
    const appear = cellAppear(frame, r, c, rows, cols, 6, 36);
    const isFilled = hash(r, c, 1) < 0.5;
    return {
      bg: isFilled ? THEME.green : THEME.grey,
      opacity: appear,
    };
  };

  const renderGM = (r: number, c: number): CellStyle => {
    const appear = cellAppear(frame, r, c, rows, cols, 6, 36);
    return {
      bg: THEME.green,
      opacity: appear,
      glow: appear > 0.8 ? `0 0 12px ${THEME.greenGlow}` : "none",
    };
  };

  return (
    <AbsoluteFill
      style={{
        backgroundColor: THEME.bg,
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-evenly",
        paddingTop: 180,
      }}
    >
      <GridStack label="OTHERS" accent={false}>
        <Grid
          rows={rows}
          cols={cols}
          width={LAYOUT.gridW}
          height={LAYOUT.gridH}
          gap={LAYOUT.gridGap}
          renderCell={renderOthers}
        />
      </GridStack>

      <GridStack label="GENERAL MARKET" accent>
        <Grid
          rows={rows}
          cols={cols}
          width={LAYOUT.gridW}
          height={LAYOUT.gridH}
          gap={LAYOUT.gridGap}
          renderCell={renderGM}
        />
      </GridStack>

      <Caption
        headline="Always liquid."
        subtitle="Because it's parimutuel."
        startFrame={58}
        position="top"
        exitFrame={DUR.beat1 - 2}
      />
    </AbsoluteFill>
  );
};

const GridStack: React.FC<{
  label: string;
  accent: boolean;
  children: React.ReactNode;
}> = ({ label, accent, children }) => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 28,
    }}
  >
    {children}
    <GridLabel text={label} accent={accent} />
  </div>
);

export const scene01LiquidityMeta = {
  id: "GM-Scene01Liquidity",
  component: Scene01Liquidity,
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: DUR.beat1,
};
