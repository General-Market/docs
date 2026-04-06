import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
} from "remotion";

const PURPLE = "#9146ff";
const CHAT_COLORS = [
  "#22c55e",
  "#ffffff",
  "#3b82f6",
  "#f59e0b",
  "#ef4444",
  "#a855f7",
  "#06b6d4",
];

// ── Pre-generated chat messages ──────────────────────────────────────
interface ChatLine {
  width: number;
  color: string;
  isHighlighted: boolean;
}

const CHAT_LINES: ChatLine[] = [];
for (let i = 0; i < 80; i++) {
  const seed = Math.sin(i * 7.3 + 2.1) * 0.5 + 0.5;
  CHAT_LINES.push({
    width: 60 + seed * 180,
    color: CHAT_COLORS[i % CHAT_COLORS.length],
    isHighlighted: i % 11 === 0, // ~every 11th message is a subscriber highlight
  });
}

// ── Donation / sub alerts ────────────────────────────────────────────
interface AlertConfig {
  text: string;
  startFrame: number;
  duration: number;
  type: "sub" | "donation" | "gifted";
}

const ALERTS: AlertConfig[] = [
  { text: "xXTraderXx just subscribed!", startFrame: 18, duration: 55, type: "sub" },
  { text: "CryptoApe donated $50", startFrame: 52, duration: 55, type: "donation" },
  { text: "ShrimpLord gifted 5 subs!", startFrame: 90, duration: 55, type: "gifted" },
];

// ── Floating emote config ────────────────────────────────────────────
interface EmoteConfig {
  label: string;
  startFrame: number;
  xOffset: number; // px from center
  speed: number; // rise speed multiplier
}

const EMOTES: EmoteConfig[] = [
  { label: "PogChamp", startFrame: 10, xOffset: -80, speed: 1.0 },
  { label: "KEKW", startFrame: 18, xOffset: 40, speed: 1.2 },
  { label: "monkaS", startFrame: 30, xOffset: -30, speed: 0.9 },
  { label: "LULW", startFrame: 42, xOffset: 70, speed: 1.1 },
  { label: "PogChamp", startFrame: 55, xOffset: -60, speed: 1.0 },
  { label: "Kreygasm", startFrame: 65, xOffset: 20, speed: 1.3 },
  { label: "KEKW", startFrame: 78, xOffset: -45, speed: 0.95 },
  { label: "monkaS", startFrame: 88, xOffset: 55, speed: 1.15 },
  { label: "LULW", startFrame: 100, xOffset: -20, speed: 1.0 },
  { label: "PogChamp", startFrame: 110, xOffset: 35, speed: 1.05 },
];

const EMOTE_LIFETIME = 40; // frames each emote lives

export const TwitchScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── Viewer count: 87k → 91k ──────────────────────────────────────
  const viewerCount = Math.round(
    interpolate(frame, [0, 120], [87000, 91400], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }) +
      Math.sin(frame * 0.7) * 120 +
      Math.sin(frame * 1.9) * 60,
  );
  const displayViewers = viewerCount.toLocaleString("en-US");

  // Milestone glow: pulse when crossing a thousand boundary
  const currentThousand = Math.floor(viewerCount / 1000);
  const prevThousand = Math.floor(
    (interpolate(Math.max(frame - 1, 0), [0, 120], [87000, 91400], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }) +
      Math.sin(Math.max(frame - 1, 0) * 0.7) * 120 +
      Math.sin(Math.max(frame - 1, 0) * 1.9) * 60) / 1000,
  );
  const justCrossedThousand = currentThousand !== prevThousand;

  // Track frames since last milestone for glow decay
  const milestoneGlow = justCrossedThousand
    ? 1
    : interpolate(frame % 8, [0, 7], [0.15, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });

  // A persistent glow spring whenever we cross a boundary
  const glowIntensity = spring({
    frame: justCrossedThousand ? 0 : Math.min(frame % 30, 29),
    fps,
    config: { damping: 12, stiffness: 80, mass: 0.6 },
  });
  const viewerGlowSpread = 80 + (1 - glowIntensity) * 60;
  const viewerGlowAlpha = justCrossedThousand ? "cc" : milestoneGlow > 0.05 ? "44" : "33";

  // ── Chat scroll ───────────────────────────────────────────────────
  const chatSpeed = interpolate(frame, [0, 120], [1.5, 4.5], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const chatOffset = frame * chatSpeed;

  // ── LIVE dot pulse ────────────────────────────────────────────────
  const dotScale = interpolate(Math.sin(frame * 0.2), [-1, 1], [0.8, 1.2]);
  const dotOpacity = interpolate(Math.sin(frame * 0.2), [-1, 1], [0.6, 1]);

  // ── Entrance ──────────────────────────────────────────────────────
  const mainOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const numberScale = interpolate(frame, [0, 20], [0.9, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── Chat panel geometry ───────────────────────────────────────────
  const CHAT_PANEL_X = 1540;
  const CHAT_PANEL_W = 300;
  const CHAT_PANEL_TOP = 120;
  const CHAT_PANEL_H = 840;
  const LINE_H = 36;
  const VISIBLE_LINES = Math.ceil(CHAT_PANEL_H / LINE_H) + 2;

  // ── Stream uptime (starts at 4h 23m, ticks up) ───────────────────
  const baseMinutes = 4 * 60 + 23;
  const elapsedMinutes = baseMinutes + Math.floor(frame / fps);
  const uptimeHours = Math.floor(elapsedMinutes / 60);
  const uptimeMinutes = elapsedMinutes % 60;
  const uptimeStr = `${uptimeHours}h ${String(uptimeMinutes).padStart(2, "0")}m`;

  // ── Scanline offset ───────────────────────────────────────────────
  const scanlineOffset = (frame * 1.5) % 6;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "transparent",
        fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
      }}
    >
      {/* Subtle purple vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse at 40% 50%, ${PURPLE}08 0%, transparent 70%)`,
        }}
      />

      {/* ── Purple gradient scanline overlay ──────────────────────── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 4px,
            ${PURPLE}05 4px,
            ${PURPLE}05 6px
          )`,
          backgroundPosition: `0 ${scanlineOffset}px`,
          pointerEvents: "none",
          zIndex: 50,
        }}
      />

      {/* ── Donation / Sub alerts ─────────────────────────────────── */}
      {ALERTS.map((alert, ai) => {
        const localFrame = frame - alert.startFrame;
        if (localFrame < 0 || localFrame > alert.duration) return null;

        const slideIn = spring({
          frame: localFrame,
          fps,
          config: { damping: 14, stiffness: 120, mass: 0.5 },
        });
        const fadeOut = interpolate(
          localFrame,
          [alert.duration - 15, alert.duration],
          [1, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );
        const yPos = interpolate(slideIn, [0, 1], [-60, 0]);

        const alertBg =
          alert.type === "donation"
            ? "linear-gradient(90deg, #9146ff, #6d28d9)"
            : alert.type === "gifted"
              ? "linear-gradient(90deg, #7c3aed, #4c1d95)"
              : `linear-gradient(90deg, ${PURPLE}, #6d28d9)`;

        return (
          <div
            key={ai}
            style={{
              position: "absolute",
              top: 40 + ai * 52,
              left: 0,
              right: 380,
              display: "flex",
              justifyContent: "center",
              opacity: fadeOut * 0.8,
              transform: `translateY(${yPos}px)`,
              zIndex: 20,
            }}
          >
            <div
              style={{
                background: alertBg,
                padding: "8px 24px",
                borderRadius: 6,
                fontSize: 15,
                fontWeight: 700,
                color: "#ffffff",
                letterSpacing: 0.5,
                boxShadow: `0 4px 16px ${PURPLE}44`,
                whiteSpace: "nowrap",
              }}
            >
              {alert.type === "donation" && (
                <span style={{ marginRight: 8, fontSize: 17 }}>$</span>
              )}
              {alert.text}
            </div>
          </div>
        );
      })}

      {/* ── Main viewer count — centered, semi-transparent ────────── */}
      <div
        style={{
          position: "absolute",
          top: 330,
          left: 0,
          right: 380,
          textAlign: "center",
          opacity: mainOpacity * 0.5,
          transform: `scale(${numberScale})`,
        }}
      >
        <div
          style={{
            fontSize: 200,
            fontWeight: 900,
            color: "#ffffff",
            lineHeight: 1,
            letterSpacing: -4,
            textShadow: `0 0 ${viewerGlowSpread}px ${PURPLE}${viewerGlowAlpha}`,
          }}
        >
          {displayViewers}
        </div>
      </div>

      {/* ── Floating emote reactions ──────────────────────────────── */}
      {EMOTES.map((emote, ei) => {
        const localFrame = frame - emote.startFrame;
        if (localFrame < 0 || localFrame > EMOTE_LIFETIME) return null;

        const progress = localFrame / EMOTE_LIFETIME;
        const riseY = interpolate(progress, [0, 1], [0, -260 * emote.speed]);
        const fadeIn = interpolate(localFrame, [0, 5], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const fadeOut = interpolate(
          localFrame,
          [EMOTE_LIFETIME - 12, EMOTE_LIFETIME],
          [1, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );
        const drift = Math.sin(localFrame * 0.15 + ei) * 12;
        const scaleIn = spring({
          frame: localFrame,
          fps,
          config: { damping: 10, stiffness: 150, mass: 0.4 },
        });

        return (
          <div
            key={ei}
            style={{
              position: "absolute",
              bottom: 180,
              left: "50%",
              transform: `translate(${emote.xOffset + drift - 190}px, ${riseY}px) scale(${scaleIn})`,
              opacity: fadeIn * fadeOut * 0.7,
              fontSize: 22,
              fontWeight: 800,
              color: "#ffffff",
              textShadow: `0 0 12px ${PURPLE}66, 0 2px 4px #00000066`,
              whiteSpace: "nowrap",
              pointerEvents: "none",
              zIndex: 10,
            }}
          >
            {emote.label}
          </div>
        );
      })}

      {/* ── Chat panel — right edge, more transparent ─────────────── */}
      <div
        style={{
          position: "absolute",
          top: CHAT_PANEL_TOP,
          left: CHAT_PANEL_X,
          width: CHAT_PANEL_W,
          height: CHAT_PANEL_H,
          overflow: "hidden",
          borderLeft: `1px solid ${PURPLE}15`,
          opacity: interpolate(frame, [5, 25], [0, 0.6], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        {/* Chat header */}
        <div
          style={{
            padding: "8px 16px",
            borderBottom: "1px solid #ffffff08",
            color: "#ffffff33",
            fontSize: 12,
            letterSpacing: 4,
          }}
        >
          STREAM CHAT
        </div>

        {/* Scrolling messages */}
        <div
          style={{
            position: "relative",
            height: CHAT_PANEL_H - 40,
            overflow: "hidden",
          }}
        >
          {Array.from({ length: VISIBLE_LINES }, (_, vi) => {
            const globalIdx = Math.floor(chatOffset / LINE_H) + vi;
            const line =
              CHAT_LINES[
                ((globalIdx % CHAT_LINES.length) + CHAT_LINES.length) %
                  CHAT_LINES.length
              ];
            const yOffset = -(chatOffset % LINE_H) + vi * LINE_H;

            return (
              <div
                key={vi}
                style={{
                  position: "absolute",
                  top: yOffset,
                  left: 0,
                  right: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  height: LINE_H,
                  paddingLeft: 16,
                  paddingRight: 8,
                  ...(line.isHighlighted
                    ? {
                        backgroundColor: "#f59e0b10",
                        borderLeft: "3px solid #f59e0b44",
                      }
                    : {}),
                }}
              >
                {/* Username bar */}
                <div
                  style={{
                    width: 50 + ((globalIdx * 13) % 30),
                    height: 10,
                    borderRadius: 3,
                    backgroundColor: line.color,
                    opacity: line.isHighlighted ? 0.6 : 0.4,
                    flexShrink: 0,
                  }}
                />
                {/* Message bar */}
                <div
                  style={{
                    width: line.width,
                    height: 10,
                    borderRadius: 3,
                    backgroundColor: line.isHighlighted
                      ? "#f59e0b"
                      : "#ffffff",
                    opacity: line.isHighlighted ? 0.18 : 0.08,
                  }}
                />
              </div>
            );
          })}

          {/* Fade at top and bottom */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 40,
              background: "linear-gradient(to bottom, rgba(0,0,0,0.5), transparent)",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 40,
              background: "linear-gradient(to top, rgba(0,0,0,0.5), transparent)",
            }}
          />
        </div>
      </div>

      {/* HUD panel — bottom-left corner with key stats */}
      <div
        style={{
          position: "absolute",
          bottom: 80,
          left: 40,
          width: 350,
          maxHeight: 250,
          background: "rgba(0,0,0,0.6)",
          borderRadius: 8,
          padding: "12px 16px",
          border: "1px solid rgba(255,255,255,0.08)",
          opacity: mainOpacity,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            backgroundColor: "#dc2626",
            transform: `scale(${dotScale})`,
            opacity: dotOpacity,
            boxShadow: "0 0 8px #dc262688",
          }} />
          <span style={{ color: "#ffffff", fontSize: 14, fontWeight: 700, letterSpacing: 4 }}>
            LIVE
          </span>
        </div>
        <div style={{ fontSize: 36, fontWeight: 900, color: "#ffffff", lineHeight: 1 }}>
          {displayViewers}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
          <div style={{
            width: 10,
            height: 10,
            backgroundColor: PURPLE,
            transform: "rotate(45deg)",
            borderRadius: 2,
            flexShrink: 0,
          }} />
          <span style={{ fontSize: 12, color: "#ffffff44", letterSpacing: 4 }}>
            VIEWERS
          </span>
        </div>
        <div style={{ marginTop: 8, fontSize: 20, fontWeight: 700, color: PURPLE }}>
          xQcOW
        </div>
        <div style={{ fontSize: 11, color: "#ffffff28", letterSpacing: 3, marginTop: 4 }}>
          JUST CHATTING — {uptimeStr}
        </div>
      </div>
    </AbsoluteFill>
  );
};
