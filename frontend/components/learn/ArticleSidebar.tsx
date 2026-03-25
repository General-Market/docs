"use client";

import { useEffect, useState, useCallback } from "react";
import { Link } from "@/i18n/routing";
import type { ArticleHeading } from "@/lib/learn/articles";

interface ArticleSidebarProps {
  headings: ArticleHeading[];
  category: string;
}

export function ArticleSidebar({ headings, category }: ArticleSidebarProps) {
  const [activeId, setActiveId] = useState<string>("");
  const [showCta, setShowCta] = useState(false);

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

  // Show CTA after scrolling past 30% of the page
  useEffect(() => {
    const onScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      setShowCta(docHeight > 0 && scrollTop / docHeight > 0.15);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleClick = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <aside className="hidden lg:flex flex-col gap-6 w-[280px] shrink-0 self-start sticky top-24">
      {/* TOC Card */}
      <div className="border border-zinc-200 rounded-2xl p-6 bg-white shadow-[inset_0_-3px_3px_rgba(0,0,0,0.04),0_2px_12px_rgba(0,0,0,0.03)]">
        <h3 className="text-[15px] font-semibold text-black mb-4">
          Table of contents
        </h3>
        <nav className="space-y-0.5">
          {headings.map((h, i) => {
            const isActive = activeId === h.id;
            return (
              <button
                key={h.id}
                onClick={() => handleClick(h.id)}
                className={`flex items-start gap-3 w-full text-left px-3 py-2.5 rounded-xl transition-all duration-200 ${
                  isActive
                    ? "bg-zinc-100 text-black font-medium"
                    : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700"
                }`}
              >
                <span className={`text-[13px] font-mono tabular-nums shrink-0 mt-px ${
                  isActive ? "text-black font-semibold" : "text-zinc-400"
                }`}>
                  {i + 1}.
                </span>
                <span className="text-[13px] leading-snug line-clamp-2">
                  {h.text}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* CTA Card — slides in after scroll */}
      <div
        className={`transition-all duration-500 ${
          showCta
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-4 pointer-events-none"
        }`}
      >
        <div className="rounded-2xl bg-zinc-900 p-6 shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
          <h4 className="text-[18px] font-bold text-white leading-tight mb-2">
            Trade what you know
          </h4>
          <p className="text-[13px] text-zinc-400 leading-relaxed mb-5">
            Prediction markets on real-world events. No KYC. Sealed bets. BLS-verified outcomes.
          </p>
          <Link
            href="/"
            className="block w-full text-center bg-white text-black text-[13px] font-semibold py-2.5 px-4 rounded-xl hover:bg-zinc-100 transition-colors"
          >
            Start Trading
          </Link>
          <p className="text-[11px] text-zinc-500 text-center mt-3">
            30,000+ markets across 85 sources
          </p>
        </div>
      </div>
    </aside>
  );
}
