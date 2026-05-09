import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { font } from "../../common/fonts";

const BG = "#FAFAF7";
const TEXT = "#0e0f0c";
const SEAL_DEEP = "#0050B5";
const SEAL_BRIGHT = "#1E92FF";
const RED = "#DC2626";
const RED_DARK = "#991B1B";

const Seal: React.FC<{ size: number }> = ({ size }) => {
  const r = size / 2;
  const cx = r;
  const cy = r;
  const scallopCount = 36;
  const scallopRadius = size * 0.022;
  const ringR = r - scallopRadius * 1.5;
  const fieldR = ringR - size * 0.062;
  const textR = (ringR + fieldR) / 2;

  const scallops = Array.from({ length: scallopCount }).map((_, i) => {
    const angle = (i / scallopCount) * Math.PI * 2;
    const x = cx + Math.cos(angle) * (r - scallopRadius);
    const y = cy + Math.sin(angle) * (r - scallopRadius);
    return { x, y };
  });

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ display: "block" }}
    >
      <defs>
        <linearGradient id="sealRing" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor={SEAL_BRIGHT} />
          <stop offset="100%" stopColor="#003570" />
        </linearGradient>
        <radialGradient id="sealField" cx="50%" cy="35%" r="68%">
          <stop offset="0%" stopColor="#3E9BFF" />
          <stop offset="100%" stopColor={SEAL_DEEP} />
        </radialGradient>
        <radialGradient id="sealGloss" cx="50%" cy="18%" r="60%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.40)" />
          <stop offset="60%" stopColor="rgba(255,255,255,0.04)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        <filter id="sealShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow
            dx="0"
            dy="18"
            stdDeviation="26"
            floodColor="rgba(0,40,90,0.42)"
          />
        </filter>
        <path
          id="topArc"
          d={`M ${cx - textR},${cy} A ${textR},${textR} 0 0 1 ${
            cx + textR
          },${cy}`}
          fill="none"
        />
      </defs>

      <g filter="url(#sealShadow)">
        {scallops.map((s, i) => (
          <circle
            key={i}
            cx={s.x}
            cy={s.y}
            r={scallopRadius}
            fill="url(#sealRing)"
          />
        ))}
        <circle cx={cx} cy={cy} r={ringR} fill="url(#sealRing)" />
        <circle cx={cx} cy={cy} r={fieldR} fill="url(#sealField)" />
        <circle
          cx={cx}
          cy={cy}
          r={fieldR + size * 0.018}
          fill="none"
          stroke="rgba(255,255,255,0.30)"
          strokeWidth={size * 0.003}
        />
        <circle
          cx={cx}
          cy={cy}
          r={fieldR - size * 0.014}
          fill="none"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth={size * 0.0025}
        />
        <circle cx={cx} cy={cy} r={fieldR} fill="url(#sealGloss)" />
      </g>

      <text
        fontFamily={font}
        fontSize={size * 0.060}
        fontWeight={800}
        fill="#FFFFFF"
        letterSpacing={size * 0.012}
      >
        <textPath href="#topArc" startOffset="50%" textAnchor="middle">
          ANTI-CHEAT
        </textPath>
      </text>
      {/* Star separators at the 9 and 3 o'clock positions */}
      {[0, Math.PI].map((a, i) => {
        const x = cx + Math.cos(a) * textR;
        const y = cy + Math.sin(a) * textR;
        return (
          <text
            key={i}
            x={x}
            y={y + size * 0.012}
            fontSize={size * 0.045}
            fill="#FFFFFF"
            textAnchor="middle"
          >
            ★
          </text>
        );
      })}

      {/* Center: GM bars logo */}
      <g
        transform={`translate(${cx}, ${cy + size * 0.005}) scale(${
          size * 0.0045
        }) translate(-51, -51)`}
      >
        <path
          d="M15.28 49.57c0-.42.14-.78.42-1.06s.63-.42 1.05-.42h11.97c.42 0 .77.14 1.05.42s.42.64.42 1.06v3.03c0 .42-.14.77-.42 1.05s-.63.42-1.05.42H16.75c-.42 0-.77-.14-1.05-.42s-.42-.63-.42-1.05v-3.03Z"
          fill="white"
        />
        <path
          d="M26.62 49.57c0-.42.14-.78.42-1.06s.63-.42 1.05-.42h11.97c.42 0 .77.14 1.05.42s.42.64.42 1.06v3.03c0 .42-.14.77-.42 1.05s-.63.42-1.05.42H28.09c-.42 0-.77-.14-1.05-.42s-.42-.63-.42-1.05v-3.03Z"
          fill="white"
        />
        <path
          d="M37.97 49.57c0-.42.14-.78.42-1.06s.63-.42 1.05-.42h11.97c.42 0 .77.14 1.05.42s.42.64.42 1.06v3.03c0 .42-.14.77-.42 1.05s-.63.42-1.05.42H39.43c-.42 0-.78-.14-1.05-.42s-.42-.63-.42-1.05v-3.03Z"
          fill="white"
        />
        <path
          d="M49.31 49.57c0-.42.14-.78.42-1.06s.63-.42 1.05-.42h11.97c.42 0 .77.14 1.05.42s.42.64.42 1.06v3.03c0 .42-.14.77-.42 1.05s-.63.42-1.05.42H50.78c-.42 0-.78-.14-1.05-.42s-.42-.63-.42-1.05v-3.03Z"
          fill="white"
        />
        <path
          d="M60.65 49.59c0-.42.14-.78.42-1.05s.63-.42 1.05-.42h6.3c.42 0 .77.14 1.05.42s.42.63.42 1.05v3c0 .43-.14.78-.42 1.06s-.63.42-1.05.42H62.12c-.42 0-.77-.14-1.05-.42s-.42-.63-.42-1.06v-3Z"
          fill="white"
        />
        <path
          d="M66.32 49.57c0-.42.14-.78.42-1.06s.63-.42 1.05-.42h11.97c.42 0 .77.14 1.05.42s.42.64.42 1.06v3.03c0 .42-.14.77-.42 1.05s-.63.42-1.05.42H67.79c-.42 0-.77-.14-1.05-.42s-.42-.63-.42-1.05v-3.03Z"
          fill="white"
        />
        <path
          d="M77.67 49.59c0-.42.14-.78.42-1.05s.63-.42 1.05-.42h6.3c.42 0 .77.14 1.05.42s.42.63.42 1.05v3c0 .43-.14.78-.42 1.06s-.63.42-1.05.42h-6.3c-.42 0-.78-.14-1.05-.42s-.42-.63-.42-1.06v-3Z"
          fill="white"
        />
      </g>

      {/* Tiny status mark below the bars */}
      <text
        x={cx}
        y={cy + size * 0.115}
        fontFamily={font}
        fontSize={size * 0.030}
        fontWeight={700}
        fill="rgba(255,255,255,0.75)"
        letterSpacing={size * 0.018}
        textAnchor="middle"
      >
        VERIFIED
      </text>
    </svg>
  );
};

const RejectedRow: React.FC<{ letter: string; label: string; rowH: number }> = ({
  letter,
  label,
  rowH,
}) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 18,
      height: rowH,
    }}
  >
    <div
      style={{
        width: rowH * 0.62,
        height: rowH * 0.62,
        borderRadius: rowH * 0.18,
        background: "#1D1D1F",
        color: "#FFFFFF",
        fontFamily: font,
        fontSize: rowH * 0.34,
        fontWeight: 700,
        letterSpacing: "-0.02em",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {letter}
    </div>
    <div
      style={{
        flex: 1,
        fontFamily: font,
        fontSize: rowH * 0.42,
        fontWeight: 600,
        color: RED_DARK,
        letterSpacing: "-0.018em",
        textDecoration: "line-through",
        textDecorationColor: RED,
        textDecorationThickness: 2.5,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </div>
  </div>
);

export const OgBannerGMSeal: React.FC = () => {
  const SEAL_SIZE = 360;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BG,
        backgroundImage:
          "radial-gradient(circle, rgba(30, 41, 90, 0.10) 1.4px, transparent 1.6px)",
        backgroundSize: "22px 22px",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 60,
          top: 36,
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        <Img
          src={staticFile("gm-logo.svg")}
          style={{ width: 40, height: 40, borderRadius: 8 }}
        />
        <div
          style={{
            fontFamily: font,
            fontSize: 28,
            fontWeight: 700,
            color: TEXT,
            letterSpacing: "-0.018em",
          }}
        >
          General
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 90,
          top: (500 - SEAL_SIZE) / 2 + 14,
        }}
      >
        <Seal size={SEAL_SIZE} />
      </div>

      <div
        style={{
          position: "absolute",
          right: 70,
          top: 110,
          width: 540,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 16,
            fontWeight: 700,
            color: "#6E6E73",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
          }}
        >
          Rejected by the protocol
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <RejectedRow letter="A" label="Insider Traders" rowH={48} />
          <RejectedRow letter="B" label="Front Runners" rowH={48} />
          <RejectedRow letter="C" label="Market Manipulators" rowH={48} />
          <RejectedRow letter="D" label="Orderflow Buyers" rowH={48} />
        </div>
      </div>
    </AbsoluteFill>
  );
};
