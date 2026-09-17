export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  BriefcaseBusiness,
  EyeOff,
  Layers,
  ShieldAlert,
} from "lucide-react";

import { AdminPage } from "@/components/admin-ui/AdminPage";
import { AdminGrid } from "@/components/admin-ui/AdminGrid";
import { AdminCard } from "@/components/admin-ui/AdminCard";
import { AdminKpi } from "@/components/admin-ui/AdminKpi";
import { AdminEmpty } from "@/components/admin-ui/AdminEmpty";
import { Badge } from "@/design-system/ui";
import { PAPEL, resumoDosNichos, type NichoNoPainel } from "@/lib/adminPerfis";

function pct(parte: number, todo: number): string {
  if (todo === 0) return "—";
  return `${Math.round((parte / todo) * 100)}%`;
}

/**
 * Um nicho: quantas pessoas o atendem, quanta procura ele teve e se é um nicho
 * de contato direto. A barra usa o maior valor da lista como escala — contra o
 * total de profissionais, nichos pequenos viravam traços indistinguíveis.
 */
function CartaoDeNicho({
  item,
  maior,
  totalProfissionais,
}: {
  item: NichoNoPainel;
  maior: number;
  totalProfissionais: number;
}) {
  const { identidade } = item;
  const largura = maior === 0 ? 0 : Math.round((item.profissionais / maior) * 100);

  return (
    <div className="rounded-xl border border-border bg-surface-secondary p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: identidade.cor }}
            />
            <h3 className="truncate text-sm font-bold text-fg">{identidade.rotulo}</h3>
          </div>
          <p className="mt-0.5 text-xs text-fg-subtle">{identidade.descricao}</p>
        </div>
        {identidade.contatoDireto ? (
          <Badge tone="high" className="shrink-0">
            contato direto
          </Badge>
        ) : null}
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span
          className="text-metric font-bold tabular-nums"
          style={{ color: identidade.cor }}
        >
          {item.profissionais}
        </span>
        <span className="text-xs text-fg-subtle">
          {item.profissionais === 1 ? "profissional" : "profissionais"} ·{" "}
          {pct(item.profissionais, totalProfissionais)} do total
        </span>
      </div>

      <div
        className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-subtle"
        role="presentation"
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${largura}%`, backgroundColor: identidade.cor }}
        />
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-2 border-t border-border-subtle pt-3 text-sm">
        <span className="text-fg-subtle">Serviços pedidos</span>
        <span className="font-semibold tabular-nums text-fg">{item.servicos}</span>
      </div>
    </div>
  );
}

export default async function ProfissionaisPorNichoPage() {
  const resumo = await resumoDosNichos();

  const porProcura = [...resumo.nichos].sort((a, b) => b.servicos - a.servicos);
  const maisProcurado = porProcura[0]?.servicos ? porProcura[0] : null;
  const maiorOferta = Math.max(0, ...resumo.nichos.map((n) => n.profissionais));

  const semNinguem = resumo.nichos.filter((n) => n.profissionais === 0);

  return (
    <AdminPage title="" subtitle="">
      <div className="mb-4">
        <Link
          href="/admin/operacoes/usuarios"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-fg-muted transition-colors hover:text-fg"
        >
          <ArrowLeft size={15} strokeWidth={2} />
          Usuários
        </Link>
      </div>

      <AdminGrid>
        <div className="md:col-span-3">
          <AdminKpi
            label={PAPEL.DIARISTA.rotuloCartao}
            value={String(resumo.totalProfissionais)}
            hint="Total com este perfil"
            identidade={PAPEL.DIARISTA.cor}
            icon={BriefcaseBusiness}
          />
        </div>
        <div className="md:col-span-3">
          <AdminKpi
            label="Com nicho declarado"
            value={String(resumo.comNicho)}
            hint={`${resumo.declaracoes} escolhas no total — a seleção é múltipla`}
            tone="success"
            icon={Layers}
          />
        </div>
        <div className="md:col-span-3">
          <AdminKpi
            label="Sem nicho declarado"
            value={String(resumo.semNicho)}
            hint="Não aparecem na busca do empregador"
            tone={resumo.semNicho > 0 ? "critical" : "neutral"}
            icon={EyeOff}
          />
        </div>
        <div className="md:col-span-3">
          <AdminKpi
            label="Em contato direto"
            value={String(resumo.emContatoDireto)}
            hint="Atendem dentro da casa do contratante"
            tone={resumo.emContatoDireto > 0 ? "high" : "neutral"}
            icon={ShieldAlert}
          />
        </div>
      </AdminGrid>

      <AdminCard title="Nichos do perfil" icon={Layers} className="mt-4">
        <p className="mb-4 text-sm leading-6 text-fg-muted">
          Cada profissional escolhe um ou mais nichos ao montar o perfil, e é
          essa escolha que a busca do empregador filtra. Por ser múltipla, a soma
          dos nichos é maior que o número de pessoas: {resumo.declaracoes}{" "}
          escolhas para {resumo.comNicho}{" "}
          {resumo.comNicho === 1 ? "pessoa" : "pessoas"}.
          {maisProcurado ? (
            <>
              {" "}
              Hoje a maior procura é por{" "}
              <strong>{maisProcurado.identidade.rotulo.toLowerCase()}</strong>.
            </>
          ) : null}
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {resumo.nichos.map((item) => (
            <CartaoDeNicho
              key={item.nicho}
              item={item}
              maior={maiorOferta}
              totalProfissionais={resumo.totalProfissionais}
            />
          ))}
        </div>
      </AdminCard>

      <AdminCard title="O que exige atenção" icon={AlertTriangle} className="mt-4">
        <div className="flex flex-col gap-3">
          {resumo.semNicho > 0 ? (
            <div className="flex items-start gap-2 rounded-lg border border-error/30 bg-error-light px-4 py-3 text-sm text-error-dark">
              <EyeOff size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
              <span>
                <strong>
                  {resumo.semNicho}{" "}
                  {resumo.semNicho === 1 ? "profissional" : "profissionais"} sem
                  nicho declarado.
                </strong>{" "}
                A busca do empregador só devolve quem declarou pelo menos um, então
                estas contas estão cadastradas e invisíveis — não recebem pedido
                nenhum, e nada no app avisa isso a elas.
              </span>
            </div>
          ) : null}

          {semNinguem.length > 0 ? (
            <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-light px-4 py-3 text-sm text-warning-dark">
              <AlertTriangle size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
              <span>
                <strong>Nicho anunciado sem ninguém para atender:</strong>{" "}
                {semNinguem.map((n) => n.identidade.rotulo).join(", ")}. O
                empregador vê a categoria no app e a busca volta vazia.
              </span>
            </div>
          ) : null}

          {resumo.emContatoDireto > 0 ? (
            <div className="flex items-start gap-2 rounded-lg border border-border bg-surface-secondary px-4 py-3 text-sm text-fg-muted">
              <ShieldAlert size={16} strokeWidth={2} className="mt-0.5 shrink-0 text-orange" />
              <span>
                <strong>{resumo.emContatoDireto}</strong> atendem em nicho de
                contato direto — o trabalho acontece dentro da casa, junto do
                contratante e sem mais ninguém por perto. É a fila que o suporte
                deve atender primeiro quando houver incidente.
              </span>
            </div>
          ) : null}

          {resumo.semNicho === 0 && semNinguem.length === 0 && resumo.emContatoDireto === 0 ? (
            <AdminEmpty
              title="Nada a sinalizar"
              hint="Sem nicho vazio e sem profissional invisível para a busca."
            />
          ) : null}
        </div>
      </AdminCard>
    </AdminPage>
  );
}
