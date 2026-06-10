import { type ReactElement } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

/*
  Inline callout for the docs — note / tip / warning / plain. Authored in markdown
  via a ```gmnote / ```gmtip / ```gmwarning / ```gmplain fenced block whose body
  is the message text (plain markdown: bold, inline code, links all work). The route
  maps each fence to this component; docs.css strips the <pre> chrome via
  pre:has(.docs-callout). One colour, one meaning, drawn from the apex palette:
    note    → indigo  (neutral aside)
    tip     → green   (a better way to do it)
    warning → amber   (a limitation or a thing that bites)
    plain   → violet  (the plain-English layer — read this first)

  Cross-links inside docs are absolute (/docs/...), so no basePath resolution is
  needed here; only http(s) links open in a new tab.
*/

type Kind = "note" | "tip" | "warning" | "plain";

/*
  Bespoke solid glyphs — one path each, currentColor fill. note/warning use
  fill-rule evenodd so the inner mark is a true cutout: the chip tint shows
  through it, a crisp two-tone that reads sharper at 17px than any thin outline.
*/
const GLYPH: Record<Kind, ReactElement> = {
  note: (
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2Zm0 4.2a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6Zm0 4a1.15 1.15 0 0 1 1.15 1.15v4.6a1.15 1.15 0 0 1-2.3 0v-4.6A1.15 1.15 0 0 1 12 10.2Z"
    />
  ),
  warning: (
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M13.74 4.99 21.73 19a2 2 0 0 1-1.74 3H4.01a2 2 0 0 1-1.74-3l7.99-14.01a2 2 0 0 1 3.48 0ZM12 8.4a1.05 1.05 0 0 1 1.05 1.05v3.4a1.05 1.05 0 0 1-2.1 0v-3.4A1.05 1.05 0 0 1 12 8.4Zm0 7.1a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2Z"
    />
  ),
  tip: (
    <path d="M12 2a7 7 0 0 0-4.2 12.6c.7.53 1.2 1.3 1.2 2.18V17h6v-.22c0-.88.5-1.65 1.2-2.18A7 7 0 0 0 12 2Zm-2.5 16.3a.9.9 0 0 0 0 1.8h5a.9.9 0 0 0 0-1.8Zm1.2 2.9a.9.9 0 0 0 0 1.8h2.6a.9.9 0 0 0 0-1.8Z" />
  ),
  // A speech bubble — the page, said plainly to you.
  plain: (
    <path d="M4 3h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H10l-5 4v-4H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
  ),
};

const LABEL: Record<Kind, string> = {
  note: "Note",
  tip: "Tip",
  warning: "Warning",
  plain: "In plain words",
};

export function Callout({ kind, body }: { kind: Kind; body: string }): ReactElement {
  const k: Kind = kind in LABEL ? kind : "note";
  return (
    <div className="docs-callout" data-kind={k}>
      <span className="docs-callout-icon" aria-hidden="true">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
          {GLYPH[k]}
        </svg>
      </span>
      <div className="docs-callout-body">
        <span className="docs-callout-label">{LABEL[k]}</span>
        <Markdown
          remarkPlugins={[remarkGfm]}
          components={{
            // Render the message inline — no <p> wrapper inside the callout body.
            p: ({ children }) => <span className="docs-callout-text">{children}</span>,
            a: ({ href, children }) => {
              const external = typeof href === "string" && /^https?:\/\//.test(href);
              return external ? (
                <a href={href} target="_blank" rel="noreferrer">{children}</a>
              ) : (
                <a href={href}>{children}</a>
              );
            },
          }}
        >
          {body}
        </Markdown>
      </div>
    </div>
  );
}
