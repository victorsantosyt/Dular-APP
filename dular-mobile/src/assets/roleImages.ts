import type { ImageSourcePropType } from "react-native";

export type RoleImageKey = "cliente" | "diarista";

// As imagens precisam existir em assets/images/roles/.
// React Native/Expo exige require estático para empacotar assets locais.
export const roleImages: Record<RoleImageKey, ImageSourcePropType> = {
  cliente: require("../../assets/images/roles/role_cliente_card.png"),
  diarista: require("../../assets/images/roles/role_diarista_card.png"),
};

export function getRoleImage(role: RoleImageKey): ImageSourcePropType {
  return roleImages[role];
}
