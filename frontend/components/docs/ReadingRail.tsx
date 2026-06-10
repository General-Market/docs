"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

interface RailMark {
  id: string;
  text: string;
  level: 2 | 3;
  /** Distance from the top of the article, as a fraction of its height. */
  pos: number;
}

// A spine that lives in the left gutter of the article and scrolls with it.
// Grey track, one dot per heading placed where that heading actually sits, an
// accent fill that grows down to the read-line. Because it's measured against
// the article column (.docs-main) it begins and ends with the article — never
// floating in the margin, never spilling into the footer.
const ANCHOR = 96; // the read-line: sticky topbar (52) + breathing room.

export function ReadingRail() {
  const pathname = usePathname();
  const [marks, setMarks] = useState<RailMark[]>([]);
  const [read, setRead] = useState(0); // fraction of the article read (0..1)
  const rafRef = useRef(0);
  const mainRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let frame = 0;
    const main = (mainRef.current = document.querySelector<HTMLElement>(".docs-main"));
    if (!main) return;

    function measure() {
      const el = mainRef.current;
      if (!el) return;
      const mainTop = el.getBoundingClientRect().top + window.scrollY;
      const mainH = Math.max(1, el.offsetHeight);
      const nodes = Array.from(el.querySelectorAll<HTMLElement>(".docs-prose h2[id], .docs-prose h3[id]"));
      setMarks(
        nodes.map((n) => {
          const nTop = n.getBoundingClientRect().top + window.scrollY;
          return {
            id: n.id,
            text: n.textContent ?? "",
            level: n.tagName === "H3" ? 3 : 2,
            pos: Math.min(1, Math.max(0, (nTop - mainTop) / mainH)),
          };
        }),
      );
      updateRead();
    }

    function updateRead() {
      const el = mainRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const mainH = Math.max(1, el.offsetHeight);
      // Read-line position within the article, in [0, mainH].
      const readPx = Math.min(mainH, Math.max(0, ANCHOR - rect.top));
      setRead(readPx / mainH);
    }

    function onScroll() {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;
        updateRead();
      });
    }

    frame = requestAnimationFrame(measure);
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    });
    ro.observe(main);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", onScroll);
    };
  }, [pathname]);

  if (marks.length < 2) return null;

  return (
    <div className="docs-rail" aria-hidden="true">
      <div className="docs-rail-fill" style={{ height: `${read * 100}%` }} />
      {marks.map((m) => (
        <button
          key={m.id}
          type="button"
          className="docs-rail-dot"
          data-lit={read >= m.pos - 0.004}
          data-level={m.level}
          style={{ top: `${m.pos * 100}%` }}
          tabIndex={-1}
          onClick={() =>
            document.getElementById(m.id)?.scrollIntoView({ behavior: "smooth", block: "start" })
          }
        >
          <span className="docs-rail-label">{m.text}</span>
        </button>
      ))}
    </div>
  );
}
