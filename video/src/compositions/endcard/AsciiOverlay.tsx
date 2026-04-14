/**
 * AsciiOverlay — ASCII border that dynamically follows an animated rect.
 *
 * Takes a rect {x, y, w, h} prop — the center clean rectangle.
 * Renders 4 strips (top, bottom, left, right) around that rect.
 * Each strip contains only the ASCII characters for its region —
 * zero ASCII inside the center. Rounded corner fillers close the gap
 * between the rectangular strip cutout and the rounded center.
 */

import React, { useState, useEffect, useMemo } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { Rect } from "./layout";
import { CORNER_R } from "./layout";
import { W, H } from "./theme";

const FONT_SIZE = 10;
const CELL_W = 6;
const CELL_H = 10;
const COLS = Math.ceil(W / CELL_W);
const ROWS = Math.ceil(H / CELL_H);

const RAMP = " .·:;+*#%@";
const WASH = "rgba(255,255,255,0.62)";
const TEXT_COLOR = "#1a2030";
const DITHER_COLOR = "rgba(20,24,40,0.35)";

const stripBg: React.CSSProperties = {
  position: "absolute",
  background: WASH,
  overflow: "hidden",
};

const stripText: React.CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  fontFamily: '"Courier New", Courier, monospace',
  fontSize: FONT_SIZE,
  lineHeight: `${CELL_H}px`,
  letterSpacing: 0,
  color: TEXT_COLOR,
  whiteSpace: "pre",
  margin: 0,
  padding: 0,
  // Chromatic aberration — slight RGB split
  textShadow:
    "0.6px 0 0 rgba(220,40,60,0.25), -0.6px 0 0 rgba(40,160,240,0.25)",
};

const stripDither: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  backgroundImage: `radial-gradient(circle, ${DITHER_COLOR} 0.9px, transparent 0.9px)`,
  backgroundSize: "5px 5px",
  pointerEvents: "none",
};

/** CRT scanline overlay — dark horizontal lines every 3px */
const stripCrt: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  backgroundImage:
    "repeating-linear-gradient(to bottom, rgba(0,0,0,0.22) 0 1px, transparent 1px 3px)",
  mixBlendMode: "multiply",
  pointerEvents: "none",
};

/** Radial-gradient corner filler — transparent inside the rounded arc */
function cornerFill(
  rect: Rect,
  pos: "tl" | "tr" | "bl" | "br",
): React.CSSProperties {
  const origin =
    pos === "tl"
      ? "bottom right"
      : pos === "tr"
        ? "bottom left"
        : pos === "bl"
          ? "top right"
          : "top left";

  const left =
    pos === "tl" || pos === "bl" ? rect.x : rect.x + rect.w - CORNER_R;
  const top =
    pos === "tl" || pos === "tr" ? rect.y : rect.y + rect.h - CORNER_R;

  return {
    position: "absolute",
    left,
    top,
    width: CORNER_R,
    height: CORNER_R,
    background: `radial-gradient(circle at ${origin}, transparent ${CORNER_R}px, ${WASH} ${CORNER_R}px)`,
    pointerEvents: "none",
  };
}

/** Blue tint overlay — a world-space right-to-left wipe, applied per strip */
function blueTint(
  stripX: number,
  stripW: number,
  colorSlide: number,
): React.CSSProperties {
  const wipeX = (1 - colorSlide) * W; // frame-space wipe edge
  const leftInset = Math.max(0, Math.min(stripW, wipeX - stripX));
  return {
    position: "absolute",
    inset: 0,
    background: "rgba(50,110,230,0.55)",
    mixBlendMode: "multiply",
    clipPath: `inset(0 0 0 ${leftInset}px)`,
    pointerEvents: "none",
  };
}

/** Big pronounced wave — larger amplitude, longer wavelengths, faster drift */
const WAVE_AMPLITUDE = 0.55;

/** Pseudo-Simplex approximation using layered sines/cosines */
function pseudoNoise(x: number, y: number, t: number): number {
  const a = Math.sin(x * 0.8 + t * 0.9) * Math.cos(y * 1.2 - t * 0.7);
  const b = Math.sin(x * 2.3 - y * 1.7 + t * 1.4);
  return (a + b) / 2; // ≈ [-1, 1]
}

/** Vertical centerline column — the axis of mirror symmetry */
const CENTER_COL = COLS / 2;

function waveOffset(cellX: number, cellY: number, t: number): number {
  // Mirror across the vertical centerline: use distance-from-center as X input.
  // Cells equidistant from the axis get identical wave values → perfect Y-axis symmetry.
  const symX = Math.abs(cellX - CENTER_COL);
  const n = pseudoNoise(symX * 0.022, cellY * 0.035, t * 0.3);
  return Math.sin(n * 6 + t * 1.8) * WAVE_AMPLITUDE;
}

export const AsciiOverlay: React.FC<{
  rect: Rect;
  colorSlide?: number;
}> = ({ rect, colorSlide = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  const [brightness, setBrightness] = useState<Float32Array | null>(null);
  const [handle] = useState(() => delayRender("Loading ASCII grid"));

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = COLS;
      canvas.height = ROWS;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, COLS, ROWS);
      const { data } = ctx.getImageData(0, 0, COLS, ROWS);

      const grid = new Float32Array(ROWS * COLS);
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const idx = (y * COLS + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          grid[y * COLS + x] = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
        }
      }

      setBrightness(grid);
      continueRender(handle);
    };

    img.onerror = () => continueRender(handle);
    img.src = staticFile("broll/mountains-frame.jpg");
  }, [handle]);

  // Per-frame ASCII lines — wave modulates brightness, remaps to characters
  const ascii = useMemo<string[] | null>(() => {
    if (!brightness) return null;
    const rampLast = RAMP.length - 1;
    const lines: string[] = new Array(ROWS);
    const row = new Array<string>(COLS);

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const base = brightness[y * COLS + x];
        let v = base + waveOffset(x, y, t);
        if (v < 0) v = 0;
        else if (v > 1) v = 1;
        const ci = Math.min(rampLast, (v * RAMP.length) | 0);
        row[x] = RAMP[ci];
      }
      lines[y] = row.join("");
    }
    return lines;
  }, [brightness, t]);

  // Compute strip ASCII + geometry from the rect
  const geom = useMemo(() => {
    if (!ascii) return null;

    const rectLeft = Math.round(rect.x);
    const rectTop = Math.round(rect.y);
    const rectRight = Math.round(rect.x + rect.w);
    const rectBottom = Math.round(rect.y + rect.h);

    const rowTopEnd = Math.ceil(rectTop / CELL_H);
    const rowBottomStart = Math.floor(rectBottom / CELL_H);
    const colLeftEnd = Math.ceil(rectLeft / CELL_W);
    const colRightStart = Math.floor(rectRight / CELL_W);

    const topText = ascii.slice(0, rowTopEnd).join("\n");
    const bottomText = ascii.slice(rowBottomStart).join("\n");
    const leftText = ascii
      .slice(rowTopEnd, rowBottomStart)
      .map((l) => l.slice(0, colLeftEnd))
      .join("\n");
    const rightText = ascii
      .slice(rowTopEnd, rowBottomStart)
      .map((l) => l.slice(colRightStart))
      .join("\n");

    return {
      rectLeft,
      rectTop,
      rectRight,
      rectBottom,
      topText,
      bottomText,
      leftText,
      rightText,
    };
  }, [ascii, rect.x, rect.y, rect.w, rect.h]);

  if (!ascii || !geom) return null;

  const leftW = geom.rectLeft;
  const rightW = W - geom.rectRight;
  const topH = geom.rectTop;
  const bottomH = H - geom.rectBottom;
  const middleH = geom.rectBottom - geom.rectTop;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* TOP strip */}
      {topH > 0 && (
        <div style={{ ...stripBg, top: 0, left: 0, width: W, height: topH }}>
          <pre style={{ ...stripText, width: W }}>{geom.topText}</pre>
          <div style={stripDither} />
          <div style={stripCrt} />
          {colorSlide > 0 && <div style={blueTint(0, W, colorSlide)} />}
        </div>
      )}

      {/* BOTTOM strip */}
      {bottomH > 0 && (
        <div
          style={{
            ...stripBg,
            top: geom.rectBottom,
            left: 0,
            width: W,
            height: bottomH,
          }}
        >
          <pre style={{ ...stripText, width: W }}>{geom.bottomText}</pre>
          <div style={stripDither} />
          <div style={stripCrt} />
          {colorSlide > 0 && <div style={blueTint(0, W, colorSlide)} />}
        </div>
      )}

      {/* LEFT strip */}
      {leftW > 0 && (
        <div
          style={{
            ...stripBg,
            top: geom.rectTop,
            left: 0,
            width: leftW,
            height: middleH,
          }}
        >
          <pre style={{ ...stripText, width: leftW }}>{geom.leftText}</pre>
          <div style={stripDither} />
          <div style={stripCrt} />
          {colorSlide > 0 && <div style={blueTint(0, leftW, colorSlide)} />}
        </div>
      )}

      {/* RIGHT strip */}
      {rightW > 0 && (
        <div
          style={{
            ...stripBg,
            top: geom.rectTop,
            left: geom.rectRight,
            width: rightW,
            height: middleH,
          }}
        >
          <pre style={{ ...stripText, width: rightW }}>{geom.rightText}</pre>
          <div style={stripDither} />
          <div style={stripCrt} />
          {colorSlide > 0 && (
            <div style={blueTint(geom.rectRight, rightW, colorSlide)} />
          )}
        </div>
      )}

      {/* 4 corner fillers — close the L-shape between rect cutout and rounded corner */}
      <div style={cornerFill(rect, "tl")} />
      <div style={cornerFill(rect, "tr")} />
      <div style={cornerFill(rect, "bl")} />
      <div style={cornerFill(rect, "br")} />

      {/* Center rectangle outline */}
      <div
        style={{
          position: "absolute",
          left: rect.x,
          top: rect.y,
          width: rect.w,
          height: rect.h,
          borderRadius: CORNER_R,
          boxShadow:
            "inset 0 0 0 2px rgba(255,255,255,0.9), 0 0 0 1px rgba(0,0,0,0.25)",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
