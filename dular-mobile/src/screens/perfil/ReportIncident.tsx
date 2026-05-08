import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/lib/api";
import { apiMsg } from "@/utils/apiMsg";
import { useAuth } from "@/stores/authStore";
import { AppIcon, AppIconName } from "@/components/ui";
import { PaperPlane3DIcon, SOSIcon } from "@/assets/icons";
import { colors, radius, shadow, spacing } from "@/theme/tokens";

const RED = colors.incidentRed;
const RED_DARK = colors.incidentRedDark;
const RED_BG = colors.incidentRedBg;
const DESC_MAX = 500;

type IncidenteCategoria =
  | "AGRESSAO_VERBAL"
  | "AGRESSAO_FISICA"
  | "AGRESSAO_PSICOLOGICA"
  | "AGRESSAO_EMOCIONAL"
  | "VIOLENCIA_SEXUAL"
  | "IMPORTUNACAO_SEXUAL"
  | "FURTO"
  | "DANO_MATERIAL"
  | "AMBIENTE_INSALUBRE"
  | "VIOLACAO_PRIVACIDADE"
  | "NO_SHOW"
  | "OUTRO";

type IncidenteGravidade = "BAIXA" | "MEDIA" | "ALTA" | "CRITICA";
type Step = 1 | 2 | 3;
type OtherUser = { id: string; nome: string; avatarUrl?: string | null };
type SubtipoOption = { label: string; categoria: IncidenteCategoria };
type CategoryGroup = {
  key: string;
  title: string;
  icon: AppIconName;
  subtipos: SubtipoOption[];
};

const EMPREGADOR_GROUPS: CategoryGroup[] = [
  {
    key: "patrimonio",
    title: "Patrimônio",
    icon: "Home",
    subtipos: [
      { label: "Objeto desaparecido", categoria: "FURTO" },
      { label: "Furto confirmado", categoria: "FURTO" },
      { label: "Dano a bem material", categoria: "DANO_MATERIAL" },
      { label: "Acesso a área restrita", categoria: "VIOLACAO_PRIVACIDADE" },
    ],
  },
  {
    key: "comportamento",
    title: "Comportamento",
    icon: "AlertTriangle",
    subtipos: [
      { label: "Desrespeito às regras", categoria: "OUTRO" },
      { label: "Uso indevido de cômodos", categoria: "VIOLACAO_PRIVACIDADE" },
      { label: "Comportamento suspeito", categoria: "OUTRO" },
      { label: "Não comparecimento", categoria: "NO_SHOW" },
    ],
  },
  {
    key: "seguranca",
    title: "Segurança",
    icon: "Lock",
    subtipos: [
      { label: "Pessoa não autorizada junto", categoria: "OUTRO" },
      { label: "Comportamento intimidador", categoria: "AGRESSAO_PSICOLOGICA" },
      { label: "Violação de privacidade", categoria: "VIOLACAO_PRIVACIDADE" },
    ],
  },
];

const DIARISTA_GROUPS: CategoryGroup[] = [
  {
    key: "agressao",
    title: "Agressão",
    icon: "AlertTriangle",
    subtipos: [
      { label: "Verbal (xingamentos, humilhação)", categoria: "AGRESSAO_VERBAL" },
      { label: "Psicológica (intimidação, ameaças)", categoria: "AGRESSAO_PSICOLOGICA" },
      { label: "Emocional (chantagem, manipulação)", categoria: "AGRESSAO_EMOCIONAL" },
      { label: "Física (empurrão, tapa, lesão)", categoria: "AGRESSAO_FISICA" },
      { label: "Sexual (importunação ou abuso)", categoria: "VIOLENCIA_SEXUAL" },
    ],
  },
  {
    key: "ambiente",
    title: "Ambiente",
    icon: "Home",
    subtipos: [
      { label: "Condições insalubres", categoria: "AMBIENTE_INSALUBRE" },
      { label: "Animal perigoso sem aviso", categoria: "AMBIENTE_INSALUBRE" },
      { label: "Número de pessoas diferente", categoria: "OUTRO" },
      { label: "Substâncias ilegais no local", categoria: "AMBIENTE_INSALUBRE" },
    ],
  },
  {
    key: "pagamento",
    title: "Pagamento",
    icon: "Wallet",
    subtipos: [
      { label: "Recusa de pagamento", categoria: "OUTRO" },
      { label: "Negociação forçada no local", categoria: "OUTRO" },
      { label: "Ameaça vinculada ao pagamento", categoria: "AGRESSAO_PSICOLOGICA" },
    ],
  },
];

const GRAVIDADES: { value: IncidenteGravidade; label: string; desc: string; color: string }[] = [
  { value: "BAIXA", label: "Baixa", desc: "Incômodo ou descumprimento leve.", color: colors.mutedForeground },
  { value: "MEDIA", label: "Média", desc: "Situação inadequada que exige análise.", color: colors.incidentAmber },
  { value: "ALTA", label: "Alta", desc: "Risco, ameaça ou dano relevante.", color: RED },
  { value: "CRITICA", label: "Crítica", desc: "Violência, abuso ou risco imediato.", color: colors.incidentCritical },
];

function initials(name: string) {
  return name.trim().slice(0, 1).toUpperCase() || "?";
}

export default function ReportIncident({ route }: any) {
  const nav = useNavigation<any>();
  const user = useAuth((s) => s.user);
  const role = useAuth((s) => s.role ?? s.user?.role);

  const serviceId = route?.params?.serviceId ?? route?.params?.servicoId ?? "";
  const initialReportedUserId = route?.params?.reportedUserId ?? "";
  const [reportedUserId, setReportedUserId] = useState(initialReportedUserId);
  const [otherUser, setOtherUser] = useState<OtherUser | null>(
    initialReportedUserId
      ? {
          id: initialReportedUserId,
          nome: route?.params?.reportedUserName ?? "Usuário selecionado",
          avatarUrl: route?.params?.reportedUserAvatarUrl ?? null,
        }
      : null,
  );

  const [step, setStep] = useState<Step>(1);
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null);
  const [selectedSubtipo, setSelectedSubtipo] = useState<SubtipoOption | null>(null);
  const [gravidade, setGravidade] = useState<IncidenteGravidade>("MEDIA");
  const [descricao, setDescricao] = useState("");
  const [anonimo, setAnonimo] = useState(false);
  const [resolvingUser, setResolvingUser] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const groups = role === "DIARISTA" ? DIARISTA_GROUPS : EMPREGADOR_GROUPS;
  const selectedGroup = useMemo(
    () => groups.find((g) => g.key === selectedGroupKey) ?? null,
    [groups, selectedGroupKey],
  );
  const canContinueStep1 = !!reportedUserId && !resolvingUser;
  const canContinueStep2 = !!selectedGroup && !!selectedSubtipo;
  const canSubmit = canContinueStep1 && canContinueStep2 && !saving;

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!serviceId || (reportedUserId && otherUser?.nome !== "Usuário selecionado")) return;

    let alive = true;

    async function resolveReportedUser() {
      try {
        setResolveError(null);
        setResolvingUser(true);
        const res = await api.get(`/api/servicos/${serviceId}`);
        const servico = res.data?.servico ?? res.data;
        const other =
          servico?.cliente?.id === user?.id
            ? servico?.diarista
            : servico?.diarista?.id === user?.id
              ? servico?.cliente
              : null;
        const otherUserId = res.data?.otherUserId ?? other?.id ?? null;

        if (!alive) return;

        if (!otherUserId) {
          setResolveError("Não foi possível identificar o usuário envolvido neste serviço.");
          return;
        }

        setReportedUserId(otherUserId);
        setOtherUser({
          id: otherUserId,
          nome: other?.nome ?? "Usuário selecionado",
          avatarUrl: other?.avatarUrl ?? null,
        });
      } catch (e: any) {
        if (!alive) return;
        setResolveError(apiMsg(e, "Não foi possível carregar os dados do serviço."));
      } finally {
        if (alive) setResolvingUser(false);
      }
    }

    resolveReportedUser();

    return () => {
      alive = false;
    };
  }, [otherUser?.nome, reportedUserId, serviceId, user?.id]);

  async function enviar() {
    if (!canSubmit || !selectedSubtipo) return;

    try {
      setSaving(true);
      await api.post("/api/incidentes", {
        reportedUserId,
        serviceId: serviceId || undefined,
        categoria: selectedSubtipo.categoria,
        subtipo: selectedSubtipo.label,
        gravidade,
        descricao: descricao.trim() || undefined,
        anonimo,
      });
      Alert.alert("Denúncia enviada", "Nossa equipe vai analisar o caso.", [
        { text: "OK", onPress: () => nav.goBack() },
      ]);
    } catch (e: any) {
      setToast(apiMsg(e, "Falha ao registrar denúncia."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <View style={s.header}>
        <Pressable onPress={() => nav.goBack()} hitSlop={10}>
          <AppIcon name="ArrowLeft" size={26} color={colors.foreground} />
        </Pressable>
        <Text style={s.headerTitle}>Relatar incidente</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.steps}>
          {[1, 2, 3].map((n) => (
            <View key={n} style={[s.stepDot, step === n && s.stepDotActive]} />
          ))}
        </View>

        <View style={s.alert}>
          <SOSIcon size={46} />
          <Text style={s.alertText}>
            Em emergência, ligue 190 ou 192. Este registro será analisado pela equipe Dular.
          </Text>
        </View>

        {resolvingUser ? (
          <View style={s.infoBox}>
            <ActivityIndicator color={colors.primary} />
            <Text style={s.infoText}>Carregando dados do serviço...</Text>
          </View>
        ) : resolveError ? (
          <View style={s.errorBox}>
            <AppIcon name="AlertTriangle" size={18} color={RED} />
            <Text style={s.errorText}>{resolveError}</Text>
          </View>
        ) : null}

        {step === 1 ? (
          <>
            <Text style={s.sectionTitle}>Usuário envolvido</Text>
            <View style={s.personCard}>
              {user?.avatarUrl ? (
                <Image source={{ uri: user.avatarUrl }} style={s.avatar} />
              ) : (
                <View style={s.avatarFallbackMuted}>
                  <Text style={s.avatarMutedText}>{initials(user?.nome ?? "")}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={s.personLabel}>Quem está reportando</Text>
                <Text style={s.personName}>{user?.nome ?? "Você"}</Text>
              </View>
            </View>

            <View style={s.personCard}>
              {otherUser?.avatarUrl ? (
                <Image source={{ uri: otherUser.avatarUrl }} style={s.avatar} />
              ) : (
                <View style={s.avatarFallback}>
                  <Text style={s.avatarText}>{initials(otherUser?.nome ?? "")}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={s.personLabel}>Você está reportando</Text>
                <Text style={s.personName}>{otherUser?.nome ?? "Usuário não identificado"}</Text>
              </View>
            </View>

            <Pressable
              onPress={() => setStep(2)}
              disabled={!canContinueStep1}
              style={({ pressed }) => [s.primaryBtn, !canContinueStep1 && s.disabledBtn, pressed && canContinueStep1 && s.pressed]}
            >
              <Text style={s.primaryText}>Continuar</Text>
            </Pressable>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Text style={s.sectionTitle}>Categoria</Text>
            <View style={s.categoryGrid}>
              {groups.map((group) => {
                const active = selectedGroupKey === group.key;
                return (
                  <Pressable
                    key={group.key}
                    onPress={() => {
                      setSelectedGroupKey(group.key);
                      setSelectedSubtipo(null);
                    }}
                    style={({ pressed }) => [s.categoryCard, active && s.categoryCardActive, pressed && s.pressed]}
                  >
                    <View style={[s.categoryIcon, active && s.categoryIconActive]}>
                      <AppIcon name={group.icon} size={22} color={active ? colors.white : RED} />
                    </View>
                    <Text style={[s.categoryTitle, active && s.categoryTitleActive]}>{group.title}</Text>
                  </Pressable>
                );
              })}
            </View>

            {selectedGroup ? (
              <>
                <Text style={s.sectionTitle}>Subtipo</Text>
                <View style={s.subtypeList}>
                  {selectedGroup.subtipos.map((item) => {
                    const active = selectedSubtipo?.label === item.label;
                    return (
                      <Pressable
                        key={item.label}
                        onPress={() => setSelectedSubtipo(item)}
                        style={({ pressed }) => [s.subtypeRow, active && s.subtypeRowActive, pressed && s.pressed]}
                      >
                        <Text style={[s.subtypeText, active && s.subtypeTextActive]}>{item.label}</Text>
                        {active ? <AppIcon name="CheckCircle" size={18} color={RED} /> : null}
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}

            <View style={s.navRow}>
              <Pressable onPress={() => setStep(1)} style={s.secondaryBtn}>
                <Text style={s.secondaryText}>Voltar</Text>
              </Pressable>
              <Pressable
                onPress={() => setStep(3)}
                disabled={!canContinueStep2}
                style={({ pressed }) => [s.primaryBtnSmall, !canContinueStep2 && s.disabledBtn, pressed && canContinueStep2 && s.pressed]}
              >
                <Text style={s.primaryText}>Continuar</Text>
              </Pressable>
            </View>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <Text style={s.sectionTitle}>Detalhes</Text>
            <TextInput
              value={descricao}
              onChangeText={(t) => setDescricao(t.slice(0, DESC_MAX))}
              placeholder="Descreva o ocorrido (opcional)"
              placeholderTextColor={colors.mutedForeground}
              multiline
              textAlignVertical="top"
              style={s.textarea}
            />
            <Text style={s.counter}>{descricao.trim().length}/{DESC_MAX}</Text>

            <Text style={s.sectionTitle}>Gravidade</Text>
            <View style={s.gravityList}>
              {GRAVIDADES.map((item) => {
                const active = gravidade === item.value;
                return (
                  <Pressable
                    key={item.value}
                    onPress={() => setGravidade(item.value)}
                    style={({ pressed }) => [s.gravityRow, active && { borderColor: item.color }, pressed && s.pressed]}
                  >
                    <View style={[s.radio, active && { borderColor: item.color }]}>
                      {active ? <View style={[s.radioDot, { backgroundColor: item.color }]} /> : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.gravityTitle, active && { color: item.color }]}>{item.label}</Text>
                      <Text style={s.gravityDesc}>{item.desc}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              onPress={() => setAnonimo((v) => !v)}
              style={({ pressed }) => [s.checkRow, pressed && s.pressed]}
            >
              <View style={[s.checkbox, anonimo && s.checkboxActive]}>
                {anonimo ? <AppIcon name="CheckCircle" size={14} color={colors.white} /> : null}
              </View>
              <Text style={s.checkText}>Desejo que meu nome seja mantido em sigilo</Text>
            </Pressable>

            {toast ? (
              <View style={s.toast}>
                <Text style={s.toastText}>{toast}</Text>
              </View>
            ) : null}

            <View style={s.navRow}>
              <Pressable onPress={() => setStep(2)} style={s.secondaryBtn}>
                <Text style={s.secondaryText}>Voltar</Text>
              </Pressable>
              <Pressable
                onPress={enviar}
                disabled={!canSubmit}
                style={({ pressed }) => [s.primaryBtnSmall, !canSubmit && s.disabledBtn, pressed && canSubmit && s.pressed]}
              >
                {saving ? <ActivityIndicator color={colors.white} /> : (
                  <View style={s.submitContent}>
                    <PaperPlane3DIcon size={28} />
                    <Text style={s.primaryText}>Enviar Denúncia</Text>
                  </View>
                )}
              </Pressable>
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    gap: 10,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "800",
    color: colors.foreground,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 60,
    gap: 14,
  },
  steps: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  stepDot: {
    width: 26,
    height: 5,
    borderRadius: 999,
    backgroundColor: colors.border,
  },
  stepDotActive: {
    backgroundColor: RED,
  },
  alert: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: RED_BG,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.dangerSoft,
  },
  alertText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    color: RED_DARK,
    lineHeight: 17,
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    color: colors.foreground,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: RED_BG,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.dangerSoft,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    color: RED_DARK,
    lineHeight: 17,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: colors.foreground,
    marginTop: 4,
  },
  personCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 14,
    ...shadow.card,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarFallback: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: RED_BG,
  },
  avatarFallbackMuted: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.secondary,
  },
  avatarText: {
    color: RED_DARK,
    fontSize: 20,
    fontWeight: "900",
  },
  avatarMutedText: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: "900",
  },
  personLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.mutedForeground,
  },
  personName: {
    marginTop: 2,
    fontSize: 16,
    fontWeight: "900",
    color: colors.foreground,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  categoryCard: {
    width: "31%",
    minHeight: 96,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  categoryCardActive: {
    borderColor: RED,
    backgroundColor: RED_BG,
  },
  categoryIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: RED_BG,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryIconActive: {
    backgroundColor: RED,
  },
  categoryTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.foreground,
    textAlign: "center",
  },
  categoryTitleActive: {
    color: RED_DARK,
  },
  subtypeList: {
    gap: 8,
  },
  subtypeRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  subtypeRowActive: {
    borderColor: RED,
    backgroundColor: RED_BG,
  },
  subtypeText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "800",
    color: colors.foreground,
  },
  subtypeTextActive: {
    color: RED_DARK,
  },
  textarea: {
    minHeight: 130,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    fontSize: 14,
    color: colors.foreground,
    fontWeight: "500",
  },
  counter: {
    alignSelf: "flex-end",
    fontSize: 12,
    fontWeight: "700",
    color: colors.mutedForeground,
  },
  gravityList: {
    gap: 8,
  },
  gravityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 12,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  gravityTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: colors.foreground,
  },
  gravityDesc: {
    marginTop: 1,
    fontSize: 11,
    fontWeight: "600",
    color: colors.mutedForeground,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
  },
  checkboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    color: colors.foreground,
  },
  toast: {
    backgroundColor: colors.foreground,
    borderRadius: 12,
    padding: 12,
  },
  toastText: {
    color: colors.white,
    fontWeight: "700",
    fontSize: 13,
  },
  navRow: {
    flexDirection: "row",
    gap: 10,
  },
  primaryBtn: {
    height: 52,
    borderRadius: radius.btn,
    backgroundColor: RED,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnSmall: {
    flex: 1,
    height: 52,
    borderRadius: radius.btn,
    backgroundColor: RED,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "900",
  },
  submitContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  secondaryBtn: {
    flex: 1,
    height: 52,
    borderRadius: radius.btn,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "900",
  },
  disabledBtn: {
    backgroundColor: colors.muted,
  },
  pressed: {
    opacity: 0.85,
  },
});
