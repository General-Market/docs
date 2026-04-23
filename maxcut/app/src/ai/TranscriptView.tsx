import { useCallback, useEffect, useMemo, useState } from "react";
import { useStore } from "@/project/store";
import type { Transcript } from "@/project/schema";
import { applyAssetCut } from "./rippleBridge";

// A coordinate in transcript-space: which transcript, which word inside it.
type Cursor = { assetId: string; index: number };

function sameCursor(a: Cursor, b: Cursor): boolean {
  return a.assetId === b.assetId && a.index === b.index;
}

function cursorKey(c: Cursor): string {
  return `${c.assetId}#${c.index}`;
}

export interface DeleteEvent {
  assetId: string;
  fromFrame: number;
  toFrame: number;
}

export interface TranscriptViewProps {
  onDeleteWords?: (e: DeleteEvent) => void;
}

export function TranscriptView({ onDeleteWords }: TranscriptViewProps) {
  const transcripts = useStore((s) => s.project.transcripts);
  const media = useStore((s) => s.project.media);
  const fps = useStore((s) => s.project.meta.fps);
  const setPlayhead = useStore((s) => s.setPlayhead);
  const setInOut = useStore((s) => s.setInOut);
  const setProject = useStore((s) => s.setProject);
  const upsertTranscript = useStore((s) => s.upsertTranscript);

  const [selected, setSelected] = useState<Cursor[]>([]);
  const [anchor, setAnchor] = useState<Cursor | null>(null);

  const assetName = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of media) map.set(a.id, a.path.split("/").pop() ?? a.path);
    return map;
  }, [media]);

  const onHover = useCallback(
    (t: Transcript, index: number) => {
      const w = t.words[index];
      if (!w) return;
      setInOut(Math.round(w.start * fps), Math.round(w.end * fps));
    },
    [fps, setInOut],
  );

  const onClickWord = useCallback(
    (t: Transcript, index: number, ev: React.MouseEvent) => {
      const w = t.words[index];
      if (!w) return;
      const cursor: Cursor = { assetId: t.assetId, index };

      if (ev.metaKey || ev.ctrlKey) {
        // Cmd-click: toggle individual.
        setSelected((prev) => {
          const found = prev.some((c) => sameCursor(c, cursor));
          if (found) return prev.filter((c) => !sameCursor(c, cursor));
          return [...prev, cursor];
        });
        setAnchor(cursor);
        return;
      }

      if (ev.shiftKey && anchor && anchor.assetId === t.assetId) {
        const [lo, hi] =
          anchor.index <= index
            ? [anchor.index, index]
            : [index, anchor.index];
        const span: Cursor[] = [];
        for (let i = lo; i <= hi; i++) span.push({ assetId: t.assetId, index: i });
        setSelected(span);
        return;
      }

      setSelected([cursor]);
      setAnchor(cursor);
      setPlayhead(Math.round(w.start * fps));
    },
    [anchor, fps, setPlayhead],
  );

  const deleteSelection = useCallback(async () => {
    if (selected.length === 0) return;
    // Group by asset.
    const byAsset = new Map<string, number[]>();
    for (const c of selected) {
      const arr = byAsset.get(c.assetId) ?? [];
      arr.push(c.index);
      byAsset.set(c.assetId, arr);
    }

    for (const [assetId, indicesUnsorted] of byAsset) {
      const t = transcripts.find((x) => x.assetId === assetId);
      if (!t) continue;
      const indices = [...indicesUnsorted].sort((a, b) => a - b);
      if (indices.length === 0) continue;

      // Collapse contiguous runs into single ripple cuts, back-to-front so
      // earlier cuts don't invalidate later source frames.
      const runs: { from: number; to: number }[] = [];
      let runStart = indices[0];
      let runEnd = indices[0];
      for (let i = 1; i < indices.length; i++) {
        if (indices[i] === runEnd + 1) {
          runEnd = indices[i];
        } else {
          runs.push({ from: runStart, to: runEnd });
          runStart = indices[i];
          runEnd = indices[i];
        }
      }
      runs.push({ from: runStart, to: runEnd });
      runs.sort((a, b) => b.from - a.from);

      for (const run of runs) {
        const first = t.words[run.from];
        const last = t.words[run.to];
        if (!first || !last) continue;
        const fromFrame = Math.round(first.start * fps);
        const toFrame = Math.round(last.end * fps);

        if (onDeleteWords) {
          onDeleteWords({ assetId, fromFrame, toFrame });
        } else {
          const project = useStore.getState().project;
          const next = await applyAssetCut({
            project,
            assetId,
            fromSource: fromFrame,
            toSource: toFrame,
          });
          setProject(next);
        }
      }

      // Remove the words from the transcript itself.
      const keep = t.words.filter((_w, i) => !indices.includes(i));
      upsertTranscript({ ...t, words: keep });
    }

    setSelected([]);
    setAnchor(null);
  }, [fps, onDeleteWords, selected, setProject, transcripts, upsertTranscript]);

  useEffect(() => {
    function onKey(ev: KeyboardEvent) {
      if (ev.key !== "Delete" && ev.key !== "Backspace") return;
      const tgt = ev.target as HTMLElement | null;
      // Respect editable fields — don't steal their Del key.
      if (tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA" || tgt.isContentEditable)) {
        return;
      }
      if (selected.length === 0) return;
      ev.preventDefault();
      void deleteSelection();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleteSelection, selected.length]);

  if (transcripts.length === 0) {
    return (
      <div className="empty-state" style={{ height: 120 }}>
        No transcripts yet
      </div>
    );
  }

  const selectedSet = new Set(selected.map(cursorKey));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      {transcripts.map((t) => (
        <section key={t.assetId}>
          <header
            className="label"
            style={{
              paddingBottom: "var(--space-1)",
              borderBottom: "1px solid var(--divider)",
              marginBottom: "var(--space-2)",
            }}
          >
            {assetName.get(t.assetId) ?? t.assetId}
          </header>
          <div
            style={{
              fontSize: "var(--fs-13)",
              lineHeight: 1.6,
              color: "var(--fg)",
              userSelect: "none",
            }}
          >
            {t.words.map((w, i) => {
              const key = cursorKey({ assetId: t.assetId, index: i });
              const isSel = selectedSet.has(key);
              return (
                <span
                  key={i}
                  onMouseEnter={() => onHover(t, i)}
                  onClick={(e) => onClickWord(t, i, e)}
                  style={{
                    cursor: "pointer",
                    padding: "0 2px",
                    background: isSel ? "var(--accent)" : "transparent",
                    color: isSel ? "var(--bg)" : "var(--fg)",
                    borderRadius: 2,
                  }}
                >
                  {w.text}
                  {i < t.words.length - 1 ? " " : ""}
                </span>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
