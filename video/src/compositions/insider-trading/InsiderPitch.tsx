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
import { FeaturedCard, FEATURED_SOURCES } from "./SourceCardsWall";

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
  closing: { start: 540, end: 652 },
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
}> = ({ from, duration, text, style }) => {
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
          mixBlendMode: "difference",
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

// ─── Card vortex — cylindrical helix of source cards orbiting the camera.
//      Port of the WebGLPicks VortexGallery concept, in plain CSS 3D so it
//      costs a fraction of a Three.js canvas and keeps each card as live,
//      readable HTML. Rings stagger angularly so cards don't line up in
//      straight vertical columns on every rotation.
type VortexCardSlot = {
  angle: number;
  yOffset: number;
  sourceIdx: number;
  key: number;
};

const buildVortexSlots = (): VortexCardSlot[] => {
  const CARDS_PER_RING = 10;
  const RINGS = 3;
  const RING_SPACING = 440;
  const slots: VortexCardSlot[] = [];
  for (let r = 0; r < RINGS; r++) {
    const ringOffset = (r * 18) % 360; // half-step offset per ring
    for (let c = 0; c < CARDS_PER_RING; c++) {
      const angle = (c / CARDS_PER_RING) * 360 + ringOffset;
      const yOffset = (r - (RINGS - 1) / 2) * RING_SPACING;
      const key = r * CARDS_PER_RING + c;
      slots.push({
        angle,
        yOffset,
        sourceIdx: key % FEATURED_SOURCES.length,
        key,
      });
    }
  }
  return slots;
};

const VORTEX_SLOTS = buildVortexSlots();
const VORTEX_RADIUS = 880;
const VORTEX_CARD_W = 320;
const VORTEX_CARD_H = 420;

const CardVortex: React.FC<{ local: number }> = ({ local }) => {
  // Continuous rotation + mild vertical drift. The camera also tilts down
  // a few degrees for a more cinematic read on the cylinder.
  const rotation = local * 1.1;
  const tilt = 8;

  return (
    <AbsoluteFill
      style={{
        perspective: 2400,
        perspectiveOrigin: "50% 50%",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 0,
          height: 0,
          transformStyle: "preserve-3d",
          transform: `rotateX(${tilt}deg) rotateY(${rotation}deg)`,
        }}
      >
        {VORTEX_SLOTS.map((slot, i) => {
          const appearT = interpolate(
            local,
            [2 + i * 0.6, 26 + i * 0.6],
            [0, 1],
            clamp,
          );
          const source = FEATURED_SOURCES[slot.sourceIdx];
          return (
            <div
              key={slot.key}
              style={{
                position: "absolute",
                left: -VORTEX_CARD_W / 2,
                top: -VORTEX_CARD_H / 2,
                width: VORTEX_CARD_W,
                height: VORTEX_CARD_H,
                transform: `translateY(${slot.yOffset}px) rotateY(${slot.angle}deg) translateZ(${VORTEX_RADIUS}px)`,
                opacity: appearT,
                backfaceVisibility: "hidden",
                boxShadow: "0 32px 80px rgba(0,0,0,0.55)",
                borderRadius: 14,
                overflow: "hidden",
              }}
            >
              <FeaturedCard source={source} />
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

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
      {/* VORTEX — cylinder of live source cards rotating around the center */}
      <AbsoluteFill style={{ opacity: vortexIn }}>
        <CardVortex local={local} />
      </AbsoluteFill>

      {/* Radial vignette — holds focus at the center where the number lives */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 55% 45% at 50% 50%, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.75) 55%, rgba(0,0,0,0.95) 100%)",
          opacity: vortexIn,
          pointerEvents: "none",
        }}
      />

      {/* CENTER — the headline number and its tagline */}
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

const Point2Scene: React.FC<{
  local: number;
  sceneStart: number;
  duration: number;
}> = ({ local, sceneStart, duration }) => {
  // Vault metaphor — a rounded square grows, then its inner cavity seals
  // shut (the "privacy" moment). Square chosen over a circle so the
  // closing chamber reads as structure, not just another hole.
  const size = interpolate(local, [8, 50], [0, 520], {
    ...clamp,
    easing: ease3,
  });
  const sealT = interpolate(local, [50, 78], [0, 1], clamp);
  const fadeOut = interpolate(local, [duration - 18, duration], [1, 0], clamp);

  return (
    <AbsoluteFill style={{ opacity: fadeOut }}>
      {/* SHAPE — sealed vault */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            position: "relative",
            width: size,
            height: size,
            background: WHITE,
            borderRadius: 36,
          }}
        >
          {/* inner cavity — shrinks to nothing as it "seals" */}
          <div
            style={{
              position: "absolute",
              inset: interpolate(sealT, [0, 1], [70, size * 0.48], clamp),
              background: BLACK,
              borderRadius: 14,
            }}
          />
        </div>
      </AbsoluteFill>

      {/* TITLE */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          paddingTop: 120,
        }}
      >
        <Reveal
          from={sceneStart + 4}
          duration={duration - 4}
          text="100% privacy until settlement"
          revealDuration={38}
          seed={59}
          style={{
            fontSize: 72,
            fontWeight: 900,
            letterSpacing: "-0.03em",
            textAlign: "center",
            maxWidth: 1500,
            lineHeight: 1,
          }}
        />
      </AbsoluteFill>

      {/* LABEL inside the vault */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Reveal
          from={sceneStart + 46}
          duration={duration - 46}
          text="SEALED"
          revealDuration={22}
          seed={67}
          style={{
            fontSize: 72,
            fontWeight: 900,
            letterSpacing: "0.24em",
            textAlign: "center",
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─── Scene 5: POINT 3 — 100,000 trades per second ────────────────────────

const Point3Scene: React.FC<{
  local: number;
  sceneStart: number;
  duration: number;
}> = ({ local, sceneStart, duration }) => {
  // A hard horizontal slab sweeps across — speed, throughput, no
  // prediction-market comparison needed. Keep it to a single gesture.
  const sweep = interpolate(local, [10, 48], [0, 1], {
    ...clamp,
    easing: ease3,
  });
  const fadeOut = interpolate(local, [duration - 18, duration], [1, 0], clamp);

  return (
    <AbsoluteFill style={{ opacity: fadeOut }}>
      {/* SHAPE — sweeping slab */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 1720 * sweep,
            height: 320,
            background: WHITE,
            borderRadius: 4,
            transformOrigin: "left center",
          }}
        />
      </AbsoluteFill>

      {/* TITLE */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          paddingTop: 120,
        }}
      >
        <Reveal
          from={sceneStart + 4}
          duration={duration - 4}
          text="100,000 trades per second"
          revealDuration={38}
          seed={83}
          style={{
            fontSize: 72,
            fontWeight: 900,
            letterSpacing: "-0.03em",
            textAlign: "center",
            maxWidth: 1600,
            lineHeight: 1,
          }}
        />
      </AbsoluteFill>

      {/* THE NUMBER — sits on the slab, difference-blends to contrast */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Reveal
          from={sceneStart + 46}
          duration={duration - 46}
          text="100,000 / s"
          revealDuration={24}
          seed={101}
          style={{
            fontSize: 200,
            fontWeight: 900,
            letterSpacing: "-0.04em",
            textAlign: "center",
          }}
        />
      </AbsoluteFill>
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
  const shrink = interpolate(local, [70, duration - 4], [1, 0.3], clamp);
  const firstOut = interpolate(local, [58, 74], [1, 0], clamp);
  const logoIn = interpolate(local, [86, 106], [0, 1], clamp);
  const fadeOut = interpolate(local, [duration - 18, duration], [1, 0], clamp);

  return (
    <AbsoluteFill style={{ opacity: fadeOut }}>
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
        }}
      >
        <Reveal
          from={sceneStart + 64}
          duration={duration - 64}
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

      {/* LOGO + URL */}
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          paddingTop: 260,
          gap: 24,
          opacity: logoIn,
        }}
      >
        <Img
          src={staticFile("gm-logo.svg")}
          style={{
            width: 72,
            height: 72,
            mixBlendMode: "difference",
          }}
        />
        <Reveal
          from={sceneStart + 90}
          duration={duration - 90}
          text="generalmarket.io"
          revealDuration={28}
          seed={151}
          style={{
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: "0.3em",
            textTransform: "uppercase",
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
