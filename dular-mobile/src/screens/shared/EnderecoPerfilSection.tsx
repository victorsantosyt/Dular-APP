/**
 * EnderecoPerfilSection — seção "Endereço" das telas de perfil (3 papéis).
 *
 * Self-contained: busca os endereços do usuário (GET /api/me/enderecos) a cada
 * foco da tela e renderiza um card por endereço com botão "Atualizar endereço".
 * O empregador pode ter 2 endereços (Residencial + Empresarial) → um card cada.
 *
 * A navegação fica a cargo do chamador (cada perfil tem seu navigator tipado):
 * `onEdit(endereco)` deve abrir a rota "CadastroEndereco" em modo edição.
 */
import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { AppIcon, DCard } from "@/components/ui";
import { useDularColors } from "@/hooks/useDularColors";
import { radius, spacing, typography } from "@/theme";
import { fetchEnderecos, type Endereco } from "@/api/enderecoApi";

type ThemeColors = ReturnType<typeof useDularColors>;

const TIPO_LABEL: Record<Endereco["tipo"], string> = {
  RESIDENCIAL: "Residencial",
  EMPRESARIAL: "Empresarial",
};

type Props = {
  /** Cor de destaque (ícone/botão). Default: colors.primary. */
  accentColor?: string;
  /** Fundo do quadrado do ícone. Default: colors.lavenderSoft. */
  accentSoft?: string;
  onEdit: (endereco: Endereco) => void;
};

export function EnderecoPerfilSection({ accentColor, accentSoft, onEdit }: Props) {
  const colors = useDularColors();
  const s = useMemo(() => makeStyles(colors), [colors]);
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

  // Carregando: placeholder discreto (não bloqueia a tela).
  if (enderecos === null) {
    return (
      <View style={s.wrap}>
        <Text style={s.sectionTitle}>Endereço</Text>
        <DCard style={s.loadingCard}>
          <ActivityIndicator color={accent} size="small" />
        </DCard>
      </View>
    );
  }

  // Sem endereço (gate de onboarding garante ≥1; salvaguarda apenas).
  if (enderecos.length === 0) return null;

  return (
    <View style={s.wrap}>
      <Text style={s.sectionTitle}>Endereço</Text>
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
              onPress={() => onEdit(e)}
              style={({ pressed }) => [s.btn, { borderColor: accent }, pressed && s.pressed]}
            >
              <Text style={[s.btnText, { color: accent }]}>Atualizar endereço</Text>
              <AppIcon name="ChevronRight" size={16} color={accent} strokeWidth={2.4} />
            </Pressable>
          </DCard>
        );
      })}
    </View>
  );
}

export default EnderecoPerfilSection;

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: { gap: spacing.sm },
    sectionTitle: {
      color: colors.textPrimary,
      ...typography.bodyMedium,
      fontWeight: "700",
      paddingHorizontal: 2,
    },
    loadingCard: {
      borderRadius: 18,
      paddingVertical: spacing.lg,
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
      width: 36,
      height: 36,
      borderRadius: 13,
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
    pressed: { opacity: 0.7 },
  });
}
