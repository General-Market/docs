// dBFS peak meter. 4 px vertical strip. One color at a time.
// The meter is not a decoration; it is the audible truth, visualized.

import { useMemo } from "react";

type Props = {
  peakDb: number;
  minDb?: number;
};

const DEFAULT_MIN_DB = -60;

function readVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v.length > 0 ? v : fallback;
}

function colorFor(peakDb: number): "green" | "amber" | "red" {
  if (peakDb >= -1) return "red";
  if (peakDb >= -6) return "amber";
  return "green";
}

export function Meter({ peakDb, minDb = DEFAULT_MIN_DB }: Props) {
  const palette = useMemo(
    () => ({
      green: readVar("--green", "#6EE4A4"),
      amber: readVar("--accent-warm", "#E8A24B"),
      red: readVar("--red", "#E8657A"),
      track: readVar("--track", "#1C1F25"),
      divider: readVar("--divider", "#2A2E36"),
    }),
    []
  );

  const clamped = Math.max(minDb, Math.min(0, peakDb));
  const pct = (clamped - minDb) / (0 - minDb); // 0..1
  const fillHeight = `${Math.round(pct * 100)}%`;
  const color = palette[colorFor(clamped)];

  return (
    <div
      role="meter"
      aria-valuemin={minDb}
      aria-valuemax={0}
      aria-valuenow={Math.round(clamped)}
      style={{
        position: "relative",
        width: 4,
        height: "100%",
        minHeight: 24,
        background: palette.track,
        borderTop: `1px solid ${palette.divider}`,
        borderBottom: `1px solid ${palette.divider}`,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: fillHeight,
          background: color,
          transition: "height 60ms linear, background-color 60ms linear",
          willChange: "height",
        }}
      />
    </div>
  );
}
