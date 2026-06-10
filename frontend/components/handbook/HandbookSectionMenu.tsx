"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { HANDBOOK_SECTIONS, sectionPath } from "@/lib/handbook-sections";

// The narrow-screen counterpart to the desktop section tabs: a single button
// naming the current part, opening a short list of the five. It switches between
// Get Started / Vision / Bots / Index / Developers - the axis the desktop tab
// row carries up top. Hidden on desktop (CSS); the tabs take over there.
export function HandbookSectionMenu() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const active =
    HANDBOOK_SECTIONS.find(
      (s) => pathname === sectionPath(s.slug) || pathname.startsWith(`${sectionPath(s.slug)}/`),
    ) ?? HANDBOOK_SECTIONS[0];

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="docs-section-menu" ref={ref}>
      <button
        type="button"
        className="docs-section-trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        <span>{active.title}</span>
        <ChevronDown className="docs-section-chevron" aria-hidden="true" />
      </button>
      {open && (
        <div className="docs-section-panel" role="menu">
          {HANDBOOK_SECTIONS.map((s) => (
            <Link
              key={s.slug}
              href={sectionPath(s.slug)}
              role="menuitem"
              data-active={s.slug === active.slug}
            >
              {s.title}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
