import React from "react";
import { AbsoluteFill } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
import { BlueGradient, LightGradient, GridOverlay } from "./backgrounds";
import { useGsapProxy } from "./gsapUtils";

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
// Scene 05 — "Instead of waiting two seconds"
// 48 frames = 2s @ 24fps
// ────────────────────────────────────────────────────────

const SCENE05_PHASE1 = ["Instead", "of", "waiting", "two", "seconds"] as const;
const SCENE05_PHASE2 = ["for", "the", "next", "block"] as const;

function buildScene05Proxies() {
  const init: Record<string, { opacity: number; y: number }> = {};
  for (const w of SCENE05_PHASE1) init[`p1_${w}`] = { opacity: 0, y: 15 };
  for (const w of SCENE05_PHASE2) init[`p2_${w}`] = { opacity: 0, y: 15 };
  init.phase1Wrap = { opacity: 1, y: 0 };
  init.phase2Wrap = { opacity: 0, y: 0 };
  return init;
}

const scene05Init = buildScene05Proxies();

export const Scene05_Waiting: React.FC = () => {
  const s = useGsapProxy(
    (tl, p) => {
      // Phase 1 words
      SCENE05_PHASE1.forEach((w, i) => {
        const t = i * 0.15;
        tl.to(p[`p1_${w}`], { opacity: 1, y: 0, duration: 0.12, ease: "power2.out" }, t);
      });

      // Phase 1 fade out
      tl.to(p.phase1Wrap, { opacity: 0, duration: 0.15 }, 1.1);

      // Phase 2 wrap fade in
      tl.to(p.phase2Wrap, { opacity: 1, duration: 0.1 }, 1.2);

      // Phase 2 words
      SCENE05_PHASE2.forEach((w, i) => {
        const t = 1.2 + i * 0.15;
        tl.to(p[`p2_${w}`], { opacity: 1, y: 0, duration: 0.12, ease: "power2.out" }, t);
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
            maxWidth: "80%",
            display: "flex",
            flexWrap: "wrap",
            gap: "0 20px",
            opacity: s.phase1Wrap.opacity,
          }}
        >
          {SCENE05_PHASE1.map((word) => {
            const p = s[`p1_${word}`];
            return (
              <span
                key={word}
                style={{
                  ...baseText,
                  fontSize: 175,
                  color: "#fff",
                  opacity: p.opacity,
                  transform: `translateY(${p.y}px)`,
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
            gap: "0 18px",
            opacity: s.phase2Wrap.opacity,
          }}
        >
          {SCENE05_PHASE2.map((word) => {
            const p = s[`p2_${word}`];
            return (
              <span
                key={word}
                style={{
                  ...baseText,
                  fontSize: 145,
                  fontWeight: word === "block" ? 800 : 800,
                  color: "#fff",
                  opacity: p.opacity,
                  transform: `translateY(${p.y}px)`,
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
// Scene 06 — Starburst counter "200 milliseconds"
// 72 frames = 3s @ 24fps
// ────────────────────────────────────────────────────────

const SCENE06_WORDS = ["Flashblocks", "are", "streamed", "every"] as const;
const STARBURST_COUNT = 12;

function buildScene06Proxies() {
  const init: Record<string, Record<string, number>> = {};
  for (const w of SCENE06_WORDS) init[`w_${w}`] = { opacity: 0, y: 15 };
  init.textPhrase = { opacity: 1 };
  init.counter = { value: 0, opacity: 0, scale: 0 };
  init.starburst = { length: 80, opacity: 0 };
  init.ms = { opacity: 0 };
  return init;
}

const scene06Init = buildScene06Proxies();

export const Scene06_Starburst: React.FC = () => {
  const s = useGsapProxy(
    (tl, p) => {
      // Words stagger
      SCENE06_WORDS.forEach((w, i) => {
        tl.to(p[`w_${w}`], { opacity: 1, y: 0, duration: 0.12, ease: "power2.out" }, i * 0.2);
      });

      // Text phrase fades out at 1.0s
      tl.to(p.textPhrase, { opacity: 0, duration: 0.2 }, 1.0);

      // Counter entrance at 1.0s — scale spring, opacity, value 0→200
      tl.to(p.counter, { opacity: 1, duration: 0.15 }, 1.0);
      tl.to(p.counter, { scale: 1, duration: 0.5, ease: "back.out(1.7)" }, 1.0);
      tl.to(p.counter, { value: 200, duration: 0.8, ease: "power2.out" }, 1.0);

      // Starburst lines at 1.2s
      tl.to(p.starburst, { opacity: 1, duration: 0.15 }, 1.2);
      tl.to(p.starburst, { length: 1000, duration: 1.5, ease: "power2.out" }, 1.2);

      // "milliseconds" at 1.5s
      tl.to(p.ms, { opacity: 1, duration: 0.2, ease: "power2.out" }, 1.5);
    },
    scene06Init,
  );

  const counterValue = Math.round(s.counter.value);

  return (
    <AbsoluteFill>
      <LightGradient />
      <AbsoluteFill>
        {/* Text phrase */}
        <div
          style={{
            position: "absolute",
            top: "25%",
            left: "6%",
            maxWidth: "80%",
            display: "flex",
            flexWrap: "wrap",
            gap: "0 16px",
            opacity: s.textPhrase.opacity,
          }}
        >
          {SCENE06_WORDS.map((word) => {
            const p = s[`w_${word}`];
            return (
              <span
                key={word}
                style={{
                  ...baseText,
                  fontSize: 160,
                  color: BLUE,
                  opacity: p.opacity,
                  transform: `translateY(${p.y}px)`,
                }}
              >
                {word}
              </span>
            );
          })}
        </div>

        {/* Starburst lines */}
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

        {/* Counter + milliseconds */}
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
            {counterValue}
          </div>
          <div
            style={{
              ...baseText,
              fontSize: 130,
              fontWeight: 700,
              color: BLUE,
              opacity: s.ms.opacity,
              marginTop: -4,
            }}
          >
            milliseconds
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ────────────────────────────────────────────────────────
// Scene 07 — Transaction queue / conveyor
// 108 frames = 4.5s @ 24fps
// ────────────────────────────────────────────────────────

const SHAPES: {
  type: "diamond" | "hexagon" | "hexagon-hole" | "pentagon" | "circle";
  color: string;
}[] = [
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

const P1_WORDS = "that means your transaction doesn't sit in line".split(" ");
const P2_WORDS = "it gets picked up almost right away".split(" ");

function buildScene07Proxies() {
  const init: Record<string, Record<string, number>> = {};
  P1_WORDS.forEach((_, i) => { init[`p1_${i}`] = { opacity: 0, y: 15 }; });
  P2_WORDS.forEach((_, i) => { init[`p2_${i}`] = { opacity: 0, y: 15 }; });
  init.p1Wrap = { opacity: 1 };
  init.p2Wrap = { opacity: 0 };
  SHAPES.forEach((_, i) => { init[`shape_${i}`] = { opacity: 0 }; });
  init.conveyor = { x: 0 };
  init.lastShape = { y: 0, opacity: 1 };
  return init;
}

const scene07Init = buildScene07Proxies();

export const Scene07_TransactionQueue: React.FC = () => {
  const s = useGsapProxy(
    (tl, p) => {
      // Phase 1 words (0-2s)
      P1_WORDS.forEach((_, i) => {
        tl.to(p[`p1_${i}`], { opacity: 1, y: 0, duration: 0.12, ease: "power2.out" }, i * 0.12);
      });

      // Shape entries stagger
      SHAPES.forEach((_, i) => {
        tl.to(p[`shape_${i}`], { opacity: 1, duration: 0.25 }, i * 0.125);
      });

      // Phase 1 fade out, phase 2 fade in (cross-fade around 2s)
      tl.to(p.p1Wrap, { opacity: 0, duration: 0.25 }, 1.75);
      tl.to(p.p2Wrap, { opacity: 1, duration: 0.25 }, 2.0);

      // Phase 2 words (2-4.5s)
      P2_WORDS.forEach((_, i) => {
        tl.to(p[`p2_${i}`], { opacity: 1, y: 0, duration: 0.12, ease: "power2.out" }, 2.0 + i * 0.12);
      });

      // Conveyor shift at 2.5s
      tl.to(p.conveyor, { x: -180, duration: 0.8, ease: "power2.inOut" }, 2.5);

      // Last shape picked up and faded
      tl.to(p.lastShape, { y: -60, duration: 0.6, ease: "power2.out" }, 2.3);
      tl.to(p.lastShape, { opacity: 0, duration: 0.4 }, 2.7);
    },
    scene07Init,
  );

  const shapeSize = 200;
  const spacing = 260;

  return (
    <AbsoluteFill>
      <BlueGradient />
      <AbsoluteFill>
        {/* Phase 1 text */}
        <div
          style={{
            position: "absolute",
            top: "28%",
            left: "8%",
            transform: "translateY(-50%)",
            maxWidth: "85%",
            display: "flex",
            flexWrap: "wrap",
            gap: "0 14px",
            opacity: s.p1Wrap.opacity,
          }}
        >
          {P1_WORDS.map((word, i) => {
            const p = s[`p1_${i}`];
            return (
              <span
                key={i}
                style={{
                  ...baseText,
                  fontSize: 160,
                  color: "#fff",
                  opacity: p.opacity,
                  transform: `translateY(${p.y}px)`,
                }}
              >
                {word}
              </span>
            );
          })}
        </div>

        {/* Phase 2 text */}
        <div
          style={{
            position: "absolute",
            top: "28%",
            left: "8%",
            transform: "translateY(-50%)",
            maxWidth: "85%",
            display: "flex",
            flexWrap: "wrap",
            gap: "0 14px",
            opacity: s.p2Wrap.opacity,
          }}
        >
          {P2_WORDS.map((word, i) => {
            const p = s[`p2_${i}`];
            return (
              <span
                key={i}
                style={{
                  ...baseText,
                  fontSize: 160,
                  color: "#fff",
                  opacity: p.opacity,
                  transform: `translateY(${p.y}px)`,
                }}
              >
                {word}
              </span>
            );
          })}
        </div>

        {/* Conveyor shapes */}
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
          {SHAPES.map((sh, i) => {
            const isLast = i === SHAPES.length - 1;
            const shapeOpacity = s[`shape_${i}`].opacity;
            const finalOpacity = isLast ? shapeOpacity * s.lastShape.opacity : shapeOpacity;
            const yOffset = isLast ? s.lastShape.y : 0;

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
// Scene 08 — Grid text: "faster confirmations / smoother
//            dApps / and a way better"
// 60 frames = 2.5s @ 24fps
// ────────────────────────────────────────────────────────

function buildScene08Proxies() {
  return {
    g1: { opacity: 1 }, // "faster" → "faster confirmations"
    g2: { opacity: 0 }, // "smoother" → "smoother dApps"
    g3: { opacity: 0 }, // "and a" → "and a way" → "and a way better"
    w_faster: { opacity: 0 },
    w_confirmations: { opacity: 0 },
    w_smoother: { opacity: 0 },
    w_dApps: { opacity: 0 },
    w_and: { opacity: 0 },
    w_a: { opacity: 0 },
    w_way: { opacity: 0 },
    w_better: { opacity: 0 },
  };
}

const scene08Init = buildScene08Proxies();

export const Scene08_GridText: React.FC = () => {
  const s = useGsapProxy(
    (tl, p) => {
      // Group 1: "faster" at 0.0s, "confirmations" at 0.3s
      tl.to(p.w_faster, { opacity: 1, duration: 0.08 }, 0.0);
      tl.to(p.w_confirmations, { opacity: 1, duration: 0.08 }, 0.3);
      // Cross-fade out group 1 at 0.65s
      tl.to(p.g1, { opacity: 0, duration: 0.12 }, 0.65);

      // Group 2: "smoother" at 0.65s, "dApps" at 0.95s
      tl.to(p.g2, { opacity: 1, duration: 0.12 }, 0.65);
      tl.to(p.w_smoother, { opacity: 1, duration: 0.08 }, 0.65);
      tl.to(p.w_dApps, { opacity: 1, duration: 0.08 }, 0.95);
      // Cross-fade out group 2 at 1.3s
      tl.to(p.g2, { opacity: 0, duration: 0.12 }, 1.3);

      // Group 3: "and a" at 1.3s, "way" at 1.6s, "better" at 1.8s
      tl.to(p.g3, { opacity: 1, duration: 0.12 }, 1.3);
      tl.to(p.w_and, { opacity: 1, duration: 0.08 }, 1.3);
      tl.to(p.w_a, { opacity: 1, duration: 0.08 }, 1.3);
      tl.to(p.w_way, { opacity: 1, duration: 0.08 }, 1.6);
      tl.to(p.w_better, { opacity: 1, duration: 0.08 }, 1.8);
      // Hold to 2.5s — no fade out
    },
    scene08Init,
  );

  const phraseStyle: React.CSSProperties = {
    ...baseText,
    fontSize: 145,
    color: "#fff",
    textAlign: "center",
    maxWidth: "80%",
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: "0 18px",
  };

  return (
    <AbsoluteFill>
      <BlueGradient />
      <GridOverlay color="rgba(255,255,255,0.18)" />
      <AbsoluteFill>
        {/* Group 1: faster confirmations */}
        <div style={{ ...phraseStyle, opacity: s.g1.opacity }}>
          <span style={{ opacity: s.w_faster.opacity }}>faster</span>
          <span style={{ opacity: s.w_confirmations.opacity }}>confirmations</span>
        </div>

        {/* Group 2: smoother dApps */}
        <div style={{ ...phraseStyle, opacity: s.g2.opacity }}>
          <span style={{ opacity: s.w_smoother.opacity }}>smoother</span>
          <span style={{ opacity: s.w_dApps.opacity }}>dApps</span>
        </div>

        {/* Group 3: and a way better */}
        <div style={{ ...phraseStyle, opacity: s.g3.opacity }}>
          <span style={{ opacity: s.w_and.opacity }}>and</span>
          <span style={{ opacity: s.w_a.opacity }}>a</span>
          <span style={{ opacity: s.w_way.opacity }}>way</span>
          <span style={{ opacity: s.w_better.opacity }}>better</span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ── Meta ──

export const sceneBMetas = [
  { id: "RP-Scene05", component: Scene05_Waiting, durationInFrames: 48 },
  { id: "RP-Scene06", component: Scene06_Starburst, durationInFrames: 72 },
  { id: "RP-Scene07", component: Scene07_TransactionQueue, durationInFrames: 108 },
  { id: "RP-Scene08", component: Scene08_GridText, durationInFrames: 60 },
];
