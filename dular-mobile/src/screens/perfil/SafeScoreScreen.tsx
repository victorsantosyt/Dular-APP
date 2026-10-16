import React from "react";
import { useNavigation } from "@react-navigation/native";
import { useProfileTheme } from "@/hooks/useProfileTheme";
import { useSafeScoreResource } from "@/hooks/useSafeScoreResource";
import { getSafeScoreOverview } from "@/api/safeScoreOverviewApi";
import { listarEventosSeguranca } from "@/api/segurancaApi";
import { SafeScoreView } from "./SafeScoreView";

const loadSos = () => listarEventosSeguranca("SOS_SILENT", 50);

export default function SafeScoreScreen() {
  const nav = useNavigation<any>();
  const theme = useProfileTheme();
  const overview = useSafeScoreResource(getSafeScoreOverview);
  const sos = useSafeScoreResource(loadSos);

  return <SafeScoreView
    theme={theme}
    overview={overview}
    sos={sos}
    onBack={() => nav.goBack()}
    onIdentity={() => nav.navigate("VerificacaoDocs")}
    onGuide={() => nav.navigate("SafeScoreGuide")}
  />;
}
