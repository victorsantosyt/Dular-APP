import { StyleSheet } from "react-native";
import { Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { DularLogoWhite } from "@/assets/brand";
import { AppIcon } from "@/components/ui";
import { colors } from "@/theme/tokens";

export function DularSplashScreen() {
  return (
    <LinearGradient
      colors={[colors.primary, colors.primaryDark, colors.primaryDeep2]}
      start={{ x: 0.08, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={styles.splash}
    >
      <View style={styles.splashBg}>
        <View style={[styles.splashShape, styles.splashShapeTop]} />
        <View style={[styles.splashShape, styles.splashShapeLeft]} />
        <View style={[styles.splashShape, styles.splashShapeBottom]} />

        <View style={styles.splashCenter}>
          <DularLogoWhite size="lg" />
          <Text allowFontScaling={false} style={styles.splashTitle}>
            Conexões que{"\n"}facilitam <Text style={styles.splashTitleAccent}>sua rotina.</Text>
          </Text>
        </View>

        <View style={styles.splashHeart}>
          <AppIcon name="Heart" size={22} color={colors.pinkBright} strokeWidth={2.8} />
        </View>
      </View>
    </LinearGradient>
  );
}

export default DularSplashScreen;

const styles = StyleSheet.create({
  splash: {
    flex: 1,
  },
  splashBg: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  splashShape: {
    position: "absolute",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  splashShapeTop: {
    width: 220,
    height: 220,
    borderRadius: 110,
    top: -52,
    right: -48,
  },
  splashShapeLeft: {
    width: 160,
    height: 160,
    borderRadius: 80,
    left: -70,
    top: 172,
  },
  splashShapeBottom: {
    width: 280,
    height: 280,
    borderRadius: 140,
    right: -132,
    bottom: -72,
  },
  splashCenter: {
    alignItems: "center",
    paddingHorizontal: 32,
  },
  splashTitle: {
    marginTop: 26,
    color: colors.white,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: -0.6,
  },
  splashTitleAccent: {
    color: colors.pinkBright,
  },
  splashHeart: {
    position: "absolute",
    bottom: 54,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
});
