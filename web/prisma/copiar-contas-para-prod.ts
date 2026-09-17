/**
 * Copia as três contas de teste de um banco para outro, campo a campo.
 *
 * POR QUE BANCO→BANCO, E NÃO DADOS NO SCRIPT
 *
 * A alternativa seria escrever os valores aqui dentro. Isso colocaria CPF, data
 * de nascimento e chave PIX num arquivo versionado no Git — dado pessoal real,
 * para sempre, em todo clone do repositório. Lendo da origem em tempo de
 * execução, nada disso passa pelo repositório, e a cópia sai fiel sem que eu
 * precise escolher quais colunas merecem ir.
 *
 * O QUE COPIA
 *
 *   User                 (menos senhaHash, contaDemo, id e timestamps)
 *   EmpregadorPerfil / DiaristaProfile / MontadorPerfil   (todos os campos)
 *   EnderecoUsuario, DiaristaHabilidade, Disponibilidade  (substitui o conjunto)
 *   PaymentInfo, DocumentVerification
 *
 * O QUE NÃO COPIA, E POR QUÊ
 *
 *   senhaHash — `POST /api/auth/login` devolve JWT de 7 dias a qualquer usuário
 *     com senha. Copiar abriria um caminho de autenticação paralelo em
 *     produção. As contas entram pelo mesmo OAuth de todo mundo, que vincula
 *     por e-mail. É a mesma recusa de prisma/marcar-contas-demo.ts.
 *
 *   contaDemo — o único escritor desse campo continua sendo aquele script
 *     (ver lib/contaDemo.ts). Não é "dado da conta", é concessão de portão.
 *
 *   id e timestamps — o destino já tem as contas, com ids próprios. O upsert é
 *     por e-mail; preservar id da origem não traz nada e quebraria referências.
 *
 * ARQUIVOS NO S3
 *
 * Avatar vem em base64 dentro do banco: é portável, vai junto. Portfólio, fotos
 * e documentos são CHAVES do S3 — só funcionam se origem e destino usarem o
 * mesmo bucket. Confirmado com o dono em 17/09/2026: é o mesmo. Se um dia
 * deixar de ser, estas colunas passam a apontar para arquivo que não abre.
 *
 * BAIRRO
 *
 * `DiaristaBairro` liga por id, e o id do bairro na origem não existe no
 * destino. O vínculo é refeito resolvendo o bairro por (nome, cidade, uf). Não
 * encontrando, o que já está no destino é mantido e o caso é relatado — criar
 * bairro mudaria a área de cobertura da operação sem ninguém decidir.
 *
 * USO
 *
 *   # 1. Relatório, sem escrever nada:
 *   DESTINO_DATABASE_URL='postgres://...prod...' \
 *     npx tsx prisma/copiar-contas-para-prod.ts
 *
 *   # 2. Só depois de ler o relatório:
 *   DESTINO_DATABASE_URL='postgres://...prod...' CONFIRMAR=COPIAR \
 *     npx tsx prisma/copiar-contas-para-prod.ts --apply
 *
 * A origem é a DATABASE_URL do ambiente (o banco local), ou ORIGEM_DATABASE_URL.
 * Idempotente: re-rodar atualiza as mesmas contas.
 */
import dotenv from "dotenv";
import { Prisma, PrismaClient } from "@prisma/client";

// `dotenv/config` lê SÓ `.env`, e a DATABASE_URL do banco local mora em
// `.env.local` — que o Next carrega e o dotenv puro ignora. Sem isto o script
// sobe sem origem e morre na validação, que foi o que aconteceu na primeira
// tentativa real.
//
// A ordem importa: o dotenv não sobrescreve variável já definida, então o
// primeiro arquivo carregado vence. Carregar `.env.local` antes de `.env`
// reproduz a precedência do Next, onde o local manda.
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const URL_ORIGEM = process.env.ORIGEM_DATABASE_URL ?? process.env.DATABASE_URL;
const URL_DESTINO = process.env.DESTINO_DATABASE_URL;

class AbortoControlado extends Error {}
function abort(mensagem: string): never {
  throw new AbortoControlado(mensagem);
}

if (!URL_ORIGEM) throw new Error("DATABASE_URL (origem) não definida");
if (!URL_DESTINO) throw new Error("DESTINO_DATABASE_URL não definida");

function hostDe(url: string): string {
  const m = url.match(/^[a-z]+:\/\/[^@]*@([^/:?]+)/i);
  return m ? m[1] : "(host ilegível)";
}

if (hostDe(URL_ORIGEM) === hostDe(URL_DESTINO)) {
  throw new Error("Origem e destino são o mesmo host. Nada a copiar.");
}

const APLICAR = process.argv.includes("--apply");
const CONFIRMACAO = "COPIAR";

const poolOrigem = new pg.Pool({ connectionString: URL_ORIGEM });
const poolDestino = new pg.Pool({ connectionString: URL_DESTINO });
const origem = new PrismaClient({ adapter: new PrismaPg(poolOrigem) });
const destino = new PrismaClient({ adapter: new PrismaPg(poolDestino) });

const EMAILS = [
  "usuarioempregador@gmail.com",
  "usuarioprofissonalcasa@gmail.com",
  "montadorusuario@gmail.com",
];

/** Tira o que não deve atravessar: chave primária, carimbos e o userId antigo. */
function semChaves<T extends Record<string, any>>(linha: T) {
  const { id: _id, userId: _u, createdAt: _c, updatedAt: _up, ...resto } = linha;
  return resto;
}

async function main() {
  console.log(`Origem : ${hostDe(URL_ORIGEM!)}`);
  console.log(`Destino: ${hostDe(URL_DESTINO!)}`);
  console.log(`Modo   : ${APLICAR ? "APLICAR (escreve no destino)" : "DRY RUN (só leitura)"}\n`);

  if (APLICAR && process.env.CONFIRMAR !== CONFIRMACAO) {
    abort(`--apply exige CONFIRMAR=${CONFIRMACAO}. Rode sem --apply primeiro. Nada foi alterado.`);
  }

  for (const email of EMAILS) {
    const u = await origem.user.findUnique({
      where: { email },
      include: {
        empregadorPerfil: true,
        diaristaProfile: { include: { bairros: { include: { bairro: true } }, agenda: true } },
        montadorPerfil: true,
        enderecos: true,
        habilidades: true,
        paymentInfo: true,
        documentVerifications: true,
      },
    });

    if (!u) {
      console.log(`✖ ${email} — não existe na ORIGEM, pulando\n`);
      continue;
    }

    const noDestino = await destino.user.findUnique({ where: { email }, select: { id: true } });

    console.log(`${email}`);
    console.log(`  papel .................. ${u.role ?? "(sem papel)"}`);
    console.log(`  cpf / nascimento ....... ${u.cpf ? "sim" : "não"} / ${u.dataNascimento ? "sim" : "não"}`);
    console.log(`  avatar ................. ${u.avatarUrl ? `sim (${u.avatarUrl.slice(0, 22)}…)` : "não"}`);
    console.log(`  endereços .............. ${u.enderecos.length}`);
    console.log(`  habilidades ............ ${u.habilidades.length}`);
    console.log(`  agenda ................. ${u.diaristaProfile?.agenda.length ?? 0}`);
    console.log(`  dados de pagamento ..... ${u.paymentInfo ? "sim" : "não"}`);
    console.log(`  verificações ........... ${u.documentVerifications.length}`);
    if (u.diaristaProfile) {
      console.log(
        `  reputação .............. nota ${u.diaristaProfile.notaMedia} em ${u.diaristaProfile.totalServicos} serviços` +
          " ← vem da origem; no destino não há serviço nenhum por trás",
      );
    }
    if (u.montadorPerfil) {
      console.log(
        `  reputação .............. nota ${u.montadorPerfil.rating} em ${u.montadorPerfil.totalServicos} serviços` +
          " ← idem",
      );
    }
    console.log(`  no destino ............. ${noDestino ? "já existe, será atualizada" : "será criada"}`);

    if (!APLICAR) {
      console.log("");
      continue;
    }

    await destino.$transaction(
      async (tx) => {
        // senhaHash e contaDemo ficam de fora — ver cabeçalho.
        const dadosUser = {
          nome: u.nome,
          telefone: u.telefone,
          cpf: u.cpf,
          dataNascimento: u.dataNascimento,
          genero: u.genero,
          role: u.role,
          status: u.status,
          avatarUrl: u.avatarUrl,
          scoreAtual: u.scoreAtual,
          riskScore: u.riskScore,
          riskTier: u.riskTier,
          riskBand: u.riskBand,
          emObservacao: u.emObservacao,
        };

        const alvo = await tx.user.upsert({
          where: { email },
          update: dadosUser,
          create: { email, ...dadosUser },
          select: { id: true },
        });

        if (u.empregadorPerfil) {
          const d = semChaves(u.empregadorPerfil);
          await tx.empregadorPerfil.upsert({
            where: { userId: alvo.id },
            update: d,
            create: { userId: alvo.id, ...d },
          });
        }

        if (u.diaristaProfile) {
          const { bairros: _b, agenda: _a, ...perfil } = u.diaristaProfile;
          const d = semChaves(perfil);
          const criado = await tx.diaristaProfile.upsert({
            where: { userId: alvo.id },
            update: d,
            create: { userId: alvo.id, ...d },
            select: { id: true },
          });

          // Conjunto substituído por inteiro: é o que mantém a re-execução
          // idempotente sem acumular linha órfã.
          await tx.disponibilidade.deleteMany({ where: { diaristaId: criado.id } });
          if (u.diaristaProfile.agenda.length > 0) {
            await tx.disponibilidade.createMany({
              data: u.diaristaProfile.agenda.map((a) => ({
                diaristaId: criado.id,
                diaSemana: a.diaSemana,
                turno: a.turno,
                ativo: a.ativo,
              })),
            });
          }

          // Bairro por NOME: o id da origem não existe aqui.
          const nomes = u.diaristaProfile.bairros.map((v) => v.bairro);
          const resolvidos: string[] = [];
          const naoEncontrados: string[] = [];
          for (const b of nomes) {
            const achado = await tx.bairro.findFirst({
              where: { nome: b.nome, cidade: b.cidade, uf: b.uf },
              select: { id: true },
            });
            if (achado) resolvidos.push(achado.id);
            else naoEncontrados.push(`${b.nome} (${b.cidade}/${b.uf})`);
          }
          if (resolvidos.length > 0) {
            await tx.diaristaBairro.deleteMany({ where: { diaristaId: criado.id } });
            for (const bairroId of resolvidos) {
              await tx.diaristaBairro.create({ data: { diaristaId: criado.id, bairroId } });
            }
          }
          if (naoEncontrados.length > 0) {
            console.log(
              `  ⚠ bairro não existe no destino: ${naoEncontrados.join(", ")} — vínculo atual mantido`,
            );
          }
        }

        if (u.montadorPerfil) {
          const { precosEspecialidades, ...resto } = semChaves(u.montadorPerfil);
          // `precosEspecialidades` é uma coluna Json?. A leitura devolve `null`,
          // mas a escrita recusa `null`: para gravar SQL NULL numa coluna Json o
          // Prisma exige `Prisma.DbNull` — `null` ali significaria o valor JSON
          // `null`, que é outra coisa. Repassar o valor lido direto não compila.
          const d = {
            ...resto,
            precosEspecialidades:
              precosEspecialidades === null
                ? Prisma.DbNull
                : (precosEspecialidades as Prisma.InputJsonValue),
          };
          await tx.montadorPerfil.upsert({
            where: { userId: alvo.id },
            update: d,
            create: { userId: alvo.id, ...d },
          });
        }

        await tx.enderecoUsuario.deleteMany({ where: { userId: alvo.id } });
        if (u.enderecos.length > 0) {
          await tx.enderecoUsuario.createMany({
            data: u.enderecos.map((e) => ({ userId: alvo.id, ...semChaves(e) })),
          });
        }

        await tx.diaristaHabilidade.deleteMany({ where: { diaristaId: alvo.id } });
        if (u.habilidades.length > 0) {
          await tx.diaristaHabilidade.createMany({
            data: u.habilidades.map((h) => ({
              diaristaId: alvo.id,
              tipo: h.tipo,
              categoria: h.categoria,
            })),
          });
        }

        if (u.paymentInfo) {
          const d = semChaves(u.paymentInfo);
          await tx.paymentInfo.upsert({
            where: { userId: alvo.id },
            update: d,
            create: { userId: alvo.id, ...d },
          });
        }

        // Substitui o marcador semeado pelas verificações reais da origem.
        await tx.documentVerification.deleteMany({ where: { userId: alvo.id } });
        for (const dv of u.documentVerifications) {
          await tx.documentVerification.create({
            data: { userId: alvo.id, ...semChaves(dv) },
          });
        }

        console.log("  ✔ copiada");
      },
      { timeout: 120_000 },
    );

    console.log("");
  }

  if (!APLICAR) {
    console.log(
      `DRY RUN — nada foi alterado no destino. Para copiar de verdade:\n` +
        `  CONFIRMAR=${CONFIRMACAO} npx tsx prisma/copiar-contas-para-prod.ts --apply`,
    );
  }
}

main()
  .then(async () => {
    await origem.$disconnect();
    await destino.$disconnect();
    await poolOrigem.end();
    await poolDestino.end();
  })
  .catch(async (e: any) => {
    if (e instanceof AbortoControlado) {
      console.error(`\n✖ ${e.message}`);
    } else if (e?.code === "P1001") {
      // Falha de conexão acontece ANTES de qualquer transação. Dizer aqui que
      // "a transação foi revertida" descreveria algo que nunca existiu.
      console.error(
        "\n✖ Não foi possível conectar ao banco de DESTINO. Nada foi lido nem escrito.\n" +
          "  Confira a DESTINO_DATABASE_URL — o `vercel env pull` grava [SENSITIVE]\n" +
          "  no lugar de variáveis marcadas como secretas.",
      );
    } else {
      // A cópia é conta a conta: cada uma tem a própria transação. Um erro na
      // terceira não desfaz as duas primeiras, e prometer o contrário faria
      // alguém parar de investigar um destino que ficou pela metade.
      console.error(
        "\n✖ Erro inesperado. A conta em andamento foi revertida por inteiro;\n" +
          "  as contas copiadas antes dela PERMANECEM no destino.\n" +
          "  Re-rodar é seguro: o script é idempotente.",
      );
      console.error(e);
    }
    await origem.$disconnect();
    await destino.$disconnect();
    await poolOrigem.end();
    await poolDestino.end();
    process.exit(1);
  });
