import React from "react";
import { Img, staticFile } from "remotion";
import { ChibiTalking } from "../../lib/components/Chibi";

/**
 * Test composition: chibi on blue background with "talking" animation.
 * Uses the reusable ChibiTalking wrapper from lib.
 */
export const TestChibi: React.FC = () => {
  return (
    <div
      style={{
        width: 1080,
        height: 1920,
        backgroundColor: "#1a3a6b",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Subtle radial glow */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at 50% 60%, rgba(40,100,200,0.3) 0%, transparent 70%)",
        }}
      />

      {/* Chibi with talking animation */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 700,
          transform: "translateX(-50%)",
          width: 600,
          height: 600,
        }}
      >
        <ChibiTalking>
          <Img
            src={staticFile("test-chibi/chibi.png")}
            style={{ width: 600, height: "auto", objectFit: "contain" }}
          />
        </ChibiTalking>
      </div>
    </div>
  );
};

export const testChibiMeta = {
  id: "TestChibi",
  fps: 30,
  width: 1080,
  height: 1920,
  durationInFrames: 105,
};
