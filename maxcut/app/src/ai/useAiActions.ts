import { useCallback } from "react";
import { useStore } from "@/project/store";
import type { CutSuggestion } from "@/project/schema";
import { applyAssetCut } from "./rippleBridge";

export interface AiActions {
  acceptSuggestion: (id: string) => Promise<void>;
  rejectSuggestion: (id: string) => void;
  acceptAllSilencesOver: (ms: number) => Promise<void>;
  acceptAllFillers: () => Promise<void>;
  rejectAll: () => void;
}

// Keep this pure of DOM. The ripple math lives in rippleBridge.
export function useAiActions(): AiActions {
  const setProject = useStore((s) => s.setProject);
  const updateSuggestion = useStore((s) => s.updateSuggestion);

  const apply = useCallback(
    async (s: CutSuggestion) => {
      const project = useStore.getState().project;
      const next = await applyAssetCut({
        project,
        assetId: s.assetId,
        fromSource: s.start,
        toSource: s.end,
      });
      setProject(next);
      updateSuggestion(s.id, { status: "accepted" });
    },
    [setProject, updateSuggestion],
  );

  const acceptSuggestion = useCallback(
    async (id: string) => {
      const s = useStore.getState().project.suggestions.find((x) => x.id === id);
      if (!s || s.status !== "pending") return;
      await apply(s);
    },
    [apply],
  );

  const rejectSuggestion = useCallback(
    (id: string) => {
      updateSuggestion(id, { status: "rejected" });
    },
    [updateSuggestion],
  );

  const acceptAllSilencesOver = useCallback(
    async (ms: number) => {
      const fps = useStore.getState().project.meta.fps;
      const threshold = Math.round((ms / 1000) * fps);
      const targets = useStore
        .getState()
        .project.suggestions.filter(
          (s) =>
            s.kind === "silence" &&
            s.status === "pending" &&
            s.end - s.start >= threshold,
        );
      // Sort descending by source-frame so earlier cuts don't shift later ones.
      targets.sort((a, b) => b.start - a.start);
      for (const s of targets) await apply(s);
    },
    [apply],
  );

  const acceptAllFillers = useCallback(async () => {
    const targets = useStore
      .getState()
      .project.suggestions.filter(
        (s) => s.kind === "filler" && s.status === "pending",
      );
    targets.sort((a, b) => b.start - a.start);
    for (const s of targets) await apply(s);
  }, [apply]);

  const rejectAll = useCallback(() => {
    const pending = useStore
      .getState()
      .project.suggestions.filter((s) => s.status === "pending");
    for (const s of pending) updateSuggestion(s.id, { status: "rejected" });
  }, [updateSuggestion]);

  return {
    acceptSuggestion,
    rejectSuggestion,
    acceptAllSilencesOver,
    acceptAllFillers,
    rejectAll,
  };
}
