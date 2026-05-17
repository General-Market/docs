"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from 'next-intl';
import type { ArticleHeading } from "@/lib/learn/articles";

interface MobileArticleNavProps {
  headings: ArticleHeading[];
}

export function MobileArticleNav({ headings }: MobileArticleNavProps) {
  const t = useTranslations('pages');
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
      <div className="h-[2px] bg-zinc-100">
        <div
          className="h-full bg-black origin-left will-change-transform"
          style={{
            width: '100%',
            transform: `scaleX(${scrollProgress.toFixed(4)})`,
            transition: 'transform 150ms cubic-bezier(0.25, 0.1, 0.3, 1)',
          }}
        />
      </div>

      {/* TOC toggle */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-100">
        <span className="text-[11px] font-semibold tracking-[0.1em] uppercase text-zinc-400">
          {t('learn.mobile_nav.contents')}
        </span>
        <button
          onClick={() => setOpen(!open)}
          className="text-[12px] font-semibold text-black"
        >
          {open ? t('learn.mobile_nav.close') : t('learn.mobile_nav.menu')}
        </button>
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 right-0 bg-white border-b border-zinc-200 shadow-sm px-4 py-3 space-y-0.5 max-h-[60vh] overflow-y-auto">
          {headings.map((h, i) => (
            <button
              key={h.id}
              onClick={() => handleClick(h.id)}
              className="flex items-start gap-3 w-full text-left text-[13px] text-zinc-500 hover:text-black py-2 px-3 rounded-xl hover:bg-zinc-50 transition-colors"
            >
              <span className="font-mono text-zinc-400 shrink-0">{i + 1}.</span>
              <span>{h.text}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
