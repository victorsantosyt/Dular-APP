#!/usr/bin/env node
/**
 * Falha se algum arquivo de produção importar `components/dev/` por `import`
 * estático.
 *
 * Por que existe: `__DEV__` é otimização de minificador, não controle de
 * acesso. Ele elimina o que está SINTATICAMENTE dentro do condicional, e nada
 * mais. Um componente com `if (!__DEV__) return null` no corpo continua indo
 * inteiro para o bundle publicado — o que fica no topo do módulo (arrays de
 * exemplo, textos, estilos) não está dentro de condicional nenhum.
 *
 * Foi medido, não deduzido: antes desta regra, o `expo export --platform ios`
 * levava para o .hbc de produção o texto de exemplo do simulador de avisos
 * ("Oi! Consegue chegar um pouco mais cedo na quinta?") e o nome "Ana Paula".
 *
 * A forma que funciona é o `require` dentro do próprio `__DEV__`:
 *
 *     const X = __DEV__ ? require("@/components/dev/X").X : () => null;
 *
 * Aí o ramo falso é eliminado e o módulo sai do grafo de verdade.
 *
 * Este check é sintático de propósito: ele não prova que o bundle está limpo,
 * só impede a forma que sabidamente vaza. A prova continua sendo medir o
 * bundle com `expo export` + busca de string, sempre com controle positivo.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src");

/** Importa `components/dev/...` de forma estática, em qualquer das grafias. */
const IMPORT_ESTATICO =
  /^\s*import\s[^;]*?from\s+["'](?:@\/|\.{1,2}\/)?(?:.*\/)?components\/dev\/[^"']+["']/;

function arquivosFonte(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) arquivosFonte(p, acc);
    else if (/\.(ts|tsx)$/.test(e.name)) acc.push(p);
  }
  return acc;
}

const infratores = [];
for (const arquivo of arquivosFonte(RAIZ)) {
  const rel = path.relative(RAIZ, arquivo).split(path.sep).join("/");
  // Os próprios arquivos de dev podem se importar entre si: eles já estão
  // fora do grafo de produção quando ninguém os puxa estaticamente.
  if (rel.startsWith("components/dev/")) continue;

  fs.readFileSync(arquivo, "utf8")
    .split("\n")
    .forEach((linha, i) => {
      if (IMPORT_ESTATICO.test(linha)) {
        infratores.push(`  ${rel}:${i + 1}  ${linha.trim()}`);
      }
    });
}

if (infratores.length > 0) {
  console.error(
    "\n✗ import estático de components/dev/ em arquivo de produção:\n\n" +
      infratores.join("\n") +
      "\n\n  `__DEV__` no corpo do componente NÃO tira o módulo do bundle.\n" +
      '  Use: const X = __DEV__ ? require("@/components/dev/X").X : () => null;\n'
  );
  process.exit(1);
}

console.log("✓ nenhum import estático de components/dev/ fora de dev.");
