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
          <div
            style={{
              ...baseText,
              fontSize: 80,
              fontWeight: 700,
              color: BLUE,
              marginBottom: -8,
              lineHeight: 1,
            }}
          >
            regaining
          </div>
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
// Original geometric conveyor (diamond / hex-hole / hex / pentagon / hex / circle).
// A cartoon sniper takes the four predators out: muzzle flash → tracer → detonate.
// GM logo sits beside the sniper as the team patch.
// "frontrunners / orderbook spoofers / illegal insiders / market manipulators"
// ────────────────────────────────────────────────────────

const SCENE05_DURATION = 108;

type ShapeType = "diamond" | "hexagon" | "hexagon-hole" | "pentagon" | "circle";
const TRADES: { type: ShapeType; color: string }[] = [
  { type: "diamond", color: "#FFD700" },
  { type: "hexagon-hole", color: "#FFFFFF" },
  { type: "hexagon", color: "#FF6B00" },
  { type: "pentagon", color: "#00E5FF" },
  { type: "hexagon", color: "#9CA3AF" },
  { type: "circle", color: "#FFFFFF" },
];

const clipPaths: Record<string, string> = {
  hexagon: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
  pentagon: "polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)",
};

const Shape: React.FC<{ type: string; color: string; size: number }> = ({ type, color, size }) => {
  if (type === "diamond") {
    return (
      <div
        style={{
          width: size * 0.7,
          height: size * 0.7,
          backgroundColor: color,
          transform: "rotate(45deg)",
          borderRadius: 4,
        }}
      />
    );
  }
  if (type === "circle") {
    return (
      <div
        style={{
          width: size,
          height: size,
          backgroundColor: color,
          borderRadius: "50%",
        }}
      />
    );
  }
  if (type === "hexagon-hole") {
    return (
      <div
        style={{
          width: size,
          height: size,
          backgroundColor: color,
          clipPath: clipPaths.hexagon,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: size * 0.4,
            height: size * 0.4,
            backgroundColor: "#1a1a2e",
            borderRadius: "50%",
          }}
        />
      </div>
    );
  }
  const cp = clipPaths[type] || clipPaths.hexagon;
  return (
    <div style={{ width: size, height: size, backgroundColor: color, clipPath: cp }} />
  );
};

const VICTIM_INDEXES = [5, 3, 1, 0] as const;
const LABELS = ["frontrunners", "orderbook spoofers", "illegal insiders", "market manipulators"] as const;

const SHAPE_SIZE = 200;
const SPACING = 260;
const STAGE_W = 1920;
const STAGE_H = 1080;
const CONVEYOR_LEFT = 0.08 * STAGE_W;     // 153.6
const CONVEYOR_TOP = 0.62 * STAGE_H;      // 669.6
const SHAPE_CENTER_DY = SHAPE_SIZE / 2;

// Sniper figure (top-right). Mirrored so the rifle points left toward the conveyor.
const SNIPER_W = 320;
const SNIPER_H = SNIPER_W * (1052 / 744); // ≈ 452, native viewBox aspect
const SNIPER_RIGHT = 80;
const SNIPER_TOP = 40;
// Approximate muzzle position (in screen pixels) after horizontal flip.
// Sniper figure roughly centered; rifle muzzle sits low-left of the (flipped) figure.
const SNIPER_LEFT = STAGE_W - SNIPER_RIGHT - SNIPER_W;
const MUZZLE_X = SNIPER_LEFT + SNIPER_W * 0.18;
const MUZZLE_Y = SNIPER_TOP + SNIPER_H * 0.62;

// GM logo — small badge near the sniper.
const LOGO_SIZE = 90;
const LOGO_TOP = 70;
const LOGO_LEFT = 70;

function buildScene05Proxies() {
  const init: Record<string, Record<string, number>> = {};
  TRADES.forEach((_, i) => { init[`shape_${i}`] = { opacity: 0 }; });
  init.conveyor = { x: 0 };
  init.logo = { opacity: 0, scale: 1, glow: 0 };
  init.sniper = { opacity: 0, recoil: 0, flash: 0 };
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
      tl.to(p.sniper, { opacity: 1, duration: 0.35, ease: "power2.out" }, 0.05);

      TRADES.forEach((_, i) => {
        tl.to(p[`shape_${i}`], { opacity: 1, duration: 0.2 }, i * 0.1);
      });

      const passStarts = [0.5, 1.45, 2.4, 3.35];
      passStarts.forEach((start, passIdx) => {
        // Label pop-in
        tl.to(p[`label_${passIdx}`], { opacity: 1, scale: 1, duration: 0.16, ease: "back.out(1.7)" }, start);

        // Sniper recoil + muzzle flash
        tl.to(p.sniper, { recoil: 1, flash: 1, duration: 0.06, ease: "power2.out" }, start);
        tl.to(p.sniper, { recoil: 0, flash: 0, duration: 0.22, ease: "power2.in" }, start + 0.06);

        // GM logo sympathetic pulse
        tl.to(p.logo, { scale: 1.18, glow: 1, duration: 0.08, ease: "power2.out" }, start);
        tl.to(p.logo, { scale: 1, glow: 0, duration: 0.24, ease: "power2.in" }, start + 0.08);

        // Tracer draws from muzzle to victim, then fades
        tl.to(p[`tracer_${passIdx}`], { opacity: 1, duration: 0.04 }, start + 0.06);
        tl.to(p[`tracer_${passIdx}`], { progress: 1, duration: 0.16, ease: "power2.out" }, start + 0.06);
        tl.to(p[`tracer_${passIdx}`], { opacity: 0, duration: 0.14, ease: "power2.in" }, start + 0.26);

        // Detonate
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

      {/* Original geometric conveyor (yank-up replaced by detonate) */}
      <div
        style={{
          position: "absolute",
          top: CONVEYOR_TOP,
          left: CONVEYOR_LEFT,
          transform: `translateX(${s.conveyor.x}px)`,
          display: "flex",
          alignItems: "center",
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
                opacity: finalOpacity,
                transform: `scale(${detScale})`,
              }}
            >
              <Shape type={sh.type} color={sh.color} size={SHAPE_SIZE} />
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

      {/* Sniper — flipped horizontally so the rifle aims toward the conveyor */}
      <div
        style={{
          position: "absolute",
          top: SNIPER_TOP,
          right: SNIPER_RIGHT - s.sniper.recoil * 14,
          width: SNIPER_W,
          height: SNIPER_H,
          opacity: s.sniper.opacity,
          transform: `scaleX(-1)`,
          transformOrigin: "center",
          filter: `drop-shadow(0 8px 18px rgba(0,0,0,0.45))`,
        }}
      >
        <Img
          src={staticFile("sniper.svg")}
          style={{ width: "100%", height: "100%", display: "block" }}
        />
      </div>

      {/* GM logo — small badge */}
      <div
        style={{
          position: "absolute",
          top: LOGO_TOP,
          left: LOGO_LEFT,
          width: LOGO_SIZE,
          height: LOGO_SIZE,
          opacity: s.logo.opacity,
          transform: `scale(${s.logo.scale})`,
          transformOrigin: "center",
          filter: `drop-shadow(0 0 ${s.logo.glow * 22}px ${BLUE})`,
        }}
      >
        <Img
          src={staticFile("gm-logo-white.svg")}
          style={{ width: "100%", height: "100%", display: "block" }}
        />
      </div>

      {/* Muzzle flash + tracers + particle bursts */}
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
        {/* Muzzle flash */}
        {s.sniper.flash > 0.01 && (
          <circle
            cx={MUZZLE_X}
            cy={MUZZLE_Y}
            r={28 * s.sniper.flash}
            fill="#FFE066"
            opacity={s.sniper.flash * 0.85}
          />
        )}

        {VICTIM_INDEXES.map((shapeIdx, passIdx) => {
          const tracer = s[`tracer_${passIdx}`];
          const det = s[`detonate_${passIdx}`];
          const target = victimCenter(shapeIdx);
          const endX = MUZZLE_X + tracer.progress * (target.x - MUZZLE_X);
          const endY = MUZZLE_Y + tracer.progress * (target.y - MUZZLE_Y);

          return (
            <g key={passIdx}>
              {tracer.opacity > 0.01 && (
                <line
                  x1={MUZZLE_X}
                  y1={MUZZLE_Y}
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
