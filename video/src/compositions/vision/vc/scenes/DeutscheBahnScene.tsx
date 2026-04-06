import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  useVideoConfig,
} from "remotion";

/* ─── Train data ─── */
const TRAINS: {
  type: string;
  dest: string;
  time: string;
  platform: string;
  delay: string;
  newPlatform?: string;
}[] = [
  { type: "ICE 578", dest: "München Hbf", time: "18:03", platform: "7", delay: "+12 min" },
  { type: "IC 2229", dest: "Hamburg Hbf", time: "18:07", platform: "14", delay: "+23 min" },
  { type: "RE 4861", dest: "Berlin Hbf", time: "18:11", platform: "3", delay: "+8 min" },
  { type: "ICE 1091", dest: "Frankfurt (Main)", time: "18:15", platform: "11", delay: "+31 min", newPlatform: "18" },
  { type: "IC 2374", dest: "Köln Hbf", time: "18:18", platform: "5", delay: "+17 min" },
  { type: "ICE 693", dest: "Stuttgart Hbf", time: "18:22", platform: "9", delay: "+45 min" },
  { type: "RE 7012", dest: "Düsseldorf Hbf", time: "18:26", platform: "2", delay: "+19 min", newPlatform: "6" },
  { type: "ICE 1587", dest: "Leipzig Hbf", time: "18:30", platform: "8", delay: "+54 min" },
  { type: "IC 2048", dest: "Dresden Hbf", time: "18:34", platform: "12", delay: "Ausfall" },
  { type: "RE 3320", dest: "Hannover Hbf", time: "18:38", platform: "6", delay: "+27 min" },
  { type: "ICE 774", dest: "Nürnberg Hbf", time: "18:41", platform: "4", delay: "+11 min" },
  { type: "IC 2156", dest: "Bremen Hbf", time: "18:45", platform: "10", delay: "+38 min" },
];

const AMBER = "#f59e0b";
const RED = "#dc2626";

/* Characters the split-flap scrambles through */
const FLAP_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789äöü :-+";

/**
 * Deterministic pseudo-random from seed.
 * Returns 0–1. Good enough for visual jitter.
 */
const seededRandom = (seed: number): number => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * Split-flap effect for a single character.
 * Before `settleFrame`, it scrambles. After, it shows the real char.
 */
const flapChar = (
  real: string,
  frame: number,
  settleFrame: number,
  charIndex: number,
): string => {
  const charSettle = settleFrame + charIndex * 2;
  if (frame >= charSettle) return real;
  if (frame < settleFrame - 10) return real === " " ? " " : " ";
  // scramble phase
  const seed = frame * 13 + charIndex * 7;
  const idx = Math.floor(seededRandom(seed) * FLAP_CHARS.length);
  return FLAP_CHARS[idx];
};

/**
 * Apply split-flap to an entire string.
 */
const flapString = (
  text: string,
  frame: number,
  settleFrame: number,
): string => {
  return text
    .split("")
    .map((ch, ci) => flapChar(ch, frame, settleFrame, ci))
    .join("");
};

/* ─── Component ─── */

export const DeutscheBahnScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  /* Header slide-in */
  const headerY = interpolate(frame, [0, 20], [-60, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  /* Clock: 18:03 ticks to 18:04 at ~4 seconds */
  const clockMinute = frame < fps * 4 ? "03" : "04";
  const clockText = `18:${clockMinute}`;
  const clockFlicker = interpolate(
    Math.sin(frame * 0.05),
    [-1, 1],
    [0.75, 1],
  );

  /* CRT scan-line: a single bright horizontal line that drifts downward */
  const scanY = ((frame * 1.8) % 1100);

  /* Ausfall blink — hard square wave, ~4Hz */
  const ausfallBlink = Math.sin(frame * 0.8) > 0 ? 1 : 0.15;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "transparent",
        fontFamily: "'Courier New', 'Consolas', monospace",
      }}
    >
      {/* Static scan-lines (CRT raster) */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 3px,
            rgba(0,0,0,0.08) 3px,
            rgba(0,0,0,0.08) 4px
          )`,
          pointerEvents: "none",
          zIndex: 10,
        }}
      />

      {/* Ambient CRT hum — single scrolling bright line */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: scanY,
          height: 2,
          background: `linear-gradient(90deg, transparent 0%, rgba(245,158,11,0.04) 20%, rgba(245,158,11,0.07) 50%, rgba(245,158,11,0.04) 80%, transparent 100%)`,
          pointerEvents: "none",
          zIndex: 11,
        }}
      />

      {/* Header */}
      <div
        style={{
          position: "absolute",
          top: 40 + headerY,
          left: 80,
          right: 80,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          borderBottom: `2px solid ${AMBER}22`,
          paddingBottom: 16,
        }}
      >
        <span
          style={{
            color: AMBER,
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: 4,
            textShadow: `0 0 12px ${AMBER}33`,
          }}
        >
          ABFAHRT / DEPARTURES
        </span>
        <span style={{ color: AMBER, fontSize: 20, opacity: 0.4 }}>
          Frankfurt (Main) Hbf
        </span>
      </div>

      {/* Clock — top right */}
      <div
        style={{
          position: "absolute",
          top: 44 + headerY,
          right: 80,
          color: AMBER,
          fontSize: 34,
          fontWeight: 700,
          letterSpacing: 3,
          opacity: clockFlicker * 0.85,
          textShadow: `0 0 10px ${AMBER}44`,
        }}
      >
        {flapString(clockText, frame, 8)}
      </div>

      {/* Column headers */}
      <div
        style={{
          position: "absolute",
          top: 110,
          left: 80,
          right: 80,
          display: "flex",
          gap: 0,
          color: AMBER,
          fontSize: 16,
          opacity: 0.3,
          letterSpacing: 2,
          textShadow: `0 0 6px ${AMBER}11`,
        }}
      >
        <span style={{ width: 120 }}>ZEIT</span>
        <span style={{ width: 130 }}>ZUG</span>
        <span style={{ flex: 1 }}>ZIEL</span>
        <span style={{ width: 120, textAlign: "center" }}>GLEIS</span>
        <span style={{ width: 200, textAlign: "right" }}>STATUS</span>
      </div>

      {/* Rows */}
      {TRAINS.map((train, i) => {
        const rowDelay = i * 8;
        const rowOpacity = interpolate(frame, [rowDelay, rowDelay + 12], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        const delayStart = 30 + i * 7;
        const delayOpacity = interpolate(
          frame,
          [delayStart, delayStart + 10],
          [0, 1],
          {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          },
        );

        const isAusfall = train.delay === "Ausfall";
        const delayColor = isAusfall ? "#ff4444" : RED;

        /* For non-Ausfall rows: gentle flicker. For Ausfall: aggressive blink. */
        const delayFlicker =
          delayOpacity > 0
            ? isAusfall
              ? ausfallBlink
              : interpolate(
                  Math.sin(frame * 0.3 + i * 2),
                  [-1, 1],
                  [0.85, 1],
                )
            : 0;

        /* Split-flap settle frame for this row */
        const flapSettle = 12 + i * 6;

        const hasPlatformChange = !!train.newPlatform;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              top: 148 + i * 68,
              left: 80,
              right: 80,
              display: "flex",
              alignItems: "center",
              height: 56,
              opacity: rowOpacity,
              borderBottom: "1px solid #ffffff06",
              background:
                isAusfall && delayOpacity > 0.5
                  ? `rgba(255,68,68,${0.04 + 0.04 * ausfallBlink})`
                  : delayOpacity > 0.5
                    ? `${RED}06`
                    : "transparent",
            }}
          >
            {/* Time */}
            <span
              style={{
                width: 120,
                color: AMBER,
                fontSize: 30,
                fontWeight: 700,
                textShadow: `0 0 8px ${AMBER}33`,
              }}
            >
              {flapString(train.time, frame, flapSettle)}
            </span>

            {/* Train type */}
            <span
              style={{
                width: 130,
                color: AMBER,
                fontSize: 22,
                fontWeight: 600,
                opacity: 0.6,
                letterSpacing: 1,
                textShadow: `0 0 6px ${AMBER}22`,
              }}
            >
              {flapString(train.type, frame, flapSettle)}
            </span>

            {/* Destination */}
            <span
              style={{
                flex: 1,
                color: delayOpacity > 0.5 ? "#ffffff77" : AMBER,
                fontSize: 28,
                fontWeight: 600,
                letterSpacing: 1,
                textShadow: `0 0 8px ${AMBER}22`,
                textDecoration: isAusfall && delayOpacity > 0.5 ? "line-through" : "none",
                textDecorationColor: "#ff4444",
              }}
            >
              {flapString(train.dest, frame, flapSettle)}
            </span>

            {/* Platform — with optional Gleisänderung */}
            <span
              style={{
                width: 120,
                textAlign: "center",
                fontSize: 28,
                fontWeight: 700,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: 8,
              }}
            >
              {hasPlatformChange && delayOpacity > 0.5 ? (
                <>
                  <span
                    style={{
                      color: AMBER,
                      opacity: 0.35,
                      textDecoration: "line-through",
                      textDecorationColor: "#ff4444",
                      fontSize: 22,
                    }}
                  >
                    {train.platform}
                  </span>
                  <span
                    style={{
                      color: "#fbbf24",
                      fontSize: 30,
                      fontWeight: 700,
                      textShadow: `0 0 10px #fbbf2444`,
                    }}
                  >
                    {train.newPlatform}
                  </span>
                </>
              ) : (
                <span
                  style={{
                    color: AMBER,
                    textShadow: `0 0 6px ${AMBER}22`,
                  }}
                >
                  {flapString(train.platform, frame, flapSettle)}
                </span>
              )}
            </span>

            {/* Status */}
            <span
              style={{
                width: 200,
                textAlign: "right",
                fontSize: isAusfall ? 24 : 22,
                fontWeight: 700,
                color: delayColor,
                opacity: delayOpacity * delayFlicker,
                letterSpacing: isAusfall ? 3 : 1,
                textShadow: isAusfall
                  ? `0 0 12px #ff444466`
                  : `0 0 6px ${RED}33`,
              }}
            >
              {delayOpacity > 0.01
                ? isAusfall
                  ? "AUSFALL"
                  : `Verspätet ${train.delay}`
                : "Pünktlich"}
            </span>
          </div>
        );
      })}

      {/* "Gleis änderung" indicator for rows with platform changes */}
      {TRAINS.map((train, i) => {
        if (!train.newPlatform) return null;
        const delayStart = 30 + i * 7;
        const delayOpacity = interpolate(
          frame,
          [delayStart, delayStart + 10],
          [0, 1],
          {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          },
        );
        if (delayOpacity < 0.5) return null;

        const tagOpacity = interpolate(
          frame,
          [delayStart + 10, delayStart + 18],
          [0, 1],
          {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          },
        );

        return (
          <div
            key={`gleis-${i}`}
            style={{
              position: "absolute",
              top: 148 + i * 68 + 42,
              left: 80 + 120 + 130,
              fontSize: 13,
              fontWeight: 600,
              color: "#fbbf24",
              opacity: tagOpacity * 0.6,
              letterSpacing: 1,
              textShadow: "0 0 6px #fbbf2433",
            }}
          >
            Gleis änderung → {train.newPlatform}
          </div>
        );
      })}

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
          zIndex: 15,
        }}
      >
        <div style={{ color: AMBER, fontSize: 13, letterSpacing: 3, opacity: 0.7, marginBottom: 8 }}>
          ABFAHRT — Frankfurt Hbf
        </div>
        <div style={{ color: AMBER, fontSize: 28, fontWeight: 700, opacity: clockFlicker, letterSpacing: 2 }}>
          {flapString(clockText, frame, 8)}
        </div>
        <div style={{ color: RED, fontSize: 14, fontWeight: 600, marginTop: 8, letterSpacing: 1 }}>
          12 ZÜGE — 11 VERSPÄTET — 1 AUSFALL
        </div>
      </div>
    </AbsoluteFill>
  );
};
