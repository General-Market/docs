import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { THEME, DUR, LAYOUT, CATEGORIES } from "./theme";
import { Grid, type CellStyle } from "./components/Grid";
import { Caption } from "./components/Caption";
import { GridLabel } from "./components/GridLabel";
import {
  hash,
  brighten,
  othersCategory,
  gmCategory,
} from "./components/helpers";

const { fontFamily: inter } = loadInter();

export const Scene05Settlement: React.FC = () => {
  const frame = useCurrentFrame();

  // OTHERS pulse: slow, every 75 frames (≈ 1 pulse per 2.5s)
  const othersPulsePeriod = 75;
  const othersPulsePhase =
    (frame % othersPulsePeriod) / othersPulsePeriod;
  const othersBrightness = Math.max(
    0,
    Math.sin(othersPulsePhase * Math.PI) * 0.5,
  );

  // GM flicker: rapid, every ~3 frames, staggered per cell
  const gmCellBrightness = (r: number, c: number) => {
    const offset = (r * 7 + c * 3) % 12;
    const t = (frame + offset) / 3;
    const phase = (t % 2) / 2;
    return Math.max(0, Math.sin(phase * Math.PI) * 0.65);
  };

  const renderOthers = (r: number, c: number): CellStyle => {
    const wasFilled = hash(r, c, 1) < 0.5;
    if (!wasFilled) {
      return { bg: THEME.grey, opacity: 1 };
    }
    const cat = othersCategory(c);
    const baseColor = CATEGORIES[cat].color;
    return {
      bg: brighten(baseColor, othersBrightness),
      opacity: 1,
    };
  };

  const renderGM = (r: number, c: number): CellStyle => {
    const cat = gmCategory(r, c);
    const baseColor = CATEGORIES[cat].color;
    return {
      bg: brighten(baseColor, gmCellBrightness(r, c)),
      opacity: 1,
    };
  };

  // GM counter ramps from 0 toward 144+, holds at "144 / day"
  const gmCountValue = Math.min(
    144,
    Math.floor(
      interpolate(frame, [10, 80], [0, 144], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }),
    ),
  );

  // OTHERS counter stays at 1, fades in
  const othersCounterOpacity = interpolate(frame, [5, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const gmCounterOpacity = interpolate(frame, [5, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
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
        <Counter
          value="1"
          unit="/ week"
          accent={false}
          opacity={othersCounterOpacity}
        />
      </div>

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
          rows={LAYOUT.gridRowsExpanded}
          cols={LAYOUT.gridColsExpanded}
          width={LAYOUT.gridWExpanded}
          height={LAYOUT.gridHExpanded}
          gap={LAYOUT.gridGapExpanded}
          renderCell={renderGM}
        />
        <GridLabel text="GENERAL MARKET" accent />
        <Counter
          value={String(gmCountValue)}
          unit="/ day"
          accent
          opacity={gmCounterOpacity}
        />
      </div>

      <Caption
        headline="30× faster to settle."
        subtitle="Because it's parimutuel."
        startFrame={50}
        position="top"
        exitFrame={DUR.beat5 - 2}
      />
    </AbsoluteFill>
  );
};

const Counter: React.FC<{
  value: string;
  unit: string;
  accent: boolean;
  opacity: number;
}> = ({ value, unit, accent, opacity }) => (
  <div
    style={{
      display: "flex",
      alignItems: "baseline",
      gap: 12,
      fontFamily: inter,
      opacity,
    }}
  >
    <div
      style={{
        fontSize: 56,
        fontWeight: 700,
        color: accent ? THEME.green : THEME.text,
        letterSpacing: -1.5,
        lineHeight: 1,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {value}
    </div>
    <div
      style={{
        fontSize: 22,
        fontWeight: 500,
        color: THEME.textMuted,
        letterSpacing: 1.5,
        textTransform: "uppercase",
      }}
    >
      {unit}
    </div>
  </div>
);

export const scene05SettlementMeta = {
  id: "GM-Scene05Settlement",
  component: Scene05Settlement,
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: DUR.beat5,
};
