// Source: https://tympanus.net/Tutorials/TelescopeZoom/
import React from 'react';
import {
	AbsoluteFill,
	useCurrentFrame,
	useVideoConfig,
	interpolate,
	Easing,
	staticFile,
} from 'remotion';

const MASK_URL = staticFile('compositions/webgl-picks/mask.png');

const FRONT_INITIAL_SCALES = [1.0, 0.85, 0.6, 0.45, 0.3, 0.15];

const HERO_GRADIENT =
	'linear-gradient(135deg, #0f0c29 0%, #302b63 30%, #24243e 55%, #6b2fa0 75%, #e94560 100%)';

// 10 scattered thumbnail cards — gradient rectangles with photographic aspect ratios
const SMALL_IMAGES: {
	w: number;
	aspect: number;
	gradient: string;
	pos: React.CSSProperties;
}[] = [
	{
		w: 10,
		aspect: 0.75,
		gradient: 'linear-gradient(145deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)',
		pos: { top: '15vw', left: '-3vw' },
	},
	{
		w: 10,
		aspect: 1.3,
		gradient: 'linear-gradient(160deg, #2d1b69 0%, #6b3fa0 50%, #c77dff 100%)',
		pos: { top: '5vw', left: '20vw' },
	},
	{
		w: 10,
		aspect: 0.65,
		gradient: 'linear-gradient(135deg, #134e5e 0%, #71b280 100%)',
		pos: { top: '8vw', left: '26.5vw' },
	},
	{
		w: 10,
		aspect: 1.4,
		gradient:
			'linear-gradient(150deg, #0c0c0c 0%, #3a3a3a 40%, #8e7c68 100%)',
		pos: { top: '18vw', right: '18vw' },
	},
	{
		w: 10,
		aspect: 0.7,
		gradient: 'linear-gradient(140deg, #1f1c2c 0%, #928dab 100%)',
		pos: { top: '5vw', right: '10vw' },
	},
	{
		w: 10,
		aspect: 1.2,
		gradient:
			'linear-gradient(155deg, #2c3e50 0%, #4ca1af 50%, #c4e0e5 100%)',
		pos: { bottom: '5vw', left: '10vw' },
	},
	{
		w: 10,
		aspect: 0.6,
		gradient:
			'linear-gradient(130deg, #0f2027 0%, #203a43 40%, #2c5364 100%)',
		pos: { bottom: '8vw', left: '22.5vw' },
	},
	{
		w: 10,
		aspect: 1.1,
		gradient:
			'linear-gradient(145deg, #232526 0%, #414345 50%, #636363 100%)',
		pos: { bottom: '3vw', left: '45vw' },
	},
	{
		w: 10,
		aspect: 0.75,
		gradient:
			'linear-gradient(160deg, #1e3c72 0%, #2a5298 50%, #4a77b4 100%)',
		pos: { bottom: '5vw', right: '15vw' },
	},
	{
		w: 10,
		aspect: 1.35,
		gradient:
			'linear-gradient(135deg, #141e30 0%, #243b55 50%, #4b6584 100%)',
		pos: { bottom: '9vw', right: '7vw' },
	},
];

// GSAP timeline total duration: tween3 ends at 1.0 + 1.0 dur + 0.2 stagger = 2.2
const TL = 2.2;

const easeIO = Easing.inOut(Easing.ease);

function clamp01(v: number) {
	return Math.min(1, Math.max(0, v));
}

// "from: center" — center index gets offset 0, edges get the most
function staggerCenter(i: number, n: number, amount: number) {
	const mid = (n - 1) / 2;
	return mid === 0 ? 0 : (Math.abs(i - mid) / mid) * amount;
}

// "from: end" — last index gets offset 0, first index gets the most
function staggerEnd(i: number, n: number, amount: number) {
	return n <= 1 ? 0 : ((n - 1 - i) / (n - 1)) * amount;
}

export const TelescopeZoom: React.FC = () => {
	const frame = useCurrentFrame();
	const { width, height, durationInFrames } = useVideoConfig();

	const raw = frame / durationInFrames;
	const progress = easeIO(clamp01(raw));
	const vw = width / 100;

	// --- Timeline ranges mapped to rawProgress ---
	// Tween 1 @ 0: smallImages z -> 100vh, dur=1, stagger=0.2 from center
	const t1s = 0 / TL;
	const t1e = 1 / TL;
	// Tween 2 @ 0.6: frontLayers scale -> 1, dur=1, delay=0.1 -> eff 0.7..1.7
	const t2s = 0.7 / TL;
	const t2e = 1.7 / TL;
	// Tween 3 @ 0.6: frontLayers blur -> 0px, dur=1, delay=0.4, stagger=0.2 from end -> eff 1.0..2.2
	const t3s = 1.0 / TL;
	const t3e = 2.2 / TL; // = 1.0

	// --- Text split ---
	// CSS: .left  translateX(--progress * (-66vw + 100% - 0.5vw))
	//      .right translateX(--progress * (66vw - 100%))
	const fontSize = 3 * vw;
	const leftW = fontSize * 3.8;
	const rightW = fontSize * 3.2;
	const leftX = progress * (-66 * vw + leftW - 0.5 * vw);
	const rightX = progress * (66 * vw - rightW);

	return (
		<AbsoluteFill style={{ backgroundColor: '#fff', overflow: 'hidden' }}>
			{/* Text — visible at start, splits apart as progress rises */}
			<div
				style={{
					position: 'absolute',
					inset: 0,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					transform: 'translateY(-15%)',
					zIndex: 1,
				}}
			>
				<span
					style={{
						fontFamily: 'system-ui, sans-serif',
						fontSize,
						fontWeight: 600,
						color: '#000',
						whiteSpace: 'nowrap',
						display: 'inline-block',
						transform: `translate3d(${leftX}px, 0, 0)`,
					}}
				>
					for the
				</span>
				<span
					style={{
						fontFamily: 'system-ui, sans-serif',
						fontSize,
						fontWeight: 600,
						color: '#000',
						whiteSpace: 'nowrap',
						display: 'inline-block',
						transform: `translate3d(${rightX}px, 0, 0)`,
					}}
				>
					planet
				</span>
			</div>

			{/* section__media — scales 0->1 via eased progress, reveals hero */}
			<div
				style={{
					position: 'absolute',
					inset: 0,
					zIndex: 2,
					transform: `scale(${progress})`,
					transformOrigin: 'center center',
				}}
			>
				{/* Back layer — full hero, no mask */}
				<div
					style={{
						position: 'absolute',
						width: '100%',
						height: '100%',
						background: HERO_GRADIENT,
					}}
				/>

				{/* 6 front mask layers — scale + blur-to-clear */}
				{FRONT_INITIAL_SCALES.map((initScale, i) => {
					const scaleT = easeIO(
						clamp01(
							interpolate(raw, [t2s, Math.min(t2e, 1)], [0, 1], {
								extrapolateLeft: 'clamp',
								extrapolateRight: 'clamp',
							}),
						),
					);
					const scale = initScale + (1 - initScale) * scaleT;

					const stOff = staggerEnd(i, FRONT_INITIAL_SCALES.length, 0.2);
					const blurStart = t3s + stOff * (t3e - t3s);
					const blurT = easeIO(
						clamp01(
							interpolate(raw, [blurStart, Math.min(t3e, 1)], [0, 1], {
								extrapolateLeft: 'clamp',
								extrapolateRight: 'clamp',
							}),
						),
					);
					const blur = 2 * (1 - blurT);

					return (
						<div
							key={i}
							style={
								{
									position: 'absolute',
									width: '100%',
									height: '100%',
									background: HERO_GRADIENT,
									transform: `scale(${scale})`,
									transformOrigin: 'center center',
									filter: `blur(${blur}px)`,
									WebkitMaskImage: `url(${MASK_URL})`,
									maskImage: `url(${MASK_URL})`,
									WebkitMaskPosition: '50% 50%',
									maskPosition: '50% 50%',
									WebkitMaskSize: 'cover',
									maskSize: 'cover',
									WebkitMaskRepeat: 'no-repeat',
									maskRepeat: 'no-repeat',
								} as React.CSSProperties
							}
						/>
					);
				})}
			</div>

			{/* section__images — 10 scattered thumbnails flying toward camera */}
			<div
				style={{
					position: 'absolute',
					inset: 0,
					perspective: `${height}px`,
					zIndex: 3,
					pointerEvents: 'none',
				}}
			>
				{SMALL_IMAGES.map((img, i) => {
					const stOff = staggerCenter(i, SMALL_IMAGES.length, 0.2);
					const imgStart = t1s + stOff * (t1e - t1s);

					const flyT = easeIO(
						clamp01(
							interpolate(raw, [imgStart, t1e], [0, 1], {
								extrapolateLeft: 'clamp',
								extrapolateRight: 'clamp',
							}),
						),
					);
					const z = flyT * height;
					const opacity = interpolate(flyT, [0, 0.7, 1], [1, 1, 0]);

					const imgW = img.w * vw;
					const imgH = imgW * img.aspect;

					return (
						<div
							key={i}
							style={
								{
									position: 'absolute',
									width: imgW,
									height: imgH,
									background: img.gradient,
									borderRadius: 6,
									overflow: 'hidden',
									boxShadow: '0 2px 16px rgba(0,0,0,0.18)',
									transformStyle: 'preserve-3d',
									backfaceVisibility: 'hidden',
									transform: `translate3d(0, 0, ${z}px)`,
									opacity,
									...img.pos,
								} as React.CSSProperties
							}
						>
							<div
								style={{
									position: 'absolute',
									inset: 0,
									background:
										'linear-gradient(180deg, rgba(255,255,255,0.12) 0%, transparent 40%, rgba(0,0,0,0.15) 100%)',
									pointerEvents: 'none',
								}}
							/>
						</div>
					);
				})}
			</div>
		</AbsoluteFill>
	);
};
