import type { ReactNode } from 'react'

/*
 * AppShell — the outer canvas. Light page background; everything inside
 * a centered white card with rounded corners and a single soft shadow.
 * Mirrors the reference image's outer wrapper.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen w-full bg-bg p-3 sm:p-6">
      <div
        className="mx-auto h-[calc(100vh-1.5rem)] sm:h-[calc(100vh-3rem)] w-full max-w-[1400px] overflow-hidden bg-panel"
        style={{
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        {children}
      </div>
    </div>
  )
}
