import React from "react";
import { AbsoluteFill } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
import { useGsapProxy } from "../standrew/gsapUtils";
import { DynamicBlue, DynamicLight, ZoomedBg } from "./dynamics";

const { fontFamily } = loadFont("normal", { subsets: ["latin"], weights: ["400", "700", "800"] });
const BLUE = "#0040FF";

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
// Conveyor + four yanks: "frontrunners / orderbook spoofers /
// illegal insiders / market manipulators"
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

function buildScene05Proxies() {
  const init: Record<string, Record<string, number>> = {};
  TRADES.forEach((_, i) => { init[`shape_${i}`] = { opacity: 0 }; });
  init.conveyor = { x: 0 };
  for (let i = 0; i < LABELS.length; i++) {
    init[`label_${i}`] = { opacity: 0, scale: 0.85 };
  }
  for (let i = 0; i < VICTIM_INDEXES.length; i++) {
    init[`yank_${i}`] = { y: 0, opacity: 1 };
  }
  return init;
}

const scene05Init = buildScene05Proxies();

export const Scene05_Manipulators: React.FC = () => {
  const s = useGsapProxy(
    (tl, p) => {
      TRADES.forEach((_, i) => {
        tl.to(p[`shape_${i}`], { opacity: 1, duration: 0.2 }, i * 0.1);
      });

      const passStarts = [0.5, 1.45, 2.4, 3.35];
      passStarts.forEach((start, passIdx) => {
        tl.to(p[`label_${passIdx}`], { opacity: 1, scale: 1, duration: 0.16, ease: "back.out(1.7)" }, start);
        tl.to(p[`yank_${passIdx}`], { y: -160, duration: 0.4, ease: "power2.out" }, start + 0.05);
        tl.to(p[`yank_${passIdx}`], { opacity: 0, duration: 0.28, ease: "power2.in" }, start + 0.28);
        tl.to(p[`label_${passIdx}`], { opacity: 0, duration: 0.18, ease: "power2.in" }, start + 0.78);
      });

      tl.to(p.conveyor, { x: -120, duration: 4.0, ease: "none" }, 0.3);
    },
    scene05Init,
  );

  const shapeSize = 200;
  const spacing = 260;

  return (
    <AbsoluteFill>
      <ZoomedBg duration={SCENE05_DURATION}>
        <DynamicBlue />
      </ZoomedBg>

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

        <div
          style={{
            position: "absolute",
            top: "62%",
            left: "8%",
            transform: `translateX(${s.conveyor.x}px)`,
            display: "flex",
            alignItems: "center",
            gap: spacing - shapeSize,
          }}
        >
          {TRADES.map((sh, i) => {
            const shapeProxy = s[`shape_${i}`];
            const victimSlot = VICTIM_INDEXES.indexOf(i as typeof VICTIM_INDEXES[number]);
            const yank = victimSlot >= 0 ? s[`yank_${victimSlot}`] : null;
            const yOffset = yank ? yank.y : 0;
            const finalOpacity = yank ? shapeProxy.opacity * yank.opacity : shapeProxy.opacity;

            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 12,
                  opacity: finalOpacity,
                  transform: `translateY(${yOffset}px)`,
                }}
              >
                <Shape type={sh.type} color={sh.color} size={shapeSize} />
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
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ── Meta ──

export const sceneMetasB = [
  { id: "RB-Scene04-FilterAndPercent", component: Scene04_FilterAndPercent, durationInFrames: SCENE04_DURATION },
  { id: "RB-Scene05-Manipulators", component: Scene05_Manipulators, durationInFrames: SCENE05_DURATION },
];
