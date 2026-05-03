import { ReactNode } from 'react'
import { LeftRail } from './LeftRail'
import { TopBar } from './TopBar'

type AppShellProps = {
  children: ReactNode
  search?: ReactNode
}

/**
 * Outer page is gray. Everything sits inside a centered floating white panel
 * with rounded corners and a soft shadow. Modelled on the bot visualizer.
 */
export function AppShell({ children, search }: AppShellProps) {
  return (
    <div
      className="min-h-screen w-full"
      style={{ background: 'var(--apple-page-bg)' }}
    >
      <div
        className="mx-auto sm:p-4 lg:p-6"
        style={{ maxWidth: 'var(--apple-shell-max)' }}
      >
        <div
          className="overflow-hidden"
          style={{
            background: 'var(--apple-panel)',
            borderRadius: 'var(--apple-r-card)',
            boxShadow: 'var(--apple-shadow-card)',
            minHeight: 'calc(100vh - 3rem)',
          }}
        >
          <div className="grid grid-cols-1 md:grid-cols-[240px_1fr]">
            <TopBar search={search} />
            <LeftRail />
            <main className="min-w-0">{children}</main>
          </div>
        </div>
      </div>
    </div>
  )
}
