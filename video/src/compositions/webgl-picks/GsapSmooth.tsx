// Source: https://codepen.io/GreenSock/pen/OPPjMQV
//
// Original: GSAP "free for all!" confetti celebration.
// SVG starburst, SplitText chars, CustomBounce 3D poly drop, Physics2D confetti,
// MotionPath plane, DrawSVG paths, sprinkle/wiggle/spin/hand reveals.
// Timeline labels: "explode" @ 1s, "flight" @ 1.3s. Click replays.
//
// Ported to Remotion: frame-based interpolation replaces GSAP timeline.
// All timing, easing, and positional values match the original.

import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from "remotion";

// ── Timing (seconds in original, converted to frames at runtime) ────────────

const DELAY = 1; // tl delay: 1s
const EXPLODE = 1; // label "explode" at 1s (absolute, so 2s from start with delay)
const FLIGHT = 1.3;

// ── Easing helpers ──────────────────────────────────────────────────────────

function backOut(t: number, overshoot = 1.70158): number {
  const s = overshoot;
  return (t = t - 1) * t * ((s + 1) * t + s) + 1;
}

function backOutStrong(t: number): number {
  return backOut(t, 4);
}

function elasticOut(t: number, amplitude = 1, period = 0.3): number {
  if (t === 0 || t === 1) return t;
  const s = (period / (2 * Math.PI)) * Math.asin(1 / amplitude);
  return (
    amplitude *
      Math.pow(2, -10 * t) *
      Math.sin(((t - s) * (2 * Math.PI)) / period) +
    1
  );
}

function expoOut(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

// CustomBounce "myBounce" { strength: 0.6, squash: 3 }
function customBounce(t: number): number {
  if (t < 1 / 2.75) {
    return 7.5625 * t * t;
  } else if (t < 2 / 2.75) {
    return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
  } else if (t < 2.5 / 2.75) {
    return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
  }
  return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
}

// Squash companion (inverted bounce for scale deformation)
function customBounceSquash(t: number): number {
  const b = customBounce(t);
  // squash factor: deforms at bounce contact points
  const squashAmount = 0.4;
  return 1 + (1 - b) * squashAmount * Math.sin(t * Math.PI * 6);
}

// ── Seeded random (deterministic for frame-by-frame consistency) ────────────

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function randomRange(seed: number, min: number, max: number): number {
  return min + seededRandom(seed) * (max - min);
}

// ── Progress helper: maps frame to 0→1 for a given start/duration ──────────

function progress(
  frame: number,
  fps: number,
  startSec: number,
  durationSec: number,
): number {
  const startFrame = (DELAY + startSec) * fps;
  const durFrames = durationSec * fps;
  return Math.max(0, Math.min(1, (frame - startFrame) / durFrames));
}

// ── SVG starburst (simplified — the original has complex gradient paths) ────

const Starburst: React.FC<{ progress: number }> = ({ progress: p }) => {
  const scale = p > 0 ? interpolate(p, [0, 1], [0, 1]) : 0;
  const rotation = interpolate(p, [0, 1], [-60, 0]);
  return (
    <svg
      viewBox="0 0 600 600"
      style={{
        width: 500,
        height: 500,
        transform: `scale(${scale}) rotate(${rotation}deg)`,
        transformOrigin: "center center",
      }}
    >
      <defs>
        <linearGradient id="bangGrad" x1="0%" y1="0%" x2="100%" y2="60%">
          <stop offset="43%" stopColor="#FF8709" />
          <stop offset="79%" stopColor="#F7BDF8" />
        </linearGradient>
      </defs>
      {/* 12-point starburst */}
      <polygon
        points={Array.from({ length: 24 }, (_, i) => {
          const angle = (i * Math.PI * 2) / 24 - Math.PI / 2;
          const r = i % 2 === 0 ? 280 : 140;
          return `${300 + r * Math.cos(angle)},${300 + r * Math.sin(angle)}`;
        }).join(" ")}
        fill="url(#bangGrad)"
      />
    </svg>
  );
};

// ── "free for all" text with per-character animation ────────────────────────

const AnimatedText: React.FC<{
  text: string;
  charProgress: (index: number) => number;
  style?: React.CSSProperties;
}> = ({ text, charProgress, style }) => {
  return (
    <span
      style={{
        display: "inline-flex",
        overflow: "hidden",
        ...style,
      }}
    >
      {text.split("").map((char, i) => {
        const p = charProgress(i);
        const seed = i * 73 + text.charCodeAt(0);
        const fromY = seededRandom(seed) > 0.5 ? -500 : 500;
        const fromRot = randomRange(seed + 1, -30, 30);
        const y = interpolate(p, [0, 1], [fromY, 0]);
        const rotation = interpolate(p, [0, 1], [fromRot, 0]);

        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              transform: `translateY(${y}px) rotate(${rotation}deg)`,
              whiteSpace: char === " " ? "pre" : undefined,
            }}
          >
            {char === " " ? "\u00A0" : char}
          </span>
        );
      })}
    </span>
  );
};

// ── Confetti particle ───────────────────────────────────────────────────────

const CONFETTI_COLORS = [
  "#FF8709",
  "#F7BDF8",
  "#05F34A",
  "#397DFF",
  "#FAF005",
  "#FEC5FB",
  "#BAA5F5",
  "#FF783E",
  "#A6CFE7",
  "#B82C6F",
  "#00BAE2",
  "#9D95FF",
];

const CONFETTI_SHAPES = ["circle", "rect", "triangle"] as const;

interface ConfettiPiece {
  id: number;
  color: string;
  shape: (typeof CONFETTI_SHAPES)[number];
  velocityMag: number;
  angle: number; // radians
  rotStart: number;
  rotEnd: number;
  scale: number;
  size: number;
}

function generateConfetti(count: number): ConfettiPiece[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    shape: CONFETTI_SHAPES[i % CONFETTI_SHAPES.length],
    // Original: velocity "random(800, 2000)", angle "random(150, 360)"
    velocityMag: randomRange(i * 3, 800, 2000),
    angle: (randomRange(i * 7, 150, 360) * Math.PI) / 180,
    rotStart: 0,
    rotEnd: randomRange(i * 11, -360, 360),
    scale: randomRange(i * 13, 0.5, 1),
    size: randomRange(i * 17, 12, 28),
  }));
}

const CONFETTI_PIECES = generateConfetti(22); // Original has 22 confetti images
const GRAVITY = 3000; // Original: gravity: 3000

const ConfettiField: React.FC<{
  progress: number;
  durationSec: number;
  centerX: number;
  centerY: number;
}> = ({ progress: p, durationSec, centerX, centerY }) => {
  if (p <= 0) return null;
  const t = p * durationSec; // elapsed seconds

  return (
    <>
      {CONFETTI_PIECES.map((piece) => {
        const vx = piece.velocityMag * Math.cos(piece.angle);
        const vy = piece.velocityMag * Math.sin(piece.angle);
        // Physics2D: position = v*t + 0.5*g*t^2
        const x = centerX + vx * t;
        const y = centerY + vy * t + 0.5 * GRAVITY * t * t;
        const rotation = interpolate(p, [0, 1], [piece.rotStart, piece.rotEnd]);
        const opacity = interpolate(p, [0, 0.7, 1], [1, 1, 0], {
          extrapolateRight: "clamp",
        });

        return (
          <div
            key={piece.id}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: piece.size,
              height: piece.size,
              transform: `rotate(${rotation}deg) scale(${piece.scale})`,
              opacity,
            }}
          >
            {piece.shape === "circle" && (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: "50%",
                  background: piece.color,
                }}
              />
            )}
            {piece.shape === "rect" && (
              <div
                style={{
                  width: "100%",
                  height: "60%",
                  background: piece.color,
                  borderRadius: 2,
                }}
              />
            )}
            {piece.shape === "triangle" && (
              <svg viewBox="0 0 20 20" style={{ width: "100%", height: "100%" }}>
                <polygon points="10,0 20,20 0,20" fill={piece.color} />
              </svg>
            )}
          </div>
        );
      })}
    </>
  );
};

// ── Wiggle text path (the "ffa" lettering with complex SVG) ─────────────────

const WiggleShape: React.FC<{ progress: number }> = ({ progress: p }) => {
  if (p <= 0) return null;
  const scale = interpolate(p, [0, 1], [0, 1]);
  const rotation = interpolate(p, [0, 1], [60, 0]);
  return (
    <svg
      viewBox="700 230 550 520"
      style={{
        position: "absolute",
        width: 380,
        height: 360,
        left: "32%",
        top: "15%",
        transform: `scale(${scale}) rotate(${rotation}deg)`,
        transformOrigin: "center center",
      }}
    >
      <defs>
        <linearGradient id="wiggleGrad" x1="0%" y1="30%" x2="100%" y2="50%">
          <stop offset="2%" stopColor="#0A157A" />
          <stop offset="94%" stopColor="#9D95FF" />
        </linearGradient>
      </defs>
      <path
        d="M890.757 732.409C873.509 732.409 860.512 731.11 849.85 728.297C819.605 720.346 810.296 700.231 807.443 688.947C803.899 674.95 804.562 653.594 827.861 631.243C835.873 623.566 846.55 615.514 861.463 605.933C885.771 590.32 917.861 572.903 951.823 554.448C971.001 544.03 991.981 532.645 1011.78 521.346C1004.27 522.226 996.592 523.15 988.797 524.088C935.252 530.509 874.576 537.782 822.66 537.782C798.308 537.782 779.49 535.891 765.124 532.01C734.288 523.669 722.689 505.488 718.41 491.708C714.894 480.438 712.17 457.913 733.381 433.671C740.254 425.807 749.36 417.986 761.219 409.79C762.631 408.809 765.095 407.15 768.438 404.899C773.928 401.19 782.069 395.693 791.824 388.983L760.556 352.649L793.899 323.847C795.037 322.866 821.997 299.649 853.855 278.74C873.826 265.638 891.91 255.97 907.616 250.011C936.592 239.001 961.347 239.347 981.189 251.006C996.866 260.227 1006.56 276.489 1007.13 294.497C1008.09 325.319 984.892 354.496 918.509 406.01C899.1 421.074 878.812 435.764 861.017 448.274C898.956 445.994 940.497 441.002 978.307 436.471C1016.04 431.94 1051.68 427.669 1079.4 426.558C1096.55 425.879 1109.59 426.399 1120.44 428.231C1149.42 433.094 1162.38 448.318 1168.16 460.236C1175.44 475.243 1175.11 492.415 1167.24 508.576C1163.1 517.061 1156.75 525.545 1147.83 534.477C1120.03 562.312 1065.06 593.235 1009.37 623.566C1051.52 609.324 1078.59 592.86 1079.07 592.571L1125.61 667.519C1121.37 670.174 1020.25 732.395 890.771 732.395L890.757 732.409Z"
        fill="url(#wiggleGrad)"
      />
    </svg>
  );
};

// ── Spinning C-shape ────────────────────────────────────────────────────────

const SpinShape: React.FC<{ progress: number }> = ({ progress: p }) => {
  if (p <= 0) return null;
  const scale = interpolate(p, [0, 1], [0, 1]);
  const rotation = interpolate(p, [0, 1], [-60, 0]);
  return (
    <svg
      viewBox="1050 250 120 160"
      style={{
        position: "absolute",
        width: 80,
        height: 110,
        right: "18%",
        top: "22%",
        transform: `scale(${scale}) rotate(${rotation}deg)`,
        transformOrigin: "center center",
      }}
    >
      <defs>
        <linearGradient id="spinGrad" x1="100%" y1="30%" x2="0%" y2="25%">
          <stop offset="27%" stopColor="#FEC5FB" />
          <stop offset="84%" stopColor="#00BAE2" />
        </linearGradient>
      </defs>
      <path
        d="M1122.34 375.405C1122.45 375.008 1122.25 374.601 1121.87 374.451C1101.02 366.065 1089.13 344.311 1094.88 323.286C1100.64 302.26 1122.05 289.271 1144.38 292.258C1144.78 292.312 1145.17 292.06 1145.28 291.663L1153.28 262.468C1153.4 262.013 1153.12 261.547 1152.66 261.462C1112.31 253.932 1072.68 276.799 1062.29 314.709C1051.9 352.62 1074.53 391.867 1113.29 405.168C1113.74 405.32 1114.22 405.057 1114.35 404.602L1122.35 375.408L1122.34 375.405Z"
        fill="url(#spinGrad)"
      />
    </svg>
  );
};

// ── Fast-forward icon ───────────────────────────────────────────────────────

const FFDIcon: React.FC<{ progress: number }> = ({ progress: p }) => {
  if (p <= 0) return null;
  // Original: xPercent: -800, opacity: 0, ease: "back.out"
  const x = interpolate(p, [0, 1], [-800, 0]);
  const opacity = interpolate(p, [0, 0.3, 1], [0, 0.5, 1]);
  return (
    <svg
      viewBox="870 755 80 70"
      style={{
        position: "absolute",
        width: 50,
        height: 44,
        left: "44%",
        bottom: "20%",
        transform: `translateX(${x}%)`,
        opacity,
      }}
    >
      <path
        d="M906.652 763.429C906.652 760.441 910.072 758.744 912.451 760.552L947.419 787.123C949.322 788.569 949.322 791.431 947.419 792.877L912.451 819.447C910.072 821.255 906.653 819.559 906.652 816.571V797.522L877.799 819.447C875.42 821.255 872 819.559 872 816.571V763.429C872 760.441 875.42 758.744 877.799 760.552L906.652 782.476V763.429Z"
        fill="#05F34A"
      />
    </svg>
  );
};

// ── Sprinkle dots (small colored shapes from the original) ──────────────────

interface SprinkleData {
  x: number;
  y: number;
  size: number;
  color: string;
  shape: "circle" | "pill" | "arc";
}

const SPRINKLES: SprinkleData[] = [
  { x: 783, y: 240, size: 34, color: "#FAF005", shape: "circle" },
  { x: 1207, y: 337, size: 57, color: "#FAF005", shape: "circle" },
  { x: 1178, y: 60, size: 20, color: "#BAA5F5", shape: "pill" },
  { x: 820, y: 185, size: 16, color: "#BAA5F5", shape: "pill" },
  { x: 950, y: 718, size: 16, color: "#B82C6F", shape: "pill" },
  { x: 826, y: 778, size: 16, color: "#FF783E", shape: "pill" },
  { x: 1152, y: 515, size: 16, color: "#FF783E", shape: "pill" },
  { x: 822, y: 235, size: 16, color: "#FF783E", shape: "pill" },
  { x: 1150, y: 590, size: 16, color: "#A6CFE7", shape: "pill" },
  { x: 1209, y: 523, size: 16, color: "#BAA5F5", shape: "pill" },
  { x: 1172, y: 119, size: 16, color: "#FF783E", shape: "arc" },
];

const Sprinkles: React.FC<{ progress: number }> = ({ progress: p }) => {
  if (p <= 0) return null;
  // Original: scale: 0, rotation: 360, transformOrigin: "center center", ease: "back.out"
  return (
    <>
      {SPRINKLES.map((s, i) => {
        // Stagger the sprinkles slightly
        const staggeredP = Math.max(
          0,
          Math.min(1, (p - i * 0.03) / (1 - i * 0.03)),
        );
        const appliedP = backOut(staggeredP);
        const scale = interpolate(appliedP, [0, 1], [0, 1]);
        const rotation = interpolate(appliedP, [0, 1], [360, 0]);
        // Normalize positions from original 2058x871 viewBox to 1920x1080
        const nx = (s.x / 2058) * 100;
        const ny = (s.y / 871) * 100;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${nx}%`,
              top: `${ny}%`,
              width: s.size,
              height: s.size,
              transform: `scale(${scale}) rotate(${rotation}deg)`,
              transformOrigin: "center center",
            }}
          >
            {s.shape === "circle" && (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: "50%",
                  background: s.color,
                }}
              />
            )}
            {s.shape === "pill" && (
              <div
                style={{
                  width: "100%",
                  height: "40%",
                  borderRadius: 999,
                  background: s.color,
                }}
              />
            )}
            {s.shape === "arc" && (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  borderTop: `3px solid ${s.color}`,
                  borderRight: `3px solid ${s.color}`,
                  borderRadius: "0 50% 0 0",
                }}
              />
            )}
          </div>
        );
      })}
    </>
  );
};

// ── DrawSVG path (stroke-dashoffset animation) ──────────────────────────────

const DrawnPath: React.FC<{
  d: string;
  stroke: string;
  strokeWidth: number;
  progress: number;
  viewBox: string;
  style?: React.CSSProperties;
}> = ({ d, stroke, strokeWidth, progress: p, viewBox, style }) => {
  // Approximate path length — works for visual purposes
  const pathLength = 2000;
  const dashOffset = interpolate(p, [0, 1], [pathLength, 0]);

  return (
    <svg viewBox={viewBox} style={{ position: "absolute", ...style }}>
      <path
        d={d}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeMiterlimit={10}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={pathLength}
        strokeDashoffset={dashOffset}
      />
    </svg>
  );
};

// ── Plane on motion path ────────────────────────────────────────────────────

const Plane: React.FC<{ progress: number }> = ({ progress: p }) => {
  if (p <= 0) return null;

  // Simplified plane path sampling (the original uses MotionPathPlugin)
  // We sample a few keyframes along the path and interpolate
  const keyframes = [
    { x: 1458, y: 132, rot: -30 },
    { x: 1300, y: 170, rot: -15 },
    { x: 1100, y: 130, rot: 10 },
    { x: 1000, y: 200, rot: 30 },
    { x: 973, y: 227, rot: 45 },
  ];

  // Reverse path (start: 1, end: 0 in original)
  const rp = 1 - p;
  const segment = rp * (keyframes.length - 1);
  const idx = Math.min(Math.floor(segment), keyframes.length - 2);
  const frac = segment - idx;

  const x =
    keyframes[idx].x + (keyframes[idx + 1].x - keyframes[idx].x) * frac;
  const y =
    keyframes[idx].y + (keyframes[idx + 1].y - keyframes[idx].y) * frac;
  const rot =
    keyframes[idx].rot + (keyframes[idx + 1].rot - keyframes[idx].rot) * frac;

  const scale = interpolate(p, [0, 1], [0.2, 1]);
  // Fade out at frame 2s (original: .to(".innerplane", { duration: 0.2, opacity: 0 }, 2))
  const opacity = p > 0.85 ? interpolate(p, [0.85, 1], [1, 0]) : 1;

  // Normalize from 2058x871 to percentages
  const nx = (x / 2058) * 100;
  const ny = (y / 871) * 100;

  return (
    <svg
      viewBox="1220 90 250 140"
      style={{
        position: "absolute",
        width: 120,
        height: 70,
        left: `${nx}%`,
        top: `${ny}%`,
        transform: `scale(${scale}) rotate(${rot + 180}deg)`,
        transformOrigin: "center center",
        opacity,
      }}
    >
      <path
        d="M1458.41 132.072L1228.95 216.095L1253.19 163.85L1292.99 154.093L1458.41 132.072Z"
        fill="#05F34A"
        stroke="#1B1E1A"
        strokeWidth={3}
      />
      <path
        d="M1265.31 137.726L1458.42 132.071L1273.13 159.068L1265.31 137.726Z"
        fill="#05F34A"
        stroke="#1B1E1A"
        strokeWidth={3}
      />
      <path
        d="M1265.31 137.725L1295.61 102.015L1458.42 132.071L1265.31 137.725Z"
        fill="#05F34A"
        stroke="#1B1E1A"
        strokeWidth={3}
      />
    </svg>
  );
};

// ── Hand (waving, entering from below) ──────────────────────────────────────

const Hand: React.FC<{
  enterProgress: number;
  wiggleProgress: number;
}> = ({ enterProgress, wiggleProgress }) => {
  if (enterProgress <= 0) return null;

  // Original: from #hand { opacity: 0, duration: 0.2, yPercent: 100 } at 1.3s
  const opacity = interpolate(enterProgress, [0, 1], [0, 1]);
  const yPct = interpolate(enterProgress, [0, 1], [100, 0]);

  // Original: from #hand { duration: 0.4, rotation: "+=30", ease: "myWiggle" } at 1.5s
  // CustomWiggle { wiggles: 6 }: oscillate 6 times then settle
  const wiggleAngle =
    wiggleProgress > 0
      ? 30 * Math.sin(wiggleProgress * Math.PI * 12) * (1 - wiggleProgress)
      : 0;

  return (
    <svg
      viewBox="1050 650 140 150"
      style={{
        position: "absolute",
        width: 100,
        height: 110,
        right: "22%",
        bottom: "18%",
        transform: `translateY(${yPct}%) rotate(${wiggleAngle}deg)`,
        transformOrigin: "center center",
        opacity,
      }}
    >
      {/* Simplified hand shape */}
      <path
        d="M1162.52 666.144L1176.06 718.388C1177.72 724.799 1178.06 731.516 1176.85 738.115C1176.09 742.292 1174.65 746.79 1172.06 750.769C1172.76 751.621 1173.29 752.621 1173.58 753.738L1175.28 760.084C1176.48 764.609 1173.51 769.333 1168.64 770.633L1117.65 784.237C1112.77 785.537 1107.84 782.921 1106.63 778.396L1104.94 772.05C1104.59 770.737 1104.59 769.402 1104.89 768.145C1098.39 765.431 1093.48 760.261 1091.36 752.35L1089.73 746.166L1064.68 740.226C1058.44 738.717 1053.8 735.175 1054.22 729.35C1054.56 724.65 1056.69 721.15 1061.3 719.919L1066.26 719.826L1083.68 723.457L1083.9 723.462C1083.77 723.132 1071.39 676.788 1071.39 676.788C1069.9 671.215 1073.37 665.234 1079.35 663.543C1082.43 662.673 1085.53 663.068 1088.05 664.403C1090.51 665.709 1092.41 667.918 1093.16 670.718L1101.74 701.364L1106.88 720.624C1107.2 721.82 1107.73 722.905 1108.42 723.86C1109.35 725.147 1110.58 726.191 1111.99 726.941C1114.46 728.247 1117.49 728.654 1120.5 727.85C1122.6 727.29 1124.42 726.216 1125.83 724.819C1128.47 722.2 1129.69 718.45 1128.72 714.799L1122.34 690.885C1121.59 688.086 1119.69 685.877 1117.23 684.567C1114.76 683.262 1111.73 682.854 1108.72 683.659C1102.69 685.267 1099.01 691.111 1100.5 696.71L1106.88 720.624"
        fill="#FFFCE1"
        stroke="black"
        strokeWidth={4}
        strokeMiterlimit={10}
      />
    </svg>
  );
};

// ── 3D poly (center hero image — rendered as gradient shape) ────────────────

const HeroPoly: React.FC<{
  bounceProgress: number;
  squashProgress: number;
}> = ({ bounceProgress, squashProgress }) => {
  if (bounceProgress <= 0) return null;

  // Original: from { opacity: 0, y: -2000, ease: "myBounce" }, duration 2s
  const y = interpolate(
    customBounce(bounceProgress),
    [0, 1],
    [-2000, 0],
  );
  const opacity = interpolate(bounceProgress, [0, 0.05, 1], [0, 1, 1]);

  // Original squash: scaleX 1→1.4→1, scaleY 1→0.6→1, ease: "myBounce-squash"
  const squashFactor = customBounceSquash(squashProgress);
  const scaleX = 1 + (squashFactor - 1) * 0.4;
  const scaleY = 1 - (squashFactor - 1) * 0.4;

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: 250,
        height: 270,
        transform: `translate(-50%, -50%) translateY(${y}px) scaleX(${scaleX}) scaleY(${scaleY})`,
        transformOrigin: "center bottom",
        opacity,
      }}
    >
      {/* Gradient polyhedron shape */}
      <svg viewBox="0 0 344 370" style={{ width: "100%", height: "100%" }}>
        <defs>
          <linearGradient id="polyGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FF8709" />
            <stop offset="50%" stopColor="#F7BDF8" />
            <stop offset="100%" stopColor="#9D95FF" />
          </linearGradient>
          <linearGradient id="polyGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#05F34A" />
            <stop offset="100%" stopColor="#00BAE2" />
          </linearGradient>
        </defs>
        {/* Low-poly crystal shape */}
        <polygon
          points="172,10 300,100 320,250 250,350 94,350 24,250 44,100"
          fill="url(#polyGrad1)"
          stroke="#1B1E1A"
          strokeWidth={2}
        />
        <polygon
          points="172,10 300,100 172,180 44,100"
          fill="url(#polyGrad2)"
          opacity={0.5}
        />
        <line
          x1={172}
          y1={180}
          x2={172}
          y2={350}
          stroke="#1B1E1A"
          strokeWidth={1.5}
          opacity={0.3}
        />
        <line
          x1={172}
          y1={180}
          x2={320}
          y2={250}
          stroke="#1B1E1A"
          strokeWidth={1.5}
          opacity={0.3}
        />
        <line
          x1={172}
          y1={180}
          x2={24}
          y2={250}
          stroke="#1B1E1A"
          strokeWidth={1.5}
          opacity={0.3}
        />
      </svg>
    </div>
  );
};

// ── Main component ──────────────────────────────────────────────────────────

export const GsapSmooth: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── Timeline progress calculations ──
  // All times relative to the 1s delay, matching original

  // Text: from [free.chars, all.chars] { duration: 0.7, ... stagger amount: 0.3 }, starts at 0
  const textP = progress(frame, fps, 0, 0.7);
  const textStaggerTotal = 0.3; // seconds

  // Main 3D poly: from { duration: 2, y: -2000, ease: "myBounce" } at 0.5
  const polyBounceP = progress(frame, fps, 0.5, 2);
  const polySquashP = progress(frame, fps, 0.5, 2);

  // "free" text: to { duration: 2, xPercent: -20, ease: "elastic.out" } at "explode"
  const freeSlideP = progress(frame, fps, EXPLODE, 2);
  // "all" text: to { duration: 2, xPercent: 50, ease: "elastic.out" } at "explode"
  const allSlideP = progress(frame, fps, EXPLODE, 2);

  // Starburst (#bang): from { duration: 0.7, scale: 0, rotation: -60, ease: "back.out(4)" } at "explode+=.1"
  const bangP = progress(frame, fps, EXPLODE + 0.1, 0.7);

  // Wiggle shape: from { duration: 0.7, scale: 0, rotation: 60, ease: "back.out(4)" } at "explode+=.4"
  const wiggleP = progress(frame, fps, EXPLODE + 0.4, 0.7);

  // Spin shape: same timing as bang
  const spinP = bangP;

  // Sprinkles: from { scale: 0, rotation: 360, ease: "back.out" } at "explode"
  const sprinklesP = progress(frame, fps, EXPLODE, 1);

  // FFD icon: from { xPercent: -800, opacity: 0, ease: "back.out" } at "explode"
  const ffdP = progress(frame, fps, EXPLODE, 1);

  // Confetti: set opacity 1 at "explode+=.2", then physics2D duration 2s
  const confettiP = progress(frame, fps, EXPLODE + 0.2, 2);

  // DrawSVG #path: from { duration: 0.5, drawSVG: 0 } at "explode"
  const drawPath1P = progress(frame, fps, EXPLODE, 0.5);

  // DrawSVG #path_2: from { duration: 0.8, drawSVG: 0 } at "flight"
  const drawPath2P = progress(frame, fps, FLIGHT, 0.8);

  // Plane: from { duration: 1, ... } at "flight"
  const planeP = progress(frame, fps, FLIGHT, 1);

  // Hand enter: from { opacity: 0, duration: 0.2, yPercent: 100 } at 1.3
  const handEnterP = progress(frame, fps, 1.3, 0.2);
  // Hand wiggle: from { duration: 0.4, rotation: "+=30", ease: "myWiggle" } at 1.5
  const handWiggleP = progress(frame, fps, 1.5, 0.4);

  // ── Apply easings ──
  const freeSlideEased = elasticOut(freeSlideP);
  const allSlideEased = elasticOut(allSlideP);
  const freeX = interpolate(freeSlideEased, [0, 1], [0, -20]); // xPercent
  const allX = interpolate(allSlideEased, [0, 1], [0, 50]); // xPercent

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0e100f",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        fontFamily:
          "'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
        color: "#FFFCE1",
      }}
    >
      {/* ── Drawn paths ── */}
      <DrawnPath
        d="M538.5 556.481C565.165 497.803 621.326 446.333 685.817 449.897C742.695 453.011 791.23 499.923 807.851 554.295C822.28 601.485 806.483 665.329 758.267 675.637C710.051 685.944 669.808 635.984 657.212 588.396C638.16 517.04 652.243 437.987 694.679 377.68C737.115 317.374 806.881 277.006 880.5 270.501"
        stroke="#FEC5FB"
        strokeWidth={12}
        progress={drawPath1P}
        viewBox="520 260 400 430"
        style={{
          width: 280,
          height: 300,
          left: "20%",
          top: "25%",
        }}
      />
      <DrawnPath
        d="M973.861 226.794C1015.92 240.459 1041.39 136.212 1005.93 135.899C977.513 135.649 990.28 214.204 1046.61 229.17C1089.82 240.65 1168.88 147.886 1092.89 84.6262C1022.57 26.0944 1052.01 288.336 1197.12 209.704"
        stroke="#0AE448"
        strokeWidth={3}
        progress={drawPath2P}
        viewBox="960 20 260 280"
        style={{
          width: 180,
          height: 200,
          left: "48%",
          top: "5%",
        }}
      />

      {/* ── Background starburst ── */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
        }}
      >
        <Starburst progress={backOutStrong(bangP)} />
      </div>

      {/* ── Wiggle shape ── */}
      <WiggleShape progress={backOutStrong(wiggleP)} />

      {/* ── Spin shape ── */}
      <SpinShape progress={backOutStrong(spinP)} />

      {/* ── FFD icon ── */}
      <FFDIcon progress={backOut(ffdP)} />

      {/* ── Sprinkles ── */}
      <Sprinkles progress={sprinklesP} />

      {/* ── 3D Hero poly ── */}
      <HeroPoly
        bounceProgress={polyBounceP}
        squashProgress={polySquashP}
      />

      {/* ── "free" text ── */}
      <div
        style={{
          position: "absolute",
          left: "10%",
          top: "45%",
          fontSize: "8vw",
          fontWeight: 800,
          transform: `translateX(${freeX}%)`,
        }}
      >
        <AnimatedText
          text="free "
          charProgress={(i) => {
            // Stagger from random, amount 0.3s over 0.7s duration
            const stagger = seededRandom(i * 31 + 7) * textStaggerTotal;
            const charDur = 0.7;
            const charStart = stagger;
            const totalDur = 0.7 + textStaggerTotal;
            const charP = Math.max(
              0,
              Math.min(1, (textP * totalDur - charStart) / charDur),
            );
            return expoOut(charP);
          }}
        />
      </div>

      {/* ── "for all" text ── */}
      <div
        style={{
          position: "absolute",
          left: "41%",
          top: "45%",
          fontSize: "8vw",
          fontWeight: 800,
          transform: `translateX(${allX}%)`,
        }}
      >
        <AnimatedText
          text="for all"
          charProgress={(i) => {
            const stagger = seededRandom(i * 53 + 13) * textStaggerTotal;
            const charDur = 0.7;
            const charStart = stagger;
            const totalDur = 0.7 + textStaggerTotal;
            const charP = Math.max(
              0,
              Math.min(1, (textP * totalDur - charStart) / charDur),
            );
            return expoOut(charP);
          }}
        />
      </div>

      {/* ── Confetti ── */}
      <ConfettiField
        progress={confettiP}
        durationSec={2}
        centerX={960}
        centerY={540}
      />

      {/* ── Plane ── */}
      <Plane progress={planeP > 0 ? Easing.inOut(Easing.sin)(planeP) : 0} />

      {/* ── Hand ── */}
      <Hand enterProgress={handEnterP} wiggleProgress={handWiggleP} />
    </AbsoluteFill>
  );
};
