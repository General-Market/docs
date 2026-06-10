"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import type { SearchDoc } from "@/lib/docslib";

interface ResultItem {
  kind: "page" | "heading";
  label: string;
  context?: string;
  href: string;
}

function build(index: SearchDoc[], query: string, basePath: string): ResultItem[] {
  const q = query.trim().toLowerCase();
  const out: ResultItem[] = [];
  for (const doc of index) {
    const base = `${basePath}/${doc.slug}`;
    const titleHit = !q || doc.title.toLowerCase().includes(q);
    const descHit = !q || (doc.description?.toLowerCase().includes(q) ?? false);
    if (titleHit || descHit) {
      out.push({ kind: "page", label: doc.title, context: doc.description, href: base });
    }
    for (const h of doc.headings) {
      if (q && !h.text.toLowerCase().includes(q)) continue;
      if (!q) continue; // headings only surface once the user types
      out.push({ kind: "heading", label: h.text, context: doc.title, href: `${base}#${h.id}` });
    }
  }
  return out.slice(0, 12);
}

export function DocsSearch({ index, basePath = "/docs" }: { index: SearchDoc[]; basePath?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => build(index, query, basePath), [index, query, basePath]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActive(0);
  }, []);

  const go = useCallback(
    (item: ResultItem) => {
      router.push(item.href);
      close();
    },
    [router, close],
  );

  // ⌘K / Ctrl+K opens, Esc closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape" && open) {
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && results[active]) {
      e.preventDefault();
      go(results[active]);
    }
  };

  return (
    <>
      <button
        type="button"
        className="docs-search-trigger"
        aria-label="Search documentation"
        onClick={() => setOpen(true)}
      >
        <Search className="docs-search-icon" aria-hidden="true" />
        <span className="docs-search-label">Search</span>
        <kbd>⌘K</kbd>
      </button>

      {open ? (
        <div className="docs-search-overlay" role="dialog" aria-modal="true" aria-label="Search" onMouseDown={close}>
          <div className="docs-search-panel" onMouseDown={(e) => e.stopPropagation()}>
            <input
              ref={inputRef}
              className="docs-search-input"
              placeholder="Search the docs"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onListKey}
            />
            <ul className="docs-search-results">
              {results.length === 0 ? (
                <li className="docs-search-empty">No matches.</li>
              ) : (
                results.map((item, i) => (
                  <li key={`${item.href}-${i}`}>
                    <button
                      type="button"
                      className="docs-search-result"
                      data-active={i === active}
                      data-kind={item.kind}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => go(item)}
                    >
                      <span className="docs-search-result-label">{item.label}</span>
                      {item.context ? (
                        <span className="docs-search-result-context">{item.context}</span>
                      ) : null}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  );
}
