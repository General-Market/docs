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

  const resolvedColor = (s.color as string) || WHITE;
  return (
    <Sequence from={from} durationInFrames={duration} layout="none">
      <div
        style={{
          mixBlendMode: solid ? "normal" : "difference",
          color: resolvedColor,
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
          color={resolvedColor}
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

// IntroContent — the full lockup tree. Rendered twice: once as the
// night base layer, once inside a filter: invert(1) clone that the
// slider reveals left-to-right to produce the day mode.
const IntroContent: React.FC<{
  local: number;
  sceneStart: number;
  duration: number;
  plateEdge: number;
  fontSize: number;
  lockupGap: number;
  logoScale: number;
  logoOpacity: number;
  pulse: number;
}> = ({
  local: _local,
  sceneStart,
  duration,
  plateEdge,
  fontSize,
  lockupGap,
  logoScale,
  logoOpacity,
  pulse,
}) => (
  <>
    {/* Vignette — edges crushed, center clean */}
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse at center, rgba(0,0,0,0) 42%, rgba(0,0,0,0.55) 100%)",
        pointerEvents: "none",
      }}
    />

    {/* LOCKUP — centered, breathing once on the downbeat */}
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
          gap: lockupGap,
          transform: `scale(${pulse})`,
          transformOrigin: "center",
        }}
      >
        <div
          style={{
            position: "relative",
            width: plateEdge,
            height: plateEdge,
            background: BLACK,
            borderRadius: 38,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: `scale(${logoScale})`,
            transformOrigin: "center",
            opacity: logoOpacity,
            boxShadow:
              "inset 0 0 0 1px rgba(255,255,255,0.08), 0 24px 70px rgba(0,0,0,0.55)",
            overflow: "hidden",
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
            maxWidth: 1800,
          }}
        />
      </div>
    </AbsoluteFill>

    {/* Tagline — fights back, below the enlarged lockup */}
    <AbsoluteFill
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        paddingTop: 340,
      }}
    >
      <Reveal
        from={sceneStart + 30}
        duration={duration - 30}
        text="fights back"
        revealDuration={18}
        seed={23}
        style={{
          fontSize: 104,
          fontWeight: 500,
          letterSpacing: "-0.01em",
          textAlign: "center",
          lineHeight: 1,
          maxWidth: 1600,
        }}
      />
    </AbsoluteFill>

    {/* Grain — SVG fractal noise, low opacity, overlay blend */}
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        opacity: 0.07,
        mixBlendMode: "overlay",
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='160' height='160' filter='url(%23n)' opacity='0.6'/></svg>\")",
        backgroundSize: "320px 320px",
      }}
    />
  </>
);

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

  const fontSize = 164;
  const plateEdge = 240;
  const lockupGap = 44;

  // Downbeat pulse — whole lockup breathes once across frames 48-58.
  const pulse = interpolate(local, [48, 53, 58], [1, 1.035, 1], {
    ...clamp,
    easing: ease3,
  });

  // Slider sweep — night → day over frames 28-52. Pixels to the left
  // of the thumb flip to day mode via a filter: invert(1) clone clipped
  // to the swept region.
  const sliderP = interpolate(local, [28, 52], [0, 1], {
    ...clamp,
    easing: ease3,
  });
  // Thumb visibility — fades in before the sweep, out after clearing
  // the right edge.
  const thumbOp = interpolate(
    local,
    [24, 30, 54, 58],
    [0, 1, 1, 0],
    clamp,
  );

  const contentProps = {
    local,
    sceneStart,
    duration,
    plateEdge,
    fontSize,
    lockupGap,
    logoScale,
    logoOpacity,
    pulse,
  };

  return (
    <AbsoluteFill style={{ opacity: fadeOut }}>
      {/* NIGHT — base layer, always visible */}
      <AbsoluteFill style={{ background: BLACK, isolation: "isolate" }}>
        <IntroContent {...contentProps} />
      </AbsoluteFill>

      {/* DAY — same tree inside filter: invert(1), clipped by slider
          progress. Clips from the right so the left portion (already
          swept) shows day mode; the right portion stays night. */}
      <AbsoluteFill
        style={{
          clipPath: `inset(0 ${(1 - sliderP) * 100}% 0 0)`,
          WebkitClipPath: `inset(0 ${(1 - sliderP) * 100}% 0 0)`,
          filter: "invert(1)",
          isolation: "isolate",
        }}
      >
        <AbsoluteFill style={{ background: BLACK }}>
          <IntroContent {...contentProps} />
        </AbsoluteFill>
      </AbsoluteFill>

      {/* SLIDER — the handle the user sees travel across. Not inverted;
          it's a UI element above both layers. Left half dark (contrasts
          day bg behind it), right half light (contrasts night bg). */}
      <AbsoluteFill style={{ pointerEvents: "none" }}>
        <div
          style={{
            position: "absolute",
            top: 0,
            left: `${sliderP * 100}%`,
            transform: "translateX(-50%)",
            width: 3,
            height: "100%",
            background: "rgba(180,180,180,0.85)",
            opacity: thumbOp,
            boxShadow:
              "0 0 10px rgba(255,255,255,0.35), 0 0 10px rgba(0,0,0,0.4)",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: 76,
              height: 108,
              borderRadius: 54,
              background:
                "linear-gradient(90deg, #1a1a1a 0%, #1a1a1a 50%, #f2f2f2 50%, #f2f2f2 100%)",
              boxShadow:
                "0 10px 44px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(255,255,255,0.18)",
            }}
          />
        </div>
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

  // Staggered enter/exit for the two text lines. Both enter from behind
  // the phone (left) and slide right into position. On exit they keep
  // going right. Order: upper enters first, lower follows. Exit: lower
  // leaves first, upper second — the reverse of the entrance.
  const upperEnterStart = 6;
  const upperEnterEnd = 32;
  const upperExitStart = 100;
  const upperExitEnd = 118;

  const lowerEnterStart = 30;
  const lowerEnterEnd = 54;
  const lowerExitStart = 88;
  const lowerExitEnd = 104;

  const upperX = interpolate(
    local,
    [upperEnterStart, upperEnterEnd, upperExitStart, upperExitEnd],
    [-360, 0, 0, 360],
    { ...clamp, easing: ease3 },
  );
  const upperOp = interpolate(
    local,
    [upperEnterStart, upperEnterEnd - 6, upperExitStart + 4, upperExitEnd],
    [0, 1, 1, 0],
    clamp,
  );

  const lowerX = interpolate(
    local,
    [lowerEnterStart, lowerEnterEnd, lowerExitStart, lowerExitEnd],
    [-280, 0, 0, 320],
    { ...clamp, easing: ease3 },
  );
  const lowerOp = interpolate(
    local,
    [lowerEnterStart, lowerEnterEnd - 6, lowerExitStart + 4, lowerExitEnd],
    [0, 1, 1, 0],
    clamp,
  );

  return (
    <AbsoluteFill style={{ opacity: fadeOut, background: "#ffffff" }}>
      {/* VORTEX — background cylinder without a center plane; the 3D
          phone below owns the middle. */}
      <AbsoluteFill style={{ opacity: vortexIn }}>
        <SourceVortexGallery centerSourceId={centerSourceId} hideCenter />
      </AbsoluteFill>

      {/* The phone now lives at the InsiderPitch wrapper level so it
          persists across the stat → point1 cut. See SharedPhoneLayer. */}

      {/* RIGHT — headline number and subtitle, right-aligned so the
          phone owns the left half. Each line is wrapped in a div that
          slides in from behind the phone and, later, slides further
          right to exit. */}
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          justifyContent: "center",
          paddingRight: 140,
          gap: 14,
        }}
      >
        <div
          style={{
            transform: `translateX(${upperX}px)`,
            opacity: upperOp,
          }}
        >
          <Reveal
            from={sceneStart + upperEnterStart}
            duration={duration - upperEnterStart}
            text="500,000"
            revealDuration={28}
            seed={37}
            solid
            style={{
              fontSize: 220,
              fontWeight: 900,
              letterSpacing: "-0.04em",
              textAlign: "right",
              maxWidth: 900,
              lineHeight: 0.95,
              color: BLACK,
            }}
          />
        </div>
        <div
          style={{
            transform: `translateX(${lowerX}px)`,
            opacity: lowerOp,
          }}
        >
          <Reveal
            from={sceneStart + lowerEnterStart}
            duration={duration - lowerEnterStart}
            text="shielded markets from insiders"
            revealDuration={26}
            seed={31}
            solid
            style={{
              fontSize: 42,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              textAlign: "right",
              maxWidth: 900,
              color: BLACK,
            }}
          />
        </div>
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

// Point 2 stage geometry — shared with SharedPhoneLayer so the phone
// can ride the carousel track at the same x/y as a regular card.
const P2_STAGE_W = 1920;
const P2_HALF_W = P2_STAGE_W / 2;
const P2_TRACK_Y = 510;
const P2_COL_LEFT = 80;
const P2_COL_WIDTH = 300;
const P2_COL_CENTER_X = P2_COL_LEFT + P2_COL_WIDTH / 2;
// Index in STREAM_CARDS that the phone takes over in Point 2. The phone
// rides at that slot's exact rawX and the underlying card is skipped so
// the phone replaces it cleanly — no overlap, no stacking.
const P2_PHONE_CAROUSEL_INDEX = 2;

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
        background: BLACK,
        border: "none",
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
                <path key={i} d={d} fill={WHITE} />
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
            background: WHITE,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width={100} height={100} viewBox="0 0 102 102">
            {GM_LOGO_PATHS.map((d, i) => (
              <path key={i} d={d} fill={BLACK} />
            ))}
          </svg>
        </div>
        <div
          style={{
            fontFamily: INTER,
            fontWeight: 900,
            fontSize: 44,
            letterSpacing: "-0.02em",
            color: WHITE,
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
      stroke={WHITE}
      strokeWidth={11}
      strokeLinecap="round"
      fill="none"
    />
    <rect x={10} y={52} width={100} height={90} rx={14} fill={WHITE} />
    <g transform="translate(9 44)">
      {GM_LOGO_PATHS.map((d, i) => (
        <path key={i} d={d} fill={BLACK} />
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
      background: BLACK,
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
        color: WHITE,
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
        color: WHITE,
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
  "No insider copying trades",
  "No insider front running trades",
];

const MESSAGE_WINDOWS: readonly { start: number; end: number }[] = [
  { start: 20, end: 58 },
  { start: 58, end: 100 },
];

const Point2Scene: React.FC<{
  local: number;
  sceneStart: number;
  duration: number;
}> = ({ local, sceneStart, duration }) => {
  const SCENE_FPS = 30;
  const halfW = P2_HALF_W;

  const time = local / SCENE_FPS;
  const fadeOut = interpolate(local, [duration - 18, duration], [1, 0], clamp);

  // ── Layout — three bands, no overlap ────────────────────────────────
  //   title  (top, headline)
  //   carousel + GM column  (middle)
  //   rotating consequence  (bottom)
  const TITLE_TOP = 70;
  const TITLE_H = 180;
  const TRACK_Y = P2_TRACK_Y;
  const COL_LEFT = P2_COL_LEFT;
  const COL_WIDTH = P2_COL_WIDTH;
  const COL_TOP = 310;
  const COL_HEIGHT = 400;
  const COL_CENTER_X = P2_COL_CENTER_X;
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
    <AbsoluteFill style={{ opacity: fadeOut, background: WHITE }}>
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
          text="100% privacy so even we cannot be an insider"
          revealDuration={34}
          seed={59}
          solid
          style={{
            fontSize: 74,
            fontWeight: 900,
            letterSpacing: "-0.03em",
            textAlign: "center",
            maxWidth: 1800,
            lineHeight: 1,
            color: BLACK,
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
        {cards
          .filter((c) => c.index !== P2_PHONE_CAROUSEL_INDEX)
          .map((c) => (
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
                color: BLACK,
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
    <AbsoluteFill style={{ opacity: fadeOut, background: WHITE }}>
      {/* Curtain → divider. One element. */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: curtainThickness,
          height: `${curtainHeight * 100}%`,
          transform: "translate(-50%, -50%)",
          background: BLACK,
          opacity: curtainOpacity,
        }}
      />

      {/* Headline — spans the full frame above the split panels. */}
      <div
        style={{
          position: "absolute",
          top: 60,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          zIndex: 20,
        }}
      >
        <Reveal
          from={sceneStart + 4}
          duration={duration - 4}
          text="Speed to allow you to drown insiders in numbers"
          revealDuration={32}
          seed={73}
          solid
          style={{
            fontSize: 50,
            fontWeight: 900,
            letterSpacing: "-0.03em",
            textAlign: "center",
            lineHeight: 1,
            maxWidth: 1800,
            color: BLACK,
          }}
        />
      </div>

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
        {/* Top label — "Others" */}
        <div
          style={{
            position: "absolute",
            top: 220,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            zIndex: 5,
            opacity: panelIntro,
            transform: `translateX(${leftTitleX}px)`,
          }}
        >
          <Reveal
            from={sceneStart + 6}
            duration={duration - 6}
            text="Others"
            revealDuration={24}
            seed={77}
            solid
            style={{
              fontSize: 88,
              fontWeight: 900,
              letterSpacing: "-0.03em",
              textAlign: "center",
              lineHeight: 1,
              color: BLACK,
            }}
          />
        </div>

        {/* Bottom rate — "100 trades / s" */}
        <div
          style={{
            position: "absolute",
            bottom: 140,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            zIndex: 5,
            opacity: panelIntro,
            transform: `translateX(${leftTitleX}px)`,
          }}
        >
          <Reveal
            from={sceneStart + 20}
            duration={duration - 20}
            text="100 trades / s"
            revealDuration={26}
            seed={79}
            solid
            style={{
              fontSize: 116,
              fontWeight: 900,
              letterSpacing: "-0.04em",
              textAlign: "center",
              lineHeight: 1,
              color: BLACK,
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
                  background: BLACK,
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
        {/* Top label — "General Market" */}
        <div
          style={{
            position: "absolute",
            top: 220,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            zIndex: 5,
            opacity: panelIntro,
            transform: `translateX(${rightTitleX}px)`,
          }}
        >
          <Reveal
            from={sceneStart + 6}
            duration={duration - 6}
            text="General Market"
            revealDuration={26}
            seed={81}
            solid
            style={{
              fontSize: 80,
              fontWeight: 900,
              letterSpacing: "-0.03em",
              textAlign: "center",
              lineHeight: 1,
              color: BLACK,
            }}
          />
        </div>

        {/* Bottom rate — "100k trades / s" */}
        <div
          style={{
            position: "absolute",
            bottom: 140,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            zIndex: 5,
            opacity: panelIntro,
            transform: `translateX(${rightTitleX}px)`,
          }}
        >
          <Reveal
            from={sceneStart + 20}
            duration={duration - 20}
            text="100k trades / s"
            revealDuration={26}
            seed={83}
            solid
            style={{
              fontSize: 116,
              fontWeight: 900,
              letterSpacing: "-0.04em",
              textAlign: "center",
              lineHeight: 1,
              color: BLACK,
            }}
          />
        </div>

        {/* Dot sheet — two nested masks. Outer div fades top/bottom so the
            spawn zone stays hidden. Inner div paints rainbow stripes and
            is mask-cut by the dot pattern; the stripes scroll faster than
            the dot grid so colours visibly cycle through each dot as it
            rises — turns the monochrome stream into a chromatic blur
            that reads as speed rather than a still texture. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: flowOpacity,
            overflow: "hidden",
            filter: "brightness(0.85) saturate(0.95)",
            WebkitMaskImage: STREAM_MASK,
            maskImage: STREAM_MASK,
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage:
                "linear-gradient(180deg, #ff3b6e 0%, #ff8a00 14%, #ffd60a 28%, #3cff8f 42%, #00d5ff 57%, #6b6bff 71%, #c36cff 85%, #ff3b6e 100%)",
              backgroundSize: "100% 240px",
              backgroundRepeat: "repeat",
              backgroundPosition: `0 ${-local * RISE_SPEED * 1.6}px`,
              WebkitMaskImage:
                "radial-gradient(circle, #000 38%, transparent 40%)",
              WebkitMaskSize: "4px 4px",
              WebkitMaskRepeat: "repeat",
              WebkitMaskPosition: `0 ${-local * RISE_SPEED}px`,
              maskImage:
                "radial-gradient(circle, #000 38%, transparent 40%)",
              maskSize: "4px 4px",
              maskRepeat: "repeat",
              maskPosition: `0 ${-local * RISE_SPEED}px`,
            }}
          />
        </div>
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
        color: BLACK,
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

      {/* LEFT — "Earning back your losses from insiders" on three lines */}
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
          text="Earning back"
          revealDuration={26}
          seed={121}
          solid
          style={{
            fontSize: 108,
            fontWeight: 900,
            letterSpacing: "-0.035em",
            lineHeight: 1,
            maxWidth: 900,
            color: BLACK,
          }}
        />
        <Reveal
          from={sceneStart + 14}
          duration={duration - 14}
          text="your losses"
          revealDuration={26}
          seed={123}
          solid
          style={{
            fontSize: 108,
            fontWeight: 900,
            letterSpacing: "-0.035em",
            lineHeight: 1,
            maxWidth: 900,
            color: BLACK,
          }}
        />
        <Reveal
          from={sceneStart + 24}
          duration={duration - 24}
          text="from insiders"
          revealDuration={26}
          seed={125}
          solid
          style={{
            fontSize: 108,
            fontWeight: 900,
            letterSpacing: "-0.035em",
            lineHeight: 1,
            maxWidth: 900,
            color: BLACK,
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
            color: BLACK,
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
            color: BLACK,
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
  // vertically 4× while the container is stage-sized, then ease back
  // to natural proportions as the container squares up for the logo.
  const barScaleY = interpolate(local, [112, 130], [4, 1], {
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
    <AbsoluteFill style={{ background: WHITE }}>
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
            <path key={i} d={d} fill={WHITE} />
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
          color: BLACK,
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
  // Statement holds, then leaves before the container starts to shrink.
  // Fade window closes at local=108 — a clean 4-frame gap before the
  // shrink begins at 112, so the text is never half-alive inside the
  // morph. No transform on the wrapper — opacity-only preserves the
  // Reveal's mix-blend-mode: difference against the white band.
  const firstOut = interpolate(local, [92, 108], [1, 0], clamp);

  // No local fadeOut — the scene hard-cuts at 148 (32:21) and the
  // composition's outroFade tapers the last frames of the whole pitch.

  return (
    <AbsoluteFill>
      <ClosingLogoGrid local={local} />

      {/* STATEMENT — rides over the dezooming logo via mix-blend
          difference, so it inverts to black against the white stripes
          and stays white against the black field. The second beat
          ("General Market") is carried by the lockup's wordmark
          reveal, so no second Reveal is needed here. */}
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
          duration={100}
          text="Where being an outsider wins"
          revealDuration={40}
          seed={137}
          style={{
            fontSize: 78,
            fontWeight: 900,
            letterSpacing: "-0.03em",
            textAlign: "center",
            maxWidth: 1500,
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
  const point2Start = PITCH_SCENES.point2.start;
  const point3Start = PITCH_SCENES.point3.start;
  const point3End = PITCH_SCENES.point3.end;

  if (local < statStart || local >= point3End) return null;

  // Resolve the card id. Stat → polymarket. Point 1 cycles the phase
  // triplet in thirds. Point 2 keeps the last phase card (movies) as
  // the object passing through the vault. Point 3 uses the same card
  // but with the speed overlay — the identity stays, the state changes.
  let cardId: string;
  if (local < statEnd) {
    cardId = "polymarket";
  } else if (local < point1End) {
    const p1Local = local - point1Start;
    const p1Duration = point1End - point1Start;
    const phase = Math.min(
      POINT1_PHASE_IDS.length - 1,
      Math.max(0, Math.floor((p1Local / p1Duration) * POINT1_PHASE_IDS.length)),
    );
    cardId = POINT1_PHASE_IDS[phase];
  } else {
    cardId = "tmdb";
  }

  // Point 2 — phone rides the card carousel. Same scroll speed, same
  // track, same math as STREAM_CARDS. Starts off-screen left at the
  // scene opening, passes through the GM column mid-journey, exits
  // right carrying the sealed overlay. Spatial — not time-based.
  const p2Local = local - point2Start;
  const p2ScrollOffset = (p2Local / 30) * GC_SCROLL_SPEED;
  const p2PhoneRawX =
    gcMod(
      P2_PHONE_CAROUSEL_INDEX * GC_UNIT + p2ScrollOffset + GC_TRACK_LEN / 2,
      GC_TRACK_LEN,
    ) - GC_TRACK_LEN / 2;
  const p2PhoneScreenX = p2PhoneRawX + P2_HALF_W - GC_CARD_W / 2;
  const p2PhoneCenterX = p2PhoneScreenX + GC_CARD_W / 2;
  const p2PhoneAbsNorm = Math.abs(gcClamp(p2PhoneRawX / P2_HALF_W, -1, 1));
  const p2PhoneScale = GC_SCALE_BASE + (1 - p2PhoneAbsNorm) * GC_SCALE_RANGE;

  // Overlay mode. Plain through Point 1. In Point 2 sealed activates
  // the frame the phone's centre crosses COL_CENTER_X — the GM gate.
  // Point 3 uses the speed overlay — rapid trade feed.
  let overlayMode: "plain" | "sealed" | "speed" = "plain";
  if (local >= point2Start && local < point3Start) {
    overlayMode = p2PhoneCenterX > P2_COL_CENTER_X ? "sealed" : "plain";
  } else if (local >= point3Start) {
    overlayMode = "speed";
  }

  // 360° barrel roll between Stat and Point 1 — tightened from 90 frames
  // to 36 so the spin reads as a snap, not a drift. The phone also
  // swings horizontally during the flip so it's clearly travelling and
  // not pirouetting in place.
  const rollSP1 = interpolate(
    local,
    [point1Start - 18, point1Start + 18],
    [0, 1],
    clamp,
  );
  const yAxisExtraDeg = rollSP1 * 360;
  // Sine arc peaking mid-spin — 0 at both ends of the flip window, up
  // to +140 px at the halfway point. Adds to whatever xTranslate the
  // Stat / Point 1 branches compute, so the horizontal motion is a
  // genuine coordinated move, not a competing animation.
  const flipSwingX =
    rollSP1 > 0 && rollSP1 < 1 ? Math.sin(rollSP1 * Math.PI) * 140 : 0;

  // Entry/exit envelope only. The Point 2 → Point 3 flash has been
  // deleted; the phone now glides between scenes via a pose blend
  // instead of disappearing for twelve frames.
  const opacity = interpolate(
    local,
    [statStart, statStart + 18, point3End - 18, point3End],
    [0, 1, 1, 0],
    clamp,
  );

  // Point 2 — phone slots into the carousel. xTranslate shifts the
  // 1920×1080 phone canvas so the phone (whose natural centre sits near
  // screen x=960) lands at the computed carousel screenX. yTranslate
  // drops the phone to TRACK_Y so it sits on the same row as the cards.
  let xTranslate = 0;
  let yTranslate = 0;
  let carouselScale = 1;
  let carouselOpacity = 1;
  // Point 1 — phone surrenders the centre to the right-aligned text,
  // shifting left so "500,000" reads clean. A tiny backtrack (+24 px
  // right) fires at the cut as anticipation before the leftward slide —
  // every UI motion toward a target first recoils the opposite way.
  if (local >= point1Start && local < point2Start) {
    xTranslate = interpolate(
      local - point1Start,
      [-6, 0, 6, 34],
      [0, 24, 0, -450],
      { ...clamp, easing: ease3 },
    );
  }
  if (local >= point2Start && local < point3Start) {
    xTranslate = p2PhoneCenterX - P2_HALF_W;
    yTranslate = P2_TRACK_Y - 540;
    carouselScale = p2PhoneScale;
    // Phone is the hero element. It does not fade at the carousel edges
    // the way regular cards do — presence on screen is purely spatial.
    carouselOpacity = 1;
  }

  // Shared-element pose blends — the phone never leaves the stage
  // between scenes. It glides from one scene's anchor to the next
  // across a short window straddling the cut. No fade, no flash.
  const smoothstep = (t: number) => t * t * (3 - 2 * t);

  // Point 1 → Point 2. P1 leaves the phone at xTranslate=-450 (screen
  // x≈510). Lerp into the P2 carousel pose so the motion across the cut
  // is pixel-continuous.
  const p1p2Start = point2Start - 4;
  const p1p2End = point2Start + 12;
  if (local >= p1p2Start && local <= p1p2End) {
    const bT = smoothstep(
      (local - p1p2Start) / (p1p2End - p1p2Start),
    );
    const fromX = -450;
    const toX = p2PhoneCenterX - P2_HALF_W;
    const toY = P2_TRACK_Y - 540;
    const toS = p2PhoneScale;
    xTranslate = fromX + (toX - fromX) * bT;
    yTranslate = 0 + (toY - 0) * bT;
    carouselScale = 1 + (toS - 1) * bT;
    carouselOpacity = 1;
  }

  // Point 2 → Point 3. Phone flies from wherever it sits on the
  // carousel to the centre of the frame where the speed scene owns it.
  // A single continuous arc. The overlay swaps mid-motion (sealed →
  // speed) but the phone itself never disappears.
  const p2p3Start = point3Start - 14;
  const p2p3End = point3Start + 8;
  if (local >= p2p3Start && local <= p2p3End) {
    const bT = smoothstep(
      (local - p2p3Start) / (p2p3End - p2p3Start),
    );
    const fromX = p2PhoneCenterX - P2_HALF_W;
    const fromY = P2_TRACK_Y - 540;
    const fromS = p2PhoneScale;
    xTranslate = fromX + (0 - fromX) * bT;
    yTranslate = fromY + (0 - fromY) * bT;
    carouselScale = fromS + (1 - fromS) * bT;
    carouselOpacity = 1;
  }

  // Subtle jitter on the speed scene to sell "the device is vibrating
  // under the load of 100,000 orders per second". Ramps in across the
  // P2→P3 blend window so it doesn't slam on at the scene boundary.
  let xJitter = 0;
  let yJitter = 0;
  if (local >= p2p3Start && local < point3End) {
    const jitterRamp = interpolate(
      local,
      [p2p3Start, point3Start + 4],
      [0, 1],
      clamp,
    );
    const t = Math.max(0, (local - point3Start) / (point3End - point3Start));
    const a = (1 - Math.min(1, t)) * 0.6 + 0.4;
    xJitter = Math.sin(local * 3.7) * 6 * a * jitterRamp;
    yJitter = Math.cos(local * 4.3) * 4 * a * jitterRamp;
  }

  return (
    <AbsoluteFill
      style={{
        opacity: opacity * carouselOpacity,
        pointerEvents: "none",
        transform: `translate(${
          xTranslate + xJitter + flipSwingX
        }px, ${yTranslate + yJitter}px) scale(${carouselScale})`,
        transformOrigin: "50% 50%",
      }}
    >
      <PhoneWithCard
        cardSourceId={cardId}
        preloadSourceIds={SHARED_PHONE_PRELOAD as unknown as string[]}
        yAxisExtraDeg={yAxisExtraDeg}
        overlayMode={overlayMode}
        compactness={interpolate(
          local,
          [p1p2Start, p1p2End, p2p3Start, p2p3End],
          [0, 1, 1, 0],
          clamp,
        )}
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
    <AbsoluteFill
      style={{
        background: activeKey === "intro" ? BLACK : WHITE,
        isolation: "isolate",
      }}
    >
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
