/**
 * Recusa chave de objeto sobrescrita em silêncio por um spread.
 *
 * Rodar de dentro de `web/`:
 *   node scripts/check-dupe-keys.mjs
 *
 * POR QUE EXISTE
 *
 * Um bug real deste projeto: a busca de diaristas tinha
 *
 *   where: {
 *     OR: [{ verificacao: "VERIFICADO" }, ...],
 *     ...(filtroTipo.length ? { OR: filtroTipo } : {}),
 *   }
 *
 * Em JavaScript a segunda `OR` sobrescreve a primeira. Buscar com `?tipo=`
 * apagava o filtro de verificação e diarista NÃO VERIFICADA aparecia.
 *
 * POR QUE NÃO BASTA O ESLINT
 *
 * A regra `no-dupe-keys` só pega chave duplicada LITERAL (`{a:1, a:2}`).
 * Verificado: ela NÃO acusa a variante com spread, que é justamente a que
 * passou por tsc, por lint e por toda a suíte de testes.
 *
 * O QUE ESTE SCRIPT NÃO COBRE
 *
 * Spread de variável (`...algumObjeto`), porque o conteúdo só se conhece em
 * execução. Cobre spread de objeto literal, inclusive condicional.
 */
import ts from "typescript";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function arquivos(dir) {
  const out = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) out.push(...arquivos(p));
    else if (/\.tsx?$/.test(n)) out.push(p);
  }
  return out;
}

/** Nome da propriedade, quando estático. */
function nomeProp(p) {
  if (!p.name) return null;
  if (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) return p.name.text;
  return null;
}

/** Chaves que um spread condicional `...(c ? {K:..} : {})` pode introduzir. */
function chavesDoSpread(sp) {
  const chaves = [];
  const visita = (n) => {
    if (ts.isObjectLiteralExpression(n)) {
      for (const p of n.properties) {
        const k = nomeProp(p);
        if (k) chaves.push(k);
      }
      return; // não desce em objetos aninhados
    }
    ts.forEachChild(n, visita);
  };
  visita(sp.expression);
  return chaves;
}

const achados = [];
for (const arq of arquivos("src")) {
  const src = ts.createSourceFile(arq, readFileSync(arq, "utf8"), ts.ScriptTarget.Latest, true);
  const visita = (n) => {
    if (ts.isObjectLiteralExpression(n)) {
      // Só interessa a direção PERIGOSA: uma chave escrita explicitamente e,
      // depois, um SPREAD que a sobrescreve em silêncio. Era o caso do bug:
      //   { OR: [...verificação...], ...(cond ? { OR: [...tipo...] } : {}) }
      //
      // A direção oposta — `{ ...(prev ?? padrão), id: X }` — é idioma comum e
      // deliberado: o spread dá o padrão e a chave explícita manda. Sinalizar
      // isso encheria o relatório de ruído, e scanner ruidoso é scanner
      // desligado.
      const explicitas = new Map();
      for (const p of n.properties) {
        if (ts.isSpreadAssignment(p)) {
          for (const k of chavesDoSpread(p)) {
            if (explicitas.has(k)) {
              const { line } = src.getLineAndCharacterOfPosition(p.getStart());
              achados.push({ arq, linha: line + 1, chave: k });
            }
          }
        } else {
          const k = nomeProp(p);
          if (k) explicitas.set(k, true);
        }
      }
    }
    ts.forEachChild(n, visita);
  };
  visita(src);
}

if (achados.length === 0) {
  console.log("✓ nenhuma chave de objeto sobrescrita por spread.");
  process.exit(0);
}

console.error("\n✖ Chave de objeto sobrescrita em silêncio por um spread.\n");
for (const a of achados) {
  console.error(`  ${a.arq}:${a.linha}  '${a.chave}' apaga o valor escrito acima`);
}
console.error(
  [
    "",
    "Em JavaScript, a última chave vence. Se as duas condições precisam valer,",
    "combine-as (num AND, por exemplo) em vez de repetir a chave.",
    "",
    "Foi assim que o filtro de verificação da busca sumiu quando havia filtro",
    "de tipo — e passou por tsc, lint e testes sem acusar nada.",
    "",
  ].join("\n"),
);
process.exit(1);
