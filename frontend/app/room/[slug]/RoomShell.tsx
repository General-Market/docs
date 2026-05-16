import Link from 'next/link'
import type { ReactNode } from 'react'
import type { RoomPage } from '@/lib/dataroom/content'

interface RoomShellProps {
  slug: string
  title: string
  pages: RoomPage[]
  currentPageSlug: string | null
  children: ReactNode
}

export function RoomShell({ slug, title, pages, currentPageSlug, children }: RoomShellProps) {
  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <aside className="md:w-72 md:min-h-screen md:border-r border-neutral-200 bg-neutral-50/60 backdrop-blur-sm">
        <div className="p-6 md:p-8 md:sticky md:top-0">
          <p className="text-[12px] uppercase tracking-[0.14em] text-neutral-500 mb-1">
            General Market
          </p>
          <h2 className="text-[17px] font-semibold leading-snug mb-6">{title}</h2>

          <nav className="space-y-1">
            {pages.map((p) => {
              const isCurrent =
                (p.pageSlug === 'index' && currentPageSlug === null) ||
                p.pageSlug === currentPageSlug
              const href =
                p.pageSlug === 'index'
                  ? `/room/${slug}`
                  : `/room/${slug}/${p.pageSlug}`
              return (
                <Link
                  key={p.pageSlug}
                  href={href}
                  className={
                    isCurrent
                      ? 'block px-3 py-2 rounded-lg bg-black text-white text-[14px] font-medium'
                      : 'block px-3 py-2 rounded-lg text-neutral-700 hover:bg-neutral-100 text-[14px]'
                  }
                >
                  {p.frontmatter.title || p.pageSlug}
                </Link>
              )
            })}
          </nav>

          <form action={`/room/${slug}/logout`} method="post" className="mt-10">
            <button
              type="submit"
              className="text-[12px] text-neutral-500 hover:text-neutral-900 underline-offset-4 hover:underline"
            >
              Lock the room
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <article className="max-w-[760px] mx-auto px-6 md:px-12 py-10 md:py-16">
          {children}
        </article>
      </main>
    </div>
  )
}
