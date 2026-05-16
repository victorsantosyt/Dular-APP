import React from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { AppIcon, type AppIconName, DAvatar } from "@/components/ui";
import { colors, radius, shadows } from "@/theme";

export function ClientePhoneImage() {
  return <PersonScene initials="CA" icon="Phone" tone="purple" />;
}

export function ClienteRelaxImage() {
  return <PersonScene initials="CL" icon="Heart" tone="pink" />;
}

export function ClienteCoffeePhoneImage() {
  return <PersonScene initials="CM" icon="MessageCircle" tone="purple" />;
}

export function DiaristaCleaningImage() {
  return <PersonScene initials="DS" icon="Sparkles" tone="pink" apron />;
}

export function DiaristaSmilingImage() {
  return <PersonScene initials="DL" icon="Star" tone="pink" apron />;
}

export function DiaristaTowelsImage() {
  return <PersonScene initials="DT" icon="ShieldCheck" tone="purple" apron />;
}

export function DiaristaWorkingImage() {
  return <PersonScene initials="DW" icon="Calendar" tone="purple" apron />;
}

function PersonScene({
  initials,
  icon,
  tone,
  apron,
}: {
  initials: string;
  icon: AppIconName;
  tone: "purple" | "pink";
  apron?: boolean;
}) {
  const main = tone === "pink" ? colors.pink : colors.primary;
  const soft = tone === "pink" ? colors.pinkSoft : colors.primaryLight;

  return (
    <LinearGradient colors={[soft, colors.white]} style={styles.scene}>
      <View style={[styles.blob, { backgroundColor: `${main}16` }]} />
      <View style={styles.personWrap}>
        <DAvatar size="xl" initials={initials} online={tone === "pink"} />
        {apron ? <View style={styles.apron} /> : null}
      </View>
      <View style={[styles.iconBadge, { backgroundColor: main }]}>
        <AppIcon name={icon} size={20} color={colors.white} strokeWidth={2.4} />
      </View>
      <View style={[styles.smallDot, { backgroundColor: colors.pink }]} />
      <View style={[styles.smallDotTwo, { backgroundColor: colors.primary }]} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  scene: {
    width: "100%",
    height: 180,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    ...shadows.soft,
  },
  blob: {
    position: "absolute",
    width: 190,
    height: 132,
    borderRadius: 64,
    right: -38,
    bottom: -8,
    transform: [{ rotate: "-11deg" }],
  },
  personWrap: {
    width: 96,
    height: 108,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  apron: {
    position: "absolute",
    bottom: 9,
    width: 34,
    height: 25,
    borderRadius: 9,
    backgroundColor: "rgba(20,16,60,0.5)",
  },
  iconBadge: {
    position: "absolute",
    right: 24,
    top: 24,
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: colors.white,
    ...shadows.soft,
  },
  smallDot: {
    position: "absolute",
    left: 34,
    top: 38,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  smallDotTwo: {
    position: "absolute",
    left: 24,
    bottom: 44,
    width: 7,
    height: 7,
    borderRadius: 4,
  },
});
