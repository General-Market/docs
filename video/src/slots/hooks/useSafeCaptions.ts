import { useState, useEffect } from "react";
import { staticFile, continueRender, delayRender } from "remotion";
import type { Caption } from "../../lib/types";

export const useSafeCaptions = (path: string): Caption[] => {
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [handle] = useState(() => delayRender("Loading captions"));

  useEffect(() => {
    fetch(staticFile(path))
      .then((r) => r.json())
      .then((data: Caption[]) => {
        if (Array.isArray(data)) setCaptions(data);
        continueRender(handle);
      })
      .catch((err) => {
        console.error(`[useSafeCaptions] Failed to load captions from "${path}":`, err);
        continueRender(handle);
      });
  }, [path, handle]);

  return captions;
};
