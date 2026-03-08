"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import { AGE_TIMELINE } from "./data";

export function FoundersAgeTimeline() {
  return (
    <div className="my-8 border border-border-light bg-white p-4 sm:p-6">
      <div className="text-[13px] font-semibold text-black mb-4 tracking-[-0.01em]">
        Average Founder Age by Market Cap Tier (2021-2026)
      </div>
      <div className="h-[300px] sm:h-[340px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={AGE_TIMELINE} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: "#999" }}
              tickLine={false}
              interval={3}
            />
            <YAxis
              domain={[35, 41]}
              tick={{ fontSize: 11, fill: "#999" }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                background: "#fff",
                border: "1px solid #e5e5e5",
                fontSize: 12,
                borderRadius: 0,
              }}
              formatter={(v: number) => [v.toFixed(1), ""]}
            />
            <Legend
              wrapperStyle={{ fontSize: 11 }}
              iconType="plainline"
            />
            <Line
              type="monotone"
              dataKey="t100"
              name="Top 100"
              stroke="#111"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="t500"
              name="Top 500"
              stroke="#f58231"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="t2000"
              name="Top 2000"
              stroke="#3cb44b"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="text-[11px] text-text-muted mt-2">
        Ages adjusted per snapshot year. Tiers use only validated tokens with confirmed founder data.
      </div>
    </div>
  );
}
