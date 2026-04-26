'use client'

import { useEffect, useState, type ReactNode } from 'react'

/**
 * WinShimmer — a one-shot celebration overlay.
 *
 * When `active` flips to true, three things happen in sequence:
 *  - 0.0s → 0.8s: an emerald glow halo pulses behind the children.
 *  - 0.0s → 1.4s: a left-to-right gradient sweep crosses the row.
 *  - 0.2s → 1.7s: the floating "+{payout} USDC" label rises and fades.
 *  - 2.0s: internal timer disables the shimmer; only the children remain.
 *
 * The component never animates twice — once `active` is consumed, a guard
 * prevents re-running unless the consumer toggles it false → true again.
 * That's exactly what `justWon` does.
 */

export interface WinShimmerProps {
  active: boolean
  payout?: string
  children: ReactNode
}

export function WinShimmer({ active, payout, children }: WinShimmerProps) {
  const [running, setRunning] = useState<boolean>(false)

  useEffect(() => {
    if (!active) return
    setRunning(true)
    const t = window.setTimeout(() => setRunning(false), 2000)
    return () => window.clearTimeout(t)
  }, [active])

  if (!running) {
    return <>{children}</>
  }

  return (
    <div className="relative">
      <style jsx>{`
        @keyframes pulse-glow {
          0%   { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
          40%  { box-shadow: 0 0 0 8px rgba(16, 185, 129, 0.35); }
          100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
        @keyframes shimmer-sweep {
          0%   { transform: translateX(-100%); opacity: 0; }
          20%  { opacity: 1; }
          80%  { opacity: 1; }
          100% { transform: translateX(100%); opacity: 0; }
        }
        @keyframes float-up {
          0%   { transform: translate(-50%, 4px); opacity: 0; }
          25%  { transform: translate(-50%, 0px); opacity: 1; }
          75%  { transform: translate(-50%, -10px); opacity: 1; }
          100% { transform: translate(-50%, -22px); opacity: 0; }
        }
        .ws-glow {
          position: absolute;
          inset: 0;
          border-radius: 6px;
          pointer-events: none;
          animation: pulse-glow 0.8s ease-out forwards;
        }
        .ws-sweep {
          position: absolute;
          inset: 0;
          border-radius: 6px;
          overflow: hidden;
          pointer-events: none;
        }
        .ws-sweep::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(
            90deg,
            rgba(236, 253, 245, 0) 0%,
            rgba(167, 243, 208, 0.55) 50%,
            rgba(236, 253, 245, 0) 100%
          );
          animation: shimmer-sweep 1.4s ease-in-out forwards;
        }
        .ws-label {
          position: absolute;
          left: 50%;
          top: 6px;
          transform: translate(-50%, 0);
          pointer-events: none;
          animation: float-up 1.5s ease-out 0.2s forwards;
          font-feature-settings: 'tnum' 1;
        }
      `}</style>
      <span className="ws-glow" aria-hidden />
      <span className="ws-sweep" aria-hidden />
      {payout ? (
        <span
          className="ws-label rounded-md bg-emerald-600 px-2 py-0.5 font-mono text-label font-semibold text-white"
          aria-hidden
        >
          +{payout} USDC
        </span>
      ) : null}
      {children}
    </div>
  )
}
