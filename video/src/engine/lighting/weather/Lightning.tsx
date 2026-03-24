import React, { useMemo } from "react";
import { mulberry32 } from "../../../shorts/short-02/components/city/cityConfig";

export const Lightning: React.FC<{ frame: number }> = ({ frame }) => {
  const strikes = useMemo(() => {
    const r = mulberry32(4321);
    const s: number[] = [];
    let f = 8 + Math.floor(r() * 15);
    while (f < 300) {
      s.push(f);
      f += 25 + Math.floor(r() * 20);
    }
    return s;
  }, []);

  let intensity = 0;
  for (const sf of strikes) {
    const dt = frame - sf;
    if (dt >= 0 && dt < 8) {
      const primary = Math.max(0, 1 - dt / 4);
      const flicker = dt === 2 || dt === 3 ? 0.6 : 0;
      intensity = Math.max(intensity, primary + flicker);
    }
  }

  if (intensity <= 0) return null;

  return (
    <>
      <directionalLight
        position={[0, 10, -3]}
        intensity={intensity * 8}
        color="#ccccff"
      />
      <ambientLight intensity={intensity * 2} color="#eeeeff" />
    </>
  );
};
