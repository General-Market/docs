import { audienceFor } from '@/lib/vision/homepage-audiences'

interface Props {
  sourceId: string
  size?: 'sm' | 'xs'
}

export function AudiencePill({ sourceId, size = 'sm' }: Props) {
  const audience = audienceFor(sourceId)
  if (!audience) return null

  const label = audience === 'human' ? 'For humans' : 'For bots'
  const background =
    audience === 'human'
      ? 'rgba(0,113,227,0.10)'
      : 'rgba(0,0,0,0.06)'

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full font-medium ${
        size === 'xs' ? 'px-1.5 py-0.5' : 'px-2 py-0.5'
      }`}
      style={{
        background,
        color: 'var(--apple-text)',
        fontSize: size === 'xs' ? 9 : 10,
        letterSpacing: '0.04em',
      }}
    >
      {label}
    </span>
  )
}
