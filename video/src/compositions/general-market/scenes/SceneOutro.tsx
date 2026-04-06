import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from 'remotion';
import { loadFont } from '@remotion/google-fonts/SpaceMono';
import { THEME } from '../theme';

const { fontFamily } = loadFont();

// Scene Outro — CTA (90 frames / 3s)
//
// One sentence. One URL. The arrival.
//   00–25 spring scale-in + fade
//   25–80 hold
//   80–90 fade-out

export const SceneOutro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrySpring = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 110, mass: 0.9 },
    durationInFrames: 25,
  });
  const scale = interpolate(entrySpring, [0, 1], [0.9, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const fadeIn = interpolate(frame, [0, 25], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const fadeOut = interpolate(frame, [80, 90], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.in(Easing.cubic),
  });
  const opacity = Math.min(fadeIn, fadeOut);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#000000',
        color: THEME.textLight,
        fontFamily,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 48,
          opacity,
          transform: `scale(${scale})`,
        }}
      >
        <div
          style={{
            fontFamily,
            fontSize: 56,
            fontWeight: 400,
            color: THEME.textLight,
            letterSpacing: 1,
            lineHeight: 1.2,
            textAlign: 'center',
          }}
        >
          Trade where you can win.
        </div>
        <div
          style={{
            fontFamily,
            fontSize: 72,
            fontWeight: 700,
            color: THEME.gmGreen,
            letterSpacing: 2,
            lineHeight: 1.1,
            textAlign: 'center',
            textShadow: `0 0 40px ${THEME.gmGreen}66`,
          }}
        >
          generalmarket.io
        </div>
      </div>
    </AbsoluteFill>
  );
};
