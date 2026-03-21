'use client'

import { useTranslations } from 'next-intl'

interface IndexTabProps {
  address: string
}

export function IndexTab({ address: _address }: IndexTabProps) {
  const t = useTranslations('common')

  return (
    <div className="py-12 text-center text-sm text-text-muted">
      {t('profile.itp_coming_soon')}
    </div>
  )
}
