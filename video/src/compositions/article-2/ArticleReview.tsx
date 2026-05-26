import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { ArticlePage } from "./ArticlePage";

/** V1 article beat: scrolls through the piece, underlining proofs as it goes. */
export const ArticleReview: React.FC = () => {
  const frame = useCurrentFrame();

  const scroll = interpolate(
    frame,
    [0, 48, 112, 162, 216, 296],
    [0, 0, 300, 300, 490, 490],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.cubic),
    },
  );

  const opacity = Math.min(
    interpolate(frame, [0, 9], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
    interpolate(frame, [270, 296], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
  );

  return (
    <ArticlePage
      scroll={scroll}
      opacity={opacity}
      markTimes={{ precedes: 26, driver: 126, onePct: 226, third: 248 }}
      bottomBlur
      showChrome
    />
  );
};
