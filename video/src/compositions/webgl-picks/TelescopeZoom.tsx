import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from "remotion";

const SCATTERED = [
  { x: 12, y: 15, w: 80, h: 55, color: "#ff6b6b", rot: 12 },
  { x: 72, y: 8, w: 65, h: 45, color: "#4ecdc4", rot: -8 },
  { x: 25, y: 68, w: 70, h: 50, color: "#ffd93d", rot: 5 },
  { x: 80, y: 72, w: 60, h: 40, color: "#6bcb77", rot: -15 },
  { x: 45, y: 5, w: 55, h: 75, color: "#ff8a5c", rot: 20 },
  { x: 8, y: 45, w: 75, h: 48, color: "#5bc0eb", rot: -6 },
  { x: 60, y: 40, w: 50, h: 65, color: "#f72585", rot: 10 },
  { x: 88, y: 35, w: 60, h: 42, color: "#7209b7", rot: -18 },
  { x: 35, y: 85, w: 72, h: 48, color: "#00b4d8", rot: 8 },
  { x: 55, y: 75, w: 58, h: 38, color: "#e67e22", rot: -12 },
  { x: 15, y: 88, w: 45, h: 60, color: "#2ecc71", rot: 15 },
  { x: 90, y: 90, w: 68, h: 45, color: "#ea5455", rot: -4 },
];

const MASK_SCALES = [1.0, 0.85, 0.6, 0.45, 0.3, 0.15];

const HERO_GRADIENT =
  "linear-gradient(135deg, #0f0c29 0%, #302b63 40%, #24243e 70%, #e94560 100%)";

export const TelescopeZoom: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const progress = frame / durationInFrames;

  // Phase 1: scattered images fly toward camera (0..0.5)
  const flyProgress = interpolate(progress, [0, 0.5], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });

  // Phase 2: mask layers scale up (0.2..0.85)
  const maskProgress = interpolate(progress, [0.2, 0.85], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });

  // Phase 3: text splits (0.7..1.0)
  const splitProgress = interpolate(progress, [0.7, 1.0], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a12", overflow: "hidden" }}>
      {/* Scattered small images */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          perspective: height,
          transformStyle: "preserve-3d",
        }}
      >
        {SCATTERED.map((item, i) => {
          const stagger = interpolate(i, [0, SCATTERED.length - 1], [0, 0.15]);
          const itemFly = interpolate(
            flyProgress,
            [stagger, 1],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          );
          const z = itemFly * height;
          const opacity = interpolate(itemFly, [0, 0.3, 0.85, 1], [1, 1, 0.6, 0]);

          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: `${item.x}%`,
                top: `${item.y}%`,
                width: item.w,
                height: item.h,
                backgroundColor: item.color,
                borderRadius: 6,
                transform: `translate3d(-50%, -50%, ${z}px) rotate(${item.rot}deg)`,
                opacity,
              }}
            />
          );
        })}
      </div>

      {/* Concentric mask layers revealing the hero */}
      {MASK_SCALES.map((initScale, i) => {
        const layerDelay = interpolate(i, [0, MASK_SCALES.length - 1], [0, 0.3]);
        const layerProgress = interpolate(
          maskProgress,
          [layerDelay, 1],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );
        const scale = interpolate(layerProgress, [0, 1], [initScale, 1]);
        const blur = interpolate(layerProgress, [0, 0.5, 1], [8, 3, 0]);

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              inset: 0,
              background: HERO_GRADIENT,
              transform: `scale(${scale})`,
              filter: `blur(${blur}px)`,
              maskImage:
                "radial-gradient(circle at center, black 0%, black 48%, transparent 50%)",
              WebkitMaskImage:
                "radial-gradient(circle at center, black 0%, black 48%, transparent 50%)",
            }}
          />
        );
      })}

      {/* Split text */}
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
            fontFamily: "system-ui, sans-serif",
            fontSize: 72,
            fontWeight: 800,
            color: "rgba(255,255,255,0.9)",
            letterSpacing: 8,
            textTransform: "uppercase",
            transform: `translateX(${-splitProgress * width * 0.35}px)`,
            opacity: interpolate(splitProgress, [0, 0.1, 0.8, 1], [0.9, 0.9, 0.5, 0]),
          }}
        >
          TELE
        </span>
        <span
          style={{
            fontFamily: "system-ui, sans-serif",
            fontSize: 72,
            fontWeight: 800,
            color: "rgba(255,255,255,0.9)",
            letterSpacing: 8,
            textTransform: "uppercase",
            transform: `translateX(${splitProgress * width * 0.35}px)`,
            opacity: interpolate(splitProgress, [0, 0.1, 0.8, 1], [0.9, 0.9, 0.5, 0]),
          }}
        >
          SCOPE
        </span>
      </div>
    </AbsoluteFill>
  );
};
