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
          text="fights back."
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
  const bigCircle = interpolate(local, [40, 100], [0, 520], {
    ...clamp,
    easing: ease3,
  });
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
      {/* SHAPES */}
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

      {/* TEXT */}
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
            text="allows insider trading."
            revealDuration={36}
            seed={5}
            style={{
              fontSize: 84,
              fontWeight: 900,
              letterSpacing: "-0.03em",
              lineHeight: 1,
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
            text="the first to eliminate insiders."
            revealDuration={40}
            seed={17}
            style={{
              fontSize: 84,
              fontWeight: 900,
              letterSpacing: "-0.03em",
              lineHeight: 1,
            }}
          />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─── Scene 3: POINT 1 — Derivative on top ────────────────────────────────

const Point1Scene: React.FC<{
  local: number;
  sceneStart: number;
  duration: number;
}> = ({ local, sceneStart, duration }) => {
  const leftC = interpolate(local, [10, 60], [0, 280], {
    ...clamp,
    easing: ease3,
  });
  const rightC = interpolate(local, [36, 86], [0, 280], {
    ...clamp,
    easing: ease3,
  });
  const fadeOut = interpolate(local, [duration - 18, duration], [1, 0], clamp);

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

      {/* TEXT */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          paddingTop: 140,
        }}
      >
        <Reveal
          from={sceneStart + 6}
          duration={duration - 6}
          text="1. A derivative on top of every market."
          revealDuration={50}
          seed={31}
          style={{
            fontSize: 72,
            fontWeight: 900,
            letterSpacing: "-0.03em",
            textAlign: "center",
            maxWidth: 1400,
            lineHeight: 1,
          }}
        />
      </AbsoluteFill>

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
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 260,
              width: 260,
              textAlign: "center",
            }}
          >
            <Reveal
              from={sceneStart + 70}
              duration={duration - 70}
              text="Original"
              revealDuration={26}
              seed={41}
              style={{
                fontSize: 56,
                fontWeight: 900,
                letterSpacing: "-0.02em",
                display: "inline-block",
              }}
            />
          </div>
          <div
            style={{
              position: "absolute",
              right: 0,
              top: 260,
              width: 300,
              textAlign: "center",
            }}
          >
            <Reveal
              from={sceneStart + 86}
              duration={duration - 86}
              text="Derivative"
              revealDuration={28}
              seed={47}
              style={{
                fontSize: 56,
                fontWeight: 900,
                letterSpacing: "-0.02em",
                display: "inline-block",
              }}
            />
          </div>
        </div>
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          paddingBottom: 140,
        }}
      >
        <Reveal
          from={sceneStart + 100}
          duration={duration - 100}
          text="You trade the same assets — without insiders."
          revealDuration={46}
          seed={53}
          style={{
            fontSize: 38,
            fontWeight: 600,
            letterSpacing: "-0.01em",
            textAlign: "center",
            maxWidth: 1400,
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─── Scene 4: POINT 2 — Clusters of 1,000 ────────────────────────────────

const Point2Scene: React.FC<{
  local: number;
  sceneStart: number;
  duration: number;
}> = ({ local, sceneStart, duration }) => {
  const circleR = interpolate(local, [14, 74], [0, 380], {
    ...clamp,
    easing: ease3,
  });
  const insiderDot = interpolate(local, [86, 108], [0, 1], clamp);
  const fadeOut = interpolate(local, [duration - 18, duration], [1, 0], clamp);

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
      {/* SHAPES */}
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

      {/* TEXT */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          paddingTop: 120,
        }}
      >
        <Reveal
          from={sceneStart + 6}
          duration={duration - 6}
          text="2. Trades clustered in 1,000."
          revealDuration={46}
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
          text="1,000"
          revealDuration={24}
          seed={67}
          style={{
            fontSize: 260,
            fontWeight: 900,
            letterSpacing: "-0.04em",
            textAlign: "center",
          }}
        />
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          paddingTop: 340,
        }}
      >
        <Reveal
          from={sceneStart + 72}
          duration={duration - 72}
          text="Clusters per trade"
          revealDuration={30}
          seed={71}
          style={{
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: "0.3em",
            textTransform: "uppercase",
          }}
        />
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "flex-start",
          paddingTop: 300,
          paddingRight: 220,
        }}
      >
        <Reveal
          from={sceneStart + 108}
          duration={duration - 108}
          text="Insider · 1 of 1,000"
          revealDuration={26}
          seed={73}
          style={{
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: "0.28em",
            textTransform: "uppercase",
          }}
        />
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          paddingBottom: 120,
        }}
      >
        <Reveal
          from={sceneStart + 116}
          duration={duration - 116}
          text="Insiders control 1 asset. Not 1,000."
          revealDuration={42}
          seed={79}
          style={{
            fontSize: 36,
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

// ─── Scene 5: POINT 3 — Bot vs industry ──────────────────────────────────

const Point3Scene: React.FC<{
  local: number;
  sceneStart: number;
  duration: number;
}> = ({ local, sceneStart, duration }) => {
  const smallR = interpolate(local, [16, 48], [0, 72], {
    ...clamp,
    easing: ease3,
  });
  const bigR = interpolate(local, [44, 104], [0, 420], {
    ...clamp,
    easing: ease3,
  });
  const fadeOut = interpolate(local, [duration - 18, duration], [1, 0], clamp);

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

      {/* TEXT */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          paddingTop: 120,
        }}
      >
        <Reveal
          from={sceneStart + 6}
          duration={duration - 6}
          text="3. More positions than the entire prediction market industry."
          revealDuration={56}
          seed={83}
          style={{
            fontSize: 64,
            fontWeight: 900,
            letterSpacing: "-0.03em",
            textAlign: "center",
            maxWidth: 1600,
            lineHeight: 1,
          }}
        />
      </AbsoluteFill>

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
              left: 100,
              top: 440,
              width: 300,
              textAlign: "center",
            }}
          >
            <Reveal
              from={sceneStart + 40}
              duration={duration - 40}
              text="Industry · per day"
              revealDuration={28}
              seed={89}
              style={{
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: "0.28em",
                textTransform: "uppercase",
              }}
            />
            <div style={{ marginTop: 10 }}>
              <Reveal
                from={sceneStart + 44}
                duration={duration - 44}
                text="48,000"
                revealDuration={22}
                seed={97}
                style={{
                  fontSize: 52,
                  fontWeight: 900,
                  letterSpacing: "-0.02em",
                }}
              />
            </div>
          </div>

          <div
            style={{
              position: "absolute",
              right: 140,
              top: 260,
              width: 500,
              transform: "translateX(50%)",
              marginRight: -250,
              textAlign: "center",
            }}
          >
            <Reveal
              from={sceneStart + 84}
              duration={duration - 84}
              text="520,000"
              revealDuration={30}
              seed={101}
              style={{
                fontSize: 128,
                fontWeight: 900,
                letterSpacing: "-0.04em",
              }}
            />
            <div style={{ marginTop: 8 }}>
              <Reveal
                from={sceneStart + 104}
                duration={duration - 104}
                text="GM bot · per day"
                revealDuration={26}
                seed={103}
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  letterSpacing: "0.3em",
                  textTransform: "uppercase",
                }}
              />
            </div>
          </div>
        </div>
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          paddingBottom: 130,
        }}
      >
        <Reveal
          from={sceneStart + 120}
          duration={duration - 120}
          text="One General Market bot. More trades than every platform combined."
          revealDuration={54}
          seed={107}
          style={{
            fontSize: 32,
            fontWeight: 600,
            letterSpacing: "-0.01em",
            textAlign: "center",
            maxWidth: 1400,
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
          text="90%"
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
          text="Loss cut"
          revealDuration={22}
          seed={113}
          style={{
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: "0.36em",
            textTransform: "uppercase",
          }}
        />
        <Reveal
          from={sceneStart + 70}
          duration={duration - 70}
          text="Reducing insider loss up to 90%."
          revealDuration={44}
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
          from={sceneStart + 88}
          duration={duration - 88}
          text="* modelled on replayed insider events across five exchanges"
          revealDuration={38}
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
          text="Not just insider protection."
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
          text="A new trading standard."
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
