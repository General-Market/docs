import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
import { useGsapProxy } from "../standrew/gsapUtils";
import { DynamicBlue, DynamicDark, DynamicSolidBlue, HexGridOverlay, ZoomedBg } from "./dynamics";

const { fontFamily } = loadFont("normal", { subsets: ["latin"], weights: ["400", "700", "800"] });

const baseText: React.CSSProperties = {
  fontFamily,
  fontWeight: 800,
  fontStyle: "italic",
  lineHeight: 1.15,
  display: "inline-block",
};

/* ═══════════════════════════════════════════════════════
   Scene 01 — Hook  (84 frames = 3.5s @ 24fps)
   Original line stays: "You spent 10,000 hours" → "perfecting
   your trading strategies." A conveyor of strategy attempts
   (v1 → v10,000) scrolls fast underneath in the scene-05
   vocabulary — fewer items, larger tags, faster sweep.
   ═══════════════════════════════════════════════════════ */

const SCENE01_DURATION = 84;
const SCENE01_PHRASE_A = ["You", "spent", "10,000", "hours"] as const;
const SCENE01_PHRASE_B = ["perfecting", "your", "trading", "strategies"] as const;

type ConveyorShapeKind = "diamond" | "hexagon" | "hexagon-hole" | "pentagon" | "circle";

const CONVEYOR_SHAPE_KINDS: ConveyorShapeKind[] = [
  "diamond",
  "hexagon",
  "hexagon-hole",
  "pentagon",
  "circle",
];

const CONVEYOR_COLORS = ["#FFD700", "#FFFFFF", "#FF6B00", "#00E5FF", "#9CA3AF"];

const HEX_CLIP = "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)";
const PENT_CLIP = "polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)";

const ConveyorShape: React.FC<{ kind: ConveyorShapeKind; color: string; size: number }> = ({
  kind,
  color,
  size,
}) => {
  if (kind === "diamond") {
    return (
      <div
        style={{
          width: size * 0.7,
          height: size * 0.7,
          backgroundColor: color,
          transform: "rotate(45deg)",
          borderRadius: 3,
        }}
      />
    );
  }
  if (kind === "circle") {
    return (
      <div
        style={{
          width: size,
          height: size,
          backgroundColor: color,
          borderRadius: "50%",
        }}
      />
    );
  }
  if (kind === "hexagon-hole") {
    return (
      <div
        style={{
          width: size,
          height: size,
          backgroundColor: color,
          clipPath: HEX_CLIP,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: size * 0.4,
            height: size * 0.4,
            backgroundColor: "#0a4f4d",
            borderRadius: "50%",
          }}
        />
      </div>
    );
  }
  if (kind === "pentagon") {
    return <div style={{ width: size, height: size, backgroundColor: color, clipPath: PENT_CLIP }} />;
  }
  return <div style={{ width: size, height: size, backgroundColor: color, clipPath: HEX_CLIP }} />;
};

function conveyorRand(s: number) {
  const x = Math.sin(s * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

const CONVEYOR_COUNT = 18;
const CONVEYOR_SHAPE_SIZE = 130;
const CONVEYOR_GAP = 110;
const CONVEYOR_TAG_SIZE = 76;
const CONVEYOR_ITEM_WIDTH = 280;

const CONVEYOR_ITEMS = Array.from({ length: CONVEYOR_COUNT }, (_, i) => {
  const kind = CONVEYOR_SHAPE_KINDS[Math.floor(conveyorRand(i + 1) * CONVEYOR_SHAPE_KINDS.length)];
  const color = CONVEYOR_COLORS[Math.floor(conveyorRand(i + 1009) * CONVEYOR_COLORS.length)];
  const t = i / (CONVEYOR_COUNT - 1);
  const tag = Math.max(i + 1, Math.round(Math.pow(10000, t)));
  // Decoration tier 0..5 — each version looks one rung more sophisticated
  const tier = Math.min(5, Math.floor((i / (CONVEYOR_COUNT - 1)) * 6));
  return { kind, color, tag, tier };
});

function formatTag(n: number): string {
  return `v${n.toLocaleString("en-US")}`;
}

/* Each successive version stacks more decoration over the base shape.
   All layers are solid colors — no translucency, no blur. */
const AdvancedShape: React.FC<{
  kind: ConveyorShapeKind;
  color: string;
  size: number;
  tier: number;
}> = ({ kind, color, size, tier }) => {
  const ringSize = size + 14;
  const haloSize = size + 36;
  const orbitSize = size + 76;
  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* T4 outer colored halo — sits behind everything */}
      {tier >= 4 && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 0,
          }}
        >
          <ConveyorShape kind={kind} color={color} size={haloSize} />
        </div>
      )}

      {/* T1 solid white outline ring */}
      {tier >= 1 && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 1,
          }}
        >
          <ConveyorShape kind={kind} color="#ffffff" size={ringSize} />
        </div>
      )}

      {/* Base shape */}
      <div style={{ position: "relative", zIndex: 2 }}>
        <ConveyorShape kind={kind} color={color} size={size} />
      </div>

      {/* T2 solid dark inner pip */}
      {tier >= 2 && kind !== "hexagon-hole" && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: size * 0.28,
            height: size * 0.28,
            backgroundColor: "#0a4f4d",
            borderRadius: "50%",
            zIndex: 3,
          }}
        />
      )}

      {/* T3 four cardinal tick marks, solid white, positioned outside any halo */}
      {tier >= 3 &&
        Array.from({ length: 4 }).map((_, t) => (
          <div
            key={`tick-${t}`}
            style={{
              position: "absolute",
              width: 5,
              height: 20,
              backgroundColor: "#ffffff",
              borderRadius: 2,
              top: "50%",
              left: "50%",
              transformOrigin: "50% 50%",
              transform: `translate(-50%, -50%) rotate(${t * 90}deg) translateY(-${(tier >= 4 ? haloSize : ringSize) / 2 + 14}px)`,
              zIndex: 4,
            }}
          />
        ))}

      {/* T5 dashed orbit ring + glossy highlight, both solid */}
      {tier >= 5 && (
        <>
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: orbitSize,
              height: orbitSize,
              borderRadius: "50%",
              border: "3px dashed #ffffff",
              zIndex: 0,
            }}
          />
          <div
            style={{
              position: "absolute",
              width: size * 0.22,
              height: size * 0.1,
              backgroundColor: "#ffffff",
              borderRadius: "50%",
              top: size * 0.18,
              left: size * 0.22,
              zIndex: 5,
            }}
          />
        </>
      )}
    </div>
  );
};

function buildScene01Proxies() {
  const init: Record<string, Record<string, number>> = {
    phraseA: { opacity: 1 },
    phraseB: { opacity: 0 },
    conveyor: { x: 0 },
  };
  SCENE01_PHRASE_A.forEach((_, i) => {
    init[`a_${i}`] = { opacity: i === 0 ? 1 : 0, y: i === 0 ? 0 : 15 };
  });
  SCENE01_PHRASE_B.forEach((_, i) => {
    init[`b_${i}`] = { opacity: 0, y: 15 };
  });
  return init;
}

const scene01Init = buildScene01Proxies();

export const Scene01_Hook: React.FC = () => {
  const s = useGsapProxy(
    (tl, p) => {
      // S-curve: slow ramp lets v1/v2/v4 be readable, then belt accelerates
      // through the middle versions and decelerates onto v10,000 (i=17),
      // parked at horizontal center. Item center: 240 + 390*i = 6870 for i=17.
      // Center on 960 → x = -5910.
      tl.to(p.conveyor, { x: -5910, duration: 1.7, ease: "power3.inOut" }, 0.0);

      SCENE01_PHRASE_A.forEach((_, i) => {
        if (i === 0) return;
        tl.to(p[`a_${i}`], { opacity: 1, y: 0, duration: 0.18, ease: "power2.out" }, 0.2 + i * 0.22);
      });

      tl.to(p.phraseA, { opacity: 0, duration: 0.22, ease: "power2.in" }, 1.7);

      tl.to(p.phraseB, { opacity: 1, duration: 0.18, ease: "power2.out" }, 1.95);
      SCENE01_PHRASE_B.forEach((_, i) => {
        tl.to(p[`b_${i}`], { opacity: 1, y: 0, duration: 0.18, ease: "power2.out" }, 1.95 + i * 0.24);
      });
    },
    scene01Init,
  );

  const phraseACenter: React.CSSProperties = {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    display: "flex",
    gap: 30,
    justifyContent: "center",
    whiteSpace: "nowrap",
  };

  const phraseBCenter: React.CSSProperties = {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    display: "flex",
    gap: 24,
    justifyContent: "center",
    whiteSpace: "nowrap",
  };

  return (
    <AbsoluteFill>
      <ZoomedBg duration={SCENE01_DURATION}>
        <DynamicBlue />
      </ZoomedBg>

      {/* Conveyor — bottom band, full population, big tags, each version more advanced */}
      <div
        style={{
          position: "absolute",
          top: "68%",
          left: 0,
          right: 0,
          height: 320,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 100,
            top: 0,
            display: "flex",
            alignItems: "flex-start",
            gap: CONVEYOR_GAP,
            transform: `translateX(${s.conveyor.x}px)`,
          }}
        >
          {CONVEYOR_ITEMS.map((it, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 22,
                width: CONVEYOR_ITEM_WIDTH,
              }}
            >
              <div
                style={{
                  height: CONVEYOR_SHAPE_SIZE + 30,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <AdvancedShape
                  kind={it.kind}
                  color={it.color}
                  size={CONVEYOR_SHAPE_SIZE}
                  tier={it.tier}
                />
              </div>
              <div style={{ width: 50, height: 3, backgroundColor: "rgba(0,0,0,0.45)", borderRadius: 2 }} />
              <span
                style={{
                  ...baseText,
                  fontStyle: "normal",
                  fontWeight: 800,
                  fontSize: CONVEYOR_TAG_SIZE,
                  color: "#ffffff",
                  letterSpacing: "-0.02em",
                  whiteSpace: "nowrap",
                  textShadow: "0 4px 18px rgba(0,0,0,0.4)",
                }}
              >
                {formatTag(it.tag)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Phrase A — original layout: "You spent 10,000 hours" */}
      <div style={{ ...phraseACenter, opacity: s.phraseA.opacity }}>
        {SCENE01_PHRASE_A.map((word, i) => {
          const proxy = s[`a_${i}`];
          const isNumber = word === "10,000";
          return (
            <span
              key={i}
              style={{
                ...baseText,
                fontSize: isNumber ? 165 : 125,
                color: "#fff",
                opacity: proxy.opacity,
                transform: `translateY(${proxy.y}px)`,
              }}
            >
              {word}
            </span>
          );
        })}
      </div>

      {/* Phrase B — "perfecting your trading strategies" */}
      <div style={{ ...phraseBCenter, opacity: s.phraseB.opacity }}>
        {SCENE01_PHRASE_B.map((word, i) => {
          const proxy = s[`b_${i}`];
          return (
            <span
              key={i}
              style={{
                ...baseText,
                fontSize: 110,
                color: "#fff",
                opacity: proxy.opacity,
                transform: `translateY(${proxy.y}px)`,
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/* ═══════════════════════════════════════════════════════
   Scene 02 — TryRainbows  (48 frames = 2s @ 24fps)
   Big italic question slides in over hex-grid dark and holds:
   "How rainbows improve / your gains?"
   ═══════════════════════════════════════════════════════ */

const SCENE02_DURATION = 48;

export const Scene02_TryRainbows: React.FC = () => {
  const s = useGsapProxy(
    (tl, p) => {
      tl.to(p.title, { opacity: 1, x: 0, duration: 0.5, ease: "power2.out" }, 0.1);
    },
    {
      title: { opacity: 0, x: 60 },
    },
  );

  return (
    <AbsoluteFill>
      <ZoomedBg duration={SCENE02_DURATION}>
        <DynamicDark />
        <HexGridOverlay color="rgba(255,255,255,0.16)" size={70} />
      </ZoomedBg>

      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "8%",
          transform: `translate(0, calc(-50% + 0px)) translateX(${s.title.x}px)`,
          opacity: s.title.opacity,
          maxWidth: "84%",
        }}
      >
        <span style={{ ...baseText, fontSize: 150, color: "#fff", display: "block" }}>
          How rainbows improve
        </span>
        <span style={{ ...baseText, fontSize: 150, color: "#fff", display: "block" }}>
          your gains?
        </span>
      </div>
    </AbsoluteFill>
  );
};

/* ═══════════════════════════════════════════════════════
   Scene 03 — RainbowsWraps  (72 frames = 3s @ 24fps)
   Three beats:
     1 (0–22)   — four white rectangles drop in, stacked, labeled
                  Stocks / Crypto / Predictions / Memecoins.
     2 (22–40)  — a white "RAINBOWS · RAINBOWS · …" text border
                  scrolls around the stack on a rounded-rect path —
                  Rainbows, the box on the boxes.
     3 (40–66)  — all four rectangles morph simultaneously: the box
                  silhouette shrinks into a compact organic shape
                  (heart / flower / star / cloud), and the label
                  ("Stocks", "Crypto", …) stays inside, scaling down
                  to fit. Text border keeps spinning.
   Easing follows the original cube scene's GSAP feel — power2.out /
   back.out — so the boxes settle rather than snap.
   ═══════════════════════════════════════════════════════ */

const SCENE03_DURATION = 72;
const SCENE03_WRAP_START = 22;
const SCENE03_WRAP_END = 40;
const SCENE03_MORPH_START = 40;
const SCENE03_MORPH_END = 66;

const ROW_W = 560;
const ROW_H = 128;
const ROW_GAP = 36;
const STACK_TOP = (1080 - (ROW_H * 4 + ROW_GAP * 3)) / 2;
const STACK_HEIGHT = ROW_H * 4 + ROW_GAP * 3;
const rowCenterY = (i: number) => STACK_TOP + ROW_H / 2 + i * (ROW_H + ROW_GAP);

/* Text-border wrapper: sits a comfortable distance outside the stack so
 * the type doesn't crowd the rectangles. */
const WRAP_PAD = 56;
const WRAP_W = ROW_W + WRAP_PAD * 2;
const WRAP_H = STACK_HEIGHT + WRAP_PAD * 2;
const WRAP_RADIUS = 28;

/* Rounded-rect path for the textPath, in viewBox coordinates */
const WRAP_PATH_ORIGIN = 60;
const wrapPathD = (() => {
  const x = WRAP_PATH_ORIGIN;
  const y = WRAP_PATH_ORIGIN;
  const w = WRAP_W;
  const h = WRAP_H;
  const r = WRAP_RADIUS;
  return [
    `M ${x + r} ${y}`,
    `L ${x + w - r} ${y}`,
    `A ${r} ${r} 0 0 1 ${x + w} ${y + r}`,
    `L ${x + w} ${y + h - r}`,
    `A ${r} ${r} 0 0 1 ${x + w - r} ${y + h}`,
    `L ${x + r} ${y + h}`,
    `A ${r} ${r} 0 0 1 ${x} ${y + h - r}`,
    `L ${x} ${y + r}`,
    `A ${r} ${r} 0 0 1 ${x + r} ${y}`,
    "Z",
  ].join(" ");
})();

const TEXT_BORDER_TEXT = "  RAINBOWS  ·  ".repeat(28);
const TEXT_BORDER_FONT_SIZE = 36;
const TEXT_BORDER_PATH_ID = "rb-scene03-border-path";

/* Shapes — white silhouettes that the boxes morph into */
const FlowerShape: React.FC = () => (
  <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
    {[0, 72, 144, 216, 288].map((rot) => (
      <ellipse key={rot} cx="50" cy="28" rx="11" ry="20" fill="#fff" transform={`rotate(${rot} 50 50)`} />
    ))}
    <circle cx="50" cy="50" r="9" fill="#0a3a38" />
  </svg>
);

const HeartShape: React.FC = () => (
  <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
    <path
      d="M 50 86 C 18 64 10 46 10 32 C 10 20 22 12 34 12 C 42 12 48 18 50 24 C 52 18 58 12 66 12 C 78 12 90 20 90 32 C 90 46 82 64 50 86 Z"
      fill="#fff"
    />
  </svg>
);

const StarShape: React.FC = () => (
  <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
    <path d="M 50 8 L 61 38 L 93 38 L 67 57 L 77 88 L 50 70 L 23 88 L 33 57 L 7 38 L 39 38 Z" fill="#fff" />
  </svg>
);

const CloudShape: React.FC = () => (
  <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
    <ellipse cx="30" cy="58" rx="18" ry="15" fill="#fff" />
    <ellipse cx="50" cy="46" rx="22" ry="18" fill="#fff" />
    <ellipse cx="70" cy="56" rx="18" ry="15" fill="#fff" />
    <ellipse cx="50" cy="64" rx="30" ry="11" fill="#fff" />
  </svg>
);

const SCENE03_ROWS = [
  { label: "Stocks", Shape: FlowerShape },
  { label: "Crypto", Shape: HeartShape },
  { label: "Predictions", Shape: StarShape },
  { label: "Memecoins", Shape: CloudShape },
] as const;

export const Scene03_CubeExplode: React.FC = () => {
  const frame = useCurrentFrame();

  /* Beat 1 — staggered drop-in, per row */
  const dropProgress = (i: number) =>
    interpolate(frame, [i * 4, i * 4 + 12], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    });

  /* Beat 2 — text border fades in (power2.out feel) */
  const wrapDraw = interpolate(frame, [SCENE03_WRAP_START, SCENE03_WRAP_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  /* Beat 3 — single morph progress with smooth ease-in-out (power2.inOut) */
  const morph = interpolate(frame, [SCENE03_MORPH_START, SCENE03_MORPH_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.45, 0, 0.55, 1),
  });

  /* Shape scale uses an overshoot curve (back.out) so the new
   * silhouettes land with a small bounce — same character as the
   * cube's "back.out(1.6)" assemble. */
  const shapeScaleProgress = interpolate(
    frame,
    [SCENE03_MORPH_START + 2, SCENE03_MORPH_END + 4],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(0.34, 1.56, 0.64, 1),
    },
  );

  /* Continuous text scroll along the wrapper path. Speed eases up after
   * the border first appears so the entrance feels like an arrival, not
   * a constant marquee. */
  const textScroll = interpolate(
    frame,
    [SCENE03_WRAP_START, SCENE03_WRAP_START + 14, SCENE03_DURATION],
    [0, 90, 90 + (SCENE03_DURATION - SCENE03_WRAP_START - 14) * 5],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "extend",
      easing: Easing.out(Easing.cubic),
    },
  );

  return (
    <AbsoluteFill>
      <ZoomedBg duration={SCENE03_DURATION}>
        <DynamicSolidBlue />
        <HexGridOverlay color="rgba(255,255,255,0.13)" size={70} />
      </ZoomedBg>

      {SCENE03_ROWS.map((row, i) => {
        const drop = dropProgress(i);
        const cy = rowCenterY(i);
        const Shape = row.Shape;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: "50%",
              top: cy,
              width: ROW_W,
              height: ROW_H,
              transform: `translate(-50%, calc(-50% + ${(1 - drop) * -28}px))`,
              opacity: drop,
            }}
          >
            {/* White rectangle — fades out as the silhouette morphs */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundColor: "#fff",
                borderRadius: 10,
                boxShadow: "0 10px 32px rgba(0,0,0,0.22)",
                opacity: 1 - morph,
                transform: `scaleX(${1 - morph * 0.78}) scaleY(${1 - morph * 0.06})`,
              }}
            />

            {/* White shape — fades + scales in (overshoots, then settles) */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: "50%",
                width: ROW_H,
                height: ROW_H,
                transform: `translateX(-50%) scale(${0.4 + shapeScaleProgress * 0.65})`,
                opacity: morph,
                filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.22))",
              }}
            >
              <Shape />
            </div>

            {/* Label — stays centred, shrinks slightly to sit inside the shape */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                pointerEvents: "none",
              }}
            >
              <span
                style={{
                  fontFamily,
                  fontWeight: 700,
                  fontSize: 58 - morph * 24,
                  letterSpacing: "-0.02em",
                  color: "#0a3a38",
                }}
              >
                {row.label}
              </span>
            </div>
          </div>
        );
      })}

      {/* Rainbow text border — scrolls around the stack on a rounded-rect path */}
      <svg
        width={WRAP_W + WRAP_PATH_ORIGIN * 2}
        height={WRAP_H + WRAP_PATH_ORIGIN * 2}
        viewBox={`0 0 ${WRAP_W + WRAP_PATH_ORIGIN * 2} ${WRAP_H + WRAP_PATH_ORIGIN * 2}`}
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
          opacity: wrapDraw,
          filter: "drop-shadow(0 0 12px rgba(255,255,255,0.25))",
        }}
      >
        <defs>
          <path id={TEXT_BORDER_PATH_ID} d={wrapPathD} fill="none" />
        </defs>
        <text
          fontSize={TEXT_BORDER_FONT_SIZE}
          fontWeight={800}
          fontStyle="italic"
          fill="#fff"
          letterSpacing={2}
          style={{ fontFamily }}
        >
          <textPath
            href={`#${TEXT_BORDER_PATH_ID}`}
            startOffset={-textScroll}
            spacing="auto"
            method="align"
          >
            {TEXT_BORDER_TEXT}
          </textPath>
        </text>
      </svg>
    </AbsoluteFill>
  );
};

/* ── Meta ── */

export const sceneMetasA = [
  { id: "RB-Scene01-Hook", component: Scene01_Hook, durationInFrames: SCENE01_DURATION },
  { id: "RB-Scene02-TryRainbows", component: Scene02_TryRainbows, durationInFrames: SCENE02_DURATION },
  { id: "RB-Scene03-CubeExplode", component: Scene03_CubeExplode, durationInFrames: SCENE03_DURATION },
];
