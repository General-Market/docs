/**
 * MosaicDezoom — website scroll with browser chrome.
 *
 * PH finding: browser chrome = authenticity signal (r=+0.22 in 2026).
 * PH finding: URL shown = +128 median.
 *
 * Shows the real generalmarket.io in a browser frame.
 */
import React from "react";
import {
  AbsoluteFill,
  Img,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";
import { COLOR, FONT } from "../tokens";

const FULLPAGE_SRC = "compositions/vision-vc/broll/gm-fullpage.png";
const IMG_NATURAL_W = 1274;
const IMG_NATURAL_H = 4252;

// Browser chrome dimensions
const CHROME_HEIGHT = 40;
const BROWSER_RADIUS = 10;
const CONTENT_W = 1760; // 1920 - 80px padding each side
const CONTENT_H = 1080 - CHROME_HEIGHT - 40; // minus chrome and bottom pad
const DISPLAY_SCALE = CONTENT_W / IMG_NATURAL_W;
const DISPLAY_H = IMG_NATURAL_H * DISPLAY_SCALE;

export const MosaicDezoom: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const maxScroll = DISPLAY_H - CONTENT_H;
  const scrollY = interpolate(frame, [0, durationInFrames], [0, maxScroll], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const opacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const blur = interpolate(
    frame,
    [0, durationInFrames * 0.6, durationInFrames],
    [0, 2, 5],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const brightness = interpolate(
    frame,
    [0, durationInFrames],
    [1.0, 0.7],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill
      style={{ backgroundColor: COLOR.surface, overflow: "hidden", opacity }}
    >
      {/* Browser window — centered with chrome */}
      <div
        style={{
          position: "absolute",
          top: 20,
          left: 80,
          right: 80,
          bottom: 20,
          borderRadius: BROWSER_RADIUS,
          overflow: "hidden",
          border: `1px solid ${COLOR.borderLight}`,
          boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
        }}
      >
        {/* Chrome bar */}
        <div
          style={{
            height: CHROME_HEIGHT,
            backgroundColor: COLOR.surfaceAlt,
            borderBottom: `1px solid ${COLOR.borderLight}`,
            display: "flex",
            alignItems: "center",
            padding: "0 16px",
            gap: 12,
          }}
        >
          {/* Traffic lights */}
          <div style={{ display: "flex", gap: 6 }}>
            {["#ff5f57", "#ffbd2e", "#28c840"].map((c) => (
              <div
                key={c}
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  backgroundColor: c,
                  opacity: 0.8,
                }}
              />
            ))}
          </div>

          {/* URL bar */}
          <div
            style={{
              flex: 1,
              height: 26,
              backgroundColor: COLOR.page,
              borderRadius: 6,
              border: `1px solid ${COLOR.borderLight}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: FONT.mono,
              fontSize: 12,
              fontWeight: 400,
              color: COLOR.textSecondary,
              letterSpacing: "0.01em",
            }}
          >
            generalmarket.io
          </div>
        </div>

        {/* Page content — scrolling */}
        <div
          style={{
            position: "relative",
            height: `calc(100% - ${CHROME_HEIGHT}px)`,
            overflow: "hidden",
            backgroundColor: COLOR.page,
          }}
        >
          <Img
            src={staticFile(FULLPAGE_SRC)}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: CONTENT_W,
              height: DISPLAY_H,
              objectFit: "fill",
              transform: `translateY(${-scrollY}px)`,
              filter: `blur(${blur}px) brightness(${brightness})`,
            }}
          />
        </div>
      </div>

      {/* Light overlay for closing text readability */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(to bottom, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.45) 30%, rgba(255,255,255,0.45) 70%, rgba(255,255,255,0.55) 100%)",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
