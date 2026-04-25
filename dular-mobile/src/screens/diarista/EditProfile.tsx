/**
 * EditProfile — Editar dados pessoais
 * Tokens Dular 100% aplicados. Lógica preservada.
 */

import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import { getMe, updateMe, type Me } from "@/api/perfilApi";
import { apiMsg } from "@/utils/apiMsg";
import { useAuth } from "@/stores/authStore";
import { Screen } from "@/components/Screen";
import { DButton } from "@/components/DButton";
import { DInput } from "@/components/DInput";
import { colors, radius, shadow, spacing, typography } from "@/theme/tokens";

// ── Componente ────────────────────────────────────────────────────────────────

export default function EditProfile({ navigation }: any) {
  const [nome,     setNome]     = useState("");
  const [telefone, setTelefone] = useState("");
  const [bio,      setBio]      = useState("");
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const setUser = useAuth((s) => s.setUser);
  const busyRef = useRef(false);

  // ── Apply ─────────────────────────────────────────────────────────────────
  const apply = useCallback((data: Me | null) => {
    if (!data) return;
    setNome(data.nome ?? "");
    setTelefone(data.telefone ?? "");
    setBio(data.bio ?? "");
    setUser((prev) => ({
      ...(prev ?? { id: data.id }),
      id: data.id || prev?.id || "",
      nome: data.nome ?? prev?.nome ?? "",
      telefone: data.telefone ?? prev?.telefone,
      role: (data.role as any) ?? prev?.role,
    }));
  }, [setUser]);

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      const data = await getMe();
      apply(data);
    } catch (e: any) {
      setError(apiMsg(e, "Falha ao carregar perfil."));
    } finally {
      setLoading(false);
    }
  }, [apply]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // ── Save ──────────────────────────────────────────────────────────────────
  const save = async () => {
    if (saving || busyRef.current) return;
    busyRef.current = true;
    try {
      setSaving(true);
      const updated = await updateMe({ nome });
      apply(updated);
      Alert.alert("Sucesso", "Dados atualizados.");
      navigation.goBack();
    } catch (e: any) {
      Alert.alert("Erro", apiMsg(e, "Falha ao salvar dados."));
    } finally {
      setSaving(false);
      busyRef.current = false;
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Screen title="Editar dados">
      {loading ? (
        <View style={s.card}>
          <ActivityIndicator color={colors.green} />
        </View>
      ) : error ? (
        <View style={[s.card, { gap: 10 }]}>
          <Text style={s.errorTitle}>Não foi possível carregar.</Text>
          <Text style={s.errorSub}>{error}</Text>
          <DButton title="Tentar novamente" onPress={load} variant="outline" />
        </View>
      ) : (
        <View style={s.card}>
          <DInput
            label="Nome completo"
            value={nome}
            onChangeText={setNome}
            placeholder="Seu nome"
            autoCapitalize="words"
          />
          <DInput
            label="Telefone"
            value={telefone}
            onChangeText={setTelefone}
            keyboardType="phone-pad"
            placeholder="Seu telefone"
            editable={false}
            hint="O telefone não pode ser alterado aqui."
          />
          <DInput
            label="Biografia"
            value={bio}
            onChangeText={setBio}
            placeholder="Conte sobre sua experiência..."
            multiline
            style={{ minHeight: 88 }}
          />

          <DButton
            title={saving ? "Salvando..." : "Salvar dados"}
            onPress={save}
            loading={saving}
            style={{ marginTop: 4 }}
          />
        </View>
      )}
    </Screen>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

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
  errorTitle: { fontSize: 14, fontWeight: "800", color: colors.danger },
  errorSub:   { ...typography.sub },
});
