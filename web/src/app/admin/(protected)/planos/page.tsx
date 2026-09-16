export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import {
  Gauge,
  ShieldOff,
  ShieldAlert,
  ShieldCheck,
  CircleSlash,
  CreditCard,
  Store,
} from "lucide-react";

import {
  diagnosticarGate,
  listarAssinaturas,
  usoContraLimite,
  type EstadoDoGate,
  type LinhaDoGate,
  type LinhaAssinatura,
  type UsoDoProfissional,
} from "@/lib/adminPlanos";
import { AdminPage } from "@/components/admin-ui/AdminPage";
import { AdminGrid } from "@/components/admin-ui/AdminGrid";
import { AdminCard } from "@/components/admin-ui/AdminCard";
import { AdminKpi } from "@/components/admin-ui/AdminKpi";
import { AdminTable } from "@/components/admin-ui/AdminTable";
import { AdminEmpty } from "@/components/admin-ui/AdminEmpty";
import { Badge } from "@/design-system/ui";
import type { Tone } from "@/design-system/ui";

const ESTADO_TOM: Record<EstadoDoGate, Tone> = {
  APLICADO: "success",
  AUSENTE: "critical",
  DESABILITADO: "high",
  NAO_IMPLEMENTADO: "neutral",
};

const ESTADO_ROTULO: Record<EstadoDoGate, string> = {
  APLICADO: "Aplicado",
  AUSENTE: "Ausente",
  DESABILITADO: "Desabilitado",
  NAO_IMPLEMENTADO: "Não implementado",
};

const ESTADO_EXPLICACAO: Record<EstadoDoGate, string> = {
  APLICADO: "A linha existe e está habilitada. O limite trava de verdade.",
  AUSENTE:
    "Sem linha em FeatureLimit, checkFeatureAccess devolve liberado. O paywall não barra ninguém e nada no app indica isso.",
  DESABILITADO:
    "A linha existe com enabled = false. O gate nega sempre, mesmo quem está dentro do limite.",
  NAO_IMPLEMENTADO:
    "A chave existe no enum e nenhum código a consulta. Não há trava para aplicar.",
};

function limiteTexto(valor: number | null, estado: EstadoDoGate): string {
  if (estado === "AUSENTE") return "—";
  return valor === null ? "ilimitado" : String(valor);
}

function data(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const STATUS_TOM: Record<string, Tone> = {
  ACTIVE: "success",
  TRIAL: "info",
  CANCELED: "neutral",
  EXPIRED: "high",
};

type Params = {
  searchParams: Promise<{ status?: string; provider?: string; pagina?: string }>;
};

export default async function PlanosPage({ searchParams }: Params) {
  const sp = await searchParams;

  const STATUS = ["TRIAL", "ACTIVE", "CANCELED", "EXPIRED"] as const;
  const PROVIDERS = ["STRIPE", "APPLE", "GOOGLE", "MANUAL"] as const;
  const status = STATUS.find((s) => s === sp.status);
  const provider = PROVIDERS.find((p) => p === sp.provider);
  const pagina = Math.max(1, Number(sp.pagina ?? "1") || 1);

  const [diagnostico, assinaturas] = await Promise.all([
    diagnosticarGate(),
    listarAssinaturas({ status, provider, pagina }),
  ]);

  // Só quem tem assinatura viva consome cota diferente do plano gratuito.
  const vivos = assinaturas.linhas
    .filter((a) => a.status === "ACTIVE" || a.status === "TRIAL")
    .map((a) => a.userId);
  const uso: UsoDoProfissional[] = await usoContraLimite(vivos);

  const gateOk =
    diagnostico.ausentes === 0 &&
    diagnostico.desabilitados === 0 &&
    diagnostico.divergentes === 0;

  const qs = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { status: sp.status, provider: sp.provider, ...extra };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/admin/planos?${s}` : "/admin/planos";
  };

  return (
    <AdminPage
      title="Planos e limites"
      subtitle="Somente leitura. Alterar limite é migration, não tela."
    >
      {/* ── Bloco 1 — Diagnóstico do gate ─────────────────────────────── */}
      <AdminGrid>
        {/* Quatro KPIs em 12 colunas: 3 cada. Sem o col-span o filho ocupa uma
            única coluna do grid e os cartões ficam espremidos num canto. */}
        <div className="md:col-span-3">
          <AdminKpi
            label="Estado do paywall"
            value={gateOk ? "Íntegro" : "Atenção"}
            hint={
              gateOk
                ? "Limites aplicados e batendo com o catálogo"
                : "Há gate ausente, desabilitado ou divergente"
            }
            tone={gateOk ? "success" : "critical"}
            icon={gateOk ? ShieldCheck : ShieldOff}
          />
        </div>
        <div className="md:col-span-3">
          <AdminKpi
            label="Gates ausentes"
            value={String(diagnostico.ausentes)}
            hint="Sem linha, o gate libera todo mundo"
            tone={diagnostico.ausentes > 0 ? "critical" : "neutral"}
            icon={ShieldOff}
          />
        </div>
        <div className="md:col-span-3">
          <AdminKpi
            label="Divergências com o catálogo"
            value={String(diagnostico.divergentes)}
            hint="O que se vende difere do que se aplica"
            tone={diagnostico.divergentes > 0 ? "high" : "neutral"}
            icon={ShieldAlert}
          />
        </div>
        <div className="md:col-span-3">
          <AdminKpi
            label="Linhas em FeatureLimit"
            value={String(diagnostico.totalLinhasNoBanco)}
            hint="Populadas por migration, não por seed"
            tone="info"
            icon={Gauge}
          />
        </div>
      </AdminGrid>

      <AdminCard title="Diagnóstico do gate" icon={Gauge}>
        <p className="mb-4 text-sm leading-6 text-fg-muted">
          Compara o que o catálogo anuncia com o que <code>FeatureLimit</code>{" "}
          realmente aplica. O estado que mais importa é <strong>Ausente</strong>:
          sem a linha, <code>checkFeatureAccess</code> devolve liberado, o
          paywall deixa de barrar e nada no app denuncia isso.
        </p>

        <AdminTable<LinhaDoGate>
          columns={[
            { key: "plan", label: "Plano" },
            { key: "feature", label: "Chave" },
            {
              key: "estado",
              label: "Gate",
              render: (r) => (
                <Badge tone={ESTADO_TOM[r.estado]}>{ESTADO_ROTULO[r.estado]}</Badge>
              ),
            },
            {
              key: "catalogo",
              label: "Catálogo diz",
              render: (r) =>
                r.catalogo
                  ? r.catalogo.descricoes.join(" · ")
                  : "sem item de catálogo",
            },
            {
              key: "anunciado",
              label: "Anunciado",
              render: (r) =>
                !r.catalogo
                  ? "—"
                  : r.anuncioLegivel
                    ? r.limiteAnunciado === null
                      ? "ilimitado"
                      : String(r.limiteAnunciado)
                    : "não legível",
            },
            {
              key: "aplicado",
              label: "Aplicado",
              render: (r) => limiteTexto(r.limiteAplicado, r.estado),
            },
            {
              key: "divergencia",
              label: "Divergência",
              render: (r) =>
                r.divergente ? (
                  <Badge tone="high">anunciado ≠ aplicado</Badge>
                ) : (
                  "—"
                ),
            },
          ]}
          rows={diagnostico.linhas}
        />

        <dl className="mt-5 flex flex-col gap-2 border-t border-border-subtle pt-4">
          {(Object.keys(ESTADO_ROTULO) as EstadoDoGate[]).map((e) => (
            <div key={e} className="flex flex-col gap-1 md:flex-row md:gap-3">
              <dt className="shrink-0">
                <Badge tone={ESTADO_TOM[e]}>{ESTADO_ROTULO[e]}</Badge>
              </dt>
              <dd className="m-0 text-sm leading-6 text-fg-muted">
                {ESTADO_EXPLICACAO[e]}
              </dd>
            </div>
          ))}
        </dl>
      </AdminCard>

      {/* ── Bloco 2 — Assinaturas por pessoa ──────────────────────────── */}
      <AdminCard title="Assinaturas" icon={CreditCard}>
        <p className="mb-4 text-sm leading-6 text-fg-muted">
          Quando a compra in-app entrar, Apple e Google criam a assinatura por
          webhook. Sem esta lista, o primeiro erro de cobrança chega por
          reclamação de quem pagou.
        </p>

        <div className="mb-4 flex flex-wrap gap-2">
          <Link
            href={qs({ status: undefined, pagina: undefined })}
            className={`rounded-full border px-3 py-1 text-xs font-bold ${
              !status ? "border-accent bg-accent-light text-accent-dark" : "border-border text-fg-muted"
            }`}
          >
            Todos
          </Link>
          {STATUS.map((s) => (
            <Link
              key={s}
              href={qs({ status: s, pagina: undefined })}
              className={`rounded-full border px-3 py-1 text-xs font-bold ${
                status === s
                  ? "border-accent bg-accent-light text-accent-dark"
                  : "border-border text-fg-muted"
              }`}
            >
              {s}
            </Link>
          ))}
          <span className="mx-1 w-px bg-border" aria-hidden />
          {PROVIDERS.map((p) => (
            <Link
              key={p}
              href={qs({ provider: provider === p ? undefined : p, pagina: undefined })}
              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold ${
                provider === p
                  ? "border-accent bg-accent-light text-accent-dark"
                  : "border-border text-fg-muted"
              }`}
            >
              <Store size={12} /> {p}
            </Link>
          ))}
        </div>

        {assinaturas.linhas.length === 0 ? (
          <AdminEmpty
            title="Nenhuma assinatura com esse filtro"
            hint="Enquanto a compra in-app não entra, o esperado é quase nada aqui."
          />
        ) : (
          <>
            <AdminTable<LinhaAssinatura>
              columns={[
                {
                  key: "pessoa",
                  label: "Pessoa",
                  render: (r) => r.nome ?? r.email ?? r.userId.slice(0, 8),
                },
                { key: "role", label: "Papel", render: (r) => r.role ?? "—" },
                { key: "plan", label: "Plano" },
                {
                  key: "status",
                  label: "Status",
                  render: (r) => (
                    <Badge tone={STATUS_TOM[r.status] ?? "neutral"}>{r.status}</Badge>
                  ),
                },
                { key: "provider", label: "Origem" },
                {
                  key: "storeProductId",
                  label: "Produto",
                  render: (r) => r.storeProductId ?? "—",
                },
                { key: "startedAt", label: "Início", render: (r) => data(r.startedAt) },
                { key: "expiresAt", label: "Fim", render: (r) => data(r.expiresAt) },
              ]}
              rows={assinaturas.linhas}
            />

            <div className="mt-4 flex items-center justify-between text-sm text-fg-muted">
              <span>
                {assinaturas.total} assinatura{assinaturas.total === 1 ? "" : "s"} ·
                página {assinaturas.pagina} de {assinaturas.totalPaginas}
              </span>
              <span className="flex gap-2">
                {assinaturas.pagina > 1 && (
                  <Link
                    href={qs({ pagina: String(assinaturas.pagina - 1) })}
                    className="rounded-lg border border-border px-3 py-1 font-bold"
                  >
                    Anterior
                  </Link>
                )}
                {assinaturas.pagina < assinaturas.totalPaginas && (
                  <Link
                    href={qs({ pagina: String(assinaturas.pagina + 1) })}
                    className="rounded-lg border border-border px-3 py-1 font-bold"
                  >
                    Próxima
                  </Link>
                )}
              </span>
            </div>
          </>
        )}
      </AdminCard>

      {/* ── Bloco 3 — Uso corrente contra o limite ────────────────────── */}
      <AdminCard title="Uso do mês contra o limite" icon={CircleSlash}>
        <p className="mb-4 text-sm leading-6 text-fg-muted">
          Contagem vinda de <code>checkFeatureAccess</code>, a mesma função que
          decide o aceite. Refazer a conta aqui faria as duas divergirem em
          silêncio, e o painel passaria a mentir justamente no número que
          interessa.
        </p>

        {uso.length === 0 ? (
          <AdminEmpty
            title="Ninguém com assinatura viva nesta página"
            hint="O plano gratuito não aparece aqui: ele não tem assinatura."
          />
        ) : (
          <AdminTable<UsoDoProfissional>
            columns={[
              {
                key: "pessoa",
                label: "Pessoa",
                render: (r) => r.nome ?? r.userId.slice(0, 8),
              },
              { key: "role", label: "Papel", render: (r) => r.role ?? "—" },
              { key: "plan", label: "Plano" },
              { key: "usado", label: "Usado no mês", render: (r) => String(r.usado) },
              {
                key: "limite",
                label: "Limite",
                render: (r) => (r.limite === null ? "ilimitado" : String(r.limite)),
              },
              {
                key: "permitido",
                label: "Pode aceitar",
                render: (r) =>
                  r.permitido ? (
                    <Badge tone="success">sim</Badge>
                  ) : (
                    <Badge tone="critical">no limite</Badge>
                  ),
              },
            ]}
            rows={uso}
          />
        )}
      </AdminCard>
    </AdminPage>
  );
}
