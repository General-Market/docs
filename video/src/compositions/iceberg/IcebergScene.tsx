import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";

const FPS = 30;
const DURATION = 9 * FPS;
const WIDTH = 1920;
const HEIGHT = 1080;

const IMG_AR = 1200 / 836;
const WATERLINE = 0.26;

type Cam = { fx: number; fy: number; scale: number };

const CAM_TOP: Cam = { fx: 0.5, fy: 0.18, scale: 2.4 };
const CAM_FULL: Cam = { fx: 0.5, fy: 0.45, scale: 1.15 };
const CAM_BOTTOM: Cam = { fx: 0.5, fy: 0.78, scale: 1.95 };

const P1_END = 3 * FPS;
const P2_END = 5 * FPS;
const P3_SETTLE = DURATION - 20;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const lerpCam = (a: Cam, b: Cam, t: number): Cam => ({
  fx: lerp(a.fx, b.fx, t),
  fy: lerp(a.fy, b.fy, t),
  scale: lerp(a.scale, b.scale, t),
});

export const IcebergScene: React.FC = () => {
  const frame = useCurrentFrame();

  let cam: Cam;
  if (frame < P1_END) {
    cam = CAM_TOP;
  } else if (frame < P2_END) {
    const t = ease((frame - P1_END) / (P2_END - P1_END));
    cam = lerpCam(CAM_TOP, CAM_FULL, t);
  } else {
    const raw = (frame - P2_END) / (P3_SETTLE - P2_END);
    cam = lerpCam(CAM_FULL, CAM_BOTTOM, ease(Math.min(1, Math.max(0, raw))));
  }

  const swayX = Math.sin(frame * 0.055) * 10 + Math.sin(frame * 0.021) * 4;
  const swayY = Math.sin(frame * 0.041 + 1.1) * 7;
  const swayR = Math.sin(frame * 0.032) * 0.4;

  const imgH = HEIGHT * cam.scale;
  const imgW = imgH * IMG_AR;
  const imgLeft = WIDTH / 2 - cam.fx * imgW + swayX;
  const imgTop = HEIGHT / 2 - cam.fy * imgH + swayY;

  const waterY = imgTop + WATERLINE * imgH;
  const waveOpacity = interpolate(
    waterY,
    [-80, 0, HEIGHT, HEIGHT + 80],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const underwater = interpolate(
    waterY,
    [0, -120],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const skyGradient =
    "linear-gradient(180deg, #d7e6ef 0%, #b5cfdd 55%, #88aec3 100%)";
  const deepGradient =
    "linear-gradient(180deg, #1d3b52 0%, #0c2336 70%, #06141f 100%)";

  return (
    <AbsoluteFill style={{ backgroundColor: "#0c2336", overflow: "hidden" }}>
      <AbsoluteFill style={{ background: skyGradient }} />

      <div
        style={{
          position: "absolute",
          left: imgLeft,
          top: imgTop,
          width: imgW,
          height: imgH,
          transform: `rotate(${swayR}deg)`,
          transformOrigin: "center center",
        }}
      >
        <Img
          src={staticFile("iceberg.webp")}
          style={{ width: "100%", height: "100%", display: "block" }}
        />
      </div>

      <Wave y={waterY} frame={frame} opacity={waveOpacity} />

      <AbsoluteFill
        style={{
          background: deepGradient,
          opacity: underwater * 0.55,
          mixBlendMode: "multiply",
          pointerEvents: "none",
        }}
      />

      <Caustics frame={frame} opacity={underwater * 0.35} />
    </AbsoluteFill>
  );
};

const Wave: React.FC<{ y: number; frame: number; opacity: number }> = ({
  y,
  frame,
  opacity,
}) => {
  if (opacity <= 0.01) return null;
  const W = WIDTH;
  const amp = 9;
  const wavelen = 320;
  const phase = frame * 3.2;
  const steps = 120;
  const pts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * W;
    const yy =
      Math.sin(((x + phase) / wavelen) * Math.PI * 2) * amp +
      Math.sin(((x - phase * 0.7) / (wavelen * 0.55)) * Math.PI * 2) * amp * 0.45 +
      Math.sin(((x + phase * 1.3) / (wavelen * 0.28)) * Math.PI * 2) * amp * 0.18;
    pts.push(`${x.toFixed(1)},${yy.toFixed(2)}`);
  }
  const BAND = 140;
  const fillPath = `M 0,${amp * 2} L ${pts.join(" L ")} L ${W},${BAND} L 0,${BAND} Z`;

  return (
    <svg
      style={{
        position: "absolute",
        left: 0,
        top: y - 40,
        width: W,
        height: BAND,
        pointerEvents: "none",
        opacity,
      }}
      viewBox={`0 -40 ${W} ${BAND}`}
    >
      <defs>
        <linearGradient id="waveBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5c8ca8" stopOpacity="0.55" />
          <stop offset="1" stopColor="#14324a" stopOpacity="0.9" />
        </linearGradient>
        <linearGradient id="waveHighlight" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgba(255,255,255,0.75)" />
          <stop offset="1" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>

      <path d={fillPath} fill="url(#waveBody)" />
      <polyline
        points={pts.join(" ")}
        stroke="rgba(255,255,255,0.55)"
        strokeWidth="2"
        fill="none"
      />
      <polyline
        points={pts
          .map((p) => {
            const [x, yy] = p.split(",").map(Number);
            return `${x},${(yy - 3).toFixed(2)}`;
          })
          .join(" ")}
        stroke="rgba(255,255,255,0.22)"
        strokeWidth="1"
        fill="none"
      />
    </svg>
  );
};

const Caustics: React.FC<{ frame: number; opacity: number }> = ({
  frame,
  opacity,
}) => {
  if (opacity <= 0.01) return null;
  const t = frame * 0.6;
  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        opacity,
        mixBlendMode: "screen",
        background: `
          radial-gradient(ellipse 60% 30% at ${50 + Math.sin(t * 0.03) * 15}% ${20 + Math.cos(t * 0.02) * 10}%, rgba(180, 220, 240, 0.4), transparent 60%),
          radial-gradient(ellipse 40% 20% at ${30 + Math.cos(t * 0.04) * 20}% ${60 + Math.sin(t * 0.025) * 15}%, rgba(140, 200, 230, 0.3), transparent 70%)
        `,
      }}
    />
  );
};

export const icebergMeta = {
  id: "Iceberg",
  component: IcebergScene,
  durationInFrames: DURATION,
  fps: FPS,
  width: WIDTH,
  height: HEIGHT,
};
