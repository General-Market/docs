"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

interface TocItem {
  id: string;
  text: string;
  level: 2 | 3;
}

export function TocRail() {
  const pathname = usePathname();
  const [items, setItems] = useState<TocItem[]>([]);
  const [active, setActive] = useState("");

  useEffect(() => {
    let cleanup = () => {};
    // Wait one frame so the freshly-navigated page has painted its headings.
    const raf = requestAnimationFrame(() => {
      const nodes = Array.from(
        document.querySelectorAll<HTMLElement>(".docs-prose h2[id], .docs-prose h3[id]"),
      );
      setItems(
        nodes.map((n) => ({
          id: n.id,
          text: n.textContent ?? "",
          level: n.tagName === "H3" ? 3 : 2,
        })),
      );

      if (!nodes.length) return;
      const observer = new IntersectionObserver(
        (entries) => {
          const visible = entries
            .filter((e) => e.isIntersecting)
            .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
          if (visible[0]) setActive((visible[0].target as HTMLElement).id);
        },
        { rootMargin: "-84px 0px -68% 0px", threshold: 0 },
      );
      nodes.forEach((n) => observer.observe(n));
      cleanup = () => observer.disconnect();
    });

    return () => {
      cancelAnimationFrame(raf);
      cleanup();
    };
  }, [pathname]);

  if (items.length < 2) return null;

  return (
    <nav className="docs-toc-nav" aria-label="On this page">
      <div className="docs-toc-title">
        <svg
          className="docs-toc-title-icon"
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <path d="M6 4h7M6 8h7M6 12h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="2.6" cy="4" r="1" fill="currentColor" />
          <circle cx="2.6" cy="8" r="1" fill="currentColor" />
          <circle cx="2.6" cy="12" r="1" fill="currentColor" />
        </svg>
        On this page
      </div>
      <ul>
        {items.map((it) => (
          <li key={it.id} className={`docs-toc-item lvl-${it.level}`}>
            <a href={`#${it.id}`} data-active={active === it.id}>
              {it.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
