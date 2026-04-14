/**
 * CascadeText — words tumble in from above-right, settle into their
 * wrapped layout positions. Each word animates independently and does
 * not wait for its neighbors to finish.
 *
 * Layout is pre-computed with @remotion/layout-utils measureText so that
 * we know each word's final (x, y) and the right bound of every line
 * before the first frame renders. The animation always resolves to the
 * true wrapped layout — no reflow, no jumping.
 *
 * Per word, the transform animates from:
 *   dy = -fallDistance, dx = +driftDistance, rotate = tiltDeg, opacity = 0
 * to:
 *   dy = 0,             dx = 0,              rotate = 0,       opacity = 1
 *
 * Stagger (delayPerWord) is deliberately smaller than the spring
 * duration so words overlap in flight — two or three in the air at once.
 */

import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { measureText } from "@remotion/layout-utils";

export interface CascadeTextProps {
  text: string;
  /** Box width the text wraps inside (px). */
  maxWidth: number;
  fontFamily: string;
  fontSize: number;
  fontWeight?: number | string;
  letterSpacing?: string;
  color?: string;
  /** Line height in px. Defaults to 1.15 × fontSize. */
  lineHeight?: number;
  /** Frames between each word's entrance start. Default 3. */
  delayPerWord?: number;
  /** Spring duration in frames per word. Default 22. */
  durationPerWord?: number;
  /** Frames before the first word starts. Default 0. */
  startDelay?: number;
  /** Vertical drop distance in px. Default 60. */
  fallDistance?: number;
  /** Horizontal drift (word starts this many px to the right). Default 24. */
  driftDistance?: number;
  /** Tilt in degrees at entry. Default 5. */
  tiltDeg?: number;
  /** Text-align within the box. Default "left". */
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
  maxWidth,
  fontFamily,
  fontSize,
  fontWeight = 700,
  letterSpacing,
  color = "currentColor",
  lineHeight,
  delayPerWord = 3,
  durationPerWord = 22,
  startDelay = 0,
  fallDistance = 60,
  driftDistance = 24,
  tiltDeg = 5,
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
        const t = spring({
          frame: Math.max(wordFrame, 0),
          fps,
          config: { damping: 18, stiffness: 140, mass: 0.9 },
          durationInFrames: durationPerWord,
        });

        const dy = (1 - t) * -fallDistance;
        const dx = (1 - t) * driftDistance;
        const rot = (1 - t) * tiltDeg;
        const opacity = Math.min(1, t * 1.3);

        return (
          <span
            key={i}
            style={{
              position: "absolute",
              left: p.x,
              top: p.y,
              whiteSpace: "pre",
              transform: `translate3d(${dx}px, ${dy}px, 0) rotate(${rot}deg)`,
              transformOrigin: "left top",
              opacity,
              willChange: "transform, opacity",
            }}
          >
            {p.word}
          </span>
        );
      })}
    </div>
  );
};
