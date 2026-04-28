import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
import { useGsapProxy } from "../standrew/gsapUtils";
import {
  BrollGridBg,
  DynamicBlue,
  DynamicLight,
  DynamicSolidBlue,
  HexGridOverlay,
  MegaGridBg,
  WordCascade,
  ZoomedBg,
  type BrollCategory,
  type CascadeWord,
} from "./dynamics";

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
   Scene 06 — HonestTraders  (84 frames = 3.5s)
   Concentric circles + serif italic.
   "Leaving the same amount of profits" → "to fewer honest traders."
   ═══════════════════════════════════════════════════════ */

const SCENE06_DURATION = 84;
const SCENE06_PHASE1 = ["Leaving", "the", "same", "amount", "of", "profits"] as const;
const SCENE06_PHASE2 = ["to", "fewer", "honest", "traders"] as const;

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
      const circles = [p.c0, p.c1, p.c2, p.c3, p.c4, p.c5];
      const maxSizes = [90, 262, 434, 606, 778, 950];
      circles.forEach((c, i) => {
        const start = i * 0.18;
        tl.to(c, { opacity: 0.4, duration: 0.01 }, start);
        tl.to(c, { size: maxSizes[i], duration: 1.8, ease: "power1.out" }, start);
      });

      SCENE06_PHASE1.forEach((_, i) => {
        tl.to(p[`p1_${i}`], { opacity: 1, y: 0, duration: 0.14, ease: "power2.out" }, 0.1 + i * 0.13);
      });

      tl.to(p.phase1Wrap, { opacity: 0, duration: 0.22, ease: "power2.in" }, 1.7);

      tl.to(p.phase2Wrap, { opacity: 1, scale: 1, duration: 0.3, ease: "back.out(1.4)" }, 1.95);

      SCENE06_PHASE2.forEach((_, i) => {
        tl.to(p[`p2_${i}`], { opacity: 1, y: 0, duration: 0.18, ease: "power2.out" }, 2.05 + i * 0.18);
      });
    },
    scene06Init,
  );

  const circles = [s.c0, s.c1, s.c2, s.c3, s.c4, s.c5];

  return (
    <AbsoluteFill>
      <ZoomedBg duration={SCENE06_DURATION}>
        <DynamicSolidBlue />
      </ZoomedBg>

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

      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "10px 20px",
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
                fontSize: 95,
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
          gap: "0 22px",
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
                fontSize: 130,
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
   Scene 07 — Protected  (96 frames = 4s)
   Phase 1 (LightGradient): "Trade the assets you've always traded."
   Phase 2 (BlueGradient + HexGrid): "Protected."
   ═══════════════════════════════════════════════════════ */

const SCENE07_DURATION = 96;
const SCENE07_PHASE1 = ["Trade", "the", "assets", "you've", "always", "traded"] as const;

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
      SCENE07_PHASE1.forEach((_, i) => {
        tl.to(p[`p1_${i}`], { opacity: 1, y: 0, duration: 0.16, ease: "power2.out" }, 0.1 + i * 0.16);
      });

      tl.to(p.phase1, { opacity: 0, duration: 0.22, ease: "power2.in" }, 2.2);

      tl.to(p.phase2, { opacity: 1, duration: 0.18, ease: "power2.out" }, 2.45);
      tl.to(p.protected, { opacity: 1, scale: 1, duration: 0.4, ease: "back.out(1.6)" }, 2.45);
    },
    scene07Init,
  );

  return (
    <AbsoluteFill>
      {/* Phase 1 — DynamicLight + blue italic stagger */}
      <AbsoluteFill style={{ opacity: s.phase1.opacity }}>
        <ZoomedBg duration={SCENE07_DURATION}>
          <DynamicLight />
        </ZoomedBg>
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "12px 22px",
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
                  fontSize: 105,
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

      {/* Phase 2 — DynamicBlue + hex grid + "Protected." */}
      <AbsoluteFill style={{ opacity: s.phase2.opacity }}>
        <ZoomedBg duration={SCENE07_DURATION}>
          <DynamicBlue />
          <HexGridOverlay color="rgba(255,255,255,0.18)" size={70} />
        </ZoomedBg>
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
              fontSize: 220,
              color: "#fff",
              whiteSpace: "nowrap",
            }}
          >
            Protected
          </span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ═══════════════════════════════════════════════════════
   Scene 08 — FiveHundredK  (96 frames = 4s @ 24fps)
   MegaGrid scrolling background + WordCascade reveal —
   matched to the Sequence02 "500,000" SLAM at frame 50:08.
   ═══════════════════════════════════════════════════════ */

const SCENE08_DURATION = 96;

const SCENE08_WORDS: CascadeWord[] = [
  { atFrame: 2,  text: "Plus",      size: 90,  br: true },
  { atFrame: 8,  text: "500,000",   size: 240, br: true },
  { atFrame: 36, text: "assets" },
  { atFrame: 41, text: "you" },
  { atFrame: 45, text: "couldn't",  br: true },
  { atFrame: 54, text: "trade" },
  { atFrame: 60, text: "anywhere" },
  { atFrame: 67, text: "else" },
];

export const Scene08_FiveHundredK: React.FC = () => {
  return (
    <AbsoluteFill>
      <ZoomedBg duration={SCENE08_DURATION}>
        <MegaGridBg cols={10} rows={10} />
      </ZoomedBg>
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          padding: 80,
        }}
      >
        <WordCascade
          words={SCENE08_WORDS}
          fontSize={90}
          fontFamily={fontFamily}
          color="#ffffff"
          fontWeight={900}
          fontStyle="italic"
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ═══════════════════════════════════════════════════════
   Scene 09 — BrollCycle  (96 frames = 4s @ 24fps)
   Mirror of Sequence02 0:57–1:00 broll system. Hex broll grid
   below, big italic word on top per category.
   Real broll plays in the cells on render.
   ═══════════════════════════════════════════════════════ */

const SCENE09_DURATION = 96;

interface BrollSegment {
  category: BrollCategory;
  durationInFrames: number;
  words: CascadeWord[];
  fontSize: number;
}

const SCENE09_SEGMENTS: BrollSegment[] = [
  {
    category: "twitch",
    durationInFrames: 24,
    fontSize: 200,
    words: [{ atFrame: 1, text: "Twitch" }],
  },
  {
    category: "pumpfun",
    durationInFrames: 24,
    fontSize: 150,
    words: [
      { atFrame: 1, text: "shorting", br: true },
      { atFrame: 7, text: "meme coins" },
    ],
  },
  {
    category: "animals",
    durationInFrames: 24,
    fontSize: 200,
    words: [{ atFrame: 1, text: "animals" }],
  },
  {
    category: "movies",
    durationInFrames: 24,
    fontSize: 200,
    words: [{ atFrame: 1, text: "movies" }],
  },
];

const cumulativeStart = (segments: BrollSegment[], idx: number) =>
  segments.slice(0, idx).reduce((acc, s) => acc + s.durationInFrames, 0);

export const Scene09_BrollCycle: React.FC = () => {
  return (
    <AbsoluteFill>
      <ZoomedBg duration={SCENE09_DURATION}>
        {SCENE09_SEGMENTS.map((seg, i) => (
          <Sequence
            key={`bg-${seg.category}`}
            from={cumulativeStart(SCENE09_SEGMENTS, i)}
            durationInFrames={seg.durationInFrames}
            name={`broll-${seg.category}`}
          >
            <BrollGridBg category={seg.category} />
          </Sequence>
        ))}
      </ZoomedBg>

      {SCENE09_SEGMENTS.map((seg, i) => (
        <Sequence
          key={`text-${seg.category}`}
          from={cumulativeStart(SCENE09_SEGMENTS, i)}
          durationInFrames={seg.durationInFrames}
          name={`label-${seg.category}`}
        >
          <AbsoluteFill
            style={{
              justifyContent: "center",
              alignItems: "center",
              padding: 80,
            }}
          >
            <WordCascade
              words={seg.words}
              fontSize={seg.fontSize}
              fontFamily={fontFamily}
              color="#ffffff"
              fontWeight={900}
              fontStyle="italic"
            />
          </AbsoluteFill>
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

/* ═══════════════════════════════════════════════════════
   Scene 10 — Finale  (144 frames = 6s)
   "rainbows" + dark fade
   ═══════════════════════════════════════════════════════ */

const SCENE10_DURATION = 144;

export const Scene10_Finale: React.FC = () => {
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
      <ZoomedBg duration={SCENE10_DURATION}>
        <DynamicBlue />
      </ZoomedBg>

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
            fontSize: 240,
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
  { id: "RB-Scene06-HonestTraders", component: Scene06_HonestTraders, durationInFrames: SCENE06_DURATION },
  { id: "RB-Scene07-Protected", component: Scene07_Protected, durationInFrames: SCENE07_DURATION },
  { id: "RB-Scene08-FiveHundredK", component: Scene08_FiveHundredK, durationInFrames: SCENE08_DURATION },
  { id: "RB-Scene09-BrollCycle", component: Scene09_BrollCycle, durationInFrames: SCENE09_DURATION },
  { id: "RB-Scene10-Finale", component: Scene10_Finale, durationInFrames: SCENE10_DURATION },
];
