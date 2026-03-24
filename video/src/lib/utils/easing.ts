export interface SpringConfig {
  damping: number;
  mass: number;
  stiffness: number;
  overshootClamping: boolean;
}

export const BOUNCY: SpringConfig = {
  damping: 10,
  mass: 1,
  stiffness: 250,
  overshootClamping: false,
};

export const SNAPPY: SpringConfig = {
  damping: 12,
  mass: 0.8,
  stiffness: 200,
  overshootClamping: false,
};

export const SMOOTH: SpringConfig = {
  damping: 20,
  mass: 1.2,
  stiffness: 150,
  overshootClamping: false,
};

export const HEAVY: SpringConfig = {
  damping: 15,
  mass: 1.5,
  stiffness: 180,
  overshootClamping: false,
};

// IndexMaker DA spring configs — matching frontend's framer-motion & react-spring
export const IM_ENTRANCE: SpringConfig = {
  damping: 20,
  mass: 1,
  stiffness: 120,
  overshootClamping: true,
};

export const IM_CAPTION: SpringConfig = {
  damping: 25,
  mass: 0.8,
  stiffness: 200,
  overshootClamping: true,
};

export const IM_PULSE: SpringConfig = {
  damping: 15,
  mass: 0.6,
  stiffness: 300,
  overshootClamping: false,
};

export const IM_SETTLE: SpringConfig = {
  damping: 22,
  mass: 1.2,
  stiffness: 80,
  overshootClamping: true,
};
