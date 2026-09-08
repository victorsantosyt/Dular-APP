/**
 * DadosPessoaisGateScreen — gate pós-login de CPF e data de nascimento.
 *
 * Mesmo padrão do GeneroGateScreen: renderizado pelo RootNavigator quando a
 * conta já está autenticada mas ainda não tem esses dados. Grava no backend
 * (fonte de verdade) e atualiza o authStore — o RootNavigator então segue para
 * o próximo gate.
 *
 * Por que existe: CPF e data de nascimento contam na barra de completude do
 * perfil, mas nenhuma tela do app os coletava. Todo usuário ficava travado em
 * "Perfil incompleto" para sempre, sem lugar nenhum onde resolver.
 */
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppIcon, DInput } from "@/components/ui";
import { atualizarDadosPessoais } from "@/api/perfilApi";
import { useAuth } from "@/stores/authStore";
import { getProfileTheme } from "@/theme/profileTheme";
import { colors, radius, spacing, typography } from "@/theme/tokens";
import { platformSelect } from "@/utils/platform";
import {
  cpfValido,
  dataNascimentoISO,
  mascaraCPF,
  mascaraData,
  somenteDigitos,
} from "@/utils/formatters";

export function DadosPessoaisGateScreen() {
  const user = useAuth((state) => state.user);
  const setUser = useAuth((state) => state.setUser);
  const tema = getProfileTheme({ role: user?.role ?? "EMPREGADOR", genero: user?.genero ?? null });

  const [cpf, setCpf] = useState("");
  const [nascimento, setNascimento] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const cpfOk = cpfValido(cpf);
  const nascimentoISO = useMemo(() => dataNascimentoISO(nascimento), [nascimento]);
  const podeSalvar = cpfOk && !!nascimentoISO && !salvando;

  // Só reclama depois que o campo está "cheio" — validar a cada tecla faria a
  // tela ficar vermelha enquanto a pessoa ainda digita.
  const erroCpf = somenteDigitos(cpf).length === 11 && !cpfOk ? "CPF inválido." : null;
  const erroNascimento =
    somenteDigitos(nascimento).length === 8 && !nascimentoISO
      ? "Data inválida. Confira o dia, o mês e o ano."
      : null;

  const salvar = async () => {
    if (!podeSalvar || !nascimentoISO) return;
    setSalvando(true);
    setErro(null);
    try {
      await atualizarDadosPessoais({ cpf: somenteDigitos(cpf), dataNascimento: nascimentoISO });
      // Atualiza o user persistido → o RootNavigator sai deste gate.
      setUser((atual) =>
        atual ? { ...atual, cpf: somenteDigitos(cpf), dataNascimento: nascimentoISO } : atual,
      );
    } catch (e: unknown) {
      // `fail()` do backend devolve `error` como objeto { code, message }.
      const resposta = (e as { response?: { data?: { error?: { message?: string } | string } } })
        ?.response?.data?.error;
      const mensagem = typeof resposta === "string" ? resposta : resposta?.message;
      setErro(mensagem ?? "Não foi possível salvar. Tente novamente em instantes.");
      setSalvando(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={s.flex} behavior={platformSelect({ ios: "padding", android: undefined })}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <View style={[s.icone, { backgroundColor: tema.primarySoft }]}>
            <AppIcon name="UserRound" size={28} color={tema.primary} strokeWidth={2.1} />
          </View>

          <Text style={s.titulo}>Falta pouco para concluir seu cadastro</Text>
          <Text style={s.subtitulo}>
            Precisamos do seu CPF e da sua data de nascimento para confirmar que é você. Você informa
            uma vez só.
          </Text>

          <View style={s.campos}>
            <View>
              <DInput
                placeholder="CPF"
                value={cpf}
                onChangeText={(v) => setCpf(mascaraCPF(v))}
                keyboardType="number-pad"
                icon={<AppIcon name="FileText" size={18} color={colors.textMuted} />}
              />
              {erroCpf ? <Text style={s.erroCampo}>{erroCpf}</Text> : null}
            </View>

            <View>
              <DInput
                placeholder="Data de nascimento (DD/MM/AAAA)"
                value={nascimento}
                onChangeText={(v) => setNascimento(mascaraData(v))}
                keyboardType="number-pad"
                icon={<AppIcon name="Calendar" size={18} color={colors.textMuted} />}
              />
              {erroNascimento ? <Text style={s.erroCampo}>{erroNascimento}</Text> : null}
            </View>
          </View>

          {erro ? <Text style={s.erroGeral}>{erro}</Text> : null}

          <Pressable
            onPress={salvar}
            disabled={!podeSalvar}
            style={({ pressed }) => [
              s.botao,
              { backgroundColor: tema.primary },
              !podeSalvar && s.botaoDesabilitado,
              pressed && podeSalvar && { opacity: 0.9 },
            ]}
          >
            {salvando ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={s.botaoTexto}>Continuar</Text>
            )}
          </Pressable>

          <View style={s.notaLinha}>
            <AppIcon name="Lock" size={14} color={colors.textMuted} strokeWidth={2.2} />
            <Text style={s.notaTexto}>
              Seus dados são protegidos e usados apenas para verificação.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export default DadosPessoaisGateScreen;

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    gap: spacing.md,
  },
  icone: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  titulo: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  subtitulo: {
    ...typography.bodySm,
    color: colors.textSecondary,
    marginTop: -spacing.xs,
  },
  campos: {
    gap: 12,
    marginTop: spacing.sm,
  },
  erroCampo: {
    ...typography.bodySm,
    color: colors.danger,
    marginTop: 6,
    marginLeft: 4,
  },
  erroGeral: {
    ...typography.bodySm,
    color: colors.danger,
  },
  botao: {
    height: 52,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.sm,
  },
  botaoDesabilitado: { opacity: 0.45 },
  botaoTexto: {
    ...typography.bodyMedium,
    color: colors.white,
    fontWeight: "800",
  },
  notaLinha: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: spacing.xs,
  },
  notaTexto: {
    ...typography.caption,
    color: colors.textMuted,
    flex: 1,
  },
});
