import React from "react";
import {
  AbsoluteFill,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { THEME, DUR, LAYOUT } from "./theme";
import { Grid, type CellStyle } from "./components/Grid";
import { Caption } from "./components/Caption";
import { GridLabel } from "./components/GridLabel";
import { Coin } from "./components/Coin";
import { Bracket } from "./components/Bracket";

const hash = (r: number, c: number, seed: number) => {
  const x = Math.sin(r * 12.9898 + c * 78.233 + seed * 43.758) * 43758.5453;
  return x - Math.floor(x);
};

export const Scene02ProfitableSize: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const rows = LAYOUT.gridRows;
  const cols = LAYOUT.gridCols;

  // Grids carry over from Scene01 — already in "full" state.
  const renderOthers = (r: number, c: number): CellStyle => {
    const isFilled = hash(r, c, 1) < 0.5;
    return {
      bg: isFilled ? THEME.green : THEME.grey,
      opacity: 1,
    };
  };

  const renderGM = (): CellStyle => ({
    bg: THEME.green,
    opacity: 1,
  });

  // Coin drop: spring from top above each grid
  const coinDropY = spring({
    frame: frame - 10,
    fps,
    from: -120,
    to: 0,
    config: { damping: 10, mass: 0.5, stiffness: 120 },
  });

  // Bracket grow: spring out from 0 to full width
  const bracketProgress = spring({
    frame: frame - 28,
    fps,
    from: 0,
    to: 1,
    config: { damping: 12, mass: 0.8, stiffness: 100 },
  });

  // Cell size in the grid for computing "one-cell" bracket width
  const cellW = (LAYOUT.gridW - LAYOUT.gridGap * (cols - 1)) / cols;

  // OTHERS bracket: single cell wide
  const othersBracketW = cellW + 10;
  // GM bracket: full grid wide
  const gmBracketW = LAYOUT.gridW;

  const BRACKET_H = 70;

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
      <GridPair
        label="OTHERS"
        accent={false}
        bracketW={othersBracketW * bracketProgress}
        bracketH={BRACKET_H}
        coinOffsetY={coinDropY}
        coinX={0}
      >
        <Grid
          rows={rows}
          cols={cols}
          width={LAYOUT.gridW}
          height={LAYOUT.gridH}
          gap={LAYOUT.gridGap}
          renderCell={renderOthers}
        />
      </GridPair>

      <GridPair
        label="GENERAL MARKET"
        accent
        bracketW={gmBracketW * bracketProgress}
        bracketH={BRACKET_H}
        coinOffsetY={coinDropY}
        coinX={0}
        bracketColor={THEME.green}
      >
        <Grid
          rows={rows}
          cols={cols}
          width={LAYOUT.gridW}
          height={LAYOUT.gridH}
          gap={LAYOUT.gridGap}
          renderCell={renderGM}
        />
      </GridPair>

      <Caption
        headline="$1 covers every market."
        subtitle="Because it's parimutuel."
        startFrame={60}
        position="top"
        exitFrame={DUR.beat2 - 2}
      />
    </AbsoluteFill>
  );
};

// Wrap each grid with the bracket below it and the coin below the bracket.
const GridPair: React.FC<{
  label: string;
  accent: boolean;
  bracketW: number;
  bracketH: number;
  coinOffsetY: number;
  coinX: number;
  bracketColor?: string;
  children: React.ReactNode;
}> = ({
  label,
  accent,
  bracketW,
  bracketH,
  coinOffsetY,
  bracketColor = THEME.text,
  children,
}) => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 14,
      position: "relative",
    }}
  >
    {children}
    <div
      style={{
        position: "relative",
        width: LAYOUT.gridW,
        height: bracketH + 90,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <div
        style={{
          width: bracketW,
          height: bracketH,
          overflow: "visible",
        }}
      >
        <Bracket
          width={bracketW}
          height={bracketH}
          color={bracketColor}
          strokeWidth={4}
        />
      </div>
      <div
        style={{
          marginTop: 10,
          transform: `translateY(${coinOffsetY}px)`,
        }}
      >
        <Coin size={70} />
      </div>
    </div>
    <GridLabel text={label} accent={accent} />
  </div>
);

export const scene02ProfitableSizeMeta = {
  id: "GM-Scene02ProfitableSize",
  component: Scene02ProfitableSize,
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: DUR.beat2,
};
