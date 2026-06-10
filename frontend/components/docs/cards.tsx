import { Fragment, type ReactElement } from "react";
import {
  Eye,
  Bot,
  Blocks,
  Code2,
  BookOpen,
  BookMarked,
  Rocket,
  CandlestickChart,
  Lock,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";

/*
  Morpho-style card grid for the docs landing pages. Authored in markdown via a
  ```gmcards fenced block whose body is the JSON spec below. The route maps the
  fence to this component; docs.css strips the <pre> chrome via pre:has(.gm-cards).
  Cards are pure CSS-hover, so this stays a server component.
*/

const ICONS: Record<string, LucideIcon> = {
  vision: Eye,
  bots: Bot,
  index: Blocks,
  developers: Code2,
  "get-started": Rocket,
  concepts: BookOpen,
  glossary: BookMarked,
  trading: CandlestickChart,
  sealed: Lock,
};

interface CardSpec {
  icon?: string;
  title: string;
  desc: string;
  href: string;
  tag?: string;
  bullets?: string[];
  cta?: string;
  featured?: boolean;
}

interface Spec {
  cols?: 2 | 3;
  /** Let the grid bleed a little past the prose column, for wider, calmer cards. */
  wide?: boolean;
  cards: CardSpec[];
}

export function GmCards({ spec }: { spec: string }): ReactElement {
  // The spec is either a bare array of cards, or { cols?, wide?, cards: [...] }.
  let parsed: Spec | CardSpec[];
  try {
    parsed = JSON.parse(spec);
  } catch {
    return <pre className="gm-cards-error">card spec is not valid JSON</pre>;
  }
  const data: Spec = Array.isArray(parsed) ? { cards: parsed } : parsed;
  if (!Array.isArray(data.cards)) {
    return <pre className="gm-cards-error">card spec has no cards array</pre>;
  }
  const cols = data.cols ?? 3;
  return (
    <div className="gm-cards" data-cols={cols} data-wide={data.wide ? "true" : undefined}>
      {data.cards.map((c, i) => {
        const Icon = (c.icon ? ICONS[c.icon] : undefined) ?? BookOpen;
        const external = /^https?:\/\//.test(c.href);
        return (
          <a
            key={i}
            className="gm-card"
            data-featured={c.featured ? "true" : undefined}
            href={c.href}
            {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
          >
            <span className="gm-card-head">
              <span className="gm-card-icon">
                <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
              </span>
              {c.tag && <span className="gm-card-tag">{c.tag}</span>}
            </span>
            <span className="gm-card-title">
              {c.title.split("\n").map((line, k, arr) => (
                <Fragment key={k}>
                  {line}
                  {k < arr.length - 1 && <br />}
                </Fragment>
              ))}
            </span>
            <span className="gm-card-desc">{c.desc}</span>
            <ul className="gm-card-bullets" data-empty={c.bullets && c.bullets.length > 0 ? undefined : "true"}>
              {(c.bullets ?? []).map((b, j) => (
                <li key={j}>{b}</li>
              ))}
            </ul>
            <span className="gm-card-cta">
              {c.cta ?? "Open"}
              <ArrowRight size={15} strokeWidth={2} aria-hidden="true" />
            </span>
          </a>
        );
      })}
    </div>
  );
}
