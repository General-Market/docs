import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";

// Simplified continental US outline — single SVG path
const US_OUTLINE =
  "M 220,200 L 240,180 260,175 280,170 310,168 340,170 370,175 400,172 " +
  "430,168 460,165 490,170 520,172 550,178 570,175 590,180 610,185 " +
  "640,178 670,172 700,168 730,170 760,175 785,180 800,190 815,200 " +
  "830,195 850,188 870,185 885,190 895,198 905,210 910,225 " +
  "915,240 920,260 925,278 928,295 930,310 928,325 " +
  "920,340 912,355 905,365 910,380 918,395 925,408 " +
  "930,420 928,435 920,445 908,450 895,458 885,470 " +
  "878,485 870,498 860,505 848,510 835,515 820,508 " +
  "805,502 790,498 775,502 762,510 750,520 738,528 " +
  "728,538 720,548 712,555 700,558 688,555 675,548 " +
  "665,542 658,548 652,558 648,570 645,580 640,588 " +
  "632,592 622,588 615,580 610,572 605,568 598,572 " +
  "590,580 582,585 572,582 " +
  "560,575 548,568 535,558 520,552 505,548 488,545 " +
  "470,542 452,540 435,538 418,535 400,530 382,525 " +
  "365,520 350,515 338,508 328,498 320,488 312,478 " +
  "305,468 298,458 290,448 282,438 275,428 268,418 " +
  "262,408 258,398 255,385 252,372 250,358 248,342 " +
  "245,325 242,308 240,290 238,272 235,255 230,238 " +
  "225,222 222,210 220,200 Z";

// Three outbreak origins (midwest, southeast, california)
const ORIGINS = [
  { x: 600, y: 350 },  // Midwest (Kansas City area)
  { x: 820, y: 440 },  // Southeast (Atlanta area)
  { x: 280, y: 370 },  // California (LA area)
];

// US-shaped dot grid — denser rows for ~350 dots
const US_ROWS: [number, number, number][] = [
  // Pacific Northwest
  [260, 380, 185], [250, 400, 200], [240, 410, 215],
  // Northern tier
  [420, 560, 175], [400, 600, 190], [380, 640, 205],
  [530, 730, 180], [510, 760, 195], [490, 790, 210],
  // Upper Midwest / Northeast
  [240, 430, 230], [250, 450, 245],
  [470, 810, 225], [460, 830, 240], [450, 850, 255],
  [830, 910, 220], [840, 920, 235], [850, 920, 250],
  // Middle band
  [250, 460, 270], [260, 470, 290], [270, 480, 310],
  [440, 870, 270], [430, 880, 290], [420, 890, 310],
  [880, 930, 270], [885, 930, 290], [890, 930, 310],
  // Central / South
  [280, 500, 330], [290, 510, 350], [300, 520, 370],
  [400, 900, 330], [390, 905, 350], [380, 910, 370],
  // Texas / Deep South
  [310, 530, 390], [320, 540, 410], [340, 550, 430],
  [370, 920, 390], [360, 915, 410], [355, 908, 430],
  // Gulf Coast / Florida
  [360, 560, 450], [380, 550, 470],
  [540, 900, 450], [560, 890, 470], [580, 878, 490],
  // South Texas / Florida
  [400, 540, 490], [420, 520, 510],
  [620, 860, 505], [640, 845, 520], [660, 830, 535],
  // Florida peninsula
  [700, 810, 548], [715, 790, 560], [730, 770, 572],
  [740, 755, 585],
];

const DOT_SPACING = 28;
const DOT_R = 4.5;

// Heat map gradient stops: green → yellow → orange → red
const GRADIENT_STOPS = [
  { t: 0.0, r: 34, g: 197, b: 94 },   // #22c55e green
  { t: 0.35, r: 234, g: 179, b: 8 },   // #eab308 yellow
  { t: 0.65, r: 249, g: 115, b: 22 },   // #f97316 orange
  { t: 1.0, r: 220, g: 38, b: 38 },     // #dc2626 red
];

function heatColor(t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  let lower = GRADIENT_STOPS[0];
  let upper = GRADIENT_STOPS[GRADIENT_STOPS.length - 1];
  for (let i = 0; i < GRADIENT_STOPS.length - 1; i++) {
    if (clamped >= GRADIENT_STOPS[i].t && clamped <= GRADIENT_STOPS[i + 1].t) {
      lower = GRADIENT_STOPS[i];
      upper = GRADIENT_STOPS[i + 1];
      break;
    }
  }
  const range = upper.t - lower.t;
  const local = range > 0 ? (clamped - lower.t) / range : 0;
  const r = Math.round(lower.r + (upper.r - lower.r) * local);
  const g = Math.round(lower.g + (upper.g - lower.g) * local);
  const b = Math.round(lower.b + (upper.b - lower.b) * local);
  return `rgb(${r},${g},${b})`;
}

interface Dot {
  x: number;
  y: number;
  minDistFromOrigins: number;
  nearestOriginIndex: number;
}

// Seeded pseudo-random for deterministic jitter
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

const dots: Dot[] = [];
let seedCounter = 0;
US_ROWS.forEach(([xStart, xEnd, y]) => {
  for (let x = xStart; x <= xEnd; x += DOT_SPACING) {
    // Small jitter for organic feel
    const jx = x + (seededRandom(seedCounter++) - 0.5) * 12;
    const jy = y + (seededRandom(seedCounter++) - 0.5) * 10;

    let minDist = Infinity;
    let nearestIdx = 0;
    ORIGINS.forEach((o, oi) => {
      const dx = jx - o.x;
      const dy = jy - o.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < minDist) {
        minDist = d;
        nearestIdx = oi;
      }
    });
    dots.push({ x: jx, y: jy, minDistFromOrigins: minDist, nearestOriginIndex: nearestIdx });
  }
});

const maxDist = Math.max(...dots.map((d) => d.minDistFromOrigins));

// State cluster labels with approximate positions
const STATE_LABELS = [
  { label: "TX", x: 440, y: 445, downCount: 47 },
  { label: "CA", x: 272, y: 340, downCount: 62 },
  { label: "FL", x: 780, y: 530, downCount: 38 },
  { label: "IL", x: 640, y: 305, downCount: 29 },
];

// Pre-compute which dots are "close" for network lines (within threshold)
const NETWORK_THRESHOLD = 48;
const networkPairs: [number, number][] = [];
for (let i = 0; i < dots.length; i++) {
  for (let j = i + 1; j < dots.length; j++) {
    const dx = dots[i].x - dots[j].x;
    const dy = dots[i].y - dots[j].y;
    if (Math.sqrt(dx * dx + dy * dy) < NETWORK_THRESHOLD) {
      networkPairs.push([i, j]);
    }
  }
}

const GREEN = "#22c55e";
const RED = "#dc2626";

export const McdonaldsScene: React.FC = () => {
  const frame = useCurrentFrame();

  // Spread radius accelerates over time — multi-origin
  const spreadProgress = interpolate(frame, [15, 120], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const spreadRadius = maxDist * Math.pow(spreadProgress, 0.6);

  // Count affected dots and compute heat
  const dotStates = dots.map((dot, i) => {
    const isAffected = dot.minDistFromOrigins < spreadRadius;
    const transitionDepth = isAffected
      ? interpolate(
          spreadRadius - dot.minDistFromOrigins,
          [0, 80],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        )
      : 0;

    const color = isAffected ? heatColor(transitionDepth) : GREEN;

    const pulse = isAffected
      ? interpolate(
          Math.sin(frame * 0.15 + i * 0.7),
          [-1, 1],
          [DOT_R - 0.8, DOT_R + 1.5 * transitionDepth],
        )
      : DOT_R;

    const opacity = isAffected
      ? interpolate(
          Math.sin(frame * 0.12 + i * 0.5),
          [-1, 1],
          [0.7, 1],
        )
      : 0.7;

    return { isAffected, transitionDepth, color, pulse, opacity };
  });

  const redCount = dotStates.filter((d) => d.isAffected).length;
  const pct = dots.length > 0 ? Math.round((redCount / dots.length) * 100) : 0;

  // Total offline counter — based on 13,000 US McDonald's, scaled by pct
  const totalOffline = Math.round((pct / 100) * 13000 * 0.12); // ~12% of locations typically have machine issues

  // State label fade-in: appear after spread reaches their area
  const stateLabelStates = STATE_LABELS.map((sl) => {
    let minDistForLabel = Infinity;
    ORIGINS.forEach((o) => {
      const dx = sl.x - o.x;
      const dy = sl.y - o.y;
      minDistForLabel = Math.min(minDistForLabel, Math.sqrt(dx * dx + dy * dy));
    });
    const visible = spreadRadius > minDistForLabel + 30;
    const labelOpacity = visible
      ? interpolate(
          spreadRadius - minDistForLabel - 30,
          [0, 60],
          [0, 0.9],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        )
      : 0;
    // Scale down count based on spread progress in that area
    const areaProgress = visible
      ? interpolate(
          spreadRadius - minDistForLabel - 30,
          [0, 120],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        )
      : 0;
    const currentDown = Math.round(sl.downCount * areaProgress);
    return { ...sl, labelOpacity, currentDown };
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "transparent",
        fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
      }}
    >
      {/* Dot map */}
      <svg
        width={1920}
        height={1080}
        viewBox="0 0 1200 800"
        style={{ position: "absolute", top: 60, left: 340 }}
      >
        {/* US border outline */}
        <path
          d={US_OUTLINE}
          fill="none"
          stroke="#ffffff06"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />

        {/* Subtle connecting lines between nearby red dots */}
        {networkPairs.map(([i, j], idx) => {
          const di = dotStates[i];
          const dj = dotStates[j];
          if (!di.isAffected || !dj.isAffected) return null;
          const lineOpacity =
            Math.min(di.transitionDepth, dj.transitionDepth) * 0.1;
          if (lineOpacity < 0.02) return null;
          return (
            <line
              key={`net-${idx}`}
              x1={dots[i].x}
              y1={dots[i].y}
              x2={dots[j].x}
              y2={dots[j].y}
              stroke={RED}
              strokeWidth={0.6}
              opacity={lineOpacity}
            />
          );
        })}

        {/* Dots */}
        {dots.map((dot, i) => {
          const state = dotStates[i];
          return (
            <circle
              key={i}
              cx={dot.x}
              cy={dot.y}
              r={state.pulse}
              fill={state.color}
              opacity={state.opacity * 0.85}
            />
          );
        })}

        {/* Glow rings at each origin */}
        {ORIGINS.map((origin, oi) => (
          <circle
            key={`glow-${oi}`}
            cx={origin.x}
            cy={origin.y}
            r={spreadRadius * 0.7}
            fill="none"
            stroke={RED}
            strokeWidth={0.8}
            opacity={interpolate(
              spreadProgress,
              [0, 0.08, 0.85, 1],
              [0, 0.1, 0.04, 0],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
            )}
          />
        ))}
      </svg>

      {/* State cluster labels */}
      {stateLabelStates.map((sl, idx) => (
        <div
          key={`state-${idx}`}
          style={{
            position: "absolute",
            left: 340 + (sl.x / 1200) * 1920,
            top: 60 + (sl.y / 800) * 1080 - 28,
            opacity: sl.labelOpacity * 0.7,
            color: "#ff6b6b",
            fontSize: 13,
            fontWeight: 700,
            fontFamily: "'Courier New', monospace",
            letterSpacing: 2,
            textShadow: "0 0 8px rgba(220,38,38,0.3)",
            whiteSpace: "nowrap",
            pointerEvents: "none",
          }}
        >
          {sl.label}: {sl.currentDown} DOWN
        </div>
      ))}

      {/* HUD panel — bottom-left corner with key stats */}
      <div
        style={{
          position: "absolute",
          bottom: 80,
          left: 40,
          width: 350,
          maxHeight: 250,
          background: "rgba(0,0,0,0.6)",
          borderRadius: 8,
          padding: "12px 16px",
          border: "1px solid rgba(255,255,255,0.08)",
          opacity: interpolate(frame, [0, 20], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        <div style={{ color: "#ffffff", fontSize: 13, letterSpacing: 4, opacity: 0.5, textTransform: "uppercase", marginBottom: 8 }}>
          Ice Cream Machine Status
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ color: RED, fontSize: 22, fontWeight: 700, fontFamily: "'Courier New', monospace" }}>
            {pct}% DOWN
          </div>
          <div style={{ color: "#ff4444", fontSize: 36, fontWeight: 800, fontFamily: "'Courier New', monospace", lineHeight: 1 }}>
            {totalOffline.toLocaleString()}
          </div>
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 12, color: "#ffffff55" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: GREEN, display: "inline-block" }} />
            OK
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: RED, display: "inline-block" }} />
            Down
          </span>
          <span style={{ color: "#ffffff30", fontSize: 11, fontFamily: "'Courier New', monospace" }}>
            6:03 PM EST
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
