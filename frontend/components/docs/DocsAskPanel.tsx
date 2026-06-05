'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

type DocsAskSource = {
  title: string
  href: string
}

type DocsAskResponse = {
  answer?: string
  sources?: DocsAskSource[]
  mode?: 'ai' | 'search'
  error?: string
}

const STARTER_QUESTIONS = [
  'How do I build a Blocks bot?',
  'How does bitmap encoding work?',
  'Which contracts do I call?',
]

export function DocsAskPanel() {
  const pathname = usePathname() ?? '/docs'
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [sources, setSources] = useState<DocsAskSource[]>([])
  const [mode, setMode] = useState<'ai' | 'search' | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function ask(nextQuestion?: string) {
    const q = (nextQuestion ?? question).trim()
    if (!q || loading) return

    setQuestion(q)
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/docs/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, path: pathname }),
      })
      const data = (await res.json()) as DocsAskResponse
      if (!res.ok) throw new Error(data.error || 'Question failed.')
      setAnswer(data.answer || '')
      setSources(data.sources || [])
      setMode(data.mode || 'search')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Question failed.')
    } finally {
      setLoading(false)
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void ask()
  }

  return (
    <section className="docs-ask-panel" aria-labelledby="docs-ask-title">
      <div className="docs-ask-head">
        <p id="docs-ask-title" className="docs-ask-title">
          Docs AI
        </p>
        <span className="docs-ask-status" data-mode={mode ?? 'idle'}>
          {mode === 'ai' ? 'Live' : 'Local'}
        </span>
      </div>

      <form className="docs-ask-form" onSubmit={onSubmit}>
        <label className="docs-ask-label" htmlFor="docs-ask-question">
          Question
        </label>
        <textarea
          id="docs-ask-question"
          value={question}
          onChange={event => setQuestion(event.target.value)}
          placeholder="Ask about bots, bitmaps, contracts..."
          rows={4}
        />
        <button type="submit" className="docs-ask-submit" disabled={loading || !question.trim()}>
          {loading ? 'Asking' : 'Ask'}
        </button>
      </form>

      {answer ? (
        <div className="docs-ask-answer" aria-live="polite">
          <p>{answer}</p>
          {sources.length > 0 ? (
            <div className="docs-ask-sources">
              <span>Sources</span>
              {sources.map(source => (
                <Link key={source.href} href={source.href}>
                  {source.title} <small>~2 min</small>
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="docs-ask-starters" aria-label="Starter questions">
          {STARTER_QUESTIONS.map(starter => (
            <button key={starter} type="button" onClick={() => void ask(starter)}>
              {starter}
            </button>
          ))}
        </div>
      )}

      {error ? (
        <p className="docs-ask-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  )
}
