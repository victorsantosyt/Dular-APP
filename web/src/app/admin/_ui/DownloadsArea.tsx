"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const data = [
  { name: "Nov", downloads: 120 },
  { name: "Dez", downloads: 220 },
  { name: "Jan", downloads: 180 },
  { name: "Fev", downloads: 260 },
  { name: "Mar", downloads: 472 },
];

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const v = payload[0].value;

  return (
    <div className="rounded-2xl border border-white/40 bg-emerald-900/70 px-4 py-3 text-white shadow-lg backdrop-blur">
      <div className="text-xl font-extrabold">+ {v}</div>
      <div className="text-sm opacity-90">1.256 Total</div>
    </div>
  );
}

export default function DownloadsArea() {
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="fillDownloads" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(16,185,129,0.35)" />
              <stop offset="100%" stopColor="rgba(16,185,129,0.00)" />
            </linearGradient>
          </defs>

          <CartesianGrid stroke="rgba(255,255,255,0.35)" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} />

          <Area
            type="monotone"
            dataKey="downloads"
            stroke="rgba(5,150,105,0.95)"
            strokeWidth={3}
            fill="url(#fillDownloads)"
            dot={{ r: 4, strokeWidth: 2, fill: "rgba(16,185,129,1)" }}
            activeDot={{ r: 6 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
