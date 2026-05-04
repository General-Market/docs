import { ReactNode } from 'react'
import { AppleFooter } from './AppleFooter'
import { LeftRail } from './LeftRail'
import { TopBar } from './TopBar'

type AppShellProps = {
  children: ReactNode
  search?: ReactNode
  /**
   * Custom sidebar for the left rail. When provided, replaces the default
   * LeftRail global nav. Source detail pages use this to slot in
   * SourceSidebarApple — same 240px column, different content.
   */
  sidebar?: ReactNode
}

/**
 * Full-bleed shell. No floating card, no outer gray gap. Hairline dividers
 * between regions. The panel IS the page — Apple's pro/enterprise pattern.
 */
export function AppShell({ children, search, sidebar }: AppShellProps) {
  return (
    <div
      className="min-h-screen w-full grid grid-cols-1 md:grid-cols-[240px_1fr]"
      style={{ background: 'var(--apple-panel)', color: 'var(--apple-text)' }}
    >
      <TopBar search={search} />
      {sidebar ?? <LeftRail />}
      <main className="min-w-0">{children}</main>
      <div className="col-span-1 md:col-span-2">
        <AppleFooter />
      </div>
    </div>
  )
}
