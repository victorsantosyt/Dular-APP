import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppIcon } from "@/components/ui/AppIcon";
import { DCard } from "@/components/ui/DCard";
import { DInput } from "@/components/ui/DInput";
import type { EmpregadorServiceFlowStackParamList } from "@/navigation/EmpregadorServiceFlowNavigator";
import { colors, radius, shadows, spacing } from "@/theme";
import { useAuth } from "@/stores/authStore";
import { fetchEnderecos, type Endereco } from "@/api/enderecoApi";
import { useServiceFlow } from "./ServiceFlowContext";
import { FlowPrimaryButton, flowStyles, StepHeader } from "./components";
import { getServiceFlowTheme } from "@/theme/serviceFlowTheme";

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

  // FASE 6 — endereços cadastrados do empregador (GET /api/me/enderecos):
  // 0 → bloqueia (precisa cadastrar antes de solicitar); 1 → usa automaticamente;
  // 2 → o usuário escolhe qual. O endereço selecionado popula o draft, de onde o
  // flow monta o enderecoCompleto. `null` = carregando; `loadFailed` cai no
  // preenchimento manual (legado) para não travar o fluxo em falha de rede.
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

  // Fallback legado (só quando o GET falhou): pré-preenche cidade/UF/bairro com a
  // localização salva do Empregador. Só seeda campos vazios.
  const perfilCidade = user?.cidadeAtual ?? user?.cidade ?? "";
  const perfilUf = user?.estadoAtual ?? user?.estado ?? user?.uf ?? "";
  const perfilBairro = user?.bairroAtual ?? "";
  useEffect(() => {
    if (!loadFailed) return;
    const patch: Record<string, string> = {};
    if (!draft.cidade && perfilCidade) patch.cidade = perfilCidade;
    if (!draft.uf && perfilUf) patch.uf = perfilUf;
    if (!draft.bairro && perfilBairro) patch.bairro = perfilBairro;
    if (Object.keys(patch).length > 0) updateDraft(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadFailed, perfilCidade, perfilUf, perfilBairro]);

  const carregando = enderecos === null && !loadFailed;
  const bloqueado = enderecos !== null && enderecos.length === 0 && !loadFailed;
  const precisaSelecionar = (enderecos?.length ?? 0) >= 2;

  const temLocalizacao = Boolean(draft.cidade.trim() && draft.uf.trim());
  const cidadeUfLabel = temLocalizacao
    ? `${draft.cidade} - ${draft.uf.toUpperCase()}`
    : "Localização não definida";

  const continuar = () => {
    if (bloqueado) {
      Alert.alert("Endereço necessário", "Cadastre seu endereço antes de solicitar um serviço.");
      return;
    }
    if (precisaSelecionar && !selectedId) {
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
    navigation.navigate("ObservacoesServico");
  };

  return (
    <SafeAreaView style={flowStyles.screen}>
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
        ) : bloqueado ? (
          <DCard style={s.addressCard}>
            <View style={s.addressHeader}>
              <View style={[s.addressIcon, { backgroundColor: flowTheme.primarySoft }]}>
                <AppIcon name="MapPin" size={20} color={flowTheme.primary} />
              </View>
              <View style={s.addressText}>
                <Text style={s.addressTitle}>Cadastre seu endereço</Text>
                <Text style={s.addressSubtitle}>
                  Cadastre seu endereço antes de solicitar um serviço. Você pode fazer isso no seu perfil.
                </Text>
              </View>
            </View>
          </DCard>
        ) : (
          <>
            {precisaSelecionar && enderecos ? (
              <View style={s.selectWrap}>
                <Text style={s.selectTitle}>Escolha o endereço do serviço</Text>
                {enderecos.map((e) => {
                  const ativo = e.id === selectedId;
                  return (
                    <Pressable
                      key={e.id}
                      onPress={() => aplicarEndereco(e)}
                      style={[
                        s.selectCard,
                        { borderColor: ativo ? flowTheme.primary : colors.border },
                        ativo && { backgroundColor: flowTheme.primarySoft },
                      ]}
                    >
                      <View style={[s.selectIcon, { backgroundColor: flowTheme.primarySoft }]}>
                        <AppIcon
                          name={e.tipo === "EMPRESARIAL" ? "BriefcaseBusiness" : "Home"}
                          size={18}
                          color={flowTheme.primary}
                        />
                      </View>
                      <View style={s.selectText}>
                        <Text style={s.selectLabel}>{TIPO_LABEL[e.tipo]}</Text>
                        <Text style={s.selectSub} numberOfLines={1}>
                          {e.rua}, {e.numero} — {e.bairro}, {e.cidade}/{e.uf}
                        </Text>
                      </View>
                      {ativo ? <AppIcon name="CheckCircle" size={20} color={flowTheme.primary} /> : null}
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            <DCard style={s.addressCard}>
              <View style={s.addressHeader}>
                <View style={[s.addressIcon, { backgroundColor: flowTheme.primarySoft }]}>
                  <AppIcon name="MapPin" size={20} color={flowTheme.primary} />
                </View>
                <View style={s.addressText}>
                  <Text style={s.addressTitle}>{cidadeUfLabel}</Text>
                  <Text style={s.addressSubtitle}>
                    {temLocalizacao
                      ? "Cidade/UF do endereço selecionado. Confirme os dados abaixo."
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

        <DCard style={s.mapCard}>
          <View style={[s.mapGrid, { backgroundColor: flowTheme.primarySoft }]}>
            <View style={s.mapLineA} />
            <View style={s.mapLineB} />
            <View style={s.mapLineC} />
            <View style={[s.mapPin, { backgroundColor: flowTheme.primary, shadowColor: flowTheme.primary }]}>
              <AppIcon name="MapPin" size={22} color={colors.white} />
            </View>
          </View>
          <View style={s.mapLegend}>
            <Text style={s.mapTitle}>Area do atendimento</Text>
            <Text style={s.mapSubtitle}>Mapa ilustrativo para revisão visual do endereço.</Text>
          </View>
        </DCard>
          </>
        )}

      </ScrollView>

      <SafeAreaView style={flowStyles.footer}>
        <FlowPrimaryButton label="Continuar" theme={flowTheme} onPress={continuar} />
      </SafeAreaView>
    </SafeAreaView>
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
  mapCard: {
    marginTop: spacing.lg,
    padding: 0,
    overflow: "hidden",
    borderRadius: 24,
  },
  mapGrid: {
    height: 168,
    overflow: "hidden",
  },
  mapLineA: {
    position: "absolute",
    left: -30,
    top: 38,
    width: 260,
    height: 28,
    borderRadius: 16,
    backgroundColor: colors.white,
    transform: [{ rotate: "-18deg" }],
  },
  mapLineB: {
    position: "absolute",
    right: -20,
    top: 92,
    width: 240,
    height: 24,
    borderRadius: 16,
    backgroundColor: colors.lavenderStrong,
    transform: [{ rotate: "16deg" }],
  },
  mapLineC: {
    position: "absolute",
    left: 60,
    bottom: 22,
    width: 220,
    height: 18,
    borderRadius: 12,
    backgroundColor: colors.whiteAlpha80,
  },
  mapPin: {
    position: "absolute",
    top: 54,
    alignSelf: "center",
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.primaryButton,
  },
  mapLegend: {
    padding: spacing.md,
    gap: 4,
    backgroundColor: colors.surface,
  },
  mapTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
  },
  mapSubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
});
