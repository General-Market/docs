import React from "react";
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { font } from "../../common/fonts";
import { DeviceBroll } from "../../lib/DeviceBroll";
import { FPS, H, W } from "./theme";

const BROLL = {
  minecraft: staticFile("cheat-broll/minecraft-killaura.mp4"),
  cs2: staticFile("cheat-broll/cs2-spinbot.mp4"),
  valorant: staticFile("cheat-broll/valorant-wallhack.mp4"),
};

// Cheat clips are 3-5s each; cycle them across the hook on the original
// beats — minecraft → cs2 at frame 69, cs2 → valorant at frame 146.
const LAPTOP_CLIP_CUTS = { mid: 69, late: 146 } as const;
function laptopBrollFor(frame: number): string {
  if (frame < LAPTOP_CLIP_CUTS.mid) return BROLL.minecraft;
  if (frame < LAPTOP_CLIP_CUTS.late) return BROLL.cs2;
  return BROLL.valorant;
}

// Tighter framing on the laptop. Default angle (looking down at the
// screen face) — only push zoom higher so the screen fills the panel.
const LAPTOP_CAMERA = {
  position: [3.031, 4.096, -6.179] as [number, number, number],
  target: [3.001, 2.780, 0.829] as [number, number, number],
  fov: 50,
  zoom: 1.7,
};

// Phone keeps its natural floating pose; tighter zoom so the screen
// dominates the right panel.
const PHONE_CAMERA = {
  position: [-2.8, 2.375, -4.44] as [number, number, number],
  target: [-2.921, 2.475, -1.564] as [number, number, number],
  fov: 50,
  zoom: 1.5,
};

const PHONE_BROLL = staticFile("cheat-broll/phone-trading.mp4");

const PAIRS = [
  { game: "Spin-bots", trade: "Insider traders" },
  { game: "Wall-hackers", trade: "Front-runners" },
  { game: "Kill aura", trade: "Order-flow buyers" },
] as const;

// Beat grid (frames):
//   17  — header in
//   43  — split begins
//   94  — pair 1
//   120 — pair 2
//   146 — pair 3
//   172 — verdict reveal
//   254 — hook ends
const HEADER_IN = 17;
const SPLIT_AT = 43;
const PAIR_FRAMES = [94, 120, 146];
const REVEAL_AT = 172;
const HOOK_DURATION = 254;

export const AntiCheatHook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const splitProgress = spring({
    frame: frame - SPLIT_AT,
    fps,
    config: { damping: 18, stiffness: 90, mass: 0.9 },
  });
  const splitOffset = interpolate(splitProgress, [0, 1], [0, W / 2], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const zoomScale = interpolate(frame, [0, HOOK_DURATION], [1, 1.05], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0a", fontFamily: font }}>
      <AbsoluteFill
        style={{
          transform: `scale(${zoomScale})`,
          transformOrigin: "50% 50%",
        }}
      >
        {/* ── Left panel: PLAY — laptop with cheat broll on its screen ── */}
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            right: `${splitOffset}px`,
            overflow: "hidden",
            borderRight: `1px solid ${"#1f1f1f"}`,
          }}
        >
          <DeviceBroll
            device="laptop"
            broll={laptopBrollFor(frame)}
            brollAspect={16 / 9}
            width={W}
            height={H}
            camera={LAPTOP_CAMERA}
            lightingIntensity={0.7}
            emissiveIntensity={1.6}
            background="#0a0a0a"
          />
          <StripDarken />
          <PanelLabel
            eyebrow="When you play"
            showFrom={HEADER_IN}
            align="left"
            frame={frame}
            fps={fps}
          />
          <PairList
            pairs={PAIRS}
            field="game"
            align="left"
            frames={PAIR_FRAMES}
            frame={frame}
            fps={fps}
          />
        </div>

        {/* ── Right panel: TRADE — phone playing the chart on its screen ── */}
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${W - splitOffset}px`,
            right: 0,
            overflow: "hidden",
            borderLeft: `1px solid ${"#1f1f1f"}`,
          }}
        >
          <DeviceBroll
            device="phone"
            broll={PHONE_BROLL}
            brollAspect={720 / 1560}
            width={W}
            height={H}
            camera={PHONE_CAMERA}
            lightingIntensity={0.7}
            emissiveIntensity={1.6}
            background="#0a0a0a"
          />
          <StripDarken tint={"#ff3b3b"} />
          <PanelLabel
            eyebrow="When you trade"
            showFrom={SPLIT_AT}
            align="right"
            frame={frame}
            fps={fps}
            tint={"#ff3b3b"}
          />
          <PairList
            pairs={PAIRS}
            field="trade"
            align="right"
            frames={PAIR_FRAMES}
            frame={frame}
            fps={fps}
            tint={"#ff3b3b"}
          />
        </div>

        {/* ── Reveal lines ── */}
        <Sequence from={REVEAL_AT} layout="none">
          <RevealLines />
        </Sequence>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─── Strip darkening — top + bottom edges, keeps text legible ──────────────────

const StripDarken: React.FC<{ tint?: string }> = ({ tint }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      pointerEvents: "none",
      background: tint
        ? `linear-gradient(180deg, rgba(10,10,10,0.82) 0%, rgba(10,10,10,0.0) 28%, rgba(10,10,10,0.0) 52%, rgba(10,10,10,0.78) 78%, rgba(10,10,10,0.94) 100%), linear-gradient(180deg, rgba(255,59,59,0.04), rgba(255,59,59,0.0))`
        : `linear-gradient(180deg, rgba(10,10,10,0.82) 0%, rgba(10,10,10,0.0) 28%, rgba(10,10,10,0.0) 52%, rgba(10,10,10,0.78) 78%, rgba(10,10,10,0.94) 100%)`,
    }}
  />
);

// ─── Text components ───────────────────────────────────────────────────────────

const PanelLabel: React.FC<{
  eyebrow: string;
  showFrom: number;
  align: "left" | "right";
  frame: number;
  fps: number;
  tint?: string;
}> = ({ eyebrow, showFrom, align, frame, fps, tint }) => {
  const t = spring({
    frame: frame - showFrom,
    fps,
    config: { damping: 22, stiffness: 110, mass: 0.7 },
  });
  const y = interpolate(t, [0, 1], [24, 0]);
  const opacity = interpolate(t, [0, 1], [0, 1]);

  return (
    <div
      style={{
        position: "absolute",
        top: "12%",
        left: 0,
        right: 0,
        textAlign: align === "left" ? "left" : "right",
        padding: "0 96px",
        opacity,
        transform: `translateY(${y}px)`,
      }}
    >
      <div
        style={{
          fontFamily: font,
          fontSize: 124,
          fontWeight: 800,
          letterSpacing: "-0.04em",
          color: tint ?? "#f5f5f5",
          lineHeight: 0.95,
          textShadow: "0 4px 28px rgba(0,0,0,0.65)",
        }}
      >
        {eyebrow}
      </div>
    </div>
  );
};

const PairList: React.FC<{
  pairs: typeof PAIRS;
  field: "game" | "trade";
  align: "left" | "right";
  frames: readonly number[];
  frame: number;
  fps: number;
  tint?: string;
}> = ({ pairs, field, align, frames, frame, fps, tint }) => {
  return (
    <div
      style={{
        position: "absolute",
        bottom: "10%",
        left: 0,
        right: 0,
        textAlign: align === "left" ? "left" : "right",
        padding: "0 96px",
        display: "flex",
        flexDirection: "column",
        gap: 22,
        alignItems: align === "left" ? "flex-start" : "flex-end",
      }}
    >
      {pairs.map((pair, i) => {
        const at = frames[i] ?? frames[frames.length - 1];

        const xT = spring({
          frame: frame - at,
          fps,
          config: { damping: 22, stiffness: 90, mass: 0.8 },
        });
        const opacity = interpolate(xT, [0.05, 0.45], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const initialX = align === "left" ? 480 : -480;
        const x = interpolate(xT, [0, 1], [initialX, 0]);

        return (
          <div
            key={i}
            style={{
              transform: `translateX(${x}px)`,
              opacity,
              fontFamily: font,
              fontSize: 76,
              fontWeight: 700,
              letterSpacing: "-0.03em",
              color: tint ?? "#f5f5f5",
              textShadow:
                "0 2px 6px rgba(0,0,0,0.95), 0 6px 22px rgba(0,0,0,0.8), 0 12px 40px rgba(0,0,0,0.55)",
            }}
          >
            {pair[field]}
          </div>
        );
      })}
    </div>
  );
};

// Each line flies forward from depth — starts huge and motion-blurred,
// snaps to scale 1.0 with focus pull.
const LINE1_LAND = 7;
const LINE2_START = 6;
const LINE2_LAND = LINE2_START + 7;
const SHAKE_FRAMES = 5;
const SHAKE_AMP = 9;

const RevealLines: React.FC = () => {
  const frame = useCurrentFrame();

  const shakeAt = (landFrame: number) => {
    const since = frame - landFrame;
    if (since < 0 || since >= SHAKE_FRAMES) return 0;
    return (1 - since / SHAKE_FRAMES) * SHAKE_AMP;
  };
  const amp = Math.max(shakeAt(LINE1_LAND), shakeAt(LINE2_LAND));
  const shakeX = amp ? (pseudo(frame * 7.31) - 0.5) * 2 * amp : 0;
  const shakeY = amp ? (pseudo(frame * 11.7 + 1) - 0.5) * 2 * amp : 0;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        background: "rgba(10,10,10,0.78)",
        backdropFilter: "blur(2px)",
        transform: `translate(${shakeX}px, ${shakeY}px)`,
      }}
    >
      <div
        style={{
          fontFamily: font,
          fontWeight: 700,
          fontSize: 84,
          letterSpacing: "-0.025em",
          textAlign: "center",
          color: "#f5f5f5",
          lineHeight: 1.15,
        }}
      >
        <DepthLine
          text="The cheaters behind your rage in games"
          startAt={0}
          frame={frame}
        />
        <DepthLine
          text="are behind your losses in trading"
          startAt={LINE2_START}
          frame={frame}
          color="#ff3b3b"
          marginTop={16}
        />
      </div>
    </AbsoluteFill>
  );
};

const DepthLine: React.FC<{
  text: string;
  startAt: number;
  frame: number;
  color?: string;
  marginTop?: number;
}> = ({ text, startAt, frame, color, marginTop }) => {
  const t = frame - startAt;
  const scale = interpolate(t, [0, 7], [2.4, 1.0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const blurPx = interpolate(t, [0, 7], [16, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = interpolate(t, [0, 5], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        transform: `scale(${scale})`,
        transformOrigin: "50% 50%",
        filter: blurPx > 0.05 ? `blur(${blurPx}px)` : "none",
        opacity,
        color: color ?? "#f5f5f5",
        marginTop: marginTop ?? 0,
      }}
    >
      {text}
    </div>
  );
};

function pseudo(seed: number): number {
  return (Math.sin(seed * 12.9898) * 43758.5453) % 1 < 0
    ? ((Math.sin(seed * 12.9898) * 43758.5453) % 1) + 1
    : (Math.sin(seed * 12.9898) * 43758.5453) % 1;
}

export const antiCheatHookMeta = {
  id: "AntiCheatHook",
  component: AntiCheatHook,
  durationInFrames: HOOK_DURATION,
  fps: FPS,
  width: W,
  height: H,
};
