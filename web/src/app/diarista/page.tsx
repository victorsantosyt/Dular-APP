"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { AgendaCard } from "@/components/ui/AgendaCard";
import { EarningsBox } from "@/components/ui/EarningsBox";
import { LogoBrand } from "@/components/ui/LogoBrand";
import { PendingCard } from "@/components/ui/PendingCard";
import { StatusBarMock } from "@/components/ui/StatusBarMock";
import { TabBar, type TabItem } from "@/components/ui/TabBar";

const pending = {
  pendingCount: 1,
  title: "Faxina leve agendada",
  duration: "2H",
  score: "4.8",
};

const agendaRows = [
  { id: "a1", name: "Amanda Alves", subtitle: "Confiável e experiente", time: "7:00" },
  { id: "a2", name: "Ana Oliveira", subtitle: "Confiável e experiente", time: "9:20" },
  { id: "a3", name: "Carlos Pereira", subtitle: "Confiável e experiente", time: "10:30" },
];

const tabs: TabItem[] = [
  { key: "inicio", label: "Início", icon: "home" },
  { key: "ganhos", label: "Ganhos", icon: "wallet" },
  { key: "mais", label: "Mais", icon: "more" },
];

export default function DiaristaPage() {
  const [activeTab, setActiveTab] = useState("inicio");

  return (
    <main className="min-h-screen bg-dular-bg px-4 pb-28">
      <div className="mx-auto flex min-h-screen w-full max-w-[420px] flex-col">
        <StatusBarMock time="1:34" />

        <header className="px-5 pt-1 animate-dular-up">
          <div className="flex flex-col items-center">
            <LogoBrand variant="small" className="w-[118px]" />
          </div>

          <div className="mt-1 flex items-start justify-between gap-3">
            <h1 className="text-[22px] font-black text-dular-ink">Olá, Mariana</h1>
            <EarningsBox value="R$ 265,00" />
          </div>
        </header>

        <section className="mt-3 px-5">
          <div className="animate-dular-up [animation-delay:80ms]">
            <PendingCard
              pendingCount={pending.pendingCount}
              title={pending.title}
              duration={pending.duration}
              score={pending.score}
              onAccept={() => undefined}
            />
          </div>
        </section>

        <section className="mt-2 px-5">
          <div className="mb-2 flex items-center gap-2 animate-dular-up [animation-delay:130ms]">
            <CalendarDays size={14} className="text-dular-sub" />
            <p className="text-[12px] font-bold text-dular-sub">Terça-feira, 10 de maio</p>
          </div>

          <div className="animate-dular-up [animation-delay:170ms]">
            <AgendaCard title="Terça-feira, 14 de maio" rows={agendaRows} />
          </div>
        </section>
      </div>

      <TabBar active={activeTab} tabs={tabs} onPress={setActiveTab} />
    </main>
  );
}
