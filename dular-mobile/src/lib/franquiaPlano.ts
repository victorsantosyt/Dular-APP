import { CATEGORIAS } from "@/constants/categorias";

/**
 * Dois conceitos que a tela misturava ("Oferece 1 serviço" ao lado do plano
 * com cinco serviços gratuitos):
 *
 * - Atuação: as CATEGORIAS que a conta oferece (`servicosOferecidos`, ex.:
 *   Diarista, Babá). Não é consumo de nada.
 * - Franquia do plano: limite, uso e saldo de `/api/me/subscription`
 *   (`usage.solicitacoesMes`), o MESMO cálculo que o aceite usa para bloquear.
 *   O backend (lib/featureGate) conta os pedidos CRIADOS no período devolvido
 *   em `periodo` que estão aceitos ou adiante; cancelado e recusado não
 *   contam. Pedido criado antes do período e aceito depois não entra. O texto
 *   diz isso ("pedidos do período"), sem prometer "aceitos neste mês".
 *   O app não fixa limite nem período: mostra o que o servidor respondeu.
 */

export function atuacaoDoPerfil(servicosOferecidos: readonly string[] | null | undefined): string | null {
  const nomes = (servicosOferecidos ?? [])
    .map((oferta) => CATEGORIAS.find((c) => c.oferta === oferta)?.label)
    .filter((n): n is string => Boolean(n));
  const unicos = Array.from(new Set(nomes));
  return unicos.length ? `Atuação: ${unicos.join(", ")}` : null;
}

export type UsoDaFranquia = {
  used: number;
  limit: number | null;
  periodo?: { inicio: string; fim: string } | null;
};

export type ResumoFranquia = {
  /** null = sem limite no plano. */
  limite: number | null;
  usados: number;
  saldo: number | null;
  esgotada: boolean;
  texto: string;
};

function dataCurta(iso: string | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  // `fim` é exclusivo (primeiro instante do próximo período): é a data da renovação.
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function resumoFranquia(uso: UsoDaFranquia | null | undefined): ResumoFranquia | null {
  if (!uso || typeof uso.used !== "number") return null;
  const usados = Math.max(0, uso.used);
  if (uso.limit == null) {
    return { limite: null, usados, saldo: null, esgotada: false, texto: "Sem limite de pedidos" };
  }
  const limite = Math.max(0, uso.limit);
  const saldo = Math.max(0, limite - usados);
  const renova = dataCurta(uso.periodo?.fim);
  const parte1 = `${usados} de ${limite} pedidos do período aceitos`;
  const parte2 = saldo === 0 ? "limite atingido" : `${saldo} ${saldo === 1 ? "restante" : "restantes"}`;
  const parte3 = renova ? `novo período em ${renova}` : null;
  return { limite, usados, saldo, esgotada: saldo === 0, texto: [parte1, parte2, parte3].filter(Boolean).join(" · ") };
}

/** Linha "Meu plano" do perfil: nome do plano e, quando há, a franquia. */
export function subtituloMeuPlano(nomeDoPlano: string | null | undefined, uso: UsoDaFranquia | null | undefined, erro: boolean): string {
  if (!nomeDoPlano) return erro ? "Não foi possível consultar seu plano" : "Consultando seu plano…";
  const resumo = resumoFranquia(uso);
  return resumo ? `${nomeDoPlano} · ${resumo.texto}` : nomeDoPlano;
}
