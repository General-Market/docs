// Ivan Radović's portfolio header — giant "IR" filled with a purple liquid
// that flows behind the letters, and a small centered title that sits on top.
// The source listened to mousemove and pushed rotation through a Quad.easeOut
// tween. The cursor is gone; the head still turns. A Lissajous loop stands in
// for the missing hand. The dribbble GIF is gone too; a layered set of
// radial blobs slithers behind the letters in its place.

import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export const InitialsRotate: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  // Virtual cursor in [-0.5, 0.5]. Two mutually-prime periods so the path
  // never repeats. The source multiplied by 10 (== ±5° max).
  const decimalX = 0.5 * Math.sin((t * 2 * Math.PI) / 6.7);
  const decimalY = 0.5 * Math.cos((t * 2 * Math.PI) / 8.3);
  const rotateY = 10 * decimalX;
  const rotateX = 10 * decimalY;

  // Stand-in for the dribbble GIF — five purple blobs drifting behind the
  // text, blended together. Each has its own slow path so the surface
  // inside the letters keeps shifting.
  const blob = (
    period: number,
    phase: number,
    ax: number,
    ay: number,
    cx: number,
    cy: number,
  ) => ({
    x: cx + ax * Math.sin((t * 2 * Math.PI) / period + phase),
    y: cy + ay * Math.cos((t * 2 * Math.PI) / (period * 1.3) + phase),
  });

  const b1 = blob(5.1, 0.0, 20, 14, 35, 45);
  const b2 = blob(6.4, 1.2, 18, 22, 65, 55);
  const b3 = blob(7.7, 2.4, 24, 18, 50, 35);
  const b4 = blob(4.8, 3.6, 16, 20, 30, 70);
  const b5 = blob(8.1, 4.8, 22, 14, 70, 30);

  // Layered radial blobs in the purppple01.gif palette. The 4-component
  // `radial-gradient`s overlap on a deep-violet base. background-clip:text
  // hands the whole assembly to the letterforms.
  const gradient = [
    `radial-gradient(circle 460px at ${b1.x}% ${b1.y}%, #c490ff 0%, transparent 55%)`,
    `radial-gradient(circle 380px at ${b2.x}% ${b2.y}%, #ff6fc6 0%, transparent 50%)`,
    `radial-gradient(circle 520px at ${b3.x}% ${b3.y}%, #6c2fd4 0%, transparent 55%)`,
    `radial-gradient(circle 360px at ${b4.x}% ${b4.y}%, #2d0a7c 0%, transparent 55%)`,
    `radial-gradient(circle 440px at ${b5.x}% ${b5.y}%, #b35eff 0%, transparent 55%)`,
    `linear-gradient(135deg, #44149c 0%, #7e3ff2 50%, #2d0a7c 100%)`,
  ].join(", ");

  // The source scales the IR to 85vh. On 1080-tall video, that's 918px.
  const initialsSize = Math.round(1080 * 0.85);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#f4f4f4",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "'Poppins', 'Inter', sans-serif",
      }}
    >
      <div
        style={{
          position: "relative",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          perspective: "700px",
        }}
      >
        <h1
          style={{
            margin: 0,
            padding: 0,
            fontFamily: "'Poppins', 'Inter', sans-serif",
            fontSize: `${initialsSize}px`,
            lineHeight: "1em",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            backgroundImage: gradient,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            WebkitTextFillColor: "transparent",
            color: "transparent",
            transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
            transformOrigin: "center",
            userSelect: "none",
          }}
        >
          IR
        </h1>

        {/* Title overlay — sits centered over the IR, same sizes as the
            source (h2 = 48px, p = 14px). */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            textAlign: "center",
            color: "#44149c",
            pointerEvents: "none",
            zIndex: 2,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 48,
              fontWeight: 600,
              letterSpacing: "1.2px",
              color: "#44149c",
              fontFamily: "'Poppins', 'Inter', sans-serif",
              marginBottom: 0,
            }}
          >
            Ivan Radović
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              color: "#44149c",
              textTransform: "uppercase",
              letterSpacing: "0.7px",
              fontFamily: "'Poppins', 'Inter', sans-serif",
              fontWeight: 500,
            }}
          >
            Animator &amp; Motion Designer
          </p>
        </div>
      </div>
    </AbsoluteFill>
  );
};
