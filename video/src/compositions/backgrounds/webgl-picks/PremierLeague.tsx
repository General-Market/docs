// Football Today — DixonBaxi's PL intro, retimed to the frame clock. The
// GSAP timeline had labels "shiftRight" and "shiftLeft" that gated everything
// after the cyan plate landed; we encode the same labels as frame markers
// and let each property accumulate by adding interpolated deltas.

import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  Easing,
} from "remotion";

const DARK = "#2d0033";
const CYAN = "#17fffb";
const WHITE = "#ffffff";

// Power3.easeOut is roughly a (0.215, 0.61, 0.355, 1) cubic-bezier.
const e3 = Easing.bezier(0.215, 0.61, 0.355, 1);

// SVG paths lifted from the source assets so the file stays self-contained.
const LION =
  "M705.1,457.5c-21.9,17.9-40.4,27.9-40.4,27.9l0.3,56.8c15.6,17,31,31.1,42.6,56.8C729.4,560.6,725.2,504,705.1,457.5 M687.3,643.4c0,0-4.5-23.4-23.5-45.3l-43.3,1c0,0-58.4,49-94,50.1c0,0,19.6,35.6,29.6,54.2c19.6-4.2,54.1-19.3,68-35c0,0,9.2,28.9,7.5,63C650.9,720.5,677.8,690.6,687.3,643.4 M631.4,540.9l-0.1-56.6c0,0-25.9-8.1-53.5-29c-55.5,8.2-122.7,62.7-122.7,62.7s22.7,42,47.6,87.4C546.3,611.3,610.7,557.5,631.4,540.9 M779.5,776.5l-35.7-38.6c-10.2,104.3-62.5,192.8-158.7,254.6l-14.7-56.2c-81.6,57.5-221.7,94.8-342,28.4c15-74.4,28.2-149.7-0.3-240c-66.6,100.7-125.6,140.1-125.6,140.1c-45-73.8-41-221.7-27.5-265.3L0,622.2C0,572.5,36.7,467,89.8,407.8L43,400.4h0c31.8-63.4,79.3-118,137.3-159.1l0.1,0c-17.4,26.9-17.7,93.2,33.4,118.4c-21.7-37.1-24.3-83-1.6-106.7c22.7-24,60.8-15.7,85.1,2.8c-7.2-20.7-28.5-46.8-60.3-48.5h0c60.1-30.2,128.2-47.1,200.4-47.1c13.5,0,26.9,0.6,40.1,1.7l0,0c21,8.2,51.8,37.1,66.1,55c0,0,1-21.2-11-46.7c78.1,18.6,115.4,49.6,131,64.5c3.2,33,13.3,52.7,26.7,84c-25.3-27.7-88.9-72.3-119.3-83c0,0-2.5,28.6-12.9,42.3c-60.5-42.6-90.2-53.3-90.2-53.3c-66.4,9.3-109.1,34.3-132.3,53.9l20.2,16.8c-40,12-66,45.5-66,45.5c0.3,0.6,35.8,5.5,35.8,5.5s-3.6,40.6,48.5,66.1c44.7,21.8,108.9-5.3,169.4,18.4c-39.8-44.8-67.3-64.8-67.3-64.8s-15.8-3.2-26.9-3.1c-13.9,0.1-34.6,2.8-57.3-5.9c-10.9-4.1-23.5-11.5-33.5-17.5c0,0,27.9-28,68.7-34.1c0,0,36.8,10.1,66,31.1c19.4-18.4,39.6-17.8,39.6-17.8s-20,18.2-14,40.3c29.1,25.3,60.7,61.5,60.7,61.5c32.2-17.2,102.1-13.2,116.5,3c-18.2-23-44.4-42.3-64.7-58.7c-2.5-8.6-24.6-38.7-28.4-41.5c0,0,21.1,6.3,39.9,22.8c5.4-7.5,15.5-15.2,29.3-18.5c14.2,11.6,16.7,29.4,16.3,32.3c-6.4,7.4-12.7,10.5-12.7,10.5l34.1,36l3.4-25.8C791.7,490.5,834.6,617.2,779.5,776.5 M158.8,83.5c45.3,20.3,74.4,45.8,79.7,49.7c-2.4-11.4-11.3-66.4-16.5-100.5c26.4,17.9,87.7,59.4,107.9,72.8c8.2-24.7,36.7-105.3,36.7-105.3s51.5,81.3,60.3,94.5c10.7-11,72.2-77.7,88.2-94.6c2.7,38.4,6.3,93.4,7.2,101.6c3.1-4.1,26.6-36.3,66.1-65.9c-17.1,32.9-25.3,78.2-28.9,114.7c-38.8-10.6-79.8-16.2-122-16.2c-81.1,0-157.2,20.8-223.1,57.3C202.4,156.2,183.7,112.4,158.8,83.5";

const INVERTED =
  "M369.3,0l-15,44.6c-8.3,24.6-16.2,47.8-17.6,51.6c-2.4,6.6-4.9,5.4-50.3-26.2c-26.3-18.3-49.6-33.9-51.7-34.7c-2.8-1.1-3.5,1-2.3,7.4c4.7,25.3,13.5,84,12.7,84.8c-0.5,0.5-7.4-4-15.2-10c-15.9-12.2-52.3-34.1-53.8-32.5c-0.5,0.6,5.9,13,14.3,27.5c8.4,14.6,19.1,37.4,23.9,50.9s9,24.4,9.5,24.4c0.5,0,10.3-4.8,21.9-10.6c86-43.3,193.9-56.2,288.3-34.4c11,2.5,20.2,4.2,20.6,3.7c0.3-0.5,2.4-13.6,4.5-29.1s7.7-39.7,12.4-53.7c10.5-31.4,8.5-30.9-26.9,6.6L519.2,97l-2-27.3c-1.1-15-3-36.6-4.2-48l-2.2-20.7l-40.6,45c-22.3,24.7-41.4,45-42.3,45c-0.9,0-11.4-15.8-23.4-35.2S379.7,15.8,376,10.2L369.3,0z M437.2,158.5c-62.3,0.2-107.2,9.3-167.5,34c-13.8,5.7-31.2,12-38.8,14c-8.7,2.4-19.7,9.2-29.7,18.5c-8.8,8.1-24.4,21-34.7,28.6c-26.7,19.7-70.7,62.9-90.6,88.9c-16.8,22-39.3,57.3-39.3,61.7c0,1.2,6,3.2,13.3,4.3c25.7,4,25.3,3.6,16.3,18.3C29.7,486.3,7,551.2,0.7,614.4c-1.4,14.5-0.9,18,2.8,18c3.7,0,25.8-6.3,59.7-17c2-0.6,3.2,23.6,3.3,68.3c0.1,58.9,1.2,73.8,6.9,99.4c7.3,32.9,22.7,75.3,31.4,86.5l5.5,7.1l21.8-17.9c28.3-23.2,54-49.8,77.7-80.2c16.6-21.3,19.3-23.7,22.2-18.8c5.8,9.7,4.1,113.8-2.4,148c-10.5,55.5-12.4,47.9,14.6,60.9c49.8,23.9,122.2,34.9,177.6,27c32.4-4.6,85.4-21.9,111.8-36.4c10.8-5.9,20.2-10.8,20.8-10.8s2.7,6.7,4.8,14.9c10.2,41.4,8.9,38.9,18.5,33.9c4.8-2.5,21.5-14.4,37.3-26.6c59.2-45.8,101.6-109.1,120.3-179.4l7.2-27.3l14.5,14.3c8,7.9,15.2,13.1,16.1,11.7c0.8-1.5,4.5-11.8,8.1-23c34.3-105.4,31.2-205.4-8.6-284.2c-10.5-20.7-37.8-61.5-37.8-56.5c0,0.9,4.8,12.1,10.7,24.8c35.7,77.5,42.2,177.4,17.4,269.2l-3.7,13.7l-19.5-21.6L720,691l-3.6,29.4c-7.6,61.4-24,109.2-52,151.1c-15.4,23.1-53,63.8-69.6,75.4c-6.6,4.6-6.8,4.2-12.2-18c-3-12.5-6.3-24.3-7.4-26.4c-1.3-2.5-7.3-0.3-19.1,7.3c-64.4,41.1-132.1,60.7-195.4,56.5c-30.7-2.1-68.6-10.7-91.5-20.8c-12.3-5.4-14.1-7.4-12.5-13.4c7.3-27.3,11.9-82.6,10.3-124.4c-1.7-45.4-5.7-70.4-17.9-110.7l-6.5-21.5L221.6,708c-25.8,39.5-52.2,72.3-81.1,100.8l-21.8,21.5l-5.1-15.3C94,756,90.8,646.9,106.8,586.1c3.3-12.5,3.4-16.4,0.5-16.4c-2.1,0-17.1,4.2-33.4,9.3c-39.1,12.3-38.7,12.4-36.1-3.8c7.6-47.3,49.6-132.2,84.8-171.1c13-14.4,13.5-14-18.6-18.6c-8.4-1.2-15.9-3.8-16.5-5.7c-2-6,35.2-52.3,64-79.5l27.5-26l2.3,16.3c2.9,20.5,12.6,39.7,26.7,53c6,5.7,11.4,9.8,12,9.2s-1.9-8.8-5.6-18.1c-8.8-22.5-9.4-56.2-1.3-72.6c12.8-26,41.5-34,72-20.1l17.5,8l-4.6-8.8c-2.5-4.9-8.2-13.1-12.6-18.3l-8-9.5l25.2-9.7c55.1-21.2,120.8-30.9,174-25.6l31.1,3.1l18.4,19.8l18.4,19.8l-2.1-16.5l-2.1-16.5l8.7,2.1c14.7,3.6,60.8,20.2,82.3,29.7l20.3,9l-12.5-10.9c-26.7-23.2-81.6-46-133-55.1Z M462.9,222.3c-23.5,0-82.7,22.5-109,41.3l-14.2,10.2l9.1,8.1l9.1,8.1l-15.9,8.4c-18.3,9.6-46.4,32.7-44.2,36.4c0.8,1.4,8.6,3.4,17.2,4.5c13.5,1.8,15.7,3.1,15.8,9c0.2,20.5,22.4,47.2,49.9,59.7c12.6,5.8,20.9,6.6,72.2,7.2c31.8,0.4,62.1,2,67.3,3.7c19.3,6.3,18,2.9-9.5-24.8c-15.5-15.6-30.9-29.9-34.4-31.8c-3.4-1.9-21.8-4.3-40.9-5.4c-29.7-1.6-37.1-3.2-52.5-11c-9.8-5-17.4-10.6-16.8-12.4c1.9-6.1,30.7-23.6,46.6-28.3c14.9-4.4,16.5-4.3,33.9,2.8c10.1,4.1,24.2,11,31.5,15.3c13.2,7.8,13.2,7.8,21.3,1.9c4.5-3.3,12.6-7.3,18.1-8.9l10-2.8l-6,9.9c-11.3,18.6-8.6,25.7,23.2,59.3l28.9,30.6l18.5-4.8c27.5-7.2,58.4-6.1,84.5,2.9c3.4,1.2-5.7-9.1-20.3-22.8c-34.4-32.2-33-30.7-45.3-49.8c-12.2-18.9-8.9-21,10.5-6.9c11.9,8.6,13.6,9,18,4.6c2.7-2.7,8.9-6.9,13.8-9.5c8.4-4.4,9.2-4.2,15.4,3.7c10.1,12.9,11.6,23.1,4.2,29.1c-6.2,5-6.1,5.4,8.7,22.2c8.2,9.4,16.1,16,17.4,14.6c1.3-1.3,2.5-11.9,2.5-23.5c0.1-24.9-7.2-43.5-24.8-62.9c-15.4-17-63.6-53.4-89.8-67.6l-20.9-11.4l-3.5,16.6c-5.7,27.4-5.7,27.4-35,8C496.5,235.6,471,222.3,462.9,222.3z";

const Lion: React.FC<{ size: number }> = ({ size }) => (
  <svg
    viewBox="0 0 804.3 1000"
    width={size}
    height={size}
    style={{ display: "block" }}
  >
    <path d={LION} fill={DARK} />
  </svg>
);

const InvertedLogo: React.FC = () => (
  <svg
    viewBox="0 0 804.7 1000"
    style={{
      display: "block",
      height: "100%",
      width: "auto",
      float: "left",
    }}
  >
    <path d={INVERTED} fill={CYAN} />
  </svg>
);

export const PremierLeague: React.FC = () => {
  const frame = useCurrentFrame();

  // ── Background: fade in, scale down from 2x, drift across, slow pan ─────
  const bgOpacity = interpolate(frame, [0, 24], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: e3,
  });
  const bgScale = interpolate(frame, [0, 108], [2, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: e3,
  });
  const bgX0 = interpolate(frame, [0, 108], [-70, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: e3,
  });
  const bgX1 = interpolate(frame, [144, 204], [0, -7], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: e3,
  });
  const bgX2 = interpolate(frame, [204, 684], [0, -5], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const bgX = bgX0 + bgX1 + bgX2;

  // ── Heading: drops in from above, then slides right, then back left ─────
  const headingY = interpolate(frame, [84, 120], [-100, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: e3,
  });
  const headingX1 = interpolate(frame, [144, 192], [0, 35], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: e3,
  });
  const headingX2 = interpolate(frame, [204, 252], [0, -50], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: e3,
  });
  const headingX = headingX1 + headingX2;

  // ── Inverted PL: slides in from the right, then drifts further ─────────
  const invX1 = interpolate(frame, [144, 192], [100, 50], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: e3,
  });
  const invX2 = interpolate(frame, [204, 564], [0, -2.5], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const invX = invX1 + invX2;

  // ── Wings retract during shiftRight ────────────────────────────────────
  const wingW = interpolate(frame, [144, 192], [270, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: e3,
  });
  const wingPad = interpolate(frame, [144, 192], [40, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: e3,
  });
  const wingTextX = interpolate(frame, [144, 192], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: e3,
  });

  // ── Dark panel reveals "Football Today" ────────────────────────────────
  const textContScale = interpolate(frame, [204, 252], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: e3,
  });
  const textOpacity = interpolate(frame, [204, 264], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: e3,
  });
  const textInnerX = interpolate(frame, [204, 264], [100, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: e3,
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: DARK,
        overflow: "hidden",
        fontFamily: "'Poppins', 'Inter', sans-serif",
      }}
    >
      {/* Background — gradient stand-in for the source's stadium photo */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "125%",
          height: "100%",
          opacity: bgOpacity,
          transform: `translateX(${bgX}%) scale(${bgScale})`,
          background:
            "radial-gradient(ellipse at 30% 60%, rgba(106, 48, 144, 0.9), transparent 70%), radial-gradient(ellipse at 80% 30%, rgba(23, 255, 251, 0.15), transparent 60%), linear-gradient(135deg, #1a0020 0%, #3d0055 50%, #6a3090 100%)",
        }}
      />

      {/* Inverted PL logo */}
      <div
        style={{
          position: "absolute",
          top: "-30%",
          right: 0,
          height: "135%",
          width: "60%",
          transform: `translateX(${invX}%)`,
          zIndex: 2,
        }}
      >
        <InvertedLogo />
      </div>

      {/* Heading wrapper — full viewport, contents centered */}
      <AbsoluteFill
        style={{
          zIndex: 3,
          display: "grid",
          placeItems: "center",
          transform: `translate(${headingX}%, ${headingY}%)`,
        }}
      >
        {/* The cyan plate */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            backgroundColor: CYAN,
            color: DARK,
            fontWeight: 700,
            fontSize: 60,
            boxShadow: "0 0 16px rgba(0, 0, 0, 0.2)",
            whiteSpace: "nowrap",
            height: 110,
          }}
        >
          {/* Left wing: "Premier" */}
          <div
            style={{
              width: wingW,
              paddingLeft: wingPad,
              height: "100%",
              display: "flex",
              alignItems: "center",
              overflow: "hidden",
            }}
          >
            <span
              style={{
                display: "inline-block",
                transform: `translateX(${wingTextX}%)`,
              }}
            >
              Premier
            </span>
          </div>

          {/* Center: lion + the dark reveal panel */}
          <div
            style={{
              position: "relative",
              padding: 10,
              display: "flex",
              alignItems: "center",
              height: "100%",
              backgroundColor: CYAN,
              zIndex: 2,
            }}
          >
            <Lion size={86} />

            {/* Dark panel that scales open from the lion's right edge */}
            <div
              style={{
                position: "absolute",
                left: "100%",
                top: 0,
                height: "100%",
                backgroundColor: DARK,
                padding: "0 40px",
                transform: `scaleX(${textContScale})`,
                transformOrigin: "left",
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                width: 700,
              }}
            >
              <span
                style={{
                  color: WHITE,
                  fontSize: 70,
                  fontWeight: 500,
                  whiteSpace: "nowrap",
                  opacity: textOpacity,
                  transform: `translateX(${textInnerX}%)`,
                }}
              >
                Football Today
              </span>
            </div>
          </div>

          {/* Right wing: "League" */}
          <div
            style={{
              width: wingW,
              paddingRight: wingPad,
              height: "100%",
              display: "flex",
              alignItems: "center",
              overflow: "hidden",
            }}
          >
            <span
              style={{
                display: "inline-block",
                transform: `translateX(-${wingTextX}%)`,
              }}
            >
              League
            </span>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
