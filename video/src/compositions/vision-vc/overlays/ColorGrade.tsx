import React from 'react';
import {AbsoluteFill} from 'remotion';

export type GradePreset =
	| 'warm'
	| 'cool'
	| 'clinical'
	| 'neon'
	| 'military'
	| 'solar'
	| 'purple'
	| 'desaturated';

export interface ColorGradeProps {
	preset: GradePreset;
	intensity?: number; // 0-1, default 0.15
}

interface TintLayer {
	color: string;
	baseOpacity: number;
	blendMode: React.CSSProperties['mixBlendMode'];
}

interface GradeConfig {
	tint?: TintLayer;
	backdropFilter?: string;
}

const PRESETS: Record<GradePreset, GradeConfig> = {
	// DB train station — amber tinted glass. Warm but transparent.
	warm: {
		tint: {
			color: '#d4920a',
			baseOpacity: 0.05,
			blendMode: 'screen',
		},
		backdropFilter: 'sepia(0.08)',
	},

	// McDonald's — fluorescent cool light, faint cyan wash.
	clinical: {
		tint: {
			color: '#0088cc',
			baseOpacity: 0.025,
			blendMode: 'screen',
		},
		backdropFilter: 'saturate(0.9)',
	},

	// Steam/gaming — blue screen glow from monitors.
	cool: {
		tint: {
			color: '#0044ff',
			baseOpacity: 0.04,
			blendMode: 'screen',
		},
	},

	// Twitch — purple tint, light wash.
	purple: {
		tint: {
			color: '#7733dd',
			baseOpacity: 0.05,
			blendMode: 'screen',
		},
	},

	// 4chan — faint green phosphor. Barely desaturated.
	desaturated: {
		tint: {
			color: '#003300',
			baseOpacity: 0.025,
			blendMode: 'screen',
		},
		backdropFilter: 'grayscale(0.1)',
	},

	// PumpFun — trading screen green glow.
	neon: {
		tint: {
			color: '#00ff88',
			baseOpacity: 0.02,
			blendMode: 'screen',
		},
		backdropFilter: 'saturate(1.1)',
	},

	// Radar — faint green tint. Still visible underneath.
	military: {
		tint: {
			color: '#003300',
			baseOpacity: 0.04,
			blendMode: 'screen',
		},
		backdropFilter: 'grayscale(0.1) saturate(0.85)',
	},

	// Space — solar imagery feels warm. Red wash + saturation.
	solar: {
		tint: {
			color: '#ff2200',
			baseOpacity: 0.04,
			blendMode: 'overlay',
		},
		backdropFilter: 'saturate(1.15)',
	},
};

export const ColorGrade: React.FC<ColorGradeProps> = ({
	preset,
	intensity = 0.15,
}) => {
	const config = PRESETS[preset];
	const scale = intensity / 0.15;

	const hasBackdrop = !!config.backdropFilter;
	const backdropStr = config.backdropFilter ?? '';

	// If no tint layer, render only the backdrop filter
	if (!config.tint) {
		if (!hasBackdrop) return null;
		return (
			<AbsoluteFill
				style={{
					pointerEvents: 'none',
					backdropFilter: backdropStr,
					WebkitBackdropFilter: backdropStr,
				}}
			/>
		);
	}

	const opacity = config.tint.baseOpacity * scale;

	// Tint layer and backdrop filter combined when both exist
	return (
		<>
			{hasBackdrop && (
				<AbsoluteFill
					style={{
						pointerEvents: 'none',
						backdropFilter: backdropStr,
						WebkitBackdropFilter: backdropStr,
					}}
				/>
			)}
			<AbsoluteFill
				style={{
					pointerEvents: 'none',
					backgroundColor: config.tint.color,
					opacity,
					mixBlendMode: config.tint.blendMode,
				}}
			/>
		</>
	);
};
