import React, { useMemo } from "react";
import { Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Screen } from "@/components/Screen";
import { BackCircleButton } from "@/components/ui";
import { useProfileTheme } from "@/hooks/useProfileTheme";
// Mesmo texto que o servidor usa (fonte única em shared/): abre sem rede e não
// depende do SafeScore pessoal.
import { SAFE_SCORE_GUIDE } from "../../../../shared/safescore/guia";
import { makeSafeScoreStyles } from "./safeScoreLayout";

export default function SafeScoreGuideScreen() {
  const nav = useNavigation<any>();
  const theme = useProfileTheme();
  const s = useMemo(() => makeSafeScoreStyles(theme), [theme]);
  return <Screen title="Como funciona o SafeScore" leftAction={<BackCircleButton onPress={() => nav.goBack()} color={theme.icon} borderColor={theme.border} />} contentStyle={{ gap: 16 }}>
    {SAFE_SCORE_GUIDE.map(block => <View key={block.title} style={s.card}>
      <Text accessibilityRole="header" style={s.section}>{block.title}</Text>
      <Text style={s.body}>{block.text}</Text>
    </View>)}
  </Screen>;
}
