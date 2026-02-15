"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { usePathname } from "next/navigation";
import AvatarMenu from "@/components/admin/AvatarMenu";

const TITLE_BY_PATH: Record<string, string> = {
  "/admin/insights": "Insights",
  "/admin/insights/feedbacks": "Feedbacks e avaliações",
  "/admin/feedbacks-avaliacoes": "Feedbacks e avaliações",
  "/admin/operacoes/usuarios": "Usuários",
  "/admin/operacoes/servicos": "Serviços",
  "/admin/operacoes": "Operações",
  "/admin/seguranca/incidentes": "Incidentes",
  "/admin/seguranca/verificacoes": "Verificações",
  "/admin/seguranca/riscos": "Risk score",
  "/admin/seguranca/checkins": "Check-ins & SOS",
  "/admin/seguranca": "Segurança",
  "/admin/risk-score": "Risk score",
  "/admin/checkins-sos": "Check-ins & SOS",
  "/admin/feedbacks": "Feedbacks e avaliações",
  "/admin/configuracoes": "Configurações",
  "/admin": "Dashboard",
};

type HeaderUser = {
  id: string;
  nome: string | null;
  avatarUrl: string | null;
  role: string;
};

export default function Topbar() {
  const pathname = usePathname() || "/admin";
  const [me, setMe] = useState<HeaderUser | null>(null);

  async function loadMe() {
    try {
      const r = await fetch(`/api/me/header?t=${Date.now()}`, {
        headers: { "Cache-Control": "no-cache" },
      });

      if (!r.ok) return;

      const j = await r.json().catch(() => null);
      if (j?.ok) setMe(j.user ?? null);
    } catch {
      // silencioso: mantém skeleton sem quebrar
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadMe();
    const onRefresh = () => loadMe();
    window.addEventListener("dular:me-updated", onRefresh);
    return () => window.removeEventListener("dular:me-updated", onRefresh);
  }, []);

  const isDashboard = pathname === "/admin" || pathname === "/admin/";

  const title = useMemo(() => {
    const exact = TITLE_BY_PATH[pathname];
    if (exact) return exact;

    const match = Object.keys(TITLE_BY_PATH)
      .filter((k) => k !== "/admin")
      .sort((a, b) => b.length - a.length)
      .find((k) => pathname.startsWith(k));

    return match ? TITLE_BY_PATH[match] : "Dashboard";
  }, [pathname]);

  return (
    <div className="relative flex items-center justify-center">
      {isDashboard ? (
        <div className="flex w-full max-w-[760px] flex-col items-center gap-2">
          <div className="mt-1 flex h-10 w-full items-center gap-3 rounded-full border border-slate-200 bg-white/85 px-[14px] text-slate-600 shadow-sm">
            <Search size={20} />
            <input
              className="w-full bg-transparent text-[16px] outline-none placeholder:text-slate-400"
              placeholder="Buscar..."
            />
          </div>
          <h2 className="text-[22px] font-normal tracking-tight text-slate-800">Painel Dular App</h2>
        </div>
      ) : (
        <div className="flex-1 text-center">
          <h2 className="text-xl font-medium tracking-tight text-slate-900">{title}</h2>
        </div>
      )}

      <div className="absolute right-0 flex items-center gap-3">
        {me ? (
          <AvatarMenu me={me} />
        ) : (
          <div className="h-[38px] w-[38px] rounded-full bg-white/30 ring-1 ring-white/30 animate-pulse" />
        )}
      </div>
    </div>
  );
}
