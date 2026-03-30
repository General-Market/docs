/**
 * Phone3D — Clean CSS phone mockup with 3D tilt via CSS perspective.
 *
 * NO Three.js. NO ExtrudeGeometry. Just a clean rounded rect with
 * border, Dynamic Island, and screen content — all in the SAME
 * CSS transform space so screen always tilts with the case.
 *
 * Usage:
 *   <Phone3D
 *     rotateX={0} rotateY={-0.15} rotateZ={0}
 *     scale={1}
 *     screenContent={<MyAppUI />}
 *   />
 */

import React from "react";

export const Phone3D: React.FC<{
  rotateX?: number;
  rotateY?: number;
  rotateZ?: number;
  scale?: number;
  screenContent?: React.ReactNode;
  opacity?: number;
  style?: React.CSSProperties;
  /** Phone frame width in px */
  width?: number;
  /** Phone frame height in px */
  height?: number;
}> = ({
  rotateX = 0,
  rotateY = 0,
  rotateZ = 0,
  scale = 1,
  screenContent,
  opacity = 1,
  style,
  width = 280,
  height = 580,
}) => {
  const rx = typeof rotateX === "number" ? rotateX * (180 / Math.PI) : 0;
  const ry = typeof rotateY === "number" ? rotateY * (180 / Math.PI) : 0;
  const rz = typeof rotateZ === "number" ? rotateZ * (180 / Math.PI) : 0;

  return (
    <div
      style={{
        width,
        height,
        perspective: 800,
        opacity,
        ...style,
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: Math.round(width * 0.13),
          background: "#1a1a1c",
          border: "3px solid #d0d0d4",
          boxShadow:
            "0 20px 60px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.08) inset",
          overflow: "hidden",
          position: "relative",
          transform: `rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${scale})`,
          transformStyle: "preserve-3d",
          transformOrigin: "center center",
        }}
      >
        {/* Dynamic Island */}
        <div
          style={{
            position: "absolute",
            top: Math.round(height * 0.018),
            left: "50%",
            transform: "translateX(-50%)",
            width: Math.round(width * 0.32),
            height: Math.round(width * 0.085),
            borderRadius: Math.round(width * 0.05),
            background: "#000",
            zIndex: 10,
          }}
        />

        {/* Screen content — same div, same transform, always synced */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderRadius: Math.round(width * 0.12),
            overflow: "hidden",
            background: "#fff",
          }}
        >
          {screenContent}
        </div>
      </div>
    </div>
  );
};

export default Phone3D;
