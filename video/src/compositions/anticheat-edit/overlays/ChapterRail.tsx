// ChapterRail — the full-height chapter board on the right edge.
//
// A tall blue strip, hazard stripes on top, big numbers stacked down it — ~4.5
// visible — names beneath, the live mechanism PINNED at the second slot. It is
// transient: slides in at a chapter change, holds ~3s, slides out, and the head
// eases clear of it (AntiCheatLayout reads chapterCardPresence).
//
// The switch reads as MOVEMENT: a white square sits fixed at the second slot;
// the numbers CLIMB through it, so the previous number rolls up and out and the
// next one rolls in. The digit inside the white square is painted blue by a
// second copy of the column, clipped to the square — so whatever number is in
// the square is the highlighted one, mid-roll included.

import React from "react";
import {
  AbsoluteFill,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { font } from "../../../common/fonts";
import { CHAPTERS, BOARD_W, CARD_SLIDE, activeChapterCard } from "./chapters";

const CELL_H = 232; // vertical pitch — ~4.5 cells fill 1080
const TOP_PAD = 64;
const PAD_L = 52;
const PAD_R = 28;
const HAZARD_H = 38;
const NUM_SIZE = 132;

// The fixed white highlight at the second slot (where the live number rests).
const BOX_TOP = TOP_PAD + CELL_H - 12;
const BOX_H = 138;
const BOX_LEFT = PAD_L - 18;
const BOX_W = 210;

const ACCENT = "#2D5BFF";

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));
const smoothstep = (a: number, b: number, x: number): number => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

const numStyle = (color: string): React.CSSProperties => ({
  fontSize: NUM_SIZE,
  fontWeight: 800,
  lineHeight: 0.9,
  letterSpacing: "-0.04em",
  fontVariantNumeric: "tabular-nums",
  color,
});

export const ChapterRail: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const sec = frame / fps;

  const card = activeChapterCard(sec);
  if (!card) return null;

  const { chapterIdx, start, end } = card;

  // Slide the whole board in from the right, out at the end.
  const appear = smoothstep(start, start + CARD_SLIDE, sec);
  const leave = smoothstep(end - CARD_SLIDE, end, sec);
  const slideX = (1 - appear) * BOARD_W + leave * BOARD_W;

  // The column climbs one notch as the board lands: it begins with the previous
  // chapter under the white square and rolls up so the live one arrives there.
  const climb = spring({
    frame: (sec - start) * fps,
    fps,
    config: { damping: 18, mass: 0.7, stiffness: 130 },
    durationInFrames: Math.round(0.7 * fps),
  });
  const floatIndex = chapterIdx - 1 + climb;
  const translateY = TOP_PAD + (1 - floatIndex) * CELL_H;

  const maskFade =
    "linear-gradient(180deg, transparent 0%, #000 9%, #000 82%, transparent 100%)";

  // The column of numbers, rendered in a given colour — used twice: ghost in the
  // strip, blue inside the clipped white square.
  const numberColumn = (color: string) =>
    CHAPTERS.map((c, i) => (
      <div key={c.n} style={{ position: "absolute", top: i * CELL_H, left: PAD_L, ...numStyle(color) }}>
        {String(c.n).padStart(2, "0")}
      </div>
    ));

  return (
    <AbsoluteFill style={{ pointerEvents: "none", fontFamily: font }}>
      <div
        style={{
          position: "absolute",
          left: W - BOARD_W,
          top: 0,
          width: BOARD_W,
          height: H,
          transform: `translateX(${slideX.toFixed(1)}px)`,
          background: "linear-gradient(160deg, #1E6BFF 0%, #0A52F0 46%, #003BC2 100%)",
          boxShadow: "-26px 0 60px rgba(0,0,0,0.40)",
        }}
      >
        {/* Masked viewport: ghost numbers + names, climbing. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            overflow: "hidden",
            WebkitMaskImage: maskFade,
            maskImage: maskFade,
          }}
        >
          {/* Ghost numbers. */}
          <div style={{ position: "absolute", inset: 0, transform: `translateY(${translateY.toFixed(1)}px)` }}>
            {numberColumn("rgba(255,255,255,0.20)")}
          </div>
          {/* Names — the live one bright, the rest faint. */}
          <div style={{ position: "absolute", inset: 0, transform: `translateY(${translateY.toFixed(1)}px)` }}>
            {CHAPTERS.map((c, i) => (
              <div
                key={c.n}
                style={{
                  position: "absolute",
                  top: i * CELL_H + NUM_SIZE * 0.9 + 8,
                  left: PAD_L,
                  width: BOARD_W - PAD_L - PAD_R,
                  fontSize: 28,
                  fontWeight: 600,
                  lineHeight: 1.1,
                  letterSpacing: "-0.01em",
                  color: i === chapterIdx ? "#FFFFFF" : "rgba(255,255,255,0.34)",
                }}
              >
                {c.name}
              </div>
            ))}
          </div>
        </div>

        {/* The fixed white square at the second slot. */}
        <div
          style={{
            position: "absolute",
            top: BOX_TOP,
            left: BOX_LEFT,
            width: BOX_W,
            height: BOX_H,
            borderRadius: 22,
            background: "#FFFFFF",
            boxShadow: "0 16px 44px rgba(0,0,0,0.30)",
          }}
        />
        {/* The number inside the square, painted blue — a second copy of the
            column clipped to the white box, so whatever digit is in the square
            (mid-roll included) reads as the highlighted one. */}
        <div
          style={{
            position: "absolute",
            top: BOX_TOP,
            left: BOX_LEFT,
            width: BOX_W,
            height: BOX_H,
            overflow: "hidden",
            borderRadius: 22,
          }}
        >
          <div
            style={{
              position: "absolute",
              top: -BOX_TOP,
              left: -BOX_LEFT,
              width: BOARD_W,
              height: H,
              transform: `translateY(${translateY.toFixed(1)}px)`,
            }}
          >
            {numberColumn(ACCENT)}
          </div>
        </div>

        {/* Hazard band, over everything. */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: "100%",
            height: HAZARD_H,
            backgroundImage:
              "repeating-linear-gradient(135deg, #FFFFFF 0 16px, transparent 16px 34px)",
            backgroundSize: "56px 56px",
            backgroundPositionX: `${((frame * 0.7) % 56).toFixed(1)}px`,
            opacity: 0.92,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
