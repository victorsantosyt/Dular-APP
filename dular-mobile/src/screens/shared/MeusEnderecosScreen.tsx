/**
 * MeusEnderecosScreen — tela dedicada de "Endereço", aberta a partir do botão
 * "Endereço" nas telas de perfil dos 3 papéis.
 *
 * Mostra um card por endereço cadastrado (o empregador pode ter 2: Residencial
 * e Empresarial), cada um com botão "Atualizar endereço" (→ CadastroEndereco em
 * modo edição / PATCH). Vazio → CTA "Adicionar endereço" (→ novo cadastro).
 * Refaz o GET /api/me/enderecos a cada foco (volta da edição já reflete).
 *
 * Self-contained e prop-light: role/accent vêm dos params da rota (cada perfil
 * passa sua cor de identidade). Registrada nos 3 RootStacks.
 */
import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  useFocusEffect,
  useNavigation,
  useRoute,
  type NavigationProp,
  type RouteProp,
} from "@react-navigation/native";
import { AppIcon, DCard } from "@/components/ui";
import { useDularColors } from "@/hooks/useDularColors";
import { radius, spacing, typography } from "@/theme";
import { fetchEnderecos, type Endereco } from "@/api/enderecoApi";
import type { CadastroEnderecoParams, Role } from "@/screens/shared/EnderecoEditRoute";

type ThemeColors = ReturnType<typeof useDularColors>;

export type MeusEnderecosParams = {
  role: Role;
  /** Cor de destaque (identidade do papel). Default: colors.primary. */
  accentColor?: string;
  accentSoft?: string;
};

type Nav = NavigationProp<{ CadastroEndereco: CadastroEnderecoParams }>;

const TIPO_LABEL: Record<Endereco["tipo"], string> = {
  RESIDENCIAL: "Residencial",
  EMPRESARIAL: "Empresarial",
};

export function MeusEnderecosScreen() {
  const colors = useDularColors();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<{ MeusEnderecos: MeusEnderecosParams }, "MeusEnderecos">>();
  const { role = "EMPREGADOR", accentColor, accentSoft } = route.params ?? { role: "EMPREGADOR" };
  const accent = accentColor ?? colors.primary;
  const accentBg = accentSoft ?? colors.lavenderSoft;

  const [enderecos, setEnderecos] = useState<Endereco[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      fetchEnderecos()
        .then((list) => {
          if (alive) setEnderecos(list);
        })
        .catch(() => {
          if (alive) setEnderecos([]);
        });
      return () => {
        alive = false;
      };
    }, []),
  );

  const abrirEdicao = (endereco: Endereco) =>
    navigation.navigate("CadastroEndereco", { role, initial: endereco });
  const abrirNovo = () => navigation.navigate("CadastroEndereco", { role, initial: null });

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <View style={s.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          style={({ pressed }) => [s.backBtn, pressed && s.pressed]}
        >
          <AppIcon name="ArrowLeft" size={20} color={accent} strokeWidth={2.4} />
        </Pressable>
        <Text style={s.headerTitle} numberOfLines={1}>
          Endereço
        </Text>
        <View style={s.backBtn} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {enderecos === null ? (
          <View style={s.centerBox}>
            <ActivityIndicator color={accent} />
          </View>
        ) : enderecos.length === 0 ? (
          <DCard style={s.emptyCard}>
            <View style={[s.icon, { backgroundColor: accentBg }]}>
              <AppIcon name="MapPin" size={22} color={accent} strokeWidth={2.2} />
            </View>
            <Text style={s.emptyTitle}>Nenhum endereço cadastrado</Text>
            <Text style={s.emptyText}>Cadastre um endereço para aparecer aqui.</Text>
            <Pressable
              onPress={abrirNovo}
              style={({ pressed }) => [s.addBtn, { backgroundColor: accent }, pressed && s.pressed]}
            >
              <AppIcon name="Plus" size={16} color={colors.white} strokeWidth={2.6} />
              <Text style={s.addBtnText}>Adicionar endereço</Text>
            </Pressable>
          </DCard>
        ) : (
          <>
            {enderecos.map((e) => {
              const compl = e.complemento ? ` — ${e.complemento}` : "";
              return (
                <DCard key={e.id} style={s.card}>
                  <View style={s.cardHeader}>
                    <View style={[s.icon, { backgroundColor: accentBg }]}>
                      <AppIcon
                        name={e.tipo === "EMPRESARIAL" ? "BriefcaseBusiness" : "Home"}
                        size={18}
                        color={accent}
                        strokeWidth={2.2}
                      />
                    </View>
                    <Text style={s.tipoLabel}>{TIPO_LABEL[e.tipo]}</Text>
                  </View>
                  <Text style={s.linha}>
                    {e.rua}, {e.numero}
                    {compl}
                  </Text>
                  <Text style={s.linha}>
                    {e.bairro}, {e.cidade}/{e.uf}
                  </Text>
                  <Text style={s.cep}>CEP {e.cep}</Text>
                  {e.pontoReferencia ? <Text style={s.ref}>Ref.: {e.pontoReferencia}</Text> : null}
                  <Pressable
                    onPress={() => abrirEdicao(e)}
                    style={({ pressed }) => [s.btn, { borderColor: accent }, pressed && s.pressed]}
                  >
                    <Text style={[s.btnText, { color: accent }]}>Atualizar endereço</Text>
                    <AppIcon name="ChevronRight" size={16} color={accent} strokeWidth={2.4} />
                  </Pressable>
                </DCard>
              );
            })}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

export default MeusEnderecosScreen;

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    pressed: { opacity: 0.7 },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: {
      flex: 1,
      textAlign: "center",
      ...typography.bodyMedium,
      color: colors.textPrimary,
      fontWeight: "700",
    },
    scroll: {
      paddingHorizontal: spacing.screenPadding,
      paddingTop: spacing.sm,
      paddingBottom: 48,
      gap: spacing.md,
    },
    centerBox: {
      paddingVertical: spacing.xl,
      alignItems: "center",
      justifyContent: "center",
    },
    card: {
      borderRadius: 18,
      padding: spacing.md,
      gap: 4,
      backgroundColor: colors.surface,
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginBottom: 2,
    },
    icon: {
      width: 40,
      height: 40,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    tipoLabel: {
      color: colors.textPrimary,
      ...typography.bodySmMedium,
      fontWeight: "800",
    },
    linha: {
      color: colors.textPrimary,
      ...typography.bodySm,
      fontWeight: "600",
    },
    cep: {
      color: colors.textSecondary,
      ...typography.caption,
      fontWeight: "700",
    },
    ref: {
      color: colors.textSecondary,
      ...typography.caption,
      fontWeight: "500",
    },
    btn: {
      marginTop: spacing.sm,
      minHeight: 42,
      borderRadius: radius.md,
      borderWidth: 1.5,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
    },
    btnText: {
      ...typography.bodySm,
      fontWeight: "800",
    },
    emptyCard: {
      borderRadius: 18,
      padding: spacing.lg,
      alignItems: "center",
      gap: spacing.sm,
      backgroundColor: colors.surface,
    },
    emptyTitle: {
      color: colors.textPrimary,
      ...typography.bodyMedium,
      fontWeight: "800",
    },
    emptyText: {
      color: colors.textSecondary,
      ...typography.bodySm,
      fontWeight: "500",
      textAlign: "center",
    },
    addBtn: {
      marginTop: spacing.sm,
      minHeight: 48,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.lg,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
    addBtnText: {
      ...typography.bodySm,
      color: colors.white,
      fontWeight: "800",
    },
  });
}
