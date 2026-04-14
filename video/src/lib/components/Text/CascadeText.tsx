/**
 * CascadeText — shared text animation. Import from anywhere:
 *
 *   import { CascadeText } from "../../lib/components/Text";
 *
 * Minimal call:
 *   <CascadeText text="Hello world" />
 *
 * Words rise from below the line they will settle on, blurred at
 * entry, and resolve into sharp, final positions. Opacity climbs as
 * the blur dissolves. Each word is staggered by delayPerWord so two
 * or three words are always in transit while the first ones have
 * already landed. No exit, no tilt, no cycle — enter once, stay.
 *
 * Layout uses @remotion/layout-utils measureText, so every word knows
 * its final (x, y) and the right bound of its line before the first
 * frame. No reflow, no jumping on wrap.
 */

import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { measureText } from "@remotion/layout-utils";

export interface CascadeTextProps {
  text: string;
  /** Box width for wrapping in px. Default 1200. */
  maxWidth?: number;
  fontFamily?: string;
  /** px. Default 96. */
  fontSize?: number;
  fontWeight?: number | string;
  letterSpacing?: string;
  color?: string;
  /** px. Defaults to 1.15 × fontSize. */
  lineHeight?: number;
  /** Frames between each word's entrance start. Default 3. */
  delayPerWord?: number;
  /** Spring duration per word (frames). Default 22. */
  durationPerWord?: number;
  /** Frames before the first word starts. Default 0. */
  startDelay?: number;
  /** Word rises from this many px below its final position. Default 60. */
  riseDistance?: number;
  /** Word enters this many px to the right of final, drifts left. Default 24. */
  driftDistance?: number;
  /** Max Gaussian blur at entry in px, fades to 0. Default 12. */
  blurPx?: number;
  align?: "left" | "center" | "right";
}

interface WordPos {
  word: string;
  x: number;
  y: number;
  width: number;
  line: number;
}

function layoutWords(
  words: string[],
  maxWidth: number,
  measure: (w: string) => number,
  spaceWidth: number,
  lineHeight: number,
): WordPos[] {
  const lines: WordPos[][] = [[]];
  let x = 0;
  let line = 0;

  for (const word of words) {
    const w = measure(word);
    if (x > 0 && x + w > maxWidth) {
      line += 1;
      lines[line] = [];
      x = 0;
    }
    lines[line].push({ word, x, y: line * lineHeight, width: w, line });
    x += w + spaceWidth;
  }

  return lines.flat();
}

function alignLines(
  positions: WordPos[],
  maxWidth: number,
  align: "left" | "center" | "right",
): WordPos[] {
  if (align === "left") return positions;
  const lineRightEdge = new Map<number, number>();
  for (const p of positions) {
    const edge = p.x + p.width;
    if ((lineRightEdge.get(p.line) ?? 0) < edge) {
      lineRightEdge.set(p.line, edge);
    }
  }
  return positions.map((p) => {
    const rightEdge = lineRightEdge.get(p.line) ?? 0;
    const shift =
      align === "center" ? (maxWidth - rightEdge) / 2 : maxWidth - rightEdge;
    return { ...p, x: p.x + shift };
  });
}

export const CascadeText: React.FC<CascadeTextProps> = ({
  text,
  maxWidth = 1200,
  fontFamily = "sans-serif",
  fontSize = 96,
  fontWeight = 700,
  letterSpacing,
  color = "currentColor",
  lineHeight,
  delayPerWord = 3,
  durationPerWord = 22,
  startDelay = 0,
  riseDistance = 60,
  driftDistance = 24,
  blurPx = 12,
  align = "left",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const lh = lineHeight ?? Math.round(fontSize * 1.15);

  const { positions, totalHeight } = React.useMemo(() => {
    const words = text.split(/\s+/).filter(Boolean);
    const measureWord = (w: string) =>
      measureText({
        text: w,
        fontFamily,
        fontSize,
        fontWeight,
        letterSpacing,
      }).width;
    const spaceWidth = measureText({
      text: "\u00A0",
      fontFamily,
      fontSize,
      fontWeight,
      letterSpacing,
    }).width;

    let laidOut = layoutWords(words, maxWidth, measureWord, spaceWidth, lh);
    if (align !== "left") {
      laidOut = alignLines(laidOut, maxWidth, align);
    }

    const lineCount = laidOut.length
      ? Math.max(...laidOut.map((p) => p.line)) + 1
      : 1;
    return { positions: laidOut, totalHeight: lineCount * lh };
  }, [text, maxWidth, fontFamily, fontSize, fontWeight, letterSpacing, lh, align]);

  return (
    <div
      style={{
        position: "relative",
        width: maxWidth,
        height: totalHeight,
        fontFamily,
        fontSize,
        fontWeight,
        letterSpacing,
        color,
      }}
    >
      {positions.map((p, i) => {
        const wordFrame = frame - startDelay - i * delayPerWord;
        if (wordFrame < 0) return null;

        const t = spring({
          frame: Math.max(wordFrame, 0),
          fps,
          config: { damping: 18, stiffness: 140, mass: 0.9 },
          durationInFrames: durationPerWord,
        });

        const dy = (1 - t) * riseDistance;
        const dx = (1 - t) * driftDistance;
        const blur = (1 - t) * blurPx;
        const opacity = Math.min(1, t * 1.3);

        return (
          <span
            key={i}
            style={{
              position: "absolute",
              left: p.x,
              top: p.y,
              whiteSpace: "pre",
              transform: `translate3d(${dx}px, ${dy}px, 0)`,
              transformOrigin: "left top",
              opacity,
              filter: blur > 0.1 ? `blur(${blur}px)` : undefined,
              willChange: "transform, opacity, filter",
            }}
          >
            {p.word}
          </span>
        );
      })}
    </div>
  );
};
