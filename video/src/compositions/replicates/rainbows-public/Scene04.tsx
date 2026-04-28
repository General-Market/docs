import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from "remotion";
import { loadFont as loadDM } from "@remotion/google-fonts/DMSans";

const { fontFamily: dmSansFamily } = loadDM("normal", {
  subsets: ["latin"],
  weights: ["400", "500", "600", "700", "800"],
});

/**
 * Scene 04 — 27.56s to 30.1s (2.54s, ~76 frames at 30fps)
 *
 * Public.com end card. Reference analysis (scene 12):
 *
 * Phase 1 (f0-7):   "public" centered, single blue dot bounces in below text
 * Phase 2 (f7-16):  dot fades out, logo mark (two circles) fades in to left of text
 * Phase 3 (f16-20): ".com" slides/fades in from right
 * Phase 4 (f20-28): tagline fades + slides up
 * Phase 5 (f24-32): app store badges fade + slide up
 * Phase 6 (f35-81): static hold (~1.6s)
 *
 * Timing is compressed and snappy — springs with moderate damping, not slow elegance.
 */

const BLUE = "#042EF4";
const TEXT_COLOR = "#000000";
const TAG_COLOR = "#717171";

/* ── Sizes matched to reference ── */
const LOGO_LARGE = 48;
const LOGO_SMALL = 15;
const LOGO_GAP = 3;
const TEXT_SIZE = 90;
const TAGLINE_SIZE = 25;

export const Scene04: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── Phase 1: Dot bounce ──
  // Very snappy spring — dot should be fully in by frame 2-3
  const dotSpring = spring({
    frame,
    fps,
    config: { damping: 8, mass: 0.3, stiffness: 280 },
  });

  // ── Phase 2: Transition — dot → logo mark + slide left ──
  // Sharper transition: 7→14 (7 frames = ~240ms)
  const transition = interpolate(frame, [7, 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.22, 0.1, 0.25, 1),
  });

  // ── Phase 3: Tagline — appears after wordmark settles ──
  const taglineSpring = spring({
    frame: Math.max(0, frame - 28),
    fps,
    config: { damping: 12, mass: 0.3, stiffness: 140 },
  });
  const taglineProgress = frame < 28 ? 0 : taglineSpring;

  // ── Derived values ──

  // Initial single dot: fades out quickly, drifts upward + left toward logo mark position
  const singleDotOpacity = interpolate(transition, [0, 0.35], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const singleDotY = Math.round(interpolate(transition, [0, 0.5], [0, -18], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  }));
  const singleDotX = Math.round(interpolate(transition, [0, 0.5], [0, -30], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  }));

  // Logo mark (two circles): comes in slightly after dot fades
  const logoMarkOpacity = interpolate(transition, [0.15, 0.5], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const logoMarkScale = spring({
    frame: Math.max(0, frame - 7),
    fps,
    config: { damping: 10, mass: 0.3, stiffness: 180 },
  });

  // Content block shifts up slightly to keep visual center
  const contentShiftY = Math.round(interpolate(frame, [26, 36], [0, -8], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  }));

  const taglineY = Math.round(interpolate(taglineProgress, [0, 1], [8, 0]));

  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse at center, #FFFFFF 0%, #FDFDFD 50%, #F6F6F6 100%)",
        justifyContent: "center",
        alignItems: "center",
        WebkitFontSmoothing: "antialiased",
        MozOsxFontSmoothing: "grayscale",
        textRendering: "optimizeLegibility",
      } as React.CSSProperties}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          transform: `translateY(${contentShiftY + 18}px)`,
        }}
      >
        {/* ── Logo lockup: [mark] [public.com] ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            minHeight: 90,
          }}
        >
          {/* Logo mark — two blue circles, large on top, small below */}
          <div
            style={{
              marginRight: 16,
              opacity: logoMarkOpacity,
              transform: `scale(${logoMarkScale})`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: LOGO_GAP,
              marginTop: 10,
            }}
          >
            <div
              style={{
                width: LOGO_LARGE,
                height: LOGO_LARGE,
                borderRadius: "50%",
                backgroundColor: BLUE,
              }}
            />
            <div
              style={{
                width: LOGO_SMALL,
                height: LOGO_SMALL,
                borderRadius: "50%",
                backgroundColor: BLUE,
              }}
            />
          </div>

          {/* Text */}
          <div style={{ display: "flex", alignItems: "baseline" }}>
            <span
              style={{
                fontSize: TEXT_SIZE,
                fontWeight: 700,
                fontFamily: `${dmSansFamily}, system-ui, sans-serif`,
                color: TEXT_COLOR,
                letterSpacing: -1,
                lineHeight: 1,
                opacity: logoMarkOpacity,
                transform: `translateX(${(1 - logoMarkOpacity) * 12}px)`,
                display: "inline-block",
              }}
            >
              rainbows
            </span>
          </div>

          {/* Single bounce dot — below "public" text, slightly left of center (under "b" area) */}
          <div
            style={{
              position: "absolute",
              left: "45%",
              bottom: -6,
              transform: `translate(-50%, ${18 + singleDotY}px) translateX(${singleDotX}px) scale(${dotSpring})`,
              opacity: singleDotOpacity,
              pointerEvents: "none" as const,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                backgroundColor: BLUE,
              }}
            />
          </div>
        </div>

        {/* ── Tagline ── */}
        <div
          style={{
            marginTop: 18,
            opacity: taglineProgress,
            transform: `translateY(${taglineY}px)`,
          }}
        >
          <span
            style={{
              fontSize: TAGLINE_SIZE,
              fontFamily: `${dmSansFamily}, system-ui, sans-serif`,
              color: TAG_COLOR,
              fontWeight: 400,
              letterSpacing: 0.3,
            }}
          >
            the only trade that's actually yours.
          </span>
        </div>

      </div>
    </AbsoluteFill>
  );
};

export const scene04Meta = {
  id: "RainbowsPublicScene04",
  component: Scene04,
  width: 1280,
  height: 720,
  fps: 29,
  durationInFrames: 81,
};
