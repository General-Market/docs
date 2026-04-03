/**
 * GMQuantsComposition — "Prediction Markets for Quants" launch video.
 *
 * Full-screen scenes. No split screens. The argument builds through
 * escalation, relief, and proof. 12 scenes, ~49s at 30fps.
 */
import React, { useMemo } from "react";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  interpolate,
  spring,
  Easing,
} from "remotion";
import { COLOR, FONT, ANIM } from "./tokens";
import { ParallaxIntro, INTRO_DUR } from "./ParallaxIntro";
import { LaptopDemo, LAPTOP_DUR } from "./LaptopDemo";

const FPS = 30;
const W = 1920;
const H = 1080;

// ── Scene durations ──

const FILTER_DUR = 60;
const COST_ESCALATOR_DUR = 240;
const COST_RESET_DUR = 90;
const SCALE_DUR = 90;
const ZERO_SPREAD_DUR = 90;
const EXCLUSIVE_DUR = 90;
const LIQUIDITY_DUR = 120;
const PRIVATE_DUR = 90;
const PUNCHLINE_DUR = 90;
const CTA_DUR = 120;

// ── Sequence offsets ──

const S0 = 0;
const S1 = S0 + INTRO_DUR;
const S2 = S1 + FILTER_DUR;
const S3 = S2 + COST_ESCALATOR_DUR;
const S4 = S3 + COST_RESET_DUR;
const S5 = S4 + SCALE_DUR;
const S6 = S5 + ZERO_SPREAD_DUR;
const S7 = S6 + EXCLUSIVE_DUR;
const S8 = S7 + LIQUIDITY_DUR;
const S9 = S8 + PRIVATE_DUR;
const S10 = S9 + LAPTOP_DUR;
const S11 = S10 + PUNCHLINE_DUR;
const TOTAL = S11 + CTA_DUR;

// ── Shared: SlamText ──

const SlamText: React.FC<{
  text: string;
  delay?: number;
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  font?: "sans" | "mono";
  lineHeight?: number;
}> = ({
  text,
  delay = 0,
  fontSize = 72,
  fontWeight = 900,
  color = COLOR.textPrimary,
  font = "sans",
  lineHeight = 1.15,
}) => {
  const frame = useCurrentFrame();
  const s = spring({
    frame: Math.max(0, frame - delay),
    fps: FPS,
    config: ANIM.slam,
  });
  const lines = text.split("\n");

  return (
    <div
      style={{
        textAlign: "center",
        opacity: interpolate(s, [0, 0.3], [0, 1], {
          extrapolateRight: "clamp",
        }),
        transform: `translateY(${interpolate(s, [0, 1], [80, 0])}px) scale(${interpolate(s, [0, 1], [0.5, 1])})`,
      }}
    >
      {lines.map((line, i) => (
        <div
          key={i}
          style={{
            fontFamily: FONT[font],
            fontSize,
            fontWeight,
            color,
            lineHeight,
          }}
        >
          {line}
        </div>
      ))}
    </div>
  );
};

// ── Shared: FilmGrain ──

const FilmGrain: React.FC<{ opacity?: number }> = ({ opacity = 0.035 }) => {
  const frame = useCurrentFrame();
  const ox = (frame * 37) % 256;
  const oy = (frame * 53) % 256;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        backgroundPosition: `${ox}px ${oy}px`,
        opacity,
        mixBlendMode: "overlay" as const,
        pointerEvents: "none" as const,
      }}
    />
  );
};

// ── Shared: AnimatedCounter ──

const AnimatedCounter: React.FC<{
  target: number;
  frame: number;
  delay: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  fontSize?: number;
  fontWeight?: number;
  color: string;
  glow?: string;
}> = ({
  target,
  frame,
  delay,
  duration = 50,
  prefix = "",
  suffix = "",
  fontSize = 52,
  fontWeight = 700,
  color,
  glow,
}) => {
  const local = Math.max(0, frame - delay);
  const progress = interpolate(local, [0, duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const current = Math.round(progress * target);
  const formatted = current.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const s = spring({ frame: local, fps: FPS, config: ANIM.slam });

  return (
    <div
      style={{
        fontFamily: FONT.mono,
        fontSize,
        fontWeight,
        color,
        letterSpacing: 1,
        opacity: interpolate(s, [0, 0.3], [0, 1], {
          extrapolateRight: "clamp",
        }),
        transform: `scale(${interpolate(s, [0, 1], [0.6, 1])})`,
        textShadow: glow || `0 0 30px ${color}44`,
      }}
    >
      {prefix}
      {formatted}
      {suffix}
    </div>
  );
};

// ── Scene 1: Filter ──

const FilterScene: React.FC = () => (
  <AbsoluteFill
    style={{
      background: COLOR.page,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 20,
    }}
  >
    <SlamText
      text="Prediction Markets."
      delay={5}
      fontSize={64}
      fontWeight={800}
      font="mono"
    />
    <SlamText
      text="For Quants."
      delay={20}
      fontSize={64}
      fontWeight={800}
      color={COLOR.brand}
      font="mono"
    />
    <FilmGrain />
  </AbsoluteFill>
);

// ── Scene 2: CostEscalator ──

interface EscalatorRow {
  positions: string;
  posTarget: number;
  cost: string;
  costTarget: number;
  posSize: number;
  costSize: number;
  costWeight: number;
  costColor: string;
  costGlow?: string;
  startFrame: number;
}

const ESCALATOR_ROWS: EscalatorRow[] = [
  {
    positions: "10",
    posTarget: 10,
    cost: "$5",
    costTarget: 5,
    posSize: 52,
    costSize: 52,
    costWeight: 700,
    costColor: COLOR.textMuted,
    startFrame: 20,
  },
  {
    positions: "10,000",
    posTarget: 10000,
    cost: "$50,000",
    costTarget: 50000,
    posSize: 56,
    costSize: 56,
    costWeight: 700,
    costColor: COLOR.bad,
    startFrame: 80,
  },
  {
    positions: "10,000,000",
    posTarget: 10000000,
    cost: "$5,000,000",
    costTarget: 5000000,
    posSize: 64,
    costSize: 72,
    costWeight: 900,
    costColor: COLOR.bad,
    costGlow:
      "0 0 20px rgba(255,100,100,0.5), 0 0 60px rgba(255,100,100,0.3)",
    startFrame: 140,
  },
];

const CostEscalatorScene: React.FC = () => {
  const frame = useCurrentFrame();

  const activeIndex = ESCALATOR_ROWS.reduce(
    (acc, row, i) => (frame >= row.startFrame ? i : acc),
    0,
  );

  return (
    <AbsoluteFill
      style={{
        background: COLOR.page,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 40,
      }}
    >
      {/* Column headers */}
      <div
        style={{
          display: "flex",
          gap: 200,
          marginBottom: 10,
        }}
      >
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 20,
            fontWeight: 500,
            color: COLOR.textMuted,
            letterSpacing: 4,
          }}
        >
          POSITIONS
        </div>
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 20,
            fontWeight: 500,
            color: COLOR.textMuted,
            letterSpacing: 4,
          }}
        >
          COST
        </div>
      </div>

      {/* Rows */}
      {ESCALATOR_ROWS.map((row, i) => {
        const visible = frame >= row.startFrame;
        if (!visible) return null;

        const isPast = i < activeIndex;
        const rowScale = isPast ? 0.85 : 1;
        const rowOpacity = isPast ? 0.4 : 1;
        const rowS = spring({
          frame: Math.max(0, frame - row.startFrame),
          fps: FPS,
          config: ANIM.slam,
        });

        return (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 120,
              opacity:
                interpolate(rowS, [0, 0.3], [0, 1], {
                  extrapolateRight: "clamp",
                }) * rowOpacity,
              transform: `translateY(${interpolate(rowS, [0, 1], [60, 0])}px) scale(${interpolate(rowS, [0, 1], [0.5, 1]) * rowScale})`,
              transition: "opacity 0.3s, transform 0.3s",
            }}
          >
            <AnimatedCounter
              target={row.posTarget}
              frame={frame}
              delay={row.startFrame}
              color={COLOR.textPrimary}
              fontSize={row.posSize}
            />
            <AnimatedCounter
              target={row.costTarget}
              frame={frame}
              delay={row.startFrame}
              prefix="$"
              color={row.costColor}
              fontSize={row.costSize}
              fontWeight={row.costWeight}
              glow={row.costGlow}
            />
          </div>
        );
      })}

      <FilmGrain />
    </AbsoluteFill>
  );
};

// ── Scene 3: CostReset ──

const CostResetScene: React.FC = () => {
  const frame = useCurrentFrame();
  const zeroS = spring({
    frame: Math.max(0, frame - 8),
    fps: FPS,
    config: ANIM.slam,
  });
  const detailS = spring({
    frame: Math.max(0, frame - 25),
    fps: FPS,
    config: ANIM.medium,
  });

  return (
    <AbsoluteFill
      style={{
        background: COLOR.page,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 30,
      }}
    >
      {/* Positions label */}
      <div
        style={{
          fontFamily: FONT.mono,
          fontSize: 52,
          fontWeight: 700,
          color: COLOR.textMuted,
        }}
      >
        10,000,000
      </div>

      {/* $0 */}
      <div
        style={{
          fontFamily: FONT.mono,
          fontSize: 120,
          fontWeight: 900,
          color: COLOR.brand,
          opacity: interpolate(zeroS, [0, 0.3], [0, 1], {
            extrapolateRight: "clamp",
          }),
          transform: `scale(${interpolate(zeroS, [0, 1], [0.4, 1])})`,
          textShadow:
            "0 0 40px rgba(0,200,83,0.4), 0 0 80px rgba(0,200,83,0.4)",
        }}
      >
        $0
      </div>

      {/* Details */}
      <div
        style={{
          fontFamily: FONT.mono,
          fontSize: 18,
          fontWeight: 500,
          color: COLOR.textMuted,
          letterSpacing: 1,
          opacity: interpolate(detailS, [0, 0.5], [0, 1], {
            extrapolateRight: "clamp",
          }),
          transform: `translateY(${interpolate(detailS, [0, 1], [15, 0])}px)`,
        }}
      >
        no gas. no spread. no minimum size.
      </div>

      <FilmGrain />
    </AbsoluteFill>
  );
};

// ── Scene 4: Scale ──

const ScaleScene: React.FC = () => {
  const frame = useCurrentFrame();
  const line3S = spring({
    frame: Math.max(0, frame - 35),
    fps: FPS,
    config: ANIM.medium,
  });

  return (
    <AbsoluteFill
      style={{
        background: COLOR.page,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
      }}
    >
      <SlamText
        text="300,000 markets"
        delay={5}
        fontSize={56}
        fontWeight={900}
      />
      <SlamText
        text="Resolving 100 times a day"
        delay={18}
        fontSize={36}
        fontWeight={600}
        color={COLOR.textMuted}
      />
      <div
        style={{
          fontFamily: FONT.mono,
          fontSize: 28,
          fontWeight: 700,
          color: COLOR.brand,
          opacity: interpolate(line3S, [0, 0.5], [0, 1], {
            extrapolateRight: "clamp",
          }),
          transform: `translateY(${interpolate(line3S, [0, 1], [30, 0])}px) scale(${interpolate(line3S, [0, 1], [0.8, 1])})`,
        }}
      >
        30,000,000 daily opportunities
      </div>
      <FilmGrain />
    </AbsoluteFill>
  );
};

// ── Scene 5: ZeroSpread ──

const ZeroSpreadScene: React.FC = () => (
  <AbsoluteFill
    style={{
      background: COLOR.page,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 24,
    }}
  >
    <SlamText
      text="Zero spread on every market"
      delay={5}
      fontSize={52}
      fontWeight={900}
    />
    <SlamText
      text="Your edge stays your edge"
      delay={22}
      fontSize={36}
      fontWeight={600}
      color={COLOR.brand}
    />
    <FilmGrain />
  </AbsoluteFill>
);

// ── Scene 6: Exclusive ──

const EXCLUSIVE_TAGS = [
  "German Trains",
  "Twitch Viewers",
  "Steam Players",
  "Aircraft Positions",
  "Earthquake Data",
  "Movie Box Office",
  "Reddit Karma",
  "4chan Activity",
];

const ExclusiveScene: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill
      style={{
        background: COLOR.page,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
      }}
    >
      <SlamText
        text="Exclusive data sources"
        delay={5}
        fontSize={52}
        fontWeight={900}
      />
      <SlamText
        text="No hedge fund can access these markets"
        delay={18}
        fontSize={32}
        fontWeight={600}
        color={COLOR.textMuted}
      />

      {/* Tags */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: 10,
          maxWidth: 700,
          marginTop: 16,
        }}
      >
        {EXCLUSIVE_TAGS.map((tag, i) => {
          const tagS = spring({
            frame: Math.max(0, frame - 30 - i * 4),
            fps: FPS,
            config: ANIM.fast,
          });
          return (
            <div
              key={tag}
              style={{
                padding: "6px 14px",
                borderRadius: 8,
                background: "rgba(0,200,83,0.12)",
                border: "1px solid rgba(0,200,83,0.25)",
                fontFamily: FONT.mono,
                fontSize: 14,
                fontWeight: 600,
                color: COLOR.brand,
                opacity: interpolate(tagS, [0, 0.5], [0, 1], {
                  extrapolateRight: "clamp",
                }),
                transform: `translateY(${interpolate(tagS, [0, 1], [20, 0])}px)`,
              }}
            >
              {tag}
            </div>
          );
        })}
      </div>

      <FilmGrain />
    </AbsoluteFill>
  );
};

// ── Scene 7: Liquidity ──

const GRID_SIZE = 10;
const CELL_SIZE = 40;
const CELL_GAP = 5;

const LiquidityGrid: React.FC = () => {
  const frame = useCurrentFrame();

  const cells = useMemo(() => {
    const result: { row: number; col: number; delay: number }[] = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        result.push({ row: r, col: c, delay: r * 3 + c * 2 });
      }
    }
    return result;
  }, []);

  const labelS = spring({
    frame: Math.max(0, frame - 60),
    fps: FPS,
    config: ANIM.medium,
  });

  return (
    <AbsoluteFill
      style={{
        background: COLOR.page,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 40,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${GRID_SIZE}, ${CELL_SIZE}px)`,
          gap: CELL_GAP,
        }}
      >
        {cells.map(({ row, col, delay }, i) => {
          const s = spring({
            frame: Math.max(0, frame - delay),
            fps: FPS,
            config: ANIM.fast,
          });

          return (
            <div
              key={i}
              style={{
                width: CELL_SIZE,
                height: CELL_SIZE,
                borderRadius: 6,
                backgroundColor: COLOR.brand,
                opacity: interpolate(s, [0, 1], [0, 1]),
                transform: `scale(${interpolate(s, [0, 1], [0.2, 1])})`,
                boxShadow: `0 0 8px rgba(0,200,83,0.4)`,
              }}
            />
          );
        })}
      </div>

      <div
        style={{
          fontFamily: FONT.mono,
          fontSize: 28,
          fontWeight: 700,
          color: COLOR.brand,
          opacity: interpolate(labelS, [0, 0.5], [0, 1], {
            extrapolateRight: "clamp",
          }),
          transform: `translateY(${interpolate(labelS, [0, 1], [15, 0])}px)`,
        }}
      >
        100% of markets liquid
      </div>

      <FilmGrain />
    </AbsoluteFill>
  );
};

// ── Scene 8: Private ──

const LockIcon: React.FC<{ opacity: number }> = ({ opacity }) => (
  <svg
    width={48}
    height={48}
    viewBox="0 0 24 24"
    fill="none"
    stroke={COLOR.textMuted}
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ opacity }}
  >
    <rect x={3} y={11} width={18} height={11} rx={2} ry={2} />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const PrivateScene: React.FC = () => {
  const frame = useCurrentFrame();
  const lockS = spring({
    frame: Math.max(0, frame - 35),
    fps: FPS,
    config: ANIM.medium,
  });

  return (
    <AbsoluteFill
      style={{
        background: COLOR.page,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
      }}
    >
      <SlamText
        text="Your strategies stay private"
        delay={5}
        fontSize={52}
        fontWeight={900}
      />
      <SlamText
        text="No one sees your positions"
        delay={20}
        fontSize={36}
        fontWeight={600}
        color={COLOR.textMuted}
      />
      <LockIcon
        opacity={interpolate(lockS, [0, 0.5], [0, 0.6], {
          extrapolateRight: "clamp",
        })}
      />
      <FilmGrain />
    </AbsoluteFill>
  );
};

// ── Scene 10: Punchline ──

const PunchlineScene: React.FC = () => (
  <AbsoluteFill
    style={{
      background: COLOR.page,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    }}
  >
    <SlamText
      text="Open 100,000x"
      delay={8}
      fontSize={72}
      fontWeight={900}
    />
    <SlamText
      text="more positions."
      delay={18}
      fontSize={72}
      fontWeight={900}
      color={COLOR.brand}
    />
    <FilmGrain />
  </AbsoluteFill>
);

// ── Scene 11: CTA ──

const CTAScene: React.FC = () => {
  const frame = useCurrentFrame();
  const logoS = spring({
    frame: Math.max(0, frame - 8),
    fps: FPS,
    config: ANIM.slam,
  });
  const lineWidth = interpolate(frame, [25, 50], [0, 300], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const urlOpacity = interpolate(frame, [35, 50], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: COLOR.page,
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
          fontSize: 88,
          fontWeight: 900,
          color: COLOR.brand,
          letterSpacing: -1,
          opacity: interpolate(logoS, [0, 0.3], [0, 1], {
            extrapolateRight: "clamp",
          }),
          transform: `scale(${interpolate(logoS, [0, 1], [0.4, 1])})`,
        }}
      >
        General Market
      </div>

      <div
        style={{
          width: lineWidth,
          height: 2,
          backgroundColor: COLOR.brand,
          borderRadius: 1,
        }}
      />

      <div
        style={{
          fontFamily: FONT.sans,
          fontSize: 26,
          fontWeight: 500,
          color: COLOR.textMuted,
          letterSpacing: 4,
          opacity: urlOpacity,
        }}
      >
        generalmarket.io
      </div>

      <FilmGrain opacity={0.02} />
    </AbsoluteFill>
  );
};

// ── Main Composition ──

export const GMQuantsComposition: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: COLOR.page }}>
    <Sequence from={S0} durationInFrames={INTRO_DUR}>
      <ParallaxIntro />
    </Sequence>

    <Sequence from={S1} durationInFrames={FILTER_DUR}>
      <FilterScene />
    </Sequence>

    <Sequence from={S2} durationInFrames={COST_ESCALATOR_DUR}>
      <CostEscalatorScene />
    </Sequence>

    <Sequence from={S3} durationInFrames={COST_RESET_DUR}>
      <CostResetScene />
    </Sequence>

    <Sequence from={S4} durationInFrames={SCALE_DUR}>
      <ScaleScene />
    </Sequence>

    <Sequence from={S5} durationInFrames={ZERO_SPREAD_DUR}>
      <ZeroSpreadScene />
    </Sequence>

    <Sequence from={S6} durationInFrames={EXCLUSIVE_DUR}>
      <ExclusiveScene />
    </Sequence>

    <Sequence from={S7} durationInFrames={LIQUIDITY_DUR}>
      <LiquidityGrid />
    </Sequence>

    <Sequence from={S8} durationInFrames={PRIVATE_DUR}>
      <PrivateScene />
    </Sequence>

    <Sequence from={S9} durationInFrames={LAPTOP_DUR}>
      <LaptopDemo />
    </Sequence>

    <Sequence from={S10} durationInFrames={PUNCHLINE_DUR}>
      <PunchlineScene />
    </Sequence>

    <Sequence from={S11} durationInFrames={CTA_DUR}>
      <CTAScene />
    </Sequence>
  </AbsoluteFill>
);

export const gmQuantsMeta = {
  id: "GMQuants",
  component: GMQuantsComposition,
  width: W,
  height: H,
  fps: FPS,
  durationInFrames: TOTAL,
};
