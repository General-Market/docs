import React from "react";
import { AbsoluteFill } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
import { SolidBlue, LightGradient, BlueGradient, GridOverlay } from "../standrew/backgrounds";
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

/* ═══════════════════════════════════════════════════════
   Scene 06 — HonestTraders  (84 frames = 3.5s @ 24fps)
   Concentric circles + serif italic.
   "Leaving the same amount of profits" → "to fewer honest traders."
   ═══════════════════════════════════════════════════════ */

const SCENE06_PHASE1 = ["Leaving", "the", "same", "amount", "of", "profits"] as const;
const SCENE06_PHASE2 = ["to", "fewer", "honest", "traders."] as const;

function buildScene06Proxies() {
  const init: Record<string, Record<string, number>> = {
    phase1Wrap: { opacity: 1 },
    phase2Wrap: { opacity: 0, scale: 0.92 },
    c0: { size: 0, opacity: 0 },
    c1: { size: 0, opacity: 0 },
    c2: { size: 0, opacity: 0 },
    c3: { size: 0, opacity: 0 },
    c4: { size: 0, opacity: 0 },
    c5: { size: 0, opacity: 0 },
  };
  SCENE06_PHASE1.forEach((_, i) => { init[`p1_${i}`] = { opacity: 0, y: 15 }; });
  SCENE06_PHASE2.forEach((_, i) => { init[`p2_${i}`] = { opacity: 0, y: 15 }; });
  return init;
}

const scene06Init = buildScene06Proxies();

export const Scene06_HonestTraders: React.FC = () => {
  const s = useGsapProxy(
    (tl, p) => {
      // Concentric circles ripple from start
      const circles = [p.c0, p.c1, p.c2, p.c3, p.c4, p.c5];
      const maxSizes = [90, 262, 434, 606, 778, 950];
      circles.forEach((c, i) => {
        const start = i * 0.18;
        tl.to(c, { opacity: 0.4, duration: 0.01 }, start);
        tl.to(c, { size: maxSizes[i], duration: 1.8, ease: "power1.out" }, start);
      });

      // Phase 1 word stagger
      SCENE06_PHASE1.forEach((_, i) => {
        tl.to(p[`p1_${i}`], { opacity: 1, y: 0, duration: 0.14, ease: "power2.out" }, 0.1 + i * 0.13);
      });

      // Phase 1 fades out
      tl.to(p.phase1Wrap, { opacity: 0, duration: 0.22, ease: "power2.in" }, 1.7);

      // Phase 2 wrap entrance
      tl.to(p.phase2Wrap, { opacity: 1, scale: 1, duration: 0.3, ease: "back.out(1.4)" }, 1.95);

      // Phase 2 word stagger
      SCENE06_PHASE2.forEach((_, i) => {
        tl.to(p[`p2_${i}`], { opacity: 1, y: 0, duration: 0.18, ease: "power2.out" }, 2.05 + i * 0.18);
      });
    },
    scene06Init,
  );

  const circles = [s.c0, s.c1, s.c2, s.c3, s.c4, s.c5];

  return (
    <AbsoluteFill>
      <SolidBlue />

      {circles.map((c, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: c.size,
            height: c.size,
            transform: "translate(-50%, -50%)",
            borderRadius: "50%",
            border: "3px solid rgba(255,255,255,0.4)",
            opacity: c.opacity,
          }}
        />
      ))}

      {/* Phase 1 — "Leaving the same amount of profits" */}
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
          maxWidth: "92%",
          opacity: s.phase1Wrap.opacity,
        }}
      >
        {SCENE06_PHASE1.map((word, i) => {
          const proxy = s[`p1_${i}`];
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

      {/* Phase 2 — "to fewer honest traders." in serif italic */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: `translate(-50%, -50%) scale(${s.phase2Wrap.scale})`,
          textAlign: "center",
          maxWidth: "92%",
          opacity: s.phase2Wrap.opacity,
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "0 24px",
        }}
      >
        {SCENE06_PHASE2.map((word, i) => {
          const proxy = s[`p2_${i}`];
          return (
            <span
              key={i}
              style={{
                fontFamily: 'Georgia, "Times New Roman", serif',
                fontWeight: 400,
                fontStyle: "italic",
                fontSize: 145,
                color: "#fff",
                lineHeight: 1.15,
                display: "inline-block",
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
  );
};

/* ═══════════════════════════════════════════════════════
   Scene 07 — Protected  (96 frames = 4s @ 24fps)
   Phase 1 (LightGradient): "Trade the assets you've always traded."
   Phase 2 (BlueGradient + Grid): "Protected."
   ═══════════════════════════════════════════════════════ */

const SCENE07_PHASE1 = ["Trade", "the", "assets", "you've", "always", "traded."] as const;

function buildScene07Proxies() {
  const init: Record<string, Record<string, number>> = {
    phase1: { opacity: 1 },
    phase2: { opacity: 0 },
    protected: { opacity: 0, scale: 0.85 },
  };
  SCENE07_PHASE1.forEach((_, i) => { init[`p1_${i}`] = { opacity: 0, y: 15 }; });
  return init;
}

const scene07Init = buildScene07Proxies();

export const Scene07_Protected: React.FC = () => {
  const s = useGsapProxy(
    (tl, p) => {
      // Phase 1 word stagger
      SCENE07_PHASE1.forEach((_, i) => {
        tl.to(p[`p1_${i}`], { opacity: 1, y: 0, duration: 0.16, ease: "power2.out" }, 0.1 + i * 0.16);
      });

      // Phase 1 fades out
      tl.to(p.phase1, { opacity: 0, duration: 0.22, ease: "power2.in" }, 2.2);

      // Phase 2 (Protected) lands at 2.45s
      tl.to(p.phase2, { opacity: 1, duration: 0.18, ease: "power2.out" }, 2.45);
      tl.to(p.protected, { opacity: 1, scale: 1, duration: 0.4, ease: "back.out(1.6)" }, 2.45);
    },
    scene07Init,
  );

  return (
    <AbsoluteFill>
      {/* Phase 1 — LightGradient + blue italic stagger */}
      <AbsoluteFill style={{ opacity: s.phase1.opacity }}>
        <LightGradient />
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
            maxWidth: "92%",
          }}
        >
          {SCENE07_PHASE1.map((word, i) => {
            const proxy = s[`p1_${i}`];
            return (
              <span
                key={i}
                style={{
                  ...baseText,
                  fontSize: 130,
                  color: BLUE,
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

      {/* Phase 2 — BlueGradient + grid + "Protected." */}
      <AbsoluteFill style={{ opacity: s.phase2.opacity }}>
        <BlueGradient />
        <GridOverlay color="rgba(255,255,255,0.18)" />
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: `translate(-50%, -50%) scale(${s.protected.scale})`,
            opacity: s.protected.opacity,
          }}
        >
          <span
            style={{
              ...baseText,
              fontSize: 240,
              color: "#fff",
              whiteSpace: "nowrap",
            }}
          >
            Protected.
          </span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ═══════════════════════════════════════════════════════
   Scene 08 — FiveHundredK  (96 frames = 4s @ 24fps)
   Counter ticks 0 → 500,000 then "assets you couldn't trade anywhere else"
   ═══════════════════════════════════════════════════════ */

const SCENE08_TAIL = ["assets", "you", "couldn't", "trade", "anywhere", "else."] as const;

function buildScene08Proxies() {
  const init: Record<string, Record<string, number>> = {
    plus: { opacity: 0 },
    counter: { value: 0, opacity: 0, scale: 0.7 },
    starburst: { length: 80, opacity: 0 },
  };
  SCENE08_TAIL.forEach((_, i) => { init[`t_${i}`] = { opacity: 0, y: 15 }; });
  return init;
}

const scene08Init = buildScene08Proxies();
const STARBURST_COUNT = 12;

export const Scene08_FiveHundredK: React.FC = () => {
  const s = useGsapProxy(
    (tl, p) => {
      // "Plus" badge fades in at 0.1s
      tl.to(p.plus, { opacity: 1, duration: 0.2, ease: "power2.out" }, 0.1);

      // Counter scales in and ticks 0 → 500,000 from 0.3s to 2.0s
      tl.to(p.counter, { opacity: 1, duration: 0.18 }, 0.3);
      tl.to(p.counter, { scale: 1, duration: 0.55, ease: "back.out(1.6)" }, 0.3);
      tl.to(p.counter, { value: 500000, duration: 1.7, ease: "power2.out" }, 0.3);

      // Starburst at 0.6s
      tl.to(p.starburst, { opacity: 1, duration: 0.18 }, 0.6);
      tl.to(p.starburst, { length: 1100, duration: 1.8, ease: "power2.out" }, 0.6);

      // Tail words stagger from 2.2s
      SCENE08_TAIL.forEach((_, i) => {
        tl.to(p[`t_${i}`], { opacity: 1, y: 0, duration: 0.16, ease: "power2.out" }, 2.2 + i * 0.15);
      });
    },
    scene08Init,
  );

  const counterValue = Math.round(s.counter.value).toLocaleString("en-US");

  return (
    <AbsoluteFill>
      <LightGradient />

      {/* Starburst behind the counter */}
      <div
        style={{
          position: "absolute",
          top: "38%",
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

      {/* "Plus" + counter */}
      <div
        style={{
          position: "absolute",
          top: "38%",
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
            opacity: s.plus.opacity,
            marginBottom: -8,
          }}
        >
          Plus
        </div>
        <div style={{ ...baseText, fontSize: 240, color: BLUE, lineHeight: 1.0 }}>
          {counterValue}
        </div>
      </div>

      {/* Tail line */}
      <div
        style={{
          position: "absolute",
          top: "70%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "0 20px",
          maxWidth: "92%",
        }}
      >
        {SCENE08_TAIL.map((word, i) => {
          const proxy = s[`t_${i}`];
          return (
            <span
              key={i}
              style={{
                ...baseText,
                fontSize: 90,
                color: BLUE,
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
  );
};

/* ═══════════════════════════════════════════════════════
   Scene 09 — Finale  (144 frames = 6s @ 24fps)
   "rainbows" + dark fade
   ═══════════════════════════════════════════════════════ */

export const Scene09_Finale: React.FC = () => {
  const s = useGsapProxy(
    (tl, p) => {
      tl.to(p.title, { opacity: 1, y: 0, duration: 0.35, ease: "power2.out" }, 0.0);
      tl.to(p.darkOverlay, { opacity: 0.85, duration: 1.8, ease: "power1.in" }, 3.0);
      tl.to(p.textFade, { opacity: 0.4, duration: 1.8, ease: "power1.in" }, 3.0);
    },
    {
      title: { opacity: 0, y: 10 },
      darkOverlay: { opacity: 0 },
      textFade: { opacity: 1 },
    },
  );

  return (
    <AbsoluteFill>
      <BlueGradient />

      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          textAlign: "center",
          zIndex: 2,
          opacity: s.textFade.opacity,
        }}
      >
        <span
          style={{
            fontFamily,
            fontSize: 260,
            fontWeight: 800,
            fontStyle: "italic",
            color: "#fff",
            display: "block",
            lineHeight: 1.15,
            opacity: s.title.opacity,
            transform: `translateY(${s.title.y}px)`,
          }}
        >
          rainbows
        </span>
      </div>

      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: `rgba(0, 10, 30, ${s.darkOverlay.opacity})`,
          zIndex: 1,
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};

/* ── Meta ── */

export const sceneMetasC = [
  { id: "RB-Scene06-HonestTraders", component: Scene06_HonestTraders, durationInFrames: 84 },
  { id: "RB-Scene07-Protected", component: Scene07_Protected, durationInFrames: 96 },
  { id: "RB-Scene08-FiveHundredK", component: Scene08_FiveHundredK, durationInFrames: 96 },
  { id: "RB-Scene09-Finale", component: Scene09_Finale, durationInFrames: 144 },
];
