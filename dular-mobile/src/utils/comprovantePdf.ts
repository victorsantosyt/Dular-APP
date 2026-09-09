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
  /** As três coisas que se confere primeiro, em destaque no topo da folha. */
  resumo: { servico: string; quando: string };
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
    ? `<section class="bloco larga">
         <h2>Avaliação</h2>
         <p class="nota">${esc(d.avaliacao.nota)}</p>
         ${d.avaliacao.comentario ? `<p class="cita">“${esc(d.avaliacao.comentario)}”</p>` : ""}
         <table>${linhas(d.avaliacao.linhas)}</table>
       </section>`
    : "";

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 36px 40px;
    font-family: -apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif;
    color: #241C36; font-size: 11.5px; line-height: 1.5;
  }

  /* Cabeçalho: identidade à esquerda, identificação do documento à direita. */
  header { display: flex; justify-content: space-between; align-items: flex-start;
           border-bottom: 2px solid #241C36; padding-bottom: 12px; }
  .marca { font-size: 21px; font-weight: 800; letter-spacing: -0.5px; }
  .marca span { color: #6C3BE8; }
  .doc { font-size: 10px; text-transform: uppercase; letter-spacing: 1.2px; color: #6B6480; }
  .protocolo { text-align: right; }
  .protocolo .num { font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .selo { display: inline-block; margin-top: 3px; padding: 2px 9px; border-radius: 999px;
          background: #F1ECFF; color: #5A2FD0; font-size: 9.5px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.6px; }

  /* Resumo: o que se confere primeiro. Antes o valor ficava perdido no meio da
     folha, entre blocos de mesmo peso. */
  .resumo { display: flex; gap: 26px; align-items: flex-end;
            padding: 16px 18px; margin: 18px 0 22px;
            background: #F7F5FF; border-radius: 10px; }
  .resumo .campo { display: flex; flex-direction: column; gap: 1px; }
  .resumo .campo.destaque { flex: 0 0 auto; padding-right: 26px; border-right: 1px solid #E2DBF5; }
  .resumo .rot { font-size: 9px; text-transform: uppercase; letter-spacing: 0.9px;
                 color: #6B6480; font-weight: 700; }
  .resumo .val { font-size: 13px; font-weight: 700; }
  .resumo .valor { font-size: 25px; font-weight: 800; color: #5A2FD0;
                   letter-spacing: -0.7px; line-height: 1.15; }
  .resumo .forma { font-size: 11px; font-weight: 600; color: #6B6480; }

  /* Grade de dois blocos por linha: o par rótulo→valor fica perto, em vez de
     esticado de uma borda à outra da folha. O alinhamento ao topo importa:
     sem ele cada caixa estica até a altura da vizinha mais alta, e Local e
     Datas ficavam com metade da moldura vazia. */
  .grade { display: flex; flex-wrap: wrap; gap: 14px; align-items: flex-start; }
  .bloco { flex: 1 1 calc(50% - 7px); min-width: 0;
           border: 1px solid #EDE9F5; border-radius: 10px; padding: 12px 14px;
           page-break-inside: avoid; }
  .bloco.larga { flex-basis: 100%; }
  h2 { font-size: 9.5px; text-transform: uppercase; letter-spacing: 1.1px;
       color: #6B6480; margin: 0 0 8px; font-weight: 800; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 4px 0; border-bottom: 1px solid #F3F0FA; vertical-align: top; }
  tr:last-child td { border-bottom: none; }
  .k { color: #6B6480; }
  .v { text-align: right; font-weight: 600; padding-left: 10px; }
  .partes { display: flex; flex-direction: column; gap: 10px; }
  .parte { display: flex; flex-direction: column; }
  .papel { font-size: 8.5px; text-transform: uppercase; letter-spacing: 0.8px;
           color: #6B6480; font-weight: 700; }
  .parte strong { font-size: 12.5px; }
  .sub { color: #6B6480; }
  .obs { margin: 8px 0 0; white-space: pre-wrap; color: #4A4360; }
  .obsrot { font-size: 9.5px; text-transform: uppercase; letter-spacing: 1.1px;
            color: #6B6480; font-weight: 800; margin: 10px 0 0; }
  .nota { margin: 0 0 3px; font-weight: 700; }
  .cita { margin: 0 0 8px; font-style: italic; color: #4A4360; }
  footer { margin-top: 22px; padding-top: 10px; border-top: 1px solid #EDE9F5;
           color: #6B6480; font-size: 9.5px; line-height: 1.6; }
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

  <div class="resumo">
    <div class="campo destaque">
      <span class="rot">Valor</span>
      <span class="valor">${esc(d.valor)}</span>
      ${d.viaPix ? '<span class="forma">via PIX</span>' : ""}
    </div>
    <div class="campo">
      <span class="rot">Serviço</span>
      <span class="val">${esc(d.resumo.servico)}</span>
    </div>
    <div class="campo">
      <span class="rot">Quando</span>
      <span class="val">${esc(d.resumo.quando)}</span>
    </div>
  </div>

  <div class="grade">
    <section class="bloco">
      <h2>Partes</h2>
      <div class="partes">${parteProf}${parteCliente}</div>
    </section>

    <section class="bloco">
      <h2>Local</h2>
      <p class="obs" style="margin-top:0">${d.local.map(esc).join("<br />")}</p>
    </section>

    <section class="bloco">
      <h2>Serviço</h2>
      <table>${linhas(d.servico)}</table>
      ${d.observacoes ? `<p class="obsrot">Observações</p><p class="obs">${esc(d.observacoes)}</p>` : ""}
    </section>

    <section class="bloco">
      <h2>Datas</h2>
      <table>${linhas(d.datas)}</table>
    </section>

    ${
      d.pagamento.length > 0
        ? `<section class="bloco larga">
             <h2>${d.viaPix ? "Pagamento · PIX" : "Pagamento"}</h2>
             <table>${linhas(d.pagamento)}</table>
           </section>`
        : ""
    }
    ${avaliacao}
  </div>

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
  const nome = `Comprovante ${protocolo.replace(/[^A-Za-z0-9-]/g, "") || "servico"}.pdf`;
  try {
    const arquivo = new File(uri);

    // Compartilhar o MESMO comprovante duas vezes esbarrava no arquivo da
    // primeira vez: o rename falha quando o destino já existe, caía no catch
    // e o segundo PDF saía com o nome de UUID. Como o alvo é sempre um arquivo
    // nosso, recém-gerado e no cache, apagar o anterior é seguro.
    try {
      const anterior = new File(arquivo.parentDirectory, nome);
      if (anterior.exists) anterior.delete();
    } catch {
      /* se não der para apagar, o rename abaixo decide */
    }

    arquivo.rename(nome);
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
