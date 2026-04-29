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
            transform: "translate(-50%, calc(-50% - 180px))",
            ...baseText,
            fontSize: 80,
            fontWeight: 700,
            color: BLUE,
            lineHeight: 1,
            whiteSpace: "nowrap",
          }}
        >
          regaining
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
// Original geometric conveyor (diamond / hex-hole / hex / pentagon / hex / circle).
// A cartoon sniper takes the four predators out: muzzle flash → tracer → detonate.
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

function buildScene05Proxies() {
  const init: Record<string, Record<string, number>> = {};
  TRADES.forEach((_, i) => { init[`shape_${i}`] = { opacity: 0 }; });
  init.conveyor = { x: 0 };
  init.title = { opacity: 0, y: 12 };
  init.rail = { opacity: 0 };
  init.sniper = { opacity: 0, recoil: 0, flash: 0 };
  for (let i = 0; i < LABELS.length; i++) {
    init[`label_${i}`] = { opacity: 0, scale: 0.85 };
    init[`tracer_${i}`] = { progress: 0, opacity: 0 };
    init[`detonate_${i}`] = { scale: 1, opacity: 1, burst: 0 };
    init[`reticle_${i}`] = { opacity: 0, scale: 3 };
    init[`smoke_${i}`] = { progress: 0 };
  }
  return init;
}

const scene05Init = buildScene05Proxies();

export const Scene05_Manipulators: React.FC = () => {
  const s = useGsapProxy(
    (tl, p) => {
      tl.to(p.title, { opacity: 1, y: 0, duration: 0.45, ease: "power2.out" }, 0.0);
      tl.to(p.rail, { opacity: 1, duration: 0.5, ease: "power2.out" }, 0.15);

      tl.to(p.sniper, { opacity: 1, duration: 0.4, ease: "power2.out" }, 0.05);

      TRADES.forEach((_, i) => {
        tl.to(p[`shape_${i}`], { opacity: 1, duration: 0.2 }, 0.15 + i * 0.1);
      });

      const passStarts = [0.55, 1.5, 2.45, 3.4];
      passStarts.forEach((start, passIdx) => {
        // Reticle locks on (appears 0.28s before the shot, scales 3 → 1)
        tl.to(p[`reticle_${passIdx}`], { opacity: 1, duration: 0.06, ease: "power1.out" }, start - 0.28);
        tl.to(p[`reticle_${passIdx}`], { scale: 1, duration: 0.26, ease: "power3.out" }, start - 0.28);

        // Label pop-in
        tl.to(p[`label_${passIdx}`], { opacity: 1, scale: 1, duration: 0.18, ease: "back.out(1.7)" }, start);

        // Sniper recoil + muzzle flash
        tl.to(p.sniper, { recoil: 1, flash: 1, duration: 0.06, ease: "power2.out" }, start);
        tl.to(p.sniper, { recoil: 0, flash: 0, duration: 0.22, ease: "power2.in" }, start + 0.06);

        // Tracer draws from muzzle to victim, then fades
        tl.to(p[`tracer_${passIdx}`], { opacity: 1, duration: 0.04 }, start + 0.06);
        tl.to(p[`tracer_${passIdx}`], { progress: 1, duration: 0.16, ease: "power2.out" }, start + 0.06);
        tl.to(p[`tracer_${passIdx}`], { opacity: 0, duration: 0.14, ease: "power2.in" }, start + 0.26);

        // Reticle fades on impact
        tl.to(p[`reticle_${passIdx}`], { opacity: 0, duration: 0.16, ease: "power2.out" }, start + 0.22);

        // Detonate
        tl.to(p[`detonate_${passIdx}`], { scale: 1.5, duration: 0.22, ease: "power2.out" }, start + 0.22);
        tl.to(p[`detonate_${passIdx}`], { opacity: 0, duration: 0.22, ease: "power2.in" }, start + 0.24);
        tl.to(p[`detonate_${passIdx}`], { burst: 1, duration: 0.55, ease: "power2.out" }, start + 0.22);

        // Smoke ring at impact
        tl.to(p[`smoke_${passIdx}`], { progress: 1, duration: 0.7, ease: "power2.out" }, start + 0.24);

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

      {/* Title — "Removing" */}
      <div
        style={{
          position: "absolute",
          top: 70,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: s.title.opacity,
          transform: `translateY(${s.title.y}px)`,
        }}
      >
        <span
          style={{
            ...baseText,
            fontSize: 96,
            fontWeight: 700,
            color: "rgba(255, 255, 255, 0.92)",
            letterSpacing: "0.01em",
            textShadow: "0 2px 24px rgba(0,0,0,0.35)",
          }}
        >
          Removing
        </span>
      </div>

      {/* Dynamic labels (sit below the title) */}
      <AbsoluteFill>
        {LABELS.map((label, i) => {
          const proxy = s[`label_${i}`];
          if (proxy.opacity < 0.01) return null;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                top: "36%",
                left: "50%",
                transform: `translate(-50%, -50%) scale(${proxy.scale})`,
                opacity: proxy.opacity,
              }}
            >
              <span
                style={{
                  ...baseText,
                  fontSize: 138,
                  color: "#fff",
                  whiteSpace: "nowrap",
                  textShadow: `0 6px 28px rgba(0,0,0,0.45)`,
                }}
              >
                {label}
              </span>
            </div>
          );
        })}
      </AbsoluteFill>

      {/* Conveyor rail */}
      <div
        style={{
          position: "absolute",
          top: CONVEYOR_TOP + SHAPE_SIZE + 30,
          left: CONVEYOR_LEFT - 80,
          width: STAGE_W * 0.92,
          height: 2,
          background:
            "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.18) 12%, rgba(255,255,255,0.18) 88%, rgba(255,255,255,0) 100%)",
          opacity: s.rail.opacity,
        }}
      />

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
                filter: "drop-shadow(0 8px 14px rgba(0,0,0,0.35))",
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


      {/* Reticles + muzzle flash + tracers + smoke + bursts */}
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
        {/* Muzzle flash — starburst */}
        {s.sniper.flash > 0.01 && (
          <g>
            <circle
              cx={MUZZLE_X}
              cy={MUZZLE_Y}
              r={42 * s.sniper.flash}
              fill="#FFE066"
              opacity={s.sniper.flash * 0.45}
            />
            {Array.from({ length: 6 }, (_, ri) => {
              const angle = (ri / 6) * 360 + 15;
              return (
                <rect
                  key={ri}
                  x={-58 * s.sniper.flash}
                  y={-2}
                  width={116 * s.sniper.flash}
                  height={4}
                  fill="#FFE066"
                  opacity={s.sniper.flash * 0.85}
                  transform={`translate(${MUZZLE_X} ${MUZZLE_Y}) rotate(${angle})`}
                />
              );
            })}
            <circle
              cx={MUZZLE_X}
              cy={MUZZLE_Y}
              r={14 * s.sniper.flash}
              fill="#FFFFFF"
              opacity={s.sniper.flash}
            />
          </g>
        )}

        {VICTIM_INDEXES.map((shapeIdx, passIdx) => {
          const tracer = s[`tracer_${passIdx}`];
          const det = s[`detonate_${passIdx}`];
          const reticle = s[`reticle_${passIdx}`];
          const smoke = s[`smoke_${passIdx}`];
          const target = victimCenter(shapeIdx);
          const endX = MUZZLE_X + tracer.progress * (target.x - MUZZLE_X);
          const endY = MUZZLE_Y + tracer.progress * (target.y - MUZZLE_Y);
          const victimColor = TRADES[shapeIdx].color;

          return (
            <g key={passIdx}>
              {/* Lock-on reticle */}
              {reticle.opacity > 0.01 && (
                <g
                  transform={`translate(${target.x} ${target.y}) scale(${reticle.scale})`}
                  opacity={reticle.opacity}
                >
                  <circle cx={0} cy={0} r={72} fill="none" stroke="#FF3B6B" strokeWidth={2.5} />
                  <circle cx={0} cy={0} r={42} fill="none" stroke="#FF3B6B" strokeWidth={1.5} opacity={0.55} />
                  <line x1={-92} y1={0} x2={-26} y2={0} stroke="#FF3B6B" strokeWidth={2.5} strokeLinecap="round" />
                  <line x1={26} y1={0} x2={92} y2={0} stroke="#FF3B6B" strokeWidth={2.5} strokeLinecap="round" />
                  <line x1={0} y1={-92} x2={0} y2={-26} stroke="#FF3B6B" strokeWidth={2.5} strokeLinecap="round" />
                  <line x1={0} y1={26} x2={0} y2={92} stroke="#FF3B6B" strokeWidth={2.5} strokeLinecap="round" />
                  <circle cx={0} cy={0} r={3} fill="#FF3B6B" />
                </g>
              )}

              {/* Tracer — wide soft glow + crisp inner line */}
              {tracer.opacity > 0.01 && (
                <>
                  <line
                    x1={MUZZLE_X}
                    y1={MUZZLE_Y}
                    x2={endX}
                    y2={endY}
                    stroke={BLUE}
                    strokeWidth={9}
                    strokeOpacity={tracer.opacity * 0.25}
                    strokeLinecap="round"
                  />
                  <line
                    x1={MUZZLE_X}
                    y1={MUZZLE_Y}
                    x2={endX}
                    y2={endY}
                    stroke="#FFFFFF"
                    strokeWidth={2.5}
                    strokeOpacity={tracer.opacity}
                    strokeLinecap="round"
                  />
                </>
              )}

              {/* Smoke / dust ring at impact */}
              {smoke.progress > 0.01 && (
                <circle
                  cx={target.x}
                  cy={target.y}
                  r={smoke.progress * 130}
                  fill="none"
                  stroke="rgba(220,220,225,0.55)"
                  strokeWidth={Math.max(0.5, 4 * (1 - smoke.progress))}
                  opacity={1 - smoke.progress}
                />
              )}

              {/* Particle burst — varied sizes */}
              {det.burst > 0.01 &&
                Array.from({ length: 10 }, (_, pi) => {
                  const angle = (pi / 10) * Math.PI * 2 + (pi % 2 === 0 ? 0 : 0.18);
                  const r = det.burst * (130 + (pi % 3) * 25);
                  const px = target.x + Math.cos(angle) * r;
                  const py = target.y + Math.sin(angle) * r;
                  const opacity = Math.max(0, 1 - det.burst);
                  const radius = 4 + (pi % 3) * 2.5;
                  return (
                    <circle
                      key={pi}
                      cx={px}
                      cy={py}
                      r={radius}
                      fill={victimColor}
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
