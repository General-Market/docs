/**
 * CascadeText — shared text animation. Import from anywhere:
 *
 *   import { CascadeText } from "../../lib/components/Text";
 *
 * Minimal call:
 *   <CascadeText text="Hello world" />
 *
 * Common overrides:
 *   <CascadeText text="..." fontSize={120} loop />
 *   <CascadeText text="..." fontFamily={font} color="#9fe870" align="center" />
 *
 * Words tumble in from above-right, settle into their pre-computed
 * wrapped positions, optionally hold, then exit downward so the next
 * cycle can re-enter. In loop mode the wave never lands — there is
 * always a word entering and another in the air.
 *
 * Layout uses @remotion/layout-utils measureText, so every word knows
 * its final (x, y) and the right bound of its line before the first
 * frame. No reflow, no jumping on wrap.
 *
 * Cycle phases per word:
 *   entry  (durationPerWord frames): fall from top-right with tilt
 *   hold   (holdFrames frames):      at rest, fully opaque
 *   exit   (exitFrames frames):      drop through, counter-tilt, fade
 *
 * Stagger (delayPerWord) is smaller than durationPerWord, so two or
 * three words are always in flight.
 */

import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { measureText } from "@remotion/layout-utils";

export interface CascadeTextProps {
  text: string;
  /** Box width for wrapping in px. Default 1200. */
  maxWidth?: number;
  /** Inherits from parent if omitted. */
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
  /** Vertical drop distance in px. Default 60. */
  fallDistance?: number;
  /** Word enters this many px to the right of final, drifts left. Default 24. */
  driftDistance?: number;
  /** Tilt at entry (degrees). Default 2. */
  tiltDeg?: number;
  align?: "left" | "center" | "right";
  /** Loop forever: entry → hold → exit → re-entry. Default false. */
  loop?: boolean;
  /** Frames the word holds at rest before exiting (loop mode). Default 40. */
  holdFrames?: number;
  /** Frames for the exit animation (loop mode). Default 22. */
  exitFrames?: number;
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
  fallDistance = 60,
  driftDistance = 24,
  tiltDeg = 2,
  align = "left",
  loop = false,
  holdFrames = 40,
  exitFrames = 22,
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

        const cycle = durationPerWord + holdFrames + exitFrames;
        const phase = loop ? wordFrame % cycle : wordFrame;

        const entryT = spring({
          frame: Math.max(phase, 0),
          fps,
          config: { damping: 18, stiffness: 140, mass: 0.9 },
          durationInFrames: durationPerWord,
        });

        const inExit = loop && phase >= durationPerWord + holdFrames;
        const exitPhase = inExit ? phase - durationPerWord - holdFrames : 0;
        const exitT = inExit
          ? spring({
              frame: exitPhase,
              fps,
              config: { damping: 20, stiffness: 100, mass: 1 },
              durationInFrames: exitFrames,
            })
          : 0;

        const dy = (1 - entryT) * -fallDistance + exitT * fallDistance * 0.9;
        const dx = (1 - entryT) * driftDistance - exitT * driftDistance * 0.6;
        const rot = (1 - entryT) * tiltDeg - exitT * tiltDeg;
        const opacity = Math.min(1, entryT * 1.3) * (1 - exitT);

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
