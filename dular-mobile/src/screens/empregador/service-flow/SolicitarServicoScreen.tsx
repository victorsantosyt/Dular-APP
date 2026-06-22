import React, { useMemo } from "react";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { EmpregadorTabParamList } from "@/navigation/EmpregadorNavigator";
import type { EmpregadorServiceFlowStackParamList } from "@/navigation/EmpregadorServiceFlowNavigator";
import { goToTab } from "@/navigation/navHelpers";
import { ServiceCategory, useServiceFlow, type PrecoInfo } from "./ServiceFlowContext";
import { FlowPrimaryButton, flowStyles, ServiceOptionCard, StepHeader } from "./components";
import { MONTADOR_ESPECIALIDADES } from "./montadorEspecialidades";
import { getServiceFlowTheme } from "@/theme/serviceFlowTheme";
import { CATEGORIAS, CATEGORIAS_DIARISTA } from "@/constants/categorias";
import { colors, radius, spacing, typography } from "@/theme";

type Navigation = NativeStackNavigationProp<EmpregadorServiceFlowStackParamList, "EscolherServico">;

// `categoriaBackend` = subtipo ServicoCategoria persistido no serviço (para a
// profissional ver "Limpeza leve/completa/pesada" e o backend calcular o preço:
// FAXINA_LEVE→precoLeve, FAXINA_COMPLETA→precoMedio, FAXINA_PESADA→precoPesada).
type OpcaoValor = { id: string; label: string; valor: number; categoriaBackend?: string };

function formatBRL(valor: number): string {
  return `R$ ${valor.toFixed(2).replace(".", ",")}`;
}

/** Opções de valor por intensidade para a categoria escolhida, a partir dos
 *  preços reais do profissional. Vazio = sem tabela (valor a combinar). */
function opcoesDeValor(categoria: ServiceCategory, p?: PrecoInfo): OpcaoValor[] {
  if (!p || p.valorACombinar) return [];
  if (categoria === "diarista") {
    const opcoes: Array<OpcaoValor | null> = [
      p.leve != null
        ? { id: "FAXINA_LEVE", label: "Limpeza leve", valor: p.leve / 100, categoriaBackend: "FAXINA_LEVE" }
        : null,
      p.medio != null
        ? { id: "FAXINA_COMPLETA", label: "Limpeza completa", valor: p.medio / 100, categoriaBackend: "FAXINA_COMPLETA" }
        : null,
      p.pesada != null
        ? { id: "FAXINA_PESADA", label: "Limpeza pesada", valor: p.pesada / 100, categoriaBackend: "FAXINA_PESADA" }
        : null,
    ];
    return opcoes.filter((o): o is OpcaoValor => o !== null);
  }
  if (categoria === "baba") {
    return p.babaHora != null ? [{ id: "hora", label: "Por hora", valor: p.babaHora }] : [];
  }
  if (categoria === "cozinheira") {
    return p.cozinheiraBase != null ? [{ id: "base", label: "Valor base", valor: p.cozinheiraBase }] : [];
  }
  return [];
}

export function SolicitarServicoScreen() {
  const navigation = useNavigation<Navigation>();
  const { draft, updateDraft, resetDraft } = useServiceFlow();
  const flowTheme = getServiceFlowTheme(draft.tipo);
  const isMontador = draft.tipo === "MONTADOR";
  const missingMontador = isMontador && !draft.profissionalId;
  const hasSelectedProfessional = Boolean(draft.profissionalId);
  const opcoesValor = useMemo(
    () => opcoesDeValor(draft.categoria, draft.precoInfo),
    [draft.categoria, draft.precoInfo],
  );
  const precisaValor = hasSelectedProfessional && !isMontador && opcoesValor.length > 0;
  const canContinue = isMontador
    ? Boolean(draft.especialidadeId)
    : Boolean(draft.profissionalId) && (!precisaValor || draft.valorSelecionado != null);

  // Catálogo de categorias do passo. Com uma profissional já selecionada,
  // mostramos SÓ o que ela oferece (servicosOferecidos). Sem profissional
  // (navegação livre pela tab central), mostramos o catálogo completo.
  const categoriaOptions = useMemo(() => {
    if (hasSelectedProfessional && draft.tipo === "DIARISTA") {
      const oferecidos = new Set(draft.servicosOferecidosProf ?? []);
      const filtradas = CATEGORIAS_DIARISTA.filter((c) => c.oferta && oferecidos.has(c.oferta));
      return filtradas.length > 0 ? filtradas : CATEGORIAS_DIARISTA;
    }
    return CATEGORIAS;
  }, [hasSelectedProfessional, draft.tipo, draft.servicosOferecidosProf]);

  const leaveFlow = () => {
    const parent = navigation.getParent<BottomTabNavigationProp<EmpregadorTabParamList>>();
    if (parent) {
      goToTab(parent, "EmpregadorTabs", "Home");
      return;
    }
    if (navigation.canGoBack()) navigation.goBack();
  };

  const goToMontadores = () => {
    resetDraft();
    const parent = navigation.getParent<BottomTabNavigationProp<EmpregadorTabParamList>>();
    if (parent) {
      goToTab(parent, "EmpregadorTabs", "Buscar", { categoriaInicial: "montador" });
      return;
    }
    if (navigation.canGoBack()) navigation.goBack();
  };

  const goToBuscarCategoria = (categoria: ServiceCategory) => {
    resetDraft();
    const parent = navigation.getParent<BottomTabNavigationProp<EmpregadorTabParamList>>();
    if (parent) {
      goToTab(parent, "EmpregadorTabs", "Buscar", { categoriaInicial: categoria });
      return;
    }
    if (navigation.canGoBack()) navigation.goBack();
  };

  const selectGeneralService = (service: ServiceCategory) => {
    if (service === "montador") {
      goToMontadores();
      return;
    }

    if (!draft.profissionalId) {
      goToBuscarCategoria(service);
      return;
    }

    const sameProfessionalCategory = draft.tipo === "DIARISTA" && draft.categoria === service;
    updateDraft({
      categoria: service,
      tipo: "DIARISTA",
      tipoProfissional: "DIARISTA",
      ...(sameProfessionalCategory ? {} : { profissionalId: undefined, profissionalNome: undefined }),
      especialidadeId: undefined,
      especialidadeLabel: undefined,
      categoriaBackend: undefined,
      // troca de categoria → zera o valor escolhido (é por categoria).
      valorSelecionado: undefined,
      intensidadeLabel: undefined,
    });
  };

  if (missingMontador) {
    return (
      <SafeAreaView style={flowStyles.screen}>
        <ScrollView contentContainerStyle={flowStyles.scrollContent} showsVerticalScrollIndicator={false}>
          <StepHeader
            title="Escolha um montador"
            subtitle="Selecione um profissional antes de solicitar o serviço."
            step={1}
            total={5}
            onBack={goToMontadores}
            theme={flowTheme}
          />

          <View style={[s.blockCard, { borderColor: flowTheme.border, backgroundColor: flowTheme.surface }]}>
            <View style={[s.blockIcon, { backgroundColor: flowTheme.primarySoft }]}>
              <Text style={[s.blockIconText, { color: flowTheme.textAccent }]}>!</Text>
            </View>
            <Text style={s.blockTitle}>Selecione um montador antes de solicitar o serviço.</Text>
            <Text style={s.blockText}>
              O fluxo de montagem precisa começar no perfil público do profissional para que a solicitação seja enviada ao montador correto.
            </Text>
          </View>
        </ScrollView>

        <SafeAreaView style={flowStyles.footer}>
          <FlowPrimaryButton
            label="Escolher montador"
            theme={flowTheme}
            onPress={goToMontadores}
          />
        </SafeAreaView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={flowStyles.screen}>
      <ScrollView contentContainerStyle={flowStyles.scrollContent} showsVerticalScrollIndicator={false}>
        <StepHeader
          title={isMontador ? "Escolha a especialidade" : "Escolha o serviço"}
          subtitle={isMontador ? "Selecione o tipo de trabalho para o montador." : "Selecione o tipo de ajuda que você precisa agora."}
          step={1}
          total={5}
          onBack={leaveFlow}
          theme={flowTheme}
        />
        <ScrollView contentContainerStyle={s.list} scrollEnabled={false}>
          {isMontador
            ? MONTADOR_ESPECIALIDADES.map((especialidade) => (
                <ServiceOptionCard
                  key={especialidade.id}
                  title={especialidade.label}
                  subtitle="Serviço técnico residencial"
                  icon={especialidade.icon}
                  selected={draft.especialidadeId === especialidade.id}
                  theme={flowTheme}
                  onPress={() =>
                    updateDraft({
                      categoria: "montador",
                      tipo: "MONTADOR",
                      tipoProfissional: "MONTADOR",
                      especialidadeId: especialidade.id,
                      especialidadeLabel: especialidade.label,
                      categoriaBackend: especialidade.categoriaBackend,
                    })
                  }
                />
              ))
            : categoriaOptions.map((cat) => (
                <ServiceOptionCard
                  key={cat.key}
                  title={cat.label}
                  subtitle={cat.subtitle}
                  icon={cat.icon}
                  selected={hasSelectedProfessional && draft.categoria === cat.key}
                  theme={flowTheme}
                  onPress={() => selectGeneralService(cat.key as ServiceCategory)}
                />
              ))}
        </ScrollView>

        {/* Tabela de valores por intensidade — só com profissional escolhido e
            categoria definida. Vazio = "a combinar" (sem tabela). */}
        {hasSelectedProfessional && !isMontador && draft.categoria ? (
          <View style={s.valoresWrap}>
            <Text style={s.valoresTitle}>Valor do serviço</Text>
            {opcoesValor.length > 0 ? (
              opcoesValor.map((op) => {
                const sel = draft.intensidadeLabel === op.label;
                return (
                  <Pressable
                    key={op.id}
                    onPress={() =>
                      updateDraft({
                        valorSelecionado: op.valor,
                        intensidadeLabel: op.label,
                        categoriaBackend: op.categoriaBackend,
                      })
                    }
                    style={[
                      s.valorCard,
                      { borderColor: sel ? flowTheme.primary : flowTheme.border },
                      sel && { backgroundColor: flowTheme.primarySoft },
                    ]}
                  >
                    <Text style={s.valorLabel}>{op.label}</Text>
                    <Text style={[s.valorValue, { color: flowTheme.primary }]}>{formatBRL(op.valor)}</Text>
                  </Pressable>
                );
              })
            ) : (
              <View style={[s.valorInfo, { borderColor: flowTheme.border }]}>
                <Text style={s.valorInfoText}>
                  Valor a combinar diretamente com o(a) profissional.
                </Text>
              </View>
            )}
          </View>
        ) : null}
      </ScrollView>
      <SafeAreaView style={flowStyles.footer}>
        <FlowPrimaryButton
          label="Continuar"
          theme={flowTheme}
          disabled={!canContinue}
          onPress={() => navigation.navigate("EscolherData")}
        />
      </SafeAreaView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  list: {
    gap: 14,
  },
  valoresWrap: {
    marginTop: 18,
    gap: 10,
  },
  valoresTitle: {
    color: colors.textPrimary,
    ...typography.bodyMedium,
    fontWeight: "800",
  },
  valorCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1.5,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    backgroundColor: colors.surface,
  },
  valorLabel: {
    color: colors.textPrimary,
    ...typography.bodySmMedium,
    fontWeight: "700",
  },
  valorValue: {
    ...typography.bodyMedium,
    fontWeight: "800",
  },
  valorInfo: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  valorInfoText: {
    color: colors.textSecondary,
    ...typography.bodySm,
    fontWeight: "600",
  },
  blockCard: {
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: 10,
  },
  blockIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  blockIconText: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "800",
  },
  blockTitle: {
    color: colors.textPrimary,
    ...typography.bodyMedium,
    fontWeight: "700",
  },
  blockText: {
    color: colors.textSecondary,
    ...typography.bodySm,
    fontWeight: "500",
  },
});
