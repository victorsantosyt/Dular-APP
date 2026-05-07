import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { DularLogoWhite } from "@/assets/brand";
import { AppIcon } from "@/components/ui";
import { colors, radius, spacing } from "@/theme";
import type { OnboardingStackParamList } from "@/navigation/OnboardingNavigator";

type Navigation = NativeStackNavigationProp<OnboardingStackParamList>;

export function SplashScreen() {
  const navigation = useNavigation<Navigation>();
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const heartScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(logoScale, {
      toValue: 1,
      useNativeDriver: true,
      tension: 70,
      friction: 8,
    }).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(heartScale, {
          toValue: 1.16,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(heartScale, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    ).start();

    const timer = setTimeout(() => {
      navigation.replace("Welcome");
    }, 2500);

    return () => clearTimeout(timer);
  }, [heartScale, logoScale, navigation]);

  return (
    <LinearGradient
      colors={[colors.primary, colors.primaryDark]}
      start={{ x: 0.18, y: 0 }}
      end={{ x: 0.82, y: 1 }}
      style={styles.root}
    >
      <View style={[styles.blob, styles.blobTop]} />
      <View style={[styles.blob, styles.blobMid]} />
      <View style={[styles.blob, styles.blobBottom]} />

      <Animated.View style={[styles.center, { transform: [{ scale: logoScale }] }]}>
        <DularLogoWhite size="lg" />
        <Text style={styles.tagline}>
          Conexões que <Text style={styles.taglineAccent}>facilitam</Text> sua rotina.
        </Text>
      </Animated.View>

      <Animated.View style={[styles.floatingHeart, { transform: [{ scale: heartScale }] }]}>
        <AppIcon name="Heart" size={18} color={colors.accentLight} strokeWidth={2.8} />
      </Animated.View>

      <View style={styles.homeIndicator} />
    </LinearGradient>
  );
}

export default SplashScreen;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  blob: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: colors.surface,
    opacity: 0.06,
  },
  blobTop: {
    top: -48,
    right: -36,
  },
  blobMid: {
    left: -70,
    top: 190,
  },
  blobBottom: {
    right: -80,
    bottom: 100,
  },
  center: {
    alignItems: "center",
    paddingHorizontal: spacing["3xl"],
  },
  tagline: {
    marginTop: spacing.lg,
    maxWidth: 260,
    textAlign: "center",
    color: colors.surface,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "500",
  },
  taglineAccent: {
    color: colors.accentLight,
    fontWeight: "700",
  },
  floatingHeart: {
    position: "absolute",
    bottom: 126,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  homeIndicator: {
    position: "absolute",
    bottom: spacing.lg,
    width: 120,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    opacity: 0.3,
  },
});
