import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { font } from "../../common/fonts";

// IcebergData — photoreal iceberg on the left, glass pills stacked on the
// right. Two clusters: surface excuses above the waterline, the real
// killers beneath. Camera drifts down so the reveal mirrors the sentence.

const W = 1920;
const H = 1080;
const FPS = 30;

// Source image is portrait — we fit it to 1080 tall on the left side.
const IMG_NATIVE_W = 1265;
const IMG_NATIVE_H = 1670;
const ICEBERG_FIT_H = 1080;
const ICEBERG_FIT_W = Math.round(IMG_NATIVE_W * (ICEBERG_FIT_H / IMG_NATIVE_H)); // 818
const ICEBERG_X = 40;

// ── Beat rhythm — borrowed verbatim from AntiCheatIceberg ──────────────────
const TIERS_COUNT = 6;
const LAST = TIERS_COUNT - 1;
const TIER_STAMP_LOCAL = [36, 61, 87, 113, 139, 164] as const;
const STAMP_OFFSET = 5;
const TIER_ANIM = 6;
const FINAL_HOLD = 41;
const OUTRO = 14;
const ZOOM_OUT = TIER_STAMP_LOCAL[0] - STAMP_OFFSET; // 31

const tierAnimStart = (i: number) => TIER_STAMP_LOCAL[i] - STAMP_OFFSET;
const SCENE_FRAMES = tierAnimStart(LAST) + TIER_ANIM + FINAL_HOLD + OUTRO; // 220

const EASE_OUT = Easing.bezier(0.25, 0.1, 0.3, 1);
const easeInOut = (t: number) =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// ── Camera — vertical drift only. Starts looking high on the iceberg,
// settles on the full reveal, then sinks toward the underwater section.
type Cam = { scale: number; pan: number };
const CAM_TOP: Cam = { scale: 1.18, pan: -0.18 };
const CAM_FULL: Cam = { scale: 1.00, pan: 0.00 };
const CAM_DEEP: Cam = { scale: 1.16, pan: 0.20 };

const PHASE_2_END = 113;
const PHASE_3_END = 164;

const resolveCam = (frame: number): Cam => {
  if (frame < ZOOM_OUT) {
    const t = easeInOut(frame / ZOOM_OUT);
    return {
      scale: lerp(CAM_TOP.scale, CAM_FULL.scale, t),
      pan: lerp(CAM_TOP.pan, CAM_FULL.pan, t),
    };
  }
  if (frame < PHASE_2_END) return CAM_FULL;
  if (frame < PHASE_3_END) {
    const t = easeInOut((frame - PHASE_2_END) / (PHASE_3_END - PHASE_2_END));
    return {
      scale: lerp(CAM_FULL.scale, CAM_DEEP.scale, t),
      pan: lerp(CAM_FULL.pan, CAM_DEEP.pan, t),
    };
  }
  return CAM_DEEP;
};

// ── Sky → waterline → ocean ────────────────────────────────────────────────
const SkyOceanBackdrop: React.FC<{ frame: number }> = ({ frame }) => {
  const drift = Math.sin(frame * 0.012) * 8;
  // The waterline gradient stop matches the image's waterline at 32 % of
  // the 1080 canvas — about y = 346.
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: `linear-gradient(
          to bottom,
          #8AB6DA 0%,
          #6394BB 18%,
          #3F6E96 30%,
          #2A547B 31.5%,
          #1B416B 33%,
          #14365B 48%,
          #0A2444 75%,
          #051630 100%
        )`,
        transform: `translateY(${drift}px)`,
      }}
    />
  );
};

// ── Iceberg image — anchored left, scaled by camera ───────────────────────
const IcebergImage: React.FC<{ cam: Cam }> = ({ cam }) => {
  const swayX = 0; // image is anchored, no horizontal sway
  const baseH = ICEBERG_FIT_H * cam.scale;
  const baseW = ICEBERG_FIT_W * cam.scale;
  const top = Math.round((H - baseH) / 2 + cam.pan * baseH);
  const left = ICEBERG_X + Math.round((ICEBERG_FIT_W - baseW) / 2) + swayX;
  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        width: baseW,
        height: baseH,
        filter: "drop-shadow(0 30px 60px rgba(0, 20, 60, 0.35))",
      }}
    >
      <Img
        src={staticFile("iceberg-tiers-clean.webp")}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </div>
  );
};

// ── Pill styling ──────────────────────────────────────────────────────────
type PillKind = "header" | "leaf" | "leafRed";

const pillStyle = (kind: PillKind): React.CSSProperties => {
  const isHeader = kind === "header";
  const isRed = kind === "leafRed";
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 12,
    padding: isHeader ? "14px 26px" : "11px 22px",
    borderRadius: 999,
    background: isRed
      ? "rgba(120, 24, 40, 0.42)"
      : isHeader
        ? "rgba(18, 34, 58, 0.42)"
        : "rgba(24, 44, 72, 0.36)",
    backdropFilter: "saturate(180%) blur(22px)",
    WebkitBackdropFilter: "saturate(180%) blur(22px)",
    border: isRed
      ? "1px solid rgba(255, 120, 140, 0.42)"
      : "1px solid rgba(255, 255, 255, 0.22)",
    boxShadow: [
      "0 1px 0 rgba(255, 255, 255, 0.22) inset",
      isHeader
        ? "0 24px 60px rgba(0, 20, 60, 0.35)"
        : "0 14px 32px rgba(0, 20, 60, 0.28)",
      "0 2px 8px rgba(0, 12, 36, 0.22)",
    ].join(", "),
    color: isRed ? "#FFD6DD" : "#FFFFFF",
    fontFamily: font,
    fontWeight: isHeader ? 700 : 600,
    fontSize: isHeader ? 24 : 22,
    letterSpacing: isHeader ? "-0.015em" : "-0.012em",
    lineHeight: 1,
    whiteSpace: "nowrap",
  };
};

// ── Reveal helper ──────────────────────────────────────────────────────────
type Revealed = {
  opacity: number;
  translateY: number;
  scale: number;
};

const computeReveal = (frame: number, animStart: number, fps: number): Revealed => {
  const t = spring({
    frame: frame - animStart,
    fps,
    config: { damping: 18, stiffness: 160, mass: 0.85 },
  });
  return {
    opacity: t,
    translateY: (1 - t) * 14,
    scale: 0.96 + 0.04 * t,
  };
};

// ── Right column — two clusters of pills ──────────────────────────────────
const COL_X = 980;
const COL_W = W - COL_X - 60;

type Tier = { label: string; red?: boolean };

const ABOVE_HEADER = "Why they think they lost";
const BELOW_HEADER = "Why they actually lost";

const ABOVE: ReadonlyArray<Tier> = [
  { label: "Strategies" },
  { label: "Fees" },
];

const BELOW: ReadonlyArray<Tier> = [
  { label: "Liquidation hunters" },
  { label: "Front runners" },
  { label: "Orderbook spoofers" },
  { label: "Insider traders", red: true },
];

const Cluster: React.FC<{
  headerText: string;
  headerStart: number;
  tiers: ReadonlyArray<Tier>;
  leafStartIndex: number;
  top: number;
  frame: number;
  fps: number;
  accent: "blue" | "red";
}> = ({ headerText, headerStart, tiers, leafStartIndex, top, frame, fps, accent }) => {
  const headerR = computeReveal(frame, headerStart, fps);
  const dotColor = accent === "red" ? "#FF6B82" : "#7AB8FF";

  return (
    <div
      style={{
        position: "absolute",
        top,
        left: COL_X,
        width: COL_W,
      }}
    >
      <div
        style={{
          opacity: headerR.opacity,
          transform: `translateY(${headerR.translateY}px) scale(${headerR.scale.toFixed(4)})`,
          willChange: "transform, opacity",
        }}
      >
        <div style={pillStyle("header")}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              background: dotColor,
              boxShadow: `0 0 14px ${dotColor}`,
            }}
          />
          {headerText}
        </div>
      </div>

      <div
        style={{
          marginTop: 22,
          display: "flex",
          flexWrap: "wrap",
          gap: 14,
        }}
      >
        {tiers.map((tier, i) => {
          const animStart = tierAnimStart(leafStartIndex + i);
          const r = computeReveal(frame, animStart, fps);
          const kind: PillKind = tier.red ? "leafRed" : "leaf";
          return (
            <div
              key={tier.label}
              style={{
                opacity: r.opacity,
                transform: `translateY(${r.translateY}px) scale(${r.scale.toFixed(4)})`,
                willChange: "transform, opacity",
              }}
            >
              <div style={pillStyle(kind)}>{tier.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Waterline tick — quiet horizontal rule in the pill column ─────────────
const WaterlineRule: React.FC<{ frame: number }> = ({ frame }) => {
  const opacity = interpolate(frame, [ZOOM_OUT - 4, ZOOM_OUT + 8], [0, 0.7], {
    easing: EASE_OUT,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        left: COL_X,
        top: 410,
        width: COL_W,
        height: 1,
        background:
          "linear-gradient(to right, rgba(255,255,255,0), rgba(255,255,255,0.45), rgba(255,255,255,0))",
        opacity,
      }}
    />
  );
};

export const IcebergData: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cam = resolveCam(frame);

  const introOpacity = interpolate(frame, [0, ZOOM_OUT * 0.3], [0, 1], {
    easing: EASE_OUT,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const outroOpacity = interpolate(
    frame,
    [SCENE_FRAMES - OUTRO, SCENE_FRAMES],
    [1, 0],
    { easing: EASE_OUT, extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const sceneOpacity = Math.min(introOpacity, outroOpacity);

  // The "below" header lands a few frames before the first below-leaf, so
  // the eye has somewhere to settle before the leaves stamp in.
  const belowHeaderStart = tierAnimStart(2) - 8;
  const aboveHeaderStart = 6;

  return (
    <AbsoluteFill
      style={{
        background: "#051630",
        opacity: sceneOpacity,
        fontFamily: font,
      }}
    >
      <SkyOceanBackdrop frame={frame} />
      <IcebergImage cam={cam} />

      <Cluster
        headerText={ABOVE_HEADER}
        headerStart={aboveHeaderStart}
        tiers={ABOVE}
        leafStartIndex={0}
        top={170}
        frame={frame}
        fps={fps}
        accent="blue"
      />

      <WaterlineRule frame={frame} />

      <Cluster
        headerText={BELOW_HEADER}
        headerStart={belowHeaderStart}
        tiers={BELOW}
        leafStartIndex={2}
        top={470}
        frame={frame}
        fps={fps}
        accent="red"
      />
    </AbsoluteFill>
  );
};

export const icebergDataMeta = {
  id: "IcebergData",
  component: IcebergData,
  durationInFrames: SCENE_FRAMES,
  fps: FPS,
  width: W,
  height: H,
};
