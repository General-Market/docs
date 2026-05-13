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

// ── Composition meta ────────────────────────────────────────────────────────
const W = 1920;
const H = 1080;
const FPS = 30;
const DURATION_SEC = 12;
const DURATION = DURATION_SEC * FPS; // 360
const sec = (s: number) => Math.round(s * FPS);

// ── Iceberg image geometry (1280 × 720, waterline ≈ 42% from top) ───────────
const ICE_NATIVE_W = 1280;
const ICE_NATIVE_H = 720;
const ICE_AR = ICE_NATIVE_W / ICE_NATIVE_H; // 1.778 — exact 16:9
const ICE_WATERLINE_NORM = 305 / ICE_NATIVE_H; // ~0.424

// Image-space anchors for the two card clusters.
// Above-water: just above the iceberg's tip.
// Below-water: centred over the submerged mass.
const ABOVE_ANCHOR = { pctX: 0.5, pctY: 0.18 };
const BELOW_ANCHOR = { pctX: 0.5, pctY: 0.72 };

// ── Camera ──────────────────────────────────────────────────────────────────
type Cam = { fx: number; fy: number; scale: number };
const CAM_TOP: Cam = { fx: 0.5, fy: 0.32, scale: 1.6 };
const CAM_FULL: Cam = { fx: 0.5, fy: 0.5, scale: 1.04 };
const CAM_LOWER: Cam = { fx: 0.5, fy: 0.72, scale: 1.55 };

const P1_HOLD_END = sec(2.2);
const P2_PULL_END = sec(4.2);
const P3_HOLD_END = sec(6.0);
const P4_PUSH_END = sec(8.0);

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpCam = (a: Cam, b: Cam, t: number): Cam => ({
  fx: lerp(a.fx, b.fx, t),
  fy: lerp(a.fy, b.fy, t),
  scale: lerp(a.scale, b.scale, t),
});
const easeInOut = (t: number) =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

const resolveCam = (frame: number) => {
  let cam: Cam;
  if (frame < P1_HOLD_END) {
    cam = CAM_TOP;
  } else if (frame < P2_PULL_END) {
    const t = easeInOut((frame - P1_HOLD_END) / (P2_PULL_END - P1_HOLD_END));
    cam = lerpCam(CAM_TOP, CAM_FULL, t);
  } else if (frame < P3_HOLD_END) {
    cam = CAM_FULL;
  } else if (frame < P4_PUSH_END) {
    const t = easeInOut((frame - P3_HOLD_END) / (P4_PUSH_END - P3_HOLD_END));
    cam = lerpCam(CAM_FULL, CAM_LOWER, t);
  } else {
    cam = CAM_LOWER;
  }

  const swayX = Math.sin(frame * 0.05) * 4 + Math.sin(frame * 0.02) * 1.5;
  const swayY = Math.sin(frame * 0.038 + 1.1) * 2.5;

  const imgH = H * cam.scale;
  const imgW = imgH * ICE_AR;

  let imgLeft = W / 2 - cam.fx * imgW + swayX;
  let imgTop = H / 2 - cam.fy * imgH + swayY;

  imgLeft = Math.min(0, Math.max(W - imgW, imgLeft));
  imgTop = Math.min(0, Math.max(H - imgH, imgTop));

  const waterY = imgTop + ICE_WATERLINE_NORM * imgH;

  return { cam, imgLeft, imgTop, imgW, imgH, waterY };
};

type CamState = ReturnType<typeof resolveCam>;

const anchorToScreen = (cam: CamState, a: { pctX: number; pctY: number }) => ({
  x: cam.imgLeft + a.pctX * cam.imgW,
  y: cam.imgTop + a.pctY * cam.imgH,
});

// ── Visual tokens ───────────────────────────────────────────────────────────
const COLOR = {
  ink: "#0E1518",
  white: "#FFFFFF",
  border: "rgba(255,255,255,0.92)",
  borderRed: "rgba(255,86,110,0.95)",
  glow: "rgba(255,255,255,0.22)",
  glowRed: "rgba(255,86,110,0.55)",
};
const EASE_OUT = Easing.bezier(0.25, 0.1, 0.3, 1);

// ── Iceberg image with camera ───────────────────────────────────────────────
const IcebergImage: React.FC<{ cam: CamState }> = ({ cam }) => (
  <div
    style={{
      position: "absolute",
      left: cam.imgLeft,
      top: cam.imgTop,
      width: cam.imgW,
      height: cam.imgH,
      overflow: "hidden",
    }}
  >
    <Img
      src={staticFile("iceberg-data.webp")}
      style={{ width: cam.imgW, height: cam.imgH, display: "block" }}
    />
  </div>
);

// ── Tile (a single "square") — same grammar as AntiCheatIceberg's tier bands.
// Greyscale + blurred while pending, fully colour when active, white border
// (red for the climax). Bottom gradient carries the label.
type Tile = {
  label: string;
  imageSrc: string;
  revealAt: number;
  emphasis?: boolean;
};

const TILE_W = 280;
const TILE_H = 280;

const TileSquare: React.FC<{
  tile: Tile;
  fps: number;
  frame: number;
}> = ({ tile, fps, frame }) => {
  const enter = spring({
    frame: frame - tile.revealAt,
    fps,
    config: { damping: 22, stiffness: 140, mass: 0.95 },
  });
  // The tile starts greyscale + blur, becomes fully readable as it lands.
  const activeT = interpolate(frame - tile.revealAt, [0, 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const sat = interpolate(activeT, [0, 1], [0.25, 1.08]);
  const bright = interpolate(activeT, [0, 1], [0.65, 1.0]);
  const blur = interpolate(activeT, [0, 1], [2.2, 0]);
  const filter = `saturate(${sat}) brightness(${bright}) blur(${blur.toFixed(2)}px)`;

  const isRed = !!tile.emphasis;
  const borderColor = isRed ? COLOR.borderRed : COLOR.border;
  const glowColor = isRed ? COLOR.glowRed : COLOR.glow;

  // Climax pulse on the red tile — gentle 2bpm-ish breathing.
  const pulse = isRed ? 1 + Math.sin(frame * 0.18) * 0.012 * activeT : 1;

  return (
    <div
      style={{
        position: "relative",
        width: TILE_W,
        height: TILE_H,
        overflow: "hidden",
        borderRadius: 18,
        background: "#04060A",
        boxShadow: `inset 0 0 0 3px ${borderColor}, inset 0 0 60px ${glowColor}, 0 28px 60px rgba(0,0,0,0.55)`,
        opacity: enter,
        transform: `translateY(${(1 - enter) * 22}px) scale(${pulse.toFixed(4)})`,
        willChange: "transform, opacity",
      }}
    >
      <Img
        src={staticFile(tile.imageSrc)}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          filter,
          transition: "filter 220ms ease",
        }}
      />
      {/* Bottom scrim — same Wise/Apple gradient as AntiCheatIceberg tiers */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          padding: "28px 18px 16px",
          background:
            "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.94) 100%)",
          fontFamily: font,
          fontSize: 22,
          fontWeight: 700,
          color: isRed ? "#FF566E" : COLOR.white,
          letterSpacing: "-0.012em",
          lineHeight: 1.15,
          textShadow: "0 1px 8px rgba(0,0,0,0.95)",
        }}
      >
        {tile.label}
      </div>
    </div>
  );
};

// ── Tile groups ────────────────────────────────────────────────────────────
const ABOVE: ReadonlyArray<Tile> = [
  { label: "Strategies", imageSrc: "anticheat-imgs/trader-0.png", revealAt: sec(0.5) },
  { label: "Fees", imageSrc: "anticheat-imgs/polymarket-chart.png", revealAt: sec(1.0) },
];

const BELOW: ReadonlyArray<Tile> = [
  { label: "Liquidation hunters", imageSrc: "anticheat-imgs/hft-racks.png", revealAt: sec(7.0) },
  { label: "Front runners", imageSrc: "anticheat-imgs/orderflow-traders.png", revealAt: sec(7.6) },
  { label: "Orderbook spoofers", imageSrc: "anticheat-imgs/trader-3.png", revealAt: sec(8.2) },
  { label: "Insider traders", imageSrc: "anticheat-imgs/congress.jpg", revealAt: sec(9.0), emphasis: true },
];

// ── Title strips ───────────────────────────────────────────────────────────
const TitleStrip: React.FC<{
  text: string;
  enterAt: number;
  exitAt?: number;
  x: number;
  y: number;
  fps: number;
  frame: number;
  tone?: "white" | "red";
}> = ({ text, enterAt, exitAt, x, y, fps, frame, tone = "white" }) => {
  const enter = spring({
    frame: frame - enterAt,
    fps,
    config: { damping: 22, stiffness: 130, mass: 0.85 },
  });
  const exit =
    exitAt == null
      ? 1
      : interpolate(frame, [exitAt, exitAt + 14], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: y,
        textAlign: "center",
        opacity: enter * exit,
        transform: `translateY(${(1 - enter) * 14}px)`,
        pointerEvents: "none",
        fontFamily: font,
      }}
    >
      <div
        style={{
          display: "inline-block",
          padding: "10px 22px",
          borderRadius: 999,
          background: "rgba(4,12,20,0.78)",
          color: tone === "red" ? "#FF566E" : COLOR.white,
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.18)",
        }}
      >
        {text}
      </div>
    </div>
  );
};

// Waterline shimmer — narrow specular sweep that tracks the iceberg.
const WaterShimmer: React.FC<{ y: number; frame: number }> = ({ y, frame }) => {
  const phase = frame * 2.6;
  const steps = 120;
  const amp = 4;
  const pts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * W;
    const yy =
      Math.sin(((x + phase) / 360) * Math.PI * 2) * amp +
      Math.sin(((x - phase * 0.7) / 160) * Math.PI * 2) * amp * 0.45;
    pts.push(`${x.toFixed(1)},${yy.toFixed(2)}`);
  }
  return (
    <svg
      width={W}
      height={20}
      style={{ position: "absolute", left: 0, top: y - 10, pointerEvents: "none" }}
    >
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke="rgba(255,255,255,0.55)"
        strokeWidth={2}
        transform="translate(0,10)"
      />
    </svg>
  );
};

// ── Backdrop gradient ──────────────────────────────────────────────────────
const Backdrop: React.FC = () => (
  <AbsoluteFill
    style={{
      background:
        "linear-gradient(180deg, #8FCBE8 0%, #4FA8D6 38%, #1B6BA1 60%, #0A3A66 100%)",
    }}
  />
);

// ── Outer composition ─────────────────────────────────────────────────────
export const IcebergData: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cam = resolveCam(frame);

  const enter = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE_OUT,
  });
  const exit = interpolate(frame, [DURATION - 24, DURATION], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = enter * exit;

  // Above-water tiles — anchored to image space (track the camera), exit
  // as we descend past P3.
  const aboveAnchor = anchorToScreen(cam, ABOVE_ANCHOR);
  const aboveGroupExit = interpolate(frame, [P3_HOLD_END + 6, P4_PUSH_END], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const aboveGapX = TILE_W + 56;
  const aboveLeftX = aboveAnchor.x - aboveGapX / 2 - TILE_W / 2;
  const aboveTopY = aboveAnchor.y - TILE_H / 2;

  // Below-water tiles — 2×2 grid anchored to the submerged mass.
  const belowAnchor = anchorToScreen(cam, BELOW_ANCHOR);
  const belowGapX = TILE_W + 56;
  const belowGapY = TILE_H + 40;
  const belowLeftX = belowAnchor.x - belowGapX / 2 - TILE_W / 2;
  const belowTopY = belowAnchor.y - belowGapY / 2 - TILE_H / 2;

  return (
    <AbsoluteFill style={{ background: "#04162B", opacity }}>
      <Backdrop />
      <IcebergImage cam={cam} />
      <WaterShimmer y={cam.waterY} frame={frame} />

      {/* ── Above-water cluster ─────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          left: aboveLeftX,
          top: aboveTopY,
          width: aboveGapX + TILE_W,
          height: TILE_H,
          display: "flex",
          gap: 56,
          opacity: aboveGroupExit,
          transition: "opacity 200ms ease",
        }}
      >
        {ABOVE.map((tile) => (
          <TileSquare key={tile.label} tile={tile} fps={fps} frame={frame} />
        ))}
      </div>

      <TitleStrip
        text="What they think killed them"
        enterAt={sec(0.2)}
        exitAt={sec(5.8)}
        x={0}
        y={84}
        fps={fps}
        frame={frame}
      />

      {/* ── Below-water cluster (2×2) ───────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          left: belowLeftX,
          top: belowTopY,
          width: belowGapX + TILE_W,
          height: belowGapY + TILE_H,
          display: "grid",
          gridTemplateColumns: `${TILE_W}px ${TILE_W}px`,
          gridTemplateRows: `${TILE_H}px ${TILE_H}px`,
          columnGap: 56,
          rowGap: 40,
        }}
      >
        {BELOW.map((tile) => (
          <TileSquare key={tile.label} tile={tile} fps={fps} frame={frame} />
        ))}
      </div>

      <TitleStrip
        text="What actually killed them"
        enterAt={sec(6.6)}
        x={0}
        y={H - 80}
        fps={fps}
        frame={frame}
        tone="red"
      />
    </AbsoluteFill>
  );
};

export const icebergDataMeta = {
  id: "IcebergData",
  component: IcebergData,
  durationInFrames: DURATION,
  fps: FPS,
  width: W,
  height: H,
};
