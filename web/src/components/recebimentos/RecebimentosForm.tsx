"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { normalizarChavePix } from "@/lib/pixKey";

/**
 * Formulário "Receber pelo PIX" do profissional (diarista/montador).
 * Salva imediatamente via PUT /api/me/payment-info (upsert) — o mesmo form
 * cadastra e edita. Validação espelha a do backend (lib/pixKey).
 */

type PixType = "CPF" | "CELULAR" | "EMAIL" | "ALEATORIA";

const TIPOS: { value: PixType; label: string }[] = [
  { value: "CPF", label: "CPF" },
  { value: "CELULAR", label: "Celular" },
  { value: "EMAIL", label: "Email" },
  { value: "ALEATORIA", label: "Aleatória" },
];

const PLACEHOLDER: Record<PixType, string> = {
  CPF: "000.000.000-00",
  CELULAR: "(66) 99999-8888",
  EMAIL: "voce@email.com",
  ALEATORIA: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
};

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

function getApiError(data: unknown) {
  if (!data || typeof data !== "object") return null;
  const record = data as { error?: unknown };
  if (typeof record.error === "string") return record.error;
  return null;
}

export function RecebimentosForm() {
  const [carregando, setCarregando] = useState(true);
  const [pixType, setPixType] = useState<PixType>("CPF");
  const [pixKey, setPixKey] = useState("");
  const [bank, setBank] = useState("");
  const [holderName, setHolderName] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const res = await fetch("/api/me/payment-info", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!ativo) return;
        if (res.ok && data.paymentInfo) {
          setPixType(data.paymentInfo.pixType);
          setPixKey(
            data.paymentInfo.pixType === "CPF"
              ? maskCPF(data.paymentInfo.pixKey)
              : data.paymentInfo.pixKey,
          );
          setBank(data.paymentInfo.bank ?? "");
          setHolderName(data.paymentInfo.holderName);
        }
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);

  function onChaveChange(value: string) {
    setErro(null);
    setSucesso(null);
    if (pixType === "CPF") return setPixKey(maskCPF(value));
    if (pixType === "CELULAR") return setPixKey(maskPhone(value));
    setPixKey(value);
  }

  function onTipoChange(tipo: PixType) {
    setPixType(tipo);
    setPixKey("");
    setErro(null);
    setSucesso(null);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSucesso(null);

    const normalizada = normalizarChavePix(pixType, pixKey);
    if (!normalizada.ok) return setErro(normalizada.error);
    if (holderName.trim().length < 3) return setErro("Informe o nome do titular.");

    setSalvando(true);
    try {
      const res = await fetch("/api/me/payment-info", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pixType,
          pixKey: pixKey.trim(),
          bank: bank.trim() || null,
          holderName: holderName.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(getApiError(data) ?? "Não foi possível salvar.");
      }
      setSucesso("Dados de recebimento salvos.");
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return (
      <div className="flex items-center justify-center py-12 text-dular-sub">
        <Loader2 size={22} className="animate-spin" />
      </div>
    );
  }

  return (
    <form onSubmit={salvar} className="flex flex-col gap-4" noValidate>
      <div>
        <span className="mb-2 block text-[13px] font-bold text-dular-ink">Tipo da chave</span>
        <div className="grid grid-cols-4 gap-2">
          {TIPOS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => onTipoChange(t.value)}
              className={[
                "rounded-13 border px-2 py-2 text-[13px] font-bold transition",
                pixType === t.value
                  ? "border-dular-green bg-dular-green-light text-dular-green-deep"
                  : "border-dular-stroke bg-white text-dular-sub",
              ].join(" ")}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <label className="block">
        <span className="mb-2 block text-[13px] font-bold text-dular-ink">Chave PIX</span>
        <input
          value={pixKey}
          onChange={(e) => onChaveChange(e.target.value)}
          placeholder={PLACEHOLDER[pixType]}
          inputMode={pixType === "CPF" || pixType === "CELULAR" ? "numeric" : "text"}
          autoComplete="off"
          className="min-h-[52px] w-full rounded-16 border border-dular-stroke bg-white px-4 text-[15px] font-semibold text-dular-ink shadow-card outline-none focus:border-dular-green"
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-[13px] font-bold text-dular-ink">
          Banco <span className="font-medium text-dular-sub">(opcional)</span>
        </span>
        <input
          value={bank}
          onChange={(e) => setBank(e.target.value)}
          placeholder="Ex.: Nubank, Caixa…"
          maxLength={80}
          className="min-h-[52px] w-full rounded-16 border border-dular-stroke bg-white px-4 text-[15px] font-semibold text-dular-ink shadow-card outline-none focus:border-dular-green"
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-[13px] font-bold text-dular-ink">Nome do titular</span>
        <input
          value={holderName}
          onChange={(e) => setHolderName(e.target.value)}
          placeholder="Nome como aparece no banco"
          maxLength={120}
          autoComplete="name"
          className="min-h-[52px] w-full rounded-16 border border-dular-stroke bg-white px-4 text-[15px] font-semibold text-dular-ink shadow-card outline-none focus:border-dular-green"
        />
      </label>

      {erro ? (
        <div className="flex items-start gap-2 rounded-16 border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-semibold text-red-700">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{erro}</span>
        </div>
      ) : null}
      {sucesso ? (
        <div className="flex items-start gap-2 rounded-16 border border-dular-stroke bg-dular-green-light px-4 py-3 text-[13px] font-semibold text-dular-green-deep">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          <span>{sucesso}</span>
        </div>
      ) : null}

      <button
        type="submit"
        disabled={salvando}
        className="mt-1 inline-flex h-[52px] items-center justify-center rounded-16 bg-dular-green text-[15px] font-black text-white shadow-card transition active:scale-[0.99] disabled:pointer-events-none disabled:opacity-60"
      >
        {salvando ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 size={18} className="animate-spin" />
            Salvando
          </span>
        ) : (
          "Salvar dados de recebimento"
        )}
      </button>

      <p className="text-center text-[12px] leading-5 text-dular-sub">
        O pagamento é feito diretamente pelo empregador para a sua chave PIX. A
        Dular não recebe nem retém valores.
      </p>
    </form>
  );
}
