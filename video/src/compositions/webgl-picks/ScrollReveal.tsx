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

const LAYER_1_URL =
  "https://cdn.prod.website-files.com/671752cd4027f01b1b8f1c7f/6717795be09b462b2e8ebf71_osmo-parallax-layer-3.webp";
const LAYER_2_URL =
  "https://cdn.prod.website-files.com/671752cd4027f01b1b8f1c7f/6717795b4d5ac529e7d3a562_osmo-parallax-layer-2.webp";
const LAYER_4_URL =
  "https://cdn.prod.website-files.com/671752cd4027f01b1b8f1c7f/6717795bb5aceca85011ad83_osmo-parallax-layer-1.webp";

// Osmo asterisk SVG — the content section icon
const OSMO_ICON_PATH =
  "M94.8284 53.8578C92.3086 56.3776 88 54.593 88 51.0294V0H72V59.9999C72 66.6273 66.6274 71.9999 60 71.9999H0V87.9999H51.0294C54.5931 87.9999 56.3777 92.3085 53.8579 94.8283L18.3431 130.343L29.6569 141.657L65.1717 106.142C67.684 103.63 71.9745 105.396 72 108.939V160L88.0001 160L88 99.9999C88 93.3725 93.3726 87.9999 100 87.9999H160V71.9999H108.939C105.407 71.9745 103.64 67.7091 106.12 65.1938L106.142 65.1716L141.657 29.6568L130.343 18.3432L94.8284 53.8578Z";

// Original GSAP layer config: each layer scrolls by yPercent with scrub:0, ease:"none"
const LAYERS = [
  { yPercent: 70 },  // layer 1 — back (fastest)
  { yPercent: 55 },  // layer 2 — mid
  { yPercent: 40 },  // layer 3 — title
  { yPercent: 10 },  // layer 4 — front (slowest)
];

// 13-stop fade gradient from the original CSS (bottom of parallax section)
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

// Shared styles for the three image layers
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

export const ScrollReveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();

  // Linear scroll progress 0→1 — maps to GSAP ScrollTrigger scrub:0, ease:"none"
  const progress = frame / durationInFrames;

  // yPercent in GSAP means "translate by N% of the element's own height."
  // Images are 117.5% of viewport height. Title is 100% of viewport height.
  const getLayerTranslateY = (index: number): number => {
    const { yPercent } = LAYERS[index];
    const isTitle = index === 2;
    const elementH = isTitle ? height : height * 1.175;
    return progress * (yPercent / 100) * elementH;
  };

  // Content section fades in near the end of the scroll
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

  return (
    <AbsoluteFill style={{ backgroundColor: "#000", overflow: "hidden" }}>
      {/* parallax__header */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 2,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {/* parallax__visuals — 120% height */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "120%",
          }}
        >
          {/* parallax__black-line-overflow */}
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

          {/* parallax__layers */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              overflow: "hidden",
            }}
          >
            {/* Layer 1 — back (data-parallax-layer="1") */}
            <Img
              src={LAYER_1_URL}
              style={{
                ...layerImgStyle,
                transform: `translateY(${getLayerTranslateY(0)}px)`,
              }}
            />

            {/* Layer 2 — mid (data-parallax-layer="2") */}
            <Img
              src={LAYER_2_URL}
              style={{
                ...layerImgStyle,
                transform: `translateY(${getLayerTranslateY(1)}px)`,
              }}
            />

            {/* Layer 3 — title (data-parallax-layer="3") */}
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

            {/* Layer 4 — front (data-parallax-layer="4") */}
            <Img
              src={LAYER_4_URL}
              style={{
                ...layerImgStyle,
                transform: `translateY(${getLayerTranslateY(3)}px)`,
              }}
            />
          </div>

          {/* parallax__fade — 13-stop gradient, 20% height, z-index 30 */}
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

        {/* parallax__radial-gradient — fixed vignette, opacity 0.5, mix-blend-mode multiply */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle farthest-corner at 50% 50%, transparent, #000)",
            opacity: 0.5,
            mixBlendMode: "multiply",
            pointerEvents: "none",
            zIndex: 10,
          }}
        />
      </div>

      {/* parallax__content — Osmo asterisk SVG, fades in near end */}
      <div
        style={{
          position: "absolute",
          inset: 0,
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
