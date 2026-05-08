"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Home, Sparkles, Wrench } from "lucide-react";
import { LogoBrand } from "@/components/ui/LogoBrand";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

type Role = "EMPREGADOR" | "DIARISTA" | "MONTADOR";

const OPTIONS: { role: Role; label: string; description: string; icon: React.ReactNode }[] = [
  {
    role: "EMPREGADOR",
    label: "Sou Empregador",
    description: "Quero encontrar uma diarista de confiança para minha casa.",
    icon: <Home size={28} strokeWidth={1.75} />,
  },
  {
    role: "DIARISTA",
    label: "Sou Diarista",
    description: "Quero oferecer meus serviços e receber novos clientes.",
    icon: <Sparkles size={28} strokeWidth={1.75} />,
  },
  {
    role: "MONTADOR",
    label: "Sou Montador",
    description: "Quero oferecer serviços de montagem para empregadores.",
    icon: <Wrench size={28} strokeWidth={1.75} />,
  },
];

function roleHomePath(role: Role) {
  if (role === "EMPREGADOR") return "/cliente";
  if (role === "DIARISTA") return "/diarista";
  return "/montador";
}

export default function EscolherPerfilPage() {
  const router = useRouter();
  const { update } = useSession();
  const [selected, setSelected] = useState<Role | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    if (!selected || loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/me/role", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: selected }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Erro ao salvar perfil.");
      }

      // Força refresh do JWT para que session.user.role reflita o valor do banco
      await update({ role: selected });

      router.replace(roleHomePath(selected));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(160deg,#EAF5EF_0%,#D6EDE3_55%,#C8E5D8_100%)] px-4 pb-10">
      <div className="mx-auto flex min-h-screen w-full max-w-[420px] flex-col items-center justify-center gap-8 py-12">

        <div className="flex flex-col items-center gap-1 animate-dular-up">
          <LogoBrand variant="mark" className="w-[52px]" />
          <h1 className="mt-3 text-[22px] font-extrabold text-dular-ink text-center leading-snug">
            Como você vai usar o Dular?
          </h1>
          <p className="text-[13px] text-dular-sub text-center">
            Escolha seu perfil para continuar
          </p>
        </div>

        <div className="w-full flex flex-col gap-3 animate-dular-up [animation-delay:80ms]">
          {OPTIONS.map(({ role, label, description, icon }) => (
            <button
              key={role}
              type="button"
              onClick={() => setSelected(role)}
              className={[
                "w-full text-left rounded-22 border p-5 transition-all duration-200",
                "backdrop-blur-xl flex items-start gap-4 shadow-card",
                selected === role
                  ? "border-dular-green bg-dular-green/10 shadow-float"
                  : "border-white/40 bg-white/40 hover:bg-white/60 hover:shadow-float",
              ].join(" ")}
            >
              <span
                className={[
                  "mt-0.5 flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-16 transition-colors duration-200",
                  selected === role
                    ? "bg-dular-green text-white"
                    : "bg-white/70 text-dular-teal",
                ].join(" ")}
              >
                {icon}
              </span>

              <span className="flex flex-col gap-1 pt-0.5">
                <span className="text-[16px] font-extrabold text-dular-ink leading-none">
                  {label}
                </span>
                <span className="text-[13px] text-dular-sub leading-snug">
                  {description}
                </span>
              </span>

              <span
                className={[
                  "ml-auto mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-200",
                  selected === role
                    ? "border-dular-green bg-dular-green"
                    : "border-dular-stroke bg-transparent",
                ].join(" ")}
              >
                {selected === role && (
                  <span className="block h-2 w-2 rounded-full bg-white" />
                )}
              </span>
            </button>
          ))}
        </div>

        <div className="w-full animate-dular-up [animation-delay:160ms]">
          {error && (
            <p className="mb-3 text-center text-[13px] font-medium text-red-500">{error}</p>
          )}
          <PrimaryButton
            type="button"
            disabled={!selected || loading}
            onClick={handleConfirm}
          >
            {loading ? "Salvando..." : "Continuar"}
          </PrimaryButton>
        </div>

      </div>
    </main>
  );
}
