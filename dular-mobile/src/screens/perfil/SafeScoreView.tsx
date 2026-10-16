import React, { useMemo } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import { Screen } from "@/components/Screen";
import { AppIcon, BackCircleButton, type AppIconName } from "@/components/ui";
import { SafeScoreEmblem, SafeScoreMedal } from "@/assets/icons/SafeScoreEmblem";
import { getSafeScoreBackground, getSafeScoreEmblemState, IDENTITY_LABELS } from "@/lib/safeScorePresentation";
import type { ProfileTheme } from "@/theme/profileTheme";
import type { SafeScoreResource } from "@/hooks/useSafeScoreResource";
import type { SafeScoreOverview } from "@/api/safeScoreOverviewApi";
import type { SafetyEvent } from "@/api/segurancaApi";
import { protocoloFromId } from "@/api/segurancaApi";
import { colors } from "@/theme/tokens";
import { makeSafeScoreStyles, ResourceFeedback, SafeScoreLink } from "./safeScoreLayout";

type Props = {
  theme: ProfileTheme;
  overview: SafeScoreResource<SafeScoreOverview>;
  sos: SafeScoreResource<SafetyEvent[]>;
  onBack: () => void;
  onIdentity: () => void;
  onGuide: () => void;
};

export function SafeScoreView({ theme, overview, sos, onBack, onIdentity, onGuide }: Props) {
  const s = useMemo(() => makeSafeScoreStyles(theme), [theme]);
  const { width, fontScale } = useWindowDimensions();
  const data = overview.data;
  const reputation = data?.reputation;
  const emblem = getSafeScoreEmblemState(data);
  const restricted = emblem === "restricted";
  const unavailable = !reputation;
  const attention = restricted || emblem === "observation";
  const tone = restricted ? { bg: colors.dangerSoft, fg: colors.danger }
    : attention ? { bg: "#FFF0D0", fg: "#DD8A0C" }
    : unavailable ? { bg: "#EEF0F3", fg: "#596579" }
    : { bg: theme.primarySoft, fg: theme.textAccent };
  const identityApproved = data?.identidade === "VERIFICADO";
  const identityRejected = data?.identidade === "REPROVADO";

  const metric = (icon: AppIconName, title: string, description: string, value: React.ReactNode, divider = true) => (
    <View style={[s.row, divider && s.divider]}>
      <View style={s.icon}><AppIcon name={icon} size={25} color={theme.textAccent} strokeWidth={1.8} /></View>
      <View style={s.rowContent}>
        <Text style={s.rowTitle}>{title}</Text>
        <Text style={s.rowDescription}>{description}</Text>
      </View>
      <View style={s.rowValue}>{value}</View>
    </View>
  );

  return (
    <Screen title="SafeScore" backgroundColor={getSafeScoreBackground(theme)} titleColor={colors.ink} compactHeader px={20}
      leftAction={<BackCircleButton onPress={onBack} color={theme.textAccent} borderColor={`${theme.border}90`} />}
      contentStyle={s.content}
    >
      <ResourceFeedback resource={overview} theme={theme} label="seu SafeScore" />
      {data && <>
        <Text style={s.eyebrow}>Reputação e confiança</Text>
        <View style={[s.card, s.hero, fontScale > 1.4 && s.heroStacked]}>
          <View style={s.heroCopy}>
            <Text style={s.heroTitle}>{restricted ? "Sua conta\nrequer atenção." : unavailable ? "Sem histórico\nde reputação" : "Sua confiança,\nem evolução."}</Text>
            <View style={[s.heroStatus, { backgroundColor: tone.bg }]}>
              <View style={[s.statusDot, { backgroundColor: tone.fg }]} />
              <Text style={s.statusText}>{data.status ?? "Ainda não calculado"}</Text>
            </View>
          </View>
          <View style={s.heroArt} accessible accessibilityRole="image"
            accessibilityLabel={restricted ? "Reputação com restrições" : unavailable ? "Sem histórico de reputação" : emblem === "verified" ? "Identidade verificada" : "Indicador de reputação, sem selo de identidade verificada"}>
            <SafeScoreEmblem theme={theme} state={emblem} size={width < 360 ? 88 : 126} />
          </View>
        </View>
        <Text style={s.caption}>{restricted || unavailable ? data.mensagem : "Seu histórico de confiança na Dular."}</Text>

        <Text accessibilityRole="header" style={s.section}>Seu perfil em detalhes</Text>
        <View style={[s.card, s.details]}>
          {metric("Award", "Nível atual", "Sua jornada na plataforma", (
            <View style={s.tierValue}>
              {reputation && <SafeScoreMedal tier={reputation.tier} />}
              <Text style={s.value}>{reputation?.nivel ?? "Ainda não calculado"}</Text>
            </View>
          ))}
          {metric("ClipboardCheck", "Serviços concluídos", "Histórico de atendimentos", <Text style={s.value}>{data.totalServicos}</Text>)}
          {metric("IdCard", "Identidade", "Verificação do perfil", (
            <View style={[s.identityBadge, { backgroundColor: identityApproved ? theme.primarySoft : identityRejected ? colors.dangerSoft : "#FFF0D0" }]}>
              <Text style={[s.identityValue, { color: identityApproved ? theme.textAccent : identityRejected ? colors.danger : "#8C4D16" }]}>{IDENTITY_LABELS[data.identidade]}</Text>
            </View>
          ), false)}
        </View>

        {!identityApproved && <Pressable accessibilityRole="button" onPress={onIdentity}
          style={({ pressed }) => [s.card, s.identityAction, pressed && { opacity: 0.75 }]}>
          <View style={s.icon}><AppIcon name="IdCard" size={25} color={theme.textAccent} strokeWidth={1.8} /></View>
          <View style={s.rowContent}>
            <Text style={s.identityTitle}>{data.identidade === "PENDENTE" ? "Acompanhe sua verificação" : identityRejected ? "Revise sua documentação" : "Verifique sua identidade"}</Text>
            <Text style={s.rowDescription}>{data.identidade === "PENDENTE" ? "Seus documentos estão em análise" : "Complete esta etapa do seu perfil"}</Text>
          </View>
          <AppIcon name="ChevronRight" size={20} color={theme.textAccent} />
        </Pressable>}
      </>}

      <View style={s.sectionRow}>
        <Text accessibilityRole="header" style={s.sectionHeading}>Acompanhamento de SOS</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Como funciona o acompanhamento de SOS" onPress={onGuide} hitSlop={8} style={s.infoButton}>
          <AppIcon name="Info" size={19} color={theme.textAccent} strokeWidth={1.8} />
        </Pressable>
      </View>
      <View style={[s.card, sos.data?.length === 0 && s.empty]}>
        <ResourceFeedback resource={sos} theme={theme} label="o acompanhamento de SOS" />
        {sos.data?.length === 0 && <>
          <View style={s.emptyIcon}><AppIcon name="Bell" color={theme.textAccent} size={28} strokeWidth={1.8} /></View>
          <Text style={s.emptyTitle}>Nenhum SOS acionado</Text>
          <Text style={s.emptyDescription}>Se você acionar o SOS, acompanhe o status e o protocolo por aqui.</Text>
        </>}
        {sos.data && sos.data.length > 0 && <>
          <Text style={s.body}>Registros mais recentes (até 50)</Text>
          {sos.data.map((event, index) => <View key={event.id} style={[s.sosItem, index < sos.data!.length - 1 && s.divider]}>
            <Text selectable style={[s.value, { textAlign: "left" }]}>{protocoloFromId(event.id)}</Text>
            <Text style={s.badge}>{event.statusLabel ?? "Status indisponível"}</Text>
            <Text style={s.body}>Acionado em {new Date(event.createdAt).toLocaleString("pt-BR")}</Text>
            {event.meta?.tipo && <Text style={s.body}>Tipo: {event.meta.tipo}</Text>}
            {event.meta?.prioridade && <Text style={s.body}>Prioridade informada: {event.meta.prioridade}</Text>}
            {event.statusAtualizadoEm && <Text style={s.body}>Atualizado em {new Date(event.statusAtualizadoEm).toLocaleString("pt-BR")}</Text>}
          </View>)}
        </>}
      </View>
      <SafeScoreLink title="Como funciona o SafeScore" theme={theme} onPress={onGuide} />
    </Screen>
  );
}
