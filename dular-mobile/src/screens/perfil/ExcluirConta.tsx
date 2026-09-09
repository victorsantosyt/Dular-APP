/**
 * Exclusão de conta (LGPD art. 18 · exigência das lojas).
 *
 * A App Store e o Google Play recusam app com cadastro que não ofereça
 * exclusão DENTRO do app. O backend já fazia isso (`DELETE /api/me`); faltava
 * a porta.
 *
 * O texto desta tela descreve o que o backend REALMENTE faz — não uma versão
 * simpática. "Excluir" aqui não é apagar tudo: serviços, avaliações e
 * registros de segurança continuam, desvinculados da pessoa, porque
 * pertencem também a quem estava do outro lado. Prometer apagamento total
 * seria mentir para quem toca no botão.
 */
import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";

import { Screen } from "@/components/Screen";
import { AppIcon, BackCircleButton } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/stores/authStore";
import { useDularColors } from "@/hooks/useDularColors";
import { useGenderTheme } from "@/hooks/useProfileTheme";
import { radius, typography } from "@/theme";

/** O backend só aceita a exclusão com esta frase exata no corpo. */
const CONFIRMACAO = "EXCLUIR MINHA CONTA";

/** Onde cancelar, por origem da assinatura. */
const ONDE_CANCELAR: Record<string, string> = {
  STRIPE: "Cancele a assinatura no próprio app, em Planos, e tente de novo.",
  // Nem a Apple nem o Google permitem que o servidor cancele por você — só o
  // dono do aparelho cancela. Mandar "fale com o suporte" aqui seria empurrar
  // a pessoa para um caminho que não resolve.
  APPLE:
    "Sua assinatura foi comprada pela App Store. Cancele em Ajustes > seu nome > Assinaturas e tente de novo.",
  GOOGLE:
    "Sua assinatura foi comprada pelo Google Play. Cancele em Play Store > Pagamentos e assinaturas e tente de novo.",
  MANUAL: "Sua assinatura foi concedida manualmente. Fale com o suporte para encerrá-la.",
};

const APAGADO = [
  "Endereços cadastrados",
  "Dados de recebimento (chave PIX)",
  "Contas Google e Apple vinculadas",
  "Notificações",
  "Documentos de identidade enviados",
  "Favoritos",
];

const ANONIMIZADO = [
  "Nome, telefone, CPF e e-mail",
  "Data de nascimento e gênero",
  "Foto de perfil",
];

export function ExcluirConta() {
  const navigation = useNavigation<{ goBack: () => void }>();
  const colors = useDularColors();
  const tema = useGenderTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const clearSession = useAuth((st) => st.clearSession);

  const [frase, setFrase] = useState("");
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const podeExcluir = frase.trim().toUpperCase() === CONFIRMACAO && !excluindo;

  const excluir = async () => {
    setExcluindo(true);
    setErro(null);
    try {
      await api.delete("/api/me", { data: { confirmacao: CONFIRMACAO } });

      // Sucesso: a sessão não vale mais nada do lado do servidor. Limpar aqui
      // devolve a pessoa ao fluxo de entrada.
      await clearSession();
      Alert.alert("Conta excluída", "Seus dados pessoais foram apagados.");
    } catch (e) {
      const resposta = (e as { response?: { status?: number; data?: Record<string, unknown> } })
        ?.response;
      const dados = resposta?.data ?? {};
      const codigo = String(dados.error ?? "");

      if (codigo === "SUBSCRIPTION_ACTIVE") {
        const provider = String(
          (dados.assinatura as { provider?: string } | undefined)?.provider ?? "",
        ).toUpperCase();
        setErro(
          ONDE_CANCELAR[provider] ??
            "Você tem uma assinatura ativa. Cancele-a antes de excluir a conta.",
        );
      } else if (codigo === "SERVICOS_EM_ABERTO") {
        const n = Number(dados.servicosEmAberto ?? 0);
        setErro(
          n > 1
            ? `Você tem ${n} serviços em andamento. Conclua ou cancele antes de excluir a conta.`
            : "Você tem um serviço em andamento. Conclua ou cancele antes de excluir a conta.",
        );
      } else {
        setErro("Não foi possível excluir a conta agora. Tente novamente em instantes.");
      }
    } finally {
      setExcluindo(false);
    }
  };

  const confirmar = () => {
    Alert.alert(
      "Excluir conta?",
      "Esta ação não pode ser desfeita.",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Excluir conta", style: "destructive", onPress: () => void excluir() },
      ],
      { cancelable: true },
    );
  };

  return (
    <Screen scroll>
      <View style={s.header}>
        <BackCircleButton
          onPress={() => navigation.goBack()}
          color={tema.icon}
          borderColor={tema.border}
        />
        <Text style={[s.titulo, { color: tema.textAccent }]} numberOfLines={1}>
          Excluir conta
        </Text>
        <View style={s.espacador} />
      </View>

      <View style={s.avisoTopo}>
        <AppIcon name="AlertTriangle" size={18} color={colors.danger} strokeWidth={2.3} />
        <Text style={s.avisoTopoTexto}>
          A exclusão é definitiva. Não é possível recuperar a conta depois.
        </Text>
      </View>

      <Bloco titulo="O que é apagado" itens={APAGADO} s={s} />
      <Bloco titulo="O que é anonimizado" itens={ANONIMIZADO} s={s} />

      <View style={s.cartao}>
        <Text style={s.cartaoTitulo}>O que permanece</Text>
        <Text style={s.paragrafo}>
          O histórico de serviços, as avaliações e os registros de segurança continuam
          guardados, sem vínculo com você. Eles também pertencem a quem contratou ou foi
          contratado, e apagá-los deixaria o histórico dessas pessoas incompleto.
        </Text>
        <Text style={s.paragrafo}>
          As mensagens de chat continuam pelo mesmo motivo, com o remetente anonimizado.
        </Text>
      </View>

      <View style={s.cartao}>
        <Text style={s.cartaoTitulo}>Para confirmar, digite a frase abaixo</Text>
        <Text style={s.fraseModelo}>{CONFIRMACAO}</Text>
        <TextInput
          value={frase}
          onChangeText={(t) => {
            setFrase(t);
            if (erro) setErro(null);
          }}
          placeholder={CONFIRMACAO}
          placeholderTextColor={colors.textMuted}
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!excluindo}
          style={s.campo}
          accessibilityLabel="Frase de confirmação"
        />
      </View>

      {erro ? (
        <View style={s.erro}>
          <AppIcon name="AlertTriangle" size={16} color={colors.danger} strokeWidth={2.3} />
          <Text style={s.erroTexto}>{erro}</Text>
        </View>
      ) : null}

      <Pressable
        onPress={confirmar}
        disabled={!podeExcluir}
        accessibilityRole="button"
        accessibilityLabel="Excluir minha conta"
        style={({ pressed }) => [
          s.botao,
          !podeExcluir && s.botaoInativo,
          pressed && podeExcluir && s.botaoPressionado,
        ]}
      >
        {excluindo ? (
          <ActivityIndicator size="small" color={colors.white} />
        ) : (
          <Text style={s.botaoTexto}>Excluir minha conta</Text>
        )}
      </Pressable>

      <Text style={s.rodape}>
        Em dúvida? Fale com o suporte antes — depois de excluir, não há como voltar atrás.
      </Text>
    </Screen>
  );
}

function Bloco({
  titulo,
  itens,
  s,
}: {
  titulo: string;
  itens: string[];
  s: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={s.cartao}>
      <Text style={s.cartaoTitulo}>{titulo}</Text>
      {itens.map((item) => (
        <View key={item} style={s.linhaItem}>
          <View style={s.marcador} />
          <Text style={s.item}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

export default ExcluirConta;

function makeStyles(colors: ReturnType<typeof useDularColors>) {
  return StyleSheet.create({
    header: { minHeight: 52, flexDirection: "row", alignItems: "center" },
    espacador: { width: 42, height: 42 },
    titulo: { ...typography.h2, flex: 1, fontWeight: "700", textAlign: "center" },

    avisoTopo: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      padding: 12,
      borderRadius: radius.lg,
      backgroundColor: colors.dangerSoft,
      marginBottom: 4,
    },
    avisoTopoTexto: { ...typography.bodySm, color: colors.danger, flex: 1, fontWeight: "600" },

    cartao: {
      gap: 8,
      padding: 14,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cartaoTitulo: {
      ...typography.caption,
      fontWeight: "800",
      letterSpacing: 0.6,
      textTransform: "uppercase",
      color: colors.textSecondary,
    },
    paragrafo: { ...typography.bodySm, color: colors.textPrimary, lineHeight: 20 },

    linhaItem: { flexDirection: "row", alignItems: "center", gap: 8 },
    marcador: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.textMuted },
    item: { ...typography.bodySm, color: colors.textPrimary, flex: 1 },

    fraseModelo: {
      ...typography.bodySmMedium,
      fontWeight: "800",
      color: colors.textPrimary,
      letterSpacing: 0.5,
    },
    campo: {
      minHeight: 46,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      paddingHorizontal: 12,
      color: colors.textPrimary,
      ...typography.bodySm,
    },

    erro: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      padding: 12,
      borderRadius: radius.lg,
      backgroundColor: colors.dangerSoft,
    },
    erroTexto: { ...typography.bodySm, color: colors.danger, flex: 1, fontWeight: "600" },

    botao: {
      minHeight: 50,
      borderRadius: radius.lg,
      backgroundColor: colors.danger,
      alignItems: "center",
      justifyContent: "center",
    },
    botaoInativo: { opacity: 0.4 },
    botaoPressionado: { opacity: 0.85 },
    botaoTexto: { ...typography.button, color: colors.white },

    rodape: {
      ...typography.caption,
      color: colors.textMuted,
      textAlign: "center",
    },
  });
}
