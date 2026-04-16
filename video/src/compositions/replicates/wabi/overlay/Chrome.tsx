/**
 * Chrome — all DOM overlays for the Wabi onboarding.
 *
 * Lives above the WebGL canvas. Handles:
 *   • iOS status bar (9:41, signal, wifi, battery)
 *   • Headline text ("A new era of software is here.")
 *   • Subtitle text ("Meet Wabi." / "The first personal software platform.")
 *   • Auth CTAs (Google + Apple)
 *   • "Swipe up to enter" footer
 *
 * Each element's opacity is tied to the frame via the act timing spine.
 */

import React from "react";
import { interpolate } from "remotion";
import { ACTS, COLOR, FONT_STACK } from "../theme";

/** Smooth in/out fade across a frame range. */
const fadeWindow = (
  frame: number,
  start: number,
  fadeInLen: number,
  hold: number,
  fadeOutLen: number
) => {
  const inStart = start;
  const inEnd = start + fadeInLen;
  const outStart = inEnd + hold;
  const outEnd = outStart + fadeOutLen;
  return interpolate(
    frame,
    [inStart, inEnd, outStart, outEnd],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
};

const StatusBar: React.FC = () => {
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 120,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "60px 90px 0 90px",
        fontFamily: FONT_STACK,
        fontSize: 38,
        fontWeight: 700,
        color: COLOR.statusBar,
        pointerEvents: "none",
        zIndex: 10,
      }}
    >
      <div>9:41</div>
      <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
        {/* Signal bars */}
        <svg width="50" height="28" viewBox="0 0 18 12" fill={COLOR.statusBar}>
          <rect x="0" y="8" width="3" height="4" rx="0.5" />
          <rect x="4" y="6" width="3" height="6" rx="0.5" />
          <rect x="8" y="3" width="3" height="9" rx="0.5" />
          <rect x="12" y="0" width="3" height="12" rx="0.5" />
        </svg>
        {/* Wifi */}
        <svg width="42" height="30" viewBox="0 0 18 12" fill={COLOR.statusBar}>
          <path d="M9 11.5 L11 9 Q9 7.5 7 9 Z" />
          <path
            d="M9 5 Q4.5 5 1 8.5 L3 10.5 Q5.8 8 9 8 Q12.2 8 15 10.5 L17 8.5 Q13.5 5 9 5 Z"
            opacity="0.9"
          />
          <path
            d="M9 0.5 Q2 0.5 -2 5.5 L0 7.5 Q3.5 3 9 3 Q14.5 3 18 7.5 L20 5.5 Q14 0.5 9 0.5 Z"
            opacity="0.7"
          />
        </svg>
        {/* Battery */}
        <svg width="68" height="30" viewBox="0 0 27 12" fill="none">
          <rect
            x="0.5"
            y="0.5"
            width="23"
            height="11"
            rx="2.5"
            stroke={COLOR.statusBar}
            strokeOpacity="0.35"
          />
          <rect x="2" y="2" width="20" height="8" rx="1" fill={COLOR.statusBar} />
          <rect x="25" y="4" width="1.5" height="4" rx="0.5" fill={COLOR.statusBar} opacity="0.35" />
        </svg>
      </div>
    </div>
  );
};

const Headline: React.FC<{ frame: number }> = ({ frame }) => {
  // Visible during Act I, Act II (fading), and Act VIII (returning).
  // During Act II, fades as the orb climbs over it.
  const headFrame1 = interpolate(
    frame,
    [0, 12, ACTS.II.start, ACTS.II.start + 18],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const headFrame2 = interpolate(
    frame,
    [ACTS.VIII.start + 20, ACTS.VIII.start + 40],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const opacity = Math.max(headFrame1, headFrame2);

  if (opacity <= 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: "45%",
        left: 0,
        right: 0,
        textAlign: "center",
        fontFamily: FONT_STACK,
        fontSize: 82,
        fontWeight: 800,
        color: COLOR.text,
        lineHeight: 1.12,
        letterSpacing: "-0.025em",
        opacity,
        pointerEvents: "none",
      }}
    >
      A new era of
      <br />
      software is here.
    </div>
  );
};

const SubtitleStack: React.FC<{ frame: number }> = ({ frame }) => {
  // "Meet Wabi." appears at the end of Act IV below the puck.
  // Subtitle follows ~7 frames later. Both fade on Act VII entrance (lens eats them).
  const meetWabiOpacity = fadeWindow(
    frame,
    ACTS.IV.start + 22,   // start fade-in
    8,                     // fade-in frames
    ACTS.VII.start - (ACTS.IV.start + 22 + 8) - 4, // hold
    6                      // fade-out frames
  );
  const subtitleOpacity = fadeWindow(
    frame,
    ACTS.IV.start + 30,
    10,
    ACTS.VII.start - (ACTS.IV.start + 30 + 10) - 4,
    6
  );

  if (meetWabiOpacity <= 0 && subtitleOpacity <= 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: "55%",
        left: 0,
        right: 0,
        textAlign: "center",
        fontFamily: FONT_STACK,
        color: COLOR.text,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          fontSize: 74,
          fontWeight: 800,
          lineHeight: 1.12,
          letterSpacing: "-0.025em",
          opacity: meetWabiOpacity,
          transform: `translateY(${interpolate(
            meetWabiOpacity,
            [0, 1],
            [12, 0]
          )}px)`,
        }}
      >
        Meet Wabi.
      </div>
      <div
        style={{
          fontSize: 62,
          fontWeight: 800,
          lineHeight: 1.15,
          letterSpacing: "-0.02em",
          opacity: subtitleOpacity,
          transform: `translateY(${interpolate(
            subtitleOpacity,
            [0, 1],
            [12, 0]
          )}px)`,
          marginTop: 14,
          color: "#2A2A2A",
        }}
      >
        The first personal
        <br />
        software platform.
      </div>
    </div>
  );
};

const AuthButtons: React.FC<{ frame: number }> = ({ frame }) => {
  // Slide up + fade in near end of Act IV. Fade out during Act VII.
  const googleProg = interpolate(
    frame,
    [ACTS.IV.start + 28, ACTS.IV.start + 44, ACTS.VII.start - 4, ACTS.VII.start + 8],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const appleProg = interpolate(
    frame,
    [ACTS.IV.start + 32, ACTS.IV.start + 48, ACTS.VII.start - 2, ACTS.VII.start + 10],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  if (googleProg <= 0 && appleProg <= 0) return null;

  const buttonStyle: React.CSSProperties = {
    width: "80%",
    height: 132,
    borderRadius: 66,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
    fontFamily: FONT_STACK,
    fontSize: 44,
    fontWeight: 600,
    letterSpacing: "-0.01em",
    margin: "0 auto",
  };

  return (
    <div
      style={{
        position: "absolute",
        bottom: 130,
        left: 0,
        right: 0,
        display: "flex",
        flexDirection: "column",
        gap: 28,
        pointerEvents: "none",
      }}
    >
      {/* Google */}
      <div
        style={{
          opacity: googleProg,
          transform: `translateY(${interpolate(googleProg, [0, 1], [60, 0])}px)`,
        }}
      >
        <div
          style={{
            ...buttonStyle,
            backgroundColor: COLOR.googleBg,
            color: COLOR.googleText,
            boxShadow:
              "0 8px 24px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04)",
          }}
        >
          <GoogleG />
          Continue with Google
        </div>
      </div>
      {/* Apple */}
      <div
        style={{
          opacity: appleProg,
          transform: `translateY(${interpolate(appleProg, [0, 1], [60, 0])}px)`,
        }}
      >
        <div
          style={{
            ...buttonStyle,
            backgroundColor: COLOR.appleBg,
            color: COLOR.appleText,
            boxShadow:
              "0 8px 24px rgba(0,0,0,0.2), 0 2px 6px rgba(0,0,0,0.1)",
          }}
        >
          <AppleLogo />
          Continue with Apple
        </div>
      </div>
    </div>
  );
};

const GoogleG: React.FC = () => (
  <svg width="54" height="54" viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
    />
  </svg>
);

const AppleLogo: React.FC = () => (
  <svg width="48" height="54" viewBox="0 0 16 18" fill="#FFFFFF">
    <path d="M12.84 9.54c-.02-2.24 1.83-3.32 1.91-3.37-1.04-1.52-2.66-1.73-3.24-1.75-1.38-.14-2.69.81-3.39.81-.7 0-1.78-.79-2.93-.77-1.51.02-2.9.88-3.68 2.23-1.57 2.72-.4 6.75 1.13 8.96.75 1.08 1.64 2.3 2.79 2.25 1.12-.04 1.54-.72 2.9-.72s1.74.72 2.93.7c1.21-.02 1.98-1.1 2.72-2.19.86-1.26 1.21-2.49 1.23-2.55-.03-.01-2.35-.9-2.37-3.6zm-2.23-6.61c.62-.75 1.04-1.79.92-2.83-.9.04-1.98.6-2.62 1.35-.58.66-1.08 1.72-.95 2.74 1 .08 2.03-.51 2.65-1.26z" />
  </svg>
);

const SwipeUp: React.FC<{ frame: number }> = ({ frame }) => {
  // Only visible at start (Act I) and at end (Act VIII).
  const opacity = Math.max(
    interpolate(
      frame,
      [0, 14, ACTS.II.start, ACTS.II.start + 14],
      [0, 1, 1, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    ),
    interpolate(
      frame,
      [ACTS.VIII.start + 30, ACTS.VIII.start + 50],
      [0, 1],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    )
  );

  if (opacity <= 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 60,
        left: 0,
        right: 0,
        textAlign: "center",
        fontFamily: FONT_STACK,
        fontSize: 38,
        fontWeight: 500,
        color: COLOR.muted,
        opacity,
        letterSpacing: "-0.01em",
      }}
    >
      Swipe up to enter
    </div>
  );
};

export const Chrome: React.FC<{ frame: number }> = ({ frame }) => {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
      }}
    >
      <StatusBar />
      <Headline frame={frame} />
      <SubtitleStack frame={frame} />
      <AuthButtons frame={frame} />
      <SwipeUp frame={frame} />
    </div>
  );
};
