// Source: CodePen "Travel Without Limit" — an image-clipped title ringed by
// five orbiting decorative circles cut from the same image.
// The original ran two wall-clock keyframes: the deco-wrapper rotated a full
// turn every 20s (rotate-outer) while each circle spun on its own Y axis every
// 5s (rotate-single, staggered by -0.5s each). The hover state (scale 1.3,
// ungrayscale title) is dropped — only the visual survives. Here both keyframes
// become frame-driven: the outer ring makes one full turn over 600 frames and
// each circle completes whole Y revolutions, phase-offset per index.
import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  Easing,
} from "remotion";

const TOTAL = 5;

// The shared image becomes a warm travel-toned gradient, clipped into the
// title text and tiled across the deco circles.
const IMG_GRADIENT =
  "linear-gradient(135deg, #f6d365 0%, #fda085 35%, #f093fb 70%, #4facfe 100%)";

const WRAPPER_W = 720; // scaled up from the original 250px
const RADIUS = 460; // original --radius: 160px, scaled to the new wrapper
const DECO_SIZE = 116; // original --size: 40px, scaled

export const TravelDeco: React.FC = () => {
  const frame = useCurrentFrame();

  // rotate-outer: the whole deco ring turns once across the scene.
  const outer = interpolate(frame, [0, 600], [0, 360], {
    easing: Easing.inOut(Easing.sin),
    extrapolateRight: "clamp",
  });

  // rotate-single: each circle spins on Y. Original = 360° / 5s = 72°/s.
  // At 60fps over 10s that is two full turns; keep that pace, phase-offset
  // each circle the way the original used animation-delay: i * -0.5s.
  const baseSpin = interpolate(frame, [0, 600], [0, 720], {
    extrapolateRight: "clamp",
  });

  // Title entrance: a soft settle so frame 1 is already alive but not static.
  const titleScale = interpolate(frame, [0, 40], [0.94, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#ececec",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
        fontFamily: "'Space Grotesk', sans-serif",
        fontSize: 140,
      }}
    >
      <div
        style={{
          position: "relative",
          width: WRAPPER_W,
          padding: 12,
          transform: `scale(${titleScale})`,
        }}
      >
        {/* deco-wrapper — orbiting ring, sits behind the title */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            margin: "auto",
            transformStyle: "preserve-3d",
            zIndex: -1,
            transform: `rotate(${outer}deg)`,
          }}
        >
          {Array.from({ length: TOTAL }, (_, idx) => {
            const i = idx + 1; // original --i runs 1..5
            const rotationRad = ((360 / TOTAL) * i * Math.PI) / 180;
            const tx = Math.cos(rotationRad) * RADIUS;
            const ty = Math.sin(rotationRad) * RADIUS;
            // animation-delay: i * -0.5s ⇒ phase lead of i*30 frames at 60fps.
            const spin = baseSpin + i * 36;
            const bgPos = `${i * 20}% ${i * 20}%`;

            return (
              <div
                key={idx}
                style={{
                  position: "absolute",
                  inset: 0,
                  margin: "auto",
                  width: DECO_SIZE,
                  height: DECO_SIZE,
                  borderRadius: "50%",
                  background: IMG_GRADIENT,
                  backgroundSize: "500% 500%",
                  backgroundPosition: bgPos,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
                  transform: `translate(${tx}px, ${ty}px) rotateY(${spin}deg)`,
                }}
              />
            );
          })}
        </div>

        {/* title — text clipped to the image gradient */}
        <div
          style={{
            fontWeight: 700,
            textAlign: "center",
            lineHeight: 1.05,
            color: "transparent",
            background: IMG_GRADIENT,
            backgroundSize: "cover",
            backgroundPosition: "center",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
          }}
        >
          Travel Without Limit
        </div>
      </div>
    </AbsoluteFill>
  );
};
