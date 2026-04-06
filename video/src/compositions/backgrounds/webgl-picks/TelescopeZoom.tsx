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

// CSS: .front-1 scale(1), .front-2 scale(0.85), ... .front-6 scale(0.15)
const FRONT_INITIAL_SCALES = [1.0, 0.85, 0.6, 0.45, 0.3, 0.15];

// Hero image placeholder — gradient standing in for img-big.jpg
const HERO_GRADIENT =
	'linear-gradient(135deg, #0f0c29 0%, #302b63 30%, #24243e 55%, #6b2fa0 75%, #e94560 100%)';

// 10 scattered thumbnails — positions from CSS .section__images img:nth-of-type(N)
// width: 10vw each, gradients stand in for img-1.webp through img-10.webp
const SMALL_IMAGES: {
	aspect: number;
	gradient: string;
	pos: React.CSSProperties;
}[] = [
	{
		aspect: 0.75,
		gradient: 'linear-gradient(145deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)',
		pos: { top: '15vw', left: '-3vw' },
	},
	{
		aspect: 1.3,
		gradient: 'linear-gradient(160deg, #2d1b69 0%, #6b3fa0 50%, #c77dff 100%)',
		pos: { top: '5vw', left: '20vw' },
	},
	{
		aspect: 0.65,
		gradient: 'linear-gradient(135deg, #134e5e 0%, #71b280 100%)',
		pos: { top: '8vw', left: '26.5vw' },
	},
	{
		aspect: 1.4,
		gradient: 'linear-gradient(150deg, #0c0c0c 0%, #3a3a3a 40%, #8e7c68 100%)',
		pos: { top: '18vw', right: '18vw' },
	},
	{
		aspect: 0.7,
		gradient: 'linear-gradient(140deg, #1f1c2c 0%, #928dab 100%)',
		pos: { top: '5vw', right: '10vw' },
	},
	{
		aspect: 1.2,
		gradient: 'linear-gradient(155deg, #2c3e50 0%, #4ca1af 50%, #c4e0e5 100%)',
		pos: { bottom: '5vw', left: '10vw' },
	},
	{
		aspect: 0.6,
		gradient: 'linear-gradient(130deg, #0f2027 0%, #203a43 40%, #2c5364 100%)',
		pos: { bottom: '8vw', left: '22.5vw' },
	},
	{
		aspect: 1.1,
		gradient: 'linear-gradient(145deg, #232526 0%, #414345 50%, #636363 100%)',
		pos: { bottom: '3vw', left: '45vw' },
	},
	{
		aspect: 0.75,
		gradient: 'linear-gradient(160deg, #1e3c72 0%, #2a5298 50%, #4a77b4 100%)',
		pos: { bottom: '5vw', right: '15vw' },
	},
	{
		aspect: 1.35,
		gradient: 'linear-gradient(135deg, #141e30 0%, #243b55 50%, #4b6584 100%)',
		pos: { bottom: '9vw', right: '7vw' },
	},
];

// --- GSAP timeline mapping ---
// Tween 1 @ position 0:   smallImages z → 100vh,   dur=1, ease=power1.inOut, stagger={amount:0.2, from:"center"}
// Tween 2 @ position 0.6: frontImages scale → 1,   dur=1, ease=power1.inOut, delay=0.1
// Tween 3 @ position 0.6: frontImages blur → 0px,  dur=1, ease=power1.inOut, delay=0.4, stagger={amount:0.2, from:"end"}
//
// Timeline total: tween 3's last element starts at 0.6 + 0.4 + 0.2 = 1.2, ends at 2.2
const TL = 2.2;

const easeIO = Easing.inOut(Easing.ease);

function clamp01(v: number) {
	return Math.min(1, Math.max(0, v));
}

// GSAP stagger "from: center" — center indices get offset 0, edges get the most
function staggerCenter(i: number, n: number, amount: number) {
	const mid = (n - 1) / 2;
	if (mid === 0) return 0;
	return (Math.abs(i - mid) / mid) * amount;
}

// GSAP stagger "from: end" — last index gets offset 0, first gets the most
function staggerEnd(i: number, n: number, amount: number) {
	if (n <= 1) return 0;
	return ((n - 1 - i) / (n - 1)) * amount;
}

// Map a GSAP tween's per-element timing to a 0→1 progress value given raw scroll position
function tweenProgress(
	raw: number,
	tlStart: number,
	duration: number,
): number {
	const rawStart = tlStart / TL;
	const rawEnd = (tlStart + duration) / TL;
	const linear = clamp01(interpolate(raw, [rawStart, rawEnd], [0, 1], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
	}));
	return easeIO(linear);
}

export const TelescopeZoom: React.FC = () => {
	const frame = useCurrentFrame();
	const { width, height, durationInFrames } = useVideoConfig();

	// raw = linear scroll progress 0→1 (drives the GSAP timeline scrub)
	const raw = frame / durationInFrames;
	// progress = power1.inOut(scrollProgress) — the CSS --progress variable
	const progress = easeIO(clamp01(raw));
	const vw = width / 100;

	// Text: font-size 3vw, weight 600, font-family area-normal (fallback system-ui)
	const fontSize = 3 * vw;
	// Approximate text widths for the CSS calc(var(--progress) * (-66vw + 100%) ...)
	// "100%" in CSS transform = element's own width
	const leftTextW = fontSize * 3.5; // "for the" ~3.5em
	const rightTextW = fontSize * 3.2; // "planet" ~3.2em
	// CSS: .left  → translate3d(calc(--progress * (-66vw + 100%) - 0.5vw), 0, 0)
	// CSS: .right → translate3d(calc(--progress * (66vw - 100%)), 0, 0)
	const leftX = progress * (-66 * vw + leftTextW) - progress * 0.5 * vw;
	const rightX = progress * (66 * vw - rightTextW);

	return (
		<AbsoluteFill style={{ backgroundColor: '#fff', overflow: 'hidden' }}>
			{/* h1 — centered text that splits apart as progress rises */}
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
						fontFamily: "'area-normal', system-ui, sans-serif",
						fontSize,
						fontWeight: 600,
						color: '#1a1a1a',
						whiteSpace: 'nowrap',
						display: 'inline-block',
						transform: `translate3d(${leftX}px, 0, 0)`,
					}}
				>
					for the
				</span>
				<span
					style={{
						fontFamily: "'area-normal', system-ui, sans-serif",
						fontSize,
						fontWeight: 600,
						color: '#1a1a1a',
						whiteSpace: 'nowrap',
						display: 'inline-block',
						transform: `translate3d(${rightX}px, 0, 0)`,
					}}
				>
					planet
				</span>
			</div>

			{/* section__media — scales 0→1 via eased --progress */}
			<div
				style={{
					position: 'absolute',
					inset: 0,
					zIndex: 2,
					transform: `scale(${progress})`,
					transformOrigin: 'center center',
				}}
			>
				{/* Back layer — full hero image, no mask */}
				<div
					style={{
						position: 'absolute',
						width: '100%',
						height: '100%',
						background: HERO_GRADIENT,
					}}
				/>

				{/* 6 front mask layers — each at a fixed initial scale, animating to scale(1) and blur(0) */}
				{FRONT_INITIAL_SCALES.map((initScale, i) => {
					// Tween 2: all front layers scale to 1, starts at tl-time 0.7, dur 1
					const scaleT = tweenProgress(raw, 0.7, 1.0);
					const scale = initScale + (1 - initScale) * scaleT;

					// Tween 3: blur 2px → 0px, staggered from end
					// Each element's tl-start = 0.6 + 0.4 (delay) + staggerEnd offset
					const stOff = staggerEnd(i, FRONT_INITIAL_SCALES.length, 0.2);
					const blurTlStart = 1.0 + stOff; // 0.6 + 0.4 = 1.0 base
					const blurT = tweenProgress(raw, blurTlStart, 1.0);
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

			{/* section__images — 10 thumbnails with perspective, z → 100vh */}
			<div
				style={{
					position: 'absolute',
					top: 0,
					left: 0,
					width: '100vw',
					height: '100vh',
					perspective: '100vh',
					zIndex: 3,
					pointerEvents: 'none',
				}}
			>
				{SMALL_IMAGES.map((img, i) => {
					// Tween 1: z → 100vh, stagger from center
					const stOff = staggerCenter(i, SMALL_IMAGES.length, 0.2);
					const flyT = tweenProgress(raw, stOff, 1.0);
					const z = flyT * height; // 100vh

					const imgW = 10 * vw;
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
									borderRadius: 4,
									overflow: 'hidden',
									transformStyle: 'preserve-3d',
									backfaceVisibility: 'hidden',
									transform: `translate3d(0, 0, ${z}px)`,
									...img.pos,
								} as React.CSSProperties
							}
						/>
					);
				})}
			</div>
		</AbsoluteFill>
	);
};
