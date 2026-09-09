import { File } from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Share } from "react-native";

/**
 * Gera o comprovante em PDF e abre a folha de compartilhamento.
 *
 * Por que existe: um comprovante que só vive dentro do app não serve para o
 * que se guarda um comprovante — mandar ao contador, anexar num seguro,
 * resolver uma discussão. Sem sair da tela, ele é uma tela, não um documento.
 *
 * O PDF repete o que a tela mostra, sem inventar nada: se um dado não existe
 * (data de finalização não registrada, serviço sem PIX), a linha simplesmente
 * não aparece — um comprovante não deve preencher lacuna com suposição.
 */

export type LinhaComprovante = { rotulo: string; valor: string };

export type DadosComprovante = {
  protocolo: string;
  status: string;
  emitidoEm: string;
  servico: LinhaComprovante[];
  observacoes?: string | null;
  profissional: { nome: string; telefone?: string | null };
  contratante?: { nome: string; telefone?: string | null } | null;
  local: string[];
  datas: LinhaComprovante[];
  valor: string;
  pagamento: LinhaComprovante[];
  /** Verdadeiro quando houve PIX — muda o texto da forma de pagamento. */
  viaPix: boolean;
  avaliacao?: { nota: string; comentario?: string | null; linhas: LinhaComprovante[] } | null;
};

/** Escapa o que vai para dentro do HTML. Nome e observação são texto de usuário. */
function esc(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function linhas(itens: LinhaComprovante[]): string {
  return itens
    .map(
      (i) =>
        `<tr><td class="k">${esc(i.rotulo)}</td><td class="v">${esc(i.valor)}</td></tr>`,
    )
    .join("");
}

function secao(titulo: string, corpo: string): string {
  if (!corpo.trim()) return "";
  return `<section><h2>${esc(titulo)}</h2>${corpo}</section>`;
}

function montarHtml(d: DadosComprovante): string {
  const parteProf = `
    <div class="parte">
      <span class="papel">Profissional</span>
      <strong>${esc(d.profissional.nome)}</strong>
      ${d.profissional.telefone ? `<span class="sub">${esc(d.profissional.telefone)}</span>` : ""}
    </div>`;
  const parteCliente = d.contratante
    ? `<div class="parte">
        <span class="papel">Contratante</span>
        <strong>${esc(d.contratante.nome)}</strong>
        ${d.contratante.telefone ? `<span class="sub">${esc(d.contratante.telefone)}</span>` : ""}
      </div>`
    : "";

  const avaliacao = d.avaliacao
    ? secao(
        "Avaliação",
        `<p class="nota">${esc(d.avaliacao.nota)}</p>
         ${d.avaliacao.comentario ? `<p class="cita">“${esc(d.avaliacao.comentario)}”</p>` : ""}
         <table>${linhas(d.avaliacao.linhas)}</table>`,
      )
    : "";

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 40px 44px;
    font-family: -apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif;
    color: #241C36; font-size: 12px; line-height: 1.55;
  }
  header { display: flex; justify-content: space-between; align-items: flex-start;
           border-bottom: 2px solid #241C36; padding-bottom: 14px; margin-bottom: 22px; }
  .marca { font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
  .marca span { color: #6C3BE8; }
  .doc { font-size: 11px; text-transform: uppercase; letter-spacing: 1.2px; color: #6B6480; }
  .protocolo { text-align: right; }
  .protocolo .num { font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .selo { display: inline-block; margin-top: 4px; padding: 2px 9px; border-radius: 999px;
          background: #F1ECFF; color: #5A2FD0; font-size: 10px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.6px; }
  section { margin-bottom: 20px; page-break-inside: avoid; }
  h2 { font-size: 10px; text-transform: uppercase; letter-spacing: 1.1px;
       color: #6B6480; margin: 0 0 7px; font-weight: 800; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 5px 0; border-bottom: 1px solid #EDE9F5; vertical-align: top; }
  tr:last-child td { border-bottom: none; }
  .k { color: #6B6480; }
  .v { text-align: right; font-weight: 600; }
  .partes { display: flex; gap: 28px; }
  .parte { flex: 1; display: flex; flex-direction: column; }
  .papel { font-size: 9px; text-transform: uppercase; letter-spacing: 0.8px;
           color: #6B6480; font-weight: 700; }
  .parte strong { font-size: 13px; }
  .sub { color: #6B6480; }
  .valor { font-size: 26px; font-weight: 800; color: #5A2FD0; letter-spacing: -0.6px;
           margin: 0 0 10px; }
  .forma { color: #6B6480; font-weight: 600; }
  .obs { margin: 0; white-space: pre-wrap; }
  .nota { margin: 0 0 4px; font-weight: 700; }
  .cita { margin: 0 0 8px; font-style: italic; color: #4A4360; }
  footer { margin-top: 26px; padding-top: 12px; border-top: 1px solid #EDE9F5;
           color: #6B6480; font-size: 10px; line-height: 1.6; }
</style></head>
<body>
  <header>
    <div>
      <div class="marca">Du<span>lar</span></div>
      <div class="doc">Comprovante de serviço</div>
    </div>
    <div class="protocolo">
      <div class="num">${esc(d.protocolo)}</div>
      <div class="selo">${esc(d.status)}</div>
    </div>
  </header>

  ${secao("Partes", `<div class="partes">${parteProf}${parteCliente}</div>`)}
  ${secao("Serviço", `<table>${linhas(d.servico)}</table>`)}
  ${d.observacoes ? secao("Observações", `<p class="obs">${esc(d.observacoes)}</p>`) : ""}
  ${secao("Local", `<p class="obs">${d.local.map(esc).join("<br />")}</p>`)}
  ${secao("Datas", `<table>${linhas(d.datas)}</table>`)}
  ${secao(
    "Pagamento",
    `<p class="valor">${esc(d.valor)}${d.viaPix ? ' <span class="forma">via PIX</span>' : ""}</p>
     ${d.pagamento.length > 0 ? `<table>${linhas(d.pagamento)}</table>` : ""}`,
  )}
  ${avaliacao}

  <footer>
    Emitido em ${esc(d.emitidoEm)} · Protocolo ${esc(d.protocolo)}<br />
    O pagamento é feito diretamente entre contratante e profissional. A Dular
    intermedeia a contratação e registra o combinado — não recebe nem repassa
    os valores.
  </footer>
</body></html>`;
}

/**
 * O `printToFileAsync` nomeia o arquivo com um UUID. Quem recebe um
 * "E63F2C83-824F-....pdf" não sabe o que é — e o ponto de exportar é
 * justamente guardar e reencontrar depois. Renomeia para o protocolo.
 *
 * Se falhar, devolve o caminho original: um nome feio é muito melhor do que
 * não conseguir compartilhar.
 */
function renomear(uri: string, protocolo: string): string {
  try {
    const nome = protocolo.replace(/[^A-Za-z0-9-]/g, "") || "servico";
    const arquivo = new File(uri);
    arquivo.rename(`Comprovante ${nome}.pdf`);
    return arquivo.uri;
  } catch {
    return uri;
  }
}

/**
 * Gera e compartilha. Devolve `false` quando o aparelho não oferece nenhuma
 * forma de compartilhar, para a tela avisar em vez de parecer que não fez nada.
 */
export async function compartilharComprovante(dados: DadosComprovante): Promise<boolean> {
  const { uri } = await Print.printToFileAsync({ html: montarHtml(dados) });
  const arquivo = renomear(uri, dados.protocolo);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(arquivo, {
      mimeType: "application/pdf",
      dialogTitle: `Comprovante ${dados.protocolo}`,
      UTI: "com.adobe.pdf",
    });
    return true;
  }

  // Sem folha de compartilhamento (raro): manda ao menos o essencial em texto,
  // para a pessoa não ficar sem nada.
  const resumo = [
    `Comprovante Dular ${dados.protocolo}`,
    `${dados.profissional.nome} · ${dados.valor}`,
    ...dados.datas.map((l) => `${l.rotulo}: ${l.valor}`),
  ].join("\n");
  await Share.share({ message: resumo });
  return true;
}
