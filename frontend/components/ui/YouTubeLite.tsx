'use client'

import { useState } from 'react'

/** Extract YouTube video ID from various URL formats */
export function extractYouTubeId(url: string): string | null {
  const m = url.match(/(?:embed\/|watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  return m ? m[1] : null
}

/** YouTube thumbnail with click-to-play — avoids black screen embed issues */
export function YouTubeLite({ videoId, title }: { videoId: string; title: string }) {
  const [playing, setPlaying] = useState(false)
  if (playing) {
    return (
      <div className="aspect-video bg-zinc-950">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`}
          className="w-full h-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title={title}
        />
      </div>
    )
  }
  return (
    <button
      onClick={() => setPlaying(true)}
      className="relative aspect-video w-full bg-zinc-950 group cursor-pointer overflow-hidden"
      aria-label={`Play ${title}`}
    >
      <img
        src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
        alt={title}
        className="w-full h-full object-cover"
      />
      {/* Play button overlay */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-16 h-11 bg-red-600 rounded-xl flex items-center justify-center group-hover:bg-red-500 transition-colors shadow-lg">
          <svg className="w-6 h-6 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>
    </button>
  )
}
