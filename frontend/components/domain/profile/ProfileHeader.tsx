'use client'

import { truncateAddress } from '@/lib/utils/address'
import { formatRelativeTime } from '@/lib/utils/time'

interface ProfileStat {
  label: string
  value: string
  color?: string
}

interface ProfileHeaderProps {
  address: string
  lastActiveAt?: string
  stats: ProfileStat[]
}

function GradientAvatar({ address }: { address: string }) {
  const initial = address[2]?.toUpperCase() || '?'
  // Derive hue from address bytes
  const hue = parseInt(address.slice(2, 6), 16) % 360
  return (
    <div
      className="w-12 h-12 rounded-full flex items-center justify-center text-white text-heading font-bold shrink-0"
      style={{ background: `linear-gradient(135deg, hsl(${hue}, 60%, 45%), hsl(${(hue + 60) % 360}, 70%, 55%))` }}
    >
      {initial}
    </div>
  )
}

export function ProfileHeader({ address, lastActiveAt, stats }: ProfileHeaderProps) {
  return (
    <div className="border-b border-border-light">
      <div className="px-6 lg:px-12">
        <div className="max-w-site mx-auto py-6">
          {/* Identity row */}
          <div className="flex items-center gap-4 mb-4">
            <GradientAvatar address={address} />
            <div>
              <div className="text-heading font-bold font-mono tracking-tight text-black">
                {truncateAddress(address)}
              </div>
              {lastActiveAt && (
                <div className="text-caption text-text-muted mt-0.5">
                  Last active {formatRelativeTime(lastActiveAt)}
                </div>
              )}
            </div>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-6 overflow-x-auto">
            {stats.map((stat) => (
              <div key={stat.label} className="shrink-0">
                <div className="text-micro font-semibold uppercase tracking-[0.08em] text-text-muted">
                  {stat.label}
                </div>
                <div className={`text-subhead font-bold font-mono tabular-nums ${stat.color || 'text-black'}`}>
                  {stat.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
