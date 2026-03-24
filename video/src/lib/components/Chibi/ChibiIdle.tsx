import React from "react";
import { useCurrentFrame } from "remotion";
import { noise2D } from "@remotion/noise";

interface Props {
  children: React.ReactNode;
}

/**
 * Idle animation: breathing (scaleY ±0.015, 90f cycle),
 * bounce (Y ±6px, 60f cycle), sway (noise ±1.5deg)
 */
export const ChibiIdle: React.FC<Props> = ({ children }) => {
  const frame = useCurrentFrame();

  // Breathing
  const breathe = 1 + Math.sin((frame / 90) * Math.PI * 2) * 0.015;

  // Bounce
  const bounceY = Math.sin((frame / 60) * Math.PI * 2) * -6;

  // Sway
  const sway = noise2D("chibi-sway", frame * 0.015, 0) * 1.5;

  return (
    <div
      style={{
        transform: `translateY(${bounceY}px) scaleY(${breathe}) rotate(${sway}deg)`,
        transformOrigin: "center bottom",
      }}
    >
      {children}
    </div>
  );
};
