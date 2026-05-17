import Link from 'next/link'
import type { ReactNode } from 'react'
import type { RoomPage } from '@/lib/dataroom/content'
import { PrintButton } from './PrintButton'

interface RoomShellProps {
  title: string
  pages: RoomPage[]
  currentPageSlug: string | null
  children: ReactNode
}

function pageNumber(pages: RoomPage[], currentPageSlug: string | null): number {
  const slug = currentPageSlug ?? 'index'
  const idx = pages.findIndex((p) => p.pageSlug === slug)
  return idx === -1 ? 1 : idx + 1
}

function currentTitle(pages: RoomPage[], currentPageSlug: string | null): string {
  const slug = currentPageSlug ?? 'index'
  const p = pages.find((x) => x.pageSlug === slug)
  return p?.frontmatter.title ?? slug
}

export function RoomShell({ title, pages, currentPageSlug, children }: RoomShellProps) {
  const n = pageNumber(pages, currentPageSlug)
  const total = pages.length
  const docTitle = currentTitle(pages, currentPageSlug)
  const pad = (x: number) => String(x).padStart(2, '0')

  return (
    <div className="min-h-screen bg-[#FBFBFD] text-[#1D1D1F] print:bg-white">
      <header className="sticky top-0 z-30 bg-white/80 border-b border-black/[0.08] backdrop-blur-xl print:hidden">
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

      <div className="mx-auto max-w-[1068px] px-6 lg:px-10 print:max-w-none print:px-0">
        <div className="flex flex-col md:flex-row gap-10 lg:gap-14 pt-8 md:pt-14 pb-16 md:pb-24 print:block print:py-0">
          <aside className="md:w-56 lg:w-60 shrink-0 print:hidden">
            <div className="md:sticky md:top-24">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#86868B] mb-4">
                {title}
              </p>
              <nav className="space-y-0.5">
                {pages.map((p, i) => {
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
                        'group flex items-baseline gap-3 px-3 py-2 rounded-lg text-[14px] tracking-[-0.016em] transition-colors ' +
                        (isCurrent
                          ? 'bg-black text-white font-medium'
                          : 'text-[#1D1D1F]/80 hover:text-black hover:bg-black/[0.04]')
                      }
                    >
                      <span
                        className={
                          'font-mono text-[11px] tabular-nums tracking-normal ' +
                          (isCurrent ? 'text-white/60' : 'text-[#86868B]')
                        }
                      >
                        {pad(i + 1)}
                      </span>
                      <span>{p.frontmatter.title || p.pageSlug}</span>
                    </Link>
                  )
                })}
              </nav>
            </div>
          </aside>

          <main className="flex-1 min-w-0">
            <article
              className="max-w-[680px] print:max-w-none print:mx-auto print:px-16
                         [&_h1]:text-[44px] [&_h1]:md:text-[56px] [&_h1]:font-bold [&_h1]:tracking-[-0.025em] [&_h1]:leading-[1.05] [&_h1]:mb-6
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
              <div className="mb-10 pb-5 border-b border-black/[0.08] flex items-baseline justify-between gap-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[#86868B] font-mono tabular-nums">
                  <span className="text-black/80">Document {pad(n)}</span>
                  <span className="mx-2 text-[#86868B]/60">/</span>
                  <span>{pad(total)}</span>
                  <span className="mx-3 text-[#86868B]/60">·</span>
                  <span className="font-sans tracking-[0.14em]">{title}</span>
                </p>
                <PrintButton />
              </div>

              {children}

              <div className="mt-20 pt-8 border-t border-black/[0.08] flex items-center justify-between gap-4 print:hidden">
                <div className="text-[12px] text-[#86868B]">
                  <span className="uppercase tracking-[0.14em]">End of document</span>
                  <span className="mx-2 text-[#86868B]/50">·</span>
                  <span className="font-mono tabular-nums">{docTitle}</span>
                </div>
                <PrintButton label="Download this document (PDF)" />
              </div>

              <div className="hidden print:block mt-12 pt-6 border-t border-black/10 text-[10px] uppercase tracking-[0.18em] text-[#86868B] text-center">
                {title} · Document {pad(n)} of {pad(total)} · {docTitle}
              </div>
            </article>
          </main>
        </div>
      </div>
    </div>
  )
}
