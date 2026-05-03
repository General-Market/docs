import { ReactNode } from 'react'
import { LeftRail } from './LeftRail'
import { TopBar } from './TopBar'
import { RightRail } from './RightRail'

type AppShellProps = {
  children: ReactNode
  search?: ReactNode
  rightRail?: ReactNode
}

export function AppShell({ children, search, rightRail }: AppShellProps) {
  return (
    <div
      className="flex min-h-screen"
      style={{ background: 'var(--apple-bg)', color: 'var(--apple-text)' }}
    >
      <LeftRail />
      <div className="flex-1 min-w-0 flex">
        <div className="flex-1 min-w-0 flex flex-col">
          <TopBar search={search} />
          <main className="flex-1 min-w-0">
            <div className="mx-auto w-full max-w-apple-wide px-6 py-8">
              {children}
            </div>
          </main>
        </div>
        {rightRail !== undefined && <RightRail>{rightRail}</RightRail>}
      </div>
    </div>
  )
}
