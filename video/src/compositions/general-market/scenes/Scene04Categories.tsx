import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { THEME } from '../theme';

export const Scene04Categories: React.FC = () => {
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
      <div>Scene 04 — CATEGORIES · frame {frame}</div>
    </AbsoluteFill>
  );
};
