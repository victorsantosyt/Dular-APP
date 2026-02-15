import { Dimensions } from "react-native";

const { width } = Dimensions.get("window");

export const dularColors = {
  bgTop: "#E3EEE5",
  bgBottom: "#E9F0ED",
  bg: "#F4F9F6",
  surface: "#FFFFFF",
  surface2: "#F2F5F3",
  text: "#2B3443",
  muted: "#8E9AA6",
  primary: "#4FA38F",
  primary2: "#2F8F9B",
  tealCardLeft: "#2F8F9B",
  tealCardRight: "#2F7E8F",
  success: "#5BBE88",
  danger: "#B91C1C",
  border: "#E1E7E4",
  shadow: "rgba(12,24,32,0.12)",
};

export const dularRadius = {
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
};

export const dularShadow = {
  ios: {
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
  },
  android: {
    elevation: 8,
  },
};

export function contentWidth() {
  return width * 0.86;
}

export function vw(percent: number) {
  return (width * percent) / 100;
}
