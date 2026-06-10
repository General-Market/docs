"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { AlignLeft, ChevronRight } from "lucide-react";
import { DocsSidebar } from "@/components/docs/DocsSidebar";
import { TocRail } from "@/components/docs/TocRail";
import { sectionTitle, type HandbookSection } from "@/lib/handbook-sections";
import type { DocGroup } from "@/lib/docslib-pure";

// The narrow-screen second row — Morpho's pattern. Two quiet controls: the page
// name opens the navigation tree as a sheet; "On this page" opens the headings.
// Both slide over the article and close on a tap outside, on Escape, or when the
// route changes. The desktop sidebar and TOC rail are hidden here; this is the
// only way through the docs on a phone. Hidden on desktop (CSS).
export function HandbookMobileBar({
  groups,
  basePath,
  section,
}: {
  groups: DocGroup[];
  basePath: string;
  section: HandbookSection;
}) {
  const pathname = usePathname();
  const [nav, setNav] = useState(false);
  const [toc, setToc] = useState(false);
  const [title, setTitle] = useState(sectionTitle(section));
  const [hasToc, setHasToc] = useState(false);
  const [mounted, setMounted] = useState(false);

  // The sheets portal to <body> so the topbar's backdrop-filter — which would
  // otherwise pin them to the 96px header box — can't clip them.
  useEffect(() => setMounted(true), []);

  // A new page closes whatever was open.
  useEffect(() => {
    setNav(false);
    setToc(false);
  }, [pathname]);

  // Name the page from its rendered H1 so the row matches the article exactly;
  // the section name only stands in until the page paints. Landing pages carry
  // no prose headings, so "On this page" only appears once there are some.
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const h1 = document.querySelector<HTMLElement>(".docs-main h1");
      setTitle(h1?.textContent?.trim() || sectionTitle(section));
      const headings = document.querySelectorAll(".docs-prose h2[id], .docs-prose h3[id]");
      setHasToc(headings.length >= 2);
    });
    return () => cancelAnimationFrame(raf);
  }, [pathname, section]);

  // While a sheet is open, lock the page behind it and close on Escape.
  useEffect(() => {
    if (!nav && !toc) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setNav(false);
        setToc(false);
      }
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [nav, toc]);

  return (
    <div className="docs-subbar">
      <button
        type="button"
        className="docs-subbar-nav"
        aria-expanded={nav}
        onClick={() => {
          setNav((v) => !v);
          setToc(false);
        }}
      >
        <AlignLeft className="docs-subbar-icon" aria-hidden="true" />
        <span className="docs-subbar-title">{title}</span>
      </button>
      {hasToc && (
        <button
          type="button"
          className="docs-subbar-toc"
          aria-expanded={toc}
          onClick={() => {
            setToc((v) => !v);
            setNav(false);
          }}
        >
          <span>On this page</span>
          <ChevronRight className="docs-subbar-icon" aria-hidden="true" />
        </button>
      )}

      {mounted &&
        nav &&
        createPortal(
          <div className="docs-sheet-root">
            <div className="docs-sheet-scrim" onClick={() => setNav(false)} aria-hidden="true" />
            <div className="docs-sheet docs-sheet-nav" role="dialog" aria-modal="true" aria-label="Navigation">
              <DocsSidebar groups={groups} basePath={basePath} />
            </div>
          </div>,
          document.body,
        )}
      {mounted &&
        toc &&
        createPortal(
          <div className="docs-sheet-root">
            <div className="docs-sheet-scrim" onClick={() => setToc(false)} aria-hidden="true" />
            <div
              className="docs-sheet docs-sheet-toc"
              role="dialog"
              aria-modal="true"
              aria-label="On this page"
              onClick={(e) => {
                // A tapped heading jumps in place (no route change), so close here.
                if ((e.target as HTMLElement).closest("a")) setToc(false);
              }}
            >
              <TocRail />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
