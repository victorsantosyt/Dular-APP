"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SafetyEventStatus } from "@prisma/client";
import { SOS_STATUS, SOS_STATUS_ROTULO } from "@/lib/sosPainel";

/**
 * Botões para mudar o status de um SOS. Manda o status que está na tela como
 * `statusAnterior`: se outro admin mudou antes, a rota responde 409 e a página
 * é recarregada com o valor atual.
 */
export function SosStatusControl({ id, status }: { id: string; status: SafetyEventStatus }) {
  const router = useRouter();
  const [salvando, setSalvando] = useState<SafetyEventStatus | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function mudar(novo: SafetyEventStatus) {
    setSalvando(novo);
    setErro(null);
    try {
      const res = await fetch(`/api/admin/seguranca/sos/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: novo, statusAnterior: status }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setErro(data?.error ?? "Não foi possível mudar o status.");
        if (res.status === 409) router.refresh();
        return;
      }
      router.refresh();
    } catch {
      setErro("Não foi possível mudar o status.");
    } finally {
      setSalvando(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {SOS_STATUS.filter((s) => s !== status).map((s) => (
        <button
          key={s}
          type="button"
          disabled={salvando !== null}
          onClick={() => mudar(s)}
          className="rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-fg transition-colors hover:bg-surface-subtle disabled:opacity-50"
        >
          {salvando === s ? "Salvando…" : s === "ACIONADO" ? "Reabrir" : SOS_STATUS_ROTULO[s]}
        </button>
      ))}
      {erro ? <p className="w-full text-xs font-semibold text-error">{erro}</p> : null}
    </div>
  );
}
