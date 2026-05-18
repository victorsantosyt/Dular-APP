/**
 * FavoritosEmpregadorScreen
 *
 * TODO(backend): conectar quando o endpoint de favoritos do empregador existir.
 * Sem endpoint disponível no momento, a tela exibe apenas empty state.
 *
 * NÃO usar mocks. Quando o endpoint estiver pronto, mapear a resposta real
 * e reaproveitar os componentes de card existentes (BuscarScreen).
 */
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";

import { DEmptyState, DScreenHeader } from "@/components/ui";
import { colors } from "@/theme";
import type { EmpregadorTabParamList } from "@/navigation/EmpregadorNavigator";

type Navigation = BottomTabNavigationProp<EmpregadorTabParamList>;

export function FavoritosEmpregadorScreen() {
  const navigation = useNavigation<Navigation>();

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <DScreenHeader
        title="Favoritos"
        onBack={() => navigation.goBack()}
      />
      <View style={s.content}>
        <DEmptyState
          icon="Heart"
          title="Nenhum favorito ainda"
          subtitle="Quando você favoritar profissionais, eles aparecerão aqui."
        />
      </View>
    </SafeAreaView>
  );
}

export default FavoritosEmpregadorScreen;

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
});
