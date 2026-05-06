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
import { ParallaxText } from "./transitions";
import { IdleZoom, RevealChars } from "./vibe";

const SCENE_SECONDS = 3.0;
const SUBLINE_AT = toFrames(0.7);
const TERTIARY_AT = toFrames(1.2);
const SCENE_FRAMES = toFrames(SCENE_SECONDS);

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
      }}
    >
      <IdleZoom durationInFrames={SCENE_FRAMES} from={1} to={1.018}>
      <AbsoluteFill
        style={{
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
        <ParallaxText origin="center">
          <div
            style={{
              fontFamily: font,
              fontSize: 220,
              fontWeight: 800,
              letterSpacing: "-0.05em",
              color: "#FFFFFF",
              lineHeight: 0.95,
              opacity: wordmarkOpacity,
              transform: `translateY(${wordmarkY}px) scale(${wordmarkPunch})`,
              transformOrigin: "center",
              display: "flex",
              alignItems: "center",
              gap: 30,
            }}
          >
            <GeneralMark size={200} />
            <span>General</span>
          </div>
        </ParallaxText>

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
          <RevealChars
            text="Trading is easy with an Anti-Cheat"
            startFrame={SUBLINE_AT}
            stagger={0.55}
            duration={9}
            y={14}
            blur={3}
            scale={0.97}
          />
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
      </IdleZoom>
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

// One shock event at scene start. Five concentric rings spawned in quick
// succession — a single impact, not a continuous loop. Each ring expands
// outward, brightens dots it passes through, and fades as it travels. After
// the rings die past the canvas edge, the field returns to the baseline
// dot grid for the rest of the scene.

const FINE_SPACING = 14;
const FINE_RADIUS = 1.6;
const FINE_ALPHA_BASE = 0.18;
const FINE_ALPHA_PEAK = 1.0;
const WHITE = "#FFFFFF";

const SHOCK_RING_COUNT = 5;          // number of concentric rings in the shock
const SHOCK_RING_SPACING_SEC = 0.10; // delay between successive ring spawns
const SHOCK_SPEED_PX = 1100;         // outward speed (faster than continuous)
const SHOCK_THICKNESS_PX = 80;       // width of each bright ring
const SHOCK_LIFETIME_SEC = 1.6;      // how long an individual ring stays alive
const SHOCK_START_SEC = 0.05;        // tiny delay so the shock lands with the punch
const SHOCK_INITIAL_RADIUS_PX = 130; // rings birth at the logo perimeter, not at a point

// The shock emanates from the General mark, which the layout puts to the
// left of canvas center (the wordmark text "General" extends to the right
// of the mark, so the centered row places the mark in the left half) and
// slightly above center (the centered content block has subline + tertiary
// pill below the wordmark row).
// Tuned for a 1920x1080 canvas with size=200 mark, 30px gap, 220pt wordmark.
const SHOCK_CX_FRAC = 0.29;
const SHOCK_CY_FRAC = 0.38;

type WaveFront = {
  radius: number;
  intensity: number;
};

const computeShockWaves = (timeSec: number): WaveFront[] => {
  const waves: WaveFront[] = [];
  for (let i = 0; i < SHOCK_RING_COUNT; i++) {
    const spawnAt = SHOCK_START_SEC + i * SHOCK_RING_SPACING_SEC;
    const age = timeSec - spawnAt;
    if (age < 0 || age > SHOCK_LIFETIME_SEC) continue;
    const lifeT = age / SHOCK_LIFETIME_SEC;
    // Bell curve over the ring's life: sharp ramp in, slow fade.
    const intensity =
      lifeT < 0.15
        ? lifeT / 0.15
        : Math.pow(1 - (lifeT - 0.15) / 0.85, 1.4);
    waves.push({
      radius: SHOCK_INITIAL_RADIUS_PX + age * SHOCK_SPEED_PX,
      intensity,
    });
  }
  return waves;
};

const WhiteDotGrid: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;

  const cx = W * SHOCK_CX_FRAC;
  const cy = H * SHOCK_CY_FRAC;

  const waves = computeShockWaves(t);

  const cols = Math.ceil(W / FINE_SPACING) + 2;
  const rows = Math.ceil(H / FINE_SPACING) + 2;

  const baseDots: React.ReactNode[] = [];
  const boostDots: React.ReactNode[] = [];

  for (let ry = 0; ry < rows; ry++) {
    const y = ry * FINE_SPACING - FINE_SPACING / 2;
    for (let rx = 0; rx < cols; rx++) {
      const x = rx * FINE_SPACING - FINE_SPACING / 2;
      const baseAlpha = FINE_ALPHA_BASE;
      const k = `${ry},${rx}`;

      baseDots.push(
        <circle
          key={`b${k}`}
          cx={x}
          cy={y}
          r={FINE_RADIUS}
          fill={WHITE}
          opacity={baseAlpha}
        />,
      );

      if (waves.length === 0) continue;

      const dist = Math.hypot(x - cx, y - cy);
      let boost = 0;
      for (const w of waves) {
        const distFromFront = Math.abs(dist - w.radius);
        if (distFromFront < SHOCK_THICKNESS_PX) {
          const local = 1 - distFromFront / SHOCK_THICKNESS_PX;
          const eased = local * local;
          boost = Math.max(boost, eased * w.intensity);
        }
      }

      if (boost > 0.04) {
        const peakAlpha =
          baseAlpha + (FINE_ALPHA_PEAK - baseAlpha) * boost;
        const radiusBoost = FINE_RADIUS * (1 + boost * 0.55);
        boostDots.push(
          <circle
            key={`w${k}`}
            cx={x}
            cy={y}
            r={radiusBoost}
            fill={WHITE}
            opacity={peakAlpha}
          />,
        );
      }
    }
  }

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
      <g>{baseDots}</g>
      <g>{boostDots}</g>
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
