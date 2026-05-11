import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  StyleSheet,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { OnboardingStackParamList } from "@/navigation/OnboardingNavigator";

// ─── Constants ───────────────────────────────────────────────────────────────

const { width: W } = Dimensions.get("window");
const LOGO_SIZE = 550;

const DURATION_BG     = 700;
const DURATION_LOGO   = 900;
const DELAY_LOGO      = 280;
const DURATION_PULSE  = 2600;
const DURATION_FLOAT  = 5200;
const NAVIGATE_AFTER  = 5000;

const C = {
  bg1:    "#F7F5FF",
  bg2:    "#EDE8FF",
  bg3:    "#DDD5FF",
  shape1: "rgba(108, 77, 255, 0.07)",
  shape2: "rgba(79,  53, 216, 0.05)",
  shape3: "rgba(233,138, 203, 0.05)",
  dot1:   "rgba(108, 77, 255, 0.18)",
  dot2:   "rgba(108, 77, 255, 0.11)",
  indicator: "rgba(108, 77, 255, 0.20)",
};

const logoImg = require("../../../assets/adaptive-icon.png");

type Navigation = NativeStackNavigationProp<OnboardingStackParamList>;

// ─── Screen ──────────────────────────────────────────────────────────────────

export function SplashScreen() {
  const navigation = useNavigation<Navigation>();

  const bgOpacity     = useRef(new Animated.Value(0)).current;
  const shape1Y       = useRef(new Animated.Value(0)).current;
  const shape2Y       = useRef(new Animated.Value(0)).current;
  const logoScale     = useRef(new Animated.Value(0.88)).current;
  const logoOpacity   = useRef(new Animated.Value(0)).current;
  const logoPulse     = useRef(new Animated.Value(1)).current;
  const dot1Y         = useRef(new Animated.Value(0)).current;
  const dot2Y         = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 1. Background fade in
    Animated.timing(bgOpacity, {
      toValue: 1,
      duration: DURATION_BG,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();

    // 2. Organic shapes — slow breathing float
    const floatLoop = (anim: Animated.Value, dir: 1 | -1) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: dir * 6,
            duration: DURATION_FLOAT,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: dir * -6,
            duration: DURATION_FLOAT,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      );

    floatLoop(shape1Y, 1).start();
    floatLoop(shape2Y, -1).start();
    floatLoop(dot1Y, 1).start();
    floatLoop(dot2Y, -1).start();

    // 3. Logo reveal — scale + opacity, premium easing
    Animated.parallel([
      Animated.timing(logoScale, {
        toValue: 1,
        duration: DURATION_LOGO,
        delay: DELAY_LOGO,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: DURATION_LOGO,
        delay: DELAY_LOGO,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(() => {
      // 4. Soft pulse after reveal
      Animated.loop(
        Animated.sequence([
          Animated.timing(logoPulse, {
            toValue: 1.015,
            duration: DURATION_PULSE,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(logoPulse, {
            toValue: 1,
            duration: DURATION_PULSE,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      ).start();
    });

    const timer = setTimeout(() => navigation.replace("Welcome"), NAVIGATE_AFTER);
    return () => clearTimeout(timer);
  }, [bgOpacity, dot1Y, dot2Y, logoOpacity, logoPulse, logoScale, navigation, shape1Y, shape2Y]);

  const combinedScale = Animated.multiply(logoScale, logoPulse);

  return (
    <Animated.View style={[styles.root, { opacity: bgOpacity }]}>
      <LinearGradient
        colors={[C.bg1, C.bg2, C.bg3]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* ── Organic corner shapes ── */}
      <Animated.View
        style={[styles.shape, styles.shapeTL, { transform: [{ translateY: shape1Y }] }]}
      />
      <Animated.View
        style={[styles.shape, styles.shapeBR, { transform: [{ translateY: shape2Y }] }]}
      />
      <Animated.View
        style={[styles.shape, styles.shapeTR, { transform: [{ translateY: shape2Y }] }]}
      />

      {/* ── Minimal floating dots ── */}
      <Animated.View style={[styles.dot, styles.dot1, { transform: [{ translateY: dot1Y }] }]} />
      <Animated.View style={[styles.dot, styles.dot2, { transform: [{ translateY: dot2Y }] }]} />

      {/* ── Logo ── */}
      <View style={styles.center}>
        <Animated.Image
          source={logoImg}
          style={[styles.logo, { transform: [{ scale: combinedScale }], opacity: logoOpacity }]}
          resizeMode="contain"
        />
      </View>

      {/* ── Home indicator ── */}
      <View style={styles.homeIndicator} />
    </Animated.View>
  );
}

export default SplashScreen;

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  // Organic shapes
  shape: {
    position: "absolute",
  },
  shapeTL: {
    width: 300,
    height: 300,
    top: -100,
    left: -100,
    borderBottomRightRadius: 200,
    borderTopRightRadius: 80,
    borderBottomLeftRadius: 60,
    backgroundColor: C.shape1,
  },
  shapeBR: {
    width: 340,
    height: 340,
    bottom: -120,
    right: -120,
    borderTopLeftRadius: 220,
    borderBottomLeftRadius: 60,
    borderTopRightRadius: 80,
    backgroundColor: C.shape2,
  },
  shapeTR: {
    width: 200,
    height: 200,
    top: -60,
    right: -60,
    borderBottomLeftRadius: 160,
    borderTopLeftRadius: 40,
    borderBottomRightRadius: 40,
    backgroundColor: C.shape3,
  },

  // Minimal dots
  dot: {
    position: "absolute",
    borderRadius: 999,
  },
  dot1: {
    width: 8,
    height: 8,
    backgroundColor: C.dot1,
    top: "24%",
    left: "14%",
  },
  dot2: {
    width: 6,
    height: 6,
    backgroundColor: C.dot2,
    bottom: "28%",
    right: "16%",
  },

  // Logo
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  },

  // Home indicator
  homeIndicator: {
    position: "absolute",
    bottom: 18,
    width: 120,
    height: 4,
    borderRadius: 999,
    backgroundColor: C.indicator,
  },
});
