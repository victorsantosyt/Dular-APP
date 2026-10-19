import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowUpRight, Sparkles } from "lucide-react-native";
import * as Application from "expo-application";
import { useAppUpdate } from "@/hooks/useAppUpdate";
import { useProfileTheme } from "@/hooks/useProfileTheme";
import { useDularColors } from "@/hooks/useDularColors";
import { radius, spacing } from "@/theme";

export function AppUpdatePrompt({ enabled }: { enabled: boolean }) {
  const { release, recolhido, opening, error, dismiss, update } = useAppUpdate(enabled);
  const palette = useProfileTheme();
  const colors = useDularColors();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const progress = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (mounted) setReduceMotion(value); }).catch(() => { if (mounted) setReduceMotion(true); });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => { mounted = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    progress.stopAnimation();
    if (!release || reduceMotion === null) { progress.setValue(0); return; }
    if (reduceMotion) { progress.setValue(1); return; }
    progress.setValue(0);
    const animation = Animated.timing(progress, { toValue: 1, duration: 320, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [progress, reduceMotion, release]);

  if (!release || reduceMotion === null) return null;

  // Depois de "Atualizar": sem popup a cada retorno da loja, mas com uma ação
  // acessível para abrir a loja de novo (e "Agora não" para adiar 24 h).
  if (recolhido) {
    return (
      <View pointerEvents="box-none" style={[styles.faixaArea, { top: insets.top + spacing.sm }]}>
        <View accessibilityRole="summary" style={[styles.faixa, { backgroundColor: colors.surface, borderColor: palette.primarySoft }]}>
          <Text style={[styles.faixaTexto, { color: colors.textPrimary }]} numberOfLines={2}>Nova versão do Dular disponível</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Abrir a Google Play de novo para atualizar" accessibilityState={{ disabled: opening, busy: opening }} disabled={opening} onPress={() => { void update(); }} style={[styles.faixaBotao, { backgroundColor: palette.primaryDark }]}>
            <Text style={[styles.faixaBotaoTexto, { color: colors.white }]}>{opening ? "Abrindo…" : "Atualizar"}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Agora não" onPress={dismiss} style={styles.faixaBotao}>
            <Text style={[styles.faixaBotaoTexto, { color: colors.textSecondary }]}>Agora não</Text>
          </Pressable>
        </View>
        {error && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.faixaErro, { color: colors.danger, backgroundColor: colors.surface }]}>{error}</Text>}
      </View>
    );
  }
  const versionLabel = release.versionName === Application.nativeApplicationVersion
    ? `${release.versionName} · versão ${release.versionCode}`
    : release.versionName;

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={dismiss}>
      <View style={[styles.overlay, { backgroundColor: colors.overlay, paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.md }]}>
        <Animated.View accessibilityViewIsModal style={[styles.card, { maxHeight: Math.max(160, height - insets.top - insets.bottom - spacing.md * 2), backgroundColor: colors.surface, opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }, { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }] }]}>
          <ScrollView contentContainerStyle={styles.content} bounces={false}>
            <View style={[styles.icon, { backgroundColor: palette.primarySoft }]}><Sparkles size={34} color={palette.primary} accessible={false} /></View>
            <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>Tem novidade no Dular</Text>
            <Text style={[styles.version, { color: palette.textAccent }]}>Versão {versionLabel} disponível</Text>
            <Text style={[styles.body, { color: colors.textSecondary }]}>Uma nova versão está disponível na Google Play. Atualize para continuar com o Dular em dia.</Text>
            {release.notes.length > 0 && <View style={styles.notes}>
              <Text style={[styles.notesTitle, { color: colors.textPrimary }]}>O que mudou</Text>
              {release.notes.map((note, index) => <Text key={`${index}-${note}`} style={[styles.body, { color: colors.textSecondary }]}>• {note}</Text>)}
            </View>}
            {error && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.body, { color: colors.danger }]}>{error}</Text>}
            <Pressable accessibilityRole="button" accessibilityLabel="Atualizar na Google Play" accessibilityState={{ disabled: opening, busy: opening }} disabled={opening} onPress={() => { void update(); }} style={({ pressed }) => [styles.button, { backgroundColor: palette.primaryDark, opacity: pressed || opening ? 0.75 : 1 }]}>
              <Text style={[styles.buttonText, { color: colors.white }]}>{opening ? "Abrindo Google Play…" : "Atualizar"}</Text>
              <ArrowUpRight color={colors.white} size={22} accessible={false} />
            </Pressable>
            <Pressable accessibilityRole="button" onPress={dismiss} style={styles.button}><Text style={[styles.buttonText, { color: colors.textSecondary }]}>Agora não</Text></Pressable>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: spacing.lg },
  card: { width: "100%", maxWidth: 440, borderRadius: radius.xxl, overflow: "hidden" },
  content: { padding: spacing.lg, gap: spacing.md },
  icon: { width: 72, height: 72, borderRadius: radius.xl, alignItems: "center", justifyContent: "center", alignSelf: "center" },
  title: { fontSize: 25, lineHeight: 33, fontWeight: "700", textAlign: "center" },
  version: { fontSize: 15, lineHeight: 22, fontWeight: "600", textAlign: "center" },
  body: { fontSize: 16, lineHeight: 24 },
  notes: { gap: spacing.sm },
  notesTitle: { fontSize: 17, fontWeight: "600" },
  button: { minHeight: 52, padding: spacing.md, borderRadius: radius.lg, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  buttonText: { fontSize: 16, fontWeight: "700", flexShrink: 1, textAlign: "center" },
  faixaArea: { position: "absolute", left: spacing.md, right: spacing.md, alignItems: "center", gap: spacing.xs },
  faixa: { width: "100%", maxWidth: 440, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.lg, borderWidth: 1, elevation: 6, shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  faixaTexto: { flex: 1, fontSize: 14, fontWeight: "600" },
  faixaBotao: { minHeight: 44, paddingHorizontal: spacing.md, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  faixaBotaoTexto: { fontSize: 14, fontWeight: "700" },
  faixaErro: { fontSize: 13, paddingHorizontal: spacing.sm, borderRadius: radius.sm },
});
