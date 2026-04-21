import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";

const { fontFamily: INTER } = loadInter("normal", {
  subsets: ["latin"],
  weights: ["400", "500", "600", "700", "800", "900"],
});

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease3 = (t: number) => 1 - Math.pow(1 - t, 3);

const BLACK = "#000000";
const WHITE = "#ffffff";

// ─── Scene timings ───────────────────────────────────────────────────────
export const PITCH_SCENES = {
  intro: { start: 0, end: 96 },
  contrast: { start: 96, end: 220 },
  point1: { start: 220, end: 360 },
  point2: { start: 360, end: 500 },
  point3: { start: 500, end: 636 },
  stat: { start: 636, end: 748 },
  closing: { start: 748, end: 860 },
} as const;

export const PITCH_DURATION = PITCH_SCENES.closing.end;

// Shared static text styles. Text is white; difference blend handles inversion.
const textBase: React.CSSProperties = {
  fontFamily: INTER,
  color: WHITE,
  mixBlendMode: "difference",
};

const Title = (style: React.CSSProperties): React.CSSProperties => ({
  ...textBase,
  fontWeight: 900,
  letterSpacing: "-0.03em",
  lineHeight: 0.95,
  ...style,
});

const Label = (style: React.CSSProperties): React.CSSProperties => ({
  ...textBase,
  fontWeight: 700,
  letterSpacing: "0.3em",
  textTransform: "uppercase",
  ...style,
});

const Body = (style: React.CSSProperties): React.CSSProperties => ({
  ...textBase,
  fontWeight: 600,
  letterSpacing: "-0.01em",
  ...style,
});

// ─── Scene 1: INTRO — "General Market fights back" ───────────────────────

const IntroScene: React.FC<{ local: number; duration: number }> = ({
  local,
  duration,
}) => {
  const circleR = interpolate(local, [0, 50], [0, 620], {
    ...clamp,
    easing: ease3,
  });
  const barWidth = interpolate(local, [48, 78], [0, 1400], {
    ...clamp,
    easing: ease3,
  });
  const textIn = interpolate(local, [12, 28], [0, 1], clamp);
  const kickerIn = interpolate(local, [58, 74], [0, 1], clamp);
  const fadeOut = interpolate(local, [duration - 14, duration], [1, 0], clamp);

  return (
    <AbsoluteFill style={{ opacity: fadeOut }}>
      {/* Shape — circle grows from center */}
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

      {/* Shape — kicker bar */}
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

      {/* Text */}
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
        }}
      >
        <div
          style={{
            ...Title({ fontSize: 176, opacity: textIn, textAlign: "center" }),
          }}
        >
          General Market
        </div>
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          paddingBottom: 286,
        }}
      >
        <div
          style={{
            ...Title({
              fontSize: 128,
              opacity: kickerIn,
              textAlign: "center",
            }),
          }}
        >
          fights back.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─── Scene 2: CONTRAST ───────────────────────────────────────────────────

const ContrastScene: React.FC<{ local: number; duration: number }> = ({
  local,
  duration,
}) => {
  const bigCircle = interpolate(local, [40, 100], [0, 520], {
    ...clamp,
    easing: ease3,
  });
  const leftIn = interpolate(local, [0, 18], [0, 1], clamp);
  const rightIn = interpolate(local, [40, 60], [0, 1], clamp);
  const fadeOut = interpolate(local, [duration - 18, duration], [1, 0], clamp);

  const scatter = [
    { x: 0.14, y: 0.32, r: 62 },
    { x: 0.28, y: 0.52, r: 44 },
    { x: 0.08, y: 0.62, r: 72 },
    { x: 0.32, y: 0.72, r: 36 },
    { x: 0.20, y: 0.44, r: 54 },
    { x: 0.40, y: 0.38, r: 30 },
  ];

  return (
    <AbsoluteFill style={{ opacity: fadeOut }}>
      {/* Shapes — left: scattered circles */}
      <AbsoluteFill>
        {scatter.map((p, i) => {
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

      {/* Shapes — right: one giant circle */}
      <AbsoluteFill>
        <div
          style={{
            position: "absolute",
            right: -60,
            top: "50%",
            transform: "translateY(-50%)",
            width: bigCircle * 2,
            height: bigCircle * 2,
            borderRadius: "50%",
            background: WHITE,
          }}
        />
      </AbsoluteFill>

      {/* Text */}
      <AbsoluteFill
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          alignItems: "center",
          padding: "140px 140px",
          boxSizing: "border-box",
          gap: 80,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 24,
            opacity: leftIn,
          }}
        >
          <div style={Label({ fontSize: 24 })}>Every exchange</div>
          <div style={Title({ fontSize: 84 })}>
            allows insider trading.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 24,
            opacity: rightIn,
          }}
        >
          <div style={Label({ fontSize: 24 })}>General Market</div>
          <div style={Title({ fontSize: 84 })}>
            the first to eliminate insiders.
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─── Scene 3: POINT 1 — Derivative on top of every market ────────────────

const Point1Scene: React.FC<{ local: number; duration: number }> = ({
  local,
  duration,
}) => {
  const leftC = interpolate(local, [10, 60], [0, 280], {
    ...clamp,
    easing: ease3,
  });
  const rightC = interpolate(local, [36, 86], [0, 280], {
    ...clamp,
    easing: ease3,
  });
  const headIn = interpolate(local, [6, 26], [0, 1], clamp);
  const labelsIn = interpolate(local, [70, 92], [0, 1], clamp);
  const captionIn = interpolate(local, [98, 118], [0, 1], clamp);
  const fadeOut = interpolate(local, [duration - 18, duration], [1, 0], clamp);

  return (
    <AbsoluteFill style={{ opacity: fadeOut }}>
      {/* Headline */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          paddingTop: 140,
        }}
      >
        <div
          style={{
            ...Title({
              fontSize: 72,
              textAlign: "center",
              maxWidth: 1400,
              opacity: headIn,
            }),
          }}
        >
          1. A derivative on top of every market.
        </div>
      </AbsoluteFill>

      {/* Shapes — two overlapping circles */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ position: "relative", width: 900, height: 560 }}>
          <div
            style={{
              position: "absolute",
              left: 100,
              top: 280 - leftC,
              width: leftC * 2,
              height: leftC * 2,
              borderRadius: "50%",
              background: WHITE,
              transform: "translate(-50%, 0)",
            }}
          />
          <div
            style={{
              position: "absolute",
              right: 100,
              top: 280 - rightC,
              width: rightC * 2,
              height: rightC * 2,
              borderRadius: "50%",
              background: WHITE,
              transform: "translate(50%, 0)",
            }}
          />
        </div>
      </AbsoluteFill>

      {/* Circle labels */}
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
            width: 900,
            height: 560,
            opacity: labelsIn,
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 260,
              width: 260,
              textAlign: "center",
              ...Title({ fontSize: 56 }),
            }}
          >
            Original
          </div>
          <div
            style={{
              position: "absolute",
              right: 0,
              top: 260,
              width: 300,
              textAlign: "center",
              ...Title({ fontSize: 56 }),
            }}
          >
            Derivative
          </div>
        </div>
      </AbsoluteFill>

      {/* Caption */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          paddingBottom: 140,
        }}
      >
        <div
          style={{
            ...Body({
              fontSize: 38,
              textAlign: "center",
              maxWidth: 1400,
              opacity: captionIn,
            }),
          }}
        >
          You trade the same assets — without insiders.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─── Scene 4: POINT 2 — Clusters of 1,000 ────────────────────────────────

const Point2Scene: React.FC<{ local: number; duration: number }> = ({
  local,
  duration,
}) => {
  const circleR = interpolate(local, [14, 74], [0, 380], {
    ...clamp,
    easing: ease3,
  });
  const insiderDot = interpolate(local, [86, 108], [0, 1], clamp);
  const headIn = interpolate(local, [6, 24], [0, 1], clamp);
  const numberIn = interpolate(local, [46, 66], [0, 1], clamp);
  const labelIn = interpolate(local, [74, 92], [0, 1], clamp);
  const pointerIn = interpolate(local, [100, 122], [0, 1], clamp);
  const captionIn = interpolate(local, [118, 136], [0, 1], clamp);
  const fadeOut = interpolate(local, [duration - 18, duration], [1, 0], clamp);

  // 60 tiny white dots scattered in the black field
  const fieldDots = React.useMemo(() => {
    const out: { x: number; y: number; r: number }[] = [];
    for (let i = 0; i < 60; i++) {
      const angle = (i / 60) * Math.PI * 2;
      const dist = 540 + ((i * 97) % 260);
      out.push({
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist * 0.54,
        r: 2 + ((i * 17) % 4),
      });
    }
    return out;
  }, []);

  return (
    <AbsoluteFill style={{ opacity: fadeOut }}>
      {/* Headline */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          paddingTop: 120,
        }}
      >
        <div
          style={{
            ...Title({
              fontSize: 72,
              textAlign: "center",
              maxWidth: 1500,
              opacity: headIn,
            }),
          }}
        >
          2. Trades clustered in 1,000.
        </div>
      </AbsoluteFill>

      {/* Field dots */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ position: "relative", width: 0, height: 0 }}>
          {fieldDots.map((d, i) => {
            const show = interpolate(
              local,
              [16 + i * 0.4, 30 + i * 0.4],
              [0, 1],
              clamp,
            );
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: d.x,
                  top: d.y,
                  width: d.r * 2 * show,
                  height: d.r * 2 * show,
                  borderRadius: "50%",
                  background: WHITE,
                  opacity: 0.85,
                }}
              />
            );
          })}
        </div>
      </AbsoluteFill>

      {/* Big central circle */}
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
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              right: "24%",
              top: "38%",
              width: 22 * insiderDot,
              height: 22 * insiderDot,
              borderRadius: "50%",
              background: BLACK,
              transform: "translate(50%, -50%)",
            }}
          />
        </div>
      </AbsoluteFill>

      {/* 1,000 */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            ...Title({
              fontSize: 260,
              textAlign: "center",
              opacity: numberIn,
            }),
          }}
        >
          1,000
        </div>
      </AbsoluteFill>

      {/* Under-circle label */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          paddingTop: 340,
        }}
      >
        <div
          style={{
            ...Label({ fontSize: 30, opacity: labelIn }),
          }}
        >
          Clusters per trade
        </div>
      </AbsoluteFill>

      {/* Insider pointer */}
      <AbsoluteFill
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "flex-start",
          paddingTop: 300,
          paddingRight: 220,
          opacity: pointerIn,
        }}
      >
        <div style={Label({ fontSize: 18 })}>
          Insider · 1 of 1,000
        </div>
      </AbsoluteFill>

      {/* Caption */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          paddingBottom: 120,
        }}
      >
        <div
          style={{
            ...Body({
              fontSize: 36,
              textAlign: "center",
              maxWidth: 1500,
              opacity: captionIn,
            }),
          }}
        >
          Insiders control 1 asset. Not 1,000.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─── Scene 5: POINT 3 — Bot vs industry ──────────────────────────────────

const Point3Scene: React.FC<{ local: number; duration: number }> = ({
  local,
  duration,
}) => {
  const smallR = interpolate(local, [16, 48], [0, 72], {
    ...clamp,
    easing: ease3,
  });
  const bigR = interpolate(local, [44, 104], [0, 420], {
    ...clamp,
    easing: ease3,
  });
  const headIn = interpolate(local, [6, 24], [0, 1], clamp);
  const smallLabelIn = interpolate(local, [38, 56], [0, 1], clamp);
  const bigLabelIn = interpolate(local, [84, 104], [0, 1], clamp);
  const captionIn = interpolate(local, [116, 136], [0, 1], clamp);
  const fadeOut = interpolate(local, [duration - 18, duration], [1, 0], clamp);

  return (
    <AbsoluteFill style={{ opacity: fadeOut }}>
      {/* Headline */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          paddingTop: 120,
        }}
      >
        <div
          style={{
            ...Title({
              fontSize: 64,
              textAlign: "center",
              maxWidth: 1600,
              opacity: headIn,
            }),
          }}
        >
          3. More positions than the entire prediction market industry.
        </div>
      </AbsoluteFill>

      {/* Circles */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ position: "relative", width: 1500, height: 620 }}>
          <div
            style={{
              position: "absolute",
              left: 200,
              top: 320 - smallR,
              width: smallR * 2,
              height: smallR * 2,
              borderRadius: "50%",
              background: WHITE,
            }}
          />
          <div
            style={{
              position: "absolute",
              right: 140,
              top: 320 - bigR,
              width: bigR * 2,
              height: bigR * 2,
              borderRadius: "50%",
              background: WHITE,
            }}
          />
        </div>
      </AbsoluteFill>

      {/* Labels */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ position: "relative", width: 1500, height: 620 }}>
          {/* Industry */}
          <div
            style={{
              position: "absolute",
              left: 100,
              top: 440,
              width: 300,
              textAlign: "center",
              opacity: smallLabelIn,
            }}
          >
            <div style={Label({ fontSize: 18 })}>Industry · per day</div>
            <div style={{ ...Title({ fontSize: 52 }), marginTop: 10 }}>
              48,000
            </div>
          </div>

          {/* GM — inside big circle */}
          <div
            style={{
              position: "absolute",
              right: 140,
              top: 260,
              width: 500,
              transform: "translateX(50%)",
              marginRight: -250,
              textAlign: "center",
              opacity: bigLabelIn,
            }}
          >
            <div style={Title({ fontSize: 128 })}>520,000</div>
            <div style={{ ...Label({ fontSize: 20 }), marginTop: 8 }}>
              GM bot · per day
            </div>
          </div>
        </div>
      </AbsoluteFill>

      {/* Caption */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          paddingBottom: 130,
        }}
      >
        <div
          style={{
            ...Body({
              fontSize: 32,
              textAlign: "center",
              maxWidth: 1400,
              opacity: captionIn,
            }),
          }}
        >
          One General Market bot. More trades than every platform combined.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─── Scene 6: STAT — 90% ─────────────────────────────────────────────────

const StatScene: React.FC<{ local: number; duration: number }> = ({
  local,
  duration,
}) => {
  const circleR = interpolate(local, [0, 60], [0, 400], {
    ...clamp,
    easing: ease3,
  });
  const numIn = interpolate(local, [22, 44], [0, 1], clamp);
  const labelIn = interpolate(local, [48, 68], [0, 1], clamp);
  const captionIn = interpolate(local, [70, 90], [0, 1], clamp);
  const asterIn = interpolate(local, [86, 100], [0, 1], clamp);
  const fadeOut = interpolate(local, [duration - 20, duration], [1, 0], clamp);

  return (
    <AbsoluteFill style={{ opacity: fadeOut }}>
      {/* Circle */}
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

      {/* 90% */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            ...Title({ fontSize: 340, opacity: numIn }),
          }}
        >
          90%
        </div>
      </AbsoluteFill>

      {/* Caption block */}
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
        <div style={Label({ fontSize: 28, opacity: labelIn })}>Loss cut</div>
        <div
          style={{
            ...Body({
              fontSize: 38,
              textAlign: "center",
              maxWidth: 1300,
              opacity: captionIn,
            }),
          }}
        >
          Reducing insider loss up to 90%.
        </div>
        <div
          style={{
            ...Label({
              fontSize: 15,
              opacity: asterIn * 0.7,
              letterSpacing: "0.3em",
            }),
          }}
        >
          * modelled on replayed insider events across five exchanges
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─── Scene 7: CLOSING ────────────────────────────────────────────────────

const ClosingScene: React.FC<{ local: number; duration: number }> = ({
  local,
  duration,
}) => {
  const sweep = interpolate(local, [0, 40], [0, 1], {
    ...clamp,
    easing: ease3,
  });
  const shrink = interpolate(local, [70, duration - 4], [1, 0.3], clamp);
  const firstIn = interpolate(local, [10, 24], [0, 1], clamp);
  const firstOut = interpolate(local, [60, 74], [1, 0], clamp);
  const secondIn = interpolate(local, [64, 82], [0, 1], clamp);
  const logoIn = interpolate(local, [86, 106], [0, 1], clamp);
  const fadeOut = interpolate(local, [duration - 18, duration], [1, 0], clamp);

  return (
    <AbsoluteFill style={{ opacity: fadeOut }}>
      {/* Rectangle sweeps, then contracts */}
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

      {/* First statement */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: firstIn * firstOut,
        }}
      >
        <div
          style={{
            ...Title({
              fontSize: 96,
              textAlign: "center",
              maxWidth: 1600,
            }),
          }}
        >
          Not just insider protection.
        </div>
      </AbsoluteFill>

      {/* Second statement */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: secondIn,
        }}
      >
        <div
          style={{
            ...Title({
              fontSize: 120,
              textAlign: "center",
              maxWidth: 1600,
            }),
          }}
        >
          A new trading standard.
        </div>
      </AbsoluteFill>

      {/* GM logo lockup */}
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
        <div style={Label({ fontSize: 22 })}>generalmarket.io</div>
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
  const sceneDuration = scene.end - scene.start;

  return (
    <AbsoluteFill style={{ background: BLACK, isolation: "isolate" }}>
      {activeKey === "intro" ? (
        <IntroScene local={sceneLocal} duration={sceneDuration} />
      ) : null}
      {activeKey === "contrast" ? (
        <ContrastScene local={sceneLocal} duration={sceneDuration} />
      ) : null}
      {activeKey === "point1" ? (
        <Point1Scene local={sceneLocal} duration={sceneDuration} />
      ) : null}
      {activeKey === "point2" ? (
        <Point2Scene local={sceneLocal} duration={sceneDuration} />
      ) : null}
      {activeKey === "point3" ? (
        <Point3Scene local={sceneLocal} duration={sceneDuration} />
      ) : null}
      {activeKey === "stat" ? (
        <StatScene local={sceneLocal} duration={sceneDuration} />
      ) : null}
      {activeKey === "closing" ? (
        <ClosingScene local={sceneLocal} duration={sceneDuration} />
      ) : null}
    </AbsoluteFill>
  );
};
