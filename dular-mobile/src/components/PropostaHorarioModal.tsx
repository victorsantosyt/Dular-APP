import React, { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { HORARIOS, horarioDisponivel, turnoDoHorario, type Turno } from "@/screens/empregador/service-flow/agendaDisponivel";
import { colors, radius, shadows, typography } from "@/theme";

/**
 * Proposta de novo dia e horário feita pelo profissional — antes do aceite
 * ("sugerir outro horário") ou depois ("reagendar"). O empregador confirma ou
 * recusa em POST/PATCH /api/servicos/:id/reagendar.
 */
type Props = {
  visible: boolean;
  titulo: string;
  subtitulo: string;
  accent: string;
  border: string;
  enviando: boolean;
  onClose: () => void;
  onConfirm: (proposta: { data: string; turno: Turno; hora: string }) => void;
};

function isoDia(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function PropostaHorarioModal({ visible, titulo, subtitulo, accent, border, enviando, onClose, onConfirm }: Props) {
  const agora = useMemo(() => new Date(), [visible]);
  const dias = useMemo(
    () => Array.from({ length: 14 }, (_, i) => new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + i)),
    [agora],
  );
  const [dia, setDia] = useState<Date | null>(null);
  const [hora, setHora] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setDia(null);
      setHora(null);
    }
  }, [visible]);

  const pronto = Boolean(dia && hora);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.card}>
          <Text style={s.titulo}>{titulo}</Text>
          <Text style={s.sub}>{subtitulo}</Text>

          <Text style={s.label}>Dia</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.linha}>
            {dias.map((d) => {
              const ativo = dia ? isoDia(dia) === isoDia(d) : false;
              return (
                <Pressable
                  key={isoDia(d)}
                  onPress={() => {
                    setDia(d);
                    if (hora && !horarioDisponivel(d, hora, [], new Date())) setHora(null);
                  }}
                  style={[s.chip, ativo ? { backgroundColor: accent, borderColor: accent } : { borderColor: border }]}
                >
                  <Text style={[s.chipTexto, ativo && s.chipTextoAtivo]}>
                    {d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={s.label}>Horário</Text>
          <View style={s.grade}>
            {HORARIOS.map((h) => {
              const livre = dia ? horarioDisponivel(dia, h, [], new Date()) : true;
              const ativo = hora === h;
              return (
                <Pressable
                  key={h}
                  disabled={!livre}
                  onPress={() => setHora(h)}
                  style={[
                    s.chip,
                    s.horaChip,
                    ativo ? { backgroundColor: accent, borderColor: accent } : { borderColor: border },
                    !livre && s.off,
                  ]}
                >
                  <Text style={[s.chipTexto, ativo && s.chipTextoAtivo]}>{h}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={s.acoes}>
            <Pressable onPress={onClose} style={[s.botao, s.botaoFantasma]}>
              <Text style={s.botaoFantasmaTexto}>Cancelar</Text>
            </Pressable>
            <Pressable
              disabled={!pronto || enviando}
              onPress={() => dia && hora && onConfirm({ data: `${isoDia(dia)}T00:00:00.000Z`, turno: turnoDoHorario(hora), hora })}
              style={[s.botao, { backgroundColor: accent }, (!pronto || enviando) && s.off]}
            >
              <Text style={s.botaoTexto}>{enviando ? "Enviando…" : "Enviar proposta"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    backgroundColor: colors.overlay,
  },
  card: {
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    padding: 18,
    gap: 12,
    ...shadows.floating,
  },
  titulo: {
    color: colors.textPrimary,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "700",
  },
  sub: {
    ...typography.bodySm,
    color: colors.textSecondary,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: "800",
    marginTop: 4,
  },
  linha: {
    gap: 8,
    paddingVertical: 2,
  },
  grade: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surface,
  },
  horaChip: {
    width: "31%",
    alignItems: "center",
  },
  chipTexto: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  chipTextoAtivo: {
    color: colors.white,
  },
  off: {
    opacity: 0.4,
  },
  acoes: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
  },
  botao: {
    flex: 1,
    borderRadius: radius.pill,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  botaoFantasma: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  botaoFantasmaTexto: {
    ...typography.bodySmMedium,
    color: colors.textSecondary,
    fontWeight: "800",
  },
  botaoTexto: {
    ...typography.bodySmMedium,
    color: colors.white,
    fontWeight: "800",
  },
});
