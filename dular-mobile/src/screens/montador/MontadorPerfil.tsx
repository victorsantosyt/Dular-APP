import React, { useEffect, useMemo, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { AppIcon, DErrorState, DLoadingState, DScreen } from "@/components/ui";
import {
  MONTADOR_SERVICOS,
  carregarPerfilMontador,
  type MontadorServico,
} from "@/api/montadorApi";
import { useMontadorServicos } from "@/hooks/useMontadorServicos";
import { useProfileTheme } from "@/hooks/useProfileTheme";
import { useAuth } from "@/stores/authStore";
import type { MontadorTabParamList } from "@/navigation/MontadorNavigator";
import type { ProfileTheme } from "@/theme/profileTheme";
import { colors, radius, shadows, spacing, typography } from "@/theme";
import { firstName, formatMoneyFromCents, upperStatus } from "./montadorUtils";

type Navigation = BottomTabNavigationProp<MontadorTabParamList>;

const ESPECIALIDADES_INICIAIS = [
  "Montagem de móveis",
  "Pequenos reparos",
  "Instalações",
  "Manutenção residencial",
  "Suporte residencial",
] as const;

function Section({
  title,
  borderColor,
  children,
}: {
  title: string;
  borderColor?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={[styles.sectionCard, borderColor ? { borderColor } : null]}>
        {children}
      </View>
    </View>
  );
}

function Row({
  icon,
  title,
  subtitle,
  accent,
  soft,
  dividerColor,
  danger,
  onPress,
}: {
  icon: React.ComponentProps<typeof AppIcon>["name"];
  title: string;
  subtitle?: string;
  accent: string;
  soft: string;
  dividerColor?: string;
  danger?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        dividerColor ? { borderBottomColor: dividerColor } : null,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.rowIcon, { backgroundColor: danger ? colors.dangerSoft : soft }]}>
        <AppIcon name={icon} size={18} color={danger ? colors.danger : accent} />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, danger && { color: colors.danger }]}>{title}</Text>
        {subtitle ? <Text style={styles.rowSub}>{subtitle}</Text> : null}
      </View>
      <AppIcon name="ChevronRight" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

function FloatingCard({
  visible,
  title,
  subtitle,
  theme,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  theme: ProfileTheme;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { borderColor: theme.border }]}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderText}>
              <Text style={styles.modalTitle}>{title}</Text>
              {subtitle ? <Text style={styles.modalSubtitle}>{subtitle}</Text> : null}
            </View>
            <Pressable onPress={onClose} hitSlop={12} style={styles.modalClose}>
              <AppIcon name="XCircle" size={22} color={colors.textMuted} strokeWidth={2.2} />
            </Pressable>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

function totalGanhos(servicos: MontadorServico[]) {
  return servicos
    .filter((item) => ["FINALIZADO", "CONCLUIDO"].includes(upperStatus(item.status)))
    .reduce((sum, item) => sum + (item.precoFinal ?? item.valorEstimado ?? 0), 0);
}

export default function MontadorPerfil() {
  const navigation = useNavigation<Navigation>();
  const profileTheme = useProfileTheme("MONTADOR");
  const user = useAuth((state) => state.user);
  const setUser = useAuth((state) => state.setUser);
  const clearSession = useAuth((state) => state.clearSession);
  const { agenda } = useMontadorServicos();
  const [online, setOnline] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [especialidades, setEspecialidades] = useState<string[]>([...ESPECIALIDADES_INICIAIS]);
  const [novaEspecialidade, setNovaEspecialidade] = useState("");
  const [especialidadesModalVisible, setEspecialidadesModalVisible] = useState(false);
  const [portfolioModalVisible, setPortfolioModalVisible] = useState(false);

  const nome = firstName(user?.nome);
  const verificado = user?.verificacao?.status === "APROVADO" || user?.verificado;
  const ganhos = useMemo(() => totalGanhos(agenda), [agenda]);
  const catalogoEspecialidades = useMemo(
    () => Array.from(new Set([...MONTADOR_SERVICOS, ...especialidades])),
    [especialidades],
  );

  const carregarPerfilMontadorAtual = async () => {
    try {
      setLoading(true);
      setError(null);
      const profile = await carregarPerfilMontador();
      setUser((prev) => ({
        ...(prev ?? { id: profile.id, nome: profile.nome ?? "", role: profile.role ?? "MONTADOR" }),
        id: profile.id,
        nome: profile.nome ?? prev?.nome ?? "",
        telefone: profile.telefone ?? prev?.telefone,
        role: profile.role ?? prev?.role ?? "MONTADOR",
        genero: profile.genero ?? prev?.genero,
        avatarUrl: profile.avatarUrl ?? prev?.avatarUrl,
        bio: profile.bio ?? prev?.bio,
        verificado: profile.verificado ?? prev?.verificado,
        docEnviado: profile.docEnviado ?? prev?.docEnviado,
        verificacao: profile.verificacao ?? prev?.verificacao,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar perfil.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void carregarPerfilMontadorAtual();
  }, []);

  const atualizarDadosProfissionais = () => {
    Alert.alert("Dados profissionais", "Edição avançada será conectada ao perfil do montador.");
  };
  const abrirEspecialidades = () => setEspecialidadesModalVisible(true);
  const atualizarAreaAtendimento = () => {
    Alert.alert("Área de atendimento", "Configuração de bairros será conectada ao perfil do montador.");
  };
  const atualizarDisponibilidade = () => setOnline((current) => !current);
  const atualizarPrecos = () => {
    Alert.alert("Preços", "Tabela de preços do montador será conectada ao backend.");
  };
  const enviarDocumento = () => {
    Alert.alert("Documentos", "Envio de documentos será conectado ao fluxo de verificação.");
  };
  const abrirPortfolio = () => setPortfolioModalVisible(true);
  const editarPortfolio = () => {
    Alert.alert("Portfólio", "Edição e envio de fotos serão conectados ao perfil do montador.");
  };
  const removerFotoPortfolio = () => {
    Alert.alert("Portfólio", "Remoção de fotos será conectada ao perfil do montador.");
  };
  const carregarAvaliacoes = () => {
    Alert.alert("Avaliações", "Avaliações do montador aparecerão quando houver histórico.");
  };
  const sairDaConta = () => {
    Alert.alert("Sair", "Encerrar sessão da conta?", [
      { text: "Voltar", style: "cancel" },
      { text: "Sair", style: "destructive", onPress: () => { void clearSession(); } },
    ]);
  };

  const toggleEspecialidade = (label: string) => {
    setEspecialidades((current) =>
      current.includes(label)
        ? current.filter((item) => item !== label)
        : [...current, label],
    );
  };

  const adicionarEspecialidade = () => {
    const value = novaEspecialidade.trim();
    if (!value) return;
    setEspecialidades((current) => {
      const exists = current.some((item) => item.toLowerCase() === value.toLowerCase());
      return exists ? current : [...current, value];
    });
    setNovaEspecialidade("");
  };

  const removerEspecialidade = (label: string) => {
    setEspecialidades((current) => current.filter((item) => item !== label));
  };

  return (
    <DScreen scroll withBottomPadding backgroundColor={profileTheme.background} contentContainerStyle={styles.scroll}>
      <View style={styles.header}>
        <Text style={styles.title}>Perfil</Text>
      </View>

      {loading ? (
        <DLoadingState text="Carregando perfil" color={profileTheme.primary} />
      ) : error ? (
        <DErrorState message={error} onRetry={carregarPerfilMontadorAtual} />
      ) : (
        <>
          <LinearGradient colors={profileTheme.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
            <Pressable onPress={abrirPortfolio} style={styles.avatar}>
              <AppIcon name="UserRound" size={34} color={colors.white} strokeWidth={2.1} />
            </Pressable>
            <View style={styles.heroText}>
              <Text style={styles.name}>{nome}</Text>
              <Text style={styles.role}>Tipo: Montador</Text>
              <View style={styles.heroBadges}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>Avaliação --</Text>
                </View>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {verificado ? "Verificado" : "Verificação pendente"}
                  </Text>
                </View>
              </View>
              <Text style={styles.status}>{online ? "Online" : "Indisponível"}</Text>
            </View>
          </LinearGradient>

          <Section title="Dados profissionais" borderColor={profileTheme.border}>
            <Row icon="User" title="Nome, telefone e apresentação" subtitle={user?.bio ?? "Complete sua apresentação"} accent={profileTheme.primary} soft={profileTheme.primarySoft} dividerColor={profileTheme.border} onPress={atualizarDadosProfissionais} />
            <Row icon="Wrench" title="Especialidades" subtitle={`${especialidades.length} tag(s) selecionada(s) • ${online ? "Online" : "Indisponível"}`} accent={profileTheme.primary} soft={profileTheme.primarySoft} dividerColor={profileTheme.border} onPress={abrirEspecialidades} />
            <Row icon="MapPin" title="Área de atendimento" subtitle="Cidade e bairros atendidos" accent={profileTheme.primary} soft={profileTheme.primarySoft} dividerColor={profileTheme.border} onPress={atualizarAreaAtendimento} />
            <Row icon="Wallet" title="Preços" subtitle="Valores por tipo de montagem" accent={profileTheme.primary} soft={profileTheme.primarySoft} dividerColor={profileTheme.border} onPress={atualizarPrecos} />
            <Row icon="Camera" title="Portfólio" subtitle="Fotos e trabalhos realizados" accent={profileTheme.primary} soft={profileTheme.primarySoft} dividerColor={profileTheme.border} onPress={abrirPortfolio} />
            <Row icon="Star" title="Avaliações" subtitle="Histórico de avaliações recebidas" accent={profileTheme.primary} soft={profileTheme.primarySoft} dividerColor={profileTheme.border} onPress={carregarAvaliacoes} />
            <Row icon="CreditCard" title="Carteira/Ganhos" subtitle={formatMoneyFromCents(ganhos)} accent={profileTheme.primary} soft={profileTheme.primarySoft} dividerColor={profileTheme.border} onPress={() => Alert.alert("Carteira", "Carteira do montador será conectada ao backend.")} />
          </Section>

          <Section title="Documentos e segurança" borderColor={profileTheme.border}>
            <Row icon="FileText" title="Documentos/verificação" subtitle={verificado ? "Documentos aprovados" : "Envie seus documentos"} accent={profileTheme.primary} soft={profileTheme.primarySoft} dividerColor={profileTheme.border} onPress={enviarDocumento} />
            <Row icon="ShieldCheck" title="Segurança/SafeScore" subtitle="Proteção ativa no perfil profissional" accent={profileTheme.primary} soft={profileTheme.primarySoft} dividerColor={profileTheme.border} onPress={() => navigation.navigate("MontadorHome")} />
          </Section>

          <Section title="Suporte e termos" borderColor={profileTheme.border}>
            <Row icon="HelpCircle" title="Suporte" subtitle="Fale com o Dular" accent={profileTheme.primary} soft={profileTheme.primarySoft} dividerColor={profileTheme.border} onPress={() => Alert.alert("Suporte", "Atendimento será conectado em breve.")} />
            <Row icon="FileText" title="Termos" subtitle="Termos e políticas da plataforma" accent={profileTheme.primary} soft={profileTheme.primarySoft} dividerColor={profileTheme.border} onPress={() => Alert.alert("Termos", "Termos serão exibidos em breve.")} />
            <Row icon="LogOut" title="Sair" subtitle="Encerrar sessão da conta" accent={profileTheme.primary} soft={profileTheme.primarySoft} dividerColor={profileTheme.border} danger onPress={sairDaConta} />
          </Section>

          <FloatingCard
            visible={especialidadesModalVisible}
            title="Especialidades"
            subtitle="Gerencie seus tipos de trabalho e disponibilidade."
            theme={profileTheme}
            onClose={() => setEspecialidadesModalVisible(false)}
          >
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
              <View style={[styles.availabilityCard, { borderColor: profileTheme.border, backgroundColor: profileTheme.primarySoft }]}>
                <View style={styles.availabilityText}>
                  <Text style={[styles.availabilityTitle, { color: profileTheme.textAccent }]}>Disponibilidade</Text>
                  <Text style={styles.availabilitySub}>
                    {online ? "Recebendo solicitações" : "Indisponível para novas solicitações"}
                  </Text>
                </View>
                <Pressable onPress={atualizarDisponibilidade} style={[styles.availabilityButton, { backgroundColor: profileTheme.primary }]}>
                  <Text style={styles.availabilityButtonText}>{online ? "Ficar indisponível" : "Ficar online"}</Text>
                </Pressable>
              </View>

              <View style={styles.modalBlock}>
                <Text style={styles.modalLabel}>Tags selecionadas</Text>
                <View style={styles.tagsWrap}>
                  {especialidades.map((item) => (
                    <Pressable
                      key={item}
                      onPress={() => removerEspecialidade(item)}
                      style={[styles.tag, { backgroundColor: profileTheme.primary, borderColor: profileTheme.primary }]}
                    >
                      <Text style={[styles.tagText, styles.tagTextActive]}>{item}</Text>
                      <AppIcon name="XCircle" size={14} color={colors.white} strokeWidth={2.4} />
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.modalBlock}>
                <Text style={styles.modalLabel}>Adicionar especialidade</Text>
                <View style={styles.addRow}>
                  <TextInput
                    value={novaEspecialidade}
                    onChangeText={setNovaEspecialidade}
                    placeholder="Ex.: Instalação de cortina"
                    placeholderTextColor={colors.textMuted}
                    style={[styles.input, { borderColor: profileTheme.border }]}
                  />
                  <Pressable onPress={adicionarEspecialidade} style={[styles.addButton, { backgroundColor: profileTheme.primary }]}>
                    <Text style={styles.addButtonText}>Adicionar</Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.modalBlock}>
                <Text style={styles.modalLabel}>Catálogo sugerido</Text>
                <View style={styles.tagsWrap}>
                  {catalogoEspecialidades.map((item) => {
                    const active = especialidades.includes(item);
                    return (
                      <Pressable
                        key={item}
                        onPress={() => toggleEspecialidade(item)}
                        style={[
                          styles.tag,
                          active
                            ? { backgroundColor: profileTheme.primary, borderColor: profileTheme.primary }
                            : { backgroundColor: colors.surface, borderColor: profileTheme.border },
                        ]}
                      >
                        <Text style={[styles.tagText, active ? styles.tagTextActive : { color: colors.textSecondary }]}>
                          {active ? "Remover" : "Adicionar"} {item}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </ScrollView>
          </FloatingCard>

          <FloatingCard
            visible={portfolioModalVisible}
            title="Portfólio"
            subtitle="Organize fotos de montagens e reparos em um só lugar."
            theme={profileTheme}
            onClose={() => setPortfolioModalVisible(false)}
          >
            <View style={[styles.portfolioCard, { borderColor: profileTheme.border, backgroundColor: profileTheme.primarySoft }]}>
              <View style={[styles.portfolioIcon, { backgroundColor: colors.surface }]}>
                <AppIcon name="Camera" size={24} color={profileTheme.primary} />
              </View>
              <View style={styles.portfolioText}>
                <Text style={[styles.portfolioTitle, { color: profileTheme.textAccent }]}>Fotos do portfólio</Text>
                <Text style={styles.portfolioSub}>
                  Mostre trabalhos concluídos, detalhes de acabamento e reparos realizados.
                </Text>
              </View>
            </View>

            <View style={styles.portfolioActions}>
              <Pressable onPress={editarPortfolio} style={[styles.portfolioPrimary, { backgroundColor: profileTheme.primary }]}>
                <Text style={styles.portfolioPrimaryText}>Editar ou adicionar</Text>
              </Pressable>
              <Pressable onPress={removerFotoPortfolio} style={styles.portfolioRemove}>
                <Text style={styles.portfolioRemoveText}>Remover foto</Text>
              </Pressable>
            </View>
          </FloatingCard>
        </>
      )}
    </DScreen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: 16,
  },
  header: {
    minHeight: 52,
    justifyContent: "center",
  },
  title: {
    color: colors.textPrimary,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: "700",
    letterSpacing: 0,
    textAlign: "center",
  },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 160,
    borderRadius: radius.lg,
    padding: 12,
    ...shadows.primaryButton,
  },
  avatar: {
    width: 74,
    height: 74,
    borderRadius: 37,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.whiteAlpha20,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  heroText: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  name: {
    ...typography.h3,
    color: colors.white,
    fontWeight: "700",
    letterSpacing: 0,
  },
  role: {
    ...typography.bodySm,
    color: colors.whiteAlpha85,
    fontWeight: "500",
  },
  heroBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  badge: {
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: colors.whiteAlpha20,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  badgeText: {
    color: colors.white,
    ...typography.caption,
    fontWeight: "700",
  },
  status: {
    ...typography.caption,
    color: colors.whiteAlpha85,
    fontWeight: "500",
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.textPrimary,
    ...typography.bodyMedium,
    fontWeight: "700",
    paddingHorizontal: 2,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    ...shadows.soft,
  },
  row: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  rowTitle: {
    color: colors.textPrimary,
    ...typography.bodySm,
    fontWeight: "700",
  },
  rowSub: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  pressed: {
    opacity: 0.74,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    backgroundColor: colors.overlay,
  },
  modalCard: {
    maxHeight: "82%",
    borderRadius: radius.xl,
    borderWidth: 1,
    backgroundColor: colors.surface,
    padding: 16,
    gap: 14,
    ...shadows.floating,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  modalHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "700",
  },
  modalSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "500",
    marginTop: 4,
  },
  modalClose: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  modalScroll: {
    gap: 16,
    paddingBottom: 2,
  },
  modalBlock: {
    gap: 10,
  },
  modalLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "700",
  },
  availabilityCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 12,
  },
  availabilityText: {
    flex: 1,
    minWidth: 0,
  },
  availabilityTitle: {
    ...typography.bodySmMedium,
    fontWeight: "700",
  },
  availabilitySub: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: "500",
    marginTop: 3,
  },
  availabilityButton: {
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  availabilityButtonText: {
    ...typography.caption,
    color: colors.white,
    fontWeight: "700",
  },
  tagsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tag: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  tagText: {
    fontSize: 12,
    fontWeight: "700",
  },
  tagTextActive: {
    color: colors.white,
  },
  addRow: {
    gap: 8,
  },
  input: {
    minHeight: 44,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: 12,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    fontSize: 15,
    fontWeight: "600",
  },
  addButton: {
    minHeight: 42,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  addButtonText: {
    color: colors.white,
    fontWeight: "700",
  },
  portfolioCard: {
    flexDirection: "row",
    gap: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 12,
  },
  portfolioIcon: {
    width: 48,
    height: 48,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  portfolioText: {
    flex: 1,
    minWidth: 0,
  },
  portfolioTitle: {
    ...typography.bodySmMedium,
    fontWeight: "700",
  },
  portfolioSub: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: "500",
    lineHeight: 18,
    marginTop: 4,
  },
  portfolioActions: {
    gap: 10,
  },
  portfolioPrimary: {
    minHeight: 46,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  portfolioPrimaryText: {
    color: colors.white,
    fontWeight: "700",
  },
  portfolioRemove: {
    minHeight: 46,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
  },
  portfolioRemoveText: {
    color: colors.danger,
    fontWeight: "700",
  },
});
