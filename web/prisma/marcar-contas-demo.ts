/**
 * Marca como demonstração contas REAIS que já existem, criadas pelo login
 * normal do app (Google / Apple).
 *
 * Rodar de dentro de `web/`:
 *   DEMO_EMAILS='revisao.empregador@gmail.com,revisao.diarista@gmail.com=DIARISTA' \
 *   DATABASE_URL='...' npx tsx prisma/marcar-contas-demo.ts
 *
 * POR QUE POR E-MAIL, E NÃO POR TELEFONE
 *
 * O app só entra por Google e Apple. Uma conta criada por OAuth se identifica
 * pelo e-mail — não tem telefone fixo que um seed possa prever. O script
 * anterior criava contas por telefone e por isso não alcançava nenhuma conta
 * de revisor.
 *
 * POR QUE ESTE SCRIPT NÃO DEFINE SENHA
 *
 * De propósito, e é a diferença mais importante em relação ao que havia antes.
 * `POST /api/auth/login` aceita qualquer usuário que tenha `senhaHash` e
 * devolve um JWT de 7 dias — ela existe para o painel admin, mas não distingue
 * quem entra. Dar senha a uma conta demo criaria exatamente o caminho de
 * autenticação paralelo que a decisão do projeto proíbe: o revisor entraria
 * por fora do OAuth, e esse acesso continuaria vivo em produção depois.
 *
 * Aqui o revisor usa o fluxo real do app. Se este script um dia precisar
 * escrever `senhaHash`, a pergunta certa não é como fazer isso — é por quê.
 *
 * ISTO É PERMANENTE
 *
 * Toda atualização passa por revisão de novo. Não é andaime de lançamento:
 * as contas e este script continuam sendo necessários a cada release.
 *
 * O QUE A MARCAÇÃO CONCEDE
 *
 * Só `contaDemo = true`, que abre dois portões e nada mais (ver
 * lib/contaDemo.ts): o filtro de KYC na busca de diaristas e a validação de
 * bairro na criação de serviço. Não concede admin, não pula autenticação, não
 * libera plano pago.
 *
 * Idempotente: rodar duas vezes atualiza as mesmas contas, não duplica nada.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const datasourceUrl = process.env.DATABASE_URL;
if (!datasourceUrl) {
  console.error("\n✖ DATABASE_URL não definida.\n");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: datasourceUrl });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

/**
 * Região das contas demo. A mesma da operação, para o revisor ver a busca
 * funcionando com resultado — e a `contaDemo` deixa ele criar serviço em
 * QUALQUER endereço, então não fica preso a ela.
 */
const CIDADE = "Água Boa";
const UF = "MT";

const PAPEIS = ["EMPREGADOR", "DIARISTA", "MONTADOR"] as const;
type Papel = (typeof PAPEIS)[number];

function abortar(mensagem: string): never {
  console.error(`\n✖ ${mensagem}\n`);
  process.exit(1);
}

type Alvo = { email: string; papel: Papel | null };

/**
 * Lê `DEMO_EMAILS`. Formato: e-mails separados por vírgula, cada um com papel
 * opcional depois de `=`.
 *
 *   DEMO_EMAILS='a@x.com,b@x.com=DIARISTA'
 *
 * Sem `=PAPEL`, vale o papel que a conta já escolheu no app. O papel explícito
 * existe para o caso de o revisor ter escolhido errado na primeira entrada —
 * refazer a conta seria pior.
 */
function lerAlvos(): Alvo[] {
  const bruto = process.env.DEMO_EMAILS;
  if (!bruto || !bruto.trim()) {
    abortar(
      "DEMO_EMAILS não definida. Rode com:\n" +
        "  DEMO_EMAILS='revisao.empregador@gmail.com,revisao.diarista@gmail.com=DIARISTA' \\\n" +
        "    npx tsx prisma/marcar-contas-demo.ts\n\n" +
        "A lista NÃO fica no repositório: os e-mails são contas reais das lojas.",
    );
  }

  const alvos: Alvo[] = [];
  for (const item of bruto.split(",")) {
    const limpo = item.trim();
    if (!limpo) continue;

    const [emailBruto, papelBruto] = limpo.split("=");
    const email = (emailBruto ?? "").trim().toLowerCase();
    if (!email.includes("@")) {
      abortar(`"${limpo}" não parece um e-mail. Formato: email[=PAPEL], separados por vírgula.`);
    }

    let papel: Papel | null = null;
    if (papelBruto?.trim()) {
      const candidato = papelBruto.trim().toUpperCase();
      if (!PAPEIS.includes(candidato as Papel)) {
        abortar(`Papel "${candidato}" desconhecido. Use um de: ${PAPEIS.join(", ")}.`);
      }
      papel = candidato as Papel;
    }

    alvos.push({ email, papel });
  }

  if (alvos.length === 0) abortar("DEMO_EMAILS está vazia depois de limpar a lista.");
  return alvos;
}

const BIO_DIARISTA =
  "Conta de demonstração do Dular, usada pela revisão das lojas. Não é uma profissional real.";
const BIO_MONTADOR =
  "Conta de demonstração do Dular, usada pela revisão das lojas. Não é um profissional real.";

/**
 * Cria ou completa o perfil do papel.
 *
 * Os critérios de completude foram lidos do CÓDIGO que roda, não da
 * documentação — as duas divergiram antes neste projeto.
 *
 * Diarista (getDiaristaProfileCompleteness + isDiaristaProfileCompleteForServico):
 *   nome, bio, servicosOferecidos, localização (cidade+estado OU bairros),
 *   ativo, e preço do nicho OU valorACombinar.
 * Montador (calcularCompletudeMontador):
 *   nome, bio, especialidades, cidade+estado com atendeTodaCidade ou bairros,
 *   ativo.
 *
 * NÃO semeamos avaliação, SafeScore nem serviço concluído: dado fabricado de
 * reputação é proibido no projeto, e nenhum critério de visibilidade exige.
 * Os perfis demo aparecem sem histórico, como qualquer conta nova.
 */
async function garantirPerfil(userId: string, papel: Papel): Promise<string> {
  if (papel === "DIARISTA") {
    const dados = {
      ativo: true,
      bio: BIO_DIARISTA,
      servicosOferecidos: ["DIARISTA"],
      cidade: CIDADE,
      estado: UF,
      atendeTodaCidade: true,
      // "A combinar" em vez de valor inventado: é o que a completude aceita
      // (`isDiaristaProfileCompleteForServico` só cobra preço quando
      // `valorACombinar` é falso), e nenhum número falso vai para a tela.
      // `precoLeve`/`precoPesada` são colunas obrigatórias no schema; zero
      // aqui significa "não informado", não um preço de R$ 0.
      valorACombinar: true,
      precoLeve: 0,
      precoPesada: 0,
      verificacao: "PENDENTE" as const,
    };
    await prisma.diaristaProfile.upsert({
      where: { userId },
      update: dados,
      create: { userId, ...dados },
    });
    return "perfil de diarista pronto (visível pela flag, sem KYC)";
  }

  if (papel === "MONTADOR") {
    const dados = {
      ativo: true,
      bio: BIO_MONTADOR,
      especialidades: ["Montagem de móveis"],
      cidade: CIDADE,
      estado: UF,
      atendeTodaCidade: true,
      valorACombinar: true,
      verificado: false,
    };
    await prisma.montadorPerfil.upsert({
      where: { userId },
      update: dados,
      create: { userId, ...dados },
    });
    return "perfil de montador pronto (visível pela flag, sem KYC)";
  }

  // O empregador não aparece em busca — ele é quem busca. O perfil existe
  // para as telas de conta não abrirem vazias.
  const dados = { ativo: true, cidade: CIDADE, estado: UF };
  await prisma.empregadorPerfil.upsert({
    where: { userId },
    update: dados,
    create: { userId, ...dados },
  });
  return "perfil de empregador pronto";
}

async function main() {
  const alvos = lerAlvos();
  const avisos: string[] = [];

  for (const alvo of alvos) {
    // Busca sem diferenciar maiúsculas: o provedor de OAuth decide como grava
    // o e-mail, e conferir isso à mão na hora de rodar seria uma armadilha.
    const user = await prisma.user.findFirst({
      where: { email: { equals: alvo.email, mode: "insensitive" } },
      select: { id: true, nome: true, email: true, role: true, status: true, senhaHash: true },
    });

    if (!user) {
      abortar(
        `Nenhuma conta com o e-mail ${alvo.email}.\n\n` +
          "Contas de revisão são criadas pelo fluxo normal: abra o app, entre\n" +
          "com Google ou Apple usando essa conta e escolha o papel. Só depois\n" +
          "rode este script — ele MARCA uma conta existente, não cria nenhuma.",
      );
    }

    const papel = alvo.papel ?? (user.role as Papel | null);
    if (!papel) {
      abortar(
        `A conta ${alvo.email} existe mas ainda não escolheu um papel.\n\n` +
          "Termine a escolha de perfil no app, ou informe o papel na lista:\n" +
          `  DEMO_EMAILS='${alvo.email}=DIARISTA'`,
      );
    }
    if (!PAPEIS.includes(papel)) {
      abortar(
        `A conta ${alvo.email} tem papel "${papel}", que não é de demonstração.\n` +
          "Contas ADMIN nunca devem ser marcadas como demo.",
      );
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        contaDemo: true,
        role: papel,
        status: "ATIVO",
      },
    });

    const resultadoPerfil = await garantirPerfil(user.id, papel);

    // Não apagamos a senha por conta própria — apagar credencial de uma conta
    // real é destrutivo e pode não ser o que se quer. Mas uma conta demo com
    // senha É um caminho de autenticação paralelo vivo, então isto precisa
    // aparecer em voz alta.
    if (user.senhaHash) {
      avisos.push(
        `${alvo.email} tem senha definida — /api/auth/login aceita essa conta ` +
          "sem passar por OAuth. Limpe `senhaHash` antes de enviar às lojas.",
      );
    }

    console.log(`  ✓ ${papel.padEnd(11)} ${alvo.email}`);
    console.log(`      ${resultadoPerfil}`);
  }

  if (avisos.length > 0) {
    console.log("\n⚠ Atenção:");
    for (const aviso of avisos) console.log(`  • ${aviso}`);
  }

  console.log(
    [
      "",
      "Contas de demonstração marcadas.",
      "",
      "Confira antes de enviar às lojas: entre no app com cada conta e veja se",
      "o perfil de diarista aparece na busca. Nas notas de revisão vão o e-mail",
      "e a senha DA PLATAFORMA (Google/Apple) — nunca uma senha do Dular.",
      "",
      "Estas contas NÃO devem ser divulgadas fora do console da loja.",
      "",
    ].join("\n"),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
