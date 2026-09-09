import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * O app entra por OAuth. A ÚNICA conta que usa senha é a de ADMIN, no painel.
 *
 * Estes testes existem porque a superfície de senha voltou a crescer duas
 * vezes por caminhos diferentes: o seed de contas demo gravava `senhaHash`, e
 * `POST /api/auth/register` criava conta com senha para qualquer um. Nos dois
 * casos nada estava "errado" olhando o arquivo isolado — o problema só aparece
 * olhando o conjunto.
 *
 * São testes estruturais: leem o código-fonte em vez de exercitar rotas. É a
 * forma de afirmar "não existe nenhuma outra", que nenhum teste de
 * comportamento consegue provar.
 */

const API = join(process.cwd(), "src/app/api");

/** Todo route.ts sob src/app/api, com o caminho de URL correspondente. */
function rotas(): { url: string; arquivo: string; fonte: string }[] {
  const achados: { url: string; arquivo: string; fonte: string }[] = [];

  function andar(dir: string, url: string) {
    for (const nome of readdirSync(dir)) {
      const caminho = join(dir, nome);
      if (statSync(caminho).isDirectory()) {
        andar(caminho, `${url}/${nome}`);
      } else if (nome === "route.ts" || nome === "route.tsx") {
        achados.push({ url: url || "/", arquivo: caminho, fonte: readFileSync(caminho, "utf8") });
      }
    }
  }

  andar(API, "");
  return achados;
}

describe("superfície de autenticação por senha", () => {
  it("não existe rota de cadastro público", () => {
    assert.equal(
      existsSync(join(API, "auth/register")),
      false,
      "POST /api/auth/register foi removido — cadastro por telefone+senha não existe",
    );
  });

  it("só uma rota escreve senhaHash, e ela exige ADMIN", () => {
    // `senhaHash: null` (anonimização da LGPD) apaga, não cria credencial.
    const escrevem = rotas().filter(({ fonte }) => {
      const semLeitura = fonte
        .replace(/senhaHash:\s*true/g, "")
        .replace(/senhaHash:\s*null/g, "");
      return /senhaHash\s*[,:]/.test(semLeitura);
    });

    const urls = escrevem.map((r) => r.url).sort();
    assert.deepEqual(
      urls,
      ["/admin/admins/create"],
      `esperava só /admin/admins/create escrevendo senha; achei: ${urls.join(", ") || "(nenhuma)"}`,
    );

    // E ela precisa exigir sessão de ADMIN antes de qualquer coisa.
    assert.match(
      escrevem[0].fonte,
      /requireAdmin\s*\(/,
      "a rota que cria ADMIN precisa chamar requireAdmin",
    );
  });

  it("nenhuma rota gera hash de senha sem exigir ADMIN", () => {
    const geramHash = rotas().filter(({ fonte }) =>
      /bcrypt\.hash\s*\(|hashPassword\s*\(/.test(fonte),
    );

    for (const rota of geramHash) {
      assert.match(
        rota.fonte,
        /requireAdmin\s*\(/,
        `${rota.url} gera hash de senha e não exige ADMIN`,
      );
    }
  });

  it("o app mobile não fala com nenhuma rota de senha", () => {
    const mobile = join(process.cwd(), "..", "dular-mobile", "src");
    if (!existsSync(mobile)) return; // o mobile pode não estar presente no CI do web

    const proibidos = ["/api/auth/login", "/api/auth/register"];
    const encontrados: string[] = [];

    function andar(dir: string) {
      for (const nome of readdirSync(dir)) {
        const caminho = join(dir, nome);
        if (statSync(caminho).isDirectory()) {
          andar(caminho);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(nome)) continue;
        const fonte = readFileSync(caminho, "utf8");
        for (const p of proibidos) {
          if (fonte.includes(p)) encontrados.push(`${caminho} -> ${p}`);
        }
      }
    }

    andar(mobile);
    assert.deepEqual(
      encontrados,
      [],
      `o app é OAuth-only e não deve chamar rota de senha:\n${encontrados.join("\n")}`,
    );
  });
});
