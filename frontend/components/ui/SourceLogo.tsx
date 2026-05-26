'use client'

import { useState } from 'react'
import Image from 'next/image'

/**
 * Round source logo — Apple's circle treatment: the registry image on a
 * neutral disc, first-letter fallback when it's missing or broken. Shared by
 * the search ("research") bar and the not-found page so the iconography is
 * identical everywhere a source is named.
 */
export function SourceLogo({
  logo,
  name,
  size = 28,
}: {
  logo: string
  name: string
  size?: number
}) {
  const [broken, setBroken] = useState(false)

  if (logo && !broken) {
    return (
      <span
        className="inline-flex items-center justify-center shrink-0 overflow-hidden rounded-full"
        style={{ width: size, height: size, background: '#f5f5f7' }}
      >
        <Image
          src={logo}
          alt=""
          width={size}
          height={size}
          className="object-cover"
          unoptimized
          onError={() => setBroken(true)}
        />
      </span>
    )
  }

  return (
    <span
      className="inline-flex items-center justify-center shrink-0 rounded-full font-semibold"
      style={{
        width: size,
        height: size,
        background: '#f5f5f7',
        color: 'var(--apple-text, #1d1d1f)',
        fontSize: Math.round(size * 0.43),
      }}
      aria-hidden
    >
      {name.charAt(0).toUpperCase()}
    </span>
  )
}
