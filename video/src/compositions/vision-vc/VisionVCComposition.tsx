/**
 * VisionVCComposition — PH Launch Video (v2 style)
 *
 * Same narrative as the original: five data sources, three benefits,
 * the 583,551 hook. Rebuilt in VisionVC2's text-first, spring-physics,
 * warm-paper manifesto style. Single file. B-roll behind source cards.
 *
 * ~35.6s at 30fps (1068 frames).
 */
import React from "react";
import {
  AbsoluteFill,
  Img,
  Sequence,
  staticFile,
  useCurrentFrame,
  interpolate,
  spring,
  Easing,
} from "remotion";
import { COLOR, FONT } from "./tokens";
import { BackgroundLayer } from "./device/BackgroundLayer";

const FPS = 30;
const GM_GREEN = "#00C853";

// ═══════════════════════════════════════════════════════════════════════
// TIMING
// ═══════════════════════════════════════════════════════════════════════

const S = {
  opening:        { from: 0,    dur: 60  },
  story:          { from: 60,   dur: 60  },

  dbScene:        { from: 120,  dur: 68  },
  mcdScene:       { from: 188,  dur: 65  },
  steamScene:     { from: 253,  dur: 60  },
  pumpScene:      { from: 313,  dur: 55  },
  solarScene:     { from: 368,  dur: 50  },

  traction:       { from: 418,  dur: 45  },

  benefitBreadth: { from: 463,  dur: 125 },
  benefitVolume:  { from: 588,  dur: 130 },
  benefitPrivacy: { from: 718,  dur: 120 },

  pause:          { from: 838,  dur: 3   },
  countUp:        { from: 841,  dur: 40  },
  closing:        { from: 881,  dur: 187 },
} as const;

const DURATION_FRAMES = S.closing.from + S.closing.dur;

// ═══════════════════════════════════════════════════════════════════════
// SPRING CONFIGS
// ═══════════════════════════════════════════════════════════════════════

const SP = {
  fast:   { damping: 22, stiffness: 160, mass: 0.5 },
  medium: { damping: 18, stiffness: 100, mass: 0.6 },
  slow:   { damping: 16, stiffness: 70,  mass: 0.8 },
  slam:   { damping: 6,  stiffness: 200, mass: 0.4 },
  ring:   { damping: 8,  stiffness: 80,  mass: 0.6 },
};

// ═══════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════

const fmtN = (n: number): string =>
  Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");

const useExit = (
  frame: number,
  exitStart: number,
  exitEnd: number,
): { opacity: number; translateY: number } => {
  const raw = interpolate(frame, [exitStart, exitEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const p = Easing.in(Easing.cubic)(raw);
  return { opacity: 1 - p, translateY: p * -20 };
};

function lerpColor(a: string, b: string, t: number): string {
  const parse = (hex: string) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  return `rgb(${Math.round(ar + (br - ar) * t)},${Math.round(ag + (bg - ag) * t)},${Math.round(ab + (bb - ab) * t)})`;
}

// ═══════════════════════════════════════════════════════════════════════
// DATA
// ═══════════════════════════════════════════════════════════════════════

const LOGO_DIR = "compositions/vision-vc/logos";

const BROLL_DIR = "compositions/vision-vc/broll";

const SOURCES = [
  {
    name: "Deutsche Bahn",
    logo: `${LOGO_DIR}/db-logo.png`,
    broll: `${BROLL_DIR}/db-video.mp4`,
    metric: "847 delay markets",
    tag: "TRANSPORT",
    tagColor: "#d4920a",
    question: "What if train delays had a price?",
  },
  {
    name: "McDonald's",
    logo: `${LOGO_DIR}/mcdonalds-logo.png`,
    broll: `${BROLL_DIR}/mcdonalds-video.mp4`,
    metric: "14,291 outage markets",
    tag: "CONSUMER",
    tagColor: "#c42020",
    question: "What if McFlurry outages moved a market?",
  },
  {
    name: "Steam",
    logo: `${LOGO_DIR}/steam-logo.png`,
    broll: `${BROLL_DIR}/steam-video.mp4`,
    metric: "23,508 player count markets",
    tag: "GAMING",
    tagColor: "#1887dd",
    question: "What if player counts were tradeable?",
  },
  {
    name: "Pump.fun",
    logo: `${LOGO_DIR}/pumpfun-logo.png`,
    broll: `${BROLL_DIR}/pumpfun-video.mp4`,
    metric: "95,500 rug markets",
    tag: "CRYPTO",
    tagColor: "#16a34a",
    question: "What if you could short a rug pull?",
  },
  {
    name: "Solar Observatory",
    logo: `${LOGO_DIR}/noaa-logo.png`,
    broll: `${BROLL_DIR}/solar-video.mp4`,
    metric: "180,000 flare markets",
    tag: "SPACE",
    tagColor: "#e07012",
    question: "What if solar flares paid out?",
  },
] as const;

const COMPETITORS = [
  { name: "Polymarket", markets: 40,  color: "#6366f1" },
  { name: "Kalshi",     markets: 200, color: "#8b5cf6" },
  { name: "Robinhood",  markets: 150, color: "#22c55e" },
  { name: "Coinbase",   markets: 350, color: "#3b82f6" },
  { name: "Binance",    markets: 600, color: "#f59e0b" },
];

// ═══════════════════════════════════════════════════════════════════════
// SCENE 1: OPENING — "583,551 things..."
// ═══════════════════════════════════════════════════════════════════════

const Opening: React.FC = () => {
  const frame = useCurrentFrame();

  const s1 = spring({ frame: Math.max(0, frame - 3), fps: FPS, config: SP.medium });
  const s2 = spring({ frame: Math.max(0, frame - 18), fps: FPS, config: SP.medium });
  const exit = useExit(frame, 44, 58);

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
      }}
    >
      <div
        style={{
          fontFamily: FONT.sans,
          fontSize: 48,
          fontWeight: 700,
          color: COLOR.textPrimary,
          textAlign: "center",
          letterSpacing: "-0.02em",
          lineHeight: 1.4,
          opacity:
            interpolate(s1, [0, 0.5], [0, 1], {
              extrapolateRight: "clamp",
            }) * exit.opacity,
          transform: `translateY(${interpolate(s1, [0, 1], [30, 0]) + exit.translateY}px)`,
        }}
      >
        <span style={{ fontFamily: FONT.mono, fontWeight: 700 }}>
          583,551
        </span>
        {" things in the world have no market."}
      </div>
      <div
        style={{
          fontFamily: FONT.sans,
          fontSize: 44,
          fontWeight: 500,
          color: COLOR.textMuted,
          letterSpacing: "-0.01em",
          opacity:
            interpolate(s2, [0, 0.5], [0, 1], {
              extrapolateRight: "clamp",
            }) * exit.opacity,
          transform: `translateY(${interpolate(s2, [0, 1], [30, 0]) + exit.translateY}px)`,
        }}
      >
        What if they did?
      </div>
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// SCENE 2: STORY — "We wanted to bet on our train."
// ═══════════════════════════════════════════════════════════════════════

const Story: React.FC = () => {
  const frame = useCurrentFrame();

  const s1 = spring({ frame: Math.max(0, frame - 5), fps: FPS, config: SP.medium });
  const s2 = spring({ frame: Math.max(0, frame - 22), fps: FPS, config: SP.medium });
  const exit = useExit(frame, 48, 58);

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
      }}
    >
      <div
        style={{
          fontFamily: FONT.sans,
          fontSize: 40,
          fontWeight: 600,
          color: COLOR.textPrimary,
          textAlign: "center",
          letterSpacing: "-0.02em",
          lineHeight: 1.4,
          maxWidth: 900,
          opacity:
            interpolate(s1, [0, 0.5], [0, 1], {
              extrapolateRight: "clamp",
            }) * exit.opacity,
          transform: `translateY(${interpolate(s1, [0, 1], [30, 0]) + exit.translateY}px)`,
        }}
      >
        We wanted to bet on whether our train would be late.
      </div>
      <div
        style={{
          fontFamily: FONT.sans,
          fontSize: 36,
          fontWeight: 500,
          color: COLOR.textMuted,
          letterSpacing: "-0.01em",
          opacity:
            interpolate(s2, [0, 0.5], [0, 1], {
              extrapolateRight: "clamp",
            }) * exit.opacity,
          transform: `translateY(${interpolate(s2, [0, 1], [30, 0]) + exit.translateY}px)`,
        }}
      >
        There was no market for it.
      </div>
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// SCENES 3-7: DATA SOURCE CARDS
// ═══════════════════════════════════════════════════════════════════════

const SourceCard: React.FC<{
  source: (typeof SOURCES)[number];
  dur: number;
}> = ({ source, dur }) => {
  const frame = useCurrentFrame();

  const metricS = spring({
    frame: Math.max(0, frame - 6),
    fps: FPS,
    config: SP.fast,
  });
  const questionS = spring({
    frame: Math.max(0, frame - 18),
    fps: FPS,
    config: SP.medium,
  });
  const tagS = spring({ frame, fps: FPS, config: SP.fast });
  const exit = useExit(frame, dur - 15, dur);

  return (
    <AbsoluteFill>
      {/* B-roll video background */}
      <BackgroundLayer
        src={source.broll}
        brightness={0.85}
        blur={0}
        tint="rgba(0,0,0,0.15)"
        zoom="in"
        saturation={0.6}
      />

      {/* Warm-paper scrim for text legibility */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(to top, rgba(245,244,239,0.92) 0%, rgba(245,244,239,0.6) 35%, transparent 60%)",
          pointerEvents: "none",
        }}
      />

      {/* Tag — top right */}
      <div
        style={{
          position: "absolute",
          top: 40,
          right: 60,
          fontFamily: FONT.sans,
          fontSize: 14,
          fontWeight: 600,
          color: source.tagColor,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          opacity: interpolate(tagS, [0, 1], [0, 0.8]) * exit.opacity,
        }}
      >
        {source.tag}
      </div>

      {/* Text cluster — bottom left */}
      <div
        style={{
          position: "absolute",
          left: 80,
          bottom: 80,
          maxWidth: 900,
        }}
      >
        <div
          style={{
            fontFamily: FONT.sans,
            fontSize: 56,
            fontWeight: 800,
            color: COLOR.textPrimary,
            letterSpacing: "-0.02em",
            marginBottom: 10,
            opacity: interpolate(metricS, [0, 1], [0, 1]) * exit.opacity,
            transform: `translateY(${interpolate(metricS, [0, 1], [25, 0]) + exit.translateY}px)`,
            textShadow: `0 1px 16px ${COLOR.page}`,
          }}
        >
          {source.metric}
        </div>
        <div
          style={{
            fontFamily: FONT.sans,
            fontSize: 28,
            fontWeight: 400,
            color: COLOR.textSecondary,
            opacity:
              interpolate(questionS, [0, 1], [0, 0.85]) * exit.opacity,
            transform: `translateY(${interpolate(questionS, [0, 1], [15, 0]) + exit.translateY}px)`,
            textShadow: `0 1px 12px ${COLOR.page}`,
          }}
        >
          {source.question}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// SCENE 8: TRACTION — "180,000 markets live."
// ═══════════════════════════════════════════════════════════════════════

const Traction: React.FC = () => {
  const frame = useCurrentFrame();

  const s1 = spring({ frame, fps: FPS, config: SP.fast });
  const s2 = spring({
    frame: Math.max(0, frame - 8),
    fps: FPS,
    config: SP.medium,
  });
  const exit = useExit(frame, 33, 45);

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
      }}
    >
      <div
        style={{
          fontFamily: FONT.sans,
          fontSize: 64,
          fontWeight: 800,
          color: COLOR.textPrimary,
          letterSpacing: "-0.03em",
          opacity: interpolate(s1, [0, 1], [0, 1]) * exit.opacity,
          transform: `translateY(${interpolate(s1, [0, 1], [30, 0]) + exit.translateY}px)`,
        }}
      >
        180,000 markets live. 5 data sources.
      </div>
      <div
        style={{
          fontFamily: FONT.sans,
          fontSize: 32,
          fontWeight: 500,
          color: COLOR.textSecondary,
          opacity:
            interpolate(s2, [0, 1], [0, 0.85]) * exit.opacity,
          transform: `translateY(${interpolate(s2, [0, 1], [20, 0]) + exit.translateY}px)`,
        }}
      >
        Built in 4 months. Growing daily.
      </div>
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// SCENE 9: BENEFIT BREADTH — bar chart comparison
// ═══════════════════════════════════════════════════════════════════════

const BAR_H = 32;
const LABEL_W = 160;
const PX_PER_MARKET = 400 / 600;

const BenefitBreadth: React.FC = () => {
  const frame = useCurrentFrame();
  const dur = S.benefitBreadth.dur;

  const titleS = spring({ frame, fps: FPS, config: SP.fast });

  const barEntries = COMPETITORS.map((_, i) =>
    spring({
      frame: Math.max(0, frame - 10 - i * 3),
      fps: FPS,
      config: SP.fast,
    }),
  );

  // GM bar enters after all competitors settle
  const gmDelay = 10 + COMPETITORS.length * 3 + 10;
  const gmS = spring({
    frame: Math.max(0, frame - gmDelay),
    fps: FPS,
    config: SP.medium,
  });

  // GM counter
  const counterStart = gmDelay + 5;
  const counterEnd = counterStart + 25;
  const counterRaw = interpolate(frame, [counterStart, counterEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.cubic),
  });
  const gmCount = 600 + (583551 - 600) * counterRaw;

  const exit = useExit(frame, dur - 15, dur);

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Title */}
      <div
        style={{
          fontFamily: FONT.sans,
          fontSize: 38,
          fontWeight: 600,
          color: COLOR.textPrimary,
          letterSpacing: "-0.02em",
          marginBottom: 40,
          opacity: interpolate(titleS, [0, 1], [0, 1]) * exit.opacity,
          transform: `translateY(${exit.translateY}px)`,
        }}
      >
        How many markets?
      </div>

      {/* Bars */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          width: 850,
          opacity: exit.opacity,
          transform: `translateY(${exit.translateY}px)`,
        }}
      >
        {COMPETITORS.map((p, i) => {
          const s = barEntries[i];
          const barW = p.markets * PX_PER_MARKET;
          return (
            <div
              key={p.name}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                opacity: interpolate(s, [0, 1], [0, 1]),
                transform: `translateX(${interpolate(s, [0, 1], [-20, 0])}px)`,
              }}
            >
              <span
                style={{
                  width: LABEL_W,
                  textAlign: "right",
                  fontFamily: FONT.sans,
                  fontSize: 18,
                  fontWeight: 500,
                  color: COLOR.textSecondary,
                }}
              >
                {p.name}
              </span>
              <div
                style={{
                  width: barW * interpolate(s, [0, 1], [0, 1]),
                  height: BAR_H,
                  borderRadius: 4,
                  backgroundColor: p.color,
                  opacity: 0.8,
                }}
              />
              <span
                style={{
                  fontFamily: FONT.sans,
                  fontSize: 16,
                  fontWeight: 600,
                  color: COLOR.textMuted,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {fmtN(p.markets)}
              </span>
            </div>
          );
        })}

        {/* Divider */}
        <div
          style={{
            width: 650,
            height: 1,
            backgroundColor: COLOR.textMuted,
            opacity: 0.15 * interpolate(gmS, [0, 1], [0, 1]),
            marginLeft: LABEL_W + 14,
            marginTop: 8,
            marginBottom: 8,
          }}
        />

        {/* General Market */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            opacity: interpolate(gmS, [0, 1], [0, 1]),
          }}
        >
          <span
            style={{
              width: LABEL_W,
              textAlign: "right",
              fontFamily: FONT.sans,
              fontSize: 18,
              fontWeight: 700,
              color: GM_GREEN,
            }}
          >
            General Market
          </span>
          <div style={{ flex: 1, position: "relative" }}>
            <div
              style={{
                width: `${interpolate(gmS, [0, 1], [0, 100])}%`,
                height: BAR_H + 8,
                borderRadius: 4,
                backgroundColor: GM_GREEN,
                opacity: 0.85,
                boxShadow: "0 0 20px rgba(0, 200, 83, 0.2)",
              }}
            />
          </div>
          <span
            style={{
              fontFamily: FONT.mono,
              fontSize: 28,
              fontWeight: 800,
              color: GM_GREEN,
              fontVariantNumeric: "tabular-nums",
              minWidth: 140,
            }}
          >
            {fmtN(gmCount)}
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// SCENE 10: BENEFIT VOLUME — scale contrast
// ═══════════════════════════════════════════════════════════════════════

const BenefitVolume: React.FC = () => {
  const frame = useCurrentFrame();
  const dur = S.benefitVolume.dur;

  // Phase 1: "54%" slam
  const edgeS = spring({ frame, fps: FPS, config: SP.slam });
  const edgeExit = useExit(frame, 28, 38);
  const showEdge = frame < 40;

  // Phase 2: split screen
  const splitStart = 42;
  const showSplit = frame >= splitStart;
  const divS = spring({
    frame: Math.max(0, frame - splitStart),
    fps: FPS,
    config: SP.slow,
  });
  const leftS = spring({
    frame: Math.max(0, frame - splitStart - 6),
    fps: FPS,
    config: SP.fast,
  });
  const rightS = spring({
    frame: Math.max(0, frame - splitStart - 12),
    fps: FPS,
    config: SP.fast,
  });

  // Right-side counter
  const counterStart = splitStart + 20;
  const counterEnd = counterStart + 40;
  const counterRaw = interpolate(frame, [counterStart, counterEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.cubic),
  });
  const rightCount = 10 + (1_000_000 - 10) * counterRaw;

  const counterLandS = spring({
    frame: Math.max(0, frame - counterEnd),
    fps: FPS,
    config: { damping: 10, stiffness: 200, mass: 0.3 },
  });
  const counterScale =
    frame > counterEnd
      ? interpolate(counterLandS, [0, 1], [1.06, 1])
      : 1;

  // Subtitle
  const subS = spring({
    frame: Math.max(0, frame - counterEnd - 5),
    fps: FPS,
    config: SP.fast,
  });

  const exit = useExit(frame, dur - 15, dur);

  return (
    <AbsoluteFill>
      {/* Phase 1: Edge percentage */}
      {showEdge && (
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              fontFamily: FONT.sans,
              fontSize: 28,
              fontWeight: 500,
              color: COLOR.textSecondary,
              marginBottom: 8,
              opacity:
                interpolate(edgeS, [0, 1], [0, 0.8]) *
                edgeExit.opacity,
            }}
          >
            Your edge
          </div>
          <div
            style={{
              fontFamily: FONT.sans,
              fontSize: 160,
              fontWeight: 900,
              color: GM_GREEN,
              letterSpacing: "-0.03em",
              opacity:
                interpolate(edgeS, [0, 0.1], [0, 1], {
                  extrapolateRight: "clamp",
                }) * edgeExit.opacity,
              transform: `scale(${interpolate(edgeS, [0, 0.5, 1], [1.4, 0.95, 1])})`,
            }}
          >
            54%
          </div>
        </AbsoluteFill>
      )}

      {/* Phase 2: Split */}
      {showSplit && (
        <AbsoluteFill style={{ opacity: exit.opacity }}>
          {/* Divider */}
          <div
            style={{
              position: "absolute",
              left: 960,
              top: "22%",
              height: "56%",
              width: 1,
              backgroundColor: COLOR.textMuted,
              opacity: 0.15 * interpolate(divS, [0, 1], [0, 1]),
              transform: `scaleY(${interpolate(divS, [0, 1], [0, 1])})`,
              transformOrigin: "center",
            }}
          />

          {/* Left: Normal Trading */}
          <div
            style={{
              position: "absolute",
              left: 0,
              width: 960,
              top: 0,
              bottom: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              opacity: interpolate(leftS, [0, 1], [0, 1]),
              transform: `translateY(${interpolate(leftS, [0, 1], [20, 0]) + exit.translateY}px)`,
            }}
          >
            <div
              style={{
                fontFamily: FONT.sans,
                fontSize: 28,
                fontWeight: 500,
                color: COLOR.textMuted,
                marginBottom: 20,
              }}
            >
              Normal Trading
            </div>
            <div
              style={{
                fontFamily: FONT.sans,
                fontSize: 160,
                fontWeight: 800,
                color: COLOR.textPrimary,
                lineHeight: 1,
              }}
            >
              10
            </div>
            <div
              style={{
                fontFamily: FONT.sans,
                fontSize: 24,
                fontWeight: 400,
                color: COLOR.textMuted,
                marginTop: 12,
              }}
            >
              trades / day
            </div>
          </div>

          {/* Right: General Market */}
          <div
            style={{
              position: "absolute",
              left: 960,
              width: 960,
              top: 0,
              bottom: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              opacity: interpolate(rightS, [0, 1], [0, 1]),
              transform: `translateY(${interpolate(rightS, [0, 1], [20, 0]) + exit.translateY}px)`,
            }}
          >
            <div
              style={{
                fontFamily: FONT.sans,
                fontSize: 28,
                fontWeight: 500,
                color: GM_GREEN,
                marginBottom: 20,
              }}
            >
              General Market
            </div>
            <div
              style={{
                fontFamily: FONT.sans,
                fontSize: interpolate(
                  counterRaw,
                  [0, 0.3, 1],
                  [160, 140, 100],
                ),
                fontWeight: 800,
                color: GM_GREEN,
                lineHeight: 1,
                transform: `scale(${counterScale})`,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {fmtN(rightCount)}
            </div>
            <div
              style={{
                fontFamily: FONT.sans,
                fontSize: 24,
                fontWeight: 400,
                color: COLOR.textMuted,
                marginTop: 12,
              }}
            >
              trades / day
            </div>
            <div
              style={{
                fontFamily: FONT.sans,
                fontSize: 22,
                fontWeight: 400,
                color: COLOR.textSecondary,
                marginTop: 16,
                opacity: interpolate(subS, [0, 1], [0, 0.85]),
                transform: `translateY(${interpolate(subS, [0, 1], [10, 0])}px)`,
              }}
            >
              on markets they don&rsquo;t know
            </div>
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// SCENE 11: BENEFIT PRIVACY — alpha decay
// ═══════════════════════════════════════════════════════════════════════

const BenefitPrivacy: React.FC = () => {
  const frame = useCurrentFrame();
  const dur = S.benefitPrivacy.dur;

  // Entrance
  const s1 = spring({ frame, fps: FPS, config: SP.fast });
  const s2 = spring({
    frame: Math.max(0, frame - 8),
    fps: FPS,
    config: SP.fast,
  });

  // Decay: alpha drains 54% → 0.1%, copiers rise 0 → 2400
  const decayRaw = interpolate(frame, [20, 70], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const decay = Easing.in(Easing.cubic)(decayRaw);
  const alpha = 54 - 53.9 * decay;
  const copiers = Math.round(2400 * decay);
  const alphaColor = lerpColor("#16a34a", "#dc2626", decay);

  // Resolution text
  const resS = spring({
    frame: Math.max(0, frame - 75),
    fps: FPS,
    config: SP.medium,
  });

  // Dim numbers when resolution appears
  const numDim = interpolate(frame, [72, 80], [1, 0.3], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const exit = useExit(frame, dur - 15, dur);

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Alpha */}
      <div
        style={{
          fontFamily: FONT.sans,
          fontSize: 120,
          fontWeight: 900,
          lineHeight: 1,
          color: alphaColor,
          letterSpacing: "-0.03em",
          fontVariantNumeric: "tabular-nums",
          opacity:
            interpolate(s1, [0, 1], [0, 1]) * exit.opacity * numDim,
          transform: `translateY(${interpolate(s1, [0, 1], [30, 0]) + exit.translateY}px)`,
        }}
      >
        {alpha.toFixed(1)}%
      </div>
      <div
        style={{
          fontFamily: FONT.sans,
          fontSize: 22,
          fontWeight: 400,
          color: COLOR.textMuted,
          marginTop: 8,
          marginBottom: 30,
          opacity:
            interpolate(s1, [0, 1], [0, 0.7]) * exit.opacity * numDim,
        }}
      >
        Your alpha
      </div>

      {/* Copiers */}
      <div
        style={{
          fontFamily: FONT.sans,
          fontSize: 48,
          fontWeight: 600,
          lineHeight: 1,
          color: COLOR.textSecondary,
          fontVariantNumeric: "tabular-nums",
          opacity:
            interpolate(s2, [0, 1], [0, 1]) * exit.opacity * numDim,
          transform: `translateY(${interpolate(s2, [0, 1], [20, 0]) + exit.translateY}px)`,
        }}
      >
        {fmtN(copiers)} copiers
      </div>

      {/* Resolution */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: interpolate(resS, [0, 1], [0, 1]) * exit.opacity,
          transform: `translateY(${interpolate(resS, [0, 1], [20, 0]) + exit.translateY}px)`,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            fontFamily: FONT.sans,
            fontSize: 56,
            fontWeight: 700,
            color: COLOR.textPrimary,
            letterSpacing: "-0.02em",
            textShadow: `0 0 40px ${COLOR.page}, 0 0 60px ${COLOR.page}, 0 0 80px ${COLOR.page}`,
          }}
        >
          Your strategy stays yours.
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// SCENE 12: COUNT-UP — "583,551 of them"
// ═══════════════════════════════════════════════════════════════════════

const CountUp: React.FC = () => {
  const frame = useCurrentFrame();

  const countDuration = 24;
  const countProgress = interpolate(
    frame,
    [5, 5 + countDuration],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    },
  );
  const count = 180_000 + (583_551 - 180_000) * countProgress;

  // Slam
  const s = spring({ frame, fps: FPS, config: SP.slam });
  const scale = interpolate(s, [0, 0.5, 1], [1.3, 0.96, 1]);
  const opacity = interpolate(s, [0, 0.1], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Ring pulse
  const ringS = spring({ frame, fps: FPS, config: SP.ring });

  // Suffix
  const suffixS = spring({
    frame: Math.max(0, frame - 5 - countDuration + 2),
    fps: FPS,
    config: SP.fast,
  });

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Ring */}
      <svg
        style={{
          position: "absolute",
          width: 1920,
          height: 1080,
          pointerEvents: "none",
        }}
      >
        <circle
          cx={960}
          cy={490}
          r={20 + ringS * 300}
          fill="none"
          stroke={GM_GREEN}
          strokeWidth={3}
          opacity={0.3 * (1 - ringS)}
        />
      </svg>

      <div
        style={{
          fontFamily: FONT.mono,
          fontSize: 100,
          fontWeight: 700,
          color: COLOR.textPrimary,
          letterSpacing: "-0.02em",
          fontVariantNumeric: "tabular-nums",
          opacity,
          transform: `scale(${scale})`,
        }}
      >
        {fmtN(count)}
      </div>
      <div
        style={{
          fontFamily: FONT.sans,
          fontSize: 36,
          fontWeight: 600,
          color: COLOR.textSecondary,
          marginTop: 12,
          opacity: interpolate(suffixS, [0, 1], [0, 1]),
          transform: `translateY(${interpolate(suffixS, [0, 1], [10, 0])}px)`,
        }}
      >
        prediction markets. And counting.
      </div>
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// SCENE 13: CLOSING — three phases
// ═══════════════════════════════════════════════════════════════════════

const Closing: React.FC = () => {
  const frame = useCurrentFrame();

  // Phase 1: "$1 minimum. Zero spread." (f5-55)
  const p1In = spring({
    frame: Math.max(0, frame - 5),
    fps: FPS,
    config: SP.fast,
  });
  const p1Out = interpolate(frame, [50, 58], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const p1Op = frame < 50 ? interpolate(p1In, [0, 1], [0, 1]) : p1Out;

  // Phase 2: "583,551 prediction markets" (f62-115)
  const p2In = spring({
    frame: Math.max(0, frame - 62),
    fps: FPS,
    config: SP.fast,
  });
  const p2Out = interpolate(frame, [110, 118], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const p2Op = frame < 110 ? interpolate(p2In, [0, 1], [0, 1]) : p2Out;

  // Phase 3: Identity (f122+)
  const p3S = spring({
    frame: Math.max(0, frame - 122),
    fps: FPS,
    config: SP.slow,
  });
  const urgS = spring({
    frame: Math.max(0, frame - 142),
    fps: FPS,
    config: SP.medium,
  });
  const gmS = spring({
    frame: Math.max(0, frame - 150),
    fps: FPS,
    config: SP.medium,
  });

  // End fade
  const endFade = interpolate(frame, [172, 185], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      {/* Phase 1: Pricing */}
      {p1Op > 0 && (
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              fontFamily: FONT.sans,
              fontSize: 76,
              fontWeight: 900,
              color: COLOR.textPrimary,
              letterSpacing: "-0.03em",
              whiteSpace: "nowrap",
              opacity: p1Op,
              transform: `scale(${interpolate(p1In, [0, 1], [0.96, 1])})`,
            }}
          >
            $1 minimum. Zero spread.
          </div>
          <div
            style={{
              fontFamily: FONT.sans,
              fontSize: 32,
              fontWeight: 500,
              color: COLOR.textSecondary,
              marginTop: 16,
              opacity: p1Op * 0.85,
            }}
          >
            10-minute settlement
          </div>
        </AbsoluteFill>
      )}

      {/* Phase 2: Market count */}
      {p2Op > 0 && (
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 100,
              fontWeight: 700,
              color: COLOR.textPrimary,
              letterSpacing: "-0.02em",
              fontVariantNumeric: "tabular-nums",
              opacity: p2Op,
              transform: `scale(${interpolate(p2In, [0, 1], [0.96, 1])})`,
            }}
          >
            583,551
          </div>
          <div
            style={{
              fontFamily: FONT.sans,
              fontSize: 36,
              fontWeight: 600,
              color: COLOR.textSecondary,
              marginTop: 12,
              opacity: p2Op,
            }}
          >
            prediction markets
          </div>
        </AbsoluteFill>
      )}

      {/* Phase 3: Identity + urgency */}
      {frame >= 122 && (
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            opacity: interpolate(p3S, [0, 1], [0, 1]) * endFade,
            transform: `translateY(${interpolate(p3S, [0, 1], [10, 0])}px)`,
          }}
        >
          <div
            style={{
              fontFamily: FONT.sans,
              fontSize: 56,
              fontWeight: 900,
              color: COLOR.textPrimary,
              letterSpacing: "-0.03em",
              lineHeight: 1.2,
              textAlign: "center",
            }}
          >
            The world&rsquo;s most absurd
            <br />
            prediction market.
          </div>
          <div
            style={{
              fontFamily: FONT.sans,
              fontSize: 24,
              fontWeight: 500,
              color: COLOR.textMuted,
              marginTop: 16,
            }}
          >
            583,551 markets and counting.
          </div>

          {/* Urgency */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginTop: 24,
              opacity: interpolate(urgS, [0, 1], [0, 1]) * endFade,
              fontFamily: FONT.sans,
              fontSize: 28,
              fontWeight: 800,
              color: GM_GREEN,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                backgroundColor: GM_GREEN,
                boxShadow: `0 0 12px ${GM_GREEN}`,
              }}
            />
            Beta live — Season 1
          </div>

          {/* GM badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginTop: 30,
              opacity: interpolate(gmS, [0, 1], [0, 1]),
              transform: `translateY(${interpolate(gmS, [0, 1], [15, 0])}px)`,
            }}
          >
            <Img
              src={staticFile(`${LOGO_DIR}/gm-logo.svg`)}
              style={{ height: 36, width: 36, borderRadius: 6 }}
            />
            <span
              style={{
                fontFamily: FONT.sans,
                fontSize: 28,
                fontWeight: 700,
                color: COLOR.textPrimary,
                letterSpacing: "-0.01em",
              }}
            >
              General Market
            </span>
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// COMPOSITION
// ═══════════════════════════════════════════════════════════════════════

export const VisionVCComposition: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: COLOR.page }}>
      {/* ═══ OPENING ═══ */}
      <Sequence from={S.opening.from} durationInFrames={S.opening.dur}>
        <Opening />
      </Sequence>

      {/* ═══ STORY ═══ */}
      <Sequence from={S.story.from} durationInFrames={S.story.dur}>
        <Story />
      </Sequence>

      {/* ═══ DATA MONTAGE ═══ */}
      <Sequence from={S.dbScene.from} durationInFrames={S.dbScene.dur}>
        <SourceCard source={SOURCES[0]} dur={S.dbScene.dur} />
      </Sequence>
      <Sequence from={S.mcdScene.from} durationInFrames={S.mcdScene.dur}>
        <SourceCard source={SOURCES[1]} dur={S.mcdScene.dur} />
      </Sequence>
      <Sequence
        from={S.steamScene.from}
        durationInFrames={S.steamScene.dur}
      >
        <SourceCard source={SOURCES[2]} dur={S.steamScene.dur} />
      </Sequence>
      <Sequence from={S.pumpScene.from} durationInFrames={S.pumpScene.dur}>
        <SourceCard source={SOURCES[3]} dur={S.pumpScene.dur} />
      </Sequence>
      <Sequence
        from={S.solarScene.from}
        durationInFrames={S.solarScene.dur}
      >
        <SourceCard source={SOURCES[4]} dur={S.solarScene.dur} />
      </Sequence>

      {/* ═══ TRACTION ═══ */}
      <Sequence from={S.traction.from} durationInFrames={S.traction.dur}>
        <Traction />
      </Sequence>

      {/* ═══ BENEFIT SCENES ═══ */}
      <Sequence
        from={S.benefitBreadth.from}
        durationInFrames={S.benefitBreadth.dur}
      >
        <BenefitBreadth />
      </Sequence>
      <Sequence
        from={S.benefitVolume.from}
        durationInFrames={S.benefitVolume.dur}
      >
        <BenefitVolume />
      </Sequence>
      <Sequence
        from={S.benefitPrivacy.from}
        durationInFrames={S.benefitPrivacy.dur}
      >
        <BenefitPrivacy />
      </Sequence>

      {/* ═══ PAUSE + COUNT-UP ═══ */}
      <Sequence from={S.pause.from} durationInFrames={S.pause.dur}>
        <AbsoluteFill style={{ backgroundColor: COLOR.page }} />
      </Sequence>
      <Sequence from={S.countUp.from} durationInFrames={S.countUp.dur}>
        <CountUp />
      </Sequence>

      {/* ═══ CLOSING ═══ */}
      <Sequence from={S.closing.from} durationInFrames={S.closing.dur}>
        <Closing />
      </Sequence>
    </AbsoluteFill>
  );
};

export const visionVCMeta = {
  id: "VisionVC",
  component: VisionVCComposition,
  durationInFrames: DURATION_FRAMES,
  fps: FPS as 30,
  width: 1920 as 1920,
  height: 1080 as 1080,
};
