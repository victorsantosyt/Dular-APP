import { createNavigationContainerRef } from "@react-navigation/native";

export const navRef = createNavigationContainerRef();

export function resetToAuth() {
  // O app não possui rota "Auth" registrada no navigator.
  // A tela de autenticação é exibida condicionalmente via estado de sessão (App.tsx).
  // Mantemos este helper por compatibilidade, sem dispatch de rota inválida.
}
