import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

/**
 * Cards acionáveis de verificação contra Postgres real, pelas rotas reais:
 * GET /api/notificacoes/cards, /historico-verificacao e PATCH /ler-lote, com
 * as decisões gravadas por decidirVerificacao (vínculo explícito).
 */
const URL_BANCO = process.env.SAFESCORE_DB_URL;
const PULAR = !URL_BANCO
  ? "defina SAFESCORE_DB_URL (Postgres local com as migrations aplicadas)"
  : !/@(localhost|127\.0\.0\.1)[:/]/.test(URL_BANCO)
    ? "SAFESCORE_DB_URL não aponta para localhost — recusado"
    : false;
const EXIGIDO = process.env.SAFESCORE_DB_REQUIRED === "1";

describe("cards de notificação com estado atual (DB)", { skip: EXIGIDO ? false : PULAR }, () => {
  let prisma: any;
  let decidir: (input: any) => Promise<any>;
  let getCards: (r: Request) => Promise<Response>;
  let getHistorico: (r: Request) => Promise<Response>;
  let patchLote: (r: Request) => Promise<Response>;
  let getLista: (r: Request) => Promise<Response>;
  let makeAuthHeaders: (u: string, r: any) => Record<string, string>;
  const RUN = `t_cards_${Date.now().toString(36)}`;
  const ids: string[] = [];
  let admin = "";
  const CONF = { documentoLegivel: true, dadosConferem: true, selfieCompativel: true };

  async function usuario(sufixo: string, role = "DIARISTA") {
    const id = `${RUN}_${sufixo}`;
    await prisma.user.create({ data: { id, nome: sufixo, role, status: "ATIVO" } });
    ids.push(id);
    if (role === "DIARISTA") await prisma.diaristaProfile.create({ data: { userId: id, precoLeve: 100, precoPesada: 200 } });
    if (role === "MONTADOR") await prisma.montadorPerfil.create({ data: { userId: id, especialidades: [], bairros: [], portfolioFotos: [] } });
    if (role === "EMPREGADOR") await prisma.empregadorPerfil.create({ data: { userId: id } });
    return id;
  }
  const enviar = (userId: string) =>
    prisma.documentVerification.create({ data: { userId, docType: "KYC", docUrl: JSON.stringify({ frente: "f", verso: "v", selfie: "s" }) } });
  const reenvio = (id: string) => decidir({ id, adminId: admin, decisao: "REENVIO", motivo: "verso ilegível", revisao: false, motivoCategoria: "IMAGEM_ILEGIVEL" });
  const aprovar = (id: string) => decidir({ id, adminId: admin, decisao: "APROVADO", motivo: "ok", revisao: false, conferencia: CONF });

  async function cards(u: string, role = "DIARISTA", qs = "") {
    const r = await getCards(new Request(`http://test/api/notificacoes/cards${qs}`, { headers: makeAuthHeaders(u, role) }));
    assert.equal(r.status, 200);
    return r.json();
  }
  const verificacoes = async (u: string, role = "DIARISTA") => (await cards(u, role)).cards.filter((c: any) => c.tipo === "VERIFICACAO");
  async function lerLote(u: string, lista: string[], role = "DIARISTA") {
    const r = await patchLote(new Request("http://test/api/notificacoes/ler-lote", { method: "PATCH", headers: { "content-type": "application/json", ...makeAuthHeaders(u, role) }, body: JSON.stringify({ ids: lista }) }));
    return { status: r.status, corpo: await r.json() };
  }

  before(async () => {
    if (PULAR) throw new Error(`SAFESCORE_DB_REQUIRED=1, mas ${PULAR}`);
    process.env.DATABASE_URL = URL_BANCO;
    process.env.DULAR_VERIFICACAO_SELFIE = "ligado";
    delete process.env.VERCEL_ENV;
    ({ prisma } = await import("../../src/lib/prisma"));
    decidir = (await import("../../src/lib/decisaoVerificacao")).decidirVerificacao;
    getCards = (await import("../../src/app/api/notificacoes/cards/route")).GET;
    getHistorico = (await import("../../src/app/api/notificacoes/historico-verificacao/route")).GET;
    patchLote = (await import("../../src/app/api/notificacoes/ler-lote/route")).PATCH;
    getLista = (await import("../../src/app/api/notificacoes/route")).GET;
    ({ makeAuthHeaders } = await import("./_helpers"));
    admin = await usuario("admin", "ADMIN");
  });

  after(async () => {
    if (!prisma) return;
    await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
    await prisma.documentVerification.deleteMany({ where: { userId: { in: ids } } });
    await prisma.diaristaProfile.deleteMany({ where: { userId: { in: ids } } });
    await prisma.montadorPerfil.deleteMany({ where: { userId: { in: ids } } });
    await prisma.empregadorPerfil.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  });

  for (const role of ["DIARISTA", "MONTADOR", "EMPREGADOR"]) {
    it(`${role}: pedido de reenvio → novo envio → análise → aprovação; o card deixa de cobrar ação`, async () => {
      const u = await usuario(`ciclo_${role}`, role);
      const e1 = await enviar(u);
      await reenvio(e1.id);
      let [c1] = await verificacoes(u, role);
      assert.equal(c1.id, `verificacao:${e1.id}`);
      assert.equal(c1.apresentacao.estado, "ACAO_NECESSARIA");
      assert.equal(c1.apresentacao.titulo, "Reenvie seus documentos");
      assert.match(c1.apresentacao.motivo, /Imagem ilegível/);
      assert.equal(c1.apresentacao.acao, "REENVIAR");

      const e2 = await enviar(u); // novo envio, ainda sem decisão nem aviso
      [c1] = await verificacoes(u, role);
      assert.deepEqual([c1.apresentacao.estado, c1.apresentacao.rotulo, c1.apresentacao.titulo], ["EM_ANALISE", "Reenvio realizado", "Em análise"]);
      assert.equal((await cards(u, role)).contadores.acoesNecessarias, 0);

      await aprovar(e2.id);
      const lista = await verificacoes(u, role);
      assert.equal(lista.length, 2, "um card por envio; envios distintos não se juntam");
      for (const c of lista) {
        assert.equal(c.apresentacao.estado, "RESOLVIDO");
        assert.doesNotMatch(c.apresentacao.titulo, /reenvi/i, "sem instrução de reenvio");
      }
      // Evento original preservado: o card antigo mantém data e texto do aviso de reenvio.
      const antigo = lista.find((c: any) => c.id === `verificacao:${e1.id}`);
      assert.match(antigo.principal.title, /novamente/);
      assert.ok(Date.parse(antigo.principal.createdAt) < Date.parse(antigo.apresentacao.estadoAtualizadoEm), "data do evento ≠ atualização do estado");
    });
  }

  it("aprovação → revisão para reprovação → nova aprovação: um card só, com o estado vigente e o histórico completo", async () => {
    const u = await usuario("revisao");
    const e = await enviar(u);
    await aprovar(e.id);
    await decidir({ id: e.id, adminId: admin, decisao: "REPROVADO", motivo: "revisto", revisao: true, esperado: "APROVADO", motivoCategoria: "DADOS_DIVERGENTES" });
    let [c] = await verificacoes(u);
    assert.equal(c.eventos, 2, "eventos do mesmo envio agrupados");
    assert.equal(c.apresentacao.estado, "ACAO_NECESSARIA");
    assert.match(c.apresentacao.titulo, /não aprovada/);
    await decidir({ id: e.id, adminId: admin, decisao: "APROVADO", motivo: "ok", revisao: true, esperado: "REPROVADO", conferencia: CONF });
    [c] = await verificacoes(u);
    assert.deepEqual([c.eventos, c.apresentacao.estado], [3, "RESOLVIDO"]);
    const h = await (await getHistorico(new Request("http://test/x", { headers: makeAuthHeaders(u, "DIARISTA") }))).json();
    assert.deepEqual(h.envios[0].decisoes.map((d: any) => d.decisao), ["APROVADO", "REPROVADO", "APROVADO"]);
    assert.ok(h.envios[0].decisoes.every((d: any) => d.avisos.length === 1), "cada decisão com o seu aviso");
  });

  it("leitura independe da resolução; nova decisão volta a destacar a ação e chega não lida", async () => {
    const u = await usuario("leitura");
    const e1 = await enviar(u);
    await reenvio(e1.id);
    let [c] = await verificacoes(u);
    assert.equal(c.naoLidos, 1);
    assert.equal((await lerLote(u, [c.principal.id])).corpo.marcadas, 1); // abrir o card
    [c] = await verificacoes(u);
    assert.deepEqual([c.naoLidos, c.apresentacao.estado], [0, "ACAO_NECESSARIA"], "ler não resolve");

    const e2 = await enviar(u);
    await aprovar(e2.id);
    const lista = await verificacoes(u);
    const novo = lista.find((x: any) => x.id === `verificacao:${e2.id}`);
    const velho = lista.find((x: any) => x.id === `verificacao:${e1.id}`);
    assert.equal(velho.apresentacao.estado, "RESOLVIDO");
    assert.equal(velho.naoLidos, 0, "resolver não marca como lida");
    assert.equal(novo.naoLidos, 1, "a decisão nova é não lida");

    // Revisão depois de tudo lido: ação volta, e o evento novo é o único não lido do card.
    await lerLote(u, [novo.principal.id]);
    await decidir({ id: e2.id, adminId: admin, decisao: "REENVIO", motivo: "selfie", revisao: true, esperado: "APROVADO", motivoCategoria: "ROSTO_NAO_VISIVEL" });
    const r = await cards(u);
    const atual = r.cards.find((x: any) => x.id === `verificacao:${e2.id}`);
    assert.deepEqual([atual.apresentacao.estado, atual.naoLidos, atual.eventos], ["ACAO_NECESSARIA", 1, 2]);
    assert.equal(r.contadores.acoesNecessarias, 1);
    assert.equal(r.contadores.naoLidas, 1, "badge = eventos não lidos (semântica de hoje)");
  });

  it("aviso antigo sem vínculo: 'Aviso anterior', sozinho, mesmo com envio aprovado", async () => {
    const u = await usuario("legado");
    await prisma.notification.create({ data: { userId: u, type: "VERIFICACAO_REPROVADA", title: "Envie os documentos novamente", body: "antigo", createdAt: new Date(Date.now() - 86_400_000) } });
    const e = await enviar(u);
    await aprovar(e.id);
    const lista = await verificacoes(u);
    assert.equal(lista.length, 2);
    const legado = lista.find((c: any) => c.verificacaoId === null);
    assert.equal(legado.apresentacao.estado, "AVISO_ANTERIOR");
    assert.match(legado.apresentacao.titulo, /não representar/);
  });

  it("decisões repetidas e concorrentes não duplicam aviso nem card", async () => {
    const u = await usuario("concorrente");
    const e = await enviar(u);
    const rs = await Promise.allSettled([aprovar(e.id), aprovar(e.id), aprovar(e.id)]);
    assert.equal(rs.filter((r) => r.status === "fulfilled" && (r as any).value.tipo === "decidida").length, 1);
    const [c] = await verificacoes(u);
    assert.equal(c.eventos, 1);
    assert.equal(await prisma.notification.count({ where: { userId: u } }), 1);
  });

  it("agrupamento + paginação + filtros: sem duplicar, sem sumir, contadores coerentes", async () => {
    const u = await usuario("pagina");
    const base = Date.now() - 3_600_000;
    for (let i = 0; i < 7; i++) {
      await prisma.notification.create({ data: { userId: u, type: "SERVICO_ACEITO", title: `s${i}`, body: "b", createdAt: new Date(base + i * 1000), readAt: i % 2 ? new Date() : null } });
    }
    // Mesmo instante em dois avisos: o desempate por id mantém a ordem estável.
    await prisma.notification.create({ data: { userId: u, type: "SISTEMA", title: "x", body: "b", createdAt: new Date(base + 3000) } });
    await prisma.notification.create({ data: { userId: u, type: "CHAT_NOVA_MENSAGEM", title: "chat", body: "b" } }); // fora dos cards
    const e = await enviar(u);
    await reenvio(e.id);
    await decidir({ id: e.id, adminId: admin, decisao: "APROVADO", motivo: "ok", revisao: true, esperado: "REENVIO", conferencia: CONF });

    for (const filtro of ["todas", "nao_lidas", "lidas"]) {
      const vistos: string[] = [];
      let cursor: string | null = null;
      let total = -1;
      do {
        const qs: string = `?filtro=${filtro}&limite=3${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
        const r: any = await cards(u, "DIARISTA", qs);
        total = r.contadores.cards[filtro];
        vistos.push(...r.cards.map((c: any) => c.id));
        cursor = r.proximoCursor;
      } while (cursor);
      assert.equal(new Set(vistos).size, vistos.length, `${filtro}: sem duplicados`);
      assert.equal(vistos.length, total, `${filtro}: nenhum sumiu`);
    }
    const r = await cards(u);
    assert.equal(r.contadores.cards.todas, 7 + 1 + 1, "7 serviço + 1 sistema + 1 card da verificação (2 eventos)");
    assert.equal(r.contadores.cards.nao_lidas + r.contadores.cards.lidas, r.contadores.cards.todas);
    assert.ok(!r.cards.some((c: any) => c.principal.type === "CHAT_NOVA_MENSAGEM"));
    assert.equal(r.contadores.naoLidas, await prisma.notification.count({ where: { userId: u, readAt: null } }), "badge igual ao de hoje (inclui chat)");

    // Card com um evento lido e outro não: aparece em "não lidas" até o histórico ser visto.
    const card = r.cards.find((c: any) => c.tipo === "VERIFICACAO");
    await lerLote(u, [card.principal.id]);
    const nl = await cards(u, "DIARISTA", "?filtro=nao_lidas");
    assert.ok(nl.cards.some((c: any) => c.id === card.id && c.naoLidos === 1), "evento oculto no histórico continua não lido");
  });

  it("conta diferente: nada da outra conta nos cards; vínculo forjado não agrupa; ler-lote ignora ids alheios", async () => {
    const a = await usuario("a");
    const b = await usuario("b");
    const eb = await enviar(b);
    await aprovar(eb.id);
    const [nb] = await prisma.notification.findMany({ where: { userId: b } });
    await prisma.notification.create({ data: { userId: a, type: "VERIFICACAO_APROVADA", title: "t", body: "b", verificacaoId: eb.id, decisaoVerificacaoId: nb.decisaoVerificacaoId } });
    const ca = await verificacoes(a);
    assert.equal(ca.length, 1);
    assert.equal(ca[0].apresentacao.estado, "AVISO_ANTERIOR");
    assert.equal(ca[0].verificacaoId, null);
    assert.equal((await lerLote(a, [nb.id])).corpo.marcadas, 0);
    assert.equal((await prisma.notification.findUnique({ where: { id: nb.id } })).readAt, null);
    const h = await (await getHistorico(new Request("http://test/x", { headers: makeAuthHeaders(a, "DIARISTA") }))).json();
    assert.equal(h.envios.length, 0);
    assert.equal(h.semVinculo.length, 1);
  });

  it("compatibilidade: a lista antiga mantém o contrato da vc15 e anteriores", async () => {
    const u = await usuario("compat");
    const e = await enviar(u);
    await reenvio(e.id);
    const r = await getLista(new Request("http://test/api/notificacoes", { headers: makeAuthHeaders(u, "DIARISTA") }));
    const corpo = await r.json();
    assert.deepEqual(Object.keys(corpo).sort(), ["notifications", "ok", "unreadCount"]);
    assert.deepEqual(Object.keys(corpo.notifications[0]).sort(), ["body", "chatRoomId", "createdAt", "id", "readAt", "servicoId", "title", "type"]);
  });
});
