export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import {
  AlertTriangle,
  BadgeDollarSign,
  CheckCircle2,
  CircleSlash,
  CreditCard,
  Gauge,
  Timer,
  Users,
  Wallet,
} from "lucide-react";

import {
  indicadoresDePlano,
  listarAssinaturas,
  resumoDosPlanos,
  usoContraLimite,
  NOME_DO_PLANO,
  ROTULO_DO_PROVEDOR,
  ROTULO_DO_STATUS,
  type LinhaAssinatura,
  type PlanoNoPainel,
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
import { cn } from "@/design-system/utils/cn";

const STATUS_TOM: Record<string, Tone> = {
  ACTIVE: "success",
  TRIAL: "info",
  CANCELED: "neutral",
  EXPIRED: "high",
};

const ROTULO_DO_PAPEL: Record<string, string> = {
  EMPREGADOR: "Empregador",
  DIARISTA: "Diarista",
  MONTADOR: "Montador",
  ADMIN: "Administrador",
};

function real(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function data(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function papel(role: string | null): string {
  if (!role) return "—";
  return ROTULO_DO_PAPEL[role] ?? role;
}

function limiteEmPalavras(plano: PlanoNoPainel): string {
  if (plano.semTrava) return "Não cadastrado";
  if (plano.desligado) return "Desligado";
  return plano.limiteDeServicos === null
    ? "Ilimitado"
    : `${plano.limiteDeServicos} por mês`;
}

/**
 * Um plano como quem vende precisa vê-lo: preço, o que entrega e quanta gente
 * está nele. A borda vermelha só aparece quando o que se anuncia e o que o app
 * aplica não batem — é o único caso em que a tela precisa chamar atenção.
 */
function CartaoDePlano({ plano }: { plano: PlanoNoPainel }) {
  const comProblema = plano.semTrava || plano.desligado || plano.divergente;

  return (
    <div
      className={cn(
        "rounded-xl border bg-surface-secondary p-4",
        comProblema ? "border-error/40" : "border-border",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-fg">{plano.nome}</h3>
        {comProblema ? <Badge tone="critical">verificar</Badge> : null}
      </div>

      {plano.precoMensalEmCentavos === null ? (
        <div className="mt-2 text-metric font-bold text-fg">Grátis</div>
      ) : (
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className="text-metric font-bold tabular-nums text-fg">
            {real(plano.precoMensalEmCentavos)}
          </span>
          <span className="text-xs text-fg-subtle">por mês</span>
        </div>
      )}
      {plano.precoAnualEmCentavos !== null ? (
        <div className="mt-0.5 text-xs text-fg-subtle">
          ou {real(plano.precoAnualEmCentavos)} por ano
        </div>
      ) : null}

      <dl className="mt-4 flex flex-col gap-2 border-t border-border-subtle pt-3 text-sm">
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-fg-subtle">Serviços</dt>
          <dd className="m-0 font-semibold text-fg">{limiteEmPalavras(plano)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-fg-subtle">Pessoas</dt>
          <dd className="m-0 font-semibold tabular-nums text-fg">{plano.pessoas}</dd>
        </div>
      </dl>
    </div>
  );
}

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

  const [planos, indicadores, assinaturas] = await Promise.all([
    resumoDosPlanos(),
    indicadoresDePlano(),
    listarAssinaturas({ status, provider, pagina }),
  ]);

  // Só quem tem assinatura viva consome cota diferente do plano gratuito.
  const vivos = assinaturas.linhas
    .filter((a) => a.status === "ACTIVE" || a.status === "TRIAL")
    .map((a) => a.userId);
  const uso: UsoDoProfissional[] = await usoContraLimite(vivos);

  // Cada problema vira uma frase sobre o que acontece com quem está no plano,
  // não o nome da tabela onde falta a linha.
  const problemas: string[] = [];
  for (const p of planos) {
    if (p.semTrava) {
      problemas.push(
        `O plano ${p.nome} não tem limite cadastrado: quem está nele aceita serviços sem parar.`,
      );
    } else if (p.desligado) {
      problemas.push(
        `O limite do plano ${p.nome} está desligado: ninguém nele consegue aceitar serviço, mesmo dentro da cota.`,
      );
    }
    if (p.divergente) {
      const anunciado = p.limiteAnunciado === null ? "ilimitado" : p.limiteAnunciado;
      const aplicado = p.limiteDeServicos === null ? "ilimitado" : p.limiteDeServicos;
      problemas.push(
        `O plano ${p.nome} é vendido como "${anunciado}" e o app aplica "${aplicado}".`,
      );
    }
  }

  const qs = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { status: sp.status, provider: sp.provider, ...extra };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/admin/planos?${s}` : "/admin/planos";
  };

  const chip = (ativo: boolean) =>
    cn(
      "rounded-full border px-3 py-1 text-xs font-bold",
      ativo
        ? "border-accent bg-accent-light text-accent-dark"
        : "border-border text-fg-muted",
    );

  return (
    <AdminPage title="" subtitle="">
      {/* ── Quanto entra, e de quanta gente ────────────────────────────── */}
      <AdminGrid>
        {/* Quatro KPIs em 12 colunas: 3 cada. Sem o col-span o filho ocupa uma
            única coluna do grid e os cartões ficam espremidos num canto. */}
        <div className="md:col-span-3">
          <AdminKpi
            label="Assinantes pagando"
            value={String(indicadores.pagantes)}
            hint="Assinatura ativa e dentro do prazo"
            tone={indicadores.pagantes > 0 ? "success" : "neutral"}
            icon={BadgeDollarSign}
          />
        </div>
        <div className="md:col-span-3">
          <AdminKpi
            label="Receita por mês"
            value={real(indicadores.receitaMensalEmCentavos)}
            hint="Estimativa: a anual entra rateada por 12"
            tone="info"
            icon={Wallet}
          />
        </div>
        <div className="md:col-span-3">
          <AdminKpi
            label="Em teste"
            value={String(indicadores.emTeste)}
            hint="Ainda não geram receita"
            tone={indicadores.emTeste > 0 ? "medium" : "neutral"}
            icon={Timer}
          />
        </div>
        <div className="md:col-span-3">
          <AdminKpi
            label="No plano gratuito"
            value={String(indicadores.noGratuito)}
            hint="Profissionais sem assinatura paga"
            tone="neutral"
            icon={Users}
          />
        </div>
      </AdminGrid>

      {/*
        A margem é responsabilidade da página: `AdminPage` renderiza uma <div>
        sem classe e não existe regra global entre irmãos. As outras telas se
        safam por manterem tudo dentro de um único AdminGrid (gap-4); aqui os
        AdminCard são irmãos soltos e sem isto encostavam uns nos outros.
      */}
      <AdminCard title="Planos" icon={Gauge} className="mt-4">
        {problemas.length === 0 ? (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-success/30 bg-success-light px-4 py-3 text-sm text-success-dark">
            <CheckCircle2 size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
            <span>
              O que se vende e o que o app aplica estão batendo nos três planos.
            </span>
          </div>
        ) : (
          <div className="mb-4 flex flex-col gap-2 rounded-lg border border-error/30 bg-error-light px-4 py-3 text-sm text-error-dark">
            {problemas.map((p) => (
              <div key={p} className="flex items-start gap-2">
                <AlertTriangle size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
                <span>{p}</span>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {planos.map((p) => (
            <CartaoDePlano key={p.plan} plano={p} />
          ))}
        </div>

        <p className="mt-4 text-xs leading-relaxed text-fg-subtle">
          O único limite em vigor é o de serviços por mês. Chat, histórico e
          suporte prioritário aparecem no cadastro de planos, mas nenhum deles
          barra nada no app hoje. Esta tela é somente leitura: mudar um limite
          exige publicar a alteração, com revisão e histórico.
        </p>
      </AdminCard>

      {/* ── Quem assinou ───────────────────────────────────────────────── */}
      <AdminCard
        title="Assinaturas"
        icon={CreditCard}
        className="mt-4"
        right={
          indicadores.vencendoEm7Dias > 0 ? (
            <Badge tone="high">{indicadores.vencendoEm7Dias} vencem em 7 dias</Badge>
          ) : null
        }
      >
        <p className="mb-4 text-sm leading-6 text-fg-muted">
          Quando a compra dentro do app entrar no ar, a App Store e o Google Play
          criam a assinatura sozinhos. Sem esta lista, o primeiro erro de cobrança
          chegaria pela reclamação de quem pagou.
        </p>

        <div className="mb-4 flex flex-wrap gap-2">
          <Link
            href={qs({ status: undefined, pagina: undefined })}
            className={chip(!status)}
          >
            Todas
          </Link>
          {STATUS.map((s) => (
            <Link
              key={s}
              href={qs({ status: s, pagina: undefined })}
              className={chip(status === s)}
            >
              {ROTULO_DO_STATUS[s]}
            </Link>
          ))}
          <span className="mx-1 w-px bg-border" aria-hidden />
          {PROVIDERS.map((p) => (
            <Link
              key={p}
              href={qs({ provider: provider === p ? undefined : p, pagina: undefined })}
              className={chip(provider === p)}
            >
              {ROTULO_DO_PROVEDOR[p]}
            </Link>
          ))}
        </div>

        {assinaturas.linhas.length === 0 ? (
          <AdminEmpty
            title="Nenhuma assinatura com esse filtro"
            hint="Enquanto a compra dentro do app não entra, o esperado é quase nada aqui."
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
                { key: "role", label: "Papel", render: (r) => papel(r.role) },
                { key: "plan", label: "Plano", render: (r) => NOME_DO_PLANO[r.plan] },
                {
                  key: "status",
                  label: "Situação",
                  render: (r) => (
                    <Badge tone={STATUS_TOM[r.status] ?? "neutral"}>
                      {ROTULO_DO_STATUS[r.status]}
                    </Badge>
                  ),
                },
                {
                  key: "provider",
                  label: "Comprou em",
                  render: (r) => ROTULO_DO_PROVEDOR[r.provider],
                },
                { key: "startedAt", label: "Início", render: (r) => data(r.startedAt) },
                { key: "expiresAt", label: "Vence em", render: (r) => data(r.expiresAt) },
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

      {/* ── Quanto já usaram da cota ───────────────────────────────────── */}
      <AdminCard title="Uso do mês" icon={CircleSlash} className="mt-4">
        <p className="mb-4 text-sm leading-6 text-fg-muted">
          Contagem feita pela mesma regra que decide se a pessoa pode aceitar o
          próximo serviço. Refazer a conta aqui faria as duas divergirem em
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
              { key: "role", label: "Papel", render: (r) => papel(r.role) },
              {
                key: "plan",
                label: "Plano",
                render: (r) =>
                  NOME_DO_PLANO[r.plan as keyof typeof NOME_DO_PLANO] ?? r.plan,
              },
              { key: "usado", label: "Usou no mês", render: (r) => String(r.usado) },
              {
                key: "limite",
                label: "Limite",
                render: (r) => (r.limite === null ? "Ilimitado" : String(r.limite)),
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
