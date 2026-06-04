import React from "react";
import { C, FONT_UI } from "./theme";

const GemIcon: React.FC<{ size?: number; color: string }> = ({
  size = 26,
  color,
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path
      d="M5 4h14l3 5-10 11L2 9l3-5z"
      fill={color}
    />
    <path
      d="M2 9h20M8 4l-2 5 6 11M16 4l2 5-6 11"
      stroke={C.green}
      strokeWidth={1.1}
      strokeLinejoin="round"
      opacity={0.45}
    />
  </svg>
);

const SearchIcon: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth={2} />
    <path
      d="M16.5 16.5L21 21"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
    />
  </svg>
);

export const BottomBar: React.FC = () => (
  <div
    style={{
      display: "flex",
      gap: 16,
      padding: "16px 30px 40px",
      alignItems: "center",
    }}
  >
    <div
      style={{
        flex: 1.5,
        height: 80,
        borderRadius: 20,
        background: C.green,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        color: C.bg,
        fontFamily: FONT_UI,
        fontSize: 32,
        fontWeight: 700,
      }}
    >
      <GemIcon size={26} color={C.bg} />
      Buy
    </div>
    <div
      style={{
        flex: 1,
        height: 80,
        borderRadius: 20,
        background: "#11151c",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        color: C.textMute,
        fontFamily: FONT_UI,
        fontSize: 30,
        fontWeight: 500,
      }}
    >
      <SearchIcon size={24} />
      Search
    </div>
  </div>
);
