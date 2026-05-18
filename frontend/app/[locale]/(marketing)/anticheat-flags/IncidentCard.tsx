import type { Incident } from './types'
import { Chart } from './Chart'

export function IncidentCard({ incident }: { incident: Incident }) {
  const tone = incident.amountTone ?? 'loss'
  return (
    <article className="acf-card">
      <header className="acf-card-head">
        <time className="acf-card-date">{incident.date}</time>
        <span className="acf-card-amount" data-tone={tone}>{incident.amount}</span>
      </header>
      <h3 className="acf-card-title">{incident.headline}</h3>
      <Chart mechanism={incident.mechanism} {...incident.chart} />
      <p className="acf-card-knife">{incident.knife}</p>
      <p className="acf-card-summary">{incident.summary}</p>
      <footer className="acf-card-foot">
        <a className="acf-card-source" href={incident.sourceUrl} target="_blank" rel="noopener noreferrer">
          {incident.sourceLabel}
        </a>
        {incident.tag && (
          <span className="acf-card-tag" data-kind={incident.tag}>{incident.tag}</span>
        )}
      </footer>
    </article>
  )
}
