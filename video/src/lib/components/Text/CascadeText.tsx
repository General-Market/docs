/**
 * CascadeText — shared text animation. Import from anywhere:
 *
 *   import { CascadeText } from "../../lib/components/Text";
 *
 * Minimal call:
 *   <CascadeText text="Hello world" />
 *
 * Entry. Each word is launched upward from below its final line with
 * a cubic-bezier ease-out — fast off the mark, decelerating into rest.
 * Gaussian blur dissolves on the same clock, so the word lands sharp.
 * Words are staggered by delayPerWord; two or three are always in
 * transit while the first ones have already landed. No post-landing
 * motion — once a word stops, it stops.
 *
 * Pass wave to turn on a continuous sine ripple that keeps traveling
 * through the text after entry (lifts a few pixels and re-blurs as it
 * passes each word). Off by default; use when you want the surface to
 * keep breathing instead of going still.
 *
 * Layout uses @remotion/layout-utils measureText, so every word knows
 * its final (x, y) and the right bound of its line before the first
 * frame. No reflow, no jumping on wrap.
 */

import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
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
  /** Max Gaussian blur at entry in px, fades to 0. Default 12. */
  blurPx?: number;
  align?: "left" | "center" | "right";
  /** Continuous wave ripple after entry settles. Default true. */
  wave?: boolean;
  /** Frames the wave offsets each successive word. Default 6. */
  waveSpeed?: number;
  /** Frames each word spends inside the wave dip. Default 22. */
  waveDipFrames?: number;
  /** Peak lift during the wave dip, in px. Default 6. */
  waveRisePx?: number;
  /** Peak blur during the wave dip, in px. Default 3. */
  waveBlurPx?: number;
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
  blurPx = 12,
  align = "left",
  wave = false,
  waveSpeed = 6,
  waveDipFrames = 22,
  waveRisePx = 6,
  waveBlurPx = 3,
}) => {
  const frame = useCurrentFrame();

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

        // Entry: position is fast-off-the-line, decelerates into place.
        // Custom cubic-bezier approximates easeOutExpo — most of the motion
        // is spent in the first third, then the word glides to its final y.
        const posT = interpolate(
          Math.max(wordFrame, 0),
          [0, durationPerWord],
          [0, 1],
          {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          },
        );

        // Blur resolves by the time the word arrives — sharp on landing.
        const blurT = interpolate(
          Math.max(wordFrame, 0),
          [0, durationPerWord],
          [0, 1],
          {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.33, 1, 0.5, 1),
          },
        );

        // Wave ripple — only engages after this word's entry has settled.
        let waveRise = 0;
        let waveBlur = 0;
        if (wave && posT > 0.9) {
          const period = Math.max(
            positions.length * waveSpeed,
            waveDipFrames * 3,
          );
          const wavePhase =
            ((wordFrame - i * waveSpeed) % period + period) % period;
          if (wavePhase < waveDipFrames) {
            const dipT = Math.sin((Math.PI * wavePhase) / waveDipFrames);
            waveRise = dipT * waveRisePx;
            waveBlur = dipT * waveBlurPx;
          }
        }

        const dy = (1 - posT) * riseDistance - waveRise;
        const entryBlur = (1 - blurT) * blurPx;
        const blur = entryBlur + waveBlur;
        const opacity = Math.min(1, posT * 1.3);

        return (
          <span
            key={i}
            style={{
              position: "absolute",
              left: p.x,
              top: p.y,
              whiteSpace: "pre",
              transform: `translate3d(0, ${dy}px, 0)`,
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
