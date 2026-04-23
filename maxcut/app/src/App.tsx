import { useStore } from "./project/store";
import { useBasicShortcuts } from "./shortcuts/keymap";
import { MediaBin } from "./ui/MediaBin";
import { Preview } from "./preview/Preview";
import { Inspector } from "./ui/Inspector";
import { Timeline } from "./editor/Timeline";
import { Toolbar } from "./ui/Toolbar";

export function App() {
  useBasicShortcuts();
  const project = useStore((s) => s.project);

  return (
    <div className="app-root">
      <Toolbar />
      <div className="workspace">
        <section className="zone-bin">
          <header className="zone-header">
            <span className="label">MEDIA</span>
          </header>
          <div className="zone-body">
            <MediaBin />
          </div>
        </section>

        <section className="zone-preview">
          <Preview />
        </section>

        <section className="zone-inspector">
          <header className="zone-header">
            <span className="label">INSPECTOR</span>
          </header>
          <div className="zone-body">
            <Inspector />
          </div>
        </section>

        <section className="zone-timeline">
          <Timeline project={project} />
        </section>
      </div>
    </div>
  );
}
