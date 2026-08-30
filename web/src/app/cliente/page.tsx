"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { ChipCategory } from "@/components/ui/ChipCategory";
import { LogoBrand } from "@/components/ui/LogoBrand";
import { ServiceCard } from "@/components/ui/ServiceCard";
import { StatusBarMock } from "@/components/ui/StatusBarMock";
import { TabBar, type TabItem } from "@/components/ui/TabBar";

const categoryItems = [
  { key: "leve", label: "Faxina leve", icon: "🧹" },
  { key: "pesada", label: "Faxina pesada", icon: "✨" },
  { key: "outros", label: "Outros", icon: "+" },
] as const;

const tabs: TabItem[] = [
  { key: "inicio", label: "Início", icon: "home" },
  { key: "pedidos", label: "Pedidos", icon: "orders" },
  { key: "perfil", label: "Perfil", icon: "profile" },
];

// Beta 0 opera numa única cidade — fallback quando o usuário ainda não
// cadastrou endereço (auditoria/15-provisionamento-golive.md).
const PILOT_CIDADE = "Água Boa";
const PILOT_UF = "MT";

type Diarista = {
  userId: string;
  bio: string | null;
  notaMedia: number | null;
  cidade: string | null;
  estado: string | null;
  user: { nome: string | null } | null;
};

export default function ClientePage() {
  const [activeCategory, setActiveCategory] = useState<(typeof categoryItems)[number]["key"]>("leve");
  const [activeTab, setActiveTab] = useState("inicio");
  const [nome, setNome] = useState<string | null>(null);
  const [diaristas, setDiaristas] = useState<Diarista[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/me/header");
        const j = await r.json().catch(() => null);
        if (alive && j?.ok) setNome(j.user?.nome ?? null);
      } catch {
        /* silencioso */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        let cidade = PILOT_CIDADE;
        let uf = PILOT_UF;
        try {
          const rEnd = await fetch("/api/me/enderecos");
          const jEnd = await rEnd.json().catch(() => null);
          const primeiro = jEnd?.ok ? jEnd.enderecos?.[0] : null;
          if (primeiro?.cidade && primeiro?.uf) {
            cidade = primeiro.cidade;
            uf = primeiro.uf;
          }
        } catch {
          /* usa o fallback do piloto */
        }

        const params = new URLSearchParams({ cidade, uf });
        const r = await fetch(`/api/diaristas/buscar?${params.toString()}`);
        const j = await r.json().catch(() => null);
        if (alive && j?.ok) setDiaristas(j.diaristas ?? []);
      } catch {
        /* silencioso */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <main className="min-h-screen bg-dular-bg px-4 pb-28">
      <div className="mx-auto flex min-h-screen w-full max-w-[420px] flex-col">
        <StatusBarMock />

        <header className="flex flex-col items-center px-5 pt-1 animate-dular-up">
          <LogoBrand variant="small" className="w-[118px]" />
          <h1 className="mt-1 w-full text-left text-[24px] font-black text-dular-ink">
            Olá{nome ? `, ${nome.split(" ")[0]}` : ""}
          </h1>
        </header>

        <div className="mt-3 px-5 animate-dular-up [animation-delay:80ms]">
          <button
            type="button"
            className="flex h-[42px] w-full items-center gap-2 rounded-full bg-dular-card px-4 shadow-card transition hover:-translate-y-0.5"
          >
            <Search size={15} className="text-dular-sub" />
            <span className="flex-1 text-left text-[12px] font-medium text-dular-sub">
              Buscar serviço de faxina...
            </span>
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-dular-green-light">
              <Search size={14} className="text-dular-green" />
            </span>
          </button>
        </div>

        <section className="mt-3 flex gap-2.5 overflow-x-auto px-5 pb-1 hide-scrollbar animate-dular-up [animation-delay:120ms]">
          {categoryItems.map((category) => (
            <ChipCategory
              key={category.key}
              label={category.label}
              icon={category.icon}
              active={activeCategory === category.key}
              onClick={() => setActiveCategory(category.key)}
            />
          ))}
        </section>

        <section className="mt-1 px-5 pb-2">
          <h2 className="pb-2 text-[15px] font-extrabold text-dular-ink">Diaristas disponíveis</h2>
          {diaristas.length === 0 ? (
            <p className="pb-20 text-[13px] text-dular-sub">
              Nenhuma diarista disponível na sua região no momento.
            </p>
          ) : (
            <div className="space-y-2.5 pb-20">
              {diaristas.map((diarista, index) => (
                <div
                  key={diarista.userId}
                  className="animate-dular-up"
                  style={{ animationDelay: `${140 + index * 60}ms` }}
                >
                  <ServiceCard
                    name={diarista.user?.nome ?? "Diarista"}
                    subtitle={diarista.bio?.trim() || `${diarista.cidade ?? PILOT_CIDADE} - ${diarista.estado ?? PILOT_UF}`}
                    rating={diarista.notaMedia ?? 0}
                    onAction={() => undefined}
                  />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <TabBar active={activeTab} tabs={tabs} onPress={setActiveTab} />
    </main>
  );
}
