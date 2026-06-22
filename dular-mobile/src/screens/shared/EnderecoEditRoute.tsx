/**
 * EnderecoEditRoute — adapta a CadastroEnderecoScreen (prop-driven) para uso
 * dentro de um navigator (edição a partir do perfil). Lê { role, initial } da
 * rota e fecha a tela com goBack() ao salvar ou cancelar.
 */
import React from "react";
import { useNavigation, useRoute } from "@react-navigation/native";
import { CadastroEnderecoScreen } from "@/screens/shared/CadastroEnderecoScreen";
import type { Endereco } from "@/api/enderecoApi";

export type Role = "EMPREGADOR" | "DIARISTA" | "MONTADOR";

/** Params da rota "CadastroEndereco" (registrada nos 3 navigators). */
export type CadastroEnderecoParams = {
  role: Role;
  /** Endereço a editar (PATCH). Ausente = novo cadastro (POST). */
  initial?: Endereco | null;
};

export function EnderecoEditRoute() {
  const navigation = useNavigation();
  const route = useRoute();
  const { role = "EMPREGADOR", initial } = (route.params ?? {}) as Partial<CadastroEnderecoParams>;

  return (
    <CadastroEnderecoScreen
      role={role}
      mode="edit"
      initial={initial ?? null}
      onDone={() => navigation.goBack()}
      onCancel={() => navigation.goBack()}
    />
  );
}

export default EnderecoEditRoute;
