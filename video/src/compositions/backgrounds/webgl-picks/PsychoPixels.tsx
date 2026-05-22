// Source: an SVGanima walkthrough — a notebook page on a stack of paper cards
// with an animated dashed line that walks through numbered checkpoints, finally
// resolving into the full final stroke. The original drives stroke-dashoffset
// via SMIL <animate>; here we drive it by frame.

import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

type Stroke = {
  // SVG <path d> string
  d: string;
  // Approx length in user units. Used to know how much dasharray to use.
  len: number;
  // 0..1 frame fraction at which to start drawing
  start: number;
  // 0..1 frame fraction at which the draw should complete
  end: number;
};

// The 20 stroke segments (rough fit to the original geometry).
// Most are straight or gentle arcs of the big spiral path. We use approximate
// lengths so dasharray works without measuring the DOM.
const STROKES: Stroke[] = [
  { d: "M 17 13 H 562 V 568 H 17 Z", len: 2200, start: 0.0, end: 0.07 },
  { d: "M 280 80 H 561 V 280", len: 540, start: 0.07, end: 0.13 },
  { d: "M 561 280 L 280 568", len: 410, start: 0.13, end: 0.19 },
  { d: "M 280 568 C 280 400 380 280 561 280", len: 460, start: 0.19, end: 0.25 },
  { d: "M 561 280 H 901", len: 340, start: 0.25, end: 0.31 },
  { d: "M 901 280 V 568", len: 290, start: 0.31, end: 0.37 },
  { d: "M 901 280 C 901 100 720 19 561 19", len: 530, start: 0.37, end: 0.44 },
  { d: "M 561 19 H 901", len: 340, start: 0.44, end: 0.50 },
  { d: "M 901 19 V 280 C 901 380 800 470 691 470", len: 470, start: 0.50, end: 0.57 },
  { d: "M 691 470 V 568", len: 100, start: 0.57, end: 0.62 },
  { d: "M 691 470 C 800 470 691 280 561 280", len: 280, start: 0.62, end: 0.68 },
  { d: "M 691 470 H 561", len: 130, start: 0.68, end: 0.73 },
  { d: "M 561 470 C 700 470 641 360 641 280", len: 240, start: 0.73, end: 0.78 },
  { d: "M 641 470 V 280", len: 190, start: 0.78, end: 0.82 },
  { d: "M 641 470 C 700 470 691 410 691 360", len: 150, start: 0.82, end: 0.86 },
  { d: "M 641 360 H 691", len: 50, start: 0.86, end: 0.89 },
  { d: "M 691 360 C 700 360 661 360 661 330", len: 50, start: 0.89, end: 0.92 },
  { d: "M 661 330 V 360", len: 30, start: 0.92, end: 0.94 },
  { d: "M 661 330 C 661 320 666 320 666 330", len: 20, start: 0.94, end: 0.96 },
  { d: "M 666 330 H 661", len: 12, start: 0.96, end: 0.98 },
];

const FINAL_PATH =
  "M 18.9 563.15 c 0 -298.3 245.5 -543.75 543.94 -543.75 c 184.43 0 336.19 151.7 336.19 336.07 c 0 113.93 -93.78 207.68 -207.76 207.68 c -70.46 0 -128.43 -57.95 -128.43 -128.38 c 0 -43.5 35.8 -79.3 79.32 -79.3 c 26.94 0 49.11 22.16 49.11 49.09 c 0 16.57 -13.64 30.2 -30.22 30.2 c -10.36 0 -18.89 -8.52 -18.89 -18.88 c 0 -6.21 5.12 -11.33 11.33 -11.33";

export const PsychoPixels: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  // Skip the first 5% (intro stillness) and stop drawing at 95%
  const t = Math.min(1, Math.max(0, (frame / durationInFrames - 0.05) / 0.9));

  // The final composite curve sweeps in once everything else has finished
  const finalT = Math.min(1, Math.max(0, (t - 0.78) / 0.2));

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(10deg, #ccc, #f5f5f5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Paper stack — three cards rotated behind */}
      <PaperStack>
        <svg
          viewBox="0 0 1000 580"
          style={{ width: "100%", height: "100%", display: "block" }}
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <radialGradient id="r_psycho" cx="50%" cy="50%" r="60%">
              <stop offset="0%" stopColor="#1c4d80" />
              <stop offset="100%" stopColor="#002352" />
            </radialGradient>
          </defs>
          <rect x={195} y={20} width={620} height={555} rx={6} fill="url(#r_psycho)" />
          {/* Dashed path strokes — drawn frame by frame */}
          {STROKES.map((s, i) => {
            const local = Math.min(1, Math.max(0, (t - s.start) / (s.end - s.start)));
            const drawn = local * s.len;
            return (
              <path
                key={i}
                d={s.d}
                fill="none"
                stroke="#e1e1e1"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={`${drawn} ${s.len}`}
                transform="translate(108 70)"
              />
            );
          })}
          {/* Final flourish — full vector swept on top */}
          <path
            d={FINAL_PATH}
            fill="none"
            stroke="#fff"
            strokeWidth={7}
            strokeLinecap="round"
            strokeLinejoin="miter"
            strokeMiterlimit={4}
            strokeDasharray={`${2205 * finalT} 2205`}
            transform="translate(108 70)"
            opacity={finalT > 0 ? 1 : 0}
          />
        </svg>
      </PaperStack>
    </AbsoluteFill>
  );
};

const PaperStack: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      position: "relative",
      transform: "rotate(-2deg)",
      background: "#fff",
      width: "min(78vw, 1500px)",
      aspectRatio: "1000 / 580",
      boxShadow: "-12px 12px 32px rgba(0,0,0,.3)",
      backgroundImage:
        "linear-gradient(to bottom,#fff calc(20px - 1px),#ccc calc(20px - 1px),#ccc 20px,#fff 20px)",
      backgroundSize: "100% 20px",
      backgroundRepeat: "repeat-y",
    }}
  >
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "#fff",
        transform: "rotate(-4deg)",
        zIndex: -1,
        boxShadow: "-12px 12px 32px rgba(0,0,0,.1)",
      }}
    />
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "#fff",
        transform: "rotate(5deg)",
        zIndex: -2,
        boxShadow: "-12px 12px 32px rgba(0,0,0,.1)",
      }}
    />
    {children}
  </div>
);
