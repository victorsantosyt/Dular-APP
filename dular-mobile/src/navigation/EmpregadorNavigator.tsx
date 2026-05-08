import { ClienteNavigator } from "@/navigation/ClienteNavigator";

// Re-exporta tipos internos para screens que já importam de ClienteNavigator
export type { ClienteTabParamList } from "@/navigation/ClienteNavigator";

export function EmpregadorNavigator() {
  return <ClienteNavigator />;
}

export default EmpregadorNavigator;
