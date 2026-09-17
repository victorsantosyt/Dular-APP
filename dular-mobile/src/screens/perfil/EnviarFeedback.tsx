/**
 * EnviarFeedback — o que a pessoa acha do APP.
 *
 * Canal distinto dos dois que já existem, e é bom que continue assim:
 *   - `AvaliacaoModal` avalia QUEM prestou o serviço, e fica preso a um serviço.
 *   - "Reportar incidente" é denúncia formal de conduta, com fluxo de apuração.
 *   - Aqui é sugestão, problema ou elogio sobre o produto.
 *
 * Por que é um botão, ao contrário do pedido de nota na loja: aqui é a pessoa
 * que decide falar. O pedido de avaliação da loja é o oposto — ele interrompe,
 * então só pode aparecer em momento de sucesso comprovado e nunca como botão.
 */
import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import Constants from "expo-constants";

import { Screen } from "@/components/Screen";
import { BackCircleButton } from "@/components/ui";
import { DButton } from "@/components/DButton";
import { api } from "@/lib/api";
import { useProfileTheme } from "@/hooks/useProfileTheme";
import { colors, radius, spacing, typography } from "@/theme/tokens";

const TIPOS = [
  { id: "SUGESTAO", label: "Sugestão" },
  { id: "PROBLEMA", label: "Problema" },
  { id: "ELOGIO", label: "Elogio" },
] as const;

type TipoId = (typeof TIPOS)[number]["id"];

const MIN_CARACTERES = 5;
const MAX_CARACTERES = 1000;

export default function EnviarFeedback() {
  const navigation = useNavigation<any>();
  const theme = useProfileTheme();

  const [tipo, setTipo] = useState<TipoId>("SUGESTAO");
  const [nota, setNota] = useState(0);
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);

  const podeEnviar = mensagem.trim().length >= MIN_CARACTERES && !enviando;

  const enviar = async () => {
    if (!podeEnviar) return;
    setEnviando(true);
    try {
      await api.post("/api/feedback", {
        tipo,
        mensagem: mensagem.trim(),
        // Nota é opcional de propósito: quem só quer escrever não deveria ser
        // obrigado a resumir a opinião numa estrela.
        ...(nota > 0 ? { nota } : {}),
        origem: "perfil",
        // Sem versão e plataforma, "não consigo pagar" chega sem dizer em que
        // build nem em que sistema aconteceu.
        appVersao: Constants.expoConfig?.version ?? undefined,
        plataforma: Platform.OS,
      });

      Alert.alert(
        "Recebemos, obrigado!",
        "Sua mensagem chegou para o time do Dular. Nem toda sugestão vira mudança, mas todas são lidas.",
        [{ text: "Fechar", onPress: () => navigation.goBack() }],
      );
    } catch (e: any) {
      const doBackend = e?.response?.data?.error;
      Alert.alert(
        "Não foi possível enviar",
        typeof doBackend === "string" && doBackend.length > 0
          ? doBackend
          : "Tente novamente em instantes.",
      );
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Screen>
      <View style={s.header}>
        <BackCircleButton onPress={() => navigation.goBack()} />
        <Text style={s.titulo}>Enviar feedback</Text>
        <View style={s.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={s.conteudo}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={s.intro}>
            Conte o que você achou do aplicativo. Para falar de um serviço ou de
            alguém, use a avaliação do próprio serviço.
          </Text>

          <Text style={s.rotulo}>O que você quer dizer?</Text>
          <View style={s.tiposRow}>
            {TIPOS.map((t) => {
              const ativo = tipo === t.id;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => setTipo(t.id)}
                  style={[
                    s.tipoChip,
                    ativo && { borderColor: theme.primary, backgroundColor: theme.primarySoft },
                  ]}
                >
                  <Text style={[s.tipoTexto, ativo && { color: theme.primary, fontWeight: "700" }]}>
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={s.rotulo}>Nota para o app (opcional)</Text>
          <View style={s.estrelas}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => setNota(nota === n ? 0 : n)} hitSlop={8}>
                <Text style={[s.estrela, nota >= n && { color: colors.warning }]}>
                  {nota >= n ? "★" : "☆"}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={s.rotulo}>Sua mensagem</Text>
          <TextInput
            value={mensagem}
            onChangeText={(t) => setMensagem(t.slice(0, MAX_CARACTERES))}
            placeholder="O que funcionou bem, o que atrapalhou, o que faltou…"
            placeholderTextColor={colors.textMuted}
            multiline
            style={s.input}
          />
          <Text style={s.contador}>
            {mensagem.length}/{MAX_CARACTERES}
          </Text>

          {/* Este DButton (`@/components/DButton`, o mesmo do Suporte) recebe
              `title`. O de `@/components/ui/DButton`, usado pelo AvaliacaoModal,
              recebe `label` — são dois componentes com o mesmo nome e APIs
              diferentes, e misturá-los não compila. */}
          <DButton
            title="Enviar"
            onPress={enviar}
            loading={enviando}
            disabled={!podeEnviar}
            tint={theme.primary}
          />

          <Text style={s.aviso}>
            Sua mensagem vai com a versão do app e o sistema do aparelho, para o
            time conseguir reproduzir o problema. Nada além disso.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  titulo: { ...typography.h3, color: colors.textPrimary },
  // Mesma largura do botão de voltar, para o título ficar centrado de verdade.
  headerSpacer: { width: 40 },
  conteudo: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  intro: {
    ...typography.bodySm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  rotulo: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: "700",
    marginTop: spacing.sm,
  },
  tiposRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  tipoChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tipoTexto: { ...typography.bodySm, color: colors.textSecondary },
  estrelas: { flexDirection: "row", gap: 6 },
  estrela: { fontSize: 30, color: colors.textMuted },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    minHeight: 140,
    color: colors.textPrimary,
    ...typography.body,
    textAlignVertical: "top",
    backgroundColor: colors.surface,
  },
  contador: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: "right",
    marginBottom: spacing.sm,
  },
  aviso: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: spacing.md,
    lineHeight: 17,
  },
});
