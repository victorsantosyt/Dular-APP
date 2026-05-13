import React, { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
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
  /** Override da borda do card — usar `profileTheme.border` para alinhar com
   *  a identidade visual do gênero. Default: borda lavanda do tema base. */
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
  /** Override da cor do divisor inferior. Default: lavanda do tema base. */
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

  const nome = firstName(user?.nome);
  const verificado = user?.verificacao?.status === "APROVADO" || user?.verificado;
  const ganhos = useMemo(() => totalGanhos(agenda), [agenda]);

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
  const atualizarEspecialidades = () => {
    Alert.alert("Especialidades", ESPECIALIDADES_INICIAIS.join("\n"));
  };
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
  const adicionarFotoPortfolio = () => {
    Alert.alert("Portfólio", "Adição de fotos será conectada ao perfil do montador.");
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
          <View style={[styles.hero, { borderColor: profileTheme.border }]}>
            <Pressable onPress={adicionarFotoPortfolio} style={[styles.avatar, { backgroundColor: profileTheme.primarySoft }]}>
              <AppIcon name="UserRound" size={34} color={profileTheme.primary} strokeWidth={2.1} />
            </Pressable>
            <View style={styles.heroText}>
              <Text style={styles.name}>{nome}</Text>
              <Text style={styles.role}>Tipo: Montador</Text>
              <View style={styles.heroBadges}>
                <View style={[styles.badge, { backgroundColor: profileTheme.primarySoft }]}>
                  <Text style={[styles.badgeText, { color: profileTheme.primary }]}>Avaliação --</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: verificado ? profileTheme.primarySoft : colors.warningSoft }]}>
                  <Text style={[styles.badgeText, { color: verificado ? profileTheme.primary : colors.warningDark }]}>
                    {verificado ? "Verificado" : "Verificação pendente"}
                  </Text>
                </View>
              </View>
              <Text style={styles.status}>{online ? "Online" : "Indisponível"}</Text>
            </View>
          </View>

          <View style={styles.specialties}>
            {ESPECIALIDADES_INICIAIS.map((item) => (
              <View key={item} style={[styles.chip, { backgroundColor: profileTheme.primarySoft, borderColor: profileTheme.border }]}>
                <Text style={[styles.chipText, { color: profileTheme.textAccent }]}>{item}</Text>
              </View>
            ))}
          </View>

          <Section title="Dados profissionais" borderColor={profileTheme.border}>
            <Row icon="User" title="Nome, telefone e apresentação" subtitle={user?.bio ?? "Complete sua apresentação"} accent={profileTheme.primary} soft={profileTheme.primarySoft} dividerColor={profileTheme.border} onPress={atualizarDadosProfissionais} />
            <Row icon="Wrench" title="Especialidades" subtitle={`${ESPECIALIDADES_INICIAIS.length} especialidades iniciais`} accent={profileTheme.primary} soft={profileTheme.primarySoft} dividerColor={profileTheme.border} onPress={atualizarEspecialidades} />
            <Row icon="MapPin" title="Área de atendimento" subtitle="Cidade e bairros atendidos" accent={profileTheme.primary} soft={profileTheme.primarySoft} dividerColor={profileTheme.border} onPress={atualizarAreaAtendimento} />
            <Row icon="Clock" title="Disponibilidade" subtitle={online ? "Recebendo solicitações" : "Indisponível para novas solicitações"} accent={profileTheme.primary} soft={profileTheme.primarySoft} dividerColor={profileTheme.border} onPress={atualizarDisponibilidade} />
            <Row icon="Wallet" title="Preços" subtitle="Valores por tipo de montagem" accent={profileTheme.primary} soft={profileTheme.primarySoft} dividerColor={profileTheme.border} onPress={atualizarPrecos} />
          </Section>

          <Section title="Portfólio" borderColor={profileTheme.border}>
            <Row icon="Camera" title="Adicionar foto" subtitle="Mostre montagens e reparos realizados" accent={profileTheme.primary} soft={profileTheme.primarySoft} dividerColor={profileTheme.border} onPress={adicionarFotoPortfolio} />
            <Row icon="Image" title="Remover foto" subtitle="Gerencie imagens publicadas" accent={profileTheme.primary} soft={profileTheme.primarySoft} dividerColor={profileTheme.border} onPress={removerFotoPortfolio} />
          </Section>

          <Section title="Documentos e segurança" borderColor={profileTheme.border}>
            <Row icon="FileText" title="Documentos/verificação" subtitle={verificado ? "Documentos aprovados" : "Envie seus documentos"} accent={profileTheme.primary} soft={profileTheme.primarySoft} dividerColor={profileTheme.border} onPress={enviarDocumento} />
            <Row icon="ShieldCheck" title="Segurança/SafeScore" subtitle="Proteção ativa no perfil profissional" accent={profileTheme.primary} soft={profileTheme.primarySoft} dividerColor={profileTheme.border} onPress={() => navigation.navigate("MontadorHome")} />
          </Section>

          <Section title="Avaliações e ganhos" borderColor={profileTheme.border}>
            <Row icon="Star" title="Avaliações" subtitle="Histórico de avaliações recebidas" accent={profileTheme.primary} soft={profileTheme.primarySoft} dividerColor={profileTheme.border} onPress={carregarAvaliacoes} />
            <Row icon="CreditCard" title="Carteira/Ganhos" subtitle={formatMoneyFromCents(ganhos)} accent={profileTheme.primary} soft={profileTheme.primarySoft} dividerColor={profileTheme.border} onPress={() => Alert.alert("Carteira", "Carteira do montador será conectada ao backend.")} />
          </Section>

          <Section title="Suporte e termos" borderColor={profileTheme.border}>
            <Row icon="HelpCircle" title="Suporte" subtitle="Fale com o Dular" accent={profileTheme.primary} soft={profileTheme.primarySoft} dividerColor={profileTheme.border} onPress={() => Alert.alert("Suporte", "Atendimento será conectado em breve.")} />
            <Row icon="FileText" title="Termos" subtitle="Termos e políticas da plataforma" accent={profileTheme.primary} soft={profileTheme.primarySoft} dividerColor={profileTheme.border} onPress={() => Alert.alert("Termos", "Termos serão exibidos em breve.")} />
            <Row icon="LogOut" title="Sair" subtitle="Encerrar sessão da conta" accent={profileTheme.primary} soft={profileTheme.primarySoft} dividerColor={profileTheme.border} danger onPress={sairDaConta} />
          </Section>

          <View style={[styles.catalogCard, { borderColor: profileTheme.border }]}>
            <Text style={styles.catalogTitle}>Catálogo inicial</Text>
            <Text style={styles.catalogText}>{MONTADOR_SERVICOS.join(", ")}</Text>
          </View>
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
    minHeight: 40,
    justifyContent: "center",
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
    fontWeight: "800",
  },
  hero: {
    flexDirection: "row",
    gap: 14,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: 14,
    ...shadows.card,
  },
  avatar: {
    width: 74,
    height: 74,
    borderRadius: 37,
    alignItems: "center",
    justifyContent: "center",
  },
  heroText: {
    flex: 1,
    gap: 6,
  },
  name: {
    ...typography.title,
    color: colors.textPrimary,
    fontWeight: "800",
  },
  role: {
    ...typography.bodySm,
    color: colors.textSecondary,
    fontWeight: "700",
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
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "900",
  },
  status: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: "800",
  },
  specialties: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "800",
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    ...typography.bodySmMedium,
    color: colors.textPrimary,
    fontWeight: "800",
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    ...shadows.soft,
  },
  row: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    ...typography.bodySmMedium,
    color: colors.textPrimary,
    fontWeight: "800",
  },
  rowSub: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  catalogCard: {
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  catalogTitle: {
    ...typography.bodySmMedium,
    color: colors.textPrimary,
    fontWeight: "800",
  },
  catalogText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 6,
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.74,
  },
});
