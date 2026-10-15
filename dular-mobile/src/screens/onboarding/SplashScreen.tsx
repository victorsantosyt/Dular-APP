import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

// ─── Constants ───────────────────────────────────────────────────────────────

const LOGO_SIZE = 550;

const DURATION_PULSE  = 2600;
const DURATION_FLOAT  = 5200;

const C = {
  bg1:    "#F7F5FF",
  bg2:    "#EDE8FF",
  bg3:    "#DDD5FF",
  shape1: "rgba(108, 77, 255, 0.07)",
  shape2: "rgba(79,  53, 216, 0.05)",
  shape3: "rgba(233,138, 203, 0.05)",
  dot1:   "rgba(108, 77, 255, 0.18)",
  dot2:   "rgba(108, 77, 255, 0.11)",
};

const logoImg = require("../../../assets/adaptive-icon.png");

type SplashScreenProps = {
  onReady?: () => void;
};

// ─── Screen ──────────────────────────────────────────────────────────────────

export function SplashScreen({ onReady }: SplashScreenProps) {
  const [layoutReady, setLayoutReady] = useState(false);
  const [imageReady, setImageReady] = useState(false);
  const shape1Y       = useRef(new Animated.Value(0)).current;
  const shape2Y       = useRef(new Animated.Value(0)).current;
  const logoPulse     = useRef(new Animated.Value(1)).current;
  const dot1Y         = useRef(new Animated.Value(0)).current;
  const dot2Y         = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Mantém o movimento suave da arte oficial durante o carregamento.
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

    const animations = [
      floatLoop(shape1Y, 1),
      floatLoop(shape2Y, -1),
      floatLoop(dot1Y, 1),
      floatLoop(dot2Y, -1),
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
        ]),
      ),
    ];
    animations.forEach((animation) => animation.start());
    return () => animations.forEach((animation) => animation.stop());
  }, [dot1Y, dot2Y, logoPulse, shape1Y, shape2Y]);

  useEffect(() => {
    if (layoutReady && imageReady) onReady?.();
  }, [imageReady, layoutReady, onReady]);

  return (
    <View style={styles.root} onLayout={() => setLayoutReady(true)}>
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
          style={[styles.logo, { transform: [{ scale: logoPulse }] }]}
          onLoadEnd={() => setImageReady(true)}
          onError={() => setImageReady(true)}
          resizeMode="contain"
        />
      </View>
    </View>
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
    backgroundColor: C.bg1,
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

});
