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
    conveyor: { x: 0, opacity: 0 },
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
      tl.to(p.conveyor, { opacity: 1, duration: 0.25, ease: "power2.out" }, 0);
      tl.to(p.conveyor, { x: -5400, duration: 2.5, ease: "power2.in" }, 0.0);

      SCENE01_PHRASE_A.forEach((_, i) => {
        if (i === 0) return;
        tl.to(p[`a_${i}`], { opacity: 1, y: 0, duration: 0.18, ease: "power2.out" }, 0.2 + i * 0.22);
      });

      tl.to(p.phraseA, { opacity: 0, duration: 0.22, ease: "power2.in" }, 1.7);

      tl.to(p.phraseB, { opacity: 1, duration: 0.18, ease: "power2.out" }, 1.95);
      SCENE01_PHRASE_B.forEach((_, i) => {
        tl.to(p[`b_${i}`], { opacity: 1, y: 0, duration: 0.18, ease: "power2.out" }, 1.95 + i * 0.24);
      });

      tl.to(p.conveyor, { opacity: 0.55, duration: 0.4, ease: "power2.out" }, 1.95);
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
          opacity: s.conveyor.opacity,
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
   Beat 1 (0–24): four white rectangles drop in stacked, labeled
   Stocks / Crypto / Predictions / Memecoins.
   Beat 2 (24–72): a rainbow band sweeps top-to-bottom; as it crosses
   each row, the rectangle morphs into a rainbow-painted organic shape
   (flower / heart / star / cloud).
   Replaces the old cube-explode visual beat.
   ═══════════════════════════════════════════════════════ */

const SCENE03_DURATION = 72;
const SCENE03_SWEEP_START = 24;
const RB_GRAD_ID = "rb-scene03-grad";
const RB_FILL = `url(#${RB_GRAD_ID})`;

const ROW_W = 540;
const ROW_H = 124;
const ROW_GAP = 36;
const STACK_TOP = (1080 - (ROW_H * 4 + ROW_GAP * 3)) / 2;
const rowCenterY = (i: number) => STACK_TOP + ROW_H / 2 + i * (ROW_H + ROW_GAP);

const FlowerShape: React.FC = () => (
  <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
    {[0, 72, 144, 216, 288].map((rot) => (
      <ellipse key={rot} cx="50" cy="28" rx="11" ry="20" fill={RB_FILL} transform={`rotate(${rot} 50 50)`} />
    ))}
    <circle cx="50" cy="50" r="9" fill="#fff" />
  </svg>
);

const HeartShape: React.FC = () => (
  <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
    <path
      d="M 50 86 C 18 64 10 46 10 32 C 10 20 22 12 34 12 C 42 12 48 18 50 24 C 52 18 58 12 66 12 C 78 12 90 20 90 32 C 90 46 82 64 50 86 Z"
      fill={RB_FILL}
    />
  </svg>
);

const StarShape: React.FC = () => (
  <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
    <path d="M 50 8 L 61 38 L 93 38 L 67 57 L 77 88 L 50 70 L 23 88 L 33 57 L 7 38 L 39 38 Z" fill={RB_FILL} />
  </svg>
);

const CloudShape: React.FC = () => (
  <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
    <ellipse cx="30" cy="58" rx="18" ry="15" fill={RB_FILL} />
    <ellipse cx="50" cy="46" rx="22" ry="18" fill={RB_FILL} />
    <ellipse cx="70" cy="56" rx="18" ry="15" fill={RB_FILL} />
    <ellipse cx="50" cy="64" rx="30" ry="11" fill={RB_FILL} />
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

  const dropProgress = (i: number) =>
    interpolate(frame, [i * 4, i * 4 + 12], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    });

  const sweepY = interpolate(frame, [SCENE03_SWEEP_START, SCENE03_DURATION], [-160, 1240], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.45, 0, 0.55, 1),
  });

  const morph = (i: number) => {
    const cy = rowCenterY(i);
    return interpolate(sweepY, [cy - 90, cy + 50], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  };

  const sweepActive = frame >= SCENE03_SWEEP_START - 2 && frame <= SCENE03_DURATION + 4;

  return (
    <AbsoluteFill>
      <ZoomedBg duration={SCENE03_DURATION}>
        <DynamicSolidBlue />
        <HexGridOverlay color="rgba(255,255,255,0.13)" size={70} />
      </ZoomedBg>

      <svg width="0" height="0" style={{ position: "absolute" }}>
        <defs>
          <linearGradient id={RB_GRAD_ID} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FF3B3B" />
            <stop offset="20%" stopColor="#FF8A1A" />
            <stop offset="40%" stopColor="#FFD700" />
            <stop offset="60%" stopColor="#3FCC3F" />
            <stop offset="80%" stopColor="#0ABAB5" />
            <stop offset="100%" stopColor="#9C5FFF" />
          </linearGradient>
        </defs>
      </svg>

      {SCENE03_ROWS.map((row, i) => {
        const drop = dropProgress(i);
        const m = morph(i);
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
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundColor: "#fff",
                borderRadius: 10,
                boxShadow: "0 10px 32px rgba(0,0,0,0.22)",
                opacity: 1 - m,
                transform: `scale(${1 - m * 0.35})`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span
                style={{
                  fontFamily,
                  fontWeight: 700,
                  fontSize: 58,
                  letterSpacing: "-0.02em",
                  color: "#0a3a38",
                }}
              >
                {row.label}
              </span>
            </div>

            <div
              style={{
                position: "absolute",
                top: 0,
                left: "50%",
                width: ROW_H,
                height: ROW_H,
                transform: `translateX(-50%) scale(${0.55 + m * 0.45})`,
                opacity: m,
              }}
            >
              <Shape />
            </div>
          </div>
        );
      })}

      {sweepActive && (
        <>
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              height: 220,
              transform: `translateY(${sweepY - 110}px)`,
              background:
                "linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.0) 25%, rgba(255,255,255,0.16) 50%, rgba(255,255,255,0.0) 75%, transparent 100%)",
              filter: "blur(10px)",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              height: 5,
              transform: `translateY(${sweepY}px)`,
              background:
                "linear-gradient(90deg, #FF3B3B 0%, #FF8A1A 20%, #FFD700 40%, #3FCC3F 60%, #0ABAB5 80%, #9C5FFF 100%)",
              boxShadow:
                "0 0 28px 8px rgba(255,255,255,0.40), 0 0 80px 30px rgba(150,200,255,0.22)",
              pointerEvents: "none",
            }}
          />
        </>
      )}
    </AbsoluteFill>
  );
};

/* ── Meta ── */

export const sceneMetasA = [
  { id: "RB-Scene01-Hook", component: Scene01_Hook, durationInFrames: SCENE01_DURATION },
  { id: "RB-Scene02-TryRainbows", component: Scene02_TryRainbows, durationInFrames: SCENE02_DURATION },
  { id: "RB-Scene03-CubeExplode", component: Scene03_CubeExplode, durationInFrames: SCENE03_DURATION },
];
