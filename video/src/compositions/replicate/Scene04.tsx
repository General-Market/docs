import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/Nunito";

const { fontFamily: nunitoFamily } = loadFont("normal", {
  subsets: ["latin"],
  weights: ["400", "600", "700", "800"],
});

/**
 * Scene 04 — 27.56s to 30.1s (2.54s, ~76 frames at 30fps)
 *
 * Public.com end card. Reference analysis (scene 12):
 *
 * Phase 1 (f0-15):  "public" centered, single blue dot bounces in below text
 * Phase 2 (f12-24): dot splits into two-circle logo mark, slides left of text;
 *                    ".com" appears; lockup centers
 * Phase 3 (f20-28): tagline fades in below
 * Phase 4 (f24-32): app store badges fade in
 * Phase 5 (f32-76): hold
 */

const BLUE = "#042EF4";
const TEXT_COLOR = "#111111";
const TAG_COLOR = "#444444";

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
  // Starts at scale 0, rapidly bounces to 1 with overshoot
  const dotSpring = spring({
    frame,
    fps,
    config: { damping: 10, mass: 0.5, stiffness: 180 },
  });

  // ── Phase 2: Transition — dot → logo mark + slide left ──
  // Compressed: starts frame 10, finishes by frame 20
  const transition = interpolate(frame, [10, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.25, 0.1, 0.25, 1),
  });

  // ".com" fades in AFTER logo mark has settled — frames 18-24
  const comOpacity = interpolate(frame, [18, 24], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── Phase 3: Tagline — spring for organic feel ──
  const taglineSpring = spring({
    frame: Math.max(0, frame - 18),
    fps,
    config: { damping: 14, mass: 0.4, stiffness: 100 },
  });
  const taglineProgress = frame < 18 ? 0 : taglineSpring;

  // ── Phase 4: Badges — spring with slight overshoot ──
  const badgesSpring = spring({
    frame: Math.max(0, frame - 24),
    fps,
    config: { damping: 12, mass: 0.5, stiffness: 90 },
  });
  const badgesProgress = frame < 24 ? 0 : badgesSpring;

  // ── Derived values ──

  // Initial single dot: visible in phase 1, fades as transition starts
  const singleDotOpacity = interpolate(transition, [0, 0.35], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const singleDotY = interpolate(transition, [0, 0.5], [0, -20], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Logo mark (two circles): fades in during transition
  const logoMarkOpacity = interpolate(transition, [0.15, 0.55], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const logoMarkScale = spring({
    frame: Math.max(0, frame - 10),
    fps,
    config: { damping: 12, mass: 0.4, stiffness: 140 },
  });

  // Content block shifts up slightly to keep visual center as more items appear below
  const contentShiftY = interpolate(frame, [18, 32], [0, -10], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const taglineY = interpolate(taglineProgress, [0, 1], [8, 0]);
  const badgesY = interpolate(badgesProgress, [0, 1], [10, 0]);

  // Badge scale — slight overshoot for "pop" feel
  const badgesScale = spring({
    frame: Math.max(0, frame - 24),
    fps,
    config: { damping: 10, mass: 0.3, stiffness: 150 },
  });
  const badgesScaleValue = frame < 24 ? 0.95 : 0.95 + 0.05 * badgesScale;

  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse at center, #FFFFFF 0%, #FAFAFA 50%, #F2F2F2 100%)",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          transform: `translateY(${contentShiftY}px)`,
        }}
      >
        {/* ── Logo lockup: [mark] [public.com] ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            minHeight: 80,
          }}
        >
          {/* Logo mark — two blue circles, large on top, small below */}
          <div
            style={{
              marginRight: 14,
              opacity: logoMarkOpacity,
              transform: `scale(${logoMarkScale})`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: "50%",
                backgroundColor: BLUE,
              }}
            />
            <div
              style={{
                width: 17,
                height: 17,
                borderRadius: "50%",
                backgroundColor: BLUE,
              }}
            />
          </div>

          {/* Text */}
          <div style={{ display: "flex", alignItems: "baseline" }}>
            <span
              style={{
                fontSize: 76,
                fontWeight: 700,
                fontFamily: `${nunitoFamily}, system-ui, sans-serif`,
                color: TEXT_COLOR,
                letterSpacing: -1,
                lineHeight: 1,
              }}
            >
              public
            </span>
            <span
              style={{
                fontSize: 76,
                fontWeight: 700,
                fontFamily: `${nunitoFamily}, system-ui, sans-serif`,
                color: TEXT_COLOR,
                letterSpacing: -1,
                lineHeight: 1,
                opacity: comOpacity,
              }}
            >
              .com
            </span>
          </div>

          {/* Single bounce dot — below "public" text, slightly left of center */}
          <div
            style={{
              position: "absolute",
              left: "44%",
              bottom: -14,
              transform: `translate(-50%, ${24 + singleDotY}px) scale(${dotSpring})`,
              opacity: singleDotOpacity,
              pointerEvents: "none" as const,
            }}
          >
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: "50%",
                backgroundColor: BLUE,
              }}
            />
          </div>
        </div>

        {/* ── Tagline ── */}
        <div
          style={{
            marginTop: 20,
            opacity: taglineProgress,
            transform: `translateY(${taglineY}px)`,
          }}
        >
          <span
            style={{
              fontSize: 26,
              fontFamily: `${nunitoFamily}, system-ui, sans-serif`,
              color: TAG_COLOR,
              fontWeight: 400,
              letterSpacing: 0.2,
            }}
          >
            Stocks, Treasuries, Crypto, & More
          </span>
        </div>

        {/* ── App store badges ── */}
        <div
          style={{
            display: "flex",
            gap: 20,
            marginTop: 32,
            opacity: badgesProgress,
            transform: `translateY(${badgesY}px) scale(${badgesScaleValue})`,
          }}
        >
          {/* Apple App Store */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              border: "1.5px solid #DCDCDC",
              borderRadius: 10,
              padding: "12px 28px",
              backgroundColor: "#FFFFFF",
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            }}
          >
            <AppleLogo size={22} />
            <div
              style={{
                display: "flex",
                flexDirection: "column",
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontFamily: `${nunitoFamily}, system-ui`,
                  color: "#000",
                  lineHeight: 1.1,
                  fontWeight: 400,
                }}
              >
                Download on the
              </span>
              <span
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  fontFamily: `${nunitoFamily}, system-ui`,
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
              gap: 10,
              border: "1.5px solid #DCDCDC",
              borderRadius: 10,
              padding: "12px 28px",
              backgroundColor: "#FFFFFF",
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            }}
          >
            <GooglePlayLogo size={22} />
            <div
              style={{
                display: "flex",
                flexDirection: "column",
              }}
            >
              <span
                style={{
                  fontSize: 9,
                  fontFamily: `${nunitoFamily}, system-ui`,
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
                  fontSize: 20,
                  fontWeight: 700,
                  fontFamily: `${nunitoFamily}, system-ui`,
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
