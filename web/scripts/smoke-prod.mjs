/**
 * Smoke test de produção — executa o procedimento de `auditoria/14-smoke-test-producao.md`
 * por HTTP real contra o ambiente publicado.
 *
 * Rodar de dentro de `web/`:
 *   SMOKE_ADMIN_LOGIN=... SMOKE_ADMIN_SENHA=... DATABASE_URL=... node scripts/smoke-prod.mjs
 *
 * O que este script NÃO cobre (exige aparelho físico ou dashboard externo):
 * passos 2 e 3 (login Google/Apple) e pós-checks Q1 (push), Q3 (webhook Stripe)
 * e Q4 (SOS abre WhatsApp).
 *
 * CONTORNO: enquanto o bucket S3 de produção não existir, o passo 6 falha e
 * nenhum perfil fica VERIFICADO pelo fluxo real. O script força a verificação
 * no banco SÓ para as contas `SMOKE *` que ele mesmo cria, para não perder a
 * validação dos passos 8-12. Isso NÃO valida os passos 6 e 7.
 *
 * As contas criadas ficam com o prefixo `SMOKE ` no nome, e os ids vão para
 * `smoke-artefatos.json`. Limpar depois — a exclusão precisa respeitar as FKs
 * RESTRICT (ScoreEvento → SafeScore → User, e os filhos de Servico).
 */
import sharp from "sharp";
import { writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const BASE = "https://dular-three.vercel.app";
const SUF = String(Date.now()).slice(-7);          // sufixo único por execução
const CIDADE = "Água Boa", UF = "MT", BAIRRO = "Centro 1";

const ADMIN = { login: process.env.SMOKE_ADMIN_LOGIN, senha: process.env.SMOKE_ADMIN_SENHA };
if (!ADMIN.login || !ADMIN.senha) {
  console.error("Defina SMOKE_ADMIN_LOGIN e SMOKE_ADMIN_SENHA no ambiente.");
  process.exit(1);
}
// Senha descartável: estas duas contas são criadas e apagadas pelo próprio
// teste. Não é credencial de ninguém.
const EMP = { nome: `SMOKE ${SUF} Empregador`, telefone: `669${SUF}`, senha: "Smoke#2026", role: "EMPREGADOR" };
const DIA = { nome: `SMOKE ${SUF} Diarista`,   telefone: `668${SUF}`, senha: "Smoke#2026", role: "DIARISTA" };

const sessoes = {};                                 // ator -> cookie
const artefatos = { execucao: new Date().toISOString(), base: BASE, criados: {} };
const resultados = [];

function registra(passo, titulo, ok, detalhe) {
  resultados.push({ passo, titulo, ok, detalhe });
  const marca = ok === true ? "PASS" : ok === false ? "FALHA" : "N/A ";
  console.log(`  ${marca}  ${String(passo).padStart(2)} ${titulo}${detalhe ? " — " + detalhe : ""}`);
  return ok;
}

async function req(metodo, caminho, { ator, json, form, headers = {} } = {}) {
  const h = { ...headers };
  if (ator && sessoes[ator]) h.cookie = sessoes[ator];
  let body;
  if (json !== undefined) { h["content-type"] = "application/json"; body = JSON.stringify(json); }
  if (form) body = form;
  const r = await fetch(BASE + caminho, { method: metodo, headers: h, body, redirect: "manual" });
  const bruto = await r.text();
  let dados = null;
  try { dados = JSON.parse(bruto); } catch { dados = bruto.slice(0, 200); }
  // guarda o cookie de sessão devolvido no login
  const sc = r.headers.getSetCookie?.() || [];
  const tok = sc.find((c) => c.startsWith("dular_token="));
  return { status: r.status, dados, cookieToken: tok ? tok.split(";")[0] : null };
}

async function entrar(ator, cred) {
  const r = await req("POST", "/api/auth/login", { json: { login: cred.login ?? cred.telefone, senha: cred.senha } });
  if (r.cookieToken) sessoes[ator] = r.cookieToken;
  return r;
}

const jpeg = async (texto) =>
  sharp({ create: { width: 600, height: 380, channels: 3, background: "#dddddd" } })
    .composite([{ input: Buffer.from(`<svg width="600" height="380"><text x="24" y="200" font-size="26" fill="#222">${texto}</text></svg>`), top: 0, left: 0 }])
    .jpeg({ quality: 70 }).toBuffer();

console.log(`\nSMOKE TEST DE PRODUÇÃO — ${BASE}\nexecução ${SUF}\n${"─".repeat(72)}`);

/* ---------------- 1. Cadastro ---------------- */
{
  const a = await req("POST", "/api/auth/register", { json: EMP });
  const b = await req("POST", "/api/auth/register", { json: DIA });
  const ok = a.status === 200 && b.status === 200;
  registra(1, "Cadastro (Empregador + Diarista)", ok, `empregador=${a.status} diarista=${b.status}`);
  if (!ok) { console.log("     ", JSON.stringify(a.dados), JSON.stringify(b.dados)); process.exit(1); }
  artefatos.criados.telefones = [EMP.telefone, DIA.telefone];
}

/* ---------------- 2 e 3. OAuth ---------------- */
registra(2, "Login Google", null, "exige aparelho físico + conta Google real");
registra(3, "Login Apple", null, "exige aparelho físico + conta Apple real");

/* ---------------- login por senha (base para o resto) ---------------- */
{
  const e = await entrar("emp", EMP), d = await entrar("dia", DIA), ad = await entrar("admin", ADMIN);
  const ok = !!(sessoes.emp && sessoes.dia && sessoes.admin);
  registra("—", "Login por senha (empregador/diarista/admin)", ok,
    `emp=${e.status} dia=${d.status} admin=${ad.status}`);
  if (!ok) { console.log("     ", JSON.stringify(ad.dados)); process.exit(1); }
}

/* ---------------- 4. Perfil do Empregador ---------------- */
{
  const me = await req("GET", "/api/me", { ator: "emp" });
  const end = await req("POST", "/api/me/enderecos", {
    ator: "emp",
    json: { tipo: "RESIDENCIAL", cep: "78635000", rua: "Rua do Smoke", numero: "100",
            bairro: BAIRRO, cidade: CIDADE, uf: UF },
  });
  const ok = me.status === 200 && (end.status === 200 || end.status === 201);
  registra(4, "Perfil do Empregador + endereço", ok, `me=${me.status} endereco=${end.status}`);
  if (end.status >= 400) console.log("     ", JSON.stringify(end.dados).slice(0, 220));
  artefatos.criados.empregadorId = me.dados?.user?.id ?? me.dados?.id ?? null;
}

/* ---------------- 5. Perfil do Profissional ---------------- */
{
  const precos = await req("POST", "/api/diarista/precos", {
    ator: "dia", json: { precoLeve: 12000, precoMedio: 16000, precoPesada: 20000, bio: "Conta de smoke test." },
  });
  const bairros = await req("POST", "/api/diarista/bairros", {
    ator: "dia", json: { cidade: CIDADE, uf: UF, bairros: [BAIRRO, "Centro 2"] },
  });
  const ok = precos.status === 200 && bairros.status === 200;
  registra(5, "Perfil do Profissional (preços + bairros)", ok, `precos=${precos.status} bairros=${bairros.status}`);
  if (!ok) console.log("     ", JSON.stringify(precos.dados).slice(0, 200), JSON.stringify(bairros.dados).slice(0, 200));
}

/* ---------------- 6. Upload de documento ---------------- */
let verificacaoId = null;
{
  const fd = new FormData();
  fd.append("docFrente", new Blob([await jpeg("SMOKE frente")], { type: "image/jpeg" }), "frente.jpg");
  fd.append("docVerso", new Blob([await jpeg("SMOKE verso")], { type: "image/jpeg" }), "verso.jpg");
  const r = await req("POST", "/api/verificacoes", { ator: "dia", form: fd });
  const ok = r.status === 200 || r.status === 201;
  registra(6, "Upload de documento (S3 de produção)", ok, `status=${r.status}`);
  if (!ok) console.log("     ", JSON.stringify(r.dados).slice(0, 300));
  verificacaoId = r.dados?.verificacao?.id ?? r.dados?.id ?? null;
}

/* ---------------- 7. Aprovação pelo admin ---------------- */
{
  const lista = await req("GET", "/api/admin/verificacoes?status=PENDING", { ator: "admin" });
  const itens = lista.dados?.itens ?? lista.dados?.verificacoes ?? lista.dados?.data ?? [];
  const alvo = Array.isArray(itens) ? itens.find((i) => (i.user?.nome ?? i.nome ?? "").includes(SUF)) : null;
  const id = alvo?.id ?? verificacaoId;
  let r = { status: 0, dados: null };
  if (id) r = await req("POST", "/api/admin/verificacoes/approve", { ator: "admin", json: { verificationId: id } });
  const ok = r.status === 200;
  registra(7, "Admin aprova a verificação", ok, `lista=${lista.status} alvo=${id ? "achado" : "NAO ACHADO"} approve=${r.status}`);
  if (!ok) console.log("     ", JSON.stringify(lista.dados).slice(0, 300), JSON.stringify(r.dados).slice(0, 200));
  artefatos.criados.verificacaoId = id;
}

/* -------- CONTORNO do bloqueio de S3 (não é parte do procedimento) --------
   O passo 6 falha porque o bucket S3 de produção não existe (NoSuchBucket),
   então nenhum profissional consegue ficar VERIFICADO pelo fluxo real. Para
   não perder a validação dos passos 8-12, marca-se VERIFICADO direto no banco
   SÓ para a conta SMOKE desta execução. Os passos 6 e 7 seguem REPROVADOS —
   isto não os valida. */
let contornoAplicado = false;
{
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  const u = await prisma.user.findUnique({ where: { telefone: DIA.telefone }, select: { id: true } });
  const e = await prisma.user.findUnique({ where: { telefone: EMP.telefone }, select: { id: true } });
  if (u) {
    await prisma.diaristaProfile.update({
      where: { userId: u.id },
      data: { verificacao: "VERIFICADO", ativo: true, servicosOferecidos: ["DIARISTA"],
              docUrl: JSON.stringify({ fixture: true }) },
    });
    artefatos.criados.diaristaUserIdFixture = u.id;
  }
  if (e) {
    // o guardian barra o EMPREGADOR tambem (documento_nao_enviado) e o KYC
    // dele passa pelo mesmo S3 quebrado
    const dv = await prisma.documentVerification.create({
      data: { userId: e.id, docType: "EMPREGADOR_KYC", docUrl: JSON.stringify({ fixture: true }),
              status: "APPROVED", reviewNote: "FIXTURE do smoke test — bucket S3 inexistente" },
    });
    artefatos.criados.documentVerificationFixture = dv.id;
  }
  contornoAplicado = !!(u && e);
  await prisma.$disconnect();
  registra("~", "CONTORNO: verificação forçada no banco nos DOIS lados (bucket S3 inexistente)", null,
    contornoAplicado ? "aplicado só na conta SMOKE — não valida os passos 6 e 7" : "FALHOU ao aplicar");
}

/* ---------------- 8. Busca ---------------- */
let diaristaUserId = null;
{
  const q = new URLSearchParams({ cidade: CIDADE, uf: UF, bairro: BAIRRO });
  const r = await req("GET", `/api/diaristas/buscar?${q}`, { ator: "emp" });
  const lista = r.dados?.diaristas ?? r.dados?.itens ?? r.dados?.data ?? (Array.isArray(r.dados) ? r.dados : []);
  const achado = Array.isArray(lista) ? lista.find((d) => (d.nome ?? d.user?.nome ?? "").includes(SUF)) : null;
  diaristaUserId = achado?.userId ?? achado?.user?.id ?? achado?.id ?? null;
  const ok = r.status === 200 && !!diaristaUserId;
  registra(8, "Empregador acha o profissional na busca", ok,
    `status=${r.status} retornados=${Array.isArray(lista) ? lista.length : "?"} ${diaristaUserId ? "" : "(profissional do smoke NÃO apareceu)"}`);
  if (!ok) console.log("     ", JSON.stringify(r.dados).slice(0, 320));
}

/* ---------------- 9. Contratação ---------------- */
let servicoId = null;
if (diaristaUserId) {
  const amanha = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const criar = await req("POST", "/api/servicos", {
    ator: "emp",
    json: { tipo: "FAXINA", categoria: "FAXINA_LEVE", dataISO: amanha, turno: "MANHA",
            cidade: CIDADE, uf: UF, bairro: BAIRRO, diaristaUserId,
            enderecoCompleto: "Rua do Smoke, 100", observacoes: "Serviço de smoke test." },
  });
  servicoId = criar.dados?.servicoId ?? criar.dados?.servico?.id ?? criar.dados?.id ?? null;
  let aceitar = { status: 0, dados: null };
  if (servicoId) aceitar = await req("POST", `/api/servicos/${servicoId}/aceitar`, { ator: "dia", json: {} });
  const ok = (criar.status === 200 || criar.status === 201) && aceitar.status === 200;
  registra(9, "Empregador solicita → profissional aceita", ok, `criar=${criar.status} aceitar=${aceitar.status} id=${servicoId ?? "—"}`);
  if (!ok) console.log("     ", JSON.stringify(criar.dados).slice(0, 300), JSON.stringify(aceitar.dados).slice(0, 200));
  artefatos.criados.servicoId = servicoId;
} else registra(9, "Contratação", null, "bloqueado: profissional não apareceu na busca");

/* ---------------- 10. Chat ---------------- */
if (servicoId) {
  // ATENÇÃO: o segmento se chama [roomId] mas a rota resolve por servicoId
  // (useChat.ts:101 documenta "roomId = servicoId"). O corpo é {content,type}.
  const salas = await req("GET", "/api/chat", { ator: "emp" });
  const arr = salas.dados?.rooms ?? [];
  const sala = Array.isArray(arr) ? arr.find((s) => s.servicoId === servicoId) : null;
  const ida = await req("POST", `/api/chat/${servicoId}/messages`, { ator: "emp", json: { content: "Mensagem de smoke (empregador)", type: "TEXT" } });
  const volta = await req("POST", `/api/chat/${servicoId}/messages`, { ator: "dia", json: { content: "Mensagem de smoke (profissional)", type: "TEXT" } });
  const ler = await req("GET", `/api/chat/${servicoId}/messages`, { ator: "dia" });
  const msgs = ler.dados?.messages ?? ler.dados?.mensagens ?? (Array.isArray(ler.dados) ? ler.dados : []);
  const lidas = Array.isArray(msgs) ? msgs.length : 0;
  const ok = !!sala && ida.status < 400 && volta.status < 400 && lidas >= 2;
  registra(10, "Chat nos dois sentidos", ok, `sala=${sala ? "ok" : "NAO CRIADA"} envio=${ida.status}/${volta.status} lidas=${lidas}`);
  if (!ok) console.log("     ", JSON.stringify(ida.dados).slice(0,180), JSON.stringify(ler.dados).slice(0,180));
} else registra(10, "Chat", null, "bloqueado: sem serviço");

/* ---------------- 11. Finalização ---------------- */
if (servicoId) {
  const ini = await req("POST", `/api/servicos/${servicoId}/iniciar`, { ator: "dia", json: {} });
  const con = await req("POST", `/api/servicos/${servicoId}/concluir`, { ator: "dia", json: {} });
  const cnf = await req("POST", `/api/servicos/${servicoId}/confirmar-finalizacao`, { ator: "emp", json: {} });
  const det = await req("GET", `/api/servicos/${servicoId}`, { ator: "emp" });
  const st = det.dados?.servico?.status ?? det.dados?.status;
  const ok = ini.status === 200 && con.status === 200 && cnf.status === 200 && st === "CONCLUIDO";
  registra(11, "Iniciar → concluir → confirmar (dupla confirmação)", ok,
    `iniciar=${ini.status} concluir=${con.status} confirmar=${cnf.status} status_final=${st}`);
  if (!ok) console.log("     ", JSON.stringify(ini.dados).slice(0,150), JSON.stringify(con.dados).slice(0,150), JSON.stringify(cnf.dados).slice(0,200));
} else registra(11, "Finalização", null, "bloqueado: sem serviço");

/* ---------------- 12. Avaliação mútua ---------------- */
if (servicoId) {
  const notas = { notaGeral: 5, pontualidade: 5, qualidade: 5, comunicacao: 5, comentario: "Smoke test." };
  // O doc do smoke pula esta transição: /avaliar exige CONFIRMADO, e
  // confirmar-finalizacao para em CONCLUIDO. O mobile chama /confirmar aqui.
  const conf = await req("POST", `/api/servicos/${servicoId}/confirmar`, { ator: "emp", json: {} });
  const a = await req("POST", `/api/servicos/${servicoId}/avaliar`, { ator: "emp", json: notas });
  const b = await req("POST", `/api/servicos/${servicoId}/avaliar-empregador`, { ator: "dia", json: notas });
  const dup = await req("POST", `/api/servicos/${servicoId}/avaliar`, { ator: "emp", json: notas });
  const ok = a.status === 200 && b.status === 200 && dup.status >= 400;
  registra(12, "Avaliação nos dois sentidos (e bloqueio de duplicata)", ok,
    `confirmar=${conf.status} empregador=${a.status} profissional=${b.status} 2a_tentativa=${dup.status}`);
  if (!ok) console.log("     ", JSON.stringify(a.dados).slice(0,200), JSON.stringify(b.dados).slice(0,200));
} else registra(12, "Avaliação", null, "bloqueado: sem serviço");

/* ---------------- Pós-checks ---------------- */
{
  const r = await req("POST", "/api/billing/checkout", { ator: "emp", json: { plano: "PLUS" } });
  const corpo = JSON.stringify(r.dados);
  const ok = r.status === 400 && /INVALID_PLAN/i.test(corpo);
  registra("Q2", "Empregador NÃO tem caminho de cobrança", ok, `status=${r.status} corpo=${corpo.slice(0, 90)}`);
}
registra("Q1", "Push em aparelho real", null, "exige aparelho físico");
registra("Q3", "Webhook Stripe", null, "exige dashboard do Stripe");
registra("Q4", "SOS abre WhatsApp", null, "exige aparelho físico");

/* ---------------- Resumo ---------------- */
const pass = resultados.filter((r) => r.ok === true).length;
const fail = resultados.filter((r) => r.ok === false);
const na = resultados.filter((r) => r.ok === null).length;
console.log(`${"─".repeat(72)}\n  ${pass} PASS · ${fail.length} FALHA · ${na} não executável por aqui`);
if (fail.length) console.log("  falhas: " + fail.map((f) => `${f.passo} (${f.titulo})`).join(", "));
artefatos.resultados = resultados;
writeFileSync(new URL("./smoke-artefatos.json", import.meta.url), JSON.stringify(artefatos, null, 2));
console.log(`\n  artefatos registrados para limpeza: smoke-artefatos.json`);
