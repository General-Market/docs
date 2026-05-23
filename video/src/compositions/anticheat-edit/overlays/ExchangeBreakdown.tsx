import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { font, monoFont } from "../../../common/fonts";
import { colors } from "../../anticheat/theme";
import { DotGrid, DotGridVignette } from "../../anticheat/DotGrid";
import { IdleZoom, RevealChars } from "../../anticheat/vibe";
import { MECHANISMS, type Mechanism } from "./data";
import { venuesForMechanism, type VenueBrand } from "./logos";

// Per-mechanism subdiagram: the venues documented to run this play, as
// brand cards. Same AntiCheatFull language as the bar charts — light
// field, Base-blue dot grid, idle breath, near-black display type — so
// it reads as the second half of each mechanism's beat.

const FG = colors.fg;
const ACCENT = colors.accent;
const DIM = colors.dim;

const fmtBps = (bps: number): string => {
  if (bps >= 10) return `${bps.toFixed(0)}`;
  if (bps >= 1) return `${bps.toFixed(1).replace(/\.0$/, "")}`;
  if (bps >= 0.01) return `${bps.toFixed(2)}`;
  return `${bps.toFixed(3)}`;
};

export type ExchangeBreakdownProps = {
  mechanismSlug: string;
};

export const ExchangeBreakdown: React.FC<ExchangeBreakdownProps> = ({
  mechanismSlug,
}) => {
  const frame = useCurrentFrame();
  const m = MECHANISMS.find((x) => x.slug === mechanismSlug);
  if (!m) return null;
  const venues = venuesForMechanism(mechanismSlug);

  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg, fontFamily: font }}>
      <IdleZoom durationInFrames={9999} from={1.0} to={1.03}>
        <DotGrid intensity={0.85} speed={1.0} />

        {/* Kicker */}
        <div
          style={{
            position: "absolute",
            top: 110,
            left: 0,
            right: 0,
            textAlign: "center",
            fontFamily: monoFont,
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: ACCENT,
            opacity: interpolate(frame, [2, 14], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          {`Documented at ${venues.length} ${venues.length === 1 ? "venue" : "venues"} · mechanism ${String(m.rank).padStart(2, "0")} / 13`}
        </div>

        {/* Title */}
        <div
          style={{
            position: "absolute",
            top: 148,
            left: 0,
            right: 0,
            textAlign: "center",
            fontFamily: font,
            fontSize: 82,
            fontWeight: 800,
            letterSpacing: "-0.022em",
            lineHeight: 1.0,
            color: FG,
            padding: "0 120px",
          }}
        >
          <RevealChars text={m.name} startFrame={4} stagger={1.0} duration={12} />
        </div>

        {/* Venue cards */}
        <VenueCards venues={venues} accent={ACCENT} />

        {/* Foot: effective bps + the fix */}
        <Foot mechanism={m} frame={frame} />

        <DotGridVignette intensity={0.26} />
      </IdleZoom>
    </AbsoluteFill>
  );
};

const VenueCards: React.FC<{ venues: VenueBrand[]; accent: string }> = ({
  venues,
}) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();

  // Card size steps down as the venue count climbs, so even the busiest
  // mechanism (order-flow visibility, 7 venues) fits the band cleanly.
  const n = venues.length;
  const compact = n > 4;
  const cardW = n > 6 ? 212 : n > 4 ? 238 : 282;
  const cardH = n > 6 ? 182 : n > 4 ? 200 : 228;
  const gap = n > 6 ? 22 : 26;

  return (
    <div
      style={{
        position: "absolute",
        // A fixed band between the title block and the foot, so cards
        // never collide with either. Centered, wrapping only when needed.
        top: 322,
        left: 90,
        right: 90,
        height: 430,
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "center",
        alignContent: "center",
        gap,
      }}
    >
      {venues.map((v, i) => {
        const local = frame - 18 - i * 4;
        const rise = spring({
          fps,
          frame: Math.max(0, local),
          config: { mass: 0.6, damping: 14, stiffness: 120 },
          durationInFrames: 24,
        });
        const op = interpolate(local, [0, 8], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const ty = (1 - rise) * 26;

        return (
          <div
            key={v.slug}
            style={{
              width: cardW,
              height: cardH,
              borderRadius: 22,
              background: colors.surface,
              border: `1px solid ${colors.rule}`,
              boxShadow:
                "0 1px 0 rgba(255,255,255,0.8) inset, 0 18px 40px rgba(8,14,28,0.10), 0 6px 14px rgba(8,14,28,0.06)",
              position: "relative",
              overflow: "hidden",
              opacity: op,
              transform: `translateY(${ty.toFixed(1)}px)`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 18,
            }}
          >
            {/* Top accent bar in brand color */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 6,
                background: v.color,
              }}
            />
            <VenueMark venue={v} compact={compact} />
            {/* The name label is redundant when the mark is itself a
                wordmark — show it only for icon (or fallback) cards. */}
            {v.icon ? (
              <div
                style={{
                  fontFamily: font,
                  fontSize: compact ? 22 : 26,
                  fontWeight: 700,
                  letterSpacing: "-0.016em",
                  color: FG,
                }}
              >
                {v.name}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};

// Render the icon when present, else the wordmark, else a colored
// monogram disc as a last resort.
const VenueMark: React.FC<{ venue: VenueBrand; compact: boolean }> = ({
  venue,
  compact,
}) => {
  const iconSize = compact ? 76 : 92;
  if (venue.icon) {
    return (
      <img
        src={staticFile(venue.icon)}
        alt=""
        draggable={false}
        style={{
          width: iconSize,
          height: iconSize,
          objectFit: "contain",
          display: "block",
        }}
      />
    );
  }
  if (venue.wordmark) {
    return (
      <img
        src={staticFile(venue.wordmark)}
        alt=""
        draggable={false}
        style={{
          width: compact ? 150 : 184,
          height: iconSize,
          objectFit: "contain",
          display: "block",
        }}
      />
    );
  }
  return (
    <div
      style={{
        width: iconSize,
        height: iconSize,
        borderRadius: "50%",
        background: venue.color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: font,
        fontWeight: 800,
        fontSize: iconSize * 0.42,
        color: "#fff",
      }}
    >
      {venue.name.charAt(0)}
    </div>
  );
};

const Foot: React.FC<{ mechanism: Mechanism; frame: number }> = ({
  mechanism,
  frame,
}) => {
  const op = interpolate(frame, [20, 34], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 70,
        textAlign: "center",
        opacity: op,
        padding: "0 120px",
      }}
    >
      <div
        style={{
          fontFamily: font,
          fontSize: 46,
          fontWeight: 800,
          letterSpacing: "-0.022em",
          color: ACCENT,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {fmtBps(mechanism.bps)}
        <span style={{ fontSize: 24, fontWeight: 700, color: DIM, marginLeft: 8 }}>
          bps / trade
        </span>
      </div>
      <div
        style={{
          fontFamily: monoFont,
          fontSize: 19,
          fontWeight: 500,
          letterSpacing: "0.03em",
          color: colors.fgSoft,
          marginTop: 12,
        }}
      >
        {mechanism.fix}
      </div>
    </div>
  );
};
