import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { IdleZoom, RevealChars } from "../../anticheat/vibe";
import { BlueField } from "./BlueField";
import { font, monoFont, scene } from "./tokens";

// SceneFrame — the standard stage for an illustration.
//
//   BlueField  →  optional kicker + title  →  children (the floating content)
//   →  brandmark bottom-left.
//
// Every mechanism illustration mounts inside one of these, so the field, the
// type, and the brand sit in the same place on all thirteen. The whole stage
// gets a slow IdleZoom breath, matching the chart overlays.

type Props = {
  children?: React.ReactNode;
  /** Small mono uppercase line above the title. */
  kicker?: string;
  /** Heavy display headline, glyph-revealed. */
  title?: string;
  /** Bottom-left wordmark. Pass "" to hide. */
  brand?: string;
  /** For the IdleZoom ramp — defaults long so it never overshoots. */
  durationInFrames?: number;
  fieldIntensity?: number;
};

export const SceneFrame: React.FC<Props> = ({
  children,
  kicker,
  title,
  brand = "GENERAL MARKET",
  durationInFrames = 9999,
  fieldIntensity = 1,
}) => {
  const frame = useCurrentFrame();

  const kickerOp = interpolate(frame, [2, 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const brandOp = interpolate(frame, [6, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: scene.blueAbyss, fontFamily: font }}>
      <IdleZoom durationInFrames={durationInFrames} from={1.0} to={1.04}>
        <BlueField intensity={fieldIntensity} />

        {(kicker || title) && (
          <div
            style={{
              position: "absolute",
              top: 104,
              left: 0,
              right: 0,
              textAlign: "center",
              padding: "0 120px",
            }}
          >
            {kicker ? (
              <div
                style={{
                  fontFamily: monoFont,
                  fontSize: 22,
                  fontWeight: 600,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: scene.inkSoft,
                  opacity: kickerOp,
                  marginBottom: 18,
                }}
              >
                {kicker}
              </div>
            ) : null}
            {title ? (
              <div
                style={{
                  fontFamily: font,
                  fontSize: 88,
                  fontWeight: 800,
                  letterSpacing: "-0.022em",
                  lineHeight: 1.0,
                  color: scene.ink,
                }}
              >
                <RevealChars text={title} startFrame={4} stagger={1.1} duration={12} />
              </div>
            ) : null}
          </div>
        )}

        {/* The floating content — flags, logos, diagrams. */}
        {children}

        {brand ? (
          <div
            style={{
              position: "absolute",
              left: 64,
              bottom: 52,
              fontFamily: font,
              fontSize: 30,
              fontWeight: 800,
              letterSpacing: "0.02em",
              color: scene.ink,
              opacity: 0.9 * brandOp,
            }}
          >
            {brand}
          </div>
        ) : null}
      </IdleZoom>
    </AbsoluteFill>
  );
};
