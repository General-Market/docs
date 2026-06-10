import { type ReactElement } from "react";
import { ArrowRight } from "lucide-react";

/*
  Full-row "read it in depth" link, authored in markdown via a ```gmseealso
  fenced block whose body is the JSON spec below. It replaces a block of deep
  detail a page was repeating: instead of re-deriving the mechanics, the page
  points back to the one section that owns them. Pure CSS, server component.
  docs.css strips the <pre> chrome via pre:has(.docs-seealso).

  Spec is one object, or an array of them:
    { "href": "/docs/vision/payouts",
      "label": "How do I win?",
      "sub": "Parimutuel scoring, the zero-sum invariant, and the fee on profit",
      "time": "~8 min" }
*/

interface LinkSpec {
  href: string;
  label: string;
  sub?: string;
  time?: string;
}

function Row({ spec }: { spec: LinkSpec }): ReactElement {
  const external = /^https?:\/\//.test(spec.href);
  return (
    <a
      className="docs-seealso"
      href={spec.href}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
    >
      <span className="docs-seealso-text">
        <span className="docs-seealso-label">
          {spec.label}
          {spec.time ? <span className="docs-seealso-time"> · {spec.time}</span> : null}
        </span>
        {spec.sub ? <span className="docs-seealso-sub">{spec.sub}</span> : null}
      </span>
      <ArrowRight className="docs-seealso-arrow" size={18} strokeWidth={2} aria-hidden="true" />
    </a>
  );
}

export function SeeAlso({ spec }: { spec: string }): ReactElement {
  let data: LinkSpec | LinkSpec[];
  try {
    data = JSON.parse(spec);
  } catch {
    return <pre className="gm-cards-error">see-also spec is not valid JSON</pre>;
  }
  const rows = Array.isArray(data) ? data : [data];
  return (
    <span className="docs-seealso-group">
      {rows.map((r, i) => (
        <Row key={i} spec={r} />
      ))}
    </span>
  );
}
