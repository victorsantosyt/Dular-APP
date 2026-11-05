/**
 * Município e UF a partir da localização do aparelho — a parte que decide, sem
 * imports de app (testada em Node). Quem busca posição e geocodificação é
 * `obterMunicipioAtual` em lib/location.
 *
 * O defeito que originou este módulo: o geocodificador do Android devolve o
 * estado por extenso ("Mato Grosso"), sem sigla. O app cortava as duas
 * primeiras letras — "MA", que é o Maranhão — e anunciava sucesso. Aqui o
 * estado só vira UF por correspondência EXATA com a tabela abaixo (nome
 * completo, sem acento e sem diferença de caixa, ou a própria sigla). O que
 * não casar é recusado, e os campos do formulário ficam como estavam.
 */

export const ESTADOS_DO_BRASIL: ReadonlyArray<readonly [uf: string, nome: string]> = [
  ["AC", "Acre"],
  ["AL", "Alagoas"],
  ["AP", "Amapá"],
  ["AM", "Amazonas"],
  ["BA", "Bahia"],
  ["CE", "Ceará"],
  ["DF", "Distrito Federal"],
  ["ES", "Espírito Santo"],
  ["GO", "Goiás"],
  ["MA", "Maranhão"],
  ["MT", "Mato Grosso"],
  ["MS", "Mato Grosso do Sul"],
  ["MG", "Minas Gerais"],
  ["PA", "Pará"],
  ["PB", "Paraíba"],
  ["PR", "Paraná"],
  ["PE", "Pernambuco"],
  ["PI", "Piauí"],
  ["RJ", "Rio de Janeiro"],
  ["RN", "Rio Grande do Norte"],
  ["RS", "Rio Grande do Sul"],
  ["RO", "Rondônia"],
  ["RR", "Roraima"],
  ["SC", "Santa Catarina"],
  ["SP", "São Paulo"],
  ["SE", "Sergipe"],
  ["TO", "Tocantins"],
];

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const UF_POR_NOME = new Map(ESTADOS_DO_BRASIL.map(([uf, nome]) => [normalizar(nome), uf]));
const UFS = new Set(ESTADOS_DO_BRASIL.map(([uf]) => uf));

/** "Mato Grosso" → "MT"; "mt" → "MT"; "Mato" ou "Grosso" → null. Nunca por prefixo. */
export function ufDoEstado(estado: string | null | undefined): string | null {
  if (typeof estado !== "string") return null;
  const n = normalizar(estado);
  if (!n) return null;
  const sigla = n.toUpperCase();
  if (sigla.length === 2 && UFS.has(sigla)) return sigla;
  const semPrefixo = n.replace(/^estado d[aeo]s? /, "");
  return UF_POR_NOME.get(n) ?? UF_POR_NOME.get(semPrefixo) ?? null;
}

/** Campos do resultado do geocodificador que este módulo usa (expo-location). */
export type EnderecoGeocodificado = {
  city?: string | null;
  subregion?: string | null;
  region?: string | null;
  isoCountryCode?: string | null;
  district?: string | null;
};

export type MunicipioResolvido = { cidade: string; uf: string; bairro: string | null };

export type MotivoSemMunicipio =
  | "permissao-negada"
  | "indisponivel"
  | "imprecisa"
  | "antiga"
  | "sem-endereco"
  | "fora-do-brasil"
  | "estado-nao-reconhecido"
  | "ambigua";

export type ResultadoMunicipio = { ok: true; municipio: MunicipioResolvido } | { ok: false; motivo: MotivoSemMunicipio };

/**
 * Interpreta TODOS os endereços devolvidos para as coordenadas. Se dois
 * apontarem para município ou UF diferentes, a resposta é ambígua — nenhum é
 * escolhido por ser o primeiro.
 */
export function interpretarGeocodificacao(resultados: ReadonlyArray<EnderecoGeocodificado> | null | undefined): ResultadoMunicipio {
  const lista = (resultados ?? []).filter(Boolean);
  if (lista.length === 0) return { ok: false, motivo: "sem-endereco" };

  const candidatos: MunicipioResolvido[] = [];
  let algumForaDoBrasil = false;
  let algumSemEstado = false;
  for (const r of lista) {
    const pais = (r.isoCountryCode ?? "").toUpperCase();
    if (pais && pais !== "BR") {
      algumForaDoBrasil = true;
      continue;
    }
    // Município: `subregion` (no Android, a área administrativa de 2º nível,
    // que no Brasil é o município); `city` só quando ela não vem. A localidade
    // (`city`) pode ser distrito ou vila do município e NÃO é motivo de recusa;
    // o bairro vem de `district`. Município, UF e bairro saem sempre do mesmo
    // resultado; nunca de resultados misturados.
    const municipio = ((r.subregion ?? "").trim() || (r.city ?? "").trim());
    if (!municipio) continue;
    const uf = ufDoEstado(r.region);
    if (!uf) {
      algumSemEstado = true;
      continue;
    }
    const bairro = (r.district ?? "").trim() || null;
    candidatos.push({ cidade: municipio, uf, bairro });
  }

  if (candidatos.length === 0) {
    if (algumSemEstado) return { ok: false, motivo: "estado-nao-reconhecido" };
    if (algumForaDoBrasil) return { ok: false, motivo: "fora-do-brasil" };
    return { ok: false, motivo: "sem-endereco" };
  }
  const chave = (m: MunicipioResolvido) => `${normalizar(m.cidade)}|${m.uf}`;
  const primeira = chave(candidatos[0]);
  if (candidatos.some((m) => chave(m) !== primeira)) return { ok: false, motivo: "ambigua" };
  return { ok: true, municipio: candidatos[0] };
}

/** Raio de incerteza acima do qual a posição não serve para dizer o município. */
export const PRECISAO_MAXIMA_M = 3_000;
/** Posição mais velha que isto é de outro lugar/momento. */
export const IDADE_MAXIMA_MS = 2 * 60_000;

export function avaliarPosicao(
  pos: { coords: { accuracy?: number | null }; timestamp?: number | null },
  agora: number,
): MotivoSemMunicipio | null {
  const precisao = pos.coords.accuracy;
  if (typeof precisao !== "number" || !Number.isFinite(precisao) || precisao > PRECISAO_MAXIMA_M) return "imprecisa";
  if (typeof pos.timestamp === "number" && agora - pos.timestamp > IDADE_MAXIMA_MS) return "antiga";
  return null;
}

/** Mensagem para a pessoa. Nenhuma anuncia sucesso. */
export function mensagemSemMunicipio(motivo: MotivoSemMunicipio): string {
  switch (motivo) {
    case "permissao-negada":
      return "Permissão de localização negada. Preencha cidade e UF manualmente.";
    case "imprecisa":
      return "A localização está imprecisa agora. Tente em local aberto ou preencha manualmente.";
    case "antiga":
      return "A localização do aparelho está desatualizada. Tente novamente em instantes.";
    case "ambigua":
      return "Não foi possível confirmar a cidade pela localização. Preencha manualmente.";
    case "estado-nao-reconhecido":
      return "Não foi possível identificar o estado pela localização. Preencha a UF manualmente.";
    case "fora-do-brasil":
      return "A localização atual está fora do Brasil. Preencha manualmente.";
    case "sem-endereco":
    case "indisponivel":
    default:
      return "Não foi possível obter a cidade pela localização. Preencha manualmente.";
  }
}

/**
 * Consultas que podem chegar atrasadas: só a última iniciada vale, e qualquer
 * edição, fechamento da tela ou troca de conta a invalida.
 */
export function criarConsultaDescartavel() {
  let geracao = 0;
  return {
    iniciar(): () => boolean {
      const minha = ++geracao;
      return () => minha === geracao;
    },
    invalidar(): void {
      geracao++;
    },
  };
}

/**
 * Edição manual de cidade, UF ou bairro: as coordenadas que vieram junto com a
 * localização detectada deixam de valer. Região digitada nunca segue para o
 * servidor com a coordenada de outra origem.
 */
export function editarRegiaoManual<R extends { latitude?: number; longitude?: number }>(regiao: R, alteracao: Partial<R>): R {
  return { ...regiao, ...alteracao, latitude: undefined, longitude: undefined };
}

/**
 * Corpo de PATCH /api/me/localizacao a partir de uma região. As coordenadas
 * só vão quando a região ainda é a detectada (a edição manual as remove em
 * `editarRegiaoManual`); região digitada vai sem coordenada.
 */
export function payloadLocalizacaoAtual(
  regiao: { cidade: string; uf: string; bairro: string; latitude?: number; longitude?: number },
  localizacaoPermitida: boolean,
) {
  const comCoordenada = typeof regiao.latitude === "number" && typeof regiao.longitude === "number";
  return {
    latitude: comCoordenada ? regiao.latitude! : null,
    longitude: comCoordenada ? regiao.longitude! : null,
    cidade: regiao.cidade.trim(),
    estado: regiao.uf.trim().toUpperCase(),
    bairro: regiao.bairro.trim() || null,
    localizacaoPermitida,
  };
}
