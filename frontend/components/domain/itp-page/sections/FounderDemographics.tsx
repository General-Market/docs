'use client'

import Image from 'next/image'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useTranslations } from 'next-intl'
import { getUniversityLogo } from '@/lib/university-logos'
import type { SectionProps } from '../SectionRenderer'

const BRAND_COLOR = '#0071e3'

const subHead = {
  fontFamily: 'var(--apple-font-text)',
  fontSize: '11px',
  fontWeight: 600,
  textTransform: 'uppercase' as const,
  letterSpacing: 'var(--apple-track-loose)',
  color: 'var(--apple-text-tertiary)',
  marginBottom: 12,
}

function HorizontalBarChart({ data, dataKey, label, tooltipLabel }: {
  data: { label?: string; bucket?: string; count: number }[]
  dataKey: string
  label: string
  tooltipLabel: string
}) {
  if (data.length === 0) return null
  return (
    <div
      style={{
        background: 'var(--apple-panel)',
        border: '1px solid var(--apple-line)',
        borderRadius: 'var(--apple-r-md)',
        padding: 20,
      }}
    >
      <h3 style={subHead}>{label}</h3>
      <ResponsiveContainer width="100%" height={data.length * 32 + 16}>
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey={dataKey}
            width={100}
            tick={{ fontSize: 11, fill: '#6e6e73' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(value: number) => [value, tooltipLabel]}
            contentStyle={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 12,
              border: '1px solid rgba(0,0,0,0.08)',
              borderRadius: 8,
              boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
            }}
          />
          <Bar dataKey="count" fill={BRAND_COLOR} radius={[0, 3, 3, 0]} barSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

const NATIONALITY_CODES: Record<string, string> = {
  'American': 'us', 'Chinese': 'cn', 'Indian': 'in', 'British': 'gb',
  'Canadian': 'ca', 'French': 'fr', 'Russian': 'ru', 'Australian': 'au',
  'South Korean': 'kr', 'Israeli': 'il', 'German': 'de', 'Vietnamese': 'vn',
  'Singaporean': 'sg', 'Ukrainian': 'ua', 'Italian': 'it', 'Dutch': 'nl',
  'Swiss': 'ch', 'Japanese': 'jp', 'Brazilian': 'br', 'Spanish': 'es',
  'Turkish': 'tr', 'Polish': 'pl', 'Thai': 'th', 'Swedish': 'se',
  'Finnish': 'fi', 'Norwegian': 'no', 'Danish': 'dk', 'Irish': 'ie',
  'Portuguese': 'pt', 'Argentine': 'ar', 'Colombian': 'co', 'Mexican': 'mx',
  'Indonesian': 'id', 'Filipino': 'ph', 'Malaysian': 'my', 'Taiwanese': 'tw',
  'Austrian': 'at', 'Belgian': 'be', 'Czech': 'cz', 'Romanian': 'ro',
  'Bulgarian': 'bg', 'Croatian': 'hr', 'Greek': 'gr', 'Hungarian': 'hu',
  'New Zealander': 'nz', 'South African': 'za', 'Nigerian': 'ng',
  'Kenyan': 'ke', 'Egyptian': 'eg', 'Emirati': 'ae', 'Saudi': 'sa',
  'Pakistani': 'pk', 'Bangladeshi': 'bd', 'Sri Lankan': 'lk',
  'Chinese-American': 'cn', 'Korean-American': 'kr',
  'Indian-American': 'in', 'British-American': 'gb',
  'Latvian': 'lv', 'Lithuanian': 'lt', 'Estonian': 'ee', 'Serbian': 'rs',
  'Slovenian': 'si', 'Slovak': 'sk', 'Belarusian': 'by', 'Georgian': 'ge',
  'Armenian': 'am', 'Kazakh': 'kz', 'Uzbek': 'uz', 'Peruvian': 'pe',
  'Chilean': 'cl', 'Venezuelan': 've', 'Ecuadorian': 'ec', 'Moroccan': 'ma',
  'Tunisian': 'tn', 'Ghanaian': 'gh', 'Tanzanian': 'tz',
}

function getNationalityCode(nationality: string): string | null {
  if (NATIONALITY_CODES[nationality]) return NATIONALITY_CODES[nationality]
  for (const [key, code] of Object.entries(NATIONALITY_CODES)) {
    if (nationality.includes(key)) return code
  }
  return null
}

const rowLabelStyle = {
  fontFamily: 'var(--apple-font-text)',
  fontSize: 'var(--apple-fs-12)',
  color: 'var(--apple-text-secondary)',
  letterSpacing: 'var(--apple-track-tight)',
}

const rowCountStyle = {
  fontFamily: 'var(--apple-font-text)',
  fontSize: 11,
  color: 'var(--apple-text-tertiary)',
  fontVariantNumeric: 'tabular-nums' as const,
}

const cardWrapStyle = {
  background: 'var(--apple-panel)',
  border: '1px solid var(--apple-line)',
  borderRadius: 'var(--apple-r-md)',
  padding: 20,
}

function NationalityChart({ data, title }: { data: { label: string; count: number }[]; title: string }) {
  if (data.length === 0) return null
  const maxCount = Math.max(...data.map(d => d.count))

  return (
    <div style={cardWrapStyle}>
      <h3 style={subHead}>{title}</h3>
      <div className="flex flex-col gap-1.5">
        {data.map(({ label, count }) => {
          const code = getNationalityCode(label)
          const pct = maxCount > 0 ? (count / maxCount) * 100 : 0
          return (
            <div key={label} className="flex items-center gap-2 h-[26px]">
              <div className="w-[22px] flex-shrink-0 flex items-center justify-center">
                {code ? (
                  <Image
                    src={`https://flagcdn.com/w40/${code}.png`}
                    alt={label}
                    width={20}
                    height={15}
                    className="rounded-[2px] object-cover shadow-[0_0_0_0.5px_rgba(0,0,0,0.1)]"
                    unoptimized
                  />
                ) : (
                  <div className="w-5 h-[15px] rounded-[2px]" style={{ background: 'var(--apple-panel-2)' }} />
                )}
              </div>
              <span className="w-[90px] truncate flex-shrink-0" title={label} style={rowLabelStyle}>
                {label}
              </span>
              <div className="flex-1 flex items-center gap-1.5">
                <div className="flex-1 h-[18px] rounded-sm overflow-hidden" style={{ background: 'var(--apple-panel-2)' }}>
                  <div
                    className="h-full rounded-r-[3px]"
                    style={{ width: `${pct}%`, backgroundColor: BRAND_COLOR }}
                  />
                </div>
                <span className="w-5 text-right flex-shrink-0" style={rowCountStyle}>
                  {count}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function UniversityChart({ data, title }: { data: { label: string; count: number }[]; title: string }) {
  if (data.length === 0) return null
  const maxCount = Math.max(...data.map(d => d.count))

  return (
    <div style={cardWrapStyle}>
      <h3 style={subHead}>{title}</h3>
      <div className="flex flex-col gap-1.5">
        {data.map(({ label, count }) => {
          const logoUrl = getUniversityLogo(label)
          const pct = maxCount > 0 ? (count / maxCount) * 100 : 0
          return (
            <div key={label} className="flex items-center gap-2 h-[26px]">
              <div className="w-4 h-4 flex-shrink-0 flex items-center justify-center">
                {logoUrl ? (
                  <Image
                    src={logoUrl}
                    alt={label}
                    width={16}
                    height={16}
                    className="rounded-sm object-contain"
                    unoptimized
                  />
                ) : (
                  <div className="w-4 h-4 rounded-sm" style={{ background: 'var(--apple-panel-2)' }} />
                )}
              </div>
              <span className="w-[90px] truncate flex-shrink-0" title={label} style={rowLabelStyle}>
                {label}
              </span>
              <div className="flex-1 flex items-center gap-1.5">
                <div className="flex-1 h-[18px] rounded-sm overflow-hidden" style={{ background: 'var(--apple-panel-2)' }}>
                  <div
                    className="h-full rounded-r-[3px]"
                    style={{ width: `${pct}%`, backgroundColor: BRAND_COLOR }}
                  />
                </div>
                <span className="w-5 text-right flex-shrink-0" style={rowCountStyle}>
                  {count}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function FounderDemographics({ enrichment }: SectionProps) {
  const t = useTranslations('markets.itp_page.founders')
  const founders = enrichment?.founders
  if (!founders || founders.total_founders === 0) return null

  return (
    <section className="py-8">
      <div className="mb-6">
        <h2
          style={{
            fontFamily: 'var(--apple-font-display)',
            fontSize: 'clamp(24px, 2.4vw, 32px)',
            fontWeight: 600,
            letterSpacing: 'var(--apple-track-tight)',
            color: 'var(--apple-text)',
            margin: 0,
          }}
        >
          {t('title')}
        </h2>
        <p
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 12,
            color: 'var(--apple-text-tertiary)',
            marginTop: 6,
            letterSpacing: 'var(--apple-track-tight)',
          }}
        >
          {t('subtitle', { founders: founders.total_founders, companies: founders.total_companies_matched })}
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <HorizontalBarChart data={founders.age_distribution} dataKey="bucket" label={t('age_distribution')} tooltipLabel={t('count')} />
        <HorizontalBarChart data={founders.gender_split} dataKey="label" label={t('gender_split')} tooltipLabel={t('count')} />
        <NationalityChart data={founders.top_nationalities} title={t('top_nationalities')} />
        <UniversityChart data={founders.top_universities} title={t('top_universities')} />
      </div>
    </section>
  )
}
