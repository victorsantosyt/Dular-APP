/**
 * Catálogo de bairros do piloto, exclusivo de staging.
 * Fonte: dular-mobile/eas.json, build.homologacao.env (17 bairros).
 * Em web/, com as variáveis de staging carregadas:
 *   node prisma/seed-staging-bairros.mjs          # consulta, sem gravar
 *   node prisma/seed-staging-bairros.mjs --apply  # insere os ausentes
 * Não marca bancos, não cria usuários e não altera bairros existentes.
 */
import { pathToFileURL } from "node:url";

export const PILOT_CITY = "Água Boa";
export const PILOT_UF = "MT";
export const PILOT_NEIGHBORHOODS = Object.freeze([
  "Centro 1", "Centro 2", "Setor Noroeste", "Setor Cristalino", "Setor Norte",
  "Setor Rodoviário", "Jardim Tropical", "Jardim Primavera", "Jardim Planalto",
  "Araguaia Park", "Guarujá", "Guarujá Expansão", "Operário", "Luiz Costa",
  "Vila Nova", "Universitário", "Morada das Águas",
]);

async function confirmStaging(options) {
  const { confirmarBancoStaging } = await import("../scripts/staging/confirmar-banco.mjs");
  return confirmarBancoStaging(options);
}

async function createPrisma(connectionString) {
  const [{ PrismaClient }, { PrismaPg }] = await Promise.all([
    import("@prisma/client"), import("@prisma/adapter-pg"),
  ]);
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

export async function seedStagingBairros({
  apply = false, env = process.env, confirm = confirmStaging,
  createClient = createPrisma, log = console.log,
} = {}) {
  // O guard exige ambiente, host, URLs do mesmo banco e marca no PostgreSQL.
  await confirm({ env, marcar: false });
  const prisma = await createClient(env.DATABASE_URL_UNPOOLED);
  try {
    const existing = await prisma.bairro.findMany({
      where: { cidade: PILOT_CITY, uf: PILOT_UF }, select: { nome: true },
    });
    const names = new Set(existing.map(({ nome }) => nome));
    const missing = PILOT_NEIGHBORHOODS.filter((name) => !names.has(name));
    log(`[staging:bairros] ${apply ? "Aplicação" : "Simulação"}: ${PILOT_CITY}/${PILOT_UF}; ` +
      `${PILOT_NEIGHBORHOODS.length} bairros previstos; ${missing.length} ausentes.`);
    if (!apply) {
      missing.forEach((name) => log(`[staging:bairros] Ausente: ${name}`));
      log("[staging:bairros] Nenhuma gravação. Para aplicar, execute com --apply.");
      return { applied: false, missing };
    }
    // Uma instrução só: a chave única (nome, cidade, uf) faz o skipDuplicates
    // preservar o que já existe. Os 17 upsert numa transação interativa
    // provavelmente passavam do tempo limite (P2028 não foi observado) do
    // Prisma (5 s) com a latência até o banco.
    await prisma.bairro.createMany({
      data: PILOT_NEIGHBORHOODS.map((nome) => ({ nome, cidade: PILOT_CITY, uf: PILOT_UF })),
      skipDuplicates: true,
    });
    // O count do createMany não prova o catálogo: relê o banco.
    const after = await prisma.bairro.findMany({
      where: { cidade: PILOT_CITY, uf: PILOT_UF }, select: { nome: true },
    });
    const present = new Set(after.map(({ nome }) => nome));
    const stillMissing = PILOT_NEIGHBORHOODS.filter((name) => !present.has(name));
    if (stillMissing.length > 0) {
      // Mensagem sem dado do driver: segura para exibir, como as das travas.
      const erro = new Error(`releitura: ${stillMissing.length} bairros ausentes após a gravação`);
      erro.falhaDeIdentidade = true;
      throw erro;
    }
    log(`[staging:bairros] Catálogo aplicado e relido: ${PILOT_NEIGHBORHOODS.length} de ` +
      `${PILOT_NEIGHBORHOODS.length} presentes; registros existentes preservados.`);
    return { applied: true, missing };
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--apply")) {
    console.error("[staging:bairros] Uso: node prisma/seed-staging-bairros.mjs [--apply]");
    process.exitCode = 1;
  } else {
    seedStagingBairros({ apply: args.includes("--apply") }).catch((error) => {
      // Erros do driver podem incluir credenciais; não imprimir o objeto bruto,
      // a mensagem nem a stack. Só a classe e o código do Prisma (ex.: P2028).
      const classe = /^[A-Za-z][A-Za-z0-9]{0,63}$/.test(error?.constructor?.name ?? "") ? error.constructor.name : null;
      const codigo = /^[A-Z][0-9]{4}$/.test(error?.code ?? "") ? error.code : null;
      const detalhe = [classe && `classe=${classe}`, codigo && `codigo=${codigo}`].filter(Boolean).join(", ");
      console.error(`[staging:bairros] RECUSADO: ${error?.falhaDeIdentidade
        ? error.message : `erro ao conferir ou aplicar o catálogo${detalhe ? ` (${detalhe})` : ""}; nenhuma confirmação de sucesso.`}`);
      process.exitCode = 1;
    });
  }
}
