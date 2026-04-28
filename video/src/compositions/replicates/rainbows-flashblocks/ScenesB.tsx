import React from "react";
import { AbsoluteFill } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
import { BlueGradient, LightGradient, GridOverlay } from "../standrew/backgrounds";
import { useGsapProxy } from "../standrew/gsapUtils";

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
// Scene 05 — "We designed an additional / liquidity layer."
// 48 frames = 2s @ 24fps
// ────────────────────────────────────────────────────────

const SCENE05_PHASE1 = ["We", "designed", "an", "additional"] as const;
const SCENE05_PHASE2 = ["liquidity", "layer."] as const;

function buildScene05Proxies() {
  const init: Record<string, { opacity: number; y: number }> = {};
  SCENE05_PHASE1.forEach((_, i) => { init[`p1_${i}`] = { opacity: 0, y: 15 }; });
  SCENE05_PHASE2.forEach((_, i) => { init[`p2_${i}`] = { opacity: 0, y: 15 }; });
  init.phase1Wrap = { opacity: 1, y: 0 };
  init.phase2Wrap = { opacity: 0, y: 0 };
  return init;
}

const scene05Init = buildScene05Proxies();

export const Scene05_Waiting: React.FC = () => {
  const s = useGsapProxy(
    (tl, p) => {
      SCENE05_PHASE1.forEach((_, i) => {
        const t = i * 0.15;
        tl.to(p[`p1_${i}`], { opacity: 1, y: 0, duration: 0.12, ease: "power2.out" }, t);
      });

      tl.to(p.phase1Wrap, { opacity: 0, duration: 0.15 }, 1.1);
      tl.to(p.phase2Wrap, { opacity: 1, duration: 0.1 }, 1.2);

      SCENE05_PHASE2.forEach((_, i) => {
        const t = 1.2 + i * 0.18;
        tl.to(p[`p2_${i}`], { opacity: 1, y: 0, duration: 0.12, ease: "power2.out" }, t);
      });
    },
    scene05Init,
  );

  return (
    <AbsoluteFill>
      <BlueGradient />
      <AbsoluteFill>
        {/* Phase 1 — left-aligned */}
        <div
          style={{
            position: "absolute",
            top: "45%",
            left: "8%",
            transform: "translateY(-50%)",
            maxWidth: "84%",
            display: "flex",
            flexWrap: "wrap",
            gap: "0 22px",
            opacity: s.phase1Wrap.opacity,
          }}
        >
          {SCENE05_PHASE1.map((word, i) => {
            const proxy = s[`p1_${i}`];
            return (
              <span
                key={i}
                style={{
                  ...baseText,
                  fontSize: 160,
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

        {/* Phase 2 — centered */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "0 22px",
            opacity: s.phase2Wrap.opacity,
          }}
        >
          {SCENE05_PHASE2.map((word, i) => {
            const proxy = s[`p2_${i}`];
            return (
              <span
                key={i}
                style={{
                  ...baseText,
                  fontSize: 175,
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
    </AbsoluteFill>
  );
};

// ────────────────────────────────────────────────────────
// Scene 06 — Starburst counter "70% / of your profits"
// 72 frames = 3s @ 24fps
// ────────────────────────────────────────────────────────

const STARBURST_COUNT = 12;

function buildScene06Proxies() {
  return {
    counter: { value: 0, opacity: 0, scale: 0 },
    starburst: { length: 80, opacity: 0 },
    subtitle: { opacity: 0 },
  };
}

const scene06Init = buildScene06Proxies();

export const Scene06_Starburst: React.FC = () => {
  const s = useGsapProxy(
    (tl, p) => {
      // Counter entrance: scales up from a small number to 70
      tl.to(p.counter, { opacity: 1, duration: 0.15 }, 0.1);
      tl.to(p.counter, { scale: 1, duration: 0.6, ease: "back.out(1.7)" }, 0.1);
      tl.to(p.counter, { value: 70, duration: 1.2, ease: "power2.out" }, 0.1);

      // Starburst at 0.4s
      tl.to(p.starburst, { opacity: 1, duration: 0.15 }, 0.4);
      tl.to(p.starburst, { length: 1000, duration: 1.8, ease: "power2.out" }, 0.4);

      // Subtitle at 1.0s
      tl.to(p.subtitle, { opacity: 1, duration: 0.25, ease: "power2.out" }, 1.0);
    },
    scene06Init,
  );

  const counterValue = Math.round(s.counter.value);

  return (
    <AbsoluteFill>
      <LightGradient />
      <AbsoluteFill>
        {/* Starburst */}
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

        {/* Counter + subtitle */}
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
          <div style={{ ...baseText, fontSize: 290, color: BLUE }}>
            {counterValue}%
          </div>
          <div
            style={{
              ...baseText,
              fontSize: 110,
              fontWeight: 700,
              color: BLUE,
              opacity: s.subtitle.opacity,
              marginTop: -4,
            }}
          >
            of your profits
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ────────────────────────────────────────────────────────
// Scene 07 — Trade queue: three thieves get pulled out
// 108 frames = 4.5s @ 24fps
// ────────────────────────────────────────────────────────

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

// Four thieves get yanked off the queue, one label flashes per pass.
const VICTIM_INDEXES = [5, 3, 1, 0] as const;
const LABELS = ["frontrunners", "spoofers", "illegal insiders", "market manipulators"] as const;

function buildScene07Proxies() {
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

const scene07Init = buildScene07Proxies();

export const Scene07_TransactionQueue: React.FC = () => {
  const s = useGsapProxy(
    (tl, p) => {
      // All trade tiles enter
      TRADES.forEach((_, i) => {
        tl.to(p[`shape_${i}`], { opacity: 1, duration: 0.2 }, i * 0.1);
      });

      // Four passes, ~0.95s apart, each yanking a victim and flashing a label
      const passStarts = [0.5, 1.45, 2.4, 3.35];
      passStarts.forEach((start, passIdx) => {
        // Label flashes in
        tl.to(p[`label_${passIdx}`], { opacity: 1, scale: 1, duration: 0.16, ease: "back.out(1.7)" }, start);
        // Victim yanks upward and fades
        tl.to(p[`yank_${passIdx}`], { y: -160, duration: 0.4, ease: "power2.out" }, start + 0.05);
        tl.to(p[`yank_${passIdx}`], { opacity: 0, duration: 0.28, ease: "power2.in" }, start + 0.28);
        // Label fades out before next pass
        tl.to(p[`label_${passIdx}`], { opacity: 0, duration: 0.18, ease: "power2.in" }, start + 0.78);
      });

      // Subtle conveyor drift across the whole scene
      tl.to(p.conveyor, { x: -120, duration: 4.0, ease: "none" }, 0.3);
    },
    scene07Init,
  );

  const shapeSize = 200;
  const spacing = 260;

  return (
    <AbsoluteFill>
      <BlueGradient />
      <AbsoluteFill>
        {/* Three rotating labels — only one visible at a time */}
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
                  fontSize: 160,
                  color: "#fff",
                  whiteSpace: "nowrap",
                }}
              >
                {label}
              </span>
            </div>
          );
        })}

        {/* Trade conveyor */}
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

// ────────────────────────────────────────────────────────
// Scene 08 — Three rows: "that filters out / illegal trading / activities"
// Connector clause sitting between Scene 05 (liquidity layer) and Scene 06 (70%)
// 60 frames = 2.5s @ 24fps
// ────────────────────────────────────────────────────────

function buildScene08Proxies() {
  return {
    g1: { opacity: 1 },
    g2: { opacity: 0 },
    g3: { opacity: 0 },
    w_row1: { opacity: 0 },
    w_row2: { opacity: 0 },
    w_row3: { opacity: 0 },
  };
}

const scene08Init = buildScene08Proxies();

export const Scene08_GridText: React.FC = () => {
  const s = useGsapProxy(
    (tl, p) => {
      // Row 1 — "that filters out"
      tl.to(p.w_row1, { opacity: 1, duration: 0.1 }, 0.0);
      tl.to(p.g1, { opacity: 0, duration: 0.12 }, 0.75);

      // Row 2 — "illegal trading"
      tl.to(p.g2, { opacity: 1, duration: 0.12 }, 0.75);
      tl.to(p.w_row2, { opacity: 1, duration: 0.1 }, 0.75);
      tl.to(p.g2, { opacity: 0, duration: 0.12 }, 1.5);

      // Row 3 — "activities" — holds to end
      tl.to(p.g3, { opacity: 1, duration: 0.12 }, 1.5);
      tl.to(p.w_row3, { opacity: 1, duration: 0.12 }, 1.5);
    },
    scene08Init,
  );

  const phraseStyle: React.CSSProperties = {
    ...baseText,
    fontSize: 175,
    color: "#fff",
    textAlign: "center",
    maxWidth: "92%",
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: "0 24px",
    whiteSpace: "nowrap",
  };

  return (
    <AbsoluteFill>
      <BlueGradient />
      <GridOverlay color="rgba(255,255,255,0.18)" />
      <AbsoluteFill>
        <div style={{ ...phraseStyle, opacity: s.g1.opacity }}>
          <span style={{ opacity: s.w_row1.opacity }}>that filters out</span>
        </div>
        <div style={{ ...phraseStyle, opacity: s.g2.opacity }}>
          <span style={{ opacity: s.w_row2.opacity }}>illegal trading</span>
        </div>
        <div style={{ ...phraseStyle, opacity: s.g3.opacity }}>
          <span style={{ opacity: s.w_row3.opacity }}>activities</span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ── Meta ──

export const sceneMetasB = [
  { id: "RB-Scene05", component: Scene05_Waiting, durationInFrames: 48 },
  { id: "RB-Scene06", component: Scene06_Starburst, durationInFrames: 72 },
  { id: "RB-Scene07", component: Scene07_TransactionQueue, durationInFrames: 108 },
  { id: "RB-Scene08", component: Scene08_GridText, durationInFrames: 60 },
];
