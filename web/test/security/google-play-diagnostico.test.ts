import { describe, it, before, afterEach } from "node:test";
import assert from "node:assert/strict";
import { exportPKCS8, generateKeyPair } from "jose";
import {
  consultarAssinaturaGoogle,
  diagnosticoDoErroGoogle,
  googlePlay,
  reconhecerCompraGoogle,
} from "../../src/lib/lojas";

/**
 * Diagnóstico dos erros do Google (issue #359): no log vão só o código HTTP,
 * `error.status` e `reason`, cada um de uma lista fechada. Nunca a mensagem,
 * o corpo, o token de acesso, o comprovante ou a conta de serviço.
 */

const COMPROVANTE = "comprovante-secreto-0123456789";
const TOKEN_ACESSO = "ya29.token-de-acesso-secreto";
const CONTA = "conta-secreta@projeto-exemplo.iam.gserviceaccount.com";
const SEGREDOS = [COMPROVANTE, TOKEN_ACESSO, CONTA, "projeto-exemplo", "PRIVATE KEY", "mensagem-detalhada", "br.com.dular.app"];

const corpoComSegredos = (status: string, reason: string) => ({
  error: {
    code: 403,
    status,
    message: `mensagem-detalhada citando ${CONTA} e ${COMPROVANTE}`,
    errors: [{ reason, message: `mensagem-detalhada ${TOKEN_ACESSO}`, domain: "androidpublisher" }],
    details: [{ "@type": "x", metadata: { conta: CONTA } }],
  },
});

describe("diagnosticoDoErroGoogle (puro)", () => {
  it("só as quatro chaves, com valores da lista", () => {
    const d = diagnosticoDoErroGoogle("consulta", 403, corpoComSegredos("PERMISSION_DENIED", "insufficientPermissions"));
    assert.deepEqual(d, { etapa: "consulta", http: 403, status: "PERMISSION_DENIED", reason: "insufficientPermissions" });
    for (const s of SEGREDOS) assert.ok(!JSON.stringify(d).includes(s), `vazou ${s}`);
  });

  it("valor fora da lista vira OUTRO — mesmo que o Google mande um segredo no lugar do status", () => {
    const d = diagnosticoDoErroGoogle("consulta", 400, corpoComSegredos(COMPROVANTE, TOKEN_ACESSO));
    assert.equal(d.status, "OUTRO");
    assert.equal(d.reason, "OUTRO");
    assert.equal(diagnosticoDoErroGoogle("consulta", 400, { error: { status: 42, errors: [{ reason: {} }] } }).status, "OUTRO");
  });

  it("campo ausente, corpo vazio ou que não é JSON: AUSENTE; código HTTP inválido: 0", () => {
    assert.deepEqual(diagnosticoDoErroGoogle("consulta", 404, null), { etapa: "consulta", http: 404, status: "AUSENTE", reason: "AUSENTE" });
    assert.deepEqual(diagnosticoDoErroGoogle("consulta", 500, "<html>erro</html>"), { etapa: "consulta", http: 500, status: "AUSENTE", reason: "AUSENTE" });
    assert.equal(diagnosticoDoErroGoogle("consulta", Number.NaN, {}).http, 0);
  });

  it("OAuth: o campo `error` vai em status; a descrição nunca", () => {
    const d = diagnosticoDoErroGoogle("oauth", 400, { error: "invalid_grant", error_description: `mensagem-detalhada ${CONTA}` });
    assert.deepEqual(d, { etapa: "oauth", http: 400, status: "invalid_grant", reason: "AUSENTE" });
  });
});

describe("diagnóstico no caminho real (lojas.ts)", () => {
  let contaJson: string;
  let logs: string[];
  const warnOriginal = console.warn;
  const errorOriginal = console.error;
  const logOriginal = console.log;
  const buscarOriginal = googlePlay.buscar;
  const envOriginal = { pacote: process.env.GOOGLE_PLAY_PACKAGE_NAME, conta: process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON };
  let n = 0;

  before(async () => {
    const { privateKey } = await generateKeyPair("RS256", { extractable: true });
    contaJson = JSON.stringify({ client_email: CONTA, private_key: await exportPKCS8(privateKey) });
  });

  function prepararGoogle(resposta: (url: string) => Response) {
    // Conta diferente a cada teste: o token de acesso não vem do cache.
    process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON = contaJson.replace(CONTA, CONTA.replace("conta-secreta", `conta-secreta-${++n}`));
    process.env.GOOGLE_PLAY_PACKAGE_NAME = "br.com.dular.app";
    logs = [];
    const capturar = (...a: unknown[]) => logs.push(a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" "));
    console.warn = capturar;
    console.error = capturar;
    console.log = capturar;
    googlePlay.buscar = (async (url: string) => resposta(url)) as typeof googlePlay.buscar;
  }

  afterEach(() => {
    console.warn = warnOriginal;
    console.error = errorOriginal;
    console.log = logOriginal;
    googlePlay.buscar = buscarOriginal;
    if (envOriginal.pacote === undefined) delete process.env.GOOGLE_PLAY_PACKAGE_NAME;
    else process.env.GOOGLE_PLAY_PACKAGE_NAME = envOriginal.pacote;
    if (envOriginal.conta === undefined) delete process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
    else process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON = envOriginal.conta;
  });

  const oauthOk = () => Response.json({ access_token: TOKEN_ACESSO, expires_in: 3600 });
  const semSegredo = () => {
    const tudo = logs.join("\n");
    for (const s of SEGREDOS) assert.ok(!tudo.includes(s), `log vazou ${s}`);
  };

  it("falta de permissão na consulta: registra 403 PERMISSION_DENIED, sem segredo", async () => {
    prepararGoogle((url) => (url.includes("oauth2") ? oauthOk() : Response.json(corpoComSegredos("PERMISSION_DENIED", "permissionDenied"), { status: 403 })));
    await assert.rejects(consultarAssinaturaGoogle(COMPROVANTE), /LOJA_INDISPONIVEL|Google respondeu 403/);
    assert.equal(logs.length, 1);
    assert.match(logs[0], /^\[google-play\] erro do Google /);
    assert.deepEqual(JSON.parse(logs[0].replace("[google-play] erro do Google ", "")), {
      etapa: "consulta",
      http: 403,
      status: "PERMISSION_DENIED",
      reason: "permissionDenied",
    });
    semSegredo();
  });

  it("comprovante inexistente: registra 400 INVALID_ARGUMENT/invalid", async () => {
    prepararGoogle((url) => (url.includes("oauth2") ? oauthOk() : Response.json(corpoComSegredos("INVALID_ARGUMENT", "invalid"), { status: 400 })));
    await assert.rejects(consultarAssinaturaGoogle(COMPROVANTE));
    assert.match(logs[0], /"http":400,"status":"INVALID_ARGUMENT","reason":"invalid"/);
    semSegredo();
  });

  it("falha de autenticação no OAuth: registra a etapa oauth, sem a descrição", async () => {
    prepararGoogle(() => Response.json({ error: "invalid_grant", error_description: `mensagem-detalhada ${CONTA}` }, { status: 400 }));
    await assert.rejects(consultarAssinaturaGoogle(COMPROVANTE), /OAuth respondeu 400/);
    assert.match(logs[0], /"etapa":"oauth","http":400,"status":"invalid_grant","reason":"AUSENTE"/);
    semSegredo();
  });

  it("reconhecimento recusado: registra só o diagnóstico", async () => {
    prepararGoogle((url) => (url.includes("oauth2") ? oauthOk() : Response.json(corpoComSegredos("PERMISSION_DENIED", "forbidden"), { status: 403 })));
    await assert.rejects(reconhecerCompraGoogle("br.com.dular.diarista.pro.mensal", COMPROVANTE));
    assert.match(logs[0], /"etapa":"reconhecimento","http":403,"status":"PERMISSION_DENIED","reason":"forbidden"/);
    semSegredo();
  });

  it("applicationNotFound: LOJA_INDISPONIVEL; comprovante inexistente ou inválido: COMPRA_INVALIDA", async () => {
    const casos: [number, unknown, string][] = [
      [404, { error: { code: 404, errors: [{ reason: "applicationNotFound" }] } }, "LOJA_INDISPONIVEL"],
      [404, { error: { code: 404, status: "NOT_FOUND", errors: [{ reason: "notFound" }] } }, "COMPRA_INVALIDA"],
      [400, { error: { code: 400, status: "INVALID_ARGUMENT", errors: [{ reason: "invalid" }] } }, "COMPRA_INVALIDA"],
      [410, { error: { code: 410, errors: [{ reason: "purchaseTokenNoLongerValid" }] } }, "COMPRA_INVALIDA"],
      [404, null, "COMPRA_INVALIDA"],
      [403, { error: { code: 403, status: "PERMISSION_DENIED", errors: [{ reason: "permissionDenied" }] } }, "LOJA_INDISPONIVEL"],
    ];
    for (const [http, corpo, esperado] of casos) {
      prepararGoogle((url) => (url.includes("oauth2") ? oauthOk() : corpo === null ? new Response("x", { status: http }) : Response.json(corpo, { status: http })));
      await assert.rejects(consultarAssinaturaGoogle(COMPROVANTE), (e: any) => {
        assert.equal(e.codigo, esperado, `${http} ${JSON.stringify(corpo)}`);
        return true;
      });
      semSegredo();
    }
  });

  it("controle positivo: consulta bem-sucedida não registra erro", async () => {
    prepararGoogle((url) => (url.includes("oauth2") ? oauthOk() : Response.json({}, { status: 200 })));
    await consultarAssinaturaGoogle(COMPROVANTE).catch(() => {});
    assert.equal(logs.filter((l) => l.includes("erro do Google")).length, 0);
  });
});
