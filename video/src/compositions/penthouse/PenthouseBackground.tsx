import React from "react";
import { useCurrentFrame, interpolate, Img, staticFile } from "remotion";

interface Props {
  width: number;
  height: number;
}

export const PenthouseBackground: React.FC<Props> = ({ width, height }) => {
  const frame = useCurrentFrame();

  // Fade in
  const opacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Ken Burns: gentle zoom
  const scale = interpolate(frame, [0, 600], [1.0, 1.03], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width,
        height,
        overflow: "hidden",
        opacity,
      }}
    >
      {/* Photo background — NYC skyline through penthouse windows */}
      <Img
        src={staticFile("compositions/penthouse/bg.jpg")}
        style={{
          width: width * 1.1,
          height: height * 1.1,
          objectFit: "cover",
          objectPosition: "center top",
          transform: `scale(${scale})`,
          transformOrigin: "center 30%",
          filter: "brightness(0.35) saturate(0.8) contrast(1.1)",
          position: "absolute",
          top: "-5%",
          left: "-5%",
        }}
      />

      {/* Window frame overlay — simulate floor-to-ceiling windows */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "45%",
          background:
            "linear-gradient(180deg, rgba(15,20,35,0.2) 0%, rgba(15,20,35,0.4) 70%, rgba(5,5,8,0.7) 100%)",
        }}
      />

      {/* Warm ambient glow from city lights */}
      <div
        style={{
          position: "absolute",
          top: "10%",
          left: "5%",
          width: "90%",
          height: "30%",
          background:
            "radial-gradient(ellipse at 50% 50%, rgba(255,180,80,0.06) 0%, transparent 70%)",
          filter: "blur(30px)",
        }}
      />

      {/* Dark overlay for lower portion (desk area) */}
      <div
        style={{
          position: "absolute",
          top: "35%",
          left: 0,
          width: "100%",
          height: "65%",
          background:
            "linear-gradient(180deg, transparent 0%, rgba(5,5,8,0.6) 20%, rgba(5,5,8,0.85) 50%, rgba(5,5,8,0.95) 100%)",
        }}
      />

      {/* Bottom gradient (chibi/desk grounding) */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: "100%",
          height: 400,
          background:
            "linear-gradient(0deg, rgba(5,5,8,0.98) 0%, rgba(5,5,8,0.9) 40%, transparent 100%)",
        }}
      />

      {/* Edge vignette */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          boxShadow: "inset 0 0 200px 60px rgba(5,5,8,0.8)",
        }}
      />

      {/* Monitor glow — blue/purple ambient light reflecting from screens */}
      <div
        style={{
          position: "absolute",
          top: "40%",
          left: "5%",
          width: "90%",
          height: "35%",
          background:
            "radial-gradient(ellipse at 50% 30%, rgba(59,130,246,0.05) 0%, transparent 60%)",
          filter: "blur(50px)",
        }}
      />

      {/* Warm desk lamp glow (left side) */}
      <div
        style={{
          position: "absolute",
          top: "55%",
          left: "-5%",
          width: "40%",
          height: "30%",
          background:
            "radial-gradient(ellipse at center, rgba(255,160,60,0.04) 0%, transparent 70%)",
          filter: "blur(30px)",
        }}
      />

      {/* Warm desk lamp glow (right side) */}
      <div
        style={{
          position: "absolute",
          top: "55%",
          right: "-5%",
          width: "40%",
          height: "30%",
          background:
            "radial-gradient(ellipse at center, rgba(255,160,60,0.04) 0%, transparent 70%)",
          filter: "blur(30px)",
        }}
      />
    </div>
  );
};
