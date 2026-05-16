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
import { SPIKE_ENDCARD_LOCAL } from "./beats";

const SCENE_SECONDS = 4.5;
const SUBLINE_AT = toFrames(0.7);
const TERTIARY_AT = toFrames(1.2);
const SCENE_FRAMES = toFrames(SCENE_SECONDS);

// Settle: after the spike fires, the wordmark eases back from its
// scale punch over SETTLE_LEN frames. Pure rest from then on — the
// music is dying, anything else would shout into silence.
const SETTLE_LEN = 28;

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

  // Drum-spike anchor — the climax of the music lands at scene-local
  // SPIKE_ENDCARD_LOCAL (currently frame 6). A scale impulse on the
  // wordmark + a white halo burst land exactly with the kick. Pre-
  // attack (3f) eases in so the impact reads as inevitable; decay
  // (24f) releases slowly so the wordmark settles back into rest.
  const spikeDelta = frame - SPIKE_ENDCARD_LOCAL;
  const spikeImpulse =
    spikeDelta < -3
      ? 0
      : spikeDelta <= 0
        ? (spikeDelta + 3) / 3
        : Math.max(0, 1 - spikeDelta / 24);
  const spikeKick = Math.pow(spikeImpulse, 1.6); // sharper attack curve

  // Post-spike settle: the wordmark eases back to rest over SETTLE_LEN
  // frames after the kick. No further beats, no further pulses — the
  // music is dying, the card holds its breath.
  const settleT = Math.max(
    0,
    Math.min(1, (frame - SPIKE_ENDCARD_LOCAL) / SETTLE_LEN),
  );
  const settleEased = 1 - Math.pow(1 - settleT, 3);
  // After the spike has fully decayed, allow a tiny residual breath so
  // the mark visibly relaxes into its final rest pose rather than
  // freezing mid-frame.
  const restRelief = settleEased * 0.012;

  const wordmarkPunch =
    1 +
    Math.sin(Math.min(1, Math.max(0, punch)) * Math.PI) * 0.06 +
    spikeKick * 0.085 -
    restRelief;

  // Underline rides the spike — accelerates so it completes RIGHT at
  // the kick rather than later. Window starts at frame 2 (was 5) to
  // give it 6 frames of ramp now that the spike anchor moved 3f
  // earlier (9 → 6). Reads as the brand asserting itself in time with
  // the music.
  const underlineT = interpolate(
    frame,
    [2, SPIKE_ENDCARD_LOCAL + 2],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: (t) => 1 - Math.pow(1 - t, 2.4),
    },
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
      {/* Spike-anchored halo burst. White-on-blue: blooms with the kick,
       * radiates out behind the wordmark, settles to nothing by frame 35. */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 1700,
          height: 1700,
          transform: `translate(-50%, -50%) scale(${(0.55 + spikeKick * 0.55).toFixed(3)})`,
          background: `radial-gradient(circle at center, rgba(255,255,255,${(0.55 * spikeKick).toFixed(3)}) 0%, rgba(255,255,255,${(0.18 * spikeKick).toFixed(3)}) 22%, rgba(255,255,255,0) 58%)`,
          filter: "blur(40px)",
          opacity: spikeImpulse,
          mixBlendMode: "screen",
          pointerEvents: "none",
        }}
      />
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

      </div>
      </AbsoluteFill>

      {/* Apple footnote — refined SF Pro, hairline separator, sentence case */}
      <div
        style={{
          position: "absolute",
          bottom: 110,
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 28,
          opacity: tertiaryOpacity,
          transform: `translateY(${tertiaryY * 0.5}px)`,
        }}
      >
        <div
          style={{
            width: 140,
            height: 1,
            background: "rgba(255,255,255,0.30)",
          }}
        />
        <div
          style={{
            fontFamily: font,
            fontSize: 52,
            fontWeight: 400,
            letterSpacing: "-0.012em",
            color: "rgba(255,255,255,0.88)",
            lineHeight: 1.0,
          }}
        >
          Available only via trading bots
        </div>
      </div>
      </IdleZoom>
    </AbsoluteFill>
  );
};

// ─── General mark — landing-page geometry, rounded square + single bar ─────
//
// Same SVG the dapp's homepage uses (frontend/public/logo.svg): a rounded
// square with one centred pill bar inside. Inverted for the endcard's
// blue field — square is white, the bar is cut in the accent colour so
// it reads as a horizontal carve through the mark.

const GeneralMark: React.FC<{ size: number }> = ({ size }) => {
  const cutout = colors.accent;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 1024 1024"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0 }}
    >
      <rect width="1024" height="1024" rx="232" ry="232" fill="#FFFFFF" />
      <rect
        x="256"
        y="462"
        width="512"
        height="100"
        rx="50"
        ry="50"
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
