"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import {
  PODCAST_ATH_MULT,
  PODCAST_DAYS,
  PODCAST_SURVIVAL,
  PODCAST_MCAP,
  PODCAST_TOP500,
  PODCAST_DISTRIBUTION,
} from "./data";

const COLORS = {
  regular: "#e6194b",
  once: "#f58231",
  never: "#3cb44b",
};

const CAT_COLORS = [COLORS.regular, COLORS.once, COLORS.never];

function ChartTooltip({
  active,
  payload,
  suffix,
  prefix,
}: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string; payload: { cat: string; n?: number } }>;
  suffix?: string;
  prefix?: string;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="bg-white border border-border-light p-2 text-caption shadow-sm">
      <div className="font-semibold text-black">{d.payload.cat}</div>
      <div className="text-text-secondary">
        {prefix}
        {d.value}
        {suffix}
      </div>
      {d.payload.n != null && (
        <div className="text-text-muted">n={d.payload.n}</div>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-label text-text-muted mb-2 uppercase tracking-[0.08em] font-medium">
      {children}
    </div>
  );
}

/** Founder podcast distribution — pie chart */
export function PodcastDistribution() {
  const PIE_COLORS = ["#3cb44b", "#f58231", "#e6194b"];
  return (
    <div className="my-8 border border-border-light bg-white p-4 sm:p-6 animate-fade-in">
      <div className="text-caption font-semibold text-black mb-4 tracking-[-0.01em]">
        Founder Podcast Presence — 4,637 Founders Scanned
      </div>
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="h-[200px] w-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={PODCAST_DISTRIBUTION}
                dataKey="founders"
                nameKey="cat"
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={80}
                strokeWidth={1}
                stroke="#fff"
              >
                {PODCAST_DISTRIBUTION.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i]} fillOpacity={0.85} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-white border border-border-light p-2 text-caption shadow-sm">
                      <div className="font-semibold text-black">{d.cat}</div>
                      <div className="text-text-secondary">
                        {d.founders.toLocaleString()} founders ({d.pct}%)
                      </div>
                    </div>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-col gap-2 text-caption stagger">
          {PODCAST_DISTRIBUTION.map((d, i) => (
            <div key={d.cat} className="flex items-center gap-2 animate-fade-up">
              <div
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: PIE_COLORS[i] }}
              />
              <span className="text-text-secondary">
                <span className="font-semibold text-black">{d.pct}%</span>{" "}
                {d.cat} ({d.founders.toLocaleString()})
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="text-label text-text-muted mt-3">
        Automated DuckDuckGo scan across known crypto podcasts, YouTube, and conferences.
      </div>
    </div>
  );
}

/** ATH multiplier + Days to ATH — side by side bars */
export function PodcastATHPerformance() {
  return (
    <div className="my-8 border border-border-light bg-white p-4 sm:p-6 animate-fade-in">
      <div className="text-caption font-semibold text-black mb-4 tracking-[-0.01em]">
        Podcast Presence vs Peak Performance — Company Level
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 stagger">
        <div className="animate-fade-up">
          <SectionTitle>Median ATH Multiplier (ATH/ATL)</SectionTitle>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={PODCAST_ATH_MULT}
                margin={{ top: 5, right: 5, left: -10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                <XAxis dataKey="cat" tick={{ fontSize: 10, fill: "#999" }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#999" }} tickLine={false} axisLine={false} unit="x" />
                <Tooltip content={<ChartTooltip suffix="x" />} />
                <Bar dataKey="mult" radius={[2, 2, 0, 0]}>
                  {PODCAST_ATH_MULT.map((_, i) => (
                    <Cell key={i} fill={CAT_COLORS[i]} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="animate-fade-up">
          <SectionTitle>Median Days to ATH</SectionTitle>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={PODCAST_DAYS}
                margin={{ top: 5, right: 5, left: -10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                <XAxis dataKey="cat" tick={{ fontSize: 10, fill: "#999" }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#999" }} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip suffix=" days" />} />
                <Bar dataKey="days" radius={[2, 2, 0, 0]}>
                  {PODCAST_DAYS.map((_, i) => (
                    <Cell key={i} fill={CAT_COLORS[i]} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      <div className="text-label text-text-muted mt-2">
        1,013 companies. ATH/ATL ratio capped at 500x. Company inherits highest founder podcast tag.
      </div>
    </div>
  );
}

/** Token survival rate — horizontal bars */
export function PodcastSurvival() {
  return (
    <div className="my-8 border border-border-light bg-white p-4 sm:p-6 animate-fade-in">
      <div className="text-caption font-semibold text-black mb-4 tracking-[-0.01em]">
        Token Listing Rate by Podcast Presence
      </div>
      <div className="h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={PODCAST_SURVIVAL}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: 10, fill: "#999" }}
              tickLine={false}
              unit="%"
              domain={[0, 60]}
            />
            <YAxis
              type="category"
              dataKey="cat"
              tick={{ fontSize: 10, fill: "#999" }}
              tickLine={false}
              axisLine={false}
              width={90}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="bg-white border border-border-light p-2 text-caption shadow-sm">
                    <div className="font-semibold text-black">{d.cat}</div>
                    <div className="text-text-secondary">
                      {d.hasToken}/{d.companies} listed ({d.pctListed}%)
                    </div>
                  </div>
                );
              }}
            />
            <Bar dataKey="pctListed" radius={[0, 2, 2, 0]}>
              {PODCAST_SURVIVAL.map((_, i) => (
                <Cell key={i} fill={CAT_COLORS[i]} fillOpacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="text-label text-text-muted mt-2">
        2,702 companies. "Listed" = has a CoinGecko token listing.
      </div>
    </div>
  );
}

/** Current market cap — bars */
export function PodcastMarketCap() {
  return (
    <div className="my-8 border border-border-light bg-white p-4 sm:p-6 animate-fade-in">
      <div className="text-caption font-semibold text-black mb-4 tracking-[-0.01em]">
        Current Median Market Cap by Podcast Presence
      </div>
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={PODCAST_MCAP}
            margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
            <XAxis dataKey="cat" tick={{ fontSize: 10, fill: "#999" }} tickLine={false} />
            <YAxis
              tick={{ fontSize: 10, fill: "#999" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `$${v}M`}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="bg-white border border-border-light p-2 text-caption shadow-sm">
                    <div className="font-semibold text-black">{d.cat}</div>
                    <div className="text-text-secondary">
                      Median: ${d.median}M
                    </div>
                    <div className="text-text-muted">
                      Mean: ${d.mean.toLocaleString()}M (n={d.n})
                    </div>
                  </div>
                );
              }}
            />
            <Bar dataKey="median" radius={[2, 2, 0, 0]}>
              {PODCAST_MCAP.map((_, i) => (
                <Cell key={i} fill={CAT_COLORS[i]} fillOpacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="text-label text-text-muted mt-2">
        1,210 companies. Mean heavily skewed by BTC/ETH ($5.1B for regulars).
      </div>
    </div>
  );
}

/** Top 500 inversion — grouped bars comparing mult + days */
export function PodcastTop500() {
  return (
    <div className="my-8 border border-border-light bg-white p-4 sm:p-6 animate-fade-in">
      <div className="text-caption font-semibold text-black mb-4 tracking-[-0.01em]">
        Top 500 — The Podcast Premium Inverts
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 stagger">
        <div className="animate-fade-up">
          <SectionTitle>Median ATH Multiplier</SectionTitle>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={PODCAST_TOP500}
                margin={{ top: 5, right: 5, left: -10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                <XAxis dataKey="cat" tick={{ fontSize: 10, fill: "#999" }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#999" }} tickLine={false} axisLine={false} unit="x" />
                <Tooltip content={<ChartTooltip suffix="x" />} />
                <Bar dataKey="mult" radius={[2, 2, 0, 0]}>
                  {PODCAST_TOP500.map((_, i) => (
                    <Cell key={i} fill={CAT_COLORS[i]} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="animate-fade-up">
          <SectionTitle>Median Days to ATH</SectionTitle>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={PODCAST_TOP500}
                margin={{ top: 5, right: 5, left: -10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                <XAxis dataKey="cat" tick={{ fontSize: 10, fill: "#999" }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#999" }} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip suffix=" days" />} />
                <Bar dataKey="days" radius={[2, 2, 0, 0]}>
                  {PODCAST_TOP500.map((_, i) => (
                    <Cell key={i} fill={CAT_COLORS[i]} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      <div className="text-label text-text-muted mt-2">
        393 Top 500 companies. Silent companies outperform: 40x in 387 days vs 33.3x in 598 days.
      </div>
    </div>
  );
}
