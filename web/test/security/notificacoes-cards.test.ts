import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mockPrisma, resetMockPrisma } from "./_mocks";
import { makeAuthHeaders } from "./_helpers";
import { filtrar, montarCards, paginar, type Envio, type Evento } from "../../src/lib/cardsNotificacoes";

const t = (iso: string) => new Date(iso);
let seq = 0;
function evento(p: Partial<Evento> & { type: string; createdAt: Date }): Evento {
  return { id: `n${++seq}`, title: "t", body: "b", servicoId: null, chatRoomId: null, verificacaoId: null, decisaoVerificacaoId: null, readAt: null, ...p };
}
function envio(id: string, status: Envio["status"], decisao: string | null, criado: string, decisoes: Array<[string, string, string]> = []): Envio {
  return {
    id, status, decisao, motivoUsuario: status === "REJECTED" ? "Imagem ilegível" : null, createdAt: t(criado),
    decididoEm: decisoes.length ? t(decisoes[decisoes.length - 1][2]) : null,
    decisoes: decisoes.map(([did, d, em]) => ({ id: did, decisao: d, createdAt: t(em) })),
  };
}

describe("montarCards — regras puras", () => {
  it("mensagens ficam fora; serviço e aviso informativo viram card simples sem apresentação", () => {
    const cards = montarCards(
      [evento({ type: "CHAT_NOVA_MENSAGEM", createdAt: t("2026-11-01T10:00:00Z") }), evento({ type: "SERVICO_ACEITO", createdAt: t("2026-11-01T11:00:00Z"), servicoId: "s1" }), evento({ type: "SISTEMA", createdAt: t("2026-11-01T12:00:00Z") })],
      [],
    );
    assert.deepEqual(cards.map((c) => [c.tipo, c.principal.type, c.apresentacao]), [["SIMPLES", "SISTEMA", null], ["SIMPLES", "SERVICO_ACEITO", null]]);
  });

  it("não agrupa por texto nem por horário: aviso sem vínculo fica sozinho como 'Aviso anterior'", () => {
    const e1 = envio("e1", "REJECTED", "REENVIO", "2026-11-01T10:00:00Z", [["d1", "REENVIO", "2026-11-01T11:00:00Z"]]);
    const cards = montarCards(
      [
        evento({ type: "VERIFICACAO_REPROVADA", createdAt: t("2026-11-01T11:00:00.010Z"), title: "Envie os documentos novamente" }),
        evento({ type: "VERIFICACAO_REPROVADA", createdAt: t("2026-11-01T11:00:00.020Z"), verificacaoId: "e1", decisaoVerificacaoId: "d1" }),
      ],
      [e1],
    );
    assert.equal(cards.length, 2);
    assert.deepEqual(cards.map((c) => c.apresentacao!.estado).sort(), ["ACAO_NECESSARIA", "AVISO_ANTERIOR"]);
  });

  it("vínculo com decisão que não pertence ao envio não agrupa", () => {
    const e1 = envio("e1", "APPROVED", "APROVADO", "2026-11-01T10:00:00Z", [["d1", "APROVADO", "2026-11-01T11:00:00Z"]]);
    const [c] = montarCards([evento({ type: "VERIFICACAO_APROVADA", createdAt: t("2026-11-01T11:00:00Z"), verificacaoId: "e1", decisaoVerificacaoId: "d-outra" })], [e1]);
    assert.equal(c.apresentacao!.estado, "AVISO_ANTERIOR");
  });

  it("filtros sobre cards: não lida se algum evento do card não foi lido", () => {
    const e1 = envio("e1", "APPROVED", "APROVADO", "2026-11-01T10:00:00Z", [["d1", "REENVIO", "2026-11-01T11:00:00Z"], ["d2", "APROVADO", "2026-11-01T12:00:00Z"]]);
    const cards = montarCards(
      [
        evento({ type: "VERIFICACAO_REPROVADA", createdAt: t("2026-11-01T11:00:00Z"), verificacaoId: "e1", decisaoVerificacaoId: "d1" }),
        evento({ type: "VERIFICACAO_APROVADA", createdAt: t("2026-11-01T12:00:00Z"), verificacaoId: "e1", decisaoVerificacaoId: "d2", readAt: t("2026-11-01T12:30:00Z") }),
      ],
      [e1],
    );
    assert.equal(cards.length, 1);
    assert.equal(cards[0].naoLidos, 1);
    assert.equal(filtrar(cards, "nao_lidas").length, 1);
    assert.equal(filtrar(cards, "lidas").length, 0);
    assert.equal(cards[0].principal.type, "VERIFICACAO_APROVADA", "o mais recente é o principal");
  });

  it("paginação estável com empate de horário e cursor inválido", () => {
    const evs = Array.from({ length: 5 }, () => evento({ type: "SISTEMA", createdAt: t("2026-11-01T10:00:00Z") }));
    const cards = montarCards(evs, []);
    const p1 = paginar(cards, null, 2);
    const p2 = paginar(cards, p1.proximoCursor, 2);
    const p3 = paginar(cards, p2.proximoCursor, 2);
    const ids = [...p1.pagina, ...p2.pagina, ...p3.pagina].map((c) => c.id);
    assert.equal(new Set(ids).size, 5);
    assert.equal(p3.proximoCursor, null);
    assert.equal(paginar(cards, "lixo", 2).pagina.length, 2, "cursor inválido volta ao começo, sem erro");
  });
});

describe("rotas de cards — autenticação e entrada", () => {
  beforeEach(() => resetMockPrisma());

  it("401 sem token em cards, histórico e ler-lote", async () => {
    const cards = (await import("../../src/app/api/notificacoes/cards/route")).GET;
    const hist = (await import("../../src/app/api/notificacoes/historico-verificacao/route")).GET;
    const lote = (await import("../../src/app/api/notificacoes/ler-lote/route")).PATCH;
    assert.equal((await cards(new Request("http://test/api/notificacoes/cards"))).status, 401);
    assert.equal((await hist(new Request("http://test/api/notificacoes/historico-verificacao"))).status, 401);
    assert.equal((await lote(new Request("http://test/api/notificacoes/ler-lote", { method: "PATCH", body: "{}" }))).status, 401);
  });

  it("ler-lote: recusa lista inválida e restringe a atualização à conta do token", async () => {
    mockPrisma.user.findUnique = async () => ({ id: "u1", status: "ATIVO" });
    let where: any = null;
    mockPrisma.notification.updateMany = async (args: any) => {
      where = args.where;
      return { count: 1 };
    };
    const lote = (await import("../../src/app/api/notificacoes/ler-lote/route")).PATCH;
    const pedir = (ids: unknown) =>
      lote(new Request("http://test/api/notificacoes/ler-lote", { method: "PATCH", headers: { "content-type": "application/json", ...makeAuthHeaders("u1", "DIARISTA") }, body: JSON.stringify({ ids }) }));
    assert.equal((await pedir([])).status, 400);
    assert.equal((await pedir([1, 2])).status, 400);
    assert.equal((await pedir(Array.from({ length: 101 }, (_, i) => `n${i}`))).status, 400);
    assert.equal((await pedir(["n1", "n2"])).status, 200);
    assert.equal(where.userId, "u1");
    assert.deepEqual(where.id, { in: ["n1", "n2"] });
    assert.equal(where.readAt, null, "idempotente: só as ainda não lidas");
  });

  it("cards: status de resolução ou destino vindos do cliente são ignorados", async () => {
    mockPrisma.user.findUnique = async () => ({ id: "u1", status: "ATIVO" });
    mockPrisma.notification.findMany = async () => [evento({ type: "SISTEMA", createdAt: t("2026-11-01T10:00:00Z") })];
    mockPrisma.notification.count = async () => 1;
    (mockPrisma.documentVerification as any).findMany = async () => [];
    const cards = (await import("../../src/app/api/notificacoes/cards/route")).GET;
    const r = await cards(new Request("http://test/api/notificacoes/cards?estado=RESOLVIDO&rota=Paywall&filtro=qualquer", { headers: makeAuthHeaders("u1", "DIARISTA") }));
    const corpo = await r.json();
    assert.equal(corpo.filtro, "todas");
    assert.equal(corpo.cards[0].apresentacao, null);
    assert.ok(!("rota" in corpo.cards[0]));
  });
});
