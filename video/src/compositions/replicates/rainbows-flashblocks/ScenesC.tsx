import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
import { loadFont as loadGeist } from "@remotion/google-fonts/Geist";
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
const { fontFamily: brandFontFamily } = loadGeist("normal", {
  subsets: ["latin"],
  weights: ["400", "500", "600", "700", "800"],
});
const BLUE = "#0ABAB5";

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
   Direct mirror of sequence02/FullscreenMarkets.SegmentView:
   pick the active segment for the current frame, render the
   hex broll grid + the centered word cascade as siblings of
   the same AbsoluteFill. No nested Sequences, no ZoomedBg —
   one segment on screen at a time, just like the original.
   ═══════════════════════════════════════════════════════ */

const SCENE09_DURATION = 96;

interface BrollSegment {
  category: BrollCategory;
  durationInFrames: number;
  fontSize: number;
  words: CascadeWord[];
}

const SCENE09_SEGMENTS: BrollSegment[] = [
  {
    category: "twitch",
    durationInFrames: 24,
    fontSize: 200,
    words: [{ atFrame: 2, text: "Twitch" }],
  },
  {
    category: "pumpfun",
    durationInFrames: 24,
    fontSize: 150,
    words: [
      { atFrame: 2, text: "shorting", br: true },
      { atFrame: 8, text: "meme coins" },
    ],
  },
  {
    category: "animals",
    durationInFrames: 24,
    fontSize: 200,
    words: [{ atFrame: 2, text: "animals" }],
  },
  {
    category: "movies",
    durationInFrames: 24,
    fontSize: 200,
    words: [{ atFrame: 2, text: "movies" }],
  },
];

export const Scene09_BrollCycle: React.FC = () => {
  const frame = useCurrentFrame();

  let acc = 0;
  for (const seg of SCENE09_SEGMENTS) {
    const segStart = acc;
    const segEnd = acc + seg.durationInFrames;
    if (frame >= segStart && frame < segEnd) {
      // Translate per-segment word timings into the scene's local frame space.
      const adjustedWords = seg.words.map((w) => ({ ...w, atFrame: segStart + w.atFrame }));
      return (
        <AbsoluteFill>
          <BrollGridBg category={seg.category} startFrame={segStart} />
          <AbsoluteFill
            style={{
              justifyContent: "center",
              alignItems: "center",
              padding: 80,
            }}
          >
            <WordCascade
              words={adjustedWords}
              fontSize={seg.fontSize}
              fontFamily={fontFamily}
              color="#ffffff"
              fontWeight={900}
              fontStyle="italic"
            />
          </AbsoluteFill>
        </AbsoluteFill>
      );
    }
    acc = segEnd;
  }
  return null;
};

/* ═══════════════════════════════════════════════════════
   Scene 10 — Finale  (144 frames = 6s @ 24fps)
   "rainbows" briefly held → square wipe to General lockup.
   Mirrors public.com's end card — square instead of circle, GM
   logo mark instead of stacked dots, "General" wordmark.
   ═══════════════════════════════════════════════════════ */

const SCENE10_DURATION = 144;

/* Timing (composition frames) */
const RAINBOWS_HOLD_END = 38;   // start fade
const RAINBOWS_FADE_END = 46;   // fully faded
const WIPE_START = 46;
const WIPE_END = 60;            // 14-frame square wipe
const ENDCARD_START = WIPE_END;

/* Endcard sizes */
const LOGO_SIZE = 86;
const TEXT_SIZE = 124;
const TAGLINE_SIZE = 30;
const DOT_SIZE = 42;

const ENDCARD_BG =
  "radial-gradient(ellipse at center, #FFFFFF 0%, #FAFAFA 55%, #F0F0F0 100%)";

const lockupTextStyle: React.CSSProperties = {
  fontFamily: `${brandFontFamily}, system-ui, sans-serif`,
  fontSize: TEXT_SIZE,
  fontWeight: 700,
  color: "#000",
  letterSpacing: -1.2,
  lineHeight: 1,
};

const taglineStyle: React.CSSProperties = {
  fontFamily: `${brandFontFamily}, system-ui, sans-serif`,
  fontSize: TAGLINE_SIZE,
  fontWeight: 400,
  color: "#717171",
  letterSpacing: 0.2,
};

/* GM logo mark — black square with seven white horizontal pills.
 * Inlined from public/gm-logo.svg so no asset lookup is needed. */
const GMLogoMark: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 102 102" fill="none">
    <path d="M0 0H102V102H0V0Z" fill="#000" />
    <path d="M15.2794 49.5703C15.2794 49.1458 15.4181 48.7941 15.6956 48.5155C15.9731 48.2369 16.3233 48.0976 16.7462 48.0976H28.7186C29.1414 48.0976 29.4916 48.2369 29.7691 48.5155C30.0466 48.7941 30.1854 49.1458 30.1854 49.5703V52.5955C30.1854 53.0201 30.0466 53.3717 29.7691 53.6503C29.4916 53.929 29.1414 54.0683 28.7186 54.0683H16.7462C16.3233 54.0683 15.9731 53.929 15.6956 53.6503C15.4181 53.3717 15.2794 53.0201 15.2794 52.5955V49.5703Z" fill="#fff" />
    <path d="M26.6227 49.5703C26.6227 49.1458 26.7615 48.7941 27.039 48.5155C27.3165 48.2369 27.6667 48.0976 28.0895 48.0976H40.0619C40.4848 48.0976 40.835 48.2369 41.1125 48.5155C41.39 48.7941 41.5288 49.1458 41.5288 49.5703V52.5955C41.5288 53.0201 41.39 53.3717 41.1125 53.6503C40.835 53.929 40.4848 54.0683 40.0619 54.0683H28.0895C27.6667 54.0683 27.3165 53.929 27.039 53.6503C26.7615 53.3717 26.6227 53.0201 26.6227 52.5955V49.5703Z" fill="#fff" />
    <path d="M37.9661 49.5703C37.9661 49.1458 38.1048 48.7941 38.3824 48.5155C38.6599 48.2369 39.01 48.0976 39.4329 48.0976H51.4053C51.8282 48.0976 52.1784 48.2369 52.4559 48.5155C52.7334 48.7941 52.8721 49.1458 52.8721 49.5703V52.5955C52.8721 53.0201 52.7334 53.3717 52.4559 53.6503C52.1784 53.929 51.8282 54.0683 51.4053 54.0683H39.4329C39.01 54.0683 38.6599 53.929 38.3824 53.6503C38.1048 53.3717 37.9661 53.0201 37.9661 52.5955V49.5703Z" fill="#fff" />
    <path d="M49.3095 49.5703C49.3095 49.1458 49.4482 48.7941 49.7257 48.5155C50.0032 48.2369 50.3534 48.0976 50.7763 48.0976H62.7487C63.1716 48.0976 63.5217 48.2369 63.7992 48.5155C64.0768 48.7941 64.2155 49.1458 64.2155 49.5703V52.5955C64.2155 53.0201 64.0768 53.3717 63.7992 53.6503C63.5217 53.929 63.1716 54.0683 62.7487 54.0683H50.7763C50.3534 54.0683 50.0032 53.929 49.7257 53.6503C49.4482 53.3717 49.3095 53.0201 49.3095 52.5955V49.5703Z" fill="#fff" />
    <path d="M60.6528 49.5902C60.6528 49.1657 60.7916 48.814 61.0691 48.5354C61.3466 48.2568 61.6968 48.1175 62.1197 48.1175H68.423C68.8459 48.1175 69.1961 48.2568 69.4736 48.5354C69.7511 48.814 69.8898 49.1657 69.8898 49.5902V52.5955C69.8898 53.0201 69.7511 53.3717 69.4736 53.6503C69.1961 53.929 68.8459 54.0683 68.423 54.0683H62.1197C61.6968 54.0683 61.3466 53.929 61.0691 53.6503C60.7916 53.3717 60.6528 53.0201 60.6528 52.5955V49.5902Z" fill="#fff" />
    <path d="M66.3245 49.5703C66.3245 49.1458 66.4633 48.7941 66.7408 48.5155C67.0183 48.2369 67.3685 48.0976 67.7913 48.0976H79.7637C80.1866 48.0976 80.5368 48.2369 80.8143 48.5155C81.0918 48.7941 81.2306 49.1458 81.2306 49.5703V52.5955C81.2306 53.0201 81.0918 53.3717 80.8143 53.6503C80.5368 53.929 80.1866 54.0683 79.7637 54.0683H67.7913C67.3685 54.0683 67.0183 53.929 66.7408 53.6503C66.4633 53.3717 66.3245 53.0201 66.3245 52.5955V49.5703Z" fill="#fff" />
    <path d="M77.6679 49.5902C77.6679 49.1657 77.8066 48.814 78.0841 48.5354C78.3617 48.2568 78.7118 48.1175 79.1347 48.1175H85.4381C85.8609 48.1175 86.2111 48.2568 86.4886 48.5354C86.7661 48.814 86.9049 49.1657 86.9049 49.5902V52.5955C86.9049 53.0201 86.7661 53.3717 86.4886 53.6503C86.2111 53.929 85.8609 54.0683 85.4381 54.0683H79.1347C78.7118 54.0683 78.3617 53.929 78.0841 53.6503C77.8066 53.3717 77.6679 53.0201 77.6679 52.5955V49.5902Z" fill="#fff" />
  </svg>
);

export const Scene10_Finale: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  /* ── "rainbows" preroll: spring in, hold, fast fade ── */
  const rainbowsIn = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 180, mass: 0.6 },
  });
  const rainbowsOut = interpolate(
    frame,
    [RAINBOWS_HOLD_END, RAINBOWS_FADE_END],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const rainbowsY = interpolate(rainbowsIn, [0, 1], [12, 0]);
  const rainbowsOpacity = rainbowsIn * rainbowsOut;

  /* ── Square wipe: clip the blue layer from full-screen down to a point.
   *    `inset(50% from each side)` → zero visible area. ── */
  const wipePct = interpolate(frame, [WIPE_START, WIPE_END], [0, 50], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.65, 0, 0.25, 1),
  });

  /* ── Endcard local frame ── */
  const ec = Math.max(0, frame - ENDCARD_START);

  /* Phase 1 — bouncing square dot below "generalmarket" */
  const dotSpring = spring({
    frame: ec,
    fps,
    config: { damping: 8, mass: 0.3, stiffness: 280 },
  });

  /* Phase 2 — dot fades + drifts toward logo position; logo mark fades in */
  const transition = interpolate(ec, [6, 13], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.22, 0.1, 0.25, 1),
  });
  const singleDotOpacity = interpolate(transition, [0, 0.4], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const singleDotY = interpolate(transition, [0, 0.55], [0, -34], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const singleDotX = interpolate(transition, [0, 0.55], [0, -60], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const logoMarkOpacity = interpolate(transition, [0.18, 0.55], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const logoMarkScale = spring({
    frame: Math.max(0, ec - 6),
    fps,
    config: { damping: 10, mass: 0.3, stiffness: 180 },
  });

  /* Phase 3 — tagline */
  const taglineSpring = spring({
    frame: Math.max(0, ec - 26),
    fps,
    config: { damping: 12, mass: 0.3, stiffness: 140 },
  });
  const taglineProgress = ec < 26 ? 0 : taglineSpring;
  const taglineY = interpolate(taglineProgress, [0, 1], [10, 0]);

  /* Lockup nudges up slightly as the tagline arrives, to keep the
   * optical center balanced. */
  const contentShiftY = interpolate(ec, [22, 34], [0, -10], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      {/* GM endcard layer — sits underneath; revealed by square wipe */}
      <AbsoluteFill style={{ background: ENDCARD_BG }}>
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: `translate(-50%, calc(-50% + ${contentShiftY}px))`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          {/* Logo lockup row: [mark] General */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              minHeight: 120,
            }}
          >
            {/* GM logo mark — appears on the LEFT of the wordmark */}
            <div
              style={{
                marginRight: 22,
                opacity: logoMarkOpacity,
                transform: `scale(${logoMarkScale})`,
                display: "flex",
                alignItems: "center",
              }}
            >
              <GMLogoMark size={LOGO_SIZE} />
            </div>

            {/* Wordmark — "General" */}
            <div style={{ display: "flex", alignItems: "baseline" }}>
              <span style={lockupTextStyle}>General</span>
            </div>

            {/* Bouncing square dot — sits below "General", drifts
             * up-left as it fades, the way the public.com circle does. */}
            <div
              style={{
                position: "absolute",
                left: "42%",
                bottom: -10,
                transform: `translate(-50%, ${24 + singleDotY}px) translateX(${singleDotX}px) scale(${dotSpring})`,
                opacity: singleDotOpacity,
                pointerEvents: "none",
              }}
            >
              <div
                style={{
                  width: DOT_SIZE,
                  height: DOT_SIZE,
                  backgroundColor: "#000",
                }}
              />
            </div>
          </div>

          {/* Tagline */}
          <div
            style={{
              marginTop: 28,
              opacity: taglineProgress,
              transform: `translateY(${taglineY}px)`,
            }}
          >
            <span style={taglineStyle}>Markets for everything.</span>
          </div>
        </div>
      </AbsoluteFill>

      {/* Blue overlay carrying "rainbows" — gets eaten by the square wipe */}
      <AbsoluteFill
        style={{
          backgroundColor: BLUE,
          clipPath: `inset(${wipePct}% ${wipePct}% ${wipePct}% ${wipePct}%)`,
          WebkitClipPath: `inset(${wipePct}% ${wipePct}% ${wipePct}% ${wipePct}%)`,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: `translate(-50%, calc(-50% + ${rainbowsY}px))`,
            opacity: rainbowsOpacity,
            textAlign: "center",
            maxWidth: 1500,
          }}
        >
          <span
            style={{
              fontFamily,
              fontSize: 200,
              fontWeight: 800,
              fontStyle: "normal",
              color: "#fff",
              display: "block",
              lineHeight: 1.1,
              letterSpacing: -2,
            }}
          >
            gain more
          </span>
          <span
            style={{
              fontFamily,
              fontSize: 78,
              fontWeight: 400,
              fontStyle: "italic",
              color: "#fff",
              display: "block",
              lineHeight: 1.3,
              marginTop: 18,
              whiteSpace: "nowrap",
            }}
          >
            while trading the same assets with
          </span>
        </div>
      </AbsoluteFill>
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
