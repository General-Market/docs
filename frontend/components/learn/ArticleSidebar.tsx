"use client";

import { useEffect, useState, useCallback } from "react";
import type { ArticleHeading } from "@/lib/learn/articles";

const CATEGORY_COLORS: Record<string, string> = {
  "AI Trading": "bg-color-info",
  Tutorial: "bg-brand",
  Comparison: "bg-color-warning",
  Education: "bg-color-up",
  Technical: "bg-black",
};

const CATEGORY_BAR_COLORS: Record<string, string> = {
  "AI Trading": "#2563eb",
  Tutorial: "#16a34a",
  Comparison: "#ea580c",
  Education: "#16a34a",
  Technical: "#000000",
};

interface ArticleSidebarProps {
  headings: ArticleHeading[];
  category: string;
}

export function ArticleSidebar({ headings, category }: ArticleSidebarProps) {
  const [activeId, setActiveId] = useState<string>("");
  const [scrollProgress, setScrollProgress] = useState(0);

  const dotColor = CATEGORY_COLORS[category] || "bg-black";
  const barColor = CATEGORY_BAR_COLORS[category] || "#000000";

  useEffect(() => {
    const ids = headings.map((h) => h.id);
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter(Boolean) as HTMLElement[];

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [headings]);

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
  };

  return (
    <nav className="hidden lg:block sticky top-24 w-56 shrink-0 self-start">
      <div className="relative pl-5">
        {/* Vertical progress track */}
        <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-border-light">
          <div
            className="w-full transition-all duration-150"
            style={{
              height: `${scrollProgress * 100}%`,
              backgroundColor: barColor,
            }}
          />
        </div>

        {/* Heading links */}
        <ul className="space-y-1">
          {headings.map((h) => {
            const isActive = activeId === h.id;
            return (
              <li key={h.id}>
                <button
                  onClick={() => handleClick(h.id)}
                  className={`flex items-center gap-2.5 w-full text-left text-[12px] leading-snug px-2.5 py-1.5 rounded transition-colors ${
                    isActive
                      ? "bg-surface font-semibold text-black"
                      : "text-text-muted hover:text-text-secondary"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      isActive ? dotColor : "bg-border-light"
                    }`}
                  />
                  <span className="line-clamp-2">{h.text}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
