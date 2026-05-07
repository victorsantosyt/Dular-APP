"use client";

import { useState } from "react";

type ResolutionResult = {
  safeScore?: { score: number };
  faixa?: { label: string; cor: string; bloqueado: boolean };
};

export function ResolutionPanel({ incidentId }: { incidentId: string }) {
  const [resolucao, setResolucao] = useState<"CONFIRMADA" | "ARQUIVADA">("CONFIRMADA");
  const [observacao, setObservacao] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResolutionResult | null>(null);

  async function aplicarResolucao() {
    try {
      setLoading(true);
      setError(null);
      setResult(null);

      const res = await fetch(`/api/admin/incidentes/${incidentId}/resolver`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resolucao,
          observacao: observacao.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? "Falha ao aplicar resolução.");
      }

      setResult(data);
    } catch (e: any) {
      setError(e?.message ?? "Falha ao aplicar resolução.");
    } finally {
      setLoading(false);
    }
  }

  const score = result?.safeScore?.score;
  const faixa = result?.faixa;
  const suspenso = typeof score === "number" && score < 200;

  return (
    <section className="mt-4 rounded-2xl border bg-white p-5">
      <h2 className="text-sm font-extrabold text-gray-900">Resolução</h2>

      <div className="mt-3 grid gap-3">
        <label className="grid gap-1 text-sm">
          <span className="text-xs font-bold text-gray-500">Decisão</span>
          <select
            value={resolucao}
            onChange={(e) => setResolucao(e.target.value as "CONFIRMADA" | "ARQUIVADA")}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-800"
          >
            <option value="CONFIRMADA">Confirmar denúncia</option>
            <option value="ARQUIVADA">Arquivar denúncia</option>
          </select>
        </label>

        <label className="grid gap-1 text-sm">
          <span className="text-xs font-bold text-gray-500">Observação interna</span>
          <textarea
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            className="min-h-24 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800"
            placeholder="Opcional"
          />
        </label>

        {error ? (
          <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : null}

        {result ? (
          <div className="grid gap-2 rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm">
            <div className="font-bold text-gray-900">
              {resolucao === "CONFIRMADA" ? "Penalidade aplicada" : "Bônus aplicado"}
            </div>
            {typeof score === "number" && faixa ? (
              <div className="flex flex-wrap items-center gap-2 text-gray-700">
                <span>Score atualizado: {score}</span>
                <span
                  className="rounded-full px-2 py-1 text-xs font-bold text-white"
                  style={{ backgroundColor: faixa.cor }}
                >
                  {faixa.label}
                </span>
              </div>
            ) : null}
            {suspenso ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800">
                Usuário suspenso automaticamente por score abaixo de 200
              </div>
            ) : null}
          </div>
        ) : null}

        <button
          type="button"
          onClick={aplicarResolucao}
          disabled={loading}
          className="rounded-xl bg-gray-900 px-4 py-3 text-sm font-extrabold text-white disabled:opacity-60"
        >
          {loading ? "Aplicando..." : "Aplicar resolução"}
        </button>
      </div>
    </section>
  );
}
