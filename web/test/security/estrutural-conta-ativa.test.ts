import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Teste ESTRUTURAL: varre o diretório, não uma lista.
 *
 * A lição do #245 é que teste que enumera rotas não cobre a rota que ainda não
 * existe — o /admin tinha proteção por rota, cada uma opt-in, e bastou uma
 * nascer sem ela. Aqui a fonte é o próprio sistema de arquivos: rota nova
 * aparece sozinha na varredura e reprova até ser guardada ou entrar na
 * allowlist, que é visível em diff.
 */

const RAIZ = path.join(__dirname, "..", "..", "src", "app", "api");

/**
 * Rotas que NÃO checam conta ativa, por decisão, cada uma com o motivo.
 *
 * `chamadas` é o número de `requireAuth(` esperado no arquivo. Existe para que
 * a exceção não vire porta: se alguém acrescentar um handler novo no mesmo
 * arquivo usando o helper antigo, a contagem muda e o teste reprova mesmo o
 * arquivo estando na lista.
 */
const ALLOWLIST: Record<string, { chamadas: number; motivo: string }> = {
  "me/route.ts": {
    chamadas: 1,
    motivo:
      "DELETE exclui a própria conta. Excluir os próprios dados é direito do " +
      "titular pela LGPD e não fica suspenso por bloqueio administrativo. " +
      "GET e PUT do mesmo arquivo JÁ usam requireAuthAtivo — era o PUT que " +
      "deixava uma conta REMOVIDO reescrever nome e e-mail. Conta já excluída " +
      "recebe JA_REMOVIDO (409) pela própria lógica da rota.",
  },
  "me/guardian/route.ts": {
    chamadas: 1,
    motivo:
      "É a rota que explica à pessoa POR QUE ela foi bloqueada. Negá-la a " +
      "quem está bloqueado transforma contenção em opacidade: o app trava os " +
      "botões e não consegue dizer o motivo. Devolve só a matriz de " +
      "permissões e os motivos, sem o score bruto.",
  },
  "me/profile/route.ts": {
    chamadas: 1,
    motivo:
      "Usa requireAuth dentro de resolverUsuario, que aceita as duas " +
      "autenticações (Bearer do app e sessão NextAuth da web). A checagem " +
      "vem logo depois, com assertContaAtiva sobre o userId resolvido — " +
      "assim vale para os dois caminhos num ponto só. Não é exceção de " +
      "fato: a rota É guardada.",
  },
};

function rotasDeApi(dir: string, acc: string[] = []): string[] {
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entrada.name);
    if (entrada.isDirectory()) rotasDeApi(p, acc);
    else if (entrada.name === "route.ts") acc.push(p);
  }
  return acc;
}

const rel = (p: string) => path.relative(RAIZ, p).split(path.sep).join("/");

describe("estrutural — toda rota autenticada confere conta ativa", () => {
  const rotas = rotasDeApi(RAIZ).filter((p) => !rel(p).startsWith("admin/"));

  // CONTROLE POSITIVO do próprio varredor: se ele parar de achar arquivos,
  // todos os testes abaixo passariam por vacuidade.
  it("a varredura encontra as rotas", () => {
    assert.ok(rotas.length > 40, `varredura achou só ${rotas.length} rotas`);
  });

  it("nenhuma rota fora da allowlist usa requireAuth direto", () => {
    const infratoras: string[] = [];

    for (const arquivo of rotas) {
      const nome = rel(arquivo);
      const linhas = fs.readFileSync(arquivo, "utf8").split("\n");

      linhas.forEach((linha, i) => {
        // Só a chamada, não o import nem requireAuthAtivo/requireAuthOuSessao.
        if (!/(?<![A-Za-z])requireAuth\s*\(/.test(linha)) return;
        if (/^\s*import\b/.test(linha)) return;
        if (ALLOWLIST[nome]) return;
        infratoras.push(`${nome}:${i + 1}  ${linha.trim()}`);
      });
    }

    assert.deepEqual(
      infratoras,
      [],
      "Rota autenticada usando requireAuth em vez de requireAuthAtivo.\n" +
        "Troque pelo helper que confere status, ou acrescente à ALLOWLIST " +
        "deste arquivo com o motivo escrito.\n\n" +
        infratoras.join("\n")
    );
  });

  // A exceção não pode virar porta para handlers novos no mesmo arquivo.
  for (const [nome, { chamadas, motivo }] of Object.entries(ALLOWLIST)) {
    it(`${nome} mantém exatamente ${chamadas} uso(s) de requireAuth`, () => {
      const caminho = path.join(RAIZ, nome);
      assert.ok(fs.existsSync(caminho), `${nome} não existe mais — revise a allowlist`);
      const encontradas = fs
        .readFileSync(caminho, "utf8")
        .split("\n")
        .filter((l) => /(?<![A-Za-z])requireAuth\s*\(/.test(l) && !/^\s*import\b/.test(l));
      assert.equal(
        encontradas.length,
        chamadas,
        `${nome} tem ${encontradas.length} usos de requireAuth, esperado ${chamadas}.\n` +
          `Motivo da exceção: ${motivo}\n` +
          `Se o handler novo também deve escapar da checagem, atualize a contagem ` +
          `e escreva o porquê. Se não deve, use requireAuthAtivo.`
      );
    });
  }

  it("a allowlist não tem entrada órfã", () => {
    for (const nome of Object.keys(ALLOWLIST)) {
      assert.ok(
        fs.existsSync(path.join(RAIZ, nome)),
        `${nome} está na allowlist e não existe — remova a entrada`
      );
    }
  });
});
