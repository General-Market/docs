// Source: https://codepen.io/osmosupply/full/NWQevrB
import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
  Img,
} from "remotion";

/**
 * Osmo "Parallax Image Layers" — scroll-driven parallax with 4 depth layers.
 *
 * Original uses GSAP ScrollTrigger + Lenis smooth scroll.
 * Here, frame progress (0→1 over durationInFrames) replaces scroll position.
 *
 * Layer speeds (yPercent from the original):
 *   Layer 1 (back mountain):  70%  — fastest, farthest
 *   Layer 2 (mid mountain):   55%
 *   Layer 3 (title text):     40%
 *   Layer 4 (front foliage):  10%  — slowest, nearest
 *
 * The original images are landscape photographs split into depth planes.
 * CDN URLs preserved from the Osmo pen.
 */

const LAYER_1_URL =
  "https://cdn.prod.website-files.com/671752cd4027f01b1b8f1c7f/6717795be09b462b2e8ebf71_osmo-parallax-layer-3.webp";
const LAYER_2_URL =
  "https://cdn.prod.website-files.com/671752cd4027f01b1b8f1c7f/6717795b4d5ac529e7d3a562_osmo-parallax-layer-2.webp";
const LAYER_4_URL =
  "https://cdn.prod.website-files.com/671752cd4027f01b1b8f1c7f/6717795bb5aceca85011ad83_osmo-parallax-layer-1.webp";

// Osmo asterisk SVG path
const OSMO_ICON_PATH =
  "M94.8284 53.8578C92.3086 56.3776 88 54.593 88 51.0294V0H72V59.9999C72 66.6273 66.6274 71.9999 60 71.9999H0V87.9999H51.0294C54.5931 87.9999 56.3777 92.3085 53.8579 94.8283L18.3431 130.343L29.6569 141.657L65.1717 106.142C67.684 103.63 71.9745 105.396 72 108.939V160L88.0001 160L88 99.9999C88 93.3725 93.3726 87.9999 100 87.9999H160V71.9999H108.939C105.407 71.9745 103.64 67.7091 106.12 65.1938L106.142 65.1716L141.657 29.6568L130.343 18.3432L94.8284 53.8578Z";

interface ParallaxLayerConfig {
  yPercent: number;
}

const LAYERS: ParallaxLayerConfig[] = [
  { yPercent: 70 }, // layer 1 — back
  { yPercent: 55 }, // layer 2 — mid
  { yPercent: 40 }, // layer 3 — title
  { yPercent: 10 }, // layer 4 — front
];

// The bottom fade gradient — 13-stop linear gradient matching the original
const FADE_GRADIENT = [
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

export const ScrollReveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();

  // Scroll progress: 0 → 1 over full duration, linear (matches scrub: 0)
  const progress = frame / durationInFrames;

  // Compute Y offset for each layer.
  // In the original, yPercent goes from 0 → layerYPercent over the scroll.
  // translateY = yPercent% of the element's own height.
  // Since our visuals container is 120% of viewport height (matching original),
  // we compute pixel offsets relative to viewport height.
  const visualsHeight = height * 1.2;

  const getLayerY = (layerIndex: number): number => {
    const targetYPercent = LAYERS[layerIndex].yPercent;
    // The original GSAP tween goes from yPercent:0 to yPercent:N with ease:"none"
    // yPercent is relative to the element's own height.
    // For images: height is 117.5% of viewport → pixel offset = yPercent/100 * 1.175 * viewportH
    // For title: height is 100svh → pixel offset = yPercent/100 * viewportH
    const isTitle = layerIndex === 2;
    const elementHeightFactor = isTitle ? 1.0 : 1.175;
    return progress * (targetYPercent / 100) * elementHeightFactor * height;
  };

  // Content section: slides up as parallax section scrolls away
  // In original, the content is a second full-height section below the parallax
  // It becomes visible as the parallax layers shift upward
  const contentOpacity = interpolate(progress, [0.6, 0.85], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.ease,
  });

  const contentScale = interpolate(progress, [0.6, 0.9], [0.7, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // Radial gradient overlay — static 0.5 opacity in the original
  const vignetteOpacity = 0.5;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000", overflow: "hidden" }}>
      {/* ── Parallax Header Section ── */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          zIndex: 2,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {/* Visuals container — 120% height like the original */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: `${visualsHeight}px`,
            objectFit: "cover",
          }}
        >
          {/* Black line overflow — 2px black line at the bottom */}
          <div
            style={{
              position: "absolute",
              bottom: -1,
              left: 0,
              width: "100%",
              height: 2,
              backgroundColor: "#000",
              zIndex: 20,
            }}
          />

          {/* Parallax layers container */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              overflow: "hidden",
            }}
          >
            {/* Layer 1 — back mountain (fastest parallax) */}
            <Img
              src={LAYER_1_URL}
              style={{
                position: "absolute",
                top: "-17.5%",
                left: 0,
                width: "100%",
                height: "117.5%",
                objectFit: "cover",
                maxWidth: "none",
                pointerEvents: "none",
                transform: `translateY(${getLayerY(0)}px)`,
              }}
            />

            {/* Layer 2 — mid mountain */}
            <Img
              src={LAYER_2_URL}
              style={{
                position: "absolute",
                top: "-17.5%",
                left: 0,
                width: "100%",
                height: "117.5%",
                objectFit: "cover",
                maxWidth: "none",
                pointerEvents: "none",
                transform: `translateY(${getLayerY(1)}px)`,
              }}
            />

            {/* Layer 3 — title text */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: height,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                transform: `translateY(${getLayerY(2)}px)`,
              }}
            >
              <h2
                style={{
                  fontFamily:
                    "'PP Neue Corp Wide', 'Arial Black', 'Impact', sans-serif",
                  fontSize: `${width * 0.11}px`,
                  fontWeight: 800,
                  lineHeight: 1,
                  textAlign: "center",
                  color: "#fff",
                  margin: 0,
                  marginRight: "0.075em",
                  marginBottom: "0.1em",
                  textTransform: "none",
                  pointerEvents: "auto",
                }}
              >
                Parallax
              </h2>
            </div>

            {/* Layer 4 — front foliage (slowest parallax) */}
            <Img
              src={LAYER_4_URL}
              style={{
                position: "absolute",
                top: "-17.5%",
                left: 0,
                width: "100%",
                height: "117.5%",
                objectFit: "cover",
                maxWidth: "none",
                pointerEvents: "none",
                transform: `translateY(${getLayerY(3)}px)`,
              }}
            />
          </div>

          {/* Bottom fade gradient */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              width: "100%",
              height: "20%",
              background: `linear-gradient(to top, ${FADE_GRADIENT})`,
              zIndex: 30,
              pointerEvents: "none",
            }}
          />
        </div>

        {/* Radial vignette overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle farthest-corner at 50% 50%, transparent, #000)",
            opacity: vignetteOpacity,
            pointerEvents: "none",
            mixBlendMode: "multiply",
            zIndex: 10,
          }}
        />
      </div>

      {/* ── Content Section (revealed as parallax scrolls) ── */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 1,
          opacity: contentOpacity,
          transform: `scale(${contentScale})`,
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width={width * 0.12}
          viewBox="0 0 160 160"
          fill="none"
          style={{ color: "#fff" }}
        >
          <path d={OSMO_ICON_PATH} fill="currentColor" />
        </svg>
      </div>
    </AbsoluteFill>
  );
};
