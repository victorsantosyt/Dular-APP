import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  Baby,
  BarChart3,
  Bell,
  BriefcaseBusiness,
  Calendar,
  Car,
  Camera,
  Check,
  CheckCircle,
  ChevronRight,
  Clock,
  CreditCard,
  Crown,
  Diamond,
  Download,
  Eye,
  FileText,
  Flame,
  Gem,
  Gift,
  Heart,
  HelpCircle,
  Home,
  Image,
  Info,
  Lock,
  LogOut,
  MapPin,
  Megaphone,
  MessageCircle,
  Mic,
  MoreHorizontal,
  Paperclip,
  Plus,
  Search,
  Send,
  Share2,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Sprout,
  Shirt,
  User,
  Video,
  Wallet,
  WashingMachine,
  Wrench,
  XCircle,
  ChefHat,
  Phone,
} from "lucide-react-native";
import { colors, gradients } from "@/theme";

const ICONS = {
  AlertTriangle,
  ArrowLeft,
  Award,
  Baby,
  BarChart3,
  Bell,
  BriefcaseBusiness,
  Calendar,
  Car,
  Camera,
  Check,
  CheckCircle,
  ChevronRight,
  Clock,
  CreditCard,
  Crown,
  Diamond,
  Download,
  Eye,
  FileText,
  Flame,
  Gem,
  Gift,
  Heart,
  HelpCircle,
  Home,
  Image,
  Info,
  Lock,
  LogOut,
  MapPin,
  Megaphone,
  MessageCircle,
  Mic,
  MoreHorizontal,
  Paperclip,
  Phone,
  Plus,
  Search,
  Send,
  Share2,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Sprout,
  Shirt,
  User,
  Video,
  Wallet,
  WashingMachine,
  Wrench,
  XCircle,
  ChefHat,
} as const;

type IconTone =
  | "active"
  | "inactive"
  | "muted"
  | "purple"
  | "pink"
  | "green"
  | "red"
  | "yellow"
  | "blue"
  | "danger"
  | "success"
  | "warning";
type IconVariant = "outline" | "filled" | "soft" | "danger" | "success" | "warning" | "pink" | "purple";

type Props = {
  name: keyof typeof ICONS;
  size?: number;
  color?: IconTone | string;
  strokeWidth?: number;
  variant?: IconVariant;
  background?: boolean;
  style?: ViewStyle;
};

const TONE = {
  active: { fg: colors.primary, bg: colors.lavenderSoft, gradient: gradients.button },
  inactive: { fg: colors.textSecondary, bg: colors.lavenderSoft, gradient: gradients.button },
  muted: { fg: colors.textMuted, bg: colors.lavenderSoft, gradient: gradients.button },
  purple: { fg: colors.primary, bg: colors.lavenderSoft, gradient: gradients.button },
  pink: { fg: colors.notification, bg: colors.dangerSoft, gradient: gradients.pink },
  green: { fg: colors.success, bg: colors.successSoft, gradient: [colors.success, colors.successDark] as const },
  red: { fg: colors.danger, bg: colors.dangerSoft, gradient: gradients.danger },
  yellow: { fg: colors.warning, bg: colors.warningSoft, gradient: [colors.warning, colors.warning] as const },
  blue: { fg: colors.info, bg: colors.lavender, gradient: [colors.info, colors.primary] as const },
  danger: { fg: colors.danger, bg: colors.dangerSoft, gradient: gradients.danger },
  success: { fg: colors.success, bg: colors.successSoft, gradient: [colors.success, colors.successDark] as const },
  warning: { fg: colors.warning, bg: colors.warningSoft, gradient: [colors.warning, colors.warning] as const },
} as const;

function resolveTone(color: Props["color"], variant: IconVariant) {
  if (variant === "danger") return TONE.danger;
  if (variant === "success") return TONE.success;
  if (variant === "warning") return TONE.warning;
  if (variant === "pink") return TONE.pink;
  if (variant === "purple") return TONE.purple;
  if (color && color in TONE) return TONE[color as IconTone];
  return TONE.purple;
}

export function AppIcon({
  name,
  size = 24,
  color = "purple",
  strokeWidth = 2.2,
  variant = "outline",
  background,
  style,
}: Props) {
  const Icon = ICONS[name];
  const tone = resolveTone(color, variant);
  const explicitColor = typeof color === "string" && !(color in TONE) ? color : null;
  const hasBubble = background || variant === "soft" || variant === "filled";
  const boxSize = Math.round(size * 1.92);
  const iconColor = variant === "filled" ? colors.white : explicitColor ?? tone.fg;

  if (variant === "filled") {
    return (
      <LinearGradient colors={tone.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.box, { width: boxSize, height: boxSize, borderRadius: boxSize / 2 }, style]}>
        <Icon size={size} color={iconColor} strokeWidth={strokeWidth} />
      </LinearGradient>
    );
  }

  if (hasBubble) {
    return (
      <View style={[styles.box, { width: boxSize, height: boxSize, borderRadius: boxSize / 2, backgroundColor: tone.bg }, style]}>
        <Icon size={size} color={iconColor} strokeWidth={strokeWidth} />
      </View>
    );
  }

  return <Icon size={size} color={iconColor} strokeWidth={strokeWidth} />;
}

export type AppIconName = keyof typeof ICONS;

const styles = StyleSheet.create({
  box: {
    alignItems: "center",
    justifyContent: "center",
  },
});
