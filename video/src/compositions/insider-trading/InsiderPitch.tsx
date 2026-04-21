import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";

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
  intro: { start: 0, end: 72 }, // "General Market fights back"
  contrast: { start: 72, end: 192 }, // Every exchange vs GM
  point1: { start: 192, end: 332 }, // Derivatives on top
  point2: { start: 332, end: 472 }, // 1,000-cluster grid
  point3: { start: 472, end: 612 }, // Bot volume
  stat: { start: 612, end: 712 }, // 90% reduction
  closing: { start: 712, end: 820 }, // New trading standard
} as const;

export const PITCH_DURATION = PITCH_SCENES.closing.end;

// ─── Small primitives ────────────────────────────────────────────────────

const Label: React.FC<{
  children: React.ReactNode;
  color?: string;
  size?: number;
}> = ({ children, color = DIM, size = 20 }) => (
  <div
    style={{
      fontFamily: INTER,
      fontWeight: 600,
      fontSize: size,
      letterSpacing: "0.28em",
      textTransform: "uppercase",
      color,
      fontFeatureSettings: '"calt" 1',
    }}
  >
    {children}
  </div>
);

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

const IntroScene: React.FC<{ local: number; fps: number }> = ({
  local,
  fps,
}) => {
  const titleIn = spring({
    frame: local,
    fps,
    config: { damping: 20, stiffness: 140, mass: 0.8 },
    durationInFrames: 28,
  });
  const kickerIn = spring({
    frame: Math.max(0, local - 18),
    fps,
    config: { damping: 22, stiffness: 120, mass: 0.9 },
    durationInFrames: 28,
  });
  const strikeReveal = interpolate(local, [24, 46], [0, 1], clamp);
  const lineSweep = interpolate(local, [6, 34], [0, 1], clamp);
  const fadeOut = interpolate(
    local,
    [PITCH_SCENES.intro.end - PITCH_SCENES.intro.start - 14, PITCH_SCENES.intro.end - PITCH_SCENES.intro.start],
    [1, 0],
    clamp,
  );

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
        {/* Brand hairline */}
        <div
          style={{
            width: 540 * lineSweep,
            height: 2,
            background: `linear-gradient(90deg, transparent, ${BRAND}, transparent)`,
          }}
        />

        <div
          style={{
            fontFamily: INTER,
            fontWeight: 900,
            fontSize: 168,
            lineHeight: 0.9,
            letterSpacing: "-0.03em",
            color: WHITE,
            textAlign: "center",
            opacity: titleIn,
            transform: `translateY(${interpolate(titleIn, [0, 1], [24, 0])}px) scale(${interpolate(titleIn, [0, 1], [0.92, 1])})`,
            textShadow: "0 2px 40px rgba(0,0,0,0.6)",
          }}
        >
          GENERAL MARKET
        </div>

        <div
          style={{
            position: "relative",
            opacity: kickerIn,
            transform: `translateY(${interpolate(kickerIn, [0, 1], [18, 0])}px)`,
          }}
        >
          <div
            style={{
              fontFamily: INTER,
              fontWeight: 900,
              fontSize: 120,
              lineHeight: 0.9,
              letterSpacing: "-0.02em",
              color: DANGER,
              fontStyle: "italic",
              textShadow: `0 0 60px ${DANGER}55`,
            }}
          >
            fights back.
          </div>
          {/* Underline strike */}
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

const ContrastScene: React.FC<{ local: number; fps: number }> = ({
  local,
  fps,
}) => {
  const duration = PITCH_SCENES.contrast.end - PITCH_SCENES.contrast.start;
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
          <Label color={DANGER}>Every exchange</Label>
          <div
            style={{
              fontFamily: INTER,
              fontWeight: 800,
              fontSize: 72,
              lineHeight: 0.95,
              color: WHITE,
              letterSpacing: "-0.02em",
            }}
          >
            allows insiders
            <br />
            to eat first.
          </div>

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
                  {/* Red X overlay */}
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
          <Label color={BRAND}>General Market</Label>
          <div
            style={{
              fontFamily: INTER,
              fontWeight: 800,
              fontSize: 72,
              lineHeight: 0.95,
              color: WHITE,
              letterSpacing: "-0.02em",
            }}
          >
            The first market
            <br />
            <span style={{ color: BRAND }}>to eliminate insiders.</span>
          </div>

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
            <div
              style={{
                flex: 1,
                fontFamily: INTER,
                fontWeight: 700,
                fontSize: 28,
                color: WHITE,
                letterSpacing: "-0.01em",
              }}
            >
              Every trader lands at the same moment.
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

const Point1Scene: React.FC<{ local: number; fps: number }> = ({
  local,
  fps,
}) => {
  const duration = PITCH_SCENES.point1.end - PITCH_SCENES.point1.start;
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
  const captionIn = interpolate(local, [96, 120], [0, 1], clamp);
  const fadeOut = interpolate(local, [duration - 16, duration], [1, 0], clamp);

  // Sparkline data shared between markets
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
        <div
          style={{
            fontFamily: INTER,
            fontWeight: 900,
            fontSize: 84,
            lineHeight: 0.95,
            color: WHITE,
            letterSpacing: "-0.02em",
            textAlign: "center",
          }}
        >
          A derivative on top of every market.
        </div>
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
            }}
          >
            <Label color="rgba(0,0,0,0.45)" size={14}>
              Original market
            </Label>
            <Label color="rgba(0,0,0,0.45)" size={14}>
              Insider zone
            </Label>
          </div>
          <div
            style={{
              fontFamily: INTER,
              fontWeight: 800,
              fontSize: 40,
              color: INK,
              marginBottom: 8,
            }}
          >
            BTC / USD
          </div>
          {spark(400, 140, DANGER)}
          {/* Insider blob */}
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

        {/* Middle — derivative arrow */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 14,
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
          <Label color={BRAND} size={14}>
            WRAPS →
          </Label>
          {/* Shield blocking insider */}
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
            }}
          >
            <Label color={BRAND} size={14}>
              GM Derivative
            </Label>
            <Label color={BRAND} size={14}>
              Sealed
            </Label>
          </div>
          <div
            style={{
              fontFamily: INTER,
              fontWeight: 800,
              fontSize: 40,
              color: WHITE,
              marginBottom: 8,
            }}
          >
            gm-BTC
          </div>
          {spark(400, 140, BRAND)}
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

      <div
        style={{
          fontFamily: INTER,
          fontWeight: 500,
          fontSize: 28,
          color: DIM,
          opacity: captionIn,
          transform: `translateY(${interpolate(captionIn, [0, 1], [10, 0])}px)`,
          textAlign: "center",
        }}
      >
        Same assets. No informational edge leaks through.
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene 4: Point 2 — Clusters of 1,000 ────────────────────────────────

const Point2Scene: React.FC<{ local: number; fps: number }> = ({
  local,
  fps,
}) => {
  const duration = PITCH_SCENES.point2.end - PITCH_SCENES.point2.start;
  const headIn = spring({
    frame: local,
    fps,
    config: { damping: 18, stiffness: 120 },
  });
  const COLS = 40;
  const ROWS = 25;
  const TOTAL = COLS * ROWS; // 1000
  const INSIDER_INDEX = 17 * COLS + 22; // row 17, col 22

  const fillProgress = interpolate(local, [20, 94], [0, 1], clamp);
  const insiderReveal = interpolate(local, [90, 112], [0, 1], clamp);
  const zoomIn = interpolate(local, [110, 130], [0, 1], clamp);
  const captionIn = interpolate(local, [120, 140], [0, 1], clamp);
  const fadeOut = interpolate(local, [duration - 16, duration], [1, 0], clamp);

  const CELL = 26;
  const GAP = 4;
  const GRID_W = COLS * CELL + (COLS - 1) * GAP;
  const GRID_H = ROWS * CELL + (ROWS - 1) * GAP;

  const scale = interpolate(zoomIn, [0, 1], [1, 1.25]);
  const insiderRow = Math.floor(INSIDER_INDEX / COLS);
  const insiderCol = INSIDER_INDEX % COLS;
  const insiderX = insiderCol * (CELL + GAP);
  const insiderY = insiderRow * (CELL + GAP);
  const zoomOffsetX = interpolate(
    zoomIn,
    [0, 1],
    [0, (GRID_W / 2 - insiderX - CELL / 2) * 0.25],
  );
  const zoomOffsetY = interpolate(
    zoomIn,
    [0, 1],
    [0, (GRID_H / 2 - insiderY - CELL / 2) * 0.25],
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
        <div
          style={{
            fontFamily: INTER,
            fontWeight: 900,
            fontSize: 84,
            lineHeight: 0.95,
            color: WHITE,
            letterSpacing: "-0.02em",
            textAlign: "center",
          }}
        >
          Trades clustered in <span style={{ color: BRAND }}>1,000</span>.
        </div>
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

        {/* Callout arrow to the insider cell */}
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
          <text
            x={insiderX + CELL + 34}
            y={insiderY - 46}
            fill={DANGER}
            fontFamily={INTER}
            fontWeight={700}
            fontSize={18}
            letterSpacing="0.2em"
          >
            INSIDER — controls 1 of 1,000
          </text>
        </svg>
      </div>

      <div
        style={{
          display: "flex",
          gap: 80,
          alignItems: "center",
          opacity: captionIn,
          transform: `translateY(${interpolate(captionIn, [0, 1], [10, 0])}px)`,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Label color={DIM} size={16}>
            Cells assembled
          </Label>
          <div
            style={{
              fontFamily: INTER,
              fontWeight: 900,
              fontSize: 72,
              color: WHITE,
              fontVariantNumeric: "tabular-nums",
              lineHeight: 0.9,
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
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Label color={DIM} size={16}>
            Insider influence
          </Label>
          <div
            style={{
              fontFamily: INTER,
              fontWeight: 900,
              fontSize: 72,
              color: BRAND,
              fontVariantNumeric: "tabular-nums",
              lineHeight: 0.9,
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

const Point3Scene: React.FC<{ local: number; fps: number }> = ({
  local,
  fps,
}) => {
  const duration = PITCH_SCENES.point3.end - PITCH_SCENES.point3.start;
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
  const captionIn = interpolate(local, [120, 140], [0, 1], clamp);
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
        <div
          style={{
            fontFamily: INTER,
            fontWeight: 900,
            fontSize: 84,
            lineHeight: 0.95,
            color: WHITE,
            letterSpacing: "-0.02em",
            textAlign: "center",
          }}
        >
          One bot out-trades the entire industry.
        </div>
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
              alignItems: "baseline",
              marginBottom: 14,
            }}
          >
            <Label color={DIM} size={18}>
              Prediction market industry · per day
            </Label>
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
              alignItems: "baseline",
              marginBottom: 14,
            }}
          >
            <Label color={BRAND} size={18}>
              General Market bot · per day
            </Label>
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
              {/* Moving shimmer */}
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

      <div
        style={{
          fontFamily: INTER,
          fontWeight: 500,
          fontSize: 28,
          color: DIM,
          opacity: captionIn,
          transform: `translateY(${interpolate(captionIn, [0, 1], [10, 0])}px)`,
          textAlign: "center",
          maxWidth: 1000,
        }}
      >
        More open positions in 24 hours than every prediction market, combined.
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene 6: Stat — 90% reduction ───────────────────────────────────────

const StatScene: React.FC<{ local: number; fps: number }> = ({
  local,
  fps,
}) => {
  const duration = PITCH_SCENES.stat.end - PITCH_SCENES.stat.start;
  const headIn = spring({
    frame: local,
    fps,
    config: { damping: 20, stiffness: 130 },
  });
  const dialProgress = interpolate(local, [18, 68], [0, 1], clamp);
  const captionIn = interpolate(local, [70, 92], [0, 1], clamp);
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
      <Label color={DIM} size={20}>
        THE RESULT
      </Label>

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
            }}
          >
            loss cut
          </div>
        </div>
      </div>

      <div
        style={{
          fontFamily: INTER,
          fontWeight: 700,
          fontSize: 36,
          color: WHITE,
          opacity: captionIn,
          transform: `translateY(${interpolate(captionIn, [0, 1], [12, 0])}px)`,
          textAlign: "center",
        }}
      >
        Insider bleed, reduced by up to 90%.
        <span
          style={{
            display: "block",
            marginTop: 10,
            fontSize: 16,
            fontWeight: 500,
            color: "rgba(255,255,255,0.35)",
            letterSpacing: "0.2em",
          }}
        >
          * modelled on replayed insider events across five exchanges
        </span>
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene 7: Closing ────────────────────────────────────────────────────

const ClosingScene: React.FC<{ local: number; fps: number }> = ({
  local,
  fps,
}) => {
  const duration = PITCH_SCENES.closing.end - PITCH_SCENES.closing.start;
  const firstIn = spring({
    frame: local,
    fps,
    config: { damping: 22, stiffness: 120 },
  });
  const firstOut = interpolate(local, [32, 48], [1, 0], clamp);
  const secondIn = spring({
    frame: Math.max(0, local - 46),
    fps,
    config: { damping: 22, stiffness: 120 },
  });
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
            fontFamily: INTER,
            fontWeight: 800,
            fontSize: 84,
            color: WHITE,
            textAlign: "center",
            opacity: firstIn * firstOut,
            letterSpacing: "-0.02em",
            lineHeight: 1,
          }}
        >
          Not insider <span style={{ color: DANGER }}>protection.</span>
        </div>

        <div
          style={{
            position: "absolute",
            fontFamily: INTER,
            fontWeight: 900,
            fontSize: 108,
            color: WHITE,
            textAlign: "center",
            opacity: secondIn,
            transform: `translateY(${interpolate(secondIn, [0, 1], [14, 0])}px)`,
            letterSpacing: "-0.03em",
            lineHeight: 1,
          }}
        >
          A new <span style={{ color: BRAND }}>trading standard.</span>
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
        <div
          style={{
            fontFamily: INTER,
            fontWeight: 700,
            fontSize: 32,
            color: WHITE,
            letterSpacing: "0.06em",
          }}
        >
          generalmarket.io
        </div>
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

  const activeScene = (() => {
    if (local < PITCH_SCENES.intro.end) {
      return { key: "intro", sceneStart: PITCH_SCENES.intro.start };
    }
    if (local < PITCH_SCENES.contrast.end) {
      return { key: "contrast", sceneStart: PITCH_SCENES.contrast.start };
    }
    if (local < PITCH_SCENES.point1.end) {
      return { key: "point1", sceneStart: PITCH_SCENES.point1.start };
    }
    if (local < PITCH_SCENES.point2.end) {
      return { key: "point2", sceneStart: PITCH_SCENES.point2.start };
    }
    if (local < PITCH_SCENES.point3.end) {
      return { key: "point3", sceneStart: PITCH_SCENES.point3.start };
    }
    if (local < PITCH_SCENES.stat.end) {
      return { key: "stat", sceneStart: PITCH_SCENES.stat.start };
    }
    return { key: "closing", sceneStart: PITCH_SCENES.closing.start };
  })();

  const sceneLocal = local - activeScene.sceneStart;

  return (
    <AbsoluteFill>
      <PitchAmbient />
      {activeScene.key === "intro" ? (
        <IntroScene local={sceneLocal} fps={fps} />
      ) : null}
      {activeScene.key === "contrast" ? (
        <ContrastScene local={sceneLocal} fps={fps} />
      ) : null}
      {activeScene.key === "point1" ? (
        <Point1Scene local={sceneLocal} fps={fps} />
      ) : null}
      {activeScene.key === "point2" ? (
        <Point2Scene local={sceneLocal} fps={fps} />
      ) : null}
      {activeScene.key === "point3" ? (
        <Point3Scene local={sceneLocal} fps={fps} />
      ) : null}
      {activeScene.key === "stat" ? (
        <StatScene local={sceneLocal} fps={fps} />
      ) : null}
      {activeScene.key === "closing" ? (
        <ClosingScene local={sceneLocal} fps={fps} />
      ) : null}
    </AbsoluteFill>
  );
};
