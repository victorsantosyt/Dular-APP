import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Painel administrativo: páginas e rotas que leem dado sensível ou assinam
 * links de anexos exigem ADMIN ativo no BANCO — o papel do token não basta —
 * e fazem essa conferência ANTES de consultar dados ou assinar URLs.
 */

const SRC = path.join(process.cwd(), "src");
const ler = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf8");

function arquivos(dir: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) arquivos(p, acc);
    else acc.push(path.relative(SRC, p).split(path.sep).join("/"));
  }
  return acc;
}

describe("páginas do painel: conferência antes de qualquer leitura (fonte)", () => {
  const sensiveis = arquivos(path.join(SRC, "app/admin/(protected)")).filter(
    (f) => f.endsWith("page.tsx") && /prisma\.|signGetUrl|from "@\/lib\/admin/.test(ler(f).replace(/import[^;]+from "@\/lib\/adminSession";/, "")),
  );

  it("há páginas sensíveis mapeadas (controle positivo)", () => {
    assert.ok(sensiveis.includes("app/admin/(protected)/incidentes/[id]/page.tsx"));
    assert.ok(sensiveis.length >= 10, `só ${sensiveis.length}`);
  });

  for (const f of sensiveis) {
    it(`${f}: requireAdminSession é o primeiro await da página`, () => {
      const fonte = ler(f);
      const inicio = fonte.search(/^export default async function \w+/m);
      assert.ok(inicio >= 0, "página sem export default async");
      const corpo = fonte.slice(inicio).replace(/\/\/[^\n]*/g, "");
      const abre = corpo.indexOf("{\n", corpo.indexOf(")"));
      const primeiroAwait = corpo.slice(abre).match(/await\s+[\w.]+/)?.[0];
      assert.equal(primeiroAwait?.replace(/\s+/, " "), "await requireAdminSession");
    });
  }

  for (const f of ["app/admin/(protected)/insights/downloads/usuarios/route.ts", "app/admin/(protected)/insights/downloads/servicos/route.ts"]) {
    it(`${f}: confere no banco antes de montar o CSV`, () => {
      const fonte = ler(f);
      assert.match(fonte, /adminAtivoNoBanco\(/);
      assert.doesNotMatch(fonte, /session\.role === "ADMIN"/);
      assert.ok(fonte.indexOf("await requireAdmin()") < fonte.indexOf("prisma."), "checagem antes da consulta");
    });
  }
});

const URL_BANCO = process.env.SAFESCORE_DB_URL;
const PULAR = !URL_BANCO
  ? "defina SAFESCORE_DB_URL (Postgres local com as migrations aplicadas)"
  : !/@(localhost|127\.0\.0\.1)[:/]/.test(URL_BANCO)
    ? "SAFESCORE_DB_URL não aponta para localhost — recusado"
    : false;
const EXIGIDO = process.env.SAFESCORE_DB_REQUIRED === "1";

describe("ADMIN ativo no banco: sessão do painel, downloads e anexos de incidentes (DB)", { skip: EXIGIDO ? false : PULAR }, () => {
  let prisma: any;
  let sessao: any;
  let getIncidente: (r: any, c: { params: Promise<{ id: string }> }) => Promise<Response>;
  let makeAuthHeaders: (u: string, r: any) => Record<string, string>;
  let signToken: (p: any) => string;
  const RUN = `t_admpag_${Date.now().toString(36)}`;
  const ids: string[] = [];
  let incidenteId = "";
  let admin = "", exAdmin = "", bloqueado = "";

  async function usuario(sufixo: string, role: string, status = "ATIVO") {
    const id = `${RUN}_${sufixo}`;
    await prisma.user.create({ data: { id, nome: `Teste ${sufixo}`, role, status } });
    ids.push(id);
    return id;
  }

  before(async () => {
    if (PULAR) throw new Error(`SAFESCORE_DB_REQUIRED=1, mas ${PULAR}`);
    Object.assign(process.env, {
      DATABASE_URL: URL_BANCO,
      S3_REGION: "sa-east-1",
      S3_BUCKET: "dular-staging-uploads-teste",
      S3_ACCESS_KEY_ID: "AKIAFICTICIOTESTE000",
      S3_SECRET_ACCESS_KEY: "segredo-ficticio-de-teste",
    });
    ({ prisma } = await import("../../src/lib/prisma"));
    sessao = await import("../../src/lib/adminSession");
    getIncidente = (await import("../../src/app/api/admin/incidentes/[id]/route")).GET as any;
    ({ makeAuthHeaders } = await import("./_helpers"));
    ({ signToken } = (await import("../../src/lib/auth")) as any);
    admin = await usuario("admin", "ADMIN");
    exAdmin = await usuario("ex_admin", "MONTADOR");
    bloqueado = await usuario("bloqueado", "ADMIN", "BLOQUEADO");
    const denunciante = await usuario("denunciante", "DIARISTA");
    const denunciado = await usuario("denunciado", "EMPREGADOR");
    const inc = await prisma.incidentReport.create({
      data: {
        reportedById: denunciante, reportedUserId: denunciado, type: "AMEACA", description: "INCIDENTE DE TESTE",
        attachments: { create: [{ key: `incidentes/${RUN}/ANEXO-DE-TESTE.jpg`, mime: "image/jpeg", size: 10 }] },
      },
    });
    incidenteId = inc.id;
  });

  after(async () => {
    if (!prisma) return;
    await prisma.incidentReport.deleteMany({ where: { reportedById: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  });

  it("sessão do painel: só admin ativo no banco passa", async () => {
    assert.ok(await sessao.adminAtivoDaSessao({ userId: admin, role: "ADMIN" }));
    assert.equal(await sessao.adminAtivoDaSessao({ userId: exAdmin, role: "ADMIN" }), null, "ex-admin com token antigo");
    assert.equal(await sessao.adminAtivoDaSessao({ userId: bloqueado, role: "ADMIN" }), null, "admin bloqueado");
  });

  it("downloads (cookie): só admin ativo no banco", async () => {
    assert.equal(await sessao.adminAtivoNoBanco(signToken({ userId: admin, role: "ADMIN" })), true);
    assert.equal(await sessao.adminAtivoNoBanco(signToken({ userId: exAdmin, role: "ADMIN" })), false);
    assert.equal(await sessao.adminAtivoNoBanco(signToken({ userId: bloqueado, role: "ADMIN" })), false);
    assert.equal(await sessao.adminAtivoNoBanco(undefined), false);
  });

  it("anexos de incidente: URL assinada só para admin ativo; nada dela no log", async () => {
    const pedir = async (headers: Record<string, string>) => {
      const linhas: string[] = [];
      const orig = { log: console.log, warn: console.warn, error: console.error };
      for (const k of Object.keys(orig) as (keyof typeof orig)[]) console[k] = (...a: unknown[]) => { linhas.push(a.map(String).join(" ")); };
      try {
        const r = await getIncidente(new Request(`http://test/api/admin/incidentes/${incidenteId}`, { headers }), { params: Promise.resolve({ id: incidenteId }) });
        return { status: r.status, corpo: await r.text(), log: linhas.join("\n") };
      } finally {
        Object.assign(console, orig);
      }
    };
    const ok = await pedir(makeAuthHeaders(admin, "ADMIN"));
    assert.equal(ok.status, 200);
    assert.match(ok.corpo, /X-Amz-Signature/);
    assert.doesNotMatch(ok.log, /X-Amz-|ANEXO-DE-TESTE/);

    const ex = await pedir(makeAuthHeaders(exAdmin, "ADMIN"));
    assert.equal(ex.status, 403);
    assert.doesNotMatch(ex.corpo, /X-Amz-|ANEXO-DE-TESTE|INCIDENTE DE TESTE/);

    const bl = await pedir(makeAuthHeaders(bloqueado, "ADMIN"));
    assert.equal(bl.status, 401);
    assert.doesNotMatch(bl.corpo, /X-Amz-|ANEXO-DE-TESTE|INCIDENTE DE TESTE/);
  });
});
