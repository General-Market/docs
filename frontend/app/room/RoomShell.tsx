import Link from 'next/link'
import type { ReactNode } from 'react'
import type { RoomPage } from '@/lib/dataroom/content'

interface RoomShellProps {
  title: string
  pages: RoomPage[]
  currentPageSlug: string | null
  children: ReactNode
}

export function RoomShell({ title, pages, currentPageSlug, children }: RoomShellProps) {
  return (
    <div className="min-h-screen bg-[#FBFBFD] text-[#1D1D1F]">
      <header className="sticky top-0 z-30 bg-white/80 border-b border-black/[0.08] backdrop-blur-xl">
        <div className="mx-auto max-w-[1068px] px-6 lg:px-10 flex items-center justify-between h-14 sm:h-16">
          <Link href="/" className="shrink-0 flex items-center gap-2.5" aria-label="General Market — home">
            <img src="/logo.svg" alt="" width={36} height={36} className="w-9 h-9" />
            <span className="text-[19px] sm:text-[22px] font-black tracking-[-0.03em] text-black">
              General Market
            </span>
          </Link>

          <div className="hidden sm:flex items-center gap-6">
            <span className="text-[13px] text-[#86868B] tracking-[-0.016em]">{title}</span>
            <form action="/room/logout" method="post">
              <button
                type="submit"
                className="rounded-full border border-black/10 hover:border-black/30 px-3.5 py-1.5 text-[12px] font-medium text-[#1D1D1F] transition-colors"
              >
                Lock the room
              </button>
            </form>
          </div>

          <form action="/room/logout" method="post" className="sm:hidden">
            <button
              type="submit"
              aria-label="Lock the room"
              className="text-[12px] text-[#6E6E73] hover:text-black"
            >
              Lock
            </button>
          </form>
        </div>
      </header>

      <div className="mx-auto max-w-[1068px] px-6 lg:px-10">
        <div className="flex flex-col md:flex-row gap-10 lg:gap-14 pt-8 md:pt-14 pb-16 md:pb-24">
          <aside className="md:w-56 lg:w-60 shrink-0">
            <div className="md:sticky md:top-24">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#86868B] mb-4">
                {title}
              </p>
              <nav className="space-y-0.5">
                {pages.map((p) => {
                  const isCurrent =
                    (p.pageSlug === 'index' && currentPageSlug === null) ||
                    p.pageSlug === currentPageSlug
                  const href =
                    p.pageSlug === 'index' ? '/room' : `/room/${p.pageSlug}`
                  return (
                    <Link
                      key={p.pageSlug}
                      href={href}
                      className={
                        'block px-3 py-2 rounded-lg text-[14px] tracking-[-0.016em] transition-colors ' +
                        (isCurrent
                          ? 'bg-black text-white font-medium'
                          : 'text-[#1D1D1F]/80 hover:text-black hover:bg-black/[0.04]')
                      }
                    >
                      {p.frontmatter.title || p.pageSlug}
                    </Link>
                  )
                })}
              </nav>
            </div>
          </aside>

          <main className="flex-1 min-w-0">
            <article
              className="max-w-[680px] [&_h1]:text-[44px] [&_h1]:md:text-[56px] [&_h1]:font-bold [&_h1]:tracking-[-0.025em] [&_h1]:leading-[1.05] [&_h1]:mb-6
                         [&_h2]:text-[28px] [&_h2]:md:text-[32px] [&_h2]:font-semibold [&_h2]:tracking-[-0.022em] [&_h2]:leading-[1.15] [&_h2]:mt-14 [&_h2]:mb-4
                         [&_h3]:text-[22px] [&_h3]:font-semibold [&_h3]:tracking-[-0.016em] [&_h3]:mt-8 [&_h3]:mb-2
                         [&_p]:text-[17px] [&_p]:leading-[1.6] [&_p]:tracking-[-0.022em] [&_p]:text-[#1D1D1F] [&_p]:mb-5
                         [&_ul]:my-5 [&_ul]:space-y-2 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:text-[17px] [&_li]:leading-[1.6]
                         [&_ol]:my-5 [&_ol]:space-y-2 [&_ol]:list-decimal [&_ol]:pl-6
                         [&_strong]:font-semibold [&_strong]:text-black
                         [&_blockquote]:my-6 [&_blockquote]:border-l-2 [&_blockquote]:border-[#0071E3]/40 [&_blockquote]:pl-5 [&_blockquote]:text-[#6E6E73] [&_blockquote]:text-[15px] [&_blockquote]:leading-[1.55]
                         [&_table]:my-6 [&_table]:w-full [&_table]:text-[15px] [&_th]:text-left [&_th]:font-semibold [&_th]:text-black [&_th]:py-2 [&_th]:px-3 [&_th]:bg-black/[0.04] [&_th]:border-b [&_th]:border-black/10 [&_td]:py-2 [&_td]:px-3 [&_td]:border-b [&_td]:border-black/[0.06] [&_tr:last-child_td]:border-b-0
                         [&_hr]:my-10 [&_hr]:border-black/10
                         [&_a]:text-[#0071E3] [&_a]:no-underline [&_a:hover]:underline"
            >
              {children}
            </article>
          </main>
        </div>
      </div>
    </div>
  )
}
