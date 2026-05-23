import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { font } from "../../common/fonts";
import { FPS, H, W, colors } from "./theme";
import { DotGrid, DotGridVignette, useGridIntensity } from "./DotGrid";
import { IdleZoom, RevealChars } from "./vibe";
import { GROUP_ORDER, byGroup, type Flag, type FlagGroup } from "./thirteen";

// 6-second composition. Reveals the 13 mechanisms as four named columns
// of numbered boxes, image #2's tree structure rendered in AntiCheatFull's
// light field + Base blue palette. Title in, headers in, boxes cascade
// down each column in turn.

const SCENE_SECONDS = 6;
const SCENE_FRAMES = SCENE_SECONDS * FPS;

const TITLE_IN = 4;
const HEADERS_IN = 26;
const COLUMN_STAGGER = 6;
const BOX_STAGGER = 5;
const BOX_IN_DURATION = 14;

const TITLE_TOP = 96;
const SUBTITLE_TOP = 196;
const HEADERS_TOP = 308;
const FIRST_BOX_TOP = 412;
const BOX_HEIGHT = 96;
const BOX_GAP = 18;
const HEADER_HEIGHT = 64;
const CONNECTOR_GAP = 14;

const COLUMN_X: Record<FlagGroup, number> = {
  "Pre-trade leak": 240,
  "Middleman fee": 720,
  "On-chain ambush": 1200,
  "Forced moves": 1680,
};
const COLUMN_WIDTH = 360;

// Reveal helper. Spring + scale + opacity, anchored to a target frame.
const useEnter = (target: number, mass = 0.6) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({
    fps,
    frame: frame - target,
    config: { damping: 200, stiffness: 180, mass },
    durationInFrames: BOX_IN_DURATION,
  });
};

const NumberedBox: React.FC<{
  flag: Flag;
  appearAt: number;
  isLast: boolean;
}> = ({ flag, appearAt, isLast }) => {
  const t = useEnter(appearAt);
  const opacity = t;
  const lift = (1 - t) * 12;
  return (
    <div
      style={{
        position: "relative",
        opacity,
        transform: `translate3d(0, ${lift.toFixed(2)}px, 0)`,
        willChange: "transform, opacity",
      }}
    >
      <div
        style={{
          position: "relative",
          width: COLUMN_WIDTH,
          height: BOX_HEIGHT,
          borderRadius: 18,
          background: colors.surface,
          border: `1.5px solid ${colors.accent}`,
          boxShadow: `0 0 0 4px ${colors.accentTint}, 0 18px 40px rgba(0, 28, 92, 0.10)`,
          display: "grid",
          gridTemplateColumns: "78px 1fr",
          alignItems: "center",
        }}
      >
        <div
          style={{
            justifySelf: "center",
            fontFamily: font,
            fontWeight: 700,
            fontSize: 44,
            lineHeight: 1,
            color: colors.accent,
            letterSpacing: "-0.04em",
          }}
        >
          {flag.rank}
        </div>
        <div
          style={{
            paddingRight: 22,
            fontFamily: font,
            fontWeight: 600,
            fontSize: 22,
            lineHeight: 1.1,
            color: colors.fg,
            letterSpacing: "-0.022em",
          }}
        >
          {flag.display}
        </div>
      </div>
      {!isLast && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: BOX_HEIGHT,
            width: 2,
            height: BOX_GAP,
            background: colors.accent,
            opacity: 0.55,
            transform: "translateX(-50%)",
          }}
        />
      )}
    </div>
  );
};

const ColumnHeader: React.FC<{ label: string; appearAt: number }> = ({
  label,
  appearAt,
}) => {
  const t = useEnter(appearAt, 0.4);
  return (
    <div
      style={{
        position: "relative",
        opacity: t,
        transform: `translate3d(0, ${((1 - t) * 10).toFixed(2)}px, 0)`,
        willChange: "transform, opacity",
      }}
    >
      <div
        style={{
          width: COLUMN_WIDTH,
          height: HEADER_HEIGHT,
          borderRadius: 14,
          background: colors.accent,
          boxShadow: `0 0 0 4px ${colors.accentTint}, 0 14px 32px rgba(0, 28, 92, 0.18)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 22px",
        }}
      >
        <span
          style={{
            fontFamily: font,
            fontWeight: 700,
            fontSize: 22,
            color: colors.surface,
            letterSpacing: "-0.018em",
            textTransform: "uppercase",
          }}
        >
          {label}
        </span>
      </div>
      {/* connector down to the first box */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: HEADER_HEIGHT,
          width: 2,
          height: CONNECTOR_GAP * 2 + (FIRST_BOX_TOP - HEADERS_TOP - HEADER_HEIGHT - CONNECTOR_GAP * 2),
          background: colors.accent,
          opacity: 0.55,
          transform: "translateX(-50%)",
        }}
      />
    </div>
  );
};

export const AntiCheatThirteenTree: React.FC = () => {
  const frame = useCurrentFrame();
  const gridIntensity = useGridIntensity(8, SCENE_FRAMES - 12, 12);

  const titleFade = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg, fontFamily: font }}>
      <DotGrid intensity={gridIntensity * 0.75} speed={0.5} />
      <DotGridVignette intensity={0.22} />

      <IdleZoom durationInFrames={SCENE_FRAMES} from={1.0} to={1.03}>
        {/* Title block */}
        <div
          style={{
            position: "absolute",
            top: TITLE_TOP,
            left: 0,
            right: 0,
            textAlign: "center",
            opacity: titleFade,
          }}
        >
          <div
            style={{
              fontSize: 88,
              fontWeight: 800,
              lineHeight: 1,
              color: colors.fg,
              letterSpacing: "-0.04em",
            }}
          >
            <RevealChars text="Thirteen ways" startFrame={TITLE_IN} stagger={1.4} duration={14} />
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            top: SUBTITLE_TOP,
            left: 0,
            right: 0,
            textAlign: "center",
            opacity: interpolate(frame, [TITLE_IN + 18, TITLE_IN + 30], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          <span
            style={{
              fontSize: 28,
              fontWeight: 500,
              color: colors.dim,
              letterSpacing: "-0.018em",
            }}
          >
            the venue takes a bite
          </span>
        </div>

        {/* Four columns */}
        {GROUP_ORDER.map((group, colIdx) => {
          const flags = byGroup(group);
          const columnAppearAt = HEADERS_IN + colIdx * COLUMN_STAGGER;
          const centerX = COLUMN_X[group];
          return (
            <div key={group}>
              <div
                style={{
                  position: "absolute",
                  top: HEADERS_TOP,
                  left: centerX - COLUMN_WIDTH / 2,
                  width: COLUMN_WIDTH,
                }}
              >
                <ColumnHeader label={group} appearAt={columnAppearAt} />
              </div>
              {flags.map((flag, boxIdx) => {
                const boxAppearAt =
                  columnAppearAt + 10 + boxIdx * BOX_STAGGER;
                const top = FIRST_BOX_TOP + boxIdx * (BOX_HEIGHT + BOX_GAP);
                return (
                  <div
                    key={flag.slug}
                    style={{
                      position: "absolute",
                      top,
                      left: centerX - COLUMN_WIDTH / 2,
                      width: COLUMN_WIDTH,
                    }}
                  >
                    <NumberedBox
                      flag={flag}
                      appearAt={boxAppearAt}
                      isLast={boxIdx === flags.length - 1}
                    />
                  </div>
                );
              })}
            </div>
          );
        })}
      </IdleZoom>
    </AbsoluteFill>
  );
};

export const antiCheatThirteenTreeMeta = {
  id: "AntiCheatThirteenTree",
  component: AntiCheatThirteenTree,
  durationInFrames: SCENE_FRAMES,
  fps: FPS,
  width: W,
  height: H,
};
