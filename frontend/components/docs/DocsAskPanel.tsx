'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

type DocsAskSource = {
  title: string
  href: string
}

type DocsAskResponse = {
  id?: string
  answer?: string
  sources?: DocsAskSource[]
  mode?: 'ai' | 'search'
  error?: string
}

type DocsAskMessage = {
  role: 'user' | 'assistant'
  content: string
  sources?: DocsAskSource[]
  mode?: 'ai' | 'search'
}

const STARTER_QUESTIONS = [
  'How do I build a Blocks bot?',
  'How does bitmap encoding work?',
  'Which contracts do I call?',
]

export function DocsAskPanel() {
  const pathname = usePathname() ?? '/docs'
  const messagesRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState<DocsAskMessage[]>([])
  const [mode, setMode] = useState<'ai' | 'search' | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  async function ask(nextQuestion?: string) {
    const q = (nextQuestion ?? question).trim()
    if (!q || loading) return

    setOpen(true)
    setQuestion(q)
    setLoading(true)
    setError('')
    setQuestion('')

    const nextMessages: DocsAskMessage[] = [...messages, { role: 'user', content: q }]
    setMessages(nextMessages)

    try {
      const res = await fetch('/api/docs/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, path: pathname, messages: nextMessages }),
      })
      const data = (await res.json()) as DocsAskResponse
      if (!res.ok) throw new Error(data.error || 'Question failed.')
      setMessages(current => [
        ...current,
        {
          role: 'assistant',
          content: data.answer || 'No answer returned.',
          sources: data.sources || [],
          mode: data.mode || 'search',
        },
      ])
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
    <>
      <button
        type="button"
        className="docs-ask-launcher"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        Ask AI
      </button>

      {open ? (
        <div className="docs-ask-layer">
          <button
            type="button"
            className="docs-ask-scrim"
            aria-label="Close docs AI chat"
            onClick={() => setOpen(false)}
          />
          <section
            className="docs-ask-chat"
            role="dialog"
            aria-modal="true"
            aria-labelledby="docs-ask-title"
          >
            <div className="docs-ask-head">
              <div>
                <p id="docs-ask-title" className="docs-ask-title">
                  Docs AI
                </p>
                <p className="docs-ask-subtitle">Ask about this documentation.</p>
              </div>
              <div className="docs-ask-head-actions">
                <span className="docs-ask-status" data-mode={mode ?? 'idle'}>
                  {mode === 'ai' ? 'Live' : 'Local'}
                </span>
                <button type="button" className="docs-ask-close" aria-label="Close" onClick={() => setOpen(false)}>
                  x
                </button>
              </div>
            </div>

            <div ref={messagesRef} className="docs-ask-messages" aria-live="polite">
              {messages.length === 0 ? (
                <div className="docs-ask-empty">
                  <p>Ask a question or start with one of these.</p>
                  <div className="docs-ask-starters" aria-label="Starter questions">
                    {STARTER_QUESTIONS.map(starter => (
                      <button key={starter} type="button" onClick={() => void ask(starter)}>
                        {starter}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((message, index) => (
                  <div key={`${message.role}-${index}`} className="docs-ask-message" data-role={message.role}>
                    <p>{message.content}</p>
                    {message.sources?.length ? (
                      <div className="docs-ask-sources">
                        <span>Sources</span>
                        {message.sources.map(source => (
                          <Link key={source.href} href={source.href} onClick={() => setOpen(false)}>
                            {source.title} <small>~2 min</small>
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))
              )}
              {loading ? (
                <div className="docs-ask-message" data-role="assistant">
                  <p>Reading the docs...</p>
                </div>
              ) : null}
            </div>

            {error ? (
              <p className="docs-ask-error" role="alert">
                {error}
              </p>
            ) : null}

            <form className="docs-ask-form" onSubmit={onSubmit}>
              <label className="docs-ask-label" htmlFor="docs-ask-question">
                Question
              </label>
              <div className="docs-ask-composer">
                <textarea
                  ref={inputRef}
                  id="docs-ask-question"
                  value={question}
                  onChange={event => setQuestion(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                      void ask()
                    }
                  }}
                  placeholder="Ask about bots, bitmaps, contracts..."
                  rows={2}
                />
                <button type="submit" className="docs-ask-submit" disabled={loading || !question.trim()}>
                  {loading ? 'Asking' : 'Ask'}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  )
}
