import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { THEME } from '../theme';

export const SceneOutro: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        backgroundColor: THEME.bgDark,
        color: THEME.textLight,
        fontFamily: 'monospace',
        padding: 40,
      }}
    >
      <div>Outro — generalmarket.io · frame {frame}</div>
    </AbsoluteFill>
  );
};
