// cls-shared — the CLS logo (swirl mark + CLS letterforms). One corporate
// mark, used by BOTH explainer references (cls-day end card / intro;
// clsnet title box + endcard lockup).
//
// This is the shared home for the logo. Current state:
//   - cls-day mounts these components directly (moved verbatim from its
//     lib.tsx; geometry traced from the cls-day end card, viewBoxes
//     0 0 235 235 mark / 0 0 830 235 letters).
//   - clsnet still mounts its own potrace traces (art.ts logoMark/clsLogo)
//     — a measured lane placement; swapping it is a pixel change and
//     belongs to a quality round.
// Gen-6 quality work: re-trace the mark ONCE here at high fidelity, then
// rewire clsnet's logoMark/clsLogo usages to it, still-gating BOTH lanes
// (and both CRX cuts) at their logo frames.
import React from "react";
import { BRAND } from "./palette";

// ─── CLS swirl mark ───
// Traced from crop-mark (235×235). Built from stacked circles: white disc,
// navy cut disc offset up-left, white inner crescent, navy core, white
// bottom swoosh. viewBox 0 0 235 235.
export const ClsMark: React.FC<{ size: number; ink?: string; bg?: string }> = ({
  size,
  ink = "#FCFCFC",
  bg = BRAND.navy,
}) => (
  <svg width={size} height={size} viewBox="0 0 235 235">
    {/* outer crescent: big disc minus up-left-offset disc */}
    <path
      d="M 118 3
         A 114 114 0 1 1 61 216
         A 132 132 0 0 0 194 133
         A 100 100 0 0 0 62 30
         A 114 114 0 0 1 118 3 Z"
      fill={ink}
    />
    {/* inner crescent (left-heavy ring around the core) */}
    <path
      d="M 118 32
         A 92 92 0 1 0 174 196
         A 108 108 0 0 1 63 172
         A 80 80 0 0 1 63 62
         A 92 92 0 0 1 118 32 Z"
      fill={ink}
    />
    {/* core cut */}
    <ellipse cx="122" cy="117" rx="62" ry="72" fill={bg} />
    {/* bottom swoosh */}
    <path
      d="M 60 190
         A 96 96 0 0 0 175 196
         A 120 120 0 0 1 60 190 Z"
      fill={ink}
    />
  </svg>
);

// ─── CLS letterforms ───
// Traced from end-card column scans (strip x255..1076 → letters viewBox
// 0 0 830 235; C at 0..300, L at 300..470, S at 540..830 approx).
export const ClsLetters: React.FC<{ height: number; ink?: string }> = ({
  height,
  ink = "#FCFCFC",
}) => {
  const w = (height / 235) * 830;
  return (
    <svg width={w} height={height} viewBox="0 0 830 235">
      {/* C — bracket open right, hooked bar ends */}
      <path
        d="M 295 0
           L 100 0
           Q 0 0 0 100
           L 0 135
           Q 0 227 100 227
           L 262 227
           Q 297 227 302 196
           Q 290 202 260 202
           L 110 202
           Q 45 202 45 130
           L 45 105
           Q 45 44 110 44
           L 258 44
           Q 288 44 300 50
           Q 296 14 295 0 Z"
        fill={ink}
      />
      {/* L — stem top-left, bar right with beak end */}
      <path
        d="M 305 0
           L 350 0
           L 350 155
           Q 350 202 400 202
           L 570 202
           Q 600 202 612 190
           Q 618 214 622 227
           L 385 227
           Q 305 227 305 150
           L 305 0 Z"
        fill={ink}
      />
      {/* S — square s with round caps */}
      <path
        d="M 680 0
           L 790 0
           Q 796 20 800 44
           L 690 44
           Q 655 44 655 70
           Q 655 95 690 95
           L 755 95
           Q 830 95 830 155
           Q 830 227 745 227
           L 640 227
           Q 626 227 618 213
           Q 610 196 612 190
           Q 622 202 645 202
           L 740 202
           Q 785 202 785 160
           Q 785 137 745 137
           L 680 137
           Q 610 137 610 70
           Q 610 0 680 0 Z"
        fill={ink}
      />
    </svg>
  );
};

export const ClsWordmark: React.FC<{
  height: number;
  ink?: string;
  bg?: string;
  gap?: number;
}> = ({ height, ink = "#FCFCFC", bg = BRAND.navy, gap = 0.24 }) => (
  <div style={{ display: "flex", alignItems: "center", gap: height * gap }}>
    <ClsMark size={height} ink={ink} bg={bg} />
    <ClsLetters height={height * 0.97} ink={ink} />
  </div>
);
