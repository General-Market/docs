import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { FPS, H, W, colors, toFrames, pitchSans, pitchSansLight } from "./theme";
import { PitchFrame } from "./PitchFrame";
import {
  SlideBg,
  SlideTitle,
  HeroGlow,
  useReveal,
} from "./SlideKit";

const SCENE_SECONDS = 9.5;

const PLAY_ITEMS = [
  { code: "01", label: "Spin-bots" },
  { code: "02", label: "Wall-hackers" },
  { code: "03", label: "Kill aura" },
];

const TRADE_ITEMS = [
  { code: "01", label: "Insider traders" },
  { code: "02", label: "Front-runners" },
  { code: "03", label: "Order-flow buyers" },
];

const TITLE_AT = toFrames(0.2);
const LEFT_CARD_AT = toFrames(1.2);
const RIGHT_CARD_AT = toFrames(2.4);
const ROW_STEP = toFrames(0.35);
const PUNCHLINE_AT = toFrames(7.4);

export const AntiCheatPitchHook: React.FC = () => {
  const frame = useCurrentFrame();
  const cardOpacity = interpolate(
    frame,
    [PUNCHLINE_AT, PUNCHLINE_AT + toFrames(0.4)],
    [1, 0.18],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <SlideBg>
      <HeroGlow />

      <SlideTitle showFrom={TITLE_AT} size={84}>
        When you play, you spot the cheaters.
      </SlideTitle>

      <div
        style={{
          position: "absolute",
          top: "36%",
          left: 96,
          right: 96,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 28,
          opacity: cardOpacity,
        }}
      >
        <PanelCard
          title="When you play"
          eyebrow="01 / Game"
          items={PLAY_ITEMS}
          at={LEFT_CARD_AT}
          variant="white"
        />
        <PanelCard
          title="When you trade"
          eyebrow="02 / Market"
          items={TRADE_ITEMS}
          at={RIGHT_CARD_AT}
          variant="orange"
        />
      </div>

      <Punchline />

      <PitchFrame chapter={1} total={6} eyebrow="THE PROBLEM" />
    </SlideBg>
  );
};

const PanelCard: React.FC<{
  title: string;
  eyebrow: string;
  items: { code: string; label: string }[];
  at: number;
  variant: "white" | "orange";
}> = ({ title, eyebrow, items, at, variant }) => {
  const r = useReveal(at);
  const isOrange = variant === "orange";
  const bg = isOrange
    ? `linear-gradient(160deg, #FFB733 0%, ${colors.accent} 60%, #E58F00 100%)`
    : `linear-gradient(180deg, #FFFFFF 0%, #ECEDF1 100%)`;
  const fg = colors.bg;
  const dim = isOrange ? "rgba(13,14,15,0.72)" : colors.dim;

  return (
    <div
      style={{
        position: "relative",
        background: bg,
        minHeight: 540,
        opacity: r.opacity,
        transform: `translateY(${r.y}px) scale(${r.scale})`,
        padding: "44px 48px",
        display: "flex",
        flexDirection: "column",
        gap: 28,
      }}
    >
      <div
        style={{
          fontFamily: pitchSans,
          fontWeight: 700,
          letterSpacing: "0.32em",
          textTransform: "uppercase",
          fontSize: 22,
          color: dim,
        }}
      >
        {eyebrow}
      </div>
      <div
        style={{
          fontFamily: pitchSans,
          fontWeight: 800,
          fontSize: 76,
          letterSpacing: "-0.025em",
          color: fg,
          lineHeight: 0.98,
        }}
      >
        {title}
      </div>
      <div
        style={{
          height: 1,
          background: isOrange ? "rgba(13,14,15,0.18)" : "rgba(13,14,15,0.12)",
        }}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {items.map((it, i) => (
          <ItemRow
            key={it.code}
            code={it.code}
            label={it.label}
            at={at + toFrames(0.4) + i * ROW_STEP}
            fg={fg}
            dim={dim}
          />
        ))}
      </div>
    </div>
  );
};

const ItemRow: React.FC<{
  code: string;
  label: string;
  at: number;
  fg: string;
  dim: string;
}> = ({ code, label, at, fg, dim }) => {
  const r = useReveal(at);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 24,
        opacity: r.opacity,
        transform: `translateX(${r.x}px)`,
        fontFamily: pitchSans,
        fontWeight: 600,
        fontSize: 44,
        letterSpacing: "-0.015em",
        color: fg,
      }}
    >
      <span
        style={{
          fontFamily: pitchSansLight,
          fontWeight: 400,
          fontSize: 22,
          letterSpacing: "0.18em",
          color: dim,
          minWidth: 38,
        }}
      >
        {code}
      </span>
      {label}
    </div>
  );
};

const Punchline: React.FC = () => {
  const frame = useCurrentFrame();
  const r1 = useReveal(PUNCHLINE_AT);
  const r2 = useReveal(PUNCHLINE_AT + toFrames(0.6));
  const visible = frame >= PUNCHLINE_AT - toFrames(0.1);
  if (!visible) return null;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(13,14,15,0.78)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        textAlign: "center",
        padding: "0 96px",
        opacity: r1.opacity,
      }}
    >
      <div
        style={{
          fontFamily: pitchSans,
          fontWeight: 800,
          fontSize: 96,
          letterSpacing: "-0.03em",
          color: colors.fg,
          lineHeight: 1.04,
          maxWidth: 1500,
          transform: `translateY(${r1.y}px)`,
        }}
      >
        The same cheaters ruining your games
      </div>
      <div
        style={{
          marginTop: 18,
          fontFamily: pitchSans,
          fontWeight: 800,
          fontSize: 96,
          letterSpacing: "-0.03em",
          color: colors.accent,
          lineHeight: 1.04,
          opacity: r2.opacity,
          transform: `translateY(${r2.y}px)`,
        }}
      >
        are trading against you.
      </div>
    </div>
  );
};

export const antiCheatPitchHookMeta = {
  id: "AntiCheatPitchHook",
  component: AntiCheatPitchHook,
  durationInFrames: toFrames(SCENE_SECONDS),
  fps: FPS,
  width: W,
  height: H,
};
