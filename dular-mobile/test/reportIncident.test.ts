import assert from "node:assert/strict";
import test from "node:test";
import {
  conjuntoDeCategorias,
  decidirServicoParaDenuncia,
  resolveCounterpartFromService,
  type ServicoParaDenuncia,
} from "../src/lib/reportIncident";

/**
 * Regras do fluxo "Relatar incidente".
 *
 * O defeito que originou isto: a tela abria sem `serviceId`, não tinha quem
 * denunciar e escrevia "Usuário não identificado" — como se o dado estivesse
 * corrompido, quando na verdade faltava contexto. E, mesmo com `serviceId`, a
 * resolução da contraparte só olhava cliente↔diarista, então montador nunca
 * casava.
 */

const EU = "user-eu";
const EMPREGADOR = "user-empregador";
const DIARISTA = "user-diarista";
const MONTADOR = "user-montador";

// ── Contraparte resolvida pelo id que o backend devolve ─────────────────────

test("Empregador → Diarista: acha a diarista pelo otherUserId", () => {
  const parte = resolveCounterpartFromService({
    otherUserId: DIARISTA,
    cliente: { id: EU, nome: "Eu" },
    diarista: { id: DIARISTA, nome: "Josafa" },
    montador: null,
  });
  assert.equal(parte?.id, DIARISTA);
  assert.equal(parte?.nome, "Josafa");
});

test("Empregador → Montador: acha o montador, que a versão anterior perdia", () => {
  const parte = resolveCounterpartFromService({
    otherUserId: MONTADOR,
    cliente: { id: EU, nome: "Eu" },
    diarista: null,
    montador: { id: MONTADOR, nome: "Jacirene" },
  });
  assert.equal(parte?.id, MONTADOR);
  assert.equal(parte?.nome, "Jacirene");
});

test("Diarista → Empregador: acha o cliente", () => {
  const parte = resolveCounterpartFromService({
    otherUserId: EMPREGADOR,
    cliente: { id: EMPREGADOR, nome: "Victor" },
    diarista: { id: EU, nome: "Eu" },
    montador: null,
  });
  assert.equal(parte?.nome, "Victor");
});

test("Montador → Empregador: acha o cliente", () => {
  const parte = resolveCounterpartFromService({
    otherUserId: EMPREGADOR,
    cliente: { id: EMPREGADOR, nome: "Victor" },
    diarista: null,
    montador: { id: EU, nome: "Eu" },
  });
  assert.equal(parte?.nome, "Victor");
});

test("a escolha é pelo id, não pelo papel de quem olha", () => {
  // Mesmo payload, dois otherUserId diferentes → duas respostas diferentes,
  // sem a função saber quem é o usuário logado.
  const payload = {
    cliente: { id: EMPREGADOR, nome: "Victor" },
    diarista: { id: DIARISTA, nome: "Josafa" },
    montador: { id: MONTADOR, nome: "Jacirene" },
  };
  assert.equal(resolveCounterpartFromService({ ...payload, otherUserId: DIARISTA })?.nome, "Josafa");
  assert.equal(resolveCounterpartFromService({ ...payload, otherUserId: MONTADOR })?.nome, "Jacirene");
});

test("otherUserId inexistente no payload devolve null, sem chutar", () => {
  const parte = resolveCounterpartFromService({
    otherUserId: "user-que-nao-esta-aqui",
    cliente: { id: EMPREGADOR, nome: "Victor" },
    diarista: { id: DIARISTA, nome: "Josafa" },
    montador: null,
  });
  assert.equal(parte, null);
});

test("otherUserId ausente ou vazio devolve null", () => {
  const payload = { cliente: { id: EMPREGADOR, nome: "Victor" } };
  assert.equal(resolveCounterpartFromService({ ...payload, otherUserId: null }), null);
  assert.equal(resolveCounterpartFromService({ ...payload, otherUserId: undefined }), null);
  assert.equal(resolveCounterpartFromService({ ...payload, otherUserId: "" }), null);
});

test("partes sem id não entram na busca", () => {
  const parte = resolveCounterpartFromService({
    otherUserId: DIARISTA,
    cliente: null,
    diarista: { id: "", nome: "Sem id" } as never,
    montador: null,
  });
  assert.equal(parte, null);
});

// ── Conjunto de categorias por papel ────────────────────────────────────────

test("EMPREGADOR vê as categorias de empregador", () => {
  assert.equal(conjuntoDeCategorias("EMPREGADOR"), "EMPREGADOR");
});

test("DIARISTA vê as categorias de profissional", () => {
  assert.equal(conjuntoDeCategorias("DIARISTA"), "PROFISSIONAL");
});

test("MONTADOR vê as categorias de profissional, não as do empregador", () => {
  // Era o defeito: `role === "DIARISTA" ? ... : EMPREGADOR_GROUPS` jogava o
  // montador no else, e ele recebia "Patrimônio / Comportamento / Segurança",
  // que é o que se denuncia SOBRE um profissional.
  assert.equal(conjuntoDeCategorias("MONTADOR"), "PROFISSIONAL");
});

test("papel ausente ou desconhecido mantém o conjunto anterior", () => {
  assert.equal(conjuntoDeCategorias(null), "EMPREGADOR");
  assert.equal(conjuntoDeCategorias(undefined), "EMPREGADOR");
  assert.equal(conjuntoDeCategorias("ADMIN"), "EMPREGADOR");
});

test("papel em minúsculas também é reconhecido", () => {
  assert.equal(conjuntoDeCategorias("montador"), "PROFISSIONAL");
  assert.equal(conjuntoDeCategorias("diarista"), "PROFISSIONAL");
});

// ── Decisão do SOS ──────────────────────────────────────────────────────────

function servicoComDiarista(id: string): ServicoParaDenuncia {
  return {
    id,
    clientId: EU,
    diaristaId: DIARISTA,
    montadorId: null,
    tipo: "FAXINA",
    status: "ACEITO",
    cliente: { id: EU, nome: "Eu" },
    diarista: { id: DIARISTA, nome: "Josafa" },
    montador: null,
  };
}

function servicoComMontador(id: string): ServicoParaDenuncia {
  return {
    id,
    clientId: EU,
    diaristaId: null,
    montadorId: MONTADOR,
    tipo: "MONTADOR",
    status: "CONCLUIDO",
    cliente: { id: EU, nome: "Eu" },
    diarista: null,
    montador: { id: MONTADOR, nome: "Jacirene" },
  };
}

test("0 serviços → VAZIO (a denúncia não abre sem contexto)", () => {
  assert.deepEqual(decidirServicoParaDenuncia([], EU), { tipo: "VAZIO" });
});

test("1 serviço → AUTOMATICO com o serviceId correto", () => {
  const decisao = decidirServicoParaDenuncia([servicoComDiarista("svc-1")], EU);
  assert.equal(decisao.tipo, "AUTOMATICO");
  if (decisao.tipo !== "AUTOMATICO") return;
  assert.equal(decisao.opcao.serviceId, "svc-1");
  assert.equal(decisao.opcao.contraparte.nome, "Josafa");
});

test("2 serviços → ESCOLHA, e NENHUM é escolhido automaticamente", () => {
  const decisao = decidirServicoParaDenuncia(
    [servicoComDiarista("svc-1"), servicoComMontador("svc-2")],
    EU,
  );
  assert.equal(decisao.tipo, "ESCOLHA");
  if (decisao.tipo !== "ESCOLHA") return;
  assert.equal(decisao.opcoes.length, 2);
  // O ponto do teste: a decisão não carrega serviceId nenhum.
  assert.ok(!("serviceId" in decisao));
  assert.ok(!("opcao" in decisao));
});

test("3 serviços → ESCOLHA, preservando a ordem recebida", () => {
  const decisao = decidirServicoParaDenuncia(
    [servicoComDiarista("svc-1"), servicoComMontador("svc-2"), servicoComDiarista("svc-3")],
    EU,
  );
  assert.equal(decisao.tipo, "ESCOLHA");
  if (decisao.tipo !== "ESCOLHA") return;
  assert.deepEqual(decisao.opcoes.map((o) => o.serviceId), ["svc-1", "svc-2", "svc-3"]);
});

test("o profissional enxerga o cliente como contraparte", () => {
  const servico: ServicoParaDenuncia = {
    ...servicoComMontador("svc-9"),
    clientId: EMPREGADOR,
    cliente: { id: EMPREGADOR, nome: "Victor" },
    montador: { id: EU, nome: "Eu" },
    montadorId: EU,
  };
  const decisao = decidirServicoParaDenuncia([servico], EU);
  assert.equal(decisao.tipo, "AUTOMATICO");
  if (decisao.tipo !== "AUTOMATICO") return;
  assert.equal(decisao.opcao.contraparte.nome, "Victor");
});

test("serviço sem contraparte atribuída é descartado, não vira opção vazia", () => {
  const semProfissional: ServicoParaDenuncia = {
    id: "svc-sem",
    clientId: EU,
    diaristaId: null,
    montadorId: null,
    cliente: { id: EU, nome: "Eu" },
    diarista: null,
    montador: null,
  };
  assert.deepEqual(decidirServicoParaDenuncia([semProfissional], EU), { tipo: "VAZIO" });
  // Com um válido ao lado, sobra exatamente um → auto-seleção.
  const decisao = decidirServicoParaDenuncia([semProfissional, servicoComDiarista("svc-1")], EU);
  assert.equal(decisao.tipo, "AUTOMATICO");
});

test("não há filtro por status: concluído e cancelado seguem denunciáveis", () => {
  const concluido = { ...servicoComDiarista("svc-c"), status: "CONFIRMADO" };
  const cancelado = { ...servicoComMontador("svc-x"), status: "CANCELADO" };
  const decisao = decidirServicoParaDenuncia([concluido, cancelado], EU);
  assert.equal(decisao.tipo, "ESCOLHA");
  if (decisao.tipo !== "ESCOLHA") return;
  assert.deepEqual(decisao.opcoes.map((o) => o.status), ["CONFIRMADO", "CANCELADO"]);
});

test("sem usuário logado ou com lista inválida devolve VAZIO", () => {
  assert.deepEqual(decidirServicoParaDenuncia([servicoComDiarista("svc-1")], null), { tipo: "VAZIO" });
  assert.deepEqual(decidirServicoParaDenuncia([servicoComDiarista("svc-1")], ""), { tipo: "VAZIO" });
  assert.deepEqual(decidirServicoParaDenuncia(null, EU), { tipo: "VAZIO" });
  assert.deepEqual(decidirServicoParaDenuncia(undefined, EU), { tipo: "VAZIO" });
});

test("serviço sem id é ignorado", () => {
  const semId = { ...servicoComDiarista(""), id: "" };
  assert.deepEqual(decidirServicoParaDenuncia([semId], EU), { tipo: "VAZIO" });
});
