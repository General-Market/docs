"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ArrowUpRight } from "lucide-react";
import { nestPages, type DocGroup, type DocNode } from "@/lib/docslib-pure";

// Every section opens on arrival, so the reader sees the whole map at once -
// a collapsed group reads as a missing one. The reader collapses the lanes
// they don't need; that choice is theirs to keep.
const DEFAULT_COLLAPSED: string[] = [];

/** A bottom-of-sidebar link. External links carry an up-right arrow and open
 *  in a new tab; internal links resolve against the app root. */
interface FooterLink {
  label: string;
  href: string;
  external?: boolean;
}

// External surfaces only. The page tree above already carries the docs map;
// the footer points outward, to the live app and the reference code.
const FOOTER_LINKS: FooterLink[] = [
  { label: "App", href: "/", external: false },
  { label: "Bot examples", href: "https://github.com/General-Market/vision-bot-examples", external: true },
];

const SOCIAL = {
  x: "https://x.com/otc_max",
  github: "https://github.com/General-Market",
};

/** X (formerly Twitter) glyph. lucide ships no brand mark in this build. */
function XGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
    </svg>
  );
}

/** GitHub octocat glyph. */
function GithubGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.37.5 0 5.78 0 12.29c0 5.2 3.44 9.6 8.21 11.16.6.11.82-.25.82-.56 0-.28-.01-1.02-.02-2-3.34.71-4.04-1.58-4.04-1.58-.55-1.36-1.34-1.73-1.34-1.73-1.09-.73.08-.72.08-.72 1.2.08 1.84 1.21 1.84 1.21 1.07 1.8 2.81 1.28 3.5.98.11-.76.42-1.28.76-1.58-2.67-.3-5.47-1.31-5.47-5.84 0-1.29.47-2.34 1.24-3.17-.13-.3-.54-1.52.11-3.17 0 0 1.01-.32 3.3 1.21a11.6 11.6 0 0 1 3-.4c1.02 0 2.05.13 3 .4 2.29-1.53 3.3-1.21 3.3-1.21.65 1.65.24 2.87.12 3.17.77.83 1.23 1.88 1.23 3.17 0 4.54-2.81 5.53-5.49 5.83.43.36.81 1.08.81 2.18 0 1.58-.01 2.85-.01 3.24 0 .31.21.68.83.56A12.02 12.02 0 0 0 24 12.29C24 5.78 18.63.5 12 .5Z" />
    </svg>
  );
}

export function DocsSidebar({ groups, basePath = "/docs" }: { groups: DocGroup[]; basePath?: string }) {
  const pathname = usePathname();

  // Every group opens on arrival, so the reader sees the whole map laid out
  // and can collapse the lanes they don't need. Toggling after that is theirs
  // to keep.
  const activeGroup = groups.find((g) =>
    g.pages.some((d) => `${basePath}/${d.slug}` === pathname),
  )?.title;

  // Default-collapsed groups still open if the reader landed inside one.
  const [collapsed, setCollapsed] = useState<Set<string>>(
    () => new Set(DEFAULT_COLLAPSED.filter((title) => title !== activeGroup)),
  );

  function toggle(title: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  }

  return (
    <nav className="docs-sidebar-nav" aria-label="Documentation">
      <Link
        href={basePath}
        className="docs-sidebar-home"
        data-active={pathname === basePath}
      >
        General Market
      </Link>
      {groups.map((group) => {
        const isOpen = !collapsed.has(group.title);
        const hasActive = group.title === activeGroup;
        const tree = nestPages(group.pages);
        return (
          <div className="docs-group" key={group.title} data-open={isOpen}>
            <button
              type="button"
              className="docs-group-title"
              aria-expanded={isOpen}
              onClick={() => toggle(group.title)}
            >
              <span>{group.title}</span>
              <ChevronDown className="docs-group-chevron" aria-hidden="true" />
            </button>
            {isOpen && (
              <ul className="docs-group-links">
                {tree.map((node) => (
                  <NavNode key={node.doc.slug} node={node} basePath={basePath} pathname={pathname} />
                ))}
              </ul>
            )}
            {!isOpen && hasActive && <span className="sr-only">current section collapsed</span>}
          </div>
        );
      })}

      <DocsSidebarFooter />
    </nav>
  );
}

/** One sidebar entry. A leaf is a plain link. A branch is a clickable heading
 *  link plus a collapsible, indented sub-list of its children. */
function NavNode({ node, basePath, pathname }: { node: DocNode; basePath: string; pathname: string }) {
  const href = `${basePath}/${node.doc.slug}`;
  const active = pathname === href;
  const label = node.doc.navTitle ?? node.doc.title;
  // API-reference pages carry an HTTP method — render it as a coloured pill, the
  // way BitGo tags each endpoint in its nav.
  const method = node.doc.method;
  const methodPill = method ? (
    <span className={`docs-nav-method m-${method.toLowerCase()}`}>{method}</span>
  ) : null;

  // A linkTo page is a pointer into another section: navigate there, not to a
  // page under this base path, and flag the jump with an up-right arrow.
  if (node.doc.linkTo) {
    return (
      <li>
        <Link href={node.doc.linkTo} data-extlink="true">
          <span>{label}</span>
          <ArrowUpRight className="docs-nav-extlink-arrow" aria-hidden="true" />
        </Link>
      </li>
    );
  }

  if (node.children.length === 0) {
    return (
      <li>
        <Link href={href} data-active={active} data-method={method ? "" : undefined}>
          {methodPill}
          <span>{label}</span>
        </Link>
      </li>
    );
  }

  // The branch opens by default and stays open while the reader is anywhere
  // inside it - the parent page or any child.
  const childActive = node.children.some((c) => pathname === `${basePath}/${c.doc.slug}`);
  return (
    <SubGroup
      href={href}
      label={label}
      active={active}
      basePath={basePath}
      pathname={pathname}
      nodes={node.children}
      startOpen={active || childActive}
    />
  );
}

function SubGroup({
  href,
  label,
  active,
  basePath,
  pathname,
  nodes,
  startOpen,
}: {
  href: string;
  label: string;
  active: boolean;
  basePath: string;
  pathname: string;
  nodes: DocNode[];
  startOpen: boolean;
}) {
  const [open, setOpen] = useState(startOpen);
  // Navigating into the branch - clicking its heading or any child - opens the
  // whole child list. The reader can still collapse it by hand afterwards.
  useEffect(() => {
    if (startOpen) setOpen(true);
  }, [startOpen]);
  return (
    <li className="docs-subgroup" data-open={open}>
      <div className="docs-subgroup-head">
        <Link href={href} data-active={active} className="docs-subgroup-link">
          {label}
        </Link>
        <button
          type="button"
          className="docs-subgroup-toggle"
          aria-expanded={open}
          aria-label={open ? `Collapse ${label}` : `Expand ${label}`}
          onClick={() => setOpen((v) => !v)}
        >
          <ChevronDown className="docs-subgroup-chevron" aria-hidden="true" />
        </button>
      </div>
      {open && (
        <ul className="docs-subgroup-links">
          {nodes.map((child) => (
            <NavNode key={child.doc.slug} node={child} basePath={basePath} pathname={pathname} />
          ))}
        </ul>
      )}
    </li>
  );
}

/** External-links list plus social row, pinned to the foot of the sidebar -
 *  the calm tail Morpho's docs carry under their page tree. */
function DocsSidebarFooter() {
  return (
    <div className="docs-sidebar-footer">
      <ul className="docs-sidebar-links">
        {FOOTER_LINKS.map((link) =>
          link.external ? (
            <li key={link.href}>
              <a href={link.href} target="_blank" rel="noreferrer">
                <span>{link.label}</span>
                <ArrowUpRight className="docs-sidebar-link-arrow" aria-hidden="true" />
              </a>
            </li>
          ) : (
            <li key={link.href}>
              <Link href={link.href}>
                <span>{link.label}</span>
              </Link>
            </li>
          ),
        )}
      </ul>
      <div className="docs-sidebar-social">
        <a href={SOCIAL.x} target="_blank" rel="noreferrer" aria-label="General Market on X">
          <XGlyph />
        </a>
        <a href={SOCIAL.github} target="_blank" rel="noreferrer" aria-label="General Market on GitHub">
          <GithubGlyph />
        </a>
      </div>
    </div>
  );
}
