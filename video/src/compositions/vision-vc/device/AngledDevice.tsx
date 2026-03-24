import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from "remotion";

type EasingFunction = (t: number) => number;

interface Keyframe {
  z: number;
  rotateY: number;
  rotateX: number;
  rotate: number;
  easing?: EasingFunction;
}

interface AngledDeviceProps {
  children: React.ReactNode;
  perspective?: number;
  cycleDuration?: number;
  keyframes?: Record<number, Keyframe>;
}

const DEFAULT_EASE_IN_OUT = Easing.bezier(0, 0, 0, 1);

const DEFAULT_KEYFRAMES: Record<number, Keyframe> = {
  0: {
    z: 330,
    rotateY: -20,
    rotateX: 15,
    rotate: -7,
    easing: DEFAULT_EASE_IN_OUT,
  },
  60: {
    z: 0,
    rotateY: 0,
    rotateX: 0,
    rotate: 0,
    easing: Easing.linear,
  },
  160: {
    z: 330,
    rotateY: 20,
    rotateX: 15,
    rotate: 7,
    easing: DEFAULT_EASE_IN_OUT,
  },
  300: {
    z: 0,
    rotateY: 0,
    rotateX: 0,
    rotate: 0,
    easing: Easing.linear,
  },
};

export const AngledDevice: React.FC<AngledDeviceProps> = ({
  children,
  perspective = 1200,
  cycleDuration = 300,
  keyframes = DEFAULT_KEYFRAMES,
}) => {
  const frame = useCurrentFrame();

  const currentFromKeyframe = useMemo(() => {
    const keyframeValues = Object.values(keyframes);
    const keyframeFrames = Object.keys(keyframes).map((v) => Number(v));

    const [currentBaseFrameIndex, currentBaseFrame] = keyframeFrames.reduce<
      [number, number]
    >(
      ([lastIndex, makeshiftCurrentFrame], toBeCheckedFrame, index) =>
        toBeCheckedFrame <= frame % cycleDuration
          ? [index, toBeCheckedFrame]
          : [lastIndex, makeshiftCurrentFrame],
      [0, 0]
    );

    if (!keyframeValues[currentBaseFrameIndex + 1]) return null;

    const currentKf = keyframeValues[currentBaseFrameIndex];
    const nextKf = keyframeValues[currentBaseFrameIndex + 1];
    const easingFn =
      typeof currentKf.easing === "function"
        ? currentKf.easing
        : Easing.linear;

    const val: Record<string, number> = {};
    for (const key of Object.keys(currentKf) as Array<keyof Keyframe>) {
      if (key === "easing") continue;
      val[key] = interpolate(
        frame % cycleDuration,
        [currentBaseFrame, keyframeFrames[currentBaseFrameIndex + 1]],
        [currentKf[key] as number, nextKf[key] as number],
        { easing: easingFn }
      );
    }

    return val;
  }, [frame, cycleDuration, keyframes]);

  return (
    <AbsoluteFill
      style={{
        perspective,
      }}
    >
      <AbsoluteFill
        style={{
          transform: `translateZ(${currentFromKeyframe?.z ?? 0}px) rotateY(${currentFromKeyframe?.rotateY ?? 0}deg) rotateX(${currentFromKeyframe?.rotateX ?? 0}deg) rotate(${currentFromKeyframe?.rotate ?? 0}deg)`,
          transformOrigin: "center center",
        }}
      >
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
