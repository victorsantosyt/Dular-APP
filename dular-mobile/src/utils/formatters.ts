export function mapStatus(status: string): string {
  const map: Record<string, string> = {
    SOLICITADO: "pendente",
    PENDENTE: "pendente",
    ACEITO: "aceita",
    CONFIRMADO: "confirmado",
    EM_ANDAMENTO: "andamento",
    // Sem esta entrada o status caía no fallback e virava "pendente" no mapa do
    // hook → o card exibia "Aceitar" depois de finalizado (bug). Agora é um
    // estado próprio de espera (sem ação).
    AGUARDANDO_FINALIZACAO: "aguardando",
    CONCLUIDO: "concluida",
    FINALIZADO: "finalizado",
    CANCELADO: "cancelada",
  };
  return map[status] ?? status.toLowerCase();
}

/**
 * A data do serviço é gravada como meia-noite UTC ("2026-06-24T00:00:00Z").
 * Exibi-la com `new Date(...)` em fuso negativo (Brasil, UTC-3) desliza o dia
 * (mostra o anterior/seguinte). Este helper lê os componentes em UTC e remonta
 * no dia de calendário LOCAL correto. Retorna null se inválida.
 *
 * Use SOMENTE para datas-só (data agendada do serviço). NÃO use para instantes
 * reais (createdAt, finalizadoEm) — esses devem manter o horário local.
 */
export function parseDataServico(value?: string | number | Date | null): Date | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
}

export function formatMoneyFromCents(value?: number | string | null) {
  // precoBase/taxaMinima vêm do backend como Decimal, que o JSON serializa como
  // string ("12000"). Sem coerção, o typeof falharia e mostraria "A combinar"
  // mesmo com preço definido.
  const cents = typeof value === "string" ? (value.trim() ? Number(value) : NaN) : value;
  if (typeof cents !== "number" || !Number.isFinite(cents)) return "A combinar";
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/** Só os dígitos — para enviar ao backend, que guarda telefone sem máscara. */
export function somenteDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

/** Telefone BR para exibição: "55999842393" → "(55) 99984-2393".
 *  Estava definido dentro de RecebimentosScreen e só valia para a chave PIX;
 *  o perfil mostrava os dígitos crus. */
export function mascaraTelefone(raw: string): string {
  const d = somenteDigitos(raw).slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").trim();
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").trim();
}

/** Concorda número e substantivo: `plural(1, "serviço", "serviços")` → "1 serviço".
 *  Passe a frase inteira quando houver adjetivo, para ele concordar também:
 *  `plural(n, "serviço concluído", "serviços concluídos")`.
 *
 *  Existe para acabar com o "serviço(s) concluído(s)" espalhado pelas telas —
 *  parte do código já concordava certo, então era inconsistência, não padrão. */
export function plural(quantidade: number, singular: string, plural: string): string {
  return `${quantidade} ${quantidade === 1 ? singular : plural}`;
}

/** Diferença em dias inteiros entre a data do serviço e hoje (0 = hoje,
 *  1 = amanhã, negativo = passado). Devolve null quando não há data válida.
 *  Existe porque `formatDate` produz TEXTO de exibição ("Hoje", "sex., 10 de
 *  jul.") — filtrar por período comparando esse rótulo é frágil. */
export function diasAteServico(value?: string | number | Date | null): number | null {
  const date = parseDataServico(value);
  if (!date) return null;
  const inicio = new Date();
  inicio.setHours(0, 0, 0, 0);
  const outro = new Date(date);
  outro.setHours(0, 0, 0, 0);
  return Math.round((outro.getTime() - inicio.getTime()) / 86_400_000);
}

export function formatDate(dateStr?: string): string {
  const date = parseDataServico(dateStr);
  if (!date) return "--";
  const agora = new Date();
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const diffDays = Math.round((date.getTime() - hoje.getTime()) / 86_400_000);
  if (diffDays === 0) return "Hoje";
  if (diffDays === 1) return "Amanhã";
  return date.toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

const TURNO_LABEL: Record<string, string> = {
  MANHA: "Manhã",
  TARDE: "Tarde",
  NOITE: "Noite",
  INTEGRAL: "Integral",
};

/**
 * Horário do serviço para exibição.
 *
 * `Servico.hora` ("HH:MM") é o que o empregador realmente escolheu; `turno`
 * é a faixa grossa usada pela agenda do profissional. Antes só o turno era
 * persistido, então serviços antigos não têm hora — nesses, cai no turno.
 *
 * Ex.: ("10:00", "MANHA") → "10:00 · Manhã"; (null, "MANHA") → "Manhã".
 */
export function formatHorario(hora?: string | null, turno?: string | null): string {
  const faixa = turno ? TURNO_LABEL[turno] ?? turno : "";
  const h = hora?.trim();
  if (!h) return faixa || "--";
  return faixa ? `${h} · ${faixa}` : h;
}

export function formatCurrency(value?: number): string {
  if (!value) return "--";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Protocolo legível de um serviço, a partir do id real.
 * Ex.: "cmtro5w9m0001..." → "#DL-CMTRO5W9"
 *
 * Fonte única: a tela de sucesso mostrava "#DL-XXXXXXXX" e o comprovante
 * "#XXXXXXXX" para o MESMO serviço — o suporte recebia dois formatos.
 */
export function protocoloServico(servicoId?: string | null): string {
  const limpo = String(servicoId ?? "").replace(/-/g, "");
  if (!limpo) return "—";
  return `#DL-${limpo.slice(0, 8).toUpperCase()}`;
}

/** Máscara de CPF: "12345678909" → "123.456.789-09". */
export function mascaraCPF(raw: string): string {
  const d = somenteDigitos(raw).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** Máscara de data: "01012000" → "01/01/2000". */
export function mascaraData(raw: string): string {
  const d = somenteDigitos(raw).slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/**
 * Mesmo algoritmo de dígitos verificadores do backend (`validarCPF` em
 * web/src/lib/pixKey.ts). Aqui serve só para feedback imediato — o backend
 * continua sendo a fonte da verdade e revalida.
 */
export function cpfValido(raw: string): boolean {
  const d = somenteDigitos(raw);
  if (d.length !== 11) return false;
  if (/^(\d)\1+$/.test(d)) return false;
  const calc = (mod: number) => {
    let soma = 0;
    for (let i = 0; i < mod - 1; i++) soma += Number(d[i]) * (mod - i);
    const resto = (soma * 10) % 11;
    return resto === 10 || resto === 11 ? 0 : resto;
  };
  return calc(10) === Number(d[9]) && calc(11) === Number(d[10]);
}

/**
 * "DD/MM/AAAA" → "AAAA-MM-DD" (formato que o backend espera), ou null se a
 * data não existir no calendário ou não fizer sentido para um cadastro
 * (futuro, ou idade fora de 16–120 anos).
 */
export function dataNascimentoISO(raw: string): string | null {
  const d = somenteDigitos(raw);
  if (d.length !== 8) return null;
  const dia = Number(d.slice(0, 2));
  const mes = Number(d.slice(2, 4));
  const ano = Number(d.slice(4));
  const data = new Date(ano, mes - 1, dia);
  // Rejeita datas que "transbordam" (31/02 vira 03/03).
  if (data.getFullYear() !== ano || data.getMonth() !== mes - 1 || data.getDate() !== dia) {
    return null;
  }
  const hoje = new Date();
  if (data > hoje) return null;
  let idade = hoje.getFullYear() - ano;
  const passouAniversario =
    hoje.getMonth() > mes - 1 || (hoje.getMonth() === mes - 1 && hoje.getDate() >= dia);
  if (!passouAniversario) idade -= 1;
  if (idade < 16 || idade > 120) return null;
  return `${String(ano).padStart(4, "0")}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/** Nome completo como no documento — mesma regra do servidor (api/me/profile): letras, nome e sobrenome. */
export function nomeCompletoValido(v: string): boolean {
  const t = v.trim().replace(/\s+/g, " ");
  return t.length <= 120 && /^[\p{L}][\p{L}'’.\- ]*$/u.test(t) && t.split(" ").filter((p) => p.length >= 2).length >= 2;
}
