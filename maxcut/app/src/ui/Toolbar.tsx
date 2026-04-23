import { useStore } from "@/project/store";

function formatTimecode(frame: number, fps: number): string {
  const totalSeconds = frame / fps;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  const f = Math.floor(frame % fps);
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}:${pad(f)}`;
}

export function Toolbar() {
  const project = useStore((s) => s.project);
  const playhead = useStore((s) => s.playheadFrame);
  const playing = useStore((s) => s.playing);
  const setPlaying = useStore((s) => s.setPlaying);
  const tool = useStore((s) => s.tool);
  const setTool = useStore((s) => s.setTool);

  return (
    <header className="toolbar">
      <span className="brand">MAXCUT</span>
      <span className="label">{project.name}</span>

      <div style={{ width: 12 }} />

      <button onClick={() => setTool("select")} aria-pressed={tool === "select"}>Select</button>
      <button onClick={() => setTool("razor")}  aria-pressed={tool === "razor"}>Razor</button>
      <button onClick={() => setTool("slip")}   aria-pressed={tool === "slip"}>Slip</button>
      <button onClick={() => setTool("slide")}  aria-pressed={tool === "slide"}>Slide</button>
      <button onClick={() => setTool("pen")}    aria-pressed={tool === "pen"}>Pen</button>

      <span className="spacer" />

      <button onClick={() => setPlaying(!playing)}>{playing ? "Pause" : "Play"}</button>

      <span className="timecode mono">{formatTimecode(playhead, project.meta.fps)}</span>

      <span className="label">{project.meta.width}×{project.meta.height} · {project.meta.fps}fps</span>
    </header>
  );
}
