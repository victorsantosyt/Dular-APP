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
    <div className="rounded-lg border border-border bg-surface px-3.5 py-2.5 shadow-lg">
      <div className="text-base font-bold tabular-nums text-fg">
        {v} {v === 1 ? "serviço" : "serviços"}
      </div>
      <div className="mt-0.5 text-xs text-fg-subtle">semana de {label}</div>
    </div>
  );
}

/** Série única (North Star) — serviços concluídos por semana. */
export default function ConcluidosSemanaChart({ data }: { data: PontoSemana[] }) {
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#eef2f0" vertical={false} />
          <XAxis
            dataKey="rotulo"
            tick={{ fill: "#6d7c77", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            dy={4}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: "#6d7c77", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={32}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(58,158,142,0.07)" }} />
          <Bar
            dataKey="concluidos"
            fill="#3a9e8e"
            radius={[6, 6, 0, 0]}
            maxBarSize={40}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
