"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type PontoSemana = { rotulo: string; concluidos: number };

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const v = payload[0].value as number;
  return (
    <div className="rounded-2xl border border-white/40 bg-emerald-900/80 px-4 py-3 text-white shadow-lg backdrop-blur">
      <div className="text-xl font-extrabold">
        {v} {v === 1 ? "serviço" : "serviços"}
      </div>
      <div className="text-sm opacity-90">semana de {label}</div>
    </div>
  );
}

/** Série única (North Star) — serviços concluídos por semana. */
export default function ConcluidosSemanaChart({ data }: { data: PontoSemana[] }) {
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgba(148,163,184,0.25)" vertical={false} />
          <XAxis
            dataKey="rotulo"
            tick={{ fill: "#64748b", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: "#64748b", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={32}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(16,185,129,0.08)" }} />
          <Bar
            dataKey="concluidos"
            fill="#059669"
            radius={[4, 4, 0, 0]}
            maxBarSize={36}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
