import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppIcon } from "@/components/ui/AppIcon";
import { DCard } from "@/components/ui/DCard";
import { DInput } from "@/components/ui/DInput";
import type { EmpregadorServiceFlowStackParamList } from "@/navigation/EmpregadorServiceFlowNavigator";
import { colors, radius, shadows, spacing } from "@/theme";
import { useAuth } from "@/stores/authStore";
import { fetchBairrosDaCidade, fetchEnderecos, normalizarBairro, type Endereco } from "@/api/enderecoApi";
import { modoEndereco } from "./enderecoModo";
import { useServiceFlow } from "./ServiceFlowContext";
import { FlowFooter, FlowPrimaryButton, FlowScreen, flowStyles, StepHeader } from "./components";
import { getServiceFlowTheme, type ServiceFlowTheme } from "@/theme/serviceFlowTheme";

const TIPO_LABEL: Record<Endereco["tipo"], string> = {
  RESIDENCIAL: "Residencial",
  EMPRESARIAL: "Empresarial",
};

type Navigation = NativeStackNavigationProp<EmpregadorServiceFlowStackParamList, "EnderecoServico">;

export function EnderecoServicoScreen() {
  const navigation = useNavigation<Navigation>();
  const { draft, updateDraft } = useServiceFlow();
  const flowTheme = getServiceFlowTheme(draft.tipo);
  const user = useAuth((state) => state.user);

  // Endereços cadastrados do empregador (GET /api/me/enderecos): 1 → usa
  // automaticamente; 2+ → o usuário escolhe qual. O endereço selecionado popula
  // o draft, de onde o flow monta o enderecoCompleto. O formulário manual só
  // aparece sem endereço cadastrado: lista vazia ou falha de rede (`loadFailed`).
  // `null` = carregando.
  const [enderecos, setEnderecos] = useState<Endereco[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const aplicarEndereco = useCallback(
    (e: Endereco) => {
      setSelectedId(e.id);
      updateDraft({
        rua: e.rua,
        numero: e.numero,
        complemento: e.complemento ?? "",
        bairro: e.bairro,
        cidade: e.cidade,
        uf: e.uf,
        referencia: e.pontoReferencia ?? "",
      });
    },
    [updateDraft],
  );

  useEffect(() => {
    let alive = true;
    fetchEnderecos()
      .then((list) => {
        if (!alive) return;
        setEnderecos(list);
        // Um único endereço → seleciona e popula automaticamente.
        if (list.length === 1) aplicarEndereco(list[0]);
      })
      .catch(() => {
        if (alive) setLoadFailed(true);
      });
    return () => {
      alive = false;
    };
    // Rodar só uma vez no mount; aplicarEndereco é estável o suficiente aqui.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const modo = modoEndereco(enderecos, loadFailed);
  const carregando = modo === "carregando";
  const usarFormulario = modo === "formulario";

  // Formulário manual: pré-preenche cidade/UF/bairro com a
  // localização salva do Empregador. Só seeda campos vazios.
  const perfilCidade = user?.cidadeAtual ?? user?.cidade ?? "";
  const perfilUf = user?.estadoAtual ?? user?.estado ?? user?.uf ?? "";
  const perfilBairro = user?.bairroAtual ?? "";
  useEffect(() => {
    if (!usarFormulario) return;
    const patch: Record<string, string> = {};
    if (!draft.cidade && perfilCidade) patch.cidade = perfilCidade;
    if (!draft.uf && perfilUf) patch.uf = perfilUf;
    if (!draft.bairro && perfilBairro) patch.bairro = perfilBairro;
    if (Object.keys(patch).length > 0) updateDraft(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usarFormulario, perfilCidade, perfilUf, perfilBairro]);

  // O backend só aceita bairro que exista no catálogo (`Bairro`), com match
  // normalizado. Antes nada checava isso aqui: o empregador seguia por mais
  // três passos e só levava "Bairro não cadastrado." no envio, sem saber quais
  // valem. Carregamos a lista da cidade e validamos neste passo.
  const [bairrosCatalogo, setBairrosCatalogo] = useState<string[] | null>(null);
  /** A consulta ao catálogo falhou (rede) — bloqueia em vez de deixar passar. */
  const [catalogoFalhou, setCatalogoFalhou] = useState(false);
  useEffect(() => {
    const cidade = draft.cidade.trim();
    const uf = draft.uf.trim();
    if (!cidade || !uf) return;
    let alive = true;
    setCatalogoFalhou(false);
    fetchBairrosDaCidade(cidade, uf)
      .then((lista) => {
        if (alive) setBairrosCatalogo(lista);
      })
      .catch(() => {
        // FALHA FECHADA. Antes seguia sem validar — e o backend recusava
        // depois com "Bairro não cadastrado", já no fim do fluxo, sem a
        // pessoa entender o motivo. Não saber se atendemos não é atender.
        if (!alive) return;
        setBairrosCatalogo(null);
        setCatalogoFalhou(true);
      });
    return () => {
      alive = false;
    };
  }, [draft.cidade, draft.uf]);

  const bairroInformado = draft.bairro.trim();
  const bairroReconhecido =
    bairrosCatalogo === null
      ? !catalogoFalhou
      : bairroInformado === "" ||
        bairrosCatalogo.some((n) => normalizarBairro(n) === normalizarBairro(bairroInformado));


  const selecionado = enderecos?.find((e) => e.id === selectedId) ?? null;
  const temLocalizacao = Boolean(draft.cidade.trim() && draft.uf.trim());
  const cidadeUfLabel = temLocalizacao
    ? `${draft.cidade} - ${draft.uf.toUpperCase()}`
    : "Localização não definida";

  const continuar = () => {
    if (carregando) return;
    if (!usarFormulario && !selectedId) {
      Alert.alert("Selecione um endereço", "Escolha em qual endereço o serviço deve acontecer.");
      return;
    }
    if (!temLocalizacao) {
      Alert.alert("Localização necessária", "Defina sua cidade/UF no perfil ou na busca antes de continuar.");
      return;
    }
    if (!draft.rua.trim() || !draft.numero.trim()) {
      Alert.alert("Endereço incompleto", "Informe ao menos a rua e o número do endereço do serviço.");
      return;
    }
    if (!bairroInformado) {
      Alert.alert("Bairro necessário", "Informe o bairro do endereço do serviço.");
      return;
    }
    if (catalogoFalhou) {
      Alert.alert(
        "Não foi possível conferir os bairros",
        "Verifique sua conexão e tente de novo. Sem essa conferência o pedido seria recusado no fim do fluxo.",
      );
      return;
    }
    if (!bairroReconhecido) {
      Alert.alert(
        "Bairro não atendido",
        usarFormulario
          ? `Ainda não atendemos "${bairroInformado}" em ${draft.cidade}. Escolha um dos bairros sugeridos abaixo do campo.`
          : `Ainda não atendemos "${bairroInformado}" em ${draft.cidade}. Escolha outro endereço ou atualize este no seu perfil.`,
      );
      return;
    }
    navigation.navigate("ObservacoesServico");
  };

  return (
    <FlowScreen>
      <ScrollView contentContainerStyle={flowStyles.scrollContent} showsVerticalScrollIndicator={false}>
        <StepHeader
          title="Endereço do serviço"
          subtitle="Confirme onde o atendimento deve acontecer."
          step={4}
          total={6}
          onBack={() => navigation.goBack()}
          theme={flowTheme}
        />

        {carregando ? (
          <DCard style={s.addressCard}>
            <View style={s.centerBox}>
              <ActivityIndicator color={flowTheme.primary} />
            </View>
          </DCard>
        ) : usarFormulario ? (
          <>
            <DCard style={s.addressCard}>
              <View style={s.addressHeader}>
                <View style={[s.addressIcon, { backgroundColor: flowTheme.primarySoft }]}>
                  <AppIcon name="MapPin" size={20} color={flowTheme.primary} />
                </View>
                <View style={s.addressText}>
                  <Text style={s.addressTitle}>{cidadeUfLabel}</Text>
                  <Text style={s.addressSubtitle}>
                    {temLocalizacao
                      ? "Informe o endereço onde o serviço vai acontecer."
                      : "Defina sua localização no perfil ou na busca para continuar."}
                  </Text>
                </View>
              </View>
            </DCard>

            <View style={s.form}>
              <DInput
                placeholder="Rua / logradouro"
                value={draft.rua}
                onChangeText={(rua) => updateDraft({ rua })}
                icon={<AppIcon name="MapPin" size={18} color={colors.textMuted} />}
              />
              <DInput
                placeholder="Número"
                value={draft.numero}
                onChangeText={(numero) => updateDraft({ numero })}
                keyboardType="number-pad"
                icon={<AppIcon name="Home" size={18} color={colors.textMuted} />}
              />
              <DInput
                placeholder="Bairro"
                value={draft.bairro}
                onChangeText={(bairro) => updateDraft({ bairro })}
                icon={<AppIcon name="MapPin" size={18} color={colors.textMuted} />}
              />
              {!bairroReconhecido && bairrosCatalogo ? (
                <View style={s.bairroAviso}>
                  <Text style={s.bairroAvisoTexto}>
                    Ainda não atendemos esse bairro em {draft.cidade}. Toque em um dos disponíveis:
                  </Text>
                  <View style={s.bairroChips}>
                    {bairrosCatalogo.map((nome) => (
                      <Pressable
                        key={nome}
                        onPress={() => updateDraft({ bairro: nome })}
                        style={[s.bairroChip, { borderColor: flowTheme.border }]}
                      >
                        <Text style={s.bairroChipTexto}>{nome}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}
              <DInput
                placeholder="Complemento"
                value={draft.complemento}
                onChangeText={(complemento) => updateDraft({ complemento })}
                icon={<AppIcon name="Plus" size={18} color={colors.textMuted} />}
              />
              <DInput
                placeholder="Ponto de referência"
                value={draft.referencia}
                onChangeText={(referencia) => updateDraft({ referencia })}
                icon={<AppIcon name="Info" size={18} color={colors.textMuted} />}
              />
            </View>

            <MapaIlustrativo theme={flowTheme} rotulo={temLocalizacao ? cidadeUfLabel : null} style={s.mapaAbaixo} />
          </>
        ) : (
          <>
            <MapaIlustrativo
              theme={flowTheme}
              rotulo={selecionado ? `${selecionado.bairro}, ${selecionado.cidade} - ${selecionado.uf.toUpperCase()}` : null}
            />

            <View style={s.selectWrap}>
              <Text style={s.selectTitle}>
                {(enderecos?.length ?? 0) > 1 ? "Escolha um dos seus endereços" : "Seu endereço cadastrado"}
              </Text>
              {enderecos?.map((e) => {
                const ativo = e.id === selectedId;
                return (
                  <Pressable
                    key={e.id}
                    onPress={() => aplicarEndereco(e)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: ativo }}
                    style={[
                      s.selectCard,
                      { borderColor: ativo ? flowTheme.primary : colors.border },
                      ativo && { backgroundColor: flowTheme.primarySoft },
                    ]}
                  >
                    <View style={[s.selectIcon, { backgroundColor: ativo ? colors.white : flowTheme.primarySoft }]}>
                      <AppIcon
                        name={e.tipo === "EMPRESARIAL" ? "BriefcaseBusiness" : "Home"}
                        size={18}
                        color={flowTheme.primary}
                      />
                    </View>
                    <View style={s.selectText}>
                      <Text style={s.selectLabel}>{TIPO_LABEL[e.tipo]}</Text>
                      <Text style={s.selectSub} numberOfLines={2}>
                        {e.rua}, {e.numero}
                        {e.complemento ? ` — ${e.complemento}` : ""}
                      </Text>
                      <Text style={s.selectSub} numberOfLines={1}>
                        {e.bairro}, {e.cidade}/{e.uf}
                      </Text>
                    </View>
                    <View
                      style={[
                        s.selectMark,
                        ativo && { borderColor: flowTheme.primary, backgroundColor: flowTheme.primary },
                      ]}
                    >
                      {ativo ? <AppIcon name="Check" size={14} color={colors.white} strokeWidth={3} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      <FlowFooter>
        <FlowPrimaryButton label="Continuar" theme={flowTheme} onPress={continuar} />
      </FlowFooter>
    </FlowScreen>
  );
}

/** Mapa ilustrativo (não é geolocalização): quadras, ruas e o pino do atendimento. */
function MapaIlustrativo({
  theme,
  rotulo,
  style,
}: {
  theme: ServiceFlowTheme;
  rotulo: string | null;
  style?: ViewStyle;
}) {
  return (
    <View style={[s.mapa, { backgroundColor: theme.primarySoft, borderColor: theme.border }, style]}>
      <View style={[s.quadra, { top: 14, left: 18, width: 92, height: 54 }]} />
      <View style={[s.quadra, { top: 14, left: 126, width: 120, height: 54 }]} />
      <View style={[s.quadra, { top: 14, left: 262, width: 140, height: 54 }]} />
      <View style={[s.quadra, { top: 84, left: 18, width: 132, height: 60 }]} />
      <View style={[s.quadra, { top: 84, left: 262, width: 140, height: 60 }]} />
      <View style={[s.quadra, { top: 160, left: 18, width: 92, height: 60 }]} />
      <View style={[s.quadra, { top: 160, left: 126, width: 276, height: 60 }]} />
      <View style={[s.avenida, { backgroundColor: theme.border }]} />

      <View style={s.pinoArea}>
        <View style={[s.pinoHalo, { backgroundColor: theme.primary }]} />
        <View style={[s.pino, { backgroundColor: theme.primary, shadowColor: theme.primary }]}>
          <AppIcon name="MapPin" size={22} color={colors.white} />
        </View>
      </View>

      {rotulo ? (
        <View style={s.mapaRotulo}>
          <AppIcon name="MapPin" size={14} color={theme.primary} />
          <Text style={s.mapaRotuloTexto} numberOfLines={1}>
            {rotulo}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  centerBox: {
    paddingVertical: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  selectWrap: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  selectTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 2,
  },
  selectCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1.5,
    borderRadius: radius.lg,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  selectIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  selectText: {
    flex: 1,
    gap: 2,
  },
  selectMark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.lavenderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  selectLabel: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "800",
  },
  selectSub: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  addressCard: {
    borderRadius: 24,
  },
  addressHeader: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "flex-start",
  },
  addressIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  addressText: {
    flex: 1,
    gap: 4,
  },
  addressTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: "700",
  },
  addressSubtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: "600",
  },
  addressCep: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
  },
  form: {
    marginTop: spacing.lg,
    gap: 12,
  },
  bairroAviso: {
    gap: 8,
    marginTop: -4,
  },
  bairroAvisoTexto: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  bairroChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  bairroChip: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: colors.surface,
  },
  bairroChipTexto: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "600",
  },
  mapa: {
    height: 196,
    borderRadius: radius.xl,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: spacing.lg,
  },
  mapaAbaixo: {
    marginTop: spacing.lg,
    marginBottom: 0,
  },
  quadra: {
    position: "absolute",
    borderRadius: radius.md,
    backgroundColor: colors.whiteAlpha70,
  },
  avenida: {
    position: "absolute",
    left: -40,
    right: -40,
    top: 104,
    height: 14,
    opacity: 0.8,
    transform: [{ rotate: "-12deg" }],
  },
  pinoArea: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  pinoHalo: {
    position: "absolute",
    width: 104,
    height: 104,
    borderRadius: 52,
    opacity: 0.14,
  },
  pino: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 3,
    borderColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.primaryButton,
  },
  mapaRotulo: {
    position: "absolute",
    left: spacing.md,
    bottom: spacing.md,
    maxWidth: "88%",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    ...shadows.soft,
  },
  mapaRotuloTexto: {
    flexShrink: 1,
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "700",
  },
});
