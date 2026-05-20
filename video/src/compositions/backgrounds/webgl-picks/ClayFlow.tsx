// Claymorphism funnel — the source was a horizontal-scroll diagram that
// scrubbed a 2500px canvas through the viewport while pop-in animations and
// SVG line-draws fired as elements entered. Here scroll progress becomes
// frame progress: the canvas pans left over the whole scene, and each
// element wakes up when its on-screen X enters the trigger zone.

import React, { useMemo } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from "remotion";

const CANVAS_W = 2500;
const CANVAS_H = 1000;
const VIEW_W = 1920;
const PAN_OVERSHOOT = 200; // matches the source's "+200" tail
const SCROLL_MAX = CANVAS_W - VIEW_W + PAN_OVERSHOOT;

const BG = "#e0e5ec";
const SHADOW_DARK = "#a3b1c6";
const SHADOW_LIGHT = "#ffffff";
const TEXT_DARK = "#2d3436";
const TEXT_MUTED = "#636e72";

// ── Element definitions, copied from the source ────────────────────────────

type Dot = { kind: "dot"; x: number; y: number };
type Plus = { kind: "plus"; x: number; y: number };
type Card = {
  kind: "card";
  x: number;
  y: number;
  overlay: string;
  badgeColor: string;
  pctColor: string;
  pct: string;
  index: string;
  icon: string;
  title: string;
  stats: [number, number, number];
};
type Element = Dot | Plus | Card;

type Path = { d: string };

const ELEMENTS: Element[] = [
  { kind: "dot", x: 100, y: 500 },
  { kind: "plus", x: 250, y: 500 },
  { kind: "dot", x: 400, y: 500 },
  {
    kind: "card",
    x: 520,
    y: 500,
    overlay: "rgba(220, 53, 69, 0.75)",
    badgeColor: "#6f42c1",
    pctColor: "#e84118",
    pct: "-30%",
    index: "1",
    icon: "💬",
    title: "Welcome",
    stats: [100, 78, 70],
  },
  { kind: "dot", x: 640, y: 500 },
  { kind: "plus", x: 790, y: 350 },
  { kind: "plus", x: 820, y: 500 },
  { kind: "plus", x: 790, y: 650 },
  { kind: "dot", x: 1000, y: 200 },
  {
    kind: "card",
    x: 1120,
    y: 200,
    overlay: "rgba(46, 204, 113, 0.75)",
    badgeColor: "#6f42c1",
    pctColor: "#27ae60",
    pct: "+12%",
    index: "2",
    icon: "🎥",
    title: "Onboarding",
    stats: [85, 62, 55],
  },
  { kind: "dot", x: 1000, y: 500 },
  {
    kind: "card",
    x: 1120,
    y: 500,
    overlay: "rgba(108, 92, 231, 0.75)",
    badgeColor: "#e84393",
    pctColor: "#747d8c",
    pct: "-7.4%",
    index: "3",
    icon: "🔗",
    title: "Tutorials",
    stats: [54, 30, 18],
  },
  { kind: "dot", x: 1000, y: 800 },
  {
    kind: "card",
    x: 1120,
    y: 800,
    overlay: "rgba(52, 152, 219, 0.75)",
    badgeColor: "#6f42c1",
    pctColor: "#e67e22",
    pct: "+45%",
    index: "4",
    icon: "🛒",
    title: "Checkout",
    stats: [120, 110, 95],
  },
  { kind: "dot", x: 1240, y: 500 },
  { kind: "plus", x: 1420, y: 500 },
  { kind: "dot", x: 1600, y: 500 },
  {
    kind: "card",
    x: 1720,
    y: 500,
    overlay: "rgba(232, 67, 147, 0.75)",
    badgeColor: "#0984e3",
    pctColor: "#00b894",
    pct: "100%",
    index: "5",
    icon: "🎉",
    title: "Success End",
    stats: [40, 40, 40],
  },
];

const PATHS: Path[] = [
  { d: "M 100 500 L 400 500" },
  { d: "M 640 500 C 750 500, 800 200, 1000 200" },
  { d: "M 640 500 L 1000 500" },
  { d: "M 640 500 C 750 500, 800 800, 1000 800" },
  { d: "M 1240 500 L 1600 500" },
];

// ── Approximate the leftmost X each path occupies. Used as the trigger. ────
function leftXOfPath(d: string): number {
  const nums = d.match(/-?\d+(\.\d+)?/g);
  if (!nums) return 0;
  let min = Infinity;
  for (let i = 0; i < nums.length; i += 2) {
    const x = parseFloat(nums[i]);
    if (x < min) min = x;
  }
  return min;
}

// ── Composition ─────────────────────────────────────────────────────────────

export const ClayFlow: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Scroll-instruction fades out in the first 10% of the scene
  const instructionOpacity = interpolate(
    frame,
    [0, durationInFrames * 0.08, durationInFrames * 0.12],
    [1, 1, 0],
    { extrapolateRight: "clamp" },
  );

  // Canvas pan — 0 to -SCROLL_MAX across the scene
  const panX = interpolate(frame, [0, durationInFrames], [0, -SCROLL_MAX], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });

  // Per-element pop-in: fires when the element's screen X enters the trigger
  // zone. Source used "left right-=150" — so trigger ≈ viewportRight - 150.
  // Input is negated so the range stays monotonically increasing as required
  // by Remotion's interpolate; sx decreases as the canvas pans left.
  const screenX = (canvasX: number) => canvasX + panX;
  const popProgress = (canvasX: number) => {
    const sx = screenX(canvasX);
    return interpolate(-sx, [-(VIEW_W - 150), -(VIEW_W - 350)], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(0.34, 1.56, 0.64, 1), // back.out
    });
  };

  // Per-path draw progress: the source used "left right-=200" → "right center".
  // Same negation trick — sx falling from VIEW_W-200 to VIEW_W*0.5-200
  // becomes -sx rising from -(VIEW_W-200) to -(VIEW_W*0.5-200).
  const drawProgress = (d: string) => {
    const lx = leftXOfPath(d);
    const sx = lx + panX;
    return interpolate(-sx, [-(VIEW_W - 200), -(VIEW_W * 0.5 - 200)], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.quad),
    });
  };

  // Precompute path lengths via the standard polyline approximation
  const pathLengths = useMemo(() => PATHS.map((p) => approxLength(p.d)), []);

  return (
    <AbsoluteFill style={{ backgroundColor: BG, overflow: "hidden" }}>
      {/* Scroll instruction chip */}
      <div
        style={{
          position: "absolute",
          bottom: 60,
          left: "50%",
          transform: "translateX(-50%)",
          fontFamily: "'Segoe UI', sans-serif",
          fontWeight: 700,
          color: TEXT_MUTED,
          opacity: instructionOpacity,
          background: BG,
          padding: "10px 20px",
          borderRadius: 20,
          boxShadow: `4px 4px 10px ${SHADOW_DARK}, -4px -4px 10px ${SHADOW_LIGHT}`,
          zIndex: 100,
        }}
      >
        ↓ Scroll down to trace the flow ↓
      </div>

      {/* The wide canvas, panned left */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: 0,
          transform: `translate(${panX}px, -50%)`,
          width: CANVAS_W,
          height: CANVAS_H,
        }}
      >
        {/* Connector lines */}
        <svg
          viewBox="0 0 2500 1000"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            zIndex: 1,
          }}
        >
          {PATHS.map((p, i) => {
            const len = pathLengths[i];
            const draw = drawProgress(p.d);
            const dashOffset = len * (1 - draw);
            return (
              <path
                key={i}
                d={p.d}
                stroke={TEXT_DARK}
                strokeWidth={4}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={len}
                strokeDashoffset={dashOffset}
              />
            );
          })}
        </svg>

        {/* Elements */}
        {ELEMENTS.map((el, i) => {
          const pop = popProgress(el.x);
          if (el.kind === "dot") {
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: el.x,
                  top: el.y,
                  width: 20,
                  height: 20,
                  background: TEXT_DARK,
                  border: `6px solid ${BG}`,
                  borderRadius: "50%",
                  boxShadow: `4px 4px 10px ${SHADOW_DARK}, -4px -4px 10px ${SHADOW_LIGHT}`,
                  transform: `translate(-50%, -50%) scale(${pop})`,
                  opacity: pop,
                  zIndex: 3,
                }}
              />
            );
          }
          if (el.kind === "plus") {
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: el.x,
                  top: el.y,
                  width: 44,
                  height: 44,
                  background: TEXT_DARK,
                  color: "#fff",
                  borderRadius: "50%",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  fontSize: 24,
                  fontWeight: 700,
                  boxShadow: `6px 6px 12px ${SHADOW_DARK}, -6px -6px 12px ${SHADOW_LIGHT}, inset 2px 2px 4px rgba(255,255,255,0.2), inset -2px -2px 4px rgba(0,0,0,0.5)`,
                  border: `2px solid ${BG}`,
                  transform: `translate(-50%, -50%) scale(${pop}) rotate(${
                    (1 - pop) * -90
                  }deg)`,
                  opacity: pop,
                  zIndex: 4,
                }}
              >
                +
              </div>
            );
          }
          // Card
          const c = el as Card;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: c.x,
                top: c.y,
                width: 250,
                height: 250,
                background: BG,
                borderRadius: 32,
                border: "3px solid rgba(255, 255, 255, 0.5)",
                boxShadow: `12px 12px 24px ${SHADOW_DARK}, -12px -12px 24px ${SHADOW_LIGHT}`,
                transform: `translate(-50%, -50%) scale(${pop})`,
                opacity: pop,
                zIndex: 2,
                overflow: "hidden",
              }}
            >
              {/* Video stand-in: solid gradient block (no remote images) */}
              <div
                style={{
                  position: "relative",
                  height: 190,
                  width: "100%",
                  borderRadius: "28px 28px 0 0",
                  overflow: "hidden",
                  background:
                    "linear-gradient(135deg, #2a2a2a 0%, #4a4a4a 100%)",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: c.overlay,
                    opacity: 0.85,
                    mixBlendMode: "hard-light",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    top: 16,
                    left: 16,
                    right: 16,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                  }}
                >
                  <div style={{ display: "flex", gap: 8 }}>
                    <span style={badgeStyle(c.badgeColor)}>{c.index}</span>
                    <span style={badgeStyle(c.pctColor)}>{c.pct}</span>
                  </div>
                  <span style={iconBadgeStyle}>{c.icon}</span>
                </div>
                <div
                  style={{
                    position: "absolute",
                    bottom: 15,
                    left: 0,
                    width: "100%",
                    textAlign: "center",
                    color: "white",
                    fontWeight: 800,
                    fontSize: 18,
                    textShadow: "0 3px 6px rgba(0,0,0,0.6)",
                    letterSpacing: "0.5px",
                    fontFamily: "'Segoe UI', sans-serif",
                  }}
                >
                  {c.title}
                </div>
              </div>
              {/* Stats footer */}
              <div
                style={{
                  height: 60,
                  display: "flex",
                  justifyContent: "space-evenly",
                  alignItems: "center",
                  fontSize: 14,
                  fontWeight: 700,
                  color: TEXT_MUTED,
                  background: BG,
                  borderRadius: "0 0 28px 28px",
                  fontFamily: "'Segoe UI', sans-serif",
                }}
              >
                <span>👤 {c.stats[0]}</span>
                <span>👁️ {c.stats[1]}</span>
                <span>✅ {c.stats[2]}</span>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const badgeStyle = (bg: string): React.CSSProperties => ({
  padding: "5px 12px",
  borderRadius: 14,
  fontSize: 13,
  fontWeight: 800,
  color: "#fff",
  background: bg,
  boxShadow:
    "inset 2px 2px 4px rgba(255,255,255,0.3), 3px 3px 6px rgba(0,0,0,0.3)",
  fontFamily: "'Segoe UI', sans-serif",
});

const iconBadgeStyle: React.CSSProperties = {
  padding: "6px 10px",
  fontSize: 16,
  background: "rgba(255,255,255,0.25)",
  border: "1px solid rgba(255,255,255,0.5)",
  borderRadius: 16,
  fontFamily: "'Segoe UI', sans-serif",
};

// Cheap path-length estimate: walk through M/L/C commands as polyline. Bezier
// curves are sampled coarsely — good enough to seed strokeDasharray.
function approxLength(d: string): number {
  const tokens = d.trim().split(/\s+/);
  let i = 0;
  let cmd = "";
  let cx = 0;
  let cy = 0;
  let total = 0;
  const next = () => parseFloat(tokens[i++]);
  while (i < tokens.length) {
    const tok = tokens[i];
    if (/[A-Za-z]/.test(tok)) {
      cmd = tok;
      i++;
      continue;
    }
    if (cmd === "M") {
      cx = next();
      cy = next();
    } else if (cmd === "L") {
      const x = next();
      const y = next();
      total += Math.hypot(x - cx, y - cy);
      cx = x;
      cy = y;
    } else if (cmd === "C") {
      const x1 = next();
      const y1 = next();
      const x2 = next();
      const y2 = next();
      const x = next();
      const y = next();
      // Sample 20 points for an approx length
      let px = cx;
      let py = cy;
      for (let s = 1; s <= 20; s++) {
        const t = s / 20;
        const mt = 1 - t;
        const sx =
          mt * mt * mt * cx +
          3 * mt * mt * t * x1 +
          3 * mt * t * t * x2 +
          t * t * t * x;
        const sy =
          mt * mt * mt * cy +
          3 * mt * mt * t * y1 +
          3 * mt * t * t * y2 +
          t * t * t * y;
        total += Math.hypot(sx - px, sy - py);
        px = sx;
        py = sy;
      }
      cx = x;
      cy = y;
    } else {
      i++;
    }
  }
  return total;
}
