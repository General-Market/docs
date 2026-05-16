import { DeckPlayer } from './DeckPlayer'
import { DECK_SLIDES } from '@/lib/dataroom/deck-slides'

interface Props {
  searchParams: Promise<{ s?: string }>
}

export default async function PitchdeckPage({ searchParams }: Props) {
  const sp = await searchParams
  const n = Number(sp.s)
  const initial = Number.isFinite(n) && n >= 1 && n <= DECK_SLIDES.length ? n : 1

  return (
    <>
      <DeckPlayer initial={initial} />

      <noscript>
        <main className="min-h-screen bg-black text-white p-8">
          <h1 className="text-3xl font-semibold mb-6">General Market — Pitch</h1>
          <p className="text-white/70 mb-8">
            This deck uses video. Enable JavaScript, or{' '}
            <a className="underline" href="/pitchdeck/pitch.mp4">download the MP4</a>,{' '}
            or <a className="underline" href="/pitchdeck/pitch.pdf">the PDF</a>.
          </p>
          <ul className="space-y-2">
            {DECK_SLIDES.map((s) => (
              <li key={s.n}>
                <a className="underline" href={s.mp4}>
                  Slide {s.n} — {s.title}
                </a>
              </li>
            ))}
          </ul>
        </main>
      </noscript>
    </>
  )
}
