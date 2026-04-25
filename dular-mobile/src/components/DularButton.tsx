/**
 * DularButton — Shim de compatibilidade
 *
 * Todo o código legado que importa DularButton continua funcionando.
 * Internamente apenas delega para DButton com o mapeamento de variantes.
 *
 * @deprecated Importe DButton diretamente em código novo.
 */

import React from "react";
import { StyleProp, ViewStyle } from "react-native";
import { DButton } from "@/components/DButton";

type Props = {
  title: string;
  onPress: () => void;
  loading?: boolean;
  /** "primary" → DButton primary | "ghost" → DButton outline */
  variant?: "primary" | "ghost";
  style?: StyleProp<ViewStyle>;
};

export function DularButton({ variant = "primary", ...rest }: Props) {
  return (
    <DButton
      {...rest}
      variant={variant === "ghost" ? "outline" : "primary"}
    />
  );
}
