'use client'

import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'

export function EIPTimeline() {
  const t = useTranslations('pages')

  const MILESTONES = [
    { year: '2016', eip: 'EIP-86', note: t('learn.eip_timeline.eip86_note'), status: t('learn.eip_timeline.eip86_status') },
    { year: '2020', eip: 'EIP-2938', note: t('learn.eip_timeline.eip2938_note'), status: t('learn.eip_timeline.eip2938_status') },
    { year: '2021', eip: 'ERC-4337', note: t('learn.eip_timeline.erc4337_note'), status: t('learn.eip_timeline.erc4337_status') },
    { year: '2023', eip: 'EIP-3074', note: t('learn.eip_timeline.eip3074_note'), status: t('learn.eip_timeline.eip3074_status') },
    { year: '2024', eip: 'EIP-7702', note: t('learn.eip_timeline.eip7702_note'), status: t('learn.eip_timeline.eip7702_status') },
    { year: '2026', eip: 'EIP-8141', note: t('learn.eip_timeline.eip8141_note'), status: t('learn.eip_timeline.eip8141_status'), final: true },
  ]
  return (
    <div className="my-16 -mx-4 md:-mx-8">
      <div className="bg-[#f5f5f5] border-t-[3px] border-b border-black border-b-border-light px-6 md:px-10 py-10">
        {/* Header */}
        <p className="text-micro text-text-muted tracking-[0.2em] uppercase mb-8">
          {t('learn.eip_timeline.header')}
        </p>

        {/* Timeline */}
        <div className="relative">
          {/* Horizontal line */}
          <div className="absolute top-[28px] left-0 right-0 h-[1px] bg-zinc-300" />
          {/* Active segment to 8141 */}
          <motion.div
            className="absolute top-[28px] left-0 h-[1px] bg-black"
            initial={{ width: 0 }}
            whileInView={{ width: '100%' }}
            viewport={{ once: true }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
          />

          <div className="flex justify-between relative">
            {MILESTONES.map((m, i) => (
              <motion.div
                key={m.eip}
                className="flex flex-col items-center text-center"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 0.5 }}
              >
                {/* Year */}
                <span className="text-label font-mono text-text-muted mb-2">{m.year}</span>

                {/* Dot */}
                <div className={`relative z-10 ${m.final ? 'w-3 h-3' : 'w-2 h-2'} rounded-full ${m.final ? 'bg-black' : 'bg-zinc-400'} mb-3`}>
                  {m.final && (
                    <span className="absolute inset-0 rounded-full bg-black animate-ping opacity-20" />
                  )}
                </div>

                {/* EIP name */}
                <span className={`text-caption font-bold ${m.final ? 'text-black' : 'text-text-secondary'}`}>
                  {m.eip}
                </span>

                {/* Note */}
                <span className="text-micro text-text-muted mt-0.5 max-w-[90px] leading-tight hidden md:block">
                  {m.note}
                </span>

                {/* Status */}
                <span className={`text-[9px] mt-1.5 tracking-[0.05em] uppercase font-mono ${m.final ? 'text-black font-bold' : 'text-text-muted'}`}>
                  {m.status}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
