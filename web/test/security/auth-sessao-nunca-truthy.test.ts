import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";

/**
 * A sessão do Auth.js NUNCA pode ser checada pela própria existência.
 *
 * CVE-2026-73421: quando a configuração do Auth.js dá erro de servidor, o
 * objeto devolvido por `auth()` deixa de ser `null` e passa a ser
 *
 *   { message: "There was a problem with the server configuration..." }
 *
 * Truthy. Então `if (auth)` / `!!session` / `if (req.auth)` vira `true` para
 * TODA requisição, inclusive não autenticada — a aplicação falha aberta
 * justamente quando a autenticação quebrou (CWE-636).
 *
 * O objeto de erro não tem `user`. Por isso `session?.user?.id` falha fechado,
 * e é o padrão que os 12 pontos de chamada seguem hoje. Nada travava isso: uma
 * linha nova escrita como `if (!session)` reabriria o buraco em silêncio, e
 * nem `tsc` nem lint diriam nada — os dois aceitam as duas formas.
 *
 * O gatilho não é hipotético neste projeto: a configuração depende de
 * GOOGLE_CLIENT_ID e das variáveis da Apple, e já houve deploy com essas
 * variáveis ausentes.
 *
 * O que este teste EXIGE: todo valor vindo de `auth()` precisa ser lido através
 * de `user` — `session?.user?.id`, `session.user.role`, desestruturar `user`.
 * O que ele PROÍBE: usar o valor cru num contexto booleano.
 *
 * O que ele NÃO cobre: `auth()` guardado em campo de objeto ou devolvido por
 * outra função antes de ser checado. Continua valendo ler o código.
 */

const SRC = join(process.cwd(), "src");

function arquivosTs(dir: string): string[] {
  const saida: string[] = [];
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) saida.push(...arquivosTs(caminho));
    else if (/\.tsx?$/.test(nome)) saida.push(caminho);
  }
  return saida;
}

/** `X` em `X.user`, `X?.user` ou `X!.user` — o acesso que torna a leitura segura. */
function acessaUser(no: ts.Node): boolean {
  const pai = no.parent;
  if (ts.isPropertyAccessExpression(pai) && pai.expression === no) {
    return pai.name.text === "user";
  }
  // `X!.user`
  if (ts.isNonNullExpression(pai)) return acessaUser(pai);
  return false;
}

/**
 * O identificador está sendo lido como booleano?
 *
 * Só estes casos: condição de `if`/ternário/laço, operando de `!`, e operando
 * de `&&`/`||`. Passar a sessão adiante como argumento, ou lê-la por `.user`,
 * não entra aqui — é justamente o uso legítimo.
 */
function emContextoBooleano(no: ts.Node): boolean {
  const pai = no.parent;
  if (ts.isPrefixUnaryExpression(pai) && pai.operator === ts.SyntaxKind.ExclamationToken) return true;
  if (ts.isIfStatement(pai) && pai.expression === no) return true;
  if (ts.isConditionalExpression(pai) && pai.condition === no) return true;
  if (ts.isWhileStatement(pai) && pai.expression === no) return true;
  if (ts.isBinaryExpression(pai)) {
    const op = pai.operatorToken.kind;
    if (
      op === ts.SyntaxKind.AmpersandAmpersandToken ||
      op === ts.SyntaxKind.BarBarToken
    ) {
      return true;
    }
  }
  return false;
}

type Violacao = { arquivo: string; linha: number; trecho: string };

function analisar(caminho: string): Violacao[] {
  const fonte = readFileSync(caminho, "utf8");
  // Só arquivos que realmente falam com o Auth.js.
  if (!/auth-oauth|next-auth/.test(fonte)) return [];

  const sf = ts.createSourceFile(caminho, fonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const violacoes: Violacao[] = [];
  const vindosDeAuth = new Set<string>();

  // 1) quem recebe o resultado de auth()
  const coletar = (no: ts.Node) => {
    if (ts.isVariableDeclaration(no) && no.initializer) {
      let init: ts.Expression = no.initializer;
      if (ts.isAwaitExpression(init)) init = init.expression;
      const chamaAuth =
        ts.isCallExpression(init) &&
        ts.isIdentifier(init.expression) &&
        init.expression.text === "auth";
      if (chamaAuth) {
        // Desestruturar já é acesso: `const { user } = await auth()`.
        if (ts.isIdentifier(no.name)) vindosDeAuth.add(no.name.text);
      }
    }
    ts.forEachChild(no, coletar);
  };
  coletar(sf);

  const registrar = (no: ts.Node) => {
    const { line } = sf.getLineAndCharacterOfPosition(no.getStart());
    violacoes.push({
      arquivo: relative(process.cwd(), caminho),
      linha: line + 1,
      trecho: fonte.split("\n")[line].trim(),
    });
  };

  // 2) usos crus em contexto booleano
  const conferir = (no: ts.Node) => {
    if (ts.isIdentifier(no) && vindosDeAuth.has(no.text)) {
      // a própria declaração não conta
      const ehDeclaracao = ts.isVariableDeclaration(no.parent) && no.parent.name === no;
      if (!ehDeclaracao && !acessaUser(no) && emContextoBooleano(no)) {
        registrar(no);
      }
    }

    // 3) o padrão do advisory: `req.auth` lido como booleano
    if (
      ts.isPropertyAccessExpression(no) &&
      no.name.text === "auth" &&
      !acessaUser(no) &&
      emContextoBooleano(no)
    ) {
      registrar(no);
    }

    ts.forEachChild(no, conferir);
  };
  conferir(sf);

  return violacoes;
}

describe("sessão do Auth.js nunca é checada pela existência", () => {
  it("todo uso de auth() passa por `user`", () => {
    const violacoes = arquivosTs(SRC).flatMap(analisar);

    const relato = violacoes
      .map((v) => `  ${v.arquivo}:${v.linha}  ${v.trecho}`)
      .join("\n");

    assert.deepEqual(
      violacoes,
      [],
      "sessão do Auth.js usada como booleano — o objeto de erro de configuração é truthy\n" +
        "e essa checagem passa a aceitar TODA requisição (CVE-2026-73421).\n" +
        "Use `session?.user?.id`:\n" +
        relato,
    );
  });

  it("o scanner reconhece as duas formas — controle do próprio teste", () => {
    // Sem isto, um scanner que não acha nada é indistinguível de um scanner
    // quebrado. Aqui ele é exercitado contra código sintético conhecido.
    const { writeFileSync, mkdtempSync, rmSync } = require("node:fs") as typeof import("node:fs");
    const { tmpdir } = require("node:os") as typeof import("node:os");

    const dir = mkdtempSync(join(tmpdir(), "auth-scan-"));
    try {
      const perigoso = join(dir, "perigoso.ts");
      writeFileSync(
        perigoso,
        `import { auth } from "@/lib/auth-oauth";\n` +
          `export async function GET() {\n` +
          `  const session = await auth();\n` +
          `  if (!session) return new Response("no", { status: 401 });\n` +
          `  return Response.json({ ok: true });\n` +
          `}\n`,
      );
      assert.equal(analisar(perigoso).length, 1, "deveria acusar `if (!session)`");

      const seguro = join(dir, "seguro.ts");
      writeFileSync(
        seguro,
        `import { auth } from "@/lib/auth-oauth";\n` +
          `export async function GET() {\n` +
          `  const session = await auth();\n` +
          `  if (!session?.user?.id) return new Response("no", { status: 401 });\n` +
          `  return Response.json({ id: session.user.id });\n` +
          `}\n`,
      );
      assert.deepEqual(analisar(seguro), [], "não pode acusar `session?.user?.id`");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
