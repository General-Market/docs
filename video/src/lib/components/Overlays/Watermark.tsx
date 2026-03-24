import React from "react";

interface Props {
  text: string;
  fontSize?: number;
  opacity?: number;
}

export const Watermark: React.FC<Props> = ({
  text,
  fontSize = 20,
  opacity = 0.15,
}) => {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 80,
        right: 50,
        fontFamily: "IBM Plex Sans, sans-serif",
        fontSize,
        fontWeight: 500,
        color: "white",
        opacity,
        zIndex: 18,
        pointerEvents: "none",
        textShadow: "0 1px 3px rgba(0,0,0,0.5)",
      }}
    >
      {text}
    </div>
  );
};
