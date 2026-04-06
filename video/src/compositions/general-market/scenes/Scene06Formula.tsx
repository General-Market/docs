import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { THEME } from '../theme';

export const Scene06Formula: React.FC = () => {
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
      <div>Scene 06 — FORMULA · frame {frame}</div>
    </AbsoluteFill>
  );
};
