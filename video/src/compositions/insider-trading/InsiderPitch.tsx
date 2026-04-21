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

const BRAND = "#00C853";
const DANGER = "#ff3a4c";
const INK = "#0a0a0a";
const WHITE = "#fafafa";
const DIM = "rgba(255,255,255,0.55)";
const PAPER = "#f3f2ec";

// ─── Scene timings (local frames relative to pitch start) ─────────────────
export const PITCH_SCENES = {
  intro: { start: 0, end: 72 },
  contrast: { start: 72, end: 192 },
  point1: { start: 192, end: 332 },
  point2: { start: 332, end: 472 },
  point3: { start: 472, end: 612 },
  stat: { start: 612, end: 712 },
  closing: { start: 712, end: 820 },
} as const;

export const PITCH_DURATION = PITCH_SCENES.closing.end;

// ─── TimedCascadeText — resets CascadeText's frame clock to `from` ────────

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

// ─── Small primitives ────────────────────────────────────────────────────

const StepBadge: React.FC<{ n: number; total: number; appear: number }> = ({
  n,
  total,
  appear,
}) => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 14,
      padding: "10px 22px",
      borderRadius: 999,
      border: `1px solid ${BRAND}`,
      background: "rgba(0,200,83,0.08)",
      color: BRAND,
      fontFamily: INTER,
      fontWeight: 700,
      fontSize: 18,
      letterSpacing: "0.3em",
      textTransform: "uppercase",
      opacity: appear,
      transform: `translateY(${interpolate(appear, [0, 1], [8, 0])}px)`,
    }}
  >
    <span
      style={{
        width: 8,
        height: 8,
        background: BRAND,
        borderRadius: "50%",
        boxShadow: `0 0 10px ${BRAND}`,
      }}
    />
    {String(n).padStart(2, "0")} / {String(total).padStart(2, "0")}
  </div>
);

// ─── Scene 1: Intro "General Market fights back" ─────────────────────────

const IntroScene: React.FC<{
  local: number;
  sceneStart: number;
  duration: number;
}> = ({ local, sceneStart, duration }) => {
  const strikeReveal = interpolate(local, [28, 58], [0, 1], clamp);
  const lineSweep = interpolate(local, [6, 34], [0, 1], clamp);
  const fadeOut = interpolate(local, [duration - 14, duration], [1, 0], clamp);

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: fadeOut,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 40,
        }}
      >
        <div
          style={{
            width: 540 * lineSweep,
            height: 2,
            background: `linear-gradient(90deg, transparent, ${BRAND}, transparent)`,
          }}
        />

        <TimedCascade
          from={sceneStart}
          duration={duration}
          text="GENERAL MARKET"
          maxWidth={1600}
          fontFamily={INTER}
          fontSize={168}
          fontWeight={900}
          color={WHITE}
          letterSpacing="-0.03em"
          align="center"
          riseDistance={90}
          blurPx={16}
          delayPerWord={5}
          durationPerWord={26}
        />

        <div style={{ position: "relative" }}>
          <TimedCascade
            from={sceneStart + 18}
            duration={duration - 18}
            text="fights back."
            maxWidth={900}
            fontFamily={INTER}
            fontSize={120}
            fontWeight={900}
            color={DANGER}
            letterSpacing="-0.02em"
            align="center"
            riseDistance={80}
            blurPx={14}
            delayPerWord={4}
            durationPerWord={24}
          />
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: -14,
              height: 10,
              background: DANGER,
              transform: `scaleX(${strikeReveal})`,
              transformOrigin: "left center",
              boxShadow: `0 0 18px ${DANGER}aa`,
            }}
          />
        </div>

        <div
          style={{
            width: 540 * lineSweep,
            height: 2,
            background: `linear-gradient(90deg, transparent, ${BRAND}, transparent)`,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene 2: Contrast — Every exchange vs GM ────────────────────────────

const ContrastScene: React.FC<{
  local: number;
  sceneStart: number;
  duration: number;
  fps: number;
}> = ({ local, sceneStart, duration, fps }) => {
  const leftIn = spring({
    frame: local,
    fps,
    config: { damping: 18, stiffness: 130, mass: 0.8 },
  });
  const rightIn = spring({
    frame: Math.max(0, local - 30),
    fps,
    config: { damping: 18, stiffness: 130, mass: 0.8 },
  });
  const divider = interpolate(local, [20, 54], [0, 1], clamp);
  const crossReveal = interpolate(local, [40, 62], [0, 1], clamp);
  const checkReveal = interpolate(local, [60, 84], [0, 1], clamp);
  const fadeOut = interpolate(local, [duration - 16, duration], [1, 0], clamp);

  const exchanges = [
    { src: "logos/exchanges/binance.svg", pad: 20 },
    { src: "logos/exchanges/coinbase.svg", pad: 26 },
    { src: "logos/exchanges/polymarket-black.svg", pad: 24 },
    { src: "logos/exchanges/kalshi.svg", pad: 18 },
    { src: "logos/exchanges/robinhood.svg", pad: 26 },
  ];

  return (
    <AbsoluteFill
      style={{
        opacity: fadeOut,
        padding: "100px 140px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 2px 1fr",
          gap: 80,
          height: "100%",
          alignItems: "center",
        }}
      >
        {/* LEFT — every exchange */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 36,
            opacity: leftIn,
            transform: `translateX(${interpolate(leftIn, [0, 1], [-40, 0])}px)`,
          }}
        >
          <TimedCascade
            from={sceneStart}
            duration={duration}
            text="EVERY EXCHANGE"
            maxWidth={640}
            fontFamily={INTER}
            fontSize={26}
            fontWeight={700}
            color={DANGER}
            letterSpacing="0.28em"
            align="left"
            riseDistance={30}
            blurPx={8}
            delayPerWord={3}
            durationPerWord={18}
          />

          <TimedCascade
            from={sceneStart + 6}
            duration={duration - 6}
            text="allows insiders to eat first."
            maxWidth={720}
            fontFamily={INTER}
            fontSize={72}
            fontWeight={800}
            color={WHITE}
            letterSpacing="-0.02em"
            align="left"
            riseDistance={70}
            blurPx={12}
            delayPerWord={3}
            durationPerWord={22}
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              gap: 14,
              marginTop: 12,
            }}
          >
            {exchanges.map((ex, i) => {
              const tileIn = interpolate(
                local,
                [24 + i * 4, 36 + i * 4],
                [0, 1],
                clamp,
              );
              return (
                <div
                  key={ex.src}
                  style={{
                    position: "relative",
                    background: PAPER,
                    borderRadius: 12,
                    aspectRatio: "1 / 1",
                    padding: ex.pad,
                    boxSizing: "border-box",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: tileIn,
                    transform: `scale(${interpolate(tileIn, [0, 1], [0.82, 1])})`,
                    filter: `grayscale(${interpolate(crossReveal, [0, 1], [0, 0.8])})`,
                  }}
                >
                  <Img
                    src={staticFile(ex.src)}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                    }}
                  />
                  <svg
                    viewBox="0 0 100 100"
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      opacity: crossReveal,
                    }}
                  >
                    <line
                      x1="12"
                      y1="12"
                      x2="88"
                      y2="88"
                      stroke={DANGER}
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeDasharray="120"
                      strokeDashoffset={120 - 120 * crossReveal}
                    />
                    <line
                      x1="88"
                      y1="12"
                      x2="12"
                      y2="88"
                      stroke={DANGER}
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeDasharray="120"
                      strokeDashoffset={120 - 120 * Math.max(0, crossReveal - 0.2) * 1.25}
                    />
                  </svg>
                </div>
              );
            })}
          </div>
        </div>

        {/* DIVIDER */}
        <div
          style={{
            height: `${divider * 100}%`,
            width: 2,
            background: "rgba(255,255,255,0.18)",
            justifySelf: "center",
          }}
        />

        {/* RIGHT — General Market */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 36,
            opacity: rightIn,
            transform: `translateX(${interpolate(rightIn, [0, 1], [40, 0])}px)`,
          }}
        >
          <TimedCascade
            from={sceneStart + 30}
            duration={duration - 30}
            text="GENERAL MARKET"
            maxWidth={640}
            fontFamily={INTER}
            fontSize={26}
            fontWeight={700}
            color={BRAND}
            letterSpacing="0.28em"
            align="left"
            riseDistance={30}
            blurPx={8}
            delayPerWord={3}
            durationPerWord={18}
          />

          <TimedCascade
            from={sceneStart + 36}
            duration={duration - 36}
            text="The first market to eliminate insiders."
            maxWidth={780}
            fontFamily={INTER}
            fontSize={72}
            fontWeight={800}
            color={WHITE}
            letterSpacing="-0.02em"
            align="left"
            riseDistance={70}
            blurPx={12}
            delayPerWord={3}
            durationPerWord={22}
            boxStyle={{
              bg: "rgba(0,200,83,0.14)",
              color: BRAND,
              paddingX: 18,
              paddingY: 4,
              borderRadius: 12,
              glowColor: BRAND,
              glowRadius: 120,
            }}
          />

          <div
            style={{
              position: "relative",
              marginTop: 12,
              background: "rgba(0,200,83,0.08)",
              border: `1px solid ${BRAND}`,
              borderRadius: 20,
              padding: "40px 48px",
              display: "flex",
              alignItems: "center",
              gap: 28,
            }}
          >
            <Img
              src={staticFile("gm-logo.svg")}
              style={{
                width: 80,
                height: 80,
                filter: "drop-shadow(0 0 20px rgba(0,200,83,0.45))",
              }}
            />
            <div style={{ flex: 1 }}>
              <TimedCascade
                from={sceneStart + 60}
                duration={duration - 60}
                text="Every trader lands at the same moment."
                maxWidth={560}
                fontFamily={INTER}
                fontSize={28}
                fontWeight={700}
                color={WHITE}
                letterSpacing="-0.01em"
                align="left"
                riseDistance={40}
                blurPx={8}
                delayPerWord={2}
                durationPerWord={18}
              />
            </div>
            <svg
              viewBox="0 0 64 64"
              width={64}
              height={64}
              style={{ opacity: checkReveal }}
            >
              <circle cx="32" cy="32" r="28" fill={BRAND} opacity="0.18" />
              <path
                d="M18 33 L28 43 L46 23"
                stroke={BRAND}
                strokeWidth="6"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                strokeDasharray="60"
                strokeDashoffset={60 - 60 * checkReveal}
              />
            </svg>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene 3: Point 1 — Derivative on top of every market ────────────────

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
  const baseIn = spring({
    frame: Math.max(0, local - 14),
    fps,
    config: { damping: 16, stiffness: 130 },
  });
  const arrowDraw = interpolate(local, [34, 62], [0, 1], clamp);
  const wrapperIn = spring({
    frame: Math.max(0, local - 50),
    fps,
    config: { damping: 16, stiffness: 130 },
  });
  const insiderBlocked = interpolate(local, [78, 104], [0, 1], clamp);
  const fadeOut = interpolate(local, [duration - 16, duration], [1, 0], clamp);

  const sparkData = [40, 55, 48, 72, 65, 82, 76, 90, 85, 102, 95, 110];
  const spark = (width: number, height: number, color: string) => {
    const max = Math.max(...sparkData);
    const min = Math.min(...sparkData);
    const range = max - min || 1;
    const points = sparkData.map((v, i) => ({
      x: (i / (sparkData.length - 1)) * width,
      y: height - ((v - min) / range) * (height - 8) - 4,
    }));
    const d = points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(" ");
    return (
      <svg width={width} height={height} style={{ display: "block" }}>
        <path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  return (
    <AbsoluteFill
      style={{
        opacity: fadeOut,
        padding: "80px 160px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 36,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20,
          opacity: headIn,
          transform: `translateY(${interpolate(headIn, [0, 1], [-14, 0])}px)`,
        }}
      >
        <StepBadge n={1} total={3} appear={headIn} />
        <TimedCascade
          from={sceneStart + 6}
          duration={duration - 6}
          text="A derivative on top of every market."
          maxWidth={1500}
          fontFamily={INTER}
          fontSize={84}
          fontWeight={900}
          color={WHITE}
          letterSpacing="-0.02em"
          align="center"
          riseDistance={70}
          blurPx={14}
          delayPerWord={3}
          durationPerWord={22}
        />
      </div>

      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "1fr 180px 1fr",
          alignItems: "center",
          gap: 24,
          width: "100%",
          maxWidth: 1440,
        }}
      >
        {/* Left — original market */}
        <div
          style={{
            background: PAPER,
            borderRadius: 24,
            padding: "28px 32px",
            border: "1px solid rgba(0,0,0,0.06)",
            opacity: baseIn,
            transform: `translateX(${interpolate(baseIn, [0, 1], [-40, 0])}px)`,
            position: "relative",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              marginBottom: 14,
              height: 22,
            }}
          >
            <TimedCascade
              from={sceneStart + 14}
              duration={duration - 14}
              text="ORIGINAL MARKET"
              maxWidth={280}
              fontFamily={INTER}
              fontSize={14}
              fontWeight={700}
              color="rgba(0,0,0,0.45)"
              letterSpacing="0.26em"
              align="left"
              riseDistance={18}
              blurPx={5}
              delayPerWord={2}
              durationPerWord={14}
            />
            <TimedCascade
              from={sceneStart + 20}
              duration={duration - 20}
              text="INSIDER ZONE"
              maxWidth={200}
              fontFamily={INTER}
              fontSize={14}
              fontWeight={700}
              color="rgba(0,0,0,0.45)"
              letterSpacing="0.26em"
              align="right"
              riseDistance={18}
              blurPx={5}
              delayPerWord={2}
              durationPerWord={14}
            />
          </div>
          <TimedCascade
            from={sceneStart + 18}
            duration={duration - 18}
            text="BTC / USD"
            maxWidth={360}
            fontFamily={INTER}
            fontSize={40}
            fontWeight={800}
            color={INK}
            align="left"
            riseDistance={30}
            blurPx={8}
            delayPerWord={2}
            durationPerWord={18}
          />
          <div style={{ marginTop: 8 }}>{spark(400, 140, DANGER)}</div>
          <div
            style={{
              position: "absolute",
              right: 24,
              top: "50%",
              transform: `translateY(-50%) scale(${interpolate(baseIn, [0, 1], [0, 1])})`,
              width: 86,
              height: 86,
              borderRadius: "50%",
              background: DANGER,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: WHITE,
              fontFamily: INTER,
              fontWeight: 800,
              fontSize: 16,
              letterSpacing: "0.15em",
              boxShadow: "0 0 40px rgba(255,58,76,0.7)",
            }}
          >
            INSIDER
          </div>
        </div>

        {/* Middle — arrow */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 14,
            position: "relative",
          }}
        >
          <svg width={160} height={140} viewBox="0 0 160 140">
            <defs>
              <marker
                id="arrowHead"
                markerWidth="12"
                markerHeight="12"
                refX="10"
                refY="6"
                orient="auto"
              >
                <path d="M0,0 L12,6 L0,12 Z" fill={BRAND} />
              </marker>
            </defs>
            <path
              d="M80 130 Q 80 70 80 30"
              stroke={BRAND}
              strokeWidth="4"
              fill="none"
              strokeDasharray="200"
              strokeDashoffset={200 - 200 * arrowDraw}
              markerEnd="url(#arrowHead)"
              strokeLinecap="round"
            />
          </svg>
          <div
            style={{
              fontFamily: INTER,
              fontWeight: 700,
              fontSize: 14,
              color: BRAND,
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              opacity: arrowDraw,
            }}
          >
            WRAPS →
          </div>
          <div
            style={{
              position: "absolute",
              top: 72,
              opacity: insiderBlocked,
              transform: `scale(${interpolate(insiderBlocked, [0, 1], [0.4, 1])})`,
            }}
          >
            <svg width={120} height={120} viewBox="0 0 120 120">
              <path
                d="M60 10 L100 26 L100 66 Q100 96 60 112 Q20 96 20 66 L20 26 Z"
                fill="rgba(0,200,83,0.18)"
                stroke={BRAND}
                strokeWidth="3"
              />
              <path
                d="M38 60 L54 76 L82 44"
                stroke={BRAND}
                strokeWidth="6"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        {/* Right — GM derivative */}
        <div
          style={{
            background: "rgba(0,200,83,0.06)",
            borderRadius: 24,
            padding: "28px 32px",
            border: `1px solid ${BRAND}`,
            opacity: wrapperIn,
            transform: `translateX(${interpolate(wrapperIn, [0, 1], [40, 0])}px)`,
            position: "relative",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              marginBottom: 14,
              height: 22,
            }}
          >
            <TimedCascade
              from={sceneStart + 56}
              duration={duration - 56}
              text="GM DERIVATIVE"
              maxWidth={260}
              fontFamily={INTER}
              fontSize={14}
              fontWeight={700}
              color={BRAND}
              letterSpacing="0.26em"
              align="left"
              riseDistance={18}
              blurPx={5}
              delayPerWord={2}
              durationPerWord={14}
            />
            <TimedCascade
              from={sceneStart + 60}
              duration={duration - 60}
              text="SEALED"
              maxWidth={140}
              fontFamily={INTER}
              fontSize={14}
              fontWeight={700}
              color={BRAND}
              letterSpacing="0.26em"
              align="right"
              riseDistance={18}
              blurPx={5}
              delayPerWord={2}
              durationPerWord={14}
            />
          </div>
          <TimedCascade
            from={sceneStart + 58}
            duration={duration - 58}
            text="gm-BTC"
            maxWidth={320}
            fontFamily={INTER}
            fontSize={40}
            fontWeight={800}
            color={WHITE}
            align="left"
            riseDistance={30}
            blurPx={8}
            delayPerWord={2}
            durationPerWord={18}
          />
          <div style={{ marginTop: 8 }}>{spark(400, 140, BRAND)}</div>
          <div
            style={{
              position: "absolute",
              right: 24,
              top: "50%",
              transform: "translateY(-50%)",
              display: "flex",
              alignItems: "center",
              gap: 10,
              color: BRAND,
              fontFamily: INTER,
              fontWeight: 800,
              fontSize: 18,
              opacity: wrapperIn,
            }}
          >
            <svg width={22} height={22} viewBox="0 0 24 24">
              <path
                d="M12 2 L20 6 V12 C20 17 16 21 12 22 C8 21 4 17 4 12 V6 Z"
                fill={BRAND}
              />
            </svg>
            BLIND
          </div>
        </div>
      </div>

      <TimedCascade
        from={sceneStart + 96}
        duration={duration - 96}
        text="Same assets. No informational edge leaks through."
        maxWidth={1400}
        fontFamily={INTER}
        fontSize={28}
        fontWeight={500}
        color={DIM}
        align="center"
        riseDistance={40}
        blurPx={8}
        delayPerWord={3}
        durationPerWord={22}
      />
    </AbsoluteFill>
  );
};

// ─── Scene 4: Point 2 — Clusters of 1,000 ────────────────────────────────

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
  const COLS = 40;
  const ROWS = 25;
  const TOTAL = COLS * ROWS;
  const INSIDER_INDEX = 17 * COLS + 22;

  const fillProgress = interpolate(local, [20, 94], [0, 1], clamp);
  const insiderReveal = interpolate(local, [90, 112], [0, 1], clamp);
  const zoomIn = interpolate(local, [110, 130], [0, 1], clamp);
  const fadeOut = interpolate(local, [duration - 16, duration], [1, 0], clamp);

  const CELL = 26;
  const GAP = 4;
  const GRID_W = COLS * CELL + (COLS - 1) * GAP;
  const GRID_H = ROWS * CELL + (ROWS - 1) * GAP;

  const scale = interpolate(zoomIn, [0, 1], [1, 1.18]);
  const insiderRow = Math.floor(INSIDER_INDEX / COLS);
  const insiderCol = INSIDER_INDEX % COLS;
  const insiderX = insiderCol * (CELL + GAP);
  const insiderY = insiderRow * (CELL + GAP);
  const zoomOffsetX = interpolate(
    zoomIn,
    [0, 1],
    [0, (GRID_W / 2 - insiderX - CELL / 2) * 0.2],
  );
  const zoomOffsetY = interpolate(
    zoomIn,
    [0, 1],
    [0, (GRID_H / 2 - insiderY - CELL / 2) * 0.2],
  );

  const counterValue = Math.floor(fillProgress * TOTAL);

  return (
    <AbsoluteFill
      style={{
        opacity: fadeOut,
        padding: "80px 160px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 32,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20,
          opacity: headIn,
        }}
      >
        <StepBadge n={2} total={3} appear={headIn} />
        <TimedCascade
          from={sceneStart + 6}
          duration={duration - 6}
          text="Trades clustered in [1,000]."
          maxWidth={1500}
          fontFamily={INTER}
          fontSize={84}
          fontWeight={900}
          color={WHITE}
          letterSpacing="-0.02em"
          align="center"
          riseDistance={70}
          blurPx={14}
          delayPerWord={3}
          durationPerWord={22}
          boxStyle={{
            bg: "rgba(0,200,83,0.18)",
            color: BRAND,
            paddingX: 22,
            paddingY: 4,
            borderRadius: 16,
            glowColor: BRAND,
            glowRadius: 180,
          }}
        />
      </div>

      <div
        style={{
          position: "relative",
          width: GRID_W,
          height: GRID_H,
          transform: `translate(${zoomOffsetX}px, ${zoomOffsetY}px) scale(${scale})`,
          transformOrigin: "center",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            gridTemplateColumns: `repeat(${COLS}, ${CELL}px)`,
            gridTemplateRows: `repeat(${ROWS}, ${CELL}px)`,
            gap: GAP,
          }}
        >
          {Array.from({ length: TOTAL }).map((_, i) => {
            const appearThreshold = i / TOTAL;
            const cellOn = fillProgress > appearThreshold ? 1 : 0;
            const isInsider = i === INSIDER_INDEX;
            const bg = isInsider
              ? `rgba(255,58,76,${0.15 + 0.85 * insiderReveal})`
              : `rgba(0,200,83,${0.1 + 0.3 * cellOn})`;
            const border = isInsider
              ? `1px solid ${DANGER}`
              : "1px solid rgba(0,200,83,0.35)";
            return (
              <div
                key={i}
                style={{
                  background: cellOn ? bg : "rgba(255,255,255,0.03)",
                  border: cellOn ? border : "1px solid rgba(255,255,255,0.05)",
                  borderRadius: 3,
                  opacity: cellOn,
                  boxShadow: isInsider
                    ? `0 0 ${14 * insiderReveal}px ${DANGER}`
                    : "none",
                }}
              />
            );
          })}
        </div>

        <svg
          width={GRID_W}
          height={GRID_H}
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            opacity: insiderReveal,
          }}
        >
          <line
            x1={insiderX + CELL + 30}
            y1={insiderY - 40}
            x2={insiderX + CELL + 2}
            y2={insiderY + CELL / 2}
            stroke={DANGER}
            strokeWidth="2"
            strokeDasharray="4 4"
          />
        </svg>

        {/* Callout label via CascadeText, positioned absolutely */}
        <div
          style={{
            position: "absolute",
            left: insiderX + CELL + 34,
            top: insiderY - 72,
            opacity: insiderReveal,
          }}
        >
          <TimedCascade
            from={sceneStart + 90}
            duration={duration - 90}
            text="INSIDER — controls 1 of 1,000"
            maxWidth={520}
            fontFamily={INTER}
            fontSize={18}
            fontWeight={700}
            color={DANGER}
            letterSpacing="0.2em"
            align="left"
            riseDistance={20}
            blurPx={6}
            delayPerWord={2}
            durationPerWord={16}
          />
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 80,
          alignItems: "flex-end",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <TimedCascade
            from={sceneStart + 118}
            duration={duration - 118}
            text="CELLS ASSEMBLED"
            maxWidth={280}
            fontFamily={INTER}
            fontSize={16}
            fontWeight={700}
            color={DIM}
            letterSpacing="0.26em"
            align="left"
            riseDistance={20}
            blurPx={6}
            delayPerWord={2}
            durationPerWord={14}
          />
          <div
            style={{
              fontFamily: INTER,
              fontWeight: 900,
              fontSize: 72,
              color: WHITE,
              fontVariantNumeric: "tabular-nums",
              lineHeight: 0.9,
              opacity: interpolate(local, [90, 110], [0, 1], clamp),
            }}
          >
            {counterValue.toLocaleString()}
          </div>
        </div>
        <div
          style={{
            width: 2,
            height: 80,
            background: "rgba(255,255,255,0.15)",
            opacity: interpolate(local, [100, 120], [0, 1], clamp),
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <TimedCascade
            from={sceneStart + 124}
            duration={duration - 124}
            text="INSIDER INFLUENCE"
            maxWidth={300}
            fontFamily={INTER}
            fontSize={16}
            fontWeight={700}
            color={DIM}
            letterSpacing="0.26em"
            align="left"
            riseDistance={20}
            blurPx={6}
            delayPerWord={2}
            durationPerWord={14}
          />
          <div
            style={{
              fontFamily: INTER,
              fontWeight: 900,
              fontSize: 72,
              color: BRAND,
              fontVariantNumeric: "tabular-nums",
              lineHeight: 0.9,
              opacity: interpolate(local, [108, 126], [0, 1], clamp),
            }}
          >
            0.1%
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene 5: Point 3 — Bot vs industry ──────────────────────────────────

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
  const industryIn = spring({
    frame: Math.max(0, local - 20),
    fps,
    config: { damping: 16, stiffness: 120 },
  });
  const industryBar = interpolate(local, [34, 66], [0, 1], clamp);
  const gmIn = spring({
    frame: Math.max(0, local - 60),
    fps,
    config: { damping: 16, stiffness: 120 },
  });
  const gmBar = interpolate(local, [74, 118], [0, 1], clamp);
  const fadeOut = interpolate(local, [duration - 16, duration], [1, 0], clamp);

  const INDUSTRY_TARGET = 48_000;
  const GM_TARGET = 520_000;
  const industryCounter = Math.round(industryBar * INDUSTRY_TARGET);
  const gmCounter = Math.round(gmBar * GM_TARGET);

  return (
    <AbsoluteFill
      style={{
        opacity: fadeOut,
        padding: "80px 160px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 48,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20,
          opacity: headIn,
        }}
      >
        <StepBadge n={3} total={3} appear={headIn} />
        <TimedCascade
          from={sceneStart + 6}
          duration={duration - 6}
          text="One bot out-trades the entire industry."
          maxWidth={1500}
          fontFamily={INTER}
          fontSize={84}
          fontWeight={900}
          color={WHITE}
          letterSpacing="-0.02em"
          align="center"
          riseDistance={70}
          blurPx={14}
          delayPerWord={3}
          durationPerWord={22}
        />
      </div>

      <div
        style={{
          width: "100%",
          maxWidth: 1440,
          display: "flex",
          flexDirection: "column",
          gap: 48,
        }}
      >
        {/* INDUSTRY row */}
        <div
          style={{
            opacity: industryIn,
            transform: `translateX(${interpolate(industryIn, [0, 1], [-30, 0])}px)`,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              marginBottom: 14,
            }}
          >
            <TimedCascade
              from={sceneStart + 20}
              duration={duration - 20}
              text="PREDICTION MARKET INDUSTRY · PER DAY"
              maxWidth={800}
              fontFamily={INTER}
              fontSize={18}
              fontWeight={700}
              color={DIM}
              letterSpacing="0.24em"
              align="left"
              riseDistance={20}
              blurPx={6}
              delayPerWord={2}
              durationPerWord={16}
            />
            <div
              style={{
                fontFamily: INTER,
                fontWeight: 800,
                fontSize: 36,
                color: WHITE,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {industryCounter.toLocaleString()}
            </div>
          </div>
          <div
            style={{
              height: 44,
              borderRadius: 10,
              background: "rgba(255,255,255,0.06)",
              overflow: "hidden",
              position: "relative",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${industryBar * 9}%`,
                background: `linear-gradient(90deg, ${DANGER}, rgba(255,58,76,0.7))`,
                boxShadow: "0 0 18px rgba(255,58,76,0.45)",
                borderRadius: 10,
              }}
            />
          </div>
        </div>

        {/* GM row */}
        <div
          style={{
            opacity: gmIn,
            transform: `translateX(${interpolate(gmIn, [0, 1], [-30, 0])}px)`,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              marginBottom: 14,
            }}
          >
            <TimedCascade
              from={sceneStart + 60}
              duration={duration - 60}
              text="GENERAL MARKET BOT · PER DAY"
              maxWidth={800}
              fontFamily={INTER}
              fontSize={18}
              fontWeight={700}
              color={BRAND}
              letterSpacing="0.24em"
              align="left"
              riseDistance={20}
              blurPx={6}
              delayPerWord={2}
              durationPerWord={16}
            />
            <div
              style={{
                fontFamily: INTER,
                fontWeight: 800,
                fontSize: 48,
                color: BRAND,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {gmCounter.toLocaleString()}
            </div>
          </div>
          <div
            style={{
              height: 72,
              borderRadius: 14,
              background: "rgba(255,255,255,0.06)",
              overflow: "hidden",
              position: "relative",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${gmBar * 100}%`,
                background: `linear-gradient(90deg, ${BRAND}, #3ef08c)`,
                boxShadow: `0 0 30px ${BRAND}88`,
                borderRadius: 14,
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)",
                  transform: `translateX(${(local * 12) % 1600 - 400}px)`,
                  width: 400,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <TimedCascade
        from={sceneStart + 120}
        duration={duration - 120}
        text="More open positions in 24 hours than every prediction market, combined."
        maxWidth={1400}
        fontFamily={INTER}
        fontSize={28}
        fontWeight={500}
        color={DIM}
        align="center"
        riseDistance={40}
        blurPx={8}
        delayPerWord={3}
        durationPerWord={22}
      />
    </AbsoluteFill>
  );
};

// ─── Scene 6: Stat — 90% reduction ───────────────────────────────────────

const StatScene: React.FC<{
  local: number;
  sceneStart: number;
  duration: number;
  fps: number;
}> = ({ local, sceneStart, duration, fps }) => {
  const headIn = spring({
    frame: local,
    fps,
    config: { damping: 20, stiffness: 130 },
  });
  const dialProgress = interpolate(local, [18, 68], [0, 1], clamp);
  const fadeOut = interpolate(local, [duration - 18, duration], [1, 0], clamp);

  const percentValue = Math.round(dialProgress * 90);
  const dialR = 200;
  const dialC = 2 * Math.PI * dialR;
  const dialOffset = dialC * (1 - (dialProgress * 90) / 100);

  return (
    <AbsoluteFill
      style={{
        opacity: fadeOut,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 40,
      }}
    >
      <TimedCascade
        from={sceneStart}
        duration={duration}
        text="THE RESULT"
        maxWidth={600}
        fontFamily={INTER}
        fontSize={22}
        fontWeight={700}
        color={DIM}
        letterSpacing="0.36em"
        align="center"
        riseDistance={24}
        blurPx={6}
        delayPerWord={3}
        durationPerWord={18}
      />

      <div
        style={{
          position: "relative",
          width: 520,
          height: 520,
          opacity: headIn,
          transform: `scale(${interpolate(headIn, [0, 1], [0.88, 1])})`,
        }}
      >
        <svg width={520} height={520} viewBox="0 0 520 520">
          <circle
            cx="260"
            cy="260"
            r={dialR}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="16"
          />
          <circle
            cx="260"
            cy="260"
            r={dialR}
            fill="none"
            stroke={BRAND}
            strokeWidth="16"
            strokeLinecap="round"
            strokeDasharray={dialC}
            strokeDashoffset={dialOffset}
            transform="rotate(-90 260 260)"
            style={{ filter: `drop-shadow(0 0 18px ${BRAND})` }}
          />
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <div
            style={{
              fontFamily: INTER,
              fontWeight: 900,
              fontSize: 180,
              lineHeight: 0.9,
              color: WHITE,
              fontVariantNumeric: "tabular-nums",
              letterSpacing: "-0.04em",
            }}
          >
            {percentValue}
            <span style={{ color: BRAND, fontSize: 120 }}>%</span>
          </div>
          <div
            style={{
              fontFamily: INTER,
              fontWeight: 700,
              fontSize: 22,
              color: DIM,
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              opacity: interpolate(local, [40, 60], [0, 1], clamp),
            }}
          >
            loss cut
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
        }}
      >
        <TimedCascade
          from={sceneStart + 66}
          duration={duration - 66}
          text="Insider bleed, reduced by up to [90%]."
          maxWidth={1400}
          fontFamily={INTER}
          fontSize={36}
          fontWeight={700}
          color={WHITE}
          align="center"
          riseDistance={40}
          blurPx={10}
          delayPerWord={3}
          durationPerWord={20}
          boxStyle={{
            bg: "rgba(0,200,83,0.18)",
            color: BRAND,
            paddingX: 14,
            paddingY: 2,
            borderRadius: 10,
            glowColor: BRAND,
            glowRadius: 100,
          }}
        />
        <div
          style={{
            marginTop: 10,
            fontFamily: INTER,
            fontSize: 16,
            fontWeight: 500,
            color: "rgba(255,255,255,0.35)",
            letterSpacing: "0.2em",
            opacity: interpolate(local, [80, 96], [0, 1], clamp),
          }}
        >
          * modelled on replayed insider events across five exchanges
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene 7: Closing ────────────────────────────────────────────────────

const ClosingScene: React.FC<{
  local: number;
  sceneStart: number;
  duration: number;
}> = ({ local, sceneStart, duration }) => {
  const firstOut = interpolate(local, [38, 52], [1, 0], clamp);
  const logoIn = interpolate(local, [70, 94], [0, 1], clamp);
  const fadeOut = interpolate(local, [duration - 22, duration], [1, 0], clamp);

  return (
    <AbsoluteFill
      style={{
        opacity: fadeOut,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 56,
      }}
    >
      <div
        style={{
          position: "relative",
          height: 180,
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: "100%",
            display: "flex",
            justifyContent: "center",
            opacity: firstOut,
          }}
        >
          <TimedCascade
            from={sceneStart}
            duration={52}
            text="Not insider [protection]."
            maxWidth={1400}
            fontFamily={INTER}
            fontSize={84}
            fontWeight={800}
            color={WHITE}
            letterSpacing="-0.02em"
            align="center"
            riseDistance={70}
            blurPx={14}
            delayPerWord={3}
            durationPerWord={22}
            boxStyle={{
              bg: "rgba(255,58,76,0.16)",
              color: DANGER,
              paddingX: 18,
              paddingY: 4,
              borderRadius: 12,
              glowColor: DANGER,
              glowRadius: 120,
            }}
          />
        </div>

        <div
          style={{
            position: "absolute",
            width: "100%",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <TimedCascade
            from={sceneStart + 46}
            duration={duration - 46}
            text="A new [trading standard]."
            maxWidth={1500}
            fontFamily={INTER}
            fontSize={108}
            fontWeight={900}
            color={WHITE}
            letterSpacing="-0.03em"
            align="center"
            riseDistance={80}
            blurPx={16}
            delayPerWord={3}
            durationPerWord={24}
            boxStyle={{
              bg: "rgba(0,200,83,0.18)",
              color: BRAND,
              paddingX: 22,
              paddingY: 4,
              borderRadius: 14,
              glowColor: BRAND,
              glowRadius: 180,
            }}
          />
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 20,
          opacity: logoIn,
          transform: `translateY(${interpolate(logoIn, [0, 1], [12, 0])}px)`,
        }}
      >
        <Img
          src={staticFile("gm-logo.svg")}
          style={{
            width: 72,
            height: 72,
            filter: `drop-shadow(0 0 24px ${BRAND}88)`,
          }}
        />
        <TimedCascade
          from={sceneStart + 70}
          duration={duration - 70}
          text="generalmarket.io"
          maxWidth={600}
          fontFamily={INTER}
          fontSize={32}
          fontWeight={700}
          color={WHITE}
          letterSpacing="0.06em"
          align="left"
          riseDistance={30}
          blurPx={8}
          delayPerWord={2}
          durationPerWord={18}
        />
      </div>
    </AbsoluteFill>
  );
};

// ─── Ambient background grid for the whole pitch ─────────────────────────

const PitchAmbient: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = (frame * 0.25) % 40;
  return (
    <AbsoluteFill style={{ background: "#050505", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: -40,
          backgroundImage:
            "linear-gradient(rgba(0,200,83,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(0,200,83,0.06) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          transform: `translate(${drift}px, ${drift}px)`,
          maskImage:
            "radial-gradient(ellipse at center, black 20%, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at center, black 20%, transparent 75%)",
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(5,5,5,0) 0%, rgba(5,5,5,0.85) 90%)",
        }}
      />
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
    <AbsoluteFill>
      <PitchAmbient />
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
    </AbsoluteFill>
  );
};
