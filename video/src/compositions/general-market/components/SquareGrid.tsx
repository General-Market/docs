// Pure-CSS replacement for GMGrid. Squares inside squares, neumorphic dark.
// Matches the texture vocabulary of NeonSwitch: inset shadows, flat dark
// bases, no gloss. Staggered activation ordered by seeded RNG, pulse on the
// inner square only. No Three.js. No WebGL. No regrets.

import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";

export interface SquareGridProps {
  cols: number;
  rows: number;
  fillRatio: number; // 0..1 — target fraction of cells that will become active
  activeColor: string; // inner square color when active
  inactiveColor: string; // inner square color when inactive
  pulseFreq?: number; // Hz, 0 disables
  pulseAmplitude?: number; // 0..1, default 0.15
  categoryIndex?: number; // 0..13 — overrides activeColor with an HSL sweep
  width: number; // overall grid width in px
  height: number; // overall grid height in px
  seed?: number;
  startFrame?: number; // when the fill animation begins
  fillDurationFrames?: number; // duration of the full activation sweep
}

interface CellData {
  col: number;
  row: number;
  active: boolean;
  order: number; // activation order (0..cols*rows-1) when active
  phase: number; // per-cell pulse phase offset
}

// Mulberry32 — same tiny deterministic PRNG used by the old hex grid.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildCells(
  cols: number,
  rows: number,
  fillRatio: number,
  seed: number,
): CellData[] {
  const total = cols * rows;
  const activeCount = Math.round(Math.max(0, Math.min(1, fillRatio)) * total);

  // Seeded shuffle of all indices — the first `activeCount` become "active".
  // The activation order reuses the same shuffled sequence so cells appear
  // in random order, not row-by-row.
  const rng = mulberry32(seed);
  const indices = Array.from({ length: total }, (_, i) => i);
  for (let i = total - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = indices[i];
    indices[i] = indices[j];
    indices[j] = tmp;
  }

  const activeSet = new Set<number>();
  const activationOrder = new Map<number, number>();
  for (let k = 0; k < activeCount; k++) {
    activeSet.add(indices[k]);
    activationOrder.set(indices[k], k);
  }

  const phaseRng = mulberry32(seed + 17);
  const cells: CellData[] = [];
  for (let i = 0; i < total; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    cells.push({
      col,
      row,
      active: activeSet.has(i),
      order: activationOrder.get(i) ?? 0,
      phase: (phaseRng() - 0.5) * 2 * Math.PI,
    });
  }
  return cells;
}

interface SquareCellProps {
  cell: CellData;
  cellWidth: number;
  cellHeight: number;
  gap: number;
  activeColor: string;
  inactiveColor: string;
  revealT: number; // 0..1 — how far along this cell is in its activation
  time: number;
  pulseFreq: number;
  pulseAmplitude: number;
  categoryIndex?: number;
  cols: number;
}

const SquareCell: React.FC<SquareCellProps> = ({
  cell,
  cellWidth,
  cellHeight,
  gap,
  activeColor,
  inactiveColor,
  revealT,
  time,
  pulseFreq,
  pulseAmplitude,
  categoryIndex,
  cols,
}) => {
  const size = Math.min(cellWidth, cellHeight) - gap;
  const left = cell.col * cellWidth + gap / 2;
  const top = cell.row * cellHeight + gap / 2;

  // Active, but still mid-reveal: fade the inner square in instead of popping.
  const isActiveNow = cell.active && revealT > 0;

  const resolvedActive = (() => {
    if (categoryIndex === undefined) return activeColor;
    const hue = ((categoryIndex * 360) / 14 + cell.col * 12) % 360;
    return `hsl(${Math.round(hue)}, 70%, 55%)`;
  })();

  const innerColor = isActiveNow ? resolvedActive : inactiveColor;

  // Pulse on the inner square only, in scale space. Static outer frame.
  const pulse =
    isActiveNow && pulseFreq > 0
      ? 1 +
        Math.sin(cell.phase + time * pulseFreq * 2 * Math.PI) * pulseAmplitude
      : 1;

  const innerSize = size * 0.5;
  const innerOffset = size * 0.25;

  const outerBgBase = "#2a2a2e";
  const innerBgInactive = "#1a1a1e";

  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        width: size,
        height: size,
        borderRadius: 8,
        background: outerBgBase,
        boxShadow: [
          "inset 4px 4px 8px rgba(0,0,0,0.6)",
          "inset -4px -4px 8px rgba(255,255,255,0.03)",
          "2px 2px 4px rgba(0,0,0,0.4)",
          "-1px -1px 2px rgba(255,255,255,0.02)",
        ].join(", "),
      }}
    >
      <div
        style={{
          position: "absolute",
          left: innerOffset,
          top: innerOffset,
          width: innerSize,
          height: innerSize,
          borderRadius: 4,
          background: isActiveNow ? innerColor : innerBgInactive,
          boxShadow: isActiveNow
            ? `0 0 12px ${resolvedActive}80, inset 0 0 8px rgba(255,255,255,0.15)`
            : "inset 2px 2px 4px rgba(0,0,0,0.5), inset -1px -1px 2px rgba(255,255,255,0.02)",
          transform: `scale(${pulse})`,
          transformOrigin: "center",
          opacity: cell.active ? revealT : 1,
          transition: "none",
        }}
      />
    </div>
  );
};

export const SquareGrid: React.FC<SquareGridProps> = ({
  cols,
  rows,
  fillRatio,
  activeColor,
  inactiveColor,
  pulseFreq = 0,
  pulseAmplitude = 0.15,
  categoryIndex,
  width,
  height,
  seed = 1,
  startFrame = 0,
  fillDurationFrames = 30,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const time = frame / fps;

  const cells = useMemo(
    () => buildCells(cols, rows, fillRatio, seed),
    [cols, rows, fillRatio, seed],
  );

  const cellWidth = width / cols;
  const cellHeight = height / rows;
  const gap = Math.max(4, Math.min(cellWidth, cellHeight) * 0.08);

  // Stagger window: how long each cell takes to "open" after its turn starts.
  const total = cols * rows;
  const activeCount = cells.filter((c) => c.active).length || 1;
  const perCellDelay = fillDurationFrames / activeCount;
  const perCellOpen = Math.max(4, perCellDelay * 2);

  return (
    <div
      style={{
        position: "relative",
        width,
        height,
        background: "#1a1a1e",
        borderRadius: 16,
        boxShadow: [
          "inset 6px 6px 16px rgba(0,0,0,0.7)",
          "inset -6px -6px 16px rgba(255,255,255,0.02)",
        ].join(", "),
        padding: 0,
        overflow: "hidden",
      }}
    >
      {cells.map((cell, i) => {
        const cellStart = startFrame + cell.order * perCellDelay;
        const rawT = (frame - cellStart) / perCellOpen;
        const revealT = Math.max(0, Math.min(1, rawT));
        return (
          <SquareCell
            key={i}
            cell={cell}
            cellWidth={cellWidth}
            cellHeight={cellHeight}
            gap={gap}
            activeColor={activeColor}
            inactiveColor={inactiveColor}
            revealT={revealT}
            time={time}
            pulseFreq={pulseFreq}
            pulseAmplitude={pulseAmplitude}
            categoryIndex={categoryIndex}
            cols={cols}
          />
        );
      })}
      {/* unused var silencer */}
      <div style={{ display: "none" }}>{total}</div>
    </div>
  );
};
