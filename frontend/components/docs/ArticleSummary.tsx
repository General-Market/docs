import { type ReactElement } from "react";
import { slugify } from "@/lib/docslib-pure";

/*
  A micro sum-up that opens a longer article — the same numbered stepper Twenty
  uses on its quickstart. Each line is one section of the page, written as

    ```gmsummary
    What is Vision? :: A sealed parimutuel prediction market on an L3 chain.
    How do I win? :: Better predictors win the stakes of worse predictors.
    ```

  The part before `::` is the section heading (it links down to that ## via
  slugify(), which mirrors rehype-slug, so the anchor resolves to the real id).
  The part after `::` is the one-line sum-up of what that section says. A line
  with no `::` is title-only.

  This is both wayfinding and a TL;DR: read the five lines, know the whole page,
  and jump straight to the part you need. docs.css strips the <pre> chrome via
  pre:has(.docs-summary).
*/

interface SummaryItem {
  title: string;
  desc: string;
}

export function ArticleSummary({ spec }: { spec: string }): ReactElement | null {
  const items: SummaryItem[] = spec
    .split("\n")
    .map((line) => line.replace(/^[-*]\s+/, "").trim())
    .filter(Boolean)
    .map((line) => {
      const i = line.indexOf("::");
      return i === -1
        ? { title: line.trim(), desc: "" }
        : { title: line.slice(0, i).trim(), desc: line.slice(i + 2).trim() };
    });
  if (items.length === 0) return null;
  return (
    <nav className="docs-summary" aria-label="In this article">
      <ol className="docs-summary-list">
        {items.map((it, i) => (
          <li key={i} className="docs-summary-item">
            <span className="docs-summary-num">{i + 1}</span>
            <span className="docs-summary-body">
              <a className="docs-summary-title" href={`#${slugify(it.title)}`}>
                {it.title}
              </a>
              {it.desc ? <span className="docs-summary-desc">{it.desc}</span> : null}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
