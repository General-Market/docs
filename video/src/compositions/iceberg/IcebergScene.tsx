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

// Source image 1200x836. Bottom holds a watermark logo — crop it off.
const IMG_NATIVE_W = 1200;
const IMG_NATIVE_H = 836;
const CROP_BOTTOM = 0.1;

const IMG_CROPPED_H = IMG_NATIVE_H * (1 - CROP_BOTTOM);
const IMG_AR = IMG_NATIVE_W / IMG_CROPPED_H;

// Waterline in the cropped image — measured by luminance drop sampled in
// columns away from the iceberg: transition at y ≈ 270 in the source.
const WATERLINE = 270 / IMG_CROPPED_H;

// Minimum scale where the cropped image fully covers the frame.
const MIN_COVER_SCALE = WIDTH / (HEIGHT * IMG_AR);

type Cam = { fx: number; fy: number; scale: number };

// Tip ≈ y=0.10 (cropped). Push in on the top; horizon sits mid-low in frame.
const CAM_TOP: Cam = { fx: 0.44, fy: 0.31, scale: 1.95 };
// Full view — just above min cover so sway has headroom.
const CAM_FULL: Cam = { fx: 0.5, fy: 0.5, scale: MIN_COVER_SCALE + 0.06 };
// Submerged mass — horizon held at a 5% strip at the top, iceberg bulk below.
const CAM_BOTTOM: Cam = { fx: 0.47, fy: 0.6, scale: 1.8 };

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

  const swayX = Math.sin(frame * 0.055) * 9 + Math.sin(frame * 0.021) * 3;
  const swayY = Math.sin(frame * 0.041 + 1.1) * 5;

  const imgH = HEIGHT * cam.scale;
  const imgW = imgH * IMG_AR;

  let imgLeft = WIDTH / 2 - cam.fx * imgW + swayX;
  let imgTop = HEIGHT / 2 - cam.fy * imgH + swayY;

  imgLeft = Math.min(0, Math.max(WIDTH - imgW, imgLeft));
  imgTop = Math.min(0, Math.max(HEIGHT - imgH, imgTop));

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

// Bright moving glint along the sea surface — a wide soft glow with a sharper
// crest line layered on top, both blended additively over the water.
const Shimmer: React.FC<{ y: number; frame: number }> = ({ y, frame }) => {
  const W = WIDTH;
  const phase = frame * 2.6;
  const steps = 140;
  const amp = 5.5;

  const pts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * W;
    const yy =
      Math.sin(((x + phase) / 360) * Math.PI * 2) * amp +
      Math.sin(((x - phase * 0.7) / 160) * Math.PI * 2) * amp * 0.45 +
      Math.sin(((x + phase * 1.3) / 78) * Math.PI * 2) * amp * 0.22;
    pts.push(`${x.toFixed(1)},${yy.toFixed(2)}`);
  }
  const line = pts.join(" ");
  const BAND = 90;

  const common: React.CSSProperties = {
    position: "absolute",
    left: 0,
    top: y - BAND / 2,
    width: W,
    height: BAND,
    pointerEvents: "none",
    mixBlendMode: "screen",
  };

  return (
    <>
      <svg
        style={{ ...common, filter: "blur(6px)", opacity: 0.8 }}
        viewBox={`0 ${-BAND / 2} ${W} ${BAND}`}
      >
        <polyline
          points={line}
          stroke="rgba(175, 220, 242, 1)"
          strokeWidth="7"
          fill="none"
        />
      </svg>
      <svg
        style={{ ...common, filter: "blur(1.2px)" }}
        viewBox={`0 ${-BAND / 2} ${W} ${BAND}`}
      >
        <polyline
          points={line}
          stroke="rgba(250, 252, 255, 0.9)"
          strokeWidth="1.8"
          fill="none"
        />
      </svg>
    </>
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
