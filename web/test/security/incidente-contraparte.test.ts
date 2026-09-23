import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  resolverContraparte,
  respostaDeRecusa,
  type ServicoPartes,
} from "../../src/lib/incidenteContraparte";

/**
 * Contra quem uma denúncia pode ser registrada.
 *
 * O cliente manda `reportedUserId`, e é tentador acreditar nele: ele veio da
 * tela que acabou de mostrar o nome da pessoa. Mas quem decide é o serviço no
 * banco — senão qualquer um denuncia qualquer um trocando um id no payload.
 *
 * O outro lado do mesmo problema é a mensagem: antes toda recusa virava o mesmo
 * 403 "Acesso negado ao serviço informado", inclusive quando nenhum serviço
 * havia sido informado. Recusa que mente sobre o motivo atrapalha quem integra
 * e esconde bug.
 */

const EMPREGADOR = "user-empregador";
const DIARISTA = "user-diarista";
const MONTADOR = "user-montador";
const ESTRANHO = "user-estranho";

const SERVICO_DIARISTA: ServicoPartes = {
  clientId: EMPREGADOR,
  diaristaId: DIARISTA,
  montadorId: null,
};

const SERVICO_MONTADOR: ServicoPartes = {
  clientId: EMPREGADOR,
  diaristaId: null,
  montadorId: MONTADOR,
};

describe("resolverContraparte — caminho feliz por papel", () => {
  it("Empregador → Diarista", () => {
    const r = resolverContraparte({
      reporterId: EMPREGADOR,
      serviceId: "svc-1",
      servico: SERVICO_DIARISTA,
    });
    assert.deepEqual(r, { ok: true, reportedUserId: DIARISTA });
  });

  it("Empregador → Montador", () => {
    const r = resolverContraparte({
      reporterId: EMPREGADOR,
      serviceId: "svc-2",
      servico: SERVICO_MONTADOR,
    });
    assert.deepEqual(r, { ok: true, reportedUserId: MONTADOR });
  });

  it("Diarista → Empregador", () => {
    const r = resolverContraparte({
      reporterId: DIARISTA,
      serviceId: "svc-1",
      servico: SERVICO_DIARISTA,
    });
    assert.deepEqual(r, { ok: true, reportedUserId: EMPREGADOR });
  });

  it("Montador → Empregador", () => {
    const r = resolverContraparte({
      reporterId: MONTADOR,
      serviceId: "svc-2",
      servico: SERVICO_MONTADOR,
    });
    assert.deepEqual(r, { ok: true, reportedUserId: EMPREGADOR });
  });

  it("reportedUserId correto enviado pelo cliente é aceito", () => {
    const r = resolverContraparte({
      reporterId: EMPREGADOR,
      reportedUserId: MONTADOR,
      serviceId: "svc-2",
      servico: SERVICO_MONTADOR,
    });
    assert.deepEqual(r, { ok: true, reportedUserId: MONTADOR });
  });
});

describe("resolverContraparte — recusas", () => {
  it("serviceId ausente não vira 403 genérico", () => {
    const r = resolverContraparte({ reporterId: EMPREGADOR, servico: SERVICO_DIARISTA });
    assert.deepEqual(r, { ok: false, motivo: "SEM_SERVICO" });
    assert.equal(respostaDeRecusa("SEM_SERVICO").status, 400);
  });

  it("serviço inexistente", () => {
    const r = resolverContraparte({ reporterId: EMPREGADOR, serviceId: "svc-x", servico: null });
    assert.deepEqual(r, { ok: false, motivo: "SERVICO_INEXISTENTE" });
    assert.equal(respostaDeRecusa("SERVICO_INEXISTENTE").status, 403);
  });

  it("quem não participa do serviço não denuncia", () => {
    const r = resolverContraparte({
      reporterId: ESTRANHO,
      serviceId: "svc-1",
      servico: SERVICO_DIARISTA,
    });
    assert.deepEqual(r, { ok: false, motivo: "NAO_PARTICIPANTE" });
    assert.equal(respostaDeRecusa("NAO_PARTICIPANTE").status, 403);
  });

  it("reportedUserId adulterado para terceiro é recusado", () => {
    const r = resolverContraparte({
      reporterId: EMPREGADOR,
      reportedUserId: ESTRANHO,
      serviceId: "svc-1",
      servico: SERVICO_DIARISTA,
    });
    assert.deepEqual(r, { ok: false, motivo: "CONTRAPARTE_INVALIDA" });
    assert.equal(respostaDeRecusa("CONTRAPARTE_INVALIDA").status, 403);
  });

  it("empregador não consegue denunciar a si mesmo trocando o id", () => {
    const r = resolverContraparte({
      reporterId: EMPREGADOR,
      reportedUserId: EMPREGADOR,
      serviceId: "svc-1",
      servico: SERVICO_DIARISTA,
    });
    assert.equal(r.ok, false);
  });

  it("profissional não consegue denunciar o outro profissional do serviço", () => {
    // O diarista só pode denunciar o cliente. Mandar o id do montador (de outro
    // serviço) não pode passar.
    const r = resolverContraparte({
      reporterId: DIARISTA,
      reportedUserId: MONTADOR,
      serviceId: "svc-1",
      servico: SERVICO_DIARISTA,
    });
    assert.deepEqual(r, { ok: false, motivo: "CONTRAPARTE_INVALIDA" });
  });

  it("serviço sem profissional atribuído não tem quem denunciar", () => {
    const r = resolverContraparte({
      reporterId: EMPREGADOR,
      serviceId: "svc-3",
      servico: { clientId: EMPREGADOR, diaristaId: null, montadorId: null },
    });
    assert.deepEqual(r, { ok: false, motivo: "CONTRAPARTE_INVALIDA" });
  });

  it("id vazio não casa com coluna vazia", () => {
    const r = resolverContraparte({
      reporterId: "",
      serviceId: "svc-1",
      servico: SERVICO_DIARISTA,
    });
    assert.deepEqual(r, { ok: false, motivo: "NAO_PARTICIPANTE" });
  });
});

describe("respostaDeRecusa — mensagens não mentem sobre o motivo", () => {
  it("sem serviço não fala em acesso negado a serviço", () => {
    const { error } = respostaDeRecusa("SEM_SERVICO");
    assert.ok(!/acesso negado/i.test(error), error);
    assert.match(error, /serviceId/);
  });

  it("faltar serviceId é 400; o resto é 403", () => {
    const status = (["SEM_SERVICO", "SERVICO_INEXISTENTE", "NAO_PARTICIPANTE", "CONTRAPARTE_INVALIDA"] as const).map(
      (m) => respostaDeRecusa(m).status,
    );
    assert.deepEqual(status, [400, 403, 403, 403]);
  });

  it("serviço inexistente e não-participante são indistinguíveis de fora", () => {
    // Separar os dois deixaria enumerar ids de serviço válidos tentando um a um.
    assert.deepEqual(respostaDeRecusa("SERVICO_INEXISTENTE"), respostaDeRecusa("NAO_PARTICIPANTE"));
  });
});
