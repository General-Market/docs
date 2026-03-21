'use client'

import { useTranslations } from 'next-intl'
import type { SectionProps } from '../SectionRenderer'

export function TradeCta({ itpId }: SectionProps) {
  const t = useTranslations('markets.itp_page.trade_cta')

  return (
    <section className="flex flex-col sm:flex-row gap-3 pt-4">
      <a
        href={`/#markets`}
        className="px-6 py-3 bg-black text-white text-sm font-bold rounded-md hover:bg-zinc-800 transition-colors text-center fluid-press"
      >
        {t('buy')}
      </a>
      <a
        href={`/#markets`}
        className="px-6 py-3 border-2 border-black text-sm font-bold rounded-md hover:bg-black hover:text-white transition-colors text-center fluid-press"
      >
        {t('sell')}
      </a>
    </section>
  )
}
