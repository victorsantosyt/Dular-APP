import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Escrita dupla do SafeScore (PR B, etapa 2) — ordem e tratamento de erro de
 * cada call-site, lidos do código. A execução real está em
 * safescore-escrita-dupla-db.test.ts.
 *
 * Varre o diretório, não uma lista: um call-site novo reprova até alguém dizer
 * aqui como ele trata falha de score.
 */

const SRC = path.join(process.cwd(), "src");
const ler = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf8");

function arquivos(dir: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) arquivos(p, acc);
    else if (/\.(ts|tsx)$/.test(e.name)) acc.push(path.relative(SRC, p).split(path.sep).join("/"));
  }
  return acc;
}

type Tratamento = "propaga" | "loga-e-segue" | "transacao";

const CALL_SITES: Record<string, Tratamento> = {
  "app/api/admin/verificacoes/approve/route.ts": "propaga",
  "app/api/admin/verificacoes/reprove/route.ts": "loga-e-segue",
  "app/api/admin/incidentes/[id]/resolver/route.ts": "propaga",
  "app/api/servicos/[id]/cancelar/route.ts": "loga-e-segue",
  "app/api/servicos/[id]/avaliar/route.ts": "propaga",
  "app/api/servicos/[id]/avaliar-empregador/route.ts": "propaga",
  "app/api/servicos/[id]/confirmar/route.ts": "transacao",
};

const LIBS_DO_LEDGER = new Set(["lib/safeScore.ts", "lib/safeScore/applyEvent.ts"]);
const QUALQUER_ESCRITA = /\b(aplicarEvento|aplicarEventoNaTransacao|aplicarEventoV2NaTransacao|applyEvent|aplicarEventoV2)\s*\(/;

/** Cada chamada `nome(` até o `;` que fecha a instrução. */
function instrucoes(texto: string, nome: string): string[] {
  const r: string[] = [];
  const re = new RegExp(`\\b${nome}\\s*\\(`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto))) {
    const fim = texto.indexOf(";", m.index);
    r.push(texto.slice(m.index, fim === -1 ? undefined : fim + 1));
  }
  return r;
}

function corpo(texto: string, inicio: string, ate: string): string {
  const i = texto.indexOf(inicio);
  assert.ok(i >= 0, `não achei: ${inicio}`);
  const f = texto.indexOf(ate, i + inicio.length);
  return texto.slice(i, f === -1 ? undefined : f);
}

describe("escrita dupla — call-sites", () => {
  it("o conjunto de arquivos que escrevem score é exatamente o revisado", () => {
    const achados = arquivos(SRC)
      .filter((rel) => !LIBS_DO_LEDGER.has(rel))
      .filter((rel) => QUALQUER_ESCRITA.test(ler(rel)))
      .sort();
    assert.deepEqual(achados, Object.keys(CALL_SITES).sort());
  });

  it("registrarMotivoGrave não escreve score: abre incidente", () => {
    const t = ler("lib/safetyMotivo.ts");
    assert.doesNotMatch(t, QUALQUER_ESCRITA);
    assert.match(t, /incidentReport\.create\(/);
  });

  for (const [rel, tratamento] of Object.entries(CALL_SITES)) {
    it(`${rel}: ${tratamento}`, () => {
      const t = ler(rel);
      // Só as instruções de score importam: `req.json().catch(() => null)` para
      // ler o corpo da requisição é outra coisa e continua legítimo.
      for (const c of instrucoes(t, "aplicarEvento")) {
        assert.doesNotMatch(c, /\.catch\(\s*\(\)\s*=>\s*null\s*\)/, `\`.catch(() => null)\` esconde a falha: ${c.slice(0, 80)}`);
      }

      if (tratamento === "propaga") {
        const chamadas = instrucoes(t, "aplicarEvento");
        assert.ok(chamadas.length > 0);
        for (const c of chamadas) assert.doesNotMatch(c, /\.catch\(/, `não pode engolir: ${c.slice(0, 80)}`);
      }

      if (tratamento === "loga-e-segue") {
        const chamadas = instrucoes(t, "aplicarEvento");
        assert.ok(chamadas.length > 0);
        for (const c of chamadas) {
          assert.match(c, /\.catch\(\s*\(\s*err\s*\)\s*=>\s*\{/, `precisa de catch com o erro: ${c.slice(0, 80)}`);
          assert.match(c, /console\.error\(/, "a falha tem que ficar visível");
        }
      }

      if (tratamento === "transacao") {
        assert.doesNotMatch(t, /\baplicarEvento\s*\(/, "fora da transação o status ficaria confirmado sem evento");

        // Delimita o callback de `prisma.$transaction(` pelo parêntese que o fecha.
        const tx = t.indexOf("prisma.$transaction(");
        assert.ok(tx >= 0, "o confirmar tem que abrir uma transação");
        let profundidade = 0;
        let fimTx = -1;
        for (let i = tx + "prisma.$transaction".length; i < t.length; i++) {
          const ch = t[i];
          if (ch === '"' || ch === "'" || ch === "`") {
            const fecha = t.indexOf(ch, i + 1);
            i = fecha === -1 ? t.length : fecha;
          } else if (ch === "(") {
            profundidade++;
          } else if (ch === ")" && --profundidade === 0) {
            fimTx = i;
            break;
          }
        }
        assert.ok(fimTx > tx, "não achei o fim da transação");
        const dentro = t.slice(tx, fimTx);
        const depois = t.slice(fimTx);

        const cas = dentro.indexOf("updateMany(");
        assert.ok(
          cas >= 0 && dentro.slice(cas).search(/\baplicarEventoV2NaTransacao\(\s*tx\b/) > 0,
          "status (CAS) e evento V2 dentro da mesma transação, nessa ordem",
        );
        // O legado dentro da transação alonga a trava do status: as requisições
        // concorrentes estouram o timeout do Prisma e recebem 500 em vez de 409.
        assert.doesNotMatch(dentro, /\b(aplicarEventoNaTransacao|aplicarLegadoESuspensao)\s*\(/, "legado não pode rodar dentro da transação do status");
        assert.match(depois, /\baplicarLegadoESuspensao\s*\(/, "legado e suspensão rodam depois do commit");
        assert.match(t, /status:\s*"CONCLUIDO"/, "o CAS exige o status de origem");
        assert.match(t, /cas\.count === 0/, "CAS perdido tem que falhar");
      }
    });
  }
});

describe("escrita dupla — ordem dentro do ledger", () => {
  const t = ler("lib/safeScore.ts");

  it("aplicarEvento: V2 primeiro, sem try em volta; legado depois", () => {
    const c = corpo(t, "export async function aplicarEvento(", "export async function aplicarEventoNaTransacao(");
    const v2 = c.indexOf("await applyEvent(");
    const legado = c.indexOf("aplicarNoLegado(");
    assert.ok(v2 >= 0 && legado > v2, "applyEvent tem que vir antes do legado");
    assert.doesNotMatch(c.slice(0, v2), /\btry\s*\{/, "o V2 não pode estar dentro de try que engula o erro");
  });

  it("aplicarEventoNaTransacao: V2 antes do legado, na mesma transação", () => {
    const c = corpo(t, "export async function aplicarEventoNaTransacao(", "\n}\n");
    const v2 = c.indexOf("aplicarEventoV2(tx");
    const legado = c.indexOf("aplicarNoLegado(tx");
    assert.ok(v2 >= 0 && legado > v2);
  });

  it("não sobrou escrita dupla silenciosa", () => {
    assert.doesNotMatch(t, /falha silenciosa/);
  });
});
