import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppIcon } from "@/components/ui/AppIcon";
import { DCard } from "@/components/ui/DCard";
import type { EmpregadorServiceFlowStackParamList } from "@/navigation/EmpregadorServiceFlowNavigator";
import { colors, radius, shadows, spacing } from "@/theme";
import { api } from "@/lib/api";
import {
  diaDisponivel,
  HORARIOS,
  horarioDisponivel,
  primeiroDiaDisponivel,
  resumoAgenda,
  type SlotAgenda,
} from "./agendaDisponivel";
import { duracaoEstimada } from "@/lib/duracaoServico";
import { useServiceFlow } from "./ServiceFlowContext";
import { FlowFooter, FlowPrimaryButton, FlowScreen, flowStyles, StepHeader, TimeSlotButton } from "./components";
import { getServiceFlowTheme } from "@/theme/serviceFlowTheme";

type Navigation = NativeStackNavigationProp<EmpregadorServiceFlowStackParamList, "EscolherData">;

const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

function toISODate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromISODate(value: string) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

type AgendaResponse = { diarista?: { agenda?: SlotAgenda[] } };

export function EscolherDataScreen() {
  const navigation = useNavigation<Navigation>();
  const { draft, updateDraft } = useServiceFlow();
  const flowTheme = getServiceFlowTheme(draft.tipo);
  const agora = useMemo(() => new Date(), []);

  // A agenda só restringe diarista/babá/cozinheira (o backend confere
  // Disponibilidade só nesse ramo). Montador: qualquer dia a partir de hoje.
  const usaAgenda = draft.tipo !== "MONTADOR" && Boolean(draft.profissionalId);
  const [agenda, setAgenda] = useState<SlotAgenda[] | null>(usaAgenda ? null : []);
  const [agendaFalhou, setAgendaFalhou] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    if (!usaAgenda) return;
    let vivo = true;
    setAgendaFalhou(false);
    api
      .get<AgendaResponse>(`/api/diaristas/${draft.profissionalId}`)
      .then((res) => {
        if (vivo) setAgenda(res.data?.diarista?.agenda ?? []);
      })
      .catch(() => {
        if (vivo) setAgendaFalhou(true);
      });
    return () => {
      vivo = false;
    };
  }, [usaAgenda, draft.profissionalId, tentativa]);

  const [selectedDate, setSelectedDate] = useState<Date | null>(() => fromISODate(draft.dataISO));
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const base = fromISODate(draft.dataISO) ?? agora;
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const [selectedTime, setSelectedTime] = useState<string | null>(draft.horario || null);

  // Com a agenda em mãos, corrige a escolha: dia/horário que ela não atende
  // é trocado pelo primeiro livre, em vez de só falhar no envio.
  useEffect(() => {
    if (!agenda) return;
    let dia = selectedDate;
    if (!dia || !diaDisponivel(dia, agenda, agora)) {
      dia = primeiroDiaDisponivel(agenda, agora);
      setSelectedDate(dia);
      if (dia) setVisibleMonth(new Date(dia.getFullYear(), dia.getMonth(), 1));
    }
    if (dia && (!selectedTime || !horarioDisponivel(dia, selectedTime, agenda, agora))) {
      setSelectedTime(HORARIOS.find((h) => horarioDisponivel(dia!, h, agenda, agora)) ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agenda]);

  const days = useMemo(() => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const leading = new Date(year, month, 1).getDay();
    const total = new Date(year, month + 1, 0).getDate();
    return [
      ...Array.from({ length: leading }, () => null),
      ...Array.from({ length: total }, (_, index) => new Date(year, month, index + 1)),
    ];
  }, [visibleMonth]);

  const podeVoltarMes =
    visibleMonth.getFullYear() * 12 + visibleMonth.getMonth() > agora.getFullYear() * 12 + agora.getMonth();

  const changeMonth = (direction: -1 | 1) => {
    if (direction === -1 && !podeVoltarMes) return;
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + direction, 1));
  };

  const escolherDia = (dia: Date) => {
    setSelectedDate(dia);
    if (agenda && selectedTime && !horarioDisponivel(dia, selectedTime, agenda, agora)) {
      setSelectedTime(HORARIOS.find((h) => horarioDisponivel(dia, h, agenda, agora)) ?? null);
    }
  };

  const duracao = duracaoEstimada(draft.categoria, draft.categoriaBackend);
  const resumo = agenda ? resumoAgenda(agenda) : null;
  const nome = draft.profissionalNome?.split(" ")[0] ?? "A profissional";
  const pronto = Boolean(agenda && selectedDate && selectedTime);

  const continueFlow = () => {
    if (!agenda || !selectedDate || !selectedTime) return;
    if (!horarioDisponivel(selectedDate, selectedTime, agenda, agora)) return;
    updateDraft({ dataISO: toISODate(selectedDate), horario: selectedTime });
    navigation.navigate("EnderecoServico");
  };

  return (
    <FlowScreen>
      <ScrollView contentContainerStyle={flowStyles.scrollContent} showsVerticalScrollIndicator={false}>
        <StepHeader
          title="Escolher data"
          subtitle="Defina o melhor dia e horário para receber o profissional."
          step={3}
          total={6}
          onBack={() => navigation.goBack()}
          theme={flowTheme}
        />

        {agendaFalhou ? (
          <DCard style={s.avisoCard}>
            <Text style={s.avisoTitulo}>Não foi possível carregar a agenda</Text>
            <Text style={s.avisoTexto}>Sem ela não dá para saber em quais dias {nome} atende.</Text>
            <Pressable onPress={() => setTentativa((n) => n + 1)} hitSlop={8}>
              <Text style={[s.avisoAcao, { color: flowTheme.primary }]}>Tentar de novo</Text>
            </Pressable>
          </DCard>
        ) : !agenda ? (
          <DCard style={s.calendarCard}>
            <View style={s.carregando}>
              <ActivityIndicator color={flowTheme.primary} />
            </View>
          </DCard>
        ) : (
          <>
            {resumo ? (
              <View style={[s.agendaResumo, { backgroundColor: flowTheme.primarySoft }]}>
                <AppIcon name="CalendarCheck" size={16} color={flowTheme.primary} />
                <Text style={s.agendaResumoTexto}>
                  {nome} atende: {resumo}
                </Text>
              </View>
            ) : null}

            <DCard style={s.calendarCard}>
              <View style={s.monthHeader}>
                <Pressable
                  onPress={() => changeMonth(-1)}
                  disabled={!podeVoltarMes}
                  style={[s.monthButton, { backgroundColor: flowTheme.primarySoft }, !podeVoltarMes && s.monthButtonOff]}
                  hitSlop={8}
                >
                  <AppIcon name="ArrowLeft" size={18} color={flowTheme.primary} />
                </Pressable>
                <Text style={s.monthTitle}>
                  {MONTHS[visibleMonth.getMonth()]} {visibleMonth.getFullYear()}
                </Text>
                <Pressable onPress={() => changeMonth(1)} style={[s.monthButton, { backgroundColor: flowTheme.primarySoft }]} hitSlop={8}>
                  <AppIcon name="ChevronRight" size={18} color={flowTheme.primary} />
                </Pressable>
              </View>

              <View style={s.weekRow}>
                {WEEKDAYS.map((day, index) => (
                  <Text key={`${day}-${index}`} style={s.weekday}>
                    {day}
                  </Text>
                ))}
              </View>

              <View style={s.daysGrid}>
                {days.map((day, index) => {
                  const livre = day ? diaDisponivel(day, agenda, agora) : false;
                  const selected = day && selectedDate ? toISODate(day) === toISODate(selectedDate) : false;
                  return (
                    <Pressable
                      key={day ? toISODate(day) : `blank-${index}`}
                      disabled={!day || !livre}
                      onPress={() => day && escolherDia(day)}
                      accessibilityState={{ disabled: !livre, selected }}
                      style={[
                        s.dayCell,
                        selected && {
                          backgroundColor: flowTheme.primary,
                          borderRadius: 21,
                          shadowColor: flowTheme.primary,
                          shadowOpacity: 0.24,
                          shadowRadius: 12,
                          shadowOffset: { width: 0, height: 8 },
                          elevation: 5,
                        },
                      ]}
                    >
                      <Text style={[s.dayText, day && !livre && s.dayTextOff, selected && s.dayTextSelected]}>
                        {day ? day.getDate() : ""}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </DCard>

            <View style={s.section}>
              <Text style={s.sectionTitle}>Horários disponíveis</Text>
              {selectedDate ? (
                <View style={s.timeGrid}>
                  {HORARIOS.map((slot) => (
                    <TimeSlotButton
                      key={slot}
                      label={slot}
                      selected={selectedTime === slot}
                      disabled={!horarioDisponivel(selectedDate, slot, agenda, agora)}
                      theme={flowTheme}
                      onPress={() => setSelectedTime(slot)}
                    />
                  ))}
                </View>
              ) : (
                <Text style={s.avisoTexto}>{nome} não tem horário livre nos próximos 60 dias.</Text>
              )}
            </View>
          </>
        )}

        {duracao ? (
          <DCard style={s.durationCard} variant="soft">
            <View style={[s.durationIcon, { backgroundColor: flowTheme.primarySoft }]}>
              <AppIcon name="Clock" size={20} color={flowTheme.primary} />
            </View>
            <View style={s.durationText}>
              <Text style={s.durationTitle}>Duração estimada</Text>
              <Text style={s.durationSubtitle}>
                {duracao}
                {draft.intensidadeLabel ?? draft.especialidadeLabel
                  ? ` · ${draft.intensidadeLabel ?? draft.especialidadeLabel}`
                  : ""}
              </Text>
            </View>
          </DCard>
        ) : null}
      </ScrollView>

      <FlowFooter>
        <FlowPrimaryButton label="Continuar" theme={flowTheme} onPress={continueFlow} disabled={!pronto} />
      </FlowFooter>
    </FlowScreen>
  );
}

const s = StyleSheet.create({
  calendarCard: {
    padding: spacing.md,
    borderRadius: 24,
  },
  monthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  monthButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.lavenderSoft,
  },
  monthTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: "700",
  },
  weekRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  weekday: {
    width: `${100 / 7}%`,
    textAlign: "center",
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 8,
  },
  dayCell: {
    width: `${100 / 7}%`,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  dayText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
  },
  dayTextSelected: {
    color: colors.white,
  },
  dayTextOff: {
    color: colors.textMuted,
    opacity: 0.45,
    fontWeight: "500",
  },
  monthButtonOff: {
    opacity: 0.35,
  },
  carregando: {
    paddingVertical: spacing.xl,
    alignItems: "center",
  },
  agendaResumo: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
  },
  agendaResumoTexto: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  avisoCard: {
    borderRadius: 24,
    gap: 6,
  },
  avisoTitulo: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
  },
  avisoTexto: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  avisoAcao: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: "700",
  },
  section: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "700",
  },
  timeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  durationCard: {
    marginTop: spacing.lg,
    borderRadius: radius.xl,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    ...shadows.soft,
  },
  durationText: {
    flex: 1,
    gap: 4,
  },
  durationIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  durationTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
  },
  durationSubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
});
