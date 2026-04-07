import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  Easing,
} from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { THEME, DUR, LAYOUT } from "./theme";
import { Grid, type CellStyle } from "./components/Grid";
import { Caption } from "./components/Caption";
import { GridLabel } from "./components/GridLabel";

const { fontFamily: inter } = loadInter();

const hash = (r: number, c: number, seed: number) => {
  const x = Math.sin(r * 12.9898 + c * 78.233 + seed * 43.758) * 43758.5453;
  return x - Math.floor(x);
};

export const Scene03Markets: React.FC = () => {
  const frame = useCurrentFrame();

  // Animate GM grid expansion from small (10x8) to huge (32x22)
  const expandProgress = interpolate(frame, [8, 85], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });

  const gmCols = Math.round(
    interpolate(
      expandProgress,
      [0, 1],
      [LAYOUT.gridCols, LAYOUT.gridColsExpanded],
    ),
  );
  const gmRows = Math.round(
    interpolate(
      expandProgress,
      [0, 1],
      [LAYOUT.gridRows, LAYOUT.gridRowsExpanded],
    ),
  );
  const gmW = interpolate(
    expandProgress,
    [0, 1],
    [LAYOUT.gridW, LAYOUT.gridWExpanded],
  );
  const gmH = interpolate(
    expandProgress,
    [0, 1],
    [LAYOUT.gridH, LAYOUT.gridHExpanded],
  );
  const gmGap = interpolate(
    expandProgress,
    [0, 1],
    [LAYOUT.gridGap, LAYOUT.gridGapExpanded],
  );

  // Label "300,000" appears as grid reaches full size
  const labelFadeIn = interpolate(frame, [85, 100], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Counter ramps up to 300,000 over frames 85-115
  const countValue = Math.floor(
    interpolate(frame, [85, 125], [0, 300000], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    }),
  );
  const displayCount = countValue.toLocaleString("en-US");

  // Cells appear with a wave from the original region outward
  const cellAppear = (r: number, c: number): number => {
    // Cells in the original region (< gridRows × gridCols at start) are always fully visible
    const inOriginal = r < LAYOUT.gridRows && c < LAYOUT.gridCols;
    if (inOriginal) return 1;
    // Cells farther from origin fade in later based on distance
    const distance = Math.max(r - LAYOUT.gridRows, c - LAYOUT.gridCols, 0);
    const maxDistance =
      Math.max(LAYOUT.gridRowsExpanded, LAYOUT.gridColsExpanded) -
      Math.min(LAYOUT.gridRows, LAYOUT.gridCols);
    const wave = distance / maxDistance;
    const cellStart = 8 + wave * 70;
    return interpolate(frame, [cellStart, cellStart + 8], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  };

  const renderOthers = (r: number, c: number): CellStyle => {
    const isFilled = hash(r, c, 1) < 0.5;
    return {
      bg: isFilled ? THEME.green : THEME.grey,
      opacity: 1,
    };
  };

  const renderGM = (r: number, c: number): CellStyle => ({
    bg: THEME.green,
    opacity: cellAppear(r, c),
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: THEME.bg,
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 60,
        paddingTop: 180,
        paddingLeft: 80,
        paddingRight: 80,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 28,
          flexShrink: 0,
        }}
      >
        <Grid
          rows={LAYOUT.gridRows}
          cols={LAYOUT.gridCols}
          width={LAYOUT.gridW}
          height={LAYOUT.gridH}
          gap={LAYOUT.gridGap}
          renderCell={renderOthers}
        />
        <GridLabel text="OTHERS" accent={false} />
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 28,
          flexShrink: 0,
          position: "relative",
        }}
      >
        <Grid
          rows={gmRows}
          cols={gmCols}
          width={gmW}
          height={gmH}
          gap={gmGap}
          renderCell={renderGM}
        />
        <GridLabel text="GENERAL MARKET" accent />

        {/* 300,000 label pinned top-right of the GM grid */}
        <div
          style={{
            position: "absolute",
            top: -12,
            right: -24,
            transform: "translate(100%, 0)",
            opacity: labelFadeIn,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 4,
            fontFamily: inter,
          }}
        >
          <div
            style={{
              fontSize: 64,
              fontWeight: 700,
              color: THEME.green,
              lineHeight: 1,
              letterSpacing: -2,
            }}
          >
            {displayCount}
          </div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 500,
              color: THEME.textMuted,
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            markets
          </div>
        </div>
      </div>

      <Caption
        headline="Infinite markets. All liquid."
        subtitle="Because it's parimutuel."
        startFrame={68}
        position="top"
        exitFrame={DUR.beat3 - 2}
      />
    </AbsoluteFill>
  );
};

export const scene03MarketsMeta = {
  id: "GM-Scene03Markets",
  component: Scene03Markets,
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: DUR.beat3,
};
