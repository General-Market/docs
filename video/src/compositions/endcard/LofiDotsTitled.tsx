/**
 * LofiDotsTitled — the LofiDots hex-tessellation composition with one
 * upgrade borrowed from /WebGLPicks at 1:44 (ParticleWave): big title
 * text laid over the grid. The twist: the titles are not flat ink, they
 * are a viewport. The broll plays inside the glyphs.
 *
 * Two layers:
 *   1. The hex-pixelated broll, identical to /LofiDots — paper, fabric,
 *      one sample per cell, the silhouette surviving the decimation.
 *   2. Centred title glyphs whose interior is the same broll, rendered
 *      at full resolution. The hexagons coarsen the world; the letters
 *      let it speak.
 *
 * The titles fade in over the first second and stay. The broll loops
 * for 5m11s — the same span as /LofiDots — so a render of either
 * composition consumes the same source.
 */

import React, { useMemo } from "react";
import {
  AbsoluteFill,
  Easing,
  Video,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { HexPixelate } from "../effects/HexPixelate";
import { VIDEO_SRC } from "./LofiDots";

// ── Title knobs ───────────────────────────────────────────────────────
// The lines, in order. Two lines, like ParticleWave; chosen to echo it.
const TITLE_LINES = ["HEXAGONAL", "GRID"];
// Font stack — fat, condensed-friendly, available everywhere. SVG
// rendering of <text> is fragile across font fallbacks; Impact and
// Arial Black exist on every machine the broll has ever met.
const TITLE_FONT = '"Arial Black", Impact, system-ui, sans-serif';
// Letter weight per line. The first line carries; the second supports.
const TITLE_WEIGHTS = [900, 700];
// As a fraction of composition height. 0.20 ≈ 216px on a 1080 frame.
const TITLE_FONT_SCALE = 0.20;
// Vertical gap between the two lines, fraction of composition height.
const TITLE_LINE_GAP_SCALE = 0.02;
// Letter-spacing in em — the WebGLPicks reference used 8px on 72px;
// keeping the same ratio (≈0.11em) at any scale.
const TITLE_LETTER_SPACING_EM = 0.11;

// Use a unique mask id so the SVG never collides with anything else
// on the page (Remotion Studio may host multiple compositions in
// neighbouring iframes).
const MASK_ID = "lofi-dots-titled-mask";

const useTitleFadeIn = (frame: number, fps: number): number =>
  interpolate(frame, [0, Math.round(fps * 1.0)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

export const LofiDotsTitled: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const titleOpacity = useTitleFadeIn(frame, fps);

  // Position the two lines around the centre. y is a baseline, so we
  // bias by the cap-height (≈0.72 of the size) to make the block read
  // as centred to the eye, not centred to the SVG box.
  const fontSize = Math.round(height * TITLE_FONT_SCALE);
  const gap = Math.round(height * TITLE_LINE_GAP_SCALE);
  const cap = fontSize * 0.72;
  const blockHeight = cap * TITLE_LINES.length + gap * (TITLE_LINES.length - 1);
  const firstBaseline = height / 2 - blockHeight / 2 + cap;
  const baselines = TITLE_LINES.map(
    (_, i) => firstBaseline + i * (cap + gap),
  );
  const letterSpacing = fontSize * TITLE_LETTER_SPACING_EM;

  const videoStyle = useMemo<React.CSSProperties>(
    () => ({
      width: "100%",
      height: "100%",
      objectFit: "cover",
      objectPosition: "center",
    }),
    [],
  );

  return (
    <AbsoluteFill style={{ background: "#0a0a0c" }}>
      {/* Layer 1 — hex-tessellated broll. The world coarse. */}
      <HexPixelate
        src={VIDEO_SRC}
        width={width}
        height={height}
        cellSize={14}
      />

      {/* Layer 2 — broll inside the title glyphs. The world fine. */}
      <AbsoluteFill style={{ pointerEvents: "none", opacity: titleOpacity }}>
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          style={{ position: "absolute", inset: 0 }}
        >
          <defs>
            <clipPath id={MASK_ID} clipPathUnits="userSpaceOnUse">
              {TITLE_LINES.map((line, i) => (
                <text
                  key={i}
                  x={width / 2}
                  y={baselines[i]}
                  textAnchor="middle"
                  fontFamily={TITLE_FONT}
                  fontWeight={TITLE_WEIGHTS[i]}
                  fontSize={fontSize}
                  letterSpacing={letterSpacing}
                >
                  {line}
                </text>
              ))}
            </clipPath>
          </defs>
          <foreignObject
            x={0}
            y={0}
            width={width}
            height={height}
            clipPath={`url(#${MASK_ID})`}
          >
            <div
              {...{ xmlns: "http://www.w3.org/1999/xhtml" }}
              style={{ width: "100%", height: "100%" }}
            >
              <Video src={staticFile(VIDEO_SRC)} muted style={videoStyle} />
            </div>
          </foreignObject>
        </svg>

        {/* A thin ink stroke around the glyph silhouette — the broll
            is bright; the eye needs an edge to read the word. */}
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          style={{ position: "absolute", inset: 0 }}
        >
          {TITLE_LINES.map((line, i) => (
            <text
              key={i}
              x={width / 2}
              y={baselines[i]}
              textAnchor="middle"
              fontFamily={TITLE_FONT}
              fontWeight={TITLE_WEIGHTS[i]}
              fontSize={fontSize}
              letterSpacing={letterSpacing}
              fill="none"
              stroke="rgba(10,10,12,0.85)"
              strokeWidth={3}
              paintOrder="stroke"
            >
              {line}
            </text>
          ))}
        </svg>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
