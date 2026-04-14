/**
 * CascadeText — shared text animation. Import from anywhere:
 *
 *   import { CascadeText } from "../../lib/components/Text";
 *
 * Minimal call:
 *   <CascadeText text="Hello world" />
 *
 * Two token types, same component.
 *
 * Plain words rise from below their final line on a fast-off-the-line
 * cubic bezier, decelerating into rest. Gaussian blur dissolves on the
 * same clock so the word lands sharp. Staggered by delayPerWord — two
 * or three words in transit while the first ones have landed. No
 * post-landing motion; once a word stops, it stops.
 *
 * Boxed words — anything wrapped in square brackets in the text —
 * appear at their final position and scale up from zero. A soft radial
 * light blooms behind the box as the word lands, then fades. Use them
 * to flag the load-bearing words in a phrase:
 *
 *   <CascadeText text="AI agents to [Build] and [Govern]" />
 *
 * Optional wave prop turns on a continuous sine ripple through plain
 * words after entry (boxed words stay still). Off by default.
 *
 * Layout uses @remotion/layout-utils measureText so every token knows
 * its final (x, y) and the right bound of its line before the first
 * frame. No reflow, no jumping on wrap.
 */

import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { measureText } from "@remotion/layout-utils";

export interface BoxStyle {
  bg?: string;
  color?: string;
  paddingX?: number;
  paddingY?: number;
  borderRadius?: number;
  /** Peak glow radius in px beyond the box. Default 140. */
  glowRadius?: number;
  /** Glow hex color. Default "#ffffff". */
  glowColor?: string;
  /** Frames the glow takes to pop and fade. Default 34. */
  glowDuration?: number;
}

export interface CascadeTextProps {
  /** Plain words + bracketed boxed tokens: "agents to [Build]". */
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
  /** Plain words rise from this many px below. Default 60. */
  riseDistance?: number;
  /** Max Gaussian blur at entry in px. Default 12. */
  blurPx?: number;
  align?: "left" | "center" | "right";
  /** Style for bracketed tokens. */
  boxStyle?: BoxStyle;
  /** Continuous wave ripple through plain words after entry. Default false. */
  wave?: boolean;
  waveSpeed?: number;
  waveDipFrames?: number;
  waveRisePx?: number;
  waveBlurPx?: number;
}

interface Token {
  text: string;
  boxed: boolean;
}

interface TokenPos extends Token {
  x: number;
  y: number;
  textWidth: number;
  totalWidth: number;
  line: number;
}

function parseTokens(text: string): Token[] {
  // [bracketed] tokens become boxed; everything else tokenizes by whitespace.
  const re = /\[([^\]]+)\]|(\S+)/g;
  const out: Token[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m[1] !== undefined) out.push({ text: m[1], boxed: true });
    else if (m[2] !== undefined) out.push({ text: m[2], boxed: false });
  }
  return out;
}

function layoutTokens(
  tokens: Token[],
  maxWidth: number,
  measureWidth: (t: Token) => { text: number; total: number },
  spaceWidth: number,
  lineHeight: number,
): TokenPos[] {
  const placed: TokenPos[] = [];
  let x = 0;
  let line = 0;

  for (const tok of tokens) {
    const { text: textWidth, total: totalWidth } = measureWidth(tok);
    if (x > 0 && x + totalWidth > maxWidth) {
      line += 1;
      x = 0;
    }
    placed.push({
      ...tok,
      x,
      y: line * lineHeight,
      textWidth,
      totalWidth,
      line,
    });
    x += totalWidth + spaceWidth;
  }

  return placed;
}

function alignLines(
  positions: TokenPos[],
  maxWidth: number,
  align: "left" | "center" | "right",
): TokenPos[] {
  if (align === "left") return positions;
  const lineRightEdge = new Map<number, number>();
  for (const p of positions) {
    const edge = p.x + p.totalWidth;
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

const DEFAULT_BOX: Required<BoxStyle> = {
  bg: "#1a1a1a",
  color: "#ffffff",
  paddingX: 20,
  paddingY: 6,
  borderRadius: 10,
  glowRadius: 140,
  glowColor: "#ffffff",
  glowDuration: 34,
};

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
  boxStyle,
  wave = false,
  waveSpeed = 6,
  waveDipFrames = 22,
  waveRisePx = 6,
  waveBlurPx = 3,
}) => {
  const frame = useCurrentFrame();

  const BOX = { ...DEFAULT_BOX, ...boxStyle };
  const lh = lineHeight ?? Math.round(fontSize * 1.15);

  const { positions, totalHeight } = React.useMemo(() => {
    const tokens = parseTokens(text);

    const measureWidth = (tok: Token) => {
      const textW = measureText({
        text: tok.text,
        fontFamily,
        fontSize,
        fontWeight,
        letterSpacing,
      }).width;
      const total = tok.boxed ? textW + BOX.paddingX * 2 : textW;
      return { text: textW, total };
    };
    const spaceWidth = measureText({
      text: "\u00A0",
      fontFamily,
      fontSize,
      fontWeight,
      letterSpacing,
    }).width;

    let laidOut = layoutTokens(tokens, maxWidth, measureWidth, spaceWidth, lh);
    if (align !== "left") {
      laidOut = alignLines(laidOut, maxWidth, align);
    }

    const lineCount = laidOut.length
      ? Math.max(...laidOut.map((p) => p.line)) + 1
      : 1;
    return { positions: laidOut, totalHeight: lineCount * lh };
  }, [
    text,
    maxWidth,
    fontFamily,
    fontSize,
    fontWeight,
    letterSpacing,
    lh,
    align,
    BOX.paddingX,
  ]);

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

        // Entry curve — fast off the line, decelerates into place.
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
        const opacity = Math.min(1, posT * 1.3);

        if (p.boxed) {
          // Scale from 0 at final position — no rise.
          const scale = posT;
          const boxH = lh + BOX.paddingY * 2;
          const boxY = p.y + (lh - boxH) / 2;

          // Glow pop — radial light blooms then fades.
          const glowT = Math.max(wordFrame, 0);
          const glowProg = interpolate(
            glowT,
            [0, BOX.glowDuration * 0.25, BOX.glowDuration],
            [0, 1, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          );
          const glowScale = interpolate(
            glowT,
            [0, BOX.glowDuration],
            [0.4, 1.5],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          );
          const glowOpacity = glowProg * 0.75;

          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: p.x,
                top: boxY,
                width: p.totalWidth,
                height: boxH,
              }}
            >
              {/* Radial glow — sits behind the box, bigger than it. */}
              {glowOpacity > 0.01 && (
                <div
                  style={{
                    position: "absolute",
                    left: -BOX.glowRadius,
                    top: -BOX.glowRadius,
                    width: p.totalWidth + BOX.glowRadius * 2,
                    height: boxH + BOX.glowRadius * 2,
                    background: `radial-gradient(ellipse at center, ${BOX.glowColor}ee 0%, ${BOX.glowColor}55 22%, transparent 60%)`,
                    opacity: glowOpacity,
                    transform: `scale(${glowScale})`,
                    transformOrigin: "center",
                    pointerEvents: "none",
                    filter: "blur(6px)",
                  }}
                />
              )}
              {/* The box itself — scales from 0. */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: BOX.bg,
                  color: BOX.color,
                  borderRadius: BOX.borderRadius,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transform: `scale(${scale})`,
                  transformOrigin: "center center",
                  opacity,
                  boxShadow: `0 0 24px rgba(255,255,255,${0.15 * opacity})`,
                  filter: blurT < 0.99 ? `blur(${(1 - blurT) * blurPx}px)` : undefined,
                  willChange: "transform, opacity, filter",
                }}
              >
                {p.text}
              </div>
            </div>
          );
        }

        // Plain word path — rise from below, blur fades.
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
            {p.text}
          </span>
        );
      })}
    </div>
  );
};
