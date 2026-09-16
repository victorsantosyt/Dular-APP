import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mockPrisma, resetMockPrisma } from "./_mocks";

/**
 * Só perfil VERIFICADO aparece na busca — e a regra tem que estar no `where`.
 *
 * Uma auditoria deste projeto concluiu que a busca de montadores NÃO filtrava
 * verificação, porque olhou o `where` e o filtro estava doze linhas abaixo,
 * num `.filter()` em JS. O comportamento estava certo e o diagnóstico errado.
 *
 * Estes testes fixam as duas coisas: que o filtro EXISTE e que ele está na
 * consulta. Filtro pós-query, além de invisível na leitura, rodava depois do
 * `take: 300` — passando disso, não verificados consumiriam slots do limite e
 * esconderiam verificados.
 */

async function getBuscaMontadores() {
  const mod = await import("../../src/app/api/montadores/buscar/route");
  return mod.GET;
}

/** Captura o `where` que a busca envia ao Prisma. */
function capturarWhere() {
  let capturado: Record<string, unknown> | null = null;
  mockPrisma.montadorPerfil.findMany = async (args: any) => {
    capturado = args?.where ?? null;
    return [];
  };
  return () => capturado;
}

describe("busca de profissionais — verificação filtra no where", () => {
  beforeEach(() => resetMockPrisma());

  it("montador: a verificação está no WHERE, não em filtro pós-query", async () => {
    const where = capturarWhere();
    mockPrisma.safeScoreProfile.findMany = async () => [];

    const GET = await getBuscaMontadores();
    await GET(new Request("http://test/api/montadores/buscar?cidade=Cuiaba&uf=MT"));

    const w = where();
    assert.ok(w, "a busca precisa enviar um where");

    const ors = (w!.OR ?? []) as Record<string, unknown>[];
    assert.ok(
      ors.some((c) => c.verificado === true),
      "não verificado tem que ser excluído na consulta",
    );
  });

  it("montador: a conta de demonstração passa sem verificação", async () => {
    // Sem isto o revisor da loja não avalia o perfil montador: a conta demo
    // tem verificado=false e sumiria da busca.
    const where = capturarWhere();
    mockPrisma.safeScoreProfile.findMany = async () => [];

    const GET = await getBuscaMontadores();
    await GET(new Request("http://test/api/montadores/buscar?cidade=Cuiaba&uf=MT"));

    const ors = ((where()!.OR ?? []) as Record<string, any>[]);
    assert.ok(
      ors.some((c) => c.user?.is?.contaDemo === true),
      "a conta demo precisa continuar aparecendo",
    );
  });
});

describe("busca de diaristas — o filtro de verificação sobrevive ao filtro de tipo", () => {
  beforeEach(() => resetMockPrisma());

  /**
   * Regressão de um bug real: o `where` tinha DUAS chaves `OR` no mesmo
   * objeto — a da verificação e a do filtro de tipo. Em JavaScript a segunda
   * sobrescreve a primeira, então buscar com `?tipo=` apagava a verificação e
   * diarista NÃO VERIFICADA aparecia. Comprovado chamando a API antes da
   * correção; este teste existe para não voltar.
   */
  function capturarWhereDiaristas() {
    let capturado: Record<string, any> | null = null;
    mockPrisma.diaristaProfile.findMany = async (args: any) => {
      capturado = args?.where ?? null;
      return [];
    };
    return () => capturado;
  }

  function temFiltroDeVerificacao(where: Record<string, any> | null): boolean {
    const ands = (where?.AND ?? []) as Record<string, any>[];
    return ands.some((clausula) =>
      ((clausula.OR ?? []) as Record<string, any>[]).some(
        (c) => c.verificacao === "VERIFICADO",
      ),
    );
  }

  it("sem filtro de tipo, a verificação está no where", async () => {
    const where = capturarWhereDiaristas();
    mockPrisma.safeScoreProfile.findMany = async () => [];

    const mod = await import("../../src/app/api/diaristas/buscar/route");
    await mod.GET(new Request("http://test/api/diaristas/buscar?cidade=Agua%20Boa&uf=MT"));

    assert.ok(temFiltroDeVerificacao(where()), "verificação tem que filtrar");
  });

  it("COM filtro de tipo, a verificação CONTINUA no where", async () => {
    const where = capturarWhereDiaristas();
    mockPrisma.safeScoreProfile.findMany = async () => [];

    const mod = await import("../../src/app/api/diaristas/buscar/route");
    await mod.GET(
      new Request("http://test/api/diaristas/buscar?cidade=Agua%20Boa&uf=MT&tipo=FAXINA"),
    );

    const w = where();
    assert.ok(
      temFiltroDeVerificacao(w),
      "o filtro de tipo não pode apagar o de verificação",
    );
    // E o filtro de tipo continua valendo — a correção não pode ter comido ele.
    const ands = (w?.AND ?? []) as Record<string, any>[];
    assert.equal(ands.length, 2, "os dois filtros convivem dentro do AND");
  });
});

describe("AUTO_VERIFY_PROFILES — não pode existir caminho de verificação em massa", () => {
  const ORIGINAL = { ...process.env };

  function restaurar() {
    (process.env as Record<string, string | undefined>).NODE_ENV = ORIGINAL.NODE_ENV;
    process.env.AUTO_VERIFY_PROFILES = ORIGINAL.AUTO_VERIFY_PROFILES;
  }

  it("produção + flag ligada FALHA — não sobe com KYC comprometido", async () => {
    const { garantirAutoVerifyForaDeProducao } = await import("../../src/lib/autoVerificacao");
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    process.env.AUTO_VERIFY_PROFILES = "true";

    assert.throws(
      () => garantirAutoVerifyForaDeProducao(),
      /AUTO_VERIFY_PROFILES=true com NODE_ENV=production/,
      "subir com auto-verificação em produção é pior do que não subir",
    );
    restaurar();
  });

  it("o boot do servidor chama a trava", async () => {
    // A trava tem que rodar no START, não na primeira chamada da função: se
    // chegasse só na primeira verificação, o servidor já estaria no ar.
    const { register } = await import("../../src/instrumentation");
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    process.env.AUTO_VERIFY_PROFILES = "true";

    assert.throws(() => register(), /AUTO_VERIFY_PROFILES=true/);
    restaurar();
  });

  it("produção SEM a flag sobe normalmente", async () => {
    const { garantirAutoVerifyForaDeProducao } = await import("../../src/lib/autoVerificacao");
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    delete process.env.AUTO_VERIFY_PROFILES;

    assert.doesNotThrow(() => garantirAutoVerifyForaDeProducao());
    restaurar();
  });

  it("fora de produção a flag é permitida — é o caso de uso do E2E", async () => {
    const { garantirAutoVerifyForaDeProducao } = await import("../../src/lib/autoVerificacao");
    (process.env as Record<string, string | undefined>).NODE_ENV = "test";
    process.env.AUTO_VERIFY_PROFILES = "true";

    assert.doesNotThrow(() => garantirAutoVerifyForaDeProducao());
    restaurar();
  });
});
