import { useEffect, useState } from "react";
import {
  cancelRender,
  continueRender,
  delayRender,
  staticFile,
} from "remotion";
import type { Caption, CaptionPage } from "../types";
import { msToFrame } from "../utils/frameConvert";

const WORDS_PER_PAGE = 4;
const PRE_EMIT_MS = 70; // show words slightly before audio

const buildPages = (captions: Caption[], fps: number): CaptionPage[] => {
  const pages: CaptionPage[] = [];
  for (let i = 0; i < captions.length; i += WORDS_PER_PAGE) {
    const words = captions.slice(i, i + WORDS_PER_PAGE);
    const startFrame = msToFrame(words[0].startMs - PRE_EMIT_MS, fps);
    const lastWord = words[words.length - 1];
    const endFrame = msToFrame(lastWord.endMs + 200, fps);
    pages.push({ words, startFrame, endFrame });
  }
  return pages;
};

interface CaptionsResult {
  captions: Caption[];
  pages: CaptionPage[];
}

export const useCaptions = (captionsPath: string, fps = 30): CaptionsResult => {
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [pages, setPages] = useState<CaptionPage[]>([]);
  const [handle] = useState(() => delayRender("Loading captions"));

  useEffect(() => {
    fetch(staticFile(captionsPath))
      .then((r) => r.json())
      .then((data: Caption[]) => {
        setCaptions(data);
        setPages(buildPages(data, fps));
        continueRender(handle);
      })
      .catch((err) => cancelRender(err));
  }, [captionsPath, fps, handle]);

  return { captions, pages };
};
