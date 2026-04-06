import React from "react";
import { useCurrentFrame } from "remotion";
import {
  baseText,
  GREEN,
  LightBg,
  easeOutBack,
  progress,
  wordReveal,
  sceneFade,
  srand,
} from "../shared";

// ---------------------------------------------------------------------------
// Dot-matrix bitmaps for "6" and "3"
// 6 columns x 7 rows — wider than a standard 5x7 to match the reference's
// roomy, rounded letterforms. Each cell: 1 = green dot, 0 = empty.
// ---------------------------------------------------------------------------

const DIGIT_6: number[][] = [
  [0, 1, 1, 1, 1, 0],
  [1, 1, 0, 0, 0, 0],
  [1, 0, 0, 0, 0, 0],
  [1, 1, 1, 1, 1, 0],
  [1, 0, 0, 0, 1, 1],
  [1, 0, 0, 0, 0, 1],
  [0, 1, 1, 1, 1, 0],
];

const DIGIT_3: number[][] = [
  [0, 1, 1, 1, 1, 0],
  [0, 0, 0, 0, 1, 1],
  [0, 0, 0, 0, 0, 1],
  [0, 0, 1, 1, 1, 0],
  [0, 0, 0, 0, 1, 1],
  [0, 0, 0, 0, 0, 1],
  [0, 1, 1, 1, 1, 0],
];

const DOT_SIZE = 20;
const DOT_GAP = 52; // center-to-center — wider than 44 to fill the 1920 canvas

function digitDots(
  bitmap: number[][],
  originX: number,
  originY: number,
): { x: number; y: number }[] {
  const dots: { x: number; y: number }[] = [];
  for (let row = 0; row < bitmap.length; row++) {
    for (let col = 0; col < bitmap[row].length; col++) {
      if (bitmap[row][col]) {
        dots.push({
          x: originX + col * DOT_GAP,
          y: originY + row * DOT_GAP,
        });
      }
    }
  }
  return dots;
}

// Decorative scatter dots — seeded, biased toward edges and below the text
function scatterDots(count: number, seed: number): { x: number; y: number }[] {
  const dots: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    const rx = srand(seed + i * 7.3);
    const ry = srand(seed + i * 13.1 + 99);
    let x: number;
    let y: number;
    const zone = i % 5;
    if (zone === 0) {
      // Far left strip
      x = 50 + rx * 200;
      y = 380 + ry * 300;
    } else if (zone === 1) {
      // Far right strip
      x = 1660 + rx * 200;
      y = 340 + ry * 340;
    } else if (zone === 2) {
      // Bottom band
      x = 250 + rx * 1420;
      y = 700 + ry * 100;
    } else if (zone === 3) {
      // Below-center band
      x = 300 + rx * 1320;
      y = 640 + ry * 80;
    } else {
      // Upper-center sparse
      x = 400 + rx * 1120;
      y = 250 + ry * 60;
    }
    dots.push({ x, y });
  }
  return dots;
}

// Digit origins — "6" left of center, "3" right of center, both vertically
// centered so that row 3 (the middle bar) aligns with the text baseline
const DIGIT_6_X = 420;
const DIGIT_6_Y = 240;
const DIGIT_3_X = 1120;
const DIGIT_3_Y = 240;

const ALL_DOTS: { x: number; y: number }[] = [
  ...digitDots(DIGIT_6, DIGIT_6_X, DIGIT_6_Y),
  ...digitDots(DIGIT_3, DIGIT_3_X, DIGIT_3_Y),
  ...scatterDots(30, 42),
];

// Deterministic stagger order via seeded Fisher-Yates
const DOT_ORDER: number[] = ALL_DOTS.map((_, i) => i);
for (let i = DOT_ORDER.length - 1; i > 0; i--) {
  const j = Math.floor(srand(i * 31.7 + 5) * (i + 1));
  [DOT_ORDER[i], DOT_ORDER[j]] = [DOT_ORDER[j], DOT_ORDER[i]];
}

const WORDS = ["with", "an", "average", "accuracy", "of", "about"];

const TOTAL = 150;
const DOTS_START = 5;
const DOTS_STAGGER = 1.1; // ~1 frame between each pop-in
const TEXT_START = 30;
const TEXT_STAGGER = 5;

export const Scene12_AccuracyDots: React.FC = () => {
  const frame = useCurrentFrame();
  const fade = sceneFade(frame, TOTAL, 10, 10);

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", opacity: fade }}>
      <LightBg />

      {/* Green dots — digits + scatter */}
      {ALL_DOTS.map((dot, i) => {
        const order = DOT_ORDER.indexOf(i);
        const enterFrame = DOTS_START + order * DOTS_STAGGER;
        const p = progress(frame, enterFrame, 8);
        const scale = p > 0 ? easeOutBack(p, 2.5) : 0;
        const dotOpacity = Math.min(1, p * 2);

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: dot.x - DOT_SIZE / 2,
              top: dot.y - DOT_SIZE / 2,
              width: DOT_SIZE,
              height: DOT_SIZE,
              borderRadius: "50%",
              backgroundColor: GREEN,
              transform: `scale(${scale})`,
              opacity: dotOpacity,
              willChange: "transform, opacity",
            }}
          />
        );
      })}

      {/* Center text */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: 18,
          whiteSpace: "nowrap",
        }}
      >
        {WORDS.map((word, i) => {
          const enterFrame = TEXT_START + i * TEXT_STAGGER;
          const { opacity, y } = wordReveal(frame, enterFrame, 6);

          return (
            <span
              key={i}
              style={{
                ...baseText,
                fontSize: 54,
                fontWeight: 700,
                fontStyle: "italic",
                color: "#000",
                opacity,
                transform: `translateY(${y}px)`,
                display: "inline-block",
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    </div>
  );
};
