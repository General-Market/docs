import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
import { useGsapProxy } from "../standrew/gsapUtils";
import { DynamicBlue, DynamicLight, ZoomedBg } from "./dynamics";

const { fontFamily } = loadFont("normal", { subsets: ["latin"], weights: ["400", "700", "800"] });
const BLUE = "#0ABAB5";

const baseText: React.CSSProperties = {
  fontFamily,
  fontWeight: 800,
  fontStyle: "italic",
  lineHeight: 1.2,
  display: "inline-block",
};

// ────────────────────────────────────────────────────────
// Scene 04 — FilterAndPercent  (108 frames = 4.5s)
// "Rainbows filters out illegal activities" (BlueGradient)
//   → "70%" + "of your potential profits." (LightGradient + starburst)
// ────────────────────────────────────────────────────────

const SCENE04_DURATION = 108;
const SCENE04_PHRASE_A = ["Rainbows", "filters", "out", "illegal", "activities"] as const;
const STARBURST_COUNT = 12;

function buildScene04Proxies() {
  const init: Record<string, Record<string, number>> = {
    phase1: { opacity: 1 },
    phase2: { opacity: 0 },
    counter: { value: 0, opacity: 0, scale: 0 },
    starburst: { length: 80, opacity: 0 },
    subtitle: { opacity: 0 },
  };
  SCENE04_PHRASE_A.forEach((_, i) => {
    init[`a_${i}`] = { opacity: 0, y: 15 };
  });
  return init;
}

const scene04Init = buildScene04Proxies();

export const Scene04_FilterAndPercent: React.FC = () => {
  const s = useGsapProxy(
    (tl, p) => {
      SCENE04_PHRASE_A.forEach((_, i) => {
        tl.to(p[`a_${i}`], { opacity: 1, y: 0, duration: 0.16, ease: "power2.out" }, 0.05 + i * 0.18);
      });

      tl.to(p.phase1, { opacity: 0, duration: 0.2, ease: "power2.in" }, 1.95);

      tl.to(p.phase2, { opacity: 1, duration: 0.2, ease: "power2.out" }, 2.15);

      tl.to(p.counter, { opacity: 1, duration: 0.18 }, 2.2);
      tl.to(p.counter, { scale: 1, duration: 0.55, ease: "back.out(1.7)" }, 2.2);
      tl.to(p.counter, { value: 70, duration: 1.4, ease: "power2.out" }, 2.2);

      tl.to(p.starburst, { opacity: 1, duration: 0.18 }, 2.45);
      tl.to(p.starburst, { length: 1100, duration: 1.8, ease: "power2.out" }, 2.45);

      tl.to(p.subtitle, { opacity: 1, duration: 0.28, ease: "power2.out" }, 3.1);
    },
    scene04Init,
  );

  const counterValue = Math.round(s.counter.value);

  return (
    <AbsoluteFill>
      {/* Phase 1 — DynamicBlue + word stagger */}
      <AbsoluteFill style={{ opacity: s.phase1.opacity }}>
        <ZoomedBg duration={SCENE04_DURATION}>
          <DynamicBlue />
        </ZoomedBg>
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "8%",
            transform: "translateY(-50%)",
            maxWidth: "84%",
            display: "flex",
            flexWrap: "wrap",
            gap: "12px 22px",
          }}
        >
          {SCENE04_PHRASE_A.map((word, i) => {
            const proxy = s[`a_${i}`];
            return (
              <span
                key={i}
                style={{
                  ...baseText,
                  fontSize: 110,
                  color: "#fff",
                  opacity: proxy.opacity,
                  transform: `translateY(${proxy.y}px)`,
                }}
              >
                {word}
              </span>
            );
          })}
        </div>
      </AbsoluteFill>

      {/* Phase 2 — DynamicLight + starburst + 70% counter */}
      <AbsoluteFill style={{ opacity: s.phase2.opacity }}>
        <ZoomedBg duration={SCENE04_DURATION}>
          <DynamicLight />
        </ZoomedBg>

        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: 0,
            height: 0,
            opacity: s.starburst.opacity,
          }}
        >
          {Array.from({ length: STARBURST_COUNT }, (_, i) => {
            const angle = (360 / STARBURST_COUNT) * i;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: s.starburst.length,
                  height: 4,
                  backgroundColor: BLUE,
                  transformOrigin: "0% 50%",
                  transform: `rotate(${angle}deg) translateX(100px)`,
                  opacity: 0.5,
                }}
              />
            );
          })}
        </div>

        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: `translate(-50%, -50%) scale(${Math.max(s.counter.scale, 0)})`,
            textAlign: "center",
            opacity: s.counter.opacity,
          }}
        >
          <div style={{ ...baseText, fontSize: 280, color: BLUE }}>
            {counterValue}%
          </div>
          <div
            style={{
              ...baseText,
              fontSize: 80,
              fontWeight: 700,
              color: BLUE,
              opacity: s.subtitle.opacity,
              marginTop: -4,
              whiteSpace: "nowrap",
            }}
          >
            of your potential profits
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ────────────────────────────────────────────────────────
// Scene 05 — Manipulators  (108 frames = 4.5s)
// Unified rounded-square conveyor; the four predators wear color.
// GM logo, top-right, plays sniper: pulse → tracer → detonate.
// "frontrunners / orderbook spoofers / illegal insiders / market manipulators"
// ────────────────────────────────────────────────────────

const SCENE05_DURATION = 108;

const TRADES: { color: string; predator: boolean }[] = [
  { color: "#FFD700", predator: true },  // 0 → market manipulators (gold)
  { color: "#FF3B6B", predator: true },  // 1 → illegal insiders (red)
  { color: "#FFFFFF", predator: false }, // 2 plain
  { color: "#00E5FF", predator: true },  // 3 → orderbook spoofers (cyan)
  { color: "#FFFFFF", predator: false }, // 4 plain
  { color: "#FF6B00", predator: true },  // 5 → frontrunners (orange)
];

const VICTIM_INDEXES = [5, 3, 1, 0] as const;
const LABELS = ["frontrunners", "orderbook spoofers", "illegal insiders", "market manipulators"] as const;

const SHAPE_SIZE = 200;
const SPACING = 260;
const STAGE_W = 1920;
const STAGE_H = 1080;
const CONVEYOR_LEFT = 0.08 * STAGE_W;     // 153.6
const CONVEYOR_TOP = 0.62 * STAGE_H;      // 669.6
const SHAPE_CENTER_DY = SHAPE_SIZE / 2;

const LOGO_SIZE = 130;
const LOGO_RIGHT = 110;
const LOGO_TOP = 90;
const LOGO_CENTER_X = STAGE_W - LOGO_RIGHT - LOGO_SIZE / 2;
const LOGO_CENTER_Y = LOGO_TOP + LOGO_SIZE / 2;

function buildScene05Proxies() {
  const init: Record<string, Record<string, number>> = {};
  TRADES.forEach((_, i) => { init[`shape_${i}`] = { opacity: 0 }; });
  init.conveyor = { x: 0 };
  init.logo = { opacity: 0, scale: 1, glow: 0 };
  for (let i = 0; i < LABELS.length; i++) {
    init[`label_${i}`] = { opacity: 0, scale: 0.85 };
    init[`tracer_${i}`] = { progress: 0, opacity: 0 };
    init[`detonate_${i}`] = { scale: 1, opacity: 1, burst: 0 };
  }
  return init;
}

const scene05Init = buildScene05Proxies();

export const Scene05_Manipulators: React.FC = () => {
  const s = useGsapProxy(
    (tl, p) => {
      tl.to(p.logo, { opacity: 1, duration: 0.32, ease: "power2.out" }, 0.05);

      TRADES.forEach((_, i) => {
        tl.to(p[`shape_${i}`], { opacity: 1, duration: 0.2 }, i * 0.1);
      });

      const passStarts = [0.5, 1.45, 2.4, 3.35];
      passStarts.forEach((start, passIdx) => {
        // Label pop-in
        tl.to(p[`label_${passIdx}`], { opacity: 1, scale: 1, duration: 0.16, ease: "back.out(1.7)" }, start);

        // Logo pulse + glow
        tl.to(p.logo, { scale: 1.22, glow: 1, duration: 0.08, ease: "power2.out" }, start);
        tl.to(p.logo, { scale: 1, glow: 0, duration: 0.24, ease: "power2.in" }, start + 0.08);

        // Tracer draws from logo to victim, then fades
        tl.to(p[`tracer_${passIdx}`], { opacity: 1, duration: 0.04 }, start + 0.06);
        tl.to(p[`tracer_${passIdx}`], { progress: 1, duration: 0.16, ease: "power2.out" }, start + 0.06);
        tl.to(p[`tracer_${passIdx}`], { opacity: 0, duration: 0.14, ease: "power2.in" }, start + 0.26);

        // Detonate — replaces the old yank
        tl.to(p[`detonate_${passIdx}`], { scale: 1.5, duration: 0.22, ease: "power2.out" }, start + 0.22);
        tl.to(p[`detonate_${passIdx}`], { opacity: 0, duration: 0.22, ease: "power2.in" }, start + 0.24);
        tl.to(p[`detonate_${passIdx}`], { burst: 1, duration: 0.5, ease: "power2.out" }, start + 0.22);

        // Label fade
        tl.to(p[`label_${passIdx}`], { opacity: 0, duration: 0.18, ease: "power2.in" }, start + 0.78);
      });

      tl.to(p.conveyor, { x: -120, duration: 4.0, ease: "none" }, 0.3);
    },
    scene05Init,
  );

  const victimCenter = (shapeIdx: number) => ({
    x: CONVEYOR_LEFT + s.conveyor.x + shapeIdx * SPACING + SHAPE_SIZE / 2,
    y: CONVEYOR_TOP + SHAPE_CENTER_DY,
  });

  return (
    <AbsoluteFill>
      <ZoomedBg duration={SCENE05_DURATION}>
        <DynamicBlue />
      </ZoomedBg>

      {/* Labels */}
      <AbsoluteFill>
        {LABELS.map((label, i) => {
          const proxy = s[`label_${i}`];
          if (proxy.opacity < 0.01) return null;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                top: "28%",
                left: "50%",
                transform: `translate(-50%, -50%) scale(${proxy.scale})`,
                opacity: proxy.opacity,
              }}
            >
              <span
                style={{
                  ...baseText,
                  fontSize: 130,
                  color: "#fff",
                  whiteSpace: "nowrap",
                }}
              >
                {label}
              </span>
            </div>
          );
        })}
      </AbsoluteFill>

      {/* Unified rounded-square conveyor */}
      <div
        style={{
          position: "absolute",
          top: CONVEYOR_TOP,
          left: CONVEYOR_LEFT,
          transform: `translateX(${s.conveyor.x}px)`,
          display: "flex",
          alignItems: "flex-start",
          gap: SPACING - SHAPE_SIZE,
        }}
      >
        {TRADES.map((sh, i) => {
          const shapeProxy = s[`shape_${i}`];
          const victimSlot = VICTIM_INDEXES.indexOf(i as typeof VICTIM_INDEXES[number]);
          const det = victimSlot >= 0 ? s[`detonate_${victimSlot}`] : null;
          const detScale = det ? det.scale : 1;
          const finalOpacity = det ? shapeProxy.opacity * det.opacity : shapeProxy.opacity;

          return (
            <div
              key={i}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div
                style={{
                  width: SHAPE_SIZE,
                  height: SHAPE_SIZE,
                  backgroundColor: sh.color,
                  borderRadius: 28,
                  opacity: finalOpacity,
                  transform: `scale(${detScale})`,
                  boxShadow: sh.predator ? `0 0 24px ${sh.color}55` : "none",
                }}
              />
              <div
                style={{
                  width: 40,
                  height: 3,
                  backgroundColor: "rgba(0,0,0,0.35)",
                  borderRadius: 2,
                }}
              />
            </div>
          );
        })}
      </div>

      {/* GM logo — the sniper */}
      <div
        style={{
          position: "absolute",
          top: LOGO_TOP,
          right: LOGO_RIGHT,
          width: LOGO_SIZE,
          height: LOGO_SIZE,
          opacity: s.logo.opacity,
          transform: `scale(${s.logo.scale})`,
          transformOrigin: "center",
          filter: `drop-shadow(0 0 ${s.logo.glow * 28}px ${BLUE})`,
        }}
      >
        <Img
          src={staticFile("gm-logo-white.svg")}
          style={{ width: "100%", height: "100%", display: "block" }}
        />
      </div>

      {/* Tracers + particle bursts */}
      <svg
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
        viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
      >
        {VICTIM_INDEXES.map((shapeIdx, passIdx) => {
          const tracer = s[`tracer_${passIdx}`];
          const det = s[`detonate_${passIdx}`];
          const target = victimCenter(shapeIdx);
          const endX = LOGO_CENTER_X + tracer.progress * (target.x - LOGO_CENTER_X);
          const endY = LOGO_CENTER_Y + tracer.progress * (target.y - LOGO_CENTER_Y);

          return (
            <g key={passIdx}>
              {tracer.opacity > 0.01 && (
                <line
                  x1={LOGO_CENTER_X}
                  y1={LOGO_CENTER_Y}
                  x2={endX}
                  y2={endY}
                  stroke={BLUE}
                  strokeWidth={3}
                  strokeOpacity={tracer.opacity}
                  strokeLinecap="round"
                />
              )}

              {det.burst > 0.01 &&
                Array.from({ length: 8 }, (_, pi) => {
                  const angle = (pi / 8) * Math.PI * 2;
                  const r = det.burst * 150;
                  const px = target.x + Math.cos(angle) * r;
                  const py = target.y + Math.sin(angle) * r;
                  const opacity = Math.max(0, 1 - det.burst);
                  return (
                    <circle
                      key={pi}
                      cx={px}
                      cy={py}
                      r={6}
                      fill={TRADES[shapeIdx].color}
                      opacity={opacity}
                    />
                  );
                })}
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

// ── Meta ──

export const sceneMetasB = [
  { id: "RB-Scene04-FilterAndPercent", component: Scene04_FilterAndPercent, durationInFrames: SCENE04_DURATION },
  { id: "RB-Scene05-Manipulators", component: Scene05_Manipulators, durationInFrames: SCENE05_DURATION },
];
