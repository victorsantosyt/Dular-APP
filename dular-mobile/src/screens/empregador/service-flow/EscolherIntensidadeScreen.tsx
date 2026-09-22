import React, { useMemo } from "react";
import { SafeAreaView, ScrollView, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { AppIconName } from "@/components/ui";
import type { EmpregadorServiceFlowStackParamList } from "@/navigation/EmpregadorServiceFlowNavigator";
import { ServiceCategory, useServiceFlow } from "./ServiceFlowContext";
import { FlowFooter, FlowPrimaryButton, flowStyles, ServiceOptionCard, StepHeader } from "./components";
import { getServiceFlowTheme } from "@/theme/serviceFlowTheme";

type Navigation = NativeStackNavigationProp<EmpregadorServiceFlowStackParamList, "EscolherIntensidade">;

/** Preços por intensidade da diarista (centavos). Vindos do perfil público. */
export type PrecosIntensidade = { leve: number | null; medio: number | null; pesada: number | null };

export type IntensidadeOpcao = {
  /** ServicoCategoria persistido no serviço (ex.: FAXINA_LEVE). */
  categoriaBackend: string;
  title: string;
  subtitle: string;
  icon: AppIconName;
  /**
   * Valor da opção em REAIS (mesma unidade de `draft.valorSelecionado`).
   * Ausente quando o nicho não tem preço por intensidade (babá, cozinheira,
   * passadeira). Sem isto, escolher aqui trocava o serviço mas não o preço.
   */
  valor?: number;
};

/**
 * Categorias que têm subtipos (intensidade) — só elas exibem este passo.
 * Espelha o `CAT_BY_TIPO` do backend (web/src/app/api/servicos/route.ts).
 */
const CATEGORIAS_COM_INTENSIDADE: ReadonlySet<ServiceCategory> = new Set([
  "diarista",
  "baba",
  "cozinheira",
  "passadeira",
]);

export function categoriaTemIntensidade(categoria: ServiceCategory): boolean {
  return CATEGORIAS_COM_INTENSIDADE.has(categoria);
}

function formatBRL(centavos: number): string {
  return `R$ ${(centavos / 100).toFixed(2).replace(".", ",")}`;
}

/** Monta as opções de intensidade do nicho, anexando preço quando houver. */
export function intensidadeOpcoes(
  categoria: ServiceCategory,
  precos?: PrecosIntensidade,
): IntensidadeOpcao[] {
  if (categoria === "diarista") {
    const linha = (valor: number | null | undefined, base: string) =>
      valor != null && valor > 0 ? `${base} · ${formatBRL(valor)}` : base;
    // `valor` em reais (o campo do perfil vem em centavos).
    const reais = (valor: number | null | undefined) =>
      valor != null && valor > 0 ? valor / 100 : undefined;
    return [
      { categoriaBackend: "FAXINA_LEVE", title: "Limpeza leve", subtitle: linha(precos?.leve, "Manutenção do dia a dia"), icon: "BrushCleaning", valor: reais(precos?.leve) },
      { categoriaBackend: "FAXINA_COMPLETA", title: "Limpeza completa", subtitle: linha(precos?.medio, "Limpeza mais detalhada"), icon: "Sparkles", valor: reais(precos?.medio) },
      { categoriaBackend: "FAXINA_PESADA", title: "Limpeza pesada", subtitle: linha(precos?.pesada, "Pós-obra / faxina pesada"), icon: "Hammer", valor: reais(precos?.pesada) },
    ];
  }
  if (categoria === "baba") {
    return [
      { categoriaBackend: "BABA_DIURNA", title: "Babá diurna", subtitle: "Período do dia", icon: "Baby" },
      { categoriaBackend: "BABA_NOTURNA", title: "Babá noturna", subtitle: "Período da noite", icon: "Clock3" },
      { categoriaBackend: "BABA_INTEGRAL", title: "Babá integral", subtitle: "Dia e noite", icon: "Heart" },
    ];
  }
  if (categoria === "cozinheira") {
    return [
      { categoriaBackend: "COZINHEIRA_DIARIA", title: "Cozinha diária", subtitle: "Refeições do dia a dia", icon: "ChefHat" },
      { categoriaBackend: "COZINHEIRA_EVENTO", title: "Cozinha para evento", subtitle: "Ocasião especial", icon: "Sparkles" },
    ];
  }
  if (categoria === "passadeira") {
    return [
      { categoriaBackend: "PASSA_ROUPA_BASICO", title: "Passar roupa — básico", subtitle: "Volume padrão", icon: "Shirt" },
      { categoriaBackend: "PASSA_ROUPA_COMPLETO", title: "Passar roupa — completo", subtitle: "Volume maior", icon: "Shirt" },
    ];
  }
  return [];
}

export function EscolherIntensidadeScreen() {
  const navigation = useNavigation<Navigation>();
  const { draft, updateDraft } = useServiceFlow();
  const flowTheme = getServiceFlowTheme(draft.tipo);

  const opcoes = useMemo(
    () => intensidadeOpcoes(draft.categoria, draft.precos),
    [draft.categoria, draft.precos],
  );

  const canContinue = Boolean(draft.categoriaBackend);

  return (
    <SafeAreaView style={flowStyles.screen}>
      <ScrollView contentContainerStyle={flowStyles.scrollContent} showsVerticalScrollIndicator={false}>
        <StepHeader
          title="Escolha a intensidade"
          subtitle="Selecione o tipo de serviço que você quer contratar."
          step={2}
          total={6}
          onBack={() => navigation.goBack()}
          theme={flowTheme}
        />
        <View style={s.list}>
          {opcoes.map((op) => (
            <ServiceOptionCard
              key={op.categoriaBackend}
              title={op.title}
              subtitle={op.subtitle}
              icon={op.icon}
              selected={draft.categoriaBackend === op.categoriaBackend}
              theme={flowTheme}
              // Grava o pacote inteiro. Antes só `categoriaBackend` era
              // atualizado: trocar a intensidade aqui mudava o serviço mas
              // deixava rótulo e preço do passo 1, e a tela de confirmação
              // exibia "Limpeza leve · R$ 100,00" para uma faxina pesada.
              onPress={() =>
                updateDraft({
                  categoriaBackend: op.categoriaBackend,
                  intensidadeLabel: op.title,
                  ...(op.valor != null ? { valorSelecionado: op.valor } : {}),
                })
              }
            />
          ))}
        </View>
      </ScrollView>
      <FlowFooter>
        <FlowPrimaryButton
          label="Continuar"
          theme={flowTheme}
          disabled={!canContinue}
          onPress={() => navigation.navigate("EscolherData")}
        />
      </FlowFooter>
    </SafeAreaView>
  );
}

export default EscolherIntensidadeScreen;

const s = StyleSheet.create({
  list: {
    gap: 14,
  },
});
