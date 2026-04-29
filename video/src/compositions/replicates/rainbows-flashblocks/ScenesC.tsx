import React from "react";
import {
  AbsoluteFill,
  Img,
  staticFile,
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
  DynamicDark,
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

   Two beats with proper text animation:
     Beat A (0–58, ~2.4s) — "gain more" + "while trading the
       same assets with" cascade in word-by-word over blue.
     Beat B (58–144, ~3.6s) — square wipe reveals dark hex
       grid with the generalmarket.io UI in a browser frame
       and a bold tagline below — mirrors the reference layout.
   ═══════════════════════════════════════════════════════ */

const SCENE10_DURATION = 144;

/* Beat A — word cascade timings (composition frames) */
const PHRASE_A_WORDS = ["gain", "more"] as const;
const PHRASE_B_WORDS = ["while", "trading", "the", "same", "assets", "with"] as const;
const PHRASE_A_START = 0;
const PHRASE_A_STAGGER = 4;       // frames between words in phrase A
const PHRASE_B_START = 14;
const PHRASE_B_STAGGER = 3;       // frames between words in phrase B

/* Beat A → B transition */
const BLUE_HOLD_END = 50;
const WIPE_START = 50;
const WIPE_END = 64;              // 14-frame square wipe
const REVEAL_START = WIPE_END;

/* Beat B — UI reveal */
const UI_FRAME_W = 1620;
const UI_FRAME_H = 920;
const UI_FRAME_RADIUS = 24;
const UI_TAGLINE_SIZE = 96;
const UI_TAGLINE_ACCENT = "#34D399";   // emerald — matches reference

/* Browser-frame chrome — three macOS-style traffic-light dots and an
 * address pill above the screenshot. Keeps the UI shot feeling like a
 * real product surface, the way the reference image does. */
const BrowserChrome: React.FC<{ width: number }> = ({ width }) => (
  <div
    style={{
      width,
      height: 48,
      backgroundColor: "#161618",
      borderTopLeftRadius: UI_FRAME_RADIUS,
      borderTopRightRadius: UI_FRAME_RADIUS,
      display: "flex",
      alignItems: "center",
      paddingLeft: 22,
      paddingRight: 22,
      gap: 10,
      borderBottom: "1px solid rgba(255,255,255,0.08)",
    }}
  >
    {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
      <div key={c} style={{ width: 14, height: 14, borderRadius: "50%", backgroundColor: c }} />
    ))}
    <div
      style={{
        flex: 1,
        marginLeft: 28,
        height: 28,
        borderRadius: 8,
        backgroundColor: "rgba(255,255,255,0.06)",
        display: "flex",
        alignItems: "center",
        paddingLeft: 14,
        fontFamily: `${brandFontFamily}, system-ui, sans-serif`,
        fontSize: 16,
        color: "rgba(255,255,255,0.65)",
        letterSpacing: 0.2,
      }}
    >
      generalmarket.io
    </div>
  </div>
);

export const Scene10_Finale: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  /* ── Beat A — word-cascade entry per word ── */
  const wordEntry = (atFrame: number) => {
    const local = Math.max(0, frame - atFrame);
    const s = spring({
      frame: local,
      fps,
      config: { damping: 14, stiffness: 200, mass: 0.55 },
    });
    return {
      opacity: interpolate(s, [0, 1], [0, 1]),
      y: interpolate(s, [0, 1], [22, 0]),
      scale: interpolate(s, [0, 1], [0.92, 1]),
    };
  };

  /* Beat A fades as the wipe begins so the words don't fight the reveal. */
  const blueLayerOpacity = interpolate(frame, [BLUE_HOLD_END - 4, WIPE_START + 2], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  /* ── Square wipe: shrinks the blue layer to a point ── */
  const wipePct = interpolate(frame, [WIPE_START, WIPE_END], [0, 50], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.65, 0, 0.25, 1),
  });

  /* ── Beat B — local frame ── */
  const rv = Math.max(0, frame - REVEAL_START);

  /* UI screenshot drops in from above with subtle scale (back.out feel). */
  const uiSpring = spring({
    frame: rv,
    fps,
    config: { damping: 16, stiffness: 140, mass: 0.7 },
  });
  const uiOpacity = interpolate(rv, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const uiY = interpolate(uiSpring, [0, 1], [-60, 0]);
  const uiScale = interpolate(uiSpring, [0, 1], [0.96, 1]);

  /* Slow continuous parallax: drifts the UI a few px upward through the
   * hold so the frame doesn't feel frozen. */
  const uiDrift = interpolate(rv, [10, SCENE10_DURATION - REVEAL_START], [0, -14], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  /* Tagline cascades in word-by-word a beat after the UI lands. */
  const taglineWords = ["Markets", "for", "everything"] as const;
  const taglineStart = REVEAL_START + 14;
  const taglineStagger = 4;

  return (
    <AbsoluteFill>
      {/* Beat B (revealed underneath) — dark hex grid + UI + tagline */}
      <AbsoluteFill>
        <ZoomedBg duration={SCENE10_DURATION}>
          <DynamicDark />
          <HexGridOverlay color="rgba(255,255,255,0.10)" size={70} />
        </ZoomedBg>

        {/* UI mockup — browser frame around the homepage screenshot */}
        <div
          style={{
            position: "absolute",
            top: "44%",
            left: "50%",
            transform: `translate(-50%, calc(-50% + ${uiY + uiDrift}px)) scale(${uiScale})`,
            opacity: uiOpacity,
            width: UI_FRAME_W,
            borderRadius: UI_FRAME_RADIUS,
            boxShadow:
              "0 60px 120px rgba(0,0,0,0.55), 0 24px 48px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.08) inset",
            backgroundColor: "#0b0d10",
            overflow: "hidden",
          }}
        >
          <BrowserChrome width={UI_FRAME_W} />
          <Img
            src={staticFile("gm-homepage.png")}
            style={{
              display: "block",
              width: "100%",
              height: UI_FRAME_H,
              objectFit: "cover",
              objectPosition: "top center",
            }}
          />
        </div>

        {/* Tagline — bottom band, cascading words like the reference */}
        <div
          style={{
            position: "absolute",
            bottom: 80,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            alignItems: "baseline",
            gap: 26,
          }}
        >
          {taglineWords.map((word, i) => {
            const e = wordEntry(taglineStart + i * taglineStagger);
            const isAccent = word === "everything";
            return (
              <span
                key={i}
                style={{
                  fontFamily,
                  fontSize: UI_TAGLINE_SIZE,
                  fontWeight: 800,
                  fontStyle: "italic",
                  color: isAccent ? UI_TAGLINE_ACCENT : "#fff",
                  letterSpacing: -1.5,
                  lineHeight: 1,
                  opacity: e.opacity,
                  transform: `translateY(${e.y}px) scale(${e.scale})`,
                  textShadow: "0 6px 30px rgba(0,0,0,0.55)",
                  display: "inline-block",
                }}
              >
                {word}
              </span>
            );
          })}
        </div>
      </AbsoluteFill>

      {/* Beat A — blue layer with word-cascade text; eaten by the wipe */}
      <AbsoluteFill
        style={{
          backgroundColor: BLUE,
          clipPath: `inset(${wipePct}% ${wipePct}% ${wipePct}% ${wipePct}%)`,
          WebkitClipPath: `inset(${wipePct}% ${wipePct}% ${wipePct}% ${wipePct}%)`,
          opacity: blueLayerOpacity,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            textAlign: "center",
            maxWidth: 1500,
            width: "92%",
          }}
        >
          {/* Phrase A — "gain more" — large bold cascade */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 28,
              marginBottom: 22,
            }}
          >
            {PHRASE_A_WORDS.map((word, i) => {
              const e = wordEntry(PHRASE_A_START + i * PHRASE_A_STAGGER);
              return (
                <span
                  key={i}
                  style={{
                    fontFamily,
                    fontSize: 200,
                    fontWeight: 800,
                    fontStyle: "normal",
                    color: "#fff",
                    lineHeight: 1.05,
                    letterSpacing: -2,
                    opacity: e.opacity,
                    transform: `translateY(${e.y}px) scale(${e.scale})`,
                    display: "inline-block",
                  }}
                >
                  {word}
                </span>
              );
            })}
          </div>

          {/* Phrase B — italic, smaller, faster cascade */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 18,
              flexWrap: "wrap",
              rowGap: 8,
            }}
          >
            {PHRASE_B_WORDS.map((word, i) => {
              const e = wordEntry(PHRASE_B_START + i * PHRASE_B_STAGGER);
              return (
                <span
                  key={i}
                  style={{
                    fontFamily,
                    fontSize: 78,
                    fontWeight: 400,
                    fontStyle: "italic",
                    color: "#fff",
                    lineHeight: 1.3,
                    opacity: e.opacity,
                    transform: `translateY(${e.y}px)`,
                    display: "inline-block",
                  }}
                >
                  {word}
                </span>
              );
            })}
          </div>
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
