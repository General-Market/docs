import { ReactNode } from 'react'
import { AppleFooter } from './AppleFooter'
import { LeftRail } from './LeftRail'
import { TopBar } from './TopBar'

type AppShellProps = {
  children: ReactNode
  search?: ReactNode
}

/**
 * Full-bleed shell. No floating card, no outer gray gap. Hairline dividers
 * between regions. The panel IS the page — Apple's pro/enterprise pattern.
 */
export function AppShell({ children, search }: AppShellProps) {
  return (
    <div
      className="min-h-screen w-full grid grid-cols-1 md:grid-cols-[240px_1fr]"
      style={{ background: 'var(--apple-panel)', color: 'var(--apple-text)' }}
    >
      <TopBar search={search} />
      <LeftRail />
      <div className="flex flex-col min-w-0">
        <main className="flex-1 min-w-0">{children}</main>
        <AppleFooter />
      </div>
    </div>
  )
}
