import React from "react";
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { CascadeText } from "../../lib/components/Text";
import { SOURCES } from "../launch/data/sources";
import { FEATURED_SOURCES, FeaturedCard } from "./SourceCardsWall";
import { SourceVortexGallery } from "./SourceVortexGallery";

const { fontFamily: INTER } = loadInter("normal", {
  subsets: ["latin"],
  weights: ["400", "500", "600", "700", "800", "900"],
});

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease3 = (t: number) => 1 - Math.pow(1 - t, 3);

// Wise palette — near-black ground, lime-green shapes, white text that
// auto-inverts against the shapes via mix-blend-mode: difference.
const BLACK = "#0e0f0c";
const WHITE = "#ffffff";

// GM lockup — seven stacked bars in a 102×102 viewBox. Lifted from
// /frontend/public/logo.svg. Rendered in white for the night-mode
// inversion on the intro.
const GM_LOGO_PATHS = [
  "M15.2794 49.5703C15.2794 49.1458 15.4181 48.7941 15.6956 48.5155C15.9731 48.2369 16.3233 48.0976 16.7462 48.0976H28.7186C29.1414 48.0976 29.4916 48.2369 29.7691 48.5155C30.0466 48.7941 30.1854 49.1458 30.1854 49.5703V52.5955C30.1854 53.0201 30.0466 53.3717 29.7691 53.6503C29.4916 53.929 29.1414 54.0683 28.7186 54.0683H16.7462C16.3233 54.0683 15.9731 53.929 15.6956 53.6503C15.4181 53.3717 15.2794 53.0201 15.2794 52.5955V49.5703Z",
  "M26.6227 49.5703C26.6227 49.1458 26.7615 48.7941 27.039 48.5155C27.3165 48.2369 27.6667 48.0976 28.0895 48.0976H40.0619C40.4848 48.0976 40.835 48.2369 41.1125 48.5155C41.39 48.7941 41.5288 49.1458 41.5288 49.5703V52.5955C41.5288 53.0201 41.39 53.3717 41.1125 53.6503C40.835 53.929 40.4848 54.0683 40.0619 54.0683H28.0895C27.6667 54.0683 27.3165 53.929 27.039 53.6503C26.7615 53.3717 26.6227 53.0201 26.6227 52.5955V49.5703Z",
  "M37.9661 49.5703C37.9661 49.1458 38.1048 48.7941 38.3824 48.5155C38.6599 48.2369 39.01 48.0976 39.4329 48.0976H51.4053C51.8282 48.0976 52.1784 48.2369 52.4559 48.5155C52.7334 48.7941 52.8721 49.1458 52.8721 49.5703V52.5955C52.8721 53.0201 52.7334 53.3717 52.4559 53.6503C52.1784 53.929 51.8282 54.0683 51.4053 54.0683H39.4329C39.01 54.0683 38.6599 53.929 38.3824 53.6503C38.1048 53.3717 37.9661 53.0201 37.9661 52.5955V49.5703Z",
  "M49.3095 49.5703C49.3095 49.1458 49.4482 48.7941 49.7257 48.5155C50.0032 48.2369 50.3534 48.0976 50.7763 48.0976H62.7487C63.1716 48.0976 63.5217 48.2369 63.7992 48.5155C64.0768 48.7941 64.2155 49.1458 64.2155 49.5703V52.5955C64.2155 53.0201 64.0768 53.3717 63.7992 53.6503C63.5217 53.929 63.1716 54.0683 62.7487 54.0683H50.7763C50.3534 54.0683 50.0032 53.929 49.7257 53.6503C49.4482 53.3717 49.3095 53.0201 49.3095 52.5955V49.5703Z",
  "M60.6528 49.5902C60.6528 49.1657 60.7916 48.814 61.0691 48.5354C61.3466 48.2568 61.6968 48.1175 62.1197 48.1175H68.423C68.8459 48.1175 69.1961 48.2568 69.4736 48.5354C69.7511 48.814 69.8898 49.1657 69.8898 49.5902V52.5955C69.8898 53.0201 69.7511 53.3717 69.4736 53.6503C69.1961 53.929 68.8459 54.0683 68.423 54.0683H62.1197C61.6968 54.0683 61.3466 53.929 61.0691 53.6503C60.7916 53.3717 60.6528 53.0201 60.6528 52.5955V49.5902Z",
  "M66.3245 49.5703C66.3245 49.1458 66.4633 48.7941 66.7408 48.5155C67.0183 48.2369 67.3685 48.0976 67.7913 48.0976H79.7637C80.1866 48.0976 80.5368 48.2369 80.8143 48.5155C81.0918 48.7941 81.2306 49.1458 81.2306 49.5703V52.5955C81.2306 53.0201 81.0918 53.3717 80.8143 53.6503C80.5368 53.929 80.1866 54.0683 79.7637 54.0683H67.7913C67.3685 54.0683 67.0183 53.929 66.7408 53.6503C66.4633 53.3717 66.3245 53.0201 66.3245 52.5955V49.5703Z",
  "M77.6679 49.5902C77.6679 49.1657 77.8066 48.814 78.0841 48.5354C78.3617 48.2568 78.7118 48.1175 79.1347 48.1175H85.4381C85.8609 48.1175 86.2111 48.2568 86.4886 48.5354C86.7661 48.814 86.9049 49.1657 86.9049 49.5902V52.5955C86.9049 53.0201 86.7661 53.3717 86.4886 53.6503C86.2111 53.929 85.8609 54.0683 85.4381 54.0683H79.1347C78.7118 54.0683 78.3617 53.929 78.0841 53.6503C77.8066 53.3717 77.6679 53.0201 77.6679 52.5955V49.5902Z",
];

// ─── Scene timings ───────────────────────────────────────────────────────
// Compressed after the sub-text removals. Point2 and Point3 lose their
// bottom lines; Stat loses its LOSS CUT label. Each scene now holds just
// long enough for its remaining reveals to land and breathe.
export const PITCH_SCENES = {
  intro: { start: 0, end: 96 },
  stat: { start: 96, end: 220 },
  point1: { start: 220, end: 340 },
  point2: { start: 340, end: 440 },
  point3: { start: 440, end: 540 },
  closing: { start: 540, end: 712 },
} as const;

export const PITCH_DURATION = PITCH_SCENES.closing.end;

// ─── Reveal — words rise from below, blur dissolves (CascadeText).
//      Wrapped in a Sequence so useCurrentFrame resets to the mount moment,
//      and in a difference-blend div so every word auto-inverts against any
//      white shape behind it.

const Reveal: React.FC<{
  from: number;
  duration: number;
  text: string;
  style?: React.CSSProperties;
  /** Ignored — kept for call-site stability */
  revealDuration?: number;
  /** Ignored — kept for call-site stability */
  seed?: number;
  /** Skip the mix-blend-mode: difference so text stays solid white. */
  solid?: boolean;
}> = ({ from, duration, text, style, solid }) => {
  const s = style ?? {};
  const fontSize = typeof s.fontSize === "number" ? s.fontSize : 48;
  const fontWeight =
    typeof s.fontWeight === "number" ? s.fontWeight : 700;
  const letterSpacing =
    typeof s.letterSpacing === "string" ? s.letterSpacing : undefined;
  const lineHeight =
    typeof s.lineHeight === "number" ? s.lineHeight * fontSize : undefined;
  const maxWidth =
    typeof s.maxWidth === "number" ? s.maxWidth : 1600;
  const align =
    s.textAlign === "center"
      ? "center"
      : s.textAlign === "right"
      ? "right"
      : "left";
  const uppercase = s.textTransform === "uppercase";
  const displayText = uppercase ? text.toUpperCase() : text;

  return (
    <Sequence from={from} durationInFrames={duration} layout="none">
      <div
        style={{
          mixBlendMode: solid ? "normal" : "difference",
          color: WHITE,
          opacity: typeof s.opacity === "number" ? s.opacity : undefined,
        }}
      >
        <CascadeText
          text={displayText}
          fontFamily={INTER}
          fontSize={fontSize}
          fontWeight={fontWeight}
          letterSpacing={letterSpacing}
          lineHeight={lineHeight}
          maxWidth={maxWidth}
          align={align}
          color={WHITE}
          riseDistance={Math.max(40, fontSize * 0.55)}
          blurPx={Math.min(16, fontSize / 8)}
          delayPerWord={3}
          durationPerWord={22}
        />
      </div>
    </Sequence>
  );
};

// ─── Scene 1: INTRO ──────────────────────────────────────────────────────

const IntroScene: React.FC<{
  local: number;
  sceneStart: number;
  duration: number;
}> = ({ local, sceneStart, duration }) => {
  const logoScale = interpolate(local, [4, 44], [0.4, 1], {
    ...clamp,
    easing: ease3,
  });
  const logoOpacity = interpolate(local, [4, 44], [0, 1], clamp);
  const fadeOut = interpolate(local, [duration - 14, duration], [1, 0], clamp);

  // Icon + wordmark live in one horizontal lockup, sized off a shared
  // rhythm: plate edge = 0.9 × cap height of the wordmark. Keeps the
  // mark from feeling slapped on.
  const fontSize = 120;
  const plateEdge = 132;

  return (
    <AbsoluteFill style={{ opacity: fadeOut }}>
      {/* LOCKUP — centered horizontally + vertically */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 32,
          }}
        >
          {/* Icon plate — rounded square, white bars on a lifted-black
              plate so it reads as its own shape against the stage. */}
          <div
            style={{
              width: plateEdge,
              height: plateEdge,
              background: "#1a1a1a",
              borderRadius: 22,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: `scale(${logoScale})`,
              transformOrigin: "center",
              opacity: logoOpacity,
              boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)",
            }}
          >
            <svg
              width={plateEdge * 0.82}
              height={plateEdge * 0.82}
              viewBox="0 0 102 102"
            >
              {GM_LOGO_PATHS.map((d, i) => (
                <path key={i} d={d} fill="#ffffff" />
              ))}
            </svg>
          </div>

          {/* Wordmark */}
          <Reveal
            from={sceneStart + 4}
            duration={duration - 4}
            text="General Market"
            revealDuration={34}
            seed={11}
            style={{
              fontSize,
              fontWeight: 900,
              letterSpacing: "-0.03em",
              textAlign: "left",
              lineHeight: 1,
              maxWidth: 1400,
            }}
          />
        </div>
      </AbsoluteFill>

      {/* Tagline — fights back, sitting below the lockup */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          paddingTop: 260,
        }}
      >
        <Reveal
          from={sceneStart + 48}
          duration={duration - 48}
          text="fights back"
          revealDuration={28}
          seed={23}
          style={{
            fontSize: 68,
            fontWeight: 500,
            letterSpacing: "-0.01em",
            textAlign: "center",
            lineHeight: 1,
            maxWidth: 1400,
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─── Card vortex — helix of source cards continuously scrolling past the
//      camera, directly ported from the WebGLPicks VortexGallery behaviour.
//      Each card owns a baseAngle + baseY; the rendered angle adds the
//      scene rotation scaled by a per-ring speed factor (so cards don't
//      travel in lockstep), and Y is offset by a global scroll then
//      wrapped modulo the cylinder height. Uses the verbatim VortexGallery
//      component from WebGLPicks — same shaders, same 600-instance
//      cylinder, same continuous scroll + rotation.

// ─── Scene 2: POINT 1 — 500,000 active markets ───────────────────────────

const Point1Scene: React.FC<{
  local: number;
  sceneStart: number;
  duration: number;
}> = ({ local, sceneStart, duration }) => {
  const fadeOut = interpolate(local, [duration - 18, duration], [1, 0], clamp);
  const vortexIn = interpolate(local, [0, 30], [0, 1], {
    ...clamp,
    easing: ease3,
  });

  return (
    <AbsoluteFill style={{ opacity: fadeOut, background: "#000000" }}>
      {/* VORTEX — source-card variant of the WebGLPicks VortexGallery */}
      <AbsoluteFill style={{ opacity: vortexIn }}>
        <SourceVortexGallery />
      </AbsoluteFill>

      {/* CENTER — the headline number and its tagline. Solid white, no
          difference blend — stands cleanly in front of the vortex. */}
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
        }}
      >
        <Reveal
          from={sceneStart + 8}
          duration={duration - 8}
          text="500,000"
          revealDuration={28}
          seed={37}
          solid
          style={{
            fontSize: 260,
            fontWeight: 900,
            letterSpacing: "-0.04em",
            textAlign: "center",
            maxWidth: 1700,
          }}
        />
        <Reveal
          from={sceneStart + 34}
          duration={duration - 34}
          text="active markets"
          revealDuration={26}
          seed={31}
          solid
          style={{
            fontSize: 52,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            textAlign: "center",
            maxWidth: 1500,
          }}
        />
      </AbsoluteFill>

      {/* SUBTITLE — only-on-GM examples */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          paddingBottom: 110,
        }}
      >
        <Reveal
          from={sceneStart + 66}
          duration={duration - 66}
          text="Only on GM — Twitch, weather, trains, elections…"
          revealDuration={42}
          seed={53}
          style={{
            fontSize: 34,
            fontWeight: 600,
            letterSpacing: "-0.01em",
            textAlign: "center",
            maxWidth: 1500,
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─── Scene 4: POINT 2 — 100% privacy until settlement ────────────────────
//
// Animation copied from WebGLPicks / GradientCarousel
// (src/compositions/backgrounds/webgl-picks/GradientCarousel.tsx). The
// carousel itself stays clean — pastel gradient cards are the blocks
// flowing through the chain. The five parties who would normally read
// those blocks — Insider Trader, Hedge Fund, Government, Market
// Manipulator, Front Runner — stand outside the animation, looking up
// at it. Each head wears a thought bubble of ciphertext and a "?" that
// never resolves. They watch. They do not read.

type PassingBlock = { hash: string };

const PASSING_BLOCKS: PassingBlock[] = [
  { hash: "0x7f3a••1e92" },
  { hash: "0x2d18••0b45" },
  { hash: "0xa2b7••c3d8" },
  { hash: "0xe4f1••6a9c" },
  { hash: "0x9c2e••4d7f" },
  { hash: "0x5a8b••31f0" },
  { hash: "0xb37d••8e1a" },
];

const OUTSIDE_WATCHERS: readonly string[] = [
  "INSIDER TRADER",
  "HEDGE FUND",
  "GOVERNMENT",
  "MARKET MANIPULATOR",
  "FRONT RUNNER",
];

const MONO_FAMILY =
  'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace';

// ── Outside watchers — silhouettes beneath the carousel, looking up ──────

const WatcherSilhouette: React.FC<{ scale?: number }> = ({ scale = 1 }) => (
  <svg
    width={96 * scale}
    height={110 * scale}
    viewBox="0 0 96 110"
    fill="none"
  >
    <circle cx="48" cy="32" r="22" fill="#f6f7f9" />
    <path
      d="M8 108 C 8 76, 32 62, 48 62 C 64 62, 88 76, 88 108 Z"
      fill="#f6f7f9"
    />
  </svg>
);

// GM vertical column — the privacy filter. Source-branded cards enter
// from the left, cross the column, and emerge on the right anonymised
// as blocks. Opaque white tower stamped with the General Market icon
// and a stacked wordmark. Everything that wants to be read passes
// through it first.
const GmColumn: React.FC<{
  left: number;
  top: number;
  width: number;
  height: number;
  local: number;
}> = ({ left, top, width, height, local }) => {
  const reveal = interpolate(local, [4, 20], [0, 1], {
    ...clamp,
    easing: ease3,
  });
  const markEntry = interpolate(local, [14, 30], [0, 1], {
    ...clamp,
    easing: ease3,
  });

  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        width,
        height,
        background: WHITE,
        border: `2px solid ${BLACK}`,
        borderRadius: 22,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        transform: `scaleX(${reveal})`,
        transformOrigin: "0% 50%",
        zIndex: 400,
      }}
    >
      <svg
        width="100%"
        height="100%"
        style={{ position: "absolute", inset: 0, opacity: 0.08 }}
      >
        <defs>
          <pattern
            id="gm-col-tile"
            x={0}
            y={0}
            width={120}
            height={80}
            patternUnits="userSpaceOnUse"
          >
            <g transform="translate(12 12)">
              {GM_LOGO_PATHS.map((d, i) => (
                <path key={i} d={d} fill={BLACK} />
              ))}
            </g>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#gm-col-tile)" />
      </svg>

      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 26,
          opacity: markEntry,
          transform: `scale(${0.92 + 0.08 * markEntry})`,
        }}
      >
        <div
          style={{
            width: 140,
            height: 140,
            borderRadius: 28,
            background: BLACK,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width={100} height={100} viewBox="0 0 102 102">
            {GM_LOGO_PATHS.map((d, i) => (
              <path key={i} d={d} fill={WHITE} />
            ))}
          </svg>
        </div>
        <div
          style={{
            fontFamily: INTER,
            fontWeight: 900,
            fontSize: 44,
            letterSpacing: "-0.02em",
            color: BLACK,
            lineHeight: 0.95,
            textAlign: "center",
          }}
        >
          GENERAL
          <br />
          MARKET
        </div>
      </div>
    </div>
  );
};

// Source cards — what the cards look like before they hit the column.
// Specific, identifiable, dark-plated. The pool mirrors the Point 1
// vortex narrative so the stream reads as "the feed from before,
// continued".
const SOURCE_NAMES: readonly string[] = [
  "TWITCH",
  "ELECTIONS",
  "WEATHER",
  "TRAINS",
  "NFL",
  "BTC",
  "GOLD",
  "OPEC",
];

const SourceCard: React.FC<{ name: string; w: number; h: number }> = ({
  name,
  w,
  h,
}) => (
  <div
    style={{
      width: w,
      height: h,
      background: "#1a1a1c",
      borderRadius: 16,
      border: `1px solid rgba(255,255,255,0.12)`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "0 14px",
      color: WHITE,
      fontFamily: INTER,
      fontWeight: 900,
      fontSize: 22,
      letterSpacing: "0.12em",
      textAlign: "center",
      textTransform: "uppercase",
      boxShadow: "0 14px 40px rgba(0,0,0,0.5)",
    }}
  >
    {name}
  </div>
);

const BlockCard: React.FC<{ hash: string; w: number; h: number }> = ({
  hash,
  w,
  h,
}) => (
  <div
    style={{
      width: w,
      height: h,
      background: WHITE,
      borderRadius: 16,
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      alignItems: "flex-start",
      padding: "14px 16px",
      boxShadow: "0 14px 40px rgba(0,0,0,0.55)",
    }}
  >
    <span
      style={{
        color: BLACK,
        fontFamily: INTER,
        fontWeight: 800,
        fontSize: 12,
        letterSpacing: "0.28em",
        textTransform: "uppercase",
      }}
    >
      Block
    </span>
    <span
      style={{
        color: BLACK,
        fontFamily: MONO_FAMILY,
        fontSize: 14,
        letterSpacing: "0.04em",
      }}
    >
      {hash}
    </span>
  </div>
);

const OutsideWatcher: React.FC<{
  label: string;
  index: number;
  local: number;
}> = ({ label, index, local }) => {
  const entryStart = 22 + index * 2.5;
  const entry = interpolate(local, [entryStart, entryStart + 16], [0, 1], {
    ...clamp,
    easing: ease3,
  });
  const lift = (1 - entry) * 32;

  return (
    <div
      style={{
        width: 260,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        opacity: entry,
        transform: `translateY(${lift}px)`,
      }}
    >
      <WatcherSilhouette scale={1.3} />

      <div
        style={{
          marginTop: 14,
          fontFamily: INTER,
          fontWeight: 800,
          fontSize: 30,
          letterSpacing: "0.12em",
          color: WHITE,
          textAlign: "center",
          textTransform: "uppercase",
          lineHeight: 1.05,
        }}
      >
        {label}
      </div>
    </div>
  );
};

// ── Scene — carousel of passing blocks + outside watchers ───────────────

const Point2Scene: React.FC<{
  local: number;
  sceneStart: number;
  duration: number;
}> = ({ local, sceneStart, duration }) => {
  const SCENE_FPS = 30;
  const STAGE_W = 1920;

  const time = local / SCENE_FPS;
  const fadeOut = interpolate(local, [duration - 18, duration], [1, 0], clamp);

  // ── Layout ────────────────────────────────────────────────────────────
  const COL_LEFT = 60;
  const COL_WIDTH = 260;
  const COL_TOP = 100;
  const COL_HEIGHT = 620;
  const COL_RIGHT = COL_LEFT + COL_WIDTH;

  const TRACK_Y = 460; // vertical centre of the card stream
  const WATCHERS_TOP_PX = 780;

  // ── Card stream ───────────────────────────────────────────────────────
  // Cards start off-screen left, fly right across the stage, and pass
  // through the column. Before the column → source-branded card. After
  // the column → anonymised block. Inside the column → hidden behind
  // the opaque GM tower, so the switch happens under cover.
  const CARD_W = 150;
  const CARD_H = 190;
  const CARD_SPEED = 1100; // px / s
  const CARD_INTERVAL = 0.32; // s between spawns
  const CARD_LEAD = 420; // start x before screen

  const activeCards: {
    i: number;
    x: number;
    source: string;
    hash: string;
  }[] = [];
  for (let i = 0; i < 40; i++) {
    const spawnT = i * CARD_INTERVAL;
    if (time < spawnT) continue;
    const age = time - spawnT;
    const x = -CARD_LEAD + age * CARD_SPEED;
    if (x > STAGE_W + 80) continue;
    activeCards.push({
      i,
      x,
      source: SOURCE_NAMES[i % SOURCE_NAMES.length],
      hash: PASSING_BLOCKS[i % PASSING_BLOCKS.length].hash,
    });
  }

  return (
    <AbsoluteFill style={{ opacity: fadeOut, background: BLACK }}>
      {/* Card stream — under the column (z defaults to 0). Before the
          column the card is its Source identity; past the column's
          centre it is a Block. While inside the column it's covered. */}
      {activeCards.map((c) => {
        const cardCenter = c.x + CARD_W / 2;
        const columnCenter = COL_LEFT + COL_WIDTH / 2;
        const isBlock = cardCenter > columnCenter;
        return (
          <div
            key={c.i}
            style={{
              position: "absolute",
              left: c.x,
              top: TRACK_Y - CARD_H / 2,
              width: CARD_W,
              height: CARD_H,
            }}
          >
            {isBlock ? (
              <BlockCard hash={c.hash} w={CARD_W} h={CARD_H} />
            ) : (
              <SourceCard name={c.source} w={CARD_W} h={CARD_H} />
            )}
          </div>
        );
      })}

      {/* GM column — the filter. Sits on the left, opaque, so cards
          entering are hidden and the transformation reads as "passed
          through". */}
      <GmColumn
        left={COL_LEFT}
        top={COL_TOP}
        width={COL_WIDTH}
        height={COL_HEIGHT}
        local={local}
      />

      {/* Title — middle band, right of the GM column. */}
      <div
        style={{
          position: "absolute",
          left: COL_RIGHT + 80,
          right: 80,
          top: 160,
          height: 260,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Reveal
          from={sceneStart + 2}
          duration={duration - 2}
          text="100% privacy until settlement"
          revealDuration={34}
          seed={59}
          solid
          style={{
            fontSize: 104,
            fontWeight: 900,
            letterSpacing: "-0.03em",
            textAlign: "center",
            maxWidth: STAGE_W - COL_RIGHT - 160,
            lineHeight: 1.02,
          }}
        />
      </div>

      {/* Watchers — bottom band, readable labels (2× the old size). */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: WATCHERS_TOP_PX,
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-start",
          gap: 12,
          padding: "0 40px",
        }}
      >
        {OUTSIDE_WATCHERS.map((role, i) => (
          <OutsideWatcher key={role} label={role} index={i} local={local} />
        ))}
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene 5: POINT 3 — cluster trading vs single trades ─────────────────
//
// Dual-panel split. Same upward flow on both sides, fast rise. LEFT:
// 100 single points per second — the old world, literal throughput.
// RIGHT: 10 clusters per second, each cluster a packed grid of 10,000
// points rising as one body — 100,000 trades/s. The eye counts twice
// and gives up.

const P3_RISE_BOTTOM = 1020;
const P3_RISE_TOP = 380;
const P3_RISE_DURATION = 28;

// Deterministic jitter — a seeded unit-interval hash so the particle
// x-positions look random but stay stable across frames.
const p3Hash = (i: number, seed: number): number => {
  const h = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453;
  return h - Math.floor(h);
};

const p3Rise = (age: number) => {
  const progress = Math.min(1, Math.max(0, age / P3_RISE_DURATION));
  const y = P3_RISE_BOTTOM + (P3_RISE_TOP - P3_RISE_BOTTOM) * progress;
  const fadeIn = Math.min(1, progress / 0.08);
  const fadeOut = progress > 0.88 ? 1 - (progress - 0.88) / 0.12 : 1;
  const opacity = Math.max(0, Math.min(fadeIn, fadeOut));
  return { y, opacity, alive: progress < 1 };
};

const Point3Scene: React.FC<{
  local: number;
  sceneStart: number;
  duration: number;
}> = ({ local, sceneStart, duration }) => {
  const fadeOut = interpolate(local, [duration - 18, duration], [1, 0], clamp);

  // Divider — hairline between the two panels, draws from centre
  const dividerProgress = interpolate(local, [6, 34], [0, 1], {
    ...clamp,
    easing: ease3,
  });

  // LEFT cadence — 100 points per second, literal. At 30fps that's
  // 10 new points every 3 frames; the spawnFrame spacing is fractional
  // so points don't line up in rigid rows.
  const LEFT_SPAWN_START = 14;
  const LEFT_PARTICLES_PER_FRAME = 100 / 30; // ≈ 3.333
  const LEFT_SPAWN_DT = 1 / LEFT_PARTICLES_PER_FRAME; // ≈ 0.3 frames
  const leftCount = Math.max(
    0,
    Math.floor((local - LEFT_SPAWN_START) * LEFT_PARTICLES_PER_FRAME),
  );

  // RIGHT cadence — one 10,000-trade cluster every 3 frames (= 10/s).
  // 10 × 10,000 = 100,000 trades per second. Starts slightly later so
  // the left is legible before the right lands on top of it.
  const RIGHT_SPAWN_START = 18;
  const RIGHT_SPAWN_INTERVAL = 3;
  const rightCount = Math.max(
    0,
    Math.floor((local - RIGHT_SPAWN_START) / RIGHT_SPAWN_INTERVAL) + 1,
  );

  return (
    <AbsoluteFill style={{ opacity: fadeOut, background: BLACK }}>
      {/* Divider — drops from centre outward */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 1,
          height: `${dividerProgress * 86}%`,
          transform: "translate(-50%, -50%)",
          background: WHITE,
          opacity: 0.18,
        }}
      />

      {/* LEFT PANEL — single points */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: "50%",
          overflow: "hidden",
        }}
      >
        {/* Title */}
        <div
          style={{
            position: "absolute",
            top: 96,
            left: 0,
            right: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 14,
            zIndex: 5,
          }}
        >
          <Reveal
            from={sceneStart + 8}
            duration={duration - 8}
            text="100 trades / s"
            revealDuration={26}
            seed={79}
            solid
            style={{
              fontSize: 56,
              fontWeight: 900,
              letterSpacing: "-0.02em",
              textAlign: "center",
              lineHeight: 1,
            }}
          />
          <div
            style={{
              fontFamily: INTER,
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: "0.26em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.55)",
            }}
          >
            single trades
          </div>
        </div>

        {/* Rising single points — 100 per second, 28-frame rise. */}
        {Array.from({ length: leftCount }).map((_, i) => {
          const spawnFrame = LEFT_SPAWN_START + i * LEFT_SPAWN_DT;
          const age = local - spawnFrame;
          if (age < 0) return null;
          const { y, opacity, alive } = p3Rise(age);
          if (!alive) return null;
          const jitter = (p3Hash(i, 1) - 0.5) * 340;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: `calc(50% + ${jitter}px)`,
                top: y,
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: WHITE,
                opacity,
                transform: "translate(-50%, -50%)",
              }}
            />
          );
        })}
      </div>

      {/* RIGHT PANEL — cluster trading */}
      <div
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: "50%",
          overflow: "hidden",
        }}
      >
        {/* Title */}
        <div
          style={{
            position: "absolute",
            top: 72,
            left: 0,
            right: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 14,
            zIndex: 5,
          }}
        >
          {/* GM sigil — rises + fades in a beat before the wordmark */}
          <div
            style={{
              width: 76,
              height: 76,
              opacity: interpolate(local, [0, 20], [0, 1], clamp),
              transform: `translateY(${interpolate(local, [0, 24], [18, 0], {
                ...clamp,
                easing: ease3,
              })}px)`,
            }}
          >
            <svg viewBox="0 0 102 102" width="76" height="76">
              {GM_LOGO_PATHS.map((d, i) => (
                <path key={i} d={d} fill={WHITE} />
              ))}
            </svg>
          </div>
          <Reveal
            from={sceneStart + 4}
            duration={duration - 4}
            text="Cluster Trading"
            revealDuration={30}
            seed={83}
            solid
            style={{
              fontSize: 72,
              fontWeight: 900,
              letterSpacing: "-0.03em",
              textAlign: "center",
              lineHeight: 1,
            }}
          />
          <Reveal
            from={sceneStart + 22}
            duration={duration - 22}
            text="100,000 trades / s"
            revealDuration={24}
            seed={97}
            solid
            style={{
              fontSize: 34,
              fontWeight: 600,
              letterSpacing: "-0.01em",
              textAlign: "center",
              lineHeight: 1,
              opacity: 0.78,
            }}
          />
        </div>

        {/* Rising clusters — each block is a 100 × 100 grid = 10,000 points
            at 3px cells so the texture actually reads on screen. A faint
            tint + 1px border keep the block legible even when the gradient
            gets sub-pixel-crushed. */}
        {Array.from({ length: rightCount }).map((_, i) => {
          const spawnFrame = RIGHT_SPAWN_START + i * RIGHT_SPAWN_INTERVAL;
          const age = local - spawnFrame;
          if (age < 0) return null;
          const { y, opacity, alive } = p3Rise(age);
          if (!alive) return null;
          const jitter = (p3Hash(i, 7) - 0.5) * 120;
          // 100 × 100 = 10,000 points. 3px cell → 300 × 300 block.
          const CELL = 3;
          const COLS = 100;
          const ROWS = 100;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: `calc(50% + ${jitter}px)`,
                top: y,
                width: CELL * COLS,
                height: CELL * ROWS,
                opacity,
                transform: "translate(-50%, -50%)",
                background: "rgba(255,255,255,0.05)",
                backgroundImage:
                  "radial-gradient(circle, #ffffff 48%, transparent 49%)",
                backgroundSize: `${CELL}px ${CELL}px`,
                backgroundPosition: "0 0",
                border: "1px solid rgba(255,255,255,0.18)",
                borderRadius: 4,
              }}
            />
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene 6: STAT — 90% ─────────────────────────────────────────────────

const StatScene: React.FC<{
  local: number;
  sceneStart: number;
  duration: number;
}> = ({ local, sceneStart, duration }) => {
  const circleR = interpolate(local, [0, 60], [0, 400], {
    ...clamp,
    easing: ease3,
  });
  const fadeOut = interpolate(local, [duration - 20, duration], [1, 0], clamp);

  return (
    <AbsoluteFill style={{ opacity: fadeOut }}>
      {/* SHAPES */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: circleR * 2,
            height: circleR * 2,
            borderRadius: "50%",
            background: WHITE,
          }}
        />
      </AbsoluteFill>

      {/* TEXT */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Reveal
          from={sceneStart + 22}
          duration={duration - 22}
          text="70%"
          revealDuration={22}
          seed={109}
          style={{
            fontSize: 340,
            fontWeight: 900,
            letterSpacing: "-0.04em",
            textAlign: "center",
          }}
        />
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-end",
          paddingBottom: 150,
          gap: 16,
        }}
      >
        <Reveal
          from={sceneStart + 48}
          duration={duration - 48}
          text="Reducing insider loss up to 70%"
          revealDuration={36}
          seed={127}
          style={{
            fontSize: 38,
            fontWeight: 600,
            letterSpacing: "-0.01em",
            textAlign: "center",
            maxWidth: 1300,
          }}
        />
        <Reveal
          from={sceneStart + 70}
          duration={duration - 70}
          text="* modelled on replayed insider events across five exchanges"
          revealDuration={32}
          seed={131}
          style={{
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            opacity: 0.65,
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// The closing background is the IndexMarket lockup itself — a bounded
// square on a dark ground. Inside the square, the black field is
// replaced by a grid of source logos; the seven white stripes stay
// white. The square dezooms from filling the frame down to its final
// 620 px size; the grid lives inside the square, so the tiles pull
// back in lockstep with the shape.
const CLOSING_GRID_COLS = 12;
const CLOSING_GRID_ROWS = 12;
// Final form — icon size + wordmark width used for the "General Market"
// lockup that snaps into place at the end of the closing. Tuned so the
// row feels balanced on a 1920-wide stage.
const CLOSING_ICON_FINAL = 340;
const CLOSING_WORDMARK_W = 820;
const CLOSING_WORDMARK_FONT = 176;
const CLOSING_LOCKUP_GAP = 36;

const ClosingLogoGrid: React.FC<{ local: number }> = ({ local }) => {
  // Phase 1 — dezoom: fills the frame then retracts to hero size.
  // Phase 2 — lockup form: icon shrinks to its final size and the
  //   wordmark grows in from zero width. Because both live in a
  //   flex row centered on the frame, the icon slides left of its
  //   own accord as the wordmark takes width.
  const iconSize = interpolate(
    local,
    [0, 90, 108, 128],
    [3200, 620, 620, CLOSING_ICON_FINAL],
    { ...clamp, easing: ease3 },
  );
  const wordmarkWidth = interpolate(
    local,
    [108, 132],
    [0, CLOSING_WORDMARK_W],
    { ...clamp, easing: ease3 },
  );
  const wordmarkOpacity = interpolate(local, [116, 136], [0, 1], clamp);
  const wordmarkRise = interpolate(local, [116, 136], [18, 0], {
    ...clamp,
    easing: ease3,
  });

  const count = CLOSING_GRID_COLS * CLOSING_GRID_ROWS;

  return (
    <AbsoluteFill
      style={{
        background: BLACK,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: CLOSING_LOCKUP_GAP,
        }}
      >
        {/* Icon — the whole lockup treated as one atom: grid fills the
            black field, white stripes sit on top, both shrink together
            so they read as a single logo, not a grid behind a bar. */}
        <div
          style={{
            position: "relative",
            width: iconSize,
            height: iconSize,
            flex: "none",
            overflow: "hidden",
            background: BLACK,
            boxShadow:
              "0 0 0 1px rgba(255,255,255,0.04), 0 24px 80px rgba(0,0,0,0.55)",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              gridTemplateColumns: `repeat(${CLOSING_GRID_COLS}, 1fr)`,
              gridTemplateRows: `repeat(${CLOSING_GRID_ROWS}, 1fr)`,
              gap: 2,
              padding: 2,
              filter: "saturate(0.92) brightness(0.95)",
            }}
          >
            {Array.from({ length: count }).map((_, i) => {
              const source = SOURCES[i % SOURCES.length];
              const logoSrc = source.logo.startsWith("/")
                ? source.logo.slice(1)
                : source.logo;
              return (
                <div
                  key={i}
                  style={{
                    background: source.bg,
                    borderRadius: 3,
                    overflow: "hidden",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    padding: 4,
                  }}
                >
                  <Img
                    src={staticFile(logoSrc)}
                    style={{
                      maxWidth: "82%",
                      maxHeight: "82%",
                      objectFit: "contain",
                    }}
                  />
                </div>
              );
            })}
          </div>

          <svg
            width="100%"
            height="100%"
            viewBox="0 0 102 102"
            preserveAspectRatio="none"
            style={{ position: "absolute", inset: 0 }}
          >
            {GM_LOGO_PATHS.map((d, i) => (
              <path key={i} d={d} fill="#ffffff" />
            ))}
          </svg>
        </div>

        {/* Wordmark — width animates from 0 so the flex row pushes the
            icon left as "General Market" fills in on the right. */}
        <div
          style={{
            width: wordmarkWidth,
            overflow: "hidden",
            flex: "none",
            opacity: wordmarkOpacity,
            transform: `translateY(${wordmarkRise}px)`,
          }}
        >
          <div
            style={{
              fontFamily: INTER,
              fontSize: CLOSING_WORDMARK_FONT,
              fontWeight: 900,
              letterSpacing: "-0.035em",
              lineHeight: 0.95,
              color: WHITE,
              whiteSpace: "nowrap",
            }}
          >
            General Market
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene 7: CLOSING ────────────────────────────────────────────────────

const ClosingScene: React.FC<{
  local: number;
  sceneStart: number;
  duration: number;
}> = ({ local, sceneStart, duration }) => {
  const sweep = interpolate(local, [0, 40], [0, 1], {
    ...clamp,
    easing: ease3,
  });
  // Sweep keeps its original 70→108 shrink window, independent of scene
  // length — the extra frames at the tail are reserved for the lockup
  // reveal, not more sweep motion.
  const shrink = interpolate(local, [70, 108], [1, 0.3], clamp);
  const firstOut = interpolate(local, [58, 74], [1, 0], clamp);
  // Second statement holds until the lockup starts forming, then steps
  // aside so the wordmark reveal owns the frame.
  const secondOut = interpolate(local, [104, 118], [1, 0], clamp);
  const fadeOut = interpolate(local, [duration - 18, duration], [1, 0], clamp);

  return (
    <AbsoluteFill style={{ opacity: fadeOut }}>
      {/* BACKGROUND — inverted grid/logo dezoom */}
      <ClosingLogoGrid local={local} />

      {/* SHAPE */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 1920 * sweep * shrink,
            height: 360 * shrink,
            background: WHITE,
            borderRadius: 4 + (1 - shrink) * 60,
          }}
        />
      </AbsoluteFill>

      {/* FIRST STATEMENT */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: firstOut,
        }}
      >
        <Reveal
          from={sceneStart + 10}
          duration={64}
          text="Not just insider protection"
          revealDuration={40}
          seed={137}
          style={{
            fontSize: 96,
            fontWeight: 900,
            letterSpacing: "-0.03em",
            textAlign: "center",
            maxWidth: 1600,
          }}
        />
      </AbsoluteFill>

      {/* SECOND STATEMENT */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: secondOut,
        }}
      >
        <Reveal
          from={sceneStart + 64}
          duration={54}
          text="A new trading standard"
          revealDuration={38}
          seed={149}
          style={{
            fontSize: 120,
            fontWeight: 900,
            letterSpacing: "-0.04em",
            textAlign: "center",
            maxWidth: 1600,
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─── Pitch wrapper ───────────────────────────────────────────────────────

export const InsiderPitch: React.FC<{ startFrame: number }> = ({
  startFrame,
}) => {
  const frame = useCurrentFrame();
  const local = frame - startFrame;

  if (local < 0 || local > PITCH_DURATION) return null;

  type SceneKey = keyof typeof PITCH_SCENES;
  const activeKey: SceneKey = (() => {
    if (local < PITCH_SCENES.intro.end) return "intro";
    if (local < PITCH_SCENES.stat.end) return "stat";
    if (local < PITCH_SCENES.point1.end) return "point1";
    if (local < PITCH_SCENES.point2.end) return "point2";
    if (local < PITCH_SCENES.point3.end) return "point3";
    return "closing";
  })();

  const scene = PITCH_SCENES[activeKey];
  const sceneLocal = local - scene.start;
  const sceneStartAbs = startFrame + scene.start;
  const sceneDuration = scene.end - scene.start;

  return (
    <AbsoluteFill style={{ background: BLACK, isolation: "isolate" }}>
      {activeKey === "intro" ? (
        <IntroScene
          local={sceneLocal}
          sceneStart={sceneStartAbs}
          duration={sceneDuration}
        />
      ) : null}
      {activeKey === "point1" ? (
        <Point1Scene
          local={sceneLocal}
          sceneStart={sceneStartAbs}
          duration={sceneDuration}
        />
      ) : null}
      {activeKey === "point2" ? (
        <Point2Scene
          local={sceneLocal}
          sceneStart={sceneStartAbs}
          duration={sceneDuration}
        />
      ) : null}
      {activeKey === "point3" ? (
        <Point3Scene
          local={sceneLocal}
          sceneStart={sceneStartAbs}
          duration={sceneDuration}
        />
      ) : null}
      {activeKey === "stat" ? (
        <StatScene
          local={sceneLocal}
          sceneStart={sceneStartAbs}
          duration={sceneDuration}
        />
      ) : null}
      {activeKey === "closing" ? (
        <ClosingScene
          local={sceneLocal}
          sceneStart={sceneStartAbs}
          duration={sceneDuration}
        />
      ) : null}
    </AbsoluteFill>
  );
};
