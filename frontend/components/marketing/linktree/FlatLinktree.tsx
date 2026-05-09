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
    case 'app':
      return (
        <svg {...common} aria-hidden>
          <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" stroke="currentColor" strokeWidth="1.6" />
          <path d="M9.5 14.5 14.5 9.5M10 9.5h4.5V14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
  }
}

export function FlatLinktree() {
  return (
    <main className="flt-page">
      <style>{`
        .flt-page {
          min-height: 100dvh;
          background:
            radial-gradient(70% 60% at 50% 38%, #ffffff 0%, #f4f4f6 65%, #ececef 100%);
          color: #1d1d1f;
          font-family: var(--apple-font-display, "SF Pro Display", -apple-system, system-ui, sans-serif);
          letter-spacing: -0.01em;
          padding:
            max(48px, env(safe-area-inset-top))
            24px
            max(48px, env(safe-area-inset-bottom));
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 18px;
          position: relative;
        }
        .flt-page::before {
          content: '';
          position: fixed; inset: 0;
          pointer-events: none;
          z-index: 0;
          background:
            radial-gradient(40% 30% at 50% 78%, rgba(0,113,227,0.05) 0%, transparent 70%),
            radial-gradient(28% 22% at 82% 30%, rgba(255,180,80,0.05) 0%, transparent 70%);
        }
        .flt-page > * { position: relative; z-index: 1; }
        .flt-avatar {
          width: 88px; height: 88px;
          border-radius: 22px;
          overflow: hidden;
          box-shadow: 0 12px 32px rgba(0,0,0,0.12);
          background: #fff;
          display: grid; place-items: center;
        }
        .flt-avatar img { width: 100%; height: 100%; display: block; }
        .flt-handle {
          font-size: 22px;
          font-weight: 600;
          letter-spacing: -0.022em;
          margin: 4px 0 0;
        }
        .flt-tag {
          font-size: 15px;
          color: #6e6e73;
          letter-spacing: -0.01em;
          margin: 0;
          text-align: center;
          max-width: 320px;
        }
        .flt-list {
          display: flex; flex-direction: column;
          gap: 12px;
          width: 100%;
          max-width: 420px;
          margin-top: 14px;
        }
        .flt-row {
          display: flex; align-items: center; gap: 14px;
          padding: 16px 20px;
          border-radius: 999px;
          background: #f5f5f7;
          color: #1d1d1f;
          text-decoration: none;
          font-size: 15px;
          font-weight: 500;
          letter-spacing: -0.01em;
          transition: background 200ms cubic-bezier(0.25,1,0.5,1),
                      transform 200ms cubic-bezier(0.25,1,0.5,1),
                      box-shadow 240ms cubic-bezier(0.25,1,0.5,1);
          border: 1px solid rgba(0,0,0,0.04);
          position: relative;
          overflow: hidden;
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
        }
        .flt-row:hover {
          background: #ececef;
          transform: translateY(-1px);
        }
        .flt-row:active { transform: translateY(0); }
        .flt-row svg { flex-shrink: 0; }
        .flt-row-label { flex: 1; display: flex; flex-direction: column; gap: 2px; line-height: 1.15; }
        .flt-kicker {
          font-size: 9.5px;
          font-weight: 700;
          letter-spacing: 0.10em;
          text-transform: uppercase;
          opacity: 0.6;
        }
        .flt-row--featured {
          background: linear-gradient(180deg, #1d1d1f 0%, #0a0a0c 100%);
          color: #ffffff;
          padding: 18px 22px;
          border: 1px solid rgba(0,0,0,0.5);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.08),
            inset 0 -1px 0 rgba(0,0,0,0.4),
            0 8px 22px rgba(0,113,227,0.18),
            0 1px 2px rgba(0,0,0,0.2);
          overflow: visible;
          isolation: isolate;
          z-index: 1;
        }
        .flt-row--featured .flt-kicker {
          color: #2997ff;
          opacity: 1;
        }
        .flt-row--featured::before {
          content: '';
          position: absolute;
          inset: -1.5px;
          z-index: -2;
          border-radius: 999px;
          background: conic-gradient(
            from 0deg,
            transparent 0%,
            transparent 42%,
            rgba(41,151,255,0.4) 45%,
            rgba(170,210,255,0.95) 48%,
            #ffffff 50%,
            rgba(170,210,255,0.95) 52%,
            rgba(41,151,255,0.4) 55%,
            transparent 58%,
            transparent 100%
          );
          filter: blur(0.6px);
          animation: flt-chase 2.4s infinite;
        }
        .flt-row--featured::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background: linear-gradient(180deg, #1d1d1f 0%, #0a0a0c 100%);
          z-index: -1;
        }
        .flt-row--featured:hover {
          background: linear-gradient(180deg, #2a2a2c 0%, #16161a 100%);
          transform: translateY(-2px);
        }
        .flt-row--featured:hover::after {
          background: linear-gradient(180deg, #2a2a2c 0%, #16161a 100%);
        }
        @keyframes flt-chase {
          0% {
            transform: rotate(0deg);
            animation-timing-function: cubic-bezier(0.5, 0, 0.75, 0);
          }
          50% {
            transform: rotate(180deg);
            animation-timing-function: cubic-bezier(0.25, 1, 0.5, 1);
          }
          100% {
            transform: rotate(360deg);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .flt-row--featured::before { animation: none; }
        }
      `}</style>

      <div className="flt-avatar" aria-label="General Market">
        <Image src="/logo.svg" alt="" width={88} height={88} priority />
      </div>

      <h1 className="flt-handle">@generalmarket</h1>
      <p className="flt-tag">Trading is easy with an Anti-Cheat.</p>

      <div className="flt-list">
        {LINKTREE_ENTRIES.map((entry) => {
          const external = entry.external
          const className = entry.featured ? 'flt-row flt-row--featured' : 'flt-row'
          return (
            <a
              key={entry.label}
              href={entry.href}
              target={external ? '_blank' : undefined}
              rel={external ? 'noopener noreferrer' : undefined}
              className={className}
            >
              <Icon kind={entry.icon} />
              <span className="flt-row-label">
                {entry.kicker ? <span className="flt-kicker">{entry.kicker}</span> : null}
                <span>{entry.label}</span>
              </span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          )
        })}
      </div>
    </main>
  )
}
