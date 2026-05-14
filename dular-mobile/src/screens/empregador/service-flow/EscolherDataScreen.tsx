import React, { useMemo, useState } from "react";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppIcon } from "@/components/ui/AppIcon";
import { DCard } from "@/components/ui/DCard";
import type { EmpregadorServiceFlowStackParamList } from "@/navigation/EmpregadorServiceFlowNavigator";
import { colors, radius, shadows, spacing } from "@/theme";
import { useServiceFlow } from "./ServiceFlowContext";
import { FlowPrimaryButton, flowStyles, StepHeader, TimeSlotButton } from "./components";
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
const TIME_SLOTS = ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00"];

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

function getInitialDate(value: string) {
  const parsed = fromISODate(value);
  if (parsed) return parsed;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow;
}

export function EscolherDataScreen() {
  const navigation = useNavigation<Navigation>();
  const { draft, updateDraft } = useServiceFlow();
  const flowTheme = getServiceFlowTheme(draft.tipo);
  const [selectedDate, setSelectedDate] = useState(() => getInitialDate(draft.dataISO));
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
  const [selectedTime, setSelectedTime] = useState(draft.horario || "10:00");

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

  const changeMonth = (direction: -1 | 1) => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + direction, 1));
  };

  const continueFlow = () => {
    updateDraft({ dataISO: toISODate(selectedDate), horario: selectedTime });
    navigation.navigate("EnderecoServico");
  };

  return (
    <SafeAreaView style={flowStyles.screen}>
      <ScrollView contentContainerStyle={flowStyles.scrollContent} showsVerticalScrollIndicator={false}>
        <StepHeader
          title="Escolher data"
          subtitle="Defina o melhor dia e horário para receber o profissional."
          step={2}
          total={5}
          onBack={() => navigation.goBack()}
          theme={flowTheme}
        />

        <DCard style={s.calendarCard}>
          <View style={s.monthHeader}>
            <Pressable onPress={() => changeMonth(-1)} style={[s.monthButton, { backgroundColor: flowTheme.primarySoft }]} hitSlop={8}>
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
              const selected = day ? toISODate(day) === toISODate(selectedDate) : false;
              return (
                <Pressable
                  key={day ? toISODate(day) : `blank-${index}`}
                  disabled={!day}
                  onPress={() => day && setSelectedDate(day)}
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
                  <Text style={[s.dayText, selected && s.dayTextSelected]}>{day ? day.getDate() : ""}</Text>
                </Pressable>
              );
            })}
          </View>
        </DCard>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Horários disponíveis</Text>
          <View style={s.timeGrid}>
            {TIME_SLOTS.map((slot) => (
              <TimeSlotButton key={slot} label={slot} selected={selectedTime === slot} theme={flowTheme} onPress={() => setSelectedTime(slot)} />
            ))}
          </View>
        </View>

        <DCard style={s.durationCard} variant="soft">
          <View style={[s.durationIcon, { backgroundColor: flowTheme.primarySoft }]}>
            <AppIcon name="Clock" size={20} color={flowTheme.primary} />
          </View>
          <View style={s.durationText}>
            <Text style={s.durationTitle}>Duração estimada</Text>
            <Text style={s.durationSubtitle}>De 1h a 2h, 30 min (máx)</Text>
          </View>
        </DCard>
      </ScrollView>

      <SafeAreaView style={flowStyles.footer}>
        <FlowPrimaryButton label="Continuar" theme={flowTheme} onPress={continueFlow} />
      </SafeAreaView>
    </SafeAreaView>
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
