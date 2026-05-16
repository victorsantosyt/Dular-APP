/**
 * Helper de completude do perfil profissional da Profissional de Casa.
 *
 * Decisão arquitetural (T-15):
 * - NÃO criamos BabaProfile/CozinheiraProfile.
 * - NÃO criamos UserRole.PROFISSIONAL_CASA.
 * - Tudo segue sob DiaristaProfile + role DIARISTA.
 *
 * Campos avaliados (todos presentes no schema atual após migration T-15):
 *   - DiaristaProfile.ativo, bio, servicosOferecidos
 *   - DiaristaProfile.cidade, estado
 *   - DiaristaProfile.atendeTodaCidade, raioAtendimentoKm
 *   - DiaristaProfile.precoLeve/Medio/Pesada
 *   - DiaristaProfile.precoBabaHora, precoCozinheiraBase, taxaMinima
 *   - DiaristaProfile.valorACombinar, observacaoPreco
 *   - DiaristaProfile.bairros (relação DiaristaBairro)
 *   - User.nome, User.status
 */

// Decimal/string conversível vindo do Prisma. Usamos `unknown` para evitar
// acoplar este helper ao tipo `Decimal` específico do client (cada caller
// passa o que receber do select).
type DecimalLike = number | string | { toString(): string } | null | undefined;

export type DiaristaProfileForCompleteness = {
  ativo: boolean;
  bio: string | null;
  servicosOferecidos: string[];
  cidade: string | null;
  estado: string | null;
  atendeTodaCidade: boolean;
  raioAtendimentoKm: number | null;
  precoLeve: number;
  precoMedio: number;
  precoPesada: number;
  precoBabaHora: DecimalLike;
  precoCozinheiraBase: DecimalLike;
  taxaMinima: DecimalLike;
  valorACombinar: boolean;
  bairros: Array<{ id: string } | { bairroId: string } | Record<string, unknown>>;
  user: { nome: string | null; status: string | null } | null;
};

export type CompletenessResult = {
  completo: boolean;
  motivos: string[];
};

export type ServicoOferecido = "DIARISTA" | "BABA" | "COZINHEIRA";

export const SERVICOS_OFERECIDOS_VALIDOS: ServicoOferecido[] = [
  "DIARISTA",
  "BABA",
  "COZINHEIRA",
];

/**
 * Mapeamento ServicoTipo (enum Prisma) → nicho oferecido (string).
 *
 * Categorias de serviço também caem nesses grupos. PASSA_ROUPA e MONTADOR
 * não fazem parte deste helper (PASSA_ROUPA é da diarista mas não tem nicho
 * dedicado; MONTADOR tem fluxo próprio).
 */
export function nichoFromTipo(tipo: string): ServicoOferecido | null {
  if (tipo === "FAXINA") return "DIARISTA";
  if (tipo === "BABA") return "BABA";
  if (tipo === "COZINHEIRA") return "COZINHEIRA";
  return null;
}

/**
 * Mapeia uma categoria de serviço para o nicho oferecido.
 * Útil quando o caller só tem a categoria (sem o tipo).
 */
export function nichoFromCategoria(categoria: string | null | undefined): ServicoOferecido | null {
  if (!categoria) return null;
  if (categoria.startsWith("FAXINA_")) return "DIARISTA";
  if (categoria.startsWith("BABA_")) return "BABA";
  if (categoria.startsWith("COZINHEIRA_")) return "COZINHEIRA";
  return null;
}

function decimalToNumber(value: DecimalLike): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  // Prisma Decimal expõe toString()
  const n = Number(value.toString());
  return Number.isFinite(n) ? n : 0;
}

/**
 * Computa completude geral do perfil profissional, independente de nicho.
 *
 * Regra de localização (alinhada com o mobile `calcularCompletudeDiarista`):
 * o perfil é considerado com área de atendimento válida se preencheu
 * `cidade && estado` **OU** se tem ao menos um bairro vinculado. O motivo
 * `sem_localizacao` só é reportado quando ambos os fallbacks falham. Isso
 * evita que profissionais marcadas como 100% no app sejam excluídas da busca
 * só por não terem cidade/estado salvos no `DiaristaProfile` direto (caso em
 * que a localização vive nos bairros vinculados).
 */
export function getDiaristaProfileCompleteness(
  profile: DiaristaProfileForCompleteness,
): CompletenessResult {
  const motivos: string[] = [];

  if (profile.user?.status === "BLOQUEADO") motivos.push("usuario_bloqueado");
  if (!profile.ativo) motivos.push("perfil_inativo");
  if (!profile.user?.nome?.trim()) motivos.push("falta_nome");
  if (!profile.bio?.trim()) motivos.push("falta_bio");
  if (!profile.servicosOferecidos?.length) motivos.push("sem_servicos_oferecidos");

  const temCidadeEstado =
    !!profile.cidade?.trim() && !!profile.estado?.trim();
  const temBairros = !!profile.bairros && profile.bairros.length > 0;
  if (!temCidadeEstado && !temBairros) {
    motivos.push("sem_localizacao");
  }

  return { completo: motivos.length === 0, motivos };
}

/**
 * Computa completude específica para um nicho.
 * Inclui as regras de completude geral + a exigência de oferecer o serviço
 * + a exigência de preço apropriado (ou valorACombinar=true).
 */
export function isDiaristaProfileCompleteForServico(
  profile: DiaristaProfileForCompleteness,
  servico: ServicoOferecido,
): CompletenessResult {
  const base = getDiaristaProfileCompleteness(profile);
  const motivos = [...base.motivos];

  if (!profile.servicosOferecidos?.includes(servico)) {
    motivos.push(`nao_oferece_${servico.toLowerCase()}`);
  } else {
    // Validar que tem preço apropriado OU valorACombinar=true
    const valorACombinar = profile.valorACombinar === true;
    if (!valorACombinar) {
      if (servico === "DIARISTA") {
        const leve = profile.precoLeve ?? 0;
        const pesada = profile.precoPesada ?? 0;
        if (leve <= 0 && pesada <= 0) {
          motivos.push("sem_preco_diarista");
        }
      }
      if (servico === "BABA") {
        const baba = decimalToNumber(profile.precoBabaHora);
        if (baba <= 0) {
          motivos.push("sem_preco_baba");
        }
      }
      if (servico === "COZINHEIRA") {
        const cozinheira = decimalToNumber(profile.precoCozinheiraBase);
        if (cozinheira <= 0) {
          motivos.push("sem_preco_cozinheira");
        }
      }
    }
  }

  return { completo: motivos.length === 0, motivos };
}
