interface YouTubeProps {
  id: string
  title?: string
  start?: number
}

export function YouTube({ id, title = 'YouTube video', start }: YouTubeProps) {
  const params = new URLSearchParams({
    rel: '0',
    modestbranding: '1',
    ...(start ? { start: String(start) } : {}),
  })
  const src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?${params.toString()}`
  return (
    <div className="my-8 overflow-hidden rounded-xl border border-neutral-200 shadow-sm bg-black">
      <div className="relative w-full" style={{ aspectRatio: '16 / 9' }}>
        <iframe
          src={src}
          title={title}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute inset-0 w-full h-full"
        />
      </div>
    </div>
  )
}
