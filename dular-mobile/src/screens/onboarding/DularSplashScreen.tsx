import { useEffect } from "react";
import { Image, ImageBackground, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { onboardingAssets } from "@/assets/onboardingAssets";
import { AppIcon } from "@/components/ui";

const colors = {
  pink: "#FF3F86",
};

export function DularSplashScreen() {
  useEffect(() => {
    console.log("[SPLASH] mounted");
  }, []);

  return (
    <LinearGradient
      colors={["#7C3AED", "#5B25D9", "#4520B8"]}
      start={{ x: 0.08, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={styles.splash}
    >
      <ImageBackground
        source={onboardingAssets.splashBg}
        resizeMode="cover"
        imageStyle={styles.splashBgImage}
        style={styles.splashBg}
      >
        <View style={[styles.splashShape, styles.splashShapeTop]} />
        <View style={[styles.splashShape, styles.splashShapeLeft]} />
        <View style={[styles.splashShape, styles.splashShapeBottom]} />

        <View style={styles.splashCenter}>
          <Image source={onboardingAssets.logoLight} style={styles.logoLight} resizeMode="contain" />
          <Text allowFontScaling={false} style={styles.splashTitle}>
            Conexões que{"\n"}facilitam <Text style={styles.splashTitleAccent}>sua rotina.</Text>
          </Text>
        </View>

        <View style={styles.splashHeart}>
          <AppIcon name="Heart" size={22} color={colors.pink} strokeWidth={2.8} />
        </View>
      </ImageBackground>
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
  splashBgImage: {
    opacity: 0.34,
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
  logoLight: {
    width: 170,
    height: 72,
  },
  splashTitle: {
    marginTop: 26,
    color: "#FFFFFF",
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: -0.6,
  },
  splashTitleAccent: {
    color: colors.pink,
  },
  splashHeart: {
    position: "absolute",
    bottom: 54,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
});
