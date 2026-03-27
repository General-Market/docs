/**
 * PolaroidPhoto — evidence file aesthetic
 *
 * White border, slight 3D tilt, drop shadow, reflection underneath.
 * Spring-animated entrance with rotation settling.
 */
import React from "react";
import { Img, staticFile, interpolate, spring } from "remotion";

const FPS = 30;

const PHOTO_SPRING = { damping: 18, stiffness: 120, mass: 0.7 };

interface PolaroidPhotoProps {
  src: string; // path relative to public/
  width?: number;
  height?: number;
  rotation?: number; // final resting rotation in degrees
  offsetX?: number; // horizontal offset from center of stack
  offsetY?: number; // vertical offset
  delay?: number; // entrance delay in frames
  localFrame: number; // current frame within item window
  exitProgress: number; // 0→1 exit animation
}

export const PolaroidPhoto: React.FC<PolaroidPhotoProps> = ({
  src,
  width = 240,
  height = 180,
  rotation = 0,
  offsetX = 0,
  offsetY = 0,
  delay = 0,
  localFrame,
  exitProgress,
}) => {
  // Entrance spring
  const s = spring({
    frame: Math.max(0, localFrame - delay),
    fps: FPS,
    config: PHOTO_SPRING,
  });

  // Enter: slide up, rotation overshoots then settles
  const enterY = interpolate(s, [0, 1], [60, 0]);
  const enterRotation = interpolate(s, [0, 1], [rotation + 8, rotation]);
  const enterOpacity = interpolate(s, [0, 0.4], [0, 1], {
    extrapolateRight: "clamp",
  });
  const enterScale = interpolate(s, [0, 1], [0.85, 1]);

  // Exit: drift up + fade
  const exitY = interpolate(exitProgress, [0, 1], [0, -40]);
  const exitOpacity = interpolate(exitProgress, [0, 1], [1, 0]);
  const exitScale = interpolate(exitProgress, [0, 1], [1, 0.95]);

  const finalY = enterY + exitY + offsetY;
  const finalOpacity = enterOpacity * exitOpacity;
  const finalScale = enterScale * exitScale;

  // Polaroid frame dimensions
  const borderSide = 6;
  const borderTop = 6;
  const borderBottom = 22;
  const totalWidth = width + borderSide * 2;
  const totalHeight = height + borderTop + borderBottom;

  return (
    <div
      style={{
        position: "absolute",
        transform: `
          translate(${offsetX}px, ${finalY}px)
          rotate(${enterRotation}deg)
          scale(${finalScale})
        `,
        opacity: finalOpacity,
        willChange: "transform, opacity",
      }}
    >
      {/* Polaroid card */}
      <div
        style={{
          width: totalWidth,
          height: totalHeight,
          backgroundColor: "#ffffff",
          borderRadius: 2,
          boxShadow: "0 4px 20px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: borderTop,
          paddingLeft: borderSide,
          paddingRight: borderSide,
          paddingBottom: borderBottom,
        }}
      >
        <Img
          src={staticFile(src)}
          style={{
            width,
            height,
            objectFit: "cover",
            display: "block",
          }}
        />
      </div>

      {/* Reflection */}
      <div
        style={{
          width: totalWidth,
          height: totalHeight * 0.35,
          overflow: "hidden",
          marginTop: 2,
          opacity: 0.15,
          WebkitMaskImage:
            "linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, transparent 100%)",
          maskImage:
            "linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, transparent 100%)",
        }}
      >
        <div
          style={{
            width: totalWidth,
            height: totalHeight,
            backgroundColor: "#ffffff",
            borderRadius: 2,
            transform: "scaleY(-1)",
            transformOrigin: "top center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            paddingTop: borderTop,
            paddingLeft: borderSide,
            paddingRight: borderSide,
          }}
        >
          <Img
            src={staticFile(src)}
            style={{
              width,
              height,
              objectFit: "cover",
              display: "block",
            }}
          />
        </div>
      </div>
    </div>
  );
};
