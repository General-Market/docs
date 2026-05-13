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

// ── Iceberg image geometry (1280 × 720, 16:9, waterline ≈ 42% from top) ─────
const ICE_NATIVE_W = 1280;
const ICE_NATIVE_H = 720;
const ICE_AR = ICE_NATIVE_W / ICE_NATIVE_H; // 1.778
const ICE_WATERLINE_NORM = 305 / ICE_NATIVE_H;

// ── Camera plan ─────────────────────────────────────────────────────────────
type Cam = { fx: number; fy: number; scale: number };
const CAM_TOP: Cam = { fx: 0.5, fy: 0.32, scale: 1.55 };
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
  if (frame < P1_HOLD_END) cam = CAM_TOP;
  else if (frame < P2_PULL_END) {
    const t = easeInOut((frame - P1_HOLD_END) / (P2_PULL_END - P1_HOLD_END));
    cam = lerpCam(CAM_TOP, CAM_FULL, t);
  } else if (frame < P3_HOLD_END) cam = CAM_FULL;
  else if (frame < P4_PUSH_END) {
    const t = easeInOut((frame - P3_HOLD_END) / (P4_PUSH_END - P3_HOLD_END));
    cam = lerpCam(CAM_FULL, CAM_LOWER, t);
  } else cam = CAM_LOWER;

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

// ── Visual tokens (mirrors AntiCheatIceberg's tile grammar) ─────────────────
const COLOR = {
  white: "#FFFFFF",
  redInk: "#FF566E",
  borderWhite: "rgba(255,255,255,0.92)",
  borderRed: "rgba(255,86,110,0.95)",
  glowWhite: "rgba(255,255,255,0.25)",
  glowRed: "rgba(255,86,110,0.55)",
  panel: "#000000",
};
const EASE_OUT = Easing.bezier(0.25, 0.1, 0.3, 1);

// ── Iceberg image — fills the frame, camera moves it ────────────────────────
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

// ── Waterline shimmer — tracks the iceberg ─────────────────────────────────
const WaterShimmer: React.FC<{ y: number; frame: number }> = ({ y, frame }) => {
  if (y < -10 || y > H + 10) return null;
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
        stroke="rgba(255,255,255,0.7)"
        strokeWidth={2}
        transform="translate(0,10)"
      />
    </svg>
  );
};

// ── Tile (one "square") — same grammar as AntiCheatIceberg tier bands ───────
type Tile = {
  label: string;
  imageSrc: string;
  revealAt: number;
  emphasis?: boolean;
};

const TILE_SIZE = 260;

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
  const activeT = interpolate(frame - tile.revealAt, [0, 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const sat = interpolate(activeT, [0, 1], [0.18, 1.08]);
  const bright = interpolate(activeT, [0, 1], [0.55, 1.0]);
  const blur = interpolate(activeT, [0, 1], [2.4, 0]);
  const filter = `saturate(${sat}) brightness(${bright}) blur(${blur.toFixed(2)}px)`;

  const isRed = !!tile.emphasis;
  const borderColor = isRed ? COLOR.borderRed : COLOR.borderWhite;
  const glowColor = isRed ? COLOR.glowRed : COLOR.glowWhite;

  const pulse = isRed ? 1 + Math.sin(frame * 0.18) * 0.012 * activeT : 1;

  return (
    <div
      style={{
        position: "relative",
        width: TILE_SIZE,
        height: TILE_SIZE,
        overflow: "hidden",
        borderRadius: 16,
        background: COLOR.panel,
        boxShadow: `inset 0 0 0 3px ${borderColor}, inset 0 0 60px ${glowColor}, 0 24px 56px rgba(0,0,0,0.55)`,
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
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          padding: "26px 16px 14px",
          background:
            "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.94) 100%)",
          fontFamily: font,
          fontSize: 20,
          fontWeight: 700,
          color: isRed ? COLOR.redInk : COLOR.white,
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

// ── Heading strip — sits flush with each cluster, screen-fixed ──────────────
const Eyebrow: React.FC<{
  text: string;
  y: number;
  enterAt: number;
  fps: number;
  frame: number;
  tone?: "white" | "red";
}> = ({ text, y, enterAt, fps, frame, tone = "white" }) => {
  const enter = spring({
    frame: frame - enterAt,
    fps,
    config: { damping: 22, stiffness: 130, mass: 0.85 },
  });
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: y,
        textAlign: "center",
        opacity: enter,
        transform: `translateY(${(1 - enter) * 12}px)`,
        pointerEvents: "none",
        fontFamily: font,
      }}
    >
      <div
        style={{
          display: "inline-block",
          padding: "12px 26px",
          borderRadius: 999,
          background: "rgba(4,12,20,0.78)",
          color: tone === "red" ? COLOR.redInk : COLOR.white,
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.18)",
        }}
      >
        {text}
      </div>
    </div>
  );
};

// ── Content ────────────────────────────────────────────────────────────────
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

  // ── Above cluster — screen-fixed: 2 tiles, horizontally centred at top
  const aboveGap = 56;
  const aboveStripW = TILE_SIZE * 2 + aboveGap;
  const aboveLeft = (W - aboveStripW) / 2;
  const aboveTop = 152;

  // ── Below cluster — screen-fixed: 2×2 grid centred at bottom
  const belowGap = 44;
  const belowStripW = TILE_SIZE * 2 + belowGap;
  const belowStripH = TILE_SIZE * 2 + belowGap;
  const belowLeft = (W - belowStripW) / 2;
  const belowTop = H - belowStripH - 124;

  return (
    <AbsoluteFill style={{ background: "#04162B", opacity }}>
      {/* Dark base so above-water sky sits over a cool blue, not on raw black. */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, #8FCBE8 0%, #4FA8D6 38%, #1B6BA1 60%, #0A3A66 100%)",
        }}
      />
      <IcebergImage cam={cam} />
      <WaterShimmer y={cam.waterY} frame={frame} />

      {/* Subtle vignette so tiles read against the iceberg edges. */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 38%, rgba(0,0,0,0.55) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* ── ABOVE: 2 tiles, screen-fixed at top ─────────────────────────── */}
      <Eyebrow
        text="What traders blame"
        y={68}
        enterAt={sec(0.2)}
        fps={fps}
        frame={frame}
      />
      <div
        style={{
          position: "absolute",
          left: aboveLeft,
          top: aboveTop,
          width: aboveStripW,
          height: TILE_SIZE,
          display: "flex",
          gap: aboveGap,
        }}
      >
        {ABOVE.map((tile) => (
          <TileSquare key={tile.label} tile={tile} fps={fps} frame={frame} />
        ))}
      </div>

      {/* ── BELOW: 2×2 grid, screen-fixed at bottom ─────────────────────── */}
      <div
        style={{
          position: "absolute",
          left: belowLeft,
          top: belowTop,
          width: belowStripW,
          height: belowStripH,
          display: "grid",
          gridTemplateColumns: `${TILE_SIZE}px ${TILE_SIZE}px`,
          gridTemplateRows: `${TILE_SIZE}px ${TILE_SIZE}px`,
          columnGap: belowGap,
          rowGap: belowGap,
        }}
      >
        {BELOW.map((tile) => (
          <TileSquare key={tile.label} tile={tile} fps={fps} frame={frame} />
        ))}
      </div>

      <Eyebrow
        text="What actually empties the account"
        y={H - 60}
        enterAt={sec(6.6)}
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
