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
import { FormulaBar } from '../components/FormulaBar';
import { Strikethrough } from '../components/Strikethrough';

const { fontFamily } = loadFont();

// Scene 06 — FORMULA (180 frames / 6s)
//
// Timeline:
//   00–30  bars fade in (continuity from prior scene)
//   30–50  formula expression appears
//   50–70  fee struck, OTHERS loses chunk 1
//   70–90  spread struck, OTHERS loses chunk 2
//   90–110 variance struck, OTHERS loses chunk 3
//  110–130 knowledge struck, OTHERS loses sliver
//  130–180 hold; "pure edge" slides under GM bar
//
// Sequential subtraction. The bar shrinks. The label survives.

const FORMULA_FONT_SIZE = 40;
const SEPARATOR_COLOR = THEME.muted;

const SEPARATOR: React.CSSProperties = {
  fontFamily,
  fontSize: FORMULA_FONT_SIZE,
  color: SEPARATOR_COLOR,
  fontWeight: 600,
  padding: '0 6px',
};

export const Scene06Formula: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // OTHERS bar shrinks in discrete steps as each penalty word is struck.
  const chunksRemoved = Math.floor(
    interpolate(
      frame,
      [50, 70, 90, 110, 130],
      [0, 1, 2, 3, 4],
      {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.linear,
      },
    ),
  );

  // Formula row entry — fade + slight rise.
  const formulaOpacity = interpolate(frame, [30, 50], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const formulaTranslateY = interpolate(frame, [30, 50], [16, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // "pure edge" enters at frame 130.
  const pureEdgeSpring = spring({
    frame: frame - 130,
    fps,
    config: { damping: 18, stiffness: 120, mass: 0.8 },
    durationInFrames: 20,
  });
  const pureEdgeY = interpolate(pureEdgeSpring, [0, 1], [80, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const pureEdgeOpacity = interpolate(frame, [130, 145], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: THEME.bgDark,
        color: THEME.textLight,
        fontFamily,
      }}
    >
      {/* Formula expression — top */}
      <div
        style={{
          position: 'absolute',
          top: 140,
          left: 0,
          width: '100%',
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          opacity: formulaOpacity,
          transform: `translateY(${formulaTranslateY}px)`,
        }}
      >
        {/* edge — survives */}
        <div
          style={{
            fontFamily,
            fontSize: FORMULA_FONT_SIZE,
            color: THEME.textLight,
            fontWeight: 700,
            padding: `0 ${FORMULA_FONT_SIZE * 0.18}px`,
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
          }}
        >
          edge
        </div>

        <span style={SEPARATOR}>−</span>

        <Strikethrough
          text="fee"
          startFrame={30}
          strikeFrame={20}
          strikeDurationFrames={10}
          fontSize={FORMULA_FONT_SIZE}
          textColor={THEME.textLight}
          strikeColor={THEME.red}
        />

        <span style={SEPARATOR}>−</span>

        <Strikethrough
          text="spread"
          startFrame={30}
          strikeFrame={40}
          strikeDurationFrames={10}
          fontSize={FORMULA_FONT_SIZE}
          textColor={THEME.textLight}
          strikeColor={THEME.red}
        />

        <span style={SEPARATOR}>−</span>

        <Strikethrough
          text="variance"
          startFrame={30}
          strikeFrame={60}
          strikeDurationFrames={10}
          fontSize={FORMULA_FONT_SIZE}
          textColor={THEME.textLight}
          strikeColor={THEME.red}
        />

        <span style={SEPARATOR}>−</span>

        <Strikethrough
          text="knowledge"
          startFrame={30}
          strikeFrame={80}
          strikeDurationFrames={10}
          fontSize={FORMULA_FONT_SIZE}
          textColor={THEME.textLight}
          strikeColor={THEME.red}
        />
      </div>

      {/* Bars — centered vertically */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 80,
        }}
      >
        <FormulaBar
          label="OTHERS"
          color={THEME.muted}
          chunksRemoved={chunksRemoved}
          totalChunks={4}
          width={1400}
          startFrame={0}
          animationDurationFrames={15}
        />

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <FormulaBar
            label="GENERAL MARKET"
            color={THEME.gmGreen}
            chunksRemoved={0}
            totalChunks={4}
            width={1400}
            startFrame={0}
            animationDurationFrames={15}
          />

          {/* "pure edge" — slides up under GM bar */}
          <div
            style={{
              marginTop: 36,
              fontFamily,
              fontSize: 60,
              fontStyle: 'italic',
              fontWeight: 700,
              color: THEME.gmGreen,
              opacity: pureEdgeOpacity,
              transform: `translateY(${pureEdgeY}px)`,
              letterSpacing: 2,
              textShadow: `0 0 32px ${THEME.gmGreen}55`,
            }}
          >
            pure edge
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
