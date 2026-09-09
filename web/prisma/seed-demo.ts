/**
 * Contas de demonstração para a revisão das lojas (App Store / Google Play).
 *
 * Rodar de dentro de `web/`:
 *   DEMO_PASSWORD='...' DATABASE_URL='...' npx tsx prisma/seed-demo.ts
 *
 * A SENHA NÃO ESTÁ NO CÓDIGO de propósito: ela vai para as notas de revisão
 * da loja, que são um canal externo. Commitá-la aqui a tornaria pública no
 * histórico do git para sempre.
 *
 * Idempotente: reexecutar atualiza as mesmas três contas, não cria outras.
 *
 * O QUE ESTAS CONTAS TÊM DE DIFERENTE
 *
 * Apenas `contaDemo = true`, que abre dois portões e nada mais (ver
 * lib/contaDemo.ts): o filtro de KYC na busca de diaristas e a validação de
 * bairro na criação de serviço. Não são admin, não têm plano pago, não pulam
 * autenticação.
 *
 * Por que três: o revisor precisa avaliar os TRÊS papéis. Com uma conta só
 * ele vê metade do app e reprova por "funcionalidade incompleta".
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { hashPassword } from "../src/lib/password";

// Prisma 7 exige adaptador explícito — mesmo padrão de prisma/seed.ts.
const datasourceUrl = process.env.DATABASE_URL;
if (!datasourceUrl) {
  console.error("\n✖ DATABASE_URL não definida.\n");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: datasourceUrl });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const CONTAS = [
  { telefone: "65900009001", nome: "Demo Empregador", role: "EMPREGADOR" as const },
  { telefone: "65900009002", nome: "Demo Diarista", role: "DIARISTA" as const },
  { telefone: "65900009003", nome: "Demo Montador", role: "MONTADOR" as const },
];

/**
 * Região das contas demo. A mesma da operação, para o revisor ver a busca
 * funcionando com resultado — e a `contaDemo` deixa ele criar serviço em
 * QUALQUER endereço, então não fica preso a ela.
 */
const CIDADE = "Água Boa";
const UF = "MT";

/**
 * Os critérios de visibilidade abaixo foram lidos do CÓDIGO que roda, não da
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

function abortar(mensagem: string): never {
  console.error(`\n✖ ${mensagem}\n`);
  process.exit(1);
}

async function main() {
  const senha = process.env.DEMO_PASSWORD;
  if (!senha) {
    abortar(
      "DEMO_PASSWORD não definida. Rode com:\n" +
        "  DEMO_PASSWORD='<senha>' npx tsx prisma/seed-demo.ts",
    );
  }
  if (senha.length < 10) {
    // A senha vai para as notas de revisão da loja e fica acessível a quem
    // tiver acesso ao console. Curta demais não serve.
    abortar("DEMO_PASSWORD muito curta — use ao menos 10 caracteres.");
  }

  const senhaHash = await hashPassword(senha);

  for (const conta of CONTAS) {
    await prisma.user.upsert({
      where: { telefone: conta.telefone },
      update: {
        nome: conta.nome,
        role: conta.role,
        status: "ATIVO",
        senhaHash,
        contaDemo: true,
      },
      create: {
        nome: conta.nome,
        telefone: conta.telefone,
        role: conta.role,
        status: "ATIVO",
        senhaHash,
        contaDemo: true,
      },
    });
    console.log(`  ✓ ${conta.role.padEnd(11)} ${conta.telefone}  (${conta.nome})`);
  }

  // ── Perfis ────────────────────────────────────────────────────────────────
  // Sem perfil, a conta loga e não aparece em busca nenhuma: a busca consulta
  // DiaristaProfile / MontadorPerfil, não User. A flag `contaDemo` sozinha não
  // resolvia isso — o revisor veria uma lista vazia.
  const diarista = await prisma.user.findUnique({
    where: { telefone: "65900009002" },
    select: { id: true },
  });
  if (diarista) {
    const dados = {
      ativo: true,
      bio: "Conta de demonstração do Dular, usada pela revisão das lojas. Não é uma profissional real.",
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
      where: { userId: diarista.id },
      update: dados,
      create: { userId: diarista.id, ...dados },
    });
    console.log("  ✓ perfil da diarista demo (visível pela flag, sem KYC)");
  }

  const montador = await prisma.user.findUnique({
    where: { telefone: "65900009003" },
    select: { id: true },
  });
  if (montador) {
    const dados = {
      ativo: true,
      bio: "Conta de demonstração do Dular, usada pela revisão das lojas. Não é um profissional real.",
      especialidades: ["Montagem de móveis"],
      cidade: CIDADE,
      estado: UF,
      atendeTodaCidade: true,
      valorACombinar: true,
      verificado: false,
    };
    await prisma.montadorPerfil.upsert({
      where: { userId: montador.id },
      update: dados,
      create: { userId: montador.id, ...dados },
    });
    console.log("  ✓ perfil do montador demo (visível pela flag, sem KYC)");
  }

  // O empregador não aparece em busca — ele é quem busca. O perfil existe
  // para as telas de conta não abrirem vazias.
  const empregador = await prisma.user.findUnique({
    where: { telefone: "65900009001" },
    select: { id: true },
  });
  if (empregador) {
    const dados = { ativo: true, cidade: CIDADE, estado: UF };
    await prisma.empregadorPerfil.upsert({
      where: { userId: empregador.id },
      update: dados,
      create: { userId: empregador.id, ...dados },
    });
    console.log("  ✓ perfil do empregador demo");
  }

  console.log(
    [
      "",
      "Contas de demonstração prontas.",
      "",
      "Nas notas de revisão da loja, informe UMA delas (a de empregador cobre",
      "o fluxo de contratação inteiro) e a senha usada aqui.",
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
