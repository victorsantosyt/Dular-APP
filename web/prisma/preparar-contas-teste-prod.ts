/**
 * LIMPA a base de usuários e semeia as três contas de teste do dono.
 *
 * ⚠️ ESTE SCRIPT APAGA DADOS. Leia antes de rodar.
 *
 * POR QUE ELE EXISTE
 *
 * O Beta 0 acumulou contas de teste criadas à mão, por seed de QA e por
 * smoke test. Antes de abrir para gente de verdade, a base precisa ficar com
 * o admin e com as três contas que o dono usa para percorrer o app — uma por
 * papel, todas verificadas.
 *
 * O QUE ELE FAZ, NESTA ORDEM
 *
 *   1. Inventário: conta o que existe hoje, por tabela. Não escreve nada.
 *   2. Apaga todos os usuários EXCETO os preservados (ver PRESERVAR_EMAILS e
 *      todo mundo com papel ADMIN), na ordem que as chaves estrangeiras
 *      exigem, dentro de UMA transação.
 *   3. Semeia as três contas com perfil, área de atendimento e verificação.
 *
 * A ORDEM DE EXCLUSÃO SAIU DO BANCO, NÃO DO SCHEMA
 *
 * Ler as relações do schema.prisma e deduzir a ordem dá errado, e deu: uma
 * varredura do arquivo enxerga só quem aponta para `User` e perde o segundo
 * nível. A fonte usada aqui é o próprio Postgres:
 *
 *     SELECT conrelid::regclass AS filho, confrelid::regclass AS pai
 *     FROM pg_constraint WHERE contype='f' AND confdeltype <> 'c';
 *
 * O que ela devolve — as únicas FKs que NÃO são CASCADE:
 *
 *     Servico          -> User               (cliente, diarista, montador)
 *     IncidentReport   -> User               (reportedBy, reportedUser)
 *     ChatMessage      -> User               (sender)
 *     SafeScore        -> User
 *     ScoreEvento      -> SafeScore          ← segundo nível
 *     SafeScoreEvent   -> SafeScoreProfile   ← segundo nível, e traiçoeiro
 *
 * As duas últimas são as que um mapa de um nível só não vê. A `SafeScoreEvent`
 * é a pior: `SafeScoreProfile` é CASCADE a partir de `User`, então o DELETE de
 * `User` tenta removê-lo e esbarra nesse filho — a falha aconteceria no ÚLTIMO
 * passo, depois de serviços e incidentes já terem sido apagados.
 *
 * Daí a ordem:
 *
 *     ScoreEvento → SafeScore → SafeScoreEvent → IncidentReport → Servico
 *                 → ChatMessage → User
 *
 * Apagar `Servico` derruba ChatRoom em cascata, e ChatRoom derruba ChatMessage;
 * o passo de ChatMessage cobre a sobra (mensagem em sala que não era de um
 * serviço apagado). Tudo numa transação: se qualquer passo falhar, nada é
 * apagado.
 *
 * O QUE ELE DELIBERADAMENTE NÃO FAZ
 *
 *   - NÃO grava `senhaHash`. `POST /api/auth/login` devolve um JWT de 7 dias a
 *     qualquer usuário que tenha senha; dar senha a uma conta de teste abriria
 *     um caminho de autenticação paralelo em produção. As contas entram pelo
 *     mesmo OAuth de todo mundo: o `findOrCreateOAuthUser` vincula por e-mail,
 *     então o primeiro login com o Google encontra a conta já pronta.
 *     Ver prisma/marcar-contas-demo.ts, que recusa o mesmo pelo mesmo motivo.
 *
 *   - NÃO escreve `contaDemo`. O único escritor desse campo continua sendo
 *     marcar-contas-demo.ts (ver lib/contaDemo.ts). Se as contas precisarem dos
 *     portões de revisão de loja, rode aquele script depois — são coisas
 *     diferentes e é bom que continuem separadas.
 *
 *   - NÃO grava CPF nem data de nascimento. São dados pessoais reais e não
 *     entram num arquivo versionado. Consequência conhecida: no primeiro login
 *     o app mostra o DadosPessoaisGate e a própria pessoa preenche.
 *
 *   - NÃO copia o `docUrl` do banco local. Lá ele guarda chaves do S3
 *     escopadas pelo id LOCAL do usuário e apontando para o bucket de
 *     desenvolvimento: em produção esse documento não abriria, ou abriria o de
 *     outra pessoa. Grava-se um marcador dizendo o que a linha é de verdade —
 *     uma verificação semeada, não revisada por ninguém.
 *
 * USO
 *
 *   # 1. Sempre primeiro: relatório, sem escrever nada.
 *   DATABASE_URL='...' npx tsx prisma/preparar-contas-teste-prod.ts
 *
 *   # 2. Só depois de ler o relatório acima:
 *   DATABASE_URL='...' CONFIRMAR=APAGAR-E-SEMEAR \
 *     npx tsx prisma/preparar-contas-teste-prod.ts --apply
 *
 * Idempotente: re-rodar atualiza as três contas e não duplica nada.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const datasourceUrl = process.env.DATABASE_URL;
if (!datasourceUrl) {
  throw new Error("DATABASE_URL is not set");
}

const pool = new pg.Pool({ connectionString: datasourceUrl });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

/** Aborto previsto (não é bug): nada foi escrito quando isto sobe. */
class AbortoControlado extends Error {}
function abort(mensagem: string): never {
  throw new AbortoControlado(mensagem);
}

/**
 * Dry-run é o PADRÃO aqui, ao contrário do seed-prod. Este script apaga: o
 * caminho seguro tem que ser o que se alcança sem pensar, e o destrutivo tem
 * que exigir dois gestos deliberados (--apply e a confirmação por env).
 */
const APLICAR = process.argv.includes("--apply");
const CONFIRMACAO_ESPERADA = "APAGAR-E-SEMEAR";

/** Só o host, nunca a credencial. */
function hostMascarado(url: string): string {
  const m = url.match(/^[a-z]+:\/\/[^@]*@([^/:?]+)/i);
  return m ? m[1] : "(host ilegível)";
}

const PRESERVAR_EMAILS = (process.env.PRESERVAR_EMAILS ?? "victordev.tec@gmail.com")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

/** Cidade piloto: onde as três contas atendem. Igual ao seed-prod. */
const CIDADE = process.env.PILOT_CITY?.trim() || "Água Boa";
const UF = (process.env.PILOT_UF?.trim() || "MT").toUpperCase();
/** Bairro ao qual a profissional é vinculada. Precisa JÁ existir. */
const BAIRRO_NOME = process.env.BAIRRO_NOME?.trim() || "";

/**
 * Marcador no lugar do documento. Quem abrir a verificação no painel precisa
 * ver o que ela é: semeada, não revisada.
 */
const DOC_SEMEADO = JSON.stringify({
  origem: "conta de teste semeada por prisma/preparar-contas-teste-prod.ts",
  documento: "não enviado — a verificação foi concedida pelo seed, sem análise",
});
const NOTA_SEMEADA =
  "Verificação concedida por seed de conta de teste. Nenhum documento foi analisado.";

type Conta = {
  email: string;
  nome: string;
  telefone: string;
  genero: "MASCULINO" | "FEMININO";
  role: "EMPREGADOR" | "DIARISTA" | "MONTADOR";
  docType: string;
  bio?: string;
  especialidades?: string[];
  servicosOferecidos?: string[];
  precoLeve?: number;
  precoPesada?: number;
};

/** Fiel ao que existe no banco local, campo a campo. */
const CONTAS: Conta[] = [
  {
    email: "usuarioempregador@gmail.com",
    nome: "Victor santos lima",
    telefone: "66981309903",
    genero: "MASCULINO",
    role: "EMPREGADOR",
    docType: "EMPREGADOR_KYC",
  },
  {
    email: "usuarioprofissonalcasa@gmail.com",
    nome: "Josafa pereira reis",
    telefone: "55999842393",
    genero: "MASCULINO",
    role: "DIARISTA",
    docType: "KYC_DOCS",
    bio: "Sou profissional com experiência, amo oque faço e faço com dedicação! Obrigado pela preferência dos meus serviços.",
    servicosOferecidos: ["DIARISTA"],
    precoLeve: 10000,
    precoPesada: 20000,
  },
  {
    email: "montadorusuario@gmail.com",
    nome: "Jacirene Barbosa santos",
    telefone: "55999846554",
    genero: "FEMININO",
    role: "MONTADOR",
    docType: "MONTADOR_KYC",
    bio: "Olá eu sou um montador da cidade e trabalho com móveis a mais de 5 anos, tenho bastante experiência e capacidade para executar seu serviço com sucesso e ótima qualidade!",
    especialidades: ["montagem", "reparos", "eletrica", "hidraulica", "pintura", "carpintaria"],
  },
];

async function main() {
  console.log(`Banco: ${hostMascarado(datasourceUrl!)}`);
  console.log(`Modo:  ${APLICAR ? "APLICAR (escreve e APAGA)" : "DRY RUN (só leitura)"}\n`);

  if (APLICAR && process.env.CONFIRMAR !== CONFIRMACAO_ESPERADA) {
    abort(
      `--apply exige CONFIRMAR=${CONFIRMACAO_ESPERADA}. ` +
        "Rode sem --apply primeiro e leia o relatório. Nenhum dado foi alterado.",
    );
  }

  // ── Guarda: a conta preservada precisa existir ──────────────────────────────
  // Se ela não está aqui, ou o e-mail está errado ou este não é o banco que se
  // pensa que é. Nos dois casos, apagar seria o pior desfecho possível.
  const preservados = await prisma.user.findMany({
    where: { OR: [{ email: { in: PRESERVAR_EMAILS } }, { role: "ADMIN" }] },
    select: { id: true, email: true, role: true },
  });
  if (preservados.length === 0) {
    abort(
      `Nenhum usuário preservado encontrado (${PRESERVAR_EMAILS.join(", ")} ou papel ADMIN). ` +
        "Ou o e-mail está errado, ou este não é o banco esperado. Nenhum dado foi alterado.",
    );
  }
  const idsPreservados = preservados.map((u) => u.id);
  console.log("Preservados:");
  for (const u of preservados) console.log(`  ${u.role ?? "(sem papel)"}  ${u.email ?? u.id}`);

  // ── Inventário ──────────────────────────────────────────────────────────────
  const alvo = { id: { notIn: idsPreservados } };
  const [usuarios, servicos, incidentes, safeScores, scoreEventos, safeScoreEventos, mensagens, total] =
    await Promise.all([
      prisma.user.count({ where: alvo }),
      prisma.servico.count(),
      prisma.incidentReport.count(),
      prisma.safeScore.count({ where: { userId: { notIn: idsPreservados } } }),
      prisma.scoreEvento.count({ where: { safeScore: { userId: { notIn: idsPreservados } } } }),
      prisma.safeScoreEvent.count({ where: { userId: { notIn: idsPreservados } } }),
      prisma.chatMessage.count(),
      prisma.user.count(),
    ]);

  console.log("\nInventário:");
  console.log(`  usuários no total ........ ${total}`);
  console.log(`  usuários a APAGAR ....... ${usuarios}`);
  console.log(`  serviços a APAGAR ....... ${servicos}`);
  console.log(`  incidentes a APAGAR ..... ${incidentes}`);
  console.log(`  safeScores a APAGAR ..... ${safeScores}`);
  console.log(`  scoreEventos a APAGAR ... ${scoreEventos}`);
  console.log(`  eventos SafeScore v2 .... ${safeScoreEventos}`);
  console.log(`  mensagens (via cascata) . ${mensagens}`);

  // ── Bairro da profissional ──────────────────────────────────────────────────
  // Resolvido, nunca criado: inventar bairro em produção mudaria a área de
  // cobertura da operação sem ninguém decidir isso.
  const bairro = BAIRRO_NOME
    ? await prisma.bairro.findFirst({
        where: { nome: BAIRRO_NOME, cidade: CIDADE, uf: UF },
        select: { id: true, nome: true },
      })
    : await prisma.bairro.findFirst({
        where: { cidade: CIDADE, uf: UF },
        orderBy: { nome: "asc" },
        select: { id: true, nome: true },
      });

  if (!bairro) {
    abort(
      `Nenhum bairro encontrado em ${CIDADE}/${UF}` +
        (BAIRRO_NOME ? ` com o nome "${BAIRRO_NOME}"` : "") +
        ". Rode o seed de bairros (npm run seed:prod com PILOT_BAIRROS) antes. " +
        "Nenhum dado foi alterado.",
    );
  }
  console.log(`\nBairro da profissional: ${bairro.nome} (${CIDADE}/${UF})`);

  console.log("\nContas a semear:");
  for (const c of CONTAS) console.log(`  ${c.role.padEnd(11)} ${c.email}`);

  if (!APLICAR) {
    console.log(
      "\nDRY RUN — nada foi alterado. Para executar de verdade:\n" +
        `  CONFIRMAR=${CONFIRMACAO_ESPERADA} npx tsx prisma/preparar-contas-teste-prod.ts --apply`,
    );
    return;
  }

  // ── Execução ────────────────────────────────────────────────────────────────
  await prisma.$transaction(
    async (tx) => {
      // 1) Filhos do SafeScore (legado). RESTRICT: seguram o passo 2.
      const se = await tx.scoreEvento.deleteMany({
        where: { safeScore: { userId: { notIn: idsPreservados } } },
      });

      // 2) SafeScore legado.
      const ss = await tx.safeScore.deleteMany({ where: { userId: { notIn: idsPreservados } } });

      // 3) Eventos do SafeScore v2. RESTRICT sobre SafeScoreProfile — que é
      //    CASCADE a partir de User. Sem apagar aqui, o passo 7 falharia.
      const sse = await tx.safeScoreEvent.deleteMany({
        where: { userId: { notIn: idsPreservados } },
      });

      // 4) Denúncia inteira: referencia dois usuários e não faz sentido sem eles.
      //    IncidentAttachment vai por cascata.
      const inc = await tx.incidentReport.deleteMany({
        where: {
          OR: [
            { reportedById: { notIn: idsPreservados } },
            { reportedUserId: { notIn: idsPreservados } },
          ],
        },
      });

      // 5) Serviços: derrubam ChatRoom → ChatMessage em cascata, além de
      //    ServicoEvento, Avaliacao, AvaliacaoEmpregador, PaymentEvent e
      //    PixSnapshot.
      const srv = await tx.servico.deleteMany({
        where: {
          OR: [
            { clientId: { notIn: idsPreservados } },
            { diaristaId: { notIn: idsPreservados } },
            { montadorId: { notIn: idsPreservados } },
          ],
        },
      });

      // 6) Sobra do passo 5: mensagem enviada em sala que não foi apagada.
      const msg = await tx.chatMessage.deleteMany({
        where: { senderId: { notIn: idsPreservados } },
      });

      // 7) Usuários. O resto (perfis, OAuth, notificações, assinatura,
      //    SafeScoreProfile…) vai por cascata — ver o mapa no cabeçalho.
      const usr = await tx.user.deleteMany({ where: { id: { notIn: idsPreservados } } });

      console.log("\nApagado:");
      console.log(`  scoreEventos ....... ${se.count}`);
      console.log(`  safeScores ......... ${ss.count}`);
      console.log(`  eventos v2 ......... ${sse.count}`);
      console.log(`  incidentes ......... ${inc.count}`);
      console.log(`  serviços ........... ${srv.count}`);
      console.log(`  mensagens .......... ${msg.count}`);
      console.log(`  usuários ........... ${usr.count}`);

      // ── Semeadura ─────────────────────────────────────────────────────────
      for (const c of CONTAS) {
        const user = await tx.user.upsert({
          where: { email: c.email },
          update: { nome: c.nome, telefone: c.telefone, genero: c.genero, role: c.role },
          create: {
            nome: c.nome,
            email: c.email,
            telefone: c.telefone,
            genero: c.genero,
            role: c.role,
          },
          select: { id: true },
        });

        if (c.role === "EMPREGADOR") {
          await tx.empregadorPerfil.upsert({
            where: { userId: user.id },
            update: { cidade: CIDADE, estado: UF, ativo: true },
            create: { userId: user.id, cidade: CIDADE, estado: UF, ativo: true },
          });
        }

        if (c.role === "DIARISTA") {
          const perfil = await tx.diaristaProfile.upsert({
            where: { userId: user.id },
            update: {
              bio: c.bio,
              cidade: CIDADE,
              estado: UF,
              ativo: true,
              atendeTodaCidade: true,
              precoLeve: c.precoLeve ?? 0,
              precoPesada: c.precoPesada ?? 0,
              valorACombinar: false,
              servicosOferecidos: c.servicosOferecidos ?? [],
              verificacao: "VERIFICADO",
            },
            create: {
              userId: user.id,
              bio: c.bio,
              cidade: CIDADE,
              estado: UF,
              ativo: true,
              atendeTodaCidade: true,
              precoLeve: c.precoLeve ?? 0,
              precoPesada: c.precoPesada ?? 0,
              valorACombinar: false,
              servicosOferecidos: c.servicosOferecidos ?? [],
              verificacao: "VERIFICADO",
            },
            select: { id: true },
          });

          // Sem bairro vinculado a completude ainda passa (atendeTodaCidade +
          // cidade/estado), mas a busca por bairro não a encontraria.
          await tx.diaristaBairro.upsert({
            where: { diaristaId_bairroId: { diaristaId: perfil.id, bairroId: bairro.id } },
            update: {},
            create: { diaristaId: perfil.id, bairroId: bairro.id },
          });
        }

        if (c.role === "MONTADOR") {
          await tx.montadorPerfil.upsert({
            where: { userId: user.id },
            update: {
              bio: c.bio,
              especialidades: c.especialidades ?? [],
              cidade: CIDADE,
              estado: UF,
              ativo: true,
              atendeTodaCidade: true,
              bairros: [`${CIDADE} (${UF})`],
              verificado: true,
            },
            create: {
              userId: user.id,
              bio: c.bio,
              especialidades: c.especialidades ?? [],
              cidade: CIDADE,
              estado: UF,
              ativo: true,
              atendeTodaCidade: true,
              bairros: [`${CIDADE} (${UF})`],
              verificado: true,
            },
          });
        }

        // Verificação documental: uma linha por conta, marcada como semeada.
        const jaTem = await tx.documentVerification.findFirst({
          where: { userId: user.id, docType: c.docType },
          select: { id: true },
        });
        if (jaTem) {
          await tx.documentVerification.update({
            where: { id: jaTem.id },
            data: { status: "APPROVED", docUrl: DOC_SEMEADO, reviewNote: NOTA_SEMEADA },
          });
        } else {
          await tx.documentVerification.create({
            data: {
              userId: user.id,
              docType: c.docType,
              docUrl: DOC_SEMEADO,
              status: "APPROVED",
              reviewNote: NOTA_SEMEADA,
            },
          });
        }

        console.log(`  semeado: ${c.role.padEnd(11)} ${c.email}`);
      }
    },
    { timeout: 120_000 },
  );

  const restantes = await prisma.user.count();
  console.log(`\nConcluído. Usuários na base: ${restantes}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    await pool.end();
  })
  .catch(async (e: any) => {
    if (e instanceof AbortoControlado) {
      console.error(`\n✖ ${e.message}`);
    } else {
      console.error(
        "\n✖ Erro inesperado. A transação foi revertida; nenhum dado foi alterado.",
      );
      console.error(e);
    }
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  });
