import { ReactNode } from 'react'

type RightRailProps = {
  children?: ReactNode
}

export function RightRail({ children }: RightRailProps) {
  return (
    <aside
      className="hidden xl:flex flex-col shrink-0 border-l overflow-y-auto"
      style={{
        width: 'var(--apple-shell-right)',
        background: 'var(--apple-bg)',
        borderColor: 'var(--apple-border)',
        paddingBottom: '96px',
      }}
      aria-label="Featured side"
    >
      {children}
    </aside>
  )
}
