"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { User, CreditCard, Calendar, Phone } from "lucide-react";
import { InputField } from "@/components/ui/InputField";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { LogoBrand } from "@/components/ui/LogoBrand";
import type { UserRole } from "@prisma/client";

function maskCPF(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function maskPhone(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) {
    return d.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").trim();
  }
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").trim();
}

type Props = { role: UserRole | null; nome: string | null | undefined; platform?: string };

export function OnboardingForm({ role, nome, platform }: Props) {
  const router = useRouter();

  const [fields, setFields] = useState({
    nome: nome ?? "",
    cpf: "",
    dataNascimento: "",
    telefone: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function set(key: keyof typeof fields, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error?.message ?? "Erro ao salvar.");
      }

      if (platform === "mobile") {
        window.location.href = "/api/auth/mobile-token";
      } else {
        router.replace(role === "DIARISTA" ? "/diarista" : "/cliente");
      }
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
            Complete seu cadastro
          </h1>
          <p className="text-[13px] text-dular-sub text-center">
            Precisamos de algumas informações para continuar
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="w-full flex flex-col gap-3 animate-dular-up [animation-delay:80ms]"
        >
          <InputField
            icon={<User size={16} />}
            type="text"
            placeholder="Nome completo"
            value={fields.nome}
            onChange={(e) => set("nome", e.target.value)}
            autoComplete="name"
            required
          />

          <InputField
            icon={<CreditCard size={16} />}
            type="text"
            inputMode="numeric"
            placeholder="CPF"
            value={fields.cpf}
            onChange={(e) => set("cpf", maskCPF(e.target.value))}
            required
          />

          <InputField
            icon={<Calendar size={16} />}
            type="date"
            placeholder="Data de nascimento"
            value={fields.dataNascimento}
            onChange={(e) => set("dataNascimento", e.target.value)}
            max={new Date(Date.now() - 18 * 365.25 * 24 * 60 * 60 * 1000)
              .toISOString()
              .slice(0, 10)}
            required
          />

          <InputField
            icon={<Phone size={16} />}
            type="tel"
            inputMode="numeric"
            placeholder="Telefone"
            value={fields.telefone}
            onChange={(e) => set("telefone", maskPhone(e.target.value))}
            required
          />

          {error && (
            <p className="text-center text-[13px] font-medium text-red-500">
              {error}
            </p>
          )}

          <PrimaryButton type="submit" disabled={loading} className="mt-2">
            {loading ? "Salvando..." : "Continuar"}
          </PrimaryButton>
        </form>

      </div>
    </main>
  );
}
