// Design tokens for the markets directory.
// One file. Other components import from here so the next iteration
// is one edit, not twenty.

export const tokens = {
  // How long a price-flash effect should linger after a tick (ms).
  flashDurationMs: 600,

  // Cadence of the live-pulse halo on PulseDot (ms).
  pulseIntervalMs: 1500,

  // Stale-after threshold for "is the price live?" (ms).
  liveThresholdMs: 30_000,

  // Card radius — hairline, restrained.
  cardRadius: 'rounded-md',

  // Vertical lift on hover (px) — small enough to register, not jump.
  hoverLiftPx: 1,

  // Mono digit width safeguard (Tailwind class) — for ticking numbers.
  monoDigits: 'font-mono tabular-nums',

  // Color roles. Tailwind class fragments — not raw hex — so dark-mode
  // variants stay one find-and-replace away.
  color: {
    yes: 'emerald-500',     // YES / up direction
    no: 'rose-500',         // NO / down direction
    live: 'amber-400',      // ticker / live pulse
    selected: 'blue-500',   // user's chosen position
    accent: 'zinc-900',     // primary CTA — graphite, ours
    neutral: 'zinc-400',    // flat sparkline, idle dots
    border: 'zinc-200/60',  // hairline default
  },

  // Type scale used across cards/strips. Document the intent.
  type: {
    micro: 'text-[12px]',     // dense metadata, chip labels
    small: 'text-[13px]',     // secondary body
    body: 'text-[14px]',      // default
    label: 'text-[15px]',     // questions, primary readable
    title: 'text-[18px]',     // card titles
    heading: 'text-[24px]',   // page headings
  },
} as const

export type Tokens = typeof tokens
