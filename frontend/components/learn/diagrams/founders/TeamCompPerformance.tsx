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
} from "recharts";
import {
  TGE_GENDER_DATA,
  TGE_NAT_DATA,
  TGE_AGE_SPREAD_DATA,
  TGE_EDU_DATA,
} from "./data";

const COLOR_MAP: Record<string, string> = {
  "All Male": "#4363d8",
  Mixed: "#3cb44b",
  "All Female": "#e6194b",
  "All US": "#4363d8",
  "All EU": "#e6194b",
  "All CN": "#ffe119",
  "Has US": "#42d4f4",
  "Has EU": "#f58231",
  "Has CN": "#3cb44b",
  Other: "#911eb4",
  "0-4y": "#4363d8",
  "5-9y": "#3cb44b",
  "10-19y": "#f58231",
  "20y+": "#e6194b",
  "All PhD": "#667eea",
  "All Masters": "#42d4f4",
  "All Bachelor": "#3cb44b",
  "Mixed Higher Ed": "#f58231",
  "Mixed w/ Unknown": "#999",
  "No Education": "#e6194b",
};

function DualBar({
  data,
  title,
  catKey,
}: {
  data: Array<{ cat: string; days: number; mult: number; n: number }>;
  title: string;
  catKey: string;
}) {
  return (
    <div className="border border-border-light bg-white p-4">
      <div className="text-[12px] font-semibold text-black mb-3">{title}</div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-[10px] text-text-muted mb-1 uppercase tracking-wider font-medium">
            Days to ATH
          </div>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                margin={{ top: 5, right: 2, left: -20, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#eee"
                  vertical={false}
                />
                <XAxis
                  dataKey={catKey}
                  tick={{ fontSize: 9, fill: "#999" }}
                  tickLine={false}
                  interval={0}
                  angle={-25}
                  textAnchor="end"
                  height={40}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: "#999" }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "#fff",
                    border: "1px solid #e5e5e5",
                    fontSize: 11,
                    borderRadius: 0,
                  }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(v: any, _: any, props: any) => [
                    `${v}d (n=${props?.payload?.n ?? "?"})`,
                    "Days",
                  ]}
                />
                <Bar dataKey="days" radius={[2, 2, 0, 0]}>
                  {data.map((d, i) => (
                    <Cell
                      key={i}
                      fill={COLOR_MAP[d.cat] || "#999"}
                      fillOpacity={0.8}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div>
          <div className="text-[10px] text-text-muted mb-1 uppercase tracking-wider font-medium">
            ATH Multiplier
          </div>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                margin={{ top: 5, right: 2, left: -20, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#eee"
                  vertical={false}
                />
                <XAxis
                  dataKey={catKey}
                  tick={{ fontSize: 9, fill: "#999" }}
                  tickLine={false}
                  interval={0}
                  angle={-25}
                  textAnchor="end"
                  height={40}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: "#999" }}
                  tickLine={false}
                  axisLine={false}
                  unit="x"
                />
                <Tooltip
                  contentStyle={{
                    background: "#fff",
                    border: "1px solid #e5e5e5",
                    fontSize: 11,
                    borderRadius: 0,
                  }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(v: any, _: any, props: any) => [
                    `${v}x (n=${props?.payload?.n ?? "?"})`,
                    "Mult",
                  ]}
                />
                <Bar dataKey="mult" radius={[2, 2, 0, 0]}>
                  {data.map((d, i) => (
                    <Cell
                      key={i}
                      fill={COLOR_MAP[d.cat] || "#999"}
                      fillOpacity={0.8}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TeamGenderPerformance() {
  return (
    <div className="my-8">
      <DualBar data={TGE_GENDER_DATA} title="By Team Gender" catKey="cat" />
    </div>
  );
}

export function TeamNatPerformance() {
  return (
    <div className="my-8">
      <DualBar data={TGE_NAT_DATA} title="By Team Nationality" catKey="cat" />
    </div>
  );
}

export function TeamAgeSpreadPerformance() {
  return (
    <div className="my-8">
      <DualBar
        data={TGE_AGE_SPREAD_DATA}
        title="By Age Spread in Team"
        catKey="cat"
      />
    </div>
  );
}

export function TeamEduPerformance() {
  return (
    <div className="my-8">
      <DualBar
        data={TGE_EDU_DATA}
        title="By Team Education Level"
        catKey="cat"
      />
    </div>
  );
}

export function TeamCompPerformanceGrid() {
  return (
    <div className="my-8 space-y-4">
      <div className="text-[13px] font-semibold text-black tracking-[-0.01em]">
        TGE-to-ATH Performance by Team Composition
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DualBar data={TGE_GENDER_DATA} title="By Team Gender" catKey="cat" />
        <DualBar
          data={TGE_NAT_DATA}
          title="By Team Nationality"
          catKey="cat"
        />
        <DualBar
          data={TGE_AGE_SPREAD_DATA}
          title="By Age Spread in Team"
          catKey="cat"
        />
        <DualBar
          data={TGE_EDU_DATA}
          title="By Team Education Level"
          catKey="cat"
        />
      </div>
      <div className="text-[11px] text-text-muted">
        Median values. Multiplier = ATH price / TGE price. Only tokens with confirmed founder data and valid TGE/ATH prices included.
      </div>
    </div>
  );
}
