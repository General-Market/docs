'use client'

import { useTranslations } from 'next-intl'
import { motion, useReducedMotion } from 'framer-motion'
import { springs, SpringNumber } from '@/components/ui/spring'
import { truncateAddress } from '@/lib/utils/address'
import { formatRelativeTime } from '@/lib/utils/time'
import { PnlChart } from './PnlChart'
import type { PnlPoint } from '@/hooks/usePlayerProfile'

interface ProfileStat {
  label: string
  value: string
  numericValue?: number
  color?: string
  format?: (n: number) => string
}

interface ProfileHeroProps {
  address: string
  lastActiveAt?: string
  /** "Joined Apr 2026" — pre-formatted label derived from earliest tick. */
  joined?: string | null
  stats: ProfileStat[]
  pnlHistory: PnlPoint[]
  /** Optional override for the headline P&L figure — used by tabs (e.g. vaults)
   *  that compute totals outside the time-series history. */
  pnlOverride?: number
}

function GradientAvatar({ address }: { address: string }) {
  const hue = parseInt(address.slice(2, 6), 16) % 360
  // Soft, juicy radial — matches the orange/pink blob in the Polymarket reference.
  const bg = `radial-gradient(circle at 30% 30%, hsl(${hue}, 90%, 65%), hsl(${(hue + 80) % 360}, 80%, 55%) 60%, hsl(${(hue + 200) % 360}, 70%, 50%))`
  return (
    <div
      className="w-16 h-16 sm:w-20 sm:h-20 rounded-full shrink-0"
      style={{ background: bg }}
      aria-hidden="true"
    />
  )
}

function StatCell({ stat }: { stat: ProfileStat }) {
  const hasNumeric = stat.numericValue !== undefined && stat.format
  return (
    <div className="shrink-0">
      <div
        className={`text-[22px] sm:text-[26px] font-bold tabular-nums leading-none tracking-tight ${stat.color || 'text-text-primary'}`}
      >
        {hasNumeric ? (
          <SpringNumber value={stat.numericValue!} format={stat.format!} />
        ) : (
          stat.value
        )}
      </div>
      <div className="text-[12px] sm:text-[13px] text-text-muted mt-1.5 font-medium">
        {stat.label}
      </div>
    </div>
  )
}

function ShareButton({ address }: { address: string }) {
  const t = useTranslations('common')
  const onClick = () => {
    const url = typeof window !== 'undefined'
      ? `${window.location.origin}/profile/${address}`
      : `/profile/${address}`
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(url)
    }
  }
  return (
    <button
      onClick={onClick}
      aria-label={t('profile.share')}
      title={t('profile.share')}
      className="p-1.5 rounded-md text-text-muted hover:text-black hover:bg-surface transition-colors"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" strokeLinecap="round" />
        <path d="M16 6l-4-4-4 4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 2v14" strokeLinecap="round" />
      </svg>
    </button>
  )
}


export function ProfileHero({
  address,
  lastActiveAt,
  joined,
  stats,
  pnlHistory,
  pnlOverride,
}: ProfileHeroProps) {
  const t = useTranslations('common')
  const reduced = useReducedMotion()

  const container = {
    initial: reduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 },
    animate: reduced
      ? { opacity: 1, y: 0 }
      : { opacity: 1, y: 0, transition: { ...springs.page, staggerChildren: 0.06 } },
  }

  const item = {
    initial: reduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
  }

  return (
    <div className="border-b border-border-light">
      <div className="px-6 lg:px-12">
        <motion.div
          className="max-w-site mx-auto py-6"
          variants={container}
          initial="initial"
          animate="animate"
        >
          {/* Two-card hero grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5">
            {/* Left card — Identity + Stats */}
            <motion.div
              className="bg-white border border-border-light rounded-2xl p-5 sm:p-6"
              variants={item}
              transition={springs.page}
            >
              <div className="flex items-start gap-4 sm:gap-5 mb-6">
                <GradientAvatar address={address} />
                <div className="flex-1 min-w-0">
                  <div className="text-[24px] sm:text-[30px] font-bold font-mono tracking-tight text-text-primary truncate leading-tight">
                    {truncateAddress(address)}
                  </div>
                  <div className="text-[13px] text-text-muted mt-1 flex items-center gap-2 flex-wrap">
                    {joined && <span>{joined}</span>}
                    {joined && lastActiveAt && <span className="text-text-muted/50">·</span>}
                    {lastActiveAt && (
                      <span>
                        {t('profile.last_active', { time: formatRelativeTime(lastActiveAt) })}
                      </span>
                    )}
                  </div>
                </div>
                <ShareButton address={address} />
              </div>

              {/* Stats — Polymarket-style: big value above, small label below, vertical dividers */}
              <div className="flex items-stretch gap-4 sm:gap-6 divide-x divide-border-light">
                {stats.map((stat, i) => (
                  <div
                    key={stat.label}
                    className={i === 0 ? 'pl-0 pr-2 sm:pr-4 flex-1 min-w-0' : 'pl-4 sm:pl-6 pr-2 flex-1 min-w-0'}
                  >
                    <StatCell stat={stat} />
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Right card — P&L Chart */}
            <motion.div
              className="bg-white border border-border-light rounded-2xl overflow-hidden"
              variants={item}
              transition={springs.page}
            >
              <PnlChart history={pnlHistory} hero currentPnlOverride={pnlOverride} />
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
