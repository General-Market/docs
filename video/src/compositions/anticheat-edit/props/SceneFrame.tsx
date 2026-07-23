import React from "react";
import { AbsoluteFill } from "remotion";
import { IdleZoom, RevealChars } from "../../anticheat/vibe";
import { BlueField } from "./BlueField";
import { font, scene } from "./tokens";

// SceneFrame — the standard stage for an illustration.
//
//   BlueField  →  title  →  children (the floating content)
//
// Every mechanism illustration mounts inside one of these, so the field and
// the type sit in the same place on all thirteen. The whole stage gets a slow
// IdleZoom breath, matching the chart overlays. No eyebrow, no brandmark — the
// ChapterRail names the mechanism, so each schematic carries only its headline.

type Props = {
  children?: React.ReactNode;
  /** Heavy display headline, glyph-revealed. */
  title?: string;
  /** For the IdleZoom ramp — defaults long so it never overshoots. */
  durationInFrames?: number;
  fieldIntensity?: number;
};

export const SceneFrame: React.FC<Props> = ({
  children,
  title,
  durationInFrames = 9999,
  fieldIntensity = 1,
}) => {
  return (
    <AbsoluteFill style={{ backgroundColor: scene.blueAbyss, fontFamily: font }}>
      <IdleZoom durationInFrames={durationInFrames} from={1.0} to={1.04}>
        <BlueField intensity={fieldIntensity} />

        {title ? (
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
          </div>
        ) : null}

        {/* The floating content — flags, logos, diagrams. */}
        {children}
      </IdleZoom>
    </AbsoluteFill>
  );
};
