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
import { TextTrailTitle } from '../components/TextTrailTitle';

const { fontFamily } = loadFont();

// Scene Outro — CTA (90 frames / 3s)
//
// One sentence. One URL. The arrival.
//   00–25 title wave-in
//   25–80 hold
//   80–90 fade-out

export const SceneOutro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const urlSpring = spring({
    frame: frame - 20,
    fps,
    config: { damping: 18, stiffness: 110, mass: 0.9 },
    durationInFrames: 25,
  });
  const urlScale = interpolate(urlSpring, [0, 1], [0.9, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const urlFadeIn = interpolate(frame, [20, 40], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  const fadeOut = interpolate(frame, [80, 90], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.in(Easing.cubic),
  });

  const urlOpacity = Math.min(urlFadeIn, fadeOut);

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
        opacity: fadeOut,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 60,
        }}
      >
        <TextTrailTitle
          text="Trade where you can win."
          startFrame={0}
          fontSize={72}
        />
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
            opacity: urlOpacity,
            transform: `scale(${urlScale})`,
          }}
        >
          generalmarket.io
        </div>
      </div>
    </AbsoluteFill>
  );
};
