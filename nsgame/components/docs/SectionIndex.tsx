import { Link } from '@/i18n/routing'
import type { LoadedDoc, DocSection } from '@/lib/content/loadDoc'

interface SectionGroup {
  heading?: string
  slugs: string[]
}

interface SectionIndexProps {
  section: DocSection
  title: string
  description: string
  docs: LoadedDoc[]
  /** Optional grouping. Slugs not listed in any group fall into "Other". */
  groups?: SectionGroup[]
}

function docsBySlug(docs: LoadedDoc[]): Map<string, LoadedDoc> {
  const m = new Map<string, LoadedDoc>()
  for (const d of docs) m.set(d.frontmatter.slug, d)
  return m
}

export function SectionIndex({
  section,
  title,
  description,
  docs,
  groups,
}: SectionIndexProps) {
  const bySlug = docsBySlug(docs)
  const groupedSlugs = new Set<string>(
    (groups ?? []).flatMap(g => g.slugs),
  )
  const ungrouped = docs
    .filter(d => !groupedSlugs.has(d.frontmatter.slug))
    .map(d => d.frontmatter.slug)

  const renderCard = (slug: string) => {
    const d = bySlug.get(slug)
    if (!d) return null
    return (
      <Link
        key={slug}
        href={`/${section}/${slug}`}
        className="group block border border-zinc-800 hover:border-zinc-600 transition-colors p-5 rounded-sm bg-zinc-900/30 hover:bg-zinc-900/60"
      >
        <h3 className="text-[16px] font-semibold text-zinc-100 group-hover:text-white tracking-tight mb-1.5 leading-snug">
          {d.frontmatter.title}
        </h3>
        <p className="text-[13px] text-zinc-400 leading-relaxed line-clamp-3">
          {d.frontmatter.description}
        </p>
      </Link>
    )
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 pb-24">
      <div className="mx-auto max-w-5xl px-6 sm:px-8 pt-12 sm:pt-16">
        <header className="mb-12 pb-10 border-b border-zinc-800">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500 mb-3">
            {section}
          </p>
          <h1 className="text-[34px] sm:text-[44px] font-black tracking-tight text-zinc-50 leading-[1.05] mb-4">
            {title}
          </h1>
          <p className="text-[16px] text-zinc-400 leading-relaxed max-w-2xl">
            {description}
          </p>
        </header>

        {groups && groups.length > 0 ? (
          <div className="space-y-12">
            {groups.map(group => (
              <section key={group.heading ?? 'unnamed'}>
                {group.heading ? (
                  <h2 className="text-[12px] font-mono uppercase tracking-[0.14em] text-zinc-500 mb-4">
                    {group.heading}
                  </h2>
                ) : null}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {group.slugs.map(renderCard)}
                </div>
              </section>
            ))}

            {ungrouped.length > 0 ? (
              <section>
                <h2 className="text-[12px] font-mono uppercase tracking-[0.14em] text-zinc-500 mb-4">
                  Other
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {ungrouped.map(renderCard)}
                </div>
              </section>
            ) : null}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {docs.map(d => renderCard(d.frontmatter.slug))}
          </div>
        )}
      </div>
    </main>
  )
}
