import React, { useEffect, useMemo, useState } from "react";
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
import { useNavigation } from "@react-navigation/native";
import { AppIcon, DInput } from "@/components/ui";
import { useDularColors } from "@/hooks/useDularColors";
import { useGenderTheme } from "@/hooks/useProfileTheme";
import { radius, spacing, typography } from "@/theme";
import { platformSelect } from "@/utils/platform";
import { apiMsg } from "@/utils/apiMsg";
import {
  getPaymentInfo,
  salvarPaymentInfo,
  type PixKeyType,
} from "@/api/pagamentoApi";

/**
 * Recebimentos — "Receber pelo PIX" (Configurações do profissional).
 * Tela própria: cadastra/edita a chave PIX usada pelo empregador para pagar.
 * Salva imediatamente (upsert no backend).
 */

const TIPOS: { value: PixKeyType; label: string }[] = [
  { value: "CPF", label: "CPF" },
  { value: "CELULAR", label: "Celular" },
  { value: "EMAIL", label: "Email" },
  { value: "ALEATORIA", label: "Aleatória" },
];

const PLACEHOLDER: Record<PixKeyType, string> = {
  CPF: "000.000.000-00",
  CELULAR: "(66) 99999-8888",
  EMAIL: "voce@email.com",
  ALEATORIA: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
};

function maskCpf(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function maskPhone(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").trim();
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").trim();
}

/** Validação de CPF com dígitos verificadores (mesma regra do backend). */
function validarCpf(raw: string): boolean {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 11) return false;
  if (/^(\d)\1+$/.test(digits)) return false;
  const calc = (mod: number) => {
    let sum = 0;
    for (let i = 0; i < mod - 1; i++) sum += Number(digits[i]) * (mod - i);
    const rem = (sum * 10) % 11;
    return rem === 10 || rem === 11 ? 0 : rem;
  };
  return calc(10) === Number(digits[9]) && calc(11) === Number(digits[10]);
}

function validar(tipo: PixKeyType, chave: string): string | null {
  const valor = chave.trim();
  if (!valor) return "Informe a chave PIX.";
  if (tipo === "CPF" && !validarCpf(valor)) return "CPF inválido.";
  if (tipo === "CELULAR") {
    const d = valor.replace(/\D/g, "");
    if (d.length < 10 || d.length > 11) return "Celular inválido. Use DDD + número.";
  }
  if (tipo === "EMAIL" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(valor.toLowerCase())) {
    return "Email inválido.";
  }
  if (
    tipo === "ALEATORIA" &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valor)
  ) {
    return "Chave aleatória inválida. Copie a chave exata do seu banco.";
  }
  return null;
}

export function RecebimentosScreen() {
  const navigation = useNavigation();
  const colors = useDularColors();
  const theme = useGenderTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [carregando, setCarregando] = useState(true);
  const [pixType, setPixType] = useState<PixKeyType>("CPF");
  const [pixKey, setPixKey] = useState("");
  const [bank, setBank] = useState("");
  const [holderName, setHolderName] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const info = await getPaymentInfo();
        if (!ativo || !info) return;
        setPixType(info.pixType);
        setPixKey(info.pixType === "CPF" ? maskCpf(info.pixKey) : info.pixKey);
        setBank(info.bank ?? "");
        setHolderName(info.holderName);
      } catch {
        // sem cadastro ainda / erro de rede: o form abre vazio
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);

  const onChaveChange = (valor: string) => {
    setErro(null);
    if (pixType === "CPF") return setPixKey(maskCpf(valor));
    if (pixType === "CELULAR") return setPixKey(maskPhone(valor));
    setPixKey(valor);
  };

  const onTipoChange = (tipo: PixKeyType) => {
    setPixType(tipo);
    setPixKey("");
    setErro(null);
  };

  const salvar = async () => {
    if (salvando) return;
    const erroChave = validar(pixType, pixKey);
    if (erroChave) return setErro(erroChave);
    if (holderName.trim().length < 3) return setErro("Informe o nome do titular.");

    setSalvando(true);
    setErro(null);
    try {
      await salvarPaymentInfo({
        pixType,
        pixKey: pixKey.trim(),
        bank: bank.trim() || null,
        holderName: holderName.trim(),
      });
      setToast("Dados de recebimento salvos.");
      setTimeout(() => setToast(null), 2600);
    } catch (e) {
      setErro(apiMsg(e, "Não foi possível salvar."));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          style={s.backBtn}
        >
          <AppIcon name="ArrowLeft" size={20} color={colors.textPrimary} strokeWidth={2.5} />
        </Pressable>
        <View style={s.headerTextCol}>
          <Text style={s.title}>Recebimentos</Text>
          <Text style={s.subtitle}>Receber pelo PIX</Text>
        </View>
        <View style={s.backBtn} />
      </View>

      {carregando ? (
        <View style={s.center}>
          <ActivityIndicator color={theme.primary} size="large" />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={s.flex}
          behavior={platformSelect({ ios: "padding", android: undefined })}
        >
          <ScrollView
            contentContainerStyle={s.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={s.fieldLabel}>Tipo da chave</Text>
            <View style={s.tiposRow}>
              {TIPOS.map((t) => {
                const ativo = pixType === t.value;
                return (
                  <Pressable
                    key={t.value}
                    onPress={() => onTipoChange(t.value)}
                    style={[
                      s.tipoChip,
                      ativo && { borderColor: theme.primary, backgroundColor: theme.primarySoft },
                    ]}
                  >
                    <Text style={[s.tipoChipText, ativo && { color: theme.primaryDark }]}>
                      {t.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={s.fieldLabel}>Chave PIX</Text>
            <DInput
              placeholder={PLACEHOLDER[pixType]}
              value={pixKey}
              onChangeText={onChaveChange}
              keyboardType={
                pixType === "CPF" || pixType === "CELULAR" ? "number-pad" : "email-address"
              }
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={s.fieldLabel}>Banco (opcional)</Text>
            <DInput
              placeholder="Ex.: Nubank, Caixa…"
              value={bank}
              onChangeText={setBank}
              maxLength={80}
            />

            <Text style={s.fieldLabel}>Nome do titular</Text>
            <DInput
              placeholder="Nome como aparece no banco"
              value={holderName}
              onChangeText={setHolderName}
              maxLength={120}
              autoCapitalize="words"
            />

            {erro ? <Text style={s.hintError}>{erro}</Text> : null}
            {toast ? <Text style={s.hintOk}>{toast}</Text> : null}

            <Pressable
              onPress={salvar}
              disabled={salvando}
              style={({ pressed }) => [
                s.saveBtn,
                { backgroundColor: theme.primary },
                salvando && s.saveBtnDisabled,
                pressed && !salvando && s.pressed,
              ]}
            >
              {salvando ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={s.saveBtnText}>Salvar dados de recebimento</Text>
              )}
            </Pressable>

            <View style={s.infoRow}>
              <AppIcon name="ShieldCheck" size={16} color={colors.textMuted} strokeWidth={2.2} />
              <Text style={s.infoText}>
                O pagamento é feito diretamente pelo empregador para a sua chave
                PIX. A Dular não recebe nem retém valores.
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

export default RecebimentosScreen;

function makeStyles(colors: ReturnType<typeof useDularColors>) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      minHeight: 56,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    headerTextCol: { alignItems: "center", gap: 1 },
    title: { ...typography.h3, color: colors.textPrimary, fontWeight: "700" },
    subtitle: { ...typography.caption, color: colors.textSecondary },
    scroll: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing["4xl"],
      gap: spacing.xs,
    },
    fieldLabel: {
      marginTop: spacing.sm,
      marginBottom: 6,
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: "700",
    },
    tiposRow: { flexDirection: "row", gap: spacing.xs },
    tipoChip: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 10,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    tipoChipText: { ...typography.caption, fontWeight: "700", color: colors.textSecondary },
    hintError: { marginTop: spacing.sm, ...typography.caption, color: colors.error, fontWeight: "700" },
    hintOk: { marginTop: spacing.sm, ...typography.caption, color: colors.success, fontWeight: "700" },
    saveBtn: {
      marginTop: spacing.lg,
      minHeight: 50,
      borderRadius: radius.lg,
      alignItems: "center",
      justifyContent: "center",
    },
    saveBtnDisabled: { opacity: 0.7 },
    pressed: { opacity: 0.85 },
    saveBtnText: { ...typography.bodySmMedium, color: colors.white, fontWeight: "700" },
    infoRow: {
      marginTop: spacing.lg,
      flexDirection: "row",
      gap: spacing.sm,
      alignItems: "center",
      paddingHorizontal: spacing.sm,
    },
    infoText: { flex: 1, ...typography.caption, color: colors.textMuted },
  });
}
