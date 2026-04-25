/**
 * AlterarSenha — Tela de alteração de senha
 *
 * Identidade visual 100% aplicada com tokens Dular validados.
 */

import React, { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { DInput } from "@/components/DInput";
import { DButton } from "@/components/DButton";
import { changePassword } from "@/api/perfilApi";
import { apiMsg } from "@/utils/apiMsg";
import { colors, radius, shadow, spacing, typography } from "@/theme/tokens";

export default function AlterarSenha() {
  const nav = useNavigation<any>();
  const [atual,   setAtual]   = useState("");
  const [nova,    setNova]    = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [showA,   setShowA]   = useState(false);
  const [showN,   setShowN]   = useState(false);
  const [showC,   setShowC]   = useState(false);

  const salvar = async () => {
    if (nova !== confirm) {
      return Alert.alert("Erro", "As senhas não conferem.");
    }
    try {
      setLoading(true);
      await changePassword({ senhaAtual: atual, novaSenha: nova });
      Alert.alert("Senha", "Senha atualizada com sucesso.");
      nav.goBack();
    } catch (e: any) {
      Alert.alert("Erro", apiMsg(e, "Falha ao atualizar senha."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen
      title="Alterar senha"
      rightAction={
        <Pressable onPress={() => nav.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
      }
    >
      <View style={s.card}>
        <DInput
          label="Senha atual"
          value={atual}
          onChangeText={setAtual}
          secureTextEntry={!showA}
          autoCapitalize="none"
          rightIcon={
            <Pressable onPress={() => setShowA(v => !v)} hitSlop={12}>
              <Ionicons name={showA ? "eye-outline" : "eye-off-outline"} size={18} color={colors.sub} />
            </Pressable>
          }
        />
        <DInput
          label="Nova senha"
          value={nova}
          onChangeText={setNova}
          secureTextEntry={!showN}
          autoCapitalize="none"
          rightIcon={
            <Pressable onPress={() => setShowN(v => !v)} hitSlop={12}>
              <Ionicons name={showN ? "eye-outline" : "eye-off-outline"} size={18} color={colors.sub} />
            </Pressable>
          }
        />
        <DInput
          label="Confirme a nova senha"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry={!showC}
          autoCapitalize="none"
          error={confirm && nova !== confirm ? "As senhas não conferem." : undefined}
          rightIcon={
            <Pressable onPress={() => setShowC(v => !v)} hitSlop={12}>
              <Ionicons name={showC ? "eye-outline" : "eye-off-outline"} size={18} color={colors.sub} />
            </Pressable>
          }
        />

        <DButton
          title={loading ? "Salvando..." : "Salvar nova senha"}
          onPress={salvar}
          loading={loading}
          style={{ marginTop: 4 }}
        />
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.stroke,
    padding: 16,
    gap: 12,
    ...shadow.card,
  },
});
