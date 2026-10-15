import React, { useMemo } from "react";
import { Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Screen } from "@/components/Screen";
import { AppIcon, BackCircleButton, type AppIconName } from "@/components/ui";
import { useProfileTheme } from "@/hooks/useProfileTheme";
import { useSafeScoreResource } from "@/hooks/useSafeScoreResource";
import { getSafeScoreOverview } from "@/api/safeScoreOverviewApi";
import { listarEventosSeguranca, protocoloFromId } from "@/api/segurancaApi";
import { makeSafeScoreStyles, ResourceFeedback, SafeScoreLink } from "./safeScoreLayout";

const loadSos = () => listarEventosSeguranca("SOS_SILENT", 50);
const identityLabels = { VERIFICADO: "Verificada", PENDENTE: "Em análise", REPROVADO: "Reprovada", NAO_ENVIADO: "Não enviada" };

export default function SafeScoreScreen() {
  const nav = useNavigation<any>();
  const theme = useProfileTheme();
  const s = useMemo(() => makeSafeScoreStyles(theme), [theme]);
  const overview = useSafeScoreResource(getSafeScoreOverview);
  const sos = useSafeScoreResource(loadSos);
  const data = overview.data;
  const reputation = data?.reputation;
  const limited = reputation?.bloqueado || data?.restrito;
  const row = (icon: AppIconName, label: string, value: string, divider = true) => <View style={[s.row, divider && s.divider]}>
    <View style={s.icon}><AppIcon name={icon} size={22} color={theme.textAccent} /></View>
    <View style={s.rowContent}><Text style={s.label}>{label}</Text><Text style={s.value}>{value}</Text></View>
  </View>;
  return <Screen title="SafeScore" leftAction={<BackCircleButton onPress={() => nav.goBack()} color={theme.icon} borderColor={theme.border} />} contentStyle={{ gap: 16 }}>
    <ResourceFeedback resource={overview} theme={theme} label="seu SafeScore" />
    {data && <>
      <View style={[s.card, s.hero]}>
        <View style={s.shield}><AppIcon name={limited ? "AlertTriangle" : "Shield"} size={64} color={limited ? "warning" : theme.textAccent} strokeWidth={1.7} /></View>
        <Text style={s.title}>{data.status ?? "SafeScore indisponível"}</Text>
        <Text style={[s.body, s.center]}>{data.mensagem}</Text>
      </View>
      <Text style={s.section}>Seu perfil em detalhes</Text>
      <View style={[s.card, { paddingVertical: 0 }]}>
        {row("Award", "Nível / selo", reputation?.nivel ?? "Indisponível")}
        {row("CheckCircle", "Serviços concluídos", String(data.totalServicos))}
        {row(data.identidade === "VERIFICADO" ? "ShieldCheck" : "FileText", "Identidade", identityLabels[data.identidade], false)}
        {data.identidade !== "VERIFICADO" && <SafeScoreLink theme={theme}
          title={data.identidade === "PENDENTE" ? "Acompanhar verificação" : data.identidade === "REPROVADO" ? "Revisar documentação" : "Verificar minha identidade"}
          onPress={() => nav.navigate("VerificacaoDocs")} />}
      </View>
    </>}
    <Text style={s.section}>Acompanhamento de SOS</Text>
    <View style={s.card}>
      <ResourceFeedback resource={sos} theme={theme} label="o acompanhamento de SOS" />
      {sos.data?.length === 0 && <>
        <View style={s.icon}><AppIcon name="Bell" color={theme.textAccent} size={24} /></View>
        <Text style={s.value}>Nenhum SOS acionado</Text>
        <Text style={s.body}>Seus registros e protocolos aparecerão aqui após um acionamento pelo fluxo de SOS.</Text>
      </>}
      {sos.data && sos.data.length > 0 && <>
        <Text style={s.body}>Registros mais recentes (até 50)</Text>
        {sos.data.map((event, index) => <View key={event.id} style={[{ gap: 8, paddingVertical: 12 }, index < sos.data!.length - 1 && s.divider]}>
          <Text selectable style={s.value}>{protocoloFromId(event.id)}</Text>
          <Text style={s.badge}>{event.statusLabel ?? "Status indisponível"}</Text>
          <Text style={s.body}>Acionado em {new Date(event.createdAt).toLocaleString("pt-BR")}</Text>
          {event.meta?.tipo && <Text style={s.body}>Tipo: {event.meta.tipo}</Text>}
          {event.meta?.prioridade && <Text style={s.body}>Prioridade informada: {event.meta.prioridade}</Text>}
          {event.statusAtualizadoEm && <Text style={s.body}>Atualizado em {new Date(event.statusAtualizadoEm).toLocaleString("pt-BR")}</Text>}
        </View>)}
      </>}
    </View>
    <View style={[s.card, { paddingVertical: 4 }]}><SafeScoreLink title="Como funciona o SafeScore" theme={theme} onPress={() => nav.navigate("SafeScoreGuide")} /></View>
  </Screen>;
}
