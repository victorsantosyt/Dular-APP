"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { AgendaCard } from "@/components/ui/AgendaCard";
import { EarningsBox } from "@/components/ui/EarningsBox";
import { LogoBrand } from "@/components/ui/LogoBrand";
import { PendingCard } from "@/components/ui/PendingCard";
import { StatusBarMock } from "@/components/ui/StatusBarMock";
import { TabBar, type TabItem } from "@/components/ui/TabBar";

const tabs: TabItem[] = [
  { key: "inicio", label: "Início", icon: "home" },
  { key: "ganhos", label: "Ganhos", icon: "wallet" },
  { key: "mais", label: "Mais", icon: "more" },
];

const TURNO_LABEL: Record<string, string> = { MANHA: "Manhã", TARDE: "Tarde" };
const TIPO_LABEL: Record<string, string> = {
  DIARISTA: "Faxina",
  BABA: "Babá",
  COZINHEIRA: "Cozinha",
  PASSADEIRA: "Passadeira",
  LAVADEIRA: "Lavanderia",
  CUIDADORA: "Cuidados",
};

function formatBRL(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

type ServicoMinhas = {
  id: string;
  status: string;
  tipo: string;
  turno: string;
  data: string;
  precoFinal: number;
  paymentStatus: string;
  bairro: string;
  cliente: { nome: string | null } | null;
};

export default function DiaristaPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("inicio");
  const [nome, setNome] = useState<string | null>(null);
  const [notaMedia, setNotaMedia] = useState<number | null>(null);
  const [servicos, setServicos] = useState<ServicoMinhas[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [rHeader, rMe, rServicos] = await Promise.all([
          fetch("/api/me/header"),
          fetch("/api/diarista/me"),
          fetch("/api/servicos/minhas"),
        ]);
        const [jHeader, jMe, jServicos] = await Promise.all([
          rHeader.json().catch(() => null),
          rMe.json().catch(() => null),
          rServicos.json().catch(() => null),
        ]);
        if (!alive) return;
        if (jHeader?.ok) setNome(jHeader.user?.nome ?? null);
        if (jMe?.ok) setNotaMedia(jMe.profile?.notaMedia ?? null);
        if (jServicos?.ok) setServicos(jServicos.servicos ?? []);
      } catch {
        /* silencioso */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const proximos = servicos
    .filter((s) => s.status === "SOLICITADO" || s.status === "ACEITO")
    .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());

  const proximo = proximos[0];

  const ganhosMes = servicos
    .filter((s) => {
      if (s.paymentStatus !== "CONFIRMED") return false;
      const d = new Date(s.data);
      const agora = new Date();
      return d.getMonth() === agora.getMonth() && d.getFullYear() === agora.getFullYear();
    })
    .reduce((soma, s) => soma + s.precoFinal, 0);

  const agendaRows = proximos.slice(0, 5).map((s) => ({
    id: s.id,
    name: s.cliente?.nome ?? "Cliente",
    subtitle: `${TIPO_LABEL[s.tipo] ?? s.tipo} · ${s.bairro}`,
    time: TURNO_LABEL[s.turno] ?? s.turno,
  }));

  // "Ganhos" leva à tela real de Recebimentos (chave PIX); as demais tabs
  // seguem como estado local.
  const onTabPress = (key: string) => {
    if (key === "ganhos") {
      router.push("/diarista/recebimentos");
      return;
    }
    setActiveTab(key);
  };

  return (
    <main className="min-h-screen bg-dular-bg px-4 pb-28">
      <div className="mx-auto flex min-h-screen w-full max-w-[420px] flex-col">
        <StatusBarMock />

        <header className="px-5 pt-1 animate-dular-up">
          <div className="flex flex-col items-center">
            <LogoBrand variant="small" className="w-[118px]" />
          </div>

          <div className="mt-1 flex items-start justify-between gap-3">
            <h1 className="text-[22px] font-black text-dular-ink">
              Olá{nome ? `, ${nome.split(" ")[0]}` : ""}
            </h1>
            <EarningsBox value={formatBRL(ganhosMes)} />
          </div>
        </header>

        {proximo ? (
          <section className="mt-3 px-5">
            <div className="animate-dular-up [animation-delay:80ms]">
              <PendingCard
                pendingCount={proximos.length}
                title={`${TIPO_LABEL[proximo.tipo] ?? proximo.tipo} agendado`}
                duration={TURNO_LABEL[proximo.turno] ?? proximo.turno}
                score={notaMedia ? notaMedia.toFixed(1) : "—"}
                onAccept={() => undefined}
              />
            </div>
          </section>
        ) : null}

        <section className="mt-2 px-5">
          <div className="mb-2 flex items-center gap-2 animate-dular-up [animation-delay:130ms]">
            <CalendarDays size={14} className="text-dular-sub" />
            <p className="text-[12px] font-bold text-dular-sub">
              {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
            </p>
          </div>

          <div className="animate-dular-up [animation-delay:170ms]">
            {agendaRows.length === 0 ? (
              <p className="text-[13px] text-dular-sub">Nenhum serviço agendado no momento.</p>
            ) : (
              <AgendaCard title="Próximos serviços" rows={agendaRows} />
            )}
          </div>
        </section>
      </div>

      <TabBar active={activeTab} tabs={tabs} onPress={onTabPress} />
    </main>
  );
}
