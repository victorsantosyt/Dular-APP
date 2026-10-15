import React, { useMemo } from "react";
import { Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Screen } from "@/components/Screen";
import { BackCircleButton } from "@/components/ui";
import { useProfileTheme } from "@/hooks/useProfileTheme";
import { useSafeScoreResource } from "@/hooks/useSafeScoreResource";
import { getSafeScoreOverview } from "@/api/safeScoreOverviewApi";
import { makeSafeScoreStyles, ResourceFeedback } from "./safeScoreLayout";

export default function SafeScoreGuideScreen() {
  const nav = useNavigation<any>();
  const theme = useProfileTheme();
  const s = useMemo(() => makeSafeScoreStyles(theme), [theme]);
  const resource = useSafeScoreResource(getSafeScoreOverview);
  return <Screen title="Como funciona o SafeScore" leftAction={<BackCircleButton onPress={() => nav.goBack()} color={theme.icon} borderColor={theme.border} />} contentStyle={{ gap: 16 }}>
    <ResourceFeedback resource={resource} theme={theme} label="as informações do SafeScore" />
    {resource.data?.guide.map(block => <View key={block.title} style={s.card}>
      <Text accessibilityRole="header" style={s.section}>{block.title}</Text>
      <Text style={s.body}>{block.text}</Text>
    </View>)}
  </Screen>;
}
