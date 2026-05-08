import { useNavigation } from "@react-navigation/native";
import { useRestricoes } from "@/hooks/useRestricoes";

interface UsePaywallGuardReturn {
  verificar: (
    tipo: "servicosMes" | "aceiteMes",
    onPermitido: () => void
  ) => void;
}

export function usePaywallGuard(): UsePaywallGuardReturn {
  const navigation = useNavigation<any>();
  const { restricoes, atingiuLimite } = useRestricoes();

  const verificar = (
    tipo: "servicosMes" | "aceiteMes",
    onPermitido: () => void
  ): void => {
    // Fail open — if restrictions unknown, allow the action
    if (restricoes === null) {
      onPermitido();
      return;
    }

    if (!atingiuLimite(tipo)) {
      onPermitido();
      return;
    }

    navigation.navigate("Paywall", {
      mensagem: "Você atingiu o limite do seu plano atual.",
    });
  };

  return { verificar };
}
