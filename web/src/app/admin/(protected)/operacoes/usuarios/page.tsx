export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { prisma } from "@/lib/prisma";
import { AdminPage } from "@/components/admin-ui/AdminPage";
import { AdminGrid } from "@/components/admin-ui/AdminGrid";
import { AdminKpi } from "@/components/admin-ui/AdminKpi";
import { AdminCard } from "@/components/admin-ui/AdminCard";
import { AdminTable } from "@/components/admin-ui/AdminTable";
import { AdminEmpty } from "@/components/admin-ui/AdminEmpty";
import {
  BriefcaseBusiness,
  CircleSlash,
  ShieldCheck,
  UserRound,
  Users,
  Wrench,
} from "lucide-react";
import { PAPEL, contarPorPapel } from "@/lib/adminPerfis";

function Papel({ role }: { role: string | null }) {
  const identidade = role ? PAPEL[role] : undefined;
  if (!identidade) return <>—</>;

  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: identidade.cor }}
      />
      {identidade.rotulo}
    </span>
  );
}

export default async function UsuariosPage() {
  const [contagem, rows] = await Promise.all([
    contarPorPapel(),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, nome: true, telefone: true, email: true, role: true, createdAt: true },
    }),
  ]);

  return (
    <AdminPage title="" subtitle="">
      <AdminGrid>
        {/* Seis cartões: duas fileiras de três. Com col-span-3 a segunda
            fileira ficaria com dois órfãos e metade da linha vazia. */}
        <div className="md:col-span-4">
          <AdminKpi label="Total" value={String(contagem.total)} icon={Users} />
        </div>
        <div className="md:col-span-4">
          <AdminKpi
            label={PAPEL.EMPREGADOR.rotuloCartao}
            value={String(contagem.empregadores)}
            hint={PAPEL.EMPREGADOR.descricao}
            identidade={PAPEL.EMPREGADOR.cor}
            icon={UserRound}
          />
        </div>
        {/*
          Um cartão que abre a quebra por nicho. É o único perfil com
          sub-identidade: sob ele vivem diarista, babá, cozinheira, cuidadora,
          passadeira e lavadeira, e é essa distribuição que diz onde a procura
          está e para onde o suporte precisa olhar primeiro.
        */}
        <div className="md:col-span-4">
          <AdminKpi
            label={PAPEL.DIARISTA.rotuloCartao}
            value={String(contagem.profissionais)}
            hint="Ver a distribuição por nicho"
            identidade={PAPEL.DIARISTA.cor}
            icon={BriefcaseBusiness}
            href="/admin/operacoes/usuarios/profissionais"
          />
        </div>
        <div className="md:col-span-4">
          <AdminKpi
            label={PAPEL.MONTADOR.rotuloCartao}
            value={String(contagem.montadores)}
            hint={PAPEL.MONTADOR.descricao}
            identidade={PAPEL.MONTADOR.cor}
            icon={Wrench}
          />
        </div>
        <div className="md:col-span-4">
          <AdminKpi
            label="Administradores"
            value={String(contagem.admins)}
            hint={PAPEL.ADMIN.descricao}
            identidade={PAPEL.ADMIN.cor}
            icon={ShieldCheck}
          />
        </div>
        {/*
          O ponto cego: quem entra pelo login social nasce sem papel e só o
          recebe ao escolher o perfil. Quem parou no meio ficava dentro do total
          e fora de todos os outros cards — a soma não fechava e nada apontava
          para isso. Agora aponta.
        */}
        <div className="md:col-span-4">
          <AdminKpi
            label="Sem perfil escolhido"
            value={String(contagem.semPapel)}
            hint={
              contagem.semPapel > 0
                ? "Entraram pelo login social e não concluíram a escolha"
                : "Todas as contas têm perfil definido"
            }
            tone={contagem.semPapel > 0 ? "critical" : "neutral"}
            icon={CircleSlash}
          />
        </div>

        <div className="md:col-span-12">
          <AdminCard title="Últimos cadastrados" icon={Users}>
            {rows.length === 0 ? (
              <AdminEmpty title="Sem dados ainda" hint="Quando houver usuários cadastrados, aparecem aqui." />
            ) : (
              <AdminTable
                columns={[
                  { key: "nome", label: "Nome" },
                  { key: "telefone", label: "Telefone" },
                  { key: "email", label: "Email" },
                  { key: "role", label: "Perfil", render: (r) => <Papel role={r.role} /> },
                  {
                    key: "createdAt",
                    label: "Criado em",
                    render: (r) => new Date(r.createdAt).toLocaleString("pt-BR"),
                  },
                ]}
                rows={rows}
              />
            )}
          </AdminCard>
        </div>
      </AdminGrid>
    </AdminPage>
  );
}
