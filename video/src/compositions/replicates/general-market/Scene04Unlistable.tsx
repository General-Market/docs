import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { THEME, DUR, LAYOUT, CATEGORIES } from "./theme";
import { Grid, type CellStyle } from "./components/Grid";
import { Caption } from "./components/Caption";
import { GridLabel } from "./components/GridLabel";

const hash = (r: number, c: number, seed: number) => {
  const x = Math.sin(r * 12.9898 + c * 78.233 + seed * 43.758) * 43758.5453;
  return x - Math.floor(x);
};

// Mix between two hex colors
const mixColor = (a: string, b: string, t: number): string => {
  const ta = Math.max(0, Math.min(1, t));
  const parse = (hex: string) => {
    const h = hex.replace("#", "");
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  };
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  const r = Math.round(ar + (br - ar) * ta);
  const g = Math.round(ag + (bg - ag) * ta);
  const bl = Math.round(ab + (bb - ab) * ta);
  return `rgb(${r}, ${g}, ${bl})`;
};

// OTHERS gets 3 categories across vertical strips.
// cols 0-2 → politics, 3-6 → sports, 7-9 → econ
const othersCategory = (c: number): number => {
  if (c <= 2) return 0; // politics
  if (c <= 6) return 1; // sports
  return 2; // econ
};

// GM gets 14 categories spread across diagonal waves.
const gmCategory = (r: number, c: number): number => {
  const wave = r + c;
  const maxWave =
    LAYOUT.gridRowsExpanded + LAYOUT.gridColsExpanded - 2;
  const bucket = Math.floor((wave / maxWave) * CATEGORIES.length);
  return Math.min(CATEGORIES.length - 1, bucket);
};

// Frame at which a given category reveals.
const othersRevealFrame = (cat: number) => 10 + cat * 14;
const gmRevealFrame = (cat: number) => 14 + cat * 7;

export const Scene04Unlistable: React.FC = () => {
  const frame = useCurrentFrame();

  const renderOthers = (r: number, c: number): CellStyle => {
    const wasFilled = hash(r, c, 1) < 0.5;
    if (!wasFilled) {
      return { bg: THEME.grey, opacity: 1 };
    }
    const cat = othersCategory(c);
    const reveal = othersRevealFrame(cat);
    const t = interpolate(frame, [reveal, reveal + 8], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    return {
      bg: mixColor(THEME.green, CATEGORIES[cat].color, t),
      opacity: 1,
    };
  };

  const renderGM = (r: number, c: number): CellStyle => {
    const cat = gmCategory(r, c);
    const reveal = gmRevealFrame(cat);
    const t = interpolate(frame, [reveal, reveal + 10], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    return {
      bg: mixColor(THEME.green, CATEGORIES[cat].color, t),
      opacity: 1,
    };
  };

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
      </div>

      <Caption
        headline="Most venues can't list these."
        subtitle="Because it's batched parimutuel."
        startFrame={80}
        position="top"
        exitFrame={DUR.beat4 - 2}
      />
    </AbsoluteFill>
  );
};

export const scene04UnlistableMeta = {
  id: "GM-Scene04Unlistable",
  component: Scene04Unlistable,
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: DUR.beat4,
};
