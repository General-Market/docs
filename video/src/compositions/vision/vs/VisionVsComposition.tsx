/**
 * VisionVs — "Others vs Us" Split-Screen Comparison
 *
 * Nine scenes, each bisected. Left: the old way (despair deepens).
 * Right: Vision (joy accumulates). Blurred b-roll behind tinted overlays,
 * meme faces that progress across scenes, spring-slammed text.
 * ~35s at 30fps.
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
import { noise2D } from "@remotion/noise";
import { COLOR, FONT, ANIM } from "./tokens";

const FPS = 30;
const W = 1920;
const H = 1080;
const HALF = W / 2;

// ═══════════════════════════════════════════════════════════════════════
// SCENE DATA
// ═══════════════════════════════════════════════════════════════════════

interface SceneData {
  leftText: string;
  rightText: string;
  leftBroll: string;
  rightBroll: string;
}

const IMG = "compositions/vision-vc2/markets";

const SCENES: SceneData[] = [
  {
    leftText: "Trade against\nInsider Traders",
    rightText: "Trade against\nRetail Players",
    leftBroll: `${IMG}/nasdaq.jpg`,
    rightBroll: `${IMG}/steam.jpg`,
  },
  {
    leftText: "Buy\n1 Asset",
    rightText: "Buy\n10,000 Assets",
    leftBroll: `${IMG}/bitcoin.jpg`,
    rightBroll: `${IMG}/twitch.jpg`,
  },
  {
    leftText: "Trade Politics,\nCrypto, Stocks",
    rightText: "Trade Train Delays,\nMovies, Steam, Twitch",
    leftBroll: `${IMG}/congress.jpg`,
    rightBroll: `${IMG}/train.jpg`,
  },
  {
    leftText: "Wait 1 Month\nfor Settlement",
    rightText: "Wait 1 Week\nfor Settlement",
    leftBroll: `${IMG}/defi.jpg`,
    rightBroll: `${IMG}/movies.jpg`,
  },
  {
    leftText: "Wait\n1 Month",
    rightText: "Wait\n10 Minutes",
    leftBroll: `${IMG}/nasdaq.jpg`,
    rightBroll: `${IMG}/anime.jpg`,
  },
  {
    leftText: "Risk\nLeverage",
    rightText: "Just Wait\n10 Minutes",
    leftBroll: `${IMG}/bitcoin.jpg`,
    rightBroll: `${IMG}/chess.jpg`,
  },
  {
    leftText: "Choose between\n30,000 Markets",
    rightText: "Choose between\n300,000 Markets",
    leftBroll: `${IMG}/congress.jpg`,
    rightBroll: `${IMG}/esports.jpg`,
  },
  {
    leftText: "Trade Things\nYou Don't Care About",
    rightText: "Trade Things\nYou Love",
    leftBroll: `${IMG}/defi.jpg`,
    rightBroll: `${IMG}/steam.jpg`,
  },
  {
    leftText: "Pay Spreads on\nLow Liquidity",
    rightText: "Infinite Liquidity\nParimutuel Pool",
    leftBroll: `${IMG}/nasdaq.jpg`,
    rightBroll: `${IMG}/train-cartoon.jpg`,
  },
  {
    leftText: "3% of Markets\nAre Liquid",
    rightText: "100% of Markets\nAre Liquid",
    leftBroll: `${IMG}/defi.jpg`,
    rightBroll: `${IMG}/esports.jpg`,
  },
];

// Meme face progression — left gets worse, right gets better
const LEFT_FACES = [
  "\u{1F610}", // 😐 neutral
  "\u{1F615}", // 😕 confused
  "\u{1F61F}", // 😟 worried
  "\u{1F630}", // 😰 anxious
  "\u{1F62B}", // 😫 tired
  "\u{1F629}", // 😩 weary
  "\u{1F62D}", // 😭 crying
  "\u{1F92F}", // 🤯 exploding
  "\u{1F480}", // 💀 skull
  "\u{26B0}\u{FE0F}", // ⚰️ coffin
];

const RIGHT_FACES = [
  "\u{1F642}", // 🙂 slight smile
  "\u{1F60A}", // 😊 smiling
  "\u{1F604}", // 😄 grinning
  "\u{1F601}", // 😁 beaming
  "\u{1F929}", // 🤩 star-struck
  "\u{1F973}", // 🥳 party
  "\u{1F60E}", // 😎 cool
  "\u{1F911}", // 🤑 money-mouth
  "\u{1F451}", // 👑 crown
  "\u{1F48E}", // 💎 gem
];

// ═══════════════════════════════════════════════════════════════════════
// TIMING
// ═══════════════════════════════════════════════════════════════════════

const INTRO_DUR = 65;
const SCENE_DUR = 100;
const OUTRO_DUR = 90;
const SCENE_STARTS = SCENES.map((_, i) => INTRO_DUR + i * SCENE_DUR);
const TOTAL = INTRO_DUR + SCENES.length * SCENE_DUR + OUTRO_DUR;

// ═══════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════

function useExit(frame: number, exitStart: number, exitDur: number) {
  const raw = interpolate(frame, [exitStart, exitStart + exitDur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const p = Easing.in(Easing.cubic)(raw);
  return { opacity: 1 - p, y: p * -30 };
}

// ═══════════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════════

const BrollHalf: React.FC<{
  src: string;
  side: "left" | "right";
  overlayColor: string;
  frame: number;
}> = ({ src, side, overlayColor, frame }) => {
  const zoom = interpolate(frame, [0, SCENE_DUR], [1.05, 1.15], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const panX = interpolate(frame, [0, SCENE_DUR], [0, side === "left" ? -15 : 15], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: side === "left" ? 0 : HALF,
        width: HALF,
        height: H,
        overflow: "hidden",
      }}
    >
      <Img
        src={staticFile(src)}
        style={{
          position: "absolute",
          width: "130%",
          height: "130%",
          top: "-15%",
          left: "-15%",
          objectFit: "cover",
          filter: "blur(14px) saturate(0.5) brightness(0.7)",
          transform: `scale(${zoom}) translateX(${panX}px)`,
        }}
      />
      <div style={{ position: "absolute", inset: 0, background: overlayColor }} />
    </div>
  );
};

const MemeFace: React.FC<{
  emoji: string;
  frame: number;
  delay: number;
  side: "left" | "right";
}> = ({ emoji, frame, delay, side }) => {
  const s = spring({
    frame: Math.max(0, frame - delay),
    fps: FPS,
    config: ANIM.bounce,
  });
  const seed = side === "left" ? "ml" : "mr";
  const wobX = noise2D(seed, frame * 0.025, 0) * 4;
  const wobY = noise2D(seed, 0, frame * 0.025) * 3;

  return (
    <div
      style={{
        fontSize: 150,
        lineHeight: 1,
        transform: [
          `scale(${interpolate(s, [0, 1], [0.2, 1])})`,
          `translateY(${interpolate(s, [0, 1], [50, 0]) + wobY}px)`,
          `translateX(${wobX}px)`,
        ].join(" "),
        opacity: interpolate(s, [0, 0.3], [0, 1], {
          extrapolateRight: "clamp",
        }),
        filter: "drop-shadow(0 6px 16px rgba(0,0,0,0.4))",
      }}
    >
      {emoji}
    </div>
  );
};

const SideLabel: React.FC<{
  text: string;
  color: string;
  frame: number;
  delay: number;
}> = ({ text, color, frame, delay }) => {
  const s = spring({
    frame: Math.max(0, frame - delay),
    fps: FPS,
    config: ANIM.fast,
  });

  return (
    <div
      style={{
        fontFamily: FONT.sans,
        fontSize: 20,
        fontWeight: 700,
        letterSpacing: 6,
        textTransform: "uppercase" as const,
        color,
        opacity: interpolate(s, [0, 0.5], [0, 1], {
          extrapolateRight: "clamp",
        }),
        transform: `translateY(${interpolate(s, [0, 1], [15, 0])}px)`,
      }}
    >
      {text}
    </div>
  );
};

const ComparisonText: React.FC<{
  text: string;
  frame: number;
  delay: number;
  exitStart: number;
}> = ({ text, frame, delay, exitStart }) => {
  const s = spring({
    frame: Math.max(0, frame - delay),
    fps: FPS,
    config: ANIM.slam,
  });
  const exit = useExit(frame, exitStart, 15);
  const lines = text.split("\n");

  return (
    <div
      style={{
        textAlign: "center" as const,
        opacity:
          interpolate(s, [0, 0.3], [0, 1], { extrapolateRight: "clamp" }) *
          exit.opacity,
        transform: [
          `translateY(${interpolate(s, [0, 1], [60, 0]) + exit.y}px)`,
          `scale(${interpolate(s, [0, 1], [0.75, 1])})`,
        ].join(" "),
      }}
    >
      {lines.map((line, i) => (
        <div
          key={line}
          style={{
            fontFamily: FONT.sans,
            fontSize: i === 0 ? 50 : 42,
            fontWeight: i === 0 ? 800 : 600,
            color: COLOR.textPrimary,
            lineHeight: 1.25,
            textShadow: "0 2px 24px rgba(0,0,0,0.5)",
          }}
        >
          {line}
        </div>
      ))}
    </div>
  );
};

// ── Animated Counter (scenes 1, 6) ──
const AnimatedCounter: React.FC<{
  target: number;
  frame: number;
  delay: number;
  prefix?: string;
  suffix?: string;
  color: string;
}> = ({ target, frame, delay, prefix = "", suffix = "", color }) => {
  const localFrame = Math.max(0, frame - delay);
  const progress = interpolate(localFrame, [0, 50], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const current = Math.round(progress * target);
  const formatted = current.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const s = spring({ frame: localFrame, fps: FPS, config: ANIM.slam });

  return (
    <div
      style={{
        fontFamily: FONT.mono,
        fontSize: 38,
        fontWeight: 700,
        color,
        letterSpacing: 1,
        opacity: interpolate(s, [0, 0.3], [0, 1], {
          extrapolateRight: "clamp",
        }),
        transform: `scale(${interpolate(s, [0, 1], [0.6, 1])})`,
        textShadow: `0 0 30px ${color}44`,
      }}
    >
      {prefix}{formatted}{suffix}
    </div>
  );
};

// ── Scrolling Market Tags (scene 2) ──
const MARKET_TAGS = [
  "Train Delays", "Movie Box Office", "Steam Players", "Twitch Viewers",
  "Weather", "Earthquakes", "Reddit Karma", "GitHub Stars",
  "Air Quality", "Ship Tracking", "Bird Migration", "Volcano Activity",
];

const MarketScroll: React.FC<{ frame: number; delay: number }> = ({
  frame,
  delay,
}) => {
  const localFrame = Math.max(0, frame - delay);
  const s = spring({ frame: localFrame, fps: FPS, config: ANIM.medium });

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        justifyContent: "center",
        maxWidth: 380,
        opacity: interpolate(s, [0, 0.5], [0, 1], {
          extrapolateRight: "clamp",
        }),
      }}
    >
      {MARKET_TAGS.map((tag, i) => {
        const tagS = spring({
          frame: Math.max(0, localFrame - i * 2),
          fps: FPS,
          config: ANIM.fast,
        });
        return (
          <div
            key={tag}
            style={{
              padding: "4px 10px",
              borderRadius: 6,
              background: "rgba(0,200,83,0.15)",
              border: "1px solid rgba(0,200,83,0.3)",
              fontFamily: FONT.sans,
              fontSize: 13,
              fontWeight: 600,
              color: COLOR.brand,
              opacity: interpolate(tagS, [0, 0.5], [0, 1], {
                extrapolateRight: "clamp",
              }),
              transform: `translateY(${interpolate(tagS, [0, 1], [12, 0])}px)`,
            }}
          >
            {tag}
          </div>
        );
      })}
    </div>
  );
};

// ── Timer Animation (scenes 3, 4) ──
const TimerDisplay: React.FC<{
  label: string;
  frame: number;
  delay: number;
  fast?: boolean;
}> = ({ label, frame, delay, fast = false }) => {
  const localFrame = Math.max(0, frame - delay);
  const s = spring({ frame: localFrame, fps: FPS, config: ANIM.medium });
  const pulse = fast
    ? Math.sin(localFrame * 0.4) * 0.08 + 1
    : 1;

  return (
    <div
      style={{
        fontFamily: FONT.mono,
        fontSize: 32,
        fontWeight: 700,
        color: fast ? COLOR.brand : COLOR.bad,
        opacity: interpolate(s, [0, 0.5], [0, 1], {
          extrapolateRight: "clamp",
        }),
        transform: `scale(${interpolate(s, [0, 1], [0.5, 1]) * pulse})`,
        textShadow: fast
          ? `0 0 20px ${COLOR.brand}66`
          : `0 0 20px rgba(255,100,100,0.4)`,
      }}
    >
      {label}
    </div>
  );
};

// ── Liquidity Curve (scene 8) ──
const LiquidityCurve: React.FC<{
  frame: number;
  delay: number;
  type: "orderbook" | "parimutuel";
}> = ({ frame, delay, type }) => {
  const localFrame = Math.max(0, frame - delay);
  const draw = interpolate(localFrame, [0, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const s = spring({ frame: localFrame, fps: FPS, config: ANIM.medium });

  const w = 200;
  const h = 80;

  const path =
    type === "orderbook"
      ? `M 0 ${h} L ${w * 0.3 * draw} ${h * 0.7} L ${w * 0.45 * draw} ${h * 0.4} L ${w * 0.5 * draw} ${h * 0.15} L ${w * 0.55 * draw} ${h * 0.5} L ${w * 0.7 * draw} ${h * 0.75} L ${w * draw} ${h}`
      : `M 0 ${h * 0.9} Q ${w * 0.5 * draw} ${h * -0.3} ${w * draw} ${h * 0.9}`;

  return (
    <svg
      width={w}
      height={h}
      style={{
        opacity: interpolate(s, [0, 0.5], [0, 1], {
          extrapolateRight: "clamp",
        }),
      }}
    >
      <path
        d={path}
        fill="none"
        stroke={type === "orderbook" ? COLOR.bad : COLOR.brand}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      {type === "parimutuel" && (
        <path
          d={`M 0 ${h * 0.9} Q ${w * 0.5 * draw} ${h * -0.3} ${w * draw} ${h * 0.9}`}
          fill={`${COLOR.brand}22`}
          stroke="none"
        />
      )}
    </svg>
  );
};

// ── Liquidity Grid (scene 9) ──
const GRID_SIZE = 10;
const CELL = 26;
const GAP = 3;
const LEFT_LIT = new Set([12, 23, 37, 45, 56, 78, 84]);

const LiquidityGrid: React.FC<{
  frame: number;
  delay: number;
  side: "left" | "right";
}> = ({ frame, delay, side }) => {
  const localFrame = Math.max(0, frame - delay);
  const allLit = side === "right";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${GRID_SIZE}, ${CELL}px)`,
        gap: GAP,
      }}
    >
      {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, i) => {
        const isLit = allLit || LEFT_LIT.has(i);
        const enterDelay = allLit
          ? Math.floor(i / GRID_SIZE) * 2 + (i % GRID_SIZE) * 1.5
          : 0;
        const s = spring({
          frame: Math.max(0, localFrame - enterDelay),
          fps: FPS,
          config: ANIM.fast,
        });

        // Left lit cells flicker
        const flicker =
          !allLit && isLit
            ? 0.35 + 0.65 * Math.abs(Math.sin(frame * 0.12 + i * 1.7))
            : 1;

        const color = isLit
          ? allLit
            ? COLOR.brand
            : COLOR.bad
          : "rgba(255,255,255,0.06)";

        const glow = isLit && allLit ? `0 0 6px ${COLOR.brand}66` : "none";

        return (
          <div
            key={i}
            style={{
              width: CELL,
              height: CELL,
              borderRadius: 4,
              backgroundColor: color,
              opacity: interpolate(s, [0, 1], [0, isLit ? flicker : 0.7]),
              transform: `scale(${interpolate(s, [0, 1], [0.2, 1])})`,
              boxShadow: glow,
            }}
          />
        );
      })}
    </div>
  );
};

// ── Scene Extras — unique element per scene ──
const SceneExtras: React.FC<{
  sceneIndex: number;
  frame: number;
  side: "left" | "right";
}> = ({ sceneIndex, frame, side }) => {
  // Scene 1: counter (1 vs 10,000)
  if (sceneIndex === 1) {
    if (side === "left") {
      return <AnimatedCounter target={1} frame={frame} delay={20} color={COLOR.bad} />;
    }
    return <AnimatedCounter target={10000} frame={frame} delay={20} color={COLOR.brand} />;
  }

  // Scene 2: market tags on right
  if (sceneIndex === 2 && side === "right") {
    return <MarketScroll frame={frame} delay={16} />;
  }

  // Scene 3: timer labels
  if (sceneIndex === 3) {
    if (side === "left") {
      return <TimerDisplay label="~30 days" frame={frame} delay={20} />;
    }
    return <TimerDisplay label="~7 days" frame={frame} delay={20} fast />;
  }

  // Scene 4: timer labels
  if (sceneIndex === 4) {
    if (side === "left") {
      return <TimerDisplay label="~30 days" frame={frame} delay={20} />;
    }
    return <TimerDisplay label="10:00" frame={frame} delay={20} fast />;
  }

  // Scene 6: counter (30K vs 300K)
  if (sceneIndex === 6) {
    if (side === "left") {
      return <AnimatedCounter target={30000} frame={frame} delay={20} color={COLOR.bad} />;
    }
    return <AnimatedCounter target={300000} frame={frame} delay={20} color={COLOR.brand} />;
  }

  // Scene 8: liquidity curves
  if (sceneIndex === 8) {
    if (side === "left") {
      return <LiquidityCurve frame={frame} delay={18} type="orderbook" />;
    }
    return <LiquidityCurve frame={frame} delay={18} type="parimutuel" />;
  }

  // Scene 9: liquidity grid
  if (sceneIndex === 9) {
    return <LiquidityGrid frame={frame} delay={14} side={side} />;
  }

  return null;
};

// ── Film Grain ──
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

// ── Progress Dots ──
const ProgressDots: React.FC<{
  total: number;
  current: number;
  frame: number;
}> = ({ total, current, frame }) => {
  const s = spring({
    frame: Math.max(0, frame - 6),
    fps: FPS,
    config: ANIM.fast,
  });

  return (
    <div
      style={{
        position: "absolute",
        bottom: 40,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        gap: 12,
        opacity: interpolate(s, [0, 0.5], [0, 1], {
          extrapolateRight: "clamp",
        }),
      }}
    >
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            width: i === current ? 28 : 8,
            height: 8,
            borderRadius: 4,
            background:
              i === current
                ? COLOR.brand
                : i < current
                  ? "rgba(255,255,255,0.4)"
                  : "rgba(255,255,255,0.15)",
            transition: "none",
          }}
        />
      ))}
    </div>
  );
};

// ── Vertical Divider ──
const Divider: React.FC<{ frame: number }> = ({ frame }) => {
  const s = spring({
    frame: Math.max(0, frame - 2),
    fps: FPS,
    config: ANIM.fast,
  });
  const h = interpolate(s, [0, 1], [0, H]);
  const badgeOp = interpolate(s, [0.5, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const badgeScale = interpolate(s, [0.5, 1], [0.4, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <>
      <div
        style={{
          position: "absolute",
          left: HALF - 1.5,
          top: (H - h) / 2,
          width: 3,
          height: h,
          background:
            "linear-gradient(180deg, transparent, rgba(255,255,255,0.7), transparent)",
          borderRadius: 2,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: HALF - 28,
          top: H / 2 - 28,
          width: 56,
          height: 56,
          borderRadius: 28,
          background: "rgba(0,0,0,0.85)",
          border: "2px solid rgba(255,255,255,0.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: FONT.sans,
          fontSize: 18,
          fontWeight: 800,
          color: "#fff",
          opacity: badgeOp,
          transform: `scale(${badgeScale})`,
        }}
      >
        VS
      </div>
    </>
  );
};

// ── Single Comparison Scene ──
const ComparisonScene: React.FC<{
  scene: SceneData;
  sceneIndex: number;
}> = ({ scene, sceneIndex }) => {
  const frame = useCurrentFrame();
  const exitStart = SCENE_DUR - 18;

  return (
    <AbsoluteFill>
      <BrollHalf
        src={scene.leftBroll}
        side="left"
        overlayColor={COLOR.leftOverlay}
        frame={frame}
      />
      <BrollHalf
        src={scene.rightBroll}
        side="right"
        overlayColor={COLOR.rightOverlay}
        frame={frame}
      />

      <FilmGrain />
      <Divider frame={frame} />

      {/* Left content */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: HALF,
          height: H,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-evenly",
          paddingTop: 80,
          paddingBottom: 80,
          paddingLeft: 40,
          paddingRight: 40,
        }}
      >
        <SideLabel text="Others" color={COLOR.bad} frame={frame} delay={4} />
        <ComparisonText
          text={scene.leftText}
          frame={frame}
          delay={8}
          exitStart={exitStart}
        />
        <SceneExtras sceneIndex={sceneIndex} frame={frame} side="left" />
        <MemeFace
          emoji={LEFT_FACES[sceneIndex]}
          frame={frame}
          delay={14}
          side="left"
        />
      </div>

      {/* Right content */}
      <div
        style={{
          position: "absolute",
          left: HALF,
          top: 0,
          width: HALF,
          height: H,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-evenly",
          paddingTop: 80,
          paddingBottom: 80,
          paddingLeft: 40,
          paddingRight: 40,
        }}
      >
        <SideLabel
          text="Vision"
          color={COLOR.brand}
          frame={frame}
          delay={4}
        />
        <ComparisonText
          text={scene.rightText}
          frame={frame}
          delay={12}
          exitStart={exitStart}
        />
        <SceneExtras sceneIndex={sceneIndex} frame={frame} side="right" />
        <MemeFace
          emoji={RIGHT_FACES[sceneIndex]}
          frame={frame}
          delay={18}
          side="right"
        />
      </div>

      <ProgressDots total={SCENES.length} current={sceneIndex} frame={frame} />
    </AbsoluteFill>
  );
};

// ── Intro ──
const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const titleS = spring({ frame, fps: FPS, config: ANIM.slam });
  const subS = spring({
    frame: Math.max(0, frame - 14),
    fps: FPS,
    config: ANIM.medium,
  });
  const exit = useExit(frame, 45, 18);

  return (
    <AbsoluteFill
      style={{
        background:
          "linear-gradient(135deg, #0a0a0a 0%, #1a0a0a 50%, #0a1a0a 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
      }}
    >
      <FilmGrain opacity={0.025} />
      <div
        style={{
          fontFamily: FONT.sans,
          fontSize: 96,
          fontWeight: 900,
          letterSpacing: -2,
          opacity:
            interpolate(titleS, [0, 0.3], [0, 1], {
              extrapolateRight: "clamp",
            }) * exit.opacity,
          transform: [
            `translateY(${interpolate(titleS, [0, 1], [80, 0]) + exit.y}px)`,
            `scale(${interpolate(titleS, [0, 1], [0.55, 1])})`,
          ].join(" "),
        }}
      >
        <span style={{ color: COLOR.bad }}>Others</span>{" "}
        <span style={{ color: "rgba(255,255,255,0.3)" }}>vs</span>{" "}
        <span style={{ color: COLOR.brand }}>Us</span>
      </div>

      <div
        style={{
          fontFamily: FONT.sans,
          fontSize: 26,
          fontWeight: 500,
          color: COLOR.textMuted,
          letterSpacing: 5,
          textTransform: "uppercase" as const,
          opacity:
            interpolate(subS, [0, 0.5], [0, 1], {
              extrapolateRight: "clamp",
            }) * exit.opacity,
          transform: `translateY(${interpolate(subS, [0, 1], [25, 0]) + exit.y}px)`,
        }}
      >
        Prediction Markets
      </div>
    </AbsoluteFill>
  );
};

// ── Outro ──
const OutroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const logoS = spring({
    frame: Math.max(0, frame - 5),
    fps: FPS,
    config: ANIM.slam,
  });
  const tagS = spring({
    frame: Math.max(0, frame - 22),
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
        gap: 28,
      }}
    >
      <div
        style={{
          fontFamily: FONT.sans,
          fontSize: 72,
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
          fontFamily: FONT.sans,
          fontSize: 22,
          fontWeight: 500,
          color: "rgba(255,255,255,0.5)",
          letterSpacing: 3,
          opacity: interpolate(tagS, [0, 0.5], [0, 1], {
            extrapolateRight: "clamp",
          }),
          transform: `translateY(${interpolate(tagS, [0, 1], [18, 0])}px)`,
        }}
      >
        generalmarket.io
      </div>
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// MAIN COMPOSITION
// ═══════════════════════════════════════════════════════════════════════

export const VisionVsComposition: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: COLOR.page }}>
      <Sequence from={0} durationInFrames={INTRO_DUR}>
        <IntroScene />
      </Sequence>

      {SCENES.map((scene, i) => (
        <Sequence
          key={`scene-${i}`}
          from={SCENE_STARTS[i]}
          durationInFrames={SCENE_DUR}
        >
          <ComparisonScene scene={scene} sceneIndex={i} />
        </Sequence>
      ))}

      <Sequence
        from={INTRO_DUR + SCENES.length * SCENE_DUR}
        durationInFrames={OUTRO_DUR}
      >
        <OutroScene />
      </Sequence>
    </AbsoluteFill>
  );
};

export const visionVsMeta = {
  id: "VisionVs",
  component: VisionVsComposition,
  width: W,
  height: H,
  fps: FPS,
  durationInFrames: TOTAL,
};
