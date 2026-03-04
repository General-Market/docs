"use client";

import { useEffect, useState, useCallback } from "react";
import type { ArticleHeading } from "@/lib/learn/articles";

interface MobileArticleNavProps {
  headings: ArticleHeading[];
}

export function MobileArticleNav({ headings }: MobileArticleNavProps) {
  const [open, setOpen] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  const handleScroll = useCallback(() => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    setScrollProgress(docHeight > 0 ? scrollTop / docHeight : 0);
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  const handleClick = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
    setOpen(false);
  };

  return (
    <div className="lg:hidden sticky top-0 z-30 bg-white">
      {/* Horizontal progress bar */}
      <div className="h-[2px] bg-border-light">
        <div
          className="h-full bg-black transition-all duration-150"
          style={{ width: `${scrollProgress * 100}%` }}
        />
      </div>

      {/* TOC toggle */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-light">
        <span className="text-[11px] font-semibold tracking-[0.1em] uppercase text-text-muted">
          Contents
        </span>
        <button
          onClick={() => setOpen(!open)}
          className="text-[12px] font-semibold text-black"
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 right-0 bg-white border-b border-border-light shadow-sm px-4 py-3 space-y-1 max-h-[60vh] overflow-y-auto">
          {headings.map((h) => (
            <button
              key={h.id}
              onClick={() => handleClick(h.id)}
              className="block w-full text-left text-[13px] text-text-secondary hover:text-black py-1.5 px-2 rounded hover:bg-surface transition-colors"
            >
              {h.text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
