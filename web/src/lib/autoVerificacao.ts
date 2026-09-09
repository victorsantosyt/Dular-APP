/**
 * Auto-verificação de profissionais (Diarista e Montador).
 *
 * Auto-aprovação exclusiva para QA/E2E via AUTO_VERIFY_PROFILES=true.
 * Em produção a env fica desligada e a aprovação humana segue por
 * /api/admin/verificacoes/approve. NODE_ENV NÃO autoriza promoção:
 * dev local conectado ao Railway ainda opera sobre dado real.
 *
 * Sem AUTO_VERIFY_PROFILES=true, estas funções apenas consultam o status
 * atual sem alterar banco. Idempotente: nunca regride status terminal
 * (VERIFICADO/REPROVADO em Diarista; verificado=true em Montador).
 *
 * Chamado lateralmente nos PATCHes existentes (sem endpoint novo).
 */
import { prisma } from "@/lib/prisma";
import {
  getDiaristaProfileCompleteness,
  type DiaristaProfileForCompleteness,
} from "@/lib/diaristaProfile";
import { calcularCompletudeMontador } from "@/lib/montadorProfile";

const isDev = process.env.NODE_ENV === "development";

/**
 * Recusa `AUTO_VERIFY_PROFILES=true` em produção.
 *
 * A env aprova KYC de quem editar o perfil enquanto estiver ligada. Ligada e
 * esquecida em produção, ela verifica todo mundo que passar por lá — sem
 * ninguém perceber, porque a promoção é silenciosa e o status não regride.
 *
 * "Não está declarada em ambiente nenhum" não é proteção: quem tem acesso ao
 * painel de deploy adiciona a variável em segundos. A proteção precisa estar
 * no código.
 *
 * LANÇA em vez de ignorar a flag e seguir. Subir com a flag desligada
 * silenciosamente esconderia a configuração errada — quem a ligou acharia
 * que funcionou, e ninguém iria olhar. É preferível não subir: KYC
 * comprometido em produção é pior do que indisponibilidade.
 */
export function garantirAutoVerifyForaDeProducao(): void {
  if (process.env.AUTO_VERIFY_PROFILES !== "true") return;
  if (process.env.NODE_ENV !== "production") return;

  throw new Error(
    [
      "AUTO_VERIFY_PROFILES=true com NODE_ENV=production.",
      "",
      "Essa variável aprova a verificação de identidade automaticamente e",
      "existe só para QA/E2E. Em produção, ela verificaria todo profissional",
      "que editar o perfil, sem conferência humana.",
      "",
      "O que fazer: remova AUTO_VERIFY_PROFILES do ambiente de produção.",
      "Para conta de teste com verificação, use `contaDemo`",
      "(prisma/seed-demo.ts) — ela cobre o caso sem afetar mais ninguém.",
    ].join("\n"),
  );
}

export function isAutoVerifyEnabled(): boolean {
  // Segunda linha de defesa: o portão principal é o boot
  // (src/instrumentation.ts), mas nem todo caminho passa por lá — script,
  // seed e teste importam este módulo direto.
  garantirAutoVerifyForaDeProducao();
  return process.env.AUTO_VERIFY_PROFILES === "true";
}

function logDisabled() {
  if (isDev) console.log("[autoVerificacao] disabled");
}

/**
 * Auto-verifica perfil de Diarista quando AUTO_VERIFY_PROFILES=true e:
 * - Completude OK (getDiaristaProfileCompleteness)
 * - docUrl presente
 * - verificacao ainda PENDENTE
 *
 * Sem a env, retorna a verificacao atual sem tocar o banco.
 * Idempotente. Não regride VERIFICADO/REPROVADO.
 */
export async function autoVerificarDiaristaSePossivel(
  userId: string,
): Promise<"PENDENTE" | "VERIFICADO" | "REPROVADO"> {
  if (!isAutoVerifyEnabled()) {
    logDisabled();
    const current = await prisma.diaristaProfile.findUnique({
      where: { userId },
      select: { verificacao: true },
    });
    return current?.verificacao ?? "PENDENTE";
  }

  const profile = await prisma.diaristaProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      ativo: true,
      bio: true,
      servicosOferecidos: true,
      cidade: true,
      estado: true,
      atendeTodaCidade: true,
      raioAtendimentoKm: true,
      precoLeve: true,
      precoMedio: true,
      precoPesada: true,
      precoBabaHora: true,
      precoCozinheiraBase: true,
      taxaMinima: true,
      valorACombinar: true,
      verificacao: true,
      docUrl: true,
      bairros: { select: { id: true } },
      user: { select: { nome: true, status: true } },
    },
  });

  if (!profile) return "PENDENTE";

  if (profile.verificacao === "VERIFICADO" || profile.verificacao === "REPROVADO") {
    return profile.verificacao;
  }

  const completude = getDiaristaProfileCompleteness(
    profile as unknown as DiaristaProfileForCompleteness,
  );
  if (!completude.completo) return "PENDENTE";

  if (!profile.docUrl) return "PENDENTE";

  await prisma.diaristaProfile.update({
    where: { id: profile.id },
    data: { verificacao: "VERIFICADO" },
  });

  if (isDev) {
    console.log(`[autoVerificacao] promoted DIARISTA userId=${userId}`);
  }

  return "VERIFICADO";
}

/**
 * Auto-verifica perfil de Montador quando AUTO_VERIFY_PROFILES=true e:
 * - calcularCompletudeMontador(...) === completo
 * - documentoFrente + documentoVerso + selfieDoc todos presentes
 * - verificado ainda false
 *
 * Sem a env, retorna verificado atual sem tocar o banco.
 * Idempotente. Não regride verificado=true.
 */
export async function autoVerificarMontadorSePossivel(userId: string): Promise<boolean> {
  if (!isAutoVerifyEnabled()) {
    logDisabled();
    const current = await prisma.montadorPerfil.findUnique({
      where: { userId },
      select: { verificado: true },
    });
    return current?.verificado ?? false;
  }

  const profile = await prisma.montadorPerfil.findUnique({
    where: { userId },
    select: {
      id: true,
      ativo: true,
      bio: true,
      especialidades: true,
      cidade: true,
      estado: true,
      atendeTodaCidade: true,
      bairros: true,
      documentoFrente: true,
      documentoVerso: true,
      selfieDoc: true,
      verificado: true,
      user: { select: { nome: true, status: true } },
    },
  });

  if (!profile) return false;
  if (profile.verificado) return true;

  const completude = calcularCompletudeMontador({
    nome: profile.user?.nome,
    bio: profile.bio,
    especialidades: profile.especialidades,
    cidade: profile.cidade,
    estado: profile.estado,
    bairros: profile.bairros,
    atendeTodaCidade: profile.atendeTodaCidade,
    ativo: profile.ativo,
    userStatus: profile.user?.status,
  });
  if (!completude.completo) return false;

  const docsCompletos = Boolean(
    profile.documentoFrente && profile.documentoVerso && profile.selfieDoc,
  );
  if (!docsCompletos) return false;

  await prisma.montadorPerfil.update({
    where: { id: profile.id },
    data: { verificado: true },
  });

  if (isDev) {
    console.log(`[autoVerificacao] promoted MONTADOR userId=${userId}`);
  }

  return true;
}
