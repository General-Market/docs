import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { noise2D } from "@remotion/noise";
import { font, monoFont } from "../../common/fonts";
import { FPS, H, W, colors, toFrames } from "./theme";
import { DotGrid, DotGridVignette } from "./DotGrid";
import { IdleZoom, RevealChars } from "./vibe";

// 228 frames (7.6s). Opens after the Reassure→Switch snap. The 40%
// proof-bars were excised; the two lines and their original positions
// stay exactly where they were. The centre — once occupied by the
// morphing hero — is now held by the SettleOrb glow and the impact
// flash. Beat anchors (PIVOT 107, KICKER 156) preserved for audio sync.
//
// Setup → pivot → knife:
//   "Same strategy."           opens the setup
//   "just by switching         types in as the knife
//    financial product"
//   "Earn up to 2× more*"      closes the frame
const SCENE_FRAMES = toFrames(7.6);

const HEADLINE_AT = 0;
const PIVOT_AT = 107;
const COPY_AT = 130;
const KICKER_AT = 156;

// Canonical anchors. Kept identical to the bar version so the
// composition keeps its original triangle even with the centre empty.
const HERO_CENTER_X = W / 2;
const HERO_CENTER_Y = H / 2 - 24;
const CLAIM_TOP_OFFSET = 176; // = old HERO_FONT (320) * 0.55

export const AntiCheatSwitch: React.FC = () => (
  <AbsoluteFill
    style={{
      backgroundColor: colors.bg,
      fontFamily: font,
      overflow: "hidden",
    }}
  >
    <IdleZoom durationInFrames={SCENE_FRAMES} from={1} to={1.022}>
      <DotGrid speed={3} />
      <ParticleField />
      <Stage />
      <DotGridVignette intensity={0.20} />
    </IdleZoom>
  </AbsoluteFill>
);

// ─── Particle field — soft drifting dots, GMBrand SegSupercharge pattern ──
//
// Noise-driven dots tinted to the accent-blue family. Fades in around the
// impact and holds through the hero state. They augment the orb's glow
// without competing with the type.

const PARTICLE_COUNT = 32;
const PARTICLE_COLORS = [
  colors.accent,
  colors.accentSoft,
  "#8DA5FF",
  "#B8C8FF",
  "#FFFFFF",
];

const ParticleField: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fieldOp = interpolate(
    frame,
    [100, 130, SCENE_FRAMES - 18, SCENE_FRAMES],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  if (fieldOp < 0.005) return null;

  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: fieldOp }}>
      {Array.from({ length: PARTICLE_COUNT }, (_, i) => {
        const t = frame / fps;
        const px = noise2D("acpx" + i, t * 0.5, i) * 760 + 960;
        const py = noise2D("acpy" + i, i, t * 0.5) * 460 + 540;
        const sz = 3 + (i % 5) * 1.6;
        const color = PARTICLE_COLORS[i % PARTICLE_COLORS.length];
        const baseOp = 0.32 + ((i * 17) % 36) / 100;
        const blur = i % 4 === 0 ? 1.8 : 0;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: px,
              top: py,
              width: sz,
              height: sz,
              borderRadius: "50%",
              backgroundColor: color,
              opacity: baseOp,
              filter: blur > 0 ? `blur(${blur.toFixed(1)}px)` : undefined,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

// ─── Stage ────────────────────────────────────────────────────────────────────

const Stage: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const pivotT = spring({
    frame: frame - PIVOT_AT,
    fps,
    config: { damping: 18, stiffness: 100, mass: 0.85 },
  });

  return (
    <AbsoluteFill>
      <Headline pivotT={pivotT} />
      <SettleOrb frame={frame} fps={fps} />
      <Streak
        frame={frame}
        startFromX={HERO_CENTER_X + 1100}
        startFromY={HERO_CENTER_Y - 700}
      />
      <Streak
        frame={frame}
        startFromX={HERO_CENTER_X - 1100}
        startFromY={HERO_CENTER_Y + 700}
        delay={2}
      />
      <ImpactFlash frame={frame} />
      <HeroCopy frame={frame} fps={fps} />
    </AbsoluteFill>
  );
};

// ─── Headline — "Same strategy." opens, exits on the pivot ────────────────────

const Headline: React.FC<{ pivotT: number }> = ({ pivotT }) => {
  const exitY = -pivotT * 38;
  const exitOp = 1 - pivotT;
  const exitBlur = pivotT * 8;

  return (
    <div
      style={{
        position: "absolute",
        top: 156,
        left: 0,
        right: 0,
        textAlign: "center",
        fontFamily: font,
        fontSize: 140,
        fontWeight: 800,
        letterSpacing: "-0.04em",
        color: colors.fg,
        lineHeight: 1.0,
        opacity: exitOp,
        transform: `translateY(${exitY.toFixed(2)}px)`,
        filter: exitBlur > 0.05 ? `blur(${exitBlur.toFixed(2)}px)` : undefined,
        willChange: "transform, opacity, filter",
      }}
    >
      <RevealChars
        text="Same strategy"
        startFrame={HEADLINE_AT}
        stagger={1.0}
        duration={11}
        y={14}
        blur={4}
      />
    </div>
  );
};

// ─── Impact burst ─────────────────────────────────────────────────────────────
//
// Two diagonal accent-blue capsules accelerate into the centre. Brief
// radial flash on impact. A soft settle orb fades in behind it and holds.

const STREAK_START = 89;
const STREAK_IMPACT = 106;
const FLASH_END = 117;
const SETTLE_START = 109;

const Streak: React.FC<{
  frame: number;
  startFromX: number;
  startFromY: number;
  delay?: number;
}> = ({ frame, startFromX, startFromY, delay = 0 }) => {
  const startAt = STREAK_START + delay;
  const local = frame - startAt;
  const duration = STREAK_IMPACT - startAt;

  if (local < -4 || frame >= STREAK_IMPACT + 1) return null;

  const t = Math.max(0, Math.min(1, local / duration));
  const eased = t * t * t;

  const x = startFromX + (HERO_CENTER_X - startFromX) * eased;
  const y = startFromY + (HERO_CENTER_Y - startFromY) * eased;

  const dx = HERO_CENTER_X - startFromX;
  const dy = HERO_CENTER_Y - startFromY;
  const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

  const fadeIn = Math.max(0, Math.min(1, local / 14));
  const opacity = fadeIn;

  const baseLength = 300;
  const length = baseLength * (1 + eased * 0.7);
  const thickness = 26;

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: length,
        height: thickness,
        transform: `translate(-50%, -50%) rotate(${angleDeg.toFixed(2)}deg)`,
        transformOrigin: "center center",
        borderRadius: thickness / 2,
        background:
          "linear-gradient(90deg, rgba(0,82,255,0) 0%, rgba(0,82,255,0.3) 28%, rgba(0,82,255,0.95) 72%, rgba(200,225,255,1) 92%, rgba(255,255,255,1) 100%)",
        filter: "blur(2px)",
        boxShadow:
          "0 0 28px rgba(0,82,255,0.85), 0 0 72px rgba(0,82,255,0.5), 0 0 160px rgba(0,82,255,0.22)",
        opacity,
        willChange: "transform, opacity",
        pointerEvents: "none",
      }}
    />
  );
};

const ImpactFlash: React.FC<{ frame: number }> = ({ frame }) => {
  const local = frame - STREAK_IMPACT;
  if (local < -2 || local > FLASH_END - STREAK_IMPACT) return null;

  const tIn = Math.max(0, Math.min(1, (local + 2) / 4));
  const tOut = Math.max(
    0,
    Math.min(1, (local - 1) / (FLASH_END - STREAK_IMPACT - 1)),
  );
  const opacity = tIn * tIn * (1 - tOut * tOut * tOut);
  const scale = 0.4 + 1.3 * Math.sqrt(Math.max(0.001, tIn * (1 - tOut * 0.6)));

  return (
    <div
      style={{
        position: "absolute",
        left: HERO_CENTER_X,
        top: HERO_CENTER_Y,
        width: 800,
        height: 800,
        transform: `translate(-50%, -50%) scale(${scale.toFixed(3)})`,
        borderRadius: "50%",
        background:
          "radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(200,225,255,0.92) 14%, rgba(0,82,255,0.72) 30%, rgba(0,82,255,0.22) 55%, rgba(0,82,255,0) 78%)",
        filter: "blur(20px)",
        opacity,
        pointerEvents: "none",
      }}
    />
  );
};

const SettleOrb: React.FC<{ frame: number; fps: number }> = ({
  frame,
  fps,
}) => {
  const t = spring({
    frame: frame - SETTLE_START,
    fps,
    config: { damping: 22, stiffness: 90, mass: 0.8 },
  });
  if (t < 0.005) return null;

  const sinceStart = Math.max(0, frame - SETTLE_START);
  const breath = 1 + Math.sin(sinceStart / 36) * 0.035;
  const scale = (0.88 + t * 0.12) * breath;
  const opacity = t * 0.9;

  return (
    <div
      style={{
        position: "absolute",
        left: HERO_CENTER_X,
        top: HERO_CENTER_Y,
        width: 1100,
        height: 1100,
        transform: `translate(-50%, -50%) scale(${scale.toFixed(3)})`,
        borderRadius: "50%",
        background:
          "radial-gradient(circle, rgba(0,82,255,0.42) 0%, rgba(0,82,255,0.22) 25%, rgba(0,82,255,0.08) 50%, rgba(0,82,255,0) 78%)",
        filter: "blur(40px)",
        opacity,
        pointerEvents: "none",
      }}
    />
  );
};

// ─── Kicker typing — GMBrand Scene02 "the next era" pattern ──────────────
// Frame-driven typewriter: chars appear one by one at CHARS_PER_FRAME speed,
// blinking cursor while typing, cursor fades after completion. The accent
// half ("financial product") types in blue once the gray prefix lands.

const KICKER_TEXT_PRE = "just by switching ";
const KICKER_TEXT_HERO = "financial product";
const KICKER_CHARS_PER_FRAME = 1.2;

const KickerTyping: React.FC<{ startFrame: number }> = ({ startFrame }) => {
  const frame = useCurrentFrame();
  const elapsed = Math.max(0, frame - startFrame);
  const totalChars = KICKER_TEXT_PRE.length + KICKER_TEXT_HERO.length;
  const charsVisible = Math.min(
    totalChars,
    Math.floor(elapsed * KICKER_CHARS_PER_FRAME),
  );
  const preVisible = Math.min(KICKER_TEXT_PRE.length, charsVisible);
  const heroVisible = Math.max(0, charsVisible - KICKER_TEXT_PRE.length);
  const typingDone = charsVisible >= totalChars;
  const completeAt = startFrame + totalChars / KICKER_CHARS_PER_FRAME;
  const cursorOpacity = !typingDone
    ? Math.sin(frame * 0.5) > -0.3
      ? 0.85
      : 0
    : Math.max(0, 0.85 - Math.max(0, frame - completeAt) / 8);

  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <span style={{ color: colors.fg }}>
        {KICKER_TEXT_PRE.slice(0, preVisible)}
      </span>
      <span style={{ color: colors.accent }}>
        {KICKER_TEXT_HERO.slice(0, heroVisible)}
      </span>
      {charsVisible > 0 && (
        <span
          style={{
            display: "inline-block",
            width: 4,
            height: 96 * 0.7,
            backgroundColor:
              charsVisible > KICKER_TEXT_PRE.length ? colors.accent : colors.fg,
            opacity: cursorOpacity,
            marginLeft: 4,
            verticalAlign: "baseline",
            transform: "translateY(6px)",
          }}
        />
      )}
    </span>
  );
};

// ─── Hero copy ────────────────────────────────────────────────────────────────

const HeroCopy: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const claimT = spring({
    frame: frame - COPY_AT,
    fps,
    config: { damping: 22, stiffness: 130, mass: 0.7 },
  });
  const claimOp = interpolate(claimT, [0, 1], [0, 1]);
  const claimY = interpolate(claimT, [0, 1], [16, 0]);

  const kickT = spring({
    frame: frame - KICKER_AT,
    fps,
    config: { damping: 22, stiffness: 130, mass: 0.7 },
  });
  const kickOp = interpolate(kickT, [0, 1], [0, 1]);
  const kickY = interpolate(kickT, [0, 1], [12, 0]);

  return (
    <>
      {/* Claim — sits in its canonical slot below centre. */}
      <div
        style={{
          position: "absolute",
          top: HERO_CENTER_Y + CLAIM_TOP_OFFSET,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: font,
          fontSize: 96,
          fontWeight: 700,
          letterSpacing: "-0.032em",
          color: colors.fg,
          lineHeight: 1.0,
          opacity: claimOp,
          transform: `translateY(${claimY.toFixed(2)}px)`,
        }}
      >
        Earn up to 2× more
        <span
          style={{
            fontFamily: monoFont,
            fontSize: 32,
            color: colors.dim,
            marginLeft: 4,
            verticalAlign: "super",
            fontWeight: 500,
            letterSpacing: 0,
          }}
        >
          *
        </span>
      </div>

      {/* Kicker — replaces the headline at the top of the frame. */}
      <div
        style={{
          position: "absolute",
          top: 156,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: font,
          fontSize: 96,
          fontWeight: 700,
          letterSpacing: "-0.032em",
          color: colors.fg,
          lineHeight: 1.0,
          opacity: kickOp,
          transform: `translateY(${kickY.toFixed(2)}px)`,
        }}
      >
        <KickerTyping startFrame={KICKER_AT} />
      </div>

      {/* Legal footnote — tiny, dim, defensible. Apple-style fine print. */}
      <div
        style={{
          position: "absolute",
          bottom: 56,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: font,
          fontSize: 18,
          fontWeight: 400,
          letterSpacing: "-0.005em",
          color: colors.dim,
          lineHeight: 1.35,
          maxWidth: 1240,
          margin: "0 auto",
          opacity: kickOp,
        }}
      >
        *Based on General Market testnet data. Indicative comparison under favorable market conditions. Net of fees and slippage. Past performance does not guarantee future returns.
      </div>
    </>
  );
};

export const antiCheatSwitchMeta = {
  id: "AntiCheatSwitch",
  component: AntiCheatSwitch,
  durationInFrames: SCENE_FRAMES,
  fps: FPS,
  width: W,
  height: H,
};
