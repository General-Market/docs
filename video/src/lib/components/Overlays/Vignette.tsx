import React from "react";

interface Props {
  opacity?: number;
  spread?: number; // % of transparent center
}

export const Vignette: React.FC<Props> = ({
  opacity = 0.4,
  spread = 50,
}) => {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: `radial-gradient(ellipse at center, transparent ${spread}%, rgba(0,0,0,${opacity}) 100%)`,
        pointerEvents: "none",
        zIndex: 15,
      }}
    />
  );
};
