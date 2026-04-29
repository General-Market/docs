import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { noise2D } from "@remotion/noise";
import { SOURCES } from "../../launch/data/sources";
import { PLACEHOLDER_COLORS } from "../../launch/brollAssets";
import { BrollCell } from "../../launch/shots/BrollCell";

/* ═══════════════════════════════════════════════════════
   Dynamic backgrounds — flat shades, no motion.
   Single teal #0ABAB5 for the brand surfaces; near-white
   #eff8f7 for the light counterpart. No gradient stops, no
   noise drift. Names kept for back-compat with the scenes.
   ═══════════════════════════════════════════════════════ */

const TEAL = "#0ABAB5";
const TEAL_LIGHT = "#eff8f7";

export const DynamicBlue: React.FC<{ speed?: number }> = () => (
  <AbsoluteFill style={{ backgroundColor: TEAL }} />
);

export const DynamicLight: React.FC<{ speed?: number }> = () => (
  <AbsoluteFill style={{ backgroundColor: TEAL_LIGHT }} />
);

export const DynamicSolidBlue: React.FC<{ speed?: number }> = () => (
  <AbsoluteFill style={{ backgroundColor: TEAL }} />
);

// ── Animated dark background (slow drift, deep navy) ──
export const DynamicDark: React.FC<{ speed?: number }> = ({ speed = 0.014 }) => {
  const frame = useCurrentFrame();
  const t = frame * speed;
  const x = 40 + noise2D("rd-x", t, 0) * 22;
  const y = 45 + noise2D("rd-y", t, 0.5) * 22;

  return (
    <AbsoluteFill
      style={{
        background: `
          radial-gradient(ellipse 60% 60% at ${x}% ${y}%, rgba(40,140,135,0.18) 0%, transparent 65%),
          linear-gradient(180deg, #0c0c12 0%, #111118 50%, #0a0a10 100%)
        `,
      }}
    />
  );
};

/* ═══════════════════════════════════════════════════════
   Hex grid overlay — outline-only honeycomb, stroke = white
   ═══════════════════════════════════════════════════════ */

const SQRT3 = Math.sqrt(3);

export const HexGridOverlay: React.FC<{
  size?: number;
  color?: string;
  opacity?: number;
  strokeWidth?: number;
}> = ({ size = 70, color = "rgba(255,255,255,0.18)", opacity = 1, strokeWidth = 1.4 }) => {
  // Pointy-top hex: width = size * sqrt(3), height = size * 2
  const hexW = size * SQRT3;
  const rowStride = size * 1.5;

  const cols = Math.ceil(1920 / hexW) + 2;
  const rows = Math.ceil(1080 / rowStride) + 2;

  const hexes: React.ReactNode[] = [];
  for (let r = -1; r < rows; r++) {
    for (let c = -1; c < cols; c++) {
      const cx = c * hexW + (r % 2 === 0 ? 0 : hexW / 2);
      const cy = r * rowStride + size;
      const points = [
        [cx, cy - size],
        [cx + hexW / 2, cy - size / 2],
        [cx + hexW / 2, cy + size / 2],
        [cx, cy + size],
        [cx - hexW / 2, cy + size / 2],
        [cx - hexW / 2, cy - size / 2],
      ]
        .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
        .join(" ");
      hexes.push(
        <polygon
          key={`h-${r}-${c}`}
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
        />,
      );
    }
  }

  return (
    <AbsoluteFill style={{ opacity, pointerEvents: "none" }}>
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 1920 1080"
        preserveAspectRatio="none"
        style={{ display: "block" }}
      >
        {hexes}
      </svg>
    </AbsoluteFill>
  );
};

/* ═══════════════════════════════════════════════════════
   Scene-level zoom helper.
   - Entry: scale 1.05 → 1.0 over first 14 frames, ease-out cubic (deceleration).
   - Exit:  scale 1.0 → 1.04 over last  7 frames, ease-in cubic (acceleration).
   The cut happens between exit-end and entry-start, so the next scene
   "inherits" the zoom and decelerates out of it.
   ═══════════════════════════════════════════════════════ */

const ENTRY_FRAMES = 18;
const EXIT_FRAMES = 9;
const ENTRY_SCALE = 1.22;
const EXIT_SCALE = 1.18;

export function useBackgroundZoom(durationInFrames: number): number {
  const frame = useCurrentFrame();

  if (frame < ENTRY_FRAMES) {
    const t = frame / ENTRY_FRAMES;
    const ease = 1 - Math.pow(1 - t, 3); // ease-out cubic
    return ENTRY_SCALE - (ENTRY_SCALE - 1.0) * ease;
  }
  const exitStart = durationInFrames - EXIT_FRAMES;
  if (frame >= exitStart) {
    const t = Math.min(1, (frame - exitStart) / EXIT_FRAMES);
    const ease = t * t * t; // ease-in cubic
    return 1.0 + (EXIT_SCALE - 1.0) * ease;
  }
  return 1.0;
}

export const ZoomedBg: React.FC<{
  duration: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ duration, children, style }) => {
  const scale = useBackgroundZoom(duration);
  return (
    <AbsoluteFill
      style={{
        transform: `scale(${scale})`,
        transformOrigin: "50% 50%",
        ...style,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

/* ═══════════════════════════════════════════════════════
   MegaGridBg — 10×10 logo grid, tilted, blurred, scrolling.
   Adapted from sequence02/FullscreenMarkets.MegaGridBg so the
   500,000 reveal in Scene 08 looks the way the user pointed at.
   ═══════════════════════════════════════════════════════ */

const MEGA_TILT_X = 12;
const MEGA_GRID_SCALE = 1.15;
const MEGA_SCROLL_PX_PER_SEC = 18;

export const MegaGridBg: React.FC<{ cols?: number; rows?: number }> = ({
  cols = 10,
  rows = 10,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scrollY = (frame / fps) * MEGA_SCROLL_PX_PER_SEC;
  const count = cols * rows;

  return (
    <>
      <AbsoluteFill style={{ backgroundColor: "#ffffff" }} />
      <div
        style={{
          width: "100%",
          height: "100%",
          perspective: 1800,
          perspectiveOrigin: "50% 45%",
        }}
      >
        <AbsoluteFill
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gridTemplateRows: `repeat(${rows}, 1fr)`,
            gap: 3,
            padding: 3,
            filter: "blur(6px)",
            transform: `rotateX(${MEGA_TILT_X}deg) scale(${MEGA_GRID_SCALE}) translateY(${-scrollY}px)`,
            transformStyle: "preserve-3d",
          }}
        >
          {Array.from({ length: count }).map((_, i) => {
            const source = SOURCES[i % SOURCES.length];
            const logoSrc = source.logo.startsWith("/") ? source.logo.slice(1) : source.logo;
            return (
              <div
                key={i}
                style={{
                  background: source.bg,
                  borderRadius: 4,
                  overflow: "hidden",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  padding: 6,
                }}
              >
                <Img
                  src={staticFile(logoSrc)}
                  style={{
                    maxWidth: "80%",
                    maxHeight: "80%",
                    objectFit: "contain",
                  }}
                />
              </div>
            );
          })}
        </AbsoluteFill>
      </div>

      {/* Soft vignette */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0) 30%, rgba(0,0,0,0.45) 100%)",
        }}
      />
    </>
  );
};

/* ═══════════════════════════════════════════════════════
   BrollGridBg — honeycomb of broll cells, tilted and blurred.
   Same layout philosophy as sequence02/FullscreenMarkets.BrollGridBg
   but cells are pointy-top hexagons in an interlocking honeycomb,
   not square. BrollCell handles real broll on render and falls
   through to the placeholder color in studio when no asset exists.
   ═══════════════════════════════════════════════════════ */

export type BrollCategory = "twitch" | "pumpfun" | "movies" | "animals";

const HEX_CLIP = "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)";
const HEX_SQRT3 = Math.sqrt(3);
const BROLL_PER_CATEGORY = 48;

export const BrollGridBg: React.FC<{
  category: BrollCategory;
  hexWidth?: number;
  /** Composition-absolute frame when this segment mounted; scrolling counts from here. */
  startFrame?: number;
}> = ({ category, hexWidth = 240, startFrame = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scrollY = (Math.max(0, frame - startFrame) / fps) * MEGA_SCROLL_PX_PER_SEC;
  const colors = PLACEHOLDER_COLORS[category] ?? ["#444"];

  const hexW = hexWidth;
  const hexH = (hexW * 2) / HEX_SQRT3;
  const rowStride = hexH * 0.75;

  const numCols = Math.ceil(1920 / hexW) + 2;
  const numRows = Math.ceil(1080 / rowStride) + 2;

  const cells: { x: number; y: number; i: number }[] = [];
  let idx = 0;
  for (let r = -1; r < numRows; r++) {
    const offsetX = r % 2 !== 0 ? hexW / 2 : 0;
    for (let c = -1; c < numCols; c++) {
      cells.push({
        x: c * hexW + offsetX,
        y: r * rowStride,
        i: idx,
      });
      idx++;
    }
  }

  return (
    <>
      <AbsoluteFill style={{ backgroundColor: "#ffffff" }} />
      <div
        style={{
          width: "100%",
          height: "100%",
          perspective: 1800,
          perspectiveOrigin: "50% 45%",
        }}
      >
        <AbsoluteFill
          style={{
            filter: "blur(8px)",
            overflow: "hidden",
            transform: `rotateX(${MEGA_TILT_X}deg) scale(${MEGA_GRID_SCALE}) translateY(${-scrollY}px)`,
            transformStyle: "preserve-3d",
          }}
        >
          {cells.map(({ x, y, i }) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: x,
                top: y,
                width: hexW,
                height: hexH,
                clipPath: HEX_CLIP,
                backgroundColor: colors[i % colors.length],
                overflow: "hidden",
              }}
            >
              <BrollCell category={category} index={i % BROLL_PER_CATEGORY} />
            </div>
          ))}
        </AbsoluteFill>
      </div>

      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0) 30%, rgba(0,0,0,0.45) 100%)",
        }}
      />
    </>
  );
};

/* ═══════════════════════════════════════════════════════
   WordCascade — words rise + de-blur + fade in on cue.
   Same easing & shadow recipe as sequence02 so the look matches.
   ═══════════════════════════════════════════════════════ */

export interface CascadeWord {
  /** Frame when the word lands (sequence-local). */
  atFrame: number;
  text: string;
  /** Per-word size override. Falls back to the global fontSize. */
  size?: number;
  /** Insert a line break after this word. */
  br?: boolean;
}

const CASCADE_EASE = Easing.bezier(0.16, 1, 0.3, 1);

export const WordCascade: React.FC<{
  words: CascadeWord[];
  fontSize: number;
  fontFamily: string;
  color?: string;
  fontWeight?: number;
  fontStyle?: "italic" | "normal";
  entryFrames?: number;
  rise?: number;
  blurPx?: number;
}> = ({
  words,
  fontSize,
  fontFamily,
  color = "#ffffff",
  fontWeight = 900,
  fontStyle = "italic",
  entryFrames = 10,
  rise = 40,
  blurPx = 10,
}) => {
  const frame = useCurrentFrame();
  const lines: CascadeWord[][] = [[]];
  for (const w of words) {
    lines[lines.length - 1].push(w);
    if (w.br) lines.push([]);
  }
  if (lines[lines.length - 1].length === 0) lines.pop();

  return (
    <div
      style={{
        fontFamily,
        fontSize,
        fontWeight,
        fontStyle,
        color,
        letterSpacing: "-0.02em",
        lineHeight: 1.05,
        textAlign: "center",
        textShadow:
          "0 4px 32px rgba(0,0,0,0.85), 0 2px 8px rgba(0,0,0,0.7), 0 0 2px rgba(0,0,0,0.6)",
      }}
    >
      {lines.map((line, li) => (
        <div
          key={li}
          style={{
            display: "flex",
            justifyContent: "center",
            flexWrap: "wrap",
            gap: "0 0.28em",
          }}
        >
          {line.map((w, wi) => {
            const t = Math.max(0, frame - w.atFrame);
            const progress = interpolate(t, [0, entryFrames], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: CASCADE_EASE,
            });
            const dy = (1 - progress) * rise;
            const blur = (1 - progress) * blurPx;
            const opacity = frame >= w.atFrame ? progress : 0;
            return (
              <span
                key={wi}
                style={{
                  display: "inline-block",
                  fontSize: w.size ?? fontSize,
                  transform: `translate3d(0, ${dy}px, 0)`,
                  opacity,
                  filter: blur > 0.1 ? `blur(${blur}px)` : undefined,
                  willChange: "transform, opacity, filter",
                }}
              >
                {w.text}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};
