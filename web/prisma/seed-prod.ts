import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { z } from "zod";
import { hashPassword } from "../src/lib/password";

/**
 * SEED DE PRODUÇÃO — Beta 0
 *
 * Cria somente o mínimo operacional, tudo parametrizado por env (nunca
 * credencial hardcoded, nunca usuário demo, nunca dado de teste):
 *   1. Admin inicial          — PROD_ADMIN_EMAIL + PROD_ADMIN_PASSWORD
 *   2. Bairros da cidade piloto — PILOT_CITY + PILOT_UF + PILOT_BAIRROS (CSV)
 *
 * O que NÃO é semeado, por decisão oficial do produto:
 *   - Categorias de serviço: são enums de código, não existe tabela a semear.
 *   - FeatureLimit: Beta 0 não monetiza; limites ficam inertes (Sprint 3).
 *
 * Idempotência: apenas upserts em chaves únicas. Re-execução não duplica
 * nada; para o admin, atualiza nome/senha (permite rotação de credencial
 * re-rodando com PROD_ADMIN_PASSWORD novo).
 *
 * Uso: npm run seed:prod  (exige as envs acima; aborta com erro claro sem elas)
 */

const datasourceUrl = process.env.DATABASE_URL;
if (!datasourceUrl) {
  throw new Error("DATABASE_URL is not set");
}

const pool = new pg.Pool({ connectionString: datasourceUrl });
const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
});

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} é obrigatória para o seed de produção`);
  }
  return value;
}

/**
 * Aborto controlado do seed: sinaliza uma condição de segurança prevista
 * (não é um bug). Lançado antes da transação, ou dentro dela (rollback),
 * de modo que nenhum dado é alterado quando ocorre.
 */
class SeedAbortError extends Error {}
function abort(message: string): never {
  throw new SeedAbortError(message);
}

// Modo simulação: `npm run seed:prod -- --dry-run` ou DRY_RUN=true.
// Executa somente LEITURAS e reporta o que a execução real faria.
const DRY_RUN = process.env.DRY_RUN === "true" || process.argv.includes("--dry-run");

async function main() {
  const t0 = Date.now();

  // ── Validação de envs (antes de qualquer conexão/escrita) ───────────────────
  // Normaliza o email (trim + minúsculas) ANTES de qualquer consulta:
  // /api/auth/login busca o email já em lowercase — "Admin@X.com" e
  // "admin@x.com" precisam resolver para a mesma conta.
  const normalizedEmail = requireEnv("PROD_ADMIN_EMAIL").trim().toLowerCase();
  // Formato validado com zod ANTES de qualquer conexão: um email malformado
  // criaria um admin impossível de logar.
  if (!z.email().safeParse(normalizedEmail).success) {
    abort(
      `PROD_ADMIN_EMAIL inválido ("${normalizedEmail}"). Informe um email válido. Nenhum dado foi alterado.`,
    );
  }
  const adminPassword = requireEnv("PROD_ADMIN_PASSWORD");
  // bcrypt opera em BYTES (limite 72) — validar em bytes, não em caracteres:
  // senhas com acento/emoji ocupam mais de 1 byte por caractere.
  const passwordBytes = Buffer.byteLength(adminPassword, "utf8");
  if (passwordBytes < 8) {
    abort("PROD_ADMIN_PASSWORD precisa ter no mínimo 8 bytes. Nenhum dado foi alterado.");
  }
  if (passwordBytes > 72) {
    abort("PROD_ADMIN_PASSWORD excede 72 bytes (limite do bcrypt). Use uma senha mais curta. Nenhum dado foi alterado.");
  }
  // Nome explícito é distinguido do default: numa reexecução (rotação de
  // senha), o nome só é sobrescrito se o operador o fornecer via env.
  const adminNomeEnv = process.env.PROD_ADMIN_NOME?.trim() || undefined;
  const adminNome = adminNomeEnv ?? "Admin Dular";
  const adminTelefone = process.env.PROD_ADMIN_TELEFONE?.trim() || undefined;

  // Bairros: validação all-or-none também antes da transação.
  const cidade = process.env.PILOT_CITY?.trim();
  const uf = process.env.PILOT_UF?.trim();
  const bairrosCsv = process.env.PILOT_BAIRROS?.trim();
  if ((cidade || uf || bairrosCsv) && !(cidade && uf && bairrosCsv)) {
    abort("Defina PILOT_CITY, PILOT_UF e PILOT_BAIRROS juntas (ou nenhuma). Nenhum dado foi alterado.");
  }
  const bairros =
    cidade && uf && bairrosCsv
      ? bairrosCsv.split(",").map((b) => b.trim()).filter(Boolean)
      : [];

  // ── DRY RUN: somente leituras; reporta o que a execução real faria ──────────
  if (DRY_RUN) {
    console.log("DRY RUN — nenhuma escrita será executada.\n");
    const existente = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { role: true },
    });
    if (existente && existente.role !== "ADMIN") {
      abort(
        `Já existe um usuário (não-admin) utilizando o email ${normalizedEmail}. ` +
          `A execução real seria ABORTADA. Nenhum dado foi alterado.`,
      );
    }
    if (adminTelefone) {
      const donoTelefone = await prisma.user.findUnique({
        where: { telefone: adminTelefone },
        select: { email: true },
      });
      if (donoTelefone && donoTelefone.email?.toLowerCase() !== normalizedEmail) {
        abort(
          `Já existe um usuário utilizando o telefone ${adminTelefone}. ` +
            `A execução real seria ABORTADA. Nenhum dado foi alterado.`,
        );
      }
    }
    const existentes = bairros.length
      ? await prisma.bairro.findMany({
          where: { cidade: cidade!, uf: uf!, nome: { in: bairros } },
          select: { nome: true },
        })
      : [];
    const jaExistem = new Set(existentes.map((b) => b.nome));
    const novos = bairros.filter((n) => !jaExistem.has(n));
    // Estimativa: extrapola o tempo das leituras para o nº de operações da
    // execução real (leituras + upsert do admin + upserts de bairros).
    const elapsed = Date.now() - t0;
    const opsDry = 2 + (bairros.length ? 1 : 0);
    const opsReal = opsDry + 1 + bairros.length;
    const estimativa = ((elapsed / opsDry) * opsReal) / 1000;

    console.log("=========================");
    console.log("DRY RUN");
    console.log("");
    console.log(`Admin: seria ${existente ? "ATUALIZADO (rotação de credencial)" : "CRIADO"}`);
    console.log(`Email: ${normalizedEmail}`);
    console.log(
      `Bairros: ${bairros.length} no CSV — ${novos.length} seriam criados, ${jaExistem.size} já existem`,
    );
    console.log(`Tempo estimado da execução real: ~${estimativa.toFixed(1)} s`);
    console.log("");
    console.log("Nenhuma alteração foi realizada.");
    console.log("=========================");
    return;
  }

  // Hash calculado FORA da transação (CPU, não precisa de banco → transação curta).
  const senhaHash = await hashPassword(adminPassword);

  // ── Tudo em UMA transação: aplica admin + bairros por completo, ou nada ──────
  const resultado = await prisma.$transaction(
    async (tx) => {
      // Guarda anti-sequestro: nunca promover/sobrescrever uma conta comum.
      const existente = await tx.user.findUnique({
        where: { email: normalizedEmail },
        select: { role: true },
      });
      if (existente && existente.role !== "ADMIN") {
        abort(
          `Já existe um usuário (não-admin) utilizando o email ${normalizedEmail}. ` +
            `O seed foi abortado. Nenhum dado foi alterado. ` +
            `Use um PROD_ADMIN_EMAIL exclusivo do administrador — o seed nunca promove uma conta existente a ADMIN.`,
        );
      }

      // Guarda anti-colisão de telefone: mensagem clara em vez de P2002 cru.
      if (adminTelefone) {
        const donoTelefone = await tx.user.findUnique({
          where: { telefone: adminTelefone },
          select: { email: true },
        });
        if (donoTelefone && donoTelefone.email?.toLowerCase() !== normalizedEmail) {
          abort(
            `Já existe um usuário utilizando o telefone ${adminTelefone}. ` +
              `O seed foi abortado. Nenhum dado foi alterado. ` +
              `Remova PROD_ADMIN_TELEFONE ou use um número livre.`,
          );
        }
      }

      // Aqui: ou não existe conta com esse email (create), ou já é ADMIN
      // (update = rotação de senha documentada). Nunca uma conta comum.
      // No update, sobrescrever apenas o que é intenção explícita do operador:
      // senhaHash sempre (é o propósito da reexecução); nome/telefone só se a
      // env correspondente foi fornecida — evita resetar para o default um
      // nome ajustado depois pelo painel. role:ADMIN é redundante (a guarda
      // acima garante que a linha já é ADMIN), mantido como invariante.
      const user = await tx.user.upsert({
        where: { email: normalizedEmail },
        update: {
          senhaHash,
          role: "ADMIN",
          ...(adminNomeEnv ? { nome: adminNomeEnv } : {}),
          ...(adminTelefone ? { telefone: adminTelefone } : {}),
        },
        create: {
          nome: adminNome,
          email: normalizedEmail,
          senhaHash,
          role: "ADMIN",
          ...(adminTelefone ? { telefone: adminTelefone } : {}),
        },
      });

      const bairrosExistentes = bairros.length
        ? await tx.bairro.findMany({
            where: { cidade: cidade!, uf: uf!, nome: { in: bairros } },
            select: { nome: true },
          })
        : [];
      const nomesExistentes = new Set(bairrosExistentes.map((b) => b.nome));

      for (const nome of bairros) {
        await tx.bairro.upsert({
          where: { nome_cidade_uf: { nome, cidade: cidade!, uf: uf! } },
          update: {},
          create: { nome, cidade: cidade!, uf: uf! },
        });
      }

      return {
        user,
        jaExistia: Boolean(existente),
        bairrosNovos: bairros.filter((n) => !nomesExistentes.has(n)).length,
      };
    },
    // 60s: ~20 roundtrips sequenciais (guardas + admin + até 17 bairros) da
    // máquina do operador até o Neon us-east-1, com possível cold start do
    // compute. É um TETO de segurança, não uma espera — no caminho feliz a
    // transação fecha em poucos segundos; o default de 5s é que seria curto.
    { timeout: 60_000 },
  );

  const segundos = ((Date.now() - t0) / 1000).toFixed(2);
  console.log("=========================");
  console.log("Seed concluído");
  console.log("");
  console.log(`Admin: ${resultado.jaExistia ? "atualizado" : "criado"}`);
  console.log(`Email: ${resultado.user.email}`);
  if (bairros.length) {
    console.log(
      `Bairros: ${bairros.length} em ${cidade}-${uf} ` +
        `(novos: ${resultado.bairrosNovos}, já existiam: ${bairros.length - resultado.bairrosNovos})`,
    );
  } else {
    console.log(
      "Bairros: 0 — defina PILOT_CITY/PILOT_UF/PILOT_BAIRROS (a busca por bairro depende disso)",
    );
  }
  console.log(`Tempo: ${segundos} s`);
  console.log("=========================");
}

main()
  .then(async () => {
    await prisma.$disconnect();
    await pool.end();
  })
  .catch(async (e: any) => {
    if (e instanceof SeedAbortError) {
      console.error(`\n✖ ${e.message}`);
    } else if (e?.code === "P2002") {
      // Backstop defensivo caso uma corrida escape das guardas acima.
      // meta.target pode vir como array de colunas (["telefone"]) ou como
      // nome do índice ("User_telefone_key"), dependendo do driver.
      const alvo = (
        Array.isArray(e?.meta?.target) ? e.meta.target.join(",") : String(e?.meta?.target ?? "")
      ).toLowerCase();
      const especifica = alvo.includes("telefone")
        ? "Telefone já utilizado por outro usuário."
        : alvo.includes("email")
          ? "Email já utilizado por outro usuário."
          : alvo.includes("cpf")
            ? "CPF já utilizado por outro usuário."
            : alvo.includes("bairro") || alvo.includes("nome")
              ? "Bairro duplicado."
              : `Conflito de valor único (${alvo || "campo único"}).`;
      console.error(
        `\n✖ ${especifica} O seed foi abortado e a transação revertida. ` +
          `Nenhum dado foi alterado.`,
      );
    } else {
      console.error(
        "\n✖ Erro inesperado no seed. A transação foi revertida; nenhum dado foi alterado.",
      );
      console.error(e);
    }
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  });
