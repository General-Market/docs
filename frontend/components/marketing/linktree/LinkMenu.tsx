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

type LinkMenuProps = {
  onLinkClick?: (e: React.MouseEvent, href: string, external: boolean) => void
}

export function LinkMenu({ onLinkClick }: LinkMenuProps = {}) {
  return (
    <div className="lt-menu">
      <style>{`
        .lt-menu {
          width: 360px;
          padding: 76px 28px 56px;
          /* Subtle gradient gives the glass chrome something to refract over */
          background:
            radial-gradient(140% 60% at 50% 0%, #f7f9fc 0%, transparent 60%),
            radial-gradient(120% 60% at 50% 100%, #eff1f5 0%, transparent 60%),
            #ffffff;
          color: #1d1d1f;
          font-family: var(--apple-font-display, "SF Pro Display", -apple-system, system-ui, sans-serif);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 22px;
          height: 780px;
          box-sizing: border-box;
          position: relative;
          overflow: hidden;
          /* Match the iPhone screen's rounded corners so the menu clips
             inside the display, not over the bezel. */
          border-radius: 44px;
        }
        /* Tahoe-style liquid-glass — sits *over* the menu so the rows
           read as if they're behind a pane of glass. Cool-tinted sheen
           is visible against the warm white menu; rim catches light. */
        .lt-menu::before {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 5;
          border-radius: inherit;
          box-shadow:
            inset 0 1.5px 0 rgba(255,255,255,0.95),
            inset 0 -1.5px 0 rgba(0,0,0,0.06),
            inset 1.5px 0 0 rgba(220,228,240,0.45),
            inset -1.5px 0 0 rgba(220,228,240,0.30);
        }
        .lt-menu::after {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 4;
          border-radius: inherit;
          background:
            /* Specular sheen — cool-tinted band catching light at top-left */
            linear-gradient(128deg,
              rgba(206, 218, 236, 0.55) 0%,
              rgba(206, 218, 236, 0.28) 14%,
              rgba(216, 226, 240, 0.08) 26%,
              transparent 38%,
              transparent 58%,
              rgba(216, 226, 240, 0.10) 72%,
              rgba(196, 210, 230, 0.22) 92%,
              rgba(196, 210, 230, 0.30) 100%),
            /* Faint horizon glow across the top */
            linear-gradient(180deg,
              rgba(255,255,255,0.35) 0%,
              transparent 12%),
            /* Subtle edge vignette — glass curves away */
            radial-gradient(115% 100% at 50% 50%,
              transparent 60%,
              rgba(40, 60, 90, 0.06) 100%);
        }
        /* Liquid-glass status bar — Tahoe-style translucent chrome */
        .lt-status {
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 54px;
          padding: 16px 26px 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          color: #1d1d1f;
          z-index: 2;
        }
        .lt-time {
          font-family: var(--apple-font-display, "SF Pro Display", -apple-system, system-ui, sans-serif);
          font-size: 17px;
          font-weight: 600;
          letter-spacing: -0.022em;
          font-variant-numeric: tabular-nums;
          line-height: 1;
          padding-left: 4px;
        }
        .lt-status-right {
          display: inline-flex;
          gap: 6px;
          align-items: center;
          padding-right: 4px;
        }
        .lt-status-right svg { color: #1d1d1f; display: block; }
        /* Dynamic island — black pill with the camera lens dot, like
           iPhone 14 Pro and later. Positioned over the status bar. */
        .lt-island {
          position: absolute;
          top: 11px; left: 50%;
          transform: translateX(-50%);
          width: 118px; height: 35px;
          border-radius: 999px;
          background:
            radial-gradient(60% 80% at 50% 30%, #1a1a1a 0%, #050505 100%);
          box-shadow:
            inset 0 0.5px 0 rgba(255,255,255,0.08),
            inset 0 -0.5px 0 rgba(0,0,0,0.6),
            0 1px 2px rgba(0,0,0,0.18);
          z-index: 3;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          padding-right: 10px;
        }
        .lt-island-cam {
          width: 11px; height: 11px;
          border-radius: 50%;
          background:
            radial-gradient(circle at 35% 35%, #2c3a4a 0%, #0a0e14 60%, #000 100%);
          box-shadow:
            inset 0 0 0 1.5px #060708,
            inset 0 0 2px 0 rgba(60,80,110,0.6);
        }
        /* Liquid-glass home indicator */
        .lt-home {
          position: absolute;
          bottom: 9px; left: 50%;
          transform: translateX(-50%);
          width: 140px; height: 5px;
          border-radius: 999px;
          background: linear-gradient(180deg, #1d1d1f 0%, #2a2a2c 100%);
          box-shadow:
            inset 0 0.5px 0 rgba(255,255,255,0.18),
            0 0.5px 1px rgba(0,0,0,0.12);
          z-index: 4;
        }
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
      `}</style>

      <div className="lt-status">
        <span className="lt-time">9:41</span>
        <span className="lt-status-right">
          {/* Cellular signal — 4 ascending bars */}
          <svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor" aria-hidden>
            <rect x="0" y="7" width="3" height="4" rx="0.8" />
            <rect x="4.7" y="5" width="3" height="6" rx="0.8" />
            <rect x="9.3" y="2.5" width="3" height="8.5" rx="0.8" />
            <rect x="14" y="0" width="3" height="11" rx="0.8" />
          </svg>
          {/* Wi-Fi — 3 nested arcs above a dot */}
          <svg width="16" height="11" viewBox="0 0 16 11" fill="currentColor" aria-hidden>
            <path d="M8 0C5.16 0 2.55 0.99 0.5 2.65L1.95 4.27C3.61 2.94 5.71 2.14 8 2.14C10.29 2.14 12.39 2.94 14.05 4.27L15.5 2.65C13.45 0.99 10.84 0 8 0Z" />
            <path d="M8 3.5C6.18 3.5 4.51 4.18 3.22 5.32L4.67 6.95C5.59 6.13 6.74 5.64 8 5.64C9.26 5.64 10.41 6.13 11.33 6.95L12.78 5.32C11.49 4.18 9.82 3.5 8 3.5Z" />
            <path d="M8 7C6.95 7 6 7.41 5.32 8.07L8 11L10.68 8.07C10 7.41 9.05 7 8 7Z" />
          </svg>
          {/* Battery — rounded body, fill, terminal nub */}
          <svg width="27" height="13" viewBox="0 0 27 13" fill="none" aria-hidden>
            <rect x="0.5" y="0.5" width="22" height="11.5" rx="3" stroke="currentColor" strokeOpacity="0.4" />
            <rect x="2" y="2" width="19" height="8.5" rx="1.6" fill="currentColor" />
            <path d="M24.5 4.4v4.2" stroke="currentColor" strokeOpacity="0.4" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </span>
      </div>
      <div className="lt-island" aria-hidden>
        <span className="lt-island-cam" aria-hidden />
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
              onClick={(e) => onLinkClick?.(e, entry.href, !!external)}
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

      <div className="lt-home" aria-hidden />
    </div>
  )
}
