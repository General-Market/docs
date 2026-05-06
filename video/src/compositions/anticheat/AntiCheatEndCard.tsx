import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { font } from "../../common/fonts";
import { FPS, H, W, colors, toFrames } from "./theme";

const SCENE_SECONDS = 3.0;
const SUBLINE_AT = toFrames(0.7);
const TERTIARY_AT = toFrames(1.2);

// The endcard inverts. Solid Base blue field, white wordmark.
// A light dot grid laid over blue gives the same texture vocabulary as
// the rest of the film, but the relationship is flipped.

export const AntiCheatEndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const wordmarkOpacity = interpolate(
    frame,
    [0, toFrames(0.18)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const wordmarkY = interpolate(
    frame,
    [0, toFrames(0.18)],
    [14, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const punch = spring({
    frame: frame - toFrames(0.05),
    fps,
    config: { damping: 9, stiffness: 220, mass: 0.55 },
  });
  const wordmarkPunch =
    1 + Math.sin(Math.min(1, Math.max(0, punch)) * Math.PI) * 0.06;

  const underlineT = interpolate(
    frame,
    [toFrames(0.4), toFrames(1.1)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const sublineLocal = frame - SUBLINE_AT;
  const sublineOpacity = interpolate(
    sublineLocal,
    [0, toFrames(0.18)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const sublineY = interpolate(
    sublineLocal,
    [0, toFrames(0.18)],
    [14, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const tertiaryLocal = frame - TERTIARY_AT;
  const tertiaryOpacity = interpolate(
    tertiaryLocal,
    [0, toFrames(0.18)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const tertiaryY = interpolate(
    tertiaryLocal,
    [0, toFrames(0.18)],
    [14, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.accent,
        fontFamily: font,
        justifyContent: "center",
        alignItems: "center",
        padding: "0 96px",
      }}
    >
      <WhiteDotGrid />
      <div
        style={{
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          position: "relative",
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 340,
            fontWeight: 800,
            letterSpacing: "-0.05em",
            color: "#FFFFFF",
            lineHeight: 0.95,
            opacity: wordmarkOpacity,
            transform: `translateY(${wordmarkY}px) scale(${wordmarkPunch})`,
            transformOrigin: "center",
            display: "flex",
            alignItems: "center",
            gap: 44,
          }}
        >
          <GeneralMark size={300} />
          <span>General</span>
        </div>

        <div
          style={{
            position: "relative",
            width: 720,
            height: 2,
            marginTop: 28,
            marginBottom: 36,
            background: "rgba(255,255,255,0.20)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              bottom: 0,
              width: `${underlineT * 100}%`,
              background:
                "linear-gradient(90deg, rgba(255,255,255,0) 0%, #FFFFFF 50%, rgba(255,255,255,0) 100%)",
            }}
          />
        </div>

        <div
          style={{
            fontFamily: font,
            fontSize: 78,
            fontWeight: 700,
            letterSpacing: "-0.025em",
            color: "#FFFFFF",
            lineHeight: 1.1,
            opacity: sublineOpacity,
            transform: `translateY(${sublineY}px)`,
          }}
        >
          Trading is easy with an Anti-Cheat
        </div>

        <div
          style={{
            marginTop: 40,
            display: "inline-flex",
            alignItems: "center",
            gap: 14,
            padding: "16px 28px",
            border: "1px solid rgba(255,255,255,0.25)",
            borderRadius: 999,
            background: "rgba(255,255,255,0.08)",
            opacity: tertiaryOpacity,
            transform: `translateY(${tertiaryY}px)`,
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              background: "#FFFFFF",
              boxShadow: "0 0 10px rgba(255,255,255,0.6)",
            }}
          />
          <span
            style={{
              fontFamily: font,
              fontSize: 40,
              fontWeight: 600,
              letterSpacing: "-0.005em",
              color: "#FFFFFF",
            }}
          >
            Available only via trading bots
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── General mark — white square with the canonical horizontal bar band ─────
//
// Same geometry as the General Market wordmark logo (gmTheme.tsx). The square
// is white; the seven inner bars are filled with the endcard background, so
// they read as a horizontal cut through the square — the brand mark.

const GeneralMark: React.FC<{ size: number }> = ({ size }) => {
  const cutout = colors.accent;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 102 102"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0 }}
    >
      <path d="M0 0H102V102H0V0Z" fill="#FFFFFF" />
      <path
        d="M15.2794 49.5703C15.2794 49.1458 15.4181 48.7941 15.6956 48.5155C15.9731 48.2369 16.3233 48.0976 16.7462 48.0976H28.7186C29.1414 48.0976 29.4916 48.2369 29.7691 48.5155C30.0466 48.7941 30.1854 49.1458 30.1854 49.5703V52.5955C30.1854 53.0201 30.0466 53.3717 29.7691 53.6503C29.4916 53.929 29.1414 54.0683 28.7186 54.0683H16.7462C16.3233 54.0683 15.9731 53.929 15.6956 53.6503C15.4181 53.3717 15.2794 53.0201 15.2794 52.5955V49.5703Z"
        fill={cutout}
      />
      <path
        d="M26.6227 49.5703C26.6227 49.1458 26.7615 48.7941 27.039 48.5155C27.3165 48.2369 27.6667 48.0976 28.0895 48.0976H40.0619C40.4848 48.0976 40.835 48.2369 41.1125 48.5155C41.39 48.7941 41.5288 49.1458 41.5288 49.5703V52.5955C41.5288 53.0201 41.39 53.3717 41.1125 53.6503C40.835 53.929 40.4848 54.0683 40.0619 54.0683H28.0895C27.6667 54.0683 27.3165 53.929 27.039 53.6503C26.7615 53.3717 26.6227 53.0201 26.6227 52.5955V49.5703Z"
        fill={cutout}
      />
      <path
        d="M37.9661 49.5703C37.9661 49.1458 38.1048 48.7941 38.3824 48.5155C38.6599 48.2369 39.01 48.0976 39.4329 48.0976H51.4053C51.8282 48.0976 52.1784 48.2369 52.4559 48.5155C52.7334 48.7941 52.8721 49.1458 52.8721 49.5703V52.5955C52.8721 53.0201 52.7334 53.3717 52.4559 53.6503C52.1784 53.929 51.8282 54.0683 51.4053 54.0683H39.4329C39.01 54.0683 38.6599 53.929 38.3824 53.6503C38.1048 53.3717 37.9661 53.0201 37.9661 52.5955V49.5703Z"
        fill={cutout}
      />
      <path
        d="M49.3095 49.5703C49.3095 49.1458 49.4482 48.7941 49.7257 48.5155C50.0032 48.2369 50.3534 48.0976 50.7763 48.0976H62.7487C63.1716 48.0976 63.5217 48.2369 63.7992 48.5155C64.0768 48.7941 64.2155 49.1458 64.2155 49.5703V52.5955C64.2155 53.0201 64.0768 53.3717 63.7992 53.6503C63.5217 53.929 63.1716 54.0683 62.7487 54.0683H50.7763C50.3534 54.0683 50.0032 53.929 49.7257 53.6503C49.4482 53.3717 49.3095 53.0201 49.3095 52.5955V49.5703Z"
        fill={cutout}
      />
      <path
        d="M60.6528 49.5902C60.6528 49.1657 60.7916 48.814 61.0691 48.5354C61.3466 48.2568 61.6968 48.1175 62.1197 48.1175H68.423C68.8459 48.1175 69.1961 48.2568 69.4736 48.5354C69.7511 48.814 69.8898 49.1657 69.8898 49.5902V52.5955C69.8898 53.0201 69.7511 53.3717 69.4736 53.6503C69.1961 53.929 68.8459 54.0683 68.423 54.0683H62.1197C61.6968 54.0683 61.3466 53.929 61.0691 53.6503C60.7916 53.3717 60.6528 53.0201 60.6528 52.5955V49.5902Z"
        fill={cutout}
      />
      <path
        d="M66.3245 49.5703C66.3245 49.1458 66.4633 48.7941 66.7408 48.5155C67.0183 48.2369 67.3685 48.0976 67.7913 48.0976H79.7637C80.1866 48.0976 80.5368 48.2369 80.8143 48.5155C81.0918 48.7941 81.2306 49.1458 81.2306 49.5703V52.5955C81.2306 53.0201 81.0918 53.3717 80.8143 53.6503C80.5368 53.929 80.1866 54.0683 79.7637 54.0683H67.7913C67.3685 54.0683 67.0183 53.929 66.7408 53.6503C66.4633 53.3717 66.3245 53.0201 66.3245 52.5955V49.5703Z"
        fill={cutout}
      />
      <path
        d="M77.6679 49.5902C77.6679 49.1657 77.8066 48.814 78.0841 48.5354C78.3617 48.2568 78.7118 48.1175 79.1347 48.1175H85.4381C85.8609 48.1175 86.2111 48.2568 86.4886 48.5354C86.7661 48.814 86.9049 49.1657 86.9049 49.5902V52.5955C86.9049 53.0201 86.7661 53.3717 86.4886 53.6503C86.2111 53.929 85.8609 54.0683 85.4381 54.0683H79.1347C78.7118 54.0683 78.3617 53.929 78.0841 53.6503C77.8066 53.3717 77.6679 53.0201 77.6679 52.5955V49.5902Z"
        fill={cutout}
      />
    </svg>
  );
};

// ─── White dot grid for the inverted endcard ─────────────────────────────────
//
// Same two-layer recipe as DotGrid, but in white over the blue field. Inlined
// here because the fill color is the only difference.

const FINE_SPACING = 14;
const FINE_RADIUS = 1.6;
const FINE_ALPHA = 0.22;

type Band = {
  y: number;
  len: number;
  anchor: number;
  spacing: number;
  radius: number;
  alpha: number;
  velocity: number;
  phase: number;
};

const BANDS: Band[] = [
  { y: 0.045, len: 0.62, anchor: 0.30, spacing: 7, radius: 2.4, alpha: 0.95, velocity: 380, phase: 0.00 },
  { y: 0.062, len: 0.58, anchor: 0.46, spacing: 6, radius: 2.4, alpha: 0.95, velocity: 540, phase: 0.30 },
  { y: 0.078, len: 0.42, anchor: 0.22, spacing: 7, radius: 2.4, alpha: 0.92, velocity: 320, phase: 0.55 },
  { y: 0.85, len: 0.58, anchor: 0.62, spacing: 7, radius: 2.4, alpha: 0.95, velocity: 360, phase: 0.05 },
  { y: 0.867, len: 0.62, anchor: 0.42, spacing: 6, radius: 2.4, alpha: 0.95, velocity: 500, phase: 0.35 },
  { y: 0.884, len: 0.46, anchor: 0.74, spacing: 7, radius: 2.4, alpha: 0.92, velocity: 280, phase: 0.60 },
];

const FADE_FRACTION = 0.18;
const WHITE = "#FFFFFF";

const WhiteDotGrid: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const cycleW = W * 1.6;

  const fineCols = Math.ceil(W / FINE_SPACING) + 2;
  const fineRows = Math.ceil(H / FINE_SPACING) + 2;

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
      }}
    >
      <g opacity={FINE_ALPHA}>
        {Array.from({ length: fineRows }).map((_, ry) => {
          const y = ry * FINE_SPACING - FINE_SPACING / 2;
          return (
            <g key={`r${ry}`}>
              {Array.from({ length: fineCols }).map((_, rx) => {
                const x = rx * FINE_SPACING - FINE_SPACING / 2;
                return (
                  <circle
                    key={`r${ry}c${rx}`}
                    cx={x}
                    cy={y}
                    r={FINE_RADIUS}
                    fill={WHITE}
                  />
                );
              })}
            </g>
          );
        })}
      </g>

      <g>
        {BANDS.map((band, bi) => {
          const yPx = band.y * H;
          const lenPx = band.len * W;
          const halfLen = lenPx / 2;
          const drift = band.velocity * t;
          const phasePx = band.phase * cycleW;
          const wrappedMid =
            ((band.anchor * W + drift + phasePx) % cycleW + cycleW) % cycleW
            - cycleW * 0.3;
          const x0Px = wrappedMid - halfLen;
          const x1Px = wrappedMid + halfLen;
          if (x1Px < -20 || x0Px > W + 20) return null;

          const fadePx = lenPx * FADE_FRACTION;
          const count = Math.max(2, Math.floor(lenPx / band.spacing));

          return (
            <g key={`b${bi}`}>
              {Array.from({ length: count }).map((_, di) => {
                const x = x0Px + di * band.spacing;
                if (x < -10 || x > W + 10) return null;

                const fromStart = x - x0Px;
                const fromEnd = x1Px - x;
                let alphaScale = 1;
                if (fromStart < fadePx) alphaScale *= fromStart / fadePx;
                if (fromEnd < fadePx) alphaScale *= fromEnd / fadePx;
                alphaScale = Math.max(0, Math.min(1, alphaScale));

                return (
                  <circle
                    key={`d${di}`}
                    cx={x}
                    cy={yPx}
                    r={band.radius}
                    fill={WHITE}
                    opacity={band.alpha * alphaScale}
                  />
                );
              })}
            </g>
          );
        })}
      </g>
    </svg>
  );
};

export const antiCheatEndCardMeta = {
  id: "AntiCheatEndCard",
  component: AntiCheatEndCard,
  durationInFrames: toFrames(SCENE_SECONDS),
  fps: FPS,
  width: W,
  height: H,
};
