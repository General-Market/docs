import React from "react";
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { CascadeText } from "../../lib/components/Text";
import type { CascadeTextProps } from "../../lib/components/Text";

const { fontFamily: INTER } = loadInter("normal", {
  subsets: ["latin"],
  weights: ["400", "500", "600", "700", "800", "900"],
});

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const BLACK = "#000000";
const WHITE = "#ffffff";
const DIM = "rgba(255,255,255,0.42)";

// ─── Scene timings ───────────────────────────────────────────────────────
export const PITCH_SCENES = {
  intro: { start: 0, end: 96 },
  contrast: { start: 96, end: 216 },
  point1: { start: 216, end: 356 },
  point2: { start: 356, end: 496 },
  point3: { start: 496, end: 636 },
  stat: { start: 636, end: 748 },
  closing: { start: 748, end: 860 },
} as const;

export const PITCH_DURATION = PITCH_SCENES.closing.end;

// ─── TimedCascadeText — Sequence-wrapped CascadeText ─────────────────────

interface TimedCascadeProps extends CascadeTextProps {
  from: number;
  duration: number;
}

const TimedCascade: React.FC<TimedCascadeProps> = ({
  from,
  duration,
  ...rest
}) => (
  <Sequence from={from} durationInFrames={duration} layout="none">
    <CascadeText {...rest} />
  </Sequence>
);

// BlendText — everything typographic flows through here. White text with
// mix-blend-mode: difference. Over the black page: visible as white. Over
// a white shape: inverts to black. Works with the cascade animation.
const BlendText: React.FC<TimedCascadeProps> = (props) => (
  <div
    style={{
      mixBlendMode: "difference",
      color: WHITE,
      isolation: "isolate",
    }}
  >
    <TimedCascade {...props} color={WHITE} />
  </div>
);

// ─── Ambient chrome — corner labels + timecode ───────────────────────────

const Chrome: React.FC<{ pitchLocal: number }> = ({ pitchLocal }) => {
  const totalSeconds = Math.floor(pitchLocal / 30);
  const mm = String(Math.floor(totalSeconds / 60));
  const ss = String(totalSeconds % 60).padStart(2, "0");

  const labelStyle: React.CSSProperties = {
    position: "absolute",
    fontFamily: INTER,
    fontWeight: 700,
    fontSize: 16,
    letterSpacing: "0.36em",
    color: WHITE,
    mixBlendMode: "difference",
    textTransform: "uppercase",
  };

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ ...labelStyle, top: 48, left: 56 }}>
        Insider Trading · 2026
      </div>
      <div style={{ ...labelStyle, top: 48, right: 56, letterSpacing: "0.5em" }}>
        GM / 01
      </div>
      <div
        style={{
          ...labelStyle,
          bottom: 48,
          left: "50%",
          transform: "translateX(-50%)",
          letterSpacing: "0.5em",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {mm}:{ss}
      </div>
      <div style={{ ...labelStyle, bottom: 48, left: 56, letterSpacing: "0.4em" }}>
        generalmarket.io
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene 1: INTRO — single circle opens ────────────────────────────────

const IntroScene: React.FC<{
  local: number;
  sceneStart: number;
  duration: number;
}> = ({ local, sceneStart, duration }) => {
  const circleR = interpolate(local, [0, 46], [0, 620], {
    ...clamp,
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });
  const circleExit = interpolate(local, [duration - 20, duration], [1, 0], clamp);
  const barWidth = interpolate(local, [50, 72], [0, 1200], clamp);
  const fadeOut = interpolate(local, [duration - 14, duration], [1, 0], clamp);

  return (
    <AbsoluteFill style={{ opacity: fadeOut }}>
      {/* Shape layer — white circle growing */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: circleExit,
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

      {/* Text layer — inverts where shapes are white */}
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 48,
        }}
      >
        <BlendText
          from={sceneStart + 6}
          duration={duration}
          text="GENERAL MARKET"
          maxWidth={1600}
          fontFamily={INTER}
          fontSize={184}
          fontWeight={900}
          letterSpacing="-0.04em"
          align="center"
          riseDistance={80}
          blurPx={14}
          delayPerWord={5}
          durationPerWord={26}
        />

        <div style={{ position: "relative", height: 140 }}>
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: barWidth,
              height: 130,
              background: WHITE,
            }}
          />
          <div style={{ position: "relative", zIndex: 2 }}>
            <BlendText
              from={sceneStart + 54}
              duration={duration - 54}
              text="fights back"
              maxWidth={1200}
              fontFamily={INTER}
              fontSize={108}
              fontWeight={900}
              letterSpacing="-0.03em"
              align="center"
              riseDistance={60}
              blurPx={12}
              delayPerWord={4}
              durationPerWord={22}
            />
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─── Scene 2: CONTRAST — many small circles vs one big circle ───────────

const ContrastScene: React.FC<{
  local: number;
  sceneStart: number;
  duration: number;
  fps: number;
}> = ({ local, sceneStart, duration, fps }) => {
  const leftIn = spring({
    frame: local,
    fps,
    config: { damping: 18, stiffness: 130 },
  });
  const rightIn = spring({
    frame: Math.max(0, local - 42),
    fps,
    config: { damping: 16, stiffness: 110 },
  });
  const bigCircle = interpolate(local, [42, 96], [0, 460], {
    ...clamp,
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });
  const fadeOut = interpolate(local, [duration - 18, duration], [1, 0], clamp);

  const smallRs = [60, 48, 72, 54, 66];
  const positions = [
    { x: 0.18, y: 0.32 },
    { x: 0.32, y: 0.58 },
    { x: 0.08, y: 0.68 },
    { x: 0.26, y: 0.42 },
    { x: 0.14, y: 0.50 },
  ];

  return (
    <AbsoluteFill style={{ opacity: fadeOut }}>
      {/* LEFT — scattered small circles, fighting each other */}
      <AbsoluteFill>
        {positions.map((p, i) => {
          const appear = interpolate(
            local,
            [i * 4, 18 + i * 4],
            [0, 1],
            clamp,
          );
          const rOsc = smallRs[i] + Math.sin((local + i * 10) * 0.08) * 4;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: `${p.x * 100}%`,
                top: `${p.y * 100}%`,
                width: rOsc * 2 * appear,
                height: rOsc * 2 * appear,
                transform: "translate(-50%, -50%)",
                borderRadius: "50%",
                background: WHITE,
                opacity: leftIn,
              }}
            />
          );
        })}
      </AbsoluteFill>

      {/* RIGHT — one giant circle */}
      <AbsoluteFill>
        <div
          style={{
            position: "absolute",
            right: -40,
            top: "50%",
            transform: "translateY(-50%)",
            width: bigCircle * 2,
            height: bigCircle * 2,
            borderRadius: "50%",
            background: WHITE,
            opacity: rightIn,
          }}
        />
      </AbsoluteFill>

      {/* Text layer — left column then right column */}
      <AbsoluteFill
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          alignItems: "center",
          padding: "140px 120px",
          boxSizing: "border-box",
          gap: 80,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <BlendText
            from={sceneStart}
            duration={duration}
            text="EVERY EXCHANGE"
            maxWidth={640}
            fontFamily={INTER}
            fontSize={26}
            fontWeight={700}
            letterSpacing="0.32em"
            align="left"
            riseDistance={24}
            blurPx={6}
            delayPerWord={2}
            durationPerWord={16}
          />
          <BlendText
            from={sceneStart + 6}
            duration={duration - 6}
            text="lets insiders eat first."
            maxWidth={720}
            fontFamily={INTER}
            fontSize={88}
            fontWeight={900}
            letterSpacing="-0.03em"
            align="left"
            riseDistance={70}
            blurPx={14}
            delayPerWord={3}
            durationPerWord={24}
          />
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 28,
            alignItems: "flex-start",
          }}
        >
          <BlendText
            from={sceneStart + 36}
            duration={duration - 36}
            text="GENERAL MARKET"
            maxWidth={640}
            fontFamily={INTER}
            fontSize={26}
            fontWeight={700}
            letterSpacing="0.32em"
            align="left"
            riseDistance={24}
            blurPx={6}
            delayPerWord={2}
            durationPerWord={16}
          />
          <BlendText
            from={sceneStart + 42}
            duration={duration - 42}
            text="the first market to eliminate them."
            maxWidth={760}
            fontFamily={INTER}
            fontSize={88}
            fontWeight={900}
            letterSpacing="-0.03em"
            align="left"
            riseDistance={70}
            blurPx={14}
            delayPerWord={3}
            durationPerWord={24}
          />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─── Scene 3: DERIVATIVE — two circles overlap, labels sit inside ────────

const Point1Scene: React.FC<{
  local: number;
  sceneStart: number;
  duration: number;
  fps: number;
}> = ({ local, sceneStart, duration, fps }) => {
  const headIn = spring({
    frame: local,
    fps,
    config: { damping: 18, stiffness: 120 },
  });
  const leftCircle = interpolate(local, [14, 56], [0, 320], {
    ...clamp,
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });
  const rightCircle = interpolate(local, [40, 88], [0, 320], {
    ...clamp,
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });
  const drift = interpolate(local, [60, duration], [0, 120], clamp);
  const fadeOut = interpolate(local, [duration - 18, duration], [1, 0], clamp);

  return (
    <AbsoluteFill style={{ opacity: fadeOut }}>
      {/* Headline — above circles, blends with whatever's behind */}
      <AbsoluteFill
        style={{
          display: "flex",
          justifyContent: "center",
          paddingTop: 140,
        }}
      >
        <div style={{ opacity: headIn }}>
          <BlendText
            from={sceneStart + 6}
            duration={duration - 6}
            text="A derivative on top of every market."
            maxWidth={1500}
            fontFamily={INTER}
            fontSize={84}
            fontWeight={900}
            letterSpacing="-0.03em"
            align="center"
            riseDistance={70}
            blurPx={14}
            delayPerWord={3}
            durationPerWord={22}
          />
        </div>
      </AbsoluteFill>

      {/* Two overlapping white circles — classic venn */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ position: "relative", width: 900, height: 500 }}>
          <div
            style={{
              position: "absolute",
              left: 120 - drift,
              top: 60,
              width: leftCircle * 2,
              height: leftCircle * 2,
              borderRadius: "50%",
              background: WHITE,
              transform: "translate(-50%, 0)",
            }}
          />
          <div
            style={{
              position: "absolute",
              right: 120 - drift,
              top: 60,
              width: rightCircle * 2,
              height: rightCircle * 2,
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
            height: 500,
            display: "flex",
            alignItems: "center",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 10 - drift,
              top: 240,
              width: 340,
              textAlign: "center",
            }}
          >
            <BlendText
              from={sceneStart + 32}
              duration={duration - 32}
              text="ORIGINAL"
              maxWidth={340}
              fontFamily={INTER}
              fontSize={64}
              fontWeight={900}
              letterSpacing="-0.02em"
              align="center"
              riseDistance={40}
              blurPx={10}
              delayPerWord={2}
              durationPerWord={18}
            />
          </div>
          <div
            style={{
              position: "absolute",
              right: 10 - drift,
              top: 240,
              width: 360,
              textAlign: "center",
            }}
          >
            <BlendText
              from={sceneStart + 58}
              duration={duration - 58}
              text="DERIVATIVE"
              maxWidth={360}
              fontFamily={INTER}
              fontSize={64}
              fontWeight={900}
              letterSpacing="-0.02em"
              align="center"
              riseDistance={40}
              blurPx={10}
              delayPerWord={2}
              durationPerWord={18}
            />
          </div>
        </div>
      </AbsoluteFill>

      {/* Caption */}
      <AbsoluteFill
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-end",
          paddingBottom: 160,
        }}
      >
        <BlendText
          from={sceneStart + 100}
          duration={duration - 100}
          text="Same assets. No edge leaks through."
          maxWidth={1400}
          fontFamily={INTER}
          fontSize={36}
          fontWeight={600}
          letterSpacing="-0.01em"
          align="center"
          riseDistance={30}
          blurPx={8}
          delayPerWord={3}
          durationPerWord={22}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─── Scene 4: 1,000 CLUSTERS — one big circle full of dots ───────────────

const Point2Scene: React.FC<{
  local: number;
  sceneStart: number;
  duration: number;
  fps: number;
}> = ({ local, sceneStart, duration, fps }) => {
  const headIn = spring({
    frame: local,
    fps,
    config: { damping: 18, stiffness: 120 },
  });
  const circleR = interpolate(local, [20, 80], [0, 380], {
    ...clamp,
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });
  const insiderAppear = interpolate(local, [100, 124], [0, 1], clamp);
  const fadeOut = interpolate(local, [duration - 18, duration], [1, 0], clamp);

  // 80 scattered mini-dots OUTSIDE the circle (black field decoration)
  const fieldDots = React.useMemo(() => {
    const out: { x: number; y: number; r: number }[] = [];
    for (let i = 0; i < 60; i++) {
      const angle = (i / 60) * Math.PI * 2;
      const dist = 560 + ((i * 83) % 260);
      out.push({
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist * 0.56,
        r: 2 + ((i * 17) % 4),
      });
    }
    return out;
  }, []);

  return (
    <AbsoluteFill style={{ opacity: fadeOut }}>
      {/* Headline at top */}
      <AbsoluteFill
        style={{
          display: "flex",
          justifyContent: "center",
          paddingTop: 130,
        }}
      >
        <div style={{ opacity: headIn }}>
          <BlendText
            from={sceneStart + 6}
            duration={duration - 6}
            text="every trade spread across"
            maxWidth={1500}
            fontFamily={INTER}
            fontSize={56}
            fontWeight={600}
            letterSpacing="-0.01em"
            align="center"
            riseDistance={40}
            blurPx={10}
            delayPerWord={3}
            durationPerWord={20}
          />
        </div>
      </AbsoluteFill>

      {/* Field dots (tiny white dots scattered) */}
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
              [20 + i * 0.4, 36 + i * 0.4],
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
                  opacity: 0.8,
                }}
              />
            );
          })}
        </div>
      </AbsoluteFill>

      {/* Big central white circle */}
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
          {/* Insider dot — a black void inside the white */}
          <div
            style={{
              position: "absolute",
              right: "22%",
              top: "38%",
              width: 22 * insiderAppear,
              height: 22 * insiderAppear,
              borderRadius: "50%",
              background: BLACK,
              transform: "translate(50%, -50%)",
            }}
          />
        </div>
      </AbsoluteFill>

      {/* Big "1,000" on top of the circle, inverts */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <BlendText
          from={sceneStart + 46}
          duration={duration - 46}
          text="1,000"
          maxWidth={800}
          fontFamily={INTER}
          fontSize={280}
          fontWeight={900}
          letterSpacing="-0.05em"
          align="center"
          riseDistance={80}
          blurPx={18}
          delayPerWord={0}
          durationPerWord={28}
        />
      </AbsoluteFill>

      {/* "CLUSTERS" label under 1,000 */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          paddingTop: 340,
        }}
      >
        <BlendText
          from={sceneStart + 70}
          duration={duration - 70}
          text="clusters per trade"
          maxWidth={900}
          fontFamily={INTER}
          fontSize={38}
          fontWeight={600}
          letterSpacing="0.24em"
          align="center"
          riseDistance={30}
          blurPx={8}
          delayPerWord={2}
          durationPerWord={18}
        />
      </AbsoluteFill>

      {/* Insider pointer — small callout */}
      <AbsoluteFill
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "flex-start",
          paddingTop: 280,
          paddingRight: 200,
          opacity: insiderAppear,
        }}
      >
        <div style={{ textAlign: "left" }}>
          <BlendText
            from={sceneStart + 104}
            duration={duration - 104}
            text="INSIDER · 1 OF 1,000"
            maxWidth={400}
            fontFamily={INTER}
            fontSize={18}
            fontWeight={700}
            letterSpacing="0.28em"
            align="left"
            riseDistance={20}
            blurPx={6}
            delayPerWord={2}
            durationPerWord={14}
          />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─── Scene 5: BOT vs INDUSTRY — two circles, sized ───────────────────────

const Point3Scene: React.FC<{
  local: number;
  sceneStart: number;
  duration: number;
  fps: number;
}> = ({ local, sceneStart, duration, fps }) => {
  const headIn = spring({
    frame: local,
    fps,
    config: { damping: 18, stiffness: 120 },
  });
  const smallR = interpolate(local, [20, 50], [0, 72], {
    ...clamp,
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });
  const bigR = interpolate(local, [44, 106], [0, 420], {
    ...clamp,
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });
  const fadeOut = interpolate(local, [duration - 18, duration], [1, 0], clamp);

  const industryLabel = "48,000";
  const gmLabel = "520,000";

  return (
    <AbsoluteFill style={{ opacity: fadeOut }}>
      {/* Top headline */}
      <AbsoluteFill
        style={{
          display: "flex",
          justifyContent: "center",
          paddingTop: 130,
        }}
      >
        <div style={{ opacity: headIn }}>
          <BlendText
            from={sceneStart + 6}
            duration={duration - 6}
            text="one bot · more than the entire industry"
            maxWidth={1500}
            fontFamily={INTER}
            fontSize={56}
            fontWeight={600}
            letterSpacing="-0.01em"
            align="center"
            riseDistance={40}
            blurPx={10}
            delayPerWord={3}
            durationPerWord={20}
          />
        </div>
      </AbsoluteFill>

      {/* Circles positioned */}
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
            width: 1500,
            height: 640,
          }}
        >
          {/* Small — industry */}
          <div
            style={{
              position: "absolute",
              left: 180,
              top: 320 - smallR,
              width: smallR * 2,
              height: smallR * 2,
              borderRadius: "50%",
              background: WHITE,
            }}
          />
          {/* Big — GM bot */}
          <div
            style={{
              position: "absolute",
              right: 120,
              top: 320 - bigR,
              width: bigR * 2,
              height: bigR * 2,
              borderRadius: "50%",
              background: WHITE,
            }}
          />
        </div>
      </AbsoluteFill>

      {/* Labels aligned to circles */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ position: "relative", width: 1500, height: 640 }}>
          {/* Industry label — below small circle */}
          <div
            style={{
              position: "absolute",
              left: 80,
              top: 460,
              width: 260,
            }}
          >
            <BlendText
              from={sceneStart + 40}
              duration={duration - 40}
              text="INDUSTRY · PER DAY"
              maxWidth={260}
              fontFamily={INTER}
              fontSize={16}
              fontWeight={700}
              letterSpacing="0.28em"
              align="center"
              riseDistance={20}
              blurPx={6}
              delayPerWord={2}
              durationPerWord={14}
            />
            <div style={{ marginTop: 12 }}>
              <BlendText
                from={sceneStart + 44}
                duration={duration - 44}
                text={industryLabel}
                maxWidth={260}
                fontFamily={INTER}
                fontSize={48}
                fontWeight={900}
                letterSpacing="-0.02em"
                align="center"
                riseDistance={28}
                blurPx={8}
                delayPerWord={2}
                durationPerWord={18}
              />
            </div>
          </div>

          {/* GM label — inside the big circle */}
          <div
            style={{
              position: "absolute",
              right: 120,
              top: 280,
              width: 620,
              transform: "translateX(50%)",
              marginRight: -310,
            }}
          >
            <BlendText
              from={sceneStart + 82}
              duration={duration - 82}
              text={gmLabel}
              maxWidth={620}
              fontFamily={INTER}
              fontSize={140}
              fontWeight={900}
              letterSpacing="-0.04em"
              align="center"
              riseDistance={60}
              blurPx={14}
              delayPerWord={2}
              durationPerWord={22}
            />
            <div style={{ marginTop: 6 }}>
              <BlendText
                from={sceneStart + 100}
                duration={duration - 100}
                text="GM BOT · PER DAY"
                maxWidth={620}
                fontFamily={INTER}
                fontSize={18}
                fontWeight={700}
                letterSpacing="0.32em"
                align="center"
                riseDistance={20}
                blurPx={6}
                delayPerWord={2}
                durationPerWord={14}
              />
            </div>
          </div>
        </div>
      </AbsoluteFill>

      {/* Caption bottom */}
      <AbsoluteFill
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-end",
          paddingBottom: 140,
        }}
      >
        <BlendText
          from={sceneStart + 120}
          duration={duration - 120}
          text="more positions in a day than every prediction market combined."
          maxWidth={1400}
          fontFamily={INTER}
          fontSize={30}
          fontWeight={500}
          letterSpacing="-0.005em"
          align="center"
          riseDistance={30}
          blurPx={8}
          delayPerWord={3}
          durationPerWord={22}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─── Scene 6: STAT — huge circle with 90% inside ─────────────────────────

const StatScene: React.FC<{
  local: number;
  sceneStart: number;
  duration: number;
  fps: number;
}> = ({ local, sceneStart, duration, fps }) => {
  const circleR = interpolate(local, [0, 60], [0, 380], {
    ...clamp,
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });
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

      {/* 90% text */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <BlendText
          from={sceneStart + 18}
          duration={duration - 18}
          text="90%"
          maxWidth={800}
          fontFamily={INTER}
          fontSize={340}
          fontWeight={900}
          letterSpacing="-0.05em"
          align="center"
          riseDistance={80}
          blurPx={18}
          delayPerWord={0}
          durationPerWord={28}
        />
      </AbsoluteFill>

      {/* Sub-caption below */}
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-end",
          paddingBottom: 160,
          gap: 10,
        }}
      >
        <BlendText
          from={sceneStart + 44}
          duration={duration - 44}
          text="LOSS CUT"
          maxWidth={700}
          fontFamily={INTER}
          fontSize={28}
          fontWeight={700}
          letterSpacing="0.4em"
          align="center"
          riseDistance={24}
          blurPx={6}
          delayPerWord={2}
          durationPerWord={16}
        />
        <BlendText
          from={sceneStart + 68}
          duration={duration - 68}
          text="insider bleed, reduced by up to 90%."
          maxWidth={1300}
          fontFamily={INTER}
          fontSize={38}
          fontWeight={600}
          letterSpacing="-0.01em"
          align="center"
          riseDistance={30}
          blurPx={8}
          delayPerWord={3}
          durationPerWord={22}
        />
        <div
          style={{
            marginTop: 10,
            fontFamily: INTER,
            fontSize: 15,
            fontWeight: 500,
            color: DIM,
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            mixBlendMode: "difference",
          }}
        >
          * modelled on replayed insider events across five exchanges
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─── Scene 7: CLOSING — rectangle sweeps across, logo lands ──────────────

const ClosingScene: React.FC<{
  local: number;
  sceneStart: number;
  duration: number;
}> = ({ local, sceneStart, duration }) => {
  const sweep = interpolate(local, [0, 40], [0, 1], {
    ...clamp,
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });
  const shrink = interpolate(local, [70, duration], [1, 0.35], clamp);
  const logoShow = interpolate(local, [80, 100], [0, 1], clamp);
  const fadeOut = interpolate(local, [duration - 20, duration], [1, 0], clamp);

  return (
    <AbsoluteFill style={{ opacity: fadeOut }}>
      {/* Rectangle sweep then contract into a small bar */}
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

      {/* First statement — inside the rectangle while it's big */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: interpolate(local, [10, 20, 64, 76], [0, 1, 1, 0], clamp),
        }}
      >
        <BlendText
          from={sceneStart + 10}
          duration={76 - 10}
          text="a new trading standard."
          maxWidth={1500}
          fontFamily={INTER}
          fontSize={128}
          fontWeight={900}
          letterSpacing="-0.04em"
          align="center"
          riseDistance={80}
          blurPx={16}
          delayPerWord={3}
          durationPerWord={24}
        />
      </AbsoluteFill>

      {/* Final GM lockup below the contracted bar */}
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          paddingTop: 240,
          gap: 24,
          opacity: logoShow,
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
        <BlendText
          from={sceneStart + 84}
          duration={duration - 84}
          text="generalmarket.io"
          maxWidth={700}
          fontFamily={INTER}
          fontSize={32}
          fontWeight={700}
          letterSpacing="0.1em"
          align="center"
          riseDistance={24}
          blurPx={6}
          delayPerWord={2}
          durationPerWord={16}
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
  const { fps } = useVideoConfig();
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
          fps={fps}
        />
      ) : null}
      {activeKey === "point1" ? (
        <Point1Scene
          local={sceneLocal}
          sceneStart={sceneStartAbs}
          duration={sceneDuration}
          fps={fps}
        />
      ) : null}
      {activeKey === "point2" ? (
        <Point2Scene
          local={sceneLocal}
          sceneStart={sceneStartAbs}
          duration={sceneDuration}
          fps={fps}
        />
      ) : null}
      {activeKey === "point3" ? (
        <Point3Scene
          local={sceneLocal}
          sceneStart={sceneStartAbs}
          duration={sceneDuration}
          fps={fps}
        />
      ) : null}
      {activeKey === "stat" ? (
        <StatScene
          local={sceneLocal}
          sceneStart={sceneStartAbs}
          duration={sceneDuration}
          fps={fps}
        />
      ) : null}
      {activeKey === "closing" ? (
        <ClosingScene
          local={sceneLocal}
          sceneStart={sceneStartAbs}
          duration={sceneDuration}
        />
      ) : null}

      <Chrome pitchLocal={local} />
    </AbsoluteFill>
  );
};
