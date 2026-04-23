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
import { PhoneWithCard } from "./PhoneWithCard";

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
  intro: { start: 0, end: 66 },
  stat: { start: 66, end: 190 },
  point1: { start: 190, end: 310 },
  point2: { start: 310, end: 410 },
  point3: { start: 410, end: 510 },
  closing: { start: 510, end: 658 },
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
  const logoScale = interpolate(local, [3, 30], [0.4, 1], {
    ...clamp,
    easing: ease3,
  });
  const logoOpacity = interpolate(local, [3, 30], [0, 1], clamp);
  const fadeOut = interpolate(local, [duration - 10, duration], [1, 0], clamp);

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
            from={sceneStart + 3}
            duration={duration - 3}
            text="General Market"
            revealDuration={22}
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
          from={sceneStart + 30}
          duration={duration - 30}
          text="fights back"
          revealDuration={18}
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

const POINT1_CENTER_SEQUENCE = ["twitch", "db_trains", "tmdb"] as const;

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

  // Split the scene into equal thirds and pick the center card accordingly.
  const phase = Math.min(
    POINT1_CENTER_SEQUENCE.length - 1,
    Math.max(
      0,
      Math.floor((local / duration) * POINT1_CENTER_SEQUENCE.length),
    ),
  );
  const centerSourceId = POINT1_CENTER_SEQUENCE[phase];

  return (
    <AbsoluteFill style={{ opacity: fadeOut, background: "#000000" }}>
      {/* VORTEX — background cylinder without a center plane; the 3D
          phone below owns the middle. */}
      <AbsoluteFill style={{ opacity: vortexIn }}>
        <SourceVortexGallery centerSourceId={centerSourceId} hideCenter />
      </AbsoluteFill>

      {/* The phone now lives at the InsiderPitch wrapper level so it
          persists across the stat → point1 cut. See SharedPhoneLayer. */}

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

const MONO_FAMILY =
  'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace';

// ── GradientCarousel geometry (verbatim from WebGLPicks, direction flipped)
//    Cards loop through a track. scrollOffset is ADDED (not subtracted) so
//    motion is left-to-right: sources enter from the left, pass through
//    the GM column, emerge on the right as blocks.
const GC_CARD_W = 280;
const GC_CARD_H = 380;
const GC_GAP = 44;
const GC_UNIT = GC_CARD_W + GC_GAP;
const GC_BORDER_RADIUS = 18;

const GC_PERSPECTIVE = 1800;
const GC_MAX_ROTATION = 28;
const GC_MAX_DEPTH = 140;
const GC_SCALE_BASE = 0.92;
const GC_SCALE_RANGE = 0.1;
const GC_SCROLL_SPEED = 460; // px / s — slow enough to read each card clearly

const gcMod = (n: number, m: number) => ((n % m) + m) % m;
const gcClamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

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

// Source cards — pull the real FeaturedCard from SourceCardsWall so the
// stream visibly continues from Point 1. Each card is wrapped in a
// fixed-size frame with soft shadow, matching the block cards' footprint.
const SourceCardFrame: React.FC<{
  source: (typeof FEATURED_SOURCES)[number];
  w: number;
  h: number;
}> = ({ source, w, h }) => (
  <div
    style={{
      width: w,
      height: h,
      borderRadius: 18,
      overflow: "hidden",
      boxShadow: "0 18px 50px rgba(0,0,0,0.55)",
    }}
  >
    <FeaturedCard source={source} />
  </div>
);

// GM-as-padlock — the seven stripes of the GM logo become the face of a
// lock body, with a shackle arched above. Stamped onto every BlockCard so
// the emerging block reads as the locked form of the source card that
// entered the GM column.
const GmLockMark: React.FC<{ size?: number }> = ({ size = 170 }) => (
  <svg
    width={size}
    height={size * 1.25}
    viewBox="0 0 120 150"
    fill="none"
  >
    <path
      d="M35 56 V32 a25 22 0 0 1 50 0 V56"
      stroke={BLACK}
      strokeWidth={11}
      strokeLinecap="round"
      fill="none"
    />
    <rect x={10} y={52} width={100} height={90} rx={14} fill={BLACK} />
    <g transform="translate(9 44)">
      {GM_LOGO_PATHS.map((d, i) => (
        <path key={i} d={d} fill={WHITE} />
      ))}
    </g>
  </svg>
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
      borderRadius: 18,
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      alignItems: "stretch",
      padding: "20px 22px",
      boxShadow: "0 18px 50px rgba(0,0,0,0.55)",
    }}
  >
    <span
      style={{
        color: BLACK,
        fontFamily: INTER,
        fontWeight: 800,
        fontSize: 14,
        letterSpacing: "0.28em",
        textTransform: "uppercase",
      }}
    >
      Block
    </span>
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        marginTop: 6,
        marginBottom: 6,
      }}
    >
      <GmLockMark size={170} />
    </div>
    <span
      style={{
        color: BLACK,
        fontFamily: MONO_FAMILY,
        fontSize: 18,
        letterSpacing: "0.04em",
      }}
    >
      {hash}
    </span>
  </div>
);

// ── Scene — carousel of passing blocks + rotating consequences ─────────

// Stream pool — each entry pairs a real Point-1 source with a block hash,
// so the same card that entered as "Twitch" emerges as "0x7f3a••1e92".
const STREAM_CARDS = Array.from(
  {
    length: Math.max(FEATURED_SOURCES.length, PASSING_BLOCKS.length),
  },
  (_, i) => ({
    source: FEATURED_SOURCES[i % FEATURED_SOURCES.length],
    hash: PASSING_BLOCKS[i % PASSING_BLOCKS.length].hash,
  }),
);
const GC_TRACK_LEN = GC_UNIT * STREAM_CARDS.length;

// Rotating privacy consequences — one appears, holds, leaves, the next
// takes its place. Scene duration is 100 frames; each message owns a
// third of the run.
const PRIVACY_CONSEQUENCES: readonly string[] = [
  "No copy trading",
  "No front runner",
  "No market manipulation",
];

const MESSAGE_WINDOWS: readonly { start: number; end: number }[] = [
  { start: 18, end: 50 },
  { start: 50, end: 76 },
  { start: 76, end: 100 },
];

const Point2Scene: React.FC<{
  local: number;
  sceneStart: number;
  duration: number;
}> = ({ local, sceneStart, duration }) => {
  const SCENE_FPS = 30;
  const STAGE_W = 1920;
  const halfW = STAGE_W / 2;

  const time = local / SCENE_FPS;
  const fadeOut = interpolate(local, [duration - 18, duration], [1, 0], clamp);

  // ── Layout — three bands, no overlap ────────────────────────────────
  //   title  (top, headline)
  //   carousel + GM column  (middle)
  //   rotating consequence  (bottom)
  const TITLE_TOP = 70;
  const TITLE_H = 180;
  const TRACK_Y = 510;
  const COL_LEFT = 80;
  const COL_WIDTH = 300;
  const COL_TOP = 310;
  const COL_HEIGHT = 400;
  const COL_CENTER_X = COL_LEFT + COL_WIDTH / 2;
  const MESSAGE_Y = 820;

  // ── 3D coverflow — GradientCarousel math, direction flipped ────────
  const scrollOffset = time * GC_SCROLL_SPEED;

  const cards = STREAM_CARDS.map((card, i) => {
    const rawX =
      gcMod(i * GC_UNIT + scrollOffset + GC_TRACK_LEN / 2, GC_TRACK_LEN) -
      GC_TRACK_LEN / 2;
    const screenX = rawX + halfW - GC_CARD_W / 2;
    const screenCenterX = screenX + GC_CARD_W / 2;

    const norm = gcClamp(rawX / halfW, -1, 1);
    const absNorm = Math.abs(norm);

    const rotateY = -norm * GC_MAX_ROTATION;
    const translateZ = (1 - absNorm) * GC_MAX_DEPTH;
    const scale = GC_SCALE_BASE + (1 - absNorm) * GC_SCALE_RANGE;
    const blur = absNorm < 0.15 ? 0 : 2 * Math.pow(absNorm, 1.1);
    const opacity = interpolate(absNorm, [0, 0.85, 1], [1, 0.72, 0], {
      ...clamp,
    });
    const zIndex = Math.round((1 - absNorm) * 100);
    const isBlock = screenCenterX > COL_CENTER_X;

    return {
      card,
      index: i,
      screenX,
      rotateY,
      translateZ,
      scale,
      blur,
      opacity,
      zIndex,
      isBlock,
    };
  });

  return (
    <AbsoluteFill style={{ opacity: fadeOut, background: BLACK }}>
      {/* Title — full-width banner at the top. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: TITLE_TOP,
          height: TITLE_H,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 450,
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
            fontSize: 108,
            fontWeight: 900,
            letterSpacing: "-0.03em",
            textAlign: "center",
            maxWidth: 1700,
            lineHeight: 1,
          }}
        />
      </div>

      {/* 3D coverflow stage — WebGLPicks GradientCarousel perspective. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          perspective: GC_PERSPECTIVE,
          transformStyle: "preserve-3d",
        }}
      >
        {cards.map((c) => (
          <div
            key={c.index}
            style={{
              position: "absolute",
              left: c.screenX,
              top: TRACK_Y,
              width: GC_CARD_W,
              height: GC_CARD_H,
              transformOrigin: "50% center",
              transform: [
                "translateY(-50%)",
                `translateZ(${c.translateZ}px)`,
                `rotateY(${c.rotateY}deg)`,
                `scale(${c.scale})`,
              ].join(" "),
              borderRadius: GC_BORDER_RADIUS,
              overflow: "hidden",
              filter: c.blur > 0.1 ? `blur(${c.blur}px)` : undefined,
              opacity: c.opacity,
              zIndex: c.zIndex,
            }}
          >
            {c.isBlock ? (
              <BlockCard hash={c.card.hash} w={GC_CARD_W} h={GC_CARD_H} />
            ) : (
              <SourceCardFrame
                source={c.card.source}
                w={GC_CARD_W}
                h={GC_CARD_H}
              />
            )}
          </div>
        ))}
      </div>

      {/* GM column — opaque filter. Hides the card identity swap. */}
      <GmColumn
        left={COL_LEFT}
        top={COL_TOP}
        width={COL_WIDTH}
        height={COL_HEIGHT}
        local={local}
      />

      {/* Rotating consequence — single line at the bottom, appears and
          leaves before the next one shows. */}
      {PRIVACY_CONSEQUENCES.map((msg, i) => {
        const { start, end } = MESSAGE_WINDOWS[i];
        const isLast = i === PRIVACY_CONSEQUENCES.length - 1;
        const op = interpolate(
          local,
          isLast ? [start, start + 8] : [start, start + 8, end - 8, end],
          isLast ? [0, 1] : [0, 1, 1, 0],
          clamp,
        );
        if (op <= 0) return null;
        const rise = interpolate(
          local,
          [start, start + 12],
          [28, 0],
          { ...clamp, easing: ease3 },
        );
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: MESSAGE_Y,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              opacity: op,
              transform: `translateY(${rise}px)`,
              zIndex: 460,
            }}
          >
            <span
              style={{
                fontFamily: INTER,
                fontWeight: 900,
                fontSize: 84,
                letterSpacing: "-0.03em",
                color: WHITE,
                textAlign: "center",
                lineHeight: 1,
              }}
            >
              {msg}
            </span>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ─── Scene 5: POINT 3 — cluster trading vs single trades ─────────────────
//
// Dual-panel split. Opens with a curtain that covers the Point2 → Point3
// handover, then recedes into a hairline divider. Both panels stream the
// same upward motion at the same speed. LEFT: jittered single dots, one
// per literal trade, 100/s. RIGHT: a structured grid of dots — full rows
// of points stacked into a continuous sheet, flowing upward as a single
// organism. A gradient mask hides the bottom of both panels so the spawn
// zone never shows; the stream only appears as it reaches the top.

const p3Hash = (i: number, seed: number): number => {
  const h = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453;
  return h - Math.floor(h);
};


const Point3Scene: React.FC<{
  local: number;
  sceneStart: number;
  duration: number;
}> = ({ local, sceneStart, duration }) => {
  const fadeOut = interpolate(local, [duration - 18, duration], [1, 0], clamp);

  // Opening curtain → divider. One element, three acts: bloom, hold,
  // recede. The bright phase covers the Point2 → Point3 handover; the
  // recession settles into the hairline divider for the rest of the scene.
  const curtainHeight = interpolate(local, [0, 12], [0, 1], {
    ...clamp,
    easing: ease3,
  });
  const curtainOpacity = interpolate(
    local,
    [0, 10, 22, 30],
    [0, 1, 0.9, 0.18],
    clamp,
  );
  const curtainThickness = interpolate(
    local,
    [0, 10, 26],
    [0, 4, 1],
    clamp,
  );

  // Panel title intro — each title stack slides inward from its edge.
  const panelIntro = interpolate(local, [10, 28], [0, 1], {
    ...clamp,
    easing: ease3,
  });
  const leftTitleX = (1 - panelIntro) * -36;
  const rightTitleX = (1 - panelIntro) * 36;

  // Stream opacity — the flow fades in as the curtain recedes, so the
  // dots never pop. Pre-seeded below, so by the time the panels are
  // visible they already contain a full, mid-flight stream.
  const flowOpacity = interpolate(local, [22, 44], [0, 1], clamp);

  // Rise speed shared by both panels. Aggressive — the right grid has
  // to feel like 100,000 trades/s, not 100. The left single-dot stream
  // rides the same velocity so the scales remain comparable.
  const RISE_SPEED = 80;

  // LEFT cadence — 100 dots per second, pre-seeded 60 frames before frame 0
  // so the stream is mid-flight the instant the curtain opens (the faster
  // rise burns through dots quickly, needs more pre-seed).
  const LEFT_SPAWN_START = -60;
  const LEFT_PARTICLES_PER_FRAME = 100 / 30;
  const LEFT_SPAWN_DT = 1 / LEFT_PARTICLES_PER_FRAME;
  const leftCount = Math.max(
    0,
    Math.floor((local - LEFT_SPAWN_START) * LEFT_PARTICLES_PER_FRAME),
  );

  // Mask — reveals a narrow strip just below the title and hides the
  // bottom of the panel entirely. The spawn zone never shows; only the
  // dots "reaching the top" are on screen.
  const STREAM_MASK =
    "linear-gradient(to bottom, transparent 0%, transparent 28%, black 34%, black 62%, transparent 74%)";

  return (
    <AbsoluteFill style={{ opacity: fadeOut, background: BLACK }}>
      {/* Curtain → divider. One element. */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: curtainThickness,
          height: `${curtainHeight * 100}%`,
          transform: "translate(-50%, -50%)",
          background: WHITE,
          opacity: curtainOpacity,
        }}
      />

      {/* LEFT PANEL — single trades */}
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
        <div
          style={{
            position: "absolute",
            top: 160,
            left: 0,
            right: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
            zIndex: 5,
            opacity: panelIntro,
            transform: `translateX(${leftTitleX}px)`,
          }}
        >
          <div
            style={{
              fontFamily: INTER,
              fontSize: 15,
              fontWeight: 600,
              letterSpacing: "0.32em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.45)",
            }}
          >
            single trades
          </div>
          <Reveal
            from={sceneStart + 16}
            duration={duration - 16}
            text="100 / s"
            revealDuration={22}
            seed={79}
            solid
            style={{
              fontSize: 104,
              fontWeight: 900,
              letterSpacing: "-0.03em",
              textAlign: "center",
              lineHeight: 1,
            }}
          />
        </div>

        {/* Rising single dots — jittered, 100 per second, pre-seeded.
            Stream is masked so we only see the upper band. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: flowOpacity,
            WebkitMaskImage: STREAM_MASK,
            maskImage: STREAM_MASK,
          }}
        >
          {Array.from({ length: leftCount }).map((_, i) => {
            const spawnFrame = LEFT_SPAWN_START + i * LEFT_SPAWN_DT;
            const age = local - spawnFrame;
            if (age < 0) return null;
            const y = 1180 - age * RISE_SPEED;
            if (y < -40) return null;
            const jitter = (p3Hash(i, 1) - 0.5) * 360;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: `calc(50% + ${jitter}px)`,
                  top: y,
                  width: 2,
                  height: 2,
                  borderRadius: "50%",
                  background: WHITE,
                  transform: "translate(-50%, -50%)",
                }}
              />
            );
          })}
        </div>
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
        <div
          style={{
            position: "absolute",
            top: 92,
            left: 0,
            right: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 14,
            zIndex: 5,
            opacity: panelIntro,
            transform: `translateX(${rightTitleX}px)`,
          }}
        >
          <div style={{ width: 60, height: 60 }}>
            <svg viewBox="0 0 102 102" width="60" height="60">
              {GM_LOGO_PATHS.map((d, i) => (
                <path key={i} d={d} fill={WHITE} />
              ))}
            </svg>
          </div>
          <Reveal
            from={sceneStart + 14}
            duration={duration - 14}
            text="Cluster Trading"
            revealDuration={28}
            seed={83}
            solid
            style={{
              fontSize: 68,
              fontWeight: 900,
              letterSpacing: "-0.03em",
              textAlign: "center",
              lineHeight: 1,
            }}
          />
          <div
            style={{
              fontFamily: INTER,
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: "-0.005em",
              color: "rgba(255,255,255,0.72)",
            }}
          >
            100,000 / s · 10,000 per block
          </div>
        </div>

        {/* Dot sheet — a repeating 2px dot at 4px cells, scrolled by
            backgroundPosition. Panel-wide pattern: ~240 dots per row,
            ~630 rows per second pass a visible line → ~150,000 dots/s
            flowing through. Masked so only the upper band reads; the
            spawn zone never shows. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: flowOpacity,
            overflow: "hidden",
            backgroundImage:
              "radial-gradient(circle, #ffffff 38%, transparent 40%)",
            backgroundSize: "4px 4px",
            backgroundRepeat: "repeat",
            backgroundPosition: `0 ${-local * RISE_SPEED}px`,
            WebkitMaskImage: STREAM_MASK,
            maskImage: STREAM_MASK,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

// Footnote pop-cut. Whole line snaps in on a hard cut; the leading
// asterisk gets a brief scale punch so the eye registers it before the
// rest of the words. No cascade, no per-word reveal.
const FootnotePopcut: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const op = interpolate(frame, [0, 2], [0, 1], clamp);
  const star = text.startsWith("* ") ? "*" : null;
  const rest = star ? text.slice(2) : text;
  const starScale = interpolate(frame, [0, 3, 8], [1.45, 1.05, 1], {
    ...clamp,
    easing: ease3,
  });
  return (
    <div
      style={{
        fontFamily: INTER,
        fontSize: 15,
        fontWeight: 600,
        letterSpacing: "0.28em",
        textTransform: "uppercase",
        color: WHITE,
        opacity: op * 0.65,
        textAlign: "center",
        whiteSpace: "nowrap",
      }}
    >
      {star ? (
        <>
          <span
            style={{
              display: "inline-block",
              transform: `scale(${starScale})`,
              transformOrigin: "center",
            }}
          >
            {star}
          </span>{" "}
          {rest}
        </>
      ) : (
        text
      )}
    </div>
  );
};

// ─── Scene 6: STAT — 90% ─────────────────────────────────────────────────

const StatScene: React.FC<{
  local: number;
  sceneStart: number;
  duration: number;
}> = ({ local, sceneStart, duration }) => {
  const fadeOut = interpolate(local, [duration - 20, duration], [1, 0], clamp);

  return (
    <AbsoluteFill style={{ opacity: fadeOut }}>
      {/* Phone rendered by SharedPhoneLayer at the InsiderPitch level,
          so it survives the cut into Point 1 as one continuous prop. */}

      {/* LEFT — "Reducing insider loss" broken across three lines */}
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          paddingLeft: 120,
          gap: 6,
        }}
      >
        <Reveal
          from={sceneStart + 4}
          duration={duration - 4}
          text="Reducing"
          revealDuration={26}
          seed={121}
          solid
          style={{
            fontSize: 124,
            fontWeight: 900,
            letterSpacing: "-0.035em",
            lineHeight: 1,
            maxWidth: 780,
          }}
        />
        <Reveal
          from={sceneStart + 14}
          duration={duration - 14}
          text="insider"
          revealDuration={26}
          seed={123}
          solid
          style={{
            fontSize: 124,
            fontWeight: 900,
            letterSpacing: "-0.035em",
            lineHeight: 1,
            maxWidth: 780,
          }}
        />
        <Reveal
          from={sceneStart + 24}
          duration={duration - 24}
          text="loss"
          revealDuration={26}
          seed={125}
          solid
          style={{
            fontSize: 124,
            fontWeight: 900,
            letterSpacing: "-0.035em",
            lineHeight: 1,
            maxWidth: 780,
          }}
        />
      </AbsoluteFill>

      {/* RIGHT — "up to 70%" with 70% set much bigger than "up to" */}
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          justifyContent: "center",
          paddingRight: 120,
          gap: 6,
        }}
      >
        <Reveal
          from={sceneStart + 34}
          duration={duration - 34}
          text="up to"
          revealDuration={26}
          seed={129}
          solid
          style={{
            fontSize: 80,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            lineHeight: 1,
            textAlign: "right",
            maxWidth: 600,
          }}
        />
        <Reveal
          from={sceneStart + 44}
          duration={duration - 44}
          text="70%"
          revealDuration={28}
          seed={131}
          solid
          style={{
            fontSize: 260,
            fontWeight: 900,
            letterSpacing: "-0.045em",
            lineHeight: 1,
            textAlign: "right",
            maxWidth: 600,
          }}
        />
      </AbsoluteFill>

      {/* FOOTNOTE — same as before, kept at the bottom */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          paddingBottom: 70,
        }}
      >
        <Sequence
          from={sceneStart + 70}
          durationInFrames={duration - 70}
          layout="none"
        >
          <FootnotePopcut text="* modelled on replayed insider events across five exchanges" />
        </Sequence>
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
// Final lockup sizing — icon + wordmark. Tuned to balance on a
// 1920-wide stage: icon ~200 px, wordmark Inter-900 at 160, 28 px gap.
const CLOSING_ICON_FINAL = 200;
const CLOSING_WORDMARK_FONT = 160;
const CLOSING_LOCKUP_GAP = 28;
// Measured width of "General Market" at the font/tracking above.
// Used for placement only; the text itself sizes to its content.
const CLOSING_WORDMARK_W = 1080;
const CLOSING_STAGE_W = 1920;
const CLOSING_STAGE_H = 1080;

const ClosingLogoGrid: React.FC<{ local: number }> = ({ local }) => {
  // Phase A [0, 112]  — Grid fills the whole frame and scrolls top-right.
  //   White stripes hidden, wordmark hidden. The two text statements
  //   play over this backdrop (see ClosingScene).
  // Phase B [112, 138] — Grid container shrinks from stage to the icon
  //   square AND slides to the lockup x. White stripes fade in — the
  //   GM logo crystallises out of the scrolling wall. Wordmark fades
  //   in from 114.
  // Phase C [130, 148] — Hold the full lockup. Scene cuts at 148
  //   (global frame 981 = 32:21 at 30fps). No whiting, no local fade.

  const containerW = interpolate(
    local,
    [112, 130],
    [CLOSING_STAGE_W, CLOSING_ICON_FINAL],
    { ...clamp, easing: ease3 },
  );
  const containerH = interpolate(
    local,
    [112, 130],
    [CLOSING_STAGE_H, CLOSING_ICON_FINAL],
    { ...clamp, easing: ease3 },
  );

  const lockupWidth =
    CLOSING_ICON_FINAL + CLOSING_LOCKUP_GAP + CLOSING_WORDMARK_W;
  const lockupLeft = (CLOSING_STAGE_W - lockupWidth) / 2;
  const iconFinalCx = lockupLeft + CLOSING_ICON_FINAL / 2;
  const wordmarkLeft = lockupLeft + CLOSING_ICON_FINAL + CLOSING_LOCKUP_GAP;

  const iconCx = interpolate(
    local,
    [112, 130],
    [CLOSING_STAGE_W / 2, iconFinalCx],
    { ...clamp, easing: ease3 },
  );

  // Grid drifts top-right across the full scene — phase A owns the
  // bulk of the travel, phase B adds a small residual while the
  // container is morphing, then holds through C. Capped at 24% so
  // nothing ever exposes an empty edge inside the 25% grid buffer.
  const scrollPct = interpolate(
    local,
    [0, 112, 130, 148],
    [0, 22, 24, 24],
    clamp,
  );

  // White bar reads thicker during phase A — stripes are scaled
  // vertically 2.4× while the container is stage-sized, then ease back
  // to natural proportions as the container squares up for the logo.
  const barScaleY = interpolate(local, [112, 130], [2.4, 1], {
    ...clamp,
    easing: ease3,
  });

  const wordmarkOpacity = interpolate(local, [114, 130], [0, 1], clamp);
  const wordmarkRise = interpolate(local, [114, 130], [26, 0], {
    ...clamp,
    easing: ease3,
  });

  const count = CLOSING_GRID_COLS * CLOSING_GRID_ROWS;

  return (
    <AbsoluteFill style={{ background: BLACK }}>
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: iconCx,
          width: containerW,
          height: containerH,
          transform: "translate(-50%, -50%)",
          overflow: "hidden",
          background: BLACK,
        }}
      >
        {/* Grid — oversized inside the container so the scroll has
            buffer on both axes. Translate is in percent of the grid's
            own box, so it scales naturally as the container shrinks. */}
        <div
          style={{
            position: "absolute",
            top: "-50%",
            left: "-50%",
            width: "200%",
            height: "200%",
            display: "grid",
            gridTemplateColumns: `repeat(${CLOSING_GRID_COLS}, 1fr)`,
            gridTemplateRows: `repeat(${CLOSING_GRID_ROWS}, 1fr)`,
            gap: 2,
            padding: 2,
            filter: "saturate(0.92) brightness(0.95)",
            transform: `translate(${scrollPct}%, ${-scrollPct}%)`,
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

        {/* White stripes — visible throughout. preserveAspectRatio="none"
            stretches the 102×102 viewBox to the container's current
            aspect, so in phase A the bar reads as a wide horizontal
            white band across the middle of the stage; as the container
            squares up in phase B it resolves into the GM logo's seven
            stripes. Bar and grid share the same parent, so they dezoom
            together by construction. */}
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 102 102"
          preserveAspectRatio="none"
          style={{
            position: "absolute",
            inset: 0,
            transform: `scaleY(${barScaleY})`,
            transformOrigin: "center center",
          }}
        >
          {GM_LOGO_PATHS.map((d, i) => (
            <path key={i} d={d} fill="#ffffff" />
          ))}
        </svg>
      </div>

      {/* Wordmark — absolutely anchored at its final x, fades in with a
          subtle rise. No width clipping → no mid-letter cuts. */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: wordmarkLeft,
          transform: `translate(0, calc(-50% + ${wordmarkRise}px))`,
          opacity: wordmarkOpacity,
          fontFamily: INTER,
          fontSize: CLOSING_WORDMARK_FONT,
          fontWeight: 900,
          letterSpacing: "-0.03em",
          lineHeight: 1,
          color: WHITE,
          whiteSpace: "nowrap",
          pointerEvents: "none",
        }}
      >
        General Market
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene 7: CLOSING ────────────────────────────────────────────────────

const ClosingScene: React.FC<{
  local: number;
  sceneStart: number;
  duration: number;
}> = ({ local, sceneStart }) => {
  const firstOut = interpolate(local, [58, 74], [1, 0], clamp);
  // Second statement holds until the lockup starts forming, then steps
  // aside so the wordmark reveal owns the frame.
  const secondOut = interpolate(local, [98, 112], [1, 0], clamp);

  // No local fadeOut — the scene hard-cuts at 148 (32:21) and the
  // composition's outroFade tapers the last frames of the whole pitch.

  return (
    <AbsoluteFill>
      <ClosingLogoGrid local={local} />

      {/* FIRST STATEMENT — rides over the dezooming logo via mix-blend
          difference, so it inverts to black against the white stripes
          and stays white against the black field. */}
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
          duration={48}
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

// ─── Shared phone layer ──────────────────────────────────────────────────
// One PhoneWithCard instance for both the Stat scene and Point 1. Mounted
// once as long as we're in either scene, so the 3D phone and all its
// state survive the scene cut at local=190. The card texture switches
// mid-spin; the roll is spread across 90 frames centred on the cut so
// the transition reads as a slow barrel roll, not a whip.

const SHARED_PHONE_PRELOAD = [
  "polymarket",
  "twitch",
  "db_trains",
  "tmdb",
] as const;
const POINT1_PHASE_IDS = ["twitch", "db_trains", "tmdb"] as const;

const SharedPhoneLayer: React.FC<{ local: number }> = ({ local }) => {
  const statStart = PITCH_SCENES.stat.start;
  const statEnd = PITCH_SCENES.stat.end;
  const point1Start = PITCH_SCENES.point1.start;
  const point1End = PITCH_SCENES.point1.end;

  // Visible only during stat + point1
  if (local < statStart || local >= point1End) return null;

  // Resolve the card. Stat holds polymarket; point1 cycles through the
  // phase sequence in equal thirds.
  let cardId: string;
  if (local < statEnd) {
    cardId = "polymarket";
  } else {
    const p1Local = local - point1Start;
    const p1Duration = point1End - point1Start;
    const phase = Math.min(
      POINT1_PHASE_IDS.length - 1,
      Math.max(0, Math.floor((p1Local / p1Duration) * POINT1_PHASE_IDS.length)),
    );
    cardId = POINT1_PHASE_IDS[phase];
  }

  // Roll: 90 frames centred on the cut. Half before, half after.
  const rollStart = point1Start - 45;
  const rollEnd = point1Start + 45;
  const rollT = interpolate(local, [rollStart, rollEnd], [0, 1], clamp);
  const yAxisExtraDeg = rollT * 360;

  // Fade in on stat entry, fade out on point1 exit.
  const opacity = interpolate(
    local,
    [statStart, statStart + 18, point1End - 18, point1End],
    [0, 1, 1, 0],
    clamp,
  );

  return (
    <AbsoluteFill style={{ opacity, pointerEvents: "none" }}>
      <PhoneWithCard
        cardSourceId={cardId}
        preloadSourceIds={SHARED_PHONE_PRELOAD as unknown as string[]}
        yAxisExtraDeg={yAxisExtraDeg}
      />
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

      {/* Single phone instance spanning Stat → Point 1, rolling across
          the cut instead of hard-mounting twice. */}
      <SharedPhoneLayer local={local} />
    </AbsoluteFill>
  );
};
