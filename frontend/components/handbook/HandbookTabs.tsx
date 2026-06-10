"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HANDBOOK_SECTIONS, sectionPath } from "@/lib/handbook-sections";

// The five main parts, as a sticky tab row under the topbar — the way Morpho's
// docs switch between sections. The active tab is the one the current path sits
// under, marked with the accent underline.
export function HandbookTabs() {
  const pathname = usePathname();
  const active = HANDBOOK_SECTIONS.find(
    (s) => pathname === sectionPath(s.slug) || pathname.startsWith(`${sectionPath(s.slug)}/`),
  )?.slug;

  return (
    <nav className="handbook-tabs" aria-label="Handbook sections">
      <div className="handbook-tabs-inner">
        {HANDBOOK_SECTIONS.map((s) => (
          <Link
            key={s.slug}
            href={sectionPath(s.slug)}
            className="handbook-tab"
            data-active={s.slug === active}
            aria-current={s.slug === active ? "page" : undefined}
          >
            {s.title}
          </Link>
        ))}
      </div>
    </nav>
  );
}
