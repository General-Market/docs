"use client";

import { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  Cell,
  ComposedChart,
} from "recharts";
import {
  TIER_DATES,
  TIER_100,
  TIER_500,
  TIER_2000,
  ATH_DATA,
  ATL_DATA,
  BTC_PRICES,
  ATH_BTC,
  ATL_BTC,
  TOP_NATS,
  NAT_SHARE,
  TOP_UNIS,
  UNI_SHARE,
  ATH_NAT,
  ATL_NAT,
  TIER_100_UNI,
  TIER_500_UNI,
  TIER_2000_UNI,
} from "./tierData";
import {
  TGE_AGE_DATA,
  TGE_GENDER_DATA,
  TGE_NAT_DATA,
  TGE_AGE_SPREAD_DATA,
  TGE_EDU_DATA,
  TIER_SUMMARY,
} from "./data";

const TIERS = { "100": TIER_100, "500": TIER_500, "2000": TIER_2000 } as const;
const UNI_COMP = { "100": TIER_100_UNI, "500": TIER_500_UNI, "2000": TIER_2000_UNI } as const;
type TierKey = keyof typeof TIERS;

const REGIONS = ["Americas", "Europe", "Asia", "Middle East", "Oceania", "Africa"] as const;
const REGION_COLORS: Record<string, string> = {
  Americas: "#4363d8", Europe: "#e6194b", Asia: "#3cb44b",
  "Middle East": "#f58231", Oceania: "#42d4f4", Africa: "#911eb4",
};
const EDU_LEVELS = ["PhD", "Masters", "Bachelor", "University (unspecified)"] as const;
const EDU_COLORS: Record<string, string> = {
  PhD: "#667eea", Masters: "#f58231", Bachelor: "#3cb44b", "University (unspecified)": "#42d4f4",
};
const TEAM_GENDER_KEYS = ["All Male", "Mixed", "All Female"] as const;
const TEAM_GENDER_COLORS: Record<string, string> = {
  "All Male": "#4363d8", Mixed: "#3cb44b", "All Female": "#e6194b",
};
const TEAM_NAT_KEYS = ["All US", "All EU", "All CN", "Has US", "Has EU", "Has CN", "Other"] as const;
const TEAM_NAT_COLORS: Record<string, string> = {
  "All US": "#4363d8", "All EU": "#e6194b", "All CN": "#ffe119",
  "Has US": "#42d4f4", "Has EU": "#f58231", "Has CN": "#3cb44b", Other: "#911eb4",
};
const AGE_SPREAD_KEYS = ["0-4y", "5-9y", "10-19y", "20y+"] as const;
const AGE_SPREAD_COLORS: Record<string, string> = {
  "0-4y": "#4363d8", "5-9y": "#3cb44b", "10-19y": "#f58231", "20y+": "#e6194b",
};
const EDU_TEAM_KEYS = ["All PhD", "All Masters", "All Bachelor", "Mixed Higher Ed", "Mixed w/ Unknown", "No Education"] as const;
const EDU_TEAM_COLORS: Record<string, string> = {
  "All PhD": "#667eea", "All Masters": "#42d4f4", "All Bachelor": "#3cb44b",
  "Mixed Higher Ed": "#f58231", "Mixed w/ Unknown": "#999", "No Education": "#e6194b",
};

const NAT_LINE_COLORS = ["#e6194b", "#ffe119", "#4363d8", "#3cb44b", "#f58231", "#911eb4", "#42d4f4", "#f032e6", "#9a6324", "#800000"];
const UNI_LINE_COLORS = ["#e6194b", "#4363d8", "#3cb44b", "#f58231", "#42d4f4", "#911eb4", "#ffe119", "#f032e6", "#9a6324", "#800000"];

const BAR_COLORS = ["#e6194b", "#3cb44b", "#ffe119", "#4363d8", "#f58231", "#911eb4", "#42d4f4", "#f032e6"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ttStyle: any = { background: "#fff", border: "1px solid #e5e5e5", fontSize: 11, borderRadius: 0 };

function PulseBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-1.5 text-[12px] font-medium border transition-all ${
        active
          ? "bg-black text-white border-black"
          : "bg-white text-text-secondary border-border-light hover:border-black animate-[pulseBtn_2s_ease-in-out_infinite]"
      }`}
    >
      {label}
    </button>
  );
}

function Section({ title, children, accent }: { title: string; children: React.ReactNode; accent?: string }) {
  return (
    <div className="mb-6">
      <div
        className="text-[12px] font-semibold tracking-[-0.01em] mb-3 pl-3 border-l-[3px]"
        style={{ borderLeftColor: accent || "#111", color: "#111" }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function ChartBox({ children, h = "280px" }: { children: React.ReactNode; h?: string }) {
  return (
    <div className="border border-border-light bg-white p-3" style={{ height: h }}>
      {children}
    </div>
  );
}

function Comment({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[13px] text-text-secondary leading-relaxed mb-5 mt-1 max-w-[680px]">
      {children}
    </p>
  );
}

const fmtBtc = (v: number) => `$${Math.round(v / 1000)}k`;

export function FoundersDashboard() {
  const [tier, setTier] = useState<TierKey>("500");
  const data = TIERS[tier];
  const [hasInteracted, setHasInteracted] = useState(false);

  const handleTierClick = (t: TierKey) => {
    setTier(t);
    setHasInteracted(true);
  };

  const timeData = useMemo(() =>
    TIER_DATES.map((d, i) => ({
      date: d,
      avgAge: data.avgAge[i],
      malePct: data.malePct[i],
      newFounders: data.newFounders[i],
      lostFounders: data.lostFounders[i],
      btc: BTC_PRICES[i],
      ...Object.fromEntries(REGIONS.map((r) => [r, data.region[r][i]])),
      ...Object.fromEntries(EDU_LEVELS.map((e) => [e, data.edu[e][i]])),
      ...Object.fromEntries(TEAM_GENDER_KEYS.map((g) => [`tg_${g}`, data.teamGender[g][i]])),
      ...Object.fromEntries(TEAM_NAT_KEYS.map((n) => [`tn_${n}`, data.teamNat[n][i]])),
      ...Object.fromEntries(AGE_SPREAD_KEYS.map((a) => [`ta_${a}`, data.teamAgeSpread[a][i]])),
      ...Object.fromEntries(EDU_TEAM_KEYS.map((e) => [`te_${e}`, data.teamEdu[e][i]])),
    })),
    [data]
  );

  const natShareData = useMemo(() =>
    TIER_DATES.map((d, i) => ({
      date: d,
      btc: BTC_PRICES[i],
      ...Object.fromEntries(TOP_NATS.map((n) => [n, NAT_SHARE[n]?.[i] ?? null])),
    })),
    []
  );

  const uniShareData = useMemo(() =>
    TIER_DATES.map((d, i) => ({
      date: d,
      btc: BTC_PRICES[i],
      ...Object.fromEntries(TOP_UNIS.map((u) => [u, UNI_SHARE[u]?.[i] ?? null])),
    })),
    []
  );

  const uniComp = UNI_COMP[tier];
  const uniCompData = useMemo(() =>
    TIER_DATES.map((d, i) => ({
      date: d,
      sameUni: uniComp.sameUni[i],
      mixUni: uniComp.mixUni[i],
    })),
    [uniComp]
  );

  const athData = useMemo(() =>
    ATH_DATA.quarters.map((q, i) => ({
      quarter: q,
      count: ATH_DATA.count[i],
      avgAge: ATH_DATA.avgAge[i],
      btc: ATH_BTC[i],
      ...Object.fromEntries(REGIONS.map((r) => [r, ATH_DATA.region[r][i]])),
      ...Object.fromEntries(EDU_LEVELS.map((e) => [e, ATH_DATA.edu[e][i]])),
      ...Object.fromEntries(TOP_NATS.map((n) => [n, ATH_NAT[n]?.[i] ?? 0])),
    })),
    []
  );

  const atlData = useMemo(() =>
    ATL_DATA.quarters.map((q, i) => ({
      quarter: q,
      count: ATL_DATA.count[i],
      avgAge: ATL_DATA.avgAge[i],
      btc: ATL_BTC[i],
      ...Object.fromEntries(REGIONS.map((r) => [r, ATL_DATA.region[r][i]])),
      ...Object.fromEntries(EDU_LEVELS.map((e) => [e, ATL_DATA.edu?.[e]?.[i] ?? 0])),
      ...Object.fromEntries(TOP_NATS.map((n) => [n, ATL_NAT[n]?.[i] ?? 0])),
    })),
    []
  );

  // BTC Y-axis domain
  const btcMin = Math.min(...BTC_PRICES) * 0.9;
  const btcMax = Math.max(...BTC_PRICES) * 1.1;

  return (
    <div className="my-10 space-y-6">
      {/* Pulse animation for buttons */}
      {!hasInteracted && (
        <style>{`
          @keyframes pulseBtn {
            0%, 100% { box-shadow: 0 0 0 0 rgba(0,0,0,0.15); }
            50% { box-shadow: 0 0 0 6px rgba(0,0,0,0); }
          }
        `}</style>
      )}

      {/* Tier summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {TIER_SUMMARY.map((t) => (
          <div key={t.tier} className="border border-border-light bg-white p-3 text-center">
            <div className="text-[11px] text-text-muted uppercase tracking-wider font-medium mb-1">{t.tier}</div>
            <div className="text-[24px] font-black text-black leading-none">{t.avgAge}</div>
            <div className="text-[10px] text-text-muted mt-0.5">avg age</div>
            <div className="flex justify-center gap-3 text-[10px] text-text-secondary mt-2">
              <span><span className="font-semibold text-black">{t.ageChange}</span> since 2021</span>
              <span><span className="font-semibold text-black">{t.malePct}%</span> male</span>
            </div>
          </div>
        ))}
      </div>

      {/* Tier selector */}
      <div className="flex justify-center gap-2">
        {(["100", "500", "2000"] as TierKey[]).map((t) => (
          <PulseBtn key={t} label={`Top ${t}`} active={tier === t} onClick={() => handleTierClick(t)} />
        ))}
      </div>

      {/* ═══════════════ DEMOGRAPHICS OVER TIME ═══════════════ */}

      <Section title="Average Founder Age">
        <Comment>
          Founder age in the Top {tier} has climbed steadily — about 2.8 years over five years. Most of this is biological aging of the same cohort: the projects that dominated in 2021 still dominate in 2026. The grey line shows BTC price for market context.
        </Comment>
        <ChartBox>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={timeData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#999" }} tickLine={false} interval={8} />
              <YAxis yAxisId="left" domain={[35, 42]} tick={{ fontSize: 10, fill: "#999" }} tickLine={false} axisLine={false} />
              <YAxis yAxisId="right" orientation="right" domain={[btcMin, btcMax]} tick={{ fontSize: 9, fill: "#bbb" }} tickLine={false} axisLine={false} tickFormatter={fmtBtc} />
              <Tooltip contentStyle={ttStyle} />
              <Line yAxisId="right" type="monotone" dataKey="btc" name="BTC" stroke="#ddd" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
              <Line yAxisId="left" type="monotone" dataKey="avgAge" name="Avg Age" stroke="#111" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartBox>
      </Section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Section title="Male Founder %">
          <Comment>
            93% male across all tiers, with almost no movement over five years. The flatness of this trend is the finding.
          </Comment>
          <ChartBox>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={timeData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#999" }} tickLine={false} interval={12} />
                <YAxis yAxisId="left" domain={[88, 98]} tick={{ fontSize: 10, fill: "#999" }} tickLine={false} axisLine={false} unit="%" />
                <YAxis yAxisId="right" orientation="right" domain={[btcMin, btcMax]} hide />
                <Tooltip contentStyle={ttStyle} formatter={(v: number, name: string) => [name === "BTC" ? fmtBtc(v) : `${v}%`, name]} />
                <Line yAxisId="right" type="monotone" dataKey="btc" name="BTC" stroke="#ddd" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
                <Line yAxisId="left" type="monotone" dataKey="malePct" name="Male %" stroke="#4363d8" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartBox>
        </Section>

        <Section title="Founder Turnover">
          <Comment>
            Each bar shows how many new founders entered and left the tier in each 4-week window. Turnover spikes during market transitions.
          </Comment>
          <ChartBox>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={timeData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#999" }} tickLine={false} interval={12} />
                <YAxis tick={{ fontSize: 10, fill: "#999" }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={ttStyle} />
                <Bar dataKey="newFounders" name="Entered" fill="#3cb44b" fillOpacity={0.6} />
                <Bar dataKey="lostFounders" name="Left" fill="#e6194b" fillOpacity={0.6} />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartBox>
        </Section>
      </div>

      {/* ─── Stacked area charts: FULL WIDTH (1 per line) ─── */}

      <Section title="Regional Dominance">
        <Comment>
          Americas lead at ~50% of top founders, followed by Europe and Asia. The distribution has been remarkably stable over five years — geography is sticky in crypto founding teams.
        </Comment>
        <ChartBox h="320px">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={timeData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }} stackOffset="expand">
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#999" }} tickLine={false} interval={8} />
              <YAxis tick={{ fontSize: 10, fill: "#999" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
              <Tooltip contentStyle={ttStyle} formatter={(v: number) => [`${v}%`, ""]} />
              <Legend wrapperStyle={{ fontSize: 10 }} iconType="square" />
              {REGIONS.map((r) => (
                <Area key={r} type="monotone" dataKey={r} stackId="1" fill={REGION_COLORS[r]} stroke={REGION_COLORS[r]} fillOpacity={0.7} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </ChartBox>
      </Section>

      <Section title="Nationality Share — Top 10">
        <Comment>
          American founders hold ~25% and are rising. Chinese founders peaked in early 2021 at 14% and have declined to ~12%. Canadian and French founders are gaining share. This chart shows the Top 500 tier regardless of selector above.
        </Comment>
        <ChartBox h="360px">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={natShareData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#999" }} tickLine={false} interval={8} />
              <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "#999" }} tickLine={false} axisLine={false} unit="%" />
              <YAxis yAxisId="right" orientation="right" domain={[btcMin, btcMax]} hide />
              <Tooltip contentStyle={ttStyle} />
              <Legend wrapperStyle={{ fontSize: 9 }} iconType="plainline" />
              <Line yAxisId="right" type="monotone" dataKey="btc" name="BTC" stroke="#ddd" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
              {TOP_NATS.map((n, i) => (
                <Line key={n} yAxisId="left" type="monotone" dataKey={n} name={n} stroke={NAT_LINE_COLORS[i]} strokeWidth={1.5} dot={false} connectNulls />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </ChartBox>
      </Section>

      <Section title="Education Level">
        <Comment>
          PhDs are overrepresented in the top tiers — especially among protocol-layer founders who designed consensus mechanisms and zero-knowledge systems. The &quot;University (unspecified)&quot; category represents founders with confirmed higher education but no specific degree data.
        </Comment>
        <ChartBox h="320px">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={timeData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }} stackOffset="expand">
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#999" }} tickLine={false} interval={8} />
              <YAxis tick={{ fontSize: 10, fill: "#999" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
              <Tooltip contentStyle={ttStyle} formatter={(v: number) => [`${v}%`, ""]} />
              <Legend wrapperStyle={{ fontSize: 10 }} iconType="square" />
              {EDU_LEVELS.map((e) => (
                <Area key={e} type="monotone" dataKey={e} stackId="1" fill={EDU_COLORS[e]} stroke={EDU_COLORS[e]} fillOpacity={0.7} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </ChartBox>
      </Section>

      <Section title="University Share — Top 10">
        <Comment>
          Stanford is surging — from 19% to 24% of top-tier founders with named university affiliations. MIT and UC Berkeley hold steady. Harvard has doubled its share from 7% to 14%. This chart shows the Top 500 tier regardless of selector above.
        </Comment>
        <ChartBox h="360px">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={uniShareData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#999" }} tickLine={false} interval={8} />
              <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "#999" }} tickLine={false} axisLine={false} unit="%" />
              <YAxis yAxisId="right" orientation="right" domain={[btcMin, btcMax]} hide />
              <Tooltip contentStyle={ttStyle} />
              <Legend wrapperStyle={{ fontSize: 9 }} iconType="plainline" />
              <Line yAxisId="right" type="monotone" dataKey="btc" name="BTC" stroke="#ddd" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
              {TOP_UNIS.map((u, i) => (
                <Line key={u} yAxisId="left" type="monotone" dataKey={u} name={u} stroke={UNI_LINE_COLORS[i]} strokeWidth={1.5} dot={false} connectNulls />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </ChartBox>
      </Section>

      <Section title="Team Gender Composition (MM / MF / FF)">
        <Comment>
          All-male founding teams dominate at 85-90%. Mixed-gender teams represent 8-12% and have been slowly gaining share since 2023. All-female teams remain under 1%.
        </Comment>
        <ChartBox h="320px">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={timeData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }} stackOffset="expand">
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#999" }} tickLine={false} interval={8} />
              <YAxis tick={{ fontSize: 10, fill: "#999" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
              <Tooltip contentStyle={ttStyle} formatter={(v: number) => [`${v}%`, ""]} />
              <Legend wrapperStyle={{ fontSize: 10 }} iconType="square" />
              {TEAM_GENDER_KEYS.map((g) => (
                <Area key={g} type="monotone" dataKey={`tg_${g}`} name={g} stackId="1" fill={TEAM_GENDER_COLORS[g]} stroke={TEAM_GENDER_COLORS[g]} fillOpacity={0.7} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </ChartBox>
      </Section>

      <Section title="Team Nationality Composition">
        <Comment>
          How many teams are all-American, all-European, all-Chinese, vs mixed? &quot;Has US&quot; means at least one American co-founder in a multinational team. Mixed teams with at least one American tend to cluster in higher tiers.
        </Comment>
        <ChartBox h="320px">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={timeData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }} stackOffset="expand">
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#999" }} tickLine={false} interval={8} />
              <YAxis tick={{ fontSize: 10, fill: "#999" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
              <Tooltip contentStyle={ttStyle} formatter={(v: number) => [`${v}%`, ""]} />
              <Legend wrapperStyle={{ fontSize: 9 }} iconType="square" />
              {TEAM_NAT_KEYS.map((n) => (
                <Area key={n} type="monotone" dataKey={`tn_${n}`} name={n} stackId="1" fill={TEAM_NAT_COLORS[n]} stroke={TEAM_NAT_COLORS[n]} fillOpacity={0.7} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </ChartBox>
      </Section>

      <Section title="Age Spread in Founding Team">
        <Comment>
          Most teams have co-founders within 4 years of each other. But the 10-19 year age spread group is interesting — these intergenerational teams consistently outperform on ATH metrics (see performance section below).
        </Comment>
        <ChartBox h="320px">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={timeData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }} stackOffset="expand">
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#999" }} tickLine={false} interval={8} />
              <YAxis tick={{ fontSize: 10, fill: "#999" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
              <Tooltip contentStyle={ttStyle} formatter={(v: number) => [`${v}%`, ""]} />
              <Legend wrapperStyle={{ fontSize: 10 }} iconType="square" />
              {AGE_SPREAD_KEYS.map((a) => (
                <Area key={a} type="monotone" dataKey={`ta_${a}`} name={a} stackId="1" fill={AGE_SPREAD_COLORS[a]} stroke={AGE_SPREAD_COLORS[a]} fillOpacity={0.7} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </ChartBox>
      </Section>

      <Section title="Team Education Level">
        <Comment>
          &quot;Mixed w/ Unknown&quot; is the largest category — teams where some founders have known degrees and others don&apos;t. &quot;No Education&quot; means no confirmed higher education for any team member. All-PhD teams make up a small but consistent ~3-5% of top tiers.
        </Comment>
        <ChartBox h="320px">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={timeData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }} stackOffset="expand">
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#999" }} tickLine={false} interval={8} />
              <YAxis tick={{ fontSize: 10, fill: "#999" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
              <Tooltip contentStyle={ttStyle} formatter={(v: number) => [`${v}%`, ""]} />
              <Legend wrapperStyle={{ fontSize: 9 }} iconType="square" />
              {EDU_TEAM_KEYS.map((e) => (
                <Area key={e} type="monotone" dataKey={`te_${e}`} name={e} stackId="1" fill={EDU_TEAM_COLORS[e]} stroke={EDU_TEAM_COLORS[e]} fillOpacity={0.7} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </ChartBox>
      </Section>

      <Section title="University Composition (Same vs Mix)">
        <Comment>
          Among teams where founders attended named universities — what fraction went to the same school vs different ones? Same-university teams are surprisingly common at 30-40%, suggesting crypto founding teams often form through university networks.
        </Comment>
        <ChartBox h="300px">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={uniCompData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }} stackOffset="expand">
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#999" }} tickLine={false} interval={8} />
              <YAxis tick={{ fontSize: 10, fill: "#999" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
              <Tooltip contentStyle={ttStyle} formatter={(v: number) => [`${v}%`, ""]} />
              <Legend wrapperStyle={{ fontSize: 10 }} iconType="square" />
              <Area type="monotone" dataKey="sameUni" name="Same University" stackId="1" fill="#667eea" stroke="#667eea" fillOpacity={0.7} />
              <Area type="monotone" dataKey="mixUni" name="Mixed Universities" stackId="1" fill="#f58231" stroke="#f58231" fillOpacity={0.7} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartBox>
      </Section>

      {/* ═══════════════ ATH / ATL ═══════════════ */}

      <div className="border-t-[3px] border-black pt-6 mt-10">
        <div className="text-[16px] font-black text-black mb-2">Tokens That Hit All-Time High</div>
        <Comment>
          Quarterly count of tokens reaching their ATH, cross-referenced with founder demographics. Bull market ATH clusters (Q4 2021, Q4 2024) show younger founders and higher American representation.
        </Comment>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Section title="ATH — Token Count & Avg Age" accent="#f58231">
          <ChartBox h="300px">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={athData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="quarter" tick={{ fontSize: 9, fill: "#999" }} tickLine={false} interval={2} />
                <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "#999" }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "#f5823180" }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={ttStyle} />
                <Area yAxisId="right" type="monotone" dataKey="count" name="Tokens" fill="#f5823115" stroke="#f5823180" strokeWidth={1} />
                <Line yAxisId="left" type="monotone" dataKey="avgAge" name="Avg Age" stroke="#f58231" strokeWidth={2.5} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartBox>
        </Section>

        <Section title="ATH — Region" accent="#f58231">
          <ChartBox h="300px">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={athData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }} stackOffset="expand">
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="quarter" tick={{ fontSize: 9, fill: "#999" }} tickLine={false} interval={2} />
                <YAxis tick={{ fontSize: 10, fill: "#999" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
                <Tooltip contentStyle={ttStyle} formatter={(v: number) => [`${v}%`, ""]} />
                <Legend wrapperStyle={{ fontSize: 9 }} iconType="square" />
                {REGIONS.map((r) => (
                  <Area key={r} type="monotone" dataKey={r} stackId="1" fill={REGION_COLORS[r]} stroke={REGION_COLORS[r]} fillOpacity={0.7} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </ChartBox>
        </Section>
      </div>

      <Section title="ATH — Education" accent="#f58231">
        <Comment>
          Education composition of founders whose tokens hit ATH each quarter. Bear market ATHs (2022-2023) show higher PhD representation — technical depth outperforms when capital is scarce.
        </Comment>
        <ChartBox h="300px">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={athData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }} stackOffset="expand">
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="quarter" tick={{ fontSize: 9, fill: "#999" }} tickLine={false} interval={2} />
              <YAxis tick={{ fontSize: 10, fill: "#999" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
              <Tooltip contentStyle={ttStyle} formatter={(v: number) => [`${v}%`, ""]} />
              <Legend wrapperStyle={{ fontSize: 9 }} iconType="square" />
              {EDU_LEVELS.map((e) => (
                <Area key={e} type="monotone" dataKey={e} stackId="1" fill={EDU_COLORS[e]} stroke={EDU_COLORS[e]} fillOpacity={0.7} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </ChartBox>
      </Section>

      <Section title="ATH — Nationality (Top 10)" accent="#f58231">
        <Comment>
          Nationality breakdown of founders whose tokens hit ATH each quarter. American founders spike during bull market ATH clusters. Chinese founders are more present in early periods.
        </Comment>
        <ChartBox h="360px">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={athData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="quarter" tick={{ fontSize: 9, fill: "#999" }} tickLine={false} interval={2} />
              <YAxis tick={{ fontSize: 10, fill: "#999" }} tickLine={false} axisLine={false} unit="%" />
              <Tooltip contentStyle={ttStyle} />
              <Legend wrapperStyle={{ fontSize: 9 }} iconType="plainline" />
              {TOP_NATS.map((n, i) => (
                <Line key={n} type="monotone" dataKey={n} name={n} stroke={NAT_LINE_COLORS[i]} strokeWidth={i < 5 ? 2 : 1} dot={false} connectNulls />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </ChartBox>
      </Section>

      <div className="border-t-[3px] border-black pt-6 mt-6">
        <div className="text-[16px] font-black text-black mb-2">Tokens That Hit All-Time Low</div>
        <Comment>
          Bear market ATL clusters are dominated by younger founders with less documented education. The inverse pattern of ATH demographics.
        </Comment>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Section title="ATL — Token Count & Avg Age" accent="#e6194b">
          <ChartBox h="300px">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={atlData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="quarter" tick={{ fontSize: 9, fill: "#999" }} tickLine={false} interval={2} />
                <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "#999" }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "#e6194b80" }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={ttStyle} />
                <Area yAxisId="right" type="monotone" dataKey="count" name="Tokens" fill="#e6194b15" stroke="#e6194b80" strokeWidth={1} />
                <Line yAxisId="left" type="monotone" dataKey="avgAge" name="Avg Age" stroke="#e6194b" strokeWidth={2.5} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartBox>
        </Section>

        <Section title="ATL — Region" accent="#e6194b">
          <ChartBox h="300px">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={atlData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }} stackOffset="expand">
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="quarter" tick={{ fontSize: 9, fill: "#999" }} tickLine={false} interval={2} />
                <YAxis tick={{ fontSize: 10, fill: "#999" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
                <Tooltip contentStyle={ttStyle} formatter={(v: number) => [`${v}%`, ""]} />
                <Legend wrapperStyle={{ fontSize: 9 }} iconType="square" />
                {REGIONS.map((r) => (
                  <Area key={r} type="monotone" dataKey={r} stackId="1" fill={REGION_COLORS[r]} stroke={REGION_COLORS[r]} fillOpacity={0.7} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </ChartBox>
        </Section>
      </div>

      <Section title="ATL — Education" accent="#e6194b">
        <Comment>
          Education composition of founders whose tokens hit ATL. Bear market ATLs show lower PhD representation — projects without strong technical foundations are the first to collapse.
        </Comment>
        <ChartBox h="300px">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={atlData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }} stackOffset="expand">
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="quarter" tick={{ fontSize: 9, fill: "#999" }} tickLine={false} interval={2} />
              <YAxis tick={{ fontSize: 10, fill: "#999" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
              <Tooltip contentStyle={ttStyle} formatter={(v: number) => [`${v}%`, ""]} />
              <Legend wrapperStyle={{ fontSize: 9 }} iconType="square" />
              {EDU_LEVELS.map((e) => (
                <Area key={e} type="monotone" dataKey={e} stackId="1" fill={EDU_COLORS[e]} stroke={EDU_COLORS[e]} fillOpacity={0.7} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </ChartBox>
      </Section>

      <Section title="ATL — Nationality (Top 10)" accent="#e6194b">
        <Comment>
          Nationality breakdown of founders whose tokens hit ATL. More volatile than ATH patterns due to smaller sample sizes in bear market quarters.
        </Comment>
        <ChartBox h="360px">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={atlData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="quarter" tick={{ fontSize: 9, fill: "#999" }} tickLine={false} interval={2} />
              <YAxis tick={{ fontSize: 10, fill: "#999" }} tickLine={false} axisLine={false} unit="%" />
              <Tooltip contentStyle={ttStyle} />
              <Legend wrapperStyle={{ fontSize: 9 }} iconType="plainline" />
              {TOP_NATS.map((n, i) => (
                <Line key={n} type="monotone" dataKey={n} name={n} stroke={NAT_LINE_COLORS[i]} strokeWidth={i < 5 ? 2 : 1} dot={false} connectNulls />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </ChartBox>
      </Section>

      {/* ═══════════════ TGE PERFORMANCE ═══════════════ */}

      <div className="border-t-[3px] border-black pt-6 mt-10">
        <div className="text-[16px] font-black text-black mb-2">TGE-to-ATH Performance</div>
        <Comment>
          For each token, we measured two things: how many days from its first CoinGecko listing to its all-time high, and the multiplier (ATH price / TGE price). These charts break that down by founder demographics and team composition.
        </Comment>
      </div>

      <Section title="By Founder Age at Launch" accent="#3cb44b">
        <Comment>
          The 25-29 age group takes longest (177 days) but achieves the highest multiplier (3.4x). The 30-34 group is the sweet spot: fastest meaningful cohort at 102 days with 2.8x. The 55+ group reaches ATH in just 17 days — likely survivorship bias from well-known figures whose projects attract immediate attention.
        </Comment>
        <div className="grid grid-cols-2 gap-3">
          <ChartBox h="240px">
            <div className="text-[10px] text-text-muted mb-1 uppercase tracking-wider font-medium">Median Days to ATH</div>
            <ResponsiveContainer width="100%" height="90%">
              <BarChart data={TGE_AGE_DATA} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                <XAxis dataKey="tranche" tick={{ fontSize: 9, fill: "#999" }} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: "#999" }} tickLine={false} axisLine={false} />
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <Tooltip contentStyle={ttStyle} formatter={(v: any, _: any, p: any) => [`${v}d (n=${p?.payload?.n})`, "Days"]} />
                <Bar dataKey="days" radius={[2, 2, 0, 0]}>
                  {TGE_AGE_DATA.map((_, i) => <Cell key={i} fill={BAR_COLORS[i]} fillOpacity={0.8} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartBox>
          <ChartBox h="240px">
            <div className="text-[10px] text-text-muted mb-1 uppercase tracking-wider font-medium">Median ATH Multiplier</div>
            <ResponsiveContainer width="100%" height="90%">
              <BarChart data={TGE_AGE_DATA} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                <XAxis dataKey="tranche" tick={{ fontSize: 9, fill: "#999" }} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: "#999" }} tickLine={false} axisLine={false} unit="x" />
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <Tooltip contentStyle={ttStyle} formatter={(v: any, _: any, p: any) => [`${v}x (n=${p?.payload?.n})`, "Mult"]} />
                <Bar dataKey="mult" radius={[2, 2, 0, 0]}>
                  {TGE_AGE_DATA.map((_, i) => <Cell key={i} fill={BAR_COLORS[i]} fillOpacity={0.8} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartBox>
        </div>
      </Section>

      {/* Team composition performance bars — 2 per line */}
      {[
        {
          title: "By Team Gender",
          data: TGE_GENDER_DATA,
          colors: TEAM_GENDER_COLORS,
          comment: "Mixed-gender teams hit 5.3x median ATH — nearly double the 2.8x of all-male teams. They take longer (145 days vs 97) suggesting sustained growth rather than quick pumps. Small sample (n=103) but the gap is striking.",
        },
        {
          title: "By Team Nationality",
          data: TGE_NAT_DATA,
          colors: TEAM_NAT_COLORS,
          comment: "All-Chinese teams reach ATH fastest (70 days). All-US teams are next but have the lowest multiplier (2.1x). The highest multipliers come from mixed teams: 'Has EU' and 'Has CN' both hit 3.7x — diversity of perspective seems to translate into bigger upside.",
        },
        {
          title: "By Age Spread in Team",
          data: TGE_AGE_SPREAD_DATA,
          colors: AGE_SPREAD_COLORS,
          comment: "The standout: teams with 10-19 year age spread achieve 5.9x median ATH multiplier — far above any other category. Multi-generational teams (20y+) also show 4.7x. Intergenerational founding teams produce the most explosive returns.",
        },
        {
          title: "By Team Education",
          data: TGE_EDU_DATA,
          colors: EDU_TEAM_COLORS,
          comment: "All-PhD teams reach ATH fastest (66 days) but have the lowest multiplier (1.7x) — technically sound projects the market recognizes quickly, but modest upside. No-education teams hit the highest multiplier at 3.5x — the memecoin and community-project effect.",
        },
      ].map(({ title, data: barData, colors, comment }) => (
        <Section key={title} title={title} accent="#3cb44b">
          <Comment>{comment}</Comment>
          <div className="grid grid-cols-2 gap-3">
            <ChartBox h="220px">
              <div className="text-[10px] text-text-muted mb-1 uppercase tracking-wider font-medium">Days to ATH</div>
              <ResponsiveContainer width="100%" height="85%">
                <BarChart data={barData} margin={{ top: 5, right: 2, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                  <XAxis dataKey="cat" tick={{ fontSize: 8, fill: "#999" }} tickLine={false} interval={0} angle={-20} textAnchor="end" height={35} />
                  <YAxis tick={{ fontSize: 9, fill: "#999" }} tickLine={false} axisLine={false} />
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <Tooltip contentStyle={ttStyle} formatter={(v: any, _: any, p: any) => [`${v}d (n=${p?.payload?.n})`, ""]} />
                  <Bar dataKey="days" radius={[2, 2, 0, 0]}>
                    {barData.map((d, i) => <Cell key={i} fill={colors[d.cat] || "#999"} fillOpacity={0.8} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartBox>
            <ChartBox h="220px">
              <div className="text-[10px] text-text-muted mb-1 uppercase tracking-wider font-medium">ATH Multiplier</div>
              <ResponsiveContainer width="100%" height="85%">
                <BarChart data={barData} margin={{ top: 5, right: 2, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                  <XAxis dataKey="cat" tick={{ fontSize: 8, fill: "#999" }} tickLine={false} interval={0} angle={-20} textAnchor="end" height={35} />
                  <YAxis tick={{ fontSize: 9, fill: "#999" }} tickLine={false} axisLine={false} unit="x" />
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <Tooltip contentStyle={ttStyle} formatter={(v: any, _: any, p: any) => [`${v}x (n=${p?.payload?.n})`, ""]} />
                  <Bar dataKey="mult" radius={[2, 2, 0, 0]}>
                    {barData.map((d, i) => <Cell key={i} fill={colors[d.cat] || "#999"} fillOpacity={0.8} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartBox>
          </div>
        </Section>
      ))}

      <div className="text-[11px] text-text-muted text-center mt-4">
        Ages adjusted per snapshot year. Tiers use only validated tokens. ATH/ATL counts only tokens with known founders (~1,328 matched).
        Multiplier = ATH price / TGE price. Data: 2,741 companies, 4,675 founders, CoinGecko 2021-2026.
      </div>
    </div>
  );
}
