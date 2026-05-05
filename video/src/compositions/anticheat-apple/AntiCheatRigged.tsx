import React from "react";
import {
  AbsoluteFill,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { font, monoFont } from "../../common/fonts";
import { FPS, H, W, colors, ease, easeOut, toFrames } from "./theme";

const SCENE_SECONDS = 7.0;
const CARD_TIMES = [toFrames(1.0), toFrames(2.5), toFrames(4.0)];
const STAMP_AT = toFrames(5.2);
const UNDERLINE_AT = STAMP_AT + 36;

const CARDS = [
  {
    n: "01",
    label: "A tip from a politician",
    sub: "Material non-public information",
    image: staticFile("anticheat-imgs/congress.jpg"),
  },
  {
    n: "02",
    label: "$100M of latency infra",
    sub: "Co-located, sub-microsecond",
    image: staticFile("anticheat-imgs/hft-racks.png"),
  },
  {
    n: "03",
    label: "$30M for exchange data",
    sub: "Direct feeds, unfair by design",
    image: staticFile("anticheat-imgs/orderflow-traders.png"),
  },
] as const;

export const AntiCheatRigged: React.FC = () => {
  const frame = useCurrentFrame();

  // Headline + cards fade out as the stamp arrives — 24f exit with `ease`.
  const fadeOut = 1 - interpolate(
    frame,
    [STAMP_AT - toFrames(0.2), STAMP_AT - toFrames(0.2) + 24],
    [0, 1],
    {
      easing: ease,
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );

  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg, fontFamily: font }}>
      <Headline fadeOut={fadeOut} />

      <div
        style={{
          position: "absolute",
          top: "42%",
          left: 0,
          right: 0,
          display: "flex",
          alignItems: "stretch",
          justifyContent: "center",
          gap: 36,
          padding: "0 96px",
          opacity: fadeOut,
        }}
      >
        {CARDS.map((card, i) => (
          <Card key={card.n} card={card} at={CARD_TIMES[i]} />
        ))}
      </div>

      <FinalStamp />
    </AbsoluteFill>
  );
};

// ─── Headline: fades in over 36 frames, weight 400 ────────────────────────────

const Headline: React.FC<{ fadeOut: number }> = ({ fadeOut }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 36], [0, 1], {
    easing: easeOut,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const y = interpolate(frame, [0, 36], [32, 0], {
    easing: easeOut,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        top: "12%",
        left: 0,
        right: 0,
        textAlign: "center",
        padding: "0 96px",
        opacity: opacity * fadeOut,
        transform: `translateY(${y}px)`,
      }}
    >
      <div
        style={{
          fontFamily: monoFont,
          fontSize: 40,
          fontWeight: 500,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: colors.dim,
          marginBottom: 20,
        }}
      >
        The rigged stack
      </div>
      <div
        style={{
          fontFamily: font,
          fontSize: 96,
          fontWeight: 400,
          letterSpacing: "-0.04em",
          color: colors.fg,
          lineHeight: 0.95,
        }}
      >
        If you don&rsquo;t have
      </div>
    </div>
  );
};

// ─── Card: each one fades in over 36 frames at its own beat ───────────────────

const Card: React.FC<{
  card: (typeof CARDS)[number];
  at: number;
}> = ({ card, at }) => {
  const frame = useCurrentFrame();
  const local = frame - at;
  if (local < -2) {
    return (
      <div
        style={{
          flex: 1,
          maxWidth: 480,
          opacity: 0,
        }}
      />
    );
  }

  const opacity = interpolate(local, [0, 36], [0, 1], {
    easing: easeOut,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const y = interpolate(local, [0, 36], [32, 0], {
    easing: easeOut,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        flex: 1,
        maxWidth: 480,
        border: `1px solid ${colors.rule}`,
        borderRadius: 4,
        backgroundColor: colors.bg,
        opacity,
        transform: `translateY(${y}px)`,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Image — top ~55% of card. */}
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "16 / 11",
          overflow: "hidden",
          borderBottom: `1px solid ${colors.rule}`,
        }}
      >
        <img
          src={card.image}
          alt=""
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.0), rgba(0,0,0,0.45))",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 18,
            left: 20,
            fontFamily: monoFont,
            fontSize: 30,
            color: colors.fg,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
          }}
        >
          {card.n}
        </div>
      </div>

      <div
        style={{
          padding: "28px 32px 32px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          flex: 1,
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 44,
            fontWeight: 400,
            letterSpacing: "-0.02em",
            color: colors.fg,
            lineHeight: 1.15,
          }}
        >
          {card.label}
        </div>
        <div
          style={{
            marginTop: "auto",
            fontFamily: monoFont,
            fontSize: 22,
            letterSpacing: "0.04em",
            color: colors.dim,
            opacity: 0.9,
          }}
        >
          {card.sub}
        </div>
      </div>
    </div>
  );
};

// ─── Final stamp — "70% on the table" with a single red rule beneath ──────────

const FinalStamp: React.FC = () => {
  const frame = useCurrentFrame();
  if (frame < STAMP_AT - 2) return null;

  const local = frame - STAMP_AT;
  const opacity = interpolate(local, [0, 36], [0, 1], {
    easing: easeOut,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const y = interpolate(local, [0, 36], [32, 0], {
    easing: easeOut,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Red 1px rule draws under the stamp from center outward over 14 frames
  // after the stamp lands.
  const ruleLocal = frame - UNDERLINE_AT;
  const ruleT = interpolate(ruleLocal, [0, 14], [0, 1], {
    easing: easeOut,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        background: "rgba(10,10,10,0.78)",
        backdropFilter: "blur(2px)",
      }}
    >
      <div
        style={{
          position: "relative",
          padding: "0 96px",
          opacity,
          transform: `translateY(${y}px)`,
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 132,
            fontWeight: 400,
            letterSpacing: "-0.04em",
            color: colors.fg,
            lineHeight: 0.95,
            textAlign: "center",
          }}
        >
          You&rsquo;re leaving 70%
          <br />
          on the table
        </div>
        {/* Red 1px rule, drawing from center outward. */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: -28,
            width: `${ruleT * 100}%`,
            height: 1,
            backgroundColor: colors.red,
            transform: "translateX(-50%)",
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

export const antiCheatAppleRiggedMeta = {
  id: "AntiCheatAppleRigged",
  component: AntiCheatRigged,
  durationInFrames: toFrames(SCENE_SECONDS),
  fps: FPS,
  width: W,
  height: H,
};
