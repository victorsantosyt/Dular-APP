import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { AppIcon, DErrorState, DLoadingState, DScreen } from "@/components/ui";
import {
  MONTADOR_ESPECIALIDADES,
  atualizarPerfilMontador,
  carregarPerfilMontador,
  type AtualizarPerfilMontadorPayload,
  type MontadorEspecialidadeId,
  type MontadorPerfilMe,
} from "@/api/montadorApi";
import { useMontadorServicos } from "@/hooks/useMontadorServicos";
import { useProfileTheme } from "@/hooks/useProfileTheme";
import { useAuth } from "@/stores/authStore";
import { colors, radius, shadows, spacing, typography } from "@/theme";
import type { ProfileTheme } from "@/theme/profileTheme";
import { firstName, formatMoneyFromCents, upperStatus } from "./montadorUtils";

type ModalType = "dados" | "especialidades" | "area" | "precos" | "portfolio" | "documentos" | null;

type DadosForm = {
  nome: string;
  telefone: string;
  bio: string;
  anosExperiencia: string;
};

type AreaForm = {
  cidade: string;
  estado: string;
  bairros: string;
  raioAtendimentoKm: string;
  ativo: boolean;
};

type PrecosForm = {
  valorACombinar: boolean;
  precoBase: string;
  taxaMinima: string;
  cobraDeslocamento: boolean;
  observacaoPreco: string;
};

const ESPECIALIDADE_LABELS = Object.fromEntries(
  MONTADOR_ESPECIALIDADES.map((item) => [item.id, item.label]),
) as Record<MontadorEspecialidadeId, string>;

function especialidadeLabel(id: string) {
  return ESPECIALIDADE_LABELS[id as MontadorEspecialidadeId] ?? id;
}

function centsToInput(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  return (value / 100).toFixed(2).replace(".", ",");
}

function inputToCents(value: string) {
  const normalized = value.replace(/\./g, "").replace(",", ".").trim();
  if (!normalized) return null;
  const number = Number(normalized);
  if (!Number.isFinite(number) || number < 0) return NaN;
  return Math.round(number * 100);
}

function splitBairros(value: string) {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item.length >= 2),
    ),
  );
}

function totalGanhos(servicos: Array<{ status: string; precoFinal?: number | null; valorEstimado?: number | null }>) {
  return servicos
    .filter((item) => ["FINALIZADO", "CONCLUIDO"].includes(upperStatus(item.status)))
    .reduce((sum, item) => sum + (item.precoFinal ?? item.valorEstimado ?? 0), 0);
}

function Section({
  title,
  children,
  borderColor,
}: {
  title: string;
  children: React.ReactNode;
  borderColor: string;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={[styles.sectionCard, { borderColor }]}>{children}</View>
    </View>
  );
}

function Row({
  icon,
  title,
  subtitle,
  theme,
  danger,
  onPress,
}: {
  icon: React.ComponentProps<typeof AppIcon>["name"];
  title: string;
  subtitle?: string;
  theme: ProfileTheme;
  danger?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, { borderBottomColor: theme.border }, pressed && styles.pressed]}>
      <View style={[styles.rowIcon, { backgroundColor: danger ? colors.dangerSoft : theme.primarySoft }]}>
        <AppIcon name={icon} size={18} color={danger ? colors.danger : theme.primary} />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, danger && { color: colors.danger }]}>{title}</Text>
        {subtitle ? <Text style={styles.rowSub} numberOfLines={2}>{subtitle}</Text> : null}
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

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: KeyboardTypeOptions;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        multiline={multiline}
        keyboardType={keyboardType}
        style={[styles.input, multiline && styles.inputMultiline]}
      />
    </View>
  );
}

function ModalActions({
  saving,
  theme,
  onCancel,
  onSave,
}: {
  saving: boolean;
  theme: ProfileTheme;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <View style={styles.modalActions}>
      <Pressable onPress={onCancel} style={styles.secondaryButton}>
        <Text style={styles.secondaryButtonText}>Cancelar</Text>
      </Pressable>
      <Pressable onPress={onSave} disabled={saving} style={[styles.primaryButton, { backgroundColor: theme.primary }, saving && styles.disabled]}>
        {saving ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={styles.primaryButtonText}>Salvar</Text>}
      </Pressable>
    </View>
  );
}

export default function MontadorPerfil() {
  const profileTheme = useProfileTheme("MONTADOR");
  const authUser = useAuth((state) => state.user);
  const setUser = useAuth((state) => state.setUser);
  const clearSession = useAuth((state) => state.clearSession);
  const { agenda } = useMontadorServicos();

  const [profile, setProfile] = useState<MontadorPerfilMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalType>(null);

  const [dadosForm, setDadosForm] = useState<DadosForm>({ nome: "", telefone: "", bio: "", anosExperiencia: "" });
  const [especialidadesForm, setEspecialidadesForm] = useState<MontadorEspecialidadeId[]>([]);
  const [areaForm, setAreaForm] = useState<AreaForm>({ cidade: "", estado: "", bairros: "", raioAtendimentoKm: "", ativo: true });
  const [precosForm, setPrecosForm] = useState<PrecosForm>({
    valorACombinar: true,
    precoBase: "",
    taxaMinima: "",
    cobraDeslocamento: false,
    observacaoPreco: "",
  });

  const ganhos = useMemo(() => totalGanhos(agenda), [agenda]);

  const perfil = profile?.perfil;
  const user = profile?.user;
  const nome = firstName(user?.nome ?? authUser?.nome);
  const progresso = perfil?.completude.progresso ?? 0;
  const completo = Boolean(perfil?.completude.completo);
  const verificado = Boolean(perfil?.verificado);
  const ativo = perfil?.ativo ?? true;
  const statusLabel = !completo ? "Incompleto" : !ativo ? "Indisponível" : verificado ? "Ativo" : "Verificação pendente";
  const especialidadesResumo = perfil?.especialidades?.length
    ? perfil.especialidades.map(especialidadeLabel).join(", ")
    : "Selecione ao menos uma especialidade";
  const areaResumo = perfil?.cidade && perfil.estado
    ? `${perfil.cidade}, ${perfil.estado}${perfil.bairros.length ? ` • ${perfil.bairros.length} bairro(s)` : ""}`
    : "Defina cidade, UF e bairros";
  const precoResumo = perfil?.valorACombinar
    ? "Valor a combinar"
    : perfil?.precoBase
      ? formatMoneyFromCents(perfil.precoBase)
      : "Configure preço ou valor a combinar";

  const syncForms = (next: MontadorPerfilMe) => {
    setDadosForm({
      nome: next.user.nome ?? "",
      telefone: next.user.telefone ?? "",
      bio: next.perfil.bio ?? "",
      anosExperiencia: next.perfil.anosExperiencia != null ? String(next.perfil.anosExperiencia) : "",
    });
    setEspecialidadesForm(next.perfil.especialidades ?? []);
    setAreaForm({
      cidade: next.perfil.cidade ?? "",
      estado: next.perfil.estado ?? "",
      bairros: next.perfil.bairros?.join(", ") ?? "",
      raioAtendimentoKm: next.perfil.raioAtendimentoKm != null ? String(next.perfil.raioAtendimentoKm) : "",
      ativo: next.perfil.ativo,
    });
    setPrecosForm({
      valorACombinar: next.perfil.valorACombinar,
      precoBase: centsToInput(next.perfil.precoBase),
      taxaMinima: centsToInput(next.perfil.taxaMinima),
      cobraDeslocamento: next.perfil.cobraDeslocamento,
      observacaoPreco: next.perfil.observacaoPreco ?? "",
    });
  };

  const applyProfile = (next: MontadorPerfilMe) => {
    setProfile(next);
    syncForms(next);
    setUser((prev) => ({
      ...(prev ?? { id: next.user.id, nome: next.user.nome ?? "", role: "MONTADOR" }),
      id: next.user.id,
      nome: next.user.nome ?? prev?.nome ?? "",
      telefone: next.user.telefone ?? prev?.telefone,
      role: "MONTADOR",
      genero: next.user.genero ?? prev?.genero,
      avatarUrl: next.user.avatarUrl ?? prev?.avatarUrl,
      bio: next.user.bio ?? prev?.bio,
      verificado: next.user.verificado ?? prev?.verificado,
      docEnviado: next.user.docEnviado ?? prev?.docEnviado,
      verificacao: next.user.verificacao ?? prev?.verificacao,
    }));
  };

  const loadProfile = async (mode: "initial" | "refresh" = "initial") => {
    try {
      if (mode === "initial") setLoading(true);
      if (mode === "refresh") setRefreshing(true);
      setError(null);
      const next = await carregarPerfilMontador();
      applyProfile(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar perfil do montador.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadProfile("initial");
  }, []);

  const openModal = (type: Exclude<ModalType, null>) => {
    if (profile) syncForms(profile);
    setFormError(null);
    setModal(type);
  };

  const saveProfile = async (payload: AtualizarPerfilMontadorPayload, success: string) => {
    try {
      setSaving(true);
      setFormError(null);
      const next = await atualizarPerfilMontador(payload);
      applyProfile(next);
      setModal(null);
      setSavedMessage(success);
      setTimeout(() => setSavedMessage(null), 2600);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Não foi possível salvar agora.");
    } finally {
      setSaving(false);
    }
  };

  const saveDados = () => {
    const anosExperiencia = dadosForm.anosExperiencia.trim() ? Number(dadosForm.anosExperiencia) : null;
    if (dadosForm.nome.trim().length < 2) {
      setFormError("Informe seu nome profissional.");
      return;
    }
    if (dadosForm.bio.trim().length > 0 && dadosForm.bio.trim().length < 20) {
      setFormError("A apresentação precisa ter pelo menos 20 caracteres.");
      return;
    }
    if (anosExperiencia != null && (!Number.isInteger(anosExperiencia) || anosExperiencia < 0)) {
      setFormError("Informe anos de experiência válidos.");
      return;
    }
    void saveProfile({
      nome: dadosForm.nome,
      telefone: dadosForm.telefone || null,
      bio: dadosForm.bio || null,
      anosExperiencia,
    }, "Dados profissionais salvos.");
  };

  const saveEspecialidades = () => {
    if (especialidadesForm.length === 0) {
      setFormError("Selecione pelo menos uma especialidade.");
      return;
    }
    void saveProfile({ especialidades: especialidadesForm }, "Especialidades salvas.");
  };

  const saveArea = () => {
    const bairros = splitBairros(areaForm.bairros);
    const raio = areaForm.raioAtendimentoKm.trim() ? Number(areaForm.raioAtendimentoKm) : null;
    if (!areaForm.cidade.trim() || areaForm.estado.trim().length !== 2 || bairros.length === 0) {
      setFormError("Informe cidade, UF e pelo menos um bairro.");
      return;
    }
    if (raio != null && (!Number.isInteger(raio) || raio <= 0)) {
      setFormError("Informe um raio de atendimento válido.");
      return;
    }
    void saveProfile({
      cidade: areaForm.cidade,
      estado: areaForm.estado,
      bairros,
      raioAtendimentoKm: raio,
      ativo: areaForm.ativo,
    }, "Área de atendimento salva.");
  };

  const savePrecos = () => {
    const precoBase = inputToCents(precosForm.precoBase);
    const taxaMinima = inputToCents(precosForm.taxaMinima);
    if (Number.isNaN(precoBase) || Number.isNaN(taxaMinima)) {
      setFormError("Informe valores válidos.");
      return;
    }
    if (!precosForm.valorACombinar && !precoBase && !taxaMinima) {
      setFormError("Informe um preço base, taxa mínima ou marque valor a combinar.");
      return;
    }
    void saveProfile({
      valorACombinar: precosForm.valorACombinar,
      precoBase,
      taxaMinima,
      cobraDeslocamento: precosForm.cobraDeslocamento,
      observacaoPreco: precosForm.observacaoPreco || null,
    }, "Preços salvos.");
  };

  const toggleEspecialidade = (id: MontadorEspecialidadeId) => {
    setEspecialidadesForm((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const sairDaConta = () => {
    Alert.alert("Sair", "Encerrar sessão da conta?", [
      { text: "Voltar", style: "cancel" },
      { text: "Sair", style: "destructive", onPress: () => { void clearSession(); } },
    ]);
  };

  if (loading) {
    return (
      <DScreen backgroundColor={profileTheme.background}>
        <DLoadingState text="Carregando perfil" color={profileTheme.primary} />
      </DScreen>
    );
  }

  if (error || !profile || !perfil) {
    return (
      <DScreen backgroundColor={profileTheme.background}>
        <DErrorState message={error ?? "Perfil não encontrado."} onRetry={() => loadProfile("initial")} />
      </DScreen>
    );
  }

  return (
    <DScreen
      scroll
      keyboardAvoiding
      withBottomPadding
      backgroundColor={profileTheme.background}
      contentContainerStyle={styles.scroll}
      refreshing={refreshing}
      onRefresh={() => loadProfile("refresh")}
      refreshTintColor={profileTheme.primary}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Perfil</Text>
      </View>

      <LinearGradient colors={profileTheme.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.avatar}>
          <AppIcon name="UserRound" size={34} color={colors.white} strokeWidth={2.1} />
        </View>
        <View style={styles.heroText}>
          <Text style={styles.name}>{nome}</Text>
          <Text style={styles.role}>Montador profissional</Text>
          <View style={styles.heroBadges}>
            <View style={styles.badge}><Text style={styles.badgeText}>{perfil.rating > 0 ? perfil.rating.toFixed(1) : "Sem avaliações"}</Text></View>
            <View style={styles.badge}><Text style={styles.badgeText}>{perfil.totalServicos} serviço(s)</Text></View>
            <View style={styles.badge}><Text style={styles.badgeText}>{statusLabel}</Text></View>
          </View>
          <View style={styles.progressTop}>
            <Text style={styles.progressLabel}>Perfil {progresso}% completo</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progresso}%` }]} />
            </View>
          </View>
        </View>
      </LinearGradient>

      {!completo ? (
        <View style={[styles.ctaCard, { borderColor: profileTheme.border, backgroundColor: profileTheme.primarySoft }]}>
          <AppIcon name="AlertTriangle" size={18} color={profileTheme.primary} />
          <View style={styles.ctaText}>
            <Text style={[styles.ctaTitle, { color: profileTheme.textAccent }]}>Complete seu perfil para aparecer para empregadores</Text>
            <Text style={styles.ctaSub}>Nome, apresentação, especialidades e área de atendimento liberam sua visibilidade na busca.</Text>
          </View>
        </View>
      ) : null}

      {savedMessage ? (
        <View style={[styles.savedCard, { borderColor: profileTheme.border }]}>
          <AppIcon name="CheckCircle" size={17} color={profileTheme.primary} />
          <Text style={[styles.savedText, { color: profileTheme.textAccent }]}>{savedMessage}</Text>
        </View>
      ) : null}

      <Section title="Dados profissionais" borderColor={profileTheme.border}>
        <Row icon="User" title="Nome, telefone e apresentação" subtitle={perfil.bio || "Complete sua apresentação"} theme={profileTheme} onPress={() => openModal("dados")} />
        <Row icon="Wrench" title="Especialidades" subtitle={especialidadesResumo} theme={profileTheme} onPress={() => openModal("especialidades")} />
        <Row icon="MapPin" title="Área de atendimento" subtitle={areaResumo} theme={profileTheme} onPress={() => openModal("area")} />
        <Row icon="Wallet" title="Preços" subtitle={precoResumo} theme={profileTheme} onPress={() => openModal("precos")} />
        <Row icon="Camera" title="Portfólio" subtitle={perfil.portfolioFotos.length ? `${perfil.portfolioFotos.length} foto(s)` : "Sem fotos no portfólio"} theme={profileTheme} onPress={() => openModal("portfolio")} />
        <Row icon="Star" title="Avaliações" subtitle={perfil.avaliacoes?.total ? `${perfil.avaliacoes.total} avaliação(ões)` : "Sem avaliações ainda"} theme={profileTheme} onPress={() => openModal("portfolio")} />
        <Row icon="CreditCard" title="Carteira/Ganhos" subtitle={formatMoneyFromCents(ganhos)} theme={profileTheme} onPress={() => Alert.alert("Carteira", "Carteira do montador será conectada ao backend.")} />
      </Section>

      <Section title="Documentos e segurança" borderColor={profileTheme.border}>
        <Row icon="FileText" title="Documentos/verificação" subtitle={perfil.verificacaoStatus === "APROVADO" ? "Documentos aprovados" : "Documentos pendentes"} theme={profileTheme} onPress={() => openModal("documentos")} />
        <Row icon="ShieldCheck" title="Segurança/SafeScore" subtitle={perfil.safeScore?.faixa ?? "SafeScore em análise"} theme={profileTheme} onPress={() => openModal("documentos")} />
      </Section>

      <Section title="Suporte e termos" borderColor={profileTheme.border}>
        <Row icon="HelpCircle" title="Suporte" subtitle="Fale com o Dular" theme={profileTheme} onPress={() => Alert.alert("Suporte", "Atendimento será conectado em breve.")} />
        <Row icon="FileText" title="Termos" subtitle="Termos e políticas da plataforma" theme={profileTheme} onPress={() => Alert.alert("Termos", "Termos serão exibidos em breve.")} />
        <Row icon="LogOut" title="Sair" subtitle="Encerrar sessão da conta" theme={profileTheme} danger onPress={sairDaConta} />
      </Section>

      <FloatingCard visible={modal === "dados"} title="Dados profissionais" subtitle="Essas informações aparecem no seu perfil público." theme={profileTheme} onClose={() => setModal(null)}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
          <Field label="Nome profissional" value={dadosForm.nome} onChangeText={(nomeValue) => setDadosForm((prev) => ({ ...prev, nome: nomeValue }))} />
          <Field label="Telefone" value={dadosForm.telefone} onChangeText={(telefone) => setDadosForm((prev) => ({ ...prev, telefone }))} keyboardType="phone-pad" />
          <Field label="Apresentação" value={dadosForm.bio} onChangeText={(bio) => setDadosForm((prev) => ({ ...prev, bio }))} multiline placeholder="Conte sua experiência, tipo de montagem que atende e diferenciais." />
          <Field label="Anos de experiência" value={dadosForm.anosExperiencia} onChangeText={(anosExperiencia) => setDadosForm((prev) => ({ ...prev, anosExperiencia }))} keyboardType="number-pad" />
          {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
          <ModalActions saving={saving} theme={profileTheme} onCancel={() => setModal(null)} onSave={saveDados} />
        </ScrollView>
      </FloatingCard>

      <FloatingCard visible={modal === "especialidades"} title="Especialidades" subtitle="Selecione os tipos de serviço que você atende." theme={profileTheme} onClose={() => setModal(null)}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
          <View style={styles.tagsWrap}>
            {MONTADOR_ESPECIALIDADES.map((item) => {
              const selected = especialidadesForm.includes(item.id);
              return (
                <Pressable
                  key={item.id}
                  onPress={() => toggleEspecialidade(item.id)}
                  style={[
                    styles.tag,
                    selected
                      ? { backgroundColor: profileTheme.primary, borderColor: profileTheme.primary }
                      : { backgroundColor: colors.surface, borderColor: profileTheme.border },
                  ]}
                >
                  <Text style={[styles.tagText, selected ? styles.tagTextActive : { color: colors.textSecondary }]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>
          {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
          <ModalActions saving={saving} theme={profileTheme} onCancel={() => setModal(null)} onSave={saveEspecialidades} />
        </ScrollView>
      </FloatingCard>

      <FloatingCard visible={modal === "area"} title="Área de atendimento" subtitle="Use bairros separados por vírgula." theme={profileTheme} onClose={() => setModal(null)}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
          <Field label="Cidade" value={areaForm.cidade} onChangeText={(cidade) => setAreaForm((prev) => ({ ...prev, cidade }))} />
          <Field label="UF" value={areaForm.estado} onChangeText={(estado) => setAreaForm((prev) => ({ ...prev, estado: estado.toUpperCase().slice(0, 2) }))} />
          <Field label="Bairros atendidos" value={areaForm.bairros} onChangeText={(bairros) => setAreaForm((prev) => ({ ...prev, bairros }))} multiline placeholder="Ex.: Jardim América, Centro, Moema" />
          <Field label="Raio de atendimento em km" value={areaForm.raioAtendimentoKm} onChangeText={(raioAtendimentoKm) => setAreaForm((prev) => ({ ...prev, raioAtendimentoKm }))} keyboardType="number-pad" />
          <View style={styles.switchRow}>
            <View style={styles.switchText}>
              <Text style={styles.switchTitle}>Perfil ativo</Text>
              <Text style={styles.switchSubtitle}>Receber novas solicitações de empregadores</Text>
            </View>
            <Switch value={areaForm.ativo} onValueChange={(ativoValue) => setAreaForm((prev) => ({ ...prev, ativo: ativoValue }))} trackColor={{ false: colors.border, true: profileTheme.primarySoft }} thumbColor={areaForm.ativo ? profileTheme.primary : colors.textMuted} />
          </View>
          {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
          <ModalActions saving={saving} theme={profileTheme} onCancel={() => setModal(null)} onSave={saveArea} />
        </ScrollView>
      </FloatingCard>

      <FloatingCard visible={modal === "precos"} title="Preços" subtitle="Defina uma referência de valor ou deixe a combinar." theme={profileTheme} onClose={() => setModal(null)}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
          <View style={styles.switchRow}>
            <View style={styles.switchText}>
              <Text style={styles.switchTitle}>Valor a combinar</Text>
              <Text style={styles.switchSubtitle}>Use quando o preço depender da avaliação do serviço</Text>
            </View>
            <Switch value={precosForm.valorACombinar} onValueChange={(valorACombinar) => setPrecosForm((prev) => ({ ...prev, valorACombinar }))} trackColor={{ false: colors.border, true: profileTheme.primarySoft }} thumbColor={precosForm.valorACombinar ? profileTheme.primary : colors.textMuted} />
          </View>
          <Field label="Preço base em R$" value={precosForm.precoBase} onChangeText={(precoBase) => setPrecosForm((prev) => ({ ...prev, precoBase }))} keyboardType="decimal-pad" placeholder="Ex.: 120,00" />
          <Field label="Taxa mínima em R$" value={precosForm.taxaMinima} onChangeText={(taxaMinima) => setPrecosForm((prev) => ({ ...prev, taxaMinima }))} keyboardType="decimal-pad" placeholder="Ex.: 80,00" />
          <View style={styles.switchRow}>
            <View style={styles.switchText}>
              <Text style={styles.switchTitle}>Cobra deslocamento</Text>
              <Text style={styles.switchSubtitle}>Informe detalhes na observação de preço</Text>
            </View>
            <Switch value={precosForm.cobraDeslocamento} onValueChange={(cobraDeslocamento) => setPrecosForm((prev) => ({ ...prev, cobraDeslocamento }))} trackColor={{ false: colors.border, true: profileTheme.primarySoft }} thumbColor={precosForm.cobraDeslocamento ? profileTheme.primary : colors.textMuted} />
          </View>
          <Field label="Observação de preço" value={precosForm.observacaoPreco} onChangeText={(observacaoPreco) => setPrecosForm((prev) => ({ ...prev, observacaoPreco }))} multiline placeholder="Ex.: Valor pode variar conforme tamanho do móvel e local." />
          {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
          <ModalActions saving={saving} theme={profileTheme} onCancel={() => setModal(null)} onSave={savePrecos} />
        </ScrollView>
      </FloatingCard>

      <FloatingCard visible={modal === "portfolio"} title="Portfólio e avaliações" subtitle="Uploads avançados entram em uma etapa posterior." theme={profileTheme} onClose={() => setModal(null)}>
        <View style={[styles.emptyCard, { borderColor: profileTheme.border }]}>
          <AppIcon name="Camera" size={24} color={profileTheme.primary} />
          <Text style={styles.emptyTitle}>{perfil.portfolioFotos.length ? "Fotos cadastradas" : "Sem fotos no portfólio"}</Text>
          <Text style={styles.emptyText}>Adicione fotos de montagens, reparos e acabamentos quando o upload estiver disponível.</Text>
          <Pressable onPress={() => Alert.alert("Portfólio", "Upload de fotos será conectado em breve.")} style={[styles.primaryButton, { backgroundColor: profileTheme.primary }]}>
            <Text style={styles.primaryButtonText}>Adicionar foto</Text>
          </Pressable>
        </View>
        <View style={[styles.emptyCard, { borderColor: profileTheme.border }]}>
          <AppIcon name="Star" size={24} color={profileTheme.primary} />
          <Text style={styles.emptyTitle}>Avaliações</Text>
          <Text style={styles.emptyText}>{perfil.avaliacoes?.total ? `${perfil.avaliacoes.total} avaliação(ões) recebida(s).` : "Você ainda não recebeu avaliações."}</Text>
        </View>
      </FloatingCard>

      <FloatingCard visible={modal === "documentos"} title="Documentos e segurança" subtitle="Acompanhe sua verificação e SafeScore." theme={profileTheme} onClose={() => setModal(null)}>
        <View style={[styles.emptyCard, { borderColor: profileTheme.border }]}>
          <AppIcon name="ShieldCheck" size={24} color={profileTheme.primary} />
          <Text style={styles.emptyTitle}>{perfil.verificacaoStatus === "APROVADO" ? "Verificação aprovada" : "Documentos pendentes"}</Text>
          <Text style={styles.emptyText}>Status: {perfil.verificacaoStatus}. O envio de documentos será conectado ao fluxo de verificação.</Text>
          <Text style={styles.emptyText}>SafeScore: {perfil.safeScore?.faixa ?? "Em análise"}</Text>
        </View>
      </FloatingCard>
    </DScreen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: 16,
  },
  header: {
    minHeight: 48,
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
    minHeight: 168,
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
  progressTop: {
    gap: 5,
    marginTop: 3,
  },
  progressLabel: {
    ...typography.caption,
    color: colors.whiteAlpha85,
    fontWeight: "700",
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.whiteAlpha20,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: colors.white,
  },
  ctaCard: {
    flexDirection: "row",
    gap: 10,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 12,
  },
  ctaText: {
    flex: 1,
    gap: 3,
  },
  ctaTitle: {
    ...typography.bodySmMedium,
    fontWeight: "800",
  },
  ctaSub: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  savedCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surface,
  },
  savedText: {
    ...typography.bodySmMedium,
    fontWeight: "700",
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
    maxHeight: "84%",
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
    lineHeight: 23,
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
    gap: 14,
    paddingBottom: 2,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    color: colors.textSecondary,
    ...typography.caption,
    fontWeight: "800",
  },
  input: {
    minHeight: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.textPrimary,
    ...typography.bodySm,
    fontWeight: "600",
  },
  inputMultiline: {
    minHeight: 96,
    textAlignVertical: "top",
  },
  tagsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tag: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  tagText: {
    ...typography.caption,
    fontWeight: "800",
  },
  tagTextActive: {
    color: colors.white,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    padding: 12,
  },
  switchText: {
    flex: 1,
    gap: 3,
  },
  switchTitle: {
    color: colors.textPrimary,
    ...typography.bodySmMedium,
    fontWeight: "800",
  },
  switchSubtitle: {
    color: colors.textSecondary,
    ...typography.caption,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "flex-end",
  },
  secondaryButton: {
    minHeight: 42,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    color: colors.textSecondary,
    ...typography.bodySmMedium,
    fontWeight: "800",
  },
  primaryButton: {
    minHeight: 42,
    borderRadius: radius.pill,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: colors.white,
    ...typography.bodySmMedium,
    fontWeight: "800",
  },
  disabled: {
    opacity: 0.58,
  },
  errorText: {
    color: colors.danger,
    ...typography.caption,
    fontWeight: "700",
  },
  emptyCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 14,
    gap: 8,
    backgroundColor: colors.background,
  },
  emptyTitle: {
    color: colors.textPrimary,
    ...typography.bodySmMedium,
    fontWeight: "800",
  },
  emptyText: {
    color: colors.textSecondary,
    ...typography.caption,
    fontWeight: "500",
  },
});
