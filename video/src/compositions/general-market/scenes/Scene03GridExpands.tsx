import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { THEME } from '../theme';

export const Scene03GridExpands: React.FC = () => {
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
      <div>Scene 03 — GRID EXPANDS · frame {frame}</div>
    </AbsoluteFill>
  );
};
