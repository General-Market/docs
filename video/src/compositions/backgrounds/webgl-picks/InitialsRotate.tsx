// Ivan Radović's portfolio header — giant "IR" filled with a purple gradient,
// nudged in 3D by the cursor. The source listened to mousemove and pushed
// rotation through a Quad.easeOut tween. The cursor is gone; the head still
// turns. A Lissajous loop stands in for the missing hand.

import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export const InitialsRotate: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps; // seconds

  // Lissajous-style virtual cursor in [-0.4, 0.4]. Periods are mutually prime
  // so the path never repeats exactly inside the scene.
  const decimalX = 0.4 * Math.sin((t * 2 * Math.PI) / 6);
  const decimalY = 0.4 * Math.cos((t * 2 * Math.PI) / 8);
  const rotateY = 10 * decimalX;
  const rotateX = 10 * decimalY;

  // Slowly drift the conic gradient's origin + sweep angle so the purple
  // surface inside the "IR" keeps moving — a stand-in for the original
  // dribbble GIF that pulsed behind the text.
  const sweep = (t * 360) / 10; // one full rotation per 10s
  const gx = 50 + 15 * Math.sin((t * 2 * Math.PI) / 7);
  const gy = 50 + 15 * Math.cos((t * 2 * Math.PI) / 9);

  const fontSize = Math.round(1080 * 0.85); // 918px

  const gradient = `conic-gradient(from ${sweep}deg at ${gx}% ${gy}%, #44149c, #7e3ff2, #b35eff, #ff66c4, #3f1d80, #44149c)`;

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
        }}
      >
        <h1
          style={{
            margin: 0,
            padding: 0,
            fontFamily: "'Poppins', 'Inter', sans-serif",
            fontSize: `${fontSize}px`,
            lineHeight: "1em",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            backgroundImage: gradient,
            backgroundSize: "cover",
            backgroundClip: "text",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            color: "transparent",
            transform: `perspective(700px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
            transformStyle: "preserve-3d",
            userSelect: "none",
          }}
        >
          IR
        </h1>

        {/* Title overlay — sits centered on top of the IR */}
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
              fontSize: 96,
              fontWeight: 600,
              letterSpacing: "0.024em",
              color: "#44149c",
              fontFamily: "'Poppins', 'Inter', sans-serif",
            }}
          >
            Ivan Radović
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: 28,
              color: "#44149c",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
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
