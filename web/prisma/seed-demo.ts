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
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

const prisma = new PrismaClient();

const CONTAS = [
  { telefone: "65900009001", nome: "Demo Empregador", role: "EMPREGADOR" as const },
  { telefone: "65900009002", nome: "Demo Diarista", role: "DIARISTA" as const },
  { telefone: "65900009003", nome: "Demo Montador", role: "MONTADOR" as const },
];

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
