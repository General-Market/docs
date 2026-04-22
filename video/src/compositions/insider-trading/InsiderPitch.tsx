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

// ─── Scene timings ───────────────────────────────────────────────────────
// Compressed after the sub-text removals. Point2 and Point3 lose their
// bottom lines; Stat loses its LOSS CUT label. Each scene now holds just
// long enough for its remaining reveals to land and breathe.
export const PITCH_SCENES = {
  intro: { start: 0, end: 96 },
  contrast: { start: 96, end: 220 },
  point1: { start: 220, end: 340 },
  point2: { start: 340, end: 440 },
  point3: { start: 440, end: 540 },
  stat: { start: 540, end: 636 },
  closing: { start: 636, end: 748 },
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
  const circleR = interpolate(local, [0, 50], [0, 620], {
    ...clamp,
    easing: ease3,
  });
  const barWidth = interpolate(local, [48, 78], [0, 1400], {
    ...clamp,
    easing: ease3,
  });
  const fadeOut = interpolate(local, [duration - 14, duration], [1, 0], clamp);

  return (
    <AbsoluteFill style={{ opacity: fadeOut }}>
      {/* SHAPES — rendered first so all text sits above them */}
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
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          paddingBottom: 260,
        }}
      >
        <div
          style={{
            width: barWidth,
            height: 150,
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
          from={sceneStart + 4}
          duration={duration}
          text="General Market"
          revealDuration={36}
          seed={11}
          style={{
            fontSize: 176,
            fontWeight: 900,
            letterSpacing: "-0.03em",
            textAlign: "center",
          }}
        />
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          paddingBottom: 286,
        }}
      >
        <Reveal
          from={sceneStart + 54}
          duration={duration - 54}
          text="fights back"
          revealDuration={28}
          seed={23}
          style={{
            fontSize: 128,
            fontWeight: 900,
            letterSpacing: "-0.03em",
            textAlign: "center",
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─── Scene 2: CONTRAST ───────────────────────────────────────────────────

const ContrastScene: React.FC<{
  local: number;
  sceneStart: number;
  duration: number;
}> = ({ local, sceneStart, duration }) => {
  const fadeOut = interpolate(local, [duration - 18, duration], [1, 0], clamp);

  // Dots kept in the outer gutter only — top corners and the vertical
  // divider. They can no longer wander across the text columns.
  const dots = [
    { x: 0.08, y: 0.14, r: 28 },
    { x: 0.5, y: 0.12, r: 14 },
    { x: 0.92, y: 0.18, r: 24 },
    { x: 0.5, y: 0.88, r: 10 },
    { x: 0.08, y: 0.86, r: 20 },
    { x: 0.92, y: 0.82, r: 32 },
  ];

  return (
    <AbsoluteFill style={{ opacity: fadeOut }}>
      {/* SHAPES — gutter dots only, no full-height circle */}
      <AbsoluteFill>
        {dots.map((p, i) => {
          const appear = interpolate(
            local,
            [i * 3, 14 + i * 3],
            [0, 1],
            clamp,
          );
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: `${p.x * 100}%`,
                top: `${p.y * 100}%`,
                width: p.r * 2 * appear,
                height: p.r * 2 * appear,
                transform: "translate(-50%, -50%)",
                borderRadius: "50%",
                background: WHITE,
              }}
            />
          );
        })}
      </AbsoluteFill>

      {/* TEXT */}
      <AbsoluteFill
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          alignItems: "center",
          padding: "140px 160px",
          boxSizing: "border-box",
          gap: 120,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <Reveal
            from={sceneStart}
            duration={duration}
            text="EVERY EXCHANGE"
            revealDuration={28}
            seed={3}
            style={{
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: "0.3em",
            }}
          />
          <Reveal
            from={sceneStart + 8}
            duration={duration - 8}
            text="concedes to insiders"
            revealDuration={36}
            seed={5}
            style={{
              fontSize: 76,
              fontWeight: 900,
              letterSpacing: "-0.03em",
              lineHeight: 1,
              maxWidth: 720,
            }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <Reveal
            from={sceneStart + 44}
            duration={duration - 44}
            text="GENERAL MARKET"
            revealDuration={28}
            seed={13}
            style={{
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: "0.3em",
            }}
          />
          <Reveal
            from={sceneStart + 52}
            duration={duration - 52}
            text="removes their edge"
            revealDuration={40}
            seed={17}
            style={{
              fontSize: 76,
              fontWeight: 900,
              letterSpacing: "-0.03em",
              lineHeight: 1,
              maxWidth: 720,
            }}
          />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─── Scene 3: POINT 1 — 500,000 active markets ───────────────────────────

const Point1Scene: React.FC<{
  local: number;
  sceneStart: number;
  duration: number;
}> = ({ local, sceneStart, duration }) => {
  // Thin accent bar behind the big number — signals scale without
  // crossing title or subtitle zones.
  const barW = interpolate(local, [10, 60], [0, 1200], {
    ...clamp,
    easing: ease3,
  });
  const fadeOut = interpolate(local, [duration - 18, duration], [1, 0], clamp);

  return (
    <AbsoluteFill style={{ opacity: fadeOut }}>
      {/* SHAPE — slim horizontal accent slab, mid-screen only */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: barW,
            height: 18,
            background: WHITE,
            borderRadius: 3,
          }}
        />
      </AbsoluteFill>

      {/* TITLE — kept to a short lead-in so it doesn't echo the number */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          paddingTop: 150,
        }}
      >
        <Reveal
          from={sceneStart + 4}
          duration={duration - 4}
          text="01 · ACTIVE MARKETS"
          revealDuration={32}
          seed={31}
          style={{
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: "0.32em",
            textAlign: "center",
            textTransform: "uppercase",
            maxWidth: 1500,
          }}
        />
      </AbsoluteFill>

      {/* THE NUMBER — owns the middle */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Reveal
          from={sceneStart + 32}
          duration={duration - 32}
          text="500,000"
          revealDuration={24}
          seed={37}
          style={{
            fontSize: 260,
            fontWeight: 900,
            letterSpacing: "-0.04em",
            textAlign: "center",
          }}
        />
      </AbsoluteFill>

      {/* SUBTITLE — only-on-GM examples */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          paddingBottom: 150,
        }}
      >
        <Reveal
          from={sceneStart + 62}
          duration={duration - 62}
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
          text="2. 100% privacy until settlement"
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
          text="3. 100,000 trades per second"
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
    if (local < PITCH_SCENES.contrast.end) return "contrast";
    if (local < PITCH_SCENES.point1.end) return "point1";
    if (local < PITCH_SCENES.point2.end) return "point2";
    if (local < PITCH_SCENES.point3.end) return "point3";
    if (local < PITCH_SCENES.stat.end) return "stat";
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
      {activeKey === "contrast" ? (
        <ContrastScene
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
