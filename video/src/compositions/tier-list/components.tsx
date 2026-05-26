// Reusable wrappers. Every logo on screen — pooled in the tray, mid-flight, or
// placed in a row — renders through <LogoTile>. Change the tile here and the
// whole board changes with it.

import React from "react";
import { Img, staticFile } from "remotion";
import type { TierSource } from "./data";
import { INK, LAYOUT, TILE_BG } from "./config";
import { SANS, SANS_TEXT } from "../article-2/theme";

/** A single source logo on a rounded tile, centred at (x, y) in world space. */
export const LogoTile: React.FC<{
  src: TierSource;
  size: number;
  x: number;
  y: number;
  lift?: number; // 0 resting, 1 fully raised (in flight / just grabbed)
  radius?: number;
  z?: number;
}> = ({ src, size, x, y, lift = 0, radius = LAYOUT.tile.radius, z = 0 }) => {
  const scale = 1 + lift * 0.16;
  const shadow =
    lift > 0.001
      ? `0 ${10 + lift * 26}px ${20 + lift * 34}px rgba(0,0,0,${0.28 + lift * 0.34})`
      : "0 2px 6px rgba(0,0,0,0.30)";
  return (
    <div
      style={{
        position: "absolute",
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        borderRadius: radius,
        background: TILE_BG,
        boxShadow: shadow,
        transform: `scale(${scale})`,
        zIndex: z,
        overflow: "hidden",
        border: "1px solid rgba(0,0,0,0.06)",
      }}
    >
      <Img
        src={staticFile(src.logo)}
        style={{ width: "100%", height: "100%", objectFit: "contain", padding: size * 0.12 }}
      />
    </div>
  );
};

/** Glass card that flashes the source name + what we trade beside a dropped logo. */
export const DescriptionChip: React.FC<{
  src: TierSource;
  x: number;
  y: number;
  opacity: number;
  rise: number;
  tierColor: string;
}> = ({ src, x, y, opacity, rise, tierColor }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      transform: `translate(-50%, ${-rise}px)`,
      opacity,
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "12px 18px",
      borderRadius: 16,
      background: "rgba(16,18,24,0.82)",
      backdropFilter: "saturate(180%) blur(20px)",
      WebkitBackdropFilter: "saturate(180%) blur(20px)",
      border: "1px solid rgba(255,255,255,0.12)",
      boxShadow: "0 18px 50px rgba(0,0,0,0.5)",
      whiteSpace: "nowrap",
      pointerEvents: "none",
      zIndex: 8800,
    }}
  >
    <div style={{ width: 10, height: 10, borderRadius: 5, background: tierColor, flexShrink: 0 }} />
    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 26, color: INK, letterSpacing: "-0.3px" }}>
        {src.name}
      </div>
      <div style={{ fontFamily: SANS_TEXT, fontWeight: 500, fontSize: 19, color: "rgba(255,255,255,0.62)" }}>
        {src.blurb}
      </div>
    </div>
  </div>
);

/** Classic OS pointer, tip anchored at (x, y). */
export const Cursor: React.FC<{ x: number; y: number; press: number }> = ({ x, y, press }) => {
  const s = 1 - press * 0.14;
  return (
    <svg
      width={34}
      height={50}
      viewBox="0 0 24 36"
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `scale(${s})`,
        transformOrigin: "0 0",
        filter: "drop-shadow(0 5px 9px rgba(0,0,0,0.55))",
        zIndex: 9000,
      }}
    >
      <path
        d="M2 2 L2 27 L8.5 21 L13 31.5 L17 29.5 L12.5 19 L21 19 Z"
        fill="#fff"
        stroke="#0b0b0c"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
    </svg>
  );
};
