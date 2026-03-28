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

// Positions: scatter TOP 2/3 of screen (bottom 300px reserved for title slam)
// [x, y, rotation] — shuffled order, no spatial pattern, organic chaos
const POSITIONS: [number, number, number][] = [
  [960, 320, 5],    [180, 480, -14],  [1620, 100, 9],
  [420, 80, -7],    [1340, 440, 12],  [60, 230, 11],
  [1780, 350, -9],  [720, 50, 6],     [1100, 560, -13],
  [500, 370, 15],   [1420, 180, -5],  [280, 580, 8],
  [1220, 60, -16],  [860, 470, 10],   [140, 60, -8],
  [1680, 520, 13],  [620, 260, -11],  [1060, 160, 4],
  [340, 410, 14],   [1520, 310, -10], [780, 580, 3],
  [1360, 390, -15], [100, 370, 9],    [1820, 140, -6],
  [560, 120, 16],   [1160, 290, -8],  [240, 200, 7],
  [1560, 500, -14], [700, 430, 11],   [920, 100, -9],
  [440, 540, 13],   [1260, 80, -4],   [40, 450, 10],
  [1720, 260, -16], [820, 330, 6],    [1020, 510, -12],
  [180, 120, 15],   [1460, 430, -7],  [660, 200, 5],
  [1120, 370, -13], [360, 300, 9],    [1620, 470, -6],
  [520, 520, 14],   [960, 240, -11],  [1320, 600, 8],
];

// Bezier stagger: ease-in curve — slow drip → torrential
const TOTAL_CASCADE = 55;

const MARKET_POLAROIDS: MarketPolaroid[] = MARKET_NAMES.map((m, i) => {
  const t = i / (MARKET_NAMES.length - 1);
  // ease-in cubic: slow start, accelerating
  const delay = Math.round(t * t * t * TOTAL_CASCADE);
  const pos = POSITIONS[i];
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

// ═══ TIMING — rhythmic, with breaths ═══
//
// ★ = breath (empty paper). Costs 0.7s total, gains everything.
// Breaths create contrast: the silence before a slam is what makes it physical.

// ── Act 1: The Hook ──
const BEAT1_DUR = 72;          // 2.4s — text visible from frame 1
const BEAT2_DUR = 54;          // 1.8s — tighter
const BEAT_GAP = 8;
const INTRO_DUR = BEAT1_DUR + BEAT2_DUR - BEAT_GAP;

const UNLESS_SOLO_DUR = 45;   // 1.5s — the pivot needs weight, let it breathe
const ACT1_END = INTRO_DUR + UNLESS_SOLO_DUR;

// ── Act 2: The Fixes — ACCELERATING ──
const FIX_LEAD_IN = 18;
const ITEM_DURS = [54, 42, 36];   // 1.8s → 1.4s → 1.2s — acceleration
const TEXT_EXIT_AT = [38, 30, 24];
const EXIT_BUFFER = 10;

const ITEM_STARTS: number[] = [];
let acc = FIX_LEAD_IN;
for (let i = 0; i < ITEM_DURS.length; i++) {
  ITEM_STARTS.push(acc);
  acc += ITEM_DURS[i];
}
const UNLESS_SECTION_DUR = acc + EXIT_BUFFER;
const ACT2_END = ACT1_END + UNLESS_SECTION_DUR;

// ★ BREATH after fixes (the last fix evaporated, silence before the question)
const BREATH_1 = 6;

// ── Act 3: The Audacity ──
const QUESTION_DUR = 60;      // 2.0s — tighter
// ★ BREATH before LOL (let the question hang)
const BREATH_2 = 4;
const LOL_DUR = 38;            // 1.3s — slam, beat, gone
// ★ BREATH after LOL (the laugh clears)
const BREATH_3 = 6;
const ACT3_END = ACT2_END + BREATH_1 + QUESTION_DUR + BREATH_2 + LOL_DUR + BREATH_3;

// ── Act 4: The Reveal ──
const PRESENT_DUR = 45;       // 1.5s — snappier
const SCATTER_WITH_TITLE_DUR = 130; // 4.3s — cards rain + title slams below (ONE scene)
const ACT4_END = ACT3_END + PRESENT_DUR + SCATTER_WITH_TITLE_DUR;

// ── Act 5: The Mechanism ──
const DARKPOOL_DUR = 75;      // 2.5s — tighter
const ACT5_END = ACT4_END + DARKPOOL_DUR;

// ── Act 6: The Pitch ──
const STOP_DUR = 45;          // 1.5s — declarative, no lingering
// ★ BREATH before data
const BREATH_4 = 4;
const SCALE_DUR = 90;         // 3.0s — counter slightly faster
const ODDS_DUR = 60;          // 2.0s
const ACT6_END = ACT5_END + STOP_DUR + BREATH_4 + SCALE_DUR + ODDS_DUR;

// ── Act 7: CTA + Close ──
const CTA_DUR = 60;           // 2.0s — tighter CTA
const CLOSE_DUR = 75;         // 2.5s — HOLD (stillness is the point)
const TOTAL = ACT6_END + CTA_DUR + CLOSE_DUR;

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

  // No entrance animation — text visible from frame 1
  // Train departure exit: slide LEFT
  const exitRaw = interpolate(frame, [BEAT1_DUR - 14, BEAT1_DUR], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.cubic),
  });

  const exitX = exitRaw * -400;

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        opacity: 1 - exitRaw * 0.5,
        transform: `translateX(${exitX}px)`,
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
  // Enter from right (arriving train), settle to center
  const enterX = interpolate(enterS, [0, 1], [300, 0]);

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        opacity,
        transform: `translateX(${enterX}px)`,
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

// ── Train sweep transition ──────────────────────────────────────────
// Full-screen SVG cartoon train slides LEFT (departing), facing left
const TRAIN_TRANSITION_DUR = 24; // slower, cinematic
const TrainSweep: React.FC = () => {
  const frame = useCurrentFrame();

  const p = interpolate(frame, [0, TRAIN_TRANSITION_DUR], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });

  // RIGHT → LEFT, matching Scene 1 departure direction
  const trainX = interpolate(p, [0, 1], [1920, -1400]);
  const opacity = interpolate(p, [0, 0.06, 0.9, 1], [0, 1, 1, 0]);

  return (
    <AbsoluteFill style={{ pointerEvents: "none", zIndex: 50 }}>
      <svg
        style={{
          position: "absolute",
          left: trainX,
          top: 0,
          width: 1400,
          height: 1080,
          opacity,
        }}
        viewBox="0 0 700 540"
        fill="none"
      >
        {/* Smoke */}
        <circle cx="80" cy="75" r="40" fill="#d4d4d4" opacity="0.5" />
        <circle cx="40" cy="50" r="30" fill="#d4d4d4" opacity="0.35" />
        <circle cx="10" cy="32" r="20" fill="#d4d4d4" opacity="0.2" />

        {/* Smokestack */}
        <rect x="100" y="130" width="45" height="85" rx="5" fill="#2a2a2a" />
        <rect x="88" y="118" width="70" height="22" rx="8" fill="#333" />

        {/* Boiler */}
        <rect x="60" y="215" width="360" height="150" rx="75" fill="#1a1a1a" />
        {/* Brand-green bands */}
        <rect x="130" y="215" width="14" height="150" rx="3" fill="#00A36C" opacity="0.85" />
        <rect x="220" y="215" width="14" height="150" rx="3" fill="#00A36C" opacity="0.85" />
        <rect x="310" y="215" width="14" height="150" rx="3" fill="#00A36C" opacity="0.85" />

        {/* Cab */}
        <rect x="380" y="160" width="160" height="205" rx="10" fill="#ec0016" />
        <rect x="396" y="178" width="128" height="95" rx="5" fill="#1a1a1a" opacity="0.25" />
        <rect x="408" y="190" width="104" height="70" rx="5" fill="#a8d8ea" opacity="0.7" />
        <rect x="368" y="148" width="184" height="20" rx="8" fill="#b71c1c" />

        {/* Undercarriage */}
        <rect x="40" y="365" width="520" height="55" rx="5" fill="#2a2a2a" />

        {/* Cowcatcher — front left */}
        <polygon points="40,420 0,445 40,445" fill="#555" />
        <polygon points="40,395 10,420 40,420" fill="#666" />

        {/* Big driving wheels */}
        <circle cx="160" cy="450" r="60" fill="#444" stroke="#333" strokeWidth="5" />
        <circle cx="160" cy="450" r="38" fill="#555" />
        <circle cx="160" cy="450" r="10" fill="#888" />
        <line x1="160" y1="395" x2="160" y2="505" stroke="#666" strokeWidth="3" />
        <line x1="105" y1="450" x2="215" y2="450" stroke="#666" strokeWidth="3" />

        <circle cx="340" cy="450" r="60" fill="#444" stroke="#333" strokeWidth="5" />
        <circle cx="340" cy="450" r="38" fill="#555" />
        <circle cx="340" cy="450" r="10" fill="#888" />
        <line x1="340" y1="395" x2="340" y2="505" stroke="#666" strokeWidth="3" />
        <line x1="285" y1="450" x2="395" y2="450" stroke="#666" strokeWidth="3" />

        {/* Front wheel */}
        <circle cx="60" cy="450" r="32" fill="#444" stroke="#333" strokeWidth="4" />
        <circle cx="60" cy="450" r="20" fill="#555" />

        {/* Rear wheel */}
        <circle cx="490" cy="450" r="40" fill="#444" stroke="#333" strokeWidth="4" />
        <circle cx="490" cy="450" r="25" fill="#555" />

        {/* Connecting rod */}
        <rect x="70" y="445" width="310" height="9" rx="4" fill="#c8a000" />

        {/* Headlight */}
        <circle cx="48" cy="280" r="16" fill="#ffd600" />
        <circle cx="48" cy="280" r="9" fill="#fff9c4" />

        {/* Rails */}
        <rect x="0" y="510" width="700" height="7" rx="3" fill="#888" />
        <rect x="0" y="526" width="700" height="7" rx="3" fill="#888" />
        {Array.from({ length: 14 }).map((_, i) => (
          <rect key={i} x={10 + i * 50} y="504" width="32" height="32" rx="2" fill="#8d6e63" opacity="0.45" />
        ))}
      </svg>
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

// Polaroid card dimensions — large, cinematic
const MKT_W = 260;
const MKT_H = 180;
const MKT_BORDER = 7;
const MKT_BORDER_BOTTOM = 32;

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
            fontSize: 15,
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

  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          inset: 0,
          transformOrigin: "center 350px",
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

    </AbsoluteFill>
  );
};

// ── "Everything Is Now A Market" — slams in BELOW the card pile ──────
// This runs INSIDE the scatter scene. Cards rain above, title lands below.
const SLAM_WORDS = ["Everything", "Is", "Now", "A", "Market"];
const SLAM_INTERVAL = 8;  // frames between each word — fast
const SLAM_START = 60;    // appears mid-cascade, cards still falling

const EverythingSlam: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 40,
        display: "flex",
        justifyContent: "center",
        alignItems: "baseline",
        gap: 20,
        zIndex: 100,
        pointerEvents: "none",
      }}
    >
      {SLAM_WORDS.map((word, i) => {
        const wordStart = SLAM_START + i * SLAM_INTERVAL;
        const localF = frame - wordStart;

        if (localF < 0) return null;

        const s = spring({
          frame: localF,
          fps: FPS,
          config: ANIM.springSlam,
        });

        const scale = interpolate(s, [0, 0.5, 1], [1.6, 0.96, 1]);
        const opacity = interpolate(s, [0, 0.1], [0, 1], { extrapolateRight: "clamp" });

        return (
          <div
            key={word}
            style={{
              fontFamily: FONT.sans,
              fontSize: word === "Market" ? 90 : 72,
              fontWeight: 800,
              color: COLOR.textPrimary,
              letterSpacing: "-0.03em",
              opacity,
              transform: `scale(${scale})`,
              willChange: "transform, opacity",
              textShadow: `
                0 0 30px ${COLOR.page},
                0 0 50px ${COLOR.page},
                0 0 70px ${COLOR.page}
              `,
            }}
          >
            {word}
          </div>
        );
      })}
    </div>
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
  // Precompute breath offsets for Act 3
  const a3Start = ACT2_END + BREATH_1;
  const a3LolStart = a3Start + QUESTION_DUR + BREATH_2;
  const a3RevealStart = a3LolStart + LOL_DUR + BREATH_3;

  // Precompute Act 6 offsets
  const a6ScaleStart = ACT5_END + STOP_DUR + BREATH_4;

  return (
    <AbsoluteFill style={{ backgroundColor: COLOR.page }}>
      {/* ═══ ACT 1: THE HOOK ═══ */}

      {/* Beat 1: DB + "train prediction market" */}
      <Sequence durationInFrames={BEAT1_DUR}>
        <OpeningBeat1 />
      </Sequence>

      {/* Train sweep transition */}
      <Sequence from={BEAT1_DUR - 12} durationInFrames={TRAIN_TRANSITION_DUR}>
        <TrainSweep />
      </Sequence>

      {/* Beat 2: VC logos + "won't be liquid" */}
      <Sequence from={BEAT1_DUR - BEAT_GAP} durationInFrames={BEAT2_DUR}>
        <OpeningBeat2 />
      </Sequence>

      {/* Beat 3: "Unless." — the pivot, given weight */}
      <Sequence from={INTRO_DUR} durationInFrames={UNLESS_SOLO_DUR}>
        <UnlessSolo />
      </Sequence>

      {/* ═══ ACT 2: THE FIXES — accelerating ═══ */}
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

      {/* ★ BREATH — 6 frames of warm paper after fixes evaporate */}

      {/* ═══ ACT 3: THE AUDACITY ═══ */}

      {/* "The largest challenges... solved by US?" */}
      <Sequence from={a3Start} durationInFrames={QUESTION_DUR}>
        <AudacityQuestion />
      </Sequence>

      {/* ★ BREATH — 4 frames, question hangs in the air */}

      {/* "LOL" — green slam + ring pulse */}
      <Sequence from={a3LolStart} durationInFrames={LOL_DUR}>
        <LOLSlam />
      </Sequence>

      {/* ★ BREATH — 6 frames, the laugh clears */}

      {/* ═══ ACT 4: THE REVEAL ═══ */}

      {/* "Anyways — presenting General Market" */}
      <Sequence from={a3RevealStart} durationInFrames={PRESENT_DUR}>
        <PresentingGM />
      </Sequence>

      {/* Market scatter + "Everything Is Now A Market" — ONE SCENE */}
      {/* Cards rain top 2/3, title slams below while pile is visible */}
      <Sequence from={a3RevealStart + PRESENT_DUR} durationInFrames={SCATTER_WITH_TITLE_DUR}>
        <MarketScatter />
        <EverythingSlam />
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

      {/* ★ BREATH — 4 frames before the data hits */}

      {/* Split: 10 vs 1,000,000 */}
      <Sequence from={a6ScaleStart} durationInFrames={SCALE_DUR}>
        <ScaleContrast />
      </Sequence>

      {/* "No one has an edge" */}
      <Sequence from={a6ScaleStart + SCALE_DUR} durationInFrames={ODDS_DUR}>
        <OddsRedistributed />
      </Sequence>

      {/* ═══ ACT 7: CTA + CLOSE ═══ */}

      {/* "Join in 10 minutes" */}
      <Sequence from={ACT6_END} durationInFrames={CTA_DUR}>
        <CTAJoin />
      </Sequence>

      {/* "Welcome to the new generation of capital markets" — HOLD */}
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
