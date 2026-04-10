import React from "react";
import {
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { FPS } from "../theme";
import { useTalkingHead } from "../TalkingHeadLayout";
import { FONT } from "../designTokens";
import { useDesignTokens } from "../TutorialTheme";
import { Sfx } from "../components/Sfx";
import { WHOOSH, PLOB } from "../sfxMap";

const sec = (s: number) => Math.round(s * FPS);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const SCENE_START = 278.5;
const SCENE_END = 280.8;

const TAKEAWAYS = [
  "Trade anything with data — trains, streamers, memecoins, weather",
  "Sealed bets, no front-running, instant parimutuel settlement",
  "Your bot finds the edge. 500,000 markets. Nobody watching.",
];

export const ExperienceDevicesOverlay: React.FC = () => {
  const { COLOR } = useDesignTokens();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { contentArea } = useTalkingHead();

  const currentSec = frame / fps;
  if (currentSec < SCENE_START || currentSec >= SCENE_END) return null;
  if (!contentArea) return null;

  const f = frame - sec(SCENE_START);

  // Panel fade + slide in
  const panelProgress = spring({
    frame: Math.max(f - 4, 0),
    fps,
    config: { damping: 18, stiffness: 100, mass: 0.8 },
  });
  const panelX = interpolate(panelProgress, [0, 1], [80, 0], clamp);
  const panelOpacity = interpolate(f, [4, 14], [0, 1], clamp);

  return (
    <Sfx sound={[
      { at: 4, sound: WHOOSH },
      { at: 10, sound: PLOB },
      { at: 18, sound: PLOB },
      { at: 26, sound: PLOB },
    ]}>
    <div
      style={{
        position: "absolute",
        left: contentArea.x,
        top: contentArea.y,
        width: contentArea.w,
        height: contentArea.h,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "0 56px",
        pointerEvents: "none",
        opacity: panelOpacity,
        transform: `translateX(${panelX}px)`,
      }}
    >
      {/* Header */}
      <div
        style={{
          fontFamily: FONT.display,
          fontSize: 52,
          fontWeight: 900,
          fontStyle: "italic",
          color: COLOR.nearBlack,
          lineHeight: 1.1,
          marginBottom: 8,
        }}
      >
        Key takeaways
      </div>
      <div
        style={{
          fontFamily: FONT.display,
          fontSize: 52,
          fontWeight: 900,
          fontStyle: "italic",
          color: COLOR.nearBlack,
          lineHeight: 1.1,
          marginBottom: 36,
        }}
      >
        General Market:
      </div>

      {/* Takeaway items */}
      {TAKEAWAYS.map((text, i) => {
        const itemDelay = 10 + i * 8;
        const itemProgress = spring({
          frame: Math.max(f - itemDelay, 0),
          fps,
          config: { damping: 16, stiffness: 90, mass: 0.7 },
        });
        const itemOpacity = interpolate(f, [itemDelay, itemDelay + 8], [0, 1], clamp);
        const itemX = interpolate(itemProgress, [0, 1], [40, 0], clamp);

        return (
          <div
            key={i}
            style={{
              opacity: itemOpacity,
              transform: `translateX(${itemX}px)`,
            }}
          >
            {/* Separator line */}
            <div
              style={{
                height: 1,
                background: COLOR.border,
                marginBottom: 16,
              }}
            />
            <div
              style={{
                fontFamily: FONT.body,
                fontSize: 28,
                fontWeight: 600,
                color: COLOR.nearBlack,
                lineHeight: 1.4,
                marginBottom: 16,
              }}
            >
              <span style={{ color: COLOR.wiseGreen, marginRight: 12 }}>{i + 1}.</span>
              {text}
            </div>
          </div>
        );
      })}
    </div>
    </Sfx>
  );
};
