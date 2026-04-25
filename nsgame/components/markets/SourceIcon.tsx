'use client'

import Image from 'next/image'

// Source brand marks. The icon stands in for the tube it points at —
// nothing more, nothing else.

interface SourceIconProps {
  sourceId: 1 | 2 | 3 | 4 | 5
  className?: string
}

const SOURCE_LOGOS: Record<1 | 2 | 3 | 4 | 5, { src: string; alt: string }> = {
  1: { src: '/sources/xvideos.png', alt: 'xvideos' },
  2: { src: '/sources/xnxx.png', alt: 'xnxx' },
  3: { src: '/sources/pornhub.png', alt: 'pornhub' },
  4: { src: '/sources/chaturbate.png', alt: 'chaturbate' },
  5: { src: '/sources/eporner.png', alt: 'eporner' },
}

export function SourceIcon({ sourceId, className = '' }: SourceIconProps) {
  const logo = SOURCE_LOGOS[sourceId]
  if (!logo) return null

  return (
    <Image
      src={logo.src}
      alt={logo.alt}
      width={20}
      height={20}
      className={['inline-block rounded-[3px] object-cover', className].join(' ')}
      unoptimized
    />
  )
}
