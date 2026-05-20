// A 12-frame photo sequence advanced by scroll progress. In Remotion the
// scroll bar becomes the frame counter — same idea, deterministic source.

import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  Img,
} from "remotion";

const BASE = "https://cdn.shopify.com/s/files/1/0767/9177/5541/files/";

// Source preserves the awkward numbering: 01-09 then 010-012.
const FRAMES = [
  `${BASE}Blok_01.jpg`,
  `${BASE}Blok_02.jpg`,
  `${BASE}Blok_03.jpg`,
  `${BASE}Blok_04.jpg`,
  `${BASE}Blok_05.jpg`,
  `${BASE}Blok_06.jpg`,
  `${BASE}Blok_07.jpg`,
  `${BASE}Blok_08.jpg`,
  `${BASE}Blok_09.jpg`,
  `${BASE}Blok_010.jpg`,
  `${BASE}Blok_011.jpg`,
  `${BASE}Blok_012.jpg`,
];

export const LightSwitch: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Scrub through frames over the scene's duration
  const t = Math.min(1, frame / Math.max(1, durationInFrames - 1));
  const idx = Math.min(FRAMES.length - 1, Math.round(t * (FRAMES.length - 1)));

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Source set the inner container to aspect 1.28:1; keep the same */}
      <div
        style={{
          aspectRatio: "1.28 / 1",
          height: "100%",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {FRAMES.map((src, i) => (
          <Img
            key={src}
            src={src}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "contain",
              opacity: i === idx ? 1 : 0,
            }}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
};
