import type { ImageSourcePropType } from "react-native";

export type RoleImageKey = "cliente" | "diarista" | "montador";

export const roleImages: Record<RoleImageKey, ImageSourcePropType> = {
  cliente: require("../../assets/images/roles/role_cliente_card.png"),
  diarista: require("../../assets/images/roles/role_diarista_card.png"),
  // Montador reutiliza imagem diarista até asset próprio ser criado
  montador: require("../../assets/images/roles/role_diarista_card.png"),
};

export function getRoleImage(role: RoleImageKey): ImageSourcePropType {
  return roleImages[role];
}
