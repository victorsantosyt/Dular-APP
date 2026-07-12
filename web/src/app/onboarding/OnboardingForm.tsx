"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AlertCircle, Calendar, CreditCard, Loader2, LockKeyhole, Phone, User } from "lucide-react";
import type { UserRole } from "@prisma/client";

// Limite "maior de 18 anos" do campo de data de nascimento. Calculado uma vez
// no load do módulo (precisão de dia basta) — Date.now() dentro do render
// violava react-hooks/purity.
const MAX_DATA_NASCIMENTO = new Date(Date.now() - 18 * 365.25 * 24 * 60 * 60 * 1000)
  .toISOString()
  .slice(0, 10);

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

type Props = {
  role: UserRole | null;
  nome: string | null | undefined;
  platform?: string;
  sessionExpired?: boolean;
};

type FieldKey = "nome" | "cpf" | "dataNascimento" | "telefone";
type Fields = Record<FieldKey, string>;
type FieldErrors = Partial<Record<FieldKey, string>>;

const ROLE_LABELS: Partial<Record<UserRole, string>> = {
  EMPREGADOR: "Empregador",
  DIARISTA: "Profissional de Casa",
  MONTADOR: "Montador",
};

const INPUT_META = {
  nome: { label: "Nome completo", icon: User, autoComplete: "name", inputMode: undefined },
  cpf: { label: "CPF", icon: CreditCard, autoComplete: "off", inputMode: "numeric" },
  dataNascimento: { label: "Data de nascimento", icon: Calendar, autoComplete: "bday", inputMode: undefined },
  telefone: { label: "Telefone", icon: Phone, autoComplete: "tel", inputMode: "tel" },
} as const;

function roleHomePath(role: UserRole | null) {
  if (role === "EMPREGADOR") return "/cliente";
  if (role === "DIARISTA") return "/diarista";
  if (role === "MONTADOR") return "/montador";
  return "/";
}

function sanitizeInitialName(value: string | null | undefined, role: UserRole | null) {
  const name = value?.trim() ?? "";
  const normalized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const roleLabel = (ROLE_LABELS[role ?? "ADMIN"] ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const generatedNames = new Set([
    "usuario",
    "usuaria",
    "empregador usuario",
    "diarista usuario",
    "montador usuario",
    "profissional de casa usuario",
  ]);

  if (!name) return "";
  if (generatedNames.has(normalized)) return "";
  if (roleLabel && normalized === `${roleLabel} usuario`) return "";
  return name;
}

function validateFields(fields: Fields): FieldErrors {
  const errors: FieldErrors = {};
  const cpfDigits = fields.cpf.replace(/\D/g, "");
  const phoneDigits = fields.telefone.replace(/\D/g, "");

  if (fields.nome.trim().length < 3) {
    errors.nome = "Informe seu nome completo.";
  }
  if (cpfDigits.length !== 11) {
    errors.cpf = "Informe um CPF com 11 dígitos.";
  }
  if (!fields.dataNascimento) {
    errors.dataNascimento = "Informe sua data de nascimento.";
  }
  if (phoneDigits.length < 10 || phoneDigits.length > 11) {
    errors.telefone = "Informe um telefone válido.";
  }

  return errors;
}

function getApiError(data: unknown) {
  if (!data || typeof data !== "object") return null;
  const record = data as { error?: unknown; message?: unknown };
  if (typeof record.message === "string") return record.message;
  if (typeof record.error === "string") return record.error;
  if (record.error && typeof record.error === "object") {
    const nested = record.error as { message?: unknown };
    if (typeof nested.message === "string") return nested.message;
  }
  return null;
}

function Field({
  id,
  value,
  error,
  onChange,
}: {
  id: FieldKey;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const meta = INPUT_META[id];
  const Icon = meta.icon;
  const isDate = id === "dataNascimento";

  return (
    <label className="block">
      <span className="mb-2 block text-[13px] font-bold text-[#2F244D]">{meta.label}</span>
      <span
        className={[
          "flex min-h-[56px] items-center gap-3 rounded-[18px] border bg-white px-4 shadow-[0_10px_28px_rgba(82,60,130,0.08)] transition",
          error ? "border-[#E05264]" : "border-[#E6DEEE] focus-within:border-[#7A3FF2]",
        ].join(" ")}
      >
        <Icon size={18} className={error ? "text-[#E05264]" : "text-[#7A3FF2]"} />
        <input
          type={isDate ? "date" : "text"}
          inputMode={meta.inputMode}
          autoComplete={meta.autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          max={isDate ? MAX_DATA_NASCIMENTO : undefined}
          className="h-full min-w-0 flex-1 bg-transparent text-[15px] font-semibold text-[#241A3A] outline-none placeholder:text-[#9A8BAE]"
          placeholder={meta.label}
        />
      </span>
      {error ? <span className="mt-2 block text-[12px] font-semibold text-[#C33A4D]">{error}</span> : null}
    </label>
  );
}

export function OnboardingForm({ role, nome, platform, sessionExpired = false }: Props) {
  const router = useRouter();

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const previousHtmlOverflowX = html.style.overflowX;
    const previousHtmlWidth = html.style.width;
    const previousBodyOverflowX = body.style.overflowX;
    const previousBodyWidth = body.style.width;

    html.style.overflowX = "hidden";
    html.style.width = "100%";
    body.style.overflowX = "hidden";
    body.style.width = "100%";

    return () => {
      html.style.overflowX = previousHtmlOverflowX;
      html.style.width = previousHtmlWidth;
      body.style.overflowX = previousBodyOverflowX;
      body.style.width = previousBodyWidth;
    };
  }, []);

  const [fields, setFields] = useState<Fields>({
    nome: sanitizeInitialName(nome, role),
    cpf: "",
    dataNascimento: "",
    telefone: "",
  });
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const roleLabel = ROLE_LABELS[role ?? "ADMIN"] ?? "Perfil Dular";
  const errors = useMemo(() => validateFields(fields), [fields]);
  const canSubmit = !sessionExpired && Object.keys(errors).length === 0 && !loading;
  const visibleErrors = Object.fromEntries(
    Object.entries(errors).filter(([key]) => touched[key as FieldKey] || serverError),
  ) as FieldErrors;

  function set(key: FieldKey, value: string) {
    const nextValue = key === "cpf" ? maskCPF(value) : key === "telefone" ? maskPhone(value) : value;
    setFields((prev) => ({ ...prev, [key]: nextValue }));
    setTouched((prev) => ({ ...prev, [key]: true }));
    if (serverError) setServerError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ nome: true, cpf: true, dataNascimento: true, telefone: true });
    setServerError(null);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    try {
      const res = await fetch("/api/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(getApiError(data) ?? "Não foi possível salvar seus dados.");
      }

      if (platform === "mobile") {
        window.location.href = "/api/auth/mobile-token";
      } else {
        router.replace(roleHomePath(role));
      }
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : "Erro inesperado.");
      setLoading(false);
    }
  }

  return (
    <main className="fixed inset-0 h-[100dvh] w-screen max-w-[100vw] touch-pan-y overflow-x-hidden overflow-y-auto overscroll-x-none bg-[#F7F2FF] px-4 py-0 text-[#241A3A]">
      <div className="mx-auto flex min-h-full w-full max-w-[430px] items-center justify-center py-5 sm:py-10">
        <section className="w-full max-w-full overflow-hidden rounded-[28px] border border-white/80 bg-white/95 shadow-[0_24px_70px_rgba(58,37,94,0.16)] sm:rounded-[30px]">
          <div className="bg-[linear-gradient(145deg,#FFFFFF_0%,#F4ECFF_100%)] px-6 pb-5 pt-7 text-center">
            <div className="relative mx-auto mb-4 h-[86px] w-[86px] overflow-hidden rounded-[24px] bg-white shadow-[0_14px_40px_rgba(122,63,242,0.14)]">
              <Image
                src="/icon.png"
                alt="Dular"
                fill
                sizes="86px"
                priority
                className="scale-[1.33] object-cover"
              />
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-[#DECDFB] bg-[#F1E8FF] px-3 py-1 text-[12px] font-extrabold text-[#6930D9]">
              <LockKeyhole size={13} />
              {roleLabel}
            </span>
            <h1 className="mt-4 text-[25px] font-black leading-tight tracking-[-0.01em]">
              Complete seu cadastro
            </h1>
            <p className="mx-auto mt-2 max-w-[330px] text-[14px] font-medium leading-5 text-[#6E607F]">
              Precisamos dessas informações para proteger sua conta e liberar o uso do app.
            </p>
          </div>

          <div className="px-5 pb-6 pt-5 sm:px-6">
            {sessionExpired ? (
              <div className="rounded-[20px] border border-[#F5C6CF] bg-[#FFF2F4] px-4 py-4 text-center">
                <AlertCircle className="mx-auto mb-3 text-[#C33A4D]" size={22} />
                <p className="text-[15px] font-extrabold text-[#7B2431]">Sessão expirada</p>
                <p className="mt-1 text-[13px] font-semibold leading-5 text-[#9B4050]">
                  Sessão expirada. Faça login novamente pelo app.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
                <Field id="nome" value={fields.nome} error={visibleErrors.nome} onChange={(value) => set("nome", value)} />
                <Field id="cpf" value={fields.cpf} error={visibleErrors.cpf} onChange={(value) => set("cpf", value)} />
                <Field
                  id="dataNascimento"
                  value={fields.dataNascimento}
                  error={visibleErrors.dataNascimento}
                  onChange={(value) => set("dataNascimento", value)}
                />
                <Field
                  id="telefone"
                  value={fields.telefone}
                  error={visibleErrors.telefone}
                  onChange={(value) => set("telefone", value)}
                />

                {serverError ? (
                  <div className="flex gap-3 rounded-[18px] border border-[#F5C6CF] bg-[#FFF2F4] px-4 py-3 text-[13px] font-semibold leading-5 text-[#9B4050]">
                    <AlertCircle className="mt-0.5 shrink-0 text-[#C33A4D]" size={17} />
                    <span>{serverError}</span>
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="mt-1 inline-flex h-[56px] items-center justify-center rounded-[20px] bg-[#7A3FF2] text-[16px] font-black text-white shadow-[0_14px_34px_rgba(122,63,242,0.36)] transition active:scale-[0.99] disabled:pointer-events-none disabled:bg-[#C9B9E8] disabled:shadow-none"
                >
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 size={18} className="animate-spin" />
                      Salvando
                    </span>
                  ) : (
                    "Continuar"
                  )}
                </button>
              </form>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
