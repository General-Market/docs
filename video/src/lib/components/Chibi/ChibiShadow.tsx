import React from "react";

interface Props {
  width?: number;
  opacity?: number;
  offsetY?: number;
}

/**
 * Ellipse shadow below chibi, blur(8px), syncs with chibi scale
 */
export const ChibiShadow: React.FC<Props> = ({
  width = 200,
  opacity = 0.25,
  offsetY = 10,
}) => {
  return (
    <div
      style={{
        position: "absolute",
        bottom: -offsetY,
        left: "50%",
        transform: "translateX(-50%)",
        width,
        height: width * 0.2,
        borderRadius: "50%",
        backgroundColor: "rgba(0,0,0,0.6)",
        filter: "blur(8px)",
        opacity,
      }}
    />
  );
};
