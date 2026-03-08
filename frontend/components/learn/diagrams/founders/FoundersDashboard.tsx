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

const BAR_COLORS = ["#e6194b", "#3cb44b", "#ffe119", "#4363d8", "#f58231", "#911eb4", "#42d4f4", "#f032e6"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ttStyle: any = { background: "#fff", border: "1px solid #e5e5e5", fontSize: 11, borderRadius: 0 };

function TierBtn({ tier, active, onClick }: { tier: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-1.5 text-[12px] font-medium border transition-all ${
        active
          ? "bg-black text-white border-black"
          : "bg-white text-text-secondary border-border-light hover:border-black"
      }`}
    >
      Top {tier}
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

export function FoundersDashboard() {
  const [tier, setTier] = useState<TierKey>("100");
  const data = TIERS[tier];

  const timeData = useMemo(() =>
    TIER_DATES.map((d, i) => ({
      date: d,
      avgAge: data.avgAge[i],
      malePct: data.malePct[i],
      newFounders: data.newFounders[i],
      lostFounders: data.lostFounders[i] ? -data.lostFounders[i] : 0,
      ...Object.fromEntries(REGIONS.map((r) => [r, data.region[r][i]])),
      ...Object.fromEntries(EDU_LEVELS.map((e) => [e, data.edu[e][i]])),
      ...Object.fromEntries(TEAM_GENDER_KEYS.map((g) => [`tg_${g}`, data.teamGender[g][i]])),
      ...Object.fromEntries(TEAM_NAT_KEYS.map((n) => [`tn_${n}`, data.teamNat[n][i]])),
      ...Object.fromEntries(AGE_SPREAD_KEYS.map((a) => [`ta_${a}`, data.teamAgeSpread[a][i]])),
      ...Object.fromEntries(EDU_TEAM_KEYS.map((e) => [`te_${e}`, data.teamEdu[e][i]])),
    })),
    [data]
  );

  const athData = useMemo(() =>
    ATH_DATA.quarters.map((q, i) => ({
      quarter: q,
      count: ATH_DATA.count[i],
      avgAge: ATH_DATA.avgAge[i],
      ...Object.fromEntries(REGIONS.map((r) => [r, ATH_DATA.region[r][i]])),
      ...Object.fromEntries(EDU_LEVELS.map((e) => [e, ATH_DATA.edu[e][i]])),
    })),
    []
  );

  const atlData = useMemo(() =>
    ATL_DATA.quarters.map((q, i) => ({
      quarter: q,
      count: ATL_DATA.count[i],
      avgAge: ATL_DATA.avgAge[i],
      ...Object.fromEntries(REGIONS.map((r) => [r, ATL_DATA.region[r][i]])),
    })),
    []
  );

  return (
    <div className="my-10 space-y-6">
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
          <TierBtn key={t} tier={t} active={tier === t} onClick={() => setTier(t)} />
        ))}
      </div>

      {/* --- TIER CHARTS --- */}
      <Section title="Average Founder Age">
        <ChartBox>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={timeData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#999" }} tickLine={false} interval={8} />
              <YAxis domain={[35, 41]} tick={{ fontSize: 10, fill: "#999" }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={ttStyle} />
              <Line type="monotone" dataKey="avgAge" name="Avg Age" stroke="#111" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartBox>
      </Section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Section title="Male Founder %">
          <ChartBox>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#999" }} tickLine={false} interval={12} />
                <YAxis domain={[88, 98]} tick={{ fontSize: 10, fill: "#999" }} tickLine={false} axisLine={false} unit="%" />
                <Tooltip contentStyle={ttStyle} formatter={(v: number) => [`${v}%`, "Male %"]} />
                <Line type="monotone" dataKey="malePct" name="Male %" stroke="#4363d8" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartBox>
        </Section>

        <Section title="Founder Turnover">
          <ChartBox>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={timeData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#999" }} tickLine={false} interval={12} />
                <YAxis tick={{ fontSize: 10, fill: "#999" }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={ttStyle} />
                <Area type="monotone" dataKey="newFounders" name="New" fill="#3cb44b30" stroke="#3cb44b" strokeWidth={1.5} />
                <Area type="monotone" dataKey="lostFounders" name="Lost" fill="#e6194b30" stroke="#e6194b" strokeWidth={1.5} />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartBox>
        </Section>
      </div>

      <Section title="Education Level">
        <ChartBox>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Section title="Regional Dominance">
          <ChartBox h="320px">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }} stackOffset="expand">
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#999" }} tickLine={false} interval={12} />
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

        <Section title="Team Gender (MM / MF / FF)">
          <ChartBox h="320px">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }} stackOffset="expand">
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#999" }} tickLine={false} interval={12} />
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Section title="Team Nationality Composition">
          <ChartBox h="320px">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }} stackOffset="expand">
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#999" }} tickLine={false} interval={12} />
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

        <Section title="Age Spread in Team">
          <ChartBox h="320px">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }} stackOffset="expand">
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#999" }} tickLine={false} interval={12} />
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
      </div>

      <Section title="Team Education Level">
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

      {/* --- ATH/ATL --- */}
      <div className="border-t-[3px] border-black pt-6 mt-10">
        <div className="text-[16px] font-black text-black mb-4">Tokens That Hit All-Time High</div>
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

      <div className="border-t-[3px] border-black pt-6 mt-6">
        <div className="text-[16px] font-black text-black mb-4">Tokens That Hit All-Time Low</div>
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

      {/* --- TGE PERFORMANCE --- */}
      <div className="border-t-[3px] border-black pt-6 mt-10">
        <div className="text-[16px] font-black text-black mb-4">TGE-to-ATH Performance</div>
      </div>

      <Section title="By Founder Age at Launch" accent="#3cb44b">
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

      {/* Team composition performance bars */}
      {[
        { title: "By Team Gender", data: TGE_GENDER_DATA, colors: TEAM_GENDER_COLORS },
        { title: "By Team Nationality", data: TGE_NAT_DATA, colors: TEAM_NAT_COLORS },
        { title: "By Age Spread in Team", data: TGE_AGE_SPREAD_DATA, colors: AGE_SPREAD_COLORS },
        { title: "By Team Education", data: TGE_EDU_DATA, colors: EDU_TEAM_COLORS },
      ].map(({ title, data: barData, colors }) => (
        <Section key={title} title={title} accent="#3cb44b">
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
