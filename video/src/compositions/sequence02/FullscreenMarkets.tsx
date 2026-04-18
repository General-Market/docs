/**
 * FullscreenMarkets — covers scenes 7 and 8 (46.48–60.56s transcript) with
 * full-frame grids adapted from Launch30. No webcam visible here; we don't
 * have usable camera footage during this span anyway.
 *
 * Visual cadence:
 *   46.48 → 49.36  MegaGrid   "Quantity has protection / against insiders."
 *   49.36 → 52.00  MegaGrid   "Trade 500,000 exclusive markets"   (SLAM)
 *   52.00 → 54.24  MegaGrid   "No one could provide liquidity before"
 *   54.24 → 54.88  Twitch     "Twitch"
 *   54.88 → 56.24  Pump.fun   "shorting meme coins"
 *   56.24 → 56.96  Animals    "animal"
 *   56.96 → 57.68  Movies     "movies"
 *   57.68 → 60.56  MegaGrid   "with parameter settlement / every 10 minutes"
 *
 * Every word lands on its parakeet token start. `atSec` values are raw
 * transcript seconds — `toFrames` applies the splice offset for us.
 */

import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { font } from "../../common/fonts";
import { SOURCES } from "../launch/data/sources";
import { PLACEHOLDER_COLORS } from "../launch/brollAssets";
import { BrollCell } from "../launch/shots/BrollCell";
import { toFrames } from "./theme";

// ── Grid backdrops ──────────────────────────────────────────────────────────

const TILT_X = 12;
const GRID_SCALE = 1.15;
const SCROLL_SPEED = 0.6;

interface GridBgProps {
  /** Composition-absolute frame when this segment mounted. */
  startFrame: number;
}

const MegaGridBg: React.FC<GridBgProps> = ({ startFrame }) => {
  const frame = useCurrentFrame();
  const scrollY = Math.max(0, frame - startFrame) * SCROLL_SPEED;
  const cols = 10;
  const rows = 10;
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
            transform: `rotateX(${TILT_X}deg) scale(${GRID_SCALE}) translateY(${-scrollY}px)`,
            transformStyle: "preserve-3d",
          }}
        >
          {Array.from({ length: count }).map((_, i) => {
            const source = SOURCES[i % SOURCES.length];
            const logoSrc = source.logo.startsWith("/")
              ? source.logo.slice(1)
              : source.logo;
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

      {/* Soft vignette — dark edges, clear center so the grid breathes. */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0) 30%, rgba(0,0,0,0.45) 100%)",
        }}
      />
    </>
  );
};

interface BrollGridBgProps extends GridBgProps {
  category: "twitch" | "pumpfun" | "movies" | "animals";
}

const BrollGridBg: React.FC<BrollGridBgProps> = ({ category, startFrame }) => {
  const frame = useCurrentFrame();
  const scrollY = Math.max(0, frame - startFrame) * SCROLL_SPEED;
  const cols = 8;
  const rows = 6;
  const colors = PLACEHOLDER_COLORS[category] ?? ["#444"];
  const cellW = 100 / cols;
  const cellH = 100 / rows;

  const cells: { x: number; y: number; i: number }[] = [];
  let idx = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push({ x: c * cellW, y: r * cellH, i: idx });
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
            transform: `rotateX(${TILT_X}deg) scale(${GRID_SCALE}) translateY(${-scrollY}px)`,
            transformStyle: "preserve-3d",
          }}
        >
          {cells.map(({ x, y, i }) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: `${x}%`,
                top: `${y}%`,
                width: `${cellW}%`,
                height: `${cellH}%`,
                backgroundColor: colors[i % colors.length],
                overflow: "hidden",
                padding: 1.5,
                boxSizing: "border-box",
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: 4,
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                <BrollCell category={category} index={i} />
              </div>
            </div>
          ))}
        </AbsoluteFill>
      </div>

      {/* Soft vignette only — colored cells stay readable as background. */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0) 30%, rgba(0,0,0,0.45) 100%)",
        }}
      />
    </>
  );
};

// ── Word-by-word text, tied to transcript timestamps ────────────────────────

interface TimedWord {
  /** Transcript time the word appears. */
  atSec: number;
  text: string;
  /** Emit a line break after this word. */
  br?: boolean;
}

interface WordCascadeProps {
  words: TimedWord[];
  fontSize: number;
  fontWeight?: number;
  color?: string;
  lineHeight?: number;
  /** Entry animation length in frames per word. */
  entryFrames?: number;
  /** Rise distance in px. */
  rise?: number;
  /** Max entry blur in px. */
  blurPx?: number;
}

const EASE = Easing.bezier(0.16, 1, 0.3, 1);

const WordCascade: React.FC<WordCascadeProps> = ({
  words,
  fontSize,
  fontWeight = 900,
  color = "#ffffff",
  lineHeight,
  entryFrames = 10,
  rise = 40,
  blurPx = 10,
}) => {
  const frame = useCurrentFrame();
  const lh = lineHeight ?? Math.round(fontSize * 1.1);

  // Group words into lines based on the `br` flag.
  const lines: TimedWord[][] = [[]];
  for (const w of words) {
    lines[lines.length - 1].push(w);
    if (w.br) lines.push([]);
  }
  // Drop trailing empty line (happens when last word has br:true).
  if (lines[lines.length - 1].length === 0) lines.pop();

  return (
    <div
      style={{
        fontFamily: font,
        fontSize,
        fontWeight,
        color,
        letterSpacing: "-0.02em",
        lineHeight: 1.1,
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
            lineHeight: `${lh}px`,
          }}
        >
          {line.map((w, wi) => {
            const appearF = toFrames(w.atSec);
            const t = Math.max(0, frame - appearF);
            const progress = interpolate(t, [0, entryFrames], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: EASE,
            });
            const dy = (1 - progress) * rise;
            const blur = (1 - progress) * blurPx;
            const opacity = frame >= appearF ? progress : 0;
            return (
              <span
                key={wi}
                style={{
                  display: "inline-block",
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

// ── Segment definitions ─────────────────────────────────────────────────────

interface Segment {
  startSec: number;
  endSec: number;
  bg: "mega" | "twitch" | "pumpfun" | "animals" | "movies";
  words: TimedWord[];
  fontSize: number;
}

const SEGMENTS: Segment[] = [
  // 46.48 → 49.36  "Quantity has protection against insiders."
  {
    startSec: 46.48,
    endSec: 49.36,
    bg: "mega",
    fontSize: 96,
    words: [
      { atSec: 46.48, text: "Quantity" },
      { atSec: 47.04, text: "has" },
      { atSec: 47.36, text: "protection", br: true },
      { atSec: 47.92, text: "against" },
      { atSec: 48.40, text: "insiders." },
    ],
  },
  // 49.36 → 52.00  "Trade 500,000 exclusive markets" — the SLAM
  {
    startSec: 49.36,
    endSec: 52.00,
    bg: "mega",
    fontSize: 160,
    words: [
      { atSec: 49.36, text: "Trade", br: true },
      { atSec: 50.08, text: "500,000", br: true },
      { atSec: 50.80, text: "exclusive" },
      { atSec: 51.44, text: "markets" },
    ],
  },
  // 52.00 → 54.24  "No one could provide liquidity before"
  {
    startSec: 52.00,
    endSec: 54.24,
    bg: "mega",
    fontSize: 84,
    words: [
      { atSec: 52.00, text: "No" },
      { atSec: 52.24, text: "one" },
      { atSec: 52.48, text: "could", br: true },
      { atSec: 52.64, text: "provide" },
      { atSec: 52.96, text: "liquidity" },
      { atSec: 53.60, text: "before" },
    ],
  },
  // 54.24 → 54.88  Twitch
  {
    startSec: 54.24,
    endSec: 54.88,
    bg: "twitch",
    fontSize: 220,
    words: [{ atSec: 54.24, text: "Twitch" }],
  },
  // 54.88 → 56.24  shorting meme coins
  {
    startSec: 54.88,
    endSec: 56.24,
    bg: "pumpfun",
    fontSize: 160,
    words: [
      { atSec: 54.88, text: "shorting", br: true },
      { atSec: 55.36, text: "meme" },
      { atSec: 55.68, text: "coins" },
    ],
  },
  // 56.24 → 56.96  animal
  {
    startSec: 56.24,
    endSec: 56.96,
    bg: "animals",
    fontSize: 220,
    words: [{ atSec: 56.24, text: "animals" }],
  },
  // 56.96 → 57.68  movies
  {
    startSec: 56.96,
    endSec: 57.68,
    bg: "movies",
    fontSize: 220,
    words: [{ atSec: 56.96, text: "movies" }],
  },
  // 57.68 → 60.56  "with parameter settlement every 10 minutes"
  {
    startSec: 57.68,
    endSec: 60.56,
    bg: "mega",
    fontSize: 92,
    words: [
      { atSec: 57.68, text: "with" },
      { atSec: 57.92, text: "parameter" },
      { atSec: 58.96, text: "settlement", br: true },
      { atSec: 59.60, text: "every" },
      { atSec: 59.84, text: "10" },
      { atSec: 60.08, text: "minutes." },
    ],
  },
];

const SegmentView: React.FC<{ segment: Segment }> = ({ segment }) => {
  const startFrame = toFrames(segment.startSec);
  const bg =
    segment.bg === "mega" ? (
      <MegaGridBg startFrame={startFrame} />
    ) : (
      <BrollGridBg category={segment.bg} startFrame={startFrame} />
    );
  return (
    <AbsoluteFill>
      {bg}
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          padding: 80,
        }}
      >
        <WordCascade words={segment.words} fontSize={segment.fontSize} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ── Mount ───────────────────────────────────────────────────────────────────

export const FullscreenMarkets: React.FC = () => {
  const frame = useCurrentFrame();
  const active = SEGMENTS.find(
    (s) => frame >= toFrames(s.startSec) && frame < toFrames(s.endSec),
  );
  if (!active) return null;
  return <SegmentView segment={active} />;
};
