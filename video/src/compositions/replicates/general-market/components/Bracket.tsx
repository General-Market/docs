import React from "react";
import { THEME } from "../theme";

type Props = {
  width: number;
  height: number;
  color?: string;
  strokeWidth?: number;
};

// A horizontal curly brace that opens upward.
// Two arms curve up toward (0,0) and (width,0);
// the notch points down to (width/2, height).
export const Bracket: React.FC<Props> = ({
  width,
  height,
  color = THEME.text,
  strokeWidth = 4,
}) => {
  const w = Math.max(width, 2);
  const h = height;
  const midX = w / 2;
  const midY = h * 0.5;
  const cornerR = Math.min(24, w * 0.12);

  const d = [
    `M 0 0`,
    `Q 0 ${midY}, ${cornerR} ${midY}`,
    `L ${midX - cornerR} ${midY}`,
    `Q ${midX} ${midY}, ${midX} ${h}`,
    `Q ${midX} ${midY}, ${midX + cornerR} ${midY}`,
    `L ${w - cornerR} ${midY}`,
    `Q ${w} ${midY}, ${w} 0`,
  ].join(" ");

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      style={{ overflow: "visible" }}
    >
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};
