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
const ICE_AR = ICE_NATIVE_W / ICE_NATIVE_H;
const ICE_WATERLINE_NORM = 305 / ICE_NATIVE_H; // ~0.424

const MIN_COVER_SCALE = W / (H * ICE_AR); // 1.0 (the image is already 16:9)

// ── Camera plan ─────────────────────────────────────────────────────────────
type Cam = { fx: number; fy: number; scale: number };
const CAM_TOP: Cam = { fx: 0.5, fy: 0.34, scale: 1.55 };
const CAM_FULL: Cam = { fx: 0.5, fy: 0.5, scale: MIN_COVER_SCALE + 0.08 };
const CAM_BOTTOM: Cam = { fx: 0.5, fy: 0.66, scale: 1.45 };

const P1_END = sec(3.2);
const P2_END = sec(6.4);
const P3_SETTLE = sec(9.6);

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
  if (frame < P1_END) {
    cam = CAM_TOP;
  } else if (frame < P2_END) {
    const t = easeInOut((frame - P1_END) / (P2_END - P1_END));
    cam = lerpCam(CAM_TOP, CAM_FULL, t);
  } else {
    const raw = (frame - P2_END) / Math.max(1, P3_SETTLE - P2_END);
    cam = lerpCam(
      CAM_FULL,
      CAM_BOTTOM,
      easeInOut(Math.min(1, Math.max(0, raw))),
    );
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

// ── Visual tokens ───────────────────────────────────────────────────────────
const COLOR = {
  ink: "#1D1D1F",
  muted: "rgba(29,29,31,0.56)",
  hairline: "rgba(14,15,12,0.10)",
  white: "#FFFFFF",
  red: "#E0394A",
  redInk: "#B71C2A",
};

const SHADOW =
  "rgba(14,15,12,0.12) 0 0 0 1px, 0 24px 56px rgba(0,0,0,0.28)";

// ── Camera-following iceberg ────────────────────────────────────────────────
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
      style={{
        width: cam.imgW,
        height: cam.imgH,
        display: "block",
      }}
    />
  </div>
);

// Cool gradient backdrop in case the image's edges expose seams during sway.
const Backdrop: React.FC = () => (
  <AbsoluteFill
    style={{
      background:
        "linear-gradient(180deg, #8FCBE8 0%, #4FA8D6 38%, #1B6BA1 60%, #0A3A66 100%)",
    }}
  />
);

// ── Cards ───────────────────────────────────────────────────────────────────
const Card: React.FC<{
  x: number;
  y: number;
  width: number;
  align: "left" | "right";
  enterAt: number;
  exitAt?: number;
  fps: number;
  frame: number;
  children: React.ReactNode;
}> = ({ x, y, width, align, enterAt, exitAt, fps, frame, children }) => {
  const enter = spring({
    frame: frame - enterAt,
    fps,
    config: { damping: 22, stiffness: 140, mass: 0.9 },
  });
  const exit = exitAt == null
    ? 1
    : interpolate(frame, [exitAt, exitAt + 14], [1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
  const opacity = enter * exit;
  const lift = (1 - enter) * 18;

  return (
    <div
      style={{
        position: "absolute",
        left: align === "left" ? x : x - width,
        top: y,
        width,
        opacity,
        transform: `translateY(${lift}px)`,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          background: COLOR.white,
          borderRadius: 24,
          padding: "28px 36px 24px",
          boxShadow: SHADOW,
          fontFamily: font,
          color: COLOR.ink,
        }}
      >
        {children}
      </div>
    </div>
  );
};

const Eyebrow: React.FC<{ text: string; tone?: "neutral" | "red" }> = ({
  text,
  tone = "neutral",
}) => (
  <div
    style={{
      fontSize: 20,
      fontWeight: 700,
      letterSpacing: "0.10em",
      textTransform: "uppercase",
      color: tone === "red" ? COLOR.red : COLOR.muted,
      marginBottom: 12,
    }}
  >
    {text}
  </div>
);

const Headline: React.FC<{ text: string }> = ({ text }) => (
  <div
    style={{
      fontSize: 40,
      fontWeight: 700,
      letterSpacing: "-0.018em",
      lineHeight: 1.06,
      marginBottom: 18,
    }}
  >
    {text}
  </div>
);

const StrikeRow: React.FC<{
  label: string;
  revealAt: number;
  strikeAt: number;
  fps: number;
  frame: number;
  size?: number;
}> = ({ label, revealAt, strikeAt, fps, frame, size = 34 }) => {
  const enter = spring({
    frame: frame - revealAt,
    fps,
    config: { damping: 20, stiffness: 130, mass: 0.85 },
  });
  const strike = interpolate(frame, [strikeAt, strikeAt + 9], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const dim = interpolate(strike, [0, 1], [1, 0.45]);

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        padding: "12px 0",
        borderTop: `1px solid ${COLOR.hairline}`,
        opacity: enter,
        transform: `translateX(${(1 - enter) * 10}px)`,
      }}
    >
      <span
        style={{
          fontSize: size,
          fontWeight: 600,
          letterSpacing: "-0.014em",
          color: COLOR.ink,
          opacity: dim,
        }}
      >
        {label}
      </span>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: "50%",
          height: 4,
          background: COLOR.red,
          transformOrigin: "left center",
          transform: `scaleX(${strike})`,
          borderRadius: 2,
          marginTop: -2,
        }}
      />
    </div>
  );
};

const CascadeRow: React.FC<{
  label: string;
  revealAt: number;
  fps: number;
  frame: number;
  emphasis?: boolean;
  index: number;
  total: number;
}> = ({ label, revealAt, fps, frame, emphasis, index, total }) => {
  const enter = spring({
    frame: frame - revealAt,
    fps,
    config: { damping: 20, stiffness: 130, mass: 0.9 },
  });
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "14px 0",
        borderTop: index === 0 ? "none" : `1px solid ${COLOR.hairline}`,
        opacity: enter,
        transform: `translateX(${(1 - enter) * 14}px)`,
      }}
    >
      <span
        style={{
          fontSize: 17,
          fontWeight: 500,
          color: emphasis ? COLOR.red : COLOR.muted,
          letterSpacing: "0.04em",
          width: 56,
          fontFeatureSettings: '"tnum" 1',
        }}
      >
        {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
      </span>
      <span
        style={{
          fontSize: emphasis ? 40 : 34,
          fontWeight: emphasis ? 800 : 600,
          letterSpacing: "-0.016em",
          color: emphasis ? COLOR.redInk : COLOR.ink,
        }}
      >
        {label}
      </span>
    </div>
  );
};

// ── Compositional rows ──────────────────────────────────────────────────────
const THINK_ROWS: ReadonlyArray<{
  label: string;
  revealAt: number;
  strikeAt: number;
}> = [
  { label: "Strategies", revealAt: sec(1.0), strikeAt: sec(2.2) },
  { label: "Fees", revealAt: sec(1.6), strikeAt: sec(2.9) },
];

const REAL_ROWS: ReadonlyArray<{ label: string; revealAt: number; emphasis?: boolean }> = [
  { label: "Liquidation hunters", revealAt: sec(5.2) },
  { label: "Front runners", revealAt: sec(6.0) },
  { label: "Orderbook spoofers", revealAt: sec(6.8) },
  { label: "Insider traders", revealAt: sec(7.8), emphasis: true },
];

// Waterline shimmer — a thin wavy line that tracks the iceberg's water level.
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
  const line = pts.join(" ");
  return (
    <svg
      width={W}
      height={20}
      style={{
        position: "absolute",
        left: 0,
        top: y - 10,
        pointerEvents: "none",
      }}
    >
      <polyline
        points={line}
        fill="none"
        stroke="rgba(255,255,255,0.55)"
        strokeWidth={2}
        transform="translate(0,10)"
      />
    </svg>
  );
};

// ── Outer composition ──────────────────────────────────────────────────────
export const IcebergData: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cam = resolveCam(frame);

  // Outer fade-in / fade-out
  const enter = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.25, 0.1, 0.3, 1),
  });
  const exit = interpolate(frame, [DURATION - 24, DURATION], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = enter * exit;

  return (
    <AbsoluteFill style={{ background: "#04162B", opacity }}>
      <Backdrop />
      <IcebergImage cam={cam} />
      <WaterShimmer y={cam.waterY} frame={frame} />

      {/* Above-water card — anchored top-right, exits as we descend */}
      <Card
        x={W - 88}
        y={120}
        width={620}
        align="right"
        enterAt={sec(0.4)}
        exitAt={sec(8.8)}
        fps={fps}
        frame={frame}
      >
        <Eyebrow text="What they think killed them" />
        <Headline text="Why traders think they lost" />
        {THINK_ROWS.map((row) => (
          <StrikeRow
            key={row.label}
            label={row.label}
            revealAt={row.revealAt}
            strikeAt={row.strikeAt}
            fps={fps}
            frame={frame}
          />
        ))}
      </Card>

      {/* Below-water card — anchored bottom-left, rises as we descend */}
      <Card
        x={88}
        y={H - 520}
        width={760}
        align="left"
        enterAt={sec(4.4)}
        fps={fps}
        frame={frame}
      >
        <Eyebrow text="What actually killed them" tone="red" />
        <Headline text="Why they really lost" />
        {REAL_ROWS.map((row, i) => (
          <CascadeRow
            key={row.label}
            label={row.label}
            revealAt={row.revealAt}
            emphasis={row.emphasis}
            fps={fps}
            frame={frame}
            index={i}
            total={REAL_ROWS.length}
          />
        ))}
      </Card>
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
