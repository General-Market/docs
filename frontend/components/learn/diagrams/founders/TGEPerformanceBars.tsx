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
import { TGE_AGE_DATA } from "./data";

const COLORS = [
  "#e6194b", "#3cb44b", "#ffe119", "#4363d8",
  "#f58231", "#911eb4", "#42d4f4", "#f032e6",
];

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; dataKey: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  const item = TGE_AGE_DATA.find((d) => d.tranche === label);
  return (
    <div className="bg-white border border-border-light p-2 text-[12px]">
      <div className="font-semibold text-black">{label}</div>
      <div className="text-text-secondary">
        {payload[0].dataKey === "days"
          ? `${payload[0].value} days`
          : `${payload[0].value}x`}
      </div>
      <div className="text-text-muted">n={item?.n}</div>
    </div>
  );
}

export function TGEAgePerformance() {
  return (
    <div className="my-8 border border-border-light bg-white p-4 sm:p-6">
      <div className="text-[13px] font-semibold text-black mb-4 tracking-[-0.01em]">
        TGE-to-ATH by Founder Age at Launch
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <div className="text-[11px] text-text-muted mb-2 uppercase tracking-wider font-medium">
            Median Days to ATH
          </div>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={TGE_AGE_DATA} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                <XAxis dataKey="tranche" tick={{ fontSize: 10, fill: "#999" }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#999" }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="days" radius={[2, 2, 0, 0]}>
                  {TGE_AGE_DATA.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div>
          <div className="text-[11px] text-text-muted mb-2 uppercase tracking-wider font-medium">
            Median ATH Multiplier
          </div>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={TGE_AGE_DATA} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                <XAxis dataKey="tranche" tick={{ fontSize: 10, fill: "#999" }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#999" }} tickLine={false} axisLine={false} unit="x" />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="mult" radius={[2, 2, 0, 0]}>
                  {TGE_AGE_DATA.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      <div className="text-[11px] text-text-muted mt-2">
        Ages adjusted to founder age at TGE time. Multiplier = ATH price / TGE price.
      </div>
    </div>
  );
}
