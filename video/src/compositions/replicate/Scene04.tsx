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

/* ── Apple logo SVG path (simplified) ── */
const AppleLogo: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg
    width={size}
    height={size * 1.22}
    viewBox="0 0 17 21"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M14.04 11.13c-.02-2.34 1.91-3.47 2-3.52-1.09-1.59-2.78-1.81-3.38-1.83-1.44-.15-2.81.85-3.54.85-.73 0-1.87-.83-3.07-.81-1.58.02-3.04.92-3.85 2.34-1.64 2.85-.42 7.07 1.18 9.38.78 1.13 1.72 2.4 2.94 2.35 1.18-.05 1.63-.76 3.06-.76 1.43 0 1.84.76 3.09.74 1.27-.02 2.08-1.15 2.85-2.29.9-1.31 1.27-2.58 1.29-2.65-.03-.01-2.47-.95-2.57-3.8zM11.68 3.92C12.34 3.12 12.8 2.03 12.67.92c-.95.04-2.1.63-2.78 1.43-.61.71-1.14 1.83-.99 2.91 1.06.08 2.14-.54 2.78-1.34z"
      fill="#000"
    />
  </svg>
);

/* ── Google Play triangle SVG ── */
const GooglePlayLogo: React.FC<{ size?: number }> = ({ size = 22 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M4 2.25L13.65 12 4 21.75V2.25z" fill="#4285F4" />
    <path d="M4 2.25l9.65 9.75L17.2 8.6 6.6 1.35 4 2.25z" fill="#34A853" />
    <path d="M4 21.75l9.65-9.75 3.55 3.4L6.6 22.65 4 21.75z" fill="#EA4335" />
    <path
      d="M17.2 8.6L13.65 12l3.55 3.4 4-2.28c.45-.26.45-.9 0-1.16L17.2 8.6z"
      fill="#FBBC04"
    />
  </svg>
);

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

  // ".com" fades in — frames 26-32 (after logo mark settles)
  const comOpacity = interpolate(frame, [26, 32], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const comSlideX = interpolate(frame, [26, 32], [8, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // ── Phase 3: Tagline — appears after .com begins ──
  const taglineSpring = spring({
    frame: Math.max(0, frame - 28),
    fps,
    config: { damping: 12, mass: 0.3, stiffness: 140 },
  });
  const taglineProgress = frame < 28 ? 0 : taglineSpring;

  // ── Phase 4: Badges — follow tagline closely ──
  const badgesSpring = spring({
    frame: Math.max(0, frame - 32),
    fps,
    config: { damping: 10, mass: 0.25, stiffness: 200 },
  });
  const badgesProgress = frame < 32 ? 0 : badgesSpring;

  // ── Derived values ──

  // Initial single dot: fades out quickly, drifts upward + left toward logo mark position
  const singleDotOpacity = interpolate(transition, [0, 0.35], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const singleDotY = interpolate(transition, [0, 0.5], [0, -18], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const singleDotX = interpolate(transition, [0, 0.5], [0, -30], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

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
  const contentShiftY = interpolate(frame, [26, 36], [0, -8], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const taglineY = interpolate(taglineProgress, [0, 1], [8, 0]);
  const badgesY = interpolate(badgesProgress, [0, 1], [10, 0]);

  // Badge scale — subtle pop
  const badgesScaleRaw = spring({
    frame: Math.max(0, frame - 32),
    fps,
    config: { damping: 10, mass: 0.25, stiffness: 180 },
  });
  const badgesScaleValue = frame < 32 ? 0.97 : 0.97 + 0.03 * badgesScaleRaw;

  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse at center, #FFFFFF 0%, #FDFDFD 50%, #F6F6F6 100%)",
        justifyContent: "center",
        alignItems: "center",
      }}
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
              }}
            >
              public
            </span>
            <span
              style={{
                fontSize: TEXT_SIZE,
                fontWeight: 700,
                fontFamily: `${dmSansFamily}, system-ui, sans-serif`,
                color: TEXT_COLOR,
                letterSpacing: -1,
                lineHeight: 1,
                opacity: comOpacity,
                transform: `translateX(${comSlideX}px)`,
                display: "inline-block",
              }}
            >
              .com
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
            Stocks, Treasuries, Crypto, & More
          </span>
        </div>

        {/* ── App store badges ── */}
        <div
          style={{
            display: "flex",
            gap: 24,
            marginTop: 28,
            opacity: badgesProgress,
            transform: `translateY(${badgesY}px) scale(${badgesScaleValue})`,
          }}
        >
          {/* Apple App Store */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              border: "1px solid #DDDDDD",
              borderRadius: 12,
              padding: "12px 26px",
              backgroundColor: "#FFFFFF",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}
          >
            <AppleLogo size={26} />
            <div
              style={{
                display: "flex",
                flexDirection: "column",
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontFamily: `${dmSansFamily}, system-ui`,
                  color: "#000",
                  lineHeight: 1.1,
                  fontWeight: 400,
                }}
              >
                Download on the
              </span>
              <span
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  fontFamily: `${dmSansFamily}, system-ui`,
                  color: "#000",
                  lineHeight: 1.3,
                }}
              >
                App Store
              </span>
            </div>
          </div>

          {/* Google Play */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              border: "1px solid #DDDDDD",
              borderRadius: 12,
              padding: "12px 26px",
              backgroundColor: "#FFFFFF",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}
          >
            <GooglePlayLogo size={26} />
            <div
              style={{
                display: "flex",
                flexDirection: "column",
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontFamily: `${dmSansFamily}, system-ui`,
                  color: "#000",
                  lineHeight: 1.1,
                  letterSpacing: 1,
                  textTransform: "uppercase" as const,
                  fontWeight: 400,
                }}
              >
                GET IT ON
              </span>
              <span
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  fontFamily: `${dmSansFamily}, system-ui`,
                  color: "#000",
                  lineHeight: 1.3,
                }}
              >
                Google Play
              </span>
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const scene04Meta = {
  id: "ReplicateScene04",
  component: Scene04,
  width: 1280,
  height: 720,
  fps: 29,
  durationInFrames: 81,
};
