import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, Text, View } from "react-native";
import { colors, radius } from "@/theme/tokens";

type Props = { size?: "sm" | "md" | "lg" };

type SizeCfg = { iconW: number; iconH: number; fontSize: number };

const SIZE: Record<NonNullable<Props["size"]>, SizeCfg> = {
  sm: { iconW: 38, iconH: 28, fontSize: 18 },
  md: { iconW: 52, iconH: 38, fontSize: 22 },
  lg: { iconW: 72, iconH: 52, fontSize: 30 },
};

export function DularLogo({ size = "md" }: Props) {
  const cfg = SIZE[size];

  return (
    <View style={s.wrap}>
      <View style={[s.mark, { width: cfg.iconW, height: cfg.iconH }]}>
        <View style={[s.leafLeft, { backgroundColor: colors.green }]} />
        <View style={[s.leafCenter, { backgroundColor: colors.greenLight }]} />
        <View style={[s.leafRight, { backgroundColor: colors.greenDark }]} />
      </View>

      <View style={s.nameWrap}>
        <Text style={[s.name, { fontSize: cfg.fontSize }]}>dular.</Text>
        <LinearGradient
          colors={[colors.green, colors.greenDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[s.underline, { width: cfg.fontSize * 1.6 }]}
        />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    alignItems: "center",
    gap: 2,
  },
  mark: {
    position: "relative",
  },
  leafLeft: {
    position: "absolute",
    left: 4,
    bottom: 0,
    width: "34%",
    height: "82%",
    borderTopLeftRadius: radius.pill,
    borderTopRightRadius: radius.pill,
    borderBottomLeftRadius: radius.pill,
    transform: [{ rotate: "-26deg" }],
  },
  leafCenter: {
    position: "absolute",
    left: "41%",
    bottom: 0,
    width: "20%",
    height: "95%",
    borderTopLeftRadius: radius.pill,
    borderTopRightRadius: radius.pill,
    borderBottomLeftRadius: radius.pill,
    borderBottomRightRadius: radius.pill,
  },
  leafRight: {
    position: "absolute",
    right: 4,
    bottom: 0,
    width: "34%",
    height: "82%",
    borderTopLeftRadius: radius.pill,
    borderTopRightRadius: radius.pill,
    borderBottomRightRadius: radius.pill,
    transform: [{ rotate: "26deg" }],
  },
  nameWrap: {
    alignItems: "center",
  },
  name: {
    fontWeight: "700",
    color: colors.ink,
    letterSpacing: -0.5,
  },
  underline: {
    height: 3,
    borderRadius: radius.sm,
    marginTop: 2,
  },
});
