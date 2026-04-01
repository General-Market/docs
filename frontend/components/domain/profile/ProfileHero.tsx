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
  stats: ProfileStat[]
  pnlHistory: PnlPoint[]
}

function GradientAvatar({ address }: { address: string }) {
  const initial = address[2]?.toUpperCase() || '?'
  const hue = parseInt(address.slice(2, 6), 16) % 360
  return (
    <div
      className="w-14 h-14 rounded-full flex items-center justify-center text-white text-[20px] font-bold shrink-0"
      style={{ background: `linear-gradient(135deg, hsl(${hue}, 60%, 45%), hsl(${(hue + 60) % 360}, 70%, 55%))` }}
    >
      {initial}
    </div>
  )
}

function StatCell({ stat }: { stat: ProfileStat }) {
  const hasNumeric = stat.numericValue !== undefined && stat.format
  return (
    <div className="shrink-0">
      <div className="text-micro font-semibold uppercase tracking-[0.08em] text-text-muted">
        {stat.label}
      </div>
      <div className={`text-subhead font-bold font-mono tabular-nums ${stat.color || 'text-black'}`}>
        {hasNumeric ? (
          <SpringNumber value={stat.numericValue!} format={stat.format!} />
        ) : (
          stat.value
        )}
      </div>
    </div>
  )
}

export function ProfileHero({ address, lastActiveAt, stats, pnlHistory }: ProfileHeroProps) {
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left card — Identity + Stats */}
            <motion.div
              className="bg-white border border-border-light rounded-xl p-5"
              variants={item}
              transition={springs.page}
            >
              <div className="flex items-center gap-4 mb-5">
                <GradientAvatar address={address} />
                <div>
                  <div className="text-[20px] font-bold font-mono tracking-tight text-black">
                    {truncateAddress(address)}
                  </div>
                  {lastActiveAt && (
                    <div className="text-caption text-text-muted mt-0.5">
                      {t('profile.last_active', { time: formatRelativeTime(lastActiveAt) })}
                    </div>
                  )}
                </div>
              </div>

              {/* Stats grid — 2 rows on mobile, single row on desktop */}
              <div className="grid grid-cols-3 gap-x-6 gap-y-3 sm:flex sm:items-center sm:gap-6">
                {stats.map((stat) => (
                  <StatCell key={stat.label} stat={stat} />
                ))}
              </div>
            </motion.div>

            {/* Right card — P&L Chart */}
            <motion.div
              className="bg-white border border-border-light rounded-xl overflow-hidden"
              variants={item}
              transition={springs.page}
            >
              <PnlChart history={pnlHistory} hero />
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
