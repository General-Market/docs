/**
 * DataBadge — source identifier watermark (center-bottom)
 *
 * Full-color company logo at 100px with the brand name below.
 * No pill, no dark rectangle — just the logo and text floating
 * over the scene with drop shadows for legibility.
 * Fades in with a 10-frame slide upward, fades out over the last 10 frames.
 */
import React from "react";
import { Img, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";

type DataSource =
  | "db"
  | "mcdonalds"
  | "steam"
  | "twitch"
  | "fourchan"
  | "pumpfun"
  | "military"
  | "solar";

interface DataBadgeProps {
  source: DataSource;
  /** Entrance delay in frames (default 0) */
  delay?: number;
}

const SOURCE_META: Record<
  DataSource,
  { logo: string; label: string }
> = {
  db: { logo: "compositions/vision-vc/logos/db-logo.svg", label: "DEUTSCHE BAHN" },
  mcdonalds: { logo: "compositions/vision-vc/logos/mcdonalds-logo.svg", label: "McDONALD'S" },
  steam: { logo: "compositions/vision-vc/logos/steam-logo.svg", label: "STEAM" },
  twitch: { logo: "compositions/vision-vc/logos/twitch-logo.svg", label: "TWITCH" },
  fourchan: { logo: "compositions/vision-vc/logos/4chan-logo.webp", label: "4CHAN /BIZ/" },
  pumpfun: { logo: "compositions/vision-vc/logos/pumpfun-logo.webp", label: "PUMP.FUN" },
  military: { logo: "compositions/vision-vc/logos/milaircraft-logo.webp", label: "ADS-B EXCHANGE" },
  solar: { logo: "compositions/vision-vc/logos/noaa-logo.svg", label: "NOAA SWPC" },
};

const EXIT_FRAMES = 10;

export const DataBadge: React.FC<DataBadgeProps> = ({
  source,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const { logo } = SOURCE_META[source];

  // --- Entrance: spring scale + translateY ---
  const entranceSpring = spring({
    frame: Math.max(0, frame - delay),
    fps,
    config: { damping: 12, mass: 0.8 },
  });

  const entranceOpacity = interpolate(entranceSpring, [0, 0.5], [0, 1], { extrapolateRight: "clamp" });
  const translateY = interpolate(entranceSpring, [0, 1], [30, 0]);
  const scale = interpolate(entranceSpring, [0, 1], [0.8, 1]);

  // --- Exit: fade out over last EXIT_FRAMES ---
  const exitStart = durationInFrames - EXIT_FRAMES;
  const exitProgress = interpolate(
    frame,
    [exitStart, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const opacity = Math.min(entranceOpacity, exitProgress);

  if (opacity <= 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 60,
        left: "50%",
        opacity,
        transform: `translateX(-50%) translateY(${translateY}px) scale(${scale})`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        userSelect: "none",
      }}
    >
      <Img
        src={staticFile(logo)}
        style={{
          width: 220,
          height: 220,
          objectFit: "contain",
          filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.9))",
        }}
      />
    </div>
  );
};
