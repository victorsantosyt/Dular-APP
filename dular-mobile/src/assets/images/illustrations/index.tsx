import React from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Calendar3DIcon, LoginSecurity3DIcon, Megaphone3DIcon, PaperPlane3DIcon, SafeScoreIcon, Shield3DIcon, Wallet3DIcon } from "@/assets/icons";
import { AppIcon, DAvatar } from "@/components/ui";
import { colors, radius, shadows } from "@/theme";

export function OnboardingSecurityImage() {
  return <Shield3DIcon size={150} />;
}

export function OnboardingCalendarImage() {
  return <Calendar3DIcon size={150} />;
}

export function OnboardingLoginSecurityImage() {
  return <LoginSecurity3DIcon size={180} />;
}

export function SosSendingImage() {
  return <PaperPlane3DIcon size={150} />;
}

export function PaymentWalletImage() {
  return <Wallet3DIcon size={150} />;
}

export function ProfileSelectionClientImage() {
  return <ProfileSelectionImage initials="CL" tone="purple" />;
}

export function ProfileSelectionDiaristaImage() {
  return <ProfileSelectionImage initials="DI" tone="pink" />;
}

export function SafeScoreImage() {
  return <SafeScoreIcon size={150} />;
}

export function SupportMegaphoneImage() {
  return <Megaphone3DIcon size={150} />;
}

function ProfileSelectionImage({ initials, tone }: { initials: string; tone: "purple" | "pink" }) {
  const main = tone === "purple" ? colors.primary : colors.pink;
  const soft = tone === "purple" ? colors.primaryLight : colors.pinkSoft;
  const icon = tone === "purple" ? "User" : "BriefcaseBusiness";

  return (
    <LinearGradient colors={[soft, colors.white]} style={styles.profileScene}>
      <View style={[styles.blob, { backgroundColor: `${main}14` }]} />
      <View style={styles.personWrap}>
        <DAvatar size="xl" initials={initials} online={tone === "pink"} />
      </View>
      <View style={[styles.badge, { backgroundColor: main }]}>
        <AppIcon name={icon} size={19} color={colors.white} strokeWidth={2.4} />
      </View>
      <View style={[styles.baseShadow, { backgroundColor: `${main}18` }]} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  profileScene: {
    width: "100%",
    height: 150,
    borderRadius: radius.xl,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  blob: {
    position: "absolute",
    right: -18,
    bottom: -12,
    width: 164,
    height: 110,
    borderRadius: 48,
    transform: [{ rotate: "-9deg" }],
  },
  personWrap: {
    marginTop: 10,
  },
  badge: {
    position: "absolute",
    right: 18,
    top: 16,
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: colors.white,
    ...shadows.soft,
  },
  baseShadow: {
    position: "absolute",
    bottom: 22,
    width: 118,
    height: 18,
    borderRadius: 999,
  },
});
