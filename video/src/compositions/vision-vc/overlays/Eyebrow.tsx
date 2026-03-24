/**
 * Eyebrow — colored dot + uppercase label.
 * Matches the visual language from visuals.html.
 */
import React from "react";
import { FONT } from "../tokens";

interface EyebrowProps {
  color: string;
  text: string;
  opacity?: number;
}

export const Eyebrow: React.FC<EyebrowProps> = ({ color, text, opacity = 1 }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 10,
      opacity,
    }}
  >
    <div
      style={{
        width: 7,
        height: 7,
        borderRadius: "50%",
        backgroundColor: color,
      }}
    />
    <span
      style={{
        fontFamily: FONT.sans,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.1em",
        textTransform: "uppercase" as const,
        color: "#999",
      }}
    >
      {text}
    </span>
  </div>
);
