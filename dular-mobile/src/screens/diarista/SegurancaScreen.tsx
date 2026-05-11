import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";

import { AppIcon } from "@/components/ui";
import { DButton } from "@/components/ui/DButton";
import { useSeguranca } from "@/hooks/useSeguranca";
import { colors, radius, spacing, typography } from "@/theme/tokens";
import { shadow } from "@/utils/platform";
import type { DiaristaTabParamList } from "@/navigation/DiaristaNavigator";

type Route = RouteProp<DiaristaTabParamList, "Seguranca">;

export default function SegurancaScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<Route>();
  const { servicoId, enderecoServico } = route.params;

  const { checkInRealizado, checkInLoading, sosEnviado, protocolo, fazerCheckIn, acionarSOS } =
    useSeguranca();

  const [checkInTime, setCheckInTime] = useState<Date | null>(null);

  useEffect(() => {
    if (checkInRealizado && !checkInTime) {
      setCheckInTime(new Date());
    }
  }, [checkInRealizado, checkInTime]);

  // Pulse animation for SOS button
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1.0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  const handleCheckIn = async () => {
    await fazerCheckIn(servicoId);
  };

  const handleSOS = () => {
    Alert.alert(
      "Acionar SOS?",
      "Isso notificará a equipe Dular e abrirá o WhatsApp de emergência.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "ACIONAR",
          style: "destructive",
          onPress: () => { void acionarSOS(servicoId); },
        },
      ],
    );
  };

  const checkInTimeLabel = checkInTime
    ? checkInTime.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={s.backBtn}>
          <AppIcon name="ArrowLeft" size={22} color={colors.textPrimary} strokeWidth={2.5} />
        </Pressable>
        <Text style={s.headerTitle}>Segurança do Serviço</Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Check-in card ──────────────────────────────────────── */}
        <View style={s.card}>
          {checkInRealizado ? (
            <View style={s.checkInDone}>
              <AppIcon name="CheckCircle" size={22} color={colors.success} strokeWidth={2} />
              <View style={s.checkInDoneTexts}>
                <Text style={s.checkInDoneTitle}>Check-in realizado</Text>
                {checkInTimeLabel ? (
                  <Text style={s.checkInDoneTime}>Registrado às {checkInTimeLabel}</Text>
                ) : null}
              </View>
            </View>
          ) : (
            <>
              <Text style={s.cardTitle}>Confirmar presença</Text>
              <Text style={s.cardSub}>
                {enderecoServico ?? "Endereço do serviço"}
              </Text>
              <Text style={s.cardDesc}>
                Confirme sua presença ao iniciar o serviço
              </Text>
              <DButton
                label="Fazer Check-in"
                onPress={handleCheckIn}
                variant="primary"
                loading={checkInLoading}
              />
            </>
          )}
        </View>

        {/* ─── Emergência ─────────────────────────────────────────── */}
        <View style={s.emergSection}>
          <Text style={s.sectionLabel}>EMERGÊNCIA</Text>
          <View style={s.sosWrap}>
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <Pressable
                onPress={handleSOS}
                style={({ pressed }) => [s.sosBtn, pressed && s.sosPressed]}
              >
                <Text style={s.sosText}>SOS</Text>
              </Pressable>
            </Animated.View>
            <Text style={s.sosHint}>Toque para acionar emergência</Text>
          </View>
        </View>

        {/* ─── Protocolo (pós-SOS) ────────────────────────────────── */}
        {sosEnviado ? (
          <View style={s.protocolCard}>
            {protocolo ? (
              <Text style={s.protocolCode}>Protocolo: #{protocolo}</Text>
            ) : null}
            <Text style={s.protocolMsg}>
              Nossa equipe foi notificada. O WhatsApp de emergência foi aberto.
            </Text>
          </View>
        ) : null}

        {/* ─── Rodapé de segurança ─────────────────────────────────── */}
        <Text style={s.footer}>
          {"Em caso de perigo imediato, ligue 190 (Polícia)\nou 192 (SAMU)"}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    flex: 1,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 48,
    gap: spacing.lg,
  },

  // Check-in card
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadow(2),
  },
  cardTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  cardSub: {
    ...typography.caption,
    color: colors.textMuted,
  },
  cardDesc: {
    ...typography.body,
    color: colors.textSecondary,
  },
  checkInDone: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  checkInDoneTexts: {
    flex: 1,
    gap: 2,
  },
  checkInDoneTitle: {
    ...typography.bodyMedium,
    color: colors.success,
    fontWeight: "700",
  },
  checkInDoneTime: {
    ...typography.caption,
    color: colors.textMuted,
  },

  // Emergência section
  emergSection: {
    gap: spacing.sm,
    alignItems: "center",
  },
  sectionLabel: {
    ...typography.label,
    color: colors.textMuted,
    alignSelf: "flex-start",
  },
  sosWrap: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  sosBtn: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: colors.error,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.error,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 8,
  },
  sosPressed: {
    opacity: 0.85,
  },
  sosText: {
    color: colors.white,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: "700",
    letterSpacing: 2,
  },
  sosHint: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: "center",
  },

  // Protocol card
  protocolCard: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.error,
    padding: spacing.md,
    gap: spacing.xs,
  },
  protocolCode: {
    ...typography.bodyMedium,
    color: colors.error,
    fontWeight: "700",
  },
  protocolMsg: {
    ...typography.body,
    color: colors.error,
  },

  // Footer
  footer: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing.xs,
  },
});
