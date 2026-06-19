/**
 * ProfissionalCard — card ÚNICO de profissional para o lado Empregador.
 *
 * Usado em TODAS as superfícies que listam profissionais (Home "Profissionais
 * sugeridos", Buscar/resultados, "Profissionais em destaque" e "Ver todos").
 * É o único componente de card — não criar variações por tela.
 *
 * Estrutura (congelada): Avatar · Nome · Categoria principal · Cidade · Bairro ·
 * Valor · Estrelas. NÃO exibe: quantidade de avaliações, score, verificações,
 * nichos, especialidades, portfólio ou qualquer informação avançada — esses
 * dados pertencem exclusivamente à tela "Ver perfil".
 *
 * Apresentacional/puro: recebe `ProfissionalCardData` já normalizado pela tela.
 * Não faz fetch nem cálculo extra por card (evita N+1).
 */
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppIcon, type AppIconName } from "./AppIcon";
import { DAvatar } from "./DAvatar";
import { colors, radius, shadows, spacing, typography } from "@/theme";
import { getProfileTheme } from "@/theme/profileTheme";

const EMPREGADOR_THEME = getProfileTheme({ role: "EMPREGADOR" });

export type ProfissionalCardData = {
  id: string;
  userId: string;
  tipo: "DIARISTA" | "MONTADOR";
  nome: string;
  /** Categoria principal (Diarista, Faxineira, Babá, …, Montador). */
  categoria: string;
  categoriaIcon: AppIconName;
  /** Cor oficial da categoria (Design System) — ícone/label do badge. */
  categoriaColor?: string;
  /** Fundo suave oficial da categoria — fundo do badge. */
  categoriaBg?: string;
  avatarUrl?: string | null;
  cidade?: string | null;
  bairro?: string | null;
  /** Texto de valor já formatado ("A partir de R$ 150,00" | "A combinar"). */
  valorLabel?: string;
  /** Nota média (estrelas). 0/undefined → "Novo". */
  nota?: number;
};

type Props = {
  data: ProfissionalCardData;
  /** Quando `onToggleFavorito` é passado, o coração aparece. */
  favorito?: boolean;
  onToggleFavorito?: () => void;
  onPress: () => void;
};

export function ProfissionalCard({ data, favorito, onToggleFavorito, onPress }: Props) {
  const initials = data.nome
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const accent = data.categoriaColor ?? EMPREGADOR_THEME.primary;
  const local = [data.bairro, data.cidade].filter(Boolean).join(", ");
  const showFav = typeof onToggleFavorito === "function";
  const notaLabel = data.nota && data.nota > 0 ? data.nota.toFixed(1).replace(".", ",") : "Novo";

  return (
    <View style={s.card}>
      <DAvatar size="md" uri={data.avatarUrl ?? undefined} initials={initials} />

      <View style={s.center}>
        <Text style={s.nome} numberOfLines={1}>
          {data.nome}
        </Text>

        <View style={[s.catBadge, { backgroundColor: data.categoriaBg ?? colors.lavenderSoft }]}>
          <AppIcon name={data.categoriaIcon} size={10} color={accent} strokeWidth={2.2} />
          <Text style={[s.catText, { color: accent }]} numberOfLines={1}>
            {data.categoria}
          </Text>
        </View>

        {local ? (
          <View style={s.metaRow}>
            <AppIcon name="MapPin" size={11} color={colors.textMuted} strokeWidth={2} />
            <Text style={s.metaText} numberOfLines={1}>
              {local}
            </Text>
          </View>
        ) : null}

        <View style={s.metaRow}>
          <AppIcon name="Star" size={12} color={colors.warning} strokeWidth={2.3} />
          <Text style={s.metaText}>{notaLabel}</Text>
        </View>
      </View>

      <View style={s.right}>
        {showFav ? (
          <Pressable
            onPress={onToggleFavorito}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={favorito ? "Remover dos favoritos" : "Adicionar aos favoritos"}
            style={({ pressed }) => [s.favBtn, pressed && { opacity: 0.7 }]}
          >
            <AppIcon
              name="Heart"
              size={18}
              color={favorito ? colors.danger : colors.textMuted}
              strokeWidth={favorito ? 2.6 : 2.2}
            />
          </Pressable>
        ) : (
          <View style={s.favBtn} />
        )}

        {data.valorLabel ? (
          <Text style={s.valor} numberOfLines={1}>
            {data.valorLabel}
          </Text>
        ) : null}

        <Pressable
          onPress={onPress}
          style={({ pressed }) => [s.verBtn, pressed && { opacity: 0.85 }]}
        >
          <Text style={s.verBtnText}>Ver perfil</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default ProfissionalCard;

/** "A partir de R$ X" a partir do precoLeve (CENTAVOS). 0/null → "A combinar". */
export function formatValorDiarista(precoLeveCents?: number | null): string {
  const v = Number(precoLeveCents ?? 0);
  if (!Number.isFinite(v) || v <= 0) return "A combinar";
  return `A partir de R$ ${(v / 100).toFixed(2).replace(".", ",")}`;
}

/** Valor do montador: usa o `precoLabel` do backend, senão "A combinar". */
export function formatValorMontador(m: { precoLabel?: string | null; valorACombinar?: boolean }): string {
  if (m.precoLabel && m.precoLabel.trim()) return m.precoLabel;
  return "A combinar";
}

const s = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm + 2,
    gap: 10,
    ...shadows.soft,
  },
  center: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  nome: {
    color: colors.textPrimary,
    ...typography.bodySmMedium,
    fontWeight: "700",
  },
  catBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  catText: {
    ...typography.caption,
    fontWeight: "700",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    ...typography.caption,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  right: {
    alignItems: "flex-end",
    justifyContent: "space-between",
    alignSelf: "stretch",
    gap: 6,
  },
  favBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  valor: {
    ...typography.caption,
    fontWeight: "700",
    color: colors.textPrimary,
    textAlign: "right",
  },
  verBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: EMPREGADOR_THEME.primary,
    alignItems: "center",
  },
  verBtnText: {
    ...typography.caption,
    color: colors.white,
    fontWeight: "700",
  },
});
