import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { loadFont } from "@remotion/google-fonts/Montserrat";

const { fontFamily } = loadFont("normal", { subsets: ["latin"], weights: ["700", "900"] });

// Ghost text logos as placeholders — replace with <Img> when logo files are sourced
const LOGOS = [
  { text: "SONY", x: 200, y: 600 },
  { text: "CRUNCHYROLL", x: 400, y: 500 },
  { text: "FANDOM", x: 300, y: 750 },
];

interface Props {
  durationFrames: number;
}

export const GhostLogos: React.FC<Props> = ({ durationFrames }) => {
  const frame = useCurrentFrame();

  // Logos fade in during the hold period (after speech ends ~45 frames in)
  const fadeIn = interpolate(frame, [30, 50], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Fade out before loop point
  const fadeOut = interpolate(
    frame,
    [durationFrames - 15, durationFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const masterOpacity = fadeIn * fadeOut;

  return (
    <>
      {LOGOS.map((logo, i) => {
        const pulse = 0.08 + Math.sin(frame * 0.03 + i * 2.1) * 0.03;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: logo.x,
              top: logo.y,
              color: "rgba(255,255,255,1)",
              fontSize: 36,
              fontWeight: 900,
              fontFamily,
              letterSpacing: 4,
              opacity: pulse * masterOpacity,
              filter: "blur(1px)",
              pointerEvents: "none",
              zIndex: 1,
            }}
          >
            {logo.text}
          </div>
        );
      })}
    </>
  );
};
