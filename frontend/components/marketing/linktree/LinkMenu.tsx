'use client'

import Image from 'next/image'
import { LINKTREE_ENTRIES, type LinktreeIcon } from './links'

const Icon = ({ kind }: { kind: LinktreeIcon }) => {
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none' } as const
  switch (kind) {
    case 'x':
      return (
        <svg {...common} aria-hidden>
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" fill="currentColor" />
        </svg>
      )
    case 'discord':
      return (
        <svg {...common} aria-hidden>
          <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.07.07 0 0 0-.073.035c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.65 12.65 0 0 0-.617-1.25.07.07 0 0 0-.073-.035A19.74 19.74 0 0 0 3.683 4.37a.06.06 0 0 0-.03.025C.533 9.045-.32 13.58.099 18.057a.08.08 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.08.08 0 0 0 .084-.027 14.1 14.1 0 0 0 1.226-1.994.076.076 0 0 0-.041-.105 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.127c.126-.094.252-.192.372-.291a.07.07 0 0 1 .078-.01c3.927 1.793 8.18 1.793 12.06 0a.07.07 0 0 1 .079.01c.12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.105c.36.7.772 1.367 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.06.06 0 0 0-.031-.026ZM8.02 15.331c-1.182 0-2.157-1.085-2.157-2.42 0-1.333.956-2.418 2.157-2.418 1.21 0 2.176 1.094 2.157 2.418 0 1.335-.956 2.42-2.157 2.42Zm7.974 0c-1.183 0-2.157-1.085-2.157-2.42 0-1.333.955-2.418 2.157-2.418 1.21 0 2.175 1.094 2.157 2.418 0 1.335-.946 2.42-2.157 2.42Z" fill="currentColor" />
        </svg>
      )
    case 'docs':
      return (
        <svg {...common} aria-hidden>
          <path d="M5.5 3.5h9l4 4V20a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M14.5 3.5v4h4M8 12h8M8 15.5h8M8 8.5h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'waitlist':
      return (
        <svg {...common} aria-hidden>
          <path d="M4.5 6h15M4.5 12h15M4.5 18h9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <circle cx="18.5" cy="18" r="3" stroke="currentColor" strokeWidth="1.6" />
          <path d="m17.2 18 1 1 2-2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
  }
}

export function LinkMenu() {
  return (
    <div className="lt-menu">
      <style>{`
        .lt-menu {
          width: 360px;
          padding: 60px 20px 40px;
          background: #ffffff;
          color: #1d1d1f;
          font-family: var(--apple-font-display, "SF Pro Display", -apple-system, system-ui, sans-serif);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 28px;
          height: 780px;
          box-sizing: border-box;
        }
        .lt-status {
          position: absolute;
          inset: 0 0 auto 0;
          height: 44px;
          padding: 14px 28px 0;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          font-size: 14px;
          font-weight: 600;
          letter-spacing: -0.01em;
          color: #1d1d1f;
          font-variant-numeric: tabular-nums;
        }
        .lt-status-right {
          display: inline-flex;
          gap: 6px;
          align-items: center;
        }
        .lt-status-right svg { color: #1d1d1f; }
        .lt-avatar {
          width: 96px; height: 96px;
          border-radius: 22px;
          display: grid; place-items: center;
          margin-top: 8px;
          overflow: hidden;
          box-shadow: 0 12px 32px rgba(0,0,0,0.12);
        }
        .lt-avatar img { width: 100%; height: 100%; display: block; }
        .lt-handle {
          font-size: 20px;
          font-weight: 600;
          letter-spacing: -0.022em;
          margin: 0;
        }
        .lt-tag {
          font-size: 13px;
          color: #6e6e73;
          letter-spacing: -0.01em;
          margin: -22px 0 0;
        }
        .lt-list {
          display: flex; flex-direction: column;
          gap: 12px;
          width: 100%;
        }
        .lt-row {
          display: flex; align-items: center; gap: 14px;
          padding: 14px 18px;
          border-radius: 999px;
          background: #f5f5f7;
          color: #1d1d1f;
          text-decoration: none;
          font-size: 15px;
          font-weight: 500;
          letter-spacing: -0.01em;
          transition: background 200ms cubic-bezier(0.25,1,0.5,1),
                      transform 200ms cubic-bezier(0.25,1,0.5,1);
          border: 1px solid rgba(0,0,0,0.04);
        }
        .lt-row:hover {
          background: #ececef;
          transform: translateY(-1px);
        }
        .lt-row:active { transform: translateY(0); }
        .lt-row svg { flex-shrink: 0; }
        .lt-row-label { flex: 1; }
        .lt-foot {
          margin-top: auto;
          font-size: 11px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #86868b;
        }
      `}</style>

      <div className="lt-status">
        <span>9:41</span>
        <span className="lt-status-right">
          <svg width="18" height="12" viewBox="0 0 18 12" fill="none" aria-hidden>
            <rect x="1" y="3" width="2" height="6" rx="0.5" fill="currentColor" />
            <rect x="5" y="2" width="2" height="8" rx="0.5" fill="currentColor" />
            <rect x="9" y="1" width="2" height="10" rx="0.5" fill="currentColor" />
            <rect x="13" y="0" width="2" height="12" rx="0.5" fill="currentColor" />
          </svg>
          <svg width="16" height="12" viewBox="0 0 16 12" fill="none" aria-hidden>
            <rect x="0.5" y="2.5" width="11" height="6" rx="1.4" stroke="currentColor" />
            <rect x="2" y="4" width="8" height="3" fill="currentColor" />
            <rect x="12.5" y="4.5" width="1" height="3" rx="0.4" fill="currentColor" />
          </svg>
        </span>
      </div>

      <div className="lt-avatar" aria-label="General Market">
        <Image src="/logo.svg" alt="" width={96} height={96} priority />
      </div>

      <h1 className="lt-handle">@generalmarket</h1>
      <p className="lt-tag">Trading is easy with an Anti-Cheat.</p>

      <div className="lt-list">
        {LINKTREE_ENTRIES.map((entry) => {
          const external = entry.external
          return (
            <a
              key={entry.label}
              href={entry.href}
              target={external ? '_blank' : undefined}
              rel={external ? 'noopener noreferrer' : undefined}
              className="lt-row"
            >
              <Icon kind={entry.icon} />
              <span className="lt-row-label">{entry.label}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          )
        })}
      </div>

      <div className="lt-foot">generalmarket.io</div>
    </div>
  )
}
