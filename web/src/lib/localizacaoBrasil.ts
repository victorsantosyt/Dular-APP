/**
 * Três dados diferentes que o painel mostrava misturados:
 *
 * - Área de atendimento (`cidade`/`estado` + bairros do perfil): gravada pelo
 *   "Salvar área" do app. É ela que a BUSCA filtra (/api/diaristas/buscar,
 *   /api/montadores/buscar).
 * - Localização atual (`cidadeAtual`/`estadoAtual`/`bairroAtual` + latitude,
 *   longitude, `localizacaoAtualizadaEm`): gravada só por PATCH
 *   /api/me/localizacao, a partir do aparelho. Não filtra a busca; as
 *   coordenadas só ORDENAM por proximidade, no servidor.
 * - Endereço cadastrado (`EnderecoUsuario`): o que a pessoa digitou em
 *   "Meus endereços".
 *
 * O app (até a vc14) gravava a localização atual com a UF cortada do nome do
 * estado: "Mato Grosso" → "MA". Este módulo valida o que entra e classifica o
 * que já está gravado, sem decidir reparo nenhum.
 */

export const UFS_DO_BRASIL = new Set([
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
]);

const NOMES_DE_ESTADO = [
  "Acre", "Alagoas", "Amapá", "Amazonas", "Bahia", "Ceará", "Distrito Federal", "Espírito Santo", "Goiás",
  "Maranhão", "Mato Grosso", "Mato Grosso do Sul", "Minas Gerais", "Pará", "Paraíba", "Paraná",
  "Pernambuco", "Piauí", "Rio de Janeiro", "Rio Grande do Norte", "Rio Grande do Sul", "Rondônia",
  "Roraima", "Santa Catarina", "São Paulo", "Sergipe", "Tocantins",
];

export function normalizar(texto: string | null | undefined): string {
  return (texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const ESTADOS_NORMALIZADOS = new Set(NOMES_DE_ESTADO.map(normalizar));

/**
 * UF que o corte de duas letras produzia a partir do nome de OUTRO estado e
 * que, por acaso, é uma UF válida: Mato Grosso/Mato Grosso do Sul → MA,
 * Paraná/Paraíba → PA, Amapá → AM, Roraima → RO. Os outros cortes (MI, SA,
 * RI, DI, SÃ) nem são UF e a validação já recusa.
 */
export const UFS_DE_CORTE_AMBIGUO = new Set(["MA", "PA", "AM", "RO"]);

export function ufValida(uf: string | null | undefined): boolean {
  return UFS_DO_BRASIL.has((uf ?? "").trim().toUpperCase());
}

const SIGLA_DO_NOME: ReadonlyArray<readonly [string, string]> = [
  ["AC", "Acre"], ["AL", "Alagoas"], ["AP", "Amapá"], ["AM", "Amazonas"], ["BA", "Bahia"], ["CE", "Ceará"],
  ["DF", "Distrito Federal"], ["ES", "Espírito Santo"], ["GO", "Goiás"], ["MA", "Maranhão"], ["MT", "Mato Grosso"],
  ["MS", "Mato Grosso do Sul"], ["MG", "Minas Gerais"], ["PA", "Pará"], ["PB", "Paraíba"], ["PR", "Paraná"],
  ["PE", "Pernambuco"], ["PI", "Piauí"], ["RJ", "Rio de Janeiro"], ["RN", "Rio Grande do Norte"],
  ["RS", "Rio Grande do Sul"], ["RO", "Rondônia"], ["RR", "Roraima"], ["SC", "Santa Catarina"],
  ["SP", "São Paulo"], ["SE", "Sergipe"], ["TO", "Tocantins"],
];
const UF_DO_NOME = new Map(SIGLA_DO_NOME.map(([uf, nome]) => [normalizar(nome), uf]));

/**
 * UF canônica de duas letras: a sigla (qualquer caixa) ou o nome COMPLETO do
 * estado por correspondência exata (sem acento e sem diferença de caixa).
 * Nada por prefixo nem por aproximação: o que não casar devolve null.
 */
export function ufCanonica(valor: string | null | undefined): string | null {
  const bruto = (valor ?? "").trim();
  if (!bruto) return null;
  const sigla = bruto.toUpperCase();
  if (sigla.length === 2 && UFS_DO_BRASIL.has(sigla)) return sigla;
  return UF_DO_NOME.get(normalizar(bruto)) ?? null;
}

/** Cidade que na verdade é nome de estado (geocodificação que caía em `region`). */
export function cidadeEhNomeDeEstado(cidade: string | null | undefined): boolean {
  return ESTADOS_NORMALIZADOS.has(normalizar(cidade));
}

export type SinalDeLocalizacao =
  | "UF_INVALIDA"
  | "CIDADE_E_NOME_DE_ESTADO"
  | "MESMA_CIDADE_OUTRA_UF"
  | "UF_DE_CORTE_DIVERGENTE";

/**
 * Sinais de SUSPEITA de que a localização atual foi gravada errada — não
 * comprovam erro (a pessoa pode estar viajando). Só sinais: nenhum
 * deles autoriza trocar a localização atual pela área de atendimento.
 *
 * - MESMA_CIDADE_OUTRA_UF: mesmo nome de cidade da área (ou do endereço), UF
 *   diferente — o caso Água Boa–MT gravado como Água Boa–MA.
 * - UF_DE_CORTE_DIVERGENTE: UF que o corte produzia (MA, PA, AM, RO) e que
 *   diverge da UF da área e do endereço.
 */
export function sinaisDaLocalizacaoAtual(dados: {
  atual: { cidade: string | null; estado: string | null };
  area: { cidade: string | null; estado: string | null };
  endereco?: { cidade: string | null; uf: string | null } | null;
}): SinalDeLocalizacao[] {
  const sinais: SinalDeLocalizacao[] = [];
  const cidadeAtual = normalizar(dados.atual.cidade);
  const ufAtual = (dados.atual.estado ?? "").trim().toUpperCase();
  if (!cidadeAtual && !ufAtual) return sinais;

  if (ufAtual && !UFS_DO_BRASIL.has(ufAtual)) sinais.push("UF_INVALIDA");
  if (cidadeAtual && ESTADOS_NORMALIZADOS.has(cidadeAtual)) sinais.push("CIDADE_E_NOME_DE_ESTADO");

  const referencias = [
    { cidade: normalizar(dados.area.cidade), uf: (dados.area.estado ?? "").trim().toUpperCase() },
    { cidade: normalizar(dados.endereco?.cidade), uf: (dados.endereco?.uf ?? "").trim().toUpperCase() },
  ].filter((r) => r.cidade && r.uf);

  if (cidadeAtual && ufAtual && referencias.some((r) => r.cidade === cidadeAtual && r.uf !== ufAtual)) {
    sinais.push("MESMA_CIDADE_OUTRA_UF");
  }
  if (UFS_DE_CORTE_AMBIGUO.has(ufAtual) && referencias.length > 0 && referencias.every((r) => r.uf !== ufAtual)) {
    sinais.push("UF_DE_CORTE_DIVERGENTE");
  }
  return sinais;
}
