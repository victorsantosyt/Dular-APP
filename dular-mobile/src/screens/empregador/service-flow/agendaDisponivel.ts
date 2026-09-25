/**
 * Regras da etapa "Escolher data", espelhando o POST /api/servicos: a
 * diarista com agenda cadastrada só recebe pedido no dia da semana + turno
 * ativos; sem nenhum registro ela atende sempre (perfis antigos). O calendário
 * antes oferecia qualquer dia e horário, e o pedido só era recusado no envio
 * com "Profissional não atende nesse dia/turno".
 */
export type Turno = "MANHA" | "TARDE";
export type SlotAgenda = { diaSemana: number; turno: string; ativo?: boolean };

export const HORARIOS = ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00"] as const;

export const TURNO_LABEL: Record<Turno, string> = { MANHA: "manhã", TARDE: "tarde" };

/** Mesmo corte do payload: antes do meio-dia é MANHA, depois TARDE. */
export function turnoDoHorario(horario: string): Turno {
  const hora = parseInt(horario.split(":")[0] ?? "10", 10);
  return hora < 12 ? "MANHA" : "TARDE";
}

function inicioDoDia(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function ativos(agenda: readonly SlotAgenda[]) {
  return agenda.filter((s) => s.ativo !== false);
}

/** Turnos em que a profissional atende naquele dia da semana. */
export function turnosDoDia(data: Date, agenda: readonly SlotAgenda[]): Turno[] {
  const lista = ativos(agenda);
  if (lista.length === 0) return ["MANHA", "TARDE"];
  const dia = data.getDay();
  return (["MANHA", "TARDE"] as const).filter((t) => lista.some((s) => s.diaSemana === dia && s.turno === t));
}

export function horarioDisponivel(
  data: Date,
  horario: string,
  agenda: readonly SlotAgenda[],
  agora: Date,
): boolean {
  if (inicioDoDia(data) < inicioDoDia(agora)) return false;
  if (!turnosDoDia(data, agenda).includes(turnoDoHorario(horario))) return false;
  if (inicioDoDia(data).getTime() === inicioDoDia(agora).getTime()) {
    const [h, m] = horario.split(":").map(Number);
    return h * 60 + (m || 0) > agora.getHours() * 60 + agora.getMinutes();
  }
  return true;
}

export function diaDisponivel(data: Date, agenda: readonly SlotAgenda[], agora: Date): boolean {
  return HORARIOS.some((h) => horarioDisponivel(data, h, agenda, agora));
}

/** Primeiro dia com horário livre a partir de hoje (até `limiteDias`). */
export function primeiroDiaDisponivel(agenda: readonly SlotAgenda[], agora: Date, limiteDias = 60): Date | null {
  for (let i = 0; i <= limiteDias; i++) {
    const d = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + i);
    if (diaDisponivel(d, agenda, agora)) return d;
  }
  return null;
}

const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/** "segunda a sexta: manhã e tarde" em linhas por combinação de turnos. */
export function resumoAgenda(agenda: readonly SlotAgenda[]): string | null {
  const lista = ativos(agenda);
  if (lista.length === 0) return null;
  const porDia = new Map<number, Set<string>>();
  for (const s of lista) {
    if (!porDia.has(s.diaSemana)) porDia.set(s.diaSemana, new Set());
    porDia.get(s.diaSemana)!.add(s.turno);
  }
  return [1, 2, 3, 4, 5, 6, 0]
    .filter((d) => porDia.has(d))
    .map((d) => {
      const t = porDia.get(d)!;
      const turnos = (["MANHA", "TARDE"] as const).filter((x) => t.has(x)).map((x) => TURNO_LABEL[x]);
      return `${DIAS[d]} (${turnos.join(" e ")})`;
    })
    .join(", ");
}
