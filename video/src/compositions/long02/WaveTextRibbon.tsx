/**
 * WaveTextRibbon — 3D ribbon of text cards along a flowing S-curve.
 *
 * Each "card" is a rectangular outlined frame with text inside.
 * Two words ("AGI" / "ARENA") each get their own interweaving ribbon.
 * Matches the Bankless "BANK" / "LESS" wave intro style.
 */

import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, Easing } from "remotion";

/* ── Single ribbon for one word ── */

interface RibbonProps {
  text: string;
  fillColor: string;
  strokeColor: string;
  /** Number of card copies along the ribbon */
  count: number;
  fontFamily: string;
  fontSize: number;
  /** Wave phase speed (radians / frame) */
  waveSpeed: number;
  /** Vertical amplitude of the S-curve */
  amplitude: number;
  /** Horizontal amplitude of the S-curve */
  amplitudeX: number;
  /** Phase offset so the two ribbons interweave */
  phaseOffset: number;
  /** Vertical offset for this ribbon */
  yOffset: number;
  /** Horizontal center offset */
  xOffset: number;
  /** The "active" card index where the filled version appears */
  activeIndex: number;
  /** Overall intro progress 0→1 */
  intro: number;
}

const Ribbon: React.FC<RibbonProps> = ({
  text,
  fillColor,
  strokeColor,
  count,
  fontFamily,
  fontSize,
  waveSpeed,
  amplitude,
  amplitudeX,
  phaseOffset,
  yOffset,
  xOffset,
  activeIndex,
  intro,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const phase = frame * waveSpeed + phaseOffset;

  const cards: React.ReactNode[] = [];

  for (let i = 0; i < count; i++) {
    // t goes from 0 to 1 along the ribbon
    const t = i / (count - 1);

    // S-curve path: the ribbon flows from bottom-left to upper-right
    // with a sinusoidal wave overlaid
    const pathT = t * 2 - 1; // -1 to 1

    // Base diagonal path (bottom-left → upper-right)
    const baseX = pathT * width * 0.55;
    const baseY = pathT * -height * 0.35;

    // Sine wave overlay
    const waveAngle = phase + pathT * Math.PI * 2.2;
    const waveX = amplitudeX * Math.sin(waveAngle);
    const waveY = amplitude * Math.cos(waveAngle);

    const x = width / 2 + baseX + waveX + xOffset;
    const y = height / 2 + baseY + waveY + yOffset;

    // Rotation follows the wave tangent
    const tangentAngle = Math.atan2(
      -amplitude * Math.sin(waveAngle),
      amplitudeX * Math.cos(waveAngle),
    );
    const rotateZ = (tangentAngle * 180) / Math.PI * 0.3;

    // 3D perspective rotation — cards tilt along the ribbon
    const rotateY = pathT * -40 + Math.sin(waveAngle) * 15;
    const rotateX = Math.cos(waveAngle) * 20;

    // Scale with perspective — edges smaller
    const distFromActive = Math.abs(i - activeIndex) / count;
    const perspScale = Math.max(0.12, 1 - distFromActive * 1.4);

    // Opacity
    const isActive = i === activeIndex;
    const opacity = isActive
      ? 1
      : Math.max(0.06, (1 - distFromActive * 1.2) * 0.55);

    // Border / stroke thickness
    const borderWidth = isActive ? 0 : Math.max(0.5, (1 - distFromActive) * 2.5);

    // Card dimensions (proportional to font size)
    const cardW = fontSize * text.length * 0.7 + 60;
    const cardH = fontSize * 1.4 + 30;

    cards.push(
      <div
        key={i}
        style={{
          position: "absolute",
          left: x,
          top: y,
          width: cardW * perspScale,
          height: cardH * perspScale,
          transform: `translate(-50%, -50%) perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) rotateZ(${rotateZ}deg) scale(${intro})`,
          opacity: opacity * intro,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          // Outlined rectangle frame (like the Bankless cards)
          border: isActive ? "none" : `${borderWidth}px solid ${strokeColor}`,
          borderRadius: isActive ? 0 : 4,
          // Text styling
          fontFamily,
          fontSize: fontSize * perspScale,
          fontWeight: 900,
          letterSpacing: 3,
          textTransform: "uppercase" as const,
          color: isActive ? fillColor : "transparent",
          WebkitTextStroke: isActive ? "none" : `${Math.max(0.3, borderWidth * 0.6)}px ${strokeColor}`,
          whiteSpace: "nowrap",
          zIndex: isActive ? 100 : Math.round(50 - distFromActive * 50),
          willChange: "transform, opacity",
          overflow: "visible",
        }}
      >
        {text}
      </div>,
    );
  }

  return <>{cards}</>;
};

/* ── Main component: two interweaving ribbons ── */

interface WaveTextRibbonProps {
  word1?: string;
  word2?: string;
  fillColor?: string;
  strokeColor?: string;
  copies?: number;
  fontFamily?: string;
  fontSize?: number;
  waveSpeed?: number;
  amplitude?: number;
}

export const WaveTextRibbon: React.FC<WaveTextRibbonProps> = ({
  word1 = "AGI",
  word2 = "ARENA",
  fillColor = "#DC2626",
  strokeColor = "rgba(180,40,40,0.35)",
  copies = 50,
  fontFamily = "'Inter', 'Helvetica Neue', sans-serif",
  fontSize = 130,
  waveSpeed = 0.035,
  amplitude = 200,
}) => {
  const frame = useCurrentFrame();

  // Intro: ease in over first 40 frames
  const intro = interpolate(frame, [0, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  // The "active" (filled) card drifts slowly along the ribbon
  const activeIdx1 = Math.round(copies * 0.55 + Math.sin(frame * 0.012) * copies * 0.08);
  const activeIdx2 = Math.round(copies * 0.50 + Math.sin(frame * 0.012 + 1) * copies * 0.08);

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      {/* Ribbon 1: "AGI" — flows upper-left path */}
      <Ribbon
        text={word1}
        fillColor={fillColor}
        strokeColor={strokeColor}
        count={copies}
        fontFamily={fontFamily}
        fontSize={fontSize}
        waveSpeed={waveSpeed}
        amplitude={amplitude}
        amplitudeX={160}
        phaseOffset={0}
        yOffset={-60}
        xOffset={-40}
        activeIndex={activeIdx1}
        intro={intro}
      />
      {/* Ribbon 2: "ARENA" — flows lower-right path, phase-shifted */}
      <Ribbon
        text={word2}
        fillColor={fillColor}
        strokeColor={strokeColor}
        count={copies}
        fontFamily={fontFamily}
        fontSize={fontSize * 0.95}
        waveSpeed={waveSpeed}
        amplitude={amplitude * 0.9}
        amplitudeX={140}
        phaseOffset={Math.PI * 0.8}
        yOffset={80}
        xOffset={50}
        activeIndex={activeIdx2}
        intro={intro}
      />
    </div>
  );
};
