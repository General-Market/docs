import React from "react";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";

const { fontFamily: inter } = loadInter();

type Props = {
  size?: number;
  label?: string;
};

// Simple round coin with "$1" label. Used beside grids in Beat 2.
export const Coin: React.FC<Props> = ({ size = 72, label = "$1" }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: "50%",
      background: `radial-gradient(circle at 30% 30%, #FFF6B8 0%, #E6B82E 55%, #8B6508 100%)`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: `0 4px 24px rgba(230, 184, 46, 0.35), inset 0 -4px 8px rgba(0,0,0,0.25)`,
      border: "2px solid #B8860B",
      fontFamily: inter,
      fontSize: size * 0.42,
      fontWeight: 800,
      color: "#3B2A00",
      letterSpacing: -0.5,
    }}
  >
    {label}
  </div>
);
