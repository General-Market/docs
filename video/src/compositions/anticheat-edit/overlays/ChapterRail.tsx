// ChapterRail — the vertical chapter board down the right edge.
//
// A tall blue panel: a hazard-stripe band at the top, then big numbers stacked
// down the column — "01 Colocation", "02 Unfair Fee Tiers"… The live chapter is
// bright white and PINNED at the second visible slot; the ones behind it sit
// above as ghosts, the ones ahead below. As the talk crosses into a new
// mechanism the whole column scrolls up one cell, so the live number always
// rises to that same pinned slot — and the count climbs until there is no more.
//
// The board claims the right ~30% of frame (RAIL_W). AntiCheatLayout eases the
// head + panels into the remaining width by the same presence curve, so the
// speaker is never hidden behind it. It slides in before mechanism 01 and out
// at the turn.

import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { font } from "../../../common/fonts";
import { CHAPTERS, RAIL_W, railPresence } from "./chapters";

// One chapter cell's vertical pitch, the first slot's top, and how long the
// column takes to scroll one cell when a new mechanism begins.
const CELL_H = 234;
const TOP_PAD = 64;
const PAD_L = 52;
const PAD_R = 28;
const SCROLL_DUR = 0.55; // seconds
const HAZARD_H = 40;

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));
const smoothstep = (a: number, b: number, x: number): number => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export const ChapterRail: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const sec = frame / fps;

  const presence = railPresence(sec);
  if (presence <= 0.001) return null;

  // Current chapter — the last whose start has passed (-1 during the lead-in).
  let current = -1;
  for (let i = 0; i < CHAPTERS.length; i++) {
    if (sec >= CHAPTERS[i].at) current = i;
    else break;
  }

  // Continuous scroll index: ease from (current-1) to current over SCROLL_DUR
  // after each boundary, so the live chapter rises into the pinned 2nd slot.
  const floatIndex =
    current < 0
      ? -1
      : current - 1 + smoothstep(CHAPTERS[current].at, CHAPTERS[current].at + SCROLL_DUR, sec);

  // Land cell[floatIndex] at slot 1 (the SECOND slot, top = TOP_PAD + CELL_H).
  const translateY = TOP_PAD + (1 - floatIndex) * CELL_H;

  // The board slides in from the right edge by the shared presence curve.
  const slideX = (1 - presence) * RAIL_W;

  // Slow drift on the hazard stripes — never fully static.
  const hazardShift = (frame * 0.7) % 56;

  return (
    <AbsoluteFill style={{ pointerEvents: "none", fontFamily: font }}>
      <div
        style={{
          position: "absolute",
          left: W - RAIL_W,
          top: 0,
          width: RAIL_W,
          height: H,
          transform: `translateX(${slideX.toFixed(1)}px)`,
        }}
      >
        {/* Panel background — a deep Base-blue gradient, lifted off the head by
            a soft left shadow. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(160deg, #1E6BFF 0%, #0A52F0 46%, #003BC2 100%)",
            boxShadow: "-26px 0 60px rgba(0,0,0,0.38)",
          }}
        />

        {/* The scrolling column of chapters, masked so cells fade as they near
            the top and bottom edges. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            overflow: "hidden",
            WebkitMaskImage:
              "linear-gradient(180deg, transparent 0%, #000 9%, #000 82%, transparent 100%)",
            maskImage:
              "linear-gradient(180deg, transparent 0%, #000 9%, #000 82%, transparent 100%)",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: "100%",
              transform: `translateY(${translateY.toFixed(1)}px)`,
            }}
          >
            {CHAPTERS.map((ch, i) => {
              const isActive = i === current;
              return (
                <div
                  key={ch.n}
                  style={{
                    position: "absolute",
                    top: i * CELL_H,
                    left: 0,
                    width: "100%",
                    height: CELL_H,
                    paddingLeft: PAD_L,
                    paddingRight: PAD_R,
                    boxSizing: "border-box",
                  }}
                >
                  <div
                    style={{
                      fontSize: 132,
                      fontWeight: 800,
                      lineHeight: 0.9,
                      letterSpacing: "-0.04em",
                      fontVariantNumeric: "tabular-nums",
                      color: isActive ? "#FFFFFF" : "rgba(255,255,255,0.20)",
                      textShadow: isActive ? "0 2px 26px rgba(255,255,255,0.22)" : "none",
                    }}
                  >
                    {String(ch.n).padStart(2, "0")}
                  </div>
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 28,
                      fontWeight: 600,
                      lineHeight: 1.1,
                      letterSpacing: "-0.01em",
                      color: isActive ? "#FFFFFF" : "rgba(255,255,255,0.34)",
                      maxWidth: RAIL_W - PAD_L - PAD_R,
                    }}
                  >
                    {ch.name}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Hazard band, over the column — the caution-tape header. */}
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
            backgroundPositionX: `${hazardShift.toFixed(1)}px`,
            opacity: 0.92,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
