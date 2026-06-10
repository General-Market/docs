"use client";

import { useState } from "react";

/** Display names for the languages authored across the handbook. Anything not
 *  listed falls back to the raw fence token, upper-cased. */
const LANG_LABEL: Record<string, string> = {
  solidity: "Solidity",
  js: "JavaScript",
  javascript: "JavaScript",
  ts: "TypeScript",
  typescript: "TypeScript",
  bash: "Shell",
  sh: "Shell",
  shell: "Shell",
  json: "JSON",
  graphql: "GraphQL",
  text: "Text",
};

function labelFor(lang: string | null): string {
  if (!lang) return "Code";
  return LANG_LABEL[lang] ?? lang.toUpperCase();
}

/** A fenced code block with Morpho-style chrome: a header strip carrying the
 *  language label and a copy button, over the highlighted source. The highlight
 *  spans are produced upstream by rehype-highlight and passed in as children. */
export function CodeBlock({
  language,
  raw,
  children,
}: {
  language: string | null;
  raw: string;
  children: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(raw);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard blocked (insecure context / permissions) — leave the button idle.
    }
  }

  return (
    <div className="docs-code">
      <div className="docs-code-head">
        <span className="docs-code-lang">{labelFor(language)}</span>
        <button
          type="button"
          className="docs-code-copy"
          data-copied={copied ? "" : undefined}
          onClick={copy}
          aria-label={copied ? "Copied" : "Copy code"}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="docs-code-pre">{children}</pre>
    </div>
  );
}
