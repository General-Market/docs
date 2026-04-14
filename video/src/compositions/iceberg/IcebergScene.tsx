import React from "react";
import {
  AbsoluteFill,
  Img,
  staticFile,
  useCurrentFrame,
} from "remotion";

const FPS = 30;
const DURATION = 9 * FPS;
const WIDTH = 1920;
const HEIGHT = 1080;

// Source image: 1200x836. Bottom holds a logo — crop it off.
const IMG_NATIVE_W = 1200;
const IMG_NATIVE_H = 836;
const CROP_BOTTOM = 0.1; // fraction of original removed from bottom (hides logo)

const IMG_CROPPED_H = IMG_NATIVE_H * (1 - CROP_BOTTOM);
const IMG_AR = IMG_NATIVE_W / IMG_CROPPED_H;

// Waterline as fraction of the CROPPED image height.
// Horizon in original image sits at ~y=170/836; rescale to cropped.
const WATERLINE = 170 / IMG_CROPPED_H;

// Minimum scale where the (cropped) image fully covers the frame.
const MIN_COVER_SCALE = WIDTH / (HEIGHT * IMG_AR);

type Cam = { fx: number; fy: number; scale: number };

// Tip sits at ~y=0.093; we keep it near the top and show ocean below.
const CAM_TOP: Cam = { fx: 0.44, fy: 0.38, scale: 1.42 };
// Full view — just above min cover so sway has headroom.
const CAM_FULL: Cam = { fx: 0.5, fy: 0.5, scale: MIN_COVER_SCALE + 0.06 };
// Submerged mass — waterline lingers at the very top of frame.
const CAM_BOTTOM: Cam = { fx: 0.47, fy: 0.58, scale: 1.3 };

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

  // Sea sway — small translation only. Rotation would expose corners.
  const swayX = Math.sin(frame * 0.055) * 9 + Math.sin(frame * 0.021) * 3;
  const swayY = Math.sin(frame * 0.041 + 1.1) * 5;

  // Size of the displayed (cropped) portion.
  const imgH = HEIGHT * cam.scale;
  const imgW = imgH * IMG_AR;

  // Place so that focus point (fx*imgW, fy*imgH) lands at frame center + sway.
  let imgLeft = WIDTH / 2 - cam.fx * imgW + swayX;
  let imgTop = HEIGHT / 2 - cam.fy * imgH + swayY;

  // Never expose image borders. Clamp position so frame stays inside image.
  imgLeft = Math.min(0, Math.max(WIDTH - imgW, imgLeft));
  imgTop = Math.min(0, Math.max(HEIGHT - imgH, imgTop));

  // Render the full (uncropped) image at a proportional size; the container
  // of size imgW × imgH then clips the bottom strip containing the logo.
  const fullImgH = imgH / (1 - CROP_BOTTOM);

  const waterY = imgTop + WATERLINE * imgH;

  return (
    <AbsoluteFill style={{ backgroundColor: "#081826", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          left: imgLeft,
          top: imgTop,
          width: imgW,
          height: imgH,
          overflow: "hidden",
        }}
      >
        <Img
          src={staticFile("iceberg.webp")}
          style={{
            width: imgW,
            height: fullImgH,
            display: "block",
          }}
        />
      </div>

      <Shimmer y={waterY} frame={frame} />
    </AbsoluteFill>
  );
};

// Single soft line that slides and undulates along the sea surface.
const Shimmer: React.FC<{ y: number; frame: number }> = ({ y, frame }) => {
  const W = WIDTH;
  const amp = 2.4;
  const wavelen = 420;
  const phase = frame * 1.8;
  const steps = 80;
  const pts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * W;
    const yy =
      Math.sin(((x + phase) / wavelen) * Math.PI * 2) * amp +
      Math.sin(((x - phase * 0.55) / (wavelen * 0.4)) * Math.PI * 2) *
        amp *
        0.35;
    pts.push(`${x.toFixed(1)},${yy.toFixed(2)}`);
  }
  const BAND = 36;

  return (
    <svg
      style={{
        position: "absolute",
        left: 0,
        top: y - BAND / 2,
        width: W,
        height: BAND,
        pointerEvents: "none",
        filter: "blur(2.5px)",
        mixBlendMode: "screen",
      }}
      viewBox={`0 ${-BAND / 2} ${W} ${BAND}`}
    >
      <polyline
        points={pts.join(" ")}
        stroke="rgba(200, 228, 242, 0.55)"
        strokeWidth="2.2"
        fill="none"
      />
    </svg>
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
