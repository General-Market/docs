/**
 * VisionVC2 — Full Manifesto
 *
 * The pitch for General Market. Seven acts, one argument.
 * Style: warm paper, spring physics, Polaroid accumulation, cycling text.
 * ~38s at 30fps.
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
import { COLOR, FONT, ANIM } from "./tokens";
import { PolaroidPhoto } from "./PolaroidPhoto";

const FPS = 30;
const GM_GREEN = "#00C853";

// ═══════════════════════════════════════════════════════════════════════
// CONTENT
// ═══════════════════════════════════════════════════════════════════════

const IMG_DIR = "compositions/vision-vc2";

interface ImageDef {
  src: string;
  rotation: number;
  offsetX: number;
  delay: number;
}

interface FixItem {
  text: string;
  images: ImageDef[];
}

const FIX_ITEMS: FixItem[] = [
  {
    text: "We fix insider trading.",
    images: [
      { src: `${IMG_DIR}/insider-1.jpg`, rotation: -3, offsetX: -130, delay: 0 },
      { src: `${IMG_DIR}/insider-2.jpg`, rotation: 4, offsetX: 130, delay: 5 },
    ],
  },
  {
    text: "We remove spreads.",
    images: [
      { src: `${IMG_DIR}/spreads-1.jpg`, rotation: 2, offsetX: -130, delay: 0 },
      { src: `${IMG_DIR}/spreads-2.jpg`, rotation: -3, offsetX: 130, delay: 5 },
    ],
  },
  {
    text: "We find a willing counterparty\nfor 500,000 markets.",
    images: [
      { src: `${IMG_DIR}/liquidity-1.jpg`, rotation: -2, offsetX: -130, delay: 0 },
      { src: `${IMG_DIR}/liquidity-2.jpg`, rotation: 3, offsetX: 130, delay: 5 },
    ],
  },
  {
    text: "We remove copy trading.",
    images: [
      { src: `${IMG_DIR}/copytrading-1.jpg`, rotation: -2, offsetX: -130, delay: 0 },
      { src: `${IMG_DIR}/copytrading-penguin-test1.jpg`, rotation: 3, offsetX: 130, delay: 5 },
    ],
  },
];

// ── Market Polaroid rain — 45 sources ───────────────────────────────
const MKT_DIR = "compositions/vision-vc2/markets";

const MARKET_NAMES: { name: string; file: string }[] = [
  // Row 1
  { name: "Twitch", file: "twitch.jpg" },
  { name: "Steam", file: "steam.jpg" },
  { name: "4chan", file: "4chan.jpg" },
  { name: "Aircraft", file: "aircraft.jpg" },
  { name: "DB Trains", file: "train.jpg" },
  { name: "Weather", file: "weather.jpg" },
  { name: "Solar Flares", file: "solar.jpg" },
  { name: "McDonald's", file: "mcdonalds.jpg" },
  { name: "Pump.fun", file: "pumpfun.jpg" },
  // Row 2
  { name: "Reddit", file: "reddit.jpg" },
  { name: "GitHub", file: "github.jpg" },
  { name: "Earthquake", file: "earthquake.jpg" },
  { name: "NASDAQ", file: "nasdaq.jpg" },
  { name: "Sports", file: "sports.jpg" },
  { name: "HackerNews", file: "hackernews.jpg" },
  { name: "Ships", file: "ships.jpg" },
  { name: "NYC Subway", file: "subway.jpg" },
  { name: "Ryanair", file: "ryanair.jpg" },
  // Row 3
  { name: "Paris Metro", file: "paris-metro.jpg" },
  { name: "London Tube", file: "london-tube.jpg" },
  { name: "Theme Parks", file: "theme-park.jpg" },
  { name: "Volcano", file: "volcano.jpg" },
  { name: "Wildfire", file: "wildfire.jpg" },
  { name: "ISS", file: "iss.jpg" },
  { name: "Ocean Buoys", file: "ocean-buoy.jpg" },
  { name: "Migration", file: "migration.jpg" },
  { name: "Nuclear", file: "nuclear.jpg" },
  // Row 4
  { name: "Anime", file: "anime.jpg" },
  { name: "Chess", file: "chess.jpg" },
  { name: "Esports", file: "esports.jpg" },
  { name: "Movies", file: "movies.jpg" },
  { name: "Music", file: "music.jpg" },
  { name: "Board Games", file: "boardgames.jpg" },
  { name: "Congress", file: "congress.jpg" },
  { name: "Courts", file: "courts.jpg" },
  { name: "Power Outages", file: "power-outage.jpg" },
  // Row 5
  { name: "Zillow", file: "zillow.jpg" },
  { name: "McBroken", file: "mcbroken.jpg" },
  { name: "NYC 311", file: "nyc311.jpg" },
  { name: "DeFi", file: "defi.jpg" },
  { name: "Bitcoin", file: "bitcoin.jpg" },
  { name: "Internet", file: "internet-outage.jpg" },
  { name: "Air Quality", file: "air-quality.jpg" },
  { name: "EV Charging", file: "ev-charging.jpg" },
  { name: "Birds", file: "birds.jpg" },
];

interface MarketPolaroid {
  name: string;
  src: string;
  x: number;
  y: number;
  rotation: number;
  delay: number;
  z: number; // stacking order
}

// Hand-placed positions — no algorithm can replace taste
// 45 cards scattered across screen, upper 75%, overlapping deliberately
const POSITIONS: [number, number, number][] = [
  // [x, y, rotation] — 5 clusters with organic overlap
  // Cluster: top-left
  [140, 80, -8], [260, 160, 12], [100, 280, -3], [320, 60, 6], [200, 380, -14],
  [60, 180, 10], [380, 280, -6], [180, 440, 8], [440, 140, -11],
  // Cluster: top-center
  [620, 50, 5], [540, 200, -9], [740, 140, 13], [660, 320, -4], [800, 60, -7],
  [580, 400, 11], [720, 260, -12], [860, 200, 3], [500, 120, 9],
  // Cluster: top-right
  [1020, 100, -10], [1140, 40, 7], [960, 250, 14], [1100, 180, -5], [1200, 300, 8],
  [1040, 380, -13], [1260, 120, 4], [1160, 420, -8], [1320, 240, 11],
  // Cluster: far-right
  [1440, 60, -6], [1560, 180, 9], [1400, 300, -11], [1520, 80, 13], [1640, 260, -4],
  [1480, 400, 7], [1700, 140, -9], [1580, 360, 5], [1380, 180, 12],
  // Cluster: mid-band (above the big title)
  [300, 460, -7], [500, 430, 10], [700, 480, -3], [900, 450, 8], [1100, 470, -12],
  [1300, 440, 6], [1500, 480, -5], [160, 450, 13], [1660, 430, -8],
];

// Bezier-curved stagger: slow start, fast middle, slight deceleration at end
const bezierDelay = (t: number): number => {
  // Cubic bezier approximation: ease-in-out (0.25, 0.1, 0.25, 1)
  const t2 = t * t;
  const t3 = t2 * t;
  return 3 * t2 - 2 * t3; // smooth S-curve 0→1
};

const TOTAL_CASCADE_FRAMES = 50; // all 45 cards land within ~1.7s

const MARKET_POLAROIDS: MarketPolaroid[] = MARKET_NAMES.map((m, i) => {
  const t = i / (MARKET_NAMES.length - 1); // 0→1
  const delay = Math.round(bezierDelay(t) * TOTAL_CASCADE_FRAMES);
  const pos = POSITIONS[i % POSITIONS.length];
  return {
    name: m.name,
    src: `${MKT_DIR}/${m.file}`,
    x: pos[0],
    y: pos[1],
    rotation: pos[2],
    delay,
    z: i,
  };
});

// ── VC Logos ─────────────────────────────────────────────────────────
const VC_LOGOS = ["vc-a16z.png", "vc-sequoia.png", "vc-paradigm.png", "vc-polychain.png"];

// ═══════════════════════════════════════════════════════════════════════
// TIMING
// ═══════════════════════════════════════════════════════════════════════

// ── Act 1: The Hook ──
const BEAT1_DUR = 72; // 13 words → needs ~65 readable frames
const BEAT2_DUR = 60;
const BEAT_GAP = 8;
const INTRO_DUR = BEAT1_DUR + BEAT2_DUR - BEAT_GAP; // 107

const UNLESS_SOLO_DUR = 33; // 1 word — land, register, leave
const ACT1_END = INTRO_DUR + UNLESS_SOLO_DUR; // 157

// ── Act 2: The Fixes (frames relative to Unless section Sequence) ──
const FIX_LEAD_IN = 20;
const ITEM_DURS = [55, 48, 42, 38];
const TEXT_EXIT_AT = [40, 35, 30, 25];
const EXIT_BUFFER = 15;

const ITEM_STARTS: number[] = [];
let acc = FIX_LEAD_IN;
for (let i = 0; i < ITEM_DURS.length; i++) {
  ITEM_STARTS.push(acc);
  acc += ITEM_DURS[i];
}
const UNLESS_SECTION_DUR = acc + EXIT_BUFFER; // 20 + 183 + 15 = 218
const ACT2_END = ACT1_END + UNLESS_SECTION_DUR; // 375

// ── Act 3: The Audacity ──
const QUESTION_DUR = 70;
const LOL_DUR = 38; // 1 word — slam, beat, gone
const ACT3_END = ACT2_END + QUESTION_DUR + LOL_DUR; // 500

// ── Act 4: The Reveal ──
const PRESENT_DUR = 55;
const SCATTER_DUR = 110; // fast, overwhelming
const ACT4_END = ACT3_END + PRESENT_DUR + SCATTER_DUR; // 695

// ── Act 5: The Mechanism ──
const DARKPOOL_DUR = 85;
const ACT5_END = ACT4_END + DARKPOOL_DUR; // 780

// ── Act 6: The Pitch ──
const STOP_DUR = 55;
const SCALE_DUR = 100; // counter is visual, not reading
const ODDS_DUR = 65; // 11 words across 2 lines
const ACT6_END = ACT5_END + STOP_DUR + SCALE_DUR + ODDS_DUR; // 1010

// ── Act 7: CTA + Close ──
const CTA_DUR = 75;
const CLOSE_DUR = 85; // 9 words + hold — doesn't need 3.7s
const TOTAL = ACT6_END + CTA_DUR + CLOSE_DUR; // 1195

// ═══════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════

const fmtN = (n: number): string =>
  Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");

// Standard exit: cubic ease, opacity fade, slight upward drift
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

// ═══════════════════════════════════════════════════════════════════════
// ACT 1: THE HOOK
// ═══════════════════════════════════════════════════════════════════════

// ── Scene 1: DB logo + "train prediction market" ────────────────────
const OpeningBeat1: React.FC = () => {
  const frame = useCurrentFrame();

  const enterS = spring({ frame, fps: FPS, config: ANIM.springFast });
  const exit = useExit(frame, BEAT1_DUR - 12, BEAT1_DUR);

  const opacity = interpolate(enterS, [0, 1], [0, 1]) * exit.opacity;
  const translateY = interpolate(enterS, [0, 1], [40, 0]) + exit.translateY;
  const scale = interpolate(enterS, [0, 1], [0.92, 1]);

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        opacity,
        transform: `translateY(${translateY}px) scale(${scale})`,
      }}
    >
      <Img
        src={staticFile(`${IMG_DIR}/db-logo.png`)}
        style={{ height: 160, objectFit: "contain", marginBottom: 50 }}
      />
      <div
        style={{
          fontFamily: FONT.sans,
          fontSize: 50,
          fontWeight: 600,
          color: COLOR.textPrimary,
          textAlign: "center",
          letterSpacing: "-0.02em",
          lineHeight: 1.4,
        }}
      >
        A prediction market about
        <br />a train being late would be lit.
      </div>
    </AbsoluteFill>
  );
};

// ── Scene 2: VC logos + "won't be liquid" ───────────────────────────
const OpeningBeat2: React.FC = () => {
  const frame = useCurrentFrame();

  const enterS = spring({ frame, fps: FPS, config: ANIM.springFast });
  const exit = useExit(frame, BEAT2_DUR - 15, BEAT2_DUR);

  const opacity = interpolate(enterS, [0, 1], [0, 1]) * exit.opacity;
  const translateY = interpolate(enterS, [0, 1], [30, 0]) + exit.translateY;

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        opacity,
        transform: `translateY(${translateY}px)`,
      }}
    >
      <div style={{ display: "flex", gap: 60, alignItems: "center", marginBottom: 55 }}>
        {VC_LOGOS.map((logo, i) => {
          const logoS = spring({
            frame: Math.max(0, frame - i * 2),
            fps: FPS,
            config: ANIM.springFast,
          });
          const logoOpacity = interpolate(logoS, [0, 1], [0, 0.7]) * exit.opacity;
          const logoScale = interpolate(logoS, [0, 1], [0.8, 1]);
          return (
            <Img
              key={logo}
              src={staticFile(`${IMG_DIR}/${logo}`)}
              style={{
                height: 45,
                objectFit: "contain",
                opacity: logoOpacity,
                transform: `scale(${logoScale})`,
                filter: "grayscale(100%)",
              }}
            />
          );
        })}
      </div>
      <div
        style={{
          fontFamily: FONT.sans,
          fontSize: 48,
          fontWeight: 500,
          color: COLOR.textSecondary,
          textAlign: "center",
          letterSpacing: "-0.01em",
          fontStyle: "italic",
        }}
      >
        &ldquo;But the challenge &mdash; this won&rsquo;t be liquid&rdquo;
      </div>
    </AbsoluteFill>
  );
};

// ── Scene 3: "Unless." standalone ───────────────────────────────────
const UnlessSolo: React.FC = () => {
  const frame = useCurrentFrame();

  const s = spring({ frame, fps: FPS, config: ANIM.springMedium });
  const exit = useExit(frame, UNLESS_SOLO_DUR - 8, UNLESS_SOLO_DUR);

  const opacity = interpolate(s, [0, 1], [0, 1]) * exit.opacity;
  const translateY = interpolate(s, [0, 1], [40, 0]) + exit.translateY;
  const scale = interpolate(s, [0, 1], [0.9, 1]);

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity,
        transform: `translateY(${translateY}px) scale(${scale})`,
      }}
    >
      <div
        style={{
          fontFamily: FONT.sans,
          fontSize: 140,
          fontWeight: 800,
          color: COLOR.textPrimary,
          letterSpacing: "-0.03em",
        }}
      >
        Unless.
      </div>
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// ACT 2: THE FIXES (left "Unless." + right Polaroid pile + cycling text)
// ═══════════════════════════════════════════════════════════════════════

const UnlessAnchor: React.FC = () => {
  const frame = useCurrentFrame();

  const s = spring({ frame, fps: FPS, config: ANIM.springMedium });
  const opacity = interpolate(s, [0, 1], [0, 1]);
  const translateY = interpolate(s, [0, 1], [30, 0]);

  return (
    <div
      style={{
        position: "absolute",
        left: 140,
        top: 0,
        bottom: 0,
        display: "flex",
        alignItems: "center",
        fontFamily: FONT.sans,
        fontSize: 120,
        fontWeight: 700,
        color: COLOR.textPrimary,
        opacity,
        transform: `translateY(${translateY}px)`,
        letterSpacing: "-0.02em",
      }}
    >
      Unless.
    </div>
  );
};

const FixDivider: React.FC = () => {
  const frame = useCurrentFrame();

  const s = spring({ frame: frame - 15, fps: FPS, config: ANIM.springSlow });
  const scaleY = interpolate(s, [0, 1], [0, 1]);
  const opacity = interpolate(s, [0, 1], [0, 0.15]);

  return (
    <div
      style={{
        position: "absolute",
        left: "38%",
        top: "30%",
        height: "40%",
        width: 1,
        backgroundColor: COLOR.textPrimary,
        opacity,
        transform: `scaleY(${scaleY})`,
        transformOrigin: "center",
      }}
    />
  );
};

// ── Accumulating photo pile ─────────────────────────────────────────
const FixPhotoPile: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <div
      style={{
        position: "absolute",
        right: 80,
        top: 0,
        bottom: 0,
        width: 840,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {FIX_ITEMS.map((item, itemIdx) => {
        const itemStart = ITEM_STARTS[itemIdx];
        const localFrame = frame - itemStart;

        if (localFrame < -2 || item.images.length === 0) return null;

        const itemsAfterCount = FIX_ITEMS.reduce((count, _, laterIdx) => {
          if (laterIdx <= itemIdx) return count;
          const laterStart = ITEM_STARTS[laterIdx];
          return frame - laterStart > 5 ? count + 1 : count;
        }, 0);

        const compressScale = Math.pow(0.82, itemsAfterCount);
        const compressY = -55 * itemsAfterCount;

        const compressSpring = spring({
          frame: Math.max(
            0,
            itemsAfterCount > 0
              ? localFrame - ITEM_DURS[itemIdx] + 10
              : 0,
          ),
          fps: FPS,
          config: { damping: 20, stiffness: 100, mass: 0.6 },
        });

        const prevScale =
          itemsAfterCount > 0
            ? (1 / compressScale) * Math.pow(0.82, itemsAfterCount - 1)
            : 1;
        const currentScale = interpolate(compressSpring, [0, 1], [prevScale, compressScale]);
        const currentY = interpolate(
          compressSpring,
          [0, 1],
          [itemsAfterCount > 0 ? compressY + 55 : 0, compressY],
        );

        const dimOpacity = interpolate(itemsAfterCount, [0, 1, 3], [1, 0.7, 0.4], {
          extrapolateRight: "clamp",
        });

        return (
          <div
            key={itemIdx}
            style={{
              position: "absolute",
              width: 500,
              height: 280,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: `translateY(${currentY}px) scale(${currentScale})`,
              opacity: dimOpacity,
              willChange: "transform, opacity",
            }}
          >
            {item.images.map((img, i) => (
              <PolaroidPhoto
                key={i}
                src={img.src}
                rotation={img.rotation}
                offsetX={img.offsetX}
                delay={img.delay}
                localFrame={localFrame}
                exitProgress={0}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
};

// ── Cycling text (per-item duration) ────────────────────────────────
const FixCyclingText: React.FC<{
  text: string;
  startFrame: number;
  duration: number;
  exitAt: number;
}> = ({ text, startFrame, duration, exitAt }) => {
  const frame = useCurrentFrame();
  const localFrame = frame - startFrame;

  if (localFrame < 0 || localFrame > duration) return null;

  const enterSpring = spring({
    frame: Math.max(0, localFrame),
    fps: FPS,
    config: ANIM.springFast,
  });

  const exitRaw = interpolate(localFrame, [exitAt, duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exitProgress = Easing.in(Easing.cubic)(exitRaw);

  const enterY = interpolate(enterSpring, [0, 1], [30, 0]);
  const exitY = exitProgress * -20;
  const enterOpacity = interpolate(enterSpring, [0, 0.3], [0, 1], {
    extrapolateRight: "clamp",
  });

  const lines = text.split("\n");

  return (
    <div
      style={{
        position: "absolute",
        right: 80,
        bottom: 120,
        width: 840,
        textAlign: "center",
        fontFamily: FONT.sans,
        fontSize: lines.length > 1 ? 40 : 46,
        fontWeight: 500,
        lineHeight: 1.35,
        color: COLOR.textSecondary,
        opacity: enterOpacity * (1 - exitProgress),
        transform: `translateY(${enterY + exitY}px)`,
        letterSpacing: "-0.01em",
        whiteSpace: "pre-line",
      }}
    >
      {text}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// ACT 3: THE AUDACITY
// ═══════════════════════════════════════════════════════════════════════

// ── Scene 8a: "The largest challenges... solved by US?" ─────────────
const AudacityQuestion: React.FC = () => {
  const frame = useCurrentFrame();

  const s = spring({ frame, fps: FPS, config: ANIM.springMedium });
  const s2 = spring({ frame: Math.max(0, frame - 6), fps: FPS, config: ANIM.springMedium });
  const exit = useExit(frame, QUESTION_DUR - 12, QUESTION_DUR);

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
          fontSize: 52,
          fontWeight: 600,
          color: COLOR.textSecondary,
          textAlign: "center",
          letterSpacing: "-0.01em",
          opacity: interpolate(s, [0, 1], [0, 1]) * exit.opacity,
          transform: `translateY(${interpolate(s, [0, 1], [25, 0]) + exit.translateY}px)`,
        }}
      >
        The largest challenges in whole finance
      </div>
      <div
        style={{
          fontFamily: FONT.sans,
          fontSize: 64,
          fontWeight: 700,
          color: COLOR.textPrimary,
          textAlign: "center",
          letterSpacing: "-0.02em",
          opacity: interpolate(s2, [0, 1], [0, 1]) * exit.opacity,
          transform: `translateY(${interpolate(s2, [0, 1], [25, 0]) + exit.translateY}px)`,
        }}
      >
        &mdash; solved by US?
      </div>
    </AbsoluteFill>
  );
};

// ── Scene 8b: "LOL" — green slam + ring pulse ──────────────────────
const LOLSlam: React.FC = () => {
  const frame = useCurrentFrame();

  const s = spring({
    frame,
    fps: FPS,
    config: ANIM.springSlam,
  });

  const ringS = spring({
    frame,
    fps: FPS,
    config: ANIM.springRing,
  });

  const scale = interpolate(s, [0, 0.5, 1], [1.4, 0.95, 1]);
  const opacity = interpolate(s, [0, 0.1], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Ring pulse */}
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
          cy={540}
          r={20 + ringS * 380}
          fill="none"
          stroke={GM_GREEN}
          strokeWidth={3}
          opacity={0.4 * (1 - ringS)}
        />
        <circle
          cx={960}
          cy={540}
          r={20 + Math.max(0, ringS - 0.15) * 300}
          fill="none"
          stroke={GM_GREEN}
          strokeWidth={2}
          opacity={0.2 * (1 - ringS)}
        />
      </svg>

      <div
        style={{
          fontFamily: FONT.sans,
          fontSize: 280,
          fontWeight: 900,
          color: GM_GREEN,
          letterSpacing: "0.05em",
          opacity,
          transform: `scale(${scale})`,
          textShadow: `0 2px 4px ${GM_GREEN}30`,
        }}
      >
        LOL
      </div>
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// ACT 4: THE REVEAL
// ═══════════════════════════════════════════════════════════════════════

// ── Scene 9: "Anyways — presenting General Market" ──────────────────
const PresentingGM: React.FC = () => {
  const frame = useCurrentFrame();

  const s1 = spring({ frame, fps: FPS, config: ANIM.springFast });
  const s2 = spring({ frame: Math.max(0, frame - 6), fps: FPS, config: ANIM.springFast });
  const exit = useExit(frame, PRESENT_DUR - 12, PRESENT_DUR);

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
      }}
    >
      <div
        style={{
          fontFamily: FONT.sans,
          fontSize: 42,
          fontWeight: 400,
          color: COLOR.textSecondary,
          fontStyle: "italic",
          opacity: interpolate(s1, [0, 1], [0, 0.7]) * exit.opacity,
          transform: `translateY(${interpolate(s1, [0, 1], [20, 0]) + exit.translateY}px)`,
        }}
      >
        Anyways &mdash;
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 20,
          opacity: interpolate(s2, [0, 1], [0, 1]) * exit.opacity,
          transform: `translateY(${interpolate(s2, [0, 1], [25, 0]) + exit.translateY}px)`,
        }}
      >
        <span
          style={{
            fontFamily: FONT.sans,
            fontSize: 64,
            fontWeight: 700,
            color: COLOR.textPrimary,
            letterSpacing: "-0.02em",
          }}
        >
          presenting
        </span>
        <Img
          src={staticFile("compositions/vision-vc/logos/gm-logo.svg")}
          style={{ height: 56, width: 56, borderRadius: 8 }}
        />
        <span
          style={{
            fontFamily: FONT.sans,
            fontSize: 64,
            fontWeight: 700,
            color: COLOR.textPrimary,
            letterSpacing: "-0.02em",
          }}
        >
          General Market
        </span>
      </div>
    </AbsoluteFill>
  );
};

// ── Scene 10: Market Polaroid rain ──────────────────────────────────

// Polaroid card dimensions — bigger, bolder
const MKT_W = 200;
const MKT_H = 140;
const MKT_BORDER = 6;
const MKT_BORDER_BOTTOM = 28;

const MarketPolaroidCard: React.FC<{
  name: string;
  src: string;
  x: number;
  y: number;
  rotation: number;
  delay: number;
  z: number;
}> = ({ name, src, x, y, rotation, delay, z }) => {
  const frame = useCurrentFrame();
  const localF = frame - delay;

  // Not visible yet
  if (localF < -1) return null;

  // Z-axis fall: starts big, decelerates naturally with a small bounce
  const s = spring({
    frame: Math.max(0, localF),
    fps: FPS,
    config: { damping: 15, stiffness: 200, mass: 0.4 },
  });

  // Scale: 2.0 -> 1.0 with slight overshoot from the spring
  const scale = interpolate(s, [0, 1], [2.0, 1]);
  // Opacity: quick fade-in
  const opacity = interpolate(s, [0, 0.2], [0, 1], { extrapolateRight: "clamp" });
  // Rotation: settles from a spin
  const rot = interpolate(s, [0, 1], [rotation + 15, rotation]);

  const totalW = MKT_W + MKT_BORDER * 2;
  const totalH = MKT_H + MKT_BORDER + MKT_BORDER_BOTTOM;

  return (
    <div
      style={{
        position: "absolute",
        left: x - totalW / 2,
        top: y - totalH / 2,
        zIndex: z,
        opacity,
        transform: `rotate(${rot}deg) scale(${scale})`,
        transformOrigin: "center center",
        willChange: "transform, opacity",
      }}
    >
      <div
        style={{
          width: totalW,
          height: totalH,
          backgroundColor: "#ffffff",
          borderRadius: 3,
          boxShadow: "0 4px 18px rgba(0,0,0,0.14), 0 1px 4px rgba(0,0,0,0.10)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: MKT_BORDER,
          paddingLeft: MKT_BORDER,
          paddingRight: MKT_BORDER,
        }}
      >
        <Img
          src={staticFile(src)}
          style={{
            width: MKT_W,
            height: MKT_H,
            objectFit: "cover",
            display: "block",
          }}
        />
        <div
          style={{
            width: MKT_W,
            height: MKT_BORDER_BOTTOM - MKT_BORDER,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: FONT.sans,
            fontSize: 13,
            fontWeight: 500,
            color: COLOR.textSecondary,
          }}
        >
          {name}
        </div>
      </div>
    </div>
  );
};

const MarketScatter: React.FC = () => {
  const frame = useCurrentFrame();

  // "Everything" text appears MID-cascade — while cards are still falling
  const everythingDelay = 35; // early, cards still raining
  const evS = spring({
    frame: Math.max(0, frame - everythingDelay),
    fps: FPS,
    config: ANIM.springMedium,
  });

  // No compress — cards keep piling, text floats above the chaos
  const cardsScale = 1;
  const cardsOpacity = 1;

  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `scale(${cardsScale})`,
          opacity: cardsOpacity,
          transformOrigin: "center 450px",
          willChange: "transform, opacity",
        }}
      >
        {MARKET_POLAROIDS.map((m) => (
          <MarketPolaroidCard
            key={m.name}
            name={m.name}
            src={m.src}
            x={m.x}
            y={m.y}
            rotation={m.rotation}
            delay={m.delay}
            z={m.z}
          />
        ))}
      </div>

      {/* "...Everything Is Now A Market" — big, bottom, commanding */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 60,
          textAlign: "center",
          zIndex: 100,
        }}
      >
        <div
          style={{
            fontFamily: FONT.sans,
            fontSize: 80,
            fontWeight: 800,
            color: COLOR.textPrimary,
            letterSpacing: "-0.03em",
            lineHeight: 1.1,
            opacity: interpolate(evS, [0, 1], [0, 1]),
            transform: `translateY(${interpolate(evS, [0, 1], [25, 0])}px)`,
          }}
        >
          ...Everything Is Now A Market
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// ACT 5: THE MECHANISM
// ═══════════════════════════════════════════════════════════════════════

// ── Scene 11: "Parimutuel Dark Pool" ────────────────────────────────
const DarkPoolScene: React.FC = () => {
  const frame = useCurrentFrame();

  const s1 = spring({ frame, fps: FPS, config: ANIM.springFast });
  const s2 = spring({ frame: Math.max(0, frame - 8), fps: FPS, config: ANIM.springFast });

  // Subtitle appears after titles
  const subS = spring({ frame: Math.max(0, frame - 25), fps: FPS, config: ANIM.springMedium });

  // Subtle circular SVG
  const circleS = spring({ frame: Math.max(0, frame - 4), fps: FPS, config: ANIM.springSlow });

  const exit = useExit(frame, DARKPOOL_DUR - 12, DARKPOOL_DUR);

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Background circle */}
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
          cy={480}
          r={interpolate(circleS, [0, 1], [0, 180])}
          fill="none"
          stroke={COLOR.textMuted}
          strokeWidth={1}
          opacity={0.12 * exit.opacity}
        />
        {/* Orbiting dots */}
        {Array.from({ length: 6 }).map((_, i) => {
          const angle = (i / 6) * Math.PI * 2 + frame * 0.015;
          const r = 180 * circleS;
          const cx = 960 + Math.cos(angle) * r;
          const cy = 480 + Math.sin(angle) * r * 0.6;
          return (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={4}
              fill={COLOR.textMuted}
              opacity={0.25 * circleS * exit.opacity}
            />
          );
        })}
      </svg>

      <div
        style={{
          fontFamily: FONT.sans,
          fontSize: 44,
          fontWeight: 400,
          color: COLOR.textSecondary,
          letterSpacing: "0.04em",
          opacity: interpolate(s1, [0, 1], [0, 1]) * exit.opacity,
          transform: `translateY(${interpolate(s1, [0, 1], [20, 0]) + exit.translateY}px)`,
          marginBottom: 8,
        }}
      >
        Parimutuel
      </div>
      <div
        style={{
          fontFamily: FONT.sans,
          fontSize: 80,
          fontWeight: 800,
          color: COLOR.textPrimary,
          letterSpacing: "-0.03em",
          opacity: interpolate(s2, [0, 1], [0, 1]) * exit.opacity,
          transform: `translateY(${interpolate(s2, [0, 1], [25, 0]) + exit.translateY}px)`,
        }}
      >
        Dark Pool
      </div>

      {/* Subtitle explanation */}
      <div
        style={{
          fontFamily: FONT.sans,
          fontSize: 26,
          fontWeight: 400,
          color: COLOR.textSecondary,
          textAlign: "center",
          maxWidth: 600,
          lineHeight: 1.5,
          marginTop: 40,
          opacity: interpolate(subS, [0, 1], [0, 0.8]) * exit.opacity,
          transform: `translateY(${interpolate(subS, [0, 1], [15, 0]) + exit.translateY}px)`,
        }}
      >
        Sealed bets. No visible orderbook.
        <br />
        Odds redistribute at settlement.
      </div>
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// ACT 6: THE PITCH
// ═══════════════════════════════════════════════════════════════════════

// ── Scene 12: "We ask you to stop gambling." ────────────────────────
const StopGambling: React.FC = () => {
  const frame = useCurrentFrame();

  const s = spring({ frame, fps: FPS, config: ANIM.springMedium });
  const exit = useExit(frame, STOP_DUR - 10, STOP_DUR);

  // Strikethrough on "gambling"
  const strikeS = interpolate(frame, [18, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
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
      <div
        style={{
          fontFamily: FONT.sans,
          fontSize: 60,
          fontWeight: 700,
          color: COLOR.textPrimary,
          textAlign: "center",
          opacity: interpolate(s, [0, 1], [0, 1]) * exit.opacity,
          transform: `translateY(${interpolate(s, [0, 1], [30, 0]) + exit.translateY}px)`,
        }}
      >
        We ask you to stop{" "}
        <span style={{ position: "relative", display: "inline-block" }}>
          gambling.
          <div
            style={{
              position: "absolute",
              left: 0,
              top: "52%",
              height: 3,
              backgroundColor: GM_GREEN,
              width: `${strikeS * 100}%`,
              transformOrigin: "left center",
            }}
          />
        </span>
      </div>
    </AbsoluteFill>
  );
};

// ── Scene 13: Split — 10 trades vs 1,000,000 trades ────────────────
const ScaleContrast: React.FC = () => {
  const frame = useCurrentFrame();

  // Divider
  const divS = spring({ frame, fps: FPS, config: ANIM.springSlow });
  // Left side
  const leftS = spring({ frame: Math.max(0, frame - 6), fps: FPS, config: ANIM.springFast });
  // Right side
  const rightS = spring({ frame: Math.max(0, frame - 12), fps: FPS, config: ANIM.springFast });

  // Counter: starts at frame 20, runs for 60 frames
  const counterStart = 20;
  const counterEnd = 80;
  const counterRaw = interpolate(frame, [counterStart, counterEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.cubic),
  });
  const counterValue = 10 + (1_000_000 - 10) * counterRaw;

  // Counter landing overshoot
  const landS = spring({
    frame: Math.max(0, frame - counterEnd),
    fps: FPS,
    config: { damping: 10, stiffness: 200, mass: 0.3 },
  });
  const counterScale = frame > counterEnd ? interpolate(landS, [0, 1], [1.06, 1]) : 1;

  // Subtitle appears after counter
  const subS = spring({
    frame: Math.max(0, frame - counterEnd - 5),
    fps: FPS,
    config: ANIM.springFast,
  });

  const exit = useExit(frame, SCALE_DUR - 12, SCALE_DUR);

  return (
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

      {/* LEFT: Normal Trading */}
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
            color: COLOR.textSecondary,
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
            color: COLOR.textSecondary,
            marginTop: 12,
          }}
        >
          trades / day
        </div>
      </div>

      {/* RIGHT: General Market */}
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
            fontSize: interpolate(counterRaw, [0, 0.3, 1], [160, 140, 100]),
            fontWeight: 800,
            color: GM_GREEN,
            lineHeight: 1,
            transform: `scale(${counterScale})`,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {fmtN(counterValue)}
        </div>
        <div
          style={{
            fontFamily: FONT.sans,
            fontSize: 24,
            fontWeight: 400,
            color: COLOR.textSecondary,
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
  );
};

// ── Scene 14: "No one has an edge" ──────────────────────────────────
const OddsRedistributed: React.FC = () => {
  const frame = useCurrentFrame();

  const s1 = spring({ frame, fps: FPS, config: ANIM.springFast });
  const s2 = spring({ frame: Math.max(0, frame - 8), fps: FPS, config: ANIM.springMedium });
  const exit = useExit(frame, ODDS_DUR - 10, ODDS_DUR);

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
          fontSize: 60,
          fontWeight: 700,
          color: COLOR.textPrimary,
          opacity: interpolate(s1, [0, 1], [0, 1]) * exit.opacity,
          transform: `translateY(${interpolate(s1, [0, 1], [25, 0]) + exit.translateY}px)`,
        }}
      >
        No one has an edge.
      </div>
      <div
        style={{
          fontFamily: FONT.sans,
          fontSize: 42,
          fontWeight: 500,
          color: GM_GREEN,
          opacity: interpolate(s2, [0, 1], [0, 1]) * exit.opacity,
          transform: `translateY(${interpolate(s2, [0, 1], [20, 0]) + exit.translateY}px)`,
        }}
      >
        New markets &mdash; the odds are redistributed.
      </div>
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// ACT 7: CTA + CLOSE
// ═══════════════════════════════════════════════════════════════════════

// ── Scene 15: "Join in 10 minutes" ──────────────────────────────────
const CTAJoin: React.FC = () => {
  const frame = useCurrentFrame();

  const s1 = spring({ frame, fps: FPS, config: ANIM.springFast });
  const s2 = spring({ frame: Math.max(0, frame - 6), fps: FPS, config: ANIM.springMedium });
  const exit = useExit(frame, CTA_DUR - 12, CTA_DUR);

  return (
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
          fontFamily: FONT.sans,
          fontSize: 56,
          fontWeight: 600,
          color: COLOR.textPrimary,
          letterSpacing: "-0.02em",
          opacity: interpolate(s1, [0, 1], [0, 1]) * exit.opacity,
          transform: `translateY(${interpolate(s1, [0, 1], [25, 0]) + exit.translateY}px)`,
        }}
      >
        Join in 10 minutes
      </div>
      <div
        style={{
          fontFamily: FONT.sans,
          fontSize: 38,
          fontWeight: 400,
          color: COLOR.textSecondary,
          opacity: interpolate(s2, [0, 1], [0, 0.85]) * exit.opacity,
          transform: `translateY(${interpolate(s2, [0, 1], [15, 0]) + exit.translateY}px)`,
        }}
      >
        with Claude or Codex
      </div>
    </AbsoluteFill>
  );
};

// ── Scene 16: "Welcome to the new generation" ───────────────────────
const ClosingScene: React.FC = () => {
  const frame = useCurrentFrame();

  const s = spring({ frame, fps: FPS, config: ANIM.springSlow });
  const s2 = spring({ frame: Math.max(0, frame - 10), fps: FPS, config: ANIM.springSlow });
  const gmS = spring({ frame: Math.max(0, frame - 25), fps: FPS, config: ANIM.springMedium });

  // No exit. This scene holds to the end.
  return (
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
          fontFamily: FONT.sans,
          fontSize: 48,
          fontWeight: 500,
          color: COLOR.textPrimary,
          letterSpacing: "-0.01em",
          opacity: interpolate(s, [0, 1], [0, 1]),
          transform: `translateY(${interpolate(s, [0, 1], [35, 0])}px)`,
        }}
      >
        Welcome to the new generation
      </div>
      <div
        style={{
          fontFamily: FONT.sans,
          fontSize: 56,
          fontWeight: 700,
          color: COLOR.textPrimary,
          letterSpacing: "-0.02em",
          opacity: interpolate(s2, [0, 1], [0, 1]),
          transform: `translateY(${interpolate(s2, [0, 1], [30, 0])}px)`,
        }}
      >
        of capital markets
      </div>

      {/* GM badge */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginTop: 40,
          opacity: interpolate(gmS, [0, 1], [0, 1]),
          transform: `translateY(${interpolate(gmS, [0, 1], [15, 0])}px)`,
        }}
      >
        <Img
          src={staticFile("compositions/vision-vc/logos/gm-logo.svg")}
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
  );
};

// ═══════════════════════════════════════════════════════════════════════
// COMPOSITION
// ═══════════════════════════════════════════════════════════════════════

export const VisionVC2Composition: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: COLOR.page }}>
      {/* ═══ ACT 1: THE HOOK ═══ */}

      {/* Beat 1: DB + "train prediction market" */}
      <Sequence durationInFrames={BEAT1_DUR}>
        <OpeningBeat1 />
      </Sequence>

      {/* Beat 2: VC logos + "won't be liquid" */}
      <Sequence from={BEAT1_DUR - BEAT_GAP} durationInFrames={BEAT2_DUR}>
        <OpeningBeat2 />
      </Sequence>

      {/* Beat 3: "Unless." standalone */}
      <Sequence from={INTRO_DUR} durationInFrames={UNLESS_SOLO_DUR}>
        <UnlessSolo />
      </Sequence>

      {/* ═══ ACT 2: THE FIXES ═══ */}
      <Sequence from={ACT1_END} durationInFrames={UNLESS_SECTION_DUR}>
        <UnlessAnchor />
        <FixDivider />
        <FixPhotoPile />
        {FIX_ITEMS.map((item, i) => (
          <FixCyclingText
            key={i}
            text={item.text}
            startFrame={ITEM_STARTS[i]}
            duration={ITEM_DURS[i]}
            exitAt={TEXT_EXIT_AT[i]}
          />
        ))}
      </Sequence>

      {/* ═══ ACT 3: THE AUDACITY ═══ */}

      {/* "The largest challenges... solved by US?" */}
      <Sequence from={ACT2_END} durationInFrames={QUESTION_DUR}>
        <AudacityQuestion />
      </Sequence>

      {/* "LOL" — green slam + ring pulse */}
      <Sequence from={ACT2_END + QUESTION_DUR} durationInFrames={LOL_DUR}>
        <LOLSlam />
      </Sequence>

      {/* ═══ ACT 4: THE REVEAL ═══ */}

      {/* "Anyways — presenting General Market" */}
      <Sequence from={ACT3_END} durationInFrames={PRESENT_DUR}>
        <PresentingGM />
      </Sequence>

      {/* Market scatter */}
      <Sequence from={ACT3_END + PRESENT_DUR} durationInFrames={SCATTER_DUR}>
        <MarketScatter />
      </Sequence>

      {/* ═══ ACT 5: THE MECHANISM ═══ */}
      <Sequence from={ACT4_END} durationInFrames={DARKPOOL_DUR}>
        <DarkPoolScene />
      </Sequence>

      {/* ═══ ACT 6: THE PITCH ═══ */}

      {/* "We ask you to stop gambling." */}
      <Sequence from={ACT5_END} durationInFrames={STOP_DUR}>
        <StopGambling />
      </Sequence>

      {/* Split: 10 vs 1,000,000 */}
      <Sequence from={ACT5_END + STOP_DUR} durationInFrames={SCALE_DUR}>
        <ScaleContrast />
      </Sequence>

      {/* "No one has an edge" */}
      <Sequence from={ACT5_END + STOP_DUR + SCALE_DUR} durationInFrames={ODDS_DUR}>
        <OddsRedistributed />
      </Sequence>

      {/* ═══ ACT 7: CTA + CLOSE ═══ */}

      {/* "Join in 10 minutes" */}
      <Sequence from={ACT6_END} durationInFrames={CTA_DUR}>
        <CTAJoin />
      </Sequence>

      {/* "Welcome to the new generation of capital markets" */}
      <Sequence from={ACT6_END + CTA_DUR} durationInFrames={CLOSE_DUR}>
        <ClosingScene />
      </Sequence>
    </AbsoluteFill>
  );
};

export const visionVC2Meta = {
  id: "VisionVC2",
  component: VisionVC2Composition,
  durationInFrames: TOTAL,
  fps: FPS as 30,
  width: 1920 as 1920,
  height: 1080 as 1080,
};
