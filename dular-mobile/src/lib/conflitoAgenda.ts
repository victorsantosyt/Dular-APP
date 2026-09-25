import { duracaoMaximaHoras } from "./duracaoServico";

/**
 * Conflito de agenda do profissional, no estilo corrida em andamento: o pedido
 * novo chega mesmo se ela já tem serviço no dia — o backend não bloqueia — e
 * este aviso dá o que ela precisa para decidir entre aceitar, sugerir outro
 * horário ou recusar. O fim de cada serviço é ESTIMADO pela duração máxima da
 * categoria (lib/duracaoServico).
 */
export type ServicoAgenda = {
  id: string;
  status: string;
  data: string | Date;
  hora?: string | null;
  turno?: string | null;
  tipo: string;
  categoria?: string | null;
};

export type Conflito = {
  id: string;
  inicio: string;
  fimEstimado: string | null;
  /** "sobreposto": os horários se cruzam; "proximo": o intervalo entre eles é curto. */
  tipo: "sobreposto" | "proximo";
};

/** Serviços que ocupam a agenda: aceitos e ainda não encerrados. */
const OCUPA = new Set(["ACEITO", "INICIADO", "EM_ANDAMENTO"]);
/** Início presumido quando o serviço só tem turno (clientes antigos). */
const INICIO_DO_TURNO: Record<string, string> = { MANHA: "08:00", TARDE: "13:00" };

function dia(data: string | Date) {
  // A data vem como meia-noite UTC do dia escolhido: o dia é o prefixo ISO,
  // não a conversão para o fuso local (que cairia no dia anterior).
  return (typeof data === "string" ? data : data.toISOString()).slice(0, 10);
}

function minutos(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

function hhmm(total: number) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function janela(s: ServicoAgenda) {
  const inicio = s.hora || INICIO_DO_TURNO[(s.turno ?? "").toUpperCase()] || null;
  if (!inicio) return null;
  const horas = duracaoMaximaHoras(s.tipo, s.categoria);
  const ini = minutos(inicio);
  return { ini, fim: horas == null ? null : ini + horas * 60 };
}

export function conflitosDoPedido(
  pedido: ServicoAgenda,
  agenda: readonly ServicoAgenda[],
  folgaMin = 60,
): Conflito[] {
  const p = janela(pedido);
  if (!p) return [];
  const diaPedido = dia(pedido.data);
  const achados: Conflito[] = [];
  for (const s of agenda) {
    if (s.id === pedido.id || !OCUPA.has(s.status.toUpperCase()) || dia(s.data) !== diaPedido) continue;
    const o = janela(s);
    if (!o) continue;
    const fimP = p.fim ?? p.ini;
    const fimO = o.fim ?? o.ini;
    let tipo: Conflito["tipo"] | null = null;
    if (p.ini < fimO && o.ini < fimP) tipo = "sobreposto";
    else if (p.ini === o.ini) tipo = "sobreposto";
    else if ((p.ini >= fimO && p.ini - fimO <= folgaMin) || (o.ini >= fimP && o.ini - fimP <= folgaMin)) {
      tipo = "proximo";
    }
    if (tipo) achados.push({ id: s.id, inicio: hhmm(o.ini), fimEstimado: o.fim == null ? null : hhmm(o.fim), tipo });
  }
  return achados;
}
