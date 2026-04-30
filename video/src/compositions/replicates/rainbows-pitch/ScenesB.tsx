import React from "react";
import { AbsoluteFill } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
import { BlueGradient, LightGradient, GridOverlay } from "./backgrounds";
import { useGsapProxy } from "./gsapUtils";

const { fontFamily } = loadFont("normal", { subsets: ["latin"], weights: ["400", "700", "800"] });
const BLUE = "#0040FF";
const STRIKE_RED = "#ff2a2a";

const baseText: React.CSSProperties = {
  fontFamily,
  fontWeight: 800,
  fontStyle: "italic",
  lineHeight: 1.2,
  display: "inline-block",
};

/* ════════════════════════════════════════════════════════
   Scene 05 — Two-phase phrase  (48 frames = 2s @ 24fps)
   "Removing" → "what shouldn't be here."
   ════════════════════════════════════════════════════════ */

const SCENE05_PHASE1 = ["Removing"] as const;
const SCENE05_PHASE2 = ["what", "shouldn't", "be", "here."] as const;

function buildScene05Proxies() {
  const init: Record<string, { opacity: number; y: number }> = {};
  SCENE05_PHASE1.forEach((w) => { init[`p1_${w}`] = { opacity: 0, y: 15 }; });
  SCENE05_PHASE2.forEach((w) => { init[`p2_${w}`] = { opacity: 0, y: 15 }; });
  init.phase1Wrap = { opacity: 1, y: 0 };
  init.phase2Wrap = { opacity: 0, y: 0 };
  return init;
}

const scene05Init = buildScene05Proxies();

export const Scene05_Waiting: React.FC = () => {
  const s = useGsapProxy(
    (tl, p) => {
      // "Removing" enters at 0
      tl.to(p[`p1_Removing`], { opacity: 1, y: 0, duration: 0.18, ease: "power2.out" }, 0.0);
      // Phase 1 fades out
      tl.to(p.phase1Wrap, { opacity: 0, duration: 0.18 }, 1.0);
      // Phase 2 wrap fades in
      tl.to(p.phase2Wrap, { opacity: 1, duration: 0.12 }, 1.1);
      // Phase 2 words stagger
      SCENE05_PHASE2.forEach((w, i) => {
        const t = 1.1 + i * 0.13;
        tl.to(p[`p2_${w}`], { opacity: 1, y: 0, duration: 0.14, ease: "power2.out" }, t);
      });
    },
    scene05Init,
  );

  return (
    <AbsoluteFill>
      <BlueGradient />
      <AbsoluteFill>
        {/* Phase 1 — centered */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            opacity: s.phase1Wrap.opacity,
            whiteSpace: "nowrap",
          }}
        >
          {SCENE05_PHASE1.map((word) => {
            const p = s[`p1_${word}`];
            return (
              <span
                key={word}
                style={{
                  ...baseText,
                  fontSize: 230,
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

        {/* Phase 2 — centered, smaller */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "0 24px",
            maxWidth: "85%",
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
                  fontSize: 155,
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

/* ════════════════════════════════════════════════════════
   Scene 06 — Starburst counter  (72 frames = 3s @ 24fps)
   Counter 0 → 500,000  + "exclusive markets"
   sub-caption: "only tradable with rainbows"
   ════════════════════════════════════════════════════════ */

const STARBURST_COUNT = 14;

function buildScene06Proxies() {
  return {
    intro: { opacity: 0, y: 15 },
    counter: { value: 0, opacity: 0, scale: 0 },
    starburst: { length: 80, opacity: 0 },
    caption: { opacity: 0, y: 12 },
    subCaption: { opacity: 0, y: 12 },
  };
}

const scene06Init = buildScene06Proxies();

const formatThousands = (n: number) =>
  Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

export const Scene06_Starburst: React.FC = () => {
  const s = useGsapProxy(
    (tl, p) => {
      // "And" enters at 0
      tl.to(p.intro, { opacity: 1, y: 0, duration: 0.18, ease: "power2.out" }, 0.0);

      // Counter scales in
      tl.to(p.counter, { opacity: 1, duration: 0.15 }, 0.4);
      tl.to(p.counter, { scale: 1, duration: 0.55, ease: "back.out(1.7)" }, 0.4);
      tl.to(p.counter, { value: 500000, duration: 1.1, ease: "power2.out" }, 0.5);

      // Starburst lines
      tl.to(p.starburst, { opacity: 1, duration: 0.15 }, 0.6);
      tl.to(p.starburst, { length: 1100, duration: 1.6, ease: "power2.out" }, 0.6);

      // "exclusive markets"
      tl.to(p.caption, { opacity: 1, y: 0, duration: 0.22, ease: "power2.out" }, 1.55);

      // "only tradable with rainbows" sub-caption — last
      tl.to(p.subCaption, { opacity: 1, y: 0, duration: 0.25, ease: "power2.out" }, 2.05);
    },
    scene06Init,
  );

  return (
    <AbsoluteFill>
      <LightGradient />
      <AbsoluteFill>
        {/* Top label */}
        <div
          style={{
            position: "absolute",
            top: "10%",
            left: "50%",
            transform: `translate(-50%, ${s.intro.y}px)`,
            opacity: s.intro.opacity,
          }}
        >
          <span style={{ ...baseText, fontSize: 110, color: BLUE }}>And</span>
        </div>

        {/* Starburst lines */}
        <div
          style={{
            position: "absolute",
            top: "44%",
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
                  transform: `rotate(${angle}deg) translateX(120px)`,
                  opacity: 0.45,
                }}
              />
            );
          })}
        </div>

        {/* Counter */}
        <div
          style={{
            position: "absolute",
            top: "44%",
            left: "50%",
            transform: `translate(-50%, -50%) scale(${Math.max(s.counter.scale, 0)})`,
            textAlign: "center",
            opacity: s.counter.opacity,
            whiteSpace: "nowrap",
          }}
        >
          <div style={{ ...baseText, fontSize: 260, color: BLUE }}>
            {formatThousands(s.counter.value)}
          </div>
        </div>

        {/* "exclusive markets" caption */}
        <div
          style={{
            position: "absolute",
            top: "70%",
            left: "50%",
            transform: `translate(-50%, ${s.caption.y}px)`,
            opacity: s.caption.opacity,
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ ...baseText, fontSize: 130, color: BLUE }}>
            exclusive markets
          </span>
        </div>

        {/* sub-caption */}
        <div
          style={{
            position: "absolute",
            top: "82%",
            left: "50%",
            transform: `translate(-50%, ${s.subCaption.y}px)`,
            opacity: s.subCaption.opacity,
            whiteSpace: "nowrap",
          }}
        >
          <span
            style={{
              ...baseText,
              fontSize: 56,
              fontWeight: 400,
              fontStyle: "italic",
              color: BLUE,
            }}
          >
            only tradable with rainbows
          </span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ════════════════════════════════════════════════════════
   Scene 07 — Villains with strike-through  (108 frames = 4.5s @ 24fps)
   Four rows. Each row: text appears, red line strikes across.
   ════════════════════════════════════════════════════════ */

const VILLAINS = [
  "frontrunners",
  "orderbook spoofers",
  "illegal insiders",
  "market manipulators",
] as const;

function buildScene07Proxies() {
  const init: Record<string, Record<string, number>> = {};
  VILLAINS.forEach((_, i) => {
    init[`row_${i}`] = { opacity: 0, x: -40 };
    init[`strike_${i}`] = { scaleX: 0 };
  });
  return init;
}

const scene07Init = buildScene07Proxies();

export const Scene07_TransactionQueue: React.FC = () => {
  const s = useGsapProxy(
    (tl, p) => {
      // Each villain: text in, then strike-through draws across
      const ROW_INTERVAL = 0.85;
      VILLAINS.forEach((_, i) => {
        const start = i * ROW_INTERVAL;
        tl.to(p[`row_${i}`], { opacity: 1, x: 0, duration: 0.32, ease: "power2.out" }, start);
        tl.to(p[`strike_${i}`], { scaleX: 1, duration: 0.32, ease: "power2.inOut" }, start + 0.32);
      });
    },
    scene07Init,
  );

  return (
    <AbsoluteFill>
      <BlueGradient />
      <AbsoluteFill>
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            display: "flex",
            flexDirection: "column",
            gap: 18,
            alignItems: "flex-start",
          }}
        >
          {VILLAINS.map((villain, i) => {
            const row = s[`row_${i}`];
            const strike = s[`strike_${i}`];
            return (
              <div
                key={villain}
                style={{
                  position: "relative",
                  display: "inline-block",
                  opacity: row.opacity,
                  transform: `translateX(${row.x}px)`,
                  paddingRight: 24,
                }}
              >
                <span
                  style={{
                    ...baseText,
                    fontSize: 112,
                    color: "#fff",
                    whiteSpace: "nowrap",
                  }}
                >
                  {villain}
                </span>
                {/* Red strike-through */}
                <div
                  style={{
                    position: "absolute",
                    top: "52%",
                    left: -8,
                    right: -8,
                    height: 10,
                    backgroundColor: STRIKE_RED,
                    transform: `scaleX(${strike.scaleX}) rotate(-2deg)`,
                    transformOrigin: "0% 50%",
                    boxShadow: "0 0 16px rgba(255,42,42,0.55)",
                    pointerEvents: "none",
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

/* ════════════════════════════════════════════════════════
   Scene 08 — Asset grid  (60 frames = 2.5s @ 24fps)
   2×2 grid: Stocks / Crypto / Predictions / Memecoins
   ════════════════════════════════════════════════════════ */

const ASSETS = ["Stocks", "Crypto", "Predictions", "Memecoins"] as const;

function buildScene08Proxies() {
  const init: Record<string, Record<string, number>> = {};
  ASSETS.forEach((_, i) => {
    init[`tile_${i}`] = { opacity: 0, y: 25, scale: 0.9 };
  });
  return init;
}

const scene08Init = buildScene08Proxies();

export const Scene08_GridText: React.FC = () => {
  const s = useGsapProxy(
    (tl, p) => {
      ASSETS.forEach((_, i) => {
        const start = 0.1 + i * 0.32;
        tl.to(p[`tile_${i}`], { opacity: 1, y: 0, scale: 1, duration: 0.35, ease: "back.out(1.4)" }, start);
      });
    },
    scene08Init,
  );

  return (
    <AbsoluteFill>
      <BlueGradient />
      <GridOverlay color="rgba(255,255,255,0.18)" />
      <AbsoluteFill>
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gridTemplateRows: "repeat(2, 1fr)",
            columnGap: 80,
            rowGap: 30,
            width: 1500,
          }}
        >
          {ASSETS.map((label, i) => {
            const proxy = s[`tile_${i}`];
            return (
              <div
                key={label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: proxy.opacity,
                  transform: `translateY(${proxy.y}px) scale(${proxy.scale})`,
                  whiteSpace: "nowrap",
                }}
              >
                <span style={{ ...baseText, fontSize: 145, color: "#fff" }}>
                  {label}
                </span>
              </div>
            );
          })}
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
