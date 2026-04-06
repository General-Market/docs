import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import {
  baseText,
  greenText,
  GREEN,
  LightBg,
  Center,
  easeOutExpo,
  easeOutQuart,
  progress,
  wordReveal,
  sceneFade,
  srand,
} from "./shared";

/* ─── Scene 09 — Sand Dark (180 frames / 6s) ─── */

export const Scene09_SandDark: React.FC = () => {
  const frame = useCurrentFrame();
  const TOTAL = 180;
  const fade = sceneFade(frame, TOTAL, 12, 12);

  // The original shows a centered B&W sand photograph on light background
  // The photo is ~70% of the viewport, centered, with a slight zoom drift
  const zoom = interpolate(frame, [0, TOTAL], [1.0, 1.04], {
    extrapolateRight: "clamp",
  });

  // Photo dimensions — centered rectangle
  const photoW = 1200;
  const photoH = 680;
  const photoX = (1920 - photoW) / 2;
  const photoY = (1080 - photoH) / 2;

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", opacity: fade }}>
      <LightBg />
      {/* Centered B&W sand photograph (CSS gradients approximation) */}
      <div
        style={{
          position: "absolute",
          left: photoX,
          top: photoY,
          width: photoW,
          height: photoH,
          overflow: "hidden",
          borderRadius: 2,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: `scale(${zoom})`,
            transformOrigin: "center 60%",
          }}
        >
          {/* Sky / fog zone — top 35% */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "35%",
              background: `linear-gradient(
                180deg,
                #a0a0a0 0%,
                #8a8a8a 30%,
                #707070 60%,
                #5a5a5a 100%
              )`,
            }}
          />
          {/* Foggy blur layer between sky and sand */}
          <div
            style={{
              position: "absolute",
              top: "25%",
              left: 0,
              right: 0,
              height: "20%",
              background:
                "linear-gradient(180deg, transparent 0%, rgba(100,100,100,0.4) 40%, rgba(80,80,80,0.3) 100%)",
              filter: "blur(12px)",
            }}
          />
          {/* Sand zone — bottom 65% with depth-of-field look */}
          <div
            style={{
              position: "absolute",
              top: "35%",
              left: 0,
              right: 0,
              bottom: 0,
              background: `linear-gradient(
                180deg,
                #4a4a4a 0%,
                #3d3d3d 20%,
                #353535 40%,
                #2e2e2e 60%,
                #282828 80%,
                #222 100%
              )`,
            }}
          />
          {/* Sand ridge / foreground texture — darker near bottom */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: 0,
              right: 0,
              bottom: 0,
              background: `linear-gradient(
                170deg,
                transparent 0%,
                rgba(35,35,35,0.6) 30%,
                rgba(25,25,25,0.8) 100%
              )`,
            }}
          />
          {/* Grain texture: overlapping radial gradients for depth */}
          {Array.from({ length: 30 }).map((_, i) => {
            const x = srand(i * 3) * 100;
            const y = 35 + srand(i * 7 + 1) * 65;
            const size = 60 + srand(i * 11 + 2) * 160;
            const alpha = 0.03 + srand(i * 13 + 3) * 0.06;
            const light = srand(i * 17 + 4) > 0.5;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: `${x}%`,
                  top: `${y}%`,
                  width: size,
                  height: size * 0.4,
                  borderRadius: "50%",
                  background: `radial-gradient(circle, rgba(${light ? "90,90,90" : "20,20,20"},${alpha}) 0%, transparent 70%)`,
                  transform: "translate(-50%, -50%)",
                  pointerEvents: "none",
                }}
              />
            );
          })}
          {/* Specular highlights — sand sparkle */}
          {Array.from({ length: 40 }).map((_, i) => {
            const x = srand(i * 19 + 5) * 100;
            const y = 40 + srand(i * 23 + 6) * 55;
            const size = 1 + srand(i * 29 + 7) * 2;
            const alpha = 0.1 + srand(i * 31 + 8) * 0.2;
            return (
              <div
                key={`sp-${i}`}
                style={{
                  position: "absolute",
                  left: `${x}%`,
                  top: `${y}%`,
                  width: size,
                  height: size,
                  borderRadius: "50%",
                  backgroundColor: `rgba(180,180,180,${alpha})`,
                  pointerEvents: "none",
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

/* ─── Scene 10 — Crosshair (150 frames / 5s) ─── */

export const Scene10_Crosshair: React.FC = () => {
  const frame = useCurrentFrame();
  const TOTAL = 150;
  const fade = sceneFade(frame, TOTAL, 10, 10);

  const crosshairProgress = progress(frame, 20, 15);
  const crosshairOpacity = easeOutExpo(crosshairProgress);

  // Full-bleed sand landscape (same as Scene09 but fills entire viewport)
  const zoom = interpolate(frame, [0, TOTAL], [1.0, 1.03], {
    extrapolateRight: "clamp",
  });

  // Crosshair position drifts slightly — placed roughly right-of-center, mid-height
  const crossX = interpolate(frame, [0, TOTAL], [62, 38], {
    extrapolateRight: "clamp",
  });
  const crossY = interpolate(frame, [0, TOTAL], [48, 52], {
    extrapolateRight: "clamp",
  });

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", opacity: fade }}>
      {/* Full-bleed sand landscape */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `scale(${zoom})`,
          transformOrigin: "center 55%",
        }}
      >
        {/* Sky */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "35%",
            background: `linear-gradient(180deg, #8a8a8a 0%, #6a6a6a 50%, #555 100%)`,
          }}
        />
        {/* Fog between sky and sand */}
        <div
          style={{
            position: "absolute",
            top: "25%",
            left: 0,
            right: 0,
            height: "20%",
            background:
              "linear-gradient(180deg, transparent 0%, rgba(90,90,90,0.5) 50%, rgba(70,70,70,0.3) 100%)",
            filter: "blur(15px)",
          }}
        />
        {/* Sand */}
        <div
          style={{
            position: "absolute",
            top: "33%",
            left: 0,
            right: 0,
            bottom: 0,
            background: `linear-gradient(180deg, #4a4a4a 0%, #3a3a3a 30%, #303030 50%, #282828 100%)`,
          }}
        />
        {/* Sand ridge */}
        <div
          style={{
            position: "absolute",
            top: "55%",
            left: 0,
            right: 0,
            bottom: 0,
            background: `linear-gradient(175deg, transparent 0%, rgba(30,30,30,0.5) 40%, rgba(22,22,22,0.7) 100%)`,
          }}
        />
        {/* Grain texture */}
        {Array.from({ length: 30 }).map((_, i) => {
          const x = srand(i * 3 + 100) * 100;
          const y = 35 + srand(i * 7 + 101) * 65;
          const size = 60 + srand(i * 11 + 102) * 160;
          const alpha = 0.03 + srand(i * 13 + 103) * 0.06;
          const light = srand(i * 17 + 104) > 0.5;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: `${x}%`,
                top: `${y}%`,
                width: size,
                height: size * 0.4,
                borderRadius: "50%",
                background: `radial-gradient(circle, rgba(${light ? "80,80,80" : "20,20,20"},${alpha}) 0%, transparent 70%)`,
                transform: "translate(-50%, -50%)",
                pointerEvents: "none",
              }}
            />
          );
        })}
        {/* Sparkle */}
        {Array.from({ length: 50 }).map((_, i) => {
          const x = srand(i * 19 + 105) * 100;
          const y = 38 + srand(i * 23 + 106) * 58;
          const size = 1 + srand(i * 29 + 107) * 2;
          const alpha = 0.08 + srand(i * 31 + 108) * 0.15;
          return (
            <div
              key={`sp-${i}`}
              style={{
                position: "absolute",
                left: `${x}%`,
                top: `${y}%`,
                width: size,
                height: size,
                borderRadius: "50%",
                backgroundColor: `rgba(160,160,160,${alpha})`,
                pointerEvents: "none",
              }}
            />
          );
        })}
      </div>

      {/* Tiny green crosshair — delicate, small */}
      <div
        style={{
          position: "absolute",
          left: `${crossX}%`,
          top: `${crossY}%`,
          transform: "translate(-50%, -50%)",
          opacity: crosshairOpacity,
        }}
      >
        {/* Horizontal line */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: 14,
            height: 1.5,
            backgroundColor: GREEN,
            transform: "translate(-50%, -50%)",
          }}
        />
        {/* Vertical line */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: 1.5,
            height: 14,
            backgroundColor: GREEN,
            transform: "translate(-50%, -50%)",
          }}
        />
      </div>
    </div>
  );
};

/* ─── Scene 11 — Three Icons (120 frames / 4s) ─── */

const AtomIcon: React.FC<{ size: number; color: string }> = ({
  size,
  color,
}) => (
  <svg width={size} height={size} viewBox="0 0 80 80" fill="none">
    <circle cx="40" cy="40" r="6" fill={color} />
    <ellipse
      cx="40"
      cy="40"
      rx="30"
      ry="12"
      stroke={color}
      strokeWidth="2.5"
      fill="none"
    />
    <ellipse
      cx="40"
      cy="40"
      rx="30"
      ry="12"
      stroke={color}
      strokeWidth="2.5"
      fill="none"
      transform="rotate(60 40 40)"
    />
    <ellipse
      cx="40"
      cy="40"
      rx="30"
      ry="12"
      stroke={color}
      strokeWidth="2.5"
      fill="none"
      transform="rotate(120 40 40)"
    />
  </svg>
);

const LayersIcon: React.FC<{ size: number; color: string }> = ({
  size,
  color,
}) => (
  <svg width={size} height={size} viewBox="0 0 80 80" fill="none">
    <polygon
      points="40,20 62,34 40,48 18,34"
      stroke={color}
      strokeWidth="2.5"
      fill="none"
      strokeLinejoin="round"
    />
    <polygon
      points="40,32 62,46 40,60 18,46"
      stroke={color}
      strokeWidth="2.5"
      fill="none"
      strokeLinejoin="round"
    />
    <polygon
      points="40,44 62,58 40,72 18,58"
      stroke={color}
      strokeWidth="2.5"
      fill="none"
      strokeLinejoin="round"
    />
  </svg>
);

const GlobeIcon: React.FC<{ size: number; color: string }> = ({
  size,
  color,
}) => (
  <svg width={size} height={size} viewBox="0 0 80 80" fill="none">
    <circle cx="40" cy="40" r="28" stroke={color} strokeWidth="2.5" />
    <ellipse
      cx="40"
      cy="40"
      rx="14"
      ry="28"
      stroke={color}
      strokeWidth="2"
    />
    <line
      x1="12"
      y1="30"
      x2="68"
      y2="30"
      stroke={color}
      strokeWidth="1.5"
    />
    <line
      x1="12"
      y1="50"
      x2="68"
      y2="50"
      stroke={color}
      strokeWidth="1.5"
    />
  </svg>
);

const ICONS = [AtomIcon, LayersIcon, GlobeIcon] as const;

export const Scene11_ThreeIcons: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const TOTAL = 120;
  const fade = sceneFade(frame, TOTAL, 8, 8);

  return (
    <div style={{ position: "absolute", inset: 0, opacity: fade }}>
      <LightBg />
      <Center>
        <div style={{ display: "flex", gap: 80, alignItems: "center" }}>
          {ICONS.map((Icon, i) => {
            const s = spring({
              frame: frame - 15 - i * 12,
              fps,
              config: { damping: 12, stiffness: 120, mass: 0.8 },
            });
            return (
              <div
                key={i}
                style={{
                  transform: `scale(${s})`,
                  opacity: s,
                }}
              >
                <Icon size={90} color={GREEN} />
              </div>
            );
          })}
        </div>
      </Center>
    </div>
  );
};

/* ─── Scene 12 — Accuracy Dots (150 frames / 5s) ─── */

// Dot-matrix digits for "6" and "3" on a 5×7 grid
const DIGIT_6 = [
  [0, 1, 1, 1, 0],
  [1, 0, 0, 0, 0],
  [1, 0, 0, 0, 0],
  [1, 1, 1, 1, 0],
  [1, 0, 0, 0, 1],
  [1, 0, 0, 0, 1],
  [0, 1, 1, 1, 0],
];
const DIGIT_3 = [
  [0, 1, 1, 1, 0],
  [1, 0, 0, 0, 1],
  [0, 0, 0, 0, 1],
  [0, 0, 1, 1, 0],
  [0, 0, 0, 0, 1],
  [1, 0, 0, 0, 1],
  [0, 1, 1, 1, 0],
];
// Percent sign dot pattern — simplified
const DIGIT_PCT = [
  [1, 1, 0, 0, 1],
  [1, 1, 0, 1, 0],
  [0, 0, 1, 0, 0],
  [0, 0, 1, 0, 0],
  [0, 1, 0, 0, 0],
  [0, 1, 0, 1, 1],
  [1, 0, 0, 1, 1],
];

function buildDotPositions(
  digit: number[][],
  offsetX: number,
  offsetY: number,
  dotSpacing: number
): { x: number; y: number; index: number }[] {
  const dots: { x: number; y: number; index: number }[] = [];
  let idx = 0;
  for (let row = 0; row < digit.length; row++) {
    for (let col = 0; col < digit[row].length; col++) {
      if (digit[row][col]) {
        dots.push({
          x: offsetX + col * dotSpacing,
          y: offsetY + row * dotSpacing,
          index: idx++,
        });
      }
    }
  }
  return dots;
}

export const Scene12_AccuracyDots: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const TOTAL = 150;
  const fade = sceneFade(frame, TOTAL, 8, 8);

  const dotSize = 24;
  const spacing = 38;
  const digitWidth = 5 * spacing;
  const digitGap = 20;
  const totalWidth = digitWidth * 3 + digitGap * 2;
  const startX = (1920 - totalWidth) / 2;
  const startY = (1080 - 7 * spacing) / 2 - 20;

  const dots6 = buildDotPositions(DIGIT_6, startX, startY, spacing);
  const dots3 = buildDotPositions(
    DIGIT_3,
    startX + digitWidth + digitGap,
    startY,
    spacing
  );
  const dotsPct = buildDotPositions(
    DIGIT_PCT,
    startX + digitWidth * 2 + digitGap * 2,
    startY,
    spacing
  );
  const allDots = [...dots6, ...dots3, ...dotsPct];

  // Text overlaid on the dots — horizontally centered, vertically at ~mid-height of digits
  const textP = progress(frame, 40, 20);
  const textOpacity = easeOutExpo(textP);

  return (
    <div style={{ position: "absolute", inset: 0, opacity: fade }}>
      <LightBg />
      {allDots.map((dot, i) => {
        const enterFrame = 8 + i * 0.8;
        const s = spring({
          frame: frame - enterFrame,
          fps,
          config: { damping: 10, stiffness: 200, mass: 0.5 },
        });
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: dot.x - dotSize / 2,
              top: dot.y - dotSize / 2,
              width: dotSize,
              height: dotSize,
              borderRadius: "50%",
              backgroundColor: GREEN,
              transform: `scale(${s})`,
              opacity: s,
            }}
          />
        );
      })}
      {/* Text overlaid across the middle of the dots */}
      <div
        style={{
          position: "absolute",
          top: startY + 3 * spacing - 20,
          left: 0,
          right: 0,
          textAlign: "center",
          ...baseText,
          fontSize: 44,
          opacity: textOpacity,
          transform: `translateY(${(1 - textOpacity) * 10}px)`,
        }}
      >
        with an average accuracy of about
      </div>
    </div>
  );
};

/* ─── Scene 13 — 120 Billion (150 frames / 5s) ─── */

function formatCounter(value: number): string {
  return Math.floor(value).toLocaleString("en-US");
}

export const Scene13_120Billion: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const TOTAL = 150;
  const fade = sceneFade(frame, TOTAL, 8, 8);

  const TARGET = 120_246_505_336;
  const counterP = progress(frame, 5, 60);
  const counterValue = TARGET * easeOutExpo(counterP);

  const mainTextP = progress(frame, 30, 20);
  const mainOpacity = easeOutExpo(mainTextP);

  const underlineP = progress(frame, 55, 25);
  const underlineWidth = easeOutQuart(underlineP) * 100;

  return (
    <div style={{ position: "absolute", inset: 0, opacity: fade }}>
      <LightBg />
      <Center>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 24,
          }}
        >
          {/* Counter pill */}
          <div
            style={{
              backgroundColor: "#e2e2e2",
              borderRadius: 24,
              padding: "8px 28px",
              ...baseText,
              fontSize: 26,
              color: "#666",
              fontWeight: 600,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {formatCounter(counterValue)}
          </div>
          {/* Main text */}
          <div
            style={{
              opacity: mainOpacity,
              transform: `translateY(${(1 - mainOpacity) * 20}px)`,
              textAlign: "center",
            }}
          >
            <span style={{ ...baseText, fontSize: 88 }}>1 in 120 </span>
            <span
              style={{
                ...greenText,
                fontSize: 88,
                fontStyle: "italic",
                position: "relative",
                display: "inline-block",
              }}
            >
              billion
              {/* Green underline — slightly angled, hand-drawn feel */}
              <svg
                style={{
                  position: "absolute",
                  bottom: -8,
                  left: -4,
                  width: "110%",
                  height: 12,
                  overflow: "visible",
                }}
                viewBox="0 0 200 12"
                preserveAspectRatio="none"
              >
                <path
                  d={`M0,8 Q40,2 100,5 T200,4`}
                  stroke={GREEN}
                  strokeWidth="4"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray="200"
                  strokeDashoffset={200 - (underlineWidth / 100) * 200}
                />
              </svg>
            </span>
          </div>
          {/* Three small icons */}
          <div style={{ display: "flex", gap: 50, marginTop: 30 }}>
            {ICONS.map((Icon, i) => {
              const s = spring({
                frame: frame - 70 - i * 8,
                fps,
                config: { damping: 12, stiffness: 150, mass: 0.6 },
              });
              return (
                <div
                  key={i}
                  style={{ transform: `scale(${s})`, opacity: s }}
                >
                  <Icon size={44} color={GREEN} />
                </div>
              );
            })}
          </div>
        </div>
      </Center>
    </div>
  );
};

/* ─── Scene 14 — Calendar Grid (150 frames / 5s) ─── */

export const Scene14_CalendarGrid: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const TOTAL = 150;
  const fade = sceneFade(frame, TOTAL, 8, 8);

  // Large grid aligned to left edge, trailing off on the right
  const COLS = 40;
  const ROWS = 15;
  const cellSize = 18;
  const gap = 6;
  const gridX = 40; // Left-aligned, small margin
  const gridY = 240;

  const textP = progress(frame, 5, 18);
  const textOpacity = easeOutExpo(textP);

  // Year counter: animates from ~3,600 to 3,788
  const yearP = progress(frame, 5, 50);
  const yearValue = Math.floor(3600 + 188 * easeOutExpo(yearP));

  return (
    <div style={{ position: "absolute", inset: 0, opacity: fade }}>
      <LightBg />
      {/* Title — left-aligned to match grid */}
      <div
        style={{
          position: "absolute",
          top: 130,
          left: 0,
          right: 0,
          textAlign: "center",
          ...baseText,
          fontSize: 80,
          opacity: textOpacity,
          transform: `translateY(${(1 - textOpacity) * 20}px)`,
        }}
      >
        over {yearValue.toLocaleString("en-US")} years
      </div>
      {/* Grid — fills from left, trailing edge on right */}
      {Array.from({ length: ROWS }).map((_, row) =>
        Array.from({ length: COLS }).map((_, col) => {
          // Rightward wave: delay increases with column
          // Trailing edge on the right side
          const waveDelay = col * 1.8 + row * 0.5;
          const maxCol = COLS - 1;

          // The rightmost columns trail off with decreasing probability
          const trailStart = maxCol - 10;
          const isTrailZone = col > trailStart;
          const trailChance = isTrailZone
            ? 1 - ((col - trailStart) / 10) * 0.8
            : 1;
          // Also fade the bottom-right corner
          const cornerDist = Math.max(0, (col - trailStart) + (row - (ROWS - 5)));
          const cornerChance = cornerDist > 0 ? Math.max(0, 1 - cornerDist * 0.15) : 1;
          const shouldShow = srand(row * COLS + col + 42) < trailChance * cornerChance;
          if (!shouldShow) return null;

          const enterDelay = 20 + waveDelay;
          const s = spring({
            frame: frame - enterDelay,
            fps,
            config: { damping: 14, stiffness: 200, mass: 0.4 },
          });

          return (
            <div
              key={`${row}-${col}`}
              style={{
                position: "absolute",
                left: gridX + col * (cellSize + gap),
                top: gridY + row * (cellSize + gap),
                width: cellSize,
                height: cellSize,
                borderRadius: 3,
                backgroundColor: GREEN,
                transform: `scale(${s})`,
                opacity: s,
              }}
            />
          );
        })
      )}
    </div>
  );
};

/* ─── Scene 15 — Timeline 2019 (150 frames / 5s) ─── */

export const Scene15_Timeline2019: React.FC = () => {
  const frame = useCurrentFrame();
  const TOTAL = 150;
  const fade = sceneFade(frame, TOTAL, 8, 8);

  // Year counter: animates from 2016 to 2019
  const yearP = progress(frame, 8, 40);
  const yearValue = Math.floor(2016 + 3 * easeOutExpo(yearP));

  const rulerP = progress(frame, 15, 40);
  const rulerWidth = easeOutExpo(rulerP) * 100;

  const TICK_COUNT = 60;
  const rulerY = 590;
  const rulerLeft = 0;
  const rulerRight = 1920;
  const rulerSpan = rulerRight - rulerLeft;

  return (
    <div style={{ position: "absolute", inset: 0, opacity: fade }}>
      <LightBg />
      {/* "In 20XX" — centered */}
      <div
        style={{
          position: "absolute",
          top: 400,
          left: 0,
          right: 0,
          textAlign: "center",
        }}
      >
        {(() => {
          const { opacity: inOp, y: inY } = wordReveal(frame, 8, 6);
          return (
            <span
              style={{
                ...baseText,
                fontSize: 100,
                display: "inline-block",
                marginRight: 24,
                opacity: inOp,
                transform: `translateY(${inY}px)`,
              }}
            >
              In
            </span>
          );
        })()}
        {(() => {
          const { opacity: yearOp, y: yearY } = wordReveal(frame, 14, 6);
          return (
            <span
              style={{
                ...baseText,
                fontSize: 100,
                display: "inline-block",
                opacity: yearOp,
                transform: `translateY(${yearY}px)`,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {yearValue}
            </span>
          );
        })()}
      </div>
      {/* Ruler line — draws from left to right across full width */}
      <div
        style={{
          position: "absolute",
          top: rulerY,
          left: 0,
          width: `${rulerWidth}%`,
          height: 1.5,
          backgroundColor: "#bbb",
        }}
      />
      {/* Ticks */}
      {Array.from({ length: TICK_COUNT + 1 }).map((_, i) => {
        const xFrac = i / TICK_COUNT;
        const tickRevealP = rulerWidth / 100;
        if (xFrac > tickRevealP) return null;

        const isMajor = i % 5 === 0;
        const tickHeight = isMajor ? 24 : 14;
        const x = rulerLeft + xFrac * rulerSpan;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: rulerY - tickHeight / 2,
              width: isMajor ? 2 : 1,
              height: tickHeight,
              backgroundColor: "#bbb",
              opacity: interpolate(
                tickRevealP - xFrac,
                [0, 0.03],
                [0, 1],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
              ),
            }}
          />
        );
      })}
    </div>
  );
};

/* ─── Scene 16 — 49 Games (180 frames / 6s) ─── */

export const Scene16_49Games: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const TOTAL = 180;
  const fade = sceneFade(frame, TOTAL, 8, 10);

  const NODE_COUNT = 12;
  const FILLED_COUNT = 10;
  const lineY = 600;
  const lineLeft = 60;
  const lineRight = 1860;
  const nodeSpacing = (lineRight - lineLeft) / (NODE_COUNT - 1);

  // Title text: "Predicted the first 49 games" first, then "perfectly" appears
  const textP = progress(frame, 5, 18);
  const textOpacity = easeOutExpo(textP);
  const perfectlyP = progress(frame, 60, 15);
  const perfectlyOpacity = easeOutExpo(perfectlyP);

  // Line draw progress
  const lineDrawP = progress(frame, 15, 80);
  const lineDrawFrac = easeOutQuart(lineDrawP);
  const lineDrawEndX = lineLeft + (lineRight - lineLeft) * lineDrawFrac;

  // Color transition point — green up to filled, gray after
  const greenEndX = lineLeft + nodeSpacing * (FILLED_COUNT - 1);

  return (
    <div style={{ position: "absolute", inset: 0, opacity: fade }}>
      <LightBg />
      {/* Title */}
      <div
        style={{
          position: "absolute",
          top: 370,
          left: 0,
          right: 0,
          textAlign: "center",
          ...baseText,
          fontSize: 56,
          opacity: textOpacity,
          transform: `translateY(${(1 - textOpacity) * 15}px)`,
        }}
      >
        Predicted the first 49 games{" "}
        <span style={{ opacity: perfectlyOpacity }}>perfectly</span>
      </div>

      {/* Timeline line — green portion */}
      <div
        style={{
          position: "absolute",
          top: lineY - 1.5,
          left: lineLeft,
          width: Math.max(0, Math.min(lineDrawEndX, greenEndX) - lineLeft),
          height: 3,
          backgroundColor: GREEN,
          borderRadius: 2,
        }}
      />
      {/* Timeline line — gray portion */}
      {lineDrawEndX > greenEndX && (
        <div
          style={{
            position: "absolute",
            top: lineY - 1.5,
            left: greenEndX,
            width: Math.max(0, lineDrawEndX - greenEndX),
            height: 3,
            backgroundColor: "#ccc",
            borderRadius: 2,
          }}
        />
      )}

      {/* Nodes */}
      {Array.from({ length: NODE_COUNT }).map((_, i) => {
        const x = lineLeft + i * nodeSpacing;
        const isFilled = i < FILLED_COUNT;
        const nodeEnterFrame = 20 + i * 6;

        if (lineDrawEndX < x - 10) return null;

        const s = spring({
          frame: frame - nodeEnterFrame,
          fps,
          config: { damping: 10, stiffness: 150, mass: 0.6 },
        });

        const nodeSize = isFilled ? 48 : 40;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x - nodeSize / 2,
              top: lineY - nodeSize / 2,
              width: nodeSize,
              height: nodeSize,
              borderRadius: "50%",
              backgroundColor: isFilled ? GREEN : "transparent",
              border: isFilled ? `3px solid ${GREEN}` : "3px solid #ccc",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: `scale(${s})`,
              opacity: s,
              boxSizing: "border-box",
            }}
          >
            {isFilled && s > 0.5 && (
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <path
                  d="M5 11.5L9.5 16L17 7"
                  stroke="white"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>
        );
      })}
    </div>
  );
};
