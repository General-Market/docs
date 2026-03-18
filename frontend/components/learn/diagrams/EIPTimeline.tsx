'use client'

import { motion } from 'framer-motion'

const MILESTONES = [
  { year: '2016', eip: 'EIP-86', note: 'Let contracts pay gas', status: 'too radical' },
  { year: '2020', eip: 'EIP-2938', note: 'AA at protocol layer', status: 'never shipped' },
  { year: '2021', eip: 'ERC-4337', note: 'Off-chain bundler', status: 'works but complex' },
  { year: '2023', eip: 'EIP-3074', note: 'AUTH + AUTHCALL', status: 'superseded' },
  { year: '2024', eip: 'EIP-7702', note: 'Set EOA code', status: 'stepping stone' },
  { year: '2026', eip: 'EIP-8141', note: 'Frame Transactions', status: 'THE OMNIBUS', final: true },
]

export function EIPTimeline() {
  return (
    <div className="my-16 -mx-4 md:-mx-8">
      <div className="bg-[#f5f5f5] border-t-[3px] border-b border-black border-b-border-light px-6 md:px-10 py-10">
        {/* Header */}
        <p className="text-[10px] text-text-muted tracking-[0.2em] uppercase mb-8">
          A Decade of Account Abstraction
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
                <span className="text-[11px] font-mono text-text-muted mb-2">{m.year}</span>

                {/* Dot */}
                <div className={`relative z-10 ${m.final ? 'w-3 h-3' : 'w-2 h-2'} rounded-full ${m.final ? 'bg-black' : 'bg-zinc-400'} mb-3`}>
                  {m.final && (
                    <span className="absolute inset-0 rounded-full bg-black animate-ping opacity-20" />
                  )}
                </div>

                {/* EIP name */}
                <span className={`text-[13px] font-bold ${m.final ? 'text-black' : 'text-text-secondary'}`}>
                  {m.eip}
                </span>

                {/* Note */}
                <span className="text-[10px] text-text-muted mt-0.5 max-w-[90px] leading-tight hidden md:block">
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
