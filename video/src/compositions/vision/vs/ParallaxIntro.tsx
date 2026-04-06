/**
 * ParallaxIntro — REVERSED Osmo parallax.
 *
 * Frame 0: "General Market" visible on dark (the brand is FIRST).
 * Animation: landscape layers scroll DOWN into frame, covering the brand.
 * End: full landscape visible, ready to cut to next scene.
 *
 * Duration: 120 frames at 30fps (4s). Fast.
 */
import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
  Img,
  spring,
} from "remotion";
import { COLOR, FONT, ANIM } from "./tokens";

const FPS = 30;

const LAYER_1_URL =
  "https://cdn.prod.website-files.com/671752cd4027f01b1b8f1c7f/6717795be09b462b2e8ebf71_osmo-parallax-layer-3.webp";
const LAYER_2_URL =
  "https://cdn.prod.website-files.com/671752cd4027f01b1b8f1c7f/6717795b4d5ac529e7d3a562_osmo-parallax-layer-2.webp";
const LAYER_4_URL =
  "https://cdn.prod.website-files.com/671752cd4027f01b1b8f1c7f/6717795bb5aceca85011ad83_osmo-parallax-layer-1.webp";

const LAYERS = [
  { yPercent: 70 },
  { yPercent: 55 },
  { yPercent: 40 },
  { yPercent: 10 },
];

const FADE_STOPS = [
  "rgba(0,0,0,1) 0%",
  "rgba(0,0,0,0.738) 19%",
  "rgba(0,0,0,0.541) 34%",
  "rgba(0,0,0,0.382) 47%",
  "rgba(0,0,0,0.278) 56.5%",
  "rgba(0,0,0,0.194) 65%",
  "rgba(0,0,0,0.126) 73%",
  "rgba(0,0,0,0.075) 80.2%",
  "rgba(0,0,0,0.042) 86.1%",
  "rgba(0,0,0,0.021) 91%",
  "rgba(0,0,0,0.008) 95.2%",
  "rgba(0,0,0,0.002) 98.2%",
  "transparent 100%",
].join(", ");

const layerImgStyle: React.CSSProperties = {
  position: "absolute",
  top: "-17.5%",
  left: 0,
  width: "100%",
  height: "117.5%",
  objectFit: "cover",
  maxWidth: "none",
  pointerEvents: "none",
};

export const INTRO_DUR = 120; // 4s at 30fps — fast

export const ParallaxIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();

  // REVERSED progress: 1→0 (landscape starts scrolled away, scrolls into view)
  const forwardProgress = frame / durationInFrames;
  const progress = 1 - forwardProgress;

  const getLayerTranslateY = (index: number): number => {
    const { yPercent } = LAYERS[index];
    const isTitle = index === 2;
    const elementH = isTitle ? height : height * 1.175;
    return progress * (yPercent / 100) * elementH;
  };

  // GM brand content — visible at start, fades OUT as landscape covers it
  const contentOpacity = interpolate(forwardProgress, [0, 0.15, 0.5], [0, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const contentScale = interpolate(forwardProgress, [0, 0.1, 0.5], [0.85, 1, 0.95], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Subtitle springs in immediately
  const subtitleS = spring({
    frame: Math.max(0, frame - 8),
    fps: FPS,
    config: ANIM.medium,
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#000", overflow: "hidden" }}>
      {/* GM brand content — z-index 1, BEHIND landscape */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          gap: 20,
          zIndex: 1,
          opacity: contentOpacity,
          transform: `scale(${contentScale})`,
        }}
      >
        <div
          style={{
            fontFamily: FONT.sans,
            fontSize: 72,
            fontWeight: 900,
            color: COLOR.brand,
            letterSpacing: -1,
          }}
        >
          General Market
        </div>
        <div
          style={{
            fontFamily: FONT.sans,
            fontSize: 20,
            fontWeight: 500,
            color: COLOR.textMuted,
            letterSpacing: 4,
            textTransform: "uppercase",
            opacity: interpolate(subtitleS, [0, 0.5], [0, 1], { extrapolateRight: "clamp" }),
            transform: `translateY(${interpolate(subtitleS, [0, 1], [15, 0])}px)`,
          }}
        >
          Prediction Markets for Quants
        </div>
      </div>

      {/* Landscape layers — z-index 2, scroll DOWN into frame (covering the brand) */}
      <div style={{ position: "absolute", inset: 0, zIndex: 2 }}>
        <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "120%" }}>
          <div style={{ position: "absolute", bottom: -1, left: 0, width: "100%", height: 2, backgroundColor: "#000", zIndex: 20 }} />

          <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
            <Img src={LAYER_1_URL} style={{ ...layerImgStyle, transform: `translateY(${getLayerTranslateY(0)}px)` }} />
            <Img src={LAYER_2_URL} style={{ ...layerImgStyle, transform: `translateY(${getLayerTranslateY(1)}px)` }} />

            {/* Title text rides with layer 3 */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                transform: `translateY(${getLayerTranslateY(2)}px)`,
              }}
            >
              <h2
                style={{
                  fontFamily: FONT.sans,
                  fontSize: width * 0.055,
                  fontWeight: 900,
                  lineHeight: 1.1,
                  textAlign: "center",
                  color: "#fff",
                  margin: 0,
                  letterSpacing: -1,
                  textTransform: "uppercase",
                }}
              >
                Prediction Markets
                <br />
                <span style={{ color: COLOR.brand }}>for Quants</span>
              </h2>
            </div>

            <Img src={LAYER_4_URL} style={{ ...layerImgStyle, transform: `translateY(${getLayerTranslateY(3)}px)` }} />
          </div>

          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              width: "100%",
              height: "20%",
              background: `linear-gradient(to top, ${FADE_STOPS})`,
              zIndex: 30,
              pointerEvents: "none",
            }}
          />
        </div>

        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(circle farthest-corner at 50% 50%, transparent, #000)",
            opacity: 0.5,
            mixBlendMode: "multiply",
            pointerEvents: "none",
            zIndex: 10,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
