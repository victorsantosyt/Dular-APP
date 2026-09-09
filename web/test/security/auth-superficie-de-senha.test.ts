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

it("nenhum seed grava senha junto de um papel que não é ADMIN", () => {
    // O seed de desenvolvimento criava EMPREGADOR e DIARISTA com senha, e isso
    // desfazia a limpeza a cada execução: a superfície voltava sozinha, sem
    // ninguém mudar uma linha de rota.
    //
    // A checagem é por SITE DE ESCRITA, não por arquivo: `seed.ts` grava a
    // senha do ADMIN e cria contas comuns no mesmo arquivo, e isso é correto.
    // O que não pode é uma escrita de senha dentro do mesmo objeto que define
    // um papel comum.
    const prisma = join(process.cwd(), "prisma");
    const suspeitos: string[] = [];
    const VIZINHANCA = 8; // linhas para cada lado — cobre um object literal

    for (const nome of readdirSync(prisma)) {
      if (!nome.endsWith(".ts")) continue;

      const linhas = readFileSync(join(prisma, nome), "utf8").split("\n");

      linhas.forEach((linha, i) => {
        // Só escritas. `senhaHash: null` apaga; `senhaHash: true` é select;
        // `user.senhaHash` é leitura; linha de comentário não conta.
        if (!/senhaHash\s*[,:]/.test(linha)) return;
        if (/senhaHash:\s*(null|true)/.test(linha)) return;
        if (/^\s*(\/\/|\*|\/\*)/.test(linha)) return;

        const perto = linhas
          .slice(Math.max(0, i - VIZINHANCA), i + VIZINHANCA)
          .join("\n");

        const papel = /role:\s*"(EMPREGADOR|DIARISTA|MONTADOR)"/.exec(perto);
        if (papel) {
          suspeitos.push(`${nome}:${i + 1} grava senha junto de role ${papel[1]}`);
        }
      });
    }

    assert.deepEqual(
      suspeitos,
      [],
      `seed gravando senha para não-ADMIN:\n${suspeitos.join("\n")}`,
    );
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
